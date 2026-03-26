# imarPRO — Seviye 3 Geliştirme Prompt'u

Aşağıdaki prompt'u yeni sohbete yapıştır. Yanına REBUILD_SPEC.md dokümanını da ekle.

---

## PROMPT BAŞLANGIÇ

Ben imarPRO projesini geliştiriyorum. Gayrimenkul fizibilite + AI kat planı üretim SaaS platformu.

**Repo:** https://github.com/Ahmet571-es/imar-pro
**GitHub Token:** [Kendi GitHub token'ınızı buraya ekleyin]

### TAMAMLANAN SEVİYELER

**Seviye 1 (9/10 ✅) — Temel Altyapı:**
- projectStore: 16 alan + 2 form state (planFormState, feasibilityFormState) serialize/restore
- Auto-save: isDirty → 3sn debounce → getState() stale-safe
- Toast: 10 bileşen, 28+ kullanım noktası
- ErrorBoundary: React crash + toast API hataları
- API key: Settings dialog → X-Claude-Api-Key / X-Grok-Api-Key header injection
- 0 adet `as never` — tip güvenli

**Seviye 2 (9/10 ✅) — AI Plan Motoru:**
- `core/layout_engine.py` (920 satır): 5 strateji (south_social, central_corridor, privacy_zones, compact_efficient, sun_maximum), zone-based placement, shrink fallback, %100 çakışmasız
- `ai/program_bridge.py` (260 satır): AI→engine köprüsü, hibrit plan generasyonu
- `ai/dual_ai_engine.py`: 5 katmanlı mimari (AI + Engine + PostProcess + CrossReview + Hybrid)
- `FloorPlanSVG.tsx` (490 satır): Çift çizgi duvar, ANSI31 tarama, extension+dimension lines, aks grid, mobilya placeholder, tavan yüksekliği
- `PlanRadarChart.tsx`: 9 boyutlu Recharts radar
- NLP parser: 20+ Türkçe keyword (ebeveyn banyo, kiler, giyinme odası vb.)
- Plan router: Header > Body > ENV API key, demo modda 5 strateji + hibrit

### MEVCUT TEKNOLOJİ STACK
- **Backend:** FastAPI + Shapely + NumPy + Anthropic + OpenAI (Grok)
- **Frontend:** React 19 + TypeScript + Zustand + Tailwind CSS 4 + Three.js/R3F + Recharts + Framer Motion
- **Mevcut 3D:** BuildingViewer.tsx (429 satır) — temel Three.js/R3F setup, orbit controls, basit kutu geometrileri
- **Deploy:** Railway (backend) + Vercel (frontend)

### ŞİMDİ YAPILACAK: SEVİYE 3 — 3D/4D/5D BIM Görselleştirme

Spesifikasyondaki Seviye 3 maddelerini (15-41) tamamla. Hedef: 9.5/10.

**KRİTİK KURALLAR:**
1. Hız ve sürenin önemi yok. Her dosya SaaS kalitesinde olacak.
2. Her madde gerçek entegrasyon ile çalışacak — dekoratif kod kabul edilmez.
3. Kodla, test et, doğrula, sonra commit et.
4. Her dosyada kendine sor: "Bu SaaS ürünü müşteriye satılabilir mi?"
5. Önceki seviyelerde öğrenilen ders: ALT YAPI YAZ → BİLEŞENLERE BAĞLA → UÇTAN UCA TEST ET. Sadece altyapı yazmak yetmez.

**İLK ADIM:** Repo'yu çek, mevcut ThreeDStep.tsx ve BuildingViewer.tsx'i incele, sonra Seviye 3 planını çıkar.

**API KEY'LER:**
- Claude: claude-sonnet-4-6-20250514 (plan üretimi + cross-review + fizibilite yorum)
- Grok/xAI: grok-4-0620 (plan üretimi + cross-review), grok-2-image (fotogerçekçi render)
- Key'ler .env'de veya frontend Settings'ten girilir, backend header'dan okur

## PROMPT BİTİŞ
