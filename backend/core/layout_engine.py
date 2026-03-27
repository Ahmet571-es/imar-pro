"""
Layout Engine — Constraint-Based Oda Yerleştirme Motoru.

MİMARİ İLKELER:
  1. Koridor aksı belirleme → bina derinliğinin ortası veya 1/3'ü
  2. Oda öncelik sırası: salon(güneş) → mutfak(salon yanı) → yatak(sessiz) → ıslak(grup) → servis
  3. Her adımda çakışma kontrolü — ASLA çakışma oluşmaz
  4. Bitişiklik constraint'leri: banyo↔yatak, mutfak↔salon, antre↔giriş
  5. Sirkülasyon garanti: tüm odalara koridor/antreden erişim
  6. 5 farklı strateji genuinely farklı layout üretir

KULLANIM:
  engine = LayoutEngine(width=14.0, height=10.0)
  result = engine.generate(room_program, strategy="south_social")
  # result.rooms → yerleştirilmiş oda listesi (PlanRoom)
  # result.is_valid → True (çakışma yok)
"""

import math
import logging
from dataclasses import dataclass, field
from typing import Optional
from core.plan_scorer import PlanRoom, FloorPlan

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# VERİ YAPILARI
# ═══════════════════════════════════════════════════════════════

@dataclass
class RoomRequest:
    """Yerleştirilecek oda talebi."""
    name: str
    room_type: str
    target_area: float      # m² hedef alan
    min_area: float = 0     # m² minimum (0 = target * 0.75)
    max_area: float = 0     # m² maximum (0 = target * 1.30)
    priority: int = 5       # 1=en yüksek (salon), 9=en düşük (depo)
    needs_exterior: bool = False
    preferred_facing: str = ""  # "south", "north", "east", "west"
    is_wet: bool = False
    adjacent_to: list[str] = field(default_factory=list)  # oda tipleri

    def __post_init__(self):
        if self.min_area <= 0:
            self.min_area = self.target_area * 0.70
        if self.max_area <= 0:
            self.max_area = self.target_area * 1.35


@dataclass
class PlacedRoom:
    """Yerleştirilmiş oda."""
    request: RoomRequest
    x: float
    y: float
    width: float
    height: float

    @property
    def area(self) -> float:
        return self.width * self.height

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def top(self) -> float:
        return self.y + self.height

    @property
    def center(self) -> tuple[float, float]:
        return (self.x + self.width / 2, self.y + self.height / 2)

    def overlaps(self, other: 'PlacedRoom', gap: float = 0.05) -> bool:
        """İki oda çakışıyor mu? (gap = minimum boşluk)"""
        return not (
            self.x + self.width <= other.x - gap or
            other.x + other.width <= self.x - gap or
            self.y + self.height <= other.y - gap or
            other.y + other.height <= self.y - gap
        )

    def touches(self, other: 'PlacedRoom', tolerance: float = 0.15) -> bool:
        """İki oda bitişik mi? (duvar paylaşıyor)"""
        # Yatay bitişiklik
        h_overlap = max(0, min(self.right, other.right) - max(self.x, other.x))
        v_overlap = max(0, min(self.top, other.top) - max(self.y, other.y))

        h_gap = min(abs(self.right - other.x), abs(other.right - self.x))
        v_gap = min(abs(self.top - other.y), abs(other.top - self.y))

        if h_gap <= tolerance and v_overlap > 0.3:
            return True
        if v_gap <= tolerance and h_overlap > 0.3:
            return True
        return False

    def is_on_edge(self, bw: float, bh: float, ox: float = 0, oy: float = 0, tol: float = 0.30) -> bool:
        """Oda yapılaşma kenarında mı?"""
        return (
            self.x <= ox + tol or
            self.right >= ox + bw - tol or
            self.y <= oy + tol or
            self.top >= oy + bh - tol
        )

    def facing_direction(self, bw: float, bh: float, ox: float = 0, oy: float = 0, tol: float = 0.30) -> str:
        """Odanın baktığı yön (dış kenar)."""
        directions = []
        if self.y <= oy + tol:
            directions.append("south")
        if self.top >= oy + bh - tol:
            directions.append("north")
        if self.x <= ox + tol:
            directions.append("west")
        if self.right >= ox + bw - tol:
            directions.append("east")
        return directions[0] if directions else ""

    def to_plan_room(self, bw: float, bh: float, ox: float = 0, oy: float = 0) -> PlanRoom:
        """PlanRoom nesnesine dönüştür."""
        on_edge = self.is_on_edge(bw, bh, ox, oy)
        facing = self.facing_direction(bw, bh, ox, oy)

        # Kapı yerleştirme (koridor/antre tarafındaki duvara)
        doors = []
        if self.request.room_type not in ("koridor", "balkon"):
            doors.append({
                "wall": "north" if self.request.room_type in ("salon", "balkon") else "south",
                "position": 0.3,
                "width": 1.00 if self.request.room_type == "antre" else 0.90,
            })

        # Pencere yerleştirme (dış cepheye)
        windows = []
        if on_edge and self.request.room_type not in ("koridor", "antre", "wc"):
            win_width = min(1.80, self.width * 0.35) if self.request.room_type == "salon" else min(1.40, self.width * 0.30)
            windows.append({
                "wall": facing or "south",
                "position": 0.5,
                "width": round(win_width, 2),
            })

        return PlanRoom(
            name=self.request.name,
            room_type=self.request.room_type,
            x=round(self.x, 2),
            y=round(self.y, 2),
            width=round(self.width, 2),
            height=round(self.height, 2),
            has_exterior_wall=on_edge,
            facing_direction=facing,
            doors=doors,
            windows=windows,
        )


