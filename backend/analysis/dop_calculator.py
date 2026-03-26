"""
DOP (Düzenleme Ortaklık Payı) Hesaplayıcı

Yasal Dayanaklar:
- 3194 sayılı İmar Kanunu Madde 18 (Arazi ve arsa düzenlemesi)
- DOP oranı: En fazla %45 (2020 değişikliği ile)
- KOP (Kamu Ortaklık Payı): DOP'tan bağımsız, kamulaştırma bedeli ödenir
- İmar artış değeri payı: 7221 sayılı Kanun (imar planı değişikliğinden kaynaklanan değer artışı)

Hesaplama Mantığı:
1. DOP: Parselin imar düzenlemesindeki kayıp oranı (max %45)
2. İmar Artış Payı: Plan değişikliği ile artan imar haklarının değer farkının %50'ye kadarı
3. Net arsa değeri: DOP ve harçlar düşüldükten sonraki gerçek değer
"""

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# DOP oranları (belediye düzenleme ortaklık payı)
DOP_MAX_ORAN = 0.45  # %45 yasal üst sınır
DOP_VARSAYILAN_ORAN = 0.35  # Genellikle uygulanan oran

# İmar artış değer payı oranları (7221 sayılı Kanun)
IMAR_ARTIS_PAYI_ORANLARI = {
    "konut_konut": 0.0,       # Konut → konut (değişiklik yok)
    "tarim_konut": 0.30,      # Tarım → konut (yüksek artış)
    "tarim_ticaret": 0.40,    # Tarım → ticaret
    "konut_ticaret": 0.20,    # Konut → ticaret (orta artış)
    "yesil_konut": 0.35,      # Yeşil alan → konut
    "sanayi_konut": 0.25,     # Sanayi → konut
}

# Tapu harçları ve vergiler (2024-2025 güncel)
TAPU_HARC_ORANI = 0.04  # %4 (alıcı+satıcı toplam)
ALICI_HARC_ORANI = 0.02  # %2 alıcı payı
SATICI_HARC_ORANI = 0.02  # %2 satıcı payı
EMLAK_VERGISI_KONUT = 0.001  # Binde 1 (büyükşehir: binde 2)
EMLAK_VERGISI_ARSA = 0.003   # Binde 3 (büyükşehir: binde 6)
NOTER_MASRAFI_SABIT = 5000   # TL (yaklaşık)


@dataclass
class DOPSonucu:
    """DOP hesaplama sonucu."""
    # Arsa bilgileri
    brut_arsa_m2: float = 0.0
    dop_orani: float = 0.0
    dop_kesinti_m2: float = 0.0
    net_arsa_m2: float = 0.0

    # İmar artış değer payı
    eski_arsa_degeri: float = 0.0
    yeni_arsa_degeri: float = 0.0
    deger_artisi: float = 0.0
    imar_artis_payi_orani: float = 0.0
    imar_artis_payi_tl: float = 0.0

    # Harçlar ve vergiler
    tapu_harci_tl: float = 0.0
    noter_masrafi_tl: float = 0.0
    yillik_emlak_vergisi_tl: float = 0.0

    # Toplam maliyet
    toplam_arsa_maliyeti: float = 0.0  # Arsa bedeli + tüm harçlar
    efektif_m2_maliyet: float = 0.0    # Toplam / net m²

    # Detaylar
    aciklama: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "brut_arsa_m2": round(self.brut_arsa_m2, 1),
            "dop_orani": f"%{self.dop_orani * 100:.1f}",
            "dop_kesinti_m2": round(self.dop_kesinti_m2, 1),
            "net_arsa_m2": round(self.net_arsa_m2, 1),
            "eski_arsa_degeri": round(self.eski_arsa_degeri),
            "yeni_arsa_degeri": round(self.yeni_arsa_degeri),
            "deger_artisi": round(self.deger_artisi),
            "imar_artis_payi_orani": f"%{self.imar_artis_payi_orani * 100:.0f}",
            "imar_artis_payi_tl": round(self.imar_artis_payi_tl),
            "tapu_harci_tl": round(self.tapu_harci_tl),
            "noter_masrafi_tl": round(self.noter_masrafi_tl),
            "yillik_emlak_vergisi_tl": round(self.yillik_emlak_vergisi_tl),
            "toplam_arsa_maliyeti": round(self.toplam_arsa_maliyeti),
            "efektif_m2_maliyet": round(self.efektif_m2_maliyet),
            "aciklama": self.aciklama,
        }


