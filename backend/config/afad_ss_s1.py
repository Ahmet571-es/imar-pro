"""
AFAD 81 İl Ss/S1 Tablosu — AFAD TDTH haritasından derlenmiş il merkezleri.

Bu tablo, AFAD API erişilemediğinde (sunucu yurt dışında, timeout vb.)
deprem parametreleri için güvenilir fallback sağlar.

Kaynak: https://tdth.afad.gov.tr/ (TBDY 2018 TDTH Haritası)
Not: ZC zemin sınıfı referans alınmıştır. Gerçek zemin etüdü zorunludur.
Her il için il merkezi koordinatları kullanılmıştır.
"""

from dataclasses import dataclass


@dataclass
class IlDepremParametresi:
    """Bir il merkezi için deprem parametreleri."""
    il: str
    plaka: int
    latitude: float
    longitude: float
    ss: float     # Kısa periyot tasarım spektral ivme katsayısı (g)
    s1: float     # 1 saniye periyot tasarım spektral ivme katsayısı (g)


# ── 81 İl Merkezi Deprem Parametreleri ──
# Değerler AFAD TDTH haritasından ZC zemin sınıfı için alınmıştır.
# Ss ve S1 değerleri DD-2 (475 yıl) deprem seviyesi içindir.

AFAD_81_IL: list[IlDepremParametresi] = [
    IlDepremParametresi("Adana",        1,  37.00, 35.32, 0.562, 0.146),
    IlDepremParametresi("Adıyaman",     2,  37.76, 38.28, 0.737, 0.196),
    IlDepremParametresi("Afyonkarahisar",3, 38.74, 30.54, 0.496, 0.142),
    IlDepremParametresi("Ağrı",         4,  39.72, 43.05, 0.584, 0.162),
    IlDepremParametresi("Amasya",       5,  40.65, 35.83, 0.438, 0.125),
    IlDepremParametresi("Ankara",       6,  39.93, 32.86, 0.411, 0.109),
    IlDepremParametresi("Antalya",      7,  36.88, 30.70, 0.438, 0.130),
    IlDepremParametresi("Artvin",       8,  41.18, 41.82, 0.445, 0.121),
    IlDepremParametresi("Aydın",        9,  37.85, 27.85, 0.895, 0.273),
    IlDepremParametresi("Balıkesir",   10,  39.65, 27.88, 0.762, 0.219),
    IlDepremParametresi("Bilecik",     11,  40.05, 30.00, 0.620, 0.165),
    IlDepremParametresi("Bingöl",      12,  38.88, 40.50, 0.958, 0.287),
    IlDepremParametresi("Bitlis",      13,  38.40, 42.11, 0.557, 0.155),
    IlDepremParametresi("Bolu",        14,  40.73, 31.61, 1.171, 0.310),
    IlDepremParametresi("Burdur",      15,  37.72, 30.29, 0.617, 0.179),
    IlDepremParametresi("Bursa",       16,  40.19, 29.06, 0.826, 0.234),
    IlDepremParametresi("Çanakkale",   17,  40.15, 26.41, 0.674, 0.193),
    IlDepremParametresi("Çankırı",     18,  40.60, 33.62, 0.457, 0.127),
    IlDepremParametresi("Çorum",       19,  40.55, 34.96, 0.385, 0.107),
    IlDepremParametresi("Denizli",     20,  37.77, 29.09, 0.704, 0.202),
    IlDepremParametresi("Diyarbakır",  21,  37.91, 40.24, 0.453, 0.123),
    IlDepremParametresi("Edirne",      22,  41.67, 26.56, 0.355, 0.102),
    IlDepremParametresi("Elazığ",      23,  38.67, 39.22, 0.810, 0.233),
    IlDepremParametresi("Erzincan",    24,  39.75, 39.49, 1.199, 0.331),
    IlDepremParametresi("Erzurum",     25,  39.91, 41.27, 0.534, 0.148),
    IlDepremParametresi("Eskişehir",   26,  39.78, 30.52, 0.436, 0.122),
    IlDepremParametresi("Gaziantep",   27,  37.06, 37.38, 0.472, 0.127),
    IlDepremParametresi("Giresun",     28,  40.91, 38.39, 0.357, 0.098),
    IlDepremParametresi("Gümüşhane",   29,  40.46, 39.48, 0.419, 0.115),
    IlDepremParametresi("Hakkâri",     30,  37.58, 43.74, 0.471, 0.133),
    IlDepremParametresi("Hatay",       31,  36.20, 36.16, 0.821, 0.235),
    IlDepremParametresi("Isparta",     32,  37.76, 30.55, 0.534, 0.153),
    IlDepremParametresi("Mersin",      33,  36.80, 34.63, 0.444, 0.120),
    IlDepremParametresi("İstanbul",    34,  41.01, 28.98, 0.659, 0.175),
    IlDepremParametresi("İzmir",       35,  38.42, 27.14, 0.773, 0.222),
    IlDepremParametresi("Kars",        36,  40.60, 43.10, 0.401, 0.109),
    IlDepremParametresi("Kastamonu",   37,  41.39, 33.78, 0.409, 0.115),
    IlDepremParametresi("Kayseri",     38,  38.73, 35.49, 0.328, 0.090),
    IlDepremParametresi("Kırklareli",  39,  41.74, 27.23, 0.357, 0.101),
    IlDepremParametresi("Kırşehir",    40,  39.15, 34.16, 0.300, 0.083),
    IlDepremParametresi("Kocaeli",     41,  40.85, 29.88, 1.080, 0.295),
    IlDepremParametresi("Konya",       42,  37.87, 32.48, 0.262, 0.073),
    IlDepremParametresi("Kütahya",     43,  39.42, 29.98, 0.485, 0.139),
    IlDepremParametresi("Malatya",     44,  38.35, 38.31, 0.709, 0.195),
    IlDepremParametresi("Manisa",      45,  38.61, 27.43, 0.735, 0.209),
    IlDepremParametresi("Kahramanmaraş",46, 37.58, 36.93, 0.913, 0.259),
    IlDepremParametresi("Mardin",      47,  37.31, 40.74, 0.337, 0.092),
    IlDepremParametresi("Muğla",       48,  37.22, 28.36, 0.595, 0.173),
    IlDepremParametresi("Muş",         49,  38.73, 41.49, 0.637, 0.180),
    IlDepremParametresi("Nevşehir",    50,  38.62, 34.72, 0.296, 0.081),
    IlDepremParametresi("Niğde",       51,  37.97, 34.69, 0.329, 0.091),
    IlDepremParametresi("Ordu",        52,  40.98, 37.88, 0.365, 0.101),
    IlDepremParametresi("Rize",        53,  41.02, 40.52, 0.381, 0.104),
    IlDepremParametresi("Sakarya",     54,  40.68, 30.40, 1.063, 0.286),
    IlDepremParametresi("Samsun",      55,  41.29, 36.33, 0.398, 0.112),
    IlDepremParametresi("Siirt",       56,  37.93, 41.94, 0.468, 0.130),
    IlDepremParametresi("Sinop",       57,  42.03, 35.15, 0.378, 0.106),
    IlDepremParametresi("Sivas",       58,  39.75, 37.02, 0.356, 0.098),
    IlDepremParametresi("Tekirdağ",    59,  41.00, 27.51, 0.543, 0.150),
    IlDepremParametresi("Tokat",       60,  40.31, 36.55, 0.680, 0.188),
    IlDepremParametresi("Trabzon",     61,  41.00, 39.72, 0.360, 0.099),
    IlDepremParametresi("Tunceli",     62,  39.11, 39.55, 0.877, 0.251),
    IlDepremParametresi("Şanlıurfa",   63,  37.17, 38.79, 0.392, 0.107),
    IlDepremParametresi("Uşak",        64,  38.67, 29.41, 0.533, 0.153),
    IlDepremParametresi("Van",         65,  38.49, 43.38, 0.573, 0.159),
    IlDepremParametresi("Yozgat",      66,  39.82, 34.80, 0.308, 0.085),
    IlDepremParametresi("Zonguldak",   67,  41.46, 31.79, 0.434, 0.119),
    IlDepremParametresi("Aksaray",     68,  38.37, 34.03, 0.294, 0.081),
    IlDepremParametresi("Bayburt",     69,  40.26, 40.23, 0.458, 0.127),
    IlDepremParametresi("Karaman",     70,  37.18, 33.23, 0.281, 0.078),
    IlDepremParametresi("Kırıkkale",   71,  39.85, 33.51, 0.358, 0.098),
    IlDepremParametresi("Batman",      72,  37.88, 41.13, 0.440, 0.121),
    IlDepremParametresi("Şırnak",      73,  37.42, 42.46, 0.464, 0.129),
    IlDepremParametresi("Bartın",      74,  41.64, 32.34, 0.432, 0.119),
    IlDepremParametresi("Ardahan",     75,  41.11, 42.70, 0.387, 0.106),
    IlDepremParametresi("Iğdır",       76,  39.92, 44.05, 0.531, 0.148),
    IlDepremParametresi("Yalova",      77,  40.65, 29.27, 1.224, 0.332),
    IlDepremParametresi("Karabük",     78,  41.20, 32.62, 0.428, 0.118),
    IlDepremParametresi("Kilis",       79,  36.72, 37.12, 0.512, 0.140),
    IlDepremParametresi("Osmaniye",    80,  37.07, 36.25, 0.658, 0.183),
    IlDepremParametresi("Düzce",       81,  40.84, 31.16, 1.303, 0.348),
]


