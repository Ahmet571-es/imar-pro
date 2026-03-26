/**
 * imarPRO — 3D/4D/5D BIM Types
 * Seviye 3 tip tanımları: geometri, materyaller, kamera, BIM verileri
 */

import type * as THREE from 'three'

// ── Temel Geometri Tipleri ──
export interface Vec3 { x: number; y: number; z: number }
export interface Size2 { width: number; height: number }
export interface Size3 { width: number; height: number; depth: number }

// ── Oda Verisi (Backend'den gelen) ──
export interface Room3DInput {
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  is_exterior: boolean
  facing: string
  area?: number
}

// ── Bina Bilgisi (Backend) ──
export interface BuildingInfo {
  total_height: number
  width: number
  depth: number
  floor_height: number
  floor_count: number
  wall_thickness?: number
  slab_thickness?: number
}

// ── Duvar Segmenti ──
export interface WallSegment {
  id: string
  side: 'north' | 'south' | 'east' | 'west'
  center: Vec3
  size: Size3
  is_exterior: boolean
  room_name: string
  room_type: string
  floor_index: number
  has_window: boolean
  has_door: boolean
  // 5D
  cost_category?: string
  cost_amount?: number
}

// ── Pencere ──
export interface WindowData {
  center: Vec3
  size: Size2
  facing: string
  room_name: string
  floor_index: number
  // 5D
  cost_amount?: number
  u_value?: number
}

// ── Kapı ──
export interface DoorData {
  center: Vec3
  size: Size2
  room_name: string
  floor_index: number
}

// ── Oda (3D) ──
export interface Room3D {
  name: string
  type: string
  position: Vec3
  dimensions: Size3
  is_exterior: boolean
  facing: string
  walls: WallSegment[]
  windows: WindowData[]
  door: DoorData | null
  floor_index: number
  // 5D
  cost_amount?: number
}

// ── Kat (3D) ──
export interface Floor3D {
  floor_index: number
  floor_y: number
  is_ground: boolean
  is_top: boolean
  rooms: Room3D[]
  slab: {
    y: number
    thickness: number
    width: number
    depth: number
  }
}

// ── Kolon ──
export interface ColumnData {
  id: number
  x: number
  z: number
  size: number
  height: number
  label: string
}

// ── Materyal Tanımı ──
export interface MaterialDef {
  color: string
  roughness?: number
  opacity?: number
  metalness?: number
  name: string
}

// ── Kamera Preset ──
export interface CameraPreset {
  id: string
  name: string
  icon: string
  position: [number, number, number]
  target: [number, number, number]
  fov?: number
}

// ── Görünüm Modu ──
export type ViewMode = 'solid' | 'xray' | 'wireframe' | 'section' | 'exploded' | 'thermal'

// ── Kesit Modu ──
export interface SectionConfig {
  enabled: boolean
  horizontal: boolean // true = yatay, false = dikey
  position: number   // kesit yüksekliği veya pozisyonu
}

// ── 4D BIM — İnşaat Fazı ──
export interface ConstructionPhase {
  id: string
  name: string
  startMonth: number
  endMonth: number
  color: string
  elements: ('foundation' | 'slab' | 'columns' | 'walls_exterior' | 'walls_interior' | 'roof' | 'facade' | 'windows' | 'doors' | 'interior_finish' | 'mep')[]
  cumulativeCostPercent: number
  description: string
}

// ── 5D BIM — Maliyet Verisi ──
export interface CostElementData {
  id: string
  elementType: 'slab' | 'wall' | 'window' | 'door' | 'roof' | 'column' | 'facade' | 'room_finish'
  name: string
  description: string
  cost: number
  costCategory: string
  costPercent: number
  floor_index?: number
  room_name?: string
}

// ── 5D What-If Analizi ──
export interface WhatIfScenario {
  id: string
  parameter: string // e.g. 'insulation_thickness', 'window_type'
  currentValue: string
  newValue: string
  costDelta: number
  energyDelta?: number
  description: string
}

// ── Render ──
export interface RenderStyle {
  id: string
  label: string
  emoji: string
}

export interface RenderItem {
  room_name: string
  room_type: string
  style: string
  image_url: string
  prompt: string
  loading: boolean
  error: string
}

// ── Viewer State (ana kontrol state'i) ──
export interface ViewerState {
  viewMode: ViewMode
  selectedFloor: number // -1 = all
  showColumns: boolean
  sectionConfig: SectionConfig
  sunHour: number
  selectedRoom: string | null
  hoveredRoom: string | null
  measureMode: boolean
  measurePoints: Vec3[]
  // 4D
  constructionMonth: number
  isPlaying4D: boolean
  // 5D
  showCostHeatmap: boolean
  totalCostDisplay: number
  selectedCostElement: CostElementData | null
}

