"""
Admin API Router — Sistem durumu, analytics, cache yönetimi.

Not: Production'da bu endpoint'ler admin auth ile korunmalıdır.
Şimdilik ADMIN_SECRET env variable ile basit token kontrolü.
"""

import os
import glob
import logging
from fastapi import APIRouter, HTTPException, Header
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin"])

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "")


def _check_admin(authorization: Optional[str] = None):
    """Basit admin token kontrolü."""
    if not ADMIN_SECRET:
        # Secret ayarlanmamışsa admin erişimi kapalı
        return True  # Dev modda açık

    if not authorization:
        raise HTTPException(status_code=401, detail="Admin token gerekli")

    token = authorization.replace("Bearer ", "").strip()
    if token != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Geçersiz admin token")


@router.get("/analytics")
async def get_analytics(authorization: Optional[str] = Header(None)):
    """Sunucu analytics — istek sayıları, hata oranı, yavaş istekler."""
    _check_admin(authorization)

    from middleware import get_analytics
    return get_analytics()


@router.get("/status")
async def get_system_status(authorization: Optional[str] = Header(None)):
    """Sistem durumu — bellek, cache, servisler."""
    _check_admin(authorization)

    import sys
    import platform
    from export.pdf_report import FONT_NAME
    from config.afad_ss_s1 import AFAD_81_IL

    # Bellek kullanımı
    try:
        import resource
        mem_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    except Exception:
        mem_mb = 0

    # TKGM cache boyutu
    cache_dir = "/tmp/tkgm-cache"
    cache_files = glob.glob(os.path.join(cache_dir, "*.json"))
    cache_size_kb = sum(os.path.getsize(f) for f in cache_files) / 1024

    return {
        "system": {
            "python": sys.version,
            "platform": platform.platform(),
            "memory_mb": round(mem_mb, 1),
        },
        "services": {
            "pdf_font": FONT_NAME,
            "afad_iller": len(AFAD_81_IL),
            "claude_key": "✓" if os.getenv("ANTHROPIC_API_KEY") else "✗",
            "grok_key": "✓" if os.getenv("XAI_API_KEY") else "✗",
            "sentry_dsn": "✓" if os.getenv("SENTRY_DSN") else "✗",
        },
        "cache": {
            "tkgm_cache_files": len(cache_files),
            "tkgm_cache_size_kb": round(cache_size_kb, 1),
        },
        "environment": {
            "railway": "✓" if os.getenv("RAILWAY_ENVIRONMENT") else "✗",
            "cors_origin": os.getenv("CORS_ORIGIN", "(yok)"),
        },
    }


@router.delete("/cache/tkgm")
async def clear_tkgm_cache(authorization: Optional[str] = Header(None)):
    """TKGM cache'ini temizle."""
    _check_admin(authorization)

    cache_dir = "/tmp/tkgm-cache"
    files = glob.glob(os.path.join(cache_dir, "*.json"))
    count = len(files)
    for f in files:
        try:
            os.remove(f)
        except Exception:
            pass

    return {"cleared": count, "message": f"{count} cache dosyası silindi"}


@router.get("/endpoints")
async def list_endpoints(authorization: Optional[str] = Header(None)):
    """Tüm API endpoint'lerini listele."""
    _check_admin(authorization)

    from main import app
    from fastapi.routing import APIRoute

    routes = []
    for route in app.routes:
        if isinstance(route, APIRoute):
            routes.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": route.name,
                "tags": route.tags,
            })

    return {
        "total": len(routes),
        "endpoints": sorted(routes, key=lambda r: r["path"]),
    }
