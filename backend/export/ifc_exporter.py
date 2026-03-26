"""
IFC Export — IFC4 formatında bina modeli oluşturur (LOD 300).

IfcOpenShell kullanarak BIM elemanlarını IFC-SPF dosyasına yazar:
- IfcWallStandardCase (duvarlar — malzeme + özellik seti)
- IfcSlab (döşemeler — malzeme + yangın dayanımı)
- IfcWindow (pencereler — boyut, cam tipi, U-değeri)
- IfcDoor (kapılar — iç/dış ayrımı, boyut)
- IfcColumn (kolonlar — kolon grid'den, malzeme: betonarme)
- IfcStairFlight (merdiven — basamak sayısı, genişlik)
- IfcSpace (hacim tanımları — alan, yükseklik, fonksiyon)
- IfcMaterial (her elemana malzeme atanır)
- IfcPropertySet (yangın dayanımı, ses yalıtımı, U-değeri)

IFC4 standardı — buildingSMART uluslararası BIM veri değişim formatı.
"""

import os
import uuid
import time
import math
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def _guid():
    """IFC GlobalId üretir (22 karakter base64)."""
    return str(uuid.uuid4().hex[:22])


# ── Malzeme Tanımları ──
MALZEME_TANIMLARI = {
    "beton_c30": {"isim": "Beton C30/37", "yogunluk": 2400},
    "tugla": {"isim": "Tuğla Duvar", "yogunluk": 1800},
    "cam_low_e": {"isim": "Low-E Cam", "yogunluk": 2500},
    "ahsap_kayin": {"isim": "Kayın Ahşap", "yogunluk": 700},
    "celik_s420": {"isim": "Çelik S420", "yogunluk": 7850},
}

# ── Özellik Setleri ──
ELEMAN_OZELLIKLERI = {
    "dis_duvar": {
        "Pset_WallCommon": {
            "IsExternal": True, "ThermalTransmittance": 0.28,
            "FireRating": "REI120", "AcousticRating": 52,
        },
    },
    "ic_duvar": {
        "Pset_WallCommon": {
            "IsExternal": False, "ThermalTransmittance": 1.8,
            "FireRating": "REI60", "AcousticRating": 42,
        },
    },
    "pencere": {
        "Pset_WindowCommon": {
            "IsExternal": True, "ThermalTransmittance": 1.4,
            "GlazingAreaFraction": 0.85, "SolarHeatGainCoefficient": 0.32,
            "AcousticRating": 35, "FireRating": "E30",
        },
    },
    "kapi_dis": {
        "Pset_DoorCommon": {
            "IsExternal": True, "ThermalTransmittance": 1.8,
            "FireRating": "EI30", "AcousticRating": 38, "SecurityRating": "RC3",
        },
    },
    "kapi_ic": {
        "Pset_DoorCommon": {
            "IsExternal": False, "ThermalTransmittance": 3.5,
            "FireRating": "EI15", "AcousticRating": 28,
        },
    },
    "kolon": {
        "Pset_ColumnCommon": {
            "IsExternal": False, "FireRating": "R120", "LoadBearing": True,
        },
    },
    "doseme": {
        "Pset_SlabCommon": {
            "IsExternal": False, "FireRating": "REI120",
            "AcousticRating": 53, "LoadBearing": True,
        },
    },
    "merdiven": {
        "Pset_StairCommon": {
            "IsExternal": False, "FireRating": "R90",
            "HandrailHeight": 0.90, "RequiredHeadroom": 2.10,
        },
    },
}

# ── Oda tipi → pencere/kapı boyutları ──
ODA_PENCERE_BOYUTLARI = {
    "salon": {"genislik": 1.6, "yukseklik": 1.5, "denizlik": 0.9},
    "yatak_odasi": {"genislik": 1.4, "yukseklik": 1.4, "denizlik": 0.9},
    "mutfak": {"genislik": 1.2, "yukseklik": 1.2, "denizlik": 1.0},
    "banyo": {"genislik": 0.6, "yukseklik": 0.6, "denizlik": 1.6},
    "wc": {"genislik": 0.5, "yukseklik": 0.5, "denizlik": 1.6},
    "antre": {"genislik": 0.0, "yukseklik": 0.0, "denizlik": 0.0},
    "koridor": {"genislik": 0.0, "yukseklik": 0.0, "denizlik": 0.0},
    "balkon": {"genislik": 2.0, "yukseklik": 2.2, "denizlik": 0.0},
}

