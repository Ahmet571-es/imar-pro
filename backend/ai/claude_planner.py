"""
Claude Sonnet 4.6 Plan Üretim Modülü — Geliştirilmiş Prompt & JSON Çıktı.

Katman 1: AI sadece MİMARİ PROGRAM üretir (oda listesi + ilişkiler + boyutlar).
Fiziksel yerleştirme layout_engine tarafından yapılır.
"""

import json
import logging
import os
from core.plan_scorer import FloorPlan, PlanRoom

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Sen Türkiye'de 25+ yıl deneyimli uzman bir mimarsın. Konut daire planı tasarlıyorsun.

SENİN GÖREVİN:
Verilen kısıtlara göre bir daire planı için MİMARİ PROGRAM tasarla.
Odaların fiziksel koordinatlarını SEN belirle. Her oda dikdörtgen, çakışmasız olmalı.

TEMEL MİMARİ İLKELER:
1. TÜM odalar dikdörtgen ve yapılaşma sınırları içinde.
2. Hiçbir oda çakışmamalı — sıfır tolerans.
3. Salon + balkon güneş alan cepheye (güney/güneybatı).
4. Yatak odaları sessiz cepheye (kuzey/arka).
5. Islak hacimler (banyo/WC/mutfak) gruplanmalı — ortak tesisat hattı.
6. Antre giriş noktasında, koridor tüm odalara erişim sağlamalı.
7. Kapılar koridor/antre tarafındaki duvara yerleşmeli.
8. Pencereler dış cephe duvarlarına.
9. Duvar kalınlıkları: dış=0.25m, iç taşıyıcı=0.20m, bölme=0.10m.

TÜRK YAPI YÖNETMELİĞİ MİNİMUM ÖLÇÜLERİ:
- Salon ≥ 12m², Yatak odası ≥ 9m², Mutfak ≥ 5m²
- Banyo ≥ 3.5m², WC ≥ 1.5m², Antre ≥ 3m²
- Koridor genişliği ≥ 1.10m, Daire giriş kapısı ≥ 1.00m
- Balkon ≥ 2m², derinlik ≥ 1.20m

VERİ SETİ İSTATİSTİKLERİ:
{dataset_rules}

KURALLAR:
- Koordinat sistemi: sol-alt köşe (0,0), x sağa, y yukarı.
- Tüm ölçüler metre cinsinden, 0.05m hassasiyetle.
- Oda en-boy oranı: 0.45 ile 1.0 arasında (aşırı dar oda yasak).
- Toplam oda alanları ≤ brüt alan × 0.92 (duvar payı).

Cevabını SADECE aşağıdaki JSON formatında ver. Başka hiçbir metin, açıklama veya markdown ekleme:
{{
  "plan_name": "Strateji adı",
  "strategy": "Kısa strateji açıklaması",
  "rooms": [
    {{
      "name": "Salon",
      "type": "salon",
      "x": 0.0,
      "y": 0.0,
      "width": 6.50,
      "height": 4.20,
      "is_exterior": true,
      "facing": "south",
      "doors": [{{"wall": "north", "position": 0.3, "width": 0.90}}],
      "windows": [{{"wall": "south", "position": 0.4, "width": 1.80}}]
    }}
  ],
  "reasoning": "Detaylı mimari gerekçe"
}}"""


def generate_plans_claude(
    polygon_coords: list[tuple[float, float]],
    apartment_program: dict,
    dataset_rules: dict,
    sun_direction: str = "south",
    api_key: str = "",
    plan_count: int = 2,
    previous_feedback: str | None = None,
) -> list[dict]:
    """Claude API ile plan üretir."""
    if not api_key:
        api_key = os.getenv("ANTHROPIC_API_KEY", "")

    if not api_key:
        logger.warning("Claude API key yok — demo plan üretiliyor.")
        return _generate_demo_plans(polygon_coords, apartment_program, plan_count)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        rules_summary = _summarize_rules(dataset_rules)
        system = SYSTEM_PROMPT.format(dataset_rules=rules_summary)
        user_prompt = _build_user_prompt(
            polygon_coords, apartment_program, sun_direction, plan_count, previous_feedback
        )

        response = client.messages.create(
            model="claude-sonnet-4-6-20250514",
            max_tokens=8192,
            system=system,
            messages=[{"role": "user", "content": user_prompt}],
        )

        response_text = response.content[0].text
        plans_data = _safe_parse_json(response_text)
        if plans_data is None:
            logger.error("Claude JSON parse edilemedi")
            return _generate_demo_plans(polygon_coords, apartment_program, plan_count)

        return _parse_plans(plans_data, "claude")

    except Exception as e:
        logger.error(f"Claude API hatası: {e}")
        return _generate_demo_plans(polygon_coords, apartment_program, plan_count)


def _build_user_prompt(polygon_coords, apartment_program, sun_direction, plan_count, previous_feedback) -> str:
    # Yapılaşma alanı boyutları
    if polygon_coords and len(polygon_coords) >= 3:
        xs = [c[0] for c in polygon_coords]
        ys = [c[1] for c in polygon_coords]
        w = max(xs) - min(xs)
        h = max(ys) - min(ys)
        area = w * h  # Yaklaşık
    else:
        w, h, area = 16, 12, 192

    odalar_str = ""
    for oda in apartment_program.get("odalar", []):
        isim = oda.get("isim", "Oda")
        tip = oda.get("tip", "diger")
        m2 = oda.get("m2", oda.get("varsayilan_m2", 10))
        odalar_str += f"  - {isim} ({tip}): {m2} m²\n"

    prompt = f"""YAPILAŞMA ALANI:
