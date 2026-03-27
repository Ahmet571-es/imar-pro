"""
Post-Processing Doğrulama — Katman 3 Güvenlik.

AI'ın ürettiği planı doğrular ve düzeltir:
1. Oda çakışma tespiti ve çözümü
2. Yapılaşma sınırları kontrolü
3. Yönetmelik uyumu
4. Minimum boyut kontrolü
"""

import logging
import math
from dataclasses import dataclass, field
from core.plan_scorer import FloorPlan, PlanRoom
from config.turkish_building_codes import MIN_ODA_ALANLARI

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Doğrulama sonucu."""
    is_valid: bool = True
    overlap_count: int = 0
    boundary_violations: int = 0
    code_violations: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    fixes_applied: list = field(default_factory=list)


def validate_and_fix(
    plan: FloorPlan,
    buildable_width: float,
    buildable_height: float,
    origin_x: float = 0.0,
    origin_y: float = 0.0,
) -> tuple[FloorPlan, ValidationResult]:
    """Planı doğrula ve mümkünse düzelt.

    Returns:
        (düzeltilmiş_plan, doğrulama_sonucu)
    """
    result = ValidationResult()
    rooms = list(plan.rooms)

    # ── 1. Sınır Dışı Odaları Düzelt ──
    for room in rooms:
        fixed = False
        # X sınırları
        if room.x < origin_x:
            room.x = origin_x + 0.10
            fixed = True
        if room.x + room.width > origin_x + buildable_width:
            overflow = (room.x + room.width) - (origin_x + buildable_width)
            if overflow < room.width * 0.3:
                room.width -= overflow + 0.05
            else:
                room.x = origin_x + buildable_width - room.width - 0.10
            fixed = True

        # Y sınırları
        if room.y < origin_y:
            room.y = origin_y + 0.10
            fixed = True
        if room.y + room.height > origin_y + buildable_height:
            overflow = (room.y + room.height) - (origin_y + buildable_height)
            if overflow < room.height * 0.3:
                room.height -= overflow + 0.05
            else:
                room.y = origin_y + buildable_height - room.height - 0.10
            fixed = True

        if fixed:
            result.fixes_applied.append(f"{room.name}: sınır düzeltmesi")
            result.boundary_violations += 1

    # ── 2. Çakışma Tespiti ve Çözümü ──
    max_iterations = 20
    for iteration in range(max_iterations):
        overlaps = _detect_overlaps(rooms)
        if not overlaps:
            break

        result.overlap_count = len(overlaps)

        for i, j in overlaps:
            r1, r2 = rooms[i], rooms[j]
            _resolve_overlap(r1, r2, buildable_width, buildable_height, origin_x, origin_y)
            result.fixes_applied.append(
                f"İter {iteration + 1}: {r1.name}↔{r2.name} çakışma çözüldü"
            )

    # Final çakışma kontrolü
    final_overlaps = _detect_overlaps(rooms)
    if final_overlaps:
        result.is_valid = False
        result.overlap_count = len(final_overlaps)
        for i, j in final_overlaps:
            result.warnings.append(f"ÇAKIŞMA ÇÖZÜLEMEDI: {rooms[i].name}↔{rooms[j].name}")

    # ── 3. Minimum Alan Kontrolü ──
    for room in rooms:
        kural = MIN_ODA_ALANLARI.get(room.room_type)
        if kural and room.area < kural["min_alan"]:
            result.code_violations.append(
                f"{room.name}: {room.area:.1f}m² < min {kural['min_alan']}m²"
            )

    # ── 4. En-Boy Oranı Kontrolü ──
    for room in rooms:
        ar = room.aspect_ratio
        if ar < 0.35 and room.room_type not in ("koridor", "balkon"):
            result.warnings.append(
                f"{room.name}: aşırı dar ({room.width:.1f}×{room.height:.1f}, oran={ar:.2f})"
            )

    # ── 5. Dış Cephe Kontrolü + Yön Belirleme ──
    for room in rooms:
        tol = 0.30  # Dış duvar kalınlığı (0.25m) + tolerans
        is_on_edge = (
            room.x <= origin_x + tol or
            room.x + room.width >= origin_x + buildable_width - tol or
            room.y <= origin_y + tol or
            room.y + room.height >= origin_y + buildable_height - tol
        )
        room.has_exterior_wall = is_on_edge

        # facing_direction güncelle (güneş optimizasyonu puanı için gerekli)
        if is_on_edge and not room.facing_direction:
            if room.y <= origin_y + tol:
                room.facing_direction = "south"
            elif room.y + room.height >= origin_y + buildable_height - tol:
                room.facing_direction = "north"
            elif room.x <= origin_x + tol:
                room.facing_direction = "west"
            elif room.x + room.width >= origin_x + buildable_width - tol:
                room.facing_direction = "east"

    if result.code_violations:
        result.is_valid = False

    # Yeni FloorPlan oluştur
    fixed_plan = FloorPlan(
        rooms=rooms,
        total_area=sum(r.area for r in rooms),
        apartment_type=plan.apartment_type,
    )

    return fixed_plan, result


def _detect_overlaps(rooms: list[PlanRoom], tolerance: float = 0.05) -> list[tuple[int, int]]:
    """Çakışan oda çiftlerini tespit eder."""
    overlaps = []
    for i in range(len(rooms)):
        for j in range(i + 1, len(rooms)):
            r1, r2 = rooms[i], rooms[j]
            # AABB overlap test
            if (r1.x + tolerance < r2.x + r2.width and
                r1.x + r1.width > r2.x + tolerance and
                r1.y + tolerance < r2.y + r2.height and
                r1.y + r1.height > r2.y + tolerance):
                overlaps.append((i, j))
    return overlaps


def _resolve_overlap(
    r1: PlanRoom, r2: PlanRoom,
    bw: float, bh: float, ox: float, oy: float
):
    """İki odanın çakışmasını çözer — küçük odayı kaydırır."""
    # Overlap miktarını hesapla
    dx_right = (r1.x + r1.width) - r2.x
    dx_left = (r2.x + r2.width) - r1.x
    dy_up = (r1.y + r1.height) - r2.y
    dy_down = (r2.y + r2.height) - r1.y

    # Minimum kaydırma yönünü bul
    min_shift = min(abs(dx_right), abs(dx_left), abs(dy_up), abs(dy_down))

    # Küçük odayı kaydır
    mover = r2 if r2.area <= r1.area else r1
    gap = 0.10  # Odalar arası boşluk

    if min_shift == abs(dx_right):
        mover.x = r1.x + r1.width + gap if mover is r2 else r2.x - r1.width - gap
    elif min_shift == abs(dx_left):
        mover.x = r1.x - mover.width - gap if mover is r2 else r2.x + r2.width + gap
    elif min_shift == abs(dy_up):
        mover.y = r1.y + r1.height + gap if mover is r2 else r2.y - r1.height - gap
    else:
        mover.y = r1.y - mover.height - gap if mover is r2 else r2.y + r2.height + gap

    # Sınır kontrolü
    mover.x = max(ox + 0.10, min(mover.x, ox + bw - mover.width - 0.10))
    mover.y = max(oy + 0.10, min(mover.y, oy + bh - mover.height - 0.10))
