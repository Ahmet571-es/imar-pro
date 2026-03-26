import { useState, useCallback, useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { toast } from '@/stores/toastStore'
import { analyzeEarthquake, getAfadIller, getSeismicForces, getBuildingPeriod } from '@/services/api'
import { cn } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
  BarChart, Bar,
} from 'recharts'
import { Loader2, TriangleAlert, ShieldAlert, Activity, MapPin, ChevronDown, ChevronUp } from 'lucide-react'

interface EarthquakeData {
  parametreler: { ss: number; s1: number; zemin_sinifi: string; zemin_aciklama: string; bks: number; bys: number; deprem_bolgesi: string; risk_seviyesi: string; afad_api: boolean }
  oneriler: { tasiyici_sistem: string; kolon_grid: string; perde: string }
  kolon_grid: { x_akslar: number[]; y_akslar: number[]; kolon_boyut: number[]; aks_isimleri_x: string[]; aks_isimleri_y: string[]; kolon_sayisi: number } | null
  spektrum: { T: number; Sa: number }[]
  taban_kesme: { T1_sn: number; Sa_T1_g: number; R: number; W_kN: number; Vt_kN: number; Vt_W_orani: number }
  detaylar: string[]
}

interface AfadIl { il: string; plaka: number; ss: number; s1: number; latitude: number; longitude: number }

interface Props {
  katSayisi: number
  binaW: number
  binaH: number
  il?: string
}

export function EarthquakePanel({ katSayisi, binaW, binaH, il = 'Ankara' }: Props) {
  const { earthquakeData, setEarthquakeData } = useProjectStore()
  const [data, setData] = useState<EarthquakeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zemin, setZemin] = useState('ZC')
  const [selectedIl, setSelectedIl] = useState(il)
  const [afadIller, setAfadIller] = useState<AfadIl[]>([])

  // Fetch AFAD iller list on mount
  useEffect(() => {
    getAfadIller()
      .then((iller) => setAfadIller(iller as AfadIl[]))
      .catch(() => {
        // Fallback: at least provide Ankara
        setAfadIller([{ il: 'Ankara', plaka: 6, ss: 0.411, s1: 0.109, latitude: 39.93, longitude: 32.86 }])
      })
  }, [])

  // Restore from store
  useEffect(() => {
    if (earthquakeData && !data) {
      setData(earthquakeData as EarthquakeData)
    }
  }, [earthquakeData, data])

  // Sync il prop
  useEffect(() => { if (il) setSelectedIl(il) }, [il])

  const getIlCoords = useCallback(() => {
    const found = afadIller.find(i => i.il === selectedIl)
    return found ? { lat: found.latitude, lon: found.longitude } : { lat: 39.93, lon: 32.86 }
  }, [selectedIl, afadIller])

  const handleAnalyze = useCallback(async () => {
    setLoading(true); setError(null)
    const coords = getIlCoords()
    try {
      const result = await analyzeEarthquake({
        latitude: coords.lat, longitude: coords.lon,
        kat_sayisi: katSayisi, zemin_sinifi: zemin,
        bina_genisligi: binaW, bina_derinligi: binaH,
        il_adi: selectedIl,
      }) as EarthquakeData
      setData(result)
      setEarthquakeData(result)
      toast.success('Deprem Analizi', `${selectedIl} — Risk: ${result.parametreler.risk_seviyesi}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Deprem analizi hatası'
      setError(msg)
      toast.error('Deprem Analizi Hatası', msg)
    } finally { setLoading(false) }
  }, [katSayisi, binaW, binaH, zemin, selectedIl, setEarthquakeData, getIlCoords])

  const riskColor = (r: string) => r === 'Dusuk' ? 'text-green-600' : r === 'Orta' ? 'text-yellow-600' : r === 'Yuksek' ? 'text-orange-600' : 'text-red-600'

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <ShieldAlert className="w-5 h-5 text-primary" /> Deprem Risk Analizi
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-text-muted" />
            <select value={selectedIl} onChange={(e) => setSelectedIl(e.target.value)} className="input-field text-xs py-1 w-32">
              {afadIller.length > 0 ? (
                afadIller.map(i => <option key={i.plaka} value={i.il}>{i.il} (Ss={i.ss})</option>)
              ) : (
                <option value="Ankara">Ankara</option>
              )}
            </select>
          </div>
          <select value={zemin} onChange={(e) => setZemin(e.target.value)} className="input-field text-xs py-1 w-20">
            {['ZA', 'ZB', 'ZC', 'ZD', 'ZE'].map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          <button onClick={handleAnalyze} disabled={loading} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
            Analiz Et
          </button>
        </div>
      </div>

      {error && <div className="text-xs text-danger flex items-center gap-1.5 mb-3"><TriangleAlert className="w-3.5 h-3.5" />{error}</div>}

      {data && (
        <div className="space-y-4">
          {/* Parameters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniCard label="Ss (Kısa Periyot)" value={data.parametreler.ss.toFixed(3)} />
            <MiniCard label="S1 (1sn Periyot)" value={data.parametreler.s1.toFixed(3)} />
            <MiniCard label="Risk Seviyesi" value={data.parametreler.risk_seviyesi} className={riskColor(data.parametreler.risk_seviyesi)} />
            <MiniCard label="Deprem Bölgesi" value={data.parametreler.deprem_bolgesi} />
          </div>

          {/* Design spectrum */}
          <div>
            <h4 className="text-xs font-semibold text-text-muted mb-2">TASARIM SPEKTRUMU (TBDY 2018)</h4>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={data.spektrum} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="T" fontSize={9} label={{ value: 'Periyot (sn)', position: 'insideBottomRight', offset: -5, fontSize: 9 }} />
                  <YAxis fontSize={9} label={{ value: 'Sa (g)', angle: -90, position: 'insideLeft', fontSize: 9 }} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(3)}g`} labelFormatter={(l) => `T = ${l} sn`} />
                  <ReferenceLine x={data.taban_kesme.T1_sn} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'T₁', fontSize: 9, fill: '#dc2626' }} />
                  <Line type="monotone" dataKey="Sa" stroke="#0369a1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Base shear + recommendations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-surface-alt rounded-lg p-3">
              <h4 className="text-xs font-semibold text-text-muted mb-2">TABAN KESME KUVVETİ</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-text-muted">T₁ (Doğal Periyot)</span><span className="font-mono font-bold">{data.taban_kesme.T1_sn} sn</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Sa(T₁)</span><span className="font-mono font-bold">{data.taban_kesme.Sa_T1_g}g</span></div>
                <div className="flex justify-between"><span className="text-text-muted">R (Süneklik)</span><span className="font-mono font-bold">{data.taban_kesme.R}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">W (Ağırlık)</span><span className="font-mono font-bold">{data.taban_kesme.W_kN.toLocaleString()} kN</span></div>
                <div className="flex justify-between border-t pt-1 mt-1"><span className="font-semibold">Vt (Taban Kesme)</span><span className="font-mono font-bold text-primary">{data.taban_kesme.Vt_kN.toLocaleString()} kN</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Vt/W</span><span className="font-mono">{data.taban_kesme.Vt_W_orani}%</span></div>
              </div>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <h4 className="text-xs font-semibold text-text-muted mb-2">ÖNERİLER</h4>
              <div className="space-y-2 text-xs">
                <div><span className="text-text-muted">Taşıyıcı:</span> <span className="font-semibold">{data.oneriler.tasiyici_sistem}</span></div>
                <div><span className="text-text-muted">Kolon Grid:</span> <span className="font-semibold">{data.oneriler.kolon_grid}</span></div>
                <div><span className="text-text-muted">Perde:</span> <span className="font-semibold">{data.oneriler.perde}</span></div>
                {data.kolon_grid && <div><span className="text-text-muted">Kolon Sayısı:</span> <span className="font-semibold">{data.kolon_grid.kolon_sayisi} adet ({data.kolon_grid.kolon_boyut[0]*100}×{data.kolon_grid.kolon_boyut[1]*100}cm)</span></div>}
              </div>
            </div>
          </div>

          {/* Kat Kuvvet Dağılımı (Derinleştirme) */}
          <FloorForceChart
            katSayisi={katSayisi}
            katAlan={binaW * binaH}
            ss={data.parametreler.ss}
            s1={data.parametreler.s1}
            zemin={zemin}
          />
        </div>
      )}
    </div>
  )
}

function MiniCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-surface-alt rounded-lg px-3 py-2">
      <div className="text-[10px] text-text-muted">{label}</div>
      <div className={cn('text-sm font-bold font-mono', className || 'text-text')}>{value}</div>
    </div>
  )
}

// ── Kat Kuvvet Dağılımı Alt Bileşeni ──
function FloorForceChart({ katSayisi, katAlan, ss, s1, zemin }: {
  katSayisi: number; katAlan: number; ss: number; s1: number; zemin: string
}) {
  const [forceData, setForceData] = useState<{ katlar: { kat: number; deprem_kuvveti_kn: number; kat_kesme_kn: number }[]; taban_kesme_kn: number } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadForces = async () => {
    setLoading(true)
    try {
      const result = await getSeismicForces({
        kat_sayisi: katSayisi, kat_alan: katAlan,
        ss, s1, zemin_sinifi: zemin,
      }) as typeof forceData & { katlar: { kat: number; deprem_kuvveti_kn: number; kat_kesme_kn: number }[] }
      setForceData(result)
      setExpanded(true)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const chartData = forceData?.katlar.map(k => ({
    name: `Kat ${k.kat}`,
    'Deprem Kuvveti (kN)': k.deprem_kuvveti_kn,
    'Kat Kesme (kN)': k.kat_kesme_kn,
  })) || []

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 bg-red-50 hover:bg-red-100 transition text-sm"
        onClick={expanded ? () => setExpanded(false) : loadForces}
      >
        <span className="font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-red-600" /> Kat Bazlı Deprem Kuvveti Dağılımı
        </span>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && forceData && (
        <div className="p-3">
          <div className="text-xs text-slate-500 mb-2">
            Taban Kesme: <strong>{forceData.taban_kesme_kn?.toLocaleString()} kN</strong> — Üçgensel dağılım (TBDY 2018)
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ left: 5, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={9} tickFormatter={(v: number) => `${v} kN`} />
                <YAxis type="category" dataKey="name" fontSize={9} width={45} />
                <Tooltip formatter={(v) => typeof v === "number" ? `${v.toFixed(1)} kN` : v} />
                <Bar dataKey="Deprem Kuvveti (kN)" fill="#ef4444" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Kat Kesme (kN)" fill="#f97316" radius={[0, 4, 4, 0]} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
