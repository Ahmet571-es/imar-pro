/**
 * imarPRO — WhatIfPanel.tsx
 * 5D What-If maliyet analizi: yalıtım kalınlığı, pencere tipi, duvar kalınlığı
 * değişikliklerinin maliyet etkisini 3D üzerinde gösterir.
 */

import { useState, useCallback } from 'react'
import { whatIfAnalysis } from '@/services/api'
import { toast } from '@/stores/toastStore'
import { Loader2 } from 'lucide-react'
import type { WhatIfScenario } from './types3d'

interface WhatIfPanelProps {
  totalCost: number
  katAdedi: number
  buildableWidth: number
  buildableHeight: number
  onScenariosChange?: (scenarios: WhatIfScenario[]) => void
}

export function WhatIfPanel({ totalCost, katAdedi, buildableWidth, buildableHeight, onScenariosChange }: WhatIfPanelProps) {
  const [loading, setLoading] = useState(false)
  const [scenarios, setScenarios] = useState<WhatIfScenario[]>([])
  const [newTotal, setNewTotal] = useState(totalCost)

  // Parameters
  const [yalitimCm, setYalitimCm] = useState<number>(5)
  const [pencereTipi, setPencereTipi] = useState<string>('cift_cam')
  const [duvarCm, setDuvarCm] = useState<number>(25)

  const handleAnalyze = useCallback(async () => {
    if (totalCost <= 0) {
      toast.warning('Uyarı', 'Fizibilite hesaplaması yapılmamış. Maliyet verisi yok.')
      return
    }
    setLoading(true)
    try {
      const result = await whatIfAnalysis({
        toplam_maliyet: totalCost,
        kat_adedi: katAdedi,
        buildable_width: buildableWidth,
        buildable_height: buildableHeight,
        yalitim_kalinligi_cm: yalitimCm !== 5 ? yalitimCm : undefined,
        pencere_tipi: pencereTipi !== 'cift_cam' ? pencereTipi : undefined,
        dis_duvar_kalinligi_cm: duvarCm !== 25 ? duvarCm : undefined,
      }) as { scenarios: WhatIfScenario[]; new_total: number; total_delta: number }

      setScenarios(result.scenarios)
      setNewTotal(result.new_total)
      onScenariosChange?.(result.scenarios)

      const deltaSign = result.total_delta >= 0 ? '+' : ''
      toast.info('What-If Analiz', `Toplam fark: ${deltaSign}₺${(result.total_delta / 1000).toFixed(0)}K`)
    } catch (e: unknown) {
      toast.error('What-If Hatası', e instanceof Error ? e.message : 'Analiz yapılamadı')
    } finally {
      setLoading(false)
    }
  }, [totalCost, katAdedi, buildableWidth, buildableHeight, yalitimCm, pencereTipi, duvarCm, onScenariosChange])

  if (totalCost <= 0) {
    return (
      <div className="bg-white rounded-xl border border-border p-4 text-center text-sm text-text-muted">
        What-If analizi için önce fizibilite hesaplaması yapılmalıdır.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          🔄 What-If Maliyet Analizi
        </h3>
        <div className="text-xs text-text-muted">
          Baz: ₺{(totalCost / 1_000_000).toFixed(1)}M
        </div>
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Yalıtım */}
        <div className="bg-surface-alt rounded-lg p-3">
          <label className="text-xs font-medium text-text block mb-1.5">
            Yalıtım Kalınlığı
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range" min={2} max={12} step={1} value={yalitimCm}
              onChange={(e) => setYalitimCm(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-xs font-mono w-10 text-right">{yalitimCm} cm</span>
          </div>
          {yalitimCm !== 5 && (
            <div className="text-[10px] text-amber-600 mt-1">Varsayılan: 5 cm</div>
          )}
        </div>

        {/* Pencere tipi */}
        <div className="bg-surface-alt rounded-lg p-3">
          <label className="text-xs font-medium text-text block mb-1.5">
            Pencere Tipi
          </label>
          <select
            value={pencereTipi}
            onChange={(e) => setPencereTipi(e.target.value)}
            className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="tek_cam">Tek Cam (U=5.7)</option>
            <option value="cift_cam">Çift Cam (U=2.8) — Varsayılan</option>
            <option value="low_e">Low-E (U=1.4)</option>
          </select>
        </div>

        {/* Duvar kalınlığı */}
        <div className="bg-surface-alt rounded-lg p-3">
          <label className="text-xs font-medium text-text block mb-1.5">
            Dış Duvar Kalınlığı
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range" min={20} max={40} step={5} value={duvarCm}
              onChange={(e) => setDuvarCm(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-xs font-mono w-10 text-right">{duvarCm} cm</span>
          </div>
          {duvarCm !== 25 && (
            <div className="text-[10px] text-amber-600 mt-1">Varsayılan: 25 cm</div>
          )}
        </div>
      </div>

      {/* Analyze button */}
      <button
        onClick={handleAnalyze}
        disabled={loading || (yalitimCm === 5 && pencereTipi === 'cift_cam' && duvarCm === 25)}
        className="w-full btn-primary text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Hesaplanıyor...
          </>
        ) : (
          '🔍 Maliyet Farkını Hesapla'
        )}
      </button>

      {/* Results */}
      {scenarios.length > 0 && (
        <div className="space-y-2">
          {scenarios.map((s) => (
            <div key={s.id} className={`rounded-lg p-3 text-xs ${s.costDelta > 0 ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{s.parameter}</span>
                <span className={`font-bold ${s.costDelta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {s.costDelta > 0 ? '+' : ''}₺{(s.costDelta / 1000).toFixed(0)}K
                </span>
              </div>
              <div className="text-text-muted">
                {s.currentValue} → {s.newValue}
              </div>
              {s.energyDelta !== undefined && s.energyDelta !== 0 && (
                <div className={`mt-1 ${(s.energyDelta ?? 0) < 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  Enerji: %{Math.abs(s.energyDelta ?? 0).toFixed(1)} {(s.energyDelta ?? 0) < 0 ? 'tasarruf' : 'artış'}
                </div>
              )}
            </div>
          ))}

          {/* Summary */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Yeni Toplam Maliyet</span>
              <span className="font-bold text-primary text-sm">
                ₺{(newTotal / 1_000_000).toFixed(2)}M
              </span>
            </div>
            <div className="text-text-muted mt-0.5">
              Fark: {newTotal - totalCost > 0 ? '+' : ''}₺{((newTotal - totalCost) / 1000).toFixed(0)}K
              ({((newTotal - totalCost) / totalCost * 100).toFixed(1)}%)
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
