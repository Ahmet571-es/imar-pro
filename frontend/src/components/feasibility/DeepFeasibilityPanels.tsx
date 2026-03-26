/**
 * DeepFeasibilityPanels — Fizibilite derinleştirme panelleri.
 * G1: Senaryo Karşılaştırma
 * G2: Kredi Geri Ödeme
 * G3: Enflasyon Modeli
 * G4: Kira Getirisi
 */

import { useState, useEffect } from 'react'
import {
  calculateScenarios, calculateLoan, calculateInflation, calculateRentYield,
} from '@/services/api'
import {
  BarChart3, CreditCard, TrendingUp, Home, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts'
import { cn } from '@/lib/utils'

interface Props {
  toplamMaliyet: number
  toplamGelir: number
  daireSayisi?: number
}

// ═══════════════════════════════════
// G1: SENARYO KARŞILAŞTIRMA
// ═══════════════════════════════════

export function ScenarioPanel({ toplamMaliyet, toplamGelir }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const result = await calculateScenarios({ baz_maliyet: toplamMaliyet, baz_gelir: toplamGelir })
      setData(result as Record<string, unknown>)
      setExpanded(true)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const senaryolar = (data?.senaryolar || []) as Record<string, unknown>[]
  const chartData = senaryolar.map(s => ({
    name: s.senaryo as string,
    Maliyet: (s.toplam_maliyet as number) / 1e6,
    Gelir: (s.toplam_gelir as number) / 1e6,
    Kâr: (s.kar as number) / 1e6,
  }))

  return (
    <div className="border rounded-xl overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100 transition" onClick={expanded ? () => setExpanded(false) : load}>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-violet-600" />
          <span className="font-semibold text-sm">3 Senaryo Karşılaştırma</span>
        </div>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && data && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {senaryolar.map((s, i) => (
              <div key={i} className={cn('p-3 rounded-lg text-center', i === 0 ? 'bg-green-50 border-green-200 border' : i === 1 ? 'bg-slate-50 border-slate-200 border' : 'bg-red-50 border-red-200 border')}>
                <div className="text-sm font-bold">{s.senaryo as string}</div>
                <div className="text-xl font-bold mt-1">₺{((s.kar as number) / 1e6).toFixed(1)}M</div>
                <div className="text-xs text-slate-500">Kâr Marjı: %{s.kar_marji as number}</div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v: number) => `₺${v}M`} />
              <Tooltip formatter={(v) => typeof v === "number" ? `₺${v.toFixed(1)}M` : v} />
              <Legend />
              <Bar dataKey="Maliyet" fill="#ef4444" />
              <Bar dataKey="Gelir" fill="#22c55e" />
              <Bar dataKey="Kâr" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════
// G2: KREDİ GERİ ÖDEME
// ═══════════════════════════════════

export function LoanPanel({ toplamMaliyet }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [krediOran, setKrediOran] = useState(50) // %50 kredi
  const [faiz, setFaiz] = useState(42)
  const [vade, setVade] = useState(120)

  const load = async () => {
    setLoading(true)
    try {
      const result = await calculateLoan({
        kredi_tutari: toplamMaliyet * krediOran / 100,
        yillik_faiz: faiz / 100,
        vade_ay: vade,
      })
      setData(result as Record<string, unknown>)
      setExpanded(true)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const yillikOzet = (data?.ozet_yillik || []) as Record<string, unknown>[]
  const chartData = yillikOzet.map(y => ({
    yil: `${y.yil}. Yıl`,
    Anapara: (y.toplam_anapara as number) / 1e6,
    Faiz: (y.toplam_faiz as number) / 1e6,
  }))

  return (
    <div className="border rounded-xl overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 transition" onClick={expanded ? () => setExpanded(false) : load}>
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-sm">Kredi Geri Ödeme Planı</span>
        </div>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-slate-500">Kredi Oranı</label>
              <input type="range" min={10} max={80} value={krediOran} onChange={e => setKrediOran(+e.target.value)} className="w-full" />
              <span className="text-xs font-medium">%{krediOran}</span>
            </div>
            <div>
              <label className="text-xs text-slate-500">Yıllık Faiz</label>
              <input type="number" value={faiz} onChange={e => setFaiz(+e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Vade (ay)</label>
              <input type="number" value={vade} onChange={e => setVade(+e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
            </div>
          </div>
          <button onClick={load} className="w-full py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition">Hesapla</button>

          {data && (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-50 rounded p-2">
                  <div className="text-slate-500 text-xs">Aylık Taksit</div>
                  <div className="font-bold">₺{(data.aylik_taksit as number)?.toLocaleString('tr-TR')}</div>
                </div>
                <div className="bg-slate-50 rounded p-2">
                  <div className="text-slate-500 text-xs">Toplam Faiz</div>
                  <div className="font-bold text-red-600">₺{((data.toplam_faiz as number) / 1e6)?.toFixed(1)}M</div>
                </div>
              </div>
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="yil" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v: number) => `₺${v}M`} />
                    <Tooltip formatter={(v) => typeof v === "number" ? `₺${v.toFixed(2)}M` : v} />
                    <Bar dataKey="Anapara" stackId="a" fill="#10b981" />
                    <Bar dataKey="Faiz" stackId="a" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════
// G3: ENFLASYON MODELİ
// ═══════════════════════════════════

export function InflationPanel({ toplamMaliyet, toplamGelir }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const result = await calculateInflation({ baz_maliyet: toplamMaliyet, baz_gelir: toplamGelir })
      setData(result as Record<string, unknown>)
      setExpanded(true)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const projeksiyon = (data?.projeksiyon || []) as Record<string, unknown>[]
  const chartData = projeksiyon.map(p => ({
    yil: `Yıl ${p.yil}`,
    'Nominal Kâr': (p.kar as number) / 1e6,
    'Reel Kâr': (p.reel_kar as number) / 1e6,
  }))

  return (
    <div className="border rounded-xl overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 transition" onClick={expanded ? () => setExpanded(false) : load}>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-orange-600" />
          <span className="font-semibold text-sm">Enflasyon Modeli</span>
        </div>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && data && (
        <div className="p-4 space-y-3">
          <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2">
            ⚠️ {String((data as Record<string, unknown>).uyari || '')}
          </div>
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yil" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v: number) => `₺${v}M`} />
                <Tooltip formatter={(v) => typeof v === "number" ? `₺${v.toFixed(1)}M` : v} />
                <Legend />
                <Line type="monotone" dataKey="Nominal Kâr" stroke="#f97316" strokeWidth={2} />
                <Line type="monotone" dataKey="Reel Kâr" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          )}
          {Boolean((data as Record<string, unknown>).insaat_sonu) && (
            <div className="text-xs grid grid-cols-2 gap-2">
              <div className="bg-slate-50 p-2 rounded">İnşaat sonu maliyet artışı: <strong>%{String(((data as Record<string, unknown>).insaat_sonu as Record<string, unknown>).maliyet_artisi)}</strong></div>
              <div className="bg-slate-50 p-2 rounded">İnşaat sonu gelir artışı: <strong>%{String(((data as Record<string, unknown>).insaat_sonu as Record<string, unknown>).gelir_artisi)}</strong></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════
// G4: KİRA GETİRİSİ
// ═══════════════════════════════════

export function RentYieldPanel({ toplamMaliyet, daireSayisi = 8 }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const result = await calculateRentYield({ toplam_maliyet: toplamMaliyet, daire_sayisi: daireSayisi })
      setData(result as Record<string, unknown>)
      setExpanded(true)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const projeksiyon = (data?.projeksiyon || []) as Record<string, unknown>[]
  const chartData = projeksiyon.map(p => ({
    yil: `${p.yil}. Yıl`,
    'Net Kira': (p.net_kira as number) / 1e6,
    'Kümülatif': (p.kumulatif_net as number) / 1e6,
  }))

  return (
    <div className="border rounded-xl overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-50 to-blue-50 hover:from-sky-100 hover:to-blue-100 transition" onClick={expanded ? () => setExpanded(false) : load}>
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-sky-600" />
          <span className="font-semibold text-sm">Kira Getirisi Analizi</span>
        </div>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && data && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="bg-sky-50 rounded-lg p-2">
              <div className="text-xs text-slate-500">Brüt Verim</div>
              <div className="font-bold text-sky-700">%{data.brut_verim_pct as number}</div>
            </div>
            <div className="bg-sky-50 rounded-lg p-2">
              <div className="text-xs text-slate-500">Net Verim</div>
              <div className="font-bold text-sky-700">%{data.net_verim_pct as number}</div>
            </div>
            <div className="bg-sky-50 rounded-lg p-2">
              <div className="text-xs text-slate-500">Geri Ödeme</div>
              <div className="font-bold text-sky-700">{data.geri_odeme_yili as number || '20+'} yıl</div>
            </div>
          </div>
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yil" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v: number) => `₺${v}M`} />
                <Tooltip formatter={(v) => typeof v === "number" ? `₺${v.toFixed(2)}M` : v} />
                <Area type="monotone" dataKey="Kümülatif" fill="#0ea5e9" fillOpacity={0.2} stroke="#0ea5e9" strokeWidth={2} />
                <Area type="monotone" dataKey="Net Kira" fill="#22c55e" fillOpacity={0.3} stroke="#22c55e" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  )
}
