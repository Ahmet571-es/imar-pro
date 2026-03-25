# imarPRO — SaaS Kalite Yeniden İnşa Spesifikasyonu

## MEVCUT DURUM ANALİZİ VE HER MODÜLÜN SORUNLARI

---

### GLOBAL SORUNLAR (Tüm fazları etkileyen)

| # | Sorun | Etki | Çözüm |
|---|-------|------|-------|
| G1 | Adımlar arası veri kaybı — plan sonuçları, fizibilite, 3D state projectStore'da tutulmuyor | Kullanıcı geri-ileri navigasyonda tüm sonuçları kaybediyor | projectStore'a planResults, feasibilityData, selectedPlanIndex eklenecek |
| G2 | Proje kaydetme eksik — sadece parselData ve imarParams persist ediliyor | Proje açıldığında plan/fizibilite sıfırdan | Tüm store state'i serialize/deserialize edilecek |
| G3 | Sıfır test — hiçbir unit/integration test yok | Güvenilirlik sıfır | Her modül için en az temel test |
| G4 | Error handling yüzeysel — çoğu yerde generic try/catch | Kullanıcı ne olduğunu anlamıyor | Her endpoint'te spesifik hata mesajları, frontend'te toast notification sistemi |
| G5 | Loading state'ler tutarsız — bazı yerlerde var bazı yerlerde yok | UX kalitesizliği | Merkezi loading/error yönetimi |

---

### FAZ 1: PARSEL + İMAR — Mevcut Skor: 7/10

**Güçlü yanlar:** Shapely geometri doğru çalışıyor, TAKS/KAKS hesaplama mantığı sağlam, SVG parsel görselleştirmesi temel seviyede iyi.

**Zayıflıklar ve SaaS çözümleri:**

| # | Sorun | Şu anki durum | SaaS seviyesi |
|---|-------|---------------|---------------|
| F1.1 | TKGM coğrafi kısıtlama | Railway sunucusu Türkiye dışında, TKGM çağrıları başarısız | Backend'e proxy/cache mekanizması: ilk çağrıda TKGM'den çek, sonuç Supabase'e cache'le. Alternatif: frontend'den doğrudan TKGM çağrısı (CORS bypass client-side) |
| F1.2 | Parsel SVG basit | Sadece polygon + kenar uzunlukları | Kuzey oku animasyonlu, çekme mesafeleri ayrı renkte layer, her kenar tıklanabilir (uzunluk düzenleme), zoom/pan, gerçek ölçek çubuğu |
| F1.3 | Çokgen giriş kısıtlı | Sadece kenar uzunlukları, açılar otomatik (düzgün çokgen varsayımı) | İnteraktif köşe sürükleme ile çokgen çizim, harita üzerinde çizim desteği, her köşede açı gösterimi |
| F1.4 | İmar hesaplama anında | 500ms debounce | Doğru ama bina yüksekliği limiti ve derinlik limiti kontrolleri eksik — bunlar da hesaplamaya dahil edilecek |
| F1.5 | Bitişik/Blok nizam | Yan bahçe 0 mantığı var ama frontend'te nizam seçildiğinde çekme mesafeleri otomatik güncellenmiyor | Nizam seçimi → çekme mesafeleri otomatik güncelleme + bilgi tooltip'i |

---

### FAZ 2: AI PLAN ÜRETİMİ — Mevcut Skor: 3/10 ⚠️ EN KRİTİK

**Güçlü yanlar:** Dual AI mimarisi doğru tasarlanmış, cross-review konsepti iyi, plan_scorer 9 boyutlu.

**Zayıflıklar ve SaaS çözümleri:**

