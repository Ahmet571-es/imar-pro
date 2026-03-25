"""
Satış Geliri Tahmini — Daire bazlı gelir, kat/cephe primi.
"""

from dataclasses import dataclass, field
from config.cost_defaults import KAT_PRIMI, CEPHE_PRIMI


@dataclass
class DaireGelir:
    daire_no: int = 0
    kat: int = 0
    tip: str = "3+1"
    net_alan: float = 0.0
    m2_fiyat: float = 0.0
    kat_primi: float = 0.0
    cephe_primi: float = 0.0
    satis_fiyati: float = 0.0

    def to_dict(self):
        return {
            "daire_no": self.daire_no,
            "kat": self.kat,
            "tip": self.tip,
            "net_alan": round(self.net_alan, 1),
            "m2_fiyat": round(self.m2_fiyat),
            "kat_primi_pct": round(self.kat_primi * 100, 1),
            "cephe_primi_pct": round(self.cephe_primi * 100, 1),
            "satis_fiyati": round(self.satis_fiyati),
        }


@dataclass
class GelirSonucu:
    daire_gelirleri: list[DaireGelir] = field(default_factory=list)
    toplam_daire_geliri: float = 0.0
    dukkan_geliri: float = 0.0
    otopark_geliri: float = 0.0
    toplam_gelir: float = 0.0
    ortalama_m2_fiyat: float = 0.0

    def to_dict(self):
        return {
            "daireler": [d.to_dict() for d in self.daire_gelirleri],
            "toplam_daire_geliri": round(self.toplam_daire_geliri),
            "dukkan_geliri": round(self.dukkan_geliri),
            "otopark_geliri": round(self.otopark_geliri),
            "toplam_gelir": round(self.toplam_gelir),
            "ortalama_m2_fiyat": round(self.ortalama_m2_fiyat),
        }


def hesapla_gelir(
    daireler: list[dict],
    m2_satis_fiyati: float = 40000,
    kat_sayisi: int = 4,
    dukkan_alani: float = 0,
    dukkan_m2_fiyat: float = 0,
    otopark_satis_adedi: int = 0,
    otopark_birim_fiyat: float = 500000,
    cephe_yon: str = "güney",
) -> GelirSonucu:
    sonuc = GelirSonucu(ortalama_m2_fiyat=m2_satis_fiyati)

    for d in daireler:
        dg = DaireGelir(
            daire_no=d.get("daire_no", 0), kat=d.get("kat", 1),
            tip=d.get("tip", "3+1"), net_alan=d.get("net_alan", 100),
            m2_fiyat=m2_satis_fiyati,
        )

        if dg.kat == 1:
            dg.kat_primi = KAT_PRIMI["zemin"]
        elif dg.kat == kat_sayisi:
            dg.kat_primi = KAT_PRIMI["cati_kati"]
        elif dg.kat >= kat_sayisi - 1:
            dg.kat_primi = KAT_PRIMI["ust_kat"]
        else:
            dg.kat_primi = KAT_PRIMI["normal"]

        dg.cephe_primi = CEPHE_PRIMI.get(cephe_yon, 0.0)
        primli_m2 = m2_satis_fiyati * (1 + dg.kat_primi + dg.cephe_primi)
        dg.satis_fiyati = dg.net_alan * primli_m2
        sonuc.daire_gelirleri.append(dg)

    sonuc.toplam_daire_geliri = sum(dg.satis_fiyati for dg in sonuc.daire_gelirleri)
    sonuc.dukkan_geliri = dukkan_alani * dukkan_m2_fiyat if dukkan_alani > 0 else 0
    sonuc.otopark_geliri = otopark_satis_adedi * otopark_birim_fiyat
    sonuc.toplam_gelir = sonuc.toplam_daire_geliri + sonuc.dukkan_geliri + sonuc.otopark_geliri
    return sonuc
