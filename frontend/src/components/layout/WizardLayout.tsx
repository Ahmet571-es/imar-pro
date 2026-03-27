import { useCallback, useState } from 'react'
import { StepNavigation } from './StepNavigation'
import { ExportDropdown } from './ExportDropdown'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { useProjectListStore } from '@/stores/projectListStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { toast } from '@/stores/toastStore'
import { LogOut, ArrowLeft, Save, User, Settings, Loader2, Cloud, CloudOff, Menu, X } from 'lucide-react'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
      <header className="bg-primary-dark text-white px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onBackToProjects}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0"
            title="Projelere Dön"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-accent rounded-lg flex items-center justify-center font-bold text-primary-dark text-xs sm:text-sm shrink-0">
            iP
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-tight leading-none truncate">
                {currentProjectName || 'imarPRO'}
              </h1>
              {isDirty && (
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" title="Kaydedilmemiş değişiklikler" />
              )}
            </div>
            <p className="text-[11px] text-white/60 flex items-center gap-1">
              {lastSavedAt ? (
                <span className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded">
                  <Cloud className="w-3 h-3 text-success" />
                  <span className="text-success/90 font-medium">{formatLastSaved(lastSavedAt)}</span>
                </span>
              ) : currentProjectId ? (
                <span className="flex items-center gap-1 bg-warning/10 px-1.5 py-0.5 rounded">
                  <CloudOff className="w-3 h-3 text-warning" />
                  <span className="text-warning/90">Kaydedilmedi</span>
                </span>
              ) : (
                <span className="text-white/40">İmar Uyumlu Kat Planı Üretici</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Desktop actions (hidden on mobile) */}
          <div className="hidden sm:flex items-center gap-1.5">
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
                <span>Kaydet</span>
              </button>
            )}

            {/* Export dropdown */}
            <ExportDropdown />

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
                <span>{user.name}</span>
                {isDemo && <span className="text-[10px] bg-accent/30 text-accent px-1 py-0.5 rounded">Demo</span>}
              </div>
            )}

            {/* Sign out */}
            <button onClick={signOut} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Çıkış">
              <LogOut className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>

          {/* Mobile: Save icon + Hamburger */}
          <div className="flex sm:hidden items-center gap-1">
            {currentProjectId && isDirty && (
              <button onClick={handleSave} disabled={loading}
                className="p-1.5 bg-accent text-primary-dark rounded-lg">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-primary-dark border-t border-white/10 px-4 py-3 space-y-2">
          <ExportDropdown />
          <button onClick={() => { openSettings(); setMobileMenuOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/70 hover:bg-white/10 transition-colors">
            <Settings className="w-3.5 h-3.5" /> Ayarlar
          </button>
          {user && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-white/50">
              <User className="w-3.5 h-3.5" />
              {user.name}
              {isDemo && <span className="text-[10px] bg-accent/30 text-accent px-1 py-0.5 rounded">Demo</span>}
            </div>
          )}
          <button onClick={() => { signOut(); setMobileMenuOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-white/10 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Çıkış Yap
          </button>
        </div>
      )}

      {/* Step Navigation */}
      <StepNavigation />

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
