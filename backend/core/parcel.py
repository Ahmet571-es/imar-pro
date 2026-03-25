"""
Parsel Geometrisi İşlemleri — Parsel oluşturma, alan/kenar hesapları.
"""

from shapely.geometry import Polygon

from utils.geometry_helpers import (
    kenarlar_ve_acilardan_polygon,
    dikdortgen_polygon,
    koordinatlardan_polygon,
    polygon_alan,
    polygon_cevre,
    kenar_uzunluklari,
    kose_acilari,
    polygon_to_coords_list,
    otomatik_acilar_hesapla,
)


class Parsel:
    """Parsel nesnesi — geometri, alan, kenar ve açı bilgilerini tutar."""

    def __init__(self, polygon: Polygon, yon: str = "kuzey"):
        self.polygon = polygon
        self.yon = yon
        self._kenarlar = None
        self._acilar = None

    @classmethod
    def from_kenarlar_acilar(cls, kenarlar: list[float], acilar: list[float] | None = None, yon: str = "kuzey"):
        if acilar is None:
            acilar = otomatik_acilar_hesapla(kenarlar)
        poly = kenarlar_ve_acilardan_polygon(kenarlar, acilar)
        return cls(poly, yon=yon)

    @classmethod
    def from_dikdortgen(cls, en: float, boy: float, yon: str = "kuzey"):
        poly = dikdortgen_polygon(en, boy)
        return cls(poly, yon=yon)

    @classmethod
    def from_koordinatlar(cls, coords: list[tuple[float, float]], yon: str = "kuzey"):
        poly = koordinatlardan_polygon(coords)
        return cls(poly, yon=yon)

    @property
    def alan(self) -> float:
        return polygon_alan(self.polygon)

    @property
    def cevre(self) -> float:
        return polygon_cevre(self.polygon)

    @property
    def kenarlar(self) -> list[float]:
        if self._kenarlar is None:
            self._kenarlar = kenar_uzunluklari(self.polygon)
        return self._kenarlar

    @property
    def acilar(self) -> list[float]:
        if self._acilar is None:
            self._acilar = kose_acilari(self.polygon)
        return self._acilar

    @property
    def kose_sayisi(self) -> int:
        return len(list(self.polygon.exterior.coords)) - 1

    @property
    def koordinatlar(self) -> list[tuple[float, float]]:
        return polygon_to_coords_list(self.polygon)

    @property
    def bounds(self):
        return self.polygon.bounds

    def ozet(self) -> dict:
        return {
            "alan_m2": round(self.alan, 2),
            "cevre_m": round(self.cevre, 2),
            "kose_sayisi": self.kose_sayisi,
            "kenarlar_m": [round(k, 2) for k in self.kenarlar],
            "acilar_derece": [round(a, 1) for a in self.acilar],
            "yon": self.yon,
        }

    def to_svg_coords(self) -> list[dict]:
        """SVG çizim için normalize koordinatlar döndürür."""
        coords = self.koordinatlar[:-1]  # Son = ilk, kaldır
        if not coords:
            return []

        min_x = min(c[0] for c in coords)
        min_y = min(c[1] for c in coords)

        return [
            {"x": round(c[0] - min_x, 3), "y": round(c[1] - min_y, 3)}
            for c in coords
        ]
