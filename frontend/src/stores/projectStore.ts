import { create } from 'zustand'
import type {
  ParselData, ImarParams, HesaplamaResult, WizardStep, Coordinate,
  Building3DData, RenderCache,
} from '@/types'

// ── Form State types (persist edilen kullanıcı girişleri) ──
export interface PlanFormState {
  daireTipi: string
  odalar: { isim: string; tip: string; m2: number }[]
  sunDir: string
}

export interface FeasibilityFormState {
  il: string
  kalite: string
  m2Fiyat: number
  arsaMaliyeti: number
  daireSayisiPerKat: number
  insaatSuresi: number
  onSatis: number
}

// ── API Response (backend'den gelen plan verisi — olduğu gibi saklanır) ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PlanResultsRaw = Record<string, any> | null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FeasibilityDataRaw = Record<string, any> | null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EarthquakeDataRaw = Record<string, any> | null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EnergyDataRaw = Record<string, any> | null

// ── Serializable State (proje kaydetme/yükleme) ──
export interface ProjectSerializable {
  // Parsel
  parselData: ParselData | null
  parselTipi: 'dikdortgen' | 'kenarlar' | 'tkgm'

  // İmar
  imarParams: ImarParams
  hesaplama: HesaplamaResult | null
  cekmeCoords: Coordinate[] | null

  // Plan
  planResults: PlanResultsRaw
  selectedPlanIndex: number
  planFormState: PlanFormState

  // 3D
  building3DData: Building3DData | null
  renderCache: RenderCache | null

  // Fizibilite
  feasibilityData: FeasibilityDataRaw
  feasibilityFormState: FeasibilityFormState

  // Deprem
  earthquakeData: EarthquakeDataRaw

  // Enerji
  energyData: EnergyDataRaw

  // Wizard
  currentStep: WizardStep
  completedSteps: WizardStep[]
}

const DEFAULT_IMAR: ImarParams = {
  kat_adedi: 4,
  insaat_nizami: 'A',
  taks: 0.35,
  kaks: 1.40,
  on_bahce: 5.0,
  yan_bahce: 3.0,
  arka_bahce: 3.0,
  bina_yuksekligi_limiti: 0,
  bina_derinligi_limiti: 0,
  siginak_gerekli: false,
  otopark_gerekli: true,
}

const DEFAULT_PLAN_FORM: PlanFormState = {
  daireTipi: '3+1',
  odalar: [],
  sunDir: 'south',
}

const DEFAULT_FEASIBILITY_FORM: FeasibilityFormState = {
  il: 'Ankara',
  kalite: 'orta',
  m2Fiyat: 45000,
  arsaMaliyeti: 5000000,
  daireSayisiPerKat: 2,
  insaatSuresi: 18,
  onSatis: 0.30,
}

interface ProjectState extends Omit<ProjectSerializable, 'completedSteps'> {
  completedSteps: Set<WizardStep>

  // Current project tracking
  currentProjectId: string | null
  currentProjectName: string | null
  lastSavedAt: string | null
  isDirty: boolean

  // Loading / Error
  loading: boolean
  loadingMessage: string | null
  error: string | null

  // ── Actions: Wizard ──
  setStep: (step: WizardStep) => void
  markCompleted: (step: WizardStep) => void

  // ── Actions: Parsel ──
  setParselData: (data: ParselData) => void
  setParselTipi: (t: 'dikdortgen' | 'kenarlar' | 'tkgm') => void

  // ── Actions: İmar ──
  setImarParams: (p: Partial<ImarParams>) => void
  setHesaplama: (h: HesaplamaResult) => void
  setCekmeCoords: (c: Coordinate[]) => void

  // ── Actions: Plan ──
  setPlanResults: (r: PlanResultsRaw) => void
  setSelectedPlanIndex: (i: number) => void
  setPlanFormState: (f: Partial<PlanFormState>) => void

  // ── Actions: 3D ──
  setBuilding3DData: (d: Building3DData) => void
  setRenderCache: (c: RenderCache) => void

  // ── Actions: Fizibilite ──
  setFeasibilityData: (d: FeasibilityDataRaw) => void
  setFeasibilityFormState: (f: Partial<FeasibilityFormState>) => void

  // ── Actions: Deprem ──
  setEarthquakeData: (d: EarthquakeDataRaw) => void

  // ── Actions: Enerji ──
  setEnergyData: (d: EnergyDataRaw) => void

  // ── Actions: Loading/Error ──
  setLoading: (l: boolean, message?: string) => void
  setError: (e: string | null) => void

  // ── Actions: Project Management ──
  setCurrentProject: (id: string, name: string) => void
  markSaved: () => void
  markDirty: () => void

  // ── Actions: Serialize / Restore ──
  serialize: () => ProjectSerializable
  restore: (data: Partial<ProjectSerializable>) => void
  resetProject: () => void
}

