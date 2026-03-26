import { useEffect, useState, useCallback } from 'react'
import { WizardLayout } from '@/components/layout/WizardLayout'
import { ParcelStep } from '@/components/parcel/ParcelStep'
import { ZoningStep } from '@/components/zoning/ZoningStep'
import { PlanStep } from '@/components/plan/PlanStep'
import { ThreeDStep } from '@/components/three/ThreeDStep'
import { FeasibilityStep } from '@/components/feasibility/FeasibilityStep'
import { AuthPage } from '@/components/auth/AuthPage'
import { ProjectsDashboard } from '@/components/projects/ProjectsDashboard'
import { LandingPage } from '@/components/landing/LandingPage'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { useProjectStore } from '@/stores/projectStore'
import { useProjectListStore } from '@/stores/projectListStore'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { toast } from '@/stores/toastStore'
import { Loader2 } from 'lucide-react'

type AppView = 'landing' | 'auth' | 'projects' | 'wizard'

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

function AppContent() {
  const { user, loading, initialize } = useAuthStore()
  const { loadFromStorage } = useSettingsStore()
  const { currentProjectId, serialize, markSaved, isDirty } = useProjectStore()
  const { updateProject } = useProjectListStore()
  const [view, setView] = useState<AppView>('landing')

  // Initialize auth + settings
  useEffect(() => {
    initialize()
    loadFromStorage()
  }, [initialize, loadFromStorage])

  // Set view based on auth state (only if not on landing)
  useEffect(() => {
    if (!loading && view !== 'landing') {
      setView(user ? 'projects' : 'auth')
    }
  }, [user, loading, view])

  // Ctrl+S keyboard shortcut for save
  const handleSave = useCallback(async () => {
    if (!currentProjectId || !isDirty) return
    const data = serialize()
    const success = await updateProject(currentProjectId, data as unknown as Record<string, unknown>)
    if (success) {
      markSaved()
      toast.success('Kaydedildi', 'Proje başarıyla güncellendi')
    } else {
      toast.error('Kayıt Hatası', 'Proje kaydedilemedi')
    }
  }, [currentProjectId, isDirty, serialize, updateProject, markSaved])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  // Auto-save when data changes (isDirty) with debounce
  // Uses getState() to avoid stale closures
  const { isDirty: currentDirty, completedSteps } = useProjectStore()
  const completedSize = completedSteps.size

  // Immediate save when a step is completed
  useEffect(() => {
    if (completedSize === 0) return
    const state = useProjectStore.getState()
    if (!state.currentProjectId || !state.isDirty) return
    const data = state.serialize()
    useProjectListStore.getState().updateProject(
      state.currentProjectId,
      data as unknown as Record<string, unknown>
    ).then((success) => {
      if (success) {
        useProjectStore.getState().markSaved()
        toast.info('Otomatik Kayıt', 'Adım tamamlandı — proje kaydedildi')
      }
    })
  }, [completedSize])

  // Debounced auto-save for other changes
  useEffect(() => {
    if (!currentDirty) return
    const timer = setTimeout(async () => {
      const state = useProjectStore.getState()
      if (!state.currentProjectId || !state.isDirty) return
      const data = state.serialize()
      const success = await useProjectListStore.getState().updateProject(
        state.currentProjectId,
        data as unknown as Record<string, unknown>
      )
      if (success) {
        useProjectStore.getState().markSaved()
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [currentDirty])

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

  // Landing page
  if (view === 'landing') {
    return <LandingPage onGetStarted={() => setView(user ? 'projects' : 'auth')} />
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

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
      <ToastContainer />
      <SettingsDialog />
    </ErrorBoundary>
  )
}
