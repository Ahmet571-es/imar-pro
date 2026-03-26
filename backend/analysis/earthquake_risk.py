"""
Deprem Risk Analizi — AFAD/TBDY 2018 parametreleri ve taşıyıcı sistem önerisi.

İyileştirmeler:
- AFAD API endpoint doğrulaması
- Kolon grid çizimi (overlay veri üretimi)
"""

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

ZEMIN_SINIFLARI = {
    "ZA": {"aciklama": "Saglam kaya", "Fs": 0.8, "risk": "Cok Dusuk"},
    "ZB": {"aciklama": "Kaya", "Fs": 0.9, "risk": "Dusuk"},
    "ZC": {"aciklama": "Siki zemin", "Fs": 1.0, "risk": "Orta"},
    "ZD": {"aciklama": "Yumusak zemin", "Fs": 1.2, "risk": "Yuksek"},
    "ZE": {"aciklama": "Cok yumusak zemin", "Fs": 1.5, "risk": "Cok Yuksek"},
}


@dataclass
class KolonGrid:
    """Kolon grid bilgisi — kat planı üzerine overlay."""
    x_akslar: list = field(default_factory=list)
    y_akslar: list = field(default_factory=list)
    kolon_boyut: tuple = (0.30, 0.50)  # en x boy (metre)
    aks_isimleri_x: list = field(default_factory=list)
    aks_isimleri_y: list = field(default_factory=list)


@dataclass
class DepremAnalizi:
    """Deprem risk analizi sonucu."""
    latitude: float = 0.0
    longitude: float = 0.0
    ss: float = 0.0
    s1: float = 0.0
    zemin_sinifi: str = "ZC"
    bks: int = 3
    bys: int = 0
    deprem_bolgesi: str = ""
    risk_seviyesi: str = ""
    tasiyici_sistem_onerisi: str = ""
    kolon_grid_onerisi: str = ""
    perde_onerisi: str = ""
    detaylar: list = field(default_factory=list)
    kolon_grid: KolonGrid | None = None
    afad_api_basarili: bool = False

    def to_dict(self) -> dict:
        return {
            "Konum": f"({self.latitude:.4f}, {self.longitude:.4f})",
            "Ss (Kisa Periyot)": f"{self.ss:.3f}",
            "S1 (1 sn Periyot)": f"{self.s1:.3f}",
            "Zemin Sinifi": (f"{self.zemin_sinifi} — "
                             f"{ZEMIN_SINIFLARI.get(self.zemin_sinifi, {}).get('aciklama', '')}"),
            "Bina Kullanim Sinifi": f"BKS-{self.bks}",
            "Bina Yukseklik Sinifi": f"BYS-{self.bys}",
            "Risk Seviyesi": self.risk_seviyesi,
            "Tasiyici Sistem Onerisi": self.tasiyici_sistem_onerisi,
            "Kolon Grid Onerisi": self.kolon_grid_onerisi,
            "AFAD API": "Basarili" if self.afad_api_basarili else "Fallback tahmin",
        }


