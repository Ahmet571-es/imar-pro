"""
imarPRO Backend — FastAPI Ana Uygulama
"""

import sys
import os
from pathlib import Path

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

app = FastAPI(
    title="imarPRO API",
    description="İmar Uyumlu Kat Planı Üretici — Profesyonel Gayrimenkul Fizibilite Platformu",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — Vercel frontend + local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ──
app.include_router(parcel_router)
app.include_router(zoning_router)
app.include_router(plan_router)
app.include_router(threed_router)
app.include_router(feasibility_router)
app.include_router(analysis_router)
app.include_router(export_router)


@app.get("/")
async def root():
    return {
        "name": "imarPRO API",
        "version": "1.0.0",
        "status": "active",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """Detaylı sağlık kontrolü — deploy monitoring için."""
    import sys
    from export.pdf_report import FONT_NAME
    from config.afad_ss_s1 import AFAD_81_IL

    return {
        "status": "ok",
        "python": sys.version.split()[0],
        "services": {
            "pdf_font": FONT_NAME,
            "afad_iller": len(AFAD_81_IL),
        },
    }
