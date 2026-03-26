"""
BIM API Router — IFC Export (LOD 300), Clash Detection, MEP Şeması, Multi-Discipline.
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
# Ortak modeller
# ══════════════════════════════════════

class RoomInput(BaseModel):
    name: str = "Oda"
    type: str = "salon"
    x: float = 0
    y: float = 0
    width: float = 5
    height: float = 4
    is_exterior: bool = False
    facing: str = ""


class KolonGridInput(BaseModel):
    x_akslar: list[float] = []
    y_akslar: list[float] = []
    kolon_boyut: tuple[float, float] = (0.30, 0.50)


class MerdivenInput(BaseModel):
    x: float = 5.0
    y: float = 3.5
    genislik: float = 2.4
    derinlik: float = 3.0


class BIMRequest(BaseModel):
    rooms: list[RoomInput] = []
    buildable_width: float = Field(default=14.0, gt=0)
    buildable_height: float = Field(default=10.0, gt=0)
    kat_sayisi: int = Field(default=4, ge=1)
    kat_yuksekligi: float = Field(default=3.0, ge=2.5, le=5.0)
    proje_adi: str = Field(default="imarPRO Projesi")
    kolon_grid: Optional[KolonGridInput] = None
    merdiven: Optional[MerdivenInput] = None


# ══════════════════════════════════════
# 1. IFC EXPORT (LOD 300)
# ══════════════════════════════════════

@router.post("/export/ifc")
async def export_ifc_file(req: BIMRequest):
    """IFC4 dosyası üretir ve indirir (LOD 300)."""
    try:
        from export.ifc_exporter import export_ifc

        rooms_dict = [r.model_dump() for r in req.rooms]
        kolon_dict = req.kolon_grid.model_dump() if req.kolon_grid else None
        merdiven_dict = req.merdiven.model_dump() if req.merdiven else None

        output_path = export_ifc(
            rooms=rooms_dict,
            buildable_width=req.buildable_width,
            buildable_height=req.buildable_height,
            kat_sayisi=req.kat_sayisi,
            kat_yuksekligi=req.kat_yuksekligi,
            proje_adi=req.proje_adi,
            kolon_grid=kolon_dict,
            merdiven_pozisyon=merdiven_dict,
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
        kolon_dict = req.kolon_grid.model_dump() if req.kolon_grid else None
        return get_ifc_summary(
            rooms_dict, req.kat_sayisi,
            kolon_grid=kolon_dict,
            buildable_width=req.buildable_width,
            buildable_height=req.buildable_height,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# 2. CLASH DETECTION (3D + tolerans + çözüm önerisi)
# ══════════════════════════════════════

class ClashRequest(BaseModel):
    rooms: list[RoomInput] = []
    kolonlar: list[dict] = []
    mep_elements: list[dict] = []
    tolerance: float = Field(default=0.05, ge=0, le=0.5)
    kat_sayisi: int = Field(default=1, ge=1)
    kat_yuksekligi: float = Field(default=3.0, ge=2.5)


@router.post("/clash-detection")
async def run_clash_detection(req: ClashRequest):
    """BIM çakışma kontrolü — 3D AABB, tolerans bazlı, çözüm önerili."""
    try:
        from analysis.clash_detection import detect_clashes

        rooms_dict = [r.model_dump() for r in req.rooms]

        report = detect_clashes(
            rooms=rooms_dict,
            kolonlar=req.kolonlar,
            mep_elements=req.mep_elements,
            tolerance=req.tolerance,
            kat_sayisi=req.kat_sayisi,
            kat_yuksekligi=req.kat_yuksekligi,
        )

        return report.to_dict()

    except Exception as e:
        logger.error(f"Clash detection hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# 3. MEP ŞEMATİK (gelişmiş)
# ══════════════════════════════════════

class MEPRequest(BaseModel):
    rooms: list[RoomInput] = []
    buildable_width: float = Field(default=14.0, gt=0)
    buildable_height: float = Field(default=10.0, gt=0)
    kat_sayisi: int = Field(default=1, ge=1)


@router.post("/mep-schematic")
async def generate_mep(req: MEPRequest):
    """MEP tesisat şeması — 6 disiplin, dirsek, boru çapı, yangın tesisatı."""
    try:
        from analysis.mep_schematic import generate_mep_schematic

        rooms_dict = [r.model_dump() for r in req.rooms]

        mep = generate_mep_schematic(
            rooms=rooms_dict,
            buildable_width=req.buildable_width,
            buildable_height=req.buildable_height,
            kat_sayisi=req.kat_sayisi,
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
                "elements": ["pano", "kablo", "priz", "aydinlatma", "topraklama"],
                "default_visible": False,
            },
            {
                "id": "mekanik",
                "name": "Mekanik (Su/Isıtma)",
                "icon": "droplets",
                "color": "#2563eb",
                "elements": ["temiz_su_boru", "pis_su_boru", "musluk", "radyator", "kazan"],
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
            {
                "id": "yangin",
                "name": "Yangın Tesisatı",
                "icon": "flame",
                "color": "#dc2626",
                "elements": ["yangin_dolabi", "sprinkler", "yangin_boru"],
                "default_visible": False,
            },
        ],
        "bim_level": "LOD 300",
        "not": "Mimari + Strüktür aktif, MEP/yangın katmanları toggle ile açılabilir",
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
        kolon_dict = req.kolon_grid.model_dump() if req.kolon_grid else None

        ifc_info = get_ifc_summary(
            rooms_dict, req.kat_sayisi,
            kolon_grid=kolon_dict,
            buildable_width=req.buildable_width,
            buildable_height=req.buildable_height,
        )
        clash_report = detect_clashes(rooms_dict)
        mep = generate_mep_schematic(rooms_dict, req.buildable_width, req.buildable_height)

        return {
            "ifc": ifc_info,
            "clash_detection": clash_report.to_dict(),
            "mep": mep.to_dict(),
            "bim_level": "LOD 300",
            "capabilities": [
                "IFC4 Export — LOD 300 (duvar, döşeme, pencere, kapı, kolon, merdiven, hacim)",
                "IfcMaterial — 5 malzeme (beton, tuğla, cam, ahşap, çelik)",
                "IfcPropertySet — yangın/ses/ısı performans verileri",
                "Clash Detection — 3D AABB, hard/soft/clearance, çözüm önerili",
                "MEP Şeması — 6 disiplin (elektrik, temiz su, pis su, ısıtma, havalandırma, yangın)",
                "Multi-discipline katman görünümü (6 katman toggle)",
            ],
        }

    except Exception as e:
        logger.error(f"BIM özet hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
