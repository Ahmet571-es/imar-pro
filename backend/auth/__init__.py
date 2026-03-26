"""
Auth Guard Sistemi — imarPRO SaaS
Reusable decorator'lar ve dependency injection fonksiyonları.

Kullanım:
    @router.get("/api/protected")
    async def endpoint(user: AuthUser = Depends(require_auth)):
        ...

    @router.post("/api/admin-only")
    async def endpoint(user: AuthUser = Depends(require_role("admin"))):
        ...

    @router.post("/api/ai-plan")
    async def endpoint(user: AuthUser = Depends(require_ai_quota)):
        ...
"""

import os
import time
import logging
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass, field

from fastapi import Request, HTTPException, Depends

logger = logging.getLogger("imarpro.auth")

# ── Supabase client (lazy) ──
_supabase = None


def _get_sb():
    """Lazy Supabase service-role client."""
    global _supabase
    if _supabase:
        return _supabase
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        _supabase = create_client(url, key)
        return _supabase
    except Exception as e:
        logger.warning(f"Supabase bağlantı hatası: {e}")
        return None


# ══════════════════════════════════════
# 1. AUTH USER MODEL
# ══════════════════════════════════════

@dataclass
class AuthUser:
    """Kimliği doğrulanmış kullanıcı."""
    user_id: str
    email: str = ""
    role: str = "user"
    plan: str = "free"
    max_projects: int = 3
    max_ai_calls: int = 10
    ai_calls_used: int = 0
    org_ids: list = field(default_factory=list)
    is_demo: bool = False

    @property
    def is_admin(self) -> bool:
        return self.role in ("admin", "superadmin")

    @property
    def is_pro(self) -> bool:
        return self.plan in ("pro", "enterprise")

    @property
    def ai_remaining(self) -> int:
        if self.max_ai_calls <= 0:
            return 999  # Sınırsız
        return max(0, self.max_ai_calls - self.ai_calls_used)

    @property
    def can_use_ai(self) -> bool:
        return self.max_ai_calls <= 0 or self.ai_calls_used < self.max_ai_calls


# ══════════════════════════════════════
# 2. TOKEN VERIFICATION
# ══════════════════════════════════════

_jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "")


def _verify_jwt(token: str) -> dict | None:
    """Supabase JWT token doğrula."""
    if not _jwt_secret:
        return None
    try:
        import jwt
        payload = jwt.decode(token, _jwt_secret, algorithms=["HS256"], audience="authenticated")
        return {
            "user_id": payload.get("sub"),
            "email": payload.get("email", ""),
            "role": payload.get("role", "authenticated"),
        }
    except Exception:
        return None


def _extract_user_from_request(request: Request) -> AuthUser | None:
    """Request'ten kullanıcı bilgisini çıkar (JWT, publishable key, veya demo)."""

    # 1. JWT token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer ") and not auth_header.startswith("Bearer sb_"):
        token = auth_header[7:].strip()
        jwt_data = _verify_jwt(token)
        if jwt_data:
            # Supabase'den profil bilgisi çek
            profile = _get_profile(jwt_data["user_id"])
            if profile:
                return AuthUser(
                    user_id=jwt_data["user_id"],
                    email=profile.get("email", jwt_data.get("email", "")),
                    role=profile.get("role", "user"),
                    plan=profile.get("plan", "free"),
                    max_projects=profile.get("max_projects", 3),
                    max_ai_calls=profile.get("max_ai_calls_monthly", 10),
                    ai_calls_used=profile.get("ai_calls_used", 0),
                )
            return AuthUser(user_id=jwt_data["user_id"], email=jwt_data.get("email", ""))

    # 2. Demo mod
    demo_id = request.headers.get("X-Demo-User-Id", "")
    if demo_id:
        return AuthUser(user_id=demo_id, email="demo@imarpro.dev", is_demo=True)

    return None


# Profile cache (5 dakika)
_profile_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 300  # 5 dakika


def _get_profile(user_id: str) -> dict | None:
    """Supabase'den profil bilgisi çek (cache'li)."""
    now = time.time()

    # Cache kontrol
    if user_id in _profile_cache:
        cached_time, cached_data = _profile_cache[user_id]
        if now - cached_time < _CACHE_TTL:
            return cached_data

    sb = _get_sb()
    if not sb:
        return None

    try:
        result = sb.table("profiles").select("*").eq("id", user_id).single().execute()
        if result.data:
            _profile_cache[user_id] = (now, result.data)
            # Son aktiflik güncelle (fire-and-forget)
            try:
                sb.table("profiles").update({"last_active_at": datetime.utcnow().isoformat()}).eq("id", user_id).execute()
            except Exception:
                pass
            return result.data
    except Exception as e:
        logger.debug(f"Profil çekme hatası: {e}")

    return None


def invalidate_profile_cache(user_id: str):
    """Profil cache'ini temizle (güncelleme sonrası)."""
    _profile_cache.pop(user_id, None)


# ══════════════════════════════════════
# 3. DEPENDENCY INJECTION GUARDS
# ══════════════════════════════════════

async def require_auth(request: Request) -> AuthUser:
    """Oturum zorunlu — yoksa 401.

    Kullanım: user: AuthUser = Depends(require_auth)
    """
    user = _extract_user_from_request(request)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Oturum gerekli. Lütfen giriş yapın.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def optional_auth(request: Request) -> AuthUser | None:
    """Opsiyonel auth — giriş yapılmamışsa None döner.

    Kullanım: user: AuthUser | None = Depends(optional_auth)
    """
    return _extract_user_from_request(request)


