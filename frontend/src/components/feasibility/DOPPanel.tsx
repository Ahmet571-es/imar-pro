import { useState, useCallback } from 'react'
import { toast } from '@/stores/toastStore'
import { calculateDOP } from '@/services/api'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { Loader2, Landmark, Calculator, TriangleAlert } from 'lucide-react'

interface DOPResult {
  sonuc: {
    brut_arsa_m2: number; dop_orani: string; dop_kesinti_m2: number; net_arsa_m2: number
    eski_arsa_degeri: number; yeni_arsa_degeri: number; deger_artisi: number
    imar_artis_payi_orani: string; imar_artis_payi_tl: number
    tapu_harci_tl: number; noter_masrafi_tl: number; yillik_emlak_vergisi_tl: number
    toplam_arsa_maliyeti: number; efektif_m2_maliyet: number
    aciklama: string[]
  }
  karsilastirma: { dop_orani: string; dop_kesinti_m2: number; net_arsa_m2: number; toplam_maliyet: number; efektif_m2: number }[]
  degisiklik_turleri: { key: string; label: string }[]
}

interface Props {
  arsaAlani: number
  arsaBirimFiyat?: number
}

export function DOPPanel({ arsaAlani, arsaBirimFiyat = 15000 }: Props) {
  const [data, setData] = useState<DOPResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [dopOrani, setDopOrani] = useState(0.35)
  const [birimFiyat, setBirimFiyat] = useState(arsaBirimFiyat)
  const [imarDegisikligi, setImarDegisikligi] = useState('')
  const [buyuksehir, setBuyuksehir] = useState(true)

  const handleCalc = useCallback(async () => {
    setLoading(true)
    try {
      const result = await calculateDOP({
        brut_arsa_m2: arsaAlani,
        arsa_birim_fiyat: birimFiyat,
        dop_orani: dopOrani,
        imar_degisikligi: imarDegisikligi,
        buyuksehir: buyuksehir,
      }) as DOPResult
      setData(result)
      toast.success('DOP Hesaplandı', `Net arsa: ${result.sonuc.net_arsa_m2} m²`)
    } catch (e: unknown) {
      toast.error('DOP Hatası', e instanceof Error ? e.message : 'Hesaplama hatası')
    } finally { setLoading(false) }
  }, [arsaAlani, birimFiyat, dopOrani, imarDegisikligi, buyuksehir])

  const fmt = (n: number) => n.toLocaleString('tr-TR')

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Landmark className="w-5 h-5 text-primary" /> DOP & İmar Artış Payı
        </h3>
        <button onClick={handleCalc} disabled={loading} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calculator className="w-3 h-3" />}
          Hesapla
        </button>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-[10px] text-text-muted block mb-1">DOP Oranı</label>
          <select value={dopOrani} onChange={e => setDopOrani(Number(e.target.value))} className="input-field text-xs py-1.5">
            <option value={0.10}>%10</option>
            <option value={0.20}>%20</option>
            <option value={0.30}>%30</option>
            <option value={0.35}>%35 (Yaygın)</option>
            <option value={0.40}>%40</option>
            <option value={0.45}>%45 (Max)</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1">Birim Fiyat (₺/m²)</label>
          <input type="number" value={birimFiyat} onChange={e => setBirimFiyat(Number(e.target.value))}
            className="input-field text-xs py-1.5" min={1000} step={1000} />
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1">İmar Değişikliği</label>
          <select value={imarDegisikligi} onChange={e => setImarDegisikligi(e.target.value)} className="input-field text-xs py-1.5">
            <option value="">Yok</option>
            <option value="tarim_konut">Tarım → Konut</option>
            <option value="tarim_ticaret">Tarım → Ticaret</option>
            <option value="konut_ticaret">Konut → Ticaret</option>
            <option value="yesil_konut">Yeşil → Konut</option>
            <option value="sanayi_konut">Sanayi → Konut</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={buyuksehir} onChange={e => setBuyuksehir(e.target.checked)}
              className="rounded w-3 h-3" />
            Büyükşehir
          </label>
        </div>
      </div>

      {data && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniCard label="Brüt Arsa" value={`${fmt(data.sonuc.brut_arsa_m2)} m²`} />
            <MiniCard label="DOP Kesinti" value={`${fmt(data.sonuc.dop_kesinti_m2)} m²`} color="text-danger" />
            <MiniCard label="Net Arsa" value={`${fmt(data.sonuc.net_arsa_m2)} m²`} color="text-success" />
            <MiniCard label="Efektif ₺/m²" value={`₺${fmt(data.sonuc.efektif_m2_maliyet)}`} />
          </div>

          {/* Cost breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MiniCard label="Arsa Değeri" value={`₺${fmt(data.sonuc.yeni_arsa_degeri)}`} />
            {data.sonuc.imar_artis_payi_tl > 0 && (
              <MiniCard label="İmar Artış Payı" value={`₺${fmt(data.sonuc.imar_artis_payi_tl)}`} color="text-warning" />
            )}
            <MiniCard label="Tapu Harcı" value={`₺${fmt(data.sonuc.tapu_harci_tl)}`} />
            <MiniCard label="Toplam Maliyet" value={`₺${fmt(data.sonuc.toplam_arsa_maliyeti)}`} color="text-primary" />
          </div>

          {/* DOP comparison chart */}
          {data.karsilastirma.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-muted mb-2">DOP ORANI KARŞILAŞTIRMA</h4>
              <div style={{ height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={data.karsilastirma} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="dop_orani" fontSize={9} />
                    <YAxis fontSize={9} tickFormatter={v => `${(Number(v)/1000000).toFixed(1)}M`} />
                    <Tooltip formatter={(v: unknown) => `₺${Number(v).toLocaleString('tr-TR')}`} />
                    <Bar dataKey="toplam_maliyet" radius={[4, 4, 0, 0]}>
                      {data.karsilastirma.map((entry, i) => (
                        <Cell key={i} fill={entry.dop_orani === data.sonuc.dop_orani ? '#0369a1' : '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Explanations */}
          {data.sonuc.aciklama.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-primary mb-1.5">Detay</h4>
              {data.sonuc.aciklama.map((a, i) => (
                <p key={i} className="text-xs text-text-muted mb-1">
                  {a.startsWith('⚠') ? <TriangleAlert className="w-3 h-3 inline mr-1 text-warning" /> : null}
                  {a}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MiniCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface-alt rounded-lg px-3 py-2">
      <div className="text-[10px] text-text-muted">{label}</div>
      <div className={cn('text-sm font-bold font-mono', color || 'text-text')}>{value}</div>
    </div>
  )
}
