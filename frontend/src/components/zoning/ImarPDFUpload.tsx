import { useState, useCallback, useRef } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { toast } from '@/stores/toastStore'
import { parseImarPDF } from '@/services/api'
import { cn } from '@/lib/utils'
import {
  Upload, FileText, Loader2, CheckCircle2, AlertCircle,
  BrainCircuit, ArrowRight, X,
} from 'lucide-react'

interface ParseResult {
  basarili: boolean
  metin_uzunlugu: number
  yontem: string
  parametreler: Record<string, unknown>
  ham_metin: string
  hata?: string
}

const PARAM_LABELS: Record<string, string> = {
  taks: 'TAKS',
  kaks: 'KAKS / Emsal',
  kat_adedi: 'Kat Adedi',
  insaat_nizami: 'İnşaat Nizamı',
  on_bahce: 'Ön Bahçe (m)',
  yan_bahce: 'Yan Bahçe (m)',
  arka_bahce: 'Arka Bahçe (m)',
  bina_yuksekligi_limiti: 'Bina Yüksekliği (m)',
  ada: 'Ada No',
  parsel: 'Parsel No',
  dop_orani: 'DOP Oranı',
  arsa_alani_m2: 'Arsa Alanı (m²)',
  fonksiyon: 'Fonksiyon',
  il: 'İl',
  ilce: 'İlçe',
  notlar: 'Notlar',
}

interface Props {
  onApplyParams?: (params: Record<string, unknown>) => void
}

export function ImarPDFUpload({ onApplyParams }: Props) {
  const [result, setResult] = useState<ParseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { setImarParams } = useProjectStore()

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Geçersiz Dosya', 'Sadece PDF dosyası kabul edilir')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dosya Çok Büyük', 'Maksimum 10MB')
      return
    }

    setFileName(file.name)
    setLoading(true)
    setResult(null)

    try {
      const parsed = await parseImarPDF(file) as ParseResult
      setResult(parsed)

      if (parsed.basarili) {
        const paramCount = Object.keys(parsed.parametreler).length
        toast.success(
          'PDF Okundu',
          `${paramCount} parametre çıkarıldı (${parsed.yontem === 'ai' ? 'AI' : 'Regex'})`
        )
      } else {
        toast.warning('PDF Okunamadı', parsed.hata || 'Parametre çıkarılamadı')
      }
    } catch (e: unknown) {
      toast.error('PDF Hatası', e instanceof Error ? e.message : 'PDF okuma başarısız')
      setResult({
        basarili: false, metin_uzunlugu: 0, yontem: 'hata',
        parametreler: {}, ham_metin: '',
        hata: e instanceof Error ? e.message : 'Bilinmeyen hata',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleApply = useCallback(() => {
    if (!result?.parametreler) return

    const p = result.parametreler
    const imarUpdate: Record<string, unknown> = {}

    if (p.taks && typeof p.taks === 'number') imarUpdate.taks = p.taks
    if (p.kaks && typeof p.kaks === 'number') imarUpdate.kaks = p.kaks
    if (p.kat_adedi && typeof p.kat_adedi === 'number') imarUpdate.kat_adedi = p.kat_adedi
    if (p.insaat_nizami) imarUpdate.insaat_nizami = p.insaat_nizami
    if (p.on_bahce && typeof p.on_bahce === 'number') imarUpdate.on_bahce = p.on_bahce
    if (p.yan_bahce && typeof p.yan_bahce === 'number') imarUpdate.yan_bahce = p.yan_bahce
    if (p.arka_bahce && typeof p.arka_bahce === 'number') imarUpdate.arka_bahce = p.arka_bahce
    if (p.bina_yuksekligi_limiti && typeof p.bina_yuksekligi_limiti === 'number')
      imarUpdate.bina_yuksekligi_limiti = p.bina_yuksekligi_limiti

    if (Object.keys(imarUpdate).length > 0) {
      setImarParams(imarUpdate as Parameters<typeof setImarParams>[0])
      toast.success('Parametreler Uygulandı', `${Object.keys(imarUpdate).length} alan güncellendi`)
    }

    if (onApplyParams) onApplyParams(result.parametreler)
  }, [result, setImarParams, onApplyParams])

  const handleClear = () => {
    setResult(null)
    setFileName('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <BrainCircuit className="w-4 h-4 text-violet-600" />
          İmar Planı PDF Okuma
        </h3>
        {result && (
          <button onClick={handleClear} className="text-xs text-text-muted hover:text-text flex items-center gap-1">
            <X className="w-3 h-3" /> Temizle
          </button>
        )}
      </div>

      {/* Upload area */}
      {!result && !loading && (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/40 hover:bg-surface-alt/50 transition-all">
          <Upload className="w-8 h-8 text-text-light mb-2" />
          <span className="text-sm font-medium text-text-muted">İmar Durumu PDF'ini Yükle</span>
          <span className="text-xs text-text-light mt-1">PDF, max 10MB — AI ile otomatik parametre çıkarma</span>
          <input ref={inputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
        </label>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <span className="text-sm text-text-muted">PDF okunuyor...</span>
          <span className="text-xs text-text-light mt-1">{fileName}</span>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-3">
          {/* Status bar */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
            result.basarili ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          )}>
            {result.basarili ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <div>
              <span className="font-semibold">{result.basarili ? 'Başarılı' : 'Başarısız'}</span>
              {' — '}
              {result.basarili
                ? `${Object.keys(result.parametreler).length} parametre (${result.yontem === 'ai' ? 'AI Claude' : 'Regex'})`
                : (result.hata || 'Parametre bulunamadı')
              }
            </div>
          </div>

          {/* Extracted parameters */}
          {result.basarili && Object.keys(result.parametreler).length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-surface-alt px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted">Çıkarılan Parametreler</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowPreview(!showPreview)}
                    className="text-[10px] text-primary hover:underline">
                    {showPreview ? 'Gizle' : 'Ham Metin'}
                  </button>
                  <button onClick={handleApply}
                    className="btn-primary text-[10px] px-2.5 py-1 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" /> İmar Formuna Uygula
                  </button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {Object.entries(result.parametreler).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between px-3 py-1.5 text-xs">
                    <span className="text-text-muted">{PARAM_LABELS[key] || key}</span>
                    <span className="font-mono font-semibold text-text">
                      {typeof val === 'number' ? val.toLocaleString('tr-TR') : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw text preview */}
          {showPreview && result.ham_metin && (
            <div className="bg-surface-alt rounded-lg p-3 max-h-32 overflow-y-auto">
              <p className="text-[10px] text-text-muted font-mono whitespace-pre-wrap leading-relaxed">
                {result.ham_metin}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