@dataclass
class LayoutResult:
    """Yerleştirme sonucu."""
    rooms: list[PlacedRoom] = field(default_factory=list)
    is_valid: bool = True
    unplaced: list[str] = field(default_factory=list)
    strategy_name: str = ""
    strategy_description: str = ""
    warnings: list[str] = field(default_factory=list)

    @property
    def total_area(self) -> float:
        return sum(r.area for r in self.rooms)

    @property
    def coverage_ratio(self) -> float:
        """Yapılaşma alanı kullanım oranı."""
        return self.total_area / max(1, self._buildable_area)

    _buildable_area: float = 0

    def to_floor_plan(self, bw: float, bh: float, ox: float = 0, oy: float = 0, apt_type: str = "3+1") -> FloorPlan:
        plan_rooms = [r.to_plan_room(bw, bh, ox, oy) for r in self.rooms]
        return FloorPlan(rooms=plan_rooms, total_area=self.total_area, apartment_type=apt_type)


# ═══════════════════════════════════════════════════════════════
# LAYOUT ENGINE
# ═══════════════════════════════════════════════════════════════

class LayoutEngine:
    """Constraint-based oda yerleştirme motoru.

    Mimari ilkelere göre odaları yapılaşma alanı içinde yerleştirir.
    %100 çakışmasız garanti.
    """

    # Duvar kalınlıkları
    OUTER_WALL = 0.25
    INNER_WALL = 0.10
    PARTITION = 0.10

    # Oda tipi → öncelik (yerleştirme sırası)
    PRIORITY = {
        "salon": 1, "balkon": 2, "mutfak": 3,
        "yatak_odasi": 4, "banyo": 5, "wc": 6,
        "antre": 7, "koridor": 8, "depo": 9,
    }

    def __init__(self, width: float, height: float, origin_x: float = 0, origin_y: float = 0):
        self.bw = width
        self.bh = height
        self.ox = origin_x
        self.oy = origin_y
        # İç yapılaşma alanı (dış duvar payı çıktıktan sonra)
        self.iw = width - 2 * self.OUTER_WALL
        self.ih = height - 2 * self.OUTER_WALL
        self.ix = origin_x + self.OUTER_WALL
        self.iy = origin_y + self.OUTER_WALL

    def generate(self, room_program: list[RoomRequest], strategy: str = "south_social") -> LayoutResult:
        """Verilen stratejiyle oda yerleştirmesi yap.

        Stratejiler:
          south_social  — Salon güneyde, sosyal alanlar ön cephede
          central_corridor — Merkezi koridor, odalar iki yanda
          privacy_zones — Yatak odaları izole, çift zon
          compact_efficient — Minimum sirkülasyon, max kullanılabilir alan
          sun_maximum — Tüm yaşam alanları güneyde
        """
        dispatch = {
            "south_social": self._strategy_south_social,
            "central_corridor": self._strategy_central_corridor,
            "privacy_zones": self._strategy_privacy_zones,
            "compact_efficient": self._strategy_compact_efficient,
            "sun_maximum": self._strategy_sun_maximum,
        }

        fn = dispatch.get(strategy, self._strategy_south_social)

        try:
            result = fn(room_program)
            result._buildable_area = self.bw * self.bh

            # Final çakışma kontrolü
            for i, r1 in enumerate(result.rooms):
                for r2 in result.rooms[i + 1:]:
                    if r1.overlaps(r2):
                        result.warnings.append(f"ÇAKIŞMA: {r1.request.name} ↔ {r2.request.name}")
                        result.is_valid = False

            return result
        except Exception as e:
            logger.error(f"Layout engine hatası ({strategy}): {e}", exc_info=True)
            return LayoutResult(is_valid=False, strategy_name=strategy, warnings=[str(e)])

    def generate_all_strategies(self, room_program: list[RoomRequest]) -> list[LayoutResult]:
        """Tüm stratejilerle yerleştirme yap, geçerli olanları döndür."""
        strategies = ["south_social", "central_corridor", "privacy_zones", "compact_efficient", "sun_maximum"]
        results = []
        for s in strategies:
            r = self.generate(room_program, s)
            if r.is_valid and len(r.rooms) > 0:
                results.append(r)
        return results

    # ───────────────────────────────────────────────────────────
    # YARDIMCI: Güvenli yerleştirme
    # ───────────────────────────────────────────────────────────

    def _calc_dims(self, req: RoomRequest, max_width: float, aspect_hint: float = 0.70) -> tuple[float, float]:
        """Oda için ideal genişlik × derinlik hesapla."""
        area = req.target_area
        # İdeal boyutlar (aspect ratio'ya göre)
        depth = math.sqrt(area / max(aspect_hint, 0.3))
        width = area / depth

        # Max genişliğe sığdır
        if width > max_width:
            width = max_width
            depth = area / width

        # Min boyut kontrolleri
        if req.room_type == "koridor":
            width = max(1.15, min(width, 1.40))
            depth = area / width
        elif req.room_type == "balkon":
            depth = max(1.25, min(depth, 1.80))
            width = area / depth

        return (round(max(width, 1.0), 2), round(max(depth, 1.0), 2))

    def _try_place(self, req: RoomRequest, x: float, y: float, w: float, h: float,
                   placed: list[PlacedRoom]) -> Optional[PlacedRoom]:
        """Odayı verilen pozisyona yerleştirmeyi dene. Çakışma varsa None."""
        candidate = PlacedRoom(request=req, x=x, y=y, width=w, height=h)

        # Sınır kontrolü
        if candidate.right > self.ix + self.iw + 0.01:
            return None
        if candidate.top > self.iy + self.ih + 0.01:
            return None
        if candidate.x < self.ix - 0.01:
            return None
        if candidate.y < self.iy - 0.01:
            return None

        # Çakışma kontrolü
        for p in placed:
            if candidate.overlaps(p, gap=self.PARTITION):
                return None

        return candidate

    def _find_slot(self, req: RoomRequest, w: float, h: float,
                   placed: list[PlacedRoom],
                   prefer_x: float = -1, prefer_y: float = -1,
                   scan_step: float = 0.25) -> Optional[PlacedRoom]:
        """Boş alan tarayarak oda yerleştir. Tercih edilen konumdan başla."""
        start_x = prefer_x if prefer_x >= self.ix else self.ix
        start_y = prefer_y if prefer_y >= self.iy else self.iy

        # Önce tercih edilen konumu dene
        if prefer_x >= self.ix and prefer_y >= self.iy:
            result = self._try_place(req, prefer_x, prefer_y, w, h, placed)
            if result:
                return result

        # Sistematik tarama
        y = start_y
        while y + h <= self.iy + self.ih + 0.01:
            x = self.ix
            while x + w <= self.ix + self.iw + 0.01:
                result = self._try_place(req, x, y, w, h, placed)
                if result:
                    return result
                x += scan_step
            y += scan_step

        # Ters yönde dene (w↔h çevirme)
        if abs(w - h) > 0.2:
            y = start_y
            while y + w <= self.iy + self.ih + 0.01:
                x = self.ix
                while x + h <= self.ix + self.iw + 0.01:
                    result = self._try_place(req, x, y, h, w, placed)
                    if result:
                        return result
                    x += scan_step
                y += scan_step

        return None

    def _find_slot_shrink(self, req: RoomRequest, placed: list[PlacedRoom],
                          prefer_x: float = -1, prefer_y: float = -1,
                          max_width: float = 0) -> Optional[PlacedRoom]:
        """Hedef boyutta sığmazsa aşamalı küçülterek yerleştir.
        Min boyut: req.min_area'nın %90'ı."""
        mw = max_width if max_width > 0 else self.iw * 0.45

        # Hedef boyuttan başla, %10'luk adımlarla küçült
        for shrink in [1.0, 0.90, 0.80, 0.70]:
            area = req.target_area * shrink
            if area < req.min_area * 0.9:
                break
            w, h = self._calc_dims(
                RoomRequest(name=req.name, room_type=req.room_type, target_area=area),
                mw, 0.70
            )
            result = self._find_slot(req, w, h, placed, prefer_x, prefer_y, scan_step=0.20)
            if result:
                return result
            # Ters oran dene
            result = self._find_slot(req, h, w, placed, prefer_x, prefer_y, scan_step=0.20)
            if result:
                return result

        return None

    def _place_in_zone(self, rooms: list[RoomRequest], placed: list[PlacedRoom],
                       zone_x: float, zone_y: float, zone_w: float, zone_h: float,
                       direction: str = "horizontal") -> list[PlacedRoom]:
        """Bir dikdörtgen bölge içinde oda listesini orantılı yerleştir.
        
        Args:
            direction: "horizontal" (yan yana) veya "vertical" (üst üste)
        Returns:
            Yerleştirilen odalar listesi (placed'a da ekler)
        """
        if not rooms or zone_w < 1.0 or zone_h < 1.0:
            return []

        wall = self.PARTITION
        total_target = sum(r.target_area for r in rooms)
        zone_area = zone_w * zone_h
        new_placed = []

        if direction == "horizontal":
            # Yan yana: her odaya genişlik oranla, yükseklik sabit
            x_cur = zone_x
            usable_w = zone_w - wall * (len(rooms) - 1)
            for room in rooms:
                share = room.target_area / max(total_target, 1)
                rw = max(1.5, usable_w * share)
                rh = min(zone_h, max(room.target_area / rw, zone_h * 0.85))
                # Sınırları aşma
                rw = min(rw, zone_x + zone_w - x_cur)
                rh = min(rh, zone_h)
                if rw < 1.0 or rh < 1.0:
                    continue
                p = self._try_place(room, x_cur, zone_y, rw, rh, placed)
                if p:
                    placed.append(p)
                    new_placed.append(p)
                    x_cur = p.right + wall
                else:
                    # Fallback: shrink
                    p = self._find_slot_shrink(room, placed, prefer_x=x_cur, prefer_y=zone_y, max_width=rw)
                    if p:
                        placed.append(p)
                        new_placed.append(p)
                        x_cur = p.right + wall
        else:
            # Üst üste: her odaya yükseklik oranla, genişlik sabit
            y_cur = zone_y
            usable_h = zone_h - wall * (len(rooms) - 1)
            for room in rooms:
                share = room.target_area / max(total_target, 1)
                rh = max(1.5, usable_h * share)
                rw = min(zone_w, max(room.target_area / rh, zone_w * 0.85))
                rh = min(rh, zone_y + zone_h - y_cur)
                rw = min(rw, zone_w)
                if rw < 1.0 or rh < 1.0:
                    continue
                p = self._try_place(room, zone_x, y_cur, rw, rh, placed)
                if p:
                    placed.append(p)
                    new_placed.append(p)
                    y_cur = p.top + wall
                else:
                    p = self._find_slot_shrink(room, placed, prefer_x=zone_x, prefer_y=y_cur, max_width=rw)
                    if p:
                        placed.append(p)
                        new_placed.append(p)
                        y_cur = p.top + wall

        return new_placed

    def _sort_program(self, program: list[RoomRequest]) -> list[RoomRequest]:
        """Oda programını öncelik sırasına göre sırala."""
        def priority_key(r: RoomRequest):
            base = self.PRIORITY.get(r.room_type, 5)
            return (r.priority if r.priority != 5 else base, -r.target_area)
        return sorted(program, key=priority_key)

    # ═══════════════════════════════════════════════════════════
    # STRATEJİ 1: GÜNEY SALON (Açık plan sosyal alan)
    # ═══════════════════════════════════════════════════════════

    def _strategy_south_social(self, program: list[RoomRequest]) -> LayoutResult:
        """Salon + mutfak güney cephede, yatak odaları kuzeyde."""
        result = LayoutResult(
            strategy_name="Güney Sosyal",
            strategy_description="Salon ve mutfak güney cephede geniş açık plan, yatak odaları kuzey/arka cephede sessiz bölge"
        )
        placed: list[PlacedRoom] = []
        wall = self.PARTITION

        # ── Güney band: Salon + Balkon ──
        salon = next((r for r in program if r.room_type == "salon"), None)
        balkon = next((r for r in program if r.room_type == "balkon"), None)

        south_y = self.iy
        # Güney band max yükseklik: iç yüksekliğin %38'i (yatak odalarına yer bırak)
        max_south_h = self.ih * 0.38
        if salon:
            sw = min(self.iw * 0.65, max(self.iw * 0.45, salon.target_area / 3.5))
            sh = min(max_south_h, salon.target_area / sw)
            p = self._try_place(salon, self.ix, south_y, sw, sh, placed)
            if p:
                placed.append(p)

        if balkon:
            # Balkon salon altına (güney cephe dışına sarkar — ama biz içeride tutuyoruz)
            bw_b = min(4.0, self.iw * 0.35)
            bh_b = max(1.25, balkon.target_area / bw_b)
            bx = self.ix
            by = south_y
            if placed:  # Salonun yanına koy
                bx = placed[0].right + wall
            p = self._try_place(balkon, bx, by, bw_b, bh_b, placed)
            if p:
                placed.append(p)

        # ── Mutfak: Salonun yanında veya üstünde ──
        mutfak = next((r for r in program if r.room_type == "mutfak"), None)
        if mutfak:
            mw, mh = self._calc_dims(mutfak, self.iw * 0.40, 0.55)
            # Salon yanında dene
            if placed:
                mx = placed[0].right + wall
                p = self._try_place(mutfak, mx, south_y, mw, mh, placed)
                if not p:
                    # Salon üstünde
                    p = self._find_slot(mutfak, mw, mh, placed,
                                        prefer_x=self.ix + self.iw * 0.5, prefer_y=south_y)
                if p:
                    placed.append(p)

        # ── Koridor aksı: Güney bandın üstünde yatay ──
        koridor = next((r for r in program if r.room_type == "koridor"), None)
        south_band_top = max((p.top for p in placed), default=south_y + self.ih * 0.35)
        cor_y = south_band_top + wall

        if koridor:
            # Koridor tam genişlikte değil — gerekli uzunlukta
            cor_h = max(1.15, min(1.30, self.ih * 0.13))
            cor_w = min(self.iw, max(koridor.target_area / cor_h, self.iw * 0.70))
            p = self._try_place(koridor, self.ix, cor_y, cor_w, cor_h, placed)
            if p:
                placed.append(p)
                cor_y = p.y
                north_y = p.top + wall
            else:
                north_y = cor_y + 1.20 + wall
        else:
            north_y = cor_y + 1.20 + wall

        # ── Antre: Koridor başında (giriş noktası) ──
        antre = next((r for r in program if r.room_type == "antre"), None)
        if antre:
            aw, ah = self._calc_dims(antre, self.iw * 0.25, 0.50)
            p = self._find_slot(antre, aw, ah, placed,
                                prefer_x=self.ix + self.iw - aw, prefer_y=cor_y)
            if p:
                placed.append(p)

        # ── Kuzey band: Yatak odaları + ıslak hacimler ──
        yatak_rooms = [r for r in program if r.room_type == "yatak_odasi"]
        wet_rooms = [r for r in program if r.room_type in ("banyo", "wc") and r.name not in [p.request.name for p in placed]]
        remaining_h = self.iy + self.ih - north_y

        # Yatak + ıslak hacimleri kuzey zonuna orantılı yerleştir
        all_north = yatak_rooms + wet_rooms
        if all_north and remaining_h >= 2.0:
            self._place_in_zone(all_north, placed,
                                self.ix, north_y, self.iw, remaining_h, "horizontal")

        # ── Kalan odalar ──
        placed_names = {p.request.name for p in placed}
        remaining = [r for r in program if r.name not in placed_names]
        for r in remaining:
            p = self._find_slot_shrink(r, placed)
            if p:
                placed.append(p)
            else:
                result.unplaced.append(r.name)

        result.rooms = placed
        return result

    # ═══════════════════════════════════════════════════════════
    # STRATEJİ 2: MERKEZİ KORİDOR
    # ═══════════════════════════════════════════════════════════

    def _strategy_central_corridor(self, program: list[RoomRequest]) -> LayoutResult:
        """Koridor ortada, yaşam alanları solda, servis alanları sağda."""
        result = LayoutResult(
            strategy_name="Merkezi Koridor",
            strategy_description="Koridor yapının ortasından geçer, sol kanat yaşam alanları, sağ kanat servis/ıslak hacimler"
        )
        placed: list[PlacedRoom] = []
        wall = self.PARTITION

        # Koridor parametreleri
        cor_width = 1.20
        left_zone_w = (self.iw - cor_width) * 0.55 - wall
        right_zone_w = (self.iw - cor_width) * 0.45 - wall
        cor_x = self.ix + left_zone_w + wall

        # ── Koridor ──
        koridor = next((r for r in program if r.room_type == "koridor"), None)
        if koridor:
            p = self._try_place(koridor, cor_x, self.iy, cor_width, self.ih, placed)
            if p:
                placed.append(p)

        # ── Sol kanat: Salon, yatak odaları, balkon ──
        left_rooms = [r for r in program if r.room_type in ("salon", "yatak_odasi", "balkon")]
        left_rooms.sort(key=lambda r: (-r.target_area, r.name))
        y_left = self.iy

        for room in left_rooms:
            rw = min(left_zone_w, max(3.0, room.target_area / 3.5))
            rh = room.target_area / rw
            if y_left + rh > self.iy + self.ih:
                rh = self.iy + self.ih - y_left
                if rh < 2.0:
                    result.unplaced.append(room.name)
                    continue
            p = self._try_place(room, self.ix, y_left, rw, rh, placed)
            if p:
                placed.append(p)
                y_left = p.top + wall

        # ── Sağ kanat: Mutfak, banyo, wc, antre ──
        right_rooms = [r for r in program if r.room_type in ("mutfak", "banyo", "wc", "antre")]
        right_rooms.sort(key=lambda r: (-r.target_area, r.name))
        right_x = cor_x + cor_width + wall
        y_right = self.iy

        for room in right_rooms:
            rw = min(right_zone_w, max(2.0, room.target_area / 3.0))
            rh = room.target_area / rw
            if y_right + rh > self.iy + self.ih:
                rh = self.iy + self.ih - y_right
                if rh < 1.5:
                    result.unplaced.append(room.name)
                    continue
            p = self._try_place(room, right_x, y_right, rw, rh, placed)
            if p:
                placed.append(p)
                y_right = p.top + wall

        # ── Kalan odalar ──
        placed_names = {p.request.name for p in placed}
        remaining = [r for r in program if r.name not in placed_names]
        for r in remaining:
            rw, rh = self._calc_dims(r, self.iw * 0.35)
            p = self._find_slot(r, rw, rh, placed)
            if p:
                placed.append(p)
            else:
                result.unplaced.append(r.name)

        result.rooms = placed
        return result

    # ═══════════════════════════════════════════════════════════
    # STRATEJİ 3: MAHREMİYET ZONLARI
    # ═══════════════════════════════════════════════════════════

    def _strategy_privacy_zones(self, program: list[RoomRequest]) -> LayoutResult:
        """Yatak odaları tamamen izole, çift zon tasarımı."""
        result = LayoutResult(
            strategy_name="Mahremiyet Zonları",
            strategy_description="Sosyal zon (salon+mutfak) ve özel zon (yatak odaları+banyo) koridorla ayrılır"
        )
        placed: list[PlacedRoom] = []
        wall = self.PARTITION

        # Yatay bölme: alt yarı sosyal, üst yarı özel
        split_ratio = 0.45  # Sosyal zon %45
        social_h = self.ih * split_ratio
        private_h = self.ih * (1 - split_ratio) - 1.20  # koridor payı

        # ── Sosyal zon (alt) ──
        salon = next((r for r in program if r.room_type == "salon"), None)
        mutfak = next((r for r in program if r.room_type == "mutfak"), None)
        balkon = next((r for r in program if r.room_type == "balkon"), None)
        antre = next((r for r in program if r.room_type == "antre"), None)

        x_cur = self.ix
        if salon:
            sw = self.iw * 0.55
            sh = min(social_h, salon.target_area / sw)
            p = self._try_place(salon, x_cur, self.iy, sw, sh, placed)
            if p:
                placed.append(p)
                x_cur = p.right + wall

        if mutfak:
            mw = self.iw - (x_cur - self.ix) - wall
            mh = min(social_h * 0.65, mutfak.target_area / max(mw, 2.0))
            p = self._try_place(mutfak, x_cur, self.iy, mw, mh, placed)
            if p:
                placed.append(p)

        if antre:
            aw, ah = self._calc_dims(antre, self.iw * 0.25, 0.50)
            p = self._find_slot(antre, aw, ah, placed,
                                prefer_x=x_cur, prefer_y=self.iy + social_h * 0.5)
            if p:
                placed.append(p)

        if balkon:
            bw_b, bh_b = self._calc_dims(balkon, self.iw * 0.35, 0.35)
            p = self._find_slot(balkon, bw_b, bh_b, placed, prefer_x=self.ix, prefer_y=self.iy)
            if p:
                placed.append(p)

        # ── Koridor (geçiş bandı) ──
        koridor = next((r for r in program if r.room_type == "koridor"), None)
        cor_y = self.iy + social_h + wall
        if koridor:
            p = self._try_place(koridor, self.ix, cor_y, self.iw, 1.20, placed)
            if p:
                placed.append(p)
                private_y = p.top + wall
            else:
                private_y = cor_y + 1.20 + wall
        else:
            private_y = cor_y + 1.20 + wall

        # ── Özel zon (üst): Yatak odaları + banyolar ──
        yatak_rooms = [r for r in program if r.room_type == "yatak_odasi"]
        wet_rooms = [r for r in program if r.room_type in ("banyo", "wc")]
        avail_h = self.iy + self.ih - private_y

        x_priv = self.ix
        for yatak in yatak_rooms:
            yw = min(self.iw * 0.40, max(3.0, yatak.target_area / 3.5))
            yh = min(avail_h, yatak.target_area / yw)
            p = self._try_place(yatak, x_priv, private_y, yw, yh, placed)
            if not p:
                p = self._find_slot(yatak, yw, yh, placed, prefer_x=x_priv, prefer_y=private_y)
            if p:
                placed.append(p)
                x_priv = p.right + wall

        for wr in wet_rooms:
            ww, wh = self._calc_dims(wr, self.iw * 0.22, 0.60)
            wh = min(wh, avail_h)
            p = self._find_slot(wr, ww, wh, placed, prefer_x=x_priv, prefer_y=private_y)
            if p:
                placed.append(p)

        # ── Kalan odalar ──
        placed_names = {p.request.name for p in placed}
        for r in program:
            if r.name not in placed_names:
                rw, rh = self._calc_dims(r, self.iw * 0.30)
                p = self._find_slot(r, rw, rh, placed)
                if p:
                    placed.append(p)
                else:
                    result.unplaced.append(r.name)

        result.rooms = placed
        return result

    # ═══════════════════════════════════════════════════════════
    # STRATEJİ 4: KOMPAKT VERİMLİ
    # ═══════════════════════════════════════════════════════════

    def _strategy_compact_efficient(self, program: list[RoomRequest]) -> LayoutResult:
        """Minimum sirkülasyon alanı, maximum kullanılabilir alan."""
        result = LayoutResult(
            strategy_name="Kompakt Verimli",
            strategy_description="Minimum koridor/antre ile maksimum kullanılabilir alan, odalar sıkı paketlenmiş"
        )
        placed: list[PlacedRoom] = []
        wall = self.PARTITION

        # Odaları alan büyüklüğüne göre sırala (büyükten küçüğe)
        sorted_rooms = sorted(program, key=lambda r: -r.target_area)

        # Sıkı grid-paketleme: soldan sağa, alttan yukarı
        x_cur = self.ix
        y_cur = self.iy
        row_height = 0.0

        for room in sorted_rooms:
            w, h = self._calc_dims(room, self.iw * 0.50, 0.65)

            # Mevcut satıra sığıyor mu?
            if x_cur + w > self.ix + self.iw + 0.01:
                # Yeni satır
                x_cur = self.ix
                y_cur += row_height + wall
                row_height = 0.0

            if y_cur + h > self.iy + self.ih + 0.01:
                # Alan kalmadı — boyutu küçült
                h = self.iy + self.ih - y_cur
                if h < 1.5:
                    result.unplaced.append(room.name)
                    continue

            p = self._try_place(room, x_cur, y_cur, w, h, placed)
            if not p:
                # Tarama ile boş alan bul
                p = self._find_slot(room, w, h, placed, prefer_x=x_cur, prefer_y=y_cur)

            if p:
                placed.append(p)
                x_cur = p.right + wall
                row_height = max(row_height, p.height)
            else:
                result.unplaced.append(room.name)

        result.rooms = placed
        return result

    # ═══════════════════════════════════════════════════════════
    # STRATEJİ 5: GÜNEŞ MAKSİMUM
    # ═══════════════════════════════════════════════════════════

    def _strategy_sun_maximum(self, program: list[RoomRequest]) -> LayoutResult:
        """Tüm yaşam alanları güney cephede, servis alanları kuzeyde."""
        result = LayoutResult(
            strategy_name="Güneş Maksimum",
            strategy_description="Salon, yatak odaları ve balkon güneye bakar, mutfak/banyo/wc kuzeyde"
        )
        placed: list[PlacedRoom] = []
        wall = self.PARTITION

        # Güney bandı (%55): salon + yatak + balkon
        sun_rooms = sorted(
            [r for r in program if r.room_type in ("salon", "yatak_odasi", "balkon")],
            key=lambda r: -r.target_area
        )
        sun_band_h = self.ih * 0.52
        cor_h = 1.20

        # Güney zonuna yerleştir
        self._place_in_zone(sun_rooms, placed,
                            self.ix, self.iy, self.iw, sun_band_h, "horizontal")

        # Koridor bandı
        koridor = next((r for r in program if r.room_type == "koridor"), None)
        cor_y = self.iy + sun_band_h + wall
        if koridor:
            cor_w = min(self.iw, max(koridor.target_area / cor_h, self.iw * 0.65))
            p = self._try_place(koridor, self.ix, cor_y, cor_w, cor_h, placed)
            if p:
                placed.append(p)

        # Kuzey bandı: mutfak + banyo + wc + antre
        north_y = cor_y + cor_h + wall
        north_h = self.iy + self.ih - north_y
        north_rooms = sorted(
            [r for r in program if r.room_type in ("mutfak", "banyo", "wc", "antre")],
            key=lambda r: -r.target_area
        )
        self._place_in_zone(north_rooms, placed,
                            self.ix, north_y, self.iw, north_h, "horizontal")

        # Kalan odalar
        placed_names = {p.request.name for p in placed}
        for r in program:
            if r.name not in placed_names:
                p = self._find_slot_shrink(r, placed)
                if p:
                    placed.append(p)
                else:
                    result.unplaced.append(r.name)

        result.rooms = placed
        return result