def deprem_risk_analizi(
    latitude: float = 39.93,
    longitude: float = 32.86,
    kat_sayisi: int = 4,
    zemin_sinifi: str = "ZC",
    ss_override: float = 0,
    s1_override: float = 0,
    bina_genisligi: float = 12.0,
    bina_derinligi: float = 10.0,
    il_adi: str = "",
) -> DepremAnalizi:
    """Deprem risk analizi yapar.

    Args:
        il_adi: İl adı — AFAD 81 il tablosu fallback'i için kullanılır.
    """
    sonuc = DepremAnalizi(
        latitude=latitude, longitude=longitude,
        zemin_sinifi=zemin_sinifi,
    )

    # Deprem parametreleri
    if ss_override > 0:
        sonuc.ss = ss_override
        sonuc.s1 = s1_override if s1_override > 0 else ss_override * 0.35
    else:
        sonuc.ss, sonuc.s1, sonuc.afad_api_basarili = _estimate_ss(
            latitude, longitude, il_adi=il_adi
        )

    if s1_override > 0:
        sonuc.s1 = s1_override

    # Zemin amplifikasyonu
    zemin_info = ZEMIN_SINIFLARI.get(zemin_sinifi, ZEMIN_SINIFLARI["ZC"])
    sonuc.ss *= zemin_info["Fs"]
    sonuc.s1 *= zemin_info["Fs"]

    # Risk seviyesi
    if sonuc.ss < 0.25:
        sonuc.risk_seviyesi = "Dusuk"
        sonuc.deprem_bolgesi = "4. Derece"
    elif sonuc.ss < 0.50:
        sonuc.risk_seviyesi = "Orta"
        sonuc.deprem_bolgesi = "3. Derece"
    elif sonuc.ss < 0.75:
        sonuc.risk_seviyesi = "Yuksek"
        sonuc.deprem_bolgesi = "2. Derece"
    else:
        sonuc.risk_seviyesi = "Cok Yuksek"
        sonuc.deprem_bolgesi = "1. Derece"

    # BYS
    bina_yuk = kat_sayisi * 3.0
    if bina_yuk <= 17.5:
        sonuc.bys = 7
    elif bina_yuk <= 25:
        sonuc.bys = 6
    elif bina_yuk <= 40:
        sonuc.bys = 5
    elif bina_yuk <= 56:
        sonuc.bys = 4
    else:
        sonuc.bys = 3

    # Taşıyıcı sistem önerisi
    if kat_sayisi <= 4:
        sonuc.tasiyici_sistem_onerisi = "Betonarme Cerceve VEYA Tunel Kalip"
        sonuc.kolon_grid_onerisi = "4.0m x 5.0m aks araligi"
        sonuc.perde_onerisi = "Min 2 adet perde duvar (her yonde)"
        grid_x = 4.0
        grid_y = 5.0
    elif kat_sayisi <= 8:
        sonuc.tasiyici_sistem_onerisi = "Betonarme Perde-Cerceve Sistem"
        sonuc.kolon_grid_onerisi = "4.5m x 5.5m aks araligi"
        sonuc.perde_onerisi = "Min 4 adet perde duvar + cerceve"
        grid_x = 4.5
        grid_y = 5.5
    else:
        sonuc.tasiyici_sistem_onerisi = "Perde Agirlikli Betonarme Sistem"
        sonuc.kolon_grid_onerisi = "5.0m x 6.0m aks araligi"
        sonuc.perde_onerisi = "Perde orani min %1.5 (her yonde)"
        grid_x = 5.0
        grid_y = 6.0

    # Kolon grid hesapla (overlay veri)
    sonuc.kolon_grid = _calculate_column_grid(
        bina_genisligi, bina_derinligi, grid_x, grid_y, kat_sayisi
    )

    # Detaylar
    sonuc.detaylar = [
        "TBDY 2018 parametreleri kullanilmistir",
        f"Bina yuksekligi tahmini: {bina_yuk:.0f}m ({kat_sayisi} kat x 3m)",
        f"Zemin sinifi: {zemin_sinifi} ({zemin_info['aciklama']})",
        "Kesin degerler icin AFAD TDTH haritasindan sorgulanmalidir: "
        "https://tdth.afad.gov.tr/",
        "Zemin etudu raporu zorunludur",
    ]

    if sonuc.ss > 0.50:
        sonuc.detaylar.append(
            "Yuksek deprem riski — perde duvar sayisi artirilmali")
    if zemin_sinifi in ("ZD", "ZE"):
        sonuc.detaylar.append(
            "Yumusak zemin — zemin iyilestirmesi gerekebilir")

    return sonuc


def _calculate_column_grid(
    bina_w: float, bina_h: float,
    grid_x: float, grid_y: float,
    kat_sayisi: int,
) -> KolonGrid:
    """Kolon grid pozisyonlarını hesaplar."""
    import math

    grid = KolonGrid()

    # X aksları
    n_x = max(2, math.ceil(bina_w / grid_x) + 1)
    actual_x = bina_w / (n_x - 1) if n_x > 1 else bina_w
    grid.x_akslar = [i * actual_x for i in range(n_x)]
    grid.aks_isimleri_x = [chr(65 + i) for i in range(n_x)]  # A, B, C...

    # Y aksları
    n_y = max(2, math.ceil(bina_h / grid_y) + 1)
    actual_y = bina_h / (n_y - 1) if n_y > 1 else bina_h
    grid.y_akslar = [i * actual_y for i in range(n_y)]
    grid.aks_isimleri_y = [str(i + 1) for i in range(n_y)]  # 1, 2, 3...

    # Kolon boyutu
    if kat_sayisi <= 4:
        grid.kolon_boyut = (0.30, 0.50)
    elif kat_sayisi <= 8:
        grid.kolon_boyut = (0.35, 0.60)
    else:
        grid.kolon_boyut = (0.40, 0.70)

    return grid


