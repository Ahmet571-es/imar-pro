"""
Grok 4 Plan Üretim Modülü — xAI API (OpenAI uyumlu).
Model: grok-4-1-fast-non-reasoning (plan üretimi)
"""

import json
import logging
import os
from core.plan_scorer import FloorPlan, PlanRoom

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert Turkish residential architect with 25+ years of experience.
Design apartment floor plans based on given constraints.

YOUR TASK:
Generate a complete floor plan with exact room coordinates and dimensions.

CORE PRINCIPLES:
1. ALL rooms must be rectangular and non-overlapping — ZERO tolerance for overlaps.
2. All rooms must fit within the buildable area boundaries.
3. Living room + balcony face the sunniest direction (south/southwest).
4. Bedrooms in quiet zones (north/back).
5. Wet areas (bathroom/WC/kitchen) clustered for shared plumbing.
6. Entry (antre) at entrance point, corridor provides access to all rooms.
7. Doors on corridor-facing walls, windows on exterior walls.
8. Wall thicknesses: exterior=0.25m, structural=0.20m, partition=0.10m.

TURKISH BUILDING CODE MINIMUMS:
- Living room ≥ 12m², Bedroom ≥ 9m², Kitchen ≥ 5m²
- Bathroom ≥ 3.5m², WC ≥ 1.5m², Entry ≥ 3m²
- Corridor width ≥ 1.10m, Balcony ≥ 2m²

DATASET:
{dataset_rules}

RULES:
- Coordinate system: bottom-left = (0,0), x→right, y→up
- All dimensions in meters, 0.05m precision
- Room aspect ratio: 0.45 to 1.0 (no extremely narrow rooms)
- Total room areas ≤ gross_area × 0.92 (wall deduction)

Respond ONLY with valid JSON, no other text:
{{
  "plans": [
    {{
      "plan_name": "Strategy name",
      "strategy": "Brief strategy description",
      "rooms": [
        {{
          "name": "Salon",
          "type": "salon",
          "x": 0.0, "y": 0.0,
          "width": 6.50, "height": 4.20,
          "is_exterior": true,
          "facing": "south",
          "doors": [{{"wall": "north", "position": 0.3, "width": 0.90}}],
          "windows": [{{"wall": "south", "position": 0.4, "width": 1.80}}]
        }}
      ],
      "reasoning": "Detailed architectural reasoning"
    }}
  ]
}}"""


def generate_plans_grok(
    polygon_coords: list[tuple[float, float]],
    apartment_program: dict,
    dataset_rules: dict,
    sun_direction: str = "south",
    api_key: str = "",
    plan_count: int = 2,
    previous_feedback: str | None = None,
) -> list[dict]:
    """Grok 4 API ile plan üretir."""
    if not api_key:
        api_key = os.getenv("XAI_API_KEY", "")

    if not api_key:
        logger.warning("Grok API key yok — demo plan üretiliyor.")
        return _generate_grok_demo(polygon_coords, apartment_program, plan_count)

    try:
        from openai import OpenAI
        client = OpenAI(base_url="https://api.x.ai/v1", api_key=api_key)

        rules_summary = _summarize_rules(dataset_rules)
        system = SYSTEM_PROMPT.format(dataset_rules=rules_summary)
        user_prompt = _build_prompt(polygon_coords, apartment_program, sun_direction, plan_count, previous_feedback)

        response = client.chat.completions.create(
            model="grok-4-1-fast-non-reasoning",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=8192,
        )

        text = response.choices[0].message.content
        data = _safe_parse_json(text)
        if data is None:
            logger.error("Grok JSON parse edilemedi")
            return _generate_grok_demo(polygon_coords, apartment_program, plan_count)

        return _parse_plans(data, "grok")

    except Exception as e:
        logger.error(f"Grok API hatası: {e}")
        return _generate_grok_demo(polygon_coords, apartment_program, plan_count)


def _build_prompt(polygon_coords, apartment_program, sun_dir, plan_count, feedback) -> str:
    if polygon_coords and len(polygon_coords) >= 3:
        xs = [c[0] for c in polygon_coords]
        ys = [c[1] for c in polygon_coords]
        w = max(xs) - min(xs)
        h = max(ys) - min(ys)
    else:
        w, h = 16, 12

    rooms_str = ""
    for oda in apartment_program.get("odalar", []):
        m2 = oda.get("m2", oda.get("varsayilan_m2", 10))
        rooms_str += f"  - {oda.get('isim', 'Room')} ({oda.get('tip', 'other')}): {m2} m²\n"

    prompt = f"""BUILDABLE AREA:
- Coordinates (m): {polygon_coords}
- Dimensions: {w:.1f}m × {h:.1f}m

APARTMENT PROGRAM:
- Type: {apartment_program.get('tip', '3+1')}
- Gross area: {apartment_program.get('brut_alan', 120)} m²
- Rooms:
{rooms_str}

