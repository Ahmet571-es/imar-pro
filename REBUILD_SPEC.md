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

**GERÇEK API KEY'LER MEVCUT** — Claude Sonnet 4.6 + Grok 4 + Grok Imagine. Bu her şeyi değiştirir.

**Zayıflıklar ve SaaS çözümleri:**

| # | Sorun | Şu anki durum | SaaS seviyesi (9/10 hedef) |
|---|-------|---------------|---------------|
| F2.1 | Demo planlar naif | Grid-based satır yerleştirme — mimari mantık sıfır | **İKİ KATMANLI MİMARİ ZEKA:** Katman A: AI (Claude+Grok) detaylı mimari program üretir — oda bitişiklik grafiği, güneş tercihleri, dolaşım şeması, gizlilik zonları, ıslak hacim gruplaması mantığı. Katman B: Layout engine bu programı fiziksel koordinatlara çevirir — bin-packing + constraint satisfaction. AI geometri yazmaz, MİMARİ DÜŞÜNÜR |
| F2.2 | Layout engine yok | Doküman "Katman 2: algoritmik yerleştirme" diyor ama bu katman hiç yazılmadı | **`core/layout_engine.py` — Profesyonel yerleştirme motoru:** 1) Yapılaşma alanını koridor aksına göre ikiye böl 2) Oda öncelik sırasına göre yerleştir (salon→yatak→ıslak→servis) 3) Bitişiklik constraint'leri: banyo-yatak, mutfak-salon, antre-giriş 4) Çakışma ASLA oluşmaz (placement validation her adımda) 5) Sirkülasyon analizi: tüm odalara koridor/antreden erişim garanti 6) 3 farklı strateji genuinely farklı layout üretir |
| F2.3 | AI → Engine → AI döngüsü yok | AI plan üretir, post-processor mekanik düzeltir, biter | **İTERATİF İYİLEŞTİRME DÖNGÜSÜ (gerçek API key ile):** 1) Claude mimari program üretir 2) Layout engine yerleştirir 3) Plan scorer puanlar 4) Düşük puan alan odalar/ilişkiler feedback olarak Claude'a geri gönderilir 5) Claude revize program üretir 6) 2-3 iterasyon → en iyi plan. Grok aynı döngüyü bağımsız yapar. Final: 4+ plan arasından en iyi 3 |
| F2.4 | Cross-review demo | API key yoksa hardcoded "65 puan" dönüyor | **GERÇEK CROSS-REVIEW:** Claude planını Grok eleştirir (güçlü/zayıf/öneri), Grok planını Claude eleştirir. Eleştiri puanı + metin. Final skor: %40 otomatik scorer + %30 cross-review + %30 AI self-assessment. Frontend'te eleştiri metni gösterilir |
| F2.5 | Mimari SVG eksik | Kapı yayları var ama: duvar çift çizgi yok, ölçü çizgileri oda bazlı değil, grid aksları yok | **TAM MİMARİ ÇİZİM STANDARDI:** Çift çizgi dış duvar (0.25m kalınlık gösterimli), tek çizgi iç duvar (0.10m), kapı 90° yay + açılma yönü oku, pencere üçlü çizgi (cam+çerçeve) genişlik yazılı, extension line + dimension line (her oda genişlik+derinlik), yapısal aks grid'i (A-B-C / 1-2-3) kesikli çizgi, ıslak hacim ANSI31 diyagonal tarama (45°), mobilya placeholder (yatak dikdörtgen, masa daire, tezgah çizgi), oda etiket: isim + alan m² + tavan yüksekliği |
| F2.6 | 3 alternatif aynı | Demo modda hepsi benzer | **5 GENUİNE STRATEJİ (Claude 2 + Grok 2 + Hybrid 1):** Claude-1: "Açık Plan" — salon+mutfak birleşik, max sosyal alan. Claude-2: "Mahremiyet" — yatak odaları izole, çift koridor. Grok-1: "Güneş Maksimum" — tüm yaşam alanları güney. Grok-2: "Kompakt Verimli" — min sirkülasyon, max kullanılabilir alan. Hybrid: En iyi 2 planın güçlü yönlerini birleştiren AI-sentez plan |
| F2.7 | Doğal dil girişi yok | Sadece form-based oda listesi | **AI DOĞAL DİL GİRİŞİ:** Kullanıcı "3+1, salonu geniş olsun, mutfak açık planlı, 2 balkon istiyorum" yazar → Claude bu metni parse eder → oda programı otomatik oluşturulur. Formla düzenleme de mümkün (hibrit giriş) |

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

