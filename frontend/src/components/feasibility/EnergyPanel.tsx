import { useState, useCallback } from 'react'
import { calculateEnergy } from '@/services/api'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { Loader2, TriangleAlert, Leaf, Zap, ThermometerSun } from 'lucide-react'

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
}

interface Props {
  toplamAlan: number
  katSayisi: number
}

export function EnergyPanel({ toplamAlan, katSayisi }: Props) {
  const [data, setData] = useState<EnergyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duvarYalitim, setDuvarYalitim] = useState('duvar_8cm_eps')
  const [pencereTipi, setPencereTipi] = useState('isicam')

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Enerji hesap hatası')
    } finally { setLoading(false) }
  }, [toplamAlan, katSayisi, duvarYalitim, pencereTipi])

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

          {/* Recommendations */}
          {data.oneriler.length > 0 && (
            <div className="bg-success/5 border border-success/20 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-success mb-1.5">Öneriler</h4>
              {data.oneriler.map((o, i) => (
                <p key={i} className="text-xs text-text-muted mb-1">• {o}</p>
              ))}
            </div>
          )}
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
