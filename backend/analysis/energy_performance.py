"""
Enerji Performans Tahmini — Basitleştirilmiş BEP-TR hesaplama, A-G sınıfı.

İyileştirmeler:
- Soğutma enerjisi hesabı
- Pencere yönü bazlı güneş kazancı
"""

from dataclasses import dataclass, field

ENERJI_SINIFLARI = {
    "A":  {"max_kwh": 50,  "renk": "#4CAF50", "aciklama": "Cok iyi"},
    "B":  {"max_kwh": 100, "renk": "#8BC34A", "aciklama": "Iyi"},
    "C":  {"max_kwh": 150, "renk": "#CDDC39", "aciklama": "Orta"},
    "D":  {"max_kwh": 200, "renk": "#FFC107", "aciklama": "Dusuk"},
    "E":  {"max_kwh": 250, "renk": "#FF9800", "aciklama": "Kotu"},
    "F":  {"max_kwh": 300, "renk": "#FF5722", "aciklama": "Cok kotu"},
    "G":  {"max_kwh": 999, "renk": "#F44336", "aciklama": "En kotu"},
}

YALITIM_U_DEGERLERI = {
    "duvar_5cm_eps":   0.50,
    "duvar_8cm_eps":   0.35,
    "duvar_10cm_eps":  0.28,
    "duvar_12cm_xps":  0.22,
    "cati_yalitimli":  0.30,
    "cati_yalitimsiz": 1.50,
}

PENCERE_U_DEGERLERI = {
    "tek_cam":   5.80,
    "cift_cam":  3.30,
    "isicam":    2.60,
    "low_e":     1.60,
}

# Güneş kazanç katsayıları (pencere yönüne göre, W/m²)
GUNES_KAZANCI_KATSAYISI = {
    "south": 180,   # Güney — kışın yüksek, yazın düşük (saçak gölgesi)
    "north": 40,    # Kuzey — çok düşük
    "east":  120,   # Doğu — sabah güneşi
    "west":  140,   # Batı — öğleden sonra (en sıcak)
}

# Soğutma derecesi-gün katsayıları (enleme göre)
SOGUTMA_KATSAYISI = {
    "sicak":  0.65,   # Akdeniz/Güneydoğu (enlem < 37)
    "iliman": 0.35,   # İç Anadolu (37-39)
    "serin":  0.15,   # Karadeniz/Doğu (39+)
}


@dataclass
class EnerjiSonucu:
    """Enerji performans sonucu."""
    yillik_isitma_kwh_m2: float = 0.0
    yillik_sogutma_kwh_m2: float = 0.0
    yillik_toplam_kwh_m2: float = 0.0
    enerji_sinifi: str = "C"
    yillik_enerji_maliyeti: float = 0.0
    duvar_u: float = 0.0
    pencere_u: float = 0.0
    cati_u: float = 0.0
    pencere_duvar_orani: float = 0.0
    gunes_kazanci_kwh: float = 0.0
    oneriler: list = field(default_factory=list)

    def to_dict(self) -> dict:
        sinif_info = ENERJI_SINIFLARI.get(self.enerji_sinifi, {})
        return {
            "Enerji Sinifi": (f"{self.enerji_sinifi} — "
                              f"{sinif_info.get('aciklama', '')}"),
            "Yillik Isitma (kWh/m2)": f"{self.yillik_isitma_kwh_m2:.0f}",
            "Yillik Sogutma (kWh/m2)": f"{self.yillik_sogutma_kwh_m2:.0f}",
            "Yillik Toplam (kWh/m2)": f"{self.yillik_toplam_kwh_m2:.0f}",
            "Yillik Enerji Maliyeti (TL)": (
                f"{self.yillik_enerji_maliyeti:,.0f}"),
            "Duvar U-degeri (W/m2K)": f"{self.duvar_u:.2f}",
            "Pencere U-degeri (W/m2K)": f"{self.pencere_u:.2f}",
            "Cati U-degeri (W/m2K)": f"{self.cati_u:.2f}",
            "Pencere/Duvar Orani": f"{self.pencere_duvar_orani:.0%}",
            "Gunes Kazanci (kWh/yil)": f"{self.gunes_kazanci_kwh:.0f}",
        }


