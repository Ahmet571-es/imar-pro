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


# ══════════════════════════════════════
# 14. BIM — IFC, CLASH, MEP
# ══════════════════════════════════════

class TestBIM:
    @pytest.fixture
    def bim_rooms(self):
        return [
            {"name": "Salon", "type": "salon", "x": 0, "y": 0, "width": 5.5, "height": 4.2},
            {"name": "Yatak", "type": "yatak_odasi", "x": 5.7, "y": 0, "width": 3.8, "height": 3.5},
            {"name": "Mutfak", "type": "mutfak", "x": 0, "y": 4.4, "width": 3.0, "height": 2.8},
            {"name": "Banyo", "type": "banyo", "x": 3.2, "y": 4.4, "width": 2.3, "height": 2.8},
        ]

    def test_clash_detection(self, client, bim_rooms):
        r = client.post("/api/bim/clash-detection", json={"rooms": bim_rooms})
        assert r.status_code == 200
        data = r.json()
        assert "toplam_kontrol" in data
        assert "cakismalar" in data
        assert data["toplam_kontrol"] > 0

    def test_mep_schematic(self, client, bim_rooms):
        r = client.post("/api/bim/mep-schematic", json={
            "rooms": bim_rooms, "buildable_width": 14, "buildable_height": 10,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["toplam_node"] > 0
        assert data["toplam_hat"] > 0
        assert data["toplam_fitting"] > 0  # Dirsek/T-bağlantı
        assert "disciplines" in data
        assert "elektrik" in data["disciplines"]
        assert "temiz_su" in data["disciplines"]
        assert "pis_su" in data["disciplines"]
        assert "yangin" in data["disciplines"]
        assert "yuk_dengesi" in data
        assert data["yuk_dengesi"]["toplam_guc_w"] > 0

    def test_ifc_summary(self, client, bim_rooms):
        r = client.post("/api/bim/ifc-summary", json={"rooms": bim_rooms, "kat_sayisi": 4})
        assert r.status_code == 200
        data = r.json()
        assert data["schema"] == "IFC4"
        assert data["bim_level"] == "LOD 300"
        assert data["entities"]["IfcWall"] == 64  # 4 rooms × 4 walls × 4 floors
        assert data["entities"]["IfcBuildingStorey"] == 4
        assert data["entities"]["IfcStairFlight"] == 4  # Her katta merdiven
        assert data["entities"]["IfcSpace"] == 16  # 4 rooms × 4 floors
        assert "IfcColumn" in data["entities"]
        assert "IfcDoor" in data["entities"]
        assert data["materials"] > 0
        assert data["property_sets"] > 0
        assert "kolon_grid" in data

    def test_disciplines(self, client):
        r = client.get("/api/bim/disciplines")
        assert r.status_code == 200
        data = r.json()
        assert len(data["disciplines"]) == 6  # mimari, strüktür, elektrik, mekanik, havalandırma, yangın
        assert data["bim_level"] == "LOD 300"

    def test_bim_summary(self, client, bim_rooms):
        r = client.post("/api/bim/summary", json={
            "rooms": bim_rooms, "buildable_width": 14, "buildable_height": 10, "kat_sayisi": 4,
        })
        assert r.status_code == 200
        data = r.json()
        assert "ifc" in data
        assert "clash_detection" in data
        assert "mep" in data
        assert data["bim_level"] == "LOD 300"

    def test_clash_min_area(self):
        """Minimum oda alanı kontrolü."""
        from analysis.clash_detection import detect_clashes
        rooms = [{"name": "Mini Banyo", "type": "banyo", "x": 0, "y": 0, "width": 1.5, "height": 1.5}]
        report = detect_clashes(rooms)
        # 1.5×1.5 = 2.25m² < 3.5m² minimum
        assert any(c.severity == "warning" for c in report.clashes)

    def test_mep_cost(self):
        """MEP maliyet tahmini sıfırdan büyük olmalı."""
        from analysis.mep_schematic import generate_mep_schematic
        rooms = [
            {"name": "Salon", "type": "salon", "x": 0, "y": 0, "width": 5, "height": 4},
            {"name": "Banyo", "type": "banyo", "x": 5.2, "y": 0, "width": 2.5, "height": 2.5},
        ]
        mep = generate_mep_schematic(rooms)
        data = mep.to_dict()
        assert data["maliyet_tahmini"]["toplam_tl"] > 0

    def test_ifc_lod300_entities(self):
        """LOD 300: pencere, kapı, kolon, merdiven, space olmalı."""
        from export.ifc_exporter import get_ifc_summary
        rooms = [
            {"name": "Salon", "type": "salon", "x": 0, "y": 0, "width": 5, "height": 4, "is_exterior": True},
            {"name": "Banyo", "type": "banyo", "x": 5.2, "y": 0, "width": 2.5, "height": 2.5, "is_exterior": True},
        ]
        data = get_ifc_summary(rooms, kat_sayisi=3)
        assert data["bim_level"] == "LOD 300"
        assert data["entities"]["IfcWindow"] > 0
        assert data["entities"]["IfcDoor"] > 0
        assert data["entities"]["IfcColumn"] > 0
        assert data["entities"]["IfcStairFlight"] == 3
        assert data["entities"]["IfcSpace"] == 6  # 2 rooms × 3 floors

    def test_clash_3d_volume(self):
        """3D çakışma hacim kontrolü."""
        from analysis.clash_detection import detect_clashes
        rooms = [
            {"name": "Salon", "type": "salon", "x": 0, "y": 0, "width": 5, "height": 4},
        ]
        # Kolon odanın tam ortasında
        kolonlar = [{"name": "K1", "x": 2.3, "y": 1.8, "width": 0.4, "height": 0.4}]
        report = detect_clashes(rooms, kolonlar=kolonlar, kat_yuksekligi=3.0)
        assert report.total_checks > 0

    def test_clash_severity_groups(self):
        """Çakışma raporunda severity grupları olmalı."""
        from analysis.clash_detection import detect_clashes
        rooms = [
            {"name": "Mini WC", "type": "wc", "x": 0, "y": 0, "width": 0.8, "height": 0.8},
        ]
        report = detect_clashes(rooms)
        data = report.to_dict()
        assert "ozet" in data
        assert "severity_gruplu" in data
        assert "hard_clash" in data["ozet"]

    def test_mep_fittings(self):
        """MEP dirsek ve T-bağlantıları üretilmeli."""
        from analysis.mep_schematic import generate_mep_schematic
        rooms = [
            {"name": "Salon", "type": "salon", "x": 0, "y": 0, "width": 5, "height": 4},
            {"name": "Banyo", "type": "banyo", "x": 5.2, "y": 0, "width": 2.5, "height": 2.5},
            {"name": "Mutfak", "type": "mutfak", "x": 0, "y": 4.2, "width": 3, "height": 2.5},
        ]
        mep = generate_mep_schematic(rooms)
        assert len(mep.fittings) > 0
        fitting_types = {f.fitting_type for f in mep.fittings}
        assert "elbow_90" in fitting_types or "tee" in fitting_types

    def test_mep_pis_su_ayri(self):
        """Temiz su ve pis su ayrı disiplinler olmalı."""
        from analysis.mep_schematic import generate_mep_schematic
        rooms = [
            {"name": "Banyo", "type": "banyo", "x": 0, "y": 0, "width": 2.5, "height": 2.5},
            {"name": "WC", "type": "wc", "x": 2.7, "y": 0, "width": 1.5, "height": 1.5},
        ]
        mep = generate_mep_schematic(rooms)
        data = mep.to_dict()
        assert "temiz_su" in data["disciplines"]
        assert "pis_su" in data["disciplines"]

    def test_mep_yangin(self):
        """Yangın tesisatı — dolap ve sprinkler olmalı."""
        from analysis.mep_schematic import generate_mep_schematic
        rooms = [
            {"name": "Salon", "type": "salon", "x": 0, "y": 0, "width": 5, "height": 4},
            {"name": "Banyo", "type": "banyo", "x": 5.2, "y": 0, "width": 2.5, "height": 2.5},
        ]
        mep = generate_mep_schematic(rooms)
        data = mep.to_dict()
        assert "yangin" in data["disciplines"]
        yangin_nodes = data["disciplines"]["yangin"]["nodes"]
        node_types = {n["node_type"] for n in yangin_nodes}
        assert "yangin_dolabi" in node_types
        assert "sprinkler" in node_types

    def test_mep_yuk_dengesi(self):
        """Elektrik yük dengesi hesaplanmalı."""
        from analysis.mep_schematic import generate_mep_schematic
        rooms = [
            {"name": "Salon", "type": "salon", "x": 0, "y": 0, "width": 5, "height": 4},
            {"name": "Mutfak", "type": "mutfak", "x": 5.2, "y": 0, "width": 3, "height": 2.5},
            {"name": "Yatak", "type": "yatak_odasi", "x": 0, "y": 4.2, "width": 4, "height": 3},
        ]
        mep = generate_mep_schematic(rooms)
        yd = mep.yuk_dengesi
        assert yd["toplam_guc_w"] > 0
        assert yd["ana_sigorta_a"] >= 16
        assert "faz_yukleri_w" in yd
        assert len(yd["faz_yukleri_w"]) == 3

    def test_clash_yangin_mesafe(self):
        """Yangın kaçış mesafesi kontrolü."""
        from analysis.clash_detection import detect_clashes
        # Merdiven bir köşede, oda çok uzakta (>30m)
        rooms = [
            {"name": "Merdiven", "type": "merdiven", "x": 0, "y": 0, "width": 2.5, "height": 3},
            {"name": "Uzak Oda", "type": "salon", "x": 35, "y": 35, "width": 5, "height": 4},
        ]
        report = detect_clashes(rooms)
        # Uzak oda merdivenden >30m olmalı → critical clash
        yangin = [c for c in report.clashes if "Yangın" in c.element_b or "merdiven" in c.description.lower()]
        assert len(yangin) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
