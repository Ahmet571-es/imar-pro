"""
MEP (Mekanik, Elektrik, Tesisat) Şematik Güzergah Üretici — Gelişmiş.

Oda planından otomatik tesisat güzergahı oluşturur:
1. Elektrik: Ana pano → koridor → oda priz/aydınlatma + yük dengesi + kablo kesiti
2. Temiz Su: Kolon → mutfak/banyo/wc (basınçlı hat, DN15-DN32)
3. Pis Su: Mutfak/banyo/wc → düşey kolon (yerçekimi, DN50-DN100)
4. Isıtma: Kazan → radyatör noktaları
5. Havalandırma: Ana kanal → oda menfezleri
6. Yangın Tesisatı: Yangın dolabı + sprinkler grid

Özellikler:
- Dirsek ve T-bağlantı noktaları
- Boru çapı hesabı (ıslak hacim sayısına göre)
- Kablo kesiti hesabı (oda sayısına göre)
- Pis su / temiz su ayrı hatlar
- Yangın dolabı + sprinkler
- Asansör şaftı
- Elektrik yük dengesi (faz dengesi)
- MEP maliyet tahmini
"""

import logging
import math
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class MEPNode:
    """Tesisat düğümü."""
    x: float
    y: float
    name: str = ""
    node_type: str = ""
    discipline: str = ""
    kat: int = 1
    z: float = 0.0  # Yükseklik (m) — boru/kanal kotu

    def to_dict(self) -> dict:
        return {
            "x": round(self.x, 2), "y": round(self.y, 2), "z": round(self.z, 2),
            "name": self.name, "node_type": self.node_type,
            "discipline": self.discipline, "kat": self.kat,
        }


@dataclass
class MEPLine:
    """Tesisat hattı."""
    x1: float
    y1: float
    x2: float
    y2: float
    name: str = ""
    line_type: str = ""  # kablo, temiz_su, pis_su, isitma_boru, kanal, yangin_boru
    discipline: str = ""
    diameter_mm: float = 0
    z: float = 0.0  # Yükseklik kotu
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
            "z": round(self.z, 2), "kat": self.kat,
        }


@dataclass
class MEPFitting:
    """Dirsek veya T-bağlantı noktası."""
    x: float
    y: float
    fitting_type: str = ""  # elbow_90, elbow_45, tee, cross, reducer
    discipline: str = ""
    diameter_mm: float = 0
    angle: float = 90
    kat: int = 1

    def to_dict(self) -> dict:
        return {
            "x": round(self.x, 2), "y": round(self.y, 2),
            "fitting_type": self.fitting_type,
            "discipline": self.discipline,
            "diameter_mm": self.diameter_mm,
            "angle": self.angle, "kat": self.kat,
        }


@dataclass
class MEPSchematic:
    """Tüm MEP verileri."""
    nodes: list[MEPNode] = field(default_factory=list)
    lines: list[MEPLine] = field(default_factory=list)
    fittings: list[MEPFitting] = field(default_factory=list)
    yuk_dengesi: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        disciplines = {}
        for d in ["elektrik", "temiz_su", "pis_su", "isitma", "havalandirma", "yangin"]:
            d_nodes = [n for n in self.nodes if n.discipline == d]
            d_lines = [l for l in self.lines if l.discipline == d]
            d_fittings = [f for f in self.fittings if f.discipline == d]
            if d_nodes or d_lines:
                disciplines[d] = {
                    "nodes": [n.to_dict() for n in d_nodes],
                    "lines": [l.to_dict() for l in d_lines],
                    "fittings": [f.to_dict() for f in d_fittings],
                    "node_count": len(d_nodes),
                    "line_count": len(d_lines),
                    "fitting_count": len(d_fittings),
                    "total_length_m": round(sum(l.length for l in d_lines), 1),
                }

        return {
            "disciplines": disciplines,
            "toplam_node": len(self.nodes),
            "toplam_hat": len(self.lines),
            "toplam_fitting": len(self.fittings),
            "toplam_uzunluk_m": round(sum(l.length for l in self.lines), 1),
            "yuk_dengesi": self.yuk_dengesi,
            "maliyet_tahmini": _estimate_cost(self),
        }


# ══════════════════════════════════════
# BORU ÇAPI HESABI
# ══════════════════════════════════════