- Köşe koordinatları (m): {polygon_coords}
- Yaklaşık boyutlar: {w:.1f}m × {h:.1f}m = {area:.0f} m²

DAİRE PROGRAMI:
- Tip: {apartment_program.get('tip', '3+1')}
- Brüt alan: {apartment_program.get('brut_alan', 120)} m²
- Odalar:
{odalar_str}

GÜNEŞ YÖN BİLGİSİ:
- En iyi güneş: {sun_direction} cephesi

GÖREV:
{plan_count} farklı plan alternatifi üret. Her plan FARKLI bir yerleşim stratejisi kullansın.

ÖNEMLİ:
- Her odanın x, y, width, height değerlerini metre olarak belirle.
- Odalar çakışmamalı.
- Tüm odalar yapılaşma sınırları ({w:.1f}×{h:.1f}m) içinde kalmalı.
- JSON dışında hiçbir metin yazma.

Yanıtı şu şekilde formatla:
{{"plans": [plan1, plan2, ...]}}"""

    if previous_feedback:
        prompt += f"\n\nÖNCEKİ İTERASYON GERİ BİLDİRİMİ:\n{previous_feedback}\nBu sorunları gidererek daha iyi planlar üret."

    return prompt


def _summarize_rules(dataset_rules: dict) -> str:
    try:
        from dataset.dataset_rules import ROOM_SIZE_STATS, ADJACENCY_PROBABILITY
        lines = ["Oda boyut ortalamaları (80K plan veri setinden):"]
        for room, stats in ROOM_SIZE_STATS.items():
            lines.append(f"  {room}: ort {stats['avg']}m² (min:{stats['min']}, max:{stats['max']}, std:{stats['std']})")
        lines.append("\nKritik bitişiklik kuralları:")
        for (r1, r2), prob in sorted(ADJACENCY_PROBABILITY.items(), key=lambda x: -x[1])[:10]:
            lines.append(f"  {r1}↔{r2}: {prob:.0%}")
        return "\n".join(lines)
    except Exception:
        return str(dataset_rules)[:1500]


def _safe_parse_json(text: str) -> dict | None:
    """JSON'u güvenli şekilde parse et — markdown fence'leri temizle."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Son çare: ilk { ile son } arasını al
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass
    return None


def _parse_plans(data: dict, source: str) -> list[dict]:
    """AI çıktısını FloorPlan nesnelerine dönüştür."""
    results = []
    plans_list = data.get("plans", [data] if "rooms" in data else [])

    for plan_data in plans_list:
        rooms = []
        for r in plan_data.get("rooms", []):
            width = float(r.get("width", 3))
            height = float(r.get("height", 3))
            rooms.append(PlanRoom(
                name=r.get("name", "Oda"),
                room_type=r.get("type", "diger"),
                x=float(r.get("x", 0)),
                y=float(r.get("y", 0)),
                width=width,
                height=height,
                has_exterior_wall=r.get("is_exterior", r.get("has_exterior_wall", False)),
                facing_direction=r.get("facing", r.get("facing_direction", "")),
                doors=r.get("doors", []),
                windows=r.get("windows", []),
            ))

        total_area = sum(r.area for r in rooms)
        fp = FloorPlan(rooms=rooms, total_area=total_area)

        results.append({
            "floor_plan": fp,
            "source": source,
            "plan_name": plan_data.get("plan_name", f"{source} plan"),
            "strategy": plan_data.get("strategy", ""),
            "reasoning": plan_data.get("reasoning", ""),
        })

    return results