## YENİDEN İNŞA SIRASI (Her seviye minimum 8.5/10)

**ÖNEMLİ:** Claude Sonnet 4.6 + Grok 4 + Grok Imagine API key'leri mevcut. Demo mode artık fallback değil, ana mod. Tüm AI özellikleri gerçek API ile çalışacak.

---

### SEVİYE 1 — Temel Altyapı + Veri Bütünlüğü → Hedef: 9/10
1. **projectStore tam genişletme** — planResults (tüm alternatifler + puanlar), selectedPlanIndex, feasibilityData, earthquakeData, energyData, buildingData3D hepsi store'da
2. **Tam serialize/deserialize** — tüm store ↔ JSON. Proje kaydet → aç → bıraktığın yerden devam, hiçbir veri kaybı yok. Her adım (parsel, imar, plan, 3D, fizibilite) tam restore
3. **Auto-save sistemi** — her adım tamamlandığında otomatik kayıt + header'da "son kaydedilme" göstergesi + manuel "Kaydet" butonu
4. **Toast notification sistemi** — başarı (yeşil), hata (kırmızı), bilgi (mavi), uyarı (sarı). 4 saniye auto-dismiss. Stack yapısı (birden fazla toast)
5. **Global error boundary** — React error boundary, crash durumunda kullanıcı dostu mesaj + "Yeniden Dene" butonu
6. **API key yönetimi** — Settings sayfası: Claude API key, Grok API key girişi. localStorage'da şifreli saklanır. Key yoksa ilgili butonlarda "API key gerekli" uyarısı

---

