import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MapPin, BrainCircuit, Box, BarChart3, FileText, Building2,
  ChevronRight, ChevronLeft, Shield, Zap, ArrowRight,
  CheckCircle2, Sparkles,
} from 'lucide-react'

interface Props {
  onGetStarted: () => void
  onLegal?: () => void
}

// ── Animated building silhouette (SVG) ──
function BuildingSilhouette() {
  return (
    <svg viewBox="0 0 600 400" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Sky gradient */}
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c4a6e" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#0c4a6e" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="buildingGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0369a1" />
          <stop offset="100%" stopColor="#082f49" />
        </linearGradient>
        <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      <rect width="600" height="400" fill="url(#sky)" rx="16" />

      {/* Ground */}
      <rect x="0" y="340" width="600" height="60" fill="#0c4a6e" opacity="0.08" rx="0" />
      <line x1="0" y1="340" x2="600" y2="340" stroke="#0c4a6e" strokeWidth="1" opacity="0.15" />

      {/* Building 1 — tall tower */}
      <g className="animate-[slideUp_1s_ease-out_0.2s_both]">
        <rect x="80" y="100" width="100" height="240" fill="url(#buildingGrad)" rx="4" opacity="0.9" />
        {/* Windows */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map(row => (
          [0, 1, 2].map(col => (
            <rect
              key={`w1-${row}-${col}`}
              x={92 + col * 30}
              y={115 + row * 27}
              width="18"
              height="14"
              fill="url(#glassGrad)"
              rx="1"
              className="animate-[fadeIn_0.3s_ease-out_both]"
              style={{ animationDelay: `${0.5 + row * 0.1 + col * 0.05}s` }}
            />
          ))
        )).flat()}
        {/* Roof detail */}
        <rect x="115" y="88" width="30" height="16" fill="#0369a1" rx="2" opacity="0.7" />
      </g>

      {/* Building 2 — medium */}
      <g className="animate-[slideUp_1s_ease-out_0.4s_both]">
        <rect x="200" y="160" width="120" height="180" fill="url(#buildingGrad)" rx="4" opacity="0.75" />
        {[0, 1, 2, 3, 4, 5].map(row => (
          [0, 1, 2, 3].map(col => (
            <rect
              key={`w2-${row}-${col}`}
              x={210 + col * 27}
              y={173 + row * 27}
              width="16"
              height="14"
              fill="url(#glassGrad)"
              rx="1"
              className="animate-[fadeIn_0.3s_ease-out_both]"
              style={{ animationDelay: `${0.8 + row * 0.08 + col * 0.04}s` }}
            />
          ))
        )).flat()}
      </g>

      {/* Building 3 — short wide */}
      <g className="animate-[slideUp_1s_ease-out_0.6s_both]">
        <rect x="340" y="210" width="140" height="130" fill="url(#buildingGrad)" rx="4" opacity="0.65" />
        {[0, 1, 2, 3].map(row => (
          [0, 1, 2, 3, 4].map(col => (
            <rect
              key={`w3-${row}-${col}`}
              x={350 + col * 26}
              y={222 + row * 27}
              width="16"
              height="14"
              fill="url(#glassGrad)"
              rx="1"
              className="animate-[fadeIn_0.3s_ease-out_both]"
              style={{ animationDelay: `${1.0 + row * 0.06 + col * 0.03}s` }}
            />
          ))
        )).flat()}
        {/* Balconies */}
        {[0, 1, 2].map(i => (
          <rect key={`b-${i}`} x={350 + i * 46} y={318} width="26" height="4" fill="#0369a1" opacity="0.4" rx="1" />
        ))}
      </g>

      {/* Small building bg */}
      <g className="animate-[slideUp_0.8s_ease-out_0.1s_both]">
        <rect x="500" y="250" width="70" height="90" fill="#0c4a6e" opacity="0.2" rx="3" />
      </g>

      {/* Measurement lines (architectural feel) */}
      <g opacity="0.3" className="animate-[fadeIn_1s_ease-out_1.5s_both]">
        <line x1="80" y1="355" x2="180" y2="355" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 2" />
        <text x="130" y="368" textAnchor="middle" fontSize="9" fill="#f59e0b" fontWeight="600">12.00m</text>
        <line x1="200" y1="355" x2="320" y2="355" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 2" />
        <text x="260" y="368" textAnchor="middle" fontSize="9" fill="#f59e0b" fontWeight="600">15.00m</text>
      </g>

      {/* North arrow */}
      <g transform="translate(560, 30)" className="animate-[fadeIn_0.5s_ease-out_2s_both]">
        <line x1="0" y1="20" x2="0" y2="0" stroke="#dc2626" strokeWidth="1.5" />
        <polygon points="-4,4 0,-4 4,4" fill="#dc2626" />
        <text x="0" y="-8" textAnchor="middle" fontSize="9" fontWeight="700" fill="#dc2626">K</text>
      </g>
    </svg>
  )
}

