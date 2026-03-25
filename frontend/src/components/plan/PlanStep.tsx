import { useState, useCallback, useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { toast } from '@/stores/toastStore'
import { FloorPlanSVG } from './FloorPlanSVG'
import { PlanRadarChart } from './PlanRadarChart'
import { generatePlan } from '@/services/api'
import { formatNumber, cn } from '@/lib/utils'
import {
  BrainCircuit, ArrowLeft, ArrowRight, Loader2, TriangleAlert,
  Plus, Trash2, Sparkles, Trophy, AlertCircle, CheckCircle2, Info,
  MessageSquareText, Grid3x3,
} from 'lucide-react'

interface OdaInput {
  isim: string
  tip: string
  m2: number
}

interface PlanResult {
  plan_name: string
  source: string
  strategy: string
  reasoning: string
  rooms: {
    name: string; type: string; x: number; y: number
    width: number; height: number; area: number
    is_exterior: boolean; facing: string
    doors: { wall: string; position: number; width: number }[]
    windows: { wall: string; position: number; width: number }[]
  }[]
  total_area: number
  room_count: number
  score: Record<string, string>
  score_total: number
  cross_review_score: number
  cross_review_notes: string
  final_score: number
  validation_warnings: string[]
  validation_fixes: string[]
}

const DAIRE_TIPLERI = ['1+1', '2+1', '3+1', '4+1', '5+1']
const ODA_TIPLERI = [
  { value: 'salon', label: 'Salon' },
  { value: 'yatak_odasi', label: 'Yatak Odası' },
  { value: 'mutfak', label: 'Mutfak' },
  { value: 'banyo', label: 'Banyo' },
  { value: 'wc', label: 'WC' },
  { value: 'antre', label: 'Antre' },
  { value: 'koridor', label: 'Koridor' },
  { value: 'balkon', label: 'Balkon' },
]

const DEFAULT_ODALAR: Record<string, OdaInput[]> = {
  '1+1': [
    { isim: 'Salon', tip: 'salon', m2: 18 },
    { isim: 'Yatak Odası', tip: 'yatak_odasi', m2: 12 },
    { isim: 'Mutfak', tip: 'mutfak', m2: 7 },
    { isim: 'Banyo', tip: 'banyo', m2: 4.5 },
    { isim: 'Antre', tip: 'antre', m2: 4 },
    { isim: 'Balkon', tip: 'balkon', m2: 4 },
  ],
  '2+1': [
    { isim: 'Salon', tip: 'salon', m2: 22 },
    { isim: 'Yatak Odası 1', tip: 'yatak_odasi', m2: 14 },
    { isim: 'Yatak Odası 2', tip: 'yatak_odasi', m2: 12 },
    { isim: 'Mutfak', tip: 'mutfak', m2: 9 },
    { isim: 'Banyo', tip: 'banyo', m2: 5 },
    { isim: 'WC', tip: 'wc', m2: 2.5 },
    { isim: 'Antre', tip: 'antre', m2: 5 },
    { isim: 'Koridor', tip: 'koridor', m2: 4 },
    { isim: 'Balkon', tip: 'balkon', m2: 5 },
  ],
  '3+1': [
    { isim: 'Salon', tip: 'salon', m2: 28 },
    { isim: 'Yatak Odası 1', tip: 'yatak_odasi', m2: 16 },
    { isim: 'Yatak Odası 2', tip: 'yatak_odasi', m2: 14 },
    { isim: 'Yatak Odası 3', tip: 'yatak_odasi', m2: 12 },
    { isim: 'Mutfak', tip: 'mutfak', m2: 11 },
    { isim: 'Banyo', tip: 'banyo', m2: 5.5 },
    { isim: 'WC', tip: 'wc', m2: 2.5 },
    { isim: 'Antre', tip: 'antre', m2: 5.5 },
    { isim: 'Koridor', tip: 'koridor', m2: 5 },
    { isim: 'Balkon 1', tip: 'balkon', m2: 5 },
    { isim: 'Balkon 2', tip: 'balkon', m2: 3.5 },
  ],
  '4+1': [
    { isim: 'Salon', tip: 'salon', m2: 32 },
    { isim: 'Yatak Odası 1', tip: 'yatak_odasi', m2: 18 },
    { isim: 'Yatak Odası 2', tip: 'yatak_odasi', m2: 15 },
    { isim: 'Yatak Odası 3', tip: 'yatak_odasi', m2: 13 },
    { isim: 'Yatak Odası 4', tip: 'yatak_odasi', m2: 12 },
    { isim: 'Mutfak', tip: 'mutfak', m2: 13 },
    { isim: 'Banyo 1', tip: 'banyo', m2: 6 },
    { isim: 'Banyo 2', tip: 'banyo', m2: 4.5 },
    { isim: 'WC', tip: 'wc', m2: 2.5 },
    { isim: 'Antre', tip: 'antre', m2: 6 },
    { isim: 'Koridor', tip: 'koridor', m2: 6 },
    { isim: 'Balkon 1', tip: 'balkon', m2: 6 },
    { isim: 'Balkon 2', tip: 'balkon', m2: 4 },
  ],
  '5+1': [
    { isim: 'Salon', tip: 'salon', m2: 38 },
    { isim: 'Yatak Odası 1', tip: 'yatak_odasi', m2: 20 },
    { isim: 'Yatak Odası 2', tip: 'yatak_odasi', m2: 16 },
    { isim: 'Yatak Odası 3', tip: 'yatak_odasi', m2: 14 },
    { isim: 'Yatak Odası 4', tip: 'yatak_odasi', m2: 13 },
    { isim: 'Yatak Odası 5', tip: 'yatak_odasi', m2: 12 },
    { isim: 'Mutfak', tip: 'mutfak', m2: 15 },
    { isim: 'Banyo 1', tip: 'banyo', m2: 7 },
    { isim: 'Banyo 2', tip: 'banyo', m2: 5 },
    { isim: 'WC', tip: 'wc', m2: 3 },
    { isim: 'Antre', tip: 'antre', m2: 7 },
    { isim: 'Koridor', tip: 'koridor', m2: 7 },
    { isim: 'Balkon 1', tip: 'balkon', m2: 7 },
    { isim: 'Balkon 2', tip: 'balkon', m2: 5 },
  ],
}

export function PlanStep() {
  const {
    parselData, hesaplama, imarParams, setStep, markCompleted, parselTipi,
    planResults, selectedPlanIndex, setPlanResults, setSelectedPlanIndex,
  } = useProjectStore()

  const [daireTipi, setDaireTipi] = useState('3+1')
  const [odalar, setOdalar] = useState<OdaInput[]>(DEFAULT_ODALAR['3+1'])
  const [sunDir, setSunDir] = useState('south')
  const [loading, setLoading] = useState(false)
  const [buildableArea, setBuildableArea] = useState<{ width: number; height: number } | null>(null)
  const [inputMode, setInputMode] = useState<'form' | 'nlp'>('form')
  const [nlpText, setNlpText] = useState('')
  const [showAxisGrid, setShowAxisGrid] = useState(false)

  // Read plans from store (restored from project save)
  const plans: PlanResult[] = (planResults?.alternatives as unknown as PlanResult[]) || []
  const selectedPlan = selectedPlanIndex

  // Restore buildable area from plans if available
  useEffect(() => {
    if (planResults && (planResults as unknown as Record<string, unknown>).buildable_area) {
      setBuildableArea((planResults as unknown as Record<string, unknown>).buildable_area as { width: number; height: number })
    }
  }, [planResults])

  const totalM2 = odalar.reduce((s, o) => s + o.m2, 0)

  const handleDaireTipiChange = (tip: string) => {
    setDaireTipi(tip)
    setOdalar(DEFAULT_ODALAR[tip] || DEFAULT_ODALAR['3+1'])
  }

  const updateOda = (index: number, field: keyof OdaInput, value: string | number) => {
    const next = [...odalar]
    next[index] = { ...next[index], [field]: value }
    setOdalar(next)
  }

  const addOda = () => {
    setOdalar([...odalar, { isim: 'Yeni Oda', tip: 'diger', m2: 8 }])
  }

  const removeOda = (index: number) => {
    setOdalar(odalar.filter((_, i) => i !== index))
  }

  // ── NLP Parser: doğal dil → oda programı ──
  const parseNlpInput = useCallback(() => {
    if (!nlpText.trim()) return
    const text = nlpText.toLowerCase().replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    const origText = nlpText.toLowerCase()

    // Daire tipini algıla
    const tipMatch = text.match(/(\d)\s*\+\s*(\d)/)
    if (!tipMatch) {
      toast.warning('Ayrıştırma', 'Daire tipi bulunamadı. Örnek: "3+1, geniş salon, açık mutfak"')
      return
    }

    const tip = `${tipMatch[1]}+${tipMatch[2]}`
    if (!DEFAULT_ODALAR[tip]) {
      toast.warning('Ayrıştırma', `"${tip}" daire tipi tanımlı değil. Geçerli: 1+1, 2+1, 3+1, 4+1, 5+1`)
      return
    }

    setDaireTipi(tip)
    const newOdalar = [...DEFAULT_ODALAR[tip]]
    const changes: string[] = []

    // Salon tercihleri
    if (origText.includes('geniş salon') || origText.includes('büyük salon') || origText.includes('ferah salon')) {
      const salon = newOdalar.find(o => o.tip === 'salon')
      if (salon) { salon.m2 = Math.round(salon.m2 * 1.25); changes.push('Salon genişletildi') }
    }
    if (origText.includes('küçük salon') || origText.includes('kompakt salon')) {
      const salon = newOdalar.find(o => o.tip === 'salon')
      if (salon) { salon.m2 = Math.round(salon.m2 * 0.80); changes.push('Salon küçültüldü') }
    }

    // Mutfak tercihleri
    if (origText.includes('açık mutfak') || origText.includes('açık plan') || origText.includes('amerikan mutfak')) {
      const mutfak = newOdalar.find(o => o.tip === 'mutfak')
      if (mutfak) { mutfak.m2 = Math.round(mutfak.m2 * 1.35); changes.push('Mutfak genişletildi (açık plan)') }
    }
    if (origText.includes('büyük mutfak') || origText.includes('geniş mutfak')) {
      const mutfak = newOdalar.find(o => o.tip === 'mutfak')
      if (mutfak) { mutfak.m2 = Math.round(mutfak.m2 * 1.20); changes.push('Mutfak genişletildi') }
    }

    // Yatak odası tercihleri
    if (origText.includes('büyük yatak') || origText.includes('geniş yatak') || origText.includes('master yatak')) {
      const yatak = newOdalar.find(o => o.tip === 'yatak_odasi')
      if (yatak) { yatak.m2 = Math.round(yatak.m2 * 1.25); changes.push('Ana yatak odası genişletildi') }
    }
    if (origText.includes('ebeveyn banyo') || origText.includes('en-suite') || origText.includes('yatak banyosu')) {
      // Ebeveyn banyosu ekle (yoksa)
      if (!newOdalar.some(o => o.isim.includes('Ebeveyn'))) {
        newOdalar.push({ isim: 'Ebeveyn Banyo', tip: 'banyo', m2: 4.5 })
        changes.push('Ebeveyn banyosu eklendi')
      }
    }

    // Balkon sayısı
    const balkonMatch = origText.match(/(\d+)\s*balkon/) || origText.match(/(iki|üç|uc)\s*balkon/)
    if (balkonMatch) {
      let count = parseInt(balkonMatch[1])
      if (isNaN(count)) count = balkonMatch[1] === 'iki' ? 2 : balkonMatch[1] === 'üç' || balkonMatch[1] === 'uc' ? 3 : 1
      const existing = newOdalar.filter(o => o.tip === 'balkon')
      if (count > existing.length) {
        for (let i = existing.length; i < count; i++) {
          newOdalar.push({ isim: `Balkon ${i + 1}`, tip: 'balkon', m2: 4 })
        }
        changes.push(`${count} balkon ayarlandı`)
      }
    }
    if (origText.includes('geniş balkon') || origText.includes('büyük balkon')) {
      const balkon = newOdalar.find(o => o.tip === 'balkon')
      if (balkon) { balkon.m2 = Math.round(balkon.m2 * 1.4); changes.push('Balkon genişletildi') }
    }

    // WC tercihleri
    if (origText.includes('ayrı wc') || origText.includes('misafir wc')) {
      if (!newOdalar.some(o => o.tip === 'wc')) {
        newOdalar.push({ isim: 'Misafir WC', tip: 'wc', m2: 2.5 })
        changes.push('Misafir WC eklendi')
      }
    }

    // Depo/kiler
    if (origText.includes('depo') || origText.includes('kiler')) {
      if (!newOdalar.some(o => o.isim.includes('Depo') || o.isim.includes('Kiler'))) {
        newOdalar.push({ isim: 'Kiler/Depo', tip: 'diger', m2: 3 })
        changes.push('Kiler/Depo eklendi')
      }
    }

    // Giyinme odası
    if (origText.includes('giyinme') || origText.includes('walk-in')) {
      if (!newOdalar.some(o => o.isim.includes('Giyinme'))) {
        newOdalar.push({ isim: 'Giyinme Odası', tip: 'diger', m2: 5 })
        changes.push('Giyinme odası eklendi')
      }
    }

    // Çalışma odası
    if (origText.includes('çalışma') || origText.includes('ofis') || origText.includes('home office')) {
      if (!newOdalar.some(o => o.isim.includes('Çalışma'))) {
        newOdalar.push({ isim: 'Çalışma Odası', tip: 'yatak_odasi', m2: 10 })
        changes.push('Çalışma odası eklendi')
      }
    }

    setOdalar(newOdalar)
    const changeText = changes.length > 0 ? ` (${changes.join(', ')})` : ''
    toast.success('Program Oluşturuldu', `${tip} daire — ${newOdalar.length} oda${changeText}`)
  }, [nlpText])

  const handleGenerate = useCallback(async () => {
    if (!parselData) return
    setLoading(true)

    try {
      const params: Record<string, unknown> = {
        parsel_tipi: parselTipi === 'tkgm' ? 'koordinatlar' : parselTipi,
        yon: parselData.yon,
        kat_adedi: imarParams.kat_adedi,
        taks: imarParams.taks,
        kaks: imarParams.kaks,
        on_bahce: imarParams.on_bahce,
        yan_bahce: imarParams.yan_bahce,
        arka_bahce: imarParams.arka_bahce,
        daire_tipi: daireTipi,
        brut_alan: hesaplama?.kat_basi_net_alan || 120,
        odalar: odalar.map((o) => ({ isim: o.isim, tip: o.tip, m2: o.m2 })),
        sun_direction: sunDir,
      }

      if (parselTipi === 'dikdortgen') {
        params.en = parselData.bounds.width
        params.boy = parselData.bounds.height
      } else {
        params.koordinatlar = parselData.koordinatlar.map((c) => ({ x: c.x, y: c.y }))
      }

      const result = await generatePlan(params) as {
        plans: PlanResult[]
        buildable_area: { width: number; height: number }
      }

      // Write to store (persisted)
      setPlanResults({
        alternatives: result.plans as never,
        generation_time_ms: 0,
        buildable_area: result.buildable_area,
      } as never)
      setSelectedPlanIndex(0)
      setBuildableArea(result.buildable_area)

      if (result.plans && result.plans.length > 0) {
        markCompleted('plan')
        toast.success('Plan Üretildi', `${result.plans.length} alternatif plan oluşturuldu`)
      } else {
        toast.warning('Plan Üretimi', 'Plan üretilemedi, parametreleri kontrol edin')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Plan üretim hatası'
      toast.error('Plan Üretim Hatası', msg)
    } finally {
      setLoading(false)
    }
  }, [parselData, parselTipi, imarParams, hesaplama, daireTipi, odalar, sunDir, markCompleted, setPlanResults, setSelectedPlanIndex])

  if (!parselData || !hesaplama) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <TriangleAlert className="w-12 h-12 text-warning mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Parsel ve İmar Tamamlanmadı</h2>
        <p className="text-text-muted mb-4">Önce ilk iki adımı tamamlayın.</p>
        <button onClick={() => setStep('parcel')} className="btn-primary">Parsel Adımına Dön</button>
      </div>
    )
  }

  const activePlan = plans[selectedPlan]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-text">AI Plan Üretimi</h2>
        <p className="text-text-muted text-sm mt-1">
          Daire programını düzenleyin, Claude + Grok Dual AI ile plan üretin
        </p>
      </div>

      {/* Top: Apartment program editor + generate button */}
      <div className="bg-white rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Daire Programı</h3>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {/* Input mode toggle */}
            <div className="flex gap-1 p-0.5 bg-surface-alt rounded-md mr-2">
              <button onClick={() => setInputMode('form')}
                className={cn('px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1',
                  inputMode === 'form' ? 'bg-white text-primary shadow-sm' : 'text-text-muted')}>
                <Grid3x3 className="w-3 h-3" /> Form
              </button>
              <button onClick={() => setInputMode('nlp')}
                className={cn('px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1',
                  inputMode === 'nlp' ? 'bg-white text-primary shadow-sm' : 'text-text-muted')}>
                <MessageSquareText className="w-3 h-3" /> Doğal Dil
              </button>
            </div>
            <span className="text-text-muted">Net alan:</span>
            <span className="font-mono font-bold text-primary">{formatNumber(hesaplama.kat_basi_net_alan)} m²</span>
            <span className="text-text-muted">|</span>
            <span className="text-text-muted">Program:</span>
            <span className={cn('font-mono font-bold', totalM2 > hesaplama.kat_basi_net_alan ? 'text-danger' : 'text-success')}>
              {formatNumber(totalM2)} m²
            </span>
          </div>
        </div>

        {/* NLP Input Mode */}
        {inputMode === 'nlp' && (
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={nlpText}
                onChange={(e) => setNlpText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && parseNlpInput()}
                className="input-field flex-1"
                placeholder='Örn: "3+1, geniş salon, açık mutfak, 2 balkon, ebeveyn banyo, çalışma odası"'
              />
              <button onClick={parseNlpInput} className="btn-primary text-sm px-4">
                Ayrıştır
              </button>
            </div>
            <p className="text-[11px] text-text-light mt-1.5">
              Desteklenen: daire tipi (3+1), geniş/büyük/küçük salon, açık/amerikan mutfak, büyük/master yatak, ebeveyn banyo, N balkon, geniş balkon, misafir WC, kiler/depo, giyinme odası, çalışma odası/home office
            </p>
          </div>
        )}

        {/* Form Input Mode */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Daire tipi */}
          <div className="flex gap-1 p-1 bg-surface-alt rounded-lg">
            {DAIRE_TIPLERI.map((t) => (
              <button key={t} onClick={() => handleDaireTipiChange(t)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  daireTipi === t ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text',
                )}>
                {t}
              </button>
            ))}
          </div>

          {/* Güneş yönü */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">Güneş:</span>
            <select value={sunDir} onChange={(e) => setSunDir(e.target.value)}
              className="input-field py-1.5 text-sm w-28">
              <option value="south">Güney</option>
              <option value="southwest">Güneybatı</option>
              <option value="southeast">Güneydoğu</option>
              <option value="west">Batı</option>
              <option value="east">Doğu</option>
            </select>
          </div>
        </div>

        {/* Room list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4 max-h-64 overflow-y-auto">
          {odalar.map((oda, i) => (
            <div key={i} className="flex items-center gap-2 bg-surface-alt rounded-lg px-3 py-2">
              <input value={oda.isim} onChange={(e) => updateOda(i, 'isim', e.target.value)}
                className="flex-1 text-sm font-medium bg-transparent outline-none min-w-0" />
              <select value={oda.tip} onChange={(e) => updateOda(i, 'tip', e.target.value)}
                className="text-xs bg-white border rounded px-1.5 py-1">
                {ODA_TIPLERI.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input type="number" value={oda.m2} onChange={(e) => updateOda(i, 'm2', Number(e.target.value))}
                className="w-14 text-sm font-mono text-right bg-white border rounded px-1.5 py-1" step={0.5} min={1} />
              <span className="text-xs text-text-muted">m²</span>
              <button onClick={() => removeOda(i)} className="text-text-light hover:text-danger transition-colors p-0.5">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={addOda} className="btn-secondary text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Oda Ekle
          </button>
          <button onClick={handleGenerate} disabled={loading}
            className="btn-primary flex items-center gap-2 text-sm ml-auto">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Planlar Üretiliyor...' : 'AI ile Plan Üret'}
          </button>
        </div>
      </div>

      {/* Results: 3 plans side by side */}
      {plans.length > 0 && (
        <>
          {/* Plan selector tabs */}
          <div className="flex gap-2 mb-4">
            {plans.map((plan, i) => (
              <button key={i} onClick={() => setSelectedPlanIndex(i)}
                className={cn(
                  'flex-1 rounded-xl border p-3 transition-all text-left',
                  selectedPlan === i
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-white hover:border-primary/30',
                )}>
                <div className="flex items-center gap-2 mb-1">
                  {i === 0 && <Trophy className="w-4 h-4 text-accent" />}
                  <span className="text-sm font-semibold">{plan.plan_name}</span>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                    plan.source === 'claude' ? 'bg-blue-100 text-blue-700' :
                    plan.source === 'grok' ? 'bg-purple-100 text-purple-700' :
                    plan.source === 'hybrid' ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700',
                  )}>
                    {plan.source === 'engine' ? 'Motor' : plan.source === 'hybrid' ? 'Hibrit' : plan.source}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span>{plan.room_count} oda</span>
                  <span>{plan.total_area.toFixed(0)} m²</span>
                  <span className="font-bold text-primary">{plan.final_score.toFixed(0)}/100</span>
                </div>
              </button>
            ))}
          </div>

          {/* Active plan detail */}
          {activePlan && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: SVG plan */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-border p-4">
                  <div className="flex items-center justify-end gap-2 mb-2">
                    <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                      <input type="checkbox" checked={showAxisGrid} onChange={(e) => setShowAxisGrid(e.target.checked)}
                        className="rounded w-3 h-3" />
                      Aks Grid
                    </label>
                  </div>
                  <FloorPlanSVG
                    rooms={activePlan.rooms}
                    buildableWidth={buildableArea?.width || 14}
                    buildableHeight={buildableArea?.height || 10}
                    svgWidth={600}
                    svgHeight={480}
                    planName={activePlan.plan_name}
                    showAxisGrid={showAxisGrid}
                  />
                </div>
              </div>

              {/* Right: Score + details */}
              <div className="space-y-4">
                {/* Score summary */}
                <div className="bg-white rounded-xl border border-border p-4">
                  <h4 className="text-xs font-semibold text-text-muted mb-3">PUANLAMA</h4>
                  <div className="text-center mb-4">
                    <div className="text-4xl font-bold text-primary font-mono">
                      {activePlan.final_score.toFixed(0)}
                    </div>
                    <div className="text-xs text-text-muted">/100 Final Skor</div>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(activePlan.score).filter(([k]) => k !== 'TOPLAM').map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">{key}</span>
                        <span className="font-mono font-semibold">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cross-review */}
                {(activePlan.cross_review_notes || activePlan.cross_review_score > 0) && (
                  <div className="bg-white rounded-xl border border-border p-4">
                    <h4 className="text-xs font-semibold text-text-muted mb-2 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      ÇAPRAZ DEĞERLENDİRME
                      <span className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded-full ml-auto font-medium',
                        activePlan.source === 'claude' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700',
                      )}>
                        {activePlan.source === 'claude' ? 'Grok tarafından' : activePlan.source === 'grok' ? 'Claude tarafından' : 'Engine'}
                      </span>
                    </h4>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn(
                        'text-lg font-bold font-mono',
                        activePlan.cross_review_score >= 70 ? 'text-success' :
                        activePlan.cross_review_score >= 50 ? 'text-warning' : 'text-danger'
                      )}>
                        {activePlan.cross_review_score.toFixed(0)}
                      </div>
                      <span className="text-xs text-text-muted">/100</span>
                      {/* Score bar */}
                      <div className="flex-1 h-1.5 bg-surface-alt rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all',
                          activePlan.cross_review_score >= 70 ? 'bg-success' :
                          activePlan.cross_review_score >= 50 ? 'bg-warning' : 'bg-danger'
                        )} style={{ width: `${activePlan.cross_review_score}%` }} />
                      </div>
                    </div>
                    {activePlan.cross_review_notes && (
                      <div className="space-y-1.5 text-xs">
                        {activePlan.cross_review_notes.includes('Güçlü:') && (
                          <div className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-success mt-0.5 shrink-0" />
                            <span className="text-text-muted">{activePlan.cross_review_notes.split('Güçlü:')[1]?.split('.')[0]?.trim()}</span>
                          </div>
                        )}
                        {activePlan.cross_review_notes.includes('Zayıf:') && (
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="w-3 h-3 text-warning mt-0.5 shrink-0" />
                            <span className="text-text-muted">{activePlan.cross_review_notes.split('Zayıf:')[1]?.split('.')[0]?.trim()}</span>
                          </div>
                        )}
                        {activePlan.cross_review_notes.includes('Öneri:') && (
                          <div className="flex items-start gap-1.5">
                            <Sparkles className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                            <span className="text-text-muted">{activePlan.cross_review_notes.split('Öneri:')[1]?.trim()}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Strategy & reasoning */}
                <div className="bg-white rounded-xl border border-border p-4">
                  <h4 className="text-xs font-semibold text-text-muted mb-2">STRATEJİ</h4>
                  <p className="text-sm text-text mb-2">{activePlan.strategy}</p>
                  <p className="text-xs text-text-muted leading-relaxed">{activePlan.reasoning}</p>
                </div>

                {/* Validation */}
                {(activePlan.validation_warnings.length > 0 || activePlan.validation_fixes.length > 0) && (
                  <div className="bg-white rounded-xl border border-border p-4">
                    <h4 className="text-xs font-semibold text-text-muted mb-2">DOĞRULAMA</h4>
                    {activePlan.validation_fixes.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {activePlan.validation_fixes.slice(0, 5).map((f, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-success">
                            <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" /> {f}
                          </div>
                        ))}
                      </div>
                    )}
                    {activePlan.validation_warnings.length > 0 && (
                      <div className="space-y-1">
                        {activePlan.validation_warnings.slice(0, 5).map((w, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-warning">
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> {w}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Radar chart: 9-dimensional comparison of all plans */}
      {plans.length >= 2 && (
        <div className="mt-6">
          <PlanRadarChart plans={plans} />
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        <button onClick={() => setStep('zoning')} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> İmar
        </button>
        <div className="flex-1" />
        <button onClick={() => { markCompleted('plan'); setStep('3d') }}
          disabled={plans.length === 0}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          3D & Render <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
