import { create } from 'zustand'
import type { ParselData, ImarParams, HesaplamaResult, WizardStep, Coordinate } from '@/types'

interface ProjectState {
  // Wizard
  currentStep: WizardStep
  setStep: (step: WizardStep) => void
  completedSteps: Set<WizardStep>
  markCompleted: (step: WizardStep) => void

  // Parsel
  parselData: ParselData | null
  setParselData: (data: ParselData) => void

  // Parsel input state
  parselTipi: 'dikdortgen' | 'kenarlar' | 'tkgm'
  setParselTipi: (t: 'dikdortgen' | 'kenarlar' | 'tkgm') => void

  // İmar
  imarParams: ImarParams
  setImarParams: (p: Partial<ImarParams>) => void
  hesaplama: HesaplamaResult | null
  setHesaplama: (h: HesaplamaResult) => void
  cekmeCoords: Coordinate[] | null
  setCekmeCoords: (c: Coordinate[]) => void

  // Loading
  loading: boolean
  setLoading: (l: boolean) => void
  error: string | null
  setError: (e: string | null) => void
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

export const useProjectStore = create<ProjectState>((set) => ({
  currentStep: 'parcel',
  setStep: (step) => set({ currentStep: step }),
  completedSteps: new Set(),
  markCompleted: (step) =>
    set((s) => {
      const next = new Set(s.completedSteps)
      next.add(step)
      return { completedSteps: next }
    }),

  parselData: null,
  setParselData: (data) => set({ parselData: data }),
  parselTipi: 'dikdortgen',
  setParselTipi: (t) => set({ parselTipi: t }),

  imarParams: DEFAULT_IMAR,
  setImarParams: (p) =>
    set((s) => ({ imarParams: { ...s.imarParams, ...p } })),
  hesaplama: null,
  setHesaplama: (h) => set({ hesaplama: h }),
  cekmeCoords: null,
  setCekmeCoords: (c) => set({ cekmeCoords: c }),

  loading: false,
  setLoading: (l) => set({ loading: l }),
  error: null,
  setError: (e) => set({ error: e }),
}))
