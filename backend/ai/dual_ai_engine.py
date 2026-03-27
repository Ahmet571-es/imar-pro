"""
Dual AI Plan Üretim Motoru — Claude Sonnet 4.6 + Grok 4 + Layout Engine.

MİMARİ:
  Katman 1: AI mimari program üretir (oda ilişki grafiği + boyut tercihleri)
  Katman 1b: Layout Engine AI programını fiziksel koordinatlara çevirir
  Katman 2: Post-processing doğrulama (çakışma, sınır, yönetmelik)
  Katman 3: Plan scorer ile puanlama + çapraz değerlendirme
  Katman 4: Layout Engine bağımsız stratejiler üretir (AI'dan bağımsız)
  Katman 5: Hibrit plan (en iyi 2'nin sentezi)
"""

import logging
from dataclasses import dataclass, field

from ai.claude_planner import generate_plans_claude
from ai.grok_planner import generate_plans_grok
from ai.cross_review import cross_review
from ai.consensus import select_best_plans
from ai.post_processor import validate_and_fix
from ai.program_bridge import generate_hybrid_plan
from core.plan_scorer import score_plan, FloorPlan, ScoreBreakdown
from core.layout_engine import LayoutEngine, build_room_program

logger = logging.getLogger(__name__)


@dataclass
class PlanAlternatif:
    """Bir plan alternatifi."""
    plan: FloorPlan
    source: str
    plan_name: str = ""
    strategy: str = ""
    score: ScoreBreakdown | None = None
    cross_review_score: float = 0.0
    cross_review_notes: str = ""
    final_score: float = 0.0
    reasoning: str = ""
    validation_warnings: list = field(default_factory=list)
    validation_fixes: list = field(default_factory=list)

    def to_dict(self) -> dict:
        rooms_data = []
        for r in self.plan.rooms:
            rooms_data.append({
                "name": r.name,
                "type": r.room_type,
                "x": round(r.x, 2),
                "y": round(r.y, 2),
                "width": round(r.width, 2),
                "height": round(r.height, 2),
                "area": round(r.area, 1),
                "is_exterior": r.has_exterior_wall,
                "facing": r.facing_direction,
                "doors": r.doors,
                "windows": r.windows,
            })

        return {
            "plan_name": self.plan_name,
            "source": self.source,
            "strategy": self.strategy,
            "reasoning": self.reasoning,
            "rooms": rooms_data,
            "total_area": round(self.plan.total_area, 1),
            "room_count": len(self.plan.rooms),
            "score": self.score.to_dict() if self.score else {},
            "score_total": round(self.score.total, 1) if self.score else 0,
            "cross_review_score": round(self.cross_review_score, 1),
            "cross_review_notes": self.cross_review_notes,
            "final_score": round(self.final_score, 1),
            "validation_warnings": self.validation_warnings,
            "validation_fixes": self.validation_fixes,
        }


@dataclass
class DualAIResult:
    """Dual AI sonuç paketi."""
    all_plans: list[PlanAlternatif] = field(default_factory=list)
    best_plans: list[PlanAlternatif] = field(default_factory=list)
    iteration: int = 1
    summary: str = ""

    def to_dict(self) -> dict:
        return {
            "best_plans": [p.to_dict() for p in self.best_plans],
            "all_plans_count": len(self.all_plans),
            "iteration": self.iteration,
            "summary": self.summary,
        }


