import { useState, useCallback, useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { toast } from '@/stores/toastStore'
import { calculateFeasibility } from '@/services/api'
import { formatNumber, cn } from '@/lib/utils'
import { EarthquakePanel } from './EarthquakePanel'
import { EnergyPanel } from './EnergyPanel'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, Cell, LineChart, Line, Legend, ReferenceLine,
} from 'recharts'
import {
  BarChart3, ArrowLeft, Loader2, TriangleAlert, TrendingUp, TrendingDown,
  DollarSign, Percent, Calculator, RefreshCw, Flame, Zap, Clock, Target,
} from 'lucide-react'

interface FeasibilityData {
  ozet: { toplam_gelir: number; toplam_gider: number; kar: number; kar_marji: number; roi: number; basabas_m2: number }
  maliyet: { kalemler: { kalem: string; tutar: number }[]; toplam_maliyet: number; birim_maliyet: number; toplam_insaat_alani: number }
  gelir: { daireler: { daire_no: number; kat: number; tip: string; net_alan: number; satis_fiyati: number; kat_primi_pct: number; cephe_primi_pct: number }[]; toplam_gelir: number }
  duyarlilik: { matris: { kar_marji: number; maliyet_d: number; fiyat_d: number }[][]; maliyet_labels: string[]; fiyat_labels: string[] }
  monte_carlo: { ortalama_kar: number; zarar_olasiligi: number; p5: number; p50: number; p95: number; histogram: { x: number; count: number; is_loss: boolean }[] }
  nakit_akisi: { aylik: { ay: number; kumulatif_gider: number; kumulatif_gelir: number; net: number }[]; payback_ay: number | null }
  irr_yillik: number
  tornado: { parametre: string; dusuk: number; yuksek: number; etki: number; baz: number }[]
  parametreler: { toplam_daire: number; net_alan_per_daire: number; insaat_suresi_ay: number }
}

