/**
 * DisciplineToggle — BIM disiplin katmanlarını açıp kapama paneli.
 * D1-D5: 6 disiplin toggle, renk paleti, fade animasyonu, disiplin bazlı BOQ.
 */

import { useState, useEffect, useCallback } from 'react'
import { getBIMDisciplines, runClashDetection, getMEPSchematic } from '@/services/api'
import {
  Layers, Building2, Columns3, Zap, Droplets, Wind, Flame,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  building: Building2,
  columns: Columns3,
  zap: Zap,
  droplets: Droplets,
  wind: Wind,
  flame: Flame,
}

interface Discipline {
  id: string
  name: string
  icon: string
  color: string
  elements: string[]
  default_visible: boolean
}

interface ClashResult {
  toplam_kontrol: number
  toplam_cakisma: number
  kritik: number
  uyari: number
  bilgi: number
  sonuc: string
  cakismalar: {
    element_a: string
    element_b: string
    clash_type: string
    severity: string
    description: string
    resolution: string
  }[]
}

interface MEPResult {
  toplam_node: number
  toplam_hat: number
  toplam_fitting: number
  toplam_uzunluk_m: number
  yuk_dengesi: {
    toplam_guc_kw: number
    ana_sigorta_a: number
    faz_dengesizligi_pct: number
    pano_kapasitesi: string
  }
  maliyet_tahmini: {
    toplam_tl: number
    disiplin_bazli: Record<string, number>
  }
}

interface Props {
  rooms: Record<string, unknown>[]
  buildableWidth?: number
  buildableHeight?: number
  katSayisi?: number
  onVisibilityChange?: (visibleDisciplines: Set<string>) => void
}

