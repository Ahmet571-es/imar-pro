"""
İnşaat Maliyet Tahmini — İl, kalite, alan bazlı 15+ kalem detaylı maliyet.
"""

from dataclasses import dataclass, field
from config.cost_defaults import (
    get_construction_cost, MALIYET_DAGILIMI, OTOPARK_MALIYETLERI, GIDER_ORANLARI,
)


@dataclass
class MaliyetSonucu:
    toplam_insaat_alani: float = 0.0
    birim_maliyet: float = 0.0
    kaba_insaat_maliyeti: float = 0.0
    maliyet_kalemleri: dict = field(default_factory=dict)
    otopark_maliyeti: float = 0.0
    proje_muhendislik: float = 0.0
    ruhsat_harclar: float = 0.0
    pazarlama: float = 0.0
    beklenmedik: float = 0.0
    toplam_insaat_gideri: float = 0.0
    arsa_maliyeti: float = 0.0
    toplam_maliyet: float = 0.0

    def to_dict(self) -> dict:
        items = []
        for kalem, tutar in self.maliyet_kalemleri.items():
            items.append({"kalem": kalem, "tutar": round(tutar)})
        items.append({"kalem": "Otopark", "tutar": round(self.otopark_maliyeti)})
        items.append({"kalem": "Proje & Mühendislik", "tutar": round(self.proje_muhendislik)})
        items.append({"kalem": "Ruhsat & Harçlar", "tutar": round(self.ruhsat_harclar)})
        items.append({"kalem": "Pazarlama", "tutar": round(self.pazarlama)})
        items.append({"kalem": "Beklenmedik Giderler", "tutar": round(self.beklenmedik)})
        if self.arsa_maliyeti > 0:
            items.append({"kalem": "Arsa Maliyeti", "tutar": round(self.arsa_maliyeti)})

        return {
            "toplam_insaat_alani": round(self.toplam_insaat_alani, 1),
            "birim_maliyet": round(self.birim_maliyet),
            "toplam_insaat_gideri": round(self.toplam_insaat_gideri),
            "arsa_maliyeti": round(self.arsa_maliyeti),
            "toplam_maliyet": round(self.toplam_maliyet),
            "kalemler": items,
        }


def hesapla_maliyet(
    toplam_insaat_alani: float,
    il: str = "Ankara",
    kalite: str = "orta",
    birim_maliyet_override: float = 0,
    arsa_maliyeti: float = 0,
    otopark_tipi: str = "acik",
    otopark_arac_sayisi: int = 0,
) -> MaliyetSonucu:
    sonuc = MaliyetSonucu()
    sonuc.toplam_insaat_alani = toplam_insaat_alani
    sonuc.arsa_maliyeti = arsa_maliyeti
    sonuc.birim_maliyet = birim_maliyet_override if birim_maliyet_override > 0 else get_construction_cost(il, kalite)
    sonuc.kaba_insaat_maliyeti = toplam_insaat_alani * sonuc.birim_maliyet

    for kalem, oran in MALIYET_DAGILIMI.items():
        sonuc.maliyet_kalemleri[kalem] = sonuc.kaba_insaat_maliyeti * oran

    if otopark_arac_sayisi > 0:
        info = OTOPARK_MALIYETLERI.get(otopark_tipi, OTOPARK_MALIYETLERI["acik"])
        sonuc.otopark_maliyeti = otopark_arac_sayisi * info["m2_arac"] * sonuc.birim_maliyet * info["maliyet_carpan"]

    toplam_baz = sonuc.kaba_insaat_maliyeti + sonuc.otopark_maliyeti
    sonuc.proje_muhendislik = toplam_baz * GIDER_ORANLARI["proje_muhendislik"]
    sonuc.ruhsat_harclar = toplam_baz * GIDER_ORANLARI["ruhsat_harclar"]
    sonuc.pazarlama = toplam_baz * GIDER_ORANLARI["pazarlama"]
    sonuc.beklenmedik = toplam_baz * GIDER_ORANLARI["beklenmedik"]

    sonuc.toplam_insaat_gideri = (
        sonuc.kaba_insaat_maliyeti + sonuc.otopark_maliyeti +
        sonuc.proje_muhendislik + sonuc.ruhsat_harclar +
        sonuc.pazarlama + sonuc.beklenmedik
    )
    sonuc.toplam_maliyet = sonuc.toplam_insaat_gideri + sonuc.arsa_maliyeti
    return sonuc
