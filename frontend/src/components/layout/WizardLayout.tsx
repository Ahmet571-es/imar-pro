import { StepNavigation } from './StepNavigation'
import { useAuthStore } from '@/stores/authStore'
import { LogOut, ArrowLeft, Save, User } from 'lucide-react'

interface Props {
  children: React.ReactNode
  onBackToProjects: () => void
}

export function WizardLayout({ children, onBackToProjects }: Props) {
  const { user, signOut, isDemo } = useAuthStore()

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="bg-primary-dark text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBackToProjects}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors mr-1" title="Projelere Dön">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-bold text-primary-dark text-sm">
            iP
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">imarPRO</h1>
            <p className="text-[10px] text-white/50">İmar Uyumlu Kat Planı Üretici</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-2 text-xs text-white/60">
              <User className="w-3.5 h-3.5" />
              <span>{user.name}</span>
              {isDemo && <span className="text-[9px] bg-accent/30 text-accent px-1 py-0.5 rounded">Demo</span>}
            </div>
          )}
          <button onClick={signOut} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Çıkış">
            <LogOut className="w-3.5 h-3.5 text-white/60" />
          </button>
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
