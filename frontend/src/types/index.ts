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
