import { useProjectStore } from '@/stores/projectStore'
import { ArrowLeft, BrainCircuit, Box, BarChart3, Lock } from 'lucide-react'

function ComingSoon({ title, icon, description }: { title: string; icon: React.ReactNode; description: string }) {
  const { setStep } = useProjectStore()
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 text-primary">
        {icon}
      </div>
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-text-muted mb-2">{description}</p>
      <div className="inline-flex items-center gap-1.5 text-xs text-text-light bg-surface-alt px-3 py-1.5 rounded-full mb-8">
        <Lock className="w-3 h-3" />
        Faz 2+ ile aktif olacak
      </div>
      <div>
        <button onClick={() => setStep('zoning')} className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          İmar Adımına Dön
        </button>
      </div>
    </div>
  )
}

export function PlanStep() {
  return (
    <ComingSoon
      title="AI Plan Üretimi"
      icon={<BrainCircuit className="w-8 h-8" />}
      description="Claude Sonnet 4.6 + Grok 4 Dual AI ile kat planı üretimi, cross-review ve puanlama."
    />
  )
}

export function ThreeDStep() {
  return (
    <ComingSoon
      title="3D & Render"
      icon={<Box className="w-8 h-8" />}
      description="Three.js ile interaktif 3D model, PBR materyaller, güneş simülasyonu ve Grok Imagine render."
    />
  )
}

export function FeasibilityStep() {
  return (
    <ComingSoon
      title="Fizibilite Analizi"
      icon={<BarChart3 className="w-8 h-8" />}
      description="Monte Carlo, nakit akışı, duyarlılık analizi, IRR/ROI ve bankaya sunulabilir PDF rapor."
    />
  )
}
