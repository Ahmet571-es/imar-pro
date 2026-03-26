"""
Deprem + Enerji Analiz API Router.
"""

import math
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from analysis.earthquake_risk import (
    deprem_risk_analizi, ZEMIN_SINIFLARI,
    tasarim_spektrumu, bina_periyod_hesabi, deprem_kuvvet_dagilimi,
)
from analysis.energy_performance import (
    enerji_performans_hesapla, ENERJI_SINIFLARI, YALITIM_U_DEGERLERI, PENCERE_U_DEGERLERI,
    aylik_enerji_tuketim, gunes_paneli_roi, isi_kaybi_haritasi,
)

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
    il_adi: str = Field(default="", description="İl adı — AFAD 81 il tablosu fallback'i için")


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
            il_adi=req.il_adi,
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


@router.get("/api/earthquake/afad-iller")
async def get_afad_iller():
    """AFAD 81 il Ss/S1 tablosu — frontend dropdown ve harita için."""
    try:
        from config.afad_ss_s1 import get_tum_iller
        return get_tum_iller()
    except Exception as e:
        logger.error(f"AFAD il tablosu hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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

        # Pencere tipi karşılaştırma
        pencere_karsilastirma = []
        for pen_key, u_val in PENCERE_U_DEGERLERI.items():
            alt_sonuc2 = enerji_performans_hesapla(
                toplam_alan=req.toplam_alan, kat_sayisi=req.kat_sayisi,
                duvar_yalitim=req.duvar_yalitim, pencere_tipi=pen_key,
                cati_yalitimli=req.cati_yalitimli,
                pencere_duvar_orani=req.pencere_duvar_orani,
                isitma_sistemi=req.isitma_sistemi, latitude=req.latitude,
            )
            pencere_karsilastirma.append({
                "pencere": pen_key.replace("_", " ").title(),
                "u_degeri": u_val,
                "kwh_m2": round(alt_sonuc2.yillik_toplam_kwh_m2, 1),
                "sinif": alt_sonuc2.enerji_sinifi,
                "maliyet_tl": round(alt_sonuc2.yillik_enerji_maliyeti),
                "secili": pen_key == req.pencere_tipi,
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
            "pencere_karsilastirma": pencere_karsilastirma,
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


# ══════════════════════════════════════
# I1. TASARIM SPEKTRUMU
# ══════════════════════════════════════

class SpektrumRequest(BaseModel):
    ss: float = Field(default=0.411, gt=0)
    s1: float = Field(default=0.109, gt=0)
    zemin_sinifi: str = Field(default="ZC")


@router.post("/api/earthquake/spektrum")
async def get_spektrum(req: SpektrumRequest):
    """TBDY 2018 yatay tasarım spektrumu grafiği."""
    try:
        return tasarim_spektrumu(ss=req.ss, s1=req.s1, zemin_sinifi=req.zemin_sinifi)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# I2. BİNA PERİYOT HESABI
# ══════════════════════════════════════

class PeriyodRequest(BaseModel):
    kat_sayisi: int = Field(default=4, ge=1)
    kat_yuksekligi: float = Field(default=3.0, ge=2.5)
    tasiyici_sistem: str = Field(default="cerceve")


@router.post("/api/earthquake/periyod")
async def calculate_period(req: PeriyodRequest):
    """Bina doğal periyot hesabı — TBDY 2018."""
    try:
        return bina_periyod_hesabi(
            kat_sayisi=req.kat_sayisi,
            kat_yuksekligi=req.kat_yuksekligi,
            tasiyici_sistem=req.tasiyici_sistem,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# I3. KAT BAZLI DEPREM KUVVETİ
# ══════════════════════════════════════

class KuvvetRequest(BaseModel):
    kat_sayisi: int = Field(default=4, ge=1)
    kat_yuksekligi: float = Field(default=3.0, ge=2.5)
    kat_alan: float = Field(default=140.0, gt=0)
    ss: float = Field(default=0.411, gt=0)
    s1: float = Field(default=0.109, gt=0)
    zemin_sinifi: str = Field(default="ZC")
    R: float = Field(default=8.0, gt=0)
    D: float = Field(default=3.0, gt=0)


@router.post("/api/earthquake/kuvvet")
async def calculate_seismic_force(req: KuvvetRequest):
    """Eşdeğer deprem yükü — kat bazlı kuvvet dağılımı."""
    try:
        return deprem_kuvvet_dagilimi(
            kat_sayisi=req.kat_sayisi,
            kat_yuksekligi=req.kat_yuksekligi,
            kat_alan=req.kat_alan,
            ss=req.ss, s1=req.s1,
            zemin_sinifi=req.zemin_sinifi,
            R=req.R, D=req.D,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# I4. AYLIK ENERJİ TÜKETİM
# ══════════════════════════════════════

class AylikEnerjiRequest(BaseModel):
    toplam_alan: float = Field(..., gt=0)
    kat_sayisi: int = Field(default=4, ge=1)
    latitude: float = Field(default=39.93)
    duvar_yalitim: str = Field(default="duvar_5cm_eps")
    pencere_tipi: str = Field(default="isicam")


@router.post("/api/energy/aylik")
async def monthly_energy(req: AylikEnerjiRequest):
    """12 aylık ısıtma/soğutma/aydınlatma tüketim grafiği."""
    try:
        return aylik_enerji_tuketim(
            toplam_alan=req.toplam_alan,
            kat_sayisi=req.kat_sayisi,
            latitude=req.latitude,
            duvar_yalitim=req.duvar_yalitim,
            pencere_tipi=req.pencere_tipi,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# I5. GÜNEŞ PANELİ ROI
# ══════════════════════════════════════

class GunesPaneliRequest(BaseModel):
    cati_alani: float = Field(default=140.0, gt=0)
    panel_verimi: float = Field(default=0.20, ge=0.10, le=0.30)
    kullanilabilir_oran: float = Field(default=0.60, ge=0.20, le=0.90)
    yillik_gunes_saat: float = Field(default=1700, ge=800, le=2500)
    panel_birim_fiyat: float = Field(default=5500, gt=0)
    elektrik_fiyat: float = Field(default=4.50, gt=0)


@router.post("/api/energy/solar")
async def solar_roi(req: GunesPaneliRequest):
    """Güneş paneli yatırım geri dönüş analizi."""
    try:
        return gunes_paneli_roi(
            cati_alani=req.cati_alani,
            panel_verimi=req.panel_verimi,
            kullanilabilir_oran=req.kullanilabilir_oran,
            yillik_gunes_saat=req.yillik_gunes_saat,
            panel_birim_fiyat=req.panel_birim_fiyat,
            elektrik_fiyat=req.elektrik_fiyat,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# I6. ISI KAYBI HARİTASI
# ══════════════════════════════════════

class IsiKaybiRequest(BaseModel):
    toplam_alan: float = Field(default=560.0, gt=0)
    kat_sayisi: int = Field(default=4, ge=1)
    duvar_yalitim: str = Field(default="duvar_5cm_eps")
    pencere_tipi: str = Field(default="isicam")
    cati_yalitimli: bool = Field(default=True)
    pencere_duvar_orani: float = Field(default=0.25, ge=0.05, le=0.60)


@router.post("/api/energy/heat-loss")
async def heat_loss_map(req: IsiKaybiRequest):
    """Duvar/cam/çatı/döşeme bazlı ısı kaybı dağılım haritası."""
    try:
        return isi_kaybi_haritasi(
            toplam_alan=req.toplam_alan,
            kat_sayisi=req.kat_sayisi,
            duvar_yalitim=req.duvar_yalitim,
            pencere_tipi=req.pencere_tipi,
            cati_yalitimli=req.cati_yalitimli,
            pencere_duvar_orani=req.pencere_duvar_orani,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
