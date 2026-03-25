import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { toast } from '@/stores/toastStore'
import { BuildingViewer } from './BuildingViewer'
import { getBuildingData, generateRoomRender } from '@/services/api'
import { cn } from '@/lib/utils'
import {
  Box, ArrowLeft, ArrowRight, Loader2, TriangleAlert,
  Camera, Image, Palette, RefreshCw,
} from 'lucide-react'

interface BuildingData {
  floors: unknown[]
  columns: unknown[]
  building: { total_height: number; width: number; depth: number; floor_height: number; floor_count: number }
  materials: Record<string, unknown>
}

interface RenderItem {
  room_name: string
  room_type: string
  style: string
  image_url: string
  prompt: string
  loading: boolean
  error: string
}

const RENDER_STYLES = [
  { id: 'modern_turk', label: 'Modern Türk', emoji: '🏠' },
  { id: 'klasik_turk', label: 'Klasik', emoji: '🏛️' },
  { id: 'minimalist', label: 'Minimalist', emoji: '⬜' },
  { id: 'luks', label: 'Lüks', emoji: '💎' },
]

// Demo fallback rooms (used when no plan data in store)
const DEMO_ROOMS = [
  { name: 'Salon', type: 'salon', x: 0.1, y: 0.1, width: 6.5, height: 4.2, is_exterior: true, facing: 'south' },
  { name: 'Yatak Odası 1', type: 'yatak_odasi', x: 0.1, y: 4.5, width: 4.2, height: 3.5, is_exterior: true, facing: 'west' },
  { name: 'Yatak Odası 2', type: 'yatak_odasi', x: 4.5, y: 4.5, width: 3.8, height: 3.3, is_exterior: true, facing: 'north' },
  { name: 'Mutfak', type: 'mutfak', x: 6.8, y: 0.1, width: 3.5, height: 3.0, is_exterior: true, facing: 'east' },
  { name: 'Banyo', type: 'banyo', x: 6.8, y: 3.3, width: 2.5, height: 2.2, is_exterior: false, facing: '' },
  { name: 'WC', type: 'wc', x: 6.8, y: 5.7, width: 1.8, height: 1.5, is_exterior: false, facing: '' },
  { name: 'Antre', type: 'antre', x: 4.5, y: 0.1, width: 2.1, height: 2.5, is_exterior: false, facing: '' },
  { name: 'Koridor', type: 'koridor', x: 4.5, y: 2.8, width: 1.2, height: 4.8, is_exterior: false, facing: '' },
  { name: 'Balkon', type: 'balkon', x: 0.1, y: -1.3, width: 4.0, height: 1.2, is_exterior: true, facing: 'south' },
]