| # | Sorun | Şu anki durum | SaaS seviyesi |
|---|-------|---------------|---------------|
| F2.1 | Demo planlar naif | Grid-based satır yerleştirme — mimari mantık sıfır | GERÇEK algoritmik layout engine: 1) Yapılaşma alanını grid'e böl 2) Oda öncelik sırasına göre yerleştir (salon→yatak→ıslak hacim→servis) 3) Bitişiklik kurallarına göre pozisyon optimize et 4) Simulated annealing veya constraint satisfaction ile iyileştir |
| F2.2 | Layout engine yok | Doküman "Katman 2: algoritmik yerleştirme" diyor ama bu katman hiç yazılmadı | Ayrı bir `core/layout_engine.py` modülü: AI'dan gelen oda programını (boyut + ilişki) alır, yapılaşma sınırları içinde fiziksel yerleştirme yapar. Çakışma-sıfır garanti, minimum sirkülasyon alanı, ıslak hacim gruplaması, güneş yönlenmesi |
| F2.3 | Post-processor mekanik | Çakışan odaları "itiyor" — bu mimari açıdan anlamsız sonuçlar üretir | Post-processor yerine layout engine'de çakışma ASLA oluşmasın. Post-processor sadece doğrulama yapsın (pass/fail), düzeltme yapmasın |
| F2.4 | AI prompt yetersiz | Prompt'ta oda koordinatlarını AI'a ürettiriyoruz ama LLM'ler geometri konusunda kötü | AI'dan sadece MİMARİ PROGRAM alınacak: oda listesi + bitişiklik ilişkileri + boyut tercihleri + güneş yönlenmesi tercihleri. Koordinatları layout engine hesaplayacak |
| F2.5 | Mimari SVG eksik | Kapı yayları ve pencere çizgileri var ama: duvar çift çizgi yok (tek çizgi), ölçü çizgileri oda bazlı değil, ıslak hacim taraması opacity düşük, grid aksları yok | Tam mimari çizim standardı: çift çizgi dış duvar (0.25m kalınlık), tek çizgi iç duvar (0.10m), kapı açılma yayı 90°, pencere üçlü çizgi (cam+çerçeve), extension line + dimension line, yapısal aks grid'i (A-B-C / 1-2-3), ıslak hacim ANSI31 taraması, oda etiket: isim + alan + kat yüksekliği |
| F2.6 | 3 alternatif aynı | Demo modda 3 strateji var ama hepsi çok benzer sonuç veriyor | Her strateji genuinely farklı olacak: 1) "Kompakt" — minimum sirkülasyon, max yaşam alanı 2) "Güneş Odaklı" — tüm yaşam alanları güney cephede 3) "Mahremiyet" — yatak odaları tamamen izole, çift koridor |

---

### FAZ 3: 3D & RENDER — Mevcut Skor: 4/10

**Güçlü yanlar:** Three.js/R3F setup doğru, orbit controls, section cut, güneş simülasyonu konsepti iyi.

**Zayıflıklar ve SaaS çözümleri:**

| # | Sorun | Şu anki durum | SaaS seviyesi |
|---|-------|---------------|---------------|
| F3.1 | VERİ AKIŞI KOPUK | `useDemoPlanRooms()` hardcoded — plan adımından veri aktarılmıyor | projectStore'da `selectedPlanRooms` → ThreeDStep gerçek veri okur. Plan değişince 3D anında güncellenir |
| F3.2 | Bina geometrisi basit | Her oda düz kutu, duvar kalınlığı yok, pencere/kapı boşluğu yok | Gerçek duvar kalınlığı (0.25m dış, 0.10m iç), pencere/kapı yerinde duvar kesintisi, döşeme kenar profili, çatı geometrisi (beşik/teras), saçak, temel bandı, merdiven evi boşluğu |
| F3.3 | PBR materyaller düz renk | MeshStandardMaterial sadece color — texture yok, normal map yok, envmap yok | Programmatic texture: sıva noise, seramik karo grid, ahşap grain, beton noise. MeshPhysicalMaterial: cam transmission+ior, envmap reflection. HDR sky dome |
| F3.4 | Post-processing yok | Sadece DirectionalLight + ambient | SSAO (köşe gölgeleri), bloom (cam/metal parlaması), vignette, SMAA anti-aliasing, exposure kontrolü |
| F3.5 | Kamera sabit | Sadece orbit — preset yok, animasyon yok | 6 kamera preset (kuş bakışı, 4 cephe, iç mekan), animasyonlu geçiş (spring/lerp), oda double-click fly-to |
| F3.6 | İnteraktivite minimum | Hover tooltip var ama tıklama yok, ölçüm yok | Oda click → detay panel, double-click → fly-to, ölçüm modu (iki nokta mesafe), oda emissive highlight |
| F3.7 | Çevre yok | Bina havada duruyor — zemin plane düz gri | Parsel sınırları yeşil alan, yol, ağaç placeholder (billboard/konik), araba, çim texture, kuzey oku 3D |
| F3.8 | Görünüm modları az | X-ray, exploded, section cut (yatay) var — wireframe yok, thermal yok, dikey kesit yok | 6 mod: solid, x-ray, wireframe, section (yatay+dikey), exploded (spring animasyonlu), thermal (enerji U-değeri renklendirme) |
| F3.9 | Export yok | Screenshot yok, GLTF yok | Canvas capture PNG (2×/4×), GLTFExporter ile .glb download, kamera preset'lerden otomatik 4 cephe screenshot |
| F3.10 | Render galerisi statik | Oda listesi hardcoded, API key yoksa boş | Plan verisinden dinamik oda kartları, 4 stil karşılaştırma slider, dış cephe 4 yön render, placeholder görseller API key yokken |
| F3.11 | Performans | Basit sahne ama optimizasyon yok | Geometry instancing (tekrar eden elemanlar), frustum culling, LOD (uzaktayken basit geometri), lazy load Three.js (code splitting) |

