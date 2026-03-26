"""
BIM API Router — IFC Export, Clash Detection, MEP Şeması, Multi-Discipline.
"""

import os
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/bim", tags=["BIM"])


# ══════════════════════════════════════
# Ortak model
# ══════════════════════════════════════

class RoomInput(BaseModel):
    name: str = "Oda"
    type: str = "salon"
    x: float = 0
    y: float = 0
    width: float = 5
    height: float = 4


class BIMRequest(BaseModel):
    rooms: list[RoomInput] = []
    buildable_width: float = Field(default=14.0, gt=0)
    buildable_height: float = Field(default=10.0, gt=0)
    kat_sayisi: int = Field(default=4, ge=1)
    kat_yuksekligi: float = Field(default=3.0, ge=2.5, le=5.0)
    proje_adi: str = Field(default="imarPRO Projesi")


# ══════════════════════════════════════
# 1. IFC EXPORT
# ══════════════════════════════════════

@router.post("/export/ifc")
async def export_ifc_file(req: BIMRequest):
    """IFC4 dosyası üretir ve indirir."""
    try:
        from export.ifc_exporter import export_ifc, get_ifc_summary

        rooms_dict = [r.model_dump() for r in req.rooms]

        output_path = export_ifc(
            rooms=rooms_dict,
            buildable_width=req.buildable_width,
            buildable_height=req.buildable_height,
            kat_sayisi=req.kat_sayisi,
            kat_yuksekligi=req.kat_yuksekligi,
            proje_adi=req.proje_adi,
        )

        return FileResponse(
            path=output_path,
            filename=f"{req.proje_adi.replace(' ', '_')}.ifc",
            media_type="application/x-step",
        )

    except ImportError as e:
        raise HTTPException(status_code=501, detail=f"IfcOpenShell yüklü değil: {e}")
    except Exception as e:
        logger.error(f"IFC export hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ifc-summary")
async def get_ifc_info(req: BIMRequest):
    """IFC dosyasının içerik özeti (indirmeden)."""
    try:
        from export.ifc_exporter import get_ifc_summary
        rooms_dict = [r.model_dump() for r in req.rooms]
        return get_ifc_summary(rooms_dict, req.kat_sayisi)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# 2. CLASH DETECTION
# ══════════════════════════════════════

class ClashRequest(BaseModel):
    rooms: list[RoomInput] = []
    kolonlar: list[dict] = []
    mep_elements: list[dict] = []
    tolerance: float = Field(default=0.05, ge=0, le=0.5)


@router.post("/clash-detection")
async def run_clash_detection(req: ClashRequest):
    """BIM çakışma kontrolü yapar."""
    try:
        from analysis.clash_detection import detect_clashes

        rooms_dict = [r.model_dump() for r in req.rooms]

        report = detect_clashes(
            rooms=rooms_dict,
            kolonlar=req.kolonlar,
            mep_elements=req.mep_elements,
            tolerance=req.tolerance,
        )

        return report.to_dict()

    except Exception as e:
        logger.error(f"Clash detection hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# 3. MEP ŞEMATİK
# ══════════════════════════════════════

class MEPRequest(BaseModel):
    rooms: list[RoomInput] = []
    buildable_width: float = Field(default=14.0, gt=0)
    buildable_height: float = Field(default=10.0, gt=0)


@router.post("/mep-schematic")
async def generate_mep(req: MEPRequest):
    """MEP tesisat şeması üretir."""
    try:
        from analysis.mep_schematic import generate_mep_schematic

        rooms_dict = [r.model_dump() for r in req.rooms]

        mep = generate_mep_schematic(
            rooms=rooms_dict,
            buildable_width=req.buildable_width,
            buildable_height=req.buildable_height,
        )

        return mep.to_dict()

    except Exception as e:
        logger.error(f"MEP şema hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# 4. MULTI-DISCIPLINE KATMAN BİLGİSİ
# ══════════════════════════════════════

@router.get("/disciplines")
async def get_disciplines():
    """BIM disiplin katmanları — frontend'de toggle için."""
    return {
        "disciplines": [
            {
                "id": "mimari",
                "name": "Mimari",
                "icon": "building",
                "color": "#0369a1",
                "elements": ["duvar", "pencere", "kapi", "doseme", "merdiven"],
                "default_visible": True,
            },
            {
                "id": "struktur",
                "name": "Strüktür",
                "icon": "columns",
                "color": "#b91c1c",
                "elements": ["kolon", "kiris", "perde", "temel"],
                "default_visible": True,
            },
            {
                "id": "elektrik",
                "name": "Elektrik",
                "icon": "zap",
                "color": "#d97706",
                "elements": ["pano", "kablo", "priz", "aydinlatma"],
                "default_visible": False,
            },
            {
                "id": "mekanik",
                "name": "Mekanik (Su/Isıtma)",
                "icon": "droplets",
                "color": "#2563eb",
                "elements": ["boru", "musluk", "radyator", "kazan"],
                "default_visible": False,
            },
            {
                "id": "havalandirma",
                "name": "Havalandırma",
                "icon": "wind",
                "color": "#059669",
                "elements": ["kanal", "menfez"],
                "default_visible": False,
            },
        ],
        "bim_level": "LOD 200",
        "not": "Mimari + Strüktür aktif, MEP katmanları toggle ile açılabilir",
    }


# ══════════════════════════════════════
# 5. BİM ÖZETİ
# ══════════════════════════════════════

@router.post("/summary")
async def bim_summary(req: BIMRequest):
    """Tüm BIM analizi tek çağrıda — IFC özeti + clash + MEP."""
    try:
        from export.ifc_exporter import get_ifc_summary
        from analysis.clash_detection import detect_clashes
        from analysis.mep_schematic import generate_mep_schematic

        rooms_dict = [r.model_dump() for r in req.rooms]

        ifc_info = get_ifc_summary(rooms_dict, req.kat_sayisi)
        clash_report = detect_clashes(rooms_dict)
        mep = generate_mep_schematic(rooms_dict, req.buildable_width, req.buildable_height)

        return {
            "ifc": ifc_info,
            "clash_detection": clash_report.to_dict(),
            "mep": mep.to_dict(),
            "bim_level": "LOD 200",
            "capabilities": [
                "IFC4 Export (duvar, döşeme, kolon)",
                "Clash Detection (oda-oda, kolon-oda, MEP-strüktür)",
                "MEP Şeması (elektrik, su, ısıtma, havalandırma)",
                "Multi-discipline katman görünümü",
            ],
        }

    except Exception as e:
        logger.error(f"BIM özet hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
