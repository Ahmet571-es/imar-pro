"""
Çoklu Kat Planı Motoru — Her kat için farklı daire planı üretimi.

Desteklenen kat tipleri:
- zemin: Ticari (dükkan) veya konut
- normal: Standart konut katları (aynı veya farklı plan)
- cati: Penthouse / çekme kat (daha küçük taban alanı)

Layout Engine ile entegre çalışır.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

from core.layout_engine import LayoutEngine, LayoutResult, RoomRequest, build_room_program

logger = logging.getLogger(__name__)


@dataclass
class KatTanimi:
    """Bir kat tanımı."""
    kat_no: int
    kat_tipi: str = "normal"  # zemin | normal | cati
    daire_tipi: str = "3+1"
    daire_sayisi: int = 2
    taban_alani_carpan: float = 1.0  # Çatı katı için 0.7–0.8 gibi
    ozel_odalar: list[dict] = field(default_factory=list)  # Override oda listesi
    label: str = ""

    def __post_init__(self):
        if not self.label:
            if self.kat_tipi == "zemin":
                self.label = "Zemin Kat"
            elif self.kat_tipi == "cati":
                self.label = "Çatı Katı"
            else:
                self.label = f"{self.kat_no}. Kat"


@dataclass
class KatPlanSonucu:
    """Bir kat için üretilen plan sonucu."""
    kat_no: int
    kat_tipi: str
    kat_label: str
    daire_tipi: str
    daire_sayisi: int
    taban_alani: float
    layout: LayoutResult | None = None
    error: str = ""

    def to_dict(self) -> dict:
        result = {
            "kat_no": self.kat_no,
            "kat_tipi": self.kat_tipi,
            "kat_label": self.kat_label,
            "daire_tipi": self.daire_tipi,
            "daire_sayisi": self.daire_sayisi,
            "taban_alani": round(self.taban_alani, 1),
            "error": self.error,
        }
        if self.layout:
            result["rooms"] = [
                {
                    "name": r.request.name,
                    "type": r.request.room_type,
                    "x": round(r.x, 2),
                    "y": round(r.y, 2),
                    "width": round(r.width, 2),
                    "height": round(r.height, 2),
                    "area": round(r.width * r.height, 1),
                    "is_exterior": getattr(r.request, 'is_exterior', False),
                    "facing": getattr(r.request, 'facing', ''),
                    "doors": [],
                    "windows": [],
                }
                for r in self.layout.rooms
            ]
            result["score"] = 0
            result["total_area"] = round(self.layout.total_area, 1)
        return result


@dataclass
class CokluKatSonucu:
    """Tüm katların birleşik sonucu."""
    toplam_kat: int
    kat_planlari: list[KatPlanSonucu] = field(default_factory=list)
    toplam_daire: int = 0
    toplam_insaat_alani: float = 0.0
    benzersiz_plan_sayisi: int = 0

    def to_dict(self) -> dict:
        return {
            "toplam_kat": self.toplam_kat,
            "toplam_daire": self.toplam_daire,
            "toplam_insaat_alani": round(self.toplam_insaat_alani, 1),
            "benzersiz_plan_sayisi": self.benzersiz_plan_sayisi,
            "kat_planlari": [kp.to_dict() for kp in self.kat_planlari],
        }


# ── Varsayılan Kat Şablonları ──

ZEMIN_KAT_TICARI = {
    "daire_tipi": "dukkan",
    "odalar": [
        {"isim": "Dükkan 1", "tip": "salon", "m2": 40},
        {"isim": "Dükkan 2", "tip": "salon", "m2": 35},
        {"isim": "Depo", "tip": "diger", "m2": 15},
        {"isim": "WC", "tip": "wc", "m2": 4},
    ],
}


def varsayilan_kat_tanimlari(
    kat_sayisi: int,
    zemin_ticari: bool = False,
    cati_penthouse: bool = False,
    normal_daire_tipi: str = "3+1",
    normal_daire_sayisi: int = 2,
) -> list[KatTanimi]:
    """Varsayılan kat tanımları oluşturur."""
    katlar = []

    for k in range(1, kat_sayisi + 1):
        if k == 1 and zemin_ticari:
            katlar.append(KatTanimi(
                kat_no=k, kat_tipi="zemin",
                daire_tipi="dukkan", daire_sayisi=1,
                ozel_odalar=ZEMIN_KAT_TICARI["odalar"],
            ))
        elif k == kat_sayisi and cati_penthouse:
            katlar.append(KatTanimi(
                kat_no=k, kat_tipi="cati",
                daire_tipi="4+1", daire_sayisi=1,
                taban_alani_carpan=0.75,
            ))
        else:
            katlar.append(KatTanimi(
                kat_no=k, kat_tipi="normal",
                daire_tipi=normal_daire_tipi,
                daire_sayisi=normal_daire_sayisi,
            ))

    return katlar


def coklu_kat_plani_uret(
    buildable_width: float,
    buildable_height: float,
    kat_tanimlari: list[KatTanimi],
    sun_direction: str = "south",
    strateji: str = "acik_plan",
) -> CokluKatSonucu:
    """Her kat için ayrı plan üretir.

    Aynı kat tipine sahip katlar aynı planı paylaşır (optimize).
    Farklı tip/daire tanımı olan katlar ayrı plan alır.
    """
    sonuc = CokluKatSonucu(toplam_kat=len(kat_tanimlari))

    # Plan cache — aynı konfigürasyona sahip katlar tekrar hesaplanmaz
    plan_cache: dict[str, LayoutResult] = {}

    for kat_def in kat_tanimlari:
        # Cache key: kat_tipi + daire_tipi + daire_sayisi + taban_carpan
        cache_key = f"{kat_def.kat_tipi}_{kat_def.daire_tipi}_{kat_def.daire_sayisi}_{kat_def.taban_alani_carpan}"

        kat_w = buildable_width * kat_def.taban_alani_carpan
        kat_h = buildable_height * kat_def.taban_alani_carpan
        kat_alan = kat_w * kat_h

        kat_sonuc = KatPlanSonucu(
            kat_no=kat_def.kat_no,
            kat_tipi=kat_def.kat_tipi,
            kat_label=kat_def.label,
            daire_tipi=kat_def.daire_tipi,
            daire_sayisi=kat_def.daire_sayisi,
            taban_alani=kat_alan,
        )

        try:
            if cache_key in plan_cache:
                # Aynı plan — cache'den al
                kat_sonuc.layout = plan_cache[cache_key]
            else:
                # Yeni plan üret
                if kat_def.ozel_odalar:
                    room_requests = [
                        RoomRequest(
                            name=od["isim"],
                            room_type=od["tip"],
                            target_area=od["m2"],
                            min_area=od["m2"] * 0.7,
                            max_area=od["m2"] * 1.3,
                        )
                        for od in kat_def.ozel_odalar
                    ]
                else:
                    # Varsayılan oda programı
                    odalar_raw = [{"isim": f"Oda {i+1}", "tip": "salon", "m2": 20}
                                  for i in range(3)]  # Placeholder
                    room_requests = build_room_program(
                        odalar_raw, daire_tipi=kat_def.daire_tipi
                    )

                engine = LayoutEngine(width=kat_w, height=kat_h)
                layout = engine.generate(
                    room_program=room_requests,
                    strategy=strateji,
                )

                plan_cache[cache_key] = layout
                kat_sonuc.layout = layout

        except Exception as e:
            logger.error(f"Kat {kat_def.kat_no} plan hatası: {e}")
            kat_sonuc.error = str(e)

        sonuc.kat_planlari.append(kat_sonuc)
        sonuc.toplam_daire += kat_def.daire_sayisi
        sonuc.toplam_insaat_alani += kat_alan

    sonuc.benzersiz_plan_sayisi = len(plan_cache)

    return sonuc
