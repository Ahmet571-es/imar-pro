"""
AI → Layout Engine Köprüsü

İki ana işlev:
1. ai_program_to_layout(): AI mimari programını RoomRequest'lere dönüştürür
2. generate_hybrid_plan(): En iyi 2 planın güçlü yönlerini birleştirir

AKIŞ:
  AI (Claude/Grok) → Mimari Program JSON → ai_program_to_layout() → RoomRequest[]
  → LayoutEngine.generate() → PlacedRoom[] → FloorPlan

  Hybrid: Plan1 + Plan2 → analyze_strengths() → merged RoomRequest[] 
  → LayoutEngine.generate() → hybrid FloorPlan
"""

import logging
from dataclasses import dataclass, field
from core.layout_engine import LayoutEngine, LayoutResult, RoomRequest, build_room_program
from core.plan_scorer import FloorPlan, score_plan, ScoreBreakdown

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# AI PROGRAM → LAYOUT ENGINE
# ═══════════════════════════════════════════════════════════════

@dataclass
class AIRoomSpec:
    """AI'ın ürettiği oda spesifikasyonu (koordinat YOK — sadece mimari tercihler)."""
    name: str
    room_type: str
    target_area: float
    preferred_facing: str = ""
    priority_zone: str = ""  # "south", "north", "center", "any"
    adjacent_rooms: list[str] = field(default_factory=list)
    special_notes: str = ""


@dataclass
class AIArchitecturalProgram:
    """AI'ın ürettiği mimari program (koordinat değil, kavramsal)."""
    rooms: list[AIRoomSpec] = field(default_factory=list)
    corridor_position: str = "center"  # "center", "south_third", "north_third"
    layout_concept: str = ""  # "open_plan", "corridor_based", "zones"
    sun_strategy: str = ""
    privacy_strategy: str = ""


def ai_program_to_layout(
    program: AIArchitecturalProgram,
    base_odalar: list[dict],
) -> list[RoomRequest]:
    """AI mimari programını layout engine RoomRequest listesine dönüştürür.
    
    AI'ın verdiği tercihler (yön, bitişiklik, zon) RoomRequest alanlarına aktarılır.
    Layout engine bu constraint'lere göre yerleştirme yapar.
    """
    # Base room program
    room_requests = build_room_program(base_odalar)
    
    # AI spesifikasyonlarını uygula
    ai_by_name = {r.name: r for r in program.rooms}
    
    for req in room_requests:
        ai_spec = ai_by_name.get(req.name)
        if not ai_spec:
            # İsimle bulunamazsa tip ile dene
            for spec in program.rooms:
                if spec.room_type == req.room_type and spec.name not in [r.name for r in room_requests if r != req]:
                    ai_spec = spec
                    break
        
        if ai_spec:
            # AI'ın alan önerisini uygula (varsa)
            if ai_spec.target_area > 0:
                req.target_area = ai_spec.target_area
                req.min_area = ai_spec.target_area * 0.75
                req.max_area = ai_spec.target_area * 1.30
            
            # Yön tercihini uygula
            if ai_spec.preferred_facing:
                req.preferred_facing = ai_spec.preferred_facing
            
            # Bitişiklik kısıtlarını güncelle
            if ai_spec.adjacent_rooms:
                req.adjacent_to = ai_spec.adjacent_rooms
    
    return room_requests


def parse_ai_json_to_program(ai_json: dict) -> AIArchitecturalProgram:
    """AI JSON çıktısını AIArchitecturalProgram'a parse eder.
    
    Beklenen format:
    {
        "concept": "open_plan",
        "corridor": "center",
        "sun_strategy": "south_facing_living",
        "rooms": [
            {"name": "Salon", "type": "salon", "area": 28, "facing": "south", 
             "zone": "south", "adjacent": ["balkon", "mutfak"]}
        ]
    }
    """
    program = AIArchitecturalProgram()
    program.layout_concept = ai_json.get("concept", "")
    program.corridor_position = ai_json.get("corridor", "center")
    program.sun_strategy = ai_json.get("sun_strategy", "")
    program.privacy_strategy = ai_json.get("privacy_strategy", "")
    
    for r in ai_json.get("rooms", []):
        program.rooms.append(AIRoomSpec(
            name=r.get("name", "Oda"),
            room_type=r.get("type", "diger"),
            target_area=float(r.get("area", 0)),
            preferred_facing=r.get("facing", ""),
            priority_zone=r.get("zone", "any"),
            adjacent_rooms=r.get("adjacent", []),
            special_notes=r.get("notes", ""),
        ))
    
    return program


