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
| F3.1 | VERİ AKIŞI KOPUK | `useDemoPlanRooms()` hardcoded demo data kullanıyor — plan adımından gelen veri hiç aktarılmıyor | projectStore'da `selectedPlanRooms` tutulacak. Plan adımında alternatif seçildiğinde store güncellenir. ThreeDStep bu store'dan okur |
| F3.2 | PBR materyaller basit | Düz renk MeshStandardMaterial — texture yok, normal map yok | En azından: dış cephe için roughness variation, zemin döşeme için karo deseni (programmatic texture), pencere camı için envmap reflection, kolon beton texture |
| F3.3 | Pencere/kapı detayı yetersiz | Kapı sadece kutu, pencere sadece düz cam | Kapı: pervaz + panel detayı (BoxGeometry kompozisyon), Pencere: çerçeve profili + cam (transmission material), Balkon: korkuluk (CylinderGeometry + BoxGeometry) |
| F3.4 | Güneş gölge kalitesi | DirectionalLight shadow var ama shadowMap düşük çözünürlük, PCF filtering yok | Shadow-mapSize 4096, PCFSoftShadowMap, cascade shadow maps düşünülebilir |
| F3.5 | Kat slider UX | Sol panelde buton listesi — scroll gerektiriyor | Dikey slider (range input) veya animasyonlu kat geçişi |
| F3.6 | Render galerisi gerçek veri kullanmıyor | Render butonları var ama API key yoksa hiçbir şey gösteremiyor | API key yoksa placeholder render örnekleri göster + "API key ekleyerek gerçek render alın" mesajı. API key varsa oda bilgilerini plan adımından al |

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

### SEVİYE 3 — 3D Veri Akışı
8. **Plan → 3D veri bağlantısı** — hardcoded demo kaldır, store'dan oku
9. **PBR materyal iyileştirme** — en azından roughness variation + programmatic texture
10. **Pencere/kapı/balkon detay** — geometri kompozisyon

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
| 3 | 3D veri akışı + materyal | 1 sohbet |
| 4 | Fizibilite PDF + deprem/enerji | 1-2 sohbet |
| 5 | Export + landing + polish | 1 sohbet |
| **Toplam** | | **6-7 sohbet** |

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
