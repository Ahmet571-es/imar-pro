import { useState, useRef, useEffect, useCallback } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { toast } from '@/stores/toastStore'
import { downloadPDFReport } from '@/services/api'
import {
  Download, FileImage, FileCode2, FileText, Box, ChevronDown,
  Loader2,
} from 'lucide-react'

interface ExportOption {
  id: string
  label: string
  icon: React.ReactNode
  steps: string[]  // which wizard steps this option is available in
  action: () => Promise<void> | void
}

export function ExportDropdown() {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const {
    currentStep, planResults, selectedPlanIndex,
    feasibilityData, earthquakeData, energyData,
    currentProjectName, parselData, imarParams, hesaplama,
  } = useProjectStore()

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Export actions ──

  const exportSVG = useCallback(async () => {
    try {
      // Get the plan SVG from DOM
      const svgEl = document.querySelector('.floor-plan-svg-container svg') as SVGElement
      if (!svgEl) { toast.warning('SVG Bulunamadı', 'Önce plan üretin'); return }
      const svgData = new XMLSerializer().serializeToString(svgEl)
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `imarPRO_plan_${Date.now()}.svg`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('SVG İndirildi', 'Kat planı SVG olarak kaydedildi')
    } catch {
      toast.error('SVG Hatası', 'SVG dışa aktarılamadı')
    }
  }, [])

  const exportPNG = useCallback(async () => {
    try {
      const svgEl = document.querySelector('.floor-plan-svg-container svg') as SVGElement
      if (!svgEl) { toast.warning('SVG Bulunamadı', 'Önce plan üretin'); return }
      const svgData = new XMLSerializer().serializeToString(svgEl)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const img = new Image()
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width * 2
          canvas.height = img.height * 2
          ctx.scale(2, 2)
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          canvas.toBlob((blob) => {
            if (blob) {
              const pngUrl = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = pngUrl
              a.download = `imarPRO_plan_${Date.now()}.png`
              a.click()
              URL.revokeObjectURL(pngUrl)
            }
            URL.revokeObjectURL(url)
            resolve()
          }, 'image/png')
        }
        img.onerror = reject
        img.src = url
      })
      toast.success('PNG İndirildi', 'Kat planı 2× çözünürlükte kaydedildi')
    } catch {
      toast.error('PNG Hatası', 'PNG dışa aktarılamadı')
    }
  }, [])

  const exportDXF = useCallback(async () => {
    try {
      if (!planResults) { toast.warning('Plan Yok', 'Önce plan üretin'); return }
      const plans = (planResults as Record<string, unknown>).plans as Record<string, unknown>[] | undefined
      const plan = plans?.[selectedPlanIndex]
      const rooms = (plan as Record<string, unknown>)?.rooms
      if (!rooms) { toast.warning('Oda Verisi Yok', 'Plan odaları bulunamadı'); return }

      const apiBase = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${apiBase}/api/export/dxf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rooms, scale: 1.0 }),
      })
      if (!res.ok) throw new Error('DXF oluşturulamadı')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `imarPRO_plan_${Date.now()}.dxf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('DXF İndirildi', 'AutoCAD DXF dosyası kaydedildi')
    } catch {
      toast.error('DXF Hatası', 'DXF dışa aktarılamadı')
    }
  }, [planResults, selectedPlanIndex])

  const export3DScreenshot = useCallback(async () => {
    try {
      const canvas = document.querySelector('.three-canvas-container canvas') as HTMLCanvasElement
      if (!canvas) { toast.warning('3D Bulunamadı', '3D görünüme gidin'); return }
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `imarPRO_3D_${Date.now()}.png`
      a.click()
      toast.success('3D Screenshot', 'Ekran görüntüsü kaydedildi')
    } catch {
      toast.error('Screenshot Hatası', 'Ekran görüntüsü alınamadı')
    }
  }, [])

  const exportPDF = useCallback(async () => {
    try {
      await downloadPDFReport({
        proje_adi: currentProjectName || 'İsimsiz Proje',
        parsel_data: parselData || {},
        imar_data: {
          ...imarParams,
          hesaplama: hesaplama || {},
        },
        fizibilite_data: feasibilityData || {},
        deprem_data: earthquakeData || undefined,
        enerji_data: energyData || undefined,
      })
      toast.success('PDF Rapor', 'Fizibilite raporu indirildi')
    } catch (e) {
      toast.error('PDF Hatası', e instanceof Error ? e.message : 'PDF oluşturulamadı')
    }
  }, [currentProjectName, parselData, imarParams, hesaplama, feasibilityData, earthquakeData, energyData])

  // ── Export options by step ──

  const options: ExportOption[] = [
    { id: 'svg', label: 'Plan SVG', icon: <FileCode2 className="w-3.5 h-3.5" />, steps: ['plan'], action: exportSVG },
    { id: 'png', label: 'Plan PNG (2×)', icon: <FileImage className="w-3.5 h-3.5" />, steps: ['plan'], action: exportPNG },
    { id: 'dxf', label: 'Plan DXF (AutoCAD)', icon: <FileText className="w-3.5 h-3.5" />, steps: ['plan'], action: exportDXF },
    { id: '3d-png', label: '3D Screenshot', icon: <Box className="w-3.5 h-3.5" />, steps: ['3d'], action: export3DScreenshot },
    { id: 'pdf', label: 'Fizibilite PDF Rapor', icon: <FileText className="w-3.5 h-3.5" />, steps: ['feasibility'], action: exportPDF },
  ]

  const activeOptions = options.filter(o => o.steps.includes(currentStep))
  const hasAnyExport = activeOptions.length > 0

  if (!hasAnyExport) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white/80 transition-all"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Dışa Aktar</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-border py-1.5 min-w-[200px] z-50">
          <div className="px-3 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            {currentStep === 'plan' ? 'Plan Dışa Aktarma' :
             currentStep === '3d' ? '3D Dışa Aktarma' :
             currentStep === 'feasibility' ? 'Rapor Dışa Aktarma' : 'Dışa Aktar'}
          </div>
          {activeOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={async () => {
                setExporting(opt.id)
                try { await opt.action() }
                finally { setExporting(null); setOpen(false) }
              }}
              disabled={!!exporting}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text hover:bg-surface-alt transition-colors disabled:opacity-50"
            >
              {exporting === opt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
