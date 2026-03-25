"""
Pydantic v2 modelleri — API request/response şemaları.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ── Parsel Modelleri ──

class Coordinate(BaseModel):
    x: float
    y: float


class ParselDikdortgenRequest(BaseModel):
    en: float = Field(..., gt=0, description="Parsel eni (metre)")
    boy: float = Field(..., gt=0, description="Parsel boyu (metre)")
    yon: str = Field(default="kuzey", description="Kuzey yönü")


class ParselKenarlarRequest(BaseModel):
    kenarlar: list[float] = Field(..., min_length=3, description="Kenar uzunlukları (metre)")
    acilar: Optional[list[float]] = Field(default=None, description="İç açılar (derece)")
    yon: str = Field(default="kuzey")


class ParselKoordinatlarRequest(BaseModel):
    koordinatlar: list[Coordinate] = Field(..., min_length=3, description="Köşe koordinatları")
    yon: str = Field(default="kuzey")


class ParselResponse(BaseModel):
    alan_m2: float
    cevre_m: float
    kose_sayisi: int
    kenarlar_m: list[float]
    acilar_derece: list[float]
    yon: str
    koordinatlar: list[Coordinate]
    bounds: dict


# ── TKGM Modelleri ──

class TKGMRequest(BaseModel):
    il: str = Field(..., description="İl adı")
    ilce: str = Field(..., description="İlçe adı")
    mahalle: str = Field(default="", description="Mahalle adı")
    ada: str = Field(..., description="Ada no")
    parsel: str = Field(..., description="Parsel no")


class TKGMResponse(BaseModel):
    basarili: bool
    il: str
    ilce: str
    mahalle: str
    ada: str
    parsel_no: str = Field(alias="parsel")
    alan: float
    koordinatlar: list[Coordinate] = []
    pafta: str = ""
    nitelik: str = ""
    hata: str = ""


# ── İmar Modelleri ──

class ImarRequest(BaseModel):
    # Parsel bilgisi (3 yöntemden biri)
    parsel_tipi: str = Field(default="dikdortgen", description="dikdortgen | kenarlar | koordinatlar")
    en: Optional[float] = None
    boy: Optional[float] = None
    kenarlar: Optional[list[float]] = None
    acilar: Optional[list[float]] = None
    koordinatlar: Optional[list[Coordinate]] = None
    yon: str = Field(default="kuzey")

    # İmar parametreleri
    kat_adedi: int = Field(default=4, ge=1, le=40)
    insaat_nizami: str = Field(default="A", pattern="^(A|B|BL)$")
    taks: float = Field(default=0.35, ge=0.05, le=1.0)
    kaks: float = Field(default=1.40, ge=0.10, le=10.0)
    on_bahce: float = Field(default=5.0, ge=0)
    yan_bahce: float = Field(default=3.0, ge=0)
    arka_bahce: float = Field(default=3.0, ge=0)
    bina_yuksekligi_limiti: float = Field(default=0.0, ge=0)
    bina_derinligi_limiti: float = Field(default=0.0, ge=0)
    siginak_gerekli: bool = False
    otopark_gerekli: bool = True


class ImarResponse(BaseModel):
    parsel: ParselResponse
    hesaplama: dict
    cekme_polygon_coords: Optional[list[Coordinate]] = None
