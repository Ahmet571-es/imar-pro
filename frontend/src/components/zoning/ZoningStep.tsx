import { useState, useCallback, useEffect, useRef } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { toast } from '@/stores/toastStore'
import { ParcelSVG } from '@/components/parcel/ParcelSVG'
import { ImarPDFUpload } from './ImarPDFUpload'
import { calculateZoning } from '@/services/api'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { ImarResponse, Coordinate } from '@/types'
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  TriangleAlert,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  ArrowDownToLine,
  CircleDot,
} from 'lucide-react'

export function ZoningStep() {
  const {
    parselData,
    imarParams,
    setImarParams,
    hesaplama,
    setHesaplama,
    cekmeCoords,
    setCekmeCoords,
    setStep,
    markCompleted,
    parselTipi,
  } = useProjectStore()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoCalc, setAutoCalc] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build request from store data
  const buildRequest = useCallback(() => {
    if (!parselData) return null
    const base: Record<string, unknown> = {
      yon: parselData.yon,
      ...imarParams,
    }
    // Dikdörtgen: en/boy gönder, diğer: koordinatlar gönder
    if (parselTipi === 'dikdortgen' && parselData.bounds?.width && parselData.bounds?.height) {
      base.parsel_tipi = 'dikdortgen'
      base.en = parselData.bounds.width
      base.boy = parselData.bounds.height
    } else if (parselData.koordinatlar?.length >= 3) {
      base.parsel_tipi = 'koordinatlar'
      base.koordinatlar = parselData.koordinatlar.map((c) => ({ x: c.x, y: c.y }))
    } else {
      return null
    }
    return base
  }, [parselData, parselTipi, imarParams])

  const doCalculate = useCallback(async () => {
    const req = buildRequest()
    if (!req) return
    setLoading(true)
    setError(null)
    try {
      const data = (await calculateZoning(req)) as ImarResponse
      setHesaplama(data.hesaplama)
      if (data.hesaplama.cekme_polygon_coords) {
        setCekmeCoords(data.hesaplama.cekme_polygon_coords)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Hesaplama hatası'
      setError(msg)
      toast.error('İmar Hesaplama Hatası', msg)
    } finally {
      setLoading(false)
    }
  }, [buildRequest, setHesaplama, setCekmeCoords])

  // Auto-calculate on param change
  useEffect(() => {
    if (!autoCalc || !parselData) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doCalculate()
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [imarParams, autoCalc, parselData, doCalculate])

  // Initial calculation
  useEffect(() => {
    if (parselData && !hesaplama) {
      doCalculate()
    }
  }, [parselData, hesaplama, doCalculate])

  const handleNext = () => {
    if (hesaplama) {
      markCompleted('zoning')
      setStep('plan')
    }
  }

  if (!parselData) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <TriangleAlert className="w-12 h-12 text-warning mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Parsel Tanımlanmadı</h2>
        <p className="text-text-muted mb-4">Önce parsel adımını tamamlayın.</p>
        <button onClick={() => setStep('parcel')} className="btn-primary">
          Parsel Adımına Dön
        </button>
      </div>
    )
  }

  const p = imarParams

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text">İmar Parametreleri</h2>
        <p className="text-text-muted text-sm mt-1">TAKS, KAKS, çekme mesafeleri ve kat bilgilerini girin</p>
      </div>

      {/* İmar PDF Upload — otomatik parametre çıkarma */}
      <div className="mb-6">
        <ImarPDFUpload onApplyParams={() => {
          // Trigger recalculation after PDF params applied
          setTimeout(() => doCalculate(), 500)
        }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-border p-5 space-y-5">
            {/* Kat & Nizam */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm">Yapı Bilgileri</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1 block">Kat Adedi</label>
                  <input
                    type="number"
                    value={p.kat_adedi}
                    onChange={(e) => setImarParams({ kat_adedi: Number(e.target.value) })}
                    className="input-field"
                    min={1}
                    max={40}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1 block">İnşaat Nizamı</label>
                  <select
                    value={p.insaat_nizami}
                    onChange={(e) => setImarParams({ insaat_nizami: e.target.value })}
                    className="input-field"
                  >
                    <option value="A">Ayrık Nizam</option>
                    <option value="B">Bitişik Nizam</option>
                    <option value="BL">Blok Nizam</option>
                  </select>
                </div>
              </div>
            </div>

            {/* TAKS/KAKS */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm">TAKS / KAKS</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1 block">TAKS</label>
                  <input
                    type="number"
                    value={p.taks}
                    onChange={(e) => setImarParams({ taks: Number(e.target.value) })}
                    className="input-field font-mono"
                    min={0.05}
                    max={1.0}
                    step={0.05}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1 block">KAKS</label>
                  <input
                    type="number"
                    value={p.kaks}
                    onChange={(e) => setImarParams({ kaks: Number(e.target.value) })}
                    className="input-field font-mono"
                    min={0.1}
                    max={10.0}
                    step={0.1}
                  />
                </div>
              </div>
            </div>

            {/* Çekme mesafeleri */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Minimize2 className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm">Çekme Mesafeleri (m)</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1 block">Ön Bahçe</label>
                  <input
                    type="number"
                    value={p.on_bahce}
                    onChange={(e) => setImarParams({ on_bahce: Number(e.target.value) })}
                    className="input-field font-mono"
                    min={0}
                    step={0.5}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1 block">Yan Bahçe</label>
                  <input
                    type="number"
                    value={p.yan_bahce}
                    onChange={(e) => setImarParams({ yan_bahce: Number(e.target.value) })}
                    className="input-field font-mono"
                    min={0}
                    step={0.5}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1 block">Arka Bahçe</label>
                  <input
                    type="number"
                    value={p.arka_bahce}
                    onChange={(e) => setImarParams({ arka_bahce: Number(e.target.value) })}
                    className="input-field font-mono"
                    min={0}
                    step={0.5}
                  />
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={p.siginak_gerekli}
                  onChange={(e) => setImarParams({ siginak_gerekli: e.target.checked })}
                  className="rounded"
                />
                <span>Sığınak</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={p.otopark_gerekli}
                  onChange={(e) => setImarParams({ otopark_gerekli: e.target.checked })}
                  className="rounded"
                />
                <span>Otopark</span>
              </label>
            </div>

            {!autoCalc && (
              <button onClick={doCalculate} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircleDot className="w-4 h-4" />}
                Hesapla
              </button>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-danger/5 text-danger rounded-lg p-3 text-sm">
                <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button onClick={() => setStep('parcel')} className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Parsel
            </button>
            <button
              onClick={handleNext}
              disabled={!hesaplama}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              AI Plan
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Visualization + Results */}
        <div className="lg:col-span-3 space-y-4">
          {/* SVG with çekme overlay */}
          <div className="bg-white rounded-xl border border-border p-4 min-h-[380px] flex items-center justify-center relative">
            {loading && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 rounded-xl">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
            <ParcelSVG
              parselCoords={parselData.koordinatlar}
              cekmeCoords={cekmeCoords}
              width={480}
              height={380}
            />
          </div>

          {/* Hesaplama Results */}
          {hesaplama && (
            <div className="space-y-3">
              {/* Primary metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ResultCard label="Parsel Alanı" value={hesaplama.parsel_alani} unit="m²" accent />
                <ResultCard label="Çekme Sonrası" value={hesaplama.cekme_sonrasi_alan} unit="m²" />
                <ResultCard label="Maks. Taban (TAKS)" value={hesaplama.max_taban_alani} unit="m²" />
                <ResultCard label="Toplam İnşaat (KAKS)" value={hesaplama.toplam_insaat_alani} unit="m²" accent />
                <ResultCard label="Kat Başı Brüt" value={hesaplama.kat_basi_brut_alan} unit="m²" />
                <ResultCard label="Kat Başı Net" value={hesaplama.kat_basi_net_alan} unit="m²" highlight />
              </div>

              {/* Ortak alanlar */}
              <div className="bg-white rounded-xl border border-border p-4">
                <h4 className="text-xs font-semibold text-text-muted mb-3 flex items-center gap-1.5">
                  <ArrowDownToLine className="w-4 h-4" />
                  Ortak Alan Detay
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-text-muted text-xs">Merdiven</span>
                    <div className="font-mono font-semibold">{formatNumber(hesaplama.merdiven_alani)} m²</div>
                  </div>
                  <div>
                    <span className="text-text-muted text-xs">Asansör</span>
                    <div className="font-mono font-semibold">{formatNumber(hesaplama.asansor_alani)} m²</div>
                  </div>
                  <div>
                    <span className="text-text-muted text-xs">Giriş Holü</span>
                    <div className="font-mono font-semibold">{formatNumber(hesaplama.giris_holu_alani)} m²</div>
                  </div>
                  <div>
                    <span className="text-text-muted text-xs">Toplam Ortak</span>
                    <div className="font-mono font-semibold text-primary">{formatNumber(hesaplama.toplam_ortak_alan)} m²</div>
                  </div>
                </div>
              </div>

              {/* Uyarılar */}
              {hesaplama.uyarilar.length > 0 && (
                <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-warning font-semibold text-sm">
                    <Info className="w-4 h-4" />
                    Uyarılar
                  </div>
                  {hesaplama.uyarilar.map((u, i) => (
                    <p key={i} className="text-sm text-text-muted">{u}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultCard({
  label,
  value,
  unit,
  accent,
  highlight,
}: {
  label: string
  value: number
  unit: string
  accent?: boolean
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'metric-card',
        highlight && 'border-success/40 bg-success/5',
        accent && 'border-primary/30',
      )}
    >
      <div className="text-xs text-text-muted mb-0.5">{label}</div>
      <div className={cn('font-bold font-mono text-lg', highlight && 'text-success', accent && 'text-primary')}>
        {formatNumber(value)}
        <span className="text-xs font-normal text-text-muted ml-1">{unit}</span>
      </div>
    </div>
  )
}
