import { create } from 'zustand'
import type {
  ParselData, ImarParams, HesaplamaResult, WizardStep, Coordinate,
  PlanResults, FeasibilityData, EarthquakeData, EnergyData,
  Building3DData, RenderCache,
} from '@/types'

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
  planResults: PlanResults | null
  selectedPlanIndex: number

  // 3D
  building3DData: Building3DData | null
  renderCache: RenderCache | null

  // Fizibilite
  feasibilityData: FeasibilityData | null

  // Deprem
  earthquakeData: EarthquakeData | null

  // Enerji
  energyData: EnergyData | null

  // Wizard
  currentStep: WizardStep
  completedSteps: WizardStep[]
}

interface ProjectState extends Omit<ProjectSerializable, 'completedSteps'> {
  // completedSteps as Set for runtime
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
  setPlanResults: (r: PlanResults) => void
  setSelectedPlanIndex: (i: number) => void

  // ── Actions: 3D ──
  setBuilding3DData: (d: Building3DData) => void
  setRenderCache: (c: RenderCache) => void

  // ── Actions: Fizibilite ──
  setFeasibilityData: (d: FeasibilityData) => void

  // ── Actions: Deprem ──
  setEarthquakeData: (d: EarthquakeData) => void

  // ── Actions: Enerji ──
  setEnergyData: (d: EnergyData) => void

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

const INITIAL_STATE = {
  currentStep: 'parcel' as WizardStep,
  completedSteps: new Set<WizardStep>(),
  parselData: null,
  parselTipi: 'dikdortgen' as const,
  imarParams: DEFAULT_IMAR,
  hesaplama: null,
  cekmeCoords: null,
  planResults: null,
  selectedPlanIndex: 0,
  building3DData: null,
  renderCache: null,
  feasibilityData: null,
  earthquakeData: null,
  energyData: null,
  currentProjectId: null,
  currentProjectName: null,
  lastSavedAt: null,
  isDirty: false,
  loading: false,
  loadingMessage: null,
  error: null,
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
  setParselTipi: (t) => set({ parselTipi: t }),

  // ── İmar ──
  setImarParams: (p) =>
    set((s) => ({ imarParams: { ...s.imarParams, ...p }, isDirty: true })),
  setHesaplama: (h) => set({ hesaplama: h, isDirty: true }),
  setCekmeCoords: (c) => set({ cekmeCoords: c, isDirty: true }),

  // ── Plan ──
  setPlanResults: (r) => set({ planResults: r, isDirty: true }),
  setSelectedPlanIndex: (i) => set({ selectedPlanIndex: i, isDirty: true }),

  // ── 3D ──
  setBuilding3DData: (d) => set({ building3DData: d, isDirty: true }),
  setRenderCache: (c) => set({ renderCache: c, isDirty: true }),

  // ── Fizibilite ──
  setFeasibilityData: (d) => set({ feasibilityData: d, isDirty: true }),

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

  // ── Serialize: store → JSON (for saving) ──
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
      building3DData: s.building3DData,
      renderCache: s.renderCache,
      feasibilityData: s.feasibilityData,
      earthquakeData: s.earthquakeData,
      energyData: s.energyData,
      currentStep: s.currentStep,
      completedSteps: Array.from(s.completedSteps),
    }
  },

  // ── Restore: JSON → store (for loading) ──
  restore: (data) => {
    const patch: Partial<ProjectState> = {}

    if (data.parselData !== undefined) patch.parselData = data.parselData
    if (data.parselTipi !== undefined) patch.parselTipi = data.parselTipi
    if (data.imarParams !== undefined) patch.imarParams = { ...DEFAULT_IMAR, ...data.imarParams }
    if (data.hesaplama !== undefined) patch.hesaplama = data.hesaplama
    if (data.cekmeCoords !== undefined) patch.cekmeCoords = data.cekmeCoords
    if (data.planResults !== undefined) patch.planResults = data.planResults
    if (data.selectedPlanIndex !== undefined) patch.selectedPlanIndex = data.selectedPlanIndex
    if (data.building3DData !== undefined) patch.building3DData = data.building3DData
    if (data.renderCache !== undefined) patch.renderCache = data.renderCache
    if (data.feasibilityData !== undefined) patch.feasibilityData = data.feasibilityData
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
  resetProject: () => set({ ...INITIAL_STATE, completedSteps: new Set() }),
}))
