"""
3D & Render API Router — 3D bina verisi + maliyet verisi + fotogerçekçi render.
Seviye 3: 4D/5D BIM entegrasyonu.
"""

import os
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional

from ai.render_generator import generate_render, generate_exterior_render, get_styles
from utils.constants import KAT_YUKSEKLIGI, DIS_DUVAR_KALINLIK, DOSEME_KALINLIK
from config.cost_defaults import MALIYET_DAGILIMI

logger = logging.getLogger(__name__)

router = APIRouter(tags=["3D & Render"])


class Room3D(BaseModel):
    name: str
    type: str
    x: float
    y: float
    width: float
    height: float
    is_exterior: bool = False
    facing: str = ""


class BuildingDataRequest(BaseModel):
    rooms: list[Room3D]
    kat_adedi: int = Field(default=4, ge=1, le=40)
    kat_yuksekligi: float = Field(default=3.0)
    buildable_width: float = Field(default=14.0)
    buildable_height: float = Field(default=10.0)
    toplam_maliyet: float = Field(default=0.0)  # 5D maliyet bağlantısı


class RenderRequest(BaseModel):
    room_name: str
    room_type: str
    room_area: float
    window_direction: str = "south"
    style: str = "modern_turk"
    grok_api_key: Optional[str] = None


class ExteriorRenderRequest(BaseModel):
    kat_adedi: int = 4
    style: str = "modern_turk"
    direction: str = "south"  # south, east, west, bird
    bina_genisligi: float = 14.0
    bina_derinligi: float = 10.0
    grok_api_key: Optional[str] = None


class WhatIfRequest(BaseModel):
    """5D What-If maliyet analizi."""
    toplam_maliyet: float
    kat_adedi: int = 4
    kat_yuksekligi: float = 3.0
    buildable_width: float = 14.0
    buildable_height: float = 10.0
    # Parametre değişiklikleri
    yalitim_kalinligi_cm: Optional[float] = None  # None = değişiklik yok
    pencere_tipi: Optional[str] = None  # "tek_cam", "cift_cam", "low_e"
    dis_duvar_kalinligi_cm: Optional[float] = None
    cati_tipi: Optional[str] = None  # "teras", "besik"