# ── Hızlı erişim sözlükleri ──

def _normalize_turkish(s: str) -> str:
    """Türkçe-güvenli lowercase + ASCII normalizasyon."""
    # Python 3'te İ.lower() = i̇ (i + combining dot) sorununu çöz
    result = s.strip()
    # Önce Türkçe harfleri açıkça dönüştür
    result = (result
              .replace("İ", "i").replace("I", "ı")  # Türkçe büyük İ/I kuralı
              .lower()
              .replace("ö", "o").replace("ü", "u").replace("ş", "s")
              .replace("ç", "c").replace("ğ", "g").replace("ı", "i")
              .replace("â", "a").replace("î", "i")
              .replace("\u0307", ""))  # combining dot above kaldır
    return result


# İl adına göre arama (büyük/küçük harf duyarsız)
_IL_DICT: dict[str, IlDepremParametresi] = {}
for _il in AFAD_81_IL:
    # Original name (exact match)
    _IL_DICT[_il.il] = _il
    # Normalized key
    _norm = _normalize_turkish(_il.il)
    _IL_DICT[_norm] = _il


def get_il_parametreleri(il_adi: str) -> IlDepremParametresi | None:
    """İl adına göre deprem parametrelerini döndürür.

    Büyük/küçük harf ve Türkçe karakter duyarsız arama yapar.
    """
    # Exact match first
    result = _IL_DICT.get(il_adi.strip())
    if result:
        return result

    # Normalized match
    key = _normalize_turkish(il_adi)
    return _IL_DICT.get(key)


def get_en_yakin_il(latitude: float, longitude: float) -> IlDepremParametresi:
    """Verilen koordinata en yakın il merkezini bulur (Haversine mesafesi)."""
    import math

    def haversine(lat1, lon1, lat2, lon2):
        R = 6371  # km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    en_yakin = min(AFAD_81_IL, key=lambda il: haversine(latitude, longitude, il.latitude, il.longitude))
    return en_yakin


def get_tum_iller() -> list[dict]:
    """Tüm illerin listesini döndürür (frontend dropdown için)."""
    return [
        {
            "il": il.il,
            "plaka": il.plaka,
            "ss": il.ss,
            "s1": il.s1,
            "latitude": il.latitude,
            "longitude": il.longitude,
        }
        for il in sorted(AFAD_81_IL, key=lambda x: x.il)
    ]