def _estimate_ss(lat: float, lon: float, il_adi: str = "") -> tuple[float, float, bool]:
    """AFAD TDTH API'den Ss/S1 değeri çeker, başarısız olursa 81 il tablosunu kullanır.

    Returns:
        (ss_value, s1_value, api_basarili)
    """
    # Yöntem 1: AFAD TDTH API
    try:
        import requests
        url = "https://tdth.afad.gov.tr/api/spectrum"
        params = {"latitude": lat, "longitude": lon, "soilType": "ZC"}
        resp = requests.get(url, params=params, timeout=3,
                           headers={"User-Agent": "Mozilla/5.0",
                                    "Accept": "application/json"})
        if resp.status_code == 200:
            data = resp.json()
            ss = data.get("Ss", data.get("ss", 0))
            s1 = data.get("S1", data.get("s1", 0))
            if ss and float(ss) > 0:
                logger.info(f"AFAD API'den Ss={ss}, S1={s1} alindi "
                            f"({lat:.2f}, {lon:.2f})")
                s1_val = float(s1) if s1 and float(s1) > 0 else float(ss) * 0.35
                return float(ss), s1_val, True
    except Exception as e:
        logger.debug(f"AFAD API hatasi: {e}")

    # Yöntem 2: deprem.afad.gov.tr
    try:
        import requests
        url2 = (f"https://deprem.afad.gov.tr/api/spectral-values?"
                f"lat={lat}&lng={lon}&soilType=ZC")
        resp2 = requests.get(url2, timeout=3,
                             headers={"User-Agent": "Mozilla/5.0"})
        if resp2.status_code == 200:
            data2 = resp2.json()
            ss = data2.get("Ss", data2.get("ss", 0))
            s1 = data2.get("S1", data2.get("s1", 0))
            if ss and float(ss) > 0:
                logger.info(f"AFAD alt. API'den Ss={ss} alindi")
                s1_val = float(s1) if s1 and float(s1) > 0 else float(ss) * 0.35
                return float(ss), s1_val, True
    except Exception as e:
        logger.debug(f"AFAD alt. API hatasi: {e}")

    # Yöntem 3: AFAD 81 İl Tablosu (güvenilir fallback)
    try:
        from config.afad_ss_s1 import get_il_parametreleri, get_en_yakin_il

        # Önce il adıyla dene
        if il_adi:
            il_param = get_il_parametreleri(il_adi)
            if il_param:
                logger.info(f"AFAD 81 il tablosundan: {il_param.il} "
                            f"Ss={il_param.ss}, S1={il_param.s1}")
                return il_param.ss, il_param.s1, False

        # Koordinata en yakın il merkezini bul
        en_yakin = get_en_yakin_il(lat, lon)
        logger.info(f"AFAD 81 il tablosundan (en yakın: {en_yakin.il}): "
                    f"Ss={en_yakin.ss}, S1={en_yakin.s1}")
        return en_yakin.ss, en_yakin.s1, False

    except Exception as e:
        logger.warning(f"AFAD 81 il tablosu hatasi: {e}")

    # Yöntem 4: Son çare kaba tahmin
    logger.warning("AFAD tüm yöntemler başarısız, kaba tahmin kullanılıyor")
    base = 0.40
    if 39.5 < lat < 41.5 and 27 < lon < 42:
        base = 0.75
    elif lat < 37.5 and 28 < lon < 32:
        base = 0.60
    elif 37 < lat < 39 and 35 < lon < 37:
        base = 0.65
    elif lon > 42:
        base = 0.30
    return base, base * 0.35, False


