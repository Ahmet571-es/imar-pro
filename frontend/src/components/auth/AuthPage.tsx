import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import { Loader2, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react'

export function AuthPage() {
  const { signIn, signUp, continueAsGuest, error, loading, isDemo } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'login') {
      await signIn(email, password)
    } else {
      await signUp(email, password, name)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-primary to-primary-light flex">
      {/* Left: branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          {/* Blueprint grid background */}
          <svg width="100%" height="100%">
            <defs>
              <pattern id="bp" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#bp)" />
          </svg>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center font-bold text-primary-dark text-2xl shadow-lg">
              iP
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>imarPRO</h1>
              <p className="text-white/60 text-sm">İmar Uyumlu Kat Planı Üretici</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-6" style={{ fontFamily: 'var(--font-display)' }}>
            Türkiye'nin En Gelişmiş<br />
            Gayrimenkul Fizibilite<br />
            Platformu
          </h2>
          <div className="space-y-4 text-white/80">
            <Feature emoji="🤖" text="Dual AI ile kat planı üretimi (Claude + Grok)" />
            <Feature emoji="🏗️" text="İnteraktif 3D bina modeli ve fotogerçekçi render" />
            <Feature emoji="📊" text="Monte Carlo, nakit akışı, IRR — bankaya sunulabilir" />
            <Feature emoji="🔬" text="TBDY 2018 deprem analizi + enerji performans A-G" />
            <Feature emoji="📐" text="DXF/SVG export — AutoCAD uyumlu mimari çizim" />
          </div>
        </div>
      </div>

      {/* Right: auth form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center font-bold text-primary-dark text-lg shadow-lg">
              iP
            </div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>imarPRO</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h3 className="text-xl font-bold text-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>
              {mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
            </h3>
            <p className="text-sm text-text-muted mb-6">
              {mode === 'login' ? 'Projelerinize erişin' : 'Ücretsiz hesabınızı oluşturun'}
            </p>

            {isDemo && (
              <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 text-xs text-text-muted mb-4">
                Demo mod — Supabase yapılandırılmamış. Giriş bilgileri yerel olarak saklanır.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1 block">Ad Soyad</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      className="input-field pl-10" placeholder="Mehmet Yılmaz" required />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-text-muted mb-1 block">E-posta</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-10" placeholder="ornek@email.com" required />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted mb-1 block">Şifre</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                  <input type={showPw ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-10 pr-10" placeholder="••••••••" required minLength={6} />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light hover:text-text">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-danger bg-danger/5 rounded-lg px-3 py-2">{error}</div>
              )}

              <button type="submit" disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-sm text-primary hover:underline">
                {mode === 'login' ? 'Hesabınız yok mu? Kayıt olun' : 'Zaten hesabınız var mı? Giriş yapın'}
              </button>
            </div>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-text-light">veya</span></div>
            </div>

            <button onClick={continueAsGuest}
              className="btn-secondary w-full flex items-center justify-center gap-2">
              Misafir Olarak Devam Et
            </button>
          </div>

          <p className="text-center text-xs text-white/40 mt-6">
            © 2025 imarPRO — Üniversite İnşaat Mühendisliği Projesi
          </p>
        </div>
      </div>
    </div>
  )
}

function Feature({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl">{emoji}</span>
      <span className="text-sm">{text}</span>
    </div>
  )
}
