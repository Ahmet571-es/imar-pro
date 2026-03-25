"""
İmar Hesaplama Motoru — TAKS/KAKS, çekme mesafeleri, ortak alan düşümleri.
"""

from dataclasses import dataclass, field
from shapely.geometry import Polygon

from utils.geometry_helpers import cekme_mesafesi_uygula, polygon_alan, polygon_to_coords_list
from utils.constants import (
    MERDIVEN_EVI_ALAN,
    ASANSOR_KUYU_ALAN,
    GIRIS_HOLU_ALAN,
    SIGINAK_ORAN,
)
from config.turkish_building_codes import check_elevator_required


@dataclass
class ImarParametreleri:
    kat_adedi: int = 4
    insaat_nizami: str = "A"
    taks: float = 0.35
    kaks: float = 1.40
    on_bahce: float = 5.0
    yan_bahce: float = 3.0
    arka_bahce: float = 3.0
    bina_yuksekligi_limiti: float = 0.0
    bina_derinligi_limiti: float = 0.0
    asansor_zorunlu: bool = False
    siginak_gerekli: bool = False
    otopark_gerekli: bool = True
    otopark_arac_sayisi: int = 0

    def __post_init__(self):
        self.asansor_zorunlu = check_elevator_required(self.kat_adedi)


@dataclass
class HesaplamaSonucu:
    parsel_alani: float = 0.0
    cekme_sonrasi_alan: float = 0.0
    max_taban_alani: float = 0.0
    toplam_insaat_alani: float = 0.0
    kat_basi_brut_alan: float = 0.0
    merdiven_alani: float = 0.0
    asansor_alani: float = 0.0
    giris_holu_alani: float = 0.0
    siginak_alani: float = 0.0
    toplam_ortak_alan: float = 0.0
    kat_basi_net_alan: float = 0.0
    cekme_polygonu: Polygon = None
    uyarilar: list = field(default_factory=list)

    def to_dict(self) -> dict:
        """API response için dict çıktısı."""
        result = {
            "parsel_alani": round(self.parsel_alani, 2),
            "cekme_sonrasi_alan": round(self.cekme_sonrasi_alan, 2),
            "max_taban_alani": round(self.max_taban_alani, 2),
            "toplam_insaat_alani": round(self.toplam_insaat_alani, 2),
            "kat_basi_brut_alan": round(self.kat_basi_brut_alan, 2),
            "merdiven_alani": round(self.merdiven_alani, 2),
            "asansor_alani": round(self.asansor_alani, 2),
            "giris_holu_alani": round(self.giris_holu_alani, 2),
            "siginak_alani": round(self.siginak_alani, 2),
            "toplam_ortak_alan": round(self.toplam_ortak_alan, 2),
            "kat_basi_net_alan": round(self.kat_basi_net_alan, 2),
            "uyarilar": self.uyarilar,
        }
        if self.cekme_polygonu and not self.cekme_polygonu.is_empty:
            coords = polygon_to_coords_list(self.cekme_polygonu)
            result["cekme_polygon_coords"] = [
                {"x": round(c[0], 3), "y": round(c[1], 3)} for c in coords
            ]
        return result


def hesapla(parsel_polygon: Polygon, imar: ImarParametreleri) -> HesaplamaSonucu:
    """Parsel geometrisi + imar parametreleri ile yapılaşma sınırlarını hesaplar."""
    sonuc = HesaplamaSonucu()
    sonuc.parsel_alani = polygon_alan(parsel_polygon)

    # 1. Çekme mesafelerini uygula
    cekme_poly = cekme_mesafesi_uygula(
        parsel_polygon,
        on_bahce=imar.on_bahce,
        yan_bahce=imar.yan_bahce,
        arka_bahce=imar.arka_bahce,
    )
    sonuc.cekme_polygonu = cekme_poly
    sonuc.cekme_sonrasi_alan = polygon_alan(cekme_poly)

    # 2. TAKS kontrolü
    taks_siniri = sonuc.parsel_alani * imar.taks
    sonuc.max_taban_alani = min(sonuc.cekme_sonrasi_alan, taks_siniri)

    if sonuc.cekme_sonrasi_alan < taks_siniri:
        sonuc.uyarilar.append(
            f"Çekme sonrası alan ({sonuc.cekme_sonrasi_alan:.1f} m²) TAKS sınırından "
            f"({taks_siniri:.1f} m²) küçük. Çekme mesafeleri belirleyici."
        )

    # 3. KAKS
    sonuc.toplam_insaat_alani = sonuc.parsel_alani * imar.kaks

    # 4. Kat başı brüt alan
    if imar.kat_adedi > 0:
        sonuc.kat_basi_brut_alan = sonuc.toplam_insaat_alani / imar.kat_adedi
    else:
        sonuc.kat_basi_brut_alan = 0

    if sonuc.kat_basi_brut_alan > sonuc.max_taban_alani:
        sonuc.uyarilar.append(
            f"Kat başı brüt alan ({sonuc.kat_basi_brut_alan:.1f} m²) > "
            f"Maks. taban alanı ({sonuc.max_taban_alani:.1f} m²). "
            f"KAKS/kat oranı imar sınırlarını aşıyor."
        )
        sonuc.kat_basi_brut_alan = sonuc.max_taban_alani
        sonuc.toplam_insaat_alani = sonuc.kat_basi_brut_alan * imar.kat_adedi

    # 5. Ortak alan düşümü
    sonuc.merdiven_alani = MERDIVEN_EVI_ALAN
    sonuc.asansor_alani = ASANSOR_KUYU_ALAN if imar.asansor_zorunlu else 0.0
    sonuc.giris_holu_alani = GIRIS_HOLU_ALAN
    sonuc.siginak_alani = sonuc.kat_basi_brut_alan * SIGINAK_ORAN if imar.siginak_gerekli else 0.0

    sonuc.toplam_ortak_alan = (
        sonuc.merdiven_alani + sonuc.asansor_alani + sonuc.siginak_alani
    )

    sonuc.kat_basi_net_alan = sonuc.kat_basi_brut_alan - sonuc.toplam_ortak_alan
    if sonuc.kat_basi_net_alan < 0:
        sonuc.kat_basi_net_alan = 0
        sonuc.uyarilar.append("Ortak alanlar kat brüt alanından büyük! Parametreleri kontrol edin.")

    return sonuc