ODA_KAPI_BOYUTLARI = {
    "salon": {"genislik": 0.90, "yukseklik": 2.10},
    "yatak_odasi": {"genislik": 0.80, "yukseklik": 2.10},
    "mutfak": {"genislik": 0.80, "yukseklik": 2.10},
    "banyo": {"genislik": 0.70, "yukseklik": 2.00},
    "wc": {"genislik": 0.70, "yukseklik": 2.00},
    "antre": {"genislik": 1.00, "yukseklik": 2.10},
    "koridor": {"genislik": 0.90, "yukseklik": 2.10},
    "balkon": {"genislik": 0.90, "yukseklik": 2.20},
}


def _translation_matrix(x: float, y: float, z: float):
    """4x4 translation matrix üretir."""
    import numpy as np
    m = np.eye(4)
    m[0][3] = x
    m[1][3] = y
    m[2][3] = z
    return m


def _add_property_set(ifc, element, pset_dict: dict):
    """Elemana IfcPropertySet ekler."""
    import ifcopenshell.api
    for pset_name, properties in pset_dict.items():
        try:
            pset = ifcopenshell.api.run("pset.add_pset", ifc, product=element, name=pset_name)
            ifcopenshell.api.run("pset.edit_pset", ifc, pset=pset, properties=properties)
        except Exception as e:
            logger.debug(f"PropertySet eklenemedi ({pset_name}): {e}")


def _is_exterior_wall(wx, wy, wlen, wthick, is_side, bw, bh, dk) -> bool:
    """Duvarın dış cephede olup olmadığını kontrol eder."""
    tol = dk * 2
    if not is_side:
        if wy < tol or wy > bh - tol:
            return True
    else:
        if wx < tol or wx > bw - tol:
            return True
    return False


def _oda_tipi_ingilizce(tip: str) -> str:
    """Oda tipini IFC standardı İngilizce'ye çevir."""
    return {
        "salon": "LIVINGROOM", "yatak_odasi": "BEDROOM",
        "mutfak": "KITCHEN", "banyo": "BATHROOM", "wc": "RESTROOM",
        "antre": "ENTRY", "koridor": "CORRIDOR", "balkon": "BALCONY",
        "merdiven": "STAIRWAY",
    }.get(tip, "USERDEFINED")


def _auto_kolon_grid(bw: float, bh: float, kat_sayisi: int) -> dict:
    """Otomatik kolon grid oluştur."""
    if kat_sayisi <= 4:
        grid_x, grid_y = 4.5, 5.0
        kolon_en, kolon_boy = 0.30, 0.50
    elif kat_sayisi <= 8:
        grid_x, grid_y = 4.0, 4.5
        kolon_en, kolon_boy = 0.35, 0.60
    else:
        grid_x, grid_y = 3.5, 4.0
        kolon_en, kolon_boy = 0.40, 0.70

    n_x = max(2, math.ceil(bw / grid_x) + 1)
    n_y = max(2, math.ceil(bh / grid_y) + 1)
    actual_x = bw / (n_x - 1) if n_x > 1 else bw
    actual_y = bh / (n_y - 1) if n_y > 1 else bh

    return {
        "x_akslar": [round(i * actual_x, 3) for i in range(n_x)],
        "y_akslar": [round(i * actual_y, 3) for i in range(n_y)],
        "kolon_boyut": (kolon_en, kolon_boy),
    }


