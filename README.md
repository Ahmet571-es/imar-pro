# imarPRO — İmar Uyumlu Kat Planı Üretici

<div align="center">

**Profesyonel gayrimenkul fizibilite ve AI kat planı üretim SaaS platformu**

Dual AI (Claude + Grok) | 3D/4D/5D BIM | TBDY 2018 Deprem | Bankaya Sunulabilir PDF

**92 dosya · 21,500+ satır · 5 seviye profesyonel BIM kalite**

</div>

## Özellikler

| Modül | Özellikler |
|-------|------------|
| **Parsel & İmar** | TKGM entegrasyonu, çokgen çizim, çekme mesafeleri, TAKS/KAKS, ölçekli SVG |
| **AI Plan Motoru** | Claude + Grok dual AI, 5 farklı strateji, cross-review, doğal dil giriş |
| **3D/4D/5D BIM** | PBR materyaller, SSAO, 6 görünüm modu, 4D inşaat simülasyonu, 5D maliyet ısı haritası |
| **Fizibilite** | Monte Carlo, IRR, nakit akışı, duyarlılık, GO/NO-GO karar paneli, AI yorum |
| **Deprem** | AFAD 81 il Ss/S1 tablosu, TBDY 2018 spektrum, kolon grid, taban kesme |
| **Enerji** | A-G sınıfı, yalıtım + pencere tipi karşılaştırma |
| **Export** | PDF rapor (15-20 sayfa), SVG, DXF (AutoCAD), PNG 2×, GLTF/GLB |

## Teknoloji Stack

- **Backend:** FastAPI · Shapely · NumPy · Anthropic SDK · OpenAI SDK · ReportLab · Matplotlib
- **Frontend:** React 19 · TypeScript · Zustand · Tailwind CSS 4 · Three.js/R3F · Recharts · Framer Motion
- **Auth/DB:** Supabase (opsiyonel — demo modu mevcut)
- **Deploy:** Railway (backend) + Vercel (frontend)

## Hızlı Başlangıç

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (ayrı terminal)
cd frontend && npm install && npm run dev
```

Frontend `http://localhost:5173` → Vite proxy → Backend `:8000`

## Deploy

### 1. Railway (Backend)

- [railway.app](https://railway.app) → New Project → Deploy from GitHub
- Root Directory: `/` — nixpacks.toml otomatik okunur
- Environment Variables:
  ```
  PORT=8000
  ANTHROPIC_API_KEY=sk-ant-...
  XAI_API_KEY=xai-...
  ```
- Kontrol: `https://APP.up.railway.app/health`

### 2. Vercel (Frontend)

- [vercel.com](https://vercel.com) → Import → Framework: **Vite** → Root: **frontend**
- Environment Variables:
  ```
  VITE_API_URL=https://APP.up.railway.app
  VITE_SUPABASE_URL=https://xxx.supabase.co     # opsiyonel
  VITE_SUPABASE_ANON_KEY=eyJ...                  # opsiyonel
  ```

### 3. Supabase (Opsiyonel)

- [supabase.com](https://supabase.com) → New Project
- SQL Editor → `supabase/migration.sql` yapıştır → Run
- Auth → Email aktif → URL + anon key'i Vercel'e ekle

> Supabase olmadan da çalışır — demo mod (localStorage) otomatik aktif.

### Custom Domain

- **Vercel:** Settings → Domains → A/CNAME kayıt
- **Railway:** Settings → Networking → Custom Domain → CNAME kayıt

## API Key Kullanımı

3 kaynaktan okunur (öncelik sırasıyla):
1. HTTP header: `X-Claude-Api-Key`, `X-Grok-Api-Key`
2. Request body: `claude_api_key`, `grok_api_key`
3. Env variable: `ANTHROPIC_API_KEY`, `XAI_API_KEY`

## API Endpoints

```
GET  /health                        Sağlık kontrolü
POST /api/parcel/calculate/rectangle Dikdörtgen parsel
POST /api/parcel/tkgm               TKGM sorgusu
POST /api/zoning/calculate           İmar hesaplama
POST /api/plan/generate              AI plan üretimi
POST /api/3d/building-data           3D bina verisi
POST /api/feasibility/calculate      Fizibilite
POST /api/earthquake/analyze         Deprem analizi
GET  /api/earthquake/afad-iller      81 il Ss/S1 tablosu
POST /api/energy/calculate           Enerji performans
POST /api/export/pdf                 PDF rapor
POST /api/export/dxf                 DXF export
POST /api/export/svg                 SVG export
```

Swagger UI: `https://API/docs`

## Lisans

MIT