@router.post("/api/3d/building-data")
async def get_building_data(req: BuildingDataRequest):
    """3D model için bina verisi + 5D maliyet dağılımı."""
    try:
        floors = []
        floor_h = req.kat_yuksekligi
        wall_t = DIS_DUVAR_KALINLIK
        slab_t = DOSEME_KALINLIK
        total_cost = req.toplam_maliyet

        # 5D: Maliyet dağılımı
        cost_per_floor = total_cost / max(1, req.kat_adedi)
        cost_data = {}
        if total_cost > 0:
            for kategori, oran in MALIYET_DAGILIMI.items():
                cost_data[kategori] = {
                    "toplam": round(total_cost * oran),
                    "oran": oran,
                    "kat_basi": round(total_cost * oran / max(1, req.kat_adedi)),
                }

        for floor_idx in range(req.kat_adedi):
            floor_y = floor_idx * floor_h
            floor_rooms = []

            for room in req.rooms:
                room_area = room.width * room.height
                # 5D: Eleman bazlı maliyet tahmini
                room_cost = 0
                if total_cost > 0:
                    # İnce inşaat maliyetinin oda alanına orantılı payı
                    total_room_area = sum(r.width * r.height for r in req.rooms)
                    room_cost_ratio = room_area / max(1, total_room_area)
                    room_cost = round(cost_per_floor * MALIYET_DAGILIMI.get("İnce İnşaat (Sıva, Boya, Döşeme)", 0.27) * room_cost_ratio)

                walls = _generate_walls(room, floor_y, floor_h, slab_t, wall_t, floor_idx, total_cost, cost_per_floor)
                windows = _generate_windows(room, floor_y, floor_h, floor_idx) if room.is_exterior and room.type not in ("koridor", "antre", "wc") else []
                door = _generate_door(room, floor_y, floor_idx) if floor_idx == 0 or room.type != "antre" else None

                room_data = {
                    "name": room.name,
                    "type": room.type,
                    "position": {
                        "x": room.x + room.width / 2,
                        "y": floor_y + floor_h / 2,
                        "z": room.y + room.height / 2,
                    },
                    "dimensions": {
                        "width": room.width,
                        "height": floor_h - slab_t,
                        "depth": room.height,
                    },
                    "is_exterior": room.is_exterior,
                    "facing": room.facing,
                    "floor_index": floor_idx,
                    "walls": walls,
                    "windows": windows,
                    "door": door,
                    # 5D
                    "cost_amount": room_cost,
                    "cost_category": "İnce İnşaat",
                }
                floor_rooms.append(room_data)

            # 5D: Döşeme maliyeti
            slab_cost = 0
            if total_cost > 0:
                slab_cost = round(cost_per_floor * MALIYET_DAGILIMI.get("Kaba İnşaat (Betonarme)", 0.37) * 0.4)

            floors.append({
                "floor_index": floor_idx,
                "floor_y": round(floor_y, 2),
                "is_ground": floor_idx == 0,
                "is_top": floor_idx == req.kat_adedi - 1,
                "rooms": floor_rooms,
                "slab": {
                    "y": round(floor_y, 2),
                    "thickness": slab_t,
                    "width": req.buildable_width,
                    "depth": req.buildable_height,
                    "cost_amount": slab_cost,
                },
            })

        columns = _generate_column_grid(req.buildable_width, req.buildable_height, req.kat_adedi, floor_h)

        return {
            "floors": floors,
            "columns": columns,
            "building": {
                "total_height": round(req.kat_adedi * floor_h, 2),
                "width": req.buildable_width,
                "depth": req.buildable_height,
                "floor_height": floor_h,
                "floor_count": req.kat_adedi,
                "wall_thickness": wall_t,
                "slab_thickness": slab_t,
            },
            "materials": {
                "exterior_wall": {"color": "#E8E0D4", "roughness": 0.85, "name": "Dış Sıva"},
                "interior_wall": {"color": "#F5F0EB", "roughness": 0.9, "name": "İç Sıva"},
                "floor_slab": {"color": "#D4C9B8", "roughness": 0.7, "name": "Beton Döşeme"},
                "window_glass": {"color": "#87CEEB", "opacity": 0.3, "roughness": 0.05, "name": "Cam"},
                "window_frame": {"color": "#555555", "roughness": 0.4, "name": "Alüminyum"},
                "door": {"color": "#8B6914", "roughness": 0.6, "name": "Ahşap Kapı"},
                "balcony": {"color": "#A0A0A0", "roughness": 0.5, "name": "Balkon"},
                "column": {"color": "#B0B0B0", "roughness": 0.8, "name": "Betonarme Kolon"},
            },
            # 5D: Maliyet özeti
            "cost_summary": cost_data if cost_data else None,
            "total_cost": total_cost,
        }

    except Exception as e:
        logger.error(f"3D veri hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/3d/what-if")