export function ThreeDStep() {
  const {
    parselData, hesaplama, imarParams, setStep, markCompleted,
    planResults, selectedPlanIndex,
  } = useProjectStore()

  const [buildingData, setBuildingData] = useState<BuildingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'3d' | 'render'>('3d')

  // Render gallery state
  const [renderStyle, setRenderStyle] = useState('modern_turk')
  const [renders, setRenders] = useState<RenderItem[]>([])

  // Get plan rooms from store, fallback to demo
  const planRooms = useMemo(() => {
    if (planResults?.alternatives) {
      const plans = planResults.alternatives as unknown as { rooms: typeof DEMO_ROOMS }[]
      const plan = plans[selectedPlanIndex] || plans[0]
      if (plan?.rooms?.length > 0) return plan.rooms
    }
    return DEMO_ROOMS
  }, [planResults, selectedPlanIndex])

  const isUsingDemoData = !planResults?.alternatives

  // Fetch building data
  useEffect(() => {
    if (!parselData || !hesaplama) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const rooms = planRooms.map((r) => ({
          name: r.name, type: r.type,
          x: r.x, y: r.y,
          width: r.width, height: r.height,
          is_exterior: r.is_exterior, facing: r.facing,
        }))

        const data = await getBuildingData({
          rooms,
          kat_adedi: imarParams.kat_adedi,
          kat_yuksekligi: 3.0,
          buildable_width: hesaplama.cekme_polygon_coords
            ? Math.max(...hesaplama.cekme_polygon_coords.map((c) => c.x)) - Math.min(...hesaplama.cekme_polygon_coords.map((c) => c.x))
            : parselData.bounds.width - imarParams.on_bahce - imarParams.arka_bahce,
          buildable_height: hesaplama.cekme_polygon_coords
            ? Math.max(...hesaplama.cekme_polygon_coords.map((c) => c.y)) - Math.min(...hesaplama.cekme_polygon_coords.map((c) => c.y))
            : parselData.bounds.height - 2 * imarParams.yan_bahce,
        }) as BuildingData

        setBuildingData(data)
      } catch (e: unknown) {
        toast.error('3D Model Hatası', e instanceof Error ? e.message : '3D veri yüklenemedi')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [parselData, hesaplama, imarParams, planRooms])

  // Generate render for a room
  const handleRender = useCallback(async (roomName: string, roomType: string, area: number, facing: string) => {
    setRenders((prev) => {
      const exists = prev.find((r) => r.room_name === roomName && r.style === renderStyle)
      if (exists) {
        return prev.map((r) =>
          r.room_name === roomName && r.style === renderStyle
            ? { ...r, loading: true, error: '' }
            : r
        )
      }
      return [...prev, { room_name: roomName, room_type: roomType, style: renderStyle, image_url: '', prompt: '', loading: true, error: '' }]
    })

    try {
      const result = await generateRoomRender({
        room_name: roomName,
        room_type: roomType,
        room_area: area,
        window_direction: facing || 'south',
        style: renderStyle,
      }) as { image_url: string; prompt: string; success: boolean; error: string }

      setRenders((prev) =>
        prev.map((r) =>
          r.room_name === roomName && r.style === renderStyle
            ? { ...r, loading: false, image_url: result.image_url, prompt: result.prompt, error: result.error }
            : r
        )
      )
      if (result.image_url) {
        toast.success('Render Hazır', `${roomName} render'ı oluşturuldu`)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Render hatası'
      setRenders((prev) =>
        prev.map((r) =>
          r.room_name === roomName && r.style === renderStyle
            ? { ...r, loading: false, error: msg }
            : r
        )
      )
      toast.error('Render Hatası', msg)
    }
  }, [renderStyle])

  if (!parselData || !hesaplama) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <TriangleAlert className="w-12 h-12 text-warning mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Önceki Adımlar Tamamlanmadı</h2>
        <button onClick={() => setStep('parcel')} className="btn-primary">Başa Dön</button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-text">3D Görselleştirme & Render</h2>
        <p className="text-text-muted text-sm mt-1">
          İnteraktif 3D bina modeli ve Grok Imagine fotogerçekçi render
          {isUsingDemoData && (
            <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
              Demo veri — plan adımından veri bekleniyor
            </span>
          )}
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-surface-alt rounded-lg w-fit mb-5">
        <button onClick={() => setActiveTab('3d')}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all',
            activeTab === '3d' ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text')}>
          <Box className="w-4 h-4" /> 3D Model
        </button>
        <button onClick={() => setActiveTab('render')}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all',
            activeTab === 'render' ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text')}>
          <Camera className="w-4 h-4" /> Render Galerisi
        </button>
      </div>

      {/* 3D Tab */}
      {activeTab === '3d' && (
        <div className="bg-white rounded-xl border border-border overflow-hidden" style={{ height: 560 }}>
          {loading && (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-text-muted">3D model hazırlanıyor...</span>
            </div>
          )}
          {buildingData && !loading && (
            <Suspense fallback={
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            }>
              <BuildingViewer
                floors={buildingData.floors as never}
                columns={buildingData.columns as never}
                building={buildingData.building as never}
                materials={buildingData.materials as never}
              />
            </Suspense>
          )}
        </div>
      )}

      {/* Render Tab */}
      {activeTab === 'render' && (
        <div className="space-y-5">
          {/* Style selector */}
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-sm">Render Stili</h3>
            </div>
            <div className="flex gap-2">
              {RENDER_STYLES.map((s) => (
                <button key={s.id} onClick={() => setRenderStyle(s.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                    renderStyle === s.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/30',
                  )}>
                  <span>{s.emoji}</span> {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Room render cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {planRooms.filter((r) => ['salon', 'yatak_odasi', 'mutfak', 'banyo', 'balkon'].includes(r.type)).map((room) => {
              const render = renders.find((r) => r.room_name === room.name && r.style === renderStyle)
              return (
                <div key={room.name} className="bg-white rounded-xl border border-border overflow-hidden">
                  {/* Image area */}
                  <div className="aspect-[4/3] bg-surface-alt flex items-center justify-center relative">
                    {render?.loading && (
                      <div className="flex flex-col items-center gap-2 text-text-muted">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="text-xs">Render oluşturuluyor...</span>
                      </div>
                    )}
                    {render?.image_url && !render.loading && (
                      <img src={render.image_url} alt={room.name}
                        className="w-full h-full object-cover" />
                    )}
                    {render?.error && !render.loading && (
                      <div className="text-center px-4">
                        <TriangleAlert className="w-6 h-6 text-warning mx-auto mb-2" />
                        <p className="text-xs text-text-muted">{render.error}</p>
                      </div>
                    )}
                    {!render && (
                      <div className="flex flex-col items-center gap-2 text-text-light">
                        <Image className="w-10 h-10" />
                        <span className="text-xs">Render üretilmedi</span>
                      </div>
                    )}
                  </div>
                  {/* Card footer */}
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{room.name}</div>
                      <div className="text-xs text-text-muted">{(room.width * room.height).toFixed(0)} m²</div>
                    </div>
                    <button
                      onClick={() => handleRender(room.name, room.type, room.width * room.height, room.facing)}
                      disabled={render?.loading}
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
                      {render?.loading
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : render?.image_url
                          ? <RefreshCw className="w-3 h-3" />
                          : <Camera className="w-3 h-3" />
                      }
                      {render?.image_url ? 'Yenile' : 'Render'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-surface-alt rounded-xl p-4 text-xs text-text-muted">
            Render üretimi Grok 2 Image API kullanır. Ayarlardan XAI API key girilmesi gereklidir.
            Her render ~10 saniye sürer.
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        <button onClick={() => setStep('plan')} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> AI Plan
        </button>
        <div className="flex-1" />
        <button onClick={() => { markCompleted('3d'); setStep('feasibility') }}
          className="btn-primary flex items-center gap-2">
          Fizibilite <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