---

### FAZ 4: FİZİBİLİTE — Mevcut Skor: 6/10

**Güçlü yanlar:** Monte Carlo, IRR, duyarlılık 5×5, nakit akışı, tornado — hesaplama mantıkları doğru.

**Zayıflıklar ve SaaS çözümleri:**

| # | Sorun | Şu anki durum | SaaS seviyesi |
|---|-------|---------------|---------------|
| F4.1 | PDF RAPOR YOK | Doküman "15-20 sayfa bankaya sunulabilir" diyor, hiç implementasyon yok | `backend/export/pdf_report.py` — ReportLab veya WeasyPrint ile: kapak sayfası, içindekiler, proje özeti, maliyet detay tablosu, daire gelir tablosu, nakit akışı grafiği (matplotlib), duyarlılık ısı haritası, Monte Carlo histogram, deprem parametre tablosu, enerji sınıf grafiği, sonuç ve öneriler. Frontend'te "PDF İndir" butonu |
| F4.2 | Daire listesi otomatik ama özelleştirilemez | Backend daireleri kat × daire/kat şeklinde auto-generate ediyor, farklı kat planları desteklenmiyor | Fizibilite formuna daire karması editörü: kat 1 (zemin): 1×3+1 + 1×2+1, kat 2-3: 2×3+1, kat 4 (çatı): 1×4+1 |
| F4.3 | Grafikler temel | Recharts standart görünüm — özel renkleme, animasyon, interaktivite az | Her grafik: hover tooltip detaylı, tıklanabilir data point, export as PNG butonu, animasyonlu yükleme |
| F4.4 | Nakit akışı gider profili | S-curve var ama parametrik değil | Kullanıcı gider profilini ayarlayabilmeli: front-loaded (kazık+temel ağırlıklı), linear, back-loaded |

---

### FAZ 5: DEPREM + ENERJİ + EXPORT — Mevcut Skor: 5/10

**Güçlü yanlar:** TBDY 2018 spektrum hesabı doğru, enerji A-G sınıflama mantıklı, DXF 8-layer çalışıyor.

**Zayıflıklar ve SaaS çözümleri:**

| # | Sorun | Şu anki durum | SaaS seviyesi |
|---|-------|---------------|---------------|
| F5.1 | Deprem/Enerji otomatik tetiklenmiyor | Kullanıcı fizibilite hesapladıktan SONRA ayrı butonlara basmak zorunda | Fizibilite hesaplamasıyla birlikte paralel çağrılacak — tek "Hesapla" butonu hepsini tetikler |
| F5.2 | AFAD API çoğunlukla çalışmıyor | Sunucu Türkiye dışında, fallback tahmini çok kaba | İl/ilçe bazlı hardcoded Ss/S1 tablosu (81 il merkezi): AFAD TDTH'den bir kere çekilip `config/afad_ss_s1.py` olarak saklanacak. API çalışırsa API, çalışmazsa bu tablo |
| F5.3 | Kolon grid SVG'si yok | Backend kolon grid hesaplıyor ama frontend'te görselleştirilmiyor | Plan SVG'si üzerine kolon grid overlay — toggle ile açılıp kapanır |
| F5.4 | Export butonları FRONTEND'TE YOK | Backend endpoint çalışıyor ama kullanıcı erişemiyor | Her adımda export toolbar: Adım 3'te SVG/DXF indir, Adım 4'te GLTF indir, Adım 5'te PDF indir |
| F5.5 | GLTF export yok | Doküman "GLTF/GLB (3D model)" diyor, hiç yok | Three.js scene'den GLTFExporter ile client-side export veya backend'de trimesh ile |
| F5.6 | Enerji yalıtım karşılaştırma chart'ı | Var ama pencere tipi karşılaştırma yok | Hem duvar yalıtım hem pencere tipi için ayrı karşılaştırma grafikleri |

