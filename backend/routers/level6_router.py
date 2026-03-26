"""
Seviye 6 API Router — Çoklu Kat, DOP, İmar PDF, Proje Karşılaştırma.
"""

import os
import logging
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Seviye 6"])


# ══════════════════════════════════════
# 1. ÇOKLU KAT PLANI
# ══════════════════════════════════════

class KatTanimiRequest(BaseModel):
    kat_no: int = Field(ge=1)
    kat_tipi: str = Field(default="normal")  # zemin | normal | cati
    daire_tipi: str = Field(default="3+1")
    daire_sayisi: int = Field(default=2, ge=1, le=6)
    taban_alani_carpan: float = Field(default=1.0, ge=0.5, le=1.0)
    ozel_odalar: list[dict] = []


class MultiFloorRequest(BaseModel):
    buildable_width: float = Field(..., gt=0)
    buildable_height: float = Field(..., gt=0)
    kat_tanimlari: list[KatTanimiRequest] = []
    sun_direction: str = Field(default="south")
    strateji: str = Field(default="acik_plan")
    # Varsayılan mod (kat_tanimlari boşsa)
    kat_sayisi: int = Field(default=4, ge=1)
    zemin_ticari: bool = Field(default=False)
    cati_penthouse: bool = Field(default=False)
    normal_daire_tipi: str = Field(default="3+1")
    normal_daire_sayisi: int = Field(default=2, ge=1)