### SEVİYE 2 — AI Plan Motoru (Gerçek AI ile) → Hedef: 9/10
7. **`core/layout_engine.py`** — Profesyonel constraint-based yerleştirme:
   - Koridor aksı belirleme (bina derinliğinin ortası veya 1/3'ü)
   - Oda yerleştirme öncelik sırası: salon (güneş cephe) → mutfak (salon yanı) → yatak odaları (sessiz cephe) → ıslak hacimler (grup) → servis (koridor/antre)
   - Her adımda çakışma kontrolü (placement validation)
   - Bitişiklik constraint'leri: banyo↔yatak, mutfak↔salon, antre↔giriş kapısı
   - Sirkülasyon garanti: tüm odalara koridor veya antreden erişim
   - Çakışma asla oluşmaz — engine sadece valid pozisyonlara yerleştirir
8. **AI prompt yeniden tasarım** — AI'dan MİMARİ PROGRAM al (oda ilişki grafiği + boyut tercihleri + güneş stratejisi + dolaşım şeması), koordinat üretmesin. Layout engine koordinatları hesaplar
9. **İteratif AI döngüsü** — Generate → Score → Feedback → Regenerate (2-3 iterasyon). Claude ve Grok bağımsız döngüler. Son iterasyonda en iyi planlar seçilir
10. **Gerçek cross-review** — Claude planını Grok eleştirir, Grok planını Claude eleştirir. Eleştiri metni + puan frontend'te gösterilir
11. **5 genuinely farklı alternatif** — Claude 2 + Grok 2 + AI-hybrid 1
12. **Doğal dil giriş** — "Geniş salonlu 3+1, açık mutfak" → AI parse → oda programı otomatik
13. **Mimari SVG tam standart** — çift çizgi duvar (kalınlık gösterimi), kapı 90° yay, pencere üçlü çizgi, dimension line, aks grid (A-B-C/1-2-3), ıslak hacim ANSI31 tarama, mobilya placeholder, oda etiket (isim + alan + yükseklik)
14. **Radar chart** — 3 alternatifin 9 boyutlu puanını Recharts radar chart ile karşılaştırma

---

### SEVİYE 3 — 3D/4D/5D BIM Görselleştirme (Enscape/Twinmotion + Navisworks seviyesi) → Hedef: 9.5/10

#### 3A. Veri Akışı + Bina Geometri Motoru
15. **Plan → 3D tam entegrasyon** — projectStore'daki selectedPlanRooms → BuildingViewer. Plan değişince 3D anında güncellenir
16. **Akıllı bina geometri üretici**:
   - Döşeme: 0.30m kalınlık, kenar profili
   - Duvarlar: dış 0.25m, iç taşıyıcı 0.20m, bölme 0.10m — ayrı kalınlık geometri
   - Pencere/kapı yerinde duvar kesintisi (gerçek boşluk)
   - Çatı: beşik çatı veya teras çatı seçeneği
   - Saçak 0.50m taşma, zemin kat giriş kapısı + basamak
   - Merdiven evi boşluğu, temel bandı

#### 3B. PBR Materyaller + Texture
17. **Programmatic texture** — sıva noise, seramik karo grid (0.60×0.60m), ahşap grain, beton noise
18. **MeshPhysicalMaterial** — cam: transmission 0.6 + ior 1.5 + envmap reflection
19. **HDR sky dome** — ücretsiz HDRI sunny outdoor, gerçekçi gökyüzü yansıması

#### 3C. Aydınlatma + Post-Processing
20. **Gelişmiş aydınlatma** — hemisphere light + sun (enlem+saat) + PCFSoftShadowMap 4096
21. **Post-processing** — SSAO + bloom + vignette + SMAA + exposure kontrolü

#### 3D. İnteraktivite + UX
22. **6 kamera preset** — kuş bakışı, 4 cephe, iç mekan — animasyonlu geçiş (spring)
23. **Oda interaktivite** — hover emissive highlight + tooltip, click detay panel, double-click fly-to
24. **Ölçüm modu** — iki nokta arası mesafe (tıkla-tıkla → dimension line)

#### 3E. Çevre + Peyzaj
25. **Basit çevre** — parsel sınırları yeşil alan, yol, ağaç placeholder (3-5 adet), araba, çim texture, 3D kuzey oku

#### 3F. Export + Screenshot
26. **Screenshot PNG** 2×/4× çözünürlük, "Fotoğraf Çek" butonu
27. **GLTF/GLB export** — Three.js GLTFExporter ile tüm bina modeli

#### 3G. 6 Görünüm Modu
28. **Solid / X-Ray / Wireframe / Section Cut (yatay+dikey) / Exploded (spring anim.) / Thermal** (enerji U-değerine göre renklendirme)

#### 3H. Grok Imagine Render Galerisi (GERÇEK API KEY İLE)
29. **Plan verisinden dinamik oda kartları** — seçili planın odaları otomatik listelenir
30. **Dış cephe render** — 4 yönden otomatik prompt (güney, doğu, batı, kuş bakışı)
31. **4 stil yan yana** — Modern Türk / Klasik / Minimalist / Lüks — aynı oda, 4 stil slider karşılaştırma
32. **Render cache** — üretilen render'lar store'da tutulur, tekrar üretmeye gerek yok
33. **Batch render** — "Tüm Odaları Render Et" tek butonla sıralı üretim + progress bar

#### 3I. 4D İnşaat Zaman Simülasyonu (BIM 4D)
34. **Zaman slider** (1-30 ay): Slider'ı sürükle → 3D modelde o ana kadar inşa edilen kısım solid, geri kalanı wireframe/şeffaf.
    İnşaat faz tanımları:
    - Ay 1-2: Hafriyat + temel (sadece temel bandı ve kazık görünür)
    - Ay 2-4: Kaba inşaat zemin + 1. kat (kolon + döşeme)
    - Ay 4-8: Kaba inşaat üst katlar (her ~1.5 ayda bir kat yükselir)
    - Ay 8-10: Çatı + dış duvar örümü
    - Ay 10-13: Dış cephe kaplama + mantolama (dış cephe renk değişimi)
    - Ay 13-16: İç ince işler (iç duvarlar opak olur, döşeme kaplama)
    - Ay 16-18: Tesisat + son kontroller (tam model)
35. **Play/pause animasyon**: Otomatik ileri sarma butonu — temel → çatı → bitmiş bina, 15 saniyelik sinematik animasyon. Kamera açısı da inşaatla birlikte değişir (alt seviyeden başlar, bina yükseldikçe kamera da yükselir)
36. **Faz renklendirme**: Her inşaat fazı farklı renk — kaba inşaat: beton gri, dış cephe: turuncu, ince inşaat: açık mavi. Legend ile hangi renk ne anlama geliyor gösterilir
37. **Nakit akışı senkronizasyon**: Zaman slider'ı sürüklenirken alt panelde o aya kadar harcanan kümülatif maliyet gösterilir — "Ay 8: ₺12.4M harcandı (toplam %45)" — 3D model ve finansal veri aynı anda ilerler

#### 3J. 5D Maliyet Görselleştirmesi (BIM 5D)
38. **Eleman bazlı maliyet**: 3D modeldeki her elemanın maliyet verisi var (backend'den gelen maliyet kalemleriyle eşleştirilmiş):
    - Döşeme tıkla → "3. Kat Döşeme: ₺285,000 (Betonarme %37 payından)"
    - Dış duvar tıkla → "Güney Cephe Dış Duvar: ₺142,000 (Dış Cephe %9 payından)"
    - Pencere tıkla → "Salon Penceresi: ₺18,500 (İnce İnşaat %27 payından)"
    - Çatı tıkla → "Çatı Kaplama: ₺95,000"
39. **Maliyet ısı haritası modu** (5D Heatmap): Tüm elemanlara maliyet büyüklüğüne göre renk atanır — en pahalı elemanlar koyu kırmızı, en ucuz koyu yeşil. Yan panelde maliyet sıralaması listesi. Görsel olarak paranın nereye gittiğini anında anlarsın
40. **What-if maliyet analizi**: 3D üzerinden "bu duvarı 5cm daha kalın yalıtım yapsam?" → maliyet farkını anında gösterir. Veya "pencere tipini Low-E'ye değiştirsem?" → enerji + maliyet etkisini 3D üzerinde görselleştirir
41. **Kümülatif maliyet göstergesi**: Ekran köşesinde her zaman görünen "Toplam Maliyet: ₺42.8M" sayacı — 4D slider'da ilerledikçe veya elemanlar değiştirildikçe güncellenir

---

### SEVİYE 4 — Fizibilite + PDF → Hedef: 9/10
34. **PDF rapor** — 15-20 sayfa profesyonel:
   - Kapak sayfası (proje adı, tarih, logo)
   - İçindekiler
   - Proje özeti (parsel, imar, daire karması)
   - Maliyet detay tablosu (15+ kalem)
   - Daire bazlı gelir tablosu (kat/cephe primi)
   - Nakit akışı grafiği (matplotlib → PDF embed)
   - Duyarlılık ısı haritası grafiği
   - Monte Carlo histogram grafiği
   - Tornado grafiği
   - Deprem parametreleri + tasarım spektrumu grafiği
   - Enerji performans (A-G bar + U değerleri)
   - Sonuç ve öneriler
   - Yasal uyarı sayfası
35. **Daire karması editörü** — kat bazlı farklı daire tipleri: zemin kat 1×3+1 + 1×2+1, normal katlar 2×3+1, çatı katı 1×4+1
36. **Deprem + enerji otomatik tetikleme** — fizibilite "Hesapla" butonu → maliyet + gelir + fizibilite + deprem + enerji hepsi paralel
37. **AI yorum** — Claude API ile fizibilite sonuçlarının yorumunu yaptır: "Bu proje %23 kâr marjı ile orta riskli. Satış fiyatı %10 düşse bile kârlı kalır..." Yorum PDF'e de eklenir

---

### SEVİYE 5 — Export + Deprem/Enerji İyileştirme + Landing → Hedef: 8.5/10
38. **Export toolbar her adımda** — Adım 3: SVG/DXF/PNG, Adım 4: GLTF/PNG screenshot, Adım 5: PDF rapor. Header'da global "Dışa Aktar" menüsü
39. **AFAD 81 il Ss/S1 tablosu** — `config/afad_ss_s1.py` hardcoded tablo (AFAD TDTH'den bir kere çekilmiş). API çalışırsa API, çalışmazsa tablo
40. **Kolon grid SVG overlay** — plan çiziminde toggle ile açılıp kapanan aks grid'i
41. **Enerji pencere tipi karşılaştırma** — duvar yalıtımına ek olarak pencere tipi (tek cam→Low-E) karşılaştırma grafiği
42. **Landing page** — hero section (animasyonlu bina silüeti), 5 özellik grid (ikon + açıklama), screenshot carousel (3 ekran görüntüsü), CTA → auth
43. **Auto-save** — her adım tamamlandığında proje otomatik güncellenir
44. **Responsive temel** — tablet breakpoint kontrolü, mobile'da stack layout

---

### KABUL KRİTERLERİ (Her seviye için)

**Seviye 1 (9/10):**
- [ ] Proje kaydet → tarayıcı kapat → aç → tüm veriler (parsel, imar, plan, fizibilite) tam restore
- [ ] Toast notification 4 türde çalışır
- [ ] API key girişi settings'ten yapılır

**Seviye 2 (9/10):**
- [ ] Gerçek Claude + Grok API ile plan üretimi çalışır
- [ ] Layout engine %100 çakışmasız plan üretir
- [ ] Cross-review gerçek AI eleştiri metni gösterir
- [ ] 3 alternatif genuinely farklı yerleşim
- [ ] Mimari SVG: çift çizgi duvar + aks grid + ölçü çizgisi çalışır
- [ ] Doğal dil giriş → oda programı otomatik
- [ ] Radar chart 9 boyutlu karşılaştırma

**Seviye 3 (9.5/10):**
- [ ] Plan adımında alternatif seçilince 3D 2 saniye içinde güncellenir
- [ ] 60fps orbit (desktop)
- [ ] 4+ farklı PBR materyal texture ile
- [ ] SSAO + bloom post-processing aktif
- [ ] 6 kamera preset animasyonlu geçiş
- [ ] Oda hover + click + fly-to çalışır
- [ ] Screenshot PNG 2× çalışır
- [ ] GLTF export Blender'da açılabilir
- [ ] Çevre: zemin + ağaç + yol
- [ ] 6 görünüm modu toggle
- [ ] Grok Imagine gerçek render üretir
- [ ] 4 stil karşılaştırma çalışır
- [ ] **4D: Zaman slider (1-30 ay) ile inşaat faz animasyonu çalışır**
- [ ] **4D: Play butonu sinematik 15sn animasyon oynatır**
- [ ] **4D: Nakit akışı 3D ile senkronize (slider sürüklenince maliyet güncellenir)**
- [ ] **5D: 3D eleman tıklama → maliyet bilgisi tooltip gösterir**
- [ ] **5D: Maliyet ısı haritası modu (kırmızı=pahalı, yeşil=ucuz)**
- [ ] **5D: Kümülatif maliyet sayacı ekranda görünür**

**Seviye 4 (9/10):**
- [ ] PDF rapor 15+ sayfa, grafik embed, profesyonel tipografi
- [ ] Daire karması kat bazlı düzenlenebilir
- [ ] Tek "Hesapla" butonu → 5 modül paralel
- [ ] AI yorum fizibilite sonuçlarını Türkçe analiz eder

**Seviye 5 (8.5/10):**
- [ ] Her adımda export butonları görünür ve çalışır
- [ ] AFAD 81 il tablosu fallback olarak çalışır
- [ ] Landing page + auth flow profesyonel
- [ ] Auto-save çalışır

---

## TAHMİNİ SOHBET SAYISI

| Seviye | Kapsam | Hedef | Sohbet |
|--------|--------|-------|--------|
| 1 | Altyapı + store + auto-save + toast + API key yönetimi | 9/10 | 1 sohbet |
| 2 | Layout engine + AI prompt + iteratif döngü + cross-review + SVG + radar + doğal dil | 9/10 | 2-3 sohbet |
| 3 | Bina geometri + PBR + post-processing + 6 mod + interaktivite + çevre + Grok render + **4D inşaat simülasyonu + 5D maliyet görselleştirme** | 9.5/10 | 4-5 sohbet |
| 4 | PDF rapor (15+ sayfa) + daire karması + otomatik tetikleme + AI yorum | 9/10 | 1-2 sohbet |
| 5 | Export toolbar + AFAD 81 il + kolon grid SVG + landing + responsive | 8.5/10 | 1-2 sohbet |
| **Toplam** | **52 madde, 5 seviye** | **Min 8.5** | **9-13 sohbet** |

---

## MEVCUT API KEY'LER

- **Claude API key** — model: `claude-sonnet-4-6-20250514` (plan üretimi + cross-review + fizibilite yorum)
- **Grok/xAI API key** — model: `grok-4-0620` (plan üretimi + cross-review), `grok-2-image` (fotogerçekçi render)

Bu key'ler `.env` dosyasında saklanacak, frontend'ten settings sayfasından da girilebilecek.

---

## YENİ SOHBET TALİMATI

Her sohbette şunu yapıştır:

```
1. Proje dokümanını (orijinal .txt)
2. Bu spesifikasyon dokümanını (REBUILD_SPEC.md)
3. "Seviye X'i tamamla" de
```

Ben repo'yu çeker, o seviyedeki tüm maddeleri sırayla yapar, test eder, push ederim.

**Her dosyada kendime soracağım:**
- "Bu SaaS ürünü müşteriye satılabilir mi?"
- "Bu kod jüri önünde utanç yaratır mı?"
- "Enscape/Twinmotion kullanan biri bunu görse ne der?"

Üç sorudan birine bile olumsuz cevap varsa o dosyayı push etmeyeceğim.
