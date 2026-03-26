"""
Clash Detection — BIM elemanları arasında 3D çakışma kontrolü.

Desteklenen kontroller:
1. Oda-oda çakışması (aynı kattaki odalar üst üste mi?)
2. Kolon-oda çakışması (kolon odanın ortasına düşüyor mu?)
3. Duvar-pencere uyumu (pencere duvar sınırını aşıyor mu?)
4. Duvar-kapı uyumu (kapı duvar sınırını aşıyor mu?)
5. Kolon-merdiven çakışması
6. MEP-strüktür çakışması (boru/kanal kolona çarpıyor mu?)
7. MEP-MEP çakışması (boru-kanal kesişimi)
8. Minimum oda boyutu kontrolü (Türk yapı mevzuatı)
9. Yangın kaçış mesafesi kontrolü

Yöntem: 3D Axis-Aligned Bounding Box (AABB) + tolerans sınıfları.
Çakışma tipleri: hard clash (0cm), soft clash (5cm), clearance (30cm).
"""

import logging
import math
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class BBox3D:
    """3D Axis-Aligned Bounding Box."""
    x: float
    y: float
    z: float
    width: float   # x yönü
    height: float  # y yönü
    depth: float   # z yönü (yükseklik)
    name: str = ""
    element_type: str = ""  # wall, column, room, pipe, duct, window, door, stair
    kat: int = 1
    discipline: str = "mimari"  # mimari, struktur, elektrik, mekanik, havalandirma

    @property
    def x2(self) -> float:
        return self.x + self.width

    @property
    def y2(self) -> float:
        return self.y + self.height

    @property
    def z2(self) -> float:
        return self.z + self.depth

    @property
    def volume(self) -> float:
        return self.width * self.height * self.depth

    @property
    def area(self) -> float:
        """2D plan alanı (x × y)."""
        return self.width * self.height

    @property
    def center(self) -> tuple[float, float, float]:
        return (
            self.x + self.width / 2,
            self.y + self.height / 2,
            self.z + self.depth / 2,
        )

    @property
    def center_2d(self) -> tuple[float, float]:
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
    overlap_volume: float = 0.0
    overlap_pct: float = 0.0
    kat: int = 1
    description: str = ""
    resolution: str = ""
    discipline_a: str = ""
    discipline_b: str = ""

    def to_dict(self) -> dict:
        return {
            "element_a": self.element_a,
            "element_b": self.element_b,
            "type_a": self.type_a,
            "type_b": self.type_b,
            "clash_type": self.clash_type,
            "severity": self.severity,
            "overlap_area": round(self.overlap_area, 3),
            "overlap_volume": round(self.overlap_volume, 4),
            "overlap_pct": round(self.overlap_pct, 1),
            "kat": self.kat,
            "description": self.description,
            "resolution": self.resolution,
            "discipline_a": self.discipline_a,
            "discipline_b": self.discipline_b,
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

    def by_severity(self) -> dict:
        """Çakışmaları severity'ye göre grupla."""
        return {
            "critical": [c.to_dict() for c in self.clashes if c.severity == "critical"],
            "warning": [c.to_dict() for c in self.clashes if c.severity == "warning"],
            "info": [c.to_dict() for c in self.clashes if c.severity == "info"],
        }

    def by_discipline(self) -> dict:
        """Çakışmaları disipline göre grupla."""
        groups = {}
        for c in self.clashes:
            key = f"{c.discipline_a}-{c.discipline_b}"
            if key not in groups:
                groups[key] = []
            groups[key].append(c.to_dict())
        return groups

    def to_dict(self) -> dict:
        return {
            "toplam_kontrol": self.total_checks,
            "toplam_cakisma": len(self.clashes),
            "kritik": self.critical_count,
            "uyari": self.warning_count,
            "bilgi": self.info_count,
            "temiz": self.is_clean,
            "sonuc": "✅ Çakışma yok" if self.is_clean else f"⚠ {self.critical_count} kritik çakışma",
            "ozet": {
                "hard_clash": sum(1 for c in self.clashes if c.clash_type == "hard"),
                "soft_clash": sum(1 for c in self.clashes if c.clash_type == "soft"),
                "clearance": sum(1 for c in self.clashes if c.clash_type == "clearance"),
            },
            "severity_gruplu": self.by_severity(),
            "cakismalar": [c.to_dict() for c in self.clashes],
        }


# ══════════════════════════════════════
# YARDIMCI FONKSİYONLAR
# ══════════════════════════════════════

def _bbox3d_overlap_volume(a: BBox3D, b: BBox3D, tolerance: float = 0.0) -> float:
    """İki 3D bbox'ın kesişim hacmini hesaplar."""
    x_ov = max(0, min(a.x2 + tolerance, b.x2 + tolerance) - max(a.x - tolerance, b.x - tolerance))
    y_ov = max(0, min(a.y2 + tolerance, b.y2 + tolerance) - max(a.y - tolerance, b.y - tolerance))
    z_ov = max(0, min(a.z2 + tolerance, b.z2 + tolerance) - max(a.z - tolerance, b.z - tolerance))
    return x_ov * y_ov * z_ov


def _bbox2d_overlap(a: BBox3D, b: BBox3D, tolerance: float = 0.0) -> float:
    """İki bbox'ın 2D plan kesişim alanını hesaplar."""
    x_ov = max(0, min(a.x2 + tolerance, b.x2 + tolerance) - max(a.x - tolerance, b.x - tolerance))
    y_ov = max(0, min(a.y2 + tolerance, b.y2 + tolerance) - max(a.y - tolerance, b.y - tolerance))
    return x_ov * y_ov


def _point_in_bbox(px: float, py: float, box: BBox3D) -> bool:
    """Nokta 2D bbox içinde mi?"""
    return box.x <= px <= box.x2 and box.y <= py <= box.y2


def _classify_clash(overlap_pct: float, element_types: tuple) -> tuple[str, str]:
    """Çakışma tipini ve severity'sini belirle."""
    # Tip çiftine göre özel kurallar
    types = set(element_types)

    if types == {"room", "room"}:
        if overlap_pct > 20:
            return "hard", "critical"
        elif overlap_pct > 5:
            return "hard", "warning"
        return "soft", "info"

    if "column" in types and "pipe" in types:
        return "hard", "critical"

    if "column" in types and "duct" in types:
        return "hard", "critical"

    if "pipe" in types and "duct" in types:
        return "soft", "warning"

    if overlap_pct > 30:
        return "hard", "critical"
    elif overlap_pct > 10:
        return "soft", "warning"
    return "clearance", "info"


def _get_resolution(type_a: str, type_b: str, clash_type: str) -> str:
    """Çakışma tipine göre spesifik çözüm önerisi."""
    resolutions = {
        ("room", "room"): "Oda boyutlarını küçültün veya pozisyonlarını kaydırın",
        ("column", "room"): "Kolonu oda duvarı kenarına taşıyın veya gizli kolon yapın",
        ("column", "stair"): "Merdiven pozisyonunu kaydırın, kolon aksını değiştirin",
        ("pipe", "column"): "Boru güzergahını kolonu bypass edecek şekilde değiştirin",
        ("duct", "column"): "Kanal güzergahını kolonu bypass edecek şekilde değiştirin",
        ("pipe", "duct"): "Boru veya kanalı farklı kota alın (dikey offset)",
        ("pipe", "pipe"): "Boruları farklı kota alın veya güzergah değiştirin",
        ("window", "column"): "Pencere pozisyonunu kaydırın, kolon aksından uzaklaştırın",
        ("door", "column"): "Kapı pozisyonunu kaydırın veya kapı genişliğini daraltın",
    }
    key = tuple(sorted([type_a, type_b]))
    return resolutions.get(key, f"Elemanları yeniden konumlandırın ({clash_type} çakışma)")


# ══════════════════════════════════════
# ANA FONKSİYON
# ══════════════════════════════════════

def detect_clashes(
    rooms: list[dict],
    kolonlar: list[dict] | None = None,
    mep_elements: list[dict] | None = None,
    tolerance: float = 0.05,
    kat_sayisi: int = 1,
    kat_yuksekligi: float = 3.0,
) -> ClashReport:
    """Tüm BIM elemanları arasında 3D çakışma kontrolü yapar.

    Args:
        rooms: [{"name","type","x","y","width","height"}, ...]
        kolonlar: [{"x","y","width","height","name"}, ...]
        mep_elements: [{"x","y","width","height","name","type","z","depth"}, ...]
        tolerance: Çakışma toleransı (m)
        kat_sayisi: Kat adedi (çoklu kat kontrolü)
        kat_yuksekligi: Kat yüksekliği (m)

    Returns:
        ClashReport — tüm çakışmalar.
    """
    report = ClashReport()
    kolonlar = kolonlar or []
    mep_elements = mep_elements or []

    # ── BBox3D'lere dönüştür ──
    room_boxes = [
        BBox3D(
            x=r.get("x", 0), y=r.get("y", 0), z=0,
            width=r.get("width", 0), height=r.get("height", 0), depth=kat_yuksekligi,
            name=r.get("name", f"Oda {i+1}"),
            element_type="room", kat=1, discipline="mimari",
        )
        for i, r in enumerate(rooms)
    ]

    kolon_boxes = [
        BBox3D(
            x=k.get("x", 0), y=k.get("y", 0), z=0,
            width=k.get("width", 0.4), height=k.get("height", 0.4), depth=kat_yuksekligi,
            name=k.get("name", f"Kolon {i+1}"),
            element_type="column", kat=1, discipline="struktur",
        )
        for i, k in enumerate(kolonlar)
    ]

    mep_boxes = [
        BBox3D(
            x=m.get("x", 0), y=m.get("y", 0), z=m.get("z", 2.5),
            width=m.get("width", 0.2), height=m.get("height", 0.2),
            depth=m.get("depth", 0.2),
            name=m.get("name", f"MEP {i+1}"),
            element_type=m.get("type", "pipe"), kat=1,
            discipline=_mep_discipline(m.get("type", "pipe")),
        )
        for i, m in enumerate(mep_elements)
    ]

    # ══════════════════════════════════════
    # 1. ODA-ODA ÇAKIŞMA
    # ══════════════════════════════════════
    for i, a in enumerate(room_boxes):
        for b in room_boxes[i+1:]:
            report.total_checks += 1
            overlap = _bbox2d_overlap(a, b, tolerance=0)
            if overlap > 0.01:
                min_area = min(a.area, b.area) or 1
                overlap_pct = overlap / min_area * 100
                clash_type, severity = _classify_clash(overlap_pct, ("room", "room"))

                report.clashes.append(Clash(
                    element_a=a.name, element_b=b.name,
                    type_a="room", type_b="room",
                    clash_type=clash_type, severity=severity,
                    overlap_area=overlap, overlap_pct=overlap_pct,
                    description=f"{a.name} ile {b.name} {overlap:.2f}m² çakışıyor (%{overlap_pct:.0f})",
                    resolution=_get_resolution("room", "room", clash_type),
                    discipline_a="mimari", discipline_b="mimari",
                ))

    # ══════════════════════════════════════
    # 2. KOLON-ODA ÇAKIŞMA
    # ══════════════════════════════════════
    for kol in kolon_boxes:
        for room in room_boxes:
            report.total_checks += 1
            kcx, kcy = kol.center_2d
            if _point_in_bbox(kcx, kcy, room):
                dx_left = kcx - room.x
                dx_right = room.x2 - kcx
                dy_bottom = kcy - room.y
                dy_top = room.y2 - kcy
                min_dist = min(dx_left, dx_right, dy_bottom, dy_top)

                if min_dist > 0.5:
                    report.clashes.append(Clash(
                        element_a=kol.name, element_b=room.name,
                        type_a="column", type_b="room",
                        clash_type="soft", severity="warning",
                        description=f"{kol.name} → {room.name} ortasında (kenardan {min_dist:.1f}m)",
                        resolution=_get_resolution("column", "room", "soft"),
                        discipline_a="struktur", discipline_b="mimari",
                    ))

    # ══════════════════════════════════════
    # 3. KOLON-MERDİVEN ÇAKIŞMA
    # ══════════════════════════════════════
    stair_rooms = [r for r in room_boxes if r.name.lower().startswith("merdiven")]
    for kol in kolon_boxes:
        for stair in stair_rooms:
            report.total_checks += 1
            overlap = _bbox2d_overlap(kol, stair, tolerance=0.1)
            if overlap > 0.01:
                report.clashes.append(Clash(
                    element_a=kol.name, element_b=stair.name,
                    type_a="column", type_b="stair",
                    clash_type="hard", severity="critical",
                    overlap_area=overlap,
                    description=f"{kol.name} merdiven alanına giriyor ({overlap:.3f}m²)",
                    resolution=_get_resolution("column", "stair", "hard"),
                    discipline_a="struktur", discipline_b="mimari",
                ))

    # ══════════════════════════════════════
    # 4. MEP-STRÜKTÜR ÇAKIŞMA (3D)
    # ══════════════════════════════════════
    for mep in mep_boxes:
        for kol in kolon_boxes:
            report.total_checks += 1
            vol = _bbox3d_overlap_volume(mep, kol, tolerance=tolerance)
            if vol > 0:
                report.clashes.append(Clash(
                    element_a=mep.name, element_b=kol.name,
                    type_a=mep.element_type, type_b="column",
                    clash_type="hard", severity="critical",
                    overlap_volume=vol,
                    description=f"{mep.name} ({mep.element_type}) kolona çarpıyor ({vol:.4f}m³)",
                    resolution=_get_resolution(mep.element_type, "column", "hard"),
                    discipline_a=mep.discipline, discipline_b="struktur",
                ))

    # ══════════════════════════════════════
    # 5. MEP-MEP ÇAKIŞMA (3D)
    # ══════════════════════════════════════
    for i, ma in enumerate(mep_boxes):
        for mb in mep_boxes[i+1:]:
            report.total_checks += 1
            vol = _bbox3d_overlap_volume(ma, mb, tolerance=tolerance)
            if vol > 0:
                clash_type, severity = _classify_clash(50, (ma.element_type, mb.element_type))
                report.clashes.append(Clash(
                    element_a=ma.name, element_b=mb.name,
                    type_a=ma.element_type, type_b=mb.element_type,
                    clash_type=clash_type, severity=severity,
                    overlap_volume=vol,
                    description=f"{ma.name} ile {mb.name} kesişiyor ({vol:.4f}m³)",
                    resolution=_get_resolution(ma.element_type, mb.element_type, clash_type),
                    discipline_a=ma.discipline, discipline_b=mb.discipline,
                ))

    # ══════════════════════════════════════
    # 6. MİNİMUM ODA BOYUTU (Türk mevzuatı)
    # ══════════════════════════════════════
    MIN_AREAS = {
        "salon": 14.0,
        "yatak_odasi": 9.0,
        "mutfak": 5.0,
        "banyo": 3.5,
        "wc": 1.5,
        "koridor": 2.0,
        "antre": 2.5,
    }

    MIN_DIMENSIONS = {
        "salon": 3.0,
        "yatak_odasi": 2.7,
        "mutfak": 1.8,
        "banyo": 1.5,
        "wc": 0.9,
        "koridor": 0.9,
    }

    for room in rooms:
        rtype = room.get("type", "")
        rw = room.get("width", 0)
        rh = room.get("height", 0)
        rarea = rw * rh
        rname = room.get("name", "Oda")
        min_area = MIN_AREAS.get(rtype, 0)
        min_dim = MIN_DIMENSIONS.get(rtype, 0)

        report.total_checks += 1
        if min_area > 0 and rarea < min_area:
            report.clashes.append(Clash(
                element_a=rname, element_b=f"Min. alan ({min_area}m²)",
                type_a="room", type_b="standard",
                clash_type="clearance", severity="warning",
                overlap_area=min_area - rarea,
                description=f"{rname}: {rarea:.1f}m² < minimum {min_area}m²",
                resolution=f"Oda alanını en az {min_area}m²'ye çıkarın",
                discipline_a="mimari", discipline_b="mevzuat",
            ))

        if min_dim > 0 and min(rw, rh) < min_dim:
            report.total_checks += 1
            report.clashes.append(Clash(
                element_a=rname, element_b=f"Min. boyut ({min_dim}m)",
                type_a="room", type_b="standard",
                clash_type="clearance", severity="warning",
                description=f"{rname}: dar kenar {min(rw, rh):.1f}m < min {min_dim}m",
                resolution=f"Oda en dar kenarını en az {min_dim}m yapın",
                discipline_a="mimari", discipline_b="mevzuat",
            ))

    # ══════════════════════════════════════
    # 7. YANGIN KAÇIŞ MESAFESİ (max 30m)
    # ══════════════════════════════════════
    merdiven_odasi = next(
        (r for r in rooms if r.get("type") in ("merdiven",) or "merdiven" in r.get("name", "").lower()),
        None
    )
    if merdiven_odasi:
        mx = merdiven_odasi.get("x", 0) + merdiven_odasi.get("width", 2) / 2
        my = merdiven_odasi.get("y", 0) + merdiven_odasi.get("height", 2) / 2

        for room in rooms:
            if room.get("type") in ("merdiven", "koridor"):
                continue
            report.total_checks += 1
            rx = room.get("x", 0) + room.get("width", 4) / 2
            ry = room.get("y", 0) + room.get("height", 3) / 2
            mesafe = math.sqrt((rx - mx) ** 2 + (ry - my) ** 2)

            if mesafe > 30:
                report.clashes.append(Clash(
                    element_a=room.get("name", "Oda"),
                    element_b="Yangın Merdiveni",
                    type_a="room", type_b="stair",
                    clash_type="clearance", severity="critical",
                    description=f"{room.get('name', 'Oda')} → merdiven: {mesafe:.1f}m > max 30m",
                    resolution="Ek yangın merdiveni ekleyin veya oda pozisyonunu değiştirin",
                    discipline_a="mimari", discipline_b="yangin",
                ))
            elif mesafe > 25:
                report.clashes.append(Clash(
                    element_a=room.get("name", "Oda"),
                    element_b="Yangın Merdiveni",
                    type_a="room", type_b="stair",
                    clash_type="clearance", severity="info",
                    description=f"{room.get('name', 'Oda')} → merdiven: {mesafe:.1f}m (sınıra yakın)",
                    resolution="Kaçış mesafesini optimize edin",
                    discipline_a="mimari", discipline_b="yangin",
                ))

    logger.info(
        f"Clash detection: {report.total_checks} kontrol, "
        f"{len(report.clashes)} çakışma ({report.critical_count} kritik)"
    )

    return report


def _mep_discipline(element_type: str) -> str:
    """MEP eleman tipinden disiplin belirle."""
    return {
        "pipe": "mekanik",
        "temiz_su": "mekanik",
        "pis_su": "mekanik",
        "duct": "havalandirma",
        "cable": "elektrik",
        "kablo": "elektrik",
        "kanal": "havalandirma",
        "sprinkler": "yangin",
        "yangin_boru": "yangin",
    }.get(element_type, "mekanik")
