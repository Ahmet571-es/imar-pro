"""
imarPRO Backend — FastAPI Ana Uygulama v2.1.0
Production-ready: Rate limiting, request logging, Sentry, TKGM cache.
"""

import sys
import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager

# Backend root'u Python path'e ekle
BACKEND_DIR = Path(__file__).parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.parcel_router import router as parcel_router
from routers.zoning_router import router as zoning_router
from routers.plan_router import router as plan_router
from routers.threed_router import router as threed_router
from routers.feasibility_router import router as feasibility_router
from routers.analysis_router import router as analysis_router
from routers.export_router import router as export_router
from routers.level6_router import router as level6_router
from routers.admin_router import router as admin_router
from middleware import RateLimitMiddleware, RequestLoggerMiddleware, setup_sentry

VERSION = "2.1.0"

# Logging + Sentry (lifespan'dan önce)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("imarpro")
_sentry_active = setup_sentry()
_rpm = int(os.getenv("RATE_LIMIT_RPM", "120"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Uygulama yaşam döngüsü — startup/shutdown."""
    from export.pdf_report import FONT_NAME
    from config.afad_ss_s1 import AFAD_81_IL
    logger.info(f"═══ imarPRO API v{VERSION} Başlatıldı ═══")
    logger.info(f"  PDF Font: {FONT_NAME}")
    logger.info(f"  AFAD İller: {len(AFAD_81_IL)}")
    logger.info(f"  Claude Key: {'✓' if os.getenv('ANTHROPIC_API_KEY') else '✗'}")
    logger.info(f"  Grok Key: {'✓' if os.getenv('XAI_API_KEY') else '✗'}")
    logger.info(f"  Sentry: {'✓' if _sentry_active else '✗'}")
    logger.info(f"  Rate Limit: {_rpm}/min")
    logger.info(f"  CORS Custom: {os.getenv('CORS_ORIGIN', '(yok)')}")
    yield
    logger.info("imarPRO API kapatılıyor...")


app = FastAPI(
    title="imarPRO API",
    description="İmar Uyumlu Kat Planı Üretici — Profesyonel Gayrimenkul Fizibilite Platformu",
    version=VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middleware Stack ──

# 1. CORS
_cors_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
]
_custom_origin = os.getenv("CORS_ORIGIN", "")
if _custom_origin:
    _cors_origins.append(_custom_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Rate Limiting
app.add_middleware(RateLimitMiddleware, requests_per_minute=_rpm, burst=20)

# 3. Request Logger + Analytics
app.add_middleware(RequestLoggerMiddleware)


# ── Routers ──
app.include_router(parcel_router)
app.include_router(zoning_router)
app.include_router(plan_router)
app.include_router(threed_router)
app.include_router(feasibility_router)
app.include_router(analysis_router)
app.include_router(export_router)
app.include_router(level6_router)
app.include_router(admin_router)


@app.get("/")
async def root():
    return {
        "name": "imarPRO API",
        "version": VERSION,
        "status": "active",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """Detaylı sağlık kontrolü — deploy monitoring için."""
    import sys as _sys
    from export.pdf_report import FONT_NAME
    from config.afad_ss_s1 import AFAD_81_IL

    return {
        "status": "ok",
        "version": VERSION,
        "python": _sys.version.split()[0],
        "services": {
            "pdf_font": FONT_NAME,
            "afad_iller": len(AFAD_81_IL),
            "sentry": _sentry_active,
            "rate_limit_rpm": _rpm,
        },
    }
