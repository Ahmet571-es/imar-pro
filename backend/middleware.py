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
                          "/api/render/styles", "/api/feasibility/iller"}

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