def _temiz_su_cap(islak_hacim_sayisi: int) -> float:
    """Islak hacim sayısına göre temiz su boru çapı (mm)."""
    if islak_hacim_sayisi <= 1:
        return 15  # DN15
    elif islak_hacim_sayisi <= 3:
        return 20  # DN20
    elif islak_hacim_sayisi <= 6:
        return 25  # DN25
    else:
        return 32  # DN32


def _pis_su_cap(oda_tipi: str) -> float:
    """Oda tipine göre pis su boru çapı (mm)."""
    return {
        "banyo": 100,  # DN100 (küvet/duş)
        "wc": 100,     # DN100 (klozet)
        "mutfak": 50,  # DN50 (lavabo)
    }.get(oda_tipi, 50)


def _kablo_kesiti(oda_sayisi: int, is_ana_hat: bool = False) -> float:
    """Oda sayısına göre kablo kesiti (mm²)."""
    if is_ana_hat:
        if oda_sayisi <= 4:
            return 6.0
        elif oda_sayisi <= 8:
            return 10.0
        else:
            return 16.0
    else:
        return 2.5  # Tali hat


def _oda_guc_tuketimi(oda_tipi: str) -> float:
    """Oda bazlı güç tüketimi tahmini (W)."""
    return {
        "salon": 1500,
        "yatak_odasi": 800,
        "mutfak": 3500,
        "banyo": 2000,
        "wc": 300,
        "koridor": 200,
        "antre": 300,
        "balkon": 150,
    }.get(oda_tipi, 500)


# ══════════════════════════════════════
# ANA FONKSİYON
# ══════════════════════════════════════