def enerji_performans_hesapla(
    toplam_alan: float,
    kat_sayisi: int = 4,
    duvar_yalitim: str = "duvar_5cm_eps",
    pencere_tipi: str = "isicam",
    cati_yalitimli: bool = True,
    pencere_duvar_orani: float = 0.25,
    isitma_sistemi: str = "dogalgaz_kombi",
    latitude: float = 39.93,
    dogalgaz_birim_fiyat: float = 3.50,
    pencere_yonleri: dict | None = None,
) -> EnerjiSonucu:
    """Basitleştirilmiş enerji performans hesabı.

    Args:
        pencere_yonleri: Her yöndeki pencere alanı oranı.
            Örn: {"south": 0.4, "north": 0.1, "east": 0.25, "west": 0.25}
    """
    sonuc = EnerjiSonucu()

    # U-değerleri
    sonuc.duvar_u = YALITIM_U_DEGERLERI.get(duvar_yalitim, 0.50)
    sonuc.pencere_u = PENCERE_U_DEGERLERI.get(pencere_tipi, 2.60)
    sonuc.cati_u = YALITIM_U_DEGERLERI[
        "cati_yalitimli" if cati_yalitimli else "cati_yalitimsiz"]
    sonuc.pencere_duvar_orani = pencere_duvar_orani

    # Isıtma derecesi-gün (HDD)
    hdd = _estimate_hdd(latitude)

    # Soğutma derecesi-gün (CDD)
    cdd = _estimate_cdd(latitude)

    # Duvar alanı
    cevre_uzunlugu = 4 * (toplam_alan / kat_sayisi) ** 0.5
    duvar_alani = cevre_uzunlugu * 2.60 * kat_sayisi
    pencere_alani = duvar_alani * pencere_duvar_orani
    opak_duvar_alani = duvar_alani - pencere_alani
    cati_alani = toplam_alan / kat_sayisi

    # Isı kaybı (W/K)
    q_duvar = opak_duvar_alani * sonuc.duvar_u
    q_pencere = pencere_alani * sonuc.pencere_u
    q_cati = cati_alani * sonuc.cati_u
    q_toplam = q_duvar + q_pencere + q_cati

    # Güneş kazancı hesabı
    if pencere_yonleri is None:
        pencere_yonleri = {
            "south": 0.35, "north": 0.15,
            "east": 0.25, "west": 0.25,
        }

    gunes_kazanci_toplam = 0.0
    for yon, oran in pencere_yonleri.items():
        yon_pencere_alani = pencere_alani * oran
        g_katsayi = GUNES_KAZANCI_KATSAYISI.get(yon, 100)
        # SHGC (Solar Heat Gain Coefficient)
        shgc = 0.40 if pencere_tipi == "low_e" else 0.60
        gunes_kazanci_toplam += yon_pencere_alani * g_katsayi * shgc / 1000
    sonuc.gunes_kazanci_kwh = gunes_kazanci_toplam * 180  # ~180 güneşli gün

    # Yıllık ısıtma enerjisi (kWh)
    yillik_isitma = (q_toplam * hdd * 24 / 1000
                     - sonuc.gunes_kazanci_kwh * 0.3)  # Kış güneş kazancı
    yillik_isitma = max(0, yillik_isitma)
    sonuc.yillik_isitma_kwh_m2 = yillik_isitma / toplam_alan

    # Yıllık soğutma enerjisi (kWh)
    sogutma_katsayi = _get_sogutma_katsayi(latitude)
    yillik_sogutma = (q_toplam * cdd * 24 / 1000
                      + sonuc.gunes_kazanci_kwh * 0.5)
    yillik_sogutma *= sogutma_katsayi
    sonuc.yillik_sogutma_kwh_m2 = max(0, yillik_sogutma / toplam_alan)

    # Isıtma sistemi verimi
    verim = {"dogalgaz_kombi": 0.92, "merkezi": 0.85, "isi_pompasi": 3.0}
    sistem_verim = verim.get(isitma_sistemi, 0.90)
    sonuc.yillik_isitma_kwh_m2 /= sistem_verim

    # Soğutma COP (inverter klima)
    sogutma_cop = 3.5
    sonuc.yillik_sogutma_kwh_m2 /= sogutma_cop

    # Toplam
    sonuc.yillik_toplam_kwh_m2 = (sonuc.yillik_isitma_kwh_m2
                                   + sonuc.yillik_sogutma_kwh_m2)

    # Enerji sınıfı (toplam üzerinden)
    for sinif, info in ENERJI_SINIFLARI.items():
        if sonuc.yillik_toplam_kwh_m2 <= info["max_kwh"]:
            sonuc.enerji_sinifi = sinif
            break

    # Yıllık maliyet
    kwh_per_m3 = 10.64
    yillik_m3 = (sonuc.yillik_isitma_kwh_m2 * toplam_alan) / kwh_per_m3
    isitma_maliyet = yillik_m3 * dogalgaz_birim_fiyat
    # Soğutma elektrik maliyeti
    elektrik_fiyat = 4.50  # TL/kWh
    sogutma_maliyet = (sonuc.yillik_sogutma_kwh_m2
                       * toplam_alan * elektrik_fiyat)
    sonuc.yillik_enerji_maliyeti = isitma_maliyet + sogutma_maliyet

    # Öneriler
    sonuc.oneriler = _generate_energy_recommendations(
        sonuc, duvar_yalitim, pencere_tipi, cati_yalitimli, pencere_yonleri
    )

    return sonuc