export function FeasibilityStep() {
  const { parselData, hesaplama, imarParams, setStep, markCompleted, feasibilityData, setFeasibilityData } = useProjectStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FeasibilityData | null>(null)

  // Restore from store if project was loaded
  useEffect(() => {
    if (feasibilityData && !data) {
      setData(feasibilityData as unknown as FeasibilityData)
    }
  }, [feasibilityData, data])

  // Form state
  const [il, setIl] = useState('Ankara')
  const [kalite, setKalite] = useState('orta')
  const [m2Fiyat, setM2Fiyat] = useState(45000)
  const [arsaMaliyeti, setArsaMaliyeti] = useState(5000000)
  const [daireSayisiPerKat, setDaireSayisiPerKat] = useState(2)
  const [insaatSuresi, setInsaatSuresi] = useState(18)
  const [onSatis, setOnSatis] = useState(0.30)

  const handleCalculate = useCallback(async () => {
    if (!hesaplama) return
    setLoading(true)
    setError(null)
    try {
      const result = await calculateFeasibility({
        toplam_insaat_alani: hesaplama.toplam_insaat_alani,
        kat_basi_net_alan: hesaplama.kat_basi_net_alan,
        kat_adedi: imarParams.kat_adedi,
        daire_sayisi_per_kat: daireSayisiPerKat,
        il, kalite,
        arsa_maliyeti: arsaMaliyeti,
        otopark_arac_sayisi: imarParams.kat_adedi * daireSayisiPerKat,
        m2_satis_fiyati: m2Fiyat,
        daire_tipi: '3+1',
        cephe_yon: 'güney',
        insaat_suresi_ay: insaatSuresi,
        satis_suresi_ay: 12,
        on_satis_orani: onSatis,
      }) as FeasibilityData
      setData(result)
      setFeasibilityData(result as never)
      markCompleted('feasibility')
      toast.success('Fizibilite Hesaplandı', `Kâr marjı: %${result.ozet.kar_marji}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Hesaplama hatası'
      setError(msg)
      toast.error('Hesaplama Hatası', msg)
    } finally {
      setLoading(false)
    }
  }, [hesaplama, imarParams, il, kalite, m2Fiyat, arsaMaliyeti, daireSayisiPerKat, insaatSuresi, onSatis, markCompleted, setFeasibilityData])

  if (!parselData || !hesaplama) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <TriangleAlert className="w-12 h-12 text-warning mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Önceki Adımlar Tamamlanmadı</h2>
        <button onClick={() => setStep('parcel')} className="btn-primary">Başa Dön</button>
      </div>
    )
  }

  const fmt = (n: number) => n.toLocaleString('tr-TR')
  const fmtM = (n: number) => `${(n / 1_000_000).toFixed(1)}M`

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-text">Fizibilite Analizi</h2>
        <p className="text-text-muted text-sm mt-1">Kapsamlı maliyet-gelir, Monte Carlo, nakit akışı ve duyarlılık analizi</p>
      </div>

      {/* Input form */}
      <div className="bg-white rounded-xl border border-border p-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">İl</label>
            <select value={il} onChange={(e) => setIl(e.target.value)} className="input-field text-sm">
              {['Ankara', 'İstanbul', 'İzmir', 'Antalya', 'Bursa', 'Konya', 'Kütahya', 'Eskişehir', 'Gaziantep', 'Trabzon'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">Kalite</label>
            <select value={kalite} onChange={(e) => setKalite(e.target.value)} className="input-field text-sm">
              <option value="ekonomik">Ekonomik</option>
              <option value="orta">Orta</option>
              <option value="luks">Lüks</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">m² Satış (₺)</label>
            <input type="number" value={m2Fiyat} onChange={(e) => setM2Fiyat(Number(e.target.value))}
              className="input-field font-mono text-sm" step={1000} />
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">Arsa Maliyeti (₺)</label>
            <input type="number" value={arsaMaliyeti} onChange={(e) => setArsaMaliyeti(Number(e.target.value))}
              className="input-field font-mono text-sm" step={500000} />
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">Daire/Kat</label>
            <input type="number" value={daireSayisiPerKat} onChange={(e) => setDaireSayisiPerKat(Number(e.target.value))}
              className="input-field font-mono text-sm" min={1} max={8} />
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">İnşaat (ay)</label>
            <input type="number" value={insaatSuresi} onChange={(e) => setInsaatSuresi(Number(e.target.value))}
              className="input-field font-mono text-sm" min={6} max={48} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-xs text-text-muted">Ön satış:</label>
            <input type="range" min={0} max={0.6} step={0.05} value={onSatis}
              onChange={(e) => setOnSatis(Number(e.target.value))} className="w-24" />
            <span className="font-mono text-xs">{(onSatis * 100).toFixed(0)}%</span>
          </div>
          <button onClick={handleCalculate} disabled={loading}
            className="btn-primary flex items-center gap-2 text-sm ml-auto">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            Hesapla
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 bg-danger/5 text-danger rounded-lg p-3 text-sm mt-3">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Results */}
      {data && (
        <div className="space-y-6">
          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard icon={<DollarSign />} label="Toplam Maliyet" value={`₺${fmtM(data.ozet.toplam_gider)}`} />
            <MetricCard icon={<TrendingUp />} label="Toplam Gelir" value={`₺${fmtM(data.ozet.toplam_gelir)}`} />
            <MetricCard icon={data.ozet.kar >= 0 ? <TrendingUp /> : <TrendingDown />}
              label="Kâr / Zarar" value={`₺${fmtM(data.ozet.kar)}`}
              accent={data.ozet.kar >= 0 ? 'success' : 'danger'} />
            <MetricCard icon={<Percent />} label="Kâr Marjı" value={`${data.ozet.kar_marji}%`}
              accent={data.ozet.kar_marji >= 15 ? 'success' : data.ozet.kar_marji >= 0 ? 'warning' : 'danger'} />
            <MetricCard icon={<Target />} label="ROI" value={`${data.ozet.roi}%`} />
            <MetricCard icon={<Zap />} label="IRR (Yıllık)" value={`${data.irr_yillik}%`}
              accent={data.irr_yillik >= 20 ? 'success' : data.irr_yillik >= 0 ? 'warning' : 'danger'} />
          </div>

          {/* Row 2: Cost breakdown + Revenue table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost breakdown bar */}
            <div className="bg-white rounded-xl border border-border p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-3">MALİYET DAĞILIMI ({data.maliyet.kalemler.length} Kalem)</h4>
              <div style={{ height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={data.maliyet.kalemler.filter(k => k.tutar > 0).sort((a, b) => b.tutar - a.tutar)} layout="vertical"
                    margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tickFormatter={(v) => fmtM(v)} fontSize={10} />
                    <YAxis type="category" dataKey="kalem" width={140} fontSize={9} />
                    <Tooltip formatter={(v) => `₺${fmt(Number(v))}`} />
                    <Bar dataKey="tutar" fill="#0369a1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Apartment revenue table */}
            <div className="bg-white rounded-xl border border-border p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-3">DAİRE BAZLI GELİR</h4>
              <div className="overflow-auto max-h-[280px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b text-text-muted">
                      <th className="py-1.5 text-left">No</th>
                      <th className="py-1.5 text-left">Kat</th>
                      <th className="py-1.5 text-right">Alan</th>
                      <th className="py-1.5 text-right">Kat P.</th>
                      <th className="py-1.5 text-right font-bold">Fiyat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.gelir.daireler.map((d) => (
                      <tr key={d.daire_no} className="border-b border-border/50 hover:bg-surface-alt">
                        <td className="py-1.5 font-mono">{d.daire_no}</td>
                        <td className="py-1.5">{d.kat === 1 ? 'Zemin' : `Kat ${d.kat}`}</td>
                        <td className="py-1.5 text-right font-mono">{d.net_alan}m²</td>
                        <td className="py-1.5 text-right font-mono text-text-muted">{d.kat_primi_pct > 0 ? '+' : ''}{d.kat_primi_pct}%</td>
                        <td className="py-1.5 text-right font-mono font-bold">₺{fmt(d.satis_fiyati)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Row 3: Cash flow + Sensitivity heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cash flow */}
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> NAKİT AKIŞI
                </h4>
                {data.nakit_akisi.payback_ay && (
                  <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">
                    Payback: {data.nakit_akisi.payback_ay}. ay
                  </span>
                )}
              </div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={data.nakit_akisi.aylik} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="ay" fontSize={9} label={{ value: 'Ay', position: 'insideBottomRight', offset: -5, fontSize: 9 }} />
                    <YAxis tickFormatter={(v) => fmtM(v)} fontSize={9} />
                    <Tooltip formatter={(v) => `₺${fmt(Number(v))}`} />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="kumulatif_gider" stroke="#dc2626" fill="#dc2626" fillOpacity={0.1} name="Küm. Gider" />
                    <Area type="monotone" dataKey="kumulatif_gelir" stroke="#059669" fill="#059669" fillOpacity={0.1} name="Küm. Gelir" />
                    <Line type="monotone" dataKey="net" stroke="#0369a1" strokeWidth={2} dot={false} name="Net" />
                    <Legend fontSize={10} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sensitivity 5x5 heatmap */}
            <div className="bg-white rounded-xl border border-border p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-3">DUYARLILIK 5×5 (Kâr Marjı %)</h4>
              <div className="overflow-auto">
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr>
                      <th className="p-1 text-left text-text-muted">Maliyet↓ / Fiyat→</th>
                      {data.duyarlilik.fiyat_labels.map((l, i) => (
                        <th key={i} className="p-1 text-center">{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.duyarlilik.matris.map((row, ri) => (
                      <tr key={ri}>
                        <td className="p-1 font-semibold">{data.duyarlilik.maliyet_labels[ri]}</td>
                        {row.map((cell, ci) => {
                          const m = cell.kar_marji
                          const bg = m > 20 ? 'bg-green-100 text-green-800'
                            : m > 10 ? 'bg-green-50 text-green-700'
                            : m > 0 ? 'bg-yellow-50 text-yellow-700'
                            : m > -10 ? 'bg-orange-50 text-orange-700'
                            : 'bg-red-100 text-red-800'
                          return (
                            <td key={ci} className={cn('p-1.5 text-center font-bold rounded', bg)}>
                              {m.toFixed(0)}%
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[9px] text-text-light mt-2">Satırlar: inşaat maliyeti değişimi, Sütunlar: satış fiyatı değişimi</p>
            </div>
          </div>

          {/* Row 4: Monte Carlo + Tornado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monte Carlo histogram */}
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" /> MONTE CARLO SİMÜLASYONU
                </h4>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium',
                  data.monte_carlo.zarar_olasiligi < 20 ? 'bg-green-100 text-green-700' :
                  data.monte_carlo.zarar_olasiligi < 50 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700')}>
                  Zarar: %{data.monte_carlo.zarar_olasiligi}
                </span>
              </div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={data.monte_carlo.histogram} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="x" tickFormatter={(v) => fmtM(v)} fontSize={8} />
                    <YAxis fontSize={9} />
                    <Tooltip formatter={(v) => [Number(v), "Simülasyon"]} labelFormatter={(l) => `₺${fmt(Number(l))}`} />
                    <ReferenceLine x={0} stroke="#dc2626" strokeDasharray="3 3" />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                      {data.monte_carlo.histogram.map((entry, i) => (
                        <Cell key={i} fill={entry.is_loss ? '#FCA5A5' : '#6EE7B7'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between text-[10px] text-text-muted mt-1 font-mono">
                <span>P5: ₺{fmtM(data.monte_carlo.p5)}</span>
                <span>P50: ₺{fmtM(data.monte_carlo.p50)}</span>
                <span>P95: ₺{fmtM(data.monte_carlo.p95)}</span>
              </div>
            </div>

            {/* Tornado */}
            <div className="bg-white rounded-xl border border-border p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-3">TORNADO — PARAMETRİK ETKİ</h4>
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={data.tornado} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" tickFormatter={(v) => fmtM(v)} fontSize={9} />
                    <YAxis type="category" dataKey="parametre" width={120} fontSize={9} />
                    <Tooltip formatter={(v) => `₺${fmt(Number(v))}`} />
                    <ReferenceLine x={data.tornado[0]?.baz || 0} stroke="#64748b" strokeDasharray="3 3" label={{ value: 'Baz', fontSize: 8 }} />
                    <Bar dataKey="dusuk" fill="#FCA5A5" name="Düşük" radius={[4, 0, 0, 4]} />
                    <Bar dataKey="yuksek" fill="#6EE7B7" name="Yüksek" radius={[0, 4, 4, 0]} />
                    <Legend fontSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Earthquake + Energy panels */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <EarthquakePanel
            katSayisi={imarParams.kat_adedi}
            binaW={hesaplama.cekme_polygon_coords
              ? Math.max(...hesaplama.cekme_polygon_coords.map(c => c.x)) - Math.min(...hesaplama.cekme_polygon_coords.map(c => c.x))
              : parselData!.bounds.width - imarParams.on_bahce - imarParams.arka_bahce}
            binaH={hesaplama.cekme_polygon_coords
              ? Math.max(...hesaplama.cekme_polygon_coords.map(c => c.y)) - Math.min(...hesaplama.cekme_polygon_coords.map(c => c.y))
              : parselData!.bounds.height - 2 * imarParams.yan_bahce}
          />
          <EnergyPanel
            toplamAlan={hesaplama.toplam_insaat_alani}
            katSayisi={imarParams.kat_adedi}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        <button onClick={() => setStep('3d')} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> 3D & Render
        </button>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string; accent?: 'success' | 'warning' | 'danger'
}) {
  return (
    <div className={cn('metric-card', accent === 'success' && 'border-success/30', accent === 'danger' && 'border-danger/30')}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn('w-4 h-4', accent === 'success' ? 'text-success' : accent === 'danger' ? 'text-danger' : 'text-primary')}>
          {icon}
        </span>
        <span className="text-[10px] text-text-muted">{label}</span>
      </div>
      <div className={cn('text-lg font-bold font-mono',
        accent === 'success' ? 'text-success' : accent === 'danger' ? 'text-danger' : 'text-text')}>
        {value}
      </div>
    </div>
  )
}