def export_ifc(
    rooms: list[dict],
    buildable_width: float = 14.0,
    buildable_height: float = 10.0,
    kat_sayisi: int = 4,
    kat_yuksekligi: float = 3.0,
    duvar_kalinligi: float = 0.2,
    proje_adi: str = "imarPRO Projesi",
    output_path: str = "",
    kolon_grid: dict | None = None,
    merdiven_pozisyon: dict | None = None,
) -> str:
    """Oda planından IFC4 dosyası üretir (LOD 300).

    Args:
        rooms: Oda listesi [{"name","type","x","y","width","height","is_exterior"}, ...]
        buildable_width: Yapılaşma alanı genişliği (m)
        buildable_height: Yapılaşma alanı derinliği (m)
        kat_sayisi: Kat adedi
        kat_yuksekligi: Kat yüksekliği (m)
        duvar_kalinligi: Duvar kalınlığı (m)
        proje_adi: IFC proje adı
        output_path: Çıktı dosya yolu
        kolon_grid: {"x_akslar": [...], "y_akslar": [...], "kolon_boyut": (en, boy)}
        merdiven_pozisyon: {"x": float, "y": float, "genislik": float, "derinlik": float}

    Returns:
        IFC dosya yolu.
    """
    try:
        import ifcopenshell
        import ifcopenshell.api
    except ImportError:
        logger.error("ifcopenshell yüklü değil")
        raise ImportError("IFC export için ifcopenshell gerekli")

    t_start = time.time()

    # ── IFC dosya oluştur ──
    ifc = ifcopenshell.api.run("project.create_file", version="IFC4")
    project = ifcopenshell.api.run("root.create_entity", ifc, ifc_class="IfcProject", name=proje_adi)
    ifcopenshell.api.run("unit.assign_unit", ifc, length={"is_metric": True, "raw": "METRES"})

    ctx = ifcopenshell.api.run("context.add_context", ifc, context_type="Model")
    body = ifcopenshell.api.run(
        "context.add_context", ifc, context_type="Model",
        context_identifier="Body", target_view="MODEL_VIEW", parent=ctx,
    )

    site = ifcopenshell.api.run("root.create_entity", ifc, ifc_class="IfcSite", name="Arsa")
    ifcopenshell.api.run("aggregate.assign_object", ifc, relating_object=project, products=[site])

    building = ifcopenshell.api.run("root.create_entity", ifc, ifc_class="IfcBuilding", name=proje_adi)
    ifcopenshell.api.run("aggregate.assign_object", ifc, relating_object=site, products=[building])

    # ── Malzemeleri oluştur ──
    malzemeler = {}
    for key, mal_info in MALZEME_TANIMLARI.items():
        malzemeler[key] = ifcopenshell.api.run("material.add_material", ifc, name=mal_info["isim"])

    # ── Kolon grid ──
    if kolon_grid is None:
        kolon_grid = _auto_kolon_grid(buildable_width, buildable_height, kat_sayisi)

    # ── Merdiven pozisyonu ──
    if merdiven_pozisyon is None:
        merdiven_pozisyon = {
            "x": buildable_width / 2 - 1.2, "y": buildable_height / 2 - 1.5,
            "genislik": 2.4, "derinlik": 3.0,
        }

    sayac = {"IfcWall": 0, "IfcSlab": 0, "IfcWindow": 0, "IfcDoor": 0,
             "IfcColumn": 0, "IfcStairFlight": 0, "IfcSpace": 0}

    # ══════════════════════════════════════
    # HER KAT İÇİN
    # ══════════════════════════════════════
    for kat_no in range(1, kat_sayisi + 1):
        z_offset = (kat_no - 1) * kat_yuksekligi

        storey = ifcopenshell.api.run(
            "root.create_entity", ifc, ifc_class="IfcBuildingStorey", name=f"{kat_no}. Kat",
        )
        ifcopenshell.api.run("aggregate.assign_object", ifc, relating_object=building, products=[storey])
        ifcopenshell.api.run(
            "geometry.edit_object_placement", ifc, product=storey,
            matrix=_translation_matrix(0, 0, z_offset),
        )

        elements = []

        # ── 1. DÖŞEME ──
        slab = ifcopenshell.api.run("root.create_entity", ifc, ifc_class="IfcSlab", name=f"Döşeme K{kat_no}")
        slab_repr = ifcopenshell.api.run(
            "geometry.add_wall_representation", ifc, context=body,
            length=buildable_width, height=buildable_height, thickness=0.25,
        )
        ifcopenshell.api.run("geometry.assign_representation", ifc, product=slab, representation=slab_repr)
        ifcopenshell.api.run(
            "geometry.edit_object_placement", ifc, product=slab,
            matrix=_translation_matrix(0, 0, z_offset),
        )
        ifcopenshell.api.run("material.assign_material", ifc, products=[slab], material=malzemeler["beton_c30"])
        _add_property_set(ifc, slab, ELEMAN_OZELLIKLERI["doseme"])
        elements.append(slab)
        sayac["IfcSlab"] += 1

        # ── 2. ODALAR ──
        for room in rooms:
            rx, ry = room.get("x", 0), room.get("y", 0)
            rw, rh = room.get("width", 4), room.get("height", 3)
            rname = room.get("name", "Oda")
            rtype = room.get("type", "salon")
            is_exterior = room.get("is_exterior", False)

            # ── IfcSpace ──
            space = ifcopenshell.api.run(
                "root.create_entity", ifc, ifc_class="IfcSpace", name=f"{rname} K{kat_no}",
            )
            sp_repr = ifcopenshell.api.run(
                "geometry.add_wall_representation", ifc, context=body,
                length=rw, height=rh, thickness=kat_yuksekligi - 0.25,
            )
            ifcopenshell.api.run("geometry.assign_representation", ifc, product=space, representation=sp_repr)
            ifcopenshell.api.run(
                "geometry.edit_object_placement", ifc, product=space,
                matrix=_translation_matrix(rx, ry, z_offset + 0.25),
            )
            _add_property_set(ifc, space, {
                "Pset_SpaceCommon": {
                    "Reference": rtype,
                    "IsExternal": is_exterior,
                    "GrossPlannedArea": round(rw * rh, 2),
                    "NetPlannedArea": round(max(0, (rw - 0.4) * (rh - 0.4)), 2),
                    "Category": _oda_tipi_ingilizce(rtype),
                },
            })
            elements.append(space)
            sayac["IfcSpace"] += 1

            # ── Duvarlar ──
            dk = duvar_kalinligi
            walls_def = [
                (f"{rname} Güney", rx, ry, rw, dk, False),
                (f"{rname} Kuzey", rx, ry + rh - dk, rw, dk, False),
                (f"{rname} Batı", rx, ry, dk, rh, True),
                (f"{rname} Doğu", rx + rw - dk, ry, dk, rh, True),
            ]

            for wname, wx, wy, wlen, wthick, is_side in walls_def:
                wall = ifcopenshell.api.run("root.create_entity", ifc, ifc_class="IfcWall", name=wname)
                w_repr = ifcopenshell.api.run(
                    "geometry.add_wall_representation", ifc, context=body,
                    length=wlen, height=kat_yuksekligi, thickness=wthick,
                )
                ifcopenshell.api.run("geometry.assign_representation", ifc, product=wall, representation=w_repr)
                ifcopenshell.api.run(
                    "geometry.edit_object_placement", ifc, product=wall,
                    matrix=_translation_matrix(wx, wy, z_offset),
                )

                duvar_dismi = _is_exterior_wall(wx, wy, wlen, wthick, is_side,
                                                buildable_width, buildable_height, dk)
                prop_key = "dis_duvar" if duvar_dismi else "ic_duvar"
                ifcopenshell.api.run("material.assign_material", ifc, products=[wall], material=malzemeler["tugla"])
                _add_property_set(ifc, wall, ELEMAN_OZELLIKLERI[prop_key])
                elements.append(wall)
                sayac["IfcWall"] += 1

            # ── Pencere ──
            p_info = ODA_PENCERE_BOYUTLARI.get(rtype, {})
            p_gen = p_info.get("genislik", 0)
            p_yuk = p_info.get("yukseklik", 0)
            p_den = p_info.get("denizlik", 0.9)

            if p_gen > 0 and p_yuk > 0 and is_exterior:
                win = ifcopenshell.api.run(
                    "root.create_entity", ifc, ifc_class="IfcWindow", name=f"{rname} Pencere K{kat_no}",
                )
                win_repr = ifcopenshell.api.run(
                    "geometry.add_wall_representation", ifc, context=body,
                    length=p_gen, height=p_yuk, thickness=dk,
                )
                ifcopenshell.api.run("geometry.assign_representation", ifc, product=win, representation=win_repr)
                ifcopenshell.api.run(
                    "geometry.edit_object_placement", ifc, product=win,
                    matrix=_translation_matrix(rx + rw / 2 - p_gen / 2, ry, z_offset + p_den),
                )
                ifcopenshell.api.run("material.assign_material", ifc, products=[win], material=malzemeler["cam_low_e"])
                _add_property_set(ifc, win, ELEMAN_OZELLIKLERI["pencere"])
                elements.append(win)
                sayac["IfcWindow"] += 1

            # ── Kapı ──
            if rtype not in ("merdiven", "balkon"):
                k_info = ODA_KAPI_BOYUTLARI.get(rtype, {"genislik": 0.80, "yukseklik": 2.10})
                kapi_dismi = (rtype == "antre") and (kat_no == 1)
                prop_key = "kapi_dis" if kapi_dismi else "kapi_ic"
                kapi_malzeme = "celik_s420" if kapi_dismi else "ahsap_kayin"

                door = ifcopenshell.api.run(
                    "root.create_entity", ifc, ifc_class="IfcDoor", name=f"{rname} Kapı K{kat_no}",
                )
                d_repr = ifcopenshell.api.run(
                    "geometry.add_wall_representation", ifc, context=body,
                    length=k_info["genislik"], height=k_info["yukseklik"], thickness=dk,
                )
                ifcopenshell.api.run("geometry.assign_representation", ifc, product=door, representation=d_repr)
                ifcopenshell.api.run(
                    "geometry.edit_object_placement", ifc, product=door,
                    matrix=_translation_matrix(rx + 0.3, ry, z_offset),
                )
                ifcopenshell.api.run("material.assign_material", ifc, products=[door], material=malzemeler[kapi_malzeme])
                _add_property_set(ifc, door, ELEMAN_OZELLIKLERI[prop_key])
                elements.append(door)
                sayac["IfcDoor"] += 1

        # ── 3. KOLONLAR ──
        x_akslar = kolon_grid.get("x_akslar", [])
        y_akslar = kolon_grid.get("y_akslar", [])
        kolon_en, kolon_boy = kolon_grid.get("kolon_boyut", (0.30, 0.50))

        for ix, kx in enumerate(x_akslar):
            for iy, ky in enumerate(y_akslar):
                col = ifcopenshell.api.run(
                    "root.create_entity", ifc, ifc_class="IfcColumn",
                    name=f"Kolon {chr(65 + ix)}{iy + 1} K{kat_no}",
                )
                c_repr = ifcopenshell.api.run(
                    "geometry.add_wall_representation", ifc, context=body,
                    length=kolon_en, height=kolon_boy, thickness=kat_yuksekligi,
                )
                ifcopenshell.api.run("geometry.assign_representation", ifc, product=col, representation=c_repr)
                ifcopenshell.api.run(
                    "geometry.edit_object_placement", ifc, product=col,
                    matrix=_translation_matrix(kx - kolon_en / 2, ky - kolon_boy / 2, z_offset),
                )
                ifcopenshell.api.run("material.assign_material", ifc, products=[col], material=malzemeler["beton_c30"])
                _add_property_set(ifc, col, ELEMAN_OZELLIKLERI["kolon"])
                elements.append(col)
                sayac["IfcColumn"] += 1

        # ── 4. MERDİVEN ──
        m_x = merdiven_pozisyon["x"]
        m_y = merdiven_pozisyon["y"]
        m_gen = merdiven_pozisyon["genislik"]
        m_der = merdiven_pozisyon["derinlik"]
        basamak_sayisi = max(1, int(kat_yuksekligi / 0.175))

        stair = ifcopenshell.api.run(
            "root.create_entity", ifc, ifc_class="IfcStairFlight", name=f"Merdiven K{kat_no}",
        )
        st_repr = ifcopenshell.api.run(
            "geometry.add_wall_representation", ifc, context=body,
            length=m_gen, height=m_der, thickness=kat_yuksekligi,
        )
        ifcopenshell.api.run("geometry.assign_representation", ifc, product=stair, representation=st_repr)
        ifcopenshell.api.run(
            "geometry.edit_object_placement", ifc, product=stair,
            matrix=_translation_matrix(m_x, m_y, z_offset),
        )
        ifcopenshell.api.run("material.assign_material", ifc, products=[stair], material=malzemeler["beton_c30"])
        _add_property_set(ifc, stair, ELEMAN_OZELLIKLERI["merdiven"])
        _add_property_set(ifc, stair, {
            "Pset_StairFlightCommon": {
                "NumberOfRisers": basamak_sayisi,
                "NumberOfTreads": basamak_sayisi - 1,
                "RiserHeight": round(kat_yuksekligi / basamak_sayisi, 3),
                "TreadLength": round(m_der / max(1, basamak_sayisi), 3),
            },
        })
        elements.append(stair)
        sayac["IfcStairFlight"] += 1

        # ── Kata ata ──
        if elements:
            ifcopenshell.api.run("spatial.assign_container", ifc, relating_structure=storey, products=elements)

    # ── Kaydet ──
    if not output_path:
        os.makedirs("/tmp/imar-pro-exports", exist_ok=True)
        output_path = os.path.join("/tmp/imar-pro-exports", f"imarpro_{uuid.uuid4().hex[:8]}.ifc")

    ifc.write(output_path)
    file_size = os.path.getsize(output_path)
    elapsed = time.time() - t_start

    logger.info(
        f"IFC kaydedildi: {output_path} ({file_size / 1024:.1f}KB, {elapsed:.2f}s) — "
        f"LOD 300 — {sum(sayac.values())} eleman"
    )
    return output_path


