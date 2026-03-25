"""
Fotogerçekçi Render — Grok 2 Image API (xAI) entegrasyonu.
"""

import os
import logging
import requests
from dataclasses import dataclass

logger = logging.getLogger(__name__)

RENDER_STYLES = {
    "modern_turk": {
        "isim": "Modern Türk",
        "aciklama": "Sade, beyaz-gri tonlar, ahşap detaylar",
        "prompt_suffix": "modern Turkish style, clean lines, white and gray tones, warm wood accents, natural materials",
    },
    "klasik_turk": {
        "isim": "Klasik Türk",
        "aciklama": "Sıcak tonlar, geleneksel motifler",
        "prompt_suffix": "classic Turkish style, warm earth tones, traditional patterns, ornate details, rich textures",
    },
    "minimalist": {
        "isim": "Minimalist",
        "aciklama": "Siyah-beyaz, clean lines",
        "prompt_suffix": "minimalist style, monochromatic, clean geometric lines, open space, natural light",
    },
    "luks": {
        "isim": "Lüks",
        "aciklama": "Mermer, kristal, gold detaylar",
        "prompt_suffix": "luxury style, marble floors, crystal chandelier, gold accents, premium materials",
    },
}

ROOM_DESCRIPTIONS = {
    "salon": "living room with sofa set, coffee table, TV unit, and dining area",
    "yatak_odasi": "bedroom with double bed, nightstands, wardrobe, and soft lighting",
    "mutfak": "kitchen with modern cabinets, countertop, appliances, and good lighting",
    "banyo": "bathroom with shower cabin, modern sink, and clean tiles",
    "antre": "entrance hall with shoe cabinet, mirror, and coat hanger",
    "balkon": "balcony with outdoor furniture and plants",
}


@dataclass
class RenderResult:
    image_url: str = ""
    prompt: str = ""
    style: str = ""
    room_name: str = ""
    success: bool = False
    error: str = ""

    def to_dict(self):
        return {
            "image_url": self.image_url,
            "prompt": self.prompt,
            "style": self.style,
            "room_name": self.room_name,
            "success": self.success,
            "error": self.error,
        }


def generate_render(
    room_name: str,
    room_type: str,
    room_area: float,
    window_direction: str = "south",
    style: str = "modern_turk",
    api_key: str = "",
) -> RenderResult:
    result = RenderResult(room_name=room_name, style=style)
    prompt = _build_prompt(room_name, room_type, room_area, window_direction, style)
    result.prompt = prompt

    if not api_key:
        api_key = os.getenv("XAI_API_KEY", "")
    if not api_key:
        result.error = "XAI_API_KEY gerekli"
        return result

    try:
        from openai import OpenAI
        client = OpenAI(base_url="https://api.x.ai/v1", api_key=api_key)
        response = client.images.generate(model="grok-2-image", prompt=prompt)
        if response.data and len(response.data) > 0:
            result.image_url = response.data[0].url or ""
            result.success = True
        else:
            result.error = "API yanıtında görüntü yok"
    except Exception as e:
        result.error = str(e)
        logger.error(f"Render hatası: {e}")

    return result


def generate_exterior_render(
    building_floors: int,
    building_style: str = "modern_turk",
    api_key: str = "",
) -> RenderResult:
    """Dış cephe render üretir."""
    result = RenderResult(room_name="Dış Cephe", style=building_style)
    style_info = RENDER_STYLES.get(building_style, RENDER_STYLES["modern_turk"])

    prompt = (
        f"Photorealistic exterior architectural visualization of a {building_floors}-story "
        f"Turkish residential apartment building, {style_info['prompt_suffix']}, "
        f"street-level perspective, landscaping, blue sky, realistic shadows, "
        f"4K architectural rendering, professional photography"
    )
    result.prompt = prompt

    if not api_key:
        api_key = os.getenv("XAI_API_KEY", "")
    if not api_key:
        result.error = "XAI_API_KEY gerekli"
        return result

    try:
        from openai import OpenAI
        client = OpenAI(base_url="https://api.x.ai/v1", api_key=api_key)
        response = client.images.generate(model="grok-2-image", prompt=prompt)
        if response.data and len(response.data) > 0:
            result.image_url = response.data[0].url or ""
            result.success = True
        else:
            result.error = "API yanıtında görüntü yok"
    except Exception as e:
        result.error = str(e)

    return result


def _build_prompt(room_name, room_type, room_area, window_direction, style):
    room_desc = ROOM_DESCRIPTIONS.get(room_type, f"{room_type} room")
    style_info = RENDER_STYLES.get(style, RENDER_STYLES["modern_turk"])
    direction_map = {
        "south": "south-facing", "north": "north-facing",
        "east": "east-facing", "west": "west-facing",
    }
    direction_text = direction_map.get(window_direction, "well-lit")

    return (
        f"Photorealistic interior architectural visualization of a {room_area:.0f} square meter "
        f"Turkish {room_desc}, {direction_text} windows with abundant natural daylight, "
        f"{style_info['prompt_suffix']}, high quality 4K architectural rendering, "
        f"professional interior photography, realistic materials and textures"
    )


def get_styles():
    return {k: {"isim": v["isim"], "aciklama": v["aciklama"]} for k, v in RENDER_STYLES.items()}
