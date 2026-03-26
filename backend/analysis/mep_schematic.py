"""
MEP (Mekanik, Elektrik, Tesisat) Şematik Güzergah Üretici.

Oda planından otomatik tesisat güzergahı oluşturur:
1. Elektrik: Ana pano → koridor → oda priz/aydınlatma
2. Su tesisatı: Kolon → mutfak/banyo/wc
3. Kalorifer: Kazan → radyatör noktaları
4. Havalandırma: Ana kanal → oda menfezleri

Güzergahlar 2D şematik olarak SVG/JSON formatında üretilir.
Gerçek BIM seviyesinde değil (3D MEP disiplini yok) ama
fizibilite platformu için yeterli temsil.
"""

import logging
import math
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class MEPNode:
    """Tesisat düğümü (priz, musluk, radyatör vb.)."""
    x: float
    y: float
    name: str = ""
    node_type: str = ""  # priz, aydinlatma, musluk, radyator, menfez, pano, kolon
    discipline: str = ""  # elektrik, su, isitma, havalandirma
    kat: int = 1

    def to_dict(self) -> dict:
        return {
            "x": round(self.x, 2), "y": round(self.y, 2),
            "name": self.name, "node_type": self.node_type,
            "discipline": self.discipline, "kat": self.kat,
        }


@dataclass
class MEPLine:
    """Tesisat hattı (boru, kablo, kanal)."""
    x1: float
    y1: float
    x2: float
    y2: float
    name: str = ""
    line_type: str = ""  # kablo, boru, kanal
    discipline: str = ""
    diameter_mm: float = 0
    kat: int = 1

    @property
    def length(self) -> float:
        return math.sqrt((self.x2 - self.x1)**2 + (self.y2 - self.y1)**2)

    def to_dict(self) -> dict:
        return {
            "x1": round(self.x1, 2), "y1": round(self.y1, 2),
            "x2": round(self.x2, 2), "y2": round(self.y2, 2),
            "name": self.name, "line_type": self.line_type,
            "discipline": self.discipline,
            "diameter_mm": self.diameter_mm,
            "length": round(self.length, 2),
            "kat": self.kat,
        }


@dataclass
class MEPSchematic:
    """Tüm MEP verileri."""
    nodes: list[MEPNode] = field(default_factory=list)
    lines: list[MEPLine] = field(default_factory=list)

    def to_dict(self) -> dict:
        disciplines = {}
        for d in ["elektrik", "su", "isitma", "havalandirma"]:
            d_nodes = [n for n in self.nodes if n.discipline == d]
            d_lines = [l for l in self.lines if l.discipline == d]
            if d_nodes or d_lines:
                disciplines[d] = {
                    "nodes": [n.to_dict() for n in d_nodes],
                    "lines": [l.to_dict() for l in d_lines],
                    "node_count": len(d_nodes),
                    "total_length_m": round(sum(l.length for l in d_lines), 1),
                }

        return {
            "disciplines": disciplines,
            "toplam_node": len(self.nodes),
            "toplam_hat": len(self.lines),
            "toplam_uzunluk_m": round(sum(l.length for l in self.lines), 1),
            "maliyet_tahmini": _estimate_cost(self),
        }


