import { useState, useCallback } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { toast } from '@/stores/toastStore'
import { X, Key, Eye, EyeOff, Trash2, CheckCircle2, AlertCircle, Sparkles, Loader2, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

export function SettingsDialog() {
  const {
    claudeApiKey, grokApiKey, isSettingsOpen,
    setClaudeApiKey, setGrokApiKey, closeSettings, clearKeys,
    hasClaudeKey, hasGrokKey,
  } = useSettingsStore()

  const [showClaude, setShowClaude] = useState(false)
  const [showGrok, setShowGrok] = useState(false)
  const [testingClaude, setTestingClaude] = useState(false)
  const [testingGrok, setTestingGrok] = useState(false)
  const [claudeStatus, setClaudeStatus] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [grokStatus, setGrokStatus] = useState<'idle' | 'ok' | 'fail'>('idle')

  // API key test — Claude
  const testClaudeKey = useCallback(async () => {
    if (!claudeApiKey) return
    setTestingClaude(true)
    setClaudeStatus('idle')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      })
      if (res.ok || res.status === 200) {
        setClaudeStatus('ok')
        toast.success('Claude API', 'Bağlantı başarılı — claude-sonnet-4 aktif')
      } else {
        const err = await res.json().catch(() => ({}))
        setClaudeStatus('fail')
        toast.error('Claude API', (err as Record<string, Record<string, string>>)?.error?.message || `HTTP ${res.status}`)
      }
    } catch (e: unknown) {
      setClaudeStatus('fail')
      toast.error('Claude API', e instanceof Error ? e.message : 'Bağlantı hatası')
    } finally {
      setTestingClaude(false)
    }
  }, [claudeApiKey])

  // API key test — Grok
  const testGrokKey = useCallback(async () => {
    if (!grokApiKey) return
    setTestingGrok(true)
    setGrokStatus('idle')
    try {
      const res = await fetch('https://api.x.ai/v1/models', {
        headers: { 'Authorization': `Bearer ${grokApiKey}` },
      })
      if (res.ok) {
        setGrokStatus('ok')
        toast.success('Grok API', 'Bağlantı başarılı — grok-4 + grok-2-image aktif')
      } else {
        setGrokStatus('fail')
        toast.error('Grok API', `HTTP ${res.status} — Geçersiz anahtar`)
      }
    } catch (e: unknown) {
      setGrokStatus('fail')
      toast.error('Grok API', e instanceof Error ? e.message : 'Bağlantı hatası')
    } finally {
      setTestingGrok(false)
    }
  }, [grokApiKey])

  if (!isSettingsOpen) return null

  const maskKey = (key: string) => {
    if (!key) return ''
    if (key.length <= 12) return '•'.repeat(key.length)
    return key.slice(0, 6) + '•'.repeat(key.length - 10) + key.slice(-4)
  }

  const handleClear = () => {
    clearKeys()
    toast.info('API Anahtarları', 'Tüm anahtarlar temizlendi')
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={closeSettings}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Key className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-text">Ayarlar</h2>
                <p className="text-xs text-text-muted">API anahtarları ve yapılandırma</p>
              </div>
            </div>
            <button onClick={closeSettings} className="p-2 hover:bg-surface-alt rounded-lg transition-colors">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-5">
            {/* Info banner */}
            <div className="flex items-start gap-3 p-3.5 bg-blue-50 rounded-xl border border-blue-100">
              <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                AI plan üretimi ve cross-review için API anahtarları gereklidir. Anahtarlar yalnızca tarayıcınızda saklanır, sunucuya gönderilmez.
              </p>
            </div>

            {/* Claude API Key */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-text mb-2">
                <span className="w-5 h-5 rounded-md bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700">C</span>
                Claude API Key
                {hasClaudeKey() ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success ml-auto" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-text-light ml-auto" />
                )}
              </label>
              <div className="relative">
                <input
                  type={showClaude ? 'text' : 'password'}
                  value={claudeApiKey}
                  onChange={(e) => setClaudeApiKey(e.target.value)}
                  placeholder="sk-ant-api03-..."
                  className="input-field pr-10 font-mono text-xs"
                />
                <button
                  onClick={() => setShowClaude(!showClaude)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-surface-alt rounded-md transition-colors"
                >
                  {showClaude ? (
                    <EyeOff className="w-4 h-4 text-text-muted" />
                  ) : (
                    <Eye className="w-4 h-4 text-text-muted" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-text-light mt-1.5">
                Model: <span className="font-mono">claude-sonnet-4-20250514</span> — Plan üretimi, cross-review, fizibilite yorumu
              </p>
              {hasClaudeKey() && (
                <button onClick={testClaudeKey} disabled={testingClaude}
                  className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                  {testingClaude ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  {testingClaude ? 'Test ediliyor...' : claudeStatus === 'ok' ? '✅ Bağlantı başarılı' : claudeStatus === 'fail' ? '❌ Başarısız — tekrar test et' : 'Bağlantıyı Test Et'}
                </button>
              )}
            </div>

            {/* Grok API Key */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-text mb-2">
                <span className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-700">G</span>
                Grok (xAI) API Key
                {hasGrokKey() ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success ml-auto" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-text-light ml-auto" />
                )}
              </label>
              <div className="relative">
                <input
                  type={showGrok ? 'text' : 'password'}
                  value={grokApiKey}
                  onChange={(e) => setGrokApiKey(e.target.value)}
                  placeholder="xai-..."
                  className="input-field pr-10 font-mono text-xs"
                />
                <button
                  onClick={() => setShowGrok(!showGrok)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-surface-alt rounded-md transition-colors"
                >
                  {showGrok ? (
                    <EyeOff className="w-4 h-4 text-text-muted" />
                  ) : (
                    <Eye className="w-4 h-4 text-text-muted" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-text-light mt-1.5">
                Modeller: <span className="font-mono">grok-4-0620</span> (plan) + <span className="font-mono">grok-2-image</span> (render)
              </p>
              {hasGrokKey() && (
                <button onClick={testGrokKey} disabled={testingGrok}
                  className="mt-2 flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-500 font-medium transition-colors">
                  {testingGrok ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  {testingGrok ? 'Test ediliyor...' : grokStatus === 'ok' ? '✅ Bağlantı başarılı' : grokStatus === 'fail' ? '❌ Başarısız — tekrar test et' : 'Bağlantıyı Test Et'}
                </button>
              )}
            </div>

            {/* Status Summary */}
            <div className="flex items-center gap-3 p-3 bg-surface-alt rounded-xl">
              <div className="flex-1">
                <p className="text-xs font-medium text-text-muted">
                  Durum: {hasClaudeKey() && hasGrokKey()
                    ? '✅ Her iki anahtar aktif — tam AI desteği'
                    : hasClaudeKey() || hasGrokKey()
                    ? '⚠️ Tek anahtar aktif — kısıtlı AI desteği'
                    : '❌ Anahtar yok — demo mod ile devam edilecek'}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface/50">
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 text-xs text-danger hover:text-red-700 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Tümünü Temizle
            </button>
            <button onClick={closeSettings} className="btn-primary text-sm px-5 py-2">
              Tamam
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