def require_role(*roles: str):
    """Belirli rol(ler) zorunlu.

    Kullanım: user: AuthUser = Depends(require_role("admin", "superadmin"))
    """
    async def _guard(request: Request) -> AuthUser:
        user = await require_auth(request)
        if user.is_demo:
            return user  # Demo modda rol kontrolü yapma
        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Bu işlem için {'/'.join(roles)} yetkisi gerekli. Mevcut rolünüz: {user.role}",
            )
        return user
    return _guard


def require_plan(*plans: str):
    """Belirli plan zorunlu.

    Kullanım: user: AuthUser = Depends(require_plan("pro", "enterprise"))
    """
    async def _guard(request: Request) -> AuthUser:
        user = await require_auth(request)
        if user.is_demo:
            return user
        if user.plan not in plans:
            raise HTTPException(
                status_code=403,
                detail=f"Bu özellik {'/'.join(plans)} planı gerektirir. Mevcut planınız: {user.plan}",
            )
        return user
    return _guard


async def require_ai_quota(request: Request) -> AuthUser:
    """AI kullanım kotası kontrolü.

    Kullanım: user: AuthUser = Depends(require_ai_quota)
    """
    user = await require_auth(request)
    if user.is_demo:
        return user

    if not user.can_use_ai:
        raise HTTPException(
            status_code=429,
            detail=f"Aylık AI kullanım limitiniz doldu ({user.max_ai_calls} çağrı). "
                   f"Pro plana yükseltin veya ay sonunu bekleyin.",
        )
    return user


async def require_project_quota(request: Request) -> AuthUser:
    """Proje oluşturma kotası kontrolü."""
    user = await require_auth(request)
    if user.is_demo:
        return user

    sb = _get_sb()
    if sb:
        try:
            result = sb.table("projects").select("id", count="exact").eq("user_id", user.user_id).neq("status", "archived").execute()
            current_count = result.count or 0
            if user.max_projects > 0 and current_count >= user.max_projects:
                raise HTTPException(
                    status_code=403,
                    detail=f"Proje limitiniz doldu ({current_count}/{user.max_projects}). "
                           f"Pro plana yükseltin veya mevcut projeleri arşivleyin.",
                )
        except HTTPException:
            raise
        except Exception:
            pass  # DB hatası — geçir

    return user


# ══════════════════════════════════════
# 4. AI USAGE TRACKING
# ══════════════════════════════════════

def track_ai_usage(user: AuthUser, action: str, tokens: int = 0, project_id: str | None = None):
    """AI kullanımını logla + sayacı artır.

    Backend'den çağrılır (endpoint içinde):
        track_ai_usage(user, "plan_generate", tokens=1500)
    """
    if user.is_demo:
        return

    sb = _get_sb()
    if not sb:
        return

    try:
        # Profil sayacını artır
        sb.rpc("increment_ai_usage", {"p_user_id": user.user_id, "p_action": action, "p_tokens": tokens}).execute()

        # Cache'i invalidate et
        invalidate_profile_cache(user.user_id)
    except Exception as e:
        logger.warning(f"AI usage tracking hatası: {e}")


# ══════════════════════════════════════
# 5. AUDIT LOG
# ══════════════════════════════════════

def audit_log(user: AuthUser | None, action: str, resource: str = "", details: dict | None = None, ip: str = ""):
    """Güvenlik denetim kaydı.

    Örnek:
        audit_log(user, "login", details={"method": "email"})
        audit_log(user, "project_delete", resource="proj-123")
        audit_log(None, "login_failed", details={"email": "x@y.com", "reason": "wrong_password"})
    """
    sb = _get_sb()

    log_entry = {
        "user_id": user.user_id if user else None,
        "action": action,
        "metadata": {
            "resource": resource,
            "ip": ip,
            **(details or {}),
            "timestamp": datetime.utcnow().isoformat(),
        },
    }

    if sb and user and not user.is_demo:
        try:
            sb.table("usage_log").insert(log_entry).execute()
        except Exception:
            pass

    # Her zaman logla (Supabase olmasa bile)
    logger.info(f"AUDIT: {action} | user={user.user_id if user else 'anon'} | {resource} | {details}")


# ══════════════════════════════════════
# 6. INPUT SANITIZATION
# ══════════════════════════════════════

import re
import html


def sanitize_string(value: str, max_length: int = 500) -> str:
    """String girdisini temizle — XSS ve injection koruması."""
    if not value:
        return ""
    # HTML escape
    value = html.escape(value.strip())
    # Max uzunluk
    value = value[:max_length]
    # Null byte temizle
    value = value.replace("\x00", "")
    return value


def sanitize_email(email: str) -> str:
    """Email formatı doğrula ve temizle."""
    email = email.strip().lower()
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        raise HTTPException(400, "Geçersiz email adresi")
    return email


def sanitize_slug(slug: str) -> str:
    """URL-safe slug doğrula."""
    slug = slug.strip().lower()
    if not re.match(r'^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$', slug):
        raise HTTPException(400, "Geçersiz slug (küçük harf, rakam ve tire, 3-50 karakter)")
    return slug


def validate_password(password: str) -> str:
    """Şifre güvenlik kontrolü."""
    if len(password) < 8:
        raise HTTPException(400, "Şifre en az 8 karakter olmalı")
    if len(password) > 128:
        raise HTTPException(400, "Şifre çok uzun (max 128 karakter)")
    return password
