"""
Production Middleware — Rate Limiting, Request Logging, Sentry, Timing.

SaaS gereksinimleri:
- Rate limiting: IP başına dakikada max istek (DDoS/spam koruması)
- Request logging: Her istek loglanır (analytics, debug)
- Sentry: Unhandled exception tracking
- Timing: Her isteğin süresini header'da döner
"""

import os
import time
import logging
from collections import defaultdict
from datetime import datetime
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("imarpro.middleware")


# ══════════════════════════════════════
# 1. RATE LIMITER
# ══════════════════════════════════════

class RateLimitMiddleware(BaseHTTPMiddleware):
    """IP bazlı rate limiting — in-memory token bucket.

    Production'da Redis kullanılması önerilir ama
    tek instance Railway için in-memory yeterli.
    """

    def __init__(self, app, requests_per_minute: int = 60, burst: int = 10):
        super().__init__(app)
        self.rpm = requests_per_minute
        self.burst = burst
        self._buckets: dict[str, dict] = defaultdict(
            lambda: {"tokens": burst, "last_refill": time.time()}
        )
        # Beyaz liste — rate limit uygulanmayan path'ler
        self._whitelist = {"/", "/health", "/docs", "/redoc", "/openapi.json",
                          "/api/zoning/defaults", "/api/earthquake/zemin-siniflari",
                          "/api/earthquake/afad-iller", "/api/energy/options",
                          "/api/render/styles", "/api/feasibility/iller",
                          "/api/bim/disciplines"}

    def _get_client_ip(self, request: Request) -> str:
        """Gerçek client IP — proxy arkasında X-Forwarded-For kullan."""
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _refill(self, bucket: dict) -> None:
        """Token bucket refill — zaman bazlı."""
        now = time.time()
        elapsed = now - bucket["last_refill"]
        refill = elapsed * (self.rpm / 60.0)
        bucket["tokens"] = min(self.burst, bucket["tokens"] + refill)
        bucket["last_refill"] = now

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Whitelist path'leri atla
        if request.url.path in self._whitelist:
            return await call_next(request)

        ip = self._get_client_ip(request)

        # Test client'ı rate limit'ten muaf tut
        if ip == "testclient":
            return await call_next(request)

        bucket = self._buckets[ip]
        self._refill(bucket)

        if bucket["tokens"] < 1:
            logger.warning(f"Rate limit aşıldı: {ip} → {request.url.path}")
            return Response(
                content='{"detail":"Rate limit aşıldı. Lütfen biraz bekleyin."}',
                status_code=429,
                media_type="application/json",
                headers={
                    "Retry-After": "10",
                    "X-RateLimit-Limit": str(self.rpm),
                    "X-RateLimit-Remaining": "0",
                },
            )

        bucket["tokens"] -= 1

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.rpm)
        response.headers["X-RateLimit-Remaining"] = str(int(bucket["tokens"]))
        return response


# ══════════════════════════════════════
# 2. REQUEST LOGGER + ANALYTICS
# ══════════════════════════════════════

# In-memory analytics store (production'da DB'ye yazılmalı)
_request_stats: dict = {
    "total_requests": 0,
    "requests_by_path": defaultdict(int),
    "requests_by_method": defaultdict(int),
    "errors_count": 0,
    "avg_response_time_ms": 0.0,
    "_total_time": 0.0,
    "started_at": datetime.now(tz=None).isoformat(),
    "last_request_at": "",
    "unique_ips": set(),
    "slow_requests": [],  # > 5 saniye
}