---

### FAZ 6: AUTH + PROJE + LANDING — Mevcut Skor: 5/10

**Güçlü yanlar:** Auth flow çalışıyor, demo mode iyi fallback, login UI tasarımı iyi.

**Zayıflıklar ve SaaS çözümleri:**

| # | Sorun | Şu anki durum | SaaS seviyesi |
|---|-------|---------------|---------------|
| F6.1 | Proje persist eksik | Sadece parselData ve imarParams kaydediliyor | Tüm store state'i JSON olarak kaydedilecek: parselData + imarParams + hesaplama + planResults + selectedPlanIndex + feasibilityData + earthquakeData + energyData |
| F6.2 | Landing page yok | Doküman "landing" diyor, direkt auth sayfasına gidiyor | Marketing landing page: hero section, özellikler grid'i, ekran görüntüleri carousel, CTA butonu → auth |
| F6.3 | Proje detaylarında güncelleme yok | Proje açılıp çalışıldıktan sonra değişiklikler kaydedilmiyor | Auto-save: her adım tamamlandığında otomatik güncelleme + manuel "Kaydet" butonu header'da |
| F6.4 | Responsive test yok | Desktop-first, mobile kırık olabilir | En azından: tablet breakpoint kontrolü, mobile'da hamburger menu, 3D viewer mobile gesture desteği |

---

## YENİDEN İNŞA SIRASI (Öncelik × Etki matrisi)

### SEVİYE 1 — Temel Altyapı (Her şeyden önce)
1. **projectStore genişletme** — planResults, feasibilityData, earthquakeData, energyData, selectedPlanIndex ekleme
2. **Serialize/deserialize** — tüm store ↔ JSON dönüşümü, proje kaydetme/yükleme tam çalışır
3. **Toast notification sistemi** — başarı/hata/bilgi mesajları için merkezi sistem

### SEVİYE 2 — AI Plan Motoru (En zayıf modül)
4. **`core/layout_engine.py`** — Constraint-based yerleştirme motoru
5. **AI prompt yeniden yazımı** — AI'dan program al, yerleştirmeyi engine yapsın
6. **3 genuinely farklı strateji** — kompakt, güneş odaklı, mahremiyet
7. **Mimari SVG iyileştirme** — çift çizgi duvar, aks grid, ölçü çizgileri

### SEVİYE 3 — 3D Mimari Görselleştirme (Enscape/Twinmotion seviyesi)

**Hedef:** Üniversite jürisi ekranı gördüğünde "bu gerçek bir yazılım" desin. Profesyonel mimari görselleştirme kalitesi.

#### 3A. Veri Akışı + Bina Geometri Motoru
8. **Plan → 3D tam entegrasyon** — hardcoded demo kaldır. projectStore'daki selectedPlanRooms doğrudan BuildingViewer'a akar. Plan adımında alternatif değiştirince 3D anında güncellenir
9. **Akıllı bina geometri üretici** (`threed_router.py` genişletme):
   - Döşeme: her katta gerçek döşeme plağı (0.30m kalınlık, kenar profili)
   - Duvarlar: dış duvar 0.25m, iç taşıyıcı 0.20m, bölme 0.10m — geometri olarak ayrı kalınlıkta
   - Duvar boşlukları: pencere ve kapı yerlerinde duvar kesintisi (gerçek boşluk, düz kutu değil)
   - Çatı: beşik çatı veya teras çatı seçeneği (kırma çatı geometrisi)
   - Saçak: çatıdan 0.50m taşma
   - Zemin kat girişi: giriş kapısı + saçak + basamak
   - Merdiven evi: kat boşluğu olarak görünen alan (her katta)
   - Temel: zemin altı 0.50m temel bandı (görünür)

