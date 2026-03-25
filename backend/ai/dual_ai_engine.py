"""
Dual AI Plan Üretim Motoru — Claude Sonnet 4.6 + Grok 4 koordinatörü.

3 Katmanlı Güvenlik:
  Katman 1: AI mimari plan üretir (koordinatlar dahil)
  Katman 2: Post-processing doğrulama (çakışma, sınır, yönetmelik)
  Katman 3: Plan scorer ile puanlama + çapraz değerlendirme
"""

import logging
from dataclasses import dataclass, field

from ai.claude_planner import generate_plans_claude
from ai.grok_planner import generate_plans_grok
from ai.cross_review import cross_review
from ai.consensus import select_best_plans
from ai.post_processor import validate_and_fix
from core.plan_scorer import score_plan, FloorPlan, ScoreBreakdown

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
    """Dual AI ile plan üretim döngüsü."""
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

    for iteration in range(1, max_iterations + 1):
        result.iteration = iteration
        logger.info(f"=== Dual AI İterasyon {iteration}/{max_iterations} ===")

        # ── KATMAN 1: AI Plan Üretimi ──

        # Claude'dan 2 plan
        try:
            claude_plans = generate_plans_claude(
                polygon_coords=buildable_polygon_coords,
                apartment_program=apartment_program,
                dataset_rules=dataset_rules,
                sun_direction=sun_best_direction,
                api_key=claude_api_key,
                plan_count=2,
                previous_feedback=_get_feedback(result.best_plans) if iteration > 1 else None,
            )
            for p in claude_plans:
                result.all_plans.append(PlanAlternatif(
                    plan=p["floor_plan"],
                    source=p.get("source", "claude"),
                    plan_name=p.get("plan_name", "Claude Plan"),
                    strategy=p.get("strategy", ""),
                    reasoning=p.get("reasoning", ""),
                ))
            logger.info(f"Claude: {len(claude_plans)} plan üretildi")
        except Exception as e:
            logger.error(f"Claude hata: {e}")

        # Grok'tan 2 plan
        try:
            grok_plans = generate_plans_grok(
                polygon_coords=buildable_polygon_coords,
                apartment_program=apartment_program,
                dataset_rules=dataset_rules,
                sun_direction=sun_best_direction,
                api_key=grok_api_key,
                plan_count=2,
                previous_feedback=_get_feedback(result.best_plans) if iteration > 1 else None,
            )
            for p in grok_plans:
                result.all_plans.append(PlanAlternatif(
                    plan=p["floor_plan"],
                    source=p.get("source", "grok"),
                    plan_name=p.get("plan_name", "Grok Plan"),
                    strategy=p.get("strategy", ""),
                    reasoning=p.get("reasoning", ""),
                ))
            logger.info(f"Grok: {len(grok_plans)} plan üretildi")
        except Exception as e:
            logger.error(f"Grok hata: {e}")

        # ── KATMAN 2: Post-Processing Doğrulama ──
        for alt in result.all_plans:
            if not alt.validation_fixes:  # henüz doğrulanmamış
                fixed_plan, validation = validate_and_fix(
                    alt.plan, bw, bh, ox, oy
                )
                alt.plan = fixed_plan
                alt.validation_warnings = validation.warnings + validation.code_violations
                alt.validation_fixes = validation.fixes_applied

                if validation.fixes_applied:
                    logger.info(f"{alt.plan_name}: {len(validation.fixes_applied)} düzeltme uygulandı")

        # ── KATMAN 3: Puanlama + Çapraz Değerlendirme ──
        for alt in result.all_plans:
            if alt.score is None:
                alt.score = score_plan(alt.plan, sun_best_direction=sun_best_direction)

        # En iyi 3'ü seç
        result.best_plans = select_best_plans(result.all_plans, top_n=3)

        # Çapraz değerlendirme
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
            alt.final_score = own_score * 0.4 + alt.cross_review_score * 0.6

        result.best_plans.sort(key=lambda x: x.final_score, reverse=True)

        if result.best_plans:
            logger.info(
                f"İterasyon {iteration} tamamlandı. "
                f"En iyi: {result.best_plans[0].final_score:.1f}/100 ({result.best_plans[0].source})"
            )

    # Özet
    if result.best_plans:
        result.summary = (
            f"{len(result.all_plans)} plan üretildi, en iyi 3 seçildi. "
            f"En yüksek puan: {result.best_plans[0].final_score:.1f}/100 "
            f"({result.best_plans[0].source} — {result.best_plans[0].plan_name})"
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
