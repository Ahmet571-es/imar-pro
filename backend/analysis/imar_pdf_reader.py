"""
İmar Planı PDF Okuyucu — PDF'den imar parametrelerini AI ile çıkarır.

İş Akışı:
1. PDF → metin çıkarma (PyPDF2 veya pdfplumber)
2. Metin → Claude AI → yapısal JSON çıktı
3. JSON → İmar parametreleri (TAKS, KAKS, kat, çekme mesafeleri)

Desteklenen Doküman Tipleri:
- İmar durumu belgesi
- Nazım/uygulama imar planı notları
- Parselasyon planı
- Belediye imar durum yazısı
"""

import logging
import json
import re
from typing import Optional

logger = logging.getLogger(__name__)


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """PDF'den metin çıkarır. Birden fazla kütüphane dener."""
    text = ""

    # Yöntem 1: PyPDF2
    try:
        from PyPDF2 import PdfReader
        import io
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            page_text = page.extract_text() or ""
            text += page_text + "\n"
        if text.strip():
            logger.info(f"PyPDF2 ile {len(reader.pages)} sayfa okundu")
            return text.strip()
    except ImportError:
        logger.debug("PyPDF2 yüklü değil")
    except Exception as e:
        logger.debug(f"PyPDF2 hatası: {e}")

    # Yöntem 2: pdfplumber
    try:
        import pdfplumber
        import io
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                text += page_text + "\n"
        if text.strip():
            logger.info(f"pdfplumber ile {len(pdf.pages)} sayfa okundu")
            return text.strip()
    except ImportError:
        logger.debug("pdfplumber yüklü değil")
    except Exception as e:
        logger.debug(f"pdfplumber hatası: {e}")

    # Yöntem 3: reportlab (zaten yüklü) + basic extraction
    try:
        import io
        # reportlab sadece yazıyor, okuyamaz — fallback
        pass
    except Exception:
        pass

    return text.strip()


def parse_imar_with_regex(text: str) -> dict:
    """Regex ile temel imar parametrelerini çıkarır (AI fallback)."""
    params = {}

    # TAKS
    taks_match = re.search(r'TAKS\s*[=:]\s*([0-9.,]+)', text, re.IGNORECASE)
    if taks_match:
        params["taks"] = float(taks_match.group(1).replace(',', '.'))

    # KAKS / Emsal
    kaks_match = re.search(r'(?:KAKS|Emsal)\s*[=:]\s*([0-9.,]+)', text, re.IGNORECASE)
    if kaks_match:
        params["kaks"] = float(kaks_match.group(1).replace(',', '.'))

    # Kat adedi
    kat_match = re.search(r'(?:Kat\s*(?:Adedi|Sayısı|sayisi))\s*[=:]\s*(\d+)', text, re.IGNORECASE)
    if not kat_match:
        kat_match = re.search(r'(?:Yükseklik|H(?:max)?)\s*[=:]\s*(\d+)\s*(?:kat|K)', text, re.IGNORECASE)
    if not kat_match:
        kat_match = re.search(r'(\d+)\s*[Kk]at(?:lı|li)', text)
    if kat_match:
        params["kat_adedi"] = int(kat_match.group(1))

    # Çekme mesafeleri
    on_match = re.search(r'(?:Ön\s*[Bb]ahçe|ön\s*çekme)\s*[=:]\s*([0-9.,]+)\s*m', text, re.IGNORECASE)
    if on_match:
        params["on_bahce"] = float(on_match.group(1).replace(',', '.'))

    yan_match = re.search(r'(?:Yan\s*[Bb]ahçe|yan\s*çekme)\s*[=:]\s*([0-9.,]+)\s*m', text, re.IGNORECASE)
    if yan_match:
        params["yan_bahce"] = float(yan_match.group(1).replace(',', '.'))

    arka_match = re.search(r'(?:Arka\s*[Bb]ahçe|arka\s*çekme)\s*[=:]\s*([0-9.,]+)\s*m', text, re.IGNORECASE)
    if arka_match:
        params["arka_bahce"] = float(arka_match.group(1).replace(',', '.'))

    # İnşaat nizamı
    if re.search(r'[Aa]yrık\s*[Nn]izam', text):
        params["insaat_nizami"] = "A"
    elif re.search(r'[Bb]itişik\s*[Nn]izam', text):
        params["insaat_nizami"] = "B"
    elif re.search(r'[Bb]lok\s*[Nn]izam', text):
        params["insaat_nizami"] = "BL"

    # Bina yüksekliği
    yuk_match = re.search(r'(?:Bina\s*[Yy]üksekli[gğ]i|H\s*max|Hmax)\s*[=:]\s*([0-9.,]+)\s*m', text, re.IGNORECASE)
    if yuk_match:
        params["bina_yuksekligi_limiti"] = float(yuk_match.group(1).replace(',', '.'))

    # Ada/Parsel
    ada_match = re.search(r'Ada\s*(?:No)?[=:\s]*(\d+)', text, re.IGNORECASE)
    if ada_match:
        params["ada"] = ada_match.group(1)
    parsel_match = re.search(r'Parsel\s*(?:No)?[=:\s]*(\d+)', text, re.IGNORECASE)
    if parsel_match:
        params["parsel"] = parsel_match.group(1)

    # DOP oranı
    dop_match = re.search(r'DOP\s*[=:]\s*%?\s*([0-9.,]+)', text, re.IGNORECASE)
    if dop_match:
        val = float(dop_match.group(1).replace(',', '.'))
        params["dop_orani"] = val / 100 if val > 1 else val

    return params


