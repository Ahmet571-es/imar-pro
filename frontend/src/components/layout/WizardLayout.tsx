import { useCallback } from 'react'
import { StepNavigation } from './StepNavigation'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { useProjectListStore } from '@/stores/projectListStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { toast } from '@/stores/toastStore'
import { LogOut, ArrowLeft, Save, User, Settings, Loader2, Cloud, CloudOff } from 'lucide-react'

interface Props {
  children: React.ReactNode
  onBackToProjects: () => void
}

export function WizardLayout({ children, onBackToProjects }: Props) {
  const { user, signOut, isDemo } = useAuthStore()
  const {
    currentProjectId, currentProjectName, lastSavedAt, isDirty, loading,
    serialize, markSaved,
  } = useProjectStore()
  const { updateProject } = useProjectListStore()
  const { openSettings } = useSettingsStore()

  const handleSave = useCallback(async () => {
    if (!currentProjectId) {
      toast.warning('Kayıt Yapılamadı', 'Önce bir proje oluşturun veya açın')
      return
    }

    const data = serialize()
    const success = await updateProject(currentProjectId, data as unknown as Record<string, unknown>)

    if (success) {
      markSaved()
      toast.success('Kaydedildi', 'Proje başarıyla güncellendi')
    } else {
      toast.error('Kayıt Hatası', 'Proje kaydedilemedi, lütfen tekrar deneyin')
    }
  }, [currentProjectId, serialize, updateProject, markSaved])

  const formatLastSaved = (iso: string | null): string => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      const now = new Date()
      const diffMs = now.getTime() - d.getTime()
      const diffMin = Math.floor(diffMs / 60000)

      if (diffMin < 1) return 'Az önce'
      if (diffMin < 60) return `${diffMin} dk önce`
      const diffHour = Math.floor(diffMin / 60)
      if (diffHour < 24) return `${diffHour} saat önce`
      return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="bg-primary-dark text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToProjects}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors mr-1"
            title="Projelere Dön"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-bold text-primary-dark text-sm">
            iP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight leading-none">
                {currentProjectName || 'imarPRO'}
              </h1>
              {isDirty && (
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" title="Kaydedilmemiş değişiklikler" />
              )}
            </div>
            <p className="text-[10px] text-white/50">
              {lastSavedAt ? (
                <span className="flex items-center gap-1">
                  <Cloud className="w-2.5 h-2.5" />
                  {formatLastSaved(lastSavedAt)}
                </span>
              ) : currentProjectId ? (
                <span className="flex items-center gap-1">
                  <CloudOff className="w-2.5 h-2.5" />
                  Henüz kaydedilmedi
                </span>
              ) : (
                'İmar Uyumlu Kat Planı Üretici'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Save button */}
          {currentProjectId && (
            <button
              onClick={handleSave}
              disabled={!isDirty || loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isDirty
                  ? 'bg-accent text-primary-dark hover:bg-accent-light'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              }`}
              title={isDirty ? 'Projeyi Kaydet (Ctrl+S)' : 'Değişiklik yok'}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Kaydet</span>
            </button>
          )}

          {/* Settings */}
          <button
            onClick={openSettings}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="Ayarlar"
          >
            <Settings className="w-3.5 h-3.5 text-white/60" />
          </button>

          {/* User info */}
          {user && (
            <div className="flex items-center gap-1.5 text-xs text-white/60 ml-1">
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{user.name}</span>
              {isDemo && <span className="text-[9px] bg-accent/30 text-accent px-1 py-0.5 rounded">Demo</span>}
            </div>
          )}

          {/* Sign out */}
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
