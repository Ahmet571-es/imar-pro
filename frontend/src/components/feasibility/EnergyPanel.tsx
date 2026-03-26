import { useState, useCallback, useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { toast } from '@/stores/toastStore'
import { calculateEnergy, getMonthlyEnergy, getSolarROI, getHeatLossMap } from '@/services/api'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  AreaChart, Area, Legend, PieChart, Pie, LineChart, Line,
} from 'recharts'
import { Loader2, TriangleAlert, Leaf, Zap, ThermometerSun, Sun, Flame, ChevronDown, ChevronUp } from 'lucide-react'

interface EnergyData {
  enerji_sinifi: string
  sinif_bilgi: { max_kwh: number; renk: string; aciklama: string }
  tum_siniflar: Record<string, { max_kwh: number; renk: string; aciklama: string }>
  isitma_kwh_m2: number
  sogutma_kwh_m2: number
  toplam_kwh_m2: number
  yillik_maliyet_tl: number
  u_degerleri: { duvar: number; pencere: number; cati: number }
  pencere_duvar_orani: number
  gunes_kazanci_kwh: number
  oneriler: string[]
  yalitim_karsilastirma: { yalitim: string; u_degeri: number; kwh_m2: number; sinif: string; maliyet_tl: number; secili: boolean }[]
  pencere_karsilastirma: { pencere: string; u_degeri: number; kwh_m2: number; sinif: string; maliyet_tl: number; secili: boolean }[]
}

interface Props {
  toplamAlan: number
  katSayisi: number
}

