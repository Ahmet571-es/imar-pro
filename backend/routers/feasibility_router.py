"""
Fizibilite API Router — Maliyet, gelir, kâr, duyarlılık, Monte Carlo, nakit akışı, IRR, tornado.
"""

import logging
from fastapi import APIRouter, HTTPException, Request
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


class AIYorumRequest(BaseModel):
    toplam_maliyet: float = 0
    toplam_gelir: float = 0
    kar_marji: float = 0
    irr: float = 0
    zarar_olasiligi: float = 0
    payback_ay: int = 0
    il: str = "Ankara"
    kat_adedi: int = 4
    toplam_daire: int = 8
    claude_api_key: str = ""


@router.post("/ai-yorum")
async def generate_ai_commentary(req: AIYorumRequest, request: Request):
    """Claude AI ile fizibilite sonuçlarını Türkçe yorumla."""
    import os

    api_key = (
        request.headers.get("X-Claude-Api-Key", "").strip()
        or req.claude_api_key
        or os.getenv("ANTHROPIC_API_KEY", "")
    )

    if not api_key:
        return {"yorum": _fallback_yorum(req)}

    try:
        from anthropic import Anthropic
        client = Anthropic(api_key=api_key)

        prompt = f"""Sen bir gayrimenkul fizibilite uzmanısın. Aşağıdaki proje verilerini analiz et ve Türkçe profesyonel bir yorum yaz.

Proje Verileri:
- İl: {req.il}
- Kat Adedi: {req.kat_adedi}
- Toplam Daire: {req.toplam_daire}
- Toplam Maliyet: ₺{req.toplam_maliyet:,.0f}
- Toplam Gelir: ₺{req.toplam_gelir:,.0f}
- Kâr Marjı: %{req.kar_marji:.1f}
- Yıllık IRR: %{req.irr:.1f}
- Monte Carlo Zarar Olasılığı: %{req.zarar_olasiligi:.1f}
- Payback Süresi: {req.payback_ay} ay

Lütfen şu başlıklar altında yorum yap:
1. Genel Değerlendirme (kârlılık düzeyi)
2. Risk Analizi (zarar olasılığı, hassas parametreler)
3. Piyasa Karşılaştırma ({req.il} bölgesi için)
4. Öneriler (maliyet optimizasyonu, fiyatlandırma stratejisi)

Kısa ve öz yaz, maksimum 300 kelime."""

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )

        yorum = message.content[0].text if message.content else ""
        return {"yorum": yorum}

    except Exception as e:
        logger.error(f"AI yorum hatası: {e}")
        return {"yorum": _fallback_yorum(req)}


def _fallback_yorum(req) -> str:
    """API key yokken basit otomatik yorum."""
    if req.kar_marji > 20:
        risk = "düşük riskli"
        verdict = "güçlü bir yatırım fırsatı"
    elif req.kar_marji > 10:
        risk = "orta riskli"
        verdict = "kabul edilebilir bir yatırım"
    elif req.kar_marji > 0:
        risk = "yüksek riskli"
        verdict = "dikkatli değerlendirilmesi gereken bir proje"
    else:
        risk = "çok yüksek riskli"
        verdict = "mevcut parametrelerle kârlı olmayan bir proje"

    return (
        f"Bu proje %{req.kar_marji:.1f} kâr marjı ile {risk} ve {verdict} olarak değerlendirilmektedir. "
        f"Monte Carlo simülasyonuna göre zarar olasılığı %{req.zarar_olasiligi:.1f} seviyesindedir. "
        f"Yatırımın geri dönüş süresi {req.payback_ay} ay olarak hesaplanmıştır. "
        f"Detaylı analiz için bir gayrimenkul değerleme uzmanı ile görüşmeniz önerilir."
    )