SUN DATA: Best sun direction: {sun_dir}

Generate {plan_count} different plan alternatives. Each plan must use a DIFFERENT layout strategy.
All rooms must fit within {w:.1f}×{h:.1f}m boundaries. No overlapping rooms."""

    if feedback:
        prompt += f"\n\nPREVIOUS FEEDBACK:\n{feedback}\nFix these issues."
    return prompt


def _summarize_rules(dataset_rules: dict) -> str:
    try:
        from dataset.dataset_rules import ROOM_SIZE_STATS
        lines = []
        for room, stats in ROOM_SIZE_STATS.items():
            lines.append(f"{room}: avg {stats['avg']}m² ({stats['min']}-{stats['max']})")
        return "\n".join(lines)
    except Exception:
        return str(dataset_rules)[:800]


def _safe_parse_json(text: str) -> dict | None:
    text = text.strip()
    for fence in ["```json", "```"]:
        if fence in text:
            text = text.split(fence)[-1] if fence == "```json" else text
            break
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass
    return None


def _parse_plans(data: dict, source: str) -> list[dict]:
    results = []
    plans_list = data.get("plans", [data] if "rooms" in data else [])

    for plan_data in plans_list:
        rooms = []
        for r in plan_data.get("rooms", []):
            rooms.append(PlanRoom(
                name=r.get("name", "Room"),
                room_type=r.get("type", "diger"),
                x=float(r.get("x", 0)),
                y=float(r.get("y", 0)),
                width=float(r.get("width", 3)),
                height=float(r.get("height", 3)),
                has_exterior_wall=r.get("is_exterior", r.get("has_exterior_wall", False)),
                facing_direction=r.get("facing", r.get("facing_direction", "")),
                doors=r.get("doors", []),
                windows=r.get("windows", []),
            ))
        fp = FloorPlan(rooms=rooms, total_area=sum(r.area for r in rooms))
        results.append({
            "floor_plan": fp,
            "source": source,
            "plan_name": plan_data.get("plan_name", f"{source} plan"),
            "strategy": plan_data.get("strategy", ""),
            "reasoning": plan_data.get("reasoning", ""),
        })
    return results


def _generate_grok_demo(polygon_coords, apartment_program, plan_count):
    """Grok demo: ıslak hacim gruplamalı yerleşim."""
    import math
    results = []

    if polygon_coords and len(polygon_coords) >= 3:
        xs = [c[0] for c in polygon_coords]
        ys = [c[1] for c in polygon_coords]
        tw, th = max(xs) - min(xs), max(ys) - min(ys)
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

    # Grok strateji: ıslak hacimler bir blokta
    wet = [o for o in odalar if o.get("tip") in ("banyo", "wc", "mutfak")]
    dry = [o for o in odalar if o.get("tip") in ("salon", "yatak_odasi", "balkon")]
    other = [o for o in odalar if o.get("tip") in ("antre", "koridor")]

    for idx in range(min(plan_count, 2)):
        rooms = []
        y_cur = oy + 0.10

        # Dry rooms sol tarafta
        x_dry = ox + 0.10
        for oda in dry:
            m2 = oda.get("m2", oda.get("varsayilan_m2", 12))
            w = min(tw * 0.6, max(3.0, math.sqrt(m2 * 1.3)))
            h = m2 / w
            if y_cur + h > oy + th - 0.10:
                break
            rooms.append(PlanRoom(
                name=oda["isim"], room_type=oda["tip"],
                x=round(x_dry, 2), y=round(y_cur, 2),
                width=round(w, 2), height=round(h, 2),
                has_exterior_wall=True,
                facing_direction="south" if y_cur < oy + 1 else "west",
            ))
            y_cur += h + 0.10

        # Wet rooms sağ üst blokta
        wet_x = ox + tw * 0.65
        y_wet = oy + 0.10
        for oda in wet:
            m2 = oda.get("m2", oda.get("varsayilan_m2", 5))
            w = min(tw * 0.30, max(2.0, math.sqrt(m2)))
            h = m2 / w
            if y_wet + h > oy + th - 0.10:
                break
            rooms.append(PlanRoom(
                name=oda["isim"], room_type=oda["tip"],
                x=round(wet_x, 2), y=round(y_wet, 2),
                width=round(w, 2), height=round(h, 2),
                has_exterior_wall=True, facing_direction="east",
            ))
            y_wet += h + 0.10

        fp = FloorPlan(rooms=rooms, total_area=sum(r.area for r in rooms),
                       apartment_type=apartment_program.get("tip", "3+1"))
        results.append({
            "floor_plan": fp,
            "source": "grok",
            "plan_name": f"Grok Strateji {idx + 1}",
            "strategy": "Islak hacim gruplaması",
            "reasoning": f"Demo plan {idx + 1} — Grok ıslak hacim gruplamalı yerleşim",
        })

    return results
