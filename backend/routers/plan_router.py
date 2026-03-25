"""
AI Plan API Router — Plan üretimi, puanlama.
"""

import os
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from core.parcel import Parsel
from core.zoning import ImarParametreleri, hesapla
from ai.dual_ai_engine import generate_dual_ai_plans
from utils.geometry_helpers import polygon_to_coords_list

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plan", tags=["AI Plan"])


class PlanOda(BaseModel):
    isim: str
    tip: str
    m2: float


class PlanGenerateRequest(BaseModel):
    # Parsel
    parsel_tipi: str = "dikdortgen"
    en: Optional[float] = None
    boy: Optional[float] = None
    koordinatlar: Optional[list[dict]] = None
    yon: str = "kuzey"

    # İmar
    kat_adedi: int = 4
    taks: float = 0.35
    kaks: float = 1.40
    on_bahce: float = 5.0
    yan_bahce: float = 3.0
    arka_bahce: float = 3.0

    # Daire programı
    daire_tipi: str = Field(default="3+1")
    brut_alan: Optional[float] = None
    odalar: Optional[list[PlanOda]] = None
    sun_direction: str = "south"

    # AI ayarları
    claude_api_key: Optional[str] = None
    grok_api_key: Optional[str] = None


@router.post("/generate")
async def generate_plan(req: PlanGenerateRequest):
    """AI ile plan üretimi — 3 alternatif döndürür."""
    try:
        # 1. Parsel oluştur
        if req.parsel_tipi == "dikdortgen" and req.en and req.boy:
            parsel = Parsel.from_dikdortgen(req.en, req.boy, yon=req.yon)
        elif req.koordinatlar:
            coords = [(c["x"], c["y"]) for c in req.koordinatlar]
            parsel = Parsel.from_koordinatlar(coords, yon=req.yon)
        else:
            raise ValueError("Parsel bilgisi eksik")

        # 2. İmar hesapla → çekme sonrası poligon
        imar = ImarParametreleri(
            kat_adedi=req.kat_adedi,
            taks=req.taks,
            kaks=req.kaks,
            on_bahce=req.on_bahce,
            yan_bahce=req.yan_bahce,
            arka_bahce=req.arka_bahce,
        )
        sonuc = hesapla(parsel.polygon, imar)

        # Yapılaşma alanı koordinatları
        if sonuc.cekme_polygonu and not sonuc.cekme_polygonu.is_empty:
            buildable_coords = list(sonuc.cekme_polygonu.exterior.coords)
        else:
            buildable_coords = list(parsel.polygon.exterior.coords)

        # 3. Daire programı
        brut_alan = req.brut_alan or sonuc.kat_basi_net_alan
        if req.odalar:
            odalar = [{"isim": o.isim, "tip": o.tip, "m2": o.m2} for o in req.odalar]
        else:
            # Varsayılan oda programı
            from config.room_defaults import get_default_rooms
            default_rooms = get_default_rooms(req.daire_tipi)
            odalar = [
                {"isim": r["isim"], "tip": r["tip"], "m2": r["varsayilan_m2"]}
                for r in default_rooms
            ]

        apartment_program = {
            "tip": req.daire_tipi,
            "brut_alan": brut_alan,
            "odalar": odalar,
        }

        # 4. Dual AI plan üretimi
        claude_key = req.claude_api_key or os.getenv("ANTHROPIC_API_KEY", "")
        grok_key = req.grok_api_key or os.getenv("XAI_API_KEY", "")

        result = generate_dual_ai_plans(
            buildable_polygon_coords=buildable_coords,
            apartment_program=apartment_program,
            dataset_rules={},
            sun_best_direction=req.sun_direction,
            claude_api_key=claude_key,
            grok_api_key=grok_key,
            max_iterations=1,
        )

        # 5. Yapılaşma sınırlarını da döndür
        xs = [c[0] for c in buildable_coords]
        ys = [c[1] for c in buildable_coords]

        return {
            "plans": result.to_dict()["best_plans"],
            "all_plans_count": result.to_dict()["all_plans_count"],
            "summary": result.summary,
            "buildable_area": {
                "coords": [{"x": round(c[0], 2), "y": round(c[1], 2)} for c in buildable_coords],
                "width": round(max(xs) - min(xs), 2),
                "height": round(max(ys) - min(ys), 2),
                "area": round(sonuc.cekme_sonrasi_alan, 2),
            },
            "apartment_program": apartment_program,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Plan üretim hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Plan üretim hatası: {str(e)}")


@router.post("/score")
async def score_existing_plan(plan_data: dict):
    """Mevcut planı puanla."""
    from core.plan_scorer import score_plan, FloorPlan, PlanRoom

    rooms = []
    for r in plan_data.get("rooms", []):
        rooms.append(PlanRoom(
            name=r["name"], room_type=r["type"],
            x=r["x"], y=r["y"],
            width=r["width"], height=r["height"],
            has_exterior_wall=r.get("is_exterior", False),
            facing_direction=r.get("facing", ""),
        ))

    fp = FloorPlan(rooms=rooms, total_area=sum(r.area for r in rooms))
    score = score_plan(fp, sun_best_direction=plan_data.get("sun_direction", "south"))

    return {
        "score": score.to_dict(),
        "total": round(score.total, 1),
        "details": score.details,
    }