def generate_mep_schematic(
    rooms: list[dict],
    buildable_width: float = 14.0,
    buildable_height: float = 10.0,
    kat_sayisi: int = 1,
) -> MEPSchematic:
    """Oda planından gelişmiş MEP şeması üretir."""
    mep = MEPSchematic()

    wet_rooms = [r for r in rooms if r.get("type") in ("banyo", "wc", "mutfak")]
    dry_rooms = [r for r in rooms if r.get("type") not in ("banyo", "wc", "mutfak", "koridor", "merdiven")]
    all_rooms = [r for r in rooms if r.get("type") != "merdiven"]
    koridor = next((r for r in rooms if r.get("type") == "koridor"), None)

    if koridor:
        kor_cx = koridor["x"] + koridor.get("width", 1) / 2
        kor_cy = koridor["y"] + koridor.get("height", 1) / 2
    else:
        kor_cx = buildable_width / 2
        kor_cy = buildable_height / 2

    islak_hacim_sayisi = len(wet_rooms)
    oda_sayisi = len(all_rooms)

    # ══════════════════════════════════════
    # 1. ELEKTRİK (gelişmiş)
    # ══════════════════════════════════════
    pano = MEPNode(x=0.3, y=buildable_height / 2, name="Ana Pano",
                   node_type="pano", discipline="elektrik", z=1.5)
    mep.nodes.append(pano)

    # Topraklama hattı
    mep.nodes.append(MEPNode(
        x=0.3, y=buildable_height / 2 - 0.3, name="Topraklama Barası",
        node_type="topraklama", discipline="elektrik", z=0.0,
    ))

    ana_kablo_kesiti = _kablo_kesiti(oda_sayisi, is_ana_hat=True)
    tali_kesit = _kablo_kesiti(oda_sayisi, is_ana_hat=False)
    toplam_guc = 0
    faz_yukleri = [0.0, 0.0, 0.0]  # R, S, T fazları

    for idx, r in enumerate(all_rooms):
        rx = r.get("x", 0) + r.get("width", 4) / 2
        ry = r.get("y", 0) + r.get("height", 3) / 2
        rname = r.get("name", "Oda")
        rtype = r.get("type", "salon")

        guc = _oda_guc_tuketimi(rtype)
        toplam_guc += guc
        faz_idx = idx % 3
        faz_yukleri[faz_idx] += guc

        # Aydınlatma
        mep.nodes.append(MEPNode(
            x=rx, y=ry, name=f"{rname} Aydınlatma",
            node_type="aydinlatma", discipline="elektrik", z=2.8,
        ))
        # Priz
        mep.nodes.append(MEPNode(
            x=r.get("x", 0) + 0.3, y=ry, name=f"{rname} Priz",
            node_type="priz", discipline="elektrik", z=0.3,
        ))

        # Ana hat: Pano → koridor (L-güzergah)
        mep.lines.append(MEPLine(
            x1=pano.x, y1=pano.y, x2=kor_cx, y2=pano.y,
            name="Ana Hat", line_type="kablo", discipline="elektrik",
            diameter_mm=ana_kablo_kesiti, z=2.8,
        ))
        # Dirsek
        mep.fittings.append(MEPFitting(
            x=kor_cx, y=pano.y, fitting_type="elbow_90",
            discipline="elektrik", diameter_mm=ana_kablo_kesiti,
        ))
        # Koridor → oda
        mep.lines.append(MEPLine(
            x1=kor_cx, y1=pano.y, x2=kor_cx, y2=ry,
            name=f"{rname} Dikey Hat", line_type="kablo", discipline="elektrik",
            diameter_mm=tali_kesit, z=2.8,
        ))
        # T-bağlantı
        mep.fittings.append(MEPFitting(
            x=kor_cx, y=ry, fitting_type="tee",
            discipline="elektrik", diameter_mm=tali_kesit,
        ))
        mep.lines.append(MEPLine(
            x1=kor_cx, y1=ry, x2=rx, y2=ry,
            name=f"{rname} Besleme", line_type="kablo", discipline="elektrik",
            diameter_mm=tali_kesit, z=2.8,
        ))

    # Yük dengesi
    mep.yuk_dengesi = {
        "toplam_guc_w": toplam_guc,
        "toplam_guc_kw": round(toplam_guc / 1000, 2),
        "faz_yukleri_w": {
            "R": round(faz_yukleri[0]), "S": round(faz_yukleri[1]), "T": round(faz_yukleri[2]),
        },
        "faz_dengesizligi_pct": round(
            (max(faz_yukleri) - min(faz_yukleri)) / max(max(faz_yukleri), 1) * 100, 1
        ),
        "ana_sigorta_a": _sigorta_secimi(toplam_guc),
        "ana_kablo_kesiti_mm2": ana_kablo_kesiti,
        "tali_kablo_kesiti_mm2": tali_kesit,
        "pano_kapasitesi": f"{_sigorta_secimi(toplam_guc)}A 3 Faz",
    }

    # ══════════════════════════════════════
    # 2. TEMİZ SU TESİSATI
    # ══════════════════════════════════════
    if wet_rooms:
        first_wet = wet_rooms[0]
        kolon_x = first_wet.get("x", 0) + first_wet.get("width", 3) / 2
        kolon_y = first_wet.get("y", 0)

        ana_cap = _temiz_su_cap(islak_hacim_sayisi)

        su_kolon = MEPNode(
            x=kolon_x, y=kolon_y, name="Temiz Su Kolonu",
            node_type="kolon_su", discipline="temiz_su", z=0.0,
        )
        mep.nodes.append(su_kolon)

        for r in wet_rooms:
            rx = r.get("x", 0) + r.get("width", 3) / 2
            ry = r.get("y", 0) + r.get("height", 3) / 2
            rname = r.get("name", "Islak Hacim")
            rtype = r.get("type", "banyo")
            tali_cap = 15 if rtype in ("banyo", "wc") else 20

            # Musluk noktası
            mep.nodes.append(MEPNode(
                x=rx, y=ry, name=f"{rname} Musluk",
                node_type="musluk", discipline="temiz_su", z=1.0,
            ))

            # L-güzergah: kolon → yatay → dikey → musluk
            mep.lines.append(MEPLine(
                x1=su_kolon.x, y1=su_kolon.y, x2=rx, y2=su_kolon.y,
                name=f"{rname} Yatay", line_type="temiz_su", discipline="temiz_su",
                diameter_mm=ana_cap, z=0.3,
            ))
            mep.fittings.append(MEPFitting(
                x=rx, y=su_kolon.y, fitting_type="elbow_90",
                discipline="temiz_su", diameter_mm=tali_cap,
            ))
            mep.lines.append(MEPLine(
                x1=rx, y1=su_kolon.y, x2=rx, y2=ry,
                name=f"{rname} Dikey", line_type="temiz_su", discipline="temiz_su",
                diameter_mm=tali_cap, z=0.3,
            ))

    # ══════════════════════════════════════
    # 3. PİS SU TESİSATI (yerçekimi akışlı)
    # ══════════════════════════════════════
    if wet_rooms:
        pis_kolon_x = kolon_x + 0.3  # Temiz su kolonunun yanında
        pis_kolon = MEPNode(
            x=pis_kolon_x, y=kolon_y, name="Pis Su Kolonu",
            node_type="kolon_pis_su", discipline="pis_su", z=0.0,
        )
        mep.nodes.append(pis_kolon)

        for r in wet_rooms:
            rx = r.get("x", 0) + r.get("width", 3) / 2 + 0.2
            ry = r.get("y", 0) + r.get("height", 3) / 2
            rname = r.get("name", "Islak Hacim")
            rtype = r.get("type", "banyo")
            cap = _pis_su_cap(rtype)

            mep.nodes.append(MEPNode(
                x=rx, y=ry, name=f"{rname} Gider",
                node_type="gider", discipline="pis_su", z=0.0,
            ))

            # Pis su: eğimli hat (yerçekimi)
            mep.lines.append(MEPLine(
                x1=rx, y1=ry, x2=pis_kolon_x, y2=pis_kolon.y,
                name=f"{rname} Pis Su", line_type="pis_su", discipline="pis_su",
                diameter_mm=cap, z=0.0,
            ))
            mep.fittings.append(MEPFitting(
                x=pis_kolon_x, y=pis_kolon.y, fitting_type="tee",
                discipline="pis_su", diameter_mm=cap,
            ))

    # ══════════════════════════════════════
    # 4. ISITMA
    # ══════════════════════════════════════
    kazan = MEPNode(
        x=buildable_width - 0.5, y=0.5, name="Kombi/Kazan",
        node_type="kazan", discipline="isitma", z=1.0,
    )
    mep.nodes.append(kazan)

    for r in dry_rooms + wet_rooms:
        rx = r.get("x", 0) + r.get("width", 4) / 2
        ry = r.get("y", 0) + 0.3
        rname = r.get("name", "Oda")

        mep.nodes.append(MEPNode(
            x=rx, y=ry, name=f"{rname} Radyatör",
            node_type="radyator", discipline="isitma", z=0.3,
        ))

        # L-güzergah + dirsek
        mep.lines.append(MEPLine(
            x1=kazan.x, y1=kazan.y, x2=rx, y2=kazan.y,
            name=f"{rname} Yatay", line_type="isitma_boru", discipline="isitma",
            diameter_mm=25, z=0.2,
        ))
        mep.fittings.append(MEPFitting(
            x=rx, y=kazan.y, fitting_type="elbow_90",
            discipline="isitma", diameter_mm=25,
        ))
        mep.lines.append(MEPLine(
            x1=rx, y1=kazan.y, x2=rx, y2=ry,
            name=f"{rname} Dikey", line_type="isitma_boru", discipline="isitma",
            diameter_mm=20, z=0.2,
        ))

    # ══════════════════════════════════════
    # 5. HAVALANDIRMA
    # ══════════════════════════════════════
    for r in wet_rooms:
        rx = r.get("x", 0) + r.get("width", 3) / 2
        ry = r.get("y", 0) + r.get("height", 3) / 2
        rname = r.get("name", "Islak Hacim")

        mep.nodes.append(MEPNode(
            x=rx, y=ry, name=f"{rname} Menfez",
            node_type="menfez", discipline="havalandirma", z=2.7,
        ))

        mep.lines.append(MEPLine(
            x1=rx, y1=ry, x2=buildable_width, y2=ry,
            name=f"{rname} Havalandırma", line_type="kanal", discipline="havalandirma",
            diameter_mm=100, z=2.7,
        ))

    # ══════════════════════════════════════
    # 6. YANGIN TESİSATI
    # ══════════════════════════════════════
    # Yangın dolabı — koridor başında
    yd_x = kor_cx - 0.3 if koridor else buildable_width / 2
    yd_y = kor_cy + 0.3 if koridor else buildable_height / 2

    mep.nodes.append(MEPNode(
        x=yd_x, y=yd_y, name="Yangın Dolabı",
        node_type="yangin_dolabi", discipline="yangin", z=1.2,
    ))

    # Sprinkler grid — her 12m²'ye bir
    toplam_alan = buildable_width * buildable_height
    sprinkler_sayisi = max(2, int(toplam_alan / 12))
    sp_cols = max(1, int(math.sqrt(sprinkler_sayisi * buildable_width / max(buildable_height, 1))))
    sp_rows = max(1, math.ceil(sprinkler_sayisi / sp_cols))

    for si in range(sp_cols):
        for sj in range(sp_rows):
            sx = (si + 0.5) * buildable_width / sp_cols
            sy = (sj + 0.5) * buildable_height / sp_rows
            mep.nodes.append(MEPNode(
                x=sx, y=sy, name=f"Sprinkler {si*sp_rows + sj + 1}",
                node_type="sprinkler", discipline="yangin", z=2.9,
            ))

    # Yangın borusu — ana hat
    mep.lines.append(MEPLine(
        x1=0, y1=yd_y, x2=buildable_width, y2=yd_y,
        name="Yangın Ana Hat", line_type="yangin_boru", discipline="yangin",
        diameter_mm=65, z=2.9,
    ))

    # ══════════════════════════════════════
    # 7. ASANSÖR ŞAFTI (varsa)
    # ══════════════════════════════════════
    if kat_sayisi >= 4:
        as_x = buildable_width / 2 + 2
        as_y = buildable_height / 2
        mep.nodes.append(MEPNode(
            x=as_x, y=as_y, name="Asansör Motor",
            node_type="asansor_motor", discipline="elektrik", z=kat_sayisi * 3.0,
        ))
        mep.nodes.append(MEPNode(
            x=as_x, y=as_y, name="Asansör Kabin",
            node_type="asansor_kabin", discipline="mekanik", z=0.0,
        ))

    logger.info(
        f"MEP şeması: {len(mep.nodes)} node, {len(mep.lines)} hat, "
        f"{len(mep.fittings)} fitting, 6 disiplin"
    )
    return mep