def _estimate_hdd(latitude: float) -> float:
    """Enlem bazlı ısıtma derecesi-gün tahmini."""
    if latitude >= 41:
        return 2800
    elif latitude >= 39:
        return 2400
    elif latitude >= 37:
        return 1800
    else:
        return 1200


def _estimate_cdd(latitude: float) -> float:
    """Enlem bazlı soğutma derecesi-gün tahmini."""
    if latitude < 37:
        return 800   # Akdeniz/Güneydoğu
    elif latitude < 39:
        return 500   # İç Anadolu
    elif latitude < 41:
        return 300   # Marmara
    else:
        return 150   # Karadeniz/Doğu


def _get_sogutma_katsayi(latitude: float) -> float:
    """Soğutma yükü katsayısı."""
    if latitude < 37:
        return SOGUTMA_KATSAYISI["sicak"]
    elif latitude < 39:
        return SOGUTMA_KATSAYISI["iliman"]
    else:
        return SOGUTMA_KATSAYISI["serin"]


def _generate_energy_recommendations(sonuc, duvar_yal, pencere,
                                      cati, pencere_yonleri) -> list[str]:
    """Enerji iyileştirme önerileri."""
    recs = []

    if sonuc.enerji_sinifi in ("D", "E", "F", "G"):
        if duvar_yal == "duvar_5cm_eps":
            recs.append("Yalitim kalinligini 5cm->10cm'ye cikarmak "
                        "enerji sinifini yukseltir")
        if pencere == "cift_cam":
            recs.append("Isicam veya Low-E pencere ile %15-25 enerji "
                        "tasarrufu mumkun")
        if not cati:
            recs.append("Cati yalitimi eklemek isi kaybini %20-30 azaltir")

    if sonuc.pencere_duvar_orani > 0.35:
        recs.append("Pencere/duvar orani yuksek — gunes kirici dusunun")

    # Pencere yönü bazlı öneriler
    if pencere_yonleri:
        bati_oran = pencere_yonleri.get("west", 0)
        if bati_oran > 0.30:
            recs.append("Bati cephesindeki pencere orani yuksek — "
                        "yaz sogutma yukunu arttirir, gunes kirici onerin")

    if sonuc.yillik_sogutma_kwh_m2 > 30:
        recs.append("Sogutma enerjisi yuksek — gunes kontrol cami veya "
                    "dis gunes kirici onerin")

    recs.append(f"Tahmini yillik enerji maliyeti: "
                f"{sonuc.yillik_enerji_maliyeti:,.0f} TL")
    return recs


# ══════════════════════════════════════
# I4. AYLIK ENERJİ TÜKETİM GRAFİĞİ
# ══════════════════════════════════════

