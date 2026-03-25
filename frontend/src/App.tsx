import { useEffect, useState } from 'react'
import { WizardLayout } from '@/components/layout/WizardLayout'
import { ParcelStep } from '@/components/parcel/ParcelStep'
import { ZoningStep } from '@/components/zoning/ZoningStep'
import { PlanStep } from '@/components/plan/PlanStep'
import { ThreeDStep } from '@/components/three/ThreeDStep'
import { FeasibilityStep } from '@/components/feasibility/FeasibilityStep'
import { AuthPage } from '@/components/auth/AuthPage'
import { ProjectsDashboard } from '@/components/projects/ProjectsDashboard'
import { useProjectStore } from '@/stores/projectStore'
import { useAuthStore } from '@/stores/authStore'
import { Loader2 } from 'lucide-react'

type AppView = 'auth' | 'projects' | 'wizard'

function WizardRouter() {
  const { currentStep } = useProjectStore()
  switch (currentStep) {
    case 'parcel': return <ParcelStep />
    case 'zoning': return <ZoningStep />
    case 'plan': return <PlanStep />
    case '3d': return <ThreeDStep />
    case 'feasibility': return <FeasibilityStep />
    default: return <ParcelStep />
  }
}

export default function App() {
  const { user, loading, initialize } = useAuthStore()
  const [view, setView] = useState<AppView>('auth')

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!loading) {
      if (user) {
        setView('projects')
      } else {
        setView('auth')
      }
    }
  }, [user, loading])

  // Loading splash
  if (loading) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center font-bold text-primary-dark text-3xl mx-auto mb-4 shadow-lg">
            iP
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-white/60 mx-auto mb-2" />
          <p className="text-white/40 text-sm">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  // Auth
  if (view === 'auth' || !user) {
    return <AuthPage />
  }

  // Projects dashboard
  if (view === 'projects') {
    return <ProjectsDashboard onOpenProject={() => setView('wizard')} />
  }

  // Wizard
  return (
    <WizardLayout onBackToProjects={() => setView('projects')}>
      <WizardRouter />
    </WizardLayout>
  )
}