@router.post("/api/plan/multi-floor")
async def generate_multi_floor(req: MultiFloorRequest):
    """Çoklu kat planı üretir — her kat farklı layout olabilir."""
    try:
        from core.multi_floor_engine import (
            coklu_kat_plani_uret, varsayilan_kat_tanimlari, KatTanimi,
        )

        if req.kat_tanimlari:
            kat_defs = [
                KatTanimi(
                    kat_no=kt.kat_no,
                    kat_tipi=kt.kat_tipi,
                    daire_tipi=kt.daire_tipi,
                    daire_sayisi=kt.daire_sayisi,
                    taban_alani_carpan=kt.taban_alani_carpan,
                    ozel_odalar=kt.ozel_odalar,
                )
                for kt in req.kat_tanimlari
            ]
        else:
            kat_defs = varsayilan_kat_tanimlari(
                kat_sayisi=req.kat_sayisi,
                zemin_ticari=req.zemin_ticari,
                cati_penthouse=req.cati_penthouse,
                normal_daire_tipi=req.normal_daire_tipi,
                normal_daire_sayisi=req.normal_daire_sayisi,
            )

        sonuc = coklu_kat_plani_uret(
            buildable_width=req.buildable_width,
            buildable_height=req.buildable_height,
            kat_tanimlari=kat_defs,
            sun_direction=req.sun_direction,
            strateji=req.strateji,
        )

        return sonuc.to_dict()

    except Exception as e:
        logger.error(f"Çoklu kat hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# 2. DOP (Düzenleme Ortaklık Payı)
# ══════════════════════════════════════

class DOPRequest(BaseModel):
    brut_arsa_m2: float = Field(..., gt=0)
    arsa_birim_fiyat: float = Field(..., gt=0)
    dop_orani: float = Field(default=0.35, ge=0, le=0.45)
    imar_degisikligi: str = Field(default="")
    eski_birim_fiyat: float = Field(default=0, ge=0)
    buyuksehir: bool = Field(default=True)


@router.post("/api/feasibility/dop")
async def calculate_dop(req: DOPRequest):
    """DOP ve imar artış değer payı hesaplar."""
    try:
        from analysis.dop_calculator import hesapla_dop, dop_karsilastirma

        sonuc = hesapla_dop(
            brut_arsa_m2=req.brut_arsa_m2,
            arsa_birim_fiyat=req.arsa_birim_fiyat,
            dop_orani=req.dop_orani,
            imar_degisikligi=req.imar_degisikligi,
            eski_birim_fiyat=req.eski_birim_fiyat,
            buyuksehir=req.buyuksehir,
        )

        karsilastirma = dop_karsilastirma(
            req.brut_arsa_m2, req.arsa_birim_fiyat, req.buyuksehir
        )

        return {
            "sonuc": sonuc.to_dict(),
            "karsilastirma": karsilastirma,
            "degisiklik_turleri": [
                {"key": "konut_konut", "label": "Konut → Konut (değişiklik yok)"},
                {"key": "tarim_konut", "label": "Tarım → Konut"},
                {"key": "tarim_ticaret", "label": "Tarım → Ticaret"},
                {"key": "konut_ticaret", "label": "Konut → Ticaret"},
                {"key": "yesil_konut", "label": "Yeşil Alan → Konut"},
                {"key": "sanayi_konut", "label": "Sanayi → Konut"},
            ],
        }

    except Exception as e:
        logger.error(f"DOP hesap hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# 3. İMAR PLANI PDF OKUMA
# ══════════════════════════════════════

@router.post("/api/imar/parse-pdf")
async def parse_imar_pdf(
    request: Request,
    file: UploadFile = File(...),
):
    """İmar planı PDF'ini yükle → AI ile parametreleri otomatik çıkar."""
    try:
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Sadece PDF dosyası kabul edilir")

        # Max 10MB
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Dosya boyutu 10MB'ı aşamaz")

        # Claude API key
        api_key = (
            request.headers.get("X-Claude-Api-Key", "").strip()
            or os.getenv("ANTHROPIC_API_KEY", "")
        )

        from analysis.imar_pdf_reader import parse_imar_pdf as do_parse

        result = do_parse(
            pdf_bytes=contents,
            claude_api_key=api_key,
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"İmar PDF okuma hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# 4. PROJE KARŞILAŞTIRMA
# ══════════════════════════════════════

class ProjectCompareRequest(BaseModel):
    projects: list[dict] = Field(..., min_length=2, max_length=5)


@router.post("/api/projects/compare")
async def compare_projects(req: ProjectCompareRequest):
    """Birden fazla projeyi karşılaştırır — ana metrikler yan yana."""
    try:
        comparison = []

        for proj in req.projects:
            name = proj.get("name", "İsimsiz")
            data = proj.get("data", {})

            # Temel metrikler çıkar
            hesaplama = data.get("hesaplama", {})
            fizibilite = data.get("feasibilityData", {})
            deprem = data.get("earthquakeData", {})
            enerji = data.get("energyData", {})
            parsel = data.get("parselData", {})
            imar = data.get("imarParams", {})

            metrics = {
                "proje_adi": name,
                "arsa_alani_m2": parsel.get("alan_m2", 0),
                "kat_adedi": imar.get("kat_adedi", 0),
                "taks": imar.get("taks", 0),
                "kaks": imar.get("kaks", 0),
                "toplam_insaat_m2": hesaplama.get("toplam_insaat_alani", 0),
                "toplam_maliyet": fizibilite.get("toplam_maliyet", 0),
                "toplam_gelir": fizibilite.get("toplam_gelir", 0),
                "kar_marji": fizibilite.get("kar_marji", 0),
                "irr": fizibilite.get("irr", 0),
                "m2_maliyet": fizibilite.get("m2_maliyet", 0),
                "deprem_risk": (deprem.get("parametreler", {}).get("risk_seviyesi", "")
                                if isinstance(deprem, dict) else ""),
                "enerji_sinifi": (enerji.get("enerji_sinifi", "")
                                  if isinstance(enerji, dict) else ""),
                "daire_sayisi": (imar.get("kat_adedi", 0)
                                 * data.get("feasibilityFormState", {}).get("daireSayisiPerKat", 2)),
            }

            comparison.append(metrics)

        # Sıralama: kâr marjına göre
        comparison.sort(key=lambda x: x.get("kar_marji", 0), reverse=True)

        # En iyi/en kötü analizi
        if len(comparison) >= 2:
            best = comparison[0]["proje_adi"]
            worst = comparison[-1]["proje_adi"]
            best_margin = comparison[0].get("kar_marji", 0)
            worst_margin = comparison[-1].get("kar_marji", 0)
        else:
            best = worst = ""
            best_margin = worst_margin = 0

        return {
            "projeler": comparison,
            "analiz": {
                "en_karli": best,
                "en_az_karli": worst,
                "en_yuksek_kar_marji": best_margin,
                "en_dusuk_kar_marji": worst_margin,
                "ortalama_kar_marji": (
                    sum(p.get("kar_marji", 0) for p in comparison) / len(comparison)
                    if comparison else 0
                ),
            },
            "karsilastirma_alanlari": [
                "arsa_alani_m2", "toplam_insaat_m2", "toplam_maliyet",
                "toplam_gelir", "kar_marji", "irr", "daire_sayisi",
                "deprem_risk", "enerji_sinifi",
            ],
        }

    except Exception as e:
        logger.error(f"Karşılaştırma hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
