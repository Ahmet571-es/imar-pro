"""
Kapsamlı Fizibilite Analizi — Kâr/zarar, duyarlılık 5×5, Monte Carlo,
nakit akışı, IRR, tornado chart, payback period.
"""

import math
import random
from dataclasses import dataclass, field


@dataclass
class FizibiliteSonucu:
    toplam_gelir: float = 0.0
    toplam_gider: float = 0.0
    kar: float = 0.0
    kar_marji: float = 0.0
    roi: float = 0.0
    basabas_m2: float = 0.0

    def to_dict(self):
        return {
            "toplam_gelir": round(self.toplam_gelir),
            "toplam_gider": round(self.toplam_gider),
            "kar": round(self.kar),
            "kar_marji": round(self.kar_marji, 1),
            "roi": round(self.roi, 1),
            "basabas_m2": round(self.basabas_m2),
        }


def hesapla_fizibilite(toplam_gelir: float, toplam_gider: float, satilabilir_alan: float = 0) -> FizibiliteSonucu:
    s = FizibiliteSonucu(toplam_gelir=toplam_gelir, toplam_gider=toplam_gider)
    s.kar = toplam_gelir - toplam_gider
    s.kar_marji = (s.kar / toplam_gelir * 100) if toplam_gelir > 0 else 0
    s.roi = (s.kar / toplam_gider * 100) if toplam_gider > 0 else 0
    s.basabas_m2 = (toplam_gider / satilabilir_alan) if satilabilir_alan > 0 else 0
    return s


# ── Duyarlılık 5×5 ──

def duyarlilik_5x5(
    baz_maliyet: float,
    baz_gelir: float,
    maliyet_adim: list[float] = None,
    fiyat_adim: list[float] = None,
) -> dict:
    if maliyet_adim is None:
        maliyet_adim = [-0.20, -0.10, 0.0, 0.10, 0.20]
    if fiyat_adim is None:
        fiyat_adim = [-0.20, -0.10, 0.0, 0.10, 0.20]

    rows = []
    for md in maliyet_adim:
        row = []
        for fd in fiyat_adim:
            m = baz_maliyet * (1 + md)
            g = baz_gelir * (1 + fd)
            kar = g - m
            marj = (kar / g * 100) if g > 0 else 0
            row.append({
                "maliyet_d": round(md * 100),
                "fiyat_d": round(fd * 100),
                "kar": round(kar),
                "kar_marji": round(marj, 1),
            })
        rows.append(row)

    return {
        "maliyet_labels": [f"{int(d*100):+d}%" for d in maliyet_adim],
        "fiyat_labels": [f"{int(d*100):+d}%" for d in fiyat_adim],
        "matris": rows,
    }


# ── Monte Carlo ──

def monte_carlo(
    baz_maliyet: float,
    baz_gelir: float,
    maliyet_std: float = 0.10,
    gelir_std: float = 0.12,
    n: int = 5000,
    seed: int = 42,
) -> dict:
    random.seed(seed)
    kars = []
    for _ in range(n):
        m = baz_maliyet * (1 + random.gauss(0, maliyet_std))
        g = baz_gelir * (1 + random.gauss(0, gelir_std))
        kars.append(g - m)

    kars.sort()
    mean_kar = sum(kars) / len(kars)
    zarar_olasiligi = sum(1 for k in kars if k < 0) / len(kars) * 100

    # Histogram bins
    min_k, max_k = min(kars), max(kars)
    bin_count = 40
    bin_width = (max_k - min_k) / bin_count if max_k > min_k else 1
    histogram = []
    for i in range(bin_count):
        lo = min_k + i * bin_width
        hi = lo + bin_width
        count = sum(1 for k in kars if lo <= k < hi)
        histogram.append({
            "x": round((lo + hi) / 2),
            "count": count,
            "is_loss": (lo + hi) / 2 < 0,
        })

    # Percentiles
    p5 = kars[int(n * 0.05)]
    p25 = kars[int(n * 0.25)]
    p50 = kars[int(n * 0.50)]
    p75 = kars[int(n * 0.75)]
    p95 = kars[int(n * 0.95)]

    return {
        "ortalama_kar": round(mean_kar),
        "zarar_olasiligi": round(zarar_olasiligi, 1),
        "p5": round(p5),
        "p25": round(p25),
        "p50": round(p50),
        "p75": round(p75),
        "p95": round(p95),
        "std": round((sum((k - mean_kar)**2 for k in kars) / len(kars))**0.5),
        "histogram": histogram,
        "n": n,
    }


# ── Nakit Akışı ──

