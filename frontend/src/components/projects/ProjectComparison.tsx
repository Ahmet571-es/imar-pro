import { useState, useCallback } from 'react'
import { useProjectListStore, type SavedProject } from '@/stores/projectListStore'
import { toast } from '@/stores/toastStore'
import { compareProjects } from '@/services/api'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend,
} from 'recharts'
import {
  GitCompare, Loader2, TrendingUp, TrendingDown, CheckCircle2,
  BarChart3, X,
} from 'lucide-react'

interface CompareResult {
  projeler: Record<string, unknown>[]
  analiz: {
    en_karli: string
    en_az_karli: string
    en_yuksek_kar_marji: number
    en_dusuk_kar_marji: number
    ortalama_kar_marji: number
  }
}

const METRIC_LABELS: Record<string, string> = {
  arsa_alani_m2: 'Arsa (m²)',
  toplam_insaat_m2: 'İnşaat (m²)',
  toplam_maliyet: 'Maliyet (₺)',
  toplam_gelir: 'Gelir (₺)',
  kar_marji: 'Kâr Marjı',
  irr: 'IRR',
  daire_sayisi: 'Daire',
  deprem_risk: 'Deprem Risk',
  enerji_sinifi: 'Enerji',
}

const BAR_COLORS = ['#0369a1', '#059669', '#d97706', '#dc2626', '#7c3aed']

interface Props {
  onClose: () => void
}

export function ProjectComparison({ onClose }: Props) {
  const { projects } = useProjectListStore()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(false)

  const toggleProject = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 5) next.add(id)
      else toast.warning('Limit', 'En fazla 5 proje karşılaştırılabilir')
      return next
    })
  }

  const handleCompare = useCallback(async () => {
    if (selectedIds.size < 2) {
      toast.warning('Yetersiz', 'En az 2 proje seçin')
      return
    }

    setLoading(true)
    try {
      const selectedProjects = projects
        .filter(p => selectedIds.has(p.id))
        .map(p => ({ name: p.name, data: p.data }))

      const res = await compareProjects(selectedProjects) as CompareResult
      setResult(res)
      toast.success('Karşılaştırma', `${res.projeler.length} proje analiz edildi`)
    } catch (e: unknown) {
      toast.error('Hata', e instanceof Error ? e.message : 'Karşılaştırma hatası')
    } finally { setLoading(false) }
  }, [selectedIds, projects])

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`
    if (Math.abs(n) >= 1_000) return `₺${(n / 1_000).toFixed(0)}K`
    return n.toLocaleString('tr-TR')
  }

  return (
    <div className="bg-white rounded-2xl border border-border shadow-lg p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-primary" /> Proje Karşılaştırma
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-surface-alt rounded-lg"><X className="w-5 h-5 text-text-muted" /></button>
      </div>

      {/* Project selector */}
      {!result && (
        <>
          <p className="text-sm text-text-muted mb-4">Karşılaştırmak istediğiniz projeleri seçin (2-5 proje):</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {projects.map(p => {
              const selected = selectedIds.has(p.id)
              const hasData = p.data && Object.keys(p.data).length > 2
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProject(p.id)}
                  disabled={!hasData}
                  className={cn(
                    'text-left p-3 rounded-xl border-2 transition-all',
                    selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30',
                    !hasData && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {selected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                    <span className="font-medium text-sm truncate">{p.name}</span>
                  </div>
                  {!hasData && <span className="text-[10px] text-text-light">Veri yetersiz</span>}
                </button>
              )
            })}
          </div>
          <button
            onClick={handleCompare}
            disabled={selectedIds.size < 2 || loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            {selectedIds.size} Projeyi Karşılaştır
          </button>
        </>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-success/10 rounded-xl p-4 text-center">
              <TrendingUp className="w-5 h-5 text-success mx-auto mb-1" />
              <div className="text-xs text-text-muted">En Kârlı</div>
              <div className="font-bold text-sm text-success">{result.analiz.en_karli}</div>
              <div className="text-xs font-mono">{(result.analiz.en_yuksek_kar_marji * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-primary/10 rounded-xl p-4 text-center">
              <BarChart3 className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-xs text-text-muted">Ortalama</div>
              <div className="font-bold text-sm text-primary">Kâr Marjı</div>
              <div className="text-xs font-mono">{(result.analiz.ortalama_kar_marji * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-danger/10 rounded-xl p-4 text-center">
              <TrendingDown className="w-5 h-5 text-danger mx-auto mb-1" />
              <div className="text-xs text-text-muted">En Az Kârlı</div>
              <div className="font-bold text-sm text-danger">{result.analiz.en_az_karli}</div>
              <div className="text-xs font-mono">{(result.analiz.en_dusuk_kar_marji * 100).toFixed(1)}%</div>
            </div>
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-text-muted font-medium">Metrik</th>
                  {result.projeler.map((p, i) => (
                    <th key={i} className="text-right py-2 px-2 font-semibold" style={{ color: BAR_COLORS[i] }}>
                      {String(p.proje_adi)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['arsa_alani_m2', 'toplam_insaat_m2', 'daire_sayisi', 'toplam_maliyet', 'toplam_gelir', 'kar_marji', 'irr', 'deprem_risk', 'enerji_sinifi'].map(metric => (
                  <tr key={metric} className="border-b border-border/50 hover:bg-surface-alt/50">
                    <td className="py-2 px-2 text-text-muted">{METRIC_LABELS[metric] || metric}</td>
                    {result.projeler.map((p, i) => {
                      const val = p[metric]
                      let display: string
                      if (metric === 'kar_marji' || metric === 'irr') {
                        display = `${((val as number || 0) * 100).toFixed(1)}%`
                      } else if (metric === 'toplam_maliyet' || metric === 'toplam_gelir') {
                        display = fmt(val as number || 0)
                      } else if (typeof val === 'number') {
                        display = val.toLocaleString('tr-TR')
                      } else {
                        display = String(val || '—')
                      }
                      return (
                        <td key={i} className="text-right py-2 px-2 font-mono font-medium">{display}</td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar chart — kâr marjı karşılaştırma */}
          <div>
            <h4 className="text-xs font-semibold text-text-muted mb-2">KÂR MARJI KARŞILAŞTIRMA</h4>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={result.projeler.map(p => ({
                  name: String(p.proje_adi).slice(0, 15),
                  kar_marji: ((p.kar_marji as number || 0) * 100),
                }))} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={9} />
                  <YAxis fontSize={9} unit="%" />
                  <Tooltip formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
                  <Bar dataKey="kar_marji" radius={[4, 4, 0, 0]}>
                    {result.projeler.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Back button */}
          <button onClick={() => { setResult(null); setSelectedIds(new Set()) }}
            className="btn-secondary text-xs">
            ← Yeniden Seç
          </button>
        </div>
      )}
    </div>
  )
}
