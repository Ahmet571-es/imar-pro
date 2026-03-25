# imarPRO — İmar Uyumlu Kat Planı Üretici

Profesyonel gayrimenkul fizibilite ve mimari plan üretim platformu. İnşaat mühendisleri ve mimarlar için Dual AI (Claude + Grok) destekli, 3D görselleştirmeli, bankaya sunulabilir fizibilite raporlu SaaS uygulaması.

## Özellikler

| Modül | Açıklama | Faz |
|-------|----------|-----|
| **Parsel** | Manuel giriş (dikdörtgen/çokgen) + TKGM sorgulama | ✅ Faz 1 |
| **İmar** | TAKS/KAKS hesaplama, çekme mesafeleri, ortak alan | ✅ Faz 1 |
| **AI Plan** | Claude + Grok Dual AI plan üretimi, cross-review | Faz 2 |
| **3D & Render** | Three.js interaktif model + Grok Imagine render | Faz 3 |
| **Fizibilite** | Monte Carlo, nakit akışı, duyarlılık, PDF rapor | Faz 4 |

## Teknoloji Stack

**Frontend:** React 18 + TypeScript + Tailwind CSS + Vite  
**Backend:** FastAPI + Python 3.11+ + Shapely + Pydantic v2  
**AI:** Claude Sonnet 4.6 + Grok 4 (plan) + Grok 2 Image (render)  
**Deploy:** Vercel (frontend) + Railway (backend)

## Kurulum

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## API Dokümantasyonu

Backend çalışırken: http://localhost:8000/docs

## Lisans

MIT
