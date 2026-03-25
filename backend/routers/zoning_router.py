"""
İmar API Router — TAKS/KAKS hesaplama, çekme mesafeleri.
"""

from fastapi import APIRouter, HTTPException
from models import ImarRequest, Coordinate
from core.parcel import Parsel
from core.zoning import ImarParametreleri, hesapla
from config.turkish_building_codes import CEKME_MESAFESI_KURALLARI
from utils.constants import INSAAT_NIZAMLARI


router = APIRouter(prefix="/api/zoning", tags=["İmar"])


@router.post("/calculate")
async def calculate_zoning(req: ImarRequest):
    """Parsel + imar parametreleri ile tam hesaplama."""
    try:
        # 1. Parsel oluştur
        if req.parsel_tipi == "dikdortgen":
            if not req.en or not req.boy:
                raise ValueError("Dikdörtgen için en ve boy gerekli.")
            parsel = Parsel.from_dikdortgen(req.en, req.boy, yon=req.yon)
        elif req.parsel_tipi == "kenarlar":
            if not req.kenarlar:
                raise ValueError("Kenar listesi gerekli.")
            parsel = Parsel.from_kenarlar_acilar(req.kenarlar, req.acilar, yon=req.yon)
        elif req.parsel_tipi == "koordinatlar":
            if not req.koordinatlar:
                raise ValueError("Koordinat listesi gerekli.")
            coords = [(c.x, c.y) for c in req.koordinatlar]
            parsel = Parsel.from_koordinatlar(coords, yon=req.yon)
        else:
            raise ValueError(f"Geçersiz parsel tipi: {req.parsel_tipi}")

        # 2. İmar parametreleri
        imar = ImarParametreleri(
            kat_adedi=req.kat_adedi,
            insaat_nizami=req.insaat_nizami,
            taks=req.taks,
            kaks=req.kaks,
            on_bahce=req.on_bahce,
            yan_bahce=req.yan_bahce,
            arka_bahce=req.arka_bahce,
            bina_yuksekligi_limiti=req.bina_yuksekligi_limiti,
            bina_derinligi_limiti=req.bina_derinligi_limiti,
            siginak_gerekli=req.siginak_gerekli,
            otopark_gerekli=req.otopark_gerekli,
        )

        # 3. Hesapla
        sonuc = hesapla(parsel.polygon, imar)

        # 4. Parsel özet
        ozet = parsel.ozet()
        coords = parsel.koordinatlar
        minx, miny, maxx, maxy = parsel.bounds

        return {
            "parsel": {
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
            },
            "imar_parametreleri": {
                "kat_adedi": imar.kat_adedi,
                "insaat_nizami": imar.insaat_nizami,
                "insaat_nizami_adi": INSAAT_NIZAMLARI.get(imar.insaat_nizami, ""),
                "taks": imar.taks,
                "kaks": imar.kaks,
                "on_bahce": imar.on_bahce,
                "yan_bahce": imar.yan_bahce,
                "arka_bahce": imar.arka_bahce,
                "asansor_zorunlu": imar.asansor_zorunlu,
                "siginak_gerekli": imar.siginak_gerekli,
            },
            "hesaplama": sonuc.to_dict(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hesaplama hatası: {str(e)}")


@router.get("/defaults")
async def get_defaults():
    """Varsayılan imar parametreleri ve seçenekler."""
    return {
        "insaat_nizamlari": INSAAT_NIZAMLARI,
        "cekme_mesafeleri": CEKME_MESAFESI_KURALLARI,
        "varsayilanlar": {
            "kat_adedi": 4,
            "taks": 0.35,
            "kaks": 1.40,
            "on_bahce": 5.0,
            "yan_bahce": 3.0,
            "arka_bahce": 3.0,
        },
    }
