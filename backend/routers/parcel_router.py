"""
Parsel API Router — Parsel oluşturma, hesaplama, TKGM sorgulama.
"""

from fastapi import APIRouter, HTTPException
from models import (
    ParselDikdortgenRequest,
    ParselKenarlarRequest,
    ParselKoordinatlarRequest,
    ParselResponse,
    TKGMRequest,
    Coordinate,
)
from core.parcel import Parsel
from core.tkgm_api import parsel_sorgula, get_il_ilce_listesi, test_tkgm_connection

router = APIRouter(prefix="/api/parcel", tags=["Parsel"])


def _parsel_to_response(p: Parsel) -> dict:
    ozet = p.ozet()
    coords = p.koordinatlar
    minx, miny, maxx, maxy = p.bounds
    return {
        "alan_m2": ozet["alan_m2"],
        "cevre_m": ozet["cevre_m"],
        "kose_sayisi": ozet["kose_sayisi"],
        "kenarlar_m": ozet["kenarlar_m"],
        "acilar_derece": ozet["acilar_derece"],
        "yon": ozet["yon"],
        "koordinatlar": [{"x": round(c[0], 3), "y": round(c[1], 3)} for c in coords],
        "bounds": {
            "min_x": round(minx, 3),
            "min_y": round(miny, 3),
            "max_x": round(maxx, 3),
            "max_y": round(maxy, 3),
            "width": round(maxx - minx, 3),
            "height": round(maxy - miny, 3),
        },
    }


@router.post("/calculate/rectangle")
async def calculate_rectangle(req: ParselDikdortgenRequest):
    """Dikdörtgen parsel hesapla."""
    try:
        p = Parsel.from_dikdortgen(req.en, req.boy, yon=req.yon)
        return _parsel_to_response(p)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/edges")
async def calculate_from_edges(req: ParselKenarlarRequest):
    """Kenar+açı ile parsel hesapla."""
    try:
        p = Parsel.from_kenarlar_acilar(req.kenarlar, req.acilar, yon=req.yon)
        return _parsel_to_response(p)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate/coordinates")
async def calculate_from_coordinates(req: ParselKoordinatlarRequest):
    """Koordinatlardan parsel hesapla."""
    try:
        coords = [(c.x, c.y) for c in req.koordinatlar]
        p = Parsel.from_koordinatlar(coords, yon=req.yon)
        return _parsel_to_response(p)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tkgm")
async def tkgm_query(req: TKGMRequest):
    """TKGM parsel sorgulama."""
    result = parsel_sorgula(
        il=req.il,
        ilce=req.ilce,
        mahalle=req.mahalle,
        ada=req.ada,
        parsel=req.parsel,
    )
    response = {
        "basarili": result.basarili,
        "il": result.il,
        "ilce": result.ilce,
        "mahalle": result.mahalle,
        "ada": result.ada,
        "parsel": result.parsel,
        "alan": result.alan,
        "pafta": result.pafta,
        "nitelik": result.nitelik,
        "hata": result.hata,
    }
    if result.koordinatlar:
        response["koordinatlar"] = [
            {"x": round(c[0], 6), "y": round(c[1], 6)} for c in result.koordinatlar
        ]
    if result.polygon:
        from utils.geometry_helpers import polygon_to_coords_list
        coords = polygon_to_coords_list(result.polygon)
        response["polygon_coords"] = [
            {"x": round(c[0], 3), "y": round(c[1], 3)} for c in coords
        ]
    return response


@router.get("/tkgm/test")
async def tkgm_connection_test():
    """TKGM bağlantı testi."""
    return test_tkgm_connection()


@router.get("/tkgm/iller")
async def get_iller():
    """İl-ilçe listesi."""
    return get_il_ilce_listesi()