# ═══════════════════════════════════════════════════════════════
# HYBRID PLAN GENERATION
# ═══════════════════════════════════════════════════════════════

@dataclass
class PlanStrength:
    """Bir planın güçlü yönleri."""
    plan_index: int
    best_dimensions: dict[str, tuple[float, float]]  # room_type → (width, height)
    best_score_dims: list[str]  # En iyi puan alan boyutlar
    strategy_name: str = ""


def analyze_plan_strengths(
    plans: list[FloorPlan],
    scores: list[ScoreBreakdown],
) -> list[PlanStrength]:
    """Her planın güçlü yönlerini analiz et."""
    strengths = []
    
    for i, (plan, score) in enumerate(zip(plans, scores)):
        dims = {}
        for room in plan.rooms:
            dims[room.name] = (room.width, room.height)
        
        # Hangi puan boyutlarında en iyi?
        best_dims = []
        all_scores = [
            ("room_size", score.room_size),
            ("adjacency", score.adjacency),
            ("exterior", score.exterior_wall),
            ("wet_area", score.wet_area),
            ("sun", score.sun_optimization),
            ("circulation", score.circulation),
        ]
        
        for dim_name, dim_score in all_scores:
            # Bu boyutta diğer planlardan daha iyi mi?
            is_best = True
            for j, other_score in enumerate(scores):
                if j == i:
                    continue
                other_val = getattr(other_score, dim_name.replace("exterior", "exterior_wall").replace("sun", "sun_optimization"), 0)
                if other_val > dim_score:
                    is_best = False
                    break
            if is_best:
                best_dims.append(dim_name)
        
        strengths.append(PlanStrength(
            plan_index=i,
            best_dimensions=dims,
            best_score_dims=best_dims,
        ))
    
    return strengths


def generate_hybrid_plan(
    plan1: FloorPlan,
    plan2: FloorPlan,
    score1: ScoreBreakdown,
    score2: ScoreBreakdown,
    buildable_width: float,
    buildable_height: float,
    origin_x: float = 0,
    origin_y: float = 0,
    sun_direction: str = "south",
) -> tuple[LayoutResult | None, str]:
    """İki planın güçlü yönlerini birleştiren hybrid plan üret.
    
    Yaklaşım:
    1. Her oda için en iyi boyutları seç (hangi plan o oda tipinde daha iyi puandı)
    2. Bitişiklik ilişkilerini her iki plandan en iyisini al
    3. En yüksek puanlı planın stratejisini temel al
    4. Layout engine ile yeniden yerleştir
    
    Returns:
        (LayoutResult, reasoning_text)
    """
    if not plan1.rooms or not plan2.rooms:
        return None, "Planlardan biri boş"
    
    # Her oda tipi için en iyi boyutları belirle
    room_scores_1 = {}
    room_scores_2 = {}
    
    for room in plan1.rooms:
        # Basit kalite metriği: alan hedef aralıkta mı + oran iyi mi
        from dataset.dataset_rules import ROOM_SIZE_STATS, ROOM_ASPECT_RATIOS
        stats = ROOM_SIZE_STATS.get(room.room_type, {})
        if stats:
            area_fit = 1.0 if stats.get("min", 0) <= room.area <= stats.get("max", 999) else 0.5
        else:
            area_fit = 0.7
        room_scores_1[room.name] = area_fit * room.aspect_ratio
    
    for room in plan2.rooms:
        stats = ROOM_SIZE_STATS.get(room.room_type, {})
        if stats:
            area_fit = 1.0 if stats.get("min", 0) <= room.area <= stats.get("max", 999) else 0.5
        else:
            area_fit = 0.7
        room_scores_2[room.name] = area_fit * room.aspect_ratio
    
    # Hybrid oda programı: her oda için en iyi boyutu al
    hybrid_rooms = []
    all_names = set()
    
    for room1 in plan1.rooms:
        all_names.add(room1.name)
        room2 = next((r for r in plan2.rooms if r.name == room1.name), None)
        
        if room2:
            # Her iki planda da var — en iyi boyutu al
            s1 = room_scores_1.get(room1.name, 0)
            s2 = room_scores_2.get(room2.name, 0)
            best = room1 if s1 >= s2 else room2
            hybrid_rooms.append({
                "isim": best.name,
                "tip": best.room_type,
                "m2": round(best.area, 1),
            })
        else:
            hybrid_rooms.append({
                "isim": room1.name,
                "tip": room1.room_type,
                "m2": round(room1.area, 1),
            })
    
    # Plan 2'de olup plan 1'de olmayan odalar
    for room2 in plan2.rooms:
        if room2.name not in all_names:
            hybrid_rooms.append({
                "isim": room2.name,
                "tip": room2.room_type,
                "m2": round(room2.area, 1),
            })
    
    # Hybrid oda programını layout engine'e ver
    program = build_room_program(hybrid_rooms)
    engine = LayoutEngine(buildable_width, buildable_height, origin_x, origin_y)
    
    # En yüksek puanlı planın stratejisi
    base_strategy = "south_social" if score1.total >= score2.total else "privacy_zones"
    
    result = engine.generate(program, base_strategy)
    result.strategy_name = "AI Hibrit Sentez"
    result.strategy_description = (
        f"Plan 1 ({score1.total:.0f} puan) ve Plan 2 ({score2.total:.0f} puan) "
        f"güçlü yönleri birleştirildi. Her oda için en iyi boyutlar seçildi."
    )
    
    reasoning = (
        f"Hibrit plan: {len(hybrid_rooms)} oda, "
        f"Plan 1'den {sum(1 for r in plan1.rooms if room_scores_1.get(r.name,0) >= room_scores_2.get(r.name,0))} oda boyutu, "
        f"Plan 2'den {sum(1 for r in plan2.rooms if room_scores_2.get(r.name,0) > room_scores_1.get(r.name,0))} oda boyutu alındı. "
        f"Strateji: {base_strategy}"
    )
    
    return result, reasoning


