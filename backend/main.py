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

app = FastAPI(
    title="imarPRO API",
    description="İmar Uyumlu Kat Planı Üretici — Profesyonel Gayrimenkul Fizibilite Platformu",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ──
app.include_router(parcel_router)
app.include_router(zoning_router)


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
    return {"status": "ok"}
