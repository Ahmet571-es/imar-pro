# imarPRO — Seviye 5 Geliştirme Prompt'u

Aşağıdaki prompt'u yeni sohbete yapıştır. Yanına REBUILD_SPEC.md dokümanını da ekle.

---

## PROMPT BAŞLANGIÇ

Ben imarPRO projesini geliştiriyorum. Gayrimenkul fizibilite + AI kat planı üretim SaaS platformu.

**Repo:** https://github.com/Ahmet571-es/imar-pro  
**GitHub Token:** (settings'ten veya önceki sohbetten al)

---

### TAMAMLANAN SEVİYELER (Hepsi Profesyonel BIM Seviyesinde)

**Seviye 1 (9/10) — Temel Altyapı:**
- projectStore: 16 alan + serialize/restore + auto-save 3sn debounce
- Toast: 4 tip (success/error/info/warning), stack yapısı
- ErrorBoundary: React crash + toast API hataları
- API key: Settings dialog + **bağlantı test butonları** (gerçek HTTP call)
- StepNavigation: **progress bar + tamamlanma %**
- ParcelSVG: **ölçek çubuğu, köşe açıları, vertex numaraları, koordinat tooltip, tıklanabilir kenarlar, K/G/D/B pusula**

**Seviye 2 (9/10) — AI Plan Motoru:**
- `core/layout_engine.py` (903 satır): 5 strateji, constraint-based, %100 çakışmasız
- `ai/program_bridge.py` (352 satır): AI→engine köprüsü, hibrit plan
- `ai/dual_ai_engine.py`: 5 katmanlı mimari (AI + Engine + PostProcess + CrossReview + Hybrid)
- `FloorPlanSVG.tsx` (520 satır): Çift çizgi duvar, ANSI31 tarama, aks grid, dimension line, kapı yayı, mobilya placeholder
- `PlanRadarChart.tsx` (167 satır): 9 boyutlu radar + **karşılaştırma tablosu**
- NLP parser: 20+ Türkçe keyword
- 5 genuinely farklı alternatif (Claude 2 + Grok 2 + Hybrid)

**Seviye 3 (9.5/10) — 3D/4D/5D BIM (14 dosya, 5,119 satır):**
- BuildingGeometry (911 satır): Duvar (ExtrudeGeometry + boşluk), Pencere (denizlik + lento + kayıt), Kapı (kasa + eşik + panel + 90° yay), Merdiven (U-dönüşlü TBDY), Balkon korkuluk (TS-EN 13374), Kolon (başlık + taban), Kiriş, Çatı (parapet kapağı + membran / mahya), Temel (radye + sürekli bant), Giriş basamak (nosing)
- PBRMaterials: sıva noise, seramik karo, ahşap grain, beton, cam (transmission+ior)
- Environment3D: 2 ağaç tipi, çalı, yol (asfalt + bordür + kaldırım + yaya geçidi), parsel sınır direkleri, sokak lambası, park bankı, 3D pusula, 3 araba
- CameraSystem: 6 preset + lerp animasyon + fly-to
- PostProcessing: SSAO + bloom + vignette + SMAA
- RoomInteraction: hover emissive + tooltip, click panel, fly-to, ölçüm modu
- FurniturePlaceholders: yatak, koltuk, tezgah, lavabo, klozet, masa (6 oda tipi)
- Annotations3D: oda etiketleri, boyut ölçü çizgileri, kat seviye işaretleri, aks grid, bina toplam ölçüler
- BOQPanel: 30+ kalem metraj, poz numaralı, CSV export
- WhatIfPanel: yalıtım/pencere/duvar → maliyet + enerji delta
- ExportTools: Screenshot PNG 2×/4×, GLTF/GLB
- 6 görünüm modu: solid/xray/wireframe/section/exploded/thermal
- 4D: inşaat timeline (1-18 ay) + play/pause + faz renk + kümülatif maliyet sync
- 5D: maliyet ısı haritası + eleman tıklama tooltip + sayaç
- Render: batch + 4 stil karşılaştırma + 4 yön dış cephe
- Code splitting: Three.js lazy loaded (3 chunk)

**Seviye 4 (9/10) — Fizibilite + PDF (5 dosya, 1,558 satır frontend + 694 satır backend):**
- PDF rapor (694 satır ReportLab+matplotlib): 15-20 sayfa, kapak, içindekiler, 4 grafik embed (nakit akışı, duyarlılık ısı haritası, Monte Carlo histogram, tornado), maliyet/gelir tabloları, deprem, enerji, AI yorum, yasal uyarı, Türkçe DejaVu font
- ApartmentMixEditor (412 satır): kat bazlı farklı daire tipleri, 3 şablon, 7 daire tipi, kat primi + cephe primi, gelir tablosu
- InvestmentDecisionPanel (215 satır): GO/NO-GO karar, 6 kriter trafik ışığı, benchmark karşılaştırma, 0-100 skor
- AI yorum: Claude API ile Türkçe değerlendirme + fallback
- Tek buton → 3 modül paralel (Promise.allSettled: fizibilite + deprem + enerji)
- Gider profili seçimi (S-eğri / ön yüklü / doğrusal)

---

### MEVCUT TEKNOLOJİ STACK

- **Backend:** FastAPI + Shapely + NumPy + Anthropic + OpenAI (Grok) + ReportLab + Matplotlib
- **Frontend:** React 19 + TypeScript + Zustand + Tailwind CSS 4 + Three.js/R3F + Recharts + Framer Motion
- **Deploy:** Railway (backend) + Vercel (frontend) — vercel.json mevcut
- **Toplam:** 80 dosya, 20,094 satır (Frontend 11,614 + Backend 8,480)

---

### ŞİMDİ YAPILACAK: SEVİYE 5 — Export + Deprem/Enerji İyileştirme + Landing

**Spesifikasyondaki Seviye 5 maddeleri (38-44):**

38. **Export toolbar her adımda** — Adım 2 (Plan): SVG/DXF/PNG export butonları. Adım 3 (3D): GLTF/PNG screenshot (zaten var ama sadece 3D içinde — header'a da ekle). Adım 4 (Fizibilite): PDF rapor butonu. Header'da global "Dışa Aktar" menüsü (dropdown: hangi adımdaysa o adımın export'ları)

39. **AFAD 81 il Ss/S1 tablosu** — `config/afad_ss_s1.py` hardcoded tablo (81 il merkezi için Ss ve S1 değerleri, AFAD TDTH'den). API çalışırsa API kullanılır, çalışmazsa bu tablo fallback. Mevcut deprem analizi sadece Ankara'ya sabit (latitude=39.93). İl seçimine göre dinamik olmalı.

40. **Kolon grid SVG overlay** — Plan SVG çiziminde (FloorPlanSVG.tsx) toggle ile açılıp kapanan kolon grid. Zaten showAxisGrid prop var ve çalışıyor — ama kolon pozisyonları backend'den gelen gerçek kolon grid ile eşleşmeli (şu an sadece oda kenarlarından üretiliyor).

41. **Enerji pencere tipi karşılaştırma** — Duvar yalıtım karşılaştırmasına ek olarak pencere tipi (tek cam → çift cam → ısıcam → Low-E) karşılaştırma grafiği. Backend'de hesaplama var ama frontend'te sadece duvar yalıtım chart gösteriliyor.

42. **Landing page** — Marketing landing page: hero section (animasyonlu bina silüeti veya 3D önizleme), 5 özellik grid (ikon + açıklama), ekran görüntüleri carousel (3 ekran: parsel, plan, 3D), CTA butonu → auth. Şu an direkt auth sayfasına gidiyor.

43. **Auto-save** — Zaten var (3sn debounce), ama her adım tamamlandığında anında kayıt tetiklenmeli (sadece isDirty'ye bağlı değil, markCompleted çağrıldığında da). Header'daki "son kaydedilme" göstergesi daha belirgin olmalı.

44. **Responsive temel** — Tablet breakpoint kontrolü (md:), mobile'da hamburger menü, 3D viewer mobile gesture desteği, form'lar stack layout. Şu an tamamen desktop-first.

---

### EK MADDELER (Seviye 3-4'ten eksik kalan profesyonel detaylar):

45. **Kolon grid SVG overlay Plan adımında** — FloorPlanSVG'de backend'den gelen kolon grid verisiyle eşleşen overlay

46. **Pencere tipi karşılaştırma grafiği** — EnergyPanel'de mevcut yalıtım chart'ının yanına pencere tipi chart

---

### KRİTİK KURALLAR:

1. **Hız ve sürenin önemi yok. Her dosya SaaS kalitesinde olacak.**
2. **Her madde gerçek entegrasyon ile çalışacak — dekoratif kod kabul edilmez.**
3. **Kodla, test et, doğrula, sonra commit et.**
4. **Her dosyada kendine sor: "Bu SaaS ürünü müşteriye satılabilir mi?"**
5. **Diğer 4 seviye profesyonel BIM seviyesinde. Seviye 5 de aynı seviyede olmalı.**
6. **Landing page bir müteahhidin veya bir üniversite jürisinin "bu profesyonel" diyeceği kalitede olmalı.**
7. **Responsive: En azından tablet + büyük mobil desteklemeli. 3D viewer'da pinch-zoom çalışmalı.**

### İLK ADIM:
Repo'yu çek, REBUILD_SPEC.md'yi oku, mevcut dosyaları incele, sonra Seviye 5 planını çıkar ve sırayla uygula.

### API KEY'LER:
- Claude: claude-sonnet-4-6-20250514 (plan üretimi + cross-review + fizibilite yorum)
- Grok/xAI: grok-4-0620 (plan üretimi + cross-review), grok-2-image (fotogerçekçi render)
- Key'ler .env'de veya frontend Settings'ten girilir, backend header'dan okur

## PROMPT BİTİŞ
