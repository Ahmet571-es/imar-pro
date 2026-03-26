/**
 * OnboardingWizard — Yeni kullanıcılar için interaktif tanıtım.
 * 4 adım: Hoşgeldin → Profil → İlk Proje → Tamamlandı
 */

import { useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import {
  Building2, User, FolderPlus, CheckCircle2, ArrowRight, ArrowLeft, X,
  MapPin, BarChart3, Layers, FileText, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  onComplete: () => void
  onSkip: () => void
}

const STEPS = [
  { id: 'welcome', title: 'imarPRO\'ya Hoş Geldiniz', icon: Sparkles },
  { id: 'profile', title: 'Profiliniz', icon: User },
  { id: 'features', title: 'Neler Yapabilirsiniz', icon: Building2 },
  { id: 'start', title: 'Başlayın', icon: FolderPlus },
]

const FEATURES = [
  { icon: MapPin, title: 'Parsel Analizi', desc: 'TKGM entegrasyonu ile otomatik parsel sorgulama' },
  { icon: Building2, title: 'AI Kat Planı', desc: 'Claude + Grok dual AI ile optimum plan üretimi' },
  { icon: Layers, title: 'BIM LOD 300', desc: 'IFC4 export, clash detection, MEP 6 disiplin' },
  { icon: BarChart3, title: 'Fizibilite', desc: 'Monte Carlo, IRR, senaryo karşılaştırma, kira analizi' },
  { icon: FileText, title: 'PDF Rapor', desc: '20+ sayfa bankaya sunulabilir profesyonel rapor' },
]

export function OnboardingWizard({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0)
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const user = useAuthStore(s => s.user)

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else onComplete()
  }, [step, onComplete])

  const prev = useCallback(() => {
    if (step > 0) setStep(s => s - 1)
  }, [step])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Progress */}
        <div className="flex bg-slate-50 border-b">
          {STEPS.map((s, i) => (
            <div key={s.id} className={cn(
              'flex-1 py-3 text-center text-xs font-medium transition-colors',
              i === step ? 'text-sky-700 bg-sky-50 border-b-2 border-sky-600' :
              i < step ? 'text-green-600' : 'text-slate-400',
            )}>
              {i < step ? <CheckCircle2 className="w-4 h-4 inline" /> : `${i + 1}.`} {s.title.split(' ')[0]}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 min-h-[300px]">
          {/* Step 1: Welcome */}
          {step === 0 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center mx-auto">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">imarPRO'ya Hoş Geldiniz!</h2>
              <p className="text-slate-600">
                Türkiye'nin en gelişmiş gayrimenkul fizibilite ve BIM platformu.
                AI destekli kat planı üretimi, LOD 300 IFC export ve bankaya sunulabilir raporlar.
              </p>
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-sm text-sky-800">
                ✨ Bu kısa tanıtım sizi 2 dakika içinde hazır hale getirecek.
              </div>
            </div>
          )}

          {/* Step 2: Profile */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Profilinizi Tamamlayın</h2>
              <p className="text-sm text-slate-500">Bu bilgiler raporlarınızda kullanılacak.</p>
              <div>
                <label className="text-sm font-medium text-slate-700">Ad Soyad</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder={user?.name || 'Mehmet Yılmaz'}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Şirket (opsiyonel)</label>
                <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                  placeholder="Otonom Reklam Ajansı"
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Telefon (opsiyonel)</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+90 5XX XXX XX XX"
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
              </div>
            </div>
          )}

          {/* Step 3: Features */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Neler Yapabilirsiniz?</h2>
              <div className="space-y-3">
                {FEATURES.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-sky-50 transition">
                    <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
                      <f.icon className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-800">{f.title}</div>
                      <div className="text-xs text-slate-500">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Start */}
          {step === 3 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Her Şey Hazır!</h2>
              <p className="text-slate-600">
                İlk projenizi oluşturmak için "Yeni Proje" butonuna tıklayın.
                Parsel bilgilerini girin, imar parametrelerini ayarlayın ve AI'ın planınızı üretmesini izleyin.
              </p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800 space-y-2">
                <div>🎯 <strong>İpucu:</strong> TKGM entegrasyonu ile parseli otomatik çekebilirsiniz.</div>
                <div>🤖 <strong>İpucu:</strong> AI plan üretimi için Ayarlar'dan API key girin.</div>
                <div>📊 <strong>İpucu:</strong> Fizibilite adımında Monte Carlo simülasyonu otomatik çalışır.</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t">
          <button onClick={onSkip} className="text-sm text-slate-400 hover:text-slate-600 transition">
            Geç
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={prev}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition">
                <ArrowLeft className="w-4 h-4" /> Geri
              </button>
            )}
            <button onClick={next}
              className="flex items-center gap-1 px-6 py-2 text-sm font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition shadow-sm">
              {step === STEPS.length - 1 ? 'Başla' : 'Devam'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