#### 3B. PBR Materyaller + Texture
10. **Programmatic texture generation** (shader veya canvas-based):
    - Dış cephe: sıva texture (noise-based roughness variation) + renk seçimi (beyaz, krem, gri, tuğla)
    - İç duvar: beyaz boya (subtle roughness)
    - Döşeme: seramik karo deseni (grid pattern, 0.60×0.60m)
    - Balkon: taş/karo zemin
    - Pencere camı: `MeshPhysicalMaterial` — transmission 0.6, ior 1.5, envmap reflection
    - Kapı: ahşap doku (procedural wood grain)
    - Kolon: beton texture (noise)
    - Çatı: kiremit rengi
11. **Environment map**: HDR sky dome (ücretsiz HDRI — sunny outdoor), gerçekçi gökyüzü yansıması cam ve parlak yüzeylerde

#### 3C. Aydınlatma + Post-Processing
12. **Gelişmiş aydınlatma**:
    - Sun light: enlem + saat bazlı gerçek pozisyon (mevcut, iyileştirilecek)
    - Ambient: hemisphere light (gökyüzü mavisi + zemin kahverengisi)
    - Shadow: PCFSoftShadowMap, mapSize 4096×4096, cascade shadow düşünülebilir
    - İç mekan modunda: oda bazlı point light (pencereden giren ışık simülasyonu)
13. **Post-processing pipeline** (React Three Fiber `@react-three/postprocessing`):
    - SSAO (Screen Space Ambient Occlusion) — köşelerde gerçekçi gölge
    - Bloom — parlak yüzeylerde (cam, metal) ışık taşması
    - Tone mapping — ACES filmic (mevcut) + exposure kontrolü
    - Vignette — kenar kararması (subtle, profesyonel fotoğraf hissi)
    - Anti-aliasing — SMAA veya FXAA

#### 3D. İnteraktivite + UX
14. **Kamera preset'leri** (tek tıkla geçiş, animasyonlu kamera hareketi):
    - Kuş bakışı (top-down 45°)
    - Güney cephe (street level)
    - Kuzey cephe
    - Doğu/Batı cephe
    - İç mekan walkthrough (salon içinden bakış)
    - İzometrik (45° her iki eksende)
15. **Kat geçiş animasyonu**: kat seçildiğinde üstteki katlar yukarı kayarak açılır (spring animation, framer-motion veya R3F useSpring)
16. **Oda interaktivitesi**:
    - Hover: oda parlar (emissive) + tooltip (isim + alan + boyut)
    - Click: sağ panelde oda detay kartı açılır (boyutlar, pencere yönü, bağlı odalar)
    - Double-click: kamera o odaya fly-to + zoom
17. **Ölçüm modu**: iki nokta arası mesafe ölçümü (tıkla-tıkla → dimension line)

#### 3E. Çevre + Peyzaj (Bina etrafı)
18. **Basit çevre elementleri**:
    - Zemin döşeme: parsel sınırları (yeşil alan + yol kenarı gri)
    - Ağaç placeholder'ları: billboard sprite veya basit konik geometri (3-5 adet)
    - Yol: parsel önünde gri şerit
    - Araba placeholder: basit kutu (otopark alanında)
    - Çim: yeşil plane + noise texture (parsel bahçe alanları)
19. **Kuzey oku**: 3D kuzey oku (compass) sahne köşesinde, her zaman görünür

#### 3F. Export + Screenshot
20. **Yüksek çözünürlük screenshot**: Canvas capture → PNG (2× veya 4× resolution multiplier). "Fotoğraf Çek" butonu → anında indirilebilir dosya
21. **GLTF/GLB export**: Three.js scene'den GLTFExporter ile tüm bina modeli download (Blender/SketchUp'a aktarılabilir)
22. **Turntable video**: 360° kamera dönüşü kaydı (opsiyonel, WebM/GIF)