def nakit_akisi(
    toplam_maliyet: float,
    toplam_gelir: float,
    insaat_suresi_ay: int = 18,
    satis_suresi_ay: int = 12,
    on_satis_orani: float = 0.30,
) -> dict:
    """Aylık kümülatif gider/gelir nakit akışı."""
    toplam_ay = insaat_suresi_ay + satis_suresi_ay
    aylik = []

    # Gider profili: S-curve (başta yavaş, ortada yoğun, sonda yavaş)
    gider_profil = []
    for i in range(insaat_suresi_ay):
        t = (i + 0.5) / insaat_suresi_ay
        w = math.sin(t * math.pi) + 0.2
        gider_profil.append(w)
    gider_toplam_w = sum(gider_profil)

    # Gelir profili: ön satış + inşaat sonu + teslim sonrası
    gelir_profil = [0.0] * toplam_ay
    on_satis_gelir = toplam_gelir * on_satis_orani
    kalan_gelir = toplam_gelir - on_satis_gelir

    # Ön satış: inşaat başından itibaren aylık eşit
    for i in range(insaat_suresi_ay):
        gelir_profil[i] += on_satis_gelir / insaat_suresi_ay

    # Kalan satışlar: inşaat bittikten sonra
    for i in range(satis_suresi_ay):
        gelir_profil[insaat_suresi_ay + i] += kalan_gelir / satis_suresi_ay

    kumulatif_gider = 0
    kumulatif_gelir = 0

    for ay in range(toplam_ay):
        aylik_gider = (toplam_maliyet * gider_profil[ay] / gider_toplam_w) if ay < insaat_suresi_ay else 0
        aylik_gelir = gelir_profil[ay]
        kumulatif_gider += aylik_gider
        kumulatif_gelir += aylik_gelir

        aylik.append({
            "ay": ay + 1,
            "aylik_gider": round(aylik_gider),
            "aylik_gelir": round(aylik_gelir),
            "kumulatif_gider": round(kumulatif_gider),
            "kumulatif_gelir": round(kumulatif_gelir),
            "net": round(kumulatif_gelir - kumulatif_gider),
        })

    # Payback period
    payback = None
    for item in aylik:
        if item["net"] >= 0:
            payback = item["ay"]
            break

    return {
        "aylik": aylik,
        "toplam_ay": toplam_ay,
        "insaat_suresi_ay": insaat_suresi_ay,
        "satis_suresi_ay": satis_suresi_ay,
        "payback_ay": payback,
    }


# ── IRR Hesabı ──

def hesapla_irr(nakit_akisi_data: list[dict], max_iter: int = 100) -> float:
    """Aylık nakit akışından yıllık IRR hesaplar (Newton-Raphson)."""
    flows = []
    for item in nakit_akisi_data:
        flows.append(item["aylik_gelir"] - item["aylik_gider"])

    if not flows or all(f == 0 for f in flows):
        return 0.0

    # Newton-Raphson IRR
    rate = 0.01  # Aylık
    for _ in range(max_iter):
        npv = sum(f / (1 + rate) ** (i + 1) for i, f in enumerate(flows))
        dnpv = sum(-f * (i + 1) / (1 + rate) ** (i + 2) for i, f in enumerate(flows))
        if abs(dnpv) < 1e-10:
            break
        new_rate = rate - npv / dnpv
        if abs(new_rate - rate) < 1e-8:
            rate = new_rate
            break
        rate = max(-0.5, min(new_rate, 2.0))

    yillik_irr = (1 + rate) ** 12 - 1
    return round(yillik_irr * 100, 1)


# ── Tornado Chart ──

def tornado_analizi(
    baz_maliyet: float,
    baz_gelir: float,
    baz_kar: float,
) -> list[dict]:
    """Hangi parametrenin kâra en çok etki ettiğini gösterir."""
    # Her parametre ±%15 değiştiğinde kâr değişimi
    params = [
        ("m² Satış Fiyatı", baz_gelir, True),
        ("İnşaat Maliyeti", baz_maliyet, False),
        ("Arsa Maliyeti", baz_maliyet * 0.25, False),
        ("Ön Satış Oranı", baz_gelir * 0.15, True),
        ("İnşaat Süresi", baz_maliyet * 0.07, False),
        ("Beklenmedik Giderler", baz_maliyet * 0.07, False),
    ]

    results = []
    for name, base_val, is_positive in params:
        delta = base_val * 0.15
        if is_positive:
            low_kar = baz_kar - delta
            high_kar = baz_kar + delta
        else:
            low_kar = baz_kar + delta  # Maliyet düşünce kâr artar
            high_kar = baz_kar - delta

        results.append({
            "parametre": name,
            "dusuk": round(low_kar),
            "yuksek": round(high_kar),
            "etki": round(abs(high_kar - low_kar)),
            "baz": round(baz_kar),
        })

    results.sort(key=lambda x: x["etki"], reverse=True)
    return results
