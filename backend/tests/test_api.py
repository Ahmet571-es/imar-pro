"""
imarPRO Backend Unit Tests — pytest ile çalıştırılır.

Kullanım: cd backend && python -m pytest tests/ -v
"""

import sys
import os
import json
import pytest

# Backend root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ══════════════════════════════════════
# FIXTURES
# ══════════════════════════════════════

@pytest.fixture
def client():
    """FastAPI test client."""
    from fastapi.testclient import TestClient
    from main import app
    return TestClient(app)


@pytest.fixture
def sample_rooms():
    """Basit oda listesi."""
    return [
        {"name": "Salon", "type": "salon", "x": 0, "y": 0, "width": 5, "height": 4,
         "area": 20, "is_exterior": True, "facing": "south", "doors": [], "windows": []},
        {"name": "Yatak", "type": "yatak_odasi", "x": 5.2, "y": 0, "width": 3.5, "height": 3.5,
         "area": 12.25, "is_exterior": True, "facing": "west", "doors": [], "windows": []},
    ]


# ══════════════════════════════════════
# 1. HEALTH & ROOT
# ══════════════════════════════════════

class TestHealthEndpoints:
    def test_root(self, client):
        r = client.get("/")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "active"
        assert "version" in data

    def test_health(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["services"]["afad_iller"] == 81
        assert data["services"]["pdf_font"] in ("DejaVu", "Helvetica")


# ══════════════════════════════════════
# 2. PARSEL
# ══════════════════════════════════════

class TestParsel:
    def test_rectangle(self, client):
        r = client.post("/api/parcel/calculate/rectangle", json={"en": 20, "boy": 30, "yon": "kuzey"})
        assert r.status_code == 200
        data = r.json()
        assert data["alan_m2"] == pytest.approx(600, rel=0.01)
        assert len(data["koordinatlar"]) >= 4  # Kapalı polygon 5 nokta döner

    def test_edges(self, client):
        r = client.post("/api/parcel/calculate/edges", json={"kenarlar": [20, 30, 20, 30]})
        assert r.status_code == 200
        data = r.json()
        assert data["alan_m2"] > 0

    def test_edges_triangle(self, client):
        r = client.post("/api/parcel/calculate/edges", json={"kenarlar": [10, 10, 10]})
        assert r.status_code == 200

    def test_invalid_edges(self, client):
        r = client.post("/api/parcel/calculate/edges", json={"kenarlar": [1]})
        assert r.status_code == 422


# ══════════════════════════════════════
# 3. İMAR
# ══════════════════════════════════════

class TestZoning:
    def test_defaults(self, client):
        r = client.get("/api/zoning/defaults")
        assert r.status_code == 200
        data = r.json()
        assert "insaat_nizamlari" in data
        assert "varsayilanlar" in data

    def test_calculate(self, client):
        r = client.post("/api/zoning/calculate", json={
            "parsel_tipi": "dikdortgen", "en": 20, "boy": 30,
            "kat_adedi": 4, "taks": 0.35, "kaks": 1.4,
            "on_bahce": 5, "yan_bahce": 3, "arka_bahce": 3,
        })
        assert r.status_code == 200
        data = r.json()
        assert "hesaplama" in data
        assert data["hesaplama"]["toplam_insaat_alani"] > 0


# ══════════════════════════════════════
# 4. PLAN
# ══════════════════════════════════════

class TestPlan:
    def test_score(self, client, sample_rooms):
        r = client.post("/api/plan/score", json={
            "rooms": sample_rooms, "buildable_width": 14, "buildable_height": 10,
        })
        assert r.status_code == 200

    def test_multi_floor(self, client):
        r = client.post("/api/plan/multi-floor", json={
            "buildable_width": 14, "buildable_height": 10,
            "kat_sayisi": 3, "normal_daire_tipi": "3+1",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["toplam_kat"] == 3
        assert data["toplam_daire"] >= 3


# ══════════════════════════════════════
# 5. FİZİBİLİTE
# ══════════════════════════════════════

class TestFeasibility:
    def test_calculate(self, client):
        r = client.post("/api/feasibility/calculate", json={
            "toplam_insaat_alani": 560, "kat_adedi": 4,
            "daire_sayisi_per_kat": 2, "il": "Ankara", "kalite": "orta",
            "m2_satis_fiyati": 45000, "arsa_maliyeti": 5000000,
            "insaat_suresi_ay": 18, "on_satis_orani": 0.3,
        })
        assert r.status_code == 200
        data = r.json()
        assert "toplam_maliyet" in data or "maliyet" in data

    def test_iller(self, client):
        r = client.get("/api/feasibility/iller")
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0

    def test_dop(self, client):
        r = client.post("/api/feasibility/dop", json={
            "brut_arsa_m2": 600, "arsa_birim_fiyat": 15000, "dop_orani": 0.35,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["sonuc"]["net_arsa_m2"] == pytest.approx(390, rel=0.01)

    def test_dop_max_limit(self, client):
        """DOP oranı %45'i aşamaz."""
        r = client.post("/api/feasibility/dop", json={
            "brut_arsa_m2": 600, "arsa_birim_fiyat": 15000, "dop_orani": 0.45,
        })
        assert r.status_code == 200

    def test_dop_with_imar_change(self, client):
        r = client.post("/api/feasibility/dop", json={
            "brut_arsa_m2": 600, "arsa_birim_fiyat": 15000,
            "dop_orani": 0.35, "imar_degisikligi": "tarim_konut",
        })
        data = r.json()
        assert data["sonuc"]["imar_artis_payi_tl"] > 0


# ══════════════════════════════════════
# 6. DEPREM
# ══════════════════════════════════════

class TestEarthquake:
    def test_analyze(self, client):
        r = client.post("/api/earthquake/analyze", json={
            "latitude": 39.93, "longitude": 32.86, "kat_sayisi": 4,
            "il_adi": "Ankara", "ss_override": 0.411, "s1_override": 0.109,
            "bina_genisligi": 14, "bina_derinligi": 10,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["parametreler"]["risk_seviyesi"] in ("Dusuk", "Orta", "Yuksek", "Cok Yuksek")
        assert data["kolon_grid"]["kolon_sayisi"] > 0

    def test_afad_iller(self, client):
        r = client.get("/api/earthquake/afad-iller")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 81

    def test_zemin_siniflari(self, client):
        r = client.get("/api/earthquake/zemin-siniflari")
        assert r.status_code == 200
        data = r.json()
        assert "ZC" in data


# ══════════════════════════════════════
# 7. ENERJİ
# ══════════════════════════════════════

class TestEnergy:
    def test_calculate(self, client):
        r = client.post("/api/energy/calculate", json={
            "toplam_alan": 560, "kat_sayisi": 4,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["enerji_sinifi"] in ("A", "B", "C", "D", "E", "F", "G")
        assert len(data.get("pencere_karsilastirma", [])) == 4
        assert len(data.get("yalitim_karsilastirma", [])) == 4

    def test_energy_options(self, client):
        r = client.get("/api/energy/options")
        assert r.status_code == 200


# ══════════════════════════════════════
# 8. EXPORT
# ══════════════════════════════════════

class TestExport:
    def test_svg(self, client, sample_rooms):
        r = client.post("/api/export/svg", json={
            "rooms": sample_rooms, "buildable_width": 14, "buildable_height": 10,
        })
        assert r.status_code == 200
        assert "svg" in r.headers.get("content-type", "")

    def test_dxf(self, client, sample_rooms):
        r = client.post("/api/export/dxf", json={
            "rooms": sample_rooms, "scale": 1.0,
        })
        assert r.status_code == 200

    def test_pdf(self, client):
        r = client.post("/api/export/pdf", json={
            "proje_adi": "Test Proje",
            "parsel_data": {"alan_m2": 600},
            "imar_data": {"kat_adedi": 4},
            "fizibilite_data": {"toplam_maliyet": 42000000, "toplam_gelir": 56000000},
        })
        assert r.status_code == 200
        assert len(r.content) > 10000  # PDF en az 10KB


# ══════════════════════════════════════
# 9. PROJE KARŞILAŞTIRMA
# ══════════════════════════════════════

class TestProjectCompare:
    def test_compare_two(self, client):
        r = client.post("/api/projects/compare", json={
            "projects": [
                {"name": "A", "data": {"feasibilityData": {"kar_marji": 0.33}}},
                {"name": "B", "data": {"feasibilityData": {"kar_marji": 0.46}}},
            ]
        })
        assert r.status_code == 200
        data = r.json()
        assert data["analiz"]["en_karli"] == "B"

    def test_compare_min_projects(self, client):
        """En az 2 proje gerekli."""
        r = client.post("/api/projects/compare", json={
            "projects": [{"name": "A", "data": {}}]
        })
        assert r.status_code == 422


# ══════════════════════════════════════
# 10. AFAD 81 İL TABLO
# ══════════════════════════════════════

class TestAFADTable:
    def test_all_81_cities(self):
        from config.afad_ss_s1 import AFAD_81_IL
        assert len(AFAD_81_IL) == 81

    def test_lookup_ankara(self):
        from config.afad_ss_s1 import get_il_parametreleri
        result = get_il_parametreleri("Ankara")
        assert result is not None
        assert result.ss > 0
        assert result.s1 > 0

    def test_lookup_case_insensitive(self):
        from config.afad_ss_s1 import get_il_parametreleri
        r1 = get_il_parametreleri("istanbul")
        r2 = get_il_parametreleri("İstanbul")
        r3 = get_il_parametreleri("ISTANBUL")
        assert r1 is not None
        assert r1.il == r2.il == r3.il

    def test_nearest_city(self):
        from config.afad_ss_s1 import get_en_yakin_il
        result = get_en_yakin_il(40.0, 29.0)
        assert result.il == "Bursa"


# ══════════════════════════════════════
# 11. DOP HESABI
# ══════════════════════════════════════

class TestDOPCalculator:
    def test_basic_dop(self):
        from analysis.dop_calculator import hesapla_dop
        result = hesapla_dop(600, 15000, dop_orani=0.35)
        assert result.net_arsa_m2 == pytest.approx(390, rel=0.01)
        assert result.dop_kesinti_m2 == pytest.approx(210, rel=0.01)
        assert result.toplam_arsa_maliyeti > 0

    def test_dop_max_cap(self):
        from analysis.dop_calculator import hesapla_dop
        result = hesapla_dop(600, 15000, dop_orani=0.50)  # %50 girsen bile %45'e kırpar
        assert result.dop_orani == 0.45

    def test_imar_artis_payi(self):
        from analysis.dop_calculator import hesapla_dop
        result = hesapla_dop(600, 15000, imar_degisikligi="tarim_konut")
        assert result.imar_artis_payi_tl > 0

    def test_dop_comparison(self):
        from analysis.dop_calculator import dop_karsilastirma
        result = dop_karsilastirma(600, 15000)
        assert len(result) == 7


# ══════════════════════════════════════
# 12. LAYOUT ENGINE
# ══════════════════════════════════════

class TestLayoutEngine:
    def test_generate(self):
        from core.layout_engine import LayoutEngine, build_room_program
        odalar = [
            {"isim": "Salon", "tip": "salon", "m2": 22},
            {"isim": "Yatak 1", "tip": "yatak_odasi", "m2": 14},
            {"isim": "Mutfak", "tip": "mutfak", "m2": 10},
        ]
        program = build_room_program(odalar, "3+1")
        engine = LayoutEngine(width=14, height=10)
        result = engine.generate(program)
        assert result.is_valid
        assert len(result.rooms) > 0

    def test_no_overlap(self):
        """Hiçbir oda çakışmamalı."""
        from core.layout_engine import LayoutEngine, build_room_program
        odalar = [
            {"isim": "Salon", "tip": "salon", "m2": 22},
            {"isim": "Yatak", "tip": "yatak_odasi", "m2": 14},
            {"isim": "Mutfak", "tip": "mutfak", "m2": 10},
            {"isim": "Banyo", "tip": "banyo", "m2": 5},
        ]
        program = build_room_program(odalar, "3+1")
        engine = LayoutEngine(width=14, height=10)
        result = engine.generate(program)
        for i, r1 in enumerate(result.rooms):
            for r2 in result.rooms[i+1:]:
                assert not r1.overlaps(r2), f"{r1.request.name} ve {r2.request.name} çakışıyor!"


# ══════════════════════════════════════
# 13. RENDER STYLES
# ══════════════════════════════════════

class TestRenderStyles:
    def test_styles(self, client):
        r = client.get("/api/render/styles")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 4  # En az 4 stil


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
