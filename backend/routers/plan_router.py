"""
AI Plan API Router — Plan üretimi, puanlama, layout engine entegrasyonu.

API Key'ler iki yerden okunur:
  1. Request body: claude_api_key, grok_api_key
  2. HTTP Header: X-Claude-Api-Key, X-Grok-Api-Key (frontend settingsStore'dan)
"""

import os
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional

from core.parcel import Parsel
from core.zoning import ImarParametreleri, hesapla
from core.layout_engine import LayoutEngine, build_room_program
from ai.dual_ai_engine import generate_dual_ai_plans
from core.plan_scorer import score_plan

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

    # AI ayarları (body'den — opsiyonel)
    claude_api_key: Optional[str] = None
    grok_api_key: Optional[str] = None


def _extract_api_keys(request: Request, body_claude: str | None, body_grok: str | None) -> tuple[str, str]:
    """API key'leri header > body > env sırasıyla al."""
    claude_key = (
        request.headers.get("X-Claude-Api-Key", "").strip()
        or (body_claude or "").strip()
        or os.getenv("ANTHROPIC_API_KEY", "")
    )
    grok_key = (
        request.headers.get("X-Grok-Api-Key", "").strip()
        or (body_grok or "").strip()
        or os.getenv("XAI_API_KEY", "")
    )
    return claude_key, grok_key


@router.post("/generate")
async def generate_plan(req: PlanGenerateRequest, request: Request):
    """AI ile plan üretimi — layout engine + dual AI.
    
    API key yoksa layout engine demo planları üretir (5 strateji).
    API key varsa Claude+Grok mimari program üretir → layout engine yerleştirir.
    """
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

        # Yapılaşma boyutları
        xs = [c[0] for c in buildable_coords]
        ys = [c[1] for c in buildable_coords]
        bw = max(xs) - min(xs)
        bh = max(ys) - min(ys)
        ox = min(xs)
        oy = min(ys)

        # 3. Daire programı
        brut_alan = req.brut_alan or sonuc.kat_basi_net_alan
        if req.odalar:
            odalar = [{"isim": o.isim, "tip": o.tip, "m2": o.m2} for o in req.odalar]
        else:
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

        # 4. API key'leri al
        claude_key, grok_key = _extract_api_keys(request, req.claude_api_key, req.grok_api_key)
        has_ai = bool(claude_key) or bool(grok_key)

        # 5. Plan üretimi
        if has_ai:
            # ── AI MODU: Dual AI + Layout Engine ──
            result = generate_dual_ai_plans(
                buildable_polygon_coords=buildable_coords,
                apartment_program=apartment_program,
                dataset_rules={},
                sun_best_direction=req.sun_direction,
                claude_api_key=claude_key,
                grok_api_key=grok_key,
                max_iterations=1,
            )
            plans = result.to_dict()["best_plans"]
            summary = result.summary
            mode = "ai"
        else:
            # ── DEMO MODU: Layout Engine 5 strateji ──
            room_program = build_room_program(odalar, req.daire_tipi)
            engine = LayoutEngine(width=bw, height=bh, origin_x=ox, origin_y=oy)
            all_results = engine.generate_all_strategies(room_program)

            plans = []
            for i, layout in enumerate(all_results[:3]):  # En iyi 3
                fp = layout.to_floor_plan(bw, bh, ox, oy, req.daire_tipi)
                sc = score_plan(fp, sun_best_direction=req.sun_direction)

                plans.append({
                    "plan_name": layout.strategy_name,
                    "source": "engine",
                    "strategy": layout.strategy_description,
                    "reasoning": f"Layout engine '{layout.strategy_name}' stratejisi — {len(layout.rooms)} oda yerleştirildi, {len(layout.unplaced)} yerleşmemiş",
                    "rooms": [{
                        "name": r.request.name,
                        "type": r.request.room_type,
                        "x": round(r.x, 2),
                        "y": round(r.y, 2),
                        "width": round(r.width, 2),
                        "height": round(r.height, 2),
                        "area": round(r.area, 1),
                        "is_exterior": r.is_on_edge(bw, bh, ox, oy),
                        "facing": r.facing_direction(bw, bh, ox, oy),
                        "doors": r.to_plan_room(bw, bh, ox, oy).doors,
                        "windows": r.to_plan_room(bw, bh, ox, oy).windows,
                    } for r in layout.rooms],
                    "total_area": round(layout.total_area, 1),
                    "room_count": len(layout.rooms),
                    "score": sc.to_dict(),
                    "score_total": round(sc.total, 1),
                    "cross_review_score": 0,
                    "cross_review_notes": "",
                    "final_score": round(sc.total, 1),
                    "validation_warnings": layout.warnings,
                    "validation_fixes": [],
                })

            # En yüksek puanlıyı öne al
            plans.sort(key=lambda p: p["final_score"], reverse=True)
            summary = f"Layout engine: {len(all_results)} strateji denendi, en iyi {len(plans)} seçildi"
            mode = "engine"

        return {
            "plans": plans,
            "all_plans_count": len(plans),
            "summary": summary,
            "mode": mode,
            "buildable_area": {
                "coords": [{"x": round(c[0], 2), "y": round(c[1], 2)} for c in buildable_coords],
                "width": round(bw, 2),
                "height": round(bh, 2),
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
    from core.plan_scorer import FloorPlan, PlanRoom

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
