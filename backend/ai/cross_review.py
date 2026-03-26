"""
Çapraz Değerlendirme — Her AI diğerinin planını eleştirir.
"""

import json
import logging
import os

logger = logging.getLogger(__name__)

REVIEW_PROMPT = """Aşağıdaki konut kat planını mimari açıdan eleştir. 100 üzerinden puan ver.

Değerlendirme kriterleri:
- Oda boyutları ve oranları
- Islak hacim gruplaması
- Dolaşım/sirkülasyon kalitesi
- Güneş yönlenmesi
- Gizlilik zonlama (yatak odaları vs sosyal alanlar)

Plan bilgileri:
{plan_info}

Yanıtını SADECE JSON olarak ver:
{{
  "score": 75,
  "strengths": ["İyi olan 1", "İyi olan 2"],
  "weaknesses": ["Kötü olan 1", "Kötü olan 2"],
  "improvement": "Somut iyileştirme önerisi"
}}"""


def cross_review(plans: list, claude_api_key: str = "", grok_api_key: str = ""):
    """Claude planları → Grok eleştirir, Grok planları → Claude eleştirir."""
    for plan_alt in plans:
        plan_info = _format_plan_info(plan_alt)

        if plan_alt.source == "claude":
            review = _review_with_grok(plan_info, grok_api_key)
        else:
            review = _review_with_claude(plan_info, claude_api_key)

        if review:
            plan_alt.cross_review_score = review.get("score", 60)
            strengths = review.get("strengths", [])
            weaknesses = review.get("weaknesses", [])
            improvement = review.get("improvement", "")
            plan_alt.cross_review_notes = (
                f"Güçlü: {'; '.join(strengths[:2])}. "
                f"Zayıf: {'; '.join(weaknesses[:2])}. "
                f"Öneri: {improvement}"
            )
        else:
            plan_alt.cross_review_score = plan_alt.score.total if plan_alt.score else 50


def _format_plan_info(plan_alt) -> str:
    if not plan_alt.plan or not plan_alt.plan.rooms:
        return "Boş plan"
    lines = [
        f"Kaynak: {plan_alt.source}",
        f"Toplam alan: {plan_alt.plan.total_area:.1f} m²",
    ]
    for r in plan_alt.plan.rooms:
        lines.append(
            f"  {r.name} ({r.room_type}): {r.width:.1f}×{r.height:.1f}m = {r.area:.1f}m² "
            f"@ ({r.x:.1f},{r.y:.1f}) {'[dış]' if r.has_exterior_wall else '[iç]'} {r.facing_direction}"
        )
    if plan_alt.score:
        lines.append(f"Otomatik puan: {plan_alt.score.total:.1f}/100")
    return "\n".join(lines)


def _review_with_claude(plan_info: str, api_key: str) -> dict | None:
    if not api_key:
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        return _demo_review()
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-opus-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": REVIEW_PROMPT.format(plan_info=plan_info)}],
        )
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```json")[-1].split("```")[0] if "```json" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return json.loads(text.strip())
    except Exception as e:
        logger.error(f"Claude review hatası: {e}")
        return _demo_review()


def _review_with_grok(plan_info: str, api_key: str) -> dict | None:
    if not api_key:
        api_key = os.getenv("XAI_API_KEY", "")
    if not api_key:
        return _demo_review()
    try:
        from openai import OpenAI
        client = OpenAI(base_url="https://api.x.ai/v1", api_key=api_key)
        response = client.chat.completions.create(
            model="grok-4",
            messages=[{"role": "user", "content": REVIEW_PROMPT.format(plan_info=plan_info)}],
            max_tokens=1024,
        )
        text = response.choices[0].message.content.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        return json.loads(text.strip())
    except Exception as e:
        logger.error(f"Grok review hatası: {e}")
        return _demo_review()


def _demo_review() -> dict:
    return {
        "score": 65,
        "strengths": ["Odalar minimum alan sınırlarını karşılıyor", "Antre giriş noktasında"],
        "weaknesses": ["Salon-balkon bağlantısı zayıf", "Sirkülasyon fazla yer kaplıyor"],
        "improvement": "Salonu güney cepheye kaydırarak balkonla bağlantı kurulmalı",
    }