def test_afad_api() -> dict:
    """AFAD API bağlantı testi."""
    results = {"tdth_api": False, "deprem_api": False, "details": []}

    try:
        import requests
        resp = requests.get(
            "https://tdth.afad.gov.tr/api/spectrum",
            params={"latitude": 39.93, "longitude": 32.86,
                    "soilType": "ZC"},
            timeout=5,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        results["tdth_api"] = resp.status_code == 200
        results["details"].append(f"TDTH API: HTTP {resp.status_code}")
    except Exception as e:
        results["details"].append(f"TDTH API hata: {e}")

    try:
        import requests
        resp2 = requests.get(
            "https://deprem.afad.gov.tr/api/spectral-values",
            params={"lat": 39.93, "lng": 32.86, "soilType": "ZC"},
            timeout=5,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        results["deprem_api"] = resp2.status_code == 200
        results["details"].append(
            f"Deprem API: HTTP {resp2.status_code}")
    except Exception as e:
        results["details"].append(f"Deprem API hata: {e}")

    return results


# ══════════════════════════════════════
# I1. TASARIM SPEKTRUMU GRAFİĞİ
# ══════════════════════════════════════

def tasarim_spektrumu(
    ss: float = 0.411,
    s1: float = 0.109,
    zemin_sinifi: str = "ZC",
) -> dict:
    """TBDY 2018 yatay tasarım spektrumu çizer.

    Returns:
        T (periyot) ve Sa (spektral ivme) dizileri.
    """
    zemin_info = ZEMIN_SINIFLARI.get(zemin_sinifi, ZEMIN_SINIFLARI["ZC"])
    fs = zemin_info["Fs"]

    sds = ss * fs   # Kısa periyot tasarım ivmesi
    sd1 = s1 * fs   # 1sn periyot tasarım ivmesi

    # Karakteristik periyotlar
    ta = 0.2 * sd1 / max(sds, 0.001)
    tb = sd1 / max(sds, 0.001)

    # Spektrum noktaları
    noktalar = []
    # T=0 → artan bölge
    noktalar.append({"T": 0, "Sa": 0.4 * sds})
    # T=Ta → plato başlangıç
    noktalar.append({"T": round(ta, 3), "Sa": round(sds, 4)})
    # T=Tb → plato bitiş
    noktalar.append({"T": round(tb, 3), "Sa": round(sds, 4)})
    # Azalan bölge
    for t in [i * 0.1 for i in range(max(1, int(tb * 10) + 1), 41)]:
        sa = sd1 / t if t > 0 else sds
        noktalar.append({"T": round(t, 2), "Sa": round(sa, 4)})

    return {
        "sds": round(sds, 4),
        "sd1": round(sd1, 4),
        "ta": round(ta, 3),
        "tb": round(tb, 3),
        "zemin_sinifi": zemin_sinifi,
        "fs": fs,
        "noktalar": noktalar,
        "aciklama": f"TBDY 2018 Yatay Tasarım Spektrumu — {zemin_sinifi} zemini",
    }


# ══════════════════════════════════════
# I2. BİNA PERİYOT HESABI
# ══════════════════════════════════════

def bina_periyod_hesabi(
    kat_sayisi: int = 4,
    kat_yuksekligi: float = 3.0,
    tasiyici_sistem: str = "cerceve",  # cerceve | perde | tunel_kalip | celik
) -> dict:
    """TBDY 2018 — T = Ct × H^α ile bina doğal periyodu."""
    H = kat_sayisi * kat_yuksekligi  # Bina yüksekliği (m)

    # Ct ve α katsayıları (TBDY 2018 Tablo 4.4)
    SISTEM_KATSAYILARI = {
        "cerceve": {"Ct": 0.1, "alpha": 0.75, "aciklama": "Betonarme Çerçeve"},
        "perde": {"Ct": 0.05, "alpha": 0.75, "aciklama": "Betonarme Perde/Çerçeve"},
        "tunel_kalip": {"Ct": 0.05, "alpha": 0.75, "aciklama": "Tünel Kalıp"},
        "celik": {"Ct": 0.08, "alpha": 0.75, "aciklama": "Çelik Çerçeve"},
    }

    k = SISTEM_KATSAYILARI.get(tasiyici_sistem, SISTEM_KATSAYILARI["cerceve"])
    Ct = k["Ct"]
    alpha = k["alpha"]

    T = Ct * (H ** alpha)

    # Rayleigh yöntemi ile üst sınır (kaba)
    T_ust = 1.4 * T

    return {
        "bina_yuksekligi_m": round(H, 1),
        "tasiyici_sistem": k["aciklama"],
        "Ct": Ct,
        "alpha": alpha,
        "T_hesap": round(T, 3),
        "T_ust_sinir": round(T_ust, 3),
        "periyot_aralik": f"{T:.3f} — {T_ust:.3f} sn",
        "aciklama": f"T = {Ct} × {H:.1f}^{alpha} = {T:.3f} sn",
    }


# ══════════════════════════════════════
# I3. KAT BAZLI DEPREM KUVVETİ DAĞILIMI
# ══════════════════════════════════════

def deprem_kuvvet_dagilimi(
    kat_sayisi: int = 4,
    kat_yuksekligi: float = 3.0,
    bina_agirligi_ton: float = 0,
    kat_alan: float = 140.0,
    ss: float = 0.411,
    s1: float = 0.109,
    zemin_sinifi: str = "ZC",
    R: float = 8.0,  # Taşıyıcı sistem davranış katsayısı
    D: float = 3.0,  # Dayanım fazlalığı katsayısı
) -> dict:
    """Eşdeğer deprem yükü yöntemi — kat bazlı yatay kuvvetler.

    TBDY 2018 Bölüm 4 — Eşdeğer Deprem Yükü Yöntemi.
    """
    import math

    zemin_info = ZEMIN_SINIFLARI.get(zemin_sinifi, ZEMIN_SINIFLARI["ZC"])
    fs = zemin_info["Fs"]
    sds = ss * fs
    sd1 = s1 * fs

    H = kat_sayisi * kat_yuksekligi

    # Bina ağırlığı (ton) — yoksa tahmini
    if bina_agirligi_ton <= 0:
        # Ortalama 1.0 t/m² (betonarme konut)
        bina_agirligi_ton = kat_sayisi * kat_alan * 1.0

    W = bina_agirligi_ton * 9.81  # kN

    # Bina periyodu
    T = 0.1 * (H ** 0.75)  # Çerçeve

    # Spektral ivme
    ta = 0.2 * sd1 / max(sds, 0.001)
    tb = sd1 / max(sds, 0.001)

    if T <= ta:
        Sa = 0.4 * sds + 0.6 * sds * T / max(ta, 0.001)
    elif T <= tb:
        Sa = sds
    else:
        Sa = sd1 / T

    # Taban kesme kuvveti
    Vt = W * Sa / (R / D)

    # Kat kuvvet dağılımı (üçgensel)
    katlar = []
    toplam_wi_hi = 0
    for i in range(1, kat_sayisi + 1):
        wi = bina_agirligi_ton / kat_sayisi * 9.81  # kN
        hi = i * kat_yuksekligi
        toplam_wi_hi += wi * hi

    for i in range(1, kat_sayisi + 1):
        wi = bina_agirligi_ton / kat_sayisi * 9.81
        hi = i * kat_yuksekligi
        fi = Vt * (wi * hi) / max(toplam_wi_hi, 1)
        vi = sum(
            Vt * (bina_agirligi_ton / kat_sayisi * 9.81 * j * kat_yuksekligi) / max(toplam_wi_hi, 1)
            for j in range(i, kat_sayisi + 1)
        )

        katlar.append({
            "kat": i,
            "yukseklik_m": round(hi, 1),
            "agirlik_kn": round(wi, 1),
            "deprem_kuvveti_kn": round(fi, 1),
            "kat_kesme_kn": round(vi, 1),
            "kat_devrilme_kn_m": round(fi * hi, 1),
        })

    return {
        "bina_agirligi_ton": round(bina_agirligi_ton, 1),
        "bina_agirligi_kn": round(W, 1),
        "bina_periyodu_sn": round(T, 3),
        "spektral_ivme_g": round(Sa, 4),
        "taban_kesme_kn": round(Vt, 1),
        "taban_kesme_orani": round(Vt / max(W, 1) * 100, 2),
        "R": R,
        "D": D,
        "katlar": katlar,
        "aciklama": "TBDY 2018 Eşdeğer Deprem Yükü Yöntemi",
    }

