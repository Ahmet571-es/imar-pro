// ── Coordinate ──
export interface Coordinate {
  x: number
  y: number
}

// ── Parsel ──
export type ParselTipi = 'dikdortgen' | 'kenarlar' | 'koordinatlar' | 'tkgm'

export interface ParselData {
  alan_m2: number
  cevre_m: number
  kose_sayisi: number
  kenarlar_m: number[]
  acilar_derece: number[]
  yon: string
  koordinatlar: Coordinate[]
  bounds: {
    min_x: number
    min_y: number
    max_x: number
    max_y: number
    width: number
    height: number
  }
}

// ── İmar ──
export interface ImarParams {
  kat_adedi: number
  insaat_nizami: string
  taks: number
  kaks: number
  on_bahce: number
  yan_bahce: number
  arka_bahce: number
  bina_yuksekligi_limiti: number
  bina_derinligi_limiti: number
  siginak_gerekli: boolean
  otopark_gerekli: boolean
}

export interface HesaplamaResult {
  parsel_alani: number
  cekme_sonrasi_alan: number
  max_taban_alani: number
  toplam_insaat_alani: number
  kat_basi_brut_alan: number
  merdiven_alani: number
  asansor_alani: number
  giris_holu_alani: number
  siginak_alani: number
  toplam_ortak_alan: number
  kat_basi_net_alan: number
  uyarilar: string[]
  cekme_polygon_coords?: Coordinate[]
}

export interface ImarResponse {
  parsel: ParselData
  imar_parametreleri: ImarParams & { insaat_nizami_adi: string; asansor_zorunlu: boolean }
  hesaplama: HesaplamaResult
}

// ── Wizard Steps ──
export type WizardStep = 'parcel' | 'zoning' | 'plan' | '3d' | 'feasibility'

export interface StepInfo {
  id: WizardStep
  label: string
  labelTr: string
  icon: string
  path: string
  phase: number
  enabled: boolean
}

// ── Plan / AI ──
export interface RoomData {
  id: string
  name: string
  name_tr: string
  type: 'salon' | 'yatak' | 'mutfak' | 'banyo' | 'wc' | 'antre' | 'koridor' | 'balkon' | 'depo' | 'otopark' | 'merdiven' | 'other'
  x: number
  y: number
  width: number
  height: number
  area: number
  floor: number
  windows?: { wall: 'north' | 'south' | 'east' | 'west'; width: number; position: number }[]
  doors?: { wall: 'north' | 'south' | 'east' | 'west'; width: number; position: number; type: 'normal' | 'sliding' }[]
  is_wet: boolean
  ceiling_height?: number
}

export interface PlanScores {
  alan_verimi: number
  oda_oranlari: number
  bitisiklik: number
  sirkulasyon: number
  gunes_erisimi: number
  mahremiyet: number
  cephe_kullanimi: number
  islak_hacim: number
  balkon_erisim: number
  toplam: number
}

export interface CrossReviewData {
  reviewer: 'claude' | 'grok'
  score: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  review_text: string
}

export interface PlanAlternative {
  id: string
  name: string
  strategy: string
  description: string
  source: 'claude' | 'grok' | 'hybrid'
  rooms: RoomData[]
  scores: PlanScores
  cross_review?: CrossReviewData
  building_width: number
  building_depth: number
  building_area: number
  corridor_axis?: 'horizontal' | 'vertical'
  iteration_count?: number
  svg_data?: string
}

export interface PlanResults {
  alternatives: PlanAlternative[]
  generation_time_ms: number
  room_program_input?: RoomProgramInput
  natural_language_input?: string
}

export interface RoomProgramInput {
  rooms: { name: string; type: RoomData['type']; min_area: number; max_area?: number; count: number }[]
  preferences?: {
    open_kitchen?: boolean
    large_salon?: boolean
    balcony_count?: number
    separate_wc?: boolean
  }
}

// ── Feasibility ──
export interface CostBreakdown {
  kalem: string
  birim_fiyat: number
  miktar: number
  toplam: number
  kategori: string
}

export interface ApartmentUnit {
  id: string
  kat: number
  tip: string
  brut_alan: number
  net_alan: number
  cephe: string
  fiyat: number
  cephe_primi?: number
  kat_primi?: number
}

export interface CashFlowItem {
  ay: number
  gider: number
  gelir: number
  kumulatif: number
  faz: string
}

export interface SensitivityCell {
  maliyet_degisim: number
  fiyat_degisim: number
  kar_marji: number
  npv: number
}

export interface MonteCarloResult {
  mean_npv: number
  std_npv: number
  percentile_5: number
  percentile_95: number
  positive_probability: number
  histogram_data: { bin: number; count: number }[]
}

export interface TornadoItem {
  parametre: string
  dusuk: number
  baz: number
  yuksek: number
  etki: number
}

export interface FeasibilityData {
  toplam_maliyet: number
  toplam_gelir: number
  net_kar: number
  kar_marji: number
  npv: number
  irr: number
  payback_months: number
  maliyet_detay: CostBreakdown[]
  daire_listesi: ApartmentUnit[]
  nakit_akisi: CashFlowItem[]
  duyarlilik: SensitivityCell[][]
  monte_carlo: MonteCarloResult
  tornado: TornadoItem[]
  ai_yorum?: string
}

// ── Earthquake ──
export interface EarthquakeData {
  enlem: number
  boylam: number
  il: string
  ilce?: string
  ss: number
  s1: number
  sds: number
  sd1: number
  zemin_sinifi: string
  deprem_bolgesi: string
  spektrum_data?: { period: number; sa: number }[]
  tasarim_params?: {
    bina_onem_katsayisi: number
    tasiyi_sistem_tipi: string
    r_katsayisi: number
    taban_kesme_kuvveti?: number
  }
  kolon_grid?: {
    x_araliklari: number[]
    y_araliklari: number[]
    kolon_boyutlari: string
  }
}

// ── Energy ──
export interface EnergyData {
  enerji_sinifi: string
  yillik_enerji_tuketimi: number
  co2_emisyonu: number
  u_deger_duvar: number
  u_deger_cati: number
  u_deger_zemin: number
  u_deger_pencere: number
  yalitim_kalinligi: number
  pencere_tipi: string
  isitma_tipi: string
  yalitim_karsilastirma?: {
    kalinlik: number
    u_deger: number
    maliyet: number
    enerji_sinifi: string
  }[]
  pencere_karsilastirma?: {
    tip: string
    u_deger: number
    maliyet: number
    solar_kazanc: number
  }[]
}

// ── 3D ──
export interface Building3DData {
  rooms: RoomData[]
  floor_count: number
  floor_height: number
  wall_thickness_outer: number
  wall_thickness_inner: number
  slab_thickness: number
  roof_type: 'flat' | 'gable'
  has_basement: boolean
  camera_presets?: {
    name: string
    position: [number, number, number]
    target: [number, number, number]
  }[]
}

// ── Render ──
export interface RenderImage {
  id: string
  room_name?: string
  direction?: string
  style: string
  prompt: string
  image_url: string
  created_at: string
}

export interface RenderCache {
  images: RenderImage[]
  last_updated: string
}

// ── Toast ──
export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

// ── Settings ──
export interface ApiKeySettings {
  claude_api_key: string
  grok_api_key: string
}