// ── Features data ──
const FEATURES = [
  {
    icon: MapPin,
    title: 'Parsel Analizi',
    desc: 'TKGM entegrasyonu, otomatik çokgen hesaplama, çekme mesafesi görselleştirme',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: Building2,
    title: 'İmar Hesaplama',
    desc: 'TAKS/KAKS, bina yüksekliği, nizam kontrolü — tüm imar parametreleri anında',
    color: 'text-indigo-600 bg-indigo-50',
  },
  {
    icon: BrainCircuit,
    title: 'AI Kat Planı',
    desc: 'Claude + Grok dual AI mimari zeka ile 5 farklı plan stratejisi, cross-review',
    color: 'text-violet-600 bg-violet-50',
  },
  {
    icon: Box,
    title: '3D/4D/5D BIM',
    desc: 'Gerçek zamanlı 3D model, inşaat simülasyonu, maliyet ısı haritası, PBR materyaller',
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    icon: BarChart3,
    title: 'Fizibilite Raporu',
    desc: 'Monte Carlo, IRR, nakit akışı, duyarlılık analizi — bankaya sunulabilir PDF',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    icon: Shield,
    title: 'Deprem + Enerji',
    desc: 'AFAD 81 il tablosu, TBDY 2018 spektrumu, A-G enerji sınıfı, yalıtım karşılaştırma',
    color: 'text-red-600 bg-red-50',
  },
]

// ── Screenshots carousel ──
const SCREENSHOTS = [
  { id: 1, title: 'Parsel & İmar Analizi', desc: 'Otomatik TAKS/KAKS hesaplama, çekme mesafesi görselleştirme, SVG parsel çizimi' },
  { id: 2, title: 'AI Kat Planı Üretimi', desc: 'Dual AI motoruyla 5 farklı plan, mimari SVG, radar puanlama, cross-review' },
  { id: 3, title: '3D BIM & Fizibilite', desc: '3D model, PBR materyaller, 15 sayfa PDF rapor, Monte Carlo simülasyonu' },
]

// ── Stats ──
const STATS = [
  { value: '81', label: 'İl Deprem Verisi' },
  { value: '5', label: 'AI Plan Stratejisi' },
  { value: '15+', label: 'Sayfa PDF Rapor' },
  { value: '6', label: 'Görünüm Modu' },
]

