/**
 * AIUsagePanel — AI kullanım detayları paneli.
 * Plan bilgisi, kalan hak, son kullanımlar, yükseltme önerisi.
 */

import { useState, useEffect } from 'react'
import { Zap, TrendingUp, Clock, AlertTriangle, ChevronUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface UsageData {
  plan: string
  projects: { used: number; max: number }
  ai_calls: { used: number; max: number; resets_at: string | null }
  recent_actions: { action: string; date: string }[]
}

const PLAN_INFO: Record<string, { label: string; color: string; features: string[] }> = {
  free: { label: 'Ücretsiz', color: 'bg-slate-500', features: ['3 proje', '10 AI çağrısı/ay', 'PDF rapor'] },
  pro: { label: 'Pro', color: 'bg-sky-500', features: ['50 proje', '500 AI çağrısı/ay', 'IFC export', 'Öncelikli destek'] },
  enterprise: { label: 'Enterprise', color: 'bg-violet-500', features: ['Sınırsız proje', 'Sınırsız AI', 'API erişimi', 'Özel entegrasyon'] },
}

const ACTION_LABELS: Record<string, string> = {
  plan_generate: 'Plan Üretimi',
  ai_review: 'AI Yorum',
  render_room: 'Oda Render',
  render_exterior: 'Dış Cephe Render',
  pdf_export: 'PDF Rapor',
  ifc_export: 'IFC Export',
  dxf_export: 'DXF Export',
  imar_pdf_parse: 'İmar PDF Okuma',
}

interface Props {
  onClose: () => void
  demoUserId?: string
}

export function AIUsagePanel({ onClose, demoUserId }: Props) {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsage()
  }, [])

  const fetchUsage = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (demoUserId) headers['X-Demo-User-Id'] = demoUserId
      const res = await fetch(`${API_BASE}/api/user/usage`, { headers })
      if (res.ok) setData(await res.json())
    } catch { /* sessiz */ }
    setLoading(false)
  }

  if (loading || !data) return null

  const plan = PLAN_INFO[data.plan] || PLAN_INFO.free
  const aiPct = data.ai_calls.max > 0
    ? Math.min(100, Math.round((data.ai_calls.used / data.ai_calls.max) * 100))
    : 0
  const projPct = data.projects.max > 0
    ? Math.min(100, Math.round((data.projects.used / data.projects.max) * 100))
    : 0

  const resetDate = data.ai_calls.resets_at
    ? new Date(data.ai_calls.resets_at).toLocaleDateString('tr-TR')
    : null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <span className="font-semibold text-slate-800">Kullanım Özeti</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Plan badge */}
          <div className="flex items-center gap-3">
            <span className={cn('text-xs font-bold px-3 py-1 rounded-full text-white', plan.color)}>{plan.label}</span>
            <div className="flex flex-wrap gap-1">
              {plan.features.map((f, i) => (
                <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{f}</span>
              ))}
            </div>
          </div>

          {/* AI kullanım */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-slate-700">AI Çağrıları</span>
              <span className="text-sm font-mono">
                <span className={aiPct > 80 ? 'text-red-600 font-bold' : 'text-slate-800'}>{data.ai_calls.used}</span>
                <span className="text-slate-400">/{data.ai_calls.max}</span>
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', aiPct > 80 ? 'bg-red-500' : aiPct > 50 ? 'bg-amber-400' : 'bg-sky-500')}
                style={{ width: `${aiPct}%` }} />
            </div>
            {resetDate && (
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Sıfırlanma: {resetDate}
              </div>
            )}
            {aiPct > 80 && (
              <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                AI limitiniz dolmak üzere. Pro plana yükseltin.
              </div>
            )}
          </div>

          {/* Proje kullanım */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-slate-700">Projeler</span>
              <span className="text-sm font-mono">
                {data.projects.used}<span className="text-slate-400">/{data.projects.max}</span>
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', projPct > 80 ? 'bg-red-500' : 'bg-emerald-500')}
                style={{ width: `${projPct}%` }} />
            </div>
          </div>

          {/* Son kullanımlar */}
          {data.recent_actions.length > 0 && (
            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">Son Kullanımlar</div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {data.recent_actions.slice(0, 8).map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{ACTION_LABELS[a.action] || a.action}</span>
                    <span className="text-slate-400">{new Date(a.date).toLocaleDateString('tr-TR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