const INITIAL_STATE = {
  currentStep: 'parcel' as WizardStep,
  completedSteps: new Set<WizardStep>(),
  parselData: null as ParselData | null,
  parselTipi: 'dikdortgen' as const,
  imarParams: DEFAULT_IMAR,
  hesaplama: null as HesaplamaResult | null,
  cekmeCoords: null as Coordinate[] | null,
  planResults: null as PlanResultsRaw,
  selectedPlanIndex: 0,
  planFormState: { ...DEFAULT_PLAN_FORM },
  building3DData: null as Building3DData | null,
  renderCache: null as RenderCache | null,
  feasibilityData: null as FeasibilityDataRaw,
  feasibilityFormState: { ...DEFAULT_FEASIBILITY_FORM },
  earthquakeData: null as EarthquakeDataRaw,
  energyData: null as EnergyDataRaw,
  currentProjectId: null as string | null,
  currentProjectName: null as string | null,
  lastSavedAt: null as string | null,
  isDirty: false,
  loading: false,
  loadingMessage: null as string | null,
  error: null as string | null,
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  ...INITIAL_STATE,

  // ── Wizard ──
  setStep: (step) => set({ currentStep: step }),
  markCompleted: (step) =>
    set((s) => {
      const next = new Set(s.completedSteps)
      next.add(step)
      return { completedSteps: next, isDirty: true }
    }),

  // ── Parsel ──
  setParselData: (data) => set({ parselData: data, isDirty: true }),
  setParselTipi: (t) => set({ parselTipi: t, isDirty: true }), // FIX S1.5: isDirty eklendi

  // ── İmar ──
  setImarParams: (p) =>
    set((s) => ({ imarParams: { ...s.imarParams, ...p }, isDirty: true })),
  setHesaplama: (h) => set({ hesaplama: h, isDirty: true }),
  setCekmeCoords: (c) => set({ cekmeCoords: c, isDirty: true }),

  // ── Plan ──
  setPlanResults: (r) => set({ planResults: r, isDirty: true }),
  setSelectedPlanIndex: (i) => set({ selectedPlanIndex: i, isDirty: true }),
  setPlanFormState: (f) =>
    set((s) => ({ planFormState: { ...s.planFormState, ...f }, isDirty: true })),

  // ── 3D ──
  setBuilding3DData: (d) => set({ building3DData: d, isDirty: true }),
  setRenderCache: (c) => set({ renderCache: c, isDirty: true }),

  // ── Fizibilite ──
  setFeasibilityData: (d) => set({ feasibilityData: d, isDirty: true }),
  setFeasibilityFormState: (f) =>
    set((s) => ({ feasibilityFormState: { ...s.feasibilityFormState, ...f }, isDirty: true })),

  // ── Deprem ──
  setEarthquakeData: (d) => set({ earthquakeData: d, isDirty: true }),

  // ── Enerji ──
  setEnergyData: (d) => set({ energyData: d, isDirty: true }),

  // ── Loading / Error ──
  setLoading: (l, message) => set({ loading: l, loadingMessage: message || null }),
  setError: (e) => set({ error: e }),

  // ── Project Management ──
  setCurrentProject: (id, name) => set({ currentProjectId: id, currentProjectName: name }),
  markSaved: () => set({ lastSavedAt: new Date().toISOString(), isDirty: false }),
  markDirty: () => set({ isDirty: true }),

  // ── Serialize: store → JSON ──
  serialize: (): ProjectSerializable => {
    const s = get()
    return {
      parselData: s.parselData,
      parselTipi: s.parselTipi,
      imarParams: s.imarParams,
      hesaplama: s.hesaplama,
      cekmeCoords: s.cekmeCoords,
      planResults: s.planResults,
      selectedPlanIndex: s.selectedPlanIndex,
      planFormState: s.planFormState,
      building3DData: s.building3DData,
      renderCache: s.renderCache,
      feasibilityData: s.feasibilityData,
      feasibilityFormState: s.feasibilityFormState,
      earthquakeData: s.earthquakeData,
      energyData: s.energyData,
      currentStep: s.currentStep,
      completedSteps: Array.from(s.completedSteps),
    }
  },

  // ── Restore: JSON → store ──
  restore: (data) => {
    const patch: Partial<ProjectState> = {}

    if (data.parselData !== undefined) patch.parselData = data.parselData
    if (data.parselTipi !== undefined) patch.parselTipi = data.parselTipi
    if (data.imarParams !== undefined) patch.imarParams = { ...DEFAULT_IMAR, ...data.imarParams }
    if (data.hesaplama !== undefined) patch.hesaplama = data.hesaplama
    if (data.cekmeCoords !== undefined) patch.cekmeCoords = data.cekmeCoords
    if (data.planResults !== undefined) patch.planResults = data.planResults
    if (data.selectedPlanIndex !== undefined) patch.selectedPlanIndex = data.selectedPlanIndex
    if (data.planFormState !== undefined) patch.planFormState = { ...DEFAULT_PLAN_FORM, ...data.planFormState }
    if (data.building3DData !== undefined) patch.building3DData = data.building3DData
    if (data.renderCache !== undefined) patch.renderCache = data.renderCache
    if (data.feasibilityData !== undefined) patch.feasibilityData = data.feasibilityData
    if (data.feasibilityFormState !== undefined) patch.feasibilityFormState = { ...DEFAULT_FEASIBILITY_FORM, ...data.feasibilityFormState }
    if (data.earthquakeData !== undefined) patch.earthquakeData = data.earthquakeData
    if (data.energyData !== undefined) patch.energyData = data.energyData
    if (data.currentStep !== undefined) patch.currentStep = data.currentStep
    if (data.completedSteps !== undefined) {
      patch.completedSteps = new Set(data.completedSteps)
    }

    patch.isDirty = false
    patch.lastSavedAt = new Date().toISOString()
    patch.error = null

    set(patch)
  },

  // ── Reset ──
  resetProject: () => set({
    ...INITIAL_STATE,
    completedSteps: new Set(),
    planFormState: { ...DEFAULT_PLAN_FORM },
    feasibilityFormState: { ...DEFAULT_FEASIBILITY_FORM },
  }),
}))
