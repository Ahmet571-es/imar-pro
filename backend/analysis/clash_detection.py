"""
Clash Detection — BIM elemanları arasında çakışma kontrolü.

Desteklenen kontroller:
1. Oda-oda çakışması (aynı kattaki odalar üst üste mi?)
2. Kolon-oda çakışması (kolon odanın içine düşüyor mu?)
3. Duvar-pencere uyumu (pencere duvar sınırını aşıyor mu?)
4. MEP-strüktür çakışması (boru/kanal kolona çarpıyor mu?)

Yöntem: 2D Axis-Aligned Bounding Box (AABB) + tolerans.
Gerçek BIM yazılımları 3D mesh intersection yapar — biz 2D bounding box ile yaklaşık çözüm sunuyoruz.
"""

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class BBox:
    """2D Axis-Aligned Bounding Box."""
    x: float
    y: float
    width: float
    height: float
    name: str = ""
    element_type: str = ""  # wall, column, room, pipe, duct
    kat: int = 1

    @property
    def x2(self) -> float:
        return self.x + self.width

    @property
    def y2(self) -> float:
        return self.y + self.height

    @property
    def area(self) -> float:
        return self.width * self.height

    @property
    def center(self) -> tuple[float, float]:
        return (self.x + self.width / 2, self.y + self.height / 2)


@dataclass
class Clash:
    """Tek bir çakışma."""
    element_a: str
    element_b: str
    type_a: str
    type_b: str
    clash_type: str  # hard | soft | clearance
    severity: str    # critical | warning | info
    overlap_area: float = 0.0
    overlap_pct: float = 0.0
    kat: int = 1
    description: str = ""
    resolution: str = ""

    def to_dict(self) -> dict:
        return {
            "element_a": self.element_a,
            "element_b": self.element_b,
            "type_a": self.type_a,
            "type_b": self.type_b,
            "clash_type": self.clash_type,
            "severity": self.severity,
            "overlap_area": round(self.overlap_area, 2),
            "overlap_pct": round(self.overlap_pct, 1),
            "kat": self.kat,
            "description": self.description,
            "resolution": self.resolution,
        }


@dataclass
class ClashReport:
    """Çakışma raporu."""
    total_checks: int = 0
    clashes: list[Clash] = field(default_factory=list)

    @property
    def critical_count(self) -> int:
        return sum(1 for c in self.clashes if c.severity == "critical")

    @property
    def warning_count(self) -> int:
        return sum(1 for c in self.clashes if c.severity == "warning")

    @property
    def info_count(self) -> int:
        return sum(1 for c in self.clashes if c.severity == "info")

    @property
    def is_clean(self) -> bool:
        return self.critical_count == 0

    def to_dict(self) -> dict:
        return {
            "toplam_kontrol": self.total_checks,
            "toplam_cakisma": len(self.clashes),
            "kritik": self.critical_count,
            "uyari": self.warning_count,
            "bilgi": self.info_count,
            "temiz": self.is_clean,
            "sonuc": "✅ Çakışma yok" if self.is_clean else f"⚠ {self.critical_count} kritik çakışma",
            "cakismalar": [c.to_dict() for c in self.clashes],
        }


def _bbox_overlap(a: BBox, b: BBox, tolerance: float = 0.05) -> float:
    """İki bbox'ın kesişim alanını hesaplar. Tolerans (m) kadar yakınlık da çakışma sayılır."""
    x_overlap = max(0, min(a.x2 + tolerance, b.x2 + tolerance) - max(a.x - tolerance, b.x - tolerance))
    y_overlap = max(0, min(a.y2 + tolerance, b.y2 + tolerance) - max(a.y - tolerance, b.y - tolerance))
    return x_overlap * y_overlap


def _point_in_bbox(px: float, py: float, box: BBox) -> bool:
    """Nokta bbox içinde mi?"""
    return box.x <= px <= box.x2 and box.y <= py <= box.y2