// ── Room Type → Renk Haritası ──
export const ROOM_COLORS: Record<string, string> = {
  salon:       '#E3F2FD',
  yatak_odasi: '#F3E5F5',
  mutfak:      '#FFF3E0',
  banyo:       '#E0F2F1',
  wc:          '#E0F2F1',
  antre:       '#FFF8E1',
  koridor:     '#ECEFF1',
  balkon:      '#C8E6C9',
  depo:        '#F5F5F5',
  merdiven:    '#E8EAF6',
}

// ── Room Type → Türkçe İsim ──
export const ROOM_LABELS: Record<string, string> = {
  salon: 'Salon', yatak_odasi: 'Yatak Odası', mutfak: 'Mutfak',
  banyo: 'Banyo', wc: 'WC', antre: 'Antre', koridor: 'Koridor',
  balkon: 'Balkon', depo: 'Depo', merdiven: 'Merdiven',
}

// ── Thermal U-value colors (thermal mode) ──
export const THERMAL_SCALE = {
  excellent: { maxU: 0.3, color: '#1565C0' },  // mavi
  good:      { maxU: 0.5, color: '#43A047' },  // yeşil
  average:   { maxU: 1.0, color: '#FDD835' },  // sarı
  poor:      { maxU: 2.0, color: '#F4511E' },  // turuncu
  bad:       { maxU: 5.0, color: '#B71C1C' },  // kırmızı
}

// ── İnşaat Faz Tanımları (4D BIM) ──
export const CONSTRUCTION_PHASES: ConstructionPhase[] = [
  {
    id: 'excavation',
    name: 'Hafriyat + Temel',
    startMonth: 1, endMonth: 2,
    color: '#795548',
    elements: ['foundation'],
    cumulativeCostPercent: 0.08,
    description: 'Kazık çakma, temel betonu dökümü',
  },
  {
    id: 'ground_structure',
    name: 'Kaba İnşaat Zemin + 1. Kat',
    startMonth: 2, endMonth: 4,
    color: '#9E9E9E',
    elements: ['slab', 'columns'],
    cumulativeCostPercent: 0.18,
    description: 'Kolon, kiriş, döşeme betonarme',
  },
  {
    id: 'upper_structure',
    name: 'Kaba İnşaat Üst Katlar',
    startMonth: 4, endMonth: 8,
    color: '#607D8B',
    elements: ['slab', 'columns'],
    cumulativeCostPercent: 0.37,
    description: 'Her ~1.5 ayda bir kat yükselir',
  },
  {
    id: 'roof_walls',
    name: 'Çatı + Dış Duvar Örümü',
    startMonth: 8, endMonth: 10,
    color: '#FF9800',
    elements: ['roof', 'walls_exterior'],
    cumulativeCostPercent: 0.48,
    description: 'Çatı konstrüksiyonu, dış duvar tuğla örme',
  },
  {
    id: 'facade',
    name: 'Dış Cephe Kaplama + Mantolama',
    startMonth: 10, endMonth: 13,
    color: '#FF5722',
    elements: ['facade', 'windows'],
    cumulativeCostPercent: 0.62,
    description: 'Isı yalıtım, dış sıva, pencere montajı',
  },
  {
    id: 'interior',
    name: 'İç İnce İşler',
    startMonth: 13, endMonth: 16,
    color: '#42A5F5',
    elements: ['walls_interior', 'doors', 'interior_finish'],
    cumulativeCostPercent: 0.85,
    description: 'İç sıva, döşeme, mutfak/banyo, kapı montajı',
  },
  {
    id: 'mep_finish',
    name: 'Tesisat + Son Kontroller',
    startMonth: 16, endMonth: 18,
    color: '#66BB6A',
    elements: ['mep'],
    cumulativeCostPercent: 1.0,
    description: 'Elektrik, sıhhi tesisat, mekanik, iskan',
  },
]

// ── Maliyet Dağılımı (5D BIM) ──
export const COST_CATEGORIES: Record<string, { label: string; percent: number; color: string }> = {
  betonarme:     { label: 'Kaba İnşaat (Betonarme)', percent: 0.37, color: '#607D8B' },
  ince_insaat:   { label: 'İnce İnşaat',              percent: 0.27, color: '#42A5F5' },
  tesisat:       { label: 'Tesisat',                   percent: 0.16, color: '#66BB6A' },
  dis_cephe:     { label: 'Dış Cephe',                 percent: 0.09, color: '#FF9800' },
  ortak_alanlar: { label: 'Ortak Alanlar',             percent: 0.06, color: '#AB47BC' },
  proje_harc:    { label: 'Proje ve Harçlar',          percent: 0.05, color: '#78909C' },
}

// ── Render Stilleri ──
export const RENDER_STYLES: RenderStyle[] = [
  { id: 'modern_turk', label: 'Modern Türk', emoji: '🏠' },
  { id: 'klasik_turk', label: 'Klasik', emoji: '🏛️' },
  { id: 'minimalist', label: 'Minimalist', emoji: '⬜' },
  { id: 'luks', label: 'Lüks', emoji: '💎' },
]