def parse_imar_with_ai(text: str, api_key: str) -> dict:
    """Claude AI ile imar parametrelerini yapısal olarak çıkarır."""
    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=api_key)

        prompt = f"""Aşağıdaki imar belgesi metninden imar parametrelerini çıkar.
Sadece JSON döndür, başka metin ekleme.

Çıkarılacak parametreler:
- taks (0-1 arası, örn: 0.35)
- kaks (0-10 arası, örn: 1.40)
- kat_adedi (tam sayı)
- insaat_nizami ("A" = ayrık, "B" = bitişik, "BL" = blok)
- on_bahce (metre)
- yan_bahce (metre)
- arka_bahce (metre)
- bina_yuksekligi_limiti (metre, 0 = sınır yok)
- ada (string)
- parsel (string)
- dop_orani (0-0.45 arası)
- arsa_alani_m2 (m²)
- fonksiyon (konut, ticaret, karma, sanayi)
- il (string)
- ilce (string)
- notlar (string — önemli ek bilgiler)

Bulunamayan parametreleri JSON'a ekleme. Sayısal değerleri number olarak döndür.

Belge metni:
---
{text[:4000]}
---

JSON:"""

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = response.content[0].text.strip()

        # JSON parse (bazen ```json ... ``` ile sarılı gelebilir)
        json_text = response_text
        if "```" in json_text:
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', json_text, re.DOTALL)
            if json_match:
                json_text = json_match.group(1)

        params = json.loads(json_text)
        logger.info(f"AI ile {len(params)} parametre çıkarıldı")
        return params

    except Exception as e:
        logger.error(f"AI parse hatası: {e}")
        return {}


def parse_imar_pdf(
    pdf_bytes: bytes,
    claude_api_key: str = "",
) -> dict:
    """İmar planı PDF'ini okur ve parametreleri çıkarır.

    Returns:
        {
            "basarili": bool,
            "metin_uzunlugu": int,
            "yontem": "ai" | "regex" | "hata",
            "parametreler": { ... },
            "ham_metin": str (ilk 500 karakter),
        }
    """
    # 1. PDF → metin
    text = extract_text_from_pdf(pdf_bytes)
    if not text:
        return {
            "basarili": False,
            "metin_uzunlugu": 0,
            "yontem": "hata",
            "parametreler": {},
            "ham_metin": "",
            "hata": "PDF'den metin çıkarılamadı. Taranmış (görsel) PDF olabilir — OCR gerekli.",
        }

    # 2. Parametreleri çıkar
    params = {}
    yontem = "regex"

    # Önce AI dene (daha doğru)
    if claude_api_key:
        ai_params = parse_imar_with_ai(text, claude_api_key)
        if ai_params:
            params = ai_params
            yontem = "ai"

    # AI başarısızsa regex fallback
    if not params:
        params = parse_imar_with_regex(text)
        yontem = "regex"

    return {
        "basarili": len(params) > 0,
        "metin_uzunlugu": len(text),
        "yontem": yontem,
        "parametreler": params,
        "ham_metin": text[:500],
    }