export function LandingPage({ onGetStarted, onLegal }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const slideTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  // Auto-advance carousel
  useEffect(() => {
    slideTimer.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SCREENSHOTS.length)
    }, 5000)
    return () => clearInterval(slideTimer.current)
  }, [])

  const goToSlide = useCallback((i: number) => {
    setCurrentSlide(i)
    clearInterval(slideTimer.current)
    slideTimer.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SCREENSHOTS.length)
    }, 5000)
  }, [])

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-primary/20">
              iP
            </div>
            <div>
              <span className="text-lg font-bold text-primary tracking-tight">imar</span>
              <span className="text-lg font-bold text-accent tracking-tight">PRO</span>
            </div>
          </div>
          <button
            onClick={onGetStarted}
            className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2"
          >
            Başla
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="pt-24 pb-12 sm:pt-32 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-semibold mb-4 sm:mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              AI Destekli Gayrimenkul Fizibilite Platformu
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-dark leading-tight mb-4 sm:mb-6">
              Arsadan <span className="text-accent">Fizibiliteye</span> Tek Platform
            </h1>
            <p className="text-base sm:text-lg text-text-muted leading-relaxed mb-6 sm:mb-8 max-w-lg">
              İmar uyumlu AI kat planı üretimi, 3D/4D/5D BIM modelleme,
              profesyonel fizibilite raporu — hepsi tek çatı altında.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-8 sm:mb-10">
              <button
                onClick={onGetStarted}
                className="btn-primary text-base px-8 py-3.5 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                Hemen Başla
                <ChevronRight className="w-5 h-5" />
              </button>
              <a
                href="#features"
                className="btn-secondary text-base px-8 py-3.5 flex items-center justify-center gap-2"
              >
                Özellikleri İncele
              </a>
            </div>
            {/* Trust signals */}
            <div className="flex items-center gap-4 flex-wrap">
              {['TBDY 2018 Uyumlu', 'AFAD Entegrasyonu', 'BEP-TR Hesaplama'].map((t) => (
                <span key={t} className="flex items-center gap-1 text-xs text-text-muted">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 border border-border/50">
              <BuildingSilhouette />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="py-8 bg-primary-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-accent">{s.value}</div>
              <div className="text-xs sm:text-sm text-white/60 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 bg-surface">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary-dark mb-3">
              Profesyonel İş Akışı
            </h2>
            <p className="text-text-muted text-sm sm:text-base max-w-xl mx-auto">
              Parsel analizinden bankaya sunulabilir fizibilite raporuna kadar tüm süreç tek platformda.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-border p-5 sm:p-6 hover:shadow-lg hover:border-primary-light/30 transition-all duration-300 group"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.color} group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-sm sm:text-base text-text mb-2">{f.title}</h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Screenshots Carousel ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary-dark mb-3">
              Platform Önizleme
            </h2>
            <p className="text-text-muted text-sm sm:text-base">
              Her adımda profesyonel BIM kalitesinde çıktı
            </p>
          </div>

          <div className="relative">
            {/* Slide content */}
            <div className="bg-gradient-to-br from-primary-dark to-primary rounded-2xl p-6 sm:p-10 min-h-[280px] sm:min-h-[360px] flex items-center justify-center relative overflow-hidden">
              {/* Decorative grid */}
              <div className="absolute inset-0 opacity-5">
                <svg width="100%" height="100%">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>

              <div className="relative z-10 text-center max-w-lg">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  {currentSlide === 0 && <MapPin className="w-7 h-7 text-accent" />}
                  {currentSlide === 1 && <BrainCircuit className="w-7 h-7 text-accent" />}
                  {currentSlide === 2 && <Box className="w-7 h-7 text-accent" />}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
                  {SCREENSHOTS[currentSlide].title}
                </h3>
                <p className="text-white/70 text-sm sm:text-base leading-relaxed">
                  {SCREENSHOTS[currentSlide].desc}
                </p>
              </div>
            </div>

            {/* Navigation arrows */}
            <button
              onClick={() => goToSlide((currentSlide - 1 + SCREENSHOTS.length) % SCREENSHOTS.length)}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-primary" />
            </button>
            <button
              onClick={() => goToSlide((currentSlide + 1) % SCREENSHOTS.length)}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-primary" />
            </button>

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-4 sm:mt-6">
              {SCREENSHOTS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === currentSlide ? 'w-8 bg-primary' : 'w-2 bg-border-strong'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gradient-to-br from-primary-dark to-primary">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Projenizi Şimdi Başlatın
          </h2>
          <p className="text-white/70 text-sm sm:text-base mb-8 max-w-lg mx-auto">
            Parsel bilgilerini girin, AI kat planınızı üretin, 3D modelinizi inceleyin
            ve bankaya sunulabilir fizibilite raporunuzu indirin.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-light text-primary-dark font-bold px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl text-base sm:text-lg transition-all shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 hover:-translate-y-0.5"
          >
            <Zap className="w-5 h-5" />
            Ücretsiz Dene
          </button>
          <p className="text-white/40 text-xs mt-4">Demo modu ile hemen keşfedin — kayıt gerekli değil</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-6 sm:py-8 px-4 sm:px-6 bg-primary-dark/95 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-accent rounded-lg flex items-center justify-center font-bold text-primary-dark text-[10px]">iP</div>
            <span className="text-xs text-white/40">imarPRO — Gayrimenkul Fizibilite & AI Kat Planı Platformu</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/30">
            {onLegal && (
              <>
                <button onClick={onLegal} className="hover:text-white/60 transition-colors">KVKK</button>
                <button onClick={onLegal} className="hover:text-white/60 transition-colors">Gizlilik</button>
                <button onClick={onLegal} className="hover:text-white/60 transition-colors">Kullanım Şartları</button>
                <span className="hidden sm:inline">|</span>
              </>
            )}
            <span>© {new Date().getFullYear()} imarPRO</span>
          </div>
        </div>
      </footer>

      {/* ── CSS Animations ── */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