def generate_dual_ai_plans(
    buildable_polygon_coords: list[tuple[float, float]],
    apartment_program: dict,
    dataset_rules: dict,
    sun_best_direction: str = "south",
    claude_api_key: str = "",
    grok_api_key: str = "",
    max_iterations: int = 1,
) -> DualAIResult:
    """Dual AI + Layout Engine ile plan üretim döngüsü.
    
    5 KATMANLI MİMARİ:
    1. Claude + Grok AI planları (API key varsa)
    2. Layout Engine bağımsız stratejiler (her zaman)
    3. Post-processing + puanlama
    4. Cross-review (API key varsa)
    5. Hibrit plan (en iyi 2'nin sentezi)
    """
    result = DualAIResult()

    # Yapılaşma boyutlarını hesapla
    if buildable_polygon_coords and len(buildable_polygon_coords) >= 3:
        xs = [c[0] for c in buildable_polygon_coords]
        ys = [c[1] for c in buildable_polygon_coords]
        bw = max(xs) - min(xs)
        bh = max(ys) - min(ys)
        ox, oy = min(xs), min(ys)
    else:
        bw, bh, ox, oy = 14.0, 10.0, 0.0, 0.0

    odalar = apartment_program.get("odalar", [])
    apt_type = apartment_program.get("tip", "3+1")

    for iteration in range(1, max_iterations + 1):
        result.iteration = iteration
        logger.info(f"=== Dual AI İterasyon {iteration}/{max_iterations} ===")

        # ── KATMAN 1: AI Plan Üretimi (PARALEL — Claude + Grok aynı anda) ──

        from concurrent.futures import ThreadPoolExecutor, as_completed

        ai_futures = {}
        with ThreadPoolExecutor(max_workers=2) as executor:
            if claude_api_key:
                ai_futures['claude'] = executor.submit(
                    generate_plans_claude,
                    polygon_coords=buildable_polygon_coords,
                    apartment_program=apartment_program,
                    dataset_rules=dataset_rules,
                    sun_direction=sun_best_direction,
                    api_key=claude_api_key,
                    plan_count=2,
                    previous_feedback=_get_feedback(result.best_plans) if iteration > 1 else None,
                )

            if grok_api_key:
                ai_futures['grok'] = executor.submit(
                    generate_plans_grok,
                    polygon_coords=buildable_polygon_coords,
                    apartment_program=apartment_program,
                    dataset_rules=dataset_rules,
                    sun_direction=sun_best_direction,
                    api_key=grok_api_key,
                    plan_count=2,
                    previous_feedback=_get_feedback(result.best_plans) if iteration > 1 else None,
                )

            for source, future in ai_futures.items():
                try:
                    plans = future.result(timeout=90)  # 90s max per AI
                    for p in plans:
                        result.all_plans.append(PlanAlternatif(
                            plan=p["floor_plan"],
                            source=source,
                            plan_name=p.get("plan_name", f"{source.title()} Plan"),
                            strategy=p.get("strategy", ""),
                            reasoning=p.get("reasoning", ""),
                        ))
                    logger.info(f"{source.title()}: {len(plans)} plan üretildi")
                except Exception as e:
                    logger.error(f"{source.title()} hata: {e}")

        # ── KATMAN 1b: Layout Engine bağımsız stratejiler ──
        try:
            room_program = build_room_program(odalar, apt_type)
            engine = LayoutEngine(width=bw, height=bh, origin_x=ox, origin_y=oy)
            
            # AI planları varsa sadece 2 farklı strateji ekle, yoksa 5 strateji
            strategies = ["south_social", "privacy_zones"] if result.all_plans else [
                "south_social", "central_corridor", "privacy_zones", "compact_efficient", "sun_maximum"
            ]
            
            for strategy in strategies:
                layout = engine.generate(room_program, strategy)
                if layout.is_valid and layout.rooms:
                    fp = layout.to_floor_plan(bw, bh, ox, oy, apt_type)
                    result.all_plans.append(PlanAlternatif(
                        plan=fp,
                        source="engine",
                        plan_name=layout.strategy_name,
                        strategy=layout.strategy_description,
                        reasoning=f"Layout engine '{layout.strategy_name}' — {len(layout.rooms)} oda",
                    ))
            logger.info(f"Layout Engine: {len(strategies)} strateji üretildi")
        except Exception as e:
            logger.error(f"Layout Engine hata: {e}")

        # ── KATMAN 2: Post-Processing Doğrulama ──
        for alt in result.all_plans:
            if not alt.validation_fixes and alt.source != "engine":  # Engine planları zaten valid
                fixed_plan, validation = validate_and_fix(alt.plan, bw, bh, ox, oy)
                alt.plan = fixed_plan
                alt.validation_warnings = validation.warnings + validation.code_violations
                alt.validation_fixes = validation.fixes_applied

        # ── KATMAN 3: Puanlama ──
        for alt in result.all_plans:
            if alt.score is None:
                alt.score = score_plan(alt.plan, sun_best_direction=sun_best_direction)

        # En iyi 4'ü seç (çeşitlilik korumalı)
        result.best_plans = select_best_plans(result.all_plans, top_n=4)

        # ── KATMAN 4: Çapraz değerlendirme (API key varsa) ──
        if claude_api_key or grok_api_key:
            try:
                cross_review(
                    plans=result.best_plans,
                    claude_api_key=claude_api_key,
                    grok_api_key=grok_api_key,
                )
            except Exception as e:
                logger.error(f"Cross-review hata: {e}")

        # Final puanı
        for alt in result.best_plans:
            own_score = alt.score.total if alt.score else 0
            if alt.cross_review_score > 0:
                alt.final_score = own_score * 0.4 + alt.cross_review_score * 0.6
            else:
                alt.final_score = own_score

        # ── KATMAN 5: Hibrit plan ──
        if len(result.best_plans) >= 2:
            try:
                p1, p2 = result.best_plans[0], result.best_plans[1]
                s1 = p1.score or ScoreBreakdown()
                s2 = p2.score or ScoreBreakdown()
                hybrid_result, hybrid_reasoning = generate_hybrid_plan(
                    p1.plan, p2.plan, s1, s2, bw, bh, ox, oy, sun_best_direction
                )
                if hybrid_result and hybrid_result.is_valid and hybrid_result.rooms:
                    hybrid_fp = hybrid_result.to_floor_plan(bw, bh, ox, oy, apt_type)
                    hybrid_score = score_plan(hybrid_fp, sun_best_direction=sun_best_direction)
                    hybrid_alt = PlanAlternatif(
                        plan=hybrid_fp,
                        source="hybrid",
                        plan_name="AI Hibrit Sentez",
                        strategy=hybrid_result.strategy_description,
                        reasoning=hybrid_reasoning,
                        score=hybrid_score,
                        final_score=hybrid_score.total,
                    )
                    result.best_plans.append(hybrid_alt)
                    logger.info(f"Hibrit plan üretildi: {hybrid_score.total:.1f}/100")
            except Exception as e:
                logger.error(f"Hibrit plan hata: {e}")

        result.best_plans.sort(key=lambda x: x.final_score, reverse=True)

        if result.best_plans:
            logger.info(
                f"İterasyon {iteration}: {len(result.best_plans)} plan, "
                f"en iyi: {result.best_plans[0].final_score:.1f}/100 ({result.best_plans[0].source})"
            )

    # Özet
    sources = set(p.source for p in result.best_plans)
    if result.best_plans:
        result.summary = (
            f"{len(result.all_plans)} plan üretildi ({', '.join(sources)}), en iyi {len(result.best_plans)} seçildi. "
            f"En yüksek: {result.best_plans[0].final_score:.1f}/100 ({result.best_plans[0].source})"
        )

    return result


def _get_feedback(best_plans: list[PlanAlternatif]) -> str:
    parts = []
    for p in best_plans:
        if p.cross_review_notes:
            parts.append(f"Plan ({p.source}): {p.cross_review_notes}")
        if p.validation_warnings:
            parts.append("Doğrulama: " + "; ".join(p.validation_warnings[:3]))
    return "\n".join(parts) if parts else ""
