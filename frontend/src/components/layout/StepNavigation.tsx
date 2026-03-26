import { useProjectStore } from '@/stores/projectStore'
import type { WizardStep, StepInfo } from '@/types'
import { cn } from '@/lib/utils'
import { MapPin, Building2, BrainCircuit, Box, BarChart3, Check } from 'lucide-react'

const STEPS: StepInfo[] = [
  { id: 'parcel', label: 'Parcel', labelTr: 'Parsel', icon: 'MapPin', path: 'parcel', phase: 1, enabled: true },
  { id: 'zoning', label: 'Zoning', labelTr: 'İmar', icon: 'Building2', path: 'zoning', phase: 1, enabled: true },
  { id: 'plan', label: 'AI Plan', labelTr: 'AI Plan', icon: 'BrainCircuit', path: 'plan', phase: 2, enabled: true },
  { id: '3d', label: '3D & Render', labelTr: '3D & Render', icon: 'Box', path: '3d', phase: 3, enabled: true },
  { id: 'feasibility', label: 'Feasibility', labelTr: 'Fizibilite', icon: 'BarChart3', path: 'feasibility', phase: 4, enabled: true },
]

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MapPin, Building2, BrainCircuit, Box, BarChart3,
}

export function StepNavigation() {
  const { currentStep, setStep, completedSteps } = useProjectStore()

  const completionPercent = Math.round((completedSteps.size / STEPS.length) * 100)

  return (
    <nav className="w-full bg-white border-b border-border">
      {/* Progress bar */}
      <div className="h-0.5 bg-border/30">
        <div
          className="h-full bg-success transition-all duration-500 ease-out"
          style={{ width: `${completionPercent}%` }}
        />
      </div>
      <div className="px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-1">
        {STEPS.map((step, i) => {
          const Icon = ICON_MAP[step.icon]
          const isActive = currentStep === step.id
          const isCompleted = completedSteps.has(step.id)
          const isAccessible = step.enabled || isCompleted || isActive

          return (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => isAccessible && setStep(step.id)}
                disabled={!isAccessible}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium w-full',
                  isActive && 'bg-primary/10 text-primary',
                  isCompleted && !isActive && 'text-success',
                  !isActive && !isCompleted && isAccessible && 'text-text-muted hover:bg-surface-alt',
                  !isAccessible && 'text-text-light cursor-not-allowed opacity-50',
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all',
                    isActive && 'bg-primary text-white',
                    isCompleted && !isActive && 'bg-success text-white',
                    !isActive && !isCompleted && 'bg-surface-alt text-text-muted',
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="w-4 h-4" />
                  ) : Icon ? (
                    <Icon className="w-4 h-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-xs opacity-60">Adım {i + 1}</span>
                  <span className="leading-tight">{step.labelTr}</span>
                </div>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'hidden sm:block w-8 h-0.5 mx-1 rounded shrink-0',
                    isCompleted ? 'bg-success' : 'bg-border',
                  )}
                />
              )}
            </div>
          )
        })}
        </div>
        {/* Completion % */}
        {completionPercent > 0 && completionPercent < 100 && (
          <div className="ml-2 text-[10px] text-text-muted font-mono shrink-0">
            %{completionPercent}
          </div>
        )}
        {completionPercent === 100 && (
          <div className="ml-2 text-[10px] text-success font-semibold shrink-0">
            ✓ Tamamlandı
          </div>
        )}
      </div>
    </nav>
  )
}

export { STEPS }
