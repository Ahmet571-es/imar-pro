"""
3D & Render API Router — 3D bina verisi + fotogerçekçi render.
"""

import os
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional

from ai.render_generator import generate_render, generate_exterior_render, get_styles
from utils.constants import KAT_YUKSEKLIGI, DIS_DUVAR_KALINLIK, DOSEME_KALINLIK

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
    grok_api_key: Optional[str] = None


@router.post("/api/3d/building-data")
async def get_building_data(req: BuildingDataRequest):
    """3D model için bina verisi — kat, duvar, pencere, kapı geometrisi döndürür."""
    try:
        floors = []
        floor_h = req.kat_yuksekligi
        wall_t = DIS_DUVAR_KALINLIK
        slab_t = DOSEME_KALINLIK

        for floor_idx in range(req.kat_adedi):
            floor_y = floor_idx * floor_h
            floor_rooms = []

            for room in req.rooms:
                # Her oda için 3D kutu verisi
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
                    # Duvar segmentleri
                    "walls": _generate_walls(room, floor_y, floor_h, slab_t, wall_t),
                    # Pencere pozisyonları
                    "windows": _generate_windows(room, floor_y, floor_h) if room.is_exterior and room.type not in ("koridor", "antre", "wc") else [],
                    # Kapı pozisyonu
                    "door": _generate_door(room, floor_y) if floor_idx == 0 or room.type != "antre" else None,
                }
                floor_rooms.append(room_data)

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
                },
            })

        # Kolon grid (yapısal akslar)
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
        }

    except Exception as e:
        logger.error(f"3D veri hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _generate_walls(room, floor_y, floor_h, slab_t, wall_t):
    """Oda duvar segmentleri."""
    h = floor_h - slab_t
    walls = []
    # North wall
    walls.append({
        "side": "north",
        "center": {"x": room.x + room.width / 2, "y": floor_y + h / 2, "z": room.y + room.height},
        "size": {"width": room.width, "height": h, "depth": wall_t if room.is_exterior else wall_t * 0.5},
        "is_exterior": room.is_exterior and room.facing in ("north", ""),
    })
    # South wall
    walls.append({
        "side": "south",
        "center": {"x": room.x + room.width / 2, "y": floor_y + h / 2, "z": room.y},
        "size": {"width": room.width, "height": h, "depth": wall_t if room.is_exterior else wall_t * 0.5},
        "is_exterior": room.is_exterior and room.facing in ("south", ""),
    })
    # East wall
    walls.append({
        "side": "east",
        "center": {"x": room.x + room.width, "y": floor_y + h / 2, "z": room.y + room.height / 2},
        "size": {"width": wall_t if room.is_exterior else wall_t * 0.5, "height": h, "depth": room.height},
        "is_exterior": room.is_exterior and room.facing in ("east", ""),
    })
    # West wall
    walls.append({
        "side": "west",
        "center": {"x": room.x, "y": floor_y + h / 2, "z": room.y + room.height / 2},
        "size": {"width": wall_t if room.is_exterior else wall_t * 0.5, "height": h, "depth": room.height},
        "is_exterior": room.is_exterior and room.facing in ("west", ""),
    })
    return walls


def _generate_windows(room, floor_y, floor_h):
    """Pencere pozisyonları."""
    windows = []
    win_w = min(1.6, room.width * 0.4)
    win_h = 1.2
    sill_h = 0.9  # Denizlik yüksekliği

    if room.facing in ("south", "north"):
        z_pos = room.y if room.facing == "south" else room.y + room.height
        windows.append({
            "center": {"x": room.x + room.width / 2, "y": floor_y + sill_h + win_h / 2, "z": z_pos},
            "size": {"width": win_w, "height": win_h},
            "facing": room.facing,
        })
    elif room.facing in ("east", "west"):
        x_pos = room.x + room.width if room.facing == "east" else room.x
        windows.append({
            "center": {"x": x_pos, "y": floor_y + sill_h + win_h / 2, "z": room.y + room.height / 2},
            "size": {"width": min(1.4, room.height * 0.4), "height": win_h},
            "facing": room.facing,
        })
    else:
        # Varsayılan: güney duvarına pencere
        windows.append({
            "center": {"x": room.x + room.width / 2, "y": floor_y + sill_h + win_h / 2, "z": room.y},
            "size": {"width": win_w, "height": win_h},
            "facing": "south",
        })

    return windows


def _generate_door(room, floor_y):
    """Kapı pozisyonu."""
    door_h = 2.10
    door_w = 0.90 if room.type != "antre" else 1.00
    return {
        "center": {"x": room.x + room.width * 0.3, "y": floor_y + door_h / 2, "z": room.y},
        "size": {"width": door_w, "height": door_h},
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
    """Dış cephe render'ı üret."""
    api_key = (
        request.headers.get("X-Grok-Api-Key", "").strip()
        or req.grok_api_key
        or os.getenv("XAI_API_KEY", "")
    )
    result = generate_exterior_render(
        building_floors=req.kat_adedi,
        building_style=req.style,
        api_key=api_key,
    )
    return result.to_dict()


@router.get("/api/render/styles")
async def list_render_styles():
    """Mevcut render stilleri."""
    return get_styles()