export function EnergyPanel({ toplamAlan, katSayisi }: Props) {
  const { energyData, setEnergyData } = useProjectStore()
  const [data, setData] = useState<EnergyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duvarYalitim, setDuvarYalitim] = useState('duvar_8cm_eps')
  const [pencereTipi, setPencereTipi] = useState('isicam')

  // Restore from store
  useEffect(() => {
    if (energyData && !data) {
      setData(energyData as EnergyData)
    }
  }, [energyData, data])

  const handleCalc = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const result = await calculateEnergy({
        toplam_alan: toplamAlan, kat_sayisi: katSayisi,
        duvar_yalitim: duvarYalitim, pencere_tipi: pencereTipi,
        cati_yalitimli: true, pencere_duvar_orani: 0.25,
        isitma_sistemi: 'dogalgaz_kombi', latitude: 39.93,
      }) as EnergyData
      setData(result)
      setEnergyData(result)
      toast.success('Enerji Hesaplandı', `Enerji sınıfı: ${result.enerji_sinifi}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Enerji hesap hatası'
      setError(msg)
      toast.error('Enerji Hesaplama Hatası', msg)
    } finally { setLoading(false) }
  }, [toplamAlan, katSayisi, duvarYalitim, pencereTipi, setEnergyData])

  const fmt = (n: number) => n.toLocaleString('tr-TR')

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Leaf className="w-5 h-5 text-success" /> Enerji Performans
        </h3>
        <div className="flex items-center gap-2">
          <select value={duvarYalitim} onChange={(e) => setDuvarYalitim(e.target.value)} className="input-field text-xs py-1 w-32">
            <option value="duvar_5cm_eps">5cm EPS</option>
            <option value="duvar_8cm_eps">8cm EPS</option>
            <option value="duvar_10cm_eps">10cm EPS</option>
            <option value="duvar_12cm_xps">12cm XPS</option>
          </select>
          <select value={pencereTipi} onChange={(e) => setPencereTipi(e.target.value)} className="input-field text-xs py-1 w-24">
            <option value="tek_cam">Tek Cam</option>
            <option value="cift_cam">Çift Cam</option>
            <option value="isicam">Isıcam</option>
            <option value="low_e">Low-E</option>
          </select>
          <button onClick={handleCalc} disabled={loading} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThermometerSun className="w-3 h-3" />}
            Hesapla
          </button>
        </div>
      </div>

      {error && <div className="text-xs text-danger flex items-center gap-1.5 mb-3"><TriangleAlert className="w-3.5 h-3.5" />{error}</div>}

      {data && (
        <div className="space-y-4">
          {/* Energy class bar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex gap-0.5">
              {Object.entries(data.tum_siniflar).map(([sinif, info]) => (
                <div key={sinif} className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg transition-all',
                  sinif === data.enerji_sinifi ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-60',
                )} style={{ backgroundColor: info.renk }}>
                  {sinif}
                </div>
              ))}
            </div>
            <div className="ml-3">
              <div className="text-2xl font-bold" style={{ color: data.sinif_bilgi.renk }}>{data.enerji_sinifi} Sınıfı</div>
              <div className="text-xs text-text-muted">{data.sinif_bilgi.aciklama} — {data.toplam_kwh_m2} kWh/m²·yıl</div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniCard label="Isıtma" value={`${data.isitma_kwh_m2} kWh/m²`} icon={<ThermometerSun className="w-3.5 h-3.5 text-orange-500" />} />
            <MiniCard label="Soğutma" value={`${data.sogutma_kwh_m2} kWh/m²`} icon={<Zap className="w-3.5 h-3.5 text-blue-500" />} />
            <MiniCard label="Yıllık Maliyet" value={`₺${fmt(data.yillik_maliyet_tl)}`} icon={<Zap className="w-3.5 h-3.5 text-primary" />} />
            <MiniCard label="Güneş Kazancı" value={`${fmt(data.gunes_kazanci_kwh)} kWh`} icon={<Leaf className="w-3.5 h-3.5 text-success" />} />
          </div>

          {/* U Values */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-alt rounded-lg p-3 text-center">
              <div className="text-[10px] text-text-muted">Duvar U</div>
              <div className="text-lg font-bold font-mono text-primary">{data.u_degerleri.duvar}</div>
              <div className="text-[9px] text-text-muted">W/m²K</div>
            </div>
            <div className="bg-surface-alt rounded-lg p-3 text-center">
              <div className="text-[10px] text-text-muted">Pencere U</div>
              <div className="text-lg font-bold font-mono text-primary">{data.u_degerleri.pencere}</div>
              <div className="text-[9px] text-text-muted">W/m²K</div>
            </div>
            <div className="bg-surface-alt rounded-lg p-3 text-center">
              <div className="text-[10px] text-text-muted">Çatı U</div>
              <div className="text-lg font-bold font-mono text-primary">{data.u_degerleri.cati}</div>
              <div className="text-[9px] text-text-muted">W/m²K</div>
            </div>
          </div>

          {/* Insulation comparison chart */}
          {data.yalitim_karsilastirma.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-muted mb-2">YALITIM KARŞILAŞTIRMA</h4>
              <div style={{ height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={data.yalitim_karsilastirma} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="yalitim" fontSize={9} />
                    <YAxis fontSize={9} label={{ value: 'kWh/m²', angle: -90, position: 'insideLeft', fontSize: 9 }} />
                    <Tooltip formatter={(v) => `${Number(v)} kWh/m²`} />
                    <Bar dataKey="kwh_m2" radius={[4, 4, 0, 0]}>
                      {data.yalitim_karsilastirma.map((entry, i) => (
                        <Cell key={i} fill={entry.secili ? '#0369a1' : '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Window type comparison chart */}
          {data.pencere_karsilastirma && data.pencere_karsilastirma.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-muted mb-2">PENCERE TİPİ KARŞILAŞTIRMA</h4>
              <div style={{ height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={data.pencere_karsilastirma} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="pencere" fontSize={9} />
                    <YAxis fontSize={9} label={{ value: 'kWh/m²', angle: -90, position: 'insideLeft', fontSize: 9 }} />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => [`${Number(v)} kWh/m²`, 'Enerji']}
                      labelFormatter={(label) => {
                        const item = data.pencere_karsilastirma.find(p => p.pencere === label)
                        return item ? `${label} (U=${item.u_degeri} W/m²K) — Sınıf ${item.sinif}` : String(label)
                      }}
                    />
                    <Bar dataKey="kwh_m2" radius={[4, 4, 0, 0]}>
                      {data.pencere_karsilastirma.map((entry, i) => (
                        <Cell key={i} fill={entry.secili ? '#0d9488' : '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {data.pencere_karsilastirma.map((p, i) => (
                  <div key={i} className={cn(
                    'text-center px-2 py-1.5 rounded-lg text-[10px] border',
                    p.secili ? 'bg-teal-50 border-teal-300 text-teal-800 font-semibold' : 'bg-surface-alt border-transparent text-text-muted'
                  )}>
                    <div className="font-mono text-xs">{p.u_degeri}</div>
                    <div>U (W/m²K)</div>
                    <div className="font-semibold text-xs mt-0.5">₺{p.maliyet_tl.toLocaleString('tr-TR')}/yıl</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {data.oneriler.length > 0 && (
            <div className="bg-success/5 border border-success/20 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-success mb-1.5">Öneriler</h4>
              {data.oneriler.map((o, i) => (
                <p key={i} className="text-xs text-text-muted mb-1">• {o}</p>
              ))}
            </div>
          )}

          {/* Derinleştirme panelleri */}
          <MonthlyEnergyChart toplamAlan={toplamAlan} katSayisi={katSayisi} />
          <SolarROIPanel catiAlani={toplamAlan / katSayisi} />
          <HeatLossPanel toplamAlan={toplamAlan} katSayisi={katSayisi} />
        </div>
      )}
    </div>
  )
}

function MiniCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-surface-alt rounded-lg px-3 py-2">
      <div className="flex items-center gap-1 mb-0.5">{icon}<span className="text-[10px] text-text-muted">{label}</span></div>
      <div className="text-sm font-bold font-mono">{value}</div>
    </div>
  )
}

// ── Aylık Enerji Tüketim Grafiği ──
function MonthlyEnergyChart({ toplamAlan, katSayisi }: { toplamAlan: number; katSayisi: number }) {
  const [data, setData] = useState<{ aylar: { ay: string; isitma_kwh_m2: number; sogutma_kwh_m2: number; aydinlatma_kwh_m2: number }[] } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const result = await getMonthlyEnergy({ toplam_alan: toplamAlan, kat_sayisi: katSayisi }) as typeof data
      setData(result)
      setExpanded(true)
    } catch { /* ignore */ }
    setLoading(false)
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 hover:bg-amber-100 transition text-sm"
        onClick={expanded ? () => setExpanded(false) : load}>
        <span className="font-semibold flex items-center gap-2"><ThermometerSun className="w-4 h-4 text-amber-600" /> 12 Aylık Enerji Tüketim</span>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && data && (
        <div className="p-3" style={{ height: 240 }}>
          <ResponsiveContainer>
            <AreaChart data={data.aylar} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="ay" fontSize={9} />
              <YAxis fontSize={9} tickFormatter={(v: number) => `${v}`} />
              <Tooltip formatter={(v) => typeof v === "number" ? `${v.toFixed(1)} kWh/m²` : v} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="isitma_kwh_m2" name="Isıtma" fill="#ef4444" fillOpacity={0.4} stroke="#ef4444" strokeWidth={2} stackId="1" />
              <Area type="monotone" dataKey="sogutma_kwh_m2" name="Soğutma" fill="#3b82f6" fillOpacity={0.4} stroke="#3b82f6" strokeWidth={2} stackId="1" />
              <Area type="monotone" dataKey="aydinlatma_kwh_m2" name="Aydınlatma" fill="#f59e0b" fillOpacity={0.3} stroke="#f59e0b" strokeWidth={1} stackId="1" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Güneş Paneli ROI ──
function SolarROIPanel({ catiAlani }: { catiAlani: number }) {
  const [data, setData] = useState<{
    panel_guc_kwp: number; yatirim_tl: number; yillik_uretim_kwh: number
    geri_odeme_yili: number | null; roi_pct: number; co2_azaltma_ton: number
    projeksiyon: { yil: number; net_kazanc: number }[]
  } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const result = await getSolarROI({ cati_alani: catiAlani }) as typeof data
      setData(result)
      setExpanded(true)
    } catch { /* ignore */ }
    setLoading(false)
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button className="w-full flex items-center justify-between px-3 py-2 bg-yellow-50 hover:bg-yellow-100 transition text-sm"
        onClick={expanded ? () => setExpanded(false) : load}>
        <span className="font-semibold flex items-center gap-2"><Sun className="w-4 h-4 text-yellow-600" /> Güneş Paneli ROI</span>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && data && (
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-yellow-50 rounded-lg p-2">
              <div className="text-slate-500">Güç</div>
              <div className="font-bold text-lg">{data.panel_guc_kwp} kWp</div>
            </div>
            <div className="bg-green-50 rounded-lg p-2">
              <div className="text-slate-500">Geri Ödeme</div>
              <div className="font-bold text-lg">{data.geri_odeme_yili || '—'} yıl</div>
            </div>
            <div className="bg-sky-50 rounded-lg p-2">
              <div className="text-slate-500">CO₂ Azaltma</div>
              <div className="font-bold text-lg">{data.co2_azaltma_ton} ton</div>
            </div>
          </div>
          <div className="text-xs bg-emerald-50 rounded-lg p-2">
            Yatırım: <strong>₺{data.yatirim_tl.toLocaleString('tr-TR')}</strong> — 
            Yıllık üretim: <strong>{data.yillik_uretim_kwh.toLocaleString('tr-TR')} kWh</strong> — 
            ROI: <strong>%{data.roi_pct > 1000 ? '1000+' : data.roi_pct}</strong>
          </div>
          {data.projeksiyon.length > 0 && (
            <div style={{ height: 160 }}>
              <ResponsiveContainer>
                <LineChart data={data.projeksiyon} margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="yil" fontSize={9} tickFormatter={(v: number) => `${v}y`} />
                  <YAxis fontSize={9} tickFormatter={(v: number) => `₺${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip formatter={(v) => typeof v === "number" ? `₺${v.toLocaleString('tr-TR')}` : v} labelFormatter={(l) => `${l}. Yıl`} />
                  <Line type="monotone" dataKey="net_kazanc" name="Net Kazanç" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Isı Kaybı Haritası ──
function HeatLossPanel({ toplamAlan, katSayisi }: { toplamAlan: number; katSayisi: number }) {
  const [data, setData] = useState<{
    kayiplar: Record<string, { alan_m2: number; u_degeri: number; kayip_wk: number; oran_pct: number }>
    toplam_kayip_wk: number; en_buyuk_kaynak: string; oneriler: string[]
  } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const result = await getHeatLossMap({ toplam_alan: toplamAlan, kat_sayisi: katSayisi }) as typeof data
      setData(result)
      setExpanded(true)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const LABELS: Record<string, string> = { duvar: 'Duvar', pencere: 'Pencere', cati: 'Çatı', doseme: 'Döşeme' }
  const COLORS: Record<string, string> = { duvar: '#f97316', pencere: '#3b82f6', cati: '#8b5cf6', doseme: '#6b7280' }

  const pieData = data ? Object.entries(data.kayiplar).map(([k, v]) => ({
    name: LABELS[k] || k, value: v.oran_pct, fill: COLORS[k] || '#94a3b8',
  })) : []

  return (
    <div className="border rounded-lg overflow-hidden">
      <button className="w-full flex items-center justify-between px-3 py-2 bg-orange-50 hover:bg-orange-100 transition text-sm"
        onClick={expanded ? () => setExpanded(false) : load}>
        <span className="font-semibold flex items-center gap-2"><Flame className="w-4 h-4 text-orange-600" /> Isı Kaybı Haritası</span>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && data && (
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div style={{ height: 180 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={40} outerRadius={70} paddingAngle={3}
                    label={({ name, value }) => `${name || ""} %${value || 0}`}
                    labelLine={false}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => typeof v === "number" ? `%${v}` : v} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {Object.entries(data.kayiplar).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: COLORS[k] || '#94a3b8' }} />
                  <div className="flex-1 text-xs">
                    <div className="font-medium">{LABELS[k] || k}</div>
                    <div className="text-slate-400">{v.alan_m2}m², U={v.u_degeri}</div>
                  </div>
                  <div className="text-xs font-bold">%{v.oran_pct}</div>
                </div>
              ))}
              <div className="text-xs pt-1 border-t font-semibold">
                Toplam: {data.toplam_kayip_wk} W/K
              </div>
            </div>
          </div>
          {data.oneriler.length > 0 && (
            <div className="text-xs bg-orange-50 rounded-lg p-2 space-y-1">
              {data.oneriler.map((o, i) => <div key={i}>💡 {o}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
