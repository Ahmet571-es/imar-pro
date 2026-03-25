import { useState, useCallback } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { ParcelSVG } from './ParcelSVG'
import { calculateRectangle, calculateFromEdges, queryTKGM, getIller } from '@/services/api'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { ParselData } from '@/types'
import {
  RectangleHorizontal,
  Pentagon,
  Search,
  ArrowRight,
  Loader2,
  TriangleAlert,
  Ruler,
  MapPin,
  Move,
  CornerDownRight,
} from 'lucide-react'

type Tab = 'dikdortgen' | 'kenarlar' | 'tkgm'

export function ParcelStep() {
  const { parselData, setParselData, setStep, markCompleted, parselTipi, setParselTipi } = useProjectStore()
  const [tab, setTab] = useState<Tab>(parselTipi)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dikdörtgen state
  const [en, setEn] = useState(20)
  const [boy, setBoy] = useState(30)

  // Kenarlar state
  const [kenarlarStr, setKenarlarStr] = useState('15,20,15,20')

  // TKGM state
  const [il, setIl] = useState('Ankara')
  const [ilce, setIlce] = useState('Cankaya')
  const [mahalle, setMahalle] = useState('')
  const [ada, setAda] = useState('')
  const [parselNo, setParselNo] = useState('')

  const handleCalculateRectangle = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = (await calculateRectangle(en, boy)) as ParselData
      setParselData(data)
      setParselTipi('dikdortgen')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hesaplama hatası')
    } finally {
      setLoading(false)
    }
  }, [en, boy, setParselData, setParselTipi])

  const handleCalculateEdges = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const kenarlar = kenarlarStr.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n))
      if (kenarlar.length < 3) throw new Error('En az 3 kenar gerekli')
      const data = (await calculateFromEdges(kenarlar)) as ParselData
      setParselData(data)
      setParselTipi('kenarlar')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hesaplama hatası')
    } finally {
      setLoading(false)
    }
  }, [kenarlarStr, setParselData, setParselTipi])

  const handleTKGM = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = (await queryTKGM(il, ilce, mahalle, ada, parselNo)) as Record<string, unknown>
      if (result.basarili && result.polygon_coords) {
        // Build parsel data from TKGM result
        setParselData({
          alan_m2: result.alan as number,
          cevre_m: 0,
          kose_sayisi: (result.polygon_coords as unknown[]).length - 1,
          kenarlar_m: [],
          acilar_derece: [],
          yon: 'kuzey',
          koordinatlar: result.polygon_coords as { x: number; y: number }[],
          bounds: { min_x: 0, min_y: 0, max_x: 0, max_y: 0, width: 0, height: 0 },
        })
        setParselTipi('tkgm')
      } else {
        setError((result.hata as string) || 'Parsel bulunamadı')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'TKGM sorgu hatası')
    } finally {
      setLoading(false)
    }
  }, [il, ilce, mahalle, ada, parselNo, setParselData, setParselTipi])

  const handleNext = () => {
    if (parselData) {
      markCompleted('parcel')
      setStep('zoning')
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dikdortgen', label: 'Dikdörtgen', icon: <RectangleHorizontal className="w-4 h-4" /> },
    { id: 'kenarlar', label: 'Çokgen', icon: <Pentagon className="w-4 h-4" /> },
    { id: 'tkgm', label: 'TKGM Sorgu', icon: <Search className="w-4 h-4" /> },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text">Parsel Tanımlama</h2>
        <p className="text-text-muted text-sm mt-1">Parsel ölçülerini girin veya TKGM'den sorgulayın</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Input Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab selector */}
          <div className="flex gap-1 p-1 bg-surface-alt rounded-lg">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all flex-1 justify-center',
                  tab === t.id ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text',
                )}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="bg-white rounded-xl border border-border p-5 space-y-4">
            {tab === 'dikdortgen' && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <RectangleHorizontal className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Dikdörtgen Parsel</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-text-muted mb-1 block">En (m)</label>
                    <input
                      type="number"
                      value={en}
                      onChange={(e) => setEn(Number(e.target.value))}
                      className="input-field"
                      min={1}
                      step={0.5}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted mb-1 block">Boy (m)</label>
                    <input
                      type="number"
                      value={boy}
                      onChange={(e) => setBoy(Number(e.target.value))}
                      className="input-field"
                      min={1}
                      step={0.5}
                    />
                  </div>
                </div>
                <div className="text-xs text-text-muted bg-surface-alt rounded-lg p-3">
                  Tahmini Alan: <span className="font-bold text-primary">{formatNumber(en * boy)} m²</span>
                </div>
                <button onClick={handleCalculateRectangle} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ruler className="w-4 h-4" />}
                  Hesapla
                </button>
              </>
            )}

            {tab === 'kenarlar' && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Pentagon className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Çokgen Parsel</h3>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1 block">
                    Kenar Uzunlukları (virgülle ayrı, metre)
                  </label>
                  <input
                    type="text"
                    value={kenarlarStr}
                    onChange={(e) => setKenarlarStr(e.target.value)}
                    className="input-field font-mono"
                    placeholder="15, 20, 15, 20"
                  />
                </div>
                <p className="text-xs text-text-muted">
                  Düzgün çokgen varsayılarak iç açılar otomatik hesaplanır. Özel açılar ileride eklenecek.
                </p>
                <button onClick={handleCalculateEdges} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Move className="w-4 h-4" />}
                  Hesapla
                </button>
              </>
            )}

            {tab === 'tkgm' && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">TKGM Parsel Sorgu</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-text-muted mb-1 block">İl</label>
                    <input value={il} onChange={(e) => setIl(e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted mb-1 block">İlçe</label>
                    <input value={ilce} onChange={(e) => setIlce(e.target.value)} className="input-field" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-text-muted mb-1 block">Mahalle</label>
                    <input value={mahalle} onChange={(e) => setMahalle(e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted mb-1 block">Ada No</label>
                    <input value={ada} onChange={(e) => setAda(e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted mb-1 block">Parsel No</label>
                    <input value={parselNo} onChange={(e) => setParselNo(e.target.value)} className="input-field" />
                  </div>
                </div>
                <button onClick={handleTKGM} disabled={loading || !ada || !parselNo} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  TKGM'den Sorgula
                </button>
                <p className="text-xs text-text-light">
                  TKGM sunucuları bazen yavaş yanıt verebilir. Erişilemezse manuel giriş kullanın.
                </p>
              </>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 bg-danger/5 text-danger rounded-lg p-3 text-sm">
                <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Next button */}
          {parselData && (
            <button onClick={handleNext} className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3">
              İmar Adımına Geç
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Right: Visualization + Metrics */}
        <div className="lg:col-span-3 space-y-4">
          {/* SVG Visualization */}
          <div className="bg-white rounded-xl border border-border p-4 min-h-[420px] flex items-center justify-center">
            <ParcelSVG
              parselCoords={parselData?.koordinatlar || []}
              width={480}
              height={400}
            />
          </div>

          {/* Metric Cards */}
          {parselData && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard label="Alan" value={`${formatNumber(parselData.alan_m2)} m²`} icon={<CornerDownRight className="w-4 h-4" />} />
              <MetricCard label="Çevre" value={`${formatNumber(parselData.cevre_m)} m`} icon={<Move className="w-4 h-4" />} />
              <MetricCard label="Köşe" value={`${parselData.kose_sayisi}`} icon={<Pentagon className="w-4 h-4" />} />
              {parselData.kenarlar_m.map((k, i) => (
                <MetricCard key={i} label={`Kenar ${i + 1}`} value={`${formatNumber(k)} m`} small />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon, small }: { label: string; value: string; icon?: React.ReactNode; small?: boolean }) {
  return (
    <div className={cn('metric-card', small && 'py-2 px-3')}>
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon && <span className="text-primary">{icon}</span>}
        <span className={cn('text-text-muted', small ? 'text-[10px]' : 'text-xs')}>{label}</span>
      </div>
      <div className={cn('font-bold text-text font-mono', small ? 'text-sm' : 'text-lg')}>{value}</div>
    </div>
  )
}