def _generate_demo_plans(polygon_coords, apartment_program, plan_count):
    """API key olmadan demo planlar üretir."""
    import math
    results = []

    if polygon_coords and len(polygon_coords) >= 3:
        xs = [c[0] for c in polygon_coords]
        ys = [c[1] for c in polygon_coords]
        tw = max(xs) - min(xs)
        th = max(ys) - min(ys)
        ox, oy = min(xs), min(ys)
    else:
        tw, th, ox, oy = 14.0, 10.0, 0.0, 0.0

    odalar = apartment_program.get("odalar", [
        {"isim": "Salon", "tip": "salon", "m2": 24},
        {"isim": "Yatak Odası 1", "tip": "yatak_odasi", "m2": 14},
        {"isim": "Yatak Odası 2", "tip": "yatak_odasi", "m2": 12},
        {"isim": "Mutfak", "tip": "mutfak", "m2": 10},
        {"isim": "Banyo", "tip": "banyo", "m2": 5},
        {"isim": "WC", "tip": "wc", "m2": 2.5},
        {"isim": "Antre", "tip": "antre", "m2": 5},
        {"isim": "Koridor", "tip": "koridor", "m2": 4},
        {"isim": "Balkon", "tip": "balkon", "m2": 5},
    ])

    strategies = [
        ("Güney Salon", "Salon güney cephede, yatak odaları kuzeyde", _layout_south_salon),
        ("Merkezi Koridor", "Koridor ortada, odalar iki yanda", _layout_central_corridor),
        ("L Salon", "L-şekil salon güneybatıda, ıslak hacimler kuzeydoğuda", _layout_l_salon),
    ]

    for idx in range(min(plan_count, len(strategies))):
        name, strategy, layout_fn = strategies[idx]
        rooms = layout_fn(odalar, tw, th, ox, oy)
        total_area = sum(r.area for r in rooms)
        fp = FloorPlan(rooms=rooms, total_area=total_area,
                       apartment_type=apartment_program.get("tip", "3+1"))
        results.append({
            "floor_plan": fp,
            "source": "claude",
            "plan_name": name,
            "strategy": strategy,
            "reasoning": f"Demo plan — {strategy}",
        })

    return results


def _layout_south_salon(odalar, tw, th, ox, oy):
    """Strateji 1: Salon güneyde, yatak odaları kuzeyde."""
    import math
    rooms = []
    dw = 0.10  # duvar payı

    # Salon güney cephede tam genişlikte
    salon = next((o for o in odalar if o["tip"] == "salon"), None)
    if salon:
        m2 = salon.get("m2", salon.get("varsayilan_m2", 24))
        sw = tw - 2 * dw
        sh = m2 / sw
        rooms.append(PlanRoom(
            name=salon["isim"], room_type="salon",
            x=round(ox + dw, 2), y=round(oy + dw, 2),
            width=round(sw, 2), height=round(min(sh, th * 0.35), 2),
            has_exterior_wall=True, facing_direction="south",
            doors=[{"wall": "north", "position": 0.8, "width": 0.90}],
            windows=[{"wall": "south", "position": 0.4, "width": 1.80}],
        ))

    # Diğer odaları grid-style yerleştir
    y_cur = oy + (rooms[0].height if rooms else th * 0.35) + dw * 3
    x_cur = ox + dw

    for oda in odalar:
        if oda["tip"] == "salon":
            continue
        m2 = oda.get("m2", oda.get("varsayilan_m2", 10))
        w = min(tw * 0.5 - dw, max(2.5, math.sqrt(m2 * 1.2)))
        h = m2 / w

        if x_cur + w > ox + tw - dw:
            x_cur = ox + dw
            y_cur += h + dw * 2

        if y_cur + h > oy + th - dw:
            h = oy + th - dw - y_cur
            if h < 1.5:
                continue

        is_ext = (x_cur <= ox + dw + 0.01 or x_cur + w >= ox + tw - dw - 0.01 or
                  y_cur + h >= oy + th - dw - 0.01)

        rooms.append(PlanRoom(
            name=oda["isim"], room_type=oda["tip"],
            x=round(x_cur, 2), y=round(y_cur, 2),
            width=round(w, 2), height=round(h, 2),
            has_exterior_wall=is_ext,
            facing_direction="north" if y_cur + h >= oy + th - 1 else "",
            doors=[{"wall": "south" if oda["tip"] != "balkon" else "north", "position": 0.3, "width": 0.90}],
            windows=[{"wall": "north", "position": 0.5, "width": 1.20}] if is_ext and oda["tip"] not in ("koridor", "antre") else [],
        ))
        x_cur += w + dw * 2

    return rooms