def hesapla_dop(
    brut_arsa_m2: float,
    arsa_birim_fiyat: float,          # TL/m²
    dop_orani: float = DOP_VARSAYILAN_ORAN,
    imar_degisikligi: str = "",        # "tarim_konut", "konut_ticaret", vb.
    eski_birim_fiyat: float = 0,       # Eski imar durumundaki m² fiyat
    buyuksehir: bool = True,
    otopark_alani: float = 0,
    yesil_alan_payi: float = 0,
) -> DOPSonucu:
    """DOP ve imar artış değeri hesaplar.

    Args:
        brut_arsa_m2: Parselin brüt alanı.
        arsa_birim_fiyat: Güncel m² fiyatı (TL).
        dop_orani: DOP kesinti oranı (0-0.45).
        imar_degisikligi: İmar plan değişikliği türü.
        eski_birim_fiyat: Eski imar durumundaki m² fiyat (değişiklik yoksa 0).
        buyuksehir: Büyükşehir belediyesi mi (emlak vergisi 2×).
        otopark_alani: Otopark için ayrılan alan (m²).
        yesil_alan_payi: Yeşil alan için ayrılan alan (m²).
    """
    sonuc = DOPSonucu()
    sonuc.brut_arsa_m2 = brut_arsa_m2

    # ── 1. DOP Hesabı ──
    dop_oran = min(dop_orani, DOP_MAX_ORAN)
    sonuc.dop_orani = dop_oran
    sonuc.dop_kesinti_m2 = brut_arsa_m2 * dop_oran
    sonuc.net_arsa_m2 = brut_arsa_m2 - sonuc.dop_kesinti_m2

    sonuc.aciklama.append(
        f"DOP kesintisi: {brut_arsa_m2:.0f} m² × %{dop_oran*100:.0f} = "
        f"{sonuc.dop_kesinti_m2:.0f} m² (Kalan: {sonuc.net_arsa_m2:.0f} m²)"
    )

    if dop_oran >= DOP_MAX_ORAN:
        sonuc.aciklama.append(
            "⚠ DOP oranı yasal üst sınır %45'e ulaştı"
        )

    # ── 2. İmar Artış Değer Payı (7221 sayılı Kanun) ──
    sonuc.yeni_arsa_degeri = sonuc.net_arsa_m2 * arsa_birim_fiyat

    if imar_degisikligi and imar_degisikligi in IMAR_ARTIS_PAYI_ORANLARI:
        artis_orani = IMAR_ARTIS_PAYI_ORANLARI[imar_degisikligi]
        sonuc.imar_artis_payi_orani = artis_orani

        if eski_birim_fiyat > 0:
            sonuc.eski_arsa_degeri = sonuc.net_arsa_m2 * eski_birim_fiyat
        else:
            # Eski değer yoksa kaba tahmin: yeni değerin %40-60'ı
            tahmin_carpan = {
                "tarim_konut": 0.20,
                "tarim_ticaret": 0.15,
                "konut_ticaret": 0.60,
                "yesil_konut": 0.10,
                "sanayi_konut": 0.40,
            }.get(imar_degisikligi, 0.50)
            sonuc.eski_arsa_degeri = sonuc.yeni_arsa_degeri * tahmin_carpan

        sonuc.deger_artisi = sonuc.yeni_arsa_degeri - sonuc.eski_arsa_degeri
        sonuc.imar_artis_payi_tl = sonuc.deger_artisi * artis_orani

        sonuc.aciklama.append(
            f"İmar değişikliği ({imar_degisikligi}): "
            f"Artış ₺{sonuc.deger_artisi:,.0f} × %{artis_orani*100:.0f} = "
            f"₺{sonuc.imar_artis_payi_tl:,.0f}"
        )
    else:
        sonuc.eski_arsa_degeri = sonuc.yeni_arsa_degeri
        sonuc.aciklama.append("İmar değişikliği yok — artış payı hesaplanmadı")

    # ── 3. Tapu Harçları ──
    sonuc.tapu_harci_tl = sonuc.yeni_arsa_degeri * ALICI_HARC_ORANI
    sonuc.noter_masrafi_tl = NOTER_MASRAFI_SABIT

    sonuc.aciklama.append(
        f"Tapu harcı (alıcı %2): ₺{sonuc.tapu_harci_tl:,.0f}"
    )

    # ── 4. Emlak Vergisi ──
    emlak_oran = (EMLAK_VERGISI_ARSA * 2 if buyuksehir
                  else EMLAK_VERGISI_ARSA)
    sonuc.yillik_emlak_vergisi_tl = sonuc.yeni_arsa_degeri * emlak_oran

    sonuc.aciklama.append(
        f"Yıllık emlak vergisi: ₺{sonuc.yillik_emlak_vergisi_tl:,.0f} "
        f"({'Büyükşehir' if buyuksehir else 'İl'} tarifesi)"
    )

    # ── 5. Toplam Arsa Maliyeti ──
    sonuc.toplam_arsa_maliyeti = (
        sonuc.yeni_arsa_degeri
        + sonuc.imar_artis_payi_tl
        + sonuc.tapu_harci_tl
        + sonuc.noter_masrafi_tl
    )
    sonuc.efektif_m2_maliyet = (
        sonuc.toplam_arsa_maliyeti / sonuc.net_arsa_m2
        if sonuc.net_arsa_m2 > 0 else 0
    )

    sonuc.aciklama.append(
        f"Toplam arsa maliyeti: ₺{sonuc.toplam_arsa_maliyeti:,.0f} "
        f"(Efektif: ₺{sonuc.efektif_m2_maliyet:,.0f}/m²)"
    )

    return sonuc


def dop_karsilastirma(
    brut_arsa_m2: float,
    arsa_birim_fiyat: float,
    buyuksehir: bool = True,
) -> list[dict]:
    """Farklı DOP oranlarının etkisini karşılaştırır."""
    oranlar = [0.0, 0.10, 0.20, 0.30, 0.35, 0.40, 0.45]
    sonuclar = []

    for oran in oranlar:
        s = hesapla_dop(brut_arsa_m2, arsa_birim_fiyat, dop_orani=oran,
                        buyuksehir=buyuksehir)
        sonuclar.append({
            "dop_orani": f"%{oran*100:.0f}",
            "dop_kesinti_m2": round(s.dop_kesinti_m2, 1),
            "net_arsa_m2": round(s.net_arsa_m2, 1),
            "toplam_maliyet": round(s.toplam_arsa_maliyeti),
            "efektif_m2": round(s.efektif_m2_maliyet),
        })

    return sonuclar
