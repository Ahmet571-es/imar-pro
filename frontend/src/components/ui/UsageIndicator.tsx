/**
 * UsageIndicator — Kompakt plan kullanım göstergesi.
 * Proje sayısı, AI çağrı hakkı progress bar.
 */

import { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface UsageData {
  plan: string
  projects: { used: number; max: number }
  ai_calls: { used: number; max: number; resets_at: string | null }
}

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-slate-500' },
  pro: { label: 'Pro', color: 'bg-sky-500' },
  enterprise: { label: 'Enterprise', color: 'bg-violet-500' },
}

interface Props {
  demoUserId?: string
}

export function UsageIndicator({ demoUserId }: Props) {
  const [data, setData] = useState<UsageData | null>(null)

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
  }

  if (!data) return null

  const plan = PLAN_LABELS[data.plan] || PLAN_LABELS.free
  const aiPct = data.ai_calls.max > 0
    ? Math.min(100, (data.ai_calls.used / data.ai_calls.max) * 100)
    : 0

  return (
    <div className="flex items-center gap-2 bg-white/10 rounded-lg px-2.5 py-1.5">
      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white', plan.color)}>
        {plan.label}
      </span>
      <div className="flex items-center gap-1.5" title={`AI: ${data.ai_calls.used}/${data.ai_calls.max}`}>
        <Zap className="w-3 h-3 text-amber-400" />
        <div className="w-12 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', aiPct > 80 ? 'bg-red-400' : 'bg-amber-400')}
            style={{ width: `${aiPct}%` }}
          />
        </div>
        <span className="text-[9px] text-white/60">{data.ai_calls.used}/{data.ai_calls.max}</span>
      </div>
    </div>
  )
}
