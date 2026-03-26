import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useProjectListStore, type SavedProject } from '@/stores/projectListStore'
import { useProjectStore } from '@/stores/projectStore'
import type { WizardStep } from '@/types'
import { useSettingsStore } from '@/stores/settingsStore'
import { toast } from '@/stores/toastStore'
import {
  Plus, FolderOpen, Trash2, Clock, MapPin, Loader2, Building2, LogOut, User,
  Settings, CheckCircle2, Layers,
} from 'lucide-react'

interface Props {
  onOpenProject: () => void
}

function getProjectSummary(data: Record<string, unknown>): string {
  const parts: string[] = []
  if (data.parselData) parts.push('Parsel')
  if (data.hesaplama) parts.push('İmar')
  if (data.planResults) parts.push('Plan')
  if (data.feasibilityData) parts.push('Fizibilite')
  if (data.earthquakeData) parts.push('Deprem')
  if (data.energyData) parts.push('Enerji')
  return parts.length > 0 ? parts.join(' → ') : 'Boş proje'
}

function getCompletedCount(data: Record<string, unknown>): number {
  const steps = data.completedSteps as string[] | undefined
  return steps?.length || 0
}

export function ProjectsDashboard({ onOpenProject }: Props) {
  const { user, signOut, isDemo } = useAuthStore()
  const { projects, loadingProjects, fetchProjects, saveProject, deleteProject } = useProjectListStore()
  const projectStore = useProjectStore()
  const { openSettings } = useSettingsStore()
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    if (user) fetchProjects(user.id)
  }, [user, fetchProjects])

  const handleCreate = async () => {
    if (!user || !newName.trim()) return

    // Reset store for new project
    projectStore.resetProject()

    const id = await saveProject(user.id, newName.trim(), {})
    if (id) {
      projectStore.setCurrentProject(id, newName.trim())
      projectStore.setStep('parcel')
      toast.success('Proje Oluşturuldu', newName.trim())
      onOpenProject()
    } else {
      toast.error('Hata', 'Proje oluşturulamadı')
    }
    setNewName('')
    setShowNew(false)
  }

  const handleOpen = (project: SavedProject) => {
    // Reset first, then restore all saved state
    projectStore.resetProject()
    projectStore.setCurrentProject(project.id, project.name)
    projectStore.restore(project.data as Record<string, unknown>)

    // Ensure we land on the right step
    const savedStep = project.data?.currentStep as string | undefined
    if (savedStep && ['parcel', 'zoning', 'plan', '3d', 'feasibility'].includes(savedStep)) {
      projectStore.setStep(savedStep as WizardStep)
    }

    toast.info('Proje Açıldı', project.name)
    onOpenProject()
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`"${name}" projesini silmek istediğinize emin misiniz?`)) {
      const success = await deleteProject(id)
      if (success) {
        toast.success('Silindi', `"${name}" projesi silindi`)
      }
    }
  }

  const handleQuickStart = async () => {
    projectStore.resetProject()
    // Auto-create a project so save works
    if (user) {
      const name = `Hızlı Proje — ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
      const id = await saveProject(user.id, name, {})
      if (id) {
        projectStore.setCurrentProject(id, name)
      }
    }
    projectStore.setStep('parcel')
    onOpenProject()
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('tr-TR', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-primary-dark text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center font-bold text-primary-dark text-lg">
              iP
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>imarPRO</h1>
              <p className="text-xs text-white/50">Projelerim</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openSettings}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Ayarlar"
            >
              <Settings className="w-4 h-4 text-white/70" />
            </button>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
              <User className="w-4 h-4 text-white/60" />
              <span className="text-sm">{user?.name || user?.email}</span>
              {isDemo && (
                <span className="text-[9px] bg-accent/30 text-accent px-1.5 py-0.5 rounded-full">Demo</span>
              )}
            </div>
            <button onClick={signOut} className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Çıkış">
              <LogOut className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text" style={{ fontFamily: 'var(--font-display)' }}>Projelerim</h2>
            <p className="text-sm text-text-muted mt-0.5">{projects.length} proje</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Yeni Proje
          </button>
        </div>

        {/* New project modal-like */}
        {showNew && (
          <div className="bg-white rounded-xl border border-primary/20 p-5 mb-6 shadow-sm">
            <h3 className="font-semibold mb-3">Yeni Proje Oluştur</h3>
            <div className="flex gap-3">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                className="input-field flex-1" placeholder="Proje adı (ör: Çankaya 5 Katlı Konut)"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus />
              <button onClick={handleCreate} disabled={!newName.trim()} className="btn-primary">Oluştur</button>
              <button onClick={() => setShowNew(false)} className="btn-secondary">İptal</button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loadingProjects && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!loadingProjects && projects.length === 0 && !showNew && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-10 h-10 text-primary/40" />
            </div>
            <h3 className="text-lg font-semibold text-text mb-1">Henüz projeniz yok</h3>
            <p className="text-sm text-text-muted mb-6">İlk projenizi oluşturarak başlayın</p>
            <button onClick={() => setShowNew(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> İlk Projeni Oluştur
            </button>
          </div>
        )}

        {/* Project grid */}
        {projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const completedCount = getCompletedCount(project.data || {})
              const summary = getProjectSummary(project.data || {})

              return (
                <div key={project.id}
                  className="bg-white rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all group cursor-pointer"
                  onClick={() => handleOpen(project)}>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(project.id, project.name) }}
                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-danger/10 rounded-lg transition-all"
                        title="Sil">
                        <Trash2 className="w-4 h-4 text-danger" />
                      </button>
                    </div>
                    <h3 className="font-semibold text-text mb-1 truncate">{project.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted mb-2">
                      <Clock className="w-3 h-3" />
                      {formatDate(project.updated_at)}
                    </div>
                    {/* Progress indicator */}
                    {completedCount > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-success">
                        <CheckCircle2 className="w-3 h-3" />
                        {completedCount}/5 adım tamamlandı
                      </div>
                    )}
                  </div>
                  <div className="border-t border-border px-5 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-text-light flex items-center gap-1.5">
                      <Layers className="w-3 h-3" />
                      {summary}
                    </span>
                    <FolderOpen className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick start */}
        <div className="mt-8 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl p-6 border border-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-text mb-1">Hızlı Başlangıç</h3>
              <p className="text-sm text-text-muted">Proje oluşturmadan doğrudan parsel girişine geç</p>
            </div>
            <button onClick={handleQuickStart}
              className="btn-primary flex items-center gap-2">
              Başla <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