#### 3G. Görünüm Modları (Toggle panel)
23. **6 görünüm modu** (sağ üst panel, icon toggle):
    - **Solid**: varsayılan, tam PBR
    - **X-Ray**: duvarlar %15 opacity, iç mekan görünür (mevcut, iyileştirilecek)
    - **Wireframe**: tüm geometri wireframe (mühendislik görünümü)
    - **Section cut**: yatay veya dikey kesit düzlemi, clipping plane ile (mevcut, iyileştirilecek — dikey kesit eklenecek)
    - **Exploded**: katlar ayrışık (mevcut, spring animasyon eklenecek)
    - **Thermal**: enerji performansına göre renklendirme (kırmızı=kayıp, yeşil=iyi — U değerlerine bağlı)
24. **Kolon grid overlay**: toggle ile açılıp kapanır, aks isimleri (A, B, C / 1, 2, 3) 3D text olarak görünür

#### 3H. Grok Imagine Render Galerisi (İyileştirilmiş)
25. **Plan verisinden otomatik oda listesi**: render kartları hardcoded değil, seçili plandan dinamik
26. **Dış cephe render**: 4 yönden (güney, doğu, batı, kuş bakışı) otomatik prompt
27. **Render karşılaştırma**: 4 stili aynı oda için yan yana slider ile karşılaştır
28. **API key yoksa**: her oda kartında profesyonel placeholder görsel + "Grok API key ile gerçek render alın" overlay
29. **Render geçmişi**: üretilen render'lar session boyunca cache'lenir, tekrar üretmeye gerek yok

#### KABUL KRİTERLERİ — SEVİYE 3
- [ ] Plan adımında alternatif seçildiğinde 3D model 2 saniye içinde güncellenir
- [ ] Orbit 60fps (mobil hariç)
- [ ] En az 4 farklı PBR materyal (dış cephe, iç duvar, cam, ahşap) texture ile
- [ ] SSAO + bloom post-processing aktif
- [ ] 6 kamera preset'i, animasyonlu geçiş
- [ ] Oda hover tooltip + click detay paneli
- [ ] Screenshot PNG 2× çözünürlük çalışır
- [ ] GLTF export çalışır (Blender'da açılabilir)
- [ ] Çevre: zemin + en az 3 ağaç + yol
- [ ] 6 görünüm modu toggle çalışır
- [ ] Grok render kartları plan verisinden dinamik

### SEVİYE 4 — Fizibilite + PDF
11. **PDF rapor** — 15+ sayfa, profesyonel, bankaya sunulabilir
12. **Deprem/enerji otomatik tetikleme** — tek buton
13. **Daire karması editörü** — kat bazlı farklı tipler

### SEVİYE 5 — Export + UI Polish
14. **Export toolbar** — SVG, DXF, PDF, GLTF butonları her adımda
15. **AFAD Ss/S1 hardcoded tablo** — 81 il
16. **Auto-save** — adım tamamlandığında otomatik kaydet
17. **Landing page** — hero + features + CTA

---

## HER SEVİYE İÇİN TAHMİNİ SOHBET SAYISI

| Seviye | Kapsam | Sohbet |
|--------|--------|--------|
| 1 | Temel altyapı + store | 1 sohbet |
| 2 | AI layout engine + SVG | 2 sohbet (engine + frontend) |
| 3 | 3D mimari görselleştirme (geometri + materyal + post-processing + interaktivite + çevre + export) | 3-4 sohbet |
| 4 | Fizibilite PDF + deprem/enerji | 1-2 sohbet |
| 5 | Export + landing + polish | 1 sohbet |
| **Toplam** | | **8-10 sohbet** |

---

## YENİ SOHBET TALİMATI

Her sohbette şunu yapıştır:

```
1. Proje dokümanını (orijinal .txt)
2. Bu spesifikasyon dokümanını
3. "Seviye X'i tamamla" de
```

Ben repo'yu çeker, o seviyedeki tüm maddeleri sırayla yapar, test eder, push ederim.
Her dosyada kendime soracağım: "Bu SaaS ürünü müşteriye satılabilir mi?"
Cevap hayırsa o dosyayı push etmeyeceğim.