def aylik_enerji_tuketim(
    toplam_alan: float,
    kat_sayisi: int = 4,
    latitude: float = 39.93,
    duvar_yalitim: str = "duvar_5cm_eps",
    pencere_tipi: str = "isicam",
) -> dict:
    """12 aylık ısıtma/soğutma/aydınlatma enerji tüketim grafiği."""
    import math

    # Aylık HDD/CDD profilleri (Ankara benzeri — enlem bazlı ölçeklenir)
    # Ocak=0 ... Aralık=11
    HDD_PROFIL = [620, 500, 380, 180, 40, 0, 0, 0, 10, 160, 380, 560]
    CDD_PROFIL = [0, 0, 0, 0, 20, 80, 160, 150, 60, 5, 0, 0]

    # Enlem bazlı ölçekleme
    lat_fac = 1.0 + (latitude - 39.0) * 0.04  # Kuzey → daha soğuk
    soguk_fac = max(0.3, 1.2 - (latitude - 35) * 0.05)  # Güney → daha sıcak

    duvar_u = YALITIM_U_DEGERLERI.get(duvar_yalitim, 0.50)
    pencere_u = PENCERE_U_DEGERLERI.get(pencere_tipi, 2.60)

    # Bina kabuğu ısı kaybı katsayısı (W/K)
    cevre = 4 * (toplam_alan / kat_sayisi) ** 0.5
    duvar_a = cevre * 2.6 * kat_sayisi * 0.75  # Opak kısım
    pencere_a = cevre * 2.6 * kat_sayisi * 0.25
    cati_a = toplam_alan / kat_sayisi
    q_total = duvar_a * duvar_u + pencere_a * pencere_u + cati_a * 0.30

    AY_ISIMLERI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                   "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

    # Aydınlatma — gün uzunluğuna göre (kısa gün → daha fazla)
    AYDINLATMA_PROFIL = [1.3, 1.2, 1.0, 0.9, 0.8, 0.7, 0.7, 0.8, 0.9, 1.0, 1.2, 1.3]
    aydinlatma_baz = toplam_alan * 10 / 1000  # 10 W/m² × saatler → kWh

    aylar = []
    yillik_isitma = 0
    yillik_sogutma = 0
    yillik_aydinlatma = 0

    for i in range(12):
        hdd = HDD_PROFIL[i] * lat_fac
        cdd = CDD_PROFIL[i] * soguk_fac

        isitma = max(0, q_total * hdd * 24 / 1000 / 0.92 / toplam_alan)  # kWh/m²
        sogutma = max(0, q_total * cdd * 24 / 1000 / 3.5 / toplam_alan * soguk_fac)
        aydinlatma = aydinlatma_baz * AYDINLATMA_PROFIL[i] * 30 / toplam_alan

        yillik_isitma += isitma * toplam_alan
        yillik_sogutma += sogutma * toplam_alan
        yillik_aydinlatma += aydinlatma * toplam_alan

        aylar.append({
            "ay": AY_ISIMLERI[i],
            "ay_no": i + 1,
            "isitma_kwh_m2": round(isitma, 1),
            "sogutma_kwh_m2": round(sogutma, 1),
            "aydinlatma_kwh_m2": round(aydinlatma, 1),
            "toplam_kwh_m2": round(isitma + sogutma + aydinlatma, 1),
        })

    return {
        "aylar": aylar,
        "yillik_ozet": {
            "isitma_kwh": round(yillik_isitma),
            "sogutma_kwh": round(yillik_sogutma),
            "aydinlatma_kwh": round(yillik_aydinlatma),
            "toplam_kwh": round(yillik_isitma + yillik_sogutma + yillik_aydinlatma),
        },
    }


# ══════════════════════════════════════
# I5. GÜNEŞ PANELİ ROI
# ══════════════════════════════════════

def gunes_paneli_roi(
    cati_alani: float = 140.0,
    panel_verimi: float = 0.20,       # %20
    kullanilabilir_oran: float = 0.60, # Çatının %60'ı
    yillik_gunes_saat: float = 1700,   # saat (Ankara)
    panel_birim_fiyat: float = 5500,   # TL/m²
    elektrik_fiyat: float = 4.50,      # TL/kWh
    yillik_fiyat_artisi: float = 0.30, # Elektrik fiyat artışı
    panel_omru_yil: int = 25,
    degradasyon: float = 0.007,        # Yıllık %0.7 verim kaybı
) -> dict:
    """Çatı güneş paneli yatırım geri dönüş analizi."""
    panel_alani = cati_alani * kullanilabilir_oran
    panel_guc_kw = panel_alani * panel_verimi  # kWp

    yatirim = panel_alani * panel_birim_fiyat
    yillik_uretim_baz = panel_guc_kw * yillik_gunes_saat  # kWh/yıl

    projeksiyon = []
    kumulatif_tasarruf = 0
    geri_odeme_yili = None

    for yil in range(1, panel_omru_yil + 1):
        verim_kaybi = (1 - degradasyon) ** (yil - 1)
        uretim = yillik_uretim_baz * verim_kaybi
        fiyat = elektrik_fiyat * (1 + yillik_fiyat_artisi) ** (yil - 1)
        tasarruf = uretim * fiyat
        kumulatif_tasarruf += tasarruf

        if geri_odeme_yili is None and kumulatif_tasarruf >= yatirim:
            geri_odeme_yili = yil

        projeksiyon.append({
            "yil": yil,
            "uretim_kwh": round(uretim),
            "elektrik_fiyat": round(fiyat, 2),
            "tasarruf_tl": round(tasarruf),
            "kumulatif_tasarruf": round(kumulatif_tasarruf),
            "net_kazanc": round(kumulatif_tasarruf - yatirim),
        })

    toplam_uretim = sum(p["uretim_kwh"] for p in projeksiyon)
    toplam_tasarruf = projeksiyon[-1]["kumulatif_tasarruf"] if projeksiyon else 0

    return {
        "panel_alani_m2": round(panel_alani, 1),
        "panel_guc_kwp": round(panel_guc_kw, 1),
        "yatirim_tl": round(yatirim),
        "yillik_uretim_kwh": round(yillik_uretim_baz),
        "geri_odeme_yili": geri_odeme_yili,
        "toplam_uretim_kwh": round(toplam_uretim),
        "toplam_tasarruf_tl": round(toplam_tasarruf),
        "net_kazanc_tl": round(toplam_tasarruf - yatirim),
        "roi_pct": round((toplam_tasarruf - yatirim) / max(yatirim, 1) * 100, 1),
        "projeksiyon": projeksiyon[:10],  # İlk 10 yıl
        "co2_azaltma_ton": round(toplam_uretim * 0.0005, 1),  # ~0.5 kg CO₂/kWh
    }