def _sigorta_secimi(toplam_guc_w: float) -> int:
    """Toplam güce göre sigorta akımı seçimi (A)."""
    akim = toplam_guc_w / 380 / 1.73  # 3 faz
    if akim <= 16:
        return 16
    elif akim <= 25:
        return 25
    elif akim <= 32:
        return 32
    elif akim <= 40:
        return 40
    elif akim <= 63:
        return 63
    return 100


def _estimate_cost(mep: MEPSchematic) -> dict:
    """MEP maliyet tahmini (2025 birim fiyatları)."""
    UNIT_COSTS = {
        "kablo": 45,
        "temiz_su": 95,
        "pis_su": 85,
        "isitma_boru": 110,
        "kanal": 130,
        "yangin_boru": 150,
    }

    FITTING_COSTS = {
        "elbow_90": 35,
        "elbow_45": 25,
        "tee": 50,
        "cross": 65,
        "reducer": 30,
    }

    NODE_COSTS = {
        "pano": 8500,
        "topraklama": 1200,
        "priz": 85,
        "aydinlatma": 350,
        "musluk": 450,
        "gider": 120,
        "radyator": 3500,
        "kazan": 35000,
        "menfez": 250,
        "yangin_dolabi": 6500,
        "sprinkler": 180,
        "asansor_motor": 125000,
        "asansor_kabin": 0,  # Motor fiyatına dahil
    }

    cost_by_discipline = {}
    total = 0

    for line in mep.lines:
        unit_cost = UNIT_COSTS.get(line.line_type, 50)
        cost = line.length * unit_cost
        total += cost
        cost_by_discipline.setdefault(line.discipline, 0)
        cost_by_discipline[line.discipline] += cost

    for fitting in mep.fittings:
        cost = FITTING_COSTS.get(fitting.fitting_type, 30)
        total += cost
        cost_by_discipline.setdefault(fitting.discipline, 0)
        cost_by_discipline[fitting.discipline] += cost

    for node in mep.nodes:
        cost = NODE_COSTS.get(node.node_type, 0)
        total += cost
        cost_by_discipline.setdefault(node.discipline, 0)
        cost_by_discipline[node.discipline] += cost

    return {
        "toplam_tl": round(total),
        "disiplin_bazli": {k: round(v) for k, v in cost_by_discipline.items()},
        "birim_fiyatlar": {
            "hat_tl_m": UNIT_COSTS,
            "fitting_tl_adet": FITTING_COSTS,
        },
        "not": "Kaba maliyet tahmini — kesin fiyat için detaylı proje gereklidir",
    }