def generate_mep_schematic(
    rooms: list[dict],
    buildable_width: float = 14.0,
    buildable_height: float = 10.0,
) -> MEPSchematic:
    """Oda planından MEP şeması üretir.

    Args:
        rooms: Oda listesi
        buildable_width: Genişlik (m)
        buildable_height: Derinlik (m)
    """
    mep = MEPSchematic()

    # Odaları tipe göre ayır
    wet_rooms = [r for r in rooms if r.get("type") in ("banyo", "wc", "mutfak")]
    dry_rooms = [r for r in rooms if r.get("type") not in ("banyo", "wc", "mutfak", "koridor", "merdiven")]
    all_rooms = [r for r in rooms if r.get("type") != "merdiven"]
    koridor = next((r for r in rooms if r.get("type") == "koridor"), None)

    # Koridor yoksa merkez hat oluştur
    if koridor:
        kor_cx = koridor["x"] + koridor.get("width", 1) / 2
        kor_cy = koridor["y"] + koridor.get("height", 1) / 2
    else:
        kor_cx = buildable_width / 2
        kor_cy = buildable_height / 2

    # ── 1. ELEKTRİK ──
    # Ana pano (giriş kenarında)
    pano = MEPNode(x=0.3, y=buildable_height / 2, name="Ana Pano", node_type="pano", discipline="elektrik")
    mep.nodes.append(pano)

    for r in all_rooms:
        rx = r.get("x", 0) + r.get("width", 4) / 2
        ry = r.get("y", 0) + r.get("height", 3) / 2
        rname = r.get("name", "Oda")

        # Aydınlatma (tavan ortası)
        light = MEPNode(x=rx, y=ry, name=f"{rname} Aydınlatma", node_type="aydinlatma", discipline="elektrik")
        mep.nodes.append(light)

        # Priz (duvar kenarı)
        priz = MEPNode(
            x=r.get("x", 0) + 0.3, y=ry,
            name=f"{rname} Priz", node_type="priz", discipline="elektrik",
        )
        mep.nodes.append(priz)

        # Kablo hattı: Pano → koridor → oda
        mep.lines.append(MEPLine(
            x1=pano.x, y1=pano.y, x2=kor_cx, y2=pano.y,
            name=f"Ana Hat", line_type="kablo", discipline="elektrik", diameter_mm=6,
        ))
        mep.lines.append(MEPLine(
            x1=kor_cx, y1=pano.y, x2=rx, y2=ry,
            name=f"{rname} Besleme", line_type="kablo", discipline="elektrik", diameter_mm=2.5,
        ))

    # ── 2. SU TESİSATI ──
    # Su kolonu (ıslak hacim yakınında)
    if wet_rooms:
        first_wet = wet_rooms[0]
        kolon_x = first_wet.get("x", 0) + first_wet.get("width", 3) / 2
        kolon_y = first_wet.get("y", 0)

        su_kolon = MEPNode(
            x=kolon_x, y=kolon_y, name="Su Kolonu",
            node_type="kolon_su", discipline="su",
        )
        mep.nodes.append(su_kolon)

        for r in wet_rooms:
            rx = r.get("x", 0) + r.get("width", 3) / 2
            ry = r.get("y", 0) + r.get("height", 3) / 2
            rname = r.get("name", "Islak Hacim")

            # Musluk noktası
            musluk = MEPNode(
                x=rx, y=ry, name=f"{rname} Musluk",
                node_type="musluk", discipline="su",
            )
            mep.nodes.append(musluk)

            # Boru hattı
            mep.lines.append(MEPLine(
                x1=su_kolon.x, y1=su_kolon.y, x2=rx, y2=ry,
                name=f"{rname} Su", line_type="boru", discipline="su",
                diameter_mm=20 if r.get("type") == "mutfak" else 15,
            ))

    # ── 3. ISITMA ──
    # Kazan (genellikle bina dışı veya bodrum)
    kazan = MEPNode(
        x=buildable_width - 0.5, y=0.5, name="Kombi/Kazan",
        node_type="kazan", discipline="isitma",
    )
    mep.nodes.append(kazan)

    for r in dry_rooms + wet_rooms:
        rx = r.get("x", 0) + r.get("width", 4) / 2
        ry = r.get("y", 0) + 0.3  # Radyatör pencere altında
        rname = r.get("name", "Oda")

        rad = MEPNode(
            x=rx, y=ry, name=f"{rname} Radyatör",
            node_type="radyator", discipline="isitma",
        )
        mep.nodes.append(rad)

        mep.lines.append(MEPLine(
            x1=kazan.x, y1=kazan.y, x2=rx, y2=ry,
            name=f"{rname} Isıtma", line_type="boru", discipline="isitma",
            diameter_mm=25,
        ))

    # ── 4. HAVALANDIRMA ──
    for r in wet_rooms:
        rx = r.get("x", 0) + r.get("width", 3) / 2
        ry = r.get("y", 0) + r.get("height", 3) / 2
        rname = r.get("name", "Islak Hacim")

        menfez = MEPNode(
            x=rx, y=ry, name=f"{rname} Menfez",
            node_type="menfez", discipline="havalandirma",
        )
        mep.nodes.append(menfez)

        # Dış cepheye kanal
        mep.lines.append(MEPLine(
            x1=rx, y1=ry, x2=buildable_width, y2=ry,
            name=f"{rname} Havalandırma", line_type="kanal", discipline="havalandirma",
            diameter_mm=100,
        ))

    logger.info(f"MEP şeması: {len(mep.nodes)} node, {len(mep.lines)} hat")
    return mep


def _estimate_cost(mep: MEPSchematic) -> dict:
    """MEP maliyet tahmini (kaba)."""
    # 2025 birim fiyatları (TL/m)
    UNIT_COSTS = {
        "kablo": 35,
        "boru": 80,
        "kanal": 120,
    }

    cost_by_discipline = {}
    total = 0

    for line in mep.lines:
        unit_cost = UNIT_COSTS.get(line.line_type, 50)
        cost = line.length * unit_cost
        total += cost

        if line.discipline not in cost_by_discipline:
            cost_by_discipline[line.discipline] = 0
        cost_by_discipline[line.discipline] += cost

    return {
        "toplam_tl": round(total),
        "disiplin_bazli": {k: round(v) for k, v in cost_by_discipline.items()},
        "not": "Kaba maliyet tahmini — kesin fiyat için detaylı proje gereklidir",
    }
