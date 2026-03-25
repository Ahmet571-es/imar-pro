"""
Deprem + Enerji Analiz API Router.
"""

import math
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from analysis.earthquake_risk import deprem_risk_analizi, ZEMIN_SINIFLARI
from analysis.energy_performance import enerji_performans_hesapla, ENERJI_SINIFLARI, YALITIM_U_DEGERLERI, PENCERE_U_DEGERLERI

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Analiz"])


# ── Deprem ──

class EarthquakeRequest(BaseModel):
    latitude: float = Field(default=39.93)
    longitude: float = Field(default=32.86)
    kat_sayisi: int = Field(default=4, ge=1)
    zemin_sinifi: str = Field(default="ZC")
    ss_override: float = Field(default=0, ge=0)
    s1_override: float = Field(default=0, ge=0)
    bina_genisligi: float = Field(default=12.0, gt=0)
    bina_derinligi: float = Field(default=10.0, gt=0)


@router.post("/api/earthquake/analyze")
async def analyze_earthquake(req: EarthquakeRequest):
    """Deprem risk analizi — AFAD parametreleri, kolon grid, tasarım spektrumu."""
    try:
        sonuc = deprem_risk_analizi(
            latitude=req.latitude,
            longitude=req.longitude,
            kat_sayisi=req.kat_sayisi,
            zemin_sinifi=req.zemin_sinifi,
            ss_override=req.ss_override,
            s1_override=req.s1_override,
            bina_genisligi=req.bina_genisligi,
            bina_derinligi=req.bina_derinligi,
        )

        # Kolon grid verisi
        grid_data = None
        if sonuc.kolon_grid:
            kg = sonuc.kolon_grid
            grid_data = {
                "x_akslar": [round(x, 2) for x in kg.x_akslar],
                "y_akslar": [round(y, 2) for y in kg.y_akslar],
                "kolon_boyut": list(kg.kolon_boyut),
                "aks_isimleri_x": kg.aks_isimleri_x,
                "aks_isimleri_y": kg.aks_isimleri_y,
                "kolon_sayisi": len(kg.x_akslar) * len(kg.y_akslar),
            }

        # Tasarım spektrumu grafiği verisi (TBDY 2018)
        spektrum = _tasarim_spektrumu(sonuc.ss, sonuc.s1)

        # Taban kesme kuvveti tahmini
        W_tahmini = req.bina_genisligi * req.bina_derinligi * req.kat_sayisi * 12  # kN/m² * alan
        T1 = req.kat_sayisi * 0.075  # Yaklaşık doğal periyot
        Sa_T1 = _spektrum_degeri(T1, sonuc.ss, sonuc.s1)
        R = 7.0  # Betonarme çerçeve süneklik katsayısı
        D = 1.0  # Dayanım fazlalığı
        Vt = W_tahmini * Sa_T1 / (R / D)  # Taban kesme kuvveti

        return {
            "parametreler": {
                "ss": round(sonuc.ss, 4),
                "s1": round(sonuc.s1, 4),
                "zemin_sinifi": sonuc.zemin_sinifi,
                "zemin_aciklama": ZEMIN_SINIFLARI.get(sonuc.zemin_sinifi, {}).get("aciklama", ""),
                "bks": sonuc.bks,
                "bys": sonuc.bys,
                "deprem_bolgesi": sonuc.deprem_bolgesi,
                "risk_seviyesi": sonuc.risk_seviyesi,
                "afad_api": sonuc.afad_api_basarili,
            },
            "oneriler": {
                "tasiyici_sistem": sonuc.tasiyici_sistem_onerisi,
                "kolon_grid": sonuc.kolon_grid_onerisi,
                "perde": sonuc.perde_onerisi,
            },
            "kolon_grid": grid_data,
            "spektrum": spektrum,
            "taban_kesme": {
                "T1_sn": round(T1, 2),
                "Sa_T1_g": round(Sa_T1, 3),
                "R": R,
                "W_kN": round(W_tahmini),
                "Vt_kN": round(Vt),
                "Vt_W_orani": round(Vt / W_tahmini * 100, 1) if W_tahmini > 0 else 0,
            },
            "detaylar": sonuc.detaylar,
        }
    except Exception as e:
        logger.error(f"Deprem analizi hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _tasarim_spektrumu(Ss: float, S1: float) -> list[dict]:
    """TBDY 2018 elastik tasarım spektrumu veri noktaları."""
    SDS = Ss  # Zemin amplifikasyonu zaten uygulanmış
    SD1 = S1

    TA = 0.2 * SD1 / SDS if SDS > 0 else 0.05
    TB = SD1 / SDS if SDS > 0 else 0.4
    TL = 6.0

    points = []
    # T = 0 .. 4 sn
    for i in range(81):
        T = i * 0.05
        if T < TA:
            Sa = SDS * (0.4 + 0.6 * T / TA) if TA > 0 else SDS
        elif T <= TB:
            Sa = SDS
        elif T <= TL:
            Sa = SD1 / T if T > 0 else SDS
        else:
            Sa = SD1 * TL / (T * T) if T > 0 else 0

        points.append({"T": round(T, 2), "Sa": round(Sa, 4)})

    return points


def _spektrum_degeri(T: float, Ss: float, S1: float) -> float:
    """Belirli periyot için spektral ivme."""
    SDS = Ss
    SD1 = S1
    TA = 0.2 * SD1 / SDS if SDS > 0 else 0.05
    TB = SD1 / SDS if SDS > 0 else 0.4

    if T < TA:
        return SDS * (0.4 + 0.6 * T / TA) if TA > 0 else SDS
    elif T <= TB:
        return SDS
    else:
        return SD1 / T if T > 0 else SDS


@router.get("/api/earthquake/zemin-siniflari")
async def get_zemin_siniflari():
    return ZEMIN_SINIFLARI


# ── Enerji ──

class EnergyRequest(BaseModel):
    toplam_alan: float = Field(..., gt=0)
    kat_sayisi: int = Field(default=4, ge=1)
    duvar_yalitim: str = Field(default="duvar_8cm_eps")
    pencere_tipi: str = Field(default="isicam")
    cati_yalitimli: bool = Field(default=True)
    pencere_duvar_orani: float = Field(default=0.25, ge=0.05, le=0.60)
    isitma_sistemi: str = Field(default="dogalgaz_kombi")
    latitude: float = Field(default=39.93)


@router.post("/api/energy/calculate")
async def calculate_energy(req: EnergyRequest):
    """Enerji performans hesabı — A-G sınıfı, U değerleri, güneş kazancı."""
    try:
        sonuc = enerji_performans_hesapla(
            toplam_alan=req.toplam_alan,
            kat_sayisi=req.kat_sayisi,
            duvar_yalitim=req.duvar_yalitim,
            pencere_tipi=req.pencere_tipi,
            cati_yalitimli=req.cati_yalitimli,
            pencere_duvar_orani=req.pencere_duvar_orani,
            isitma_sistemi=req.isitma_sistemi,
            latitude=req.latitude,
        )

        # Yalıtım karşılaştırma
        karsilastirma = []
        for yal_key, u_val in YALITIM_U_DEGERLERI.items():
            if "duvar" in yal_key:
                alt_sonuc = enerji_performans_hesapla(
                    toplam_alan=req.toplam_alan, kat_sayisi=req.kat_sayisi,
                    duvar_yalitim=yal_key, pencere_tipi=req.pencere_tipi,
                    cati_yalitimli=req.cati_yalitimli,
                    pencere_duvar_orani=req.pencere_duvar_orani,
                    isitma_sistemi=req.isitma_sistemi, latitude=req.latitude,
                )
                karsilastirma.append({
                    "yalitim": yal_key.replace("duvar_", "").replace("_", " ").upper(),
                    "u_degeri": u_val,
                    "kwh_m2": round(alt_sonuc.yillik_toplam_kwh_m2, 1),
                    "sinif": alt_sonuc.enerji_sinifi,
                    "maliyet_tl": round(alt_sonuc.yillik_enerji_maliyeti),
                    "secili": yal_key == req.duvar_yalitim,
                })

        return {
            "enerji_sinifi": sonuc.enerji_sinifi,
            "sinif_bilgi": ENERJI_SINIFLARI.get(sonuc.enerji_sinifi, {}),
            "tum_siniflar": {k: v for k, v in ENERJI_SINIFLARI.items()},
            "isitma_kwh_m2": round(sonuc.yillik_isitma_kwh_m2, 1),
            "sogutma_kwh_m2": round(sonuc.yillik_sogutma_kwh_m2, 1),
            "toplam_kwh_m2": round(sonuc.yillik_toplam_kwh_m2, 1),
            "yillik_maliyet_tl": round(sonuc.yillik_enerji_maliyeti),
            "u_degerleri": {
                "duvar": round(sonuc.duvar_u, 3),
                "pencere": round(sonuc.pencere_u, 3),
                "cati": round(sonuc.cati_u, 3),
            },
            "pencere_duvar_orani": round(sonuc.pencere_duvar_orani, 2),
            "gunes_kazanci_kwh": round(sonuc.gunes_kazanci_kwh, 1),
            "oneriler": sonuc.oneriler,
            "yalitim_karsilastirma": karsilastirma,
        }
    except Exception as e:
        logger.error(f"Enerji hesap hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/energy/options")
async def get_energy_options():
    """Enerji hesap seçenekleri."""
    return {
        "duvar_yalitimlari": {k: v for k, v in YALITIM_U_DEGERLERI.items() if "duvar" in k},
        "pencere_tipleri": PENCERE_U_DEGERLERI,
        "isitma_sistemleri": ["dogalgaz_kombi", "merkezi", "isi_pompasi"],
    }