# ══════════════════════════════════════
# I6. ISI KAYBI HARİTASI
# ══════════════════════════════════════

def isi_kaybi_haritasi(
    toplam_alan: float = 560.0,
    kat_sayisi: int = 4,
    duvar_yalitim: str = "duvar_5cm_eps",
    pencere_tipi: str = "isicam",
    cati_yalitimli: bool = True,
    pencere_duvar_orani: float = 0.25,
) -> dict:
    """Duvar/cam/çatı/döşeme bazlı ısı kaybı dağılım haritası."""
    duvar_u = YALITIM_U_DEGERLERI.get(duvar_yalitim, 0.50)
    pencere_u = PENCERE_U_DEGERLERI.get(pencere_tipi, 2.60)
    cati_u = YALITIM_U_DEGERLERI["cati_yalitimli" if cati_yalitimli else "cati_yalitimsiz"]
    doseme_u = 0.40  # Bodrum üzeri döşeme

    cevre = 4 * (toplam_alan / kat_sayisi) ** 0.5
    duvar_alani = cevre * 2.6 * kat_sayisi
    pencere_alani = duvar_alani * pencere_duvar_orani
    opak_alani = duvar_alani - pencere_alani
    cati_alani = toplam_alan / kat_sayisi
    doseme_alani = toplam_alan / kat_sayisi

    # Isı kaybı (W/K)
    kayiplar = {
        "duvar": {"alan_m2": round(opak_alani, 1), "u_degeri": duvar_u, "kayip_wk": round(opak_alani * duvar_u, 1)},
        "pencere": {"alan_m2": round(pencere_alani, 1), "u_degeri": pencere_u, "kayip_wk": round(pencere_alani * pencere_u, 1)},
        "cati": {"alan_m2": round(cati_alani, 1), "u_degeri": cati_u, "kayip_wk": round(cati_alani * cati_u, 1)},
        "doseme": {"alan_m2": round(doseme_alani, 1), "u_degeri": doseme_u, "kayip_wk": round(doseme_alani * doseme_u, 1)},
    }

    toplam_kayip = sum(k["kayip_wk"] for k in kayiplar.values())

    for k, v in kayiplar.items():
        v["oran_pct"] = round(v["kayip_wk"] / max(toplam_kayip, 1) * 100, 1)

    # En büyük kaynak ve öneri
    en_buyuk = max(kayiplar, key=lambda k: kayiplar[k]["kayip_wk"])
    oneriler = []
    if kayiplar["pencere"]["oran_pct"] > 30:
        oneriler.append("Pencerelerden yüksek ısı kaybı — Low-E cam önerilir")
    if kayiplar["cati"]["oran_pct"] > 25 and not cati_yalitimli:
        oneriler.append("Çatı yalıtımı eklemek ısı kaybını %20-30 azaltır")
    if kayiplar["duvar"]["oran_pct"] > 40:
        oneriler.append("Duvar yalıtımını artırmak (8-10cm EPS) önerilir")

    return {
        "kayiplar": kayiplar,
        "toplam_kayip_wk": round(toplam_kayip, 1),
        "en_buyuk_kaynak": en_buyuk,
        "oneriler": oneriler,
    }