async def what_if_analysis(req: WhatIfRequest):
    """5D What-If: Parametre değişikliğinin maliyet etkisi."""
    try:
        results = []
        base_cost = req.toplam_maliyet
        bina_alan = req.buildable_width * req.buildable_height * req.kat_adedi

        # Yalıtım kalınlığı değişimi
        if req.yalitim_kalinligi_cm is not None:
            default_cm = 5.0
            delta_cm = req.yalitim_kalinligi_cm - default_cm
            # Her cm yalıtım ~%0.8 maliyet artışı (dış cephe payından)
            cephe_cost = base_cost * MALIYET_DAGILIMI.get("Dış Cephe (Mantolama, Kaplama)", 0.09)
            cost_delta = cephe_cost * (delta_cm * 0.08)
            # Enerji tasarrufu: her cm ~%3 U-değer düşüşü
            energy_delta = -delta_cm * 3.0  # % olarak

            results.append({
                "id": "yalitim",
                "parameter": "Yalıtım Kalınlığı",
                "currentValue": f"{default_cm:.0f} cm",
                "newValue": f"{req.yalitim_kalinligi_cm:.0f} cm",
                "costDelta": round(cost_delta),
                "energyDelta": round(energy_delta, 1),
                "description": f"Yalıtım {default_cm:.0f}→{req.yalitim_kalinligi_cm:.0f} cm: "
                              f"Maliyet {'artışı' if cost_delta > 0 else 'düşüşü'} ₺{abs(cost_delta):,.0f}, "
                              f"Enerji %{abs(energy_delta):.1f} {'tasarruf' if energy_delta < 0 else 'artış'}",
            })

        # Pencere tipi değişimi
        if req.pencere_tipi is not None:
            pencere_maliyetleri = {
                "tek_cam": {"m2": 800, "u_deger": 5.7},
                "cift_cam": {"m2": 1400, "u_deger": 2.8},
                "low_e": {"m2": 2200, "u_deger": 1.4},
            }
            current = pencere_maliyetleri.get("cift_cam", {})
            target = pencere_maliyetleri.get(req.pencere_tipi, current)

            pencere_adet = max(1, len([r for r in range(req.kat_adedi)]) * 6)
            pencere_alan = pencere_adet * 1.6 * 1.2
            cost_delta = (target.get("m2", 0) - current.get("m2", 0)) * pencere_alan
            u_delta = target.get("u_deger", 0) - current.get("u_deger", 0)

            results.append({
                "id": "pencere",
                "parameter": "Pencere Tipi",
                "currentValue": "Çift Cam",
                "newValue": req.pencere_tipi.replace("_", " ").title(),
                "costDelta": round(cost_delta),
                "energyDelta": round(u_delta * -5, 1),
                "description": f"Pencere tipi değişimi: Maliyet farkı ₺{abs(cost_delta):,.0f}, "
                              f"U-değer {current.get('u_deger', 0)}→{target.get('u_deger', 0)}",
            })

        # Duvar kalınlığı değişimi
        if req.dis_duvar_kalinligi_cm is not None:
            default_cm = 25.0
            delta_cm = req.dis_duvar_kalinligi_cm - default_cm
            duvar_m2 = 2 * (req.buildable_width + req.buildable_height) * req.kat_adedi * req.kat_yuksekligi
            cost_per_cm = 15  # ₺/m²/cm tuğla+sıva
            cost_delta = duvar_m2 * delta_cm * cost_per_cm

            results.append({
                "id": "duvar",
                "parameter": "Dış Duvar Kalınlığı",
                "currentValue": f"{default_cm:.0f} cm",
                "newValue": f"{req.dis_duvar_kalinligi_cm:.0f} cm",
                "costDelta": round(cost_delta),
                "energyDelta": round(-delta_cm * 1.5, 1),
                "description": f"Dış duvar {default_cm:.0f}→{req.dis_duvar_kalinligi_cm:.0f} cm: "
                              f"Maliyet farkı ₺{abs(cost_delta):,.0f}",
            })

        return {
            "scenarios": results,
            "base_cost": base_cost,
            "total_delta": sum(r["costDelta"] for r in results),
            "new_total": base_cost + sum(r["costDelta"] for r in results),
        }

    except Exception as e:
        logger.error(f"What-if hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _generate_walls(room, floor_y, floor_h, slab_t, wall_t, floor_index=0, total_cost=0, cost_per_floor=0):
    """Oda duvar segmentleri — 5D maliyet verisi dahil."""
    h = floor_h - slab_t
    walls = []

    # Duvar bazlı maliyet (dış cephe duvarı vs iç duvar)
    wall_cost_ext = round(cost_per_floor * 0.045) if total_cost > 0 else 0
    wall_cost_int = round(cost_per_floor * 0.015) if total_cost > 0 else 0

    for side, cx, cy, cz, sw, sh, sd, is_ext_side in [
        ("north", room.x + room.width / 2, floor_y + h / 2, room.y + room.height,
         room.width, h, wall_t if room.is_exterior else wall_t * 0.5,
         room.is_exterior and room.facing in ("north", "")),
        ("south", room.x + room.width / 2, floor_y + h / 2, room.y,
         room.width, h, wall_t if room.is_exterior else wall_t * 0.5,
         room.is_exterior and room.facing in ("south", "")),
        ("east", room.x + room.width, floor_y + h / 2, room.y + room.height / 2,
         wall_t if room.is_exterior else wall_t * 0.5, h, room.height,
         room.is_exterior and room.facing in ("east", "")),
        ("west", room.x, floor_y + h / 2, room.y + room.height / 2,
         wall_t if room.is_exterior else wall_t * 0.5, h, room.height,
         room.is_exterior and room.facing in ("west", "")),
    ]:
        walls.append({
            "id": f"{room.name}_{side}_{floor_index}",
            "side": side,
            "center": {"x": cx, "y": cy, "z": cz},
            "size": {"width": sw, "height": sh, "depth": sd},
            "is_exterior": is_ext_side,
            "room_name": room.name,
            "room_type": room.type,
            "floor_index": floor_index,
            "has_window": False,
            "has_door": False,
            "cost_category": "Dış Cephe" if is_ext_side else "İnce İnşaat",
            "cost_amount": wall_cost_ext if is_ext_side else wall_cost_int,
        })

    return walls


def _generate_windows(room, floor_y, floor_h, floor_index=0):
    """Pencere pozisyonları — floor_index + 5D maliyet dahil."""
    windows = []
    win_w = min(1.6, room.width * 0.4)
    win_h = 1.2
    sill_h = 0.9

    if room.facing in ("south", "north"):
        z_pos = room.y if room.facing == "south" else room.y + room.height
        windows.append({
            "center": {"x": room.x + room.width / 2, "y": floor_y + sill_h + win_h / 2, "z": z_pos},
            "size": {"width": win_w, "height": win_h},
            "facing": room.facing,
            "room_name": room.name,
            "floor_index": floor_index,
            "cost_amount": 18500,
            "u_value": 2.8,
        })
    elif room.facing in ("east", "west"):
        x_pos = room.x + room.width if room.facing == "east" else room.x
        windows.append({
            "center": {"x": x_pos, "y": floor_y + sill_h + win_h / 2, "z": room.y + room.height / 2},
            "size": {"width": min(1.4, room.height * 0.4), "height": win_h},
            "facing": room.facing,
            "room_name": room.name,
            "floor_index": floor_index,
            "cost_amount": 16000,
            "u_value": 2.8,
        })
    else:
        windows.append({
            "center": {"x": room.x + room.width / 2, "y": floor_y + sill_h + win_h / 2, "z": room.y},
            "size": {"width": win_w, "height": win_h},
            "facing": "south",
            "room_name": room.name,
            "floor_index": floor_index,
            "cost_amount": 18500,
            "u_value": 2.8,
        })

    return windows


def _generate_door(room, floor_y, floor_index=0):
    """Kapı pozisyonu — floor_index dahil."""
    door_h = 2.10
    door_w = 0.90 if room.type != "antre" else 1.00
    return {
        "center": {"x": room.x + room.width * 0.3, "y": floor_y + door_h / 2, "z": room.y},
        "size": {"width": door_w, "height": door_h},
        "room_name": room.name,
        "floor_index": floor_index,
    }


def _generate_column_grid(bw, bh, floors, floor_h):
    """Yapısal kolon grid'i — ~5m aralıkla."""
    columns = []
    col_size = 0.40
    spacing_x = max(3.0, bw / max(1, round(bw / 5)))
    spacing_z = max(3.0, bh / max(1, round(bh / 5)))

    x = 0
    col_id = 0
    while x <= bw + 0.01:
        z = 0
        while z <= bh + 0.01:
            columns.append({
                "id": col_id,
                "x": round(x, 2),
                "z": round(z, 2),
                "size": col_size,
                "height": round(floors * floor_h, 2),
                "label": f"{chr(65 + col_id // 10)}{col_id % 10 + 1}",
            })
            col_id += 1
            z += spacing_z
        x += spacing_x

    return columns


# ── Render Endpoints ──

@router.post("/api/render/generate")
async def generate_room_render(req: RenderRequest, request: Request):
    """Fotogerçekçi oda render'ı üret (Grok Imagine)."""
    api_key = (
        request.headers.get("X-Grok-Api-Key", "").strip()
        or req.grok_api_key
        or os.getenv("XAI_API_KEY", "")
    )
    result = generate_render(
        room_name=req.room_name,
        room_type=req.room_type,
        room_area=req.room_area,
        window_direction=req.window_direction,
        style=req.style,
        api_key=api_key,
    )
    return result.to_dict()


@router.post("/api/render/exterior")
async def generate_exterior(req: ExteriorRenderRequest, request: Request):
    """Dış cephe render'ı üret — 4 yön desteği."""
    api_key = (
        request.headers.get("X-Grok-Api-Key", "").strip()
        or req.grok_api_key
        or os.getenv("XAI_API_KEY", "")
    )

    direction_prompts = {
        "south": "front facade view from street level, south-facing",
        "east": "side facade view from east, morning light",
        "west": "side facade view from west, afternoon light",
        "bird": "aerial bird's eye view, top-down perspective showing rooftop and surroundings",
    }

    result = generate_exterior_render(
        building_floors=req.kat_adedi,
        building_style=req.style,
        api_key=api_key,
        direction_prompt=direction_prompts.get(req.direction, direction_prompts["south"]),
    )
    return result.to_dict()


@router.get("/api/render/styles")
async def list_render_styles():
    """Mevcut render stilleri."""
    return get_styles()