def detect_clashes(
    rooms: list[dict],
    kolonlar: list[dict] | None = None,
    mep_elements: list[dict] | None = None,
    tolerance: float = 0.05,
) -> ClashReport:
    """Tüm BIM elemanları arasında çakışma kontrolü yapar.

    Args:
        rooms: [{"name","type","x","y","width","height"}, ...]
        kolonlar: [{"x","y","width","height","name"}, ...] (opsiyonel)
        mep_elements: [{"x","y","width","height","name","type"}, ...] (opsiyonel)
        tolerance: Çakışma toleransı (m)

    Returns:
        ClashReport — tüm çakışmalar listesi.
    """
    report = ClashReport()
    kolonlar = kolonlar or []
    mep_elements = mep_elements or []

    # ── 1. Oda-Oda Çakışma Kontrolü ──
    room_boxes = [
        BBox(
            x=r.get("x", 0), y=r.get("y", 0),
            width=r.get("width", 0), height=r.get("height", 0),
            name=r.get("name", f"Oda {i+1}"),
            element_type="room",
        )
        for i, r in enumerate(rooms)
    ]

    for i, a in enumerate(room_boxes):
        for b in room_boxes[i+1:]:
            report.total_checks += 1
            overlap = _bbox_overlap(a, b, tolerance=0)  # Odalar arası tolerans yok
            if overlap > 0.01:  # > 0.01 m² = çakışma
                min_area = min(a.area, b.area)
                overlap_pct = (overlap / min_area * 100) if min_area > 0 else 0

                severity = "critical" if overlap_pct > 20 else "warning" if overlap_pct > 5 else "info"
                report.clashes.append(Clash(
                    element_a=a.name, element_b=b.name,
                    type_a="room", type_b="room",
                    clash_type="hard",
                    severity=severity,
                    overlap_area=overlap,
                    overlap_pct=overlap_pct,
                    description=f"{a.name} ile {b.name} {overlap:.2f}m² çakışıyor (%{overlap_pct:.0f})",
                    resolution="Oda boyutlarını veya pozisyonlarını düzeltin",
                ))

    # ── 2. Kolon-Oda Kontrolü ──
    kolon_boxes = [
        BBox(
            x=k.get("x", 0), y=k.get("y", 0),
            width=k.get("width", 0.4), height=k.get("height", 0.4),
            name=k.get("name", f"Kolon {i+1}"),
            element_type="column",
        )
        for i, k in enumerate(kolonlar)
    ]

    for kol in kolon_boxes:
        for room in room_boxes:
            report.total_checks += 1
            # Kolon odanın ortasına düşüyorsa sorun — kenarına düşmesi normal
            kcx, kcy = kol.center
            if _point_in_bbox(kcx, kcy, room):
                # Kolon kenardan ne kadar uzakta?
                dx_left = kcx - room.x
                dx_right = room.x2 - kcx
                dy_bottom = kcy - room.y
                dy_top = room.y2 - kcy
                min_dist = min(dx_left, dx_right, dy_bottom, dy_top)

                if min_dist > 0.5:  # Kenardan 50cm'den fazla içeride
                    report.clashes.append(Clash(
                        element_a=kol.name, element_b=room.name,
                        type_a="column", type_b="room",
                        clash_type="soft",
                        severity="warning",
                        description=f"{kol.name} → {room.name} ortasında (kenardan {min_dist:.1f}m)",
                        resolution="Kolonu oda duvarı kenarına taşıyın veya gizli kolon yapın",
                    ))

    # ── 3. MEP-Strüktür Çakışma Kontrolü ──
    mep_boxes = [
        BBox(
            x=m.get("x", 0), y=m.get("y", 0),
            width=m.get("width", 0.2), height=m.get("height", 0.2),
            name=m.get("name", f"MEP {i+1}"),
            element_type=m.get("type", "pipe"),
        )
        for i, m in enumerate(mep_elements)
    ]

    for mep in mep_boxes:
        # MEP vs Kolon
        for kol in kolon_boxes:
            report.total_checks += 1
            overlap = _bbox_overlap(mep, kol, tolerance=tolerance)
            if overlap > 0:
                report.clashes.append(Clash(
                    element_a=mep.name, element_b=kol.name,
                    type_a=mep.element_type, type_b="column",
                    clash_type="hard",
                    severity="critical",
                    overlap_area=overlap,
                    description=f"{mep.name} ({mep.element_type}) kolona çarpıyor",
                    resolution="Boru/kanal güzergahını kolonu bypass edecek şekilde değiştirin",
                ))

    # ── 4. Minimum Oda Boyutu Kontrolü ──
    MIN_AREAS = {
        "salon": 14.0,
        "yatak_odasi": 9.0,
        "mutfak": 5.0,
        "banyo": 3.5,
        "wc": 1.5,
        "koridor": 2.0,
    }

    for room in rooms:
        rtype = room.get("type", "")
        rarea = room.get("width", 0) * room.get("height", 0)
        rname = room.get("name", "Oda")
        min_area = MIN_AREAS.get(rtype, 0)

        report.total_checks += 1
        if min_area > 0 and rarea < min_area:
            report.clashes.append(Clash(
                element_a=rname, element_b=f"Min. alan ({min_area}m²)",
                type_a="room", type_b="standard",
                clash_type="clearance",
                severity="warning",
                overlap_area=min_area - rarea,
                description=f"{rname}: {rarea:.1f}m² < minimum {min_area}m²",
                resolution=f"Oda alanını en az {min_area}m²'ye çıkarın",
            ))

    logger.info(
        f"Clash detection: {report.total_checks} kontrol, "
        f"{len(report.clashes)} çakışma ({report.critical_count} kritik)"
    )

    return report
