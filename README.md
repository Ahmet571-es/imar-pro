# imarPRO — İmar Uyumlu Kat Planı Üretici

<div align="center">

**Profesyonel gayrimenkul fizibilite ve mimari plan üretim platformu**

Dual AI (Claude + Grok) | 3D Görselleştirme | Bankaya Sunulabilir Fizibilite

</div>

## Özellikler

| Modül | Açıklama |
|-------|----------|
| **Parsel** | Manuel giriş (dikdörtgen/çokgen) + TKGM CBS API sorgulama |
| **İmar** | TAKS/KAKS hesaplama, çekme mesafeleri, ortak alan düşümü |
| **AI Plan** | Claude Sonnet 4.6 + Grok 4 Dual AI plan üretimi, cross-review, 3 katmanlı güvenlik |
| **3D & Render** | Three.js interaktif model + Grok 2 Image fotogerçekçi render (4 stil) |
| **Fizibilite** | 15+ kalem maliyet, Monte Carlo (5000 sim), nakit akışı, IRR, duyarlılık 5×5, tornado |
| **Deprem** | AFAD Ss/S1, TBDY 2018 tasarım spektrumu, kolon grid, taban kesme kuvveti |
| **Enerji** | A-G sınıfı, cephe bazlı U değeri, yalıtım karşılaştırma, güneş kazancı |
| **Export** | DXF (AutoCAD katmanlı), SVG (mimari standart) |
| **Auth** | Supabase Auth + proje kaydetme/yükleme (demo mod dahil) |

## Teknoloji Stack

**Frontend:** React 18 + TypeScript + Tailwind CSS + Vite + React Three Fiber + Recharts + Zustand  
**Backend:** FastAPI + Python 3.11+ + Shapely + Pydantic v2 + ezdxf  
**AI:** Claude Sonnet 4.6 + Grok 4 (plan) + Grok 2 Image (render)  
**Auth/DB:** Supabase (PostgreSQL + Auth) — opsiyonel, demo mod mevcut  
**Deploy:** Vercel (frontend) + Railway (backend)

## Kurulum

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # API key'leri girin
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # Supabase URL'leri girin (opsiyonel)
npm run dev
```

### Supabase (opsiyonel)
1. [supabase.com](https://supabase.com) → yeni proje oluştur
2. `supabase/migration.sql` dosyasını SQL Editor'da çalıştır
3. Frontend `.env.local` dosyasına URL + anon key gir
4. Supabase olmadan da demo mod ile tüm özellikler çalışır

## API Dokümantasyonu

Backend çalışırken: http://localhost:8000/docs

## Proje Yapısı

```
imar-pro/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── models.py             # Pydantic schemas
│   ├── routers/              # API endpoints (7 router)
│   ├── core/                 # Parsel, imar, plan scorer
│   ├── ai/                   # Claude, Grok, dual engine, post-processor
│   ├── analysis/             # Fizibilite, deprem, enerji
│   ├── config/               # Yönetmelik, maliyet, daire şablonları
│   ├── dataset/              # 80K plan istatistikleri
│   ├── export/               # DXF, SVG
│   └── utils/                # Geometri, sabitler
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── auth/         # Login/Register
│       │   ├── projects/     # Proje dashboard
│       │   ├── layout/       # Header, wizard navigation
│       │   ├── parcel/       # Adım 1: Parsel
│       │   ├── zoning/       # Adım 2: İmar
│       │   ├── plan/         # Adım 3: AI Plan + mimari SVG
│       │   ├── three/        # Adım 4: 3D + Render
│       │   └── feasibility/  # Adım 5: Fizibilite + Deprem + Enerji
│       ├── stores/           # Zustand (auth, project, projectList)
│       ├── services/         # API client
│       ├── lib/              # Utils, Supabase client
│       └── types/            # TypeScript types
└── supabase/
    └── migration.sql         # Veritabanı şeması
```

## Lisans

MIT
