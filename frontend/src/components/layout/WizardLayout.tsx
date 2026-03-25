import { StepNavigation } from './StepNavigation'

interface Props {
  children: React.ReactNode
}

export function WizardLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="bg-primary-dark text-white px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-bold text-primary-dark text-sm">
            iP
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">imarPRO</h1>
            <p className="text-xs text-white/60">İmar Uyumlu Kat Planı Üretici</p>
          </div>
        </div>
      </header>

      {/* Step Navigation */}
      <StepNavigation />

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