export function DisciplineToggle({ rooms, buildableWidth = 14, buildableHeight = 10, katSayisi = 4, onVisibilityChange }: Props) {
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [visible, setVisible] = useState<Set<string>>(new Set(['mimari', 'struktur']))
  const [bimLevel, setBimLevel] = useState('LOD 200')
  const [expanded, setExpanded] = useState(true)
  const [loading, setLoading] = useState(false)

  // Clash detection
  const [clashResult, setClashResult] = useState<ClashResult | null>(null)
  const [clashExpanded, setClashExpanded] = useState(false)
  const [clashLoading, setClashLoading] = useState(false)

  // MEP
  const [mepResult, setMepResult] = useState<MEPResult | null>(null)
  const [mepExpanded, setMepExpanded] = useState(false)

  useEffect(() => {
    loadDisciplines()
  }, [])

  const loadDisciplines = async () => {
    setLoading(true)
    try {
      const data = await getBIMDisciplines()
      setDisciplines(data.disciplines)
      setBimLevel(data.bim_level)
      const defaults = new Set(data.disciplines.filter(d => d.default_visible).map(d => d.id))
      setVisible(defaults)
      onVisibilityChange?.(defaults)
    } catch {
      // fallback
      setDisciplines([
        { id: 'mimari', name: 'Mimari', icon: 'building', color: '#0369a1', elements: ['duvar', 'pencere', 'kapi'], default_visible: true },
        { id: 'struktur', name: 'Strüktür', icon: 'columns', color: '#b91c1c', elements: ['kolon', 'kiris'], default_visible: true },
        { id: 'elektrik', name: 'Elektrik', icon: 'zap', color: '#d97706', elements: ['pano', 'kablo'], default_visible: false },
        { id: 'mekanik', name: 'Mekanik', icon: 'droplets', color: '#2563eb', elements: ['boru', 'musluk'], default_visible: false },
        { id: 'havalandirma', name: 'Havalandırma', icon: 'wind', color: '#059669', elements: ['kanal', 'menfez'], default_visible: false },
        { id: 'yangin', name: 'Yangın', icon: 'flame', color: '#dc2626', elements: ['sprinkler'], default_visible: false },
      ])
    } finally {
      setLoading(false)
    }
  }

  const toggleDiscipline = useCallback((id: string) => {
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      onVisibilityChange?.(next)
      return next
    })
  }, [onVisibilityChange])

  const runClash = async () => {
    setClashLoading(true)
    try {
      const result = await runClashDetection({
        rooms,
        kat_sayisi: katSayisi,
      }) as ClashResult
      setClashResult(result)
      setClashExpanded(true)
    } catch (err) {
      console.error('Clash detection hatası:', err)
    } finally {
      setClashLoading(false)
    }
  }

  const loadMEP = async () => {
    try {
      const result = await getMEPSchematic({
        rooms,
        buildable_width: buildableWidth,
        buildable_height: buildableHeight,
        kat_sayisi: katSayisi,
      }) as MEPResult
      setMepResult(result)
      setMepExpanded(true)
    } catch (err) {
      console.error('MEP hatası:', err)
    }
  }

  const severityColor = (s: string) => {
    if (s === 'critical') return 'bg-red-100 text-red-800'
    if (s === 'warning') return 'bg-amber-100 text-amber-800'
    return 'bg-blue-100 text-blue-800'
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-600" />
          <span className="font-semibold text-sm text-slate-800">BIM Disiplinler</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">{bimLevel}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="p-3 space-y-2">
          {/* Discipline toggles */}
          {disciplines.map(d => {
            const Icon = ICON_MAP[d.icon] || Layers
            const isVisible = visible.has(d.id)

            return (
              <button
                key={d.id}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
                  isVisible
                    ? 'bg-slate-100 shadow-sm'
                    : 'bg-slate-50/50 opacity-50 hover:opacity-75',
                )}
                onClick={() => toggleDiscipline(d.id)}
              >
                <div
                  className="w-3 h-3 rounded-full transition-transform"
                  style={{
                    backgroundColor: isVisible ? d.color : '#cbd5e1',
                    transform: isVisible ? 'scale(1)' : 'scale(0.6)',
                  }}
                />
                <span className="w-4 h-4" style={{ color: isVisible ? d.color : '#94a3b8' }}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className={cn('text-sm flex-1 text-left', isVisible ? 'text-slate-800 font-medium' : 'text-slate-400')}>
                  {d.name}
                </span>
                <span className="text-xs text-slate-400">{d.elements.length} tip</span>
              </button>
            )
          })}

          {/* Aktif sayacı */}
          <div className="text-xs text-center text-slate-500 pt-1">
            {visible.size}/{disciplines.length} aktif
          </div>

          {/* Clash Detection butonu */}
          <button
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-medium transition"
            onClick={runClash}
            disabled={clashLoading}
          >
            {clashLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            Çakışma Kontrolü
          </button>

          {/* MEP butonu */}
          <button
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-sm font-medium transition"
            onClick={loadMEP}
          >
            <Droplets className="w-4 h-4" />
            MEP Tesisat Analizi
          </button>

          {/* Clash Results */}
          {clashResult && (
            <div className="mt-2 border-t pt-2">
              <button
                className="w-full flex items-center justify-between text-sm"
                onClick={() => setClashExpanded(!clashExpanded)}
              >
                <span className="flex items-center gap-2">
                  {clashResult.kritik === 0
                    ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                    : <AlertTriangle className="w-4 h-4 text-red-600" />
                  }
                  <span className="font-medium">{clashResult.sonuc}</span>
                </span>
                {clashExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {clashExpanded && clashResult.cakismalar.length > 0 && (
                <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                  {clashResult.cakismalar.map((c, i) => (
                    <div key={i} className={cn('text-xs p-2 rounded', severityColor(c.severity))}>
                      <div className="font-medium">{c.description}</div>
                      <div className="opacity-75 mt-0.5">💡 {c.resolution}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MEP Results */}
          {mepResult && mepExpanded && (
            <div className="mt-2 border-t pt-2 space-y-1.5">
              <div className="text-sm font-medium text-slate-700">MEP Özeti</div>
              <div className="grid grid-cols-3 gap-1 text-xs">
                <div className="bg-slate-50 rounded p-1.5 text-center">
                  <div className="font-bold text-slate-800">{mepResult.toplam_node}</div>
                  <div className="text-slate-500">Düğüm</div>
                </div>
                <div className="bg-slate-50 rounded p-1.5 text-center">
                  <div className="font-bold text-slate-800">{mepResult.toplam_hat}</div>
                  <div className="text-slate-500">Hat</div>
                </div>
                <div className="bg-slate-50 rounded p-1.5 text-center">
                  <div className="font-bold text-slate-800">{mepResult.toplam_fitting}</div>
                  <div className="text-slate-500">Bağlantı</div>
                </div>
              </div>
              {mepResult.yuk_dengesi && (
                <div className="text-xs bg-yellow-50 rounded p-2">
                  <span className="font-medium">⚡ Elektrik:</span>{' '}
                  {mepResult.yuk_dengesi.toplam_guc_kw} kW,{' '}
                  {mepResult.yuk_dengesi.pano_kapasitesi}
                </div>
              )}
              <div className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded p-2">
                💰 MEP Maliyet: ₺{(mepResult.maliyet_tahmini?.toplam_tl || 0).toLocaleString('tr-TR')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
