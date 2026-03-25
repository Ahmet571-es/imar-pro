"""
Fizibilite API Router — Maliyet, gelir, kâr, duyarlılık, Monte Carlo, nakit akışı, IRR, tornado.
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from analysis.cost_estimator import hesapla_maliyet
from analysis.revenue_estimator import hesapla_gelir
from analysis.feasibility import (
    hesapla_fizibilite, duyarlilik_5x5, monte_carlo,
    nakit_akisi, hesapla_irr, tornado_analizi,
)
from config.cost_defaults import get_iller

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/feasibility", tags=["Fizibilite"])


class FeasibilityRequest(BaseModel):
    # İmar verileri
    toplam_insaat_alani: float = Field(..., gt=0)
    kat_basi_net_alan: float = Field(default=0)
    kat_adedi: int = Field(default=4, ge=1)
    daire_sayisi_per_kat: int = Field(default=2, ge=1)

    # Maliyet
    il: str = Field(default="Ankara")
    kalite: str = Field(default="orta")
    birim_maliyet_override: float = Field(default=0, ge=0)
    arsa_maliyeti: float = Field(default=0, ge=0)
    otopark_tipi: str = Field(default="acik")
    otopark_arac_sayisi: int = Field(default=0, ge=0)

    # Gelir
    m2_satis_fiyati: float = Field(default=40000, gt=0)
    daire_tipi: str = Field(default="3+1")
    cephe_yon: str = Field(default="güney")
    dukkan_alani: float = Field(default=0, ge=0)
    dukkan_m2_fiyat: float = Field(default=0, ge=0)
    otopark_satis_adedi: int = Field(default=0, ge=0)
    otopark_birim_fiyat: float = Field(default=500000, ge=0)

    # Nakit akışı
    insaat_suresi_ay: int = Field(default=18, ge=6, le=48)
    satis_suresi_ay: int = Field(default=12, ge=3, le=36)
    on_satis_orani: float = Field(default=0.30, ge=0, le=1)


@router.post("/calculate")
async def calculate_feasibility(req: FeasibilityRequest):
    """Tam fizibilite hesaplaması — tüm modüller tek çağrıda."""
    try:
        # 1. Maliyet
        maliyet = hesapla_maliyet(
            toplam_insaat_alani=req.toplam_insaat_alani,
            il=req.il, kalite=req.kalite,
            birim_maliyet_override=req.birim_maliyet_override,
            arsa_maliyeti=req.arsa_maliyeti,
            otopark_tipi=req.otopark_tipi,
            otopark_arac_sayisi=req.otopark_arac_sayisi,
        )

        # 2. Daire listesi oluştur
        toplam_daire = req.kat_adedi * req.daire_sayisi_per_kat
        net_alan_per_daire = req.kat_basi_net_alan / req.daire_sayisi_per_kat if req.kat_basi_net_alan > 0 else req.toplam_insaat_alani / req.kat_adedi / req.daire_sayisi_per_kat * 0.85

        daireler = []
        daire_no = 1
        for kat in range(1, req.kat_adedi + 1):
            for _ in range(req.daire_sayisi_per_kat):
                daireler.append({
                    "daire_no": daire_no,
                    "kat": kat,
                    "tip": req.daire_tipi,
                    "net_alan": net_alan_per_daire,
                })
                daire_no += 1

        # 3. Gelir
        gelir = hesapla_gelir(
            daireler=daireler,
            m2_satis_fiyati=req.m2_satis_fiyati,
            kat_sayisi=req.kat_adedi,
            dukkan_alani=req.dukkan_alani,
            dukkan_m2_fiyat=req.dukkan_m2_fiyat,
            otopark_satis_adedi=req.otopark_satis_adedi,
            otopark_birim_fiyat=req.otopark_birim_fiyat,
            cephe_yon=req.cephe_yon,
        )

        # 4. Fizibilite özet
        satilabilir_alan = sum(d["net_alan"] for d in daireler)
        fizibilite = hesapla_fizibilite(
            gelir.toplam_gelir, maliyet.toplam_maliyet, satilabilir_alan
        )

        # 5. Duyarlılık 5×5
        duyarlilik = duyarlilik_5x5(maliyet.toplam_maliyet, gelir.toplam_gelir)

        # 6. Monte Carlo
        mc = monte_carlo(maliyet.toplam_maliyet, gelir.toplam_gelir)

        # 7. Nakit akışı
        na = nakit_akisi(
            maliyet.toplam_maliyet, gelir.toplam_gelir,
            insaat_suresi_ay=req.insaat_suresi_ay,
            satis_suresi_ay=req.satis_suresi_ay,
            on_satis_orani=req.on_satis_orani,
        )

        # 8. IRR
        irr = hesapla_irr(na["aylik"])

        # 9. Tornado
        tornado = tornado_analizi(
            maliyet.toplam_maliyet, gelir.toplam_gelir, fizibilite.kar
        )

        return {
            "ozet": fizibilite.to_dict(),
            "maliyet": maliyet.to_dict(),
            "gelir": gelir.to_dict(),
            "duyarlilik": duyarlilik,
            "monte_carlo": mc,
            "nakit_akisi": na,
            "irr_yillik": irr,
            "tornado": tornado,
            "parametreler": {
                "toplam_daire": toplam_daire,
                "net_alan_per_daire": round(net_alan_per_daire, 1),
                "satilabilir_alan": round(satilabilir_alan, 1),
                "insaat_suresi_ay": req.insaat_suresi_ay,
                "satis_suresi_ay": req.satis_suresi_ay,
            },
        }

    except Exception as e:
        logger.error(f"Fizibilite hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sensitivity")
async def sensitivity_only(baz_maliyet: float, baz_gelir: float):
    """Sadece duyarlılık matrisi."""
    return duyarlilik_5x5(baz_maliyet, baz_gelir)


@router.get("/iller")
async def list_iller():
    """İl listesi (maliyet verisi olan)."""
    return get_iller()