class RequestLoggerMiddleware(BaseHTTPMiddleware):
    """Her isteği loglar ve analytics toplar."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.time()
        ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if not ip and request.client:
            ip = request.client.host

        # Process request
        try:
            response = await call_next(request)
        except Exception as e:
            _request_stats["errors_count"] += 1
            logger.error(f"Unhandled error: {request.method} {request.url.path} — {e}")
            raise

        # Timing
        duration_ms = (time.time() - start) * 1000

        # Analytics güncelle
        _request_stats["total_requests"] += 1
        _request_stats["requests_by_path"][request.url.path] += 1
        _request_stats["requests_by_method"][request.method] += 1
        _request_stats["_total_time"] += duration_ms
        _request_stats["avg_response_time_ms"] = (
            _request_stats["_total_time"] / _request_stats["total_requests"]
        )
        _request_stats["last_request_at"] = datetime.now(tz=None).isoformat()
        if ip:
            _request_stats["unique_ips"].add(ip)

        if response.status_code >= 400:
            _request_stats["errors_count"] += 1

        # Slow request tracking
        if duration_ms > 5000:
            _request_stats["slow_requests"].append({
                "path": request.url.path,
                "method": request.method,
                "duration_ms": round(duration_ms),
                "status": response.status_code,
                "time": datetime.now(tz=None).isoformat(),
            })
            # Son 50 yavaş isteği tut
            _request_stats["slow_requests"] = _request_stats["slow_requests"][-50:]

        # Response header
        response.headers["X-Response-Time"] = f"{duration_ms:.0f}ms"

        # Log
        log_level = logging.WARNING if response.status_code >= 400 else logging.INFO
        if request.url.path not in ("/", "/health", "/docs", "/redoc", "/openapi.json"):
            logger.log(
                log_level,
                f"{request.method} {request.url.path} → {response.status_code} "
                f"({duration_ms:.0f}ms) [{ip}]"
            )

        return response


def get_analytics() -> dict:
    """Analytics verisini döndürür (admin endpoint için)."""
    return {
        "total_requests": _request_stats["total_requests"],
        "unique_visitors": len(_request_stats["unique_ips"]),
        "errors_count": _request_stats["errors_count"],
        "error_rate": (
            f"{_request_stats['errors_count'] / max(_request_stats['total_requests'], 1) * 100:.1f}%"
        ),
        "avg_response_time_ms": round(_request_stats["avg_response_time_ms"], 1),
        "started_at": _request_stats["started_at"],
        "last_request_at": _request_stats["last_request_at"],
        "top_endpoints": dict(
            sorted(
                _request_stats["requests_by_path"].items(),
                key=lambda x: x[1], reverse=True
            )[:15]
        ),
        "methods": dict(_request_stats["requests_by_method"]),
        "slow_requests": _request_stats["slow_requests"][-10:],
    }


# ══════════════════════════════════════
# 3. SENTRY INTEGRATION
# ══════════════════════════════════════

def setup_sentry(dsn: str | None = None):
    """Sentry hata takibi başlatır.

    Railway env: SENTRY_DSN=https://xxx@sentry.io/xxx
    """
    sentry_dsn = dsn or os.getenv("SENTRY_DSN", "")
    if not sentry_dsn:
        logger.info("Sentry DSN ayarlanmamış — hata takibi kapalı")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=sentry_dsn,
            integrations=[
                StarletteIntegration(transaction_style="endpoint"),
                FastApiIntegration(transaction_style="endpoint"),
            ],
            traces_sample_rate=0.2,  # %20 performans izleme
            profiles_sample_rate=0.1,
            environment=os.getenv("RAILWAY_ENVIRONMENT", "development"),
            release=f"imarpro@2.0.0",
            send_default_pii=False,  # KVKK — kişisel veri gönderme
        )
        logger.info("Sentry hata takibi aktif")
        return True
    except ImportError:
        logger.debug("sentry-sdk yüklü değil — pip install sentry-sdk[fastapi]")
        return False
    except Exception as e:
        logger.warning(f"Sentry başlatma hatası: {e}")
        return False


# ══════════════════════════════════════
# 4. SUPABASE JWT VERIFICATION
# ══════════════════════════════════════

_SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")


def verify_supabase_token(authorization: str | None) -> dict | None:
    """Supabase JWT token'ını doğrular.

    Returns:
        Token payload (user_id, email vb.) veya None (geçersiz/eksik).

    Kullanım (router'da):
        user = verify_supabase_token(request.headers.get("Authorization"))
        if not user:
            raise HTTPException(401, "Oturum gerekli")
    """
    if not _SUPABASE_JWT_SECRET:
        return None  # JWT doğrulama kapalı — SUPABASE_JWT_SECRET ayarlanmamış

    if not authorization:
        return None

    token = authorization.replace("Bearer ", "").strip()
    if not token:
        return None

    try:
        import jwt
        payload = jwt.decode(
            token,
            _SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return {
            "user_id": payload.get("sub"),
            "email": payload.get("email"),
            "role": payload.get("role", "authenticated"),
            "exp": payload.get("exp"),
        }
    except ImportError:
        logger.debug("PyJWT yüklü değil — pip install PyJWT")
        return None
    except Exception as e:
        logger.debug(f"JWT doğrulama hatası: {e}")
        return None


# ══════════════════════════════════════
# 5. SECURITY HEADERS MIDDLEWARE
# ══════════════════════════════════════

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Güvenlik header'ları — OWASP önerileri."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # XSS koruması
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # HSTS (sadece production'da)
        if os.getenv("RAILWAY_ENVIRONMENT") == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Permissions Policy
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"

        return response


# ══════════════════════════════════════
# 6. USAGE TRACKING MIDDLEWARE
# ══════════════════════════════════════

# AI endpoint'leri — kullanım takibi yapılacak
_TRACKED_ENDPOINTS = {
    "/api/plan/generate": "plan_generate",
    "/api/feasibility/ai-yorum": "ai_review",
    "/api/render/generate": "render_room",
    "/api/render/exterior": "render_exterior",
    "/api/export/pdf": "pdf_export",
    "/api/export/dxf": "dxf_export",
    "/api/bim/export/ifc": "ifc_export",
    "/api/imar/parse-pdf": "imar_pdf_parse",
    "/api/plan/multi-floor": "multi_floor_plan",
}

# AI kredisi harcayan endpoint'ler (quota kontrolü yapılır)
_AI_CREDIT_ENDPOINTS = {
    "/api/plan/generate", "/api/feasibility/ai-yorum",
    "/api/render/generate", "/api/render/exterior",
    "/api/imar/parse-pdf", "/api/plan/multi-floor",
}


class UsageTrackingMiddleware(BaseHTTPMiddleware):
    """Kullanıcı bazlı kullanım takibi + AI quota kontrolü."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Sadece POST ve tracked endpoint'ler
        if request.method != "POST" or request.url.path not in _TRACKED_ENDPOINTS:
            return await call_next(request)

        # Kullanıcı tespiti
        user = verify_supabase_token(request.headers.get("Authorization"))
        demo_id = request.headers.get("X-Demo-User-Id", "")

        # AI quota kontrolü (gerçek kullanıcılar için)
        if user and request.url.path in _AI_CREDIT_ENDPOINTS:
            quota_ok = _check_ai_quota(user["user_id"])
            if not quota_ok:
                return Response(
                    content='{"detail":"Aylık AI kullanım limitiniz doldu. Pro plana yükseltin."}',
                    status_code=429,
                    media_type="application/json",
                )

        start = time.time()
        response = await call_next(request)
        duration_ms = int((time.time() - start) * 1000)

        # Supabase'e log yaz + AI sayacını artır
        if user and response.status_code == 200:
            action = _TRACKED_ENDPOINTS[request.url.path]
            is_ai = request.url.path in _AI_CREDIT_ENDPOINTS
            _log_usage_async(
                user_id=user["user_id"],
                action=action,
                duration_ms=duration_ms,
                increment_ai=is_ai,
            )

        return response


def _check_ai_quota(user_id: str) -> bool:
    """AI kullanım kotası kontrolü."""
    try:
        supabase_url = os.getenv("SUPABASE_URL", "")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not supabase_url or not service_key:
            return True  # Supabase yoksa geçir

        import requests as req
        resp = req.get(
            f"{supabase_url}/rest/v1/profiles?id=eq.{user_id}&select=ai_calls_used,max_ai_calls_monthly",
            headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
            timeout=2,
        )
        if resp.status_code == 200:
            data = resp.json()
            if data:
                used = data[0].get("ai_calls_used", 0)
                max_calls = data[0].get("max_ai_calls_monthly", 10)
                if max_calls > 0 and used >= max_calls:
                    return False
        return True
    except Exception:
        return True  # Hata durumunda geçir


def _log_usage_async(user_id: str, action: str, duration_ms: int = 0, increment_ai: bool = False):
    """Supabase usage_log'a asenkron yaz (hata yutulur)."""
    try:
        supabase_url = os.getenv("SUPABASE_URL", "")
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not supabase_url or not service_key:
            return

        import requests as req
        # Usage log yaz
        req.post(
            f"{supabase_url}/rest/v1/usage_log",
            json={"user_id": user_id, "action": action, "duration_ms": duration_ms},
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            timeout=2,
        )

        # AI sayacını artır
        if increment_ai:
            req.post(
                f"{supabase_url}/rest/v1/rpc/increment_ai_usage",
                json={"p_user_id": user_id, "p_action": action, "p_tokens": 0},
                headers={
                    "apikey": service_key,
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json",
                },
                timeout=2,
            )
    except Exception:
        pass  # Kullanım logu yazılamazsa sessizce devam et