def get_ifc_summary(rooms: list[dict], kat_sayisi: int = 4,
                     kolon_grid: dict | None = None,
                     buildable_width: float = 14.0,
                     buildable_height: float = 10.0) -> dict:
    """IFC dosyasının içerik özetini döndürür (export etmeden)."""
    if kolon_grid is None:
        kolon_grid = _auto_kolon_grid(buildable_width, buildable_height, kat_sayisi)

    wall_count = len(rooms) * 4 * kat_sayisi
    slab_count = kat_sayisi
    storey_count = kat_sayisi

    exterior_rooms = [r for r in rooms if r.get("is_exterior", False)]
    window_capable = [r for r in exterior_rooms
                      if ODA_PENCERE_BOYUTLARI.get(r.get("type", ""), {}).get("genislik", 0) > 0]
    window_count = len(window_capable) * kat_sayisi

    door_capable = [r for r in rooms if r.get("type", "") not in ("merdiven", "balkon")]
    door_count = len(door_capable) * kat_sayisi

    n_kx = len(kolon_grid.get("x_akslar", []))
    n_ky = len(kolon_grid.get("y_akslar", []))
    column_count = n_kx * n_ky * kat_sayisi
    space_count = len(rooms) * kat_sayisi
    stair_count = kat_sayisi

    entities = {
        "IfcProject": 1, "IfcSite": 1, "IfcBuilding": 1,
        "IfcBuildingStorey": storey_count,
        "IfcWall": wall_count, "IfcSlab": slab_count,
        "IfcWindow": window_count, "IfcDoor": door_count,
        "IfcColumn": column_count, "IfcStairFlight": stair_count,
        "IfcSpace": space_count,
    }

    return {
        "format": "IFC4 (ISO 16739-1:2018)",
        "schema": "IFC4",
        "entities": entities,
        "total_entities": sum(entities.values()),
        "materials": len(MALZEME_TANIMLARI),
        "property_sets": len(ELEMAN_OZELLIKLERI),
        "bim_level": "LOD 300",
        "kolon_grid": {
            "x_aks_sayisi": n_kx, "y_aks_sayisi": n_ky,
            "kolon_boyut": list(kolon_grid.get("kolon_boyut", (0.30, 0.50))),
        },
        "desteklenen_viewer": [
            "BIMvision (ücretsiz)", "Solibri Anywhere", "xBIM Xplorer",
            "IFC.js web viewer", "Autodesk Viewer", "Navisworks", "Tekla BIMsight",
        ],
    }
