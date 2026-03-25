import { useProjectStore } from '@/stores/projectStore'
import { ArrowLeft, BarChart3, Lock } from 'lucide-react'

export function FeasibilityStep() {
  const { setStep } = useProjectStore()
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 text-primary">
        <BarChart3 className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Fizibilite Analizi</h2>
      <p className="text-text-muted mb-2">
        Monte Carlo, nakit akışı, duyarlılık analizi, IRR/ROI ve bankaya sunulabilir PDF rapor.
      </p>
      <div className="inline-flex items-center gap-1.5 text-xs text-text-light bg-surface-alt px-3 py-1.5 rounded-full mb-8">
        <Lock className="w-3 h-3" />
        Faz 4 ile aktif olacak
      </div>
      <div>
        <button onClick={() => setStep('3d')} className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          3D Adımına Dön
        </button>
      </div>
    </div>
  )
}