def _layout_central_corridor(odalar, tw, th, ox, oy):
    """Strateji 2: Merkezi koridor, odalar iki tarafta."""
    import math
    rooms = []
    corridor_w = 1.20
    half_w = (tw - corridor_w) / 2 - 0.10

    # Koridor
    koridor = next((o for o in odalar if o["tip"] == "koridor"), None)
    rooms.append(PlanRoom(
        name=koridor["isim"] if koridor else "Koridor",
        room_type="koridor",
        x=round(ox + half_w + 0.10, 2), y=round(oy + 0.10, 2),
        width=round(corridor_w, 2), height=round(th - 0.20, 2),
        has_exterior_wall=False,
    ))

    # Sol taraf odaları
    left_odalar = [o for o in odalar if o["tip"] in ("salon", "yatak_odasi", "balkon")]
    y_left = oy + 0.10
    for oda in left_odalar:
        m2 = oda.get("m2", oda.get("varsayilan_m2", 12))
        w = min(half_w, max(3.0, math.sqrt(m2 * 1.3)))
        h = m2 / w
        if y_left + h > oy + th - 0.10:
            break
        rooms.append(PlanRoom(
            name=oda["isim"], room_type=oda["tip"],
            x=round(ox + 0.10, 2), y=round(y_left, 2),
            width=round(w, 2), height=round(h, 2),
            has_exterior_wall=True, facing_direction="west",
            doors=[{"wall": "east", "position": 0.3, "width": 0.90}],
            windows=[{"wall": "west", "position": 0.5, "width": 1.40}] if oda["tip"] != "koridor" else [],
        ))
        y_left += h + 0.10

    # Sağ taraf odaları (ıslak hacimler + antre)
    right_odalar = [o for o in odalar if o["tip"] in ("mutfak", "banyo", "wc", "antre")]
    y_right = oy + 0.10
    right_x = ox + half_w + 0.10 + corridor_w + 0.10
    for oda in right_odalar:
        m2 = oda.get("m2", oda.get("varsayilan_m2", 5))
        w = min(half_w, max(2.0, math.sqrt(m2 * 1.1)))
        h = m2 / w
        if y_right + h > oy + th - 0.10:
            break
        rooms.append(PlanRoom(
            name=oda["isim"], room_type=oda["tip"],
            x=round(right_x, 2), y=round(y_right, 2),
            width=round(w, 2), height=round(h, 2),
            has_exterior_wall=True, facing_direction="east",
            doors=[{"wall": "west", "position": 0.3, "width": 0.90}],
        ))
        y_right += h + 0.10

    return rooms


def _layout_l_salon(odalar, tw, th, ox, oy):
    """Strateji 3: Geniş salon güneybatıda."""
    import math
    rooms = []

    salon = next((o for o in odalar if o["tip"] == "salon"), None)
    if salon:
        m2 = salon.get("m2", salon.get("varsayilan_m2", 24))
        sw = tw * 0.55
        sh = m2 / sw
        rooms.append(PlanRoom(
            name=salon["isim"], room_type="salon",
            x=round(ox + 0.10, 2), y=round(oy + 0.10, 2),
            width=round(sw, 2), height=round(sh, 2),
            has_exterior_wall=True, facing_direction="south",
            doors=[{"wall": "east", "position": 0.5, "width": 0.90}],
            windows=[{"wall": "south", "position": 0.3, "width": 2.00},
                     {"wall": "west", "position": 0.5, "width": 1.20}],
        ))

    # Diğer odalar sağ ve üst bölgede
    right_x = ox + tw * 0.55 + 0.30
    y_cur = oy + 0.10
    remaining = [o for o in odalar if o["tip"] != "salon"]

    for oda in remaining:
        m2 = oda.get("m2", oda.get("varsayilan_m2", 8))
        avail_w = tw - (right_x - ox) - 0.10
        w = min(avail_w, max(2.0, math.sqrt(m2 * 1.1)))
        h = m2 / w

        if y_cur + h > oy + th - 0.10:
            # Overflow: üst sıra
            right_x = ox + 0.10
            y_cur = oy + th * 0.5
            avail_w = tw * 0.55 - 0.10
            w = min(avail_w, max(2.5, math.sqrt(m2 * 1.2)))
            h = m2 / w

        if y_cur + h > oy + th - 0.10:
            continue

        rooms.append(PlanRoom(
            name=oda["isim"], room_type=oda["tip"],
            x=round(right_x, 2), y=round(y_cur, 2),
            width=round(w, 2), height=round(h, 2),
            has_exterior_wall=right_x + w >= ox + tw - 0.5,
            facing_direction="east" if right_x + w >= ox + tw - 0.5 else "",
            doors=[{"wall": "west", "position": 0.3, "width": 0.90}],
        ))
        y_cur += h + 0.10

    return rooms