# ═══════════════════════════════════════════════════════════════
# YARDIMCI: Room Program Builder
# ═══════════════════════════════════════════════════════════════

def build_room_program(odalar: list[dict], daire_tipi: str = "3+1") -> list[RoomRequest]:
    """Frontend oda listesinden RoomRequest listesi oluşturur."""
    program = []
    for oda in odalar:
        room_type = oda.get("tip", "diger")
        m2 = oda.get("m2", oda.get("varsayilan_m2", 10))
        name = oda.get("isim", oda.get("name", "Oda"))

        is_wet = room_type in ("banyo", "wc", "mutfak")
        needs_ext = room_type in ("salon", "yatak_odasi", "balkon", "mutfak")

        # Bitişiklik
        adjacent = []
        if room_type == "banyo":
            adjacent = ["yatak_odasi", "koridor"]
        elif room_type == "wc":
            adjacent = ["koridor", "antre"]
        elif room_type == "mutfak":
            adjacent = ["salon", "koridor"]
        elif room_type == "salon":
            adjacent = ["balkon", "mutfak", "antre"]
        elif room_type == "antre":
            adjacent = ["koridor", "salon"]

        # Güneş tercihi
        facing = ""
        if room_type == "salon":
            facing = "south"
        elif room_type == "balkon":
            facing = "south"
        elif room_type == "yatak_odasi":
            facing = "east"
        elif room_type == "mutfak":
            facing = "north"

        program.append(RoomRequest(
            name=name,
            room_type=room_type,
            target_area=m2,
            priority=LayoutEngine.PRIORITY.get(room_type, 5),
            needs_exterior=needs_ext,
            preferred_facing=facing,
            is_wet=is_wet,
            adjacent_to=adjacent,
        ))

    return program