# ═══════════════════════════════════════════════════════════════
# AI PROMPT TEMPLATES (mimari program çıktısı için)
# ═══════════════════════════════════════════════════════════════

ARCHITECTURAL_PROGRAM_PROMPT = """Sen uzman bir Türk konut mimarısın.

GÖREVİN: Verilen kısıtlara göre bir MİMARİ PROGRAM tasarla. 
KOORDİNAT ÜRETMEYECEKSİN. Sadece mimari kararları ver.

YAPILAŞMA ALANI: {width:.1f}m × {height:.1f}m = {area:.0f} m²
DAİRE TİPİ: {apartment_type}
BRÜT ALAN: {gross_area} m²
GÜNEŞ: En iyi güneş {sun_direction} cephesinden geliyor

ODALAR:
{rooms_list}

ŞU KARARLARI VER:
1. Her oda için ideal alan (m²) ve neden
2. Her oda için yön tercihi (north/south/east/west) ve neden
3. Her oda hangi bölgede olmalı (south/north/center)
4. Hangi odalar bitişik olmalı ve neden
5. Koridor pozisyonu (center/south_third/north_third)
6. Genel yerleşim konsepti (open_plan/corridor_based/zones)

SADECE JSON formatında yanıt ver:
{{
  "concept": "corridor_based",
  "corridor": "center",
  "sun_strategy": "açıklama",
  "privacy_strategy": "açıklama",
  "rooms": [
    {{
      "name": "Salon",
      "type": "salon", 
      "area": 28,
      "facing": "south",
      "zone": "south",
      "adjacent": ["balkon", "mutfak"],
      "notes": "Güney cephe zorunlu, balkonla bağlantı"
    }}
  ]
}}"""


def build_architectural_prompt(
    width: float, height: float, apartment_type: str,
    gross_area: float, sun_direction: str, odalar: list[dict]
) -> str:
    """AI'a gönderilecek mimari program prompt'u oluştur."""
    rooms_list = "\n".join(
        f"  - {o.get('isim', 'Oda')} ({o.get('tip', 'diger')}): hedef {o.get('m2', 10)} m²"
        for o in odalar
    )
    
    return ARCHITECTURAL_PROGRAM_PROMPT.format(
        width=width,
        height=height,
        area=width * height,
        apartment_type=apartment_type,
        gross_area=gross_area,
        sun_direction=sun_direction,
        rooms_list=rooms_list,
    )
