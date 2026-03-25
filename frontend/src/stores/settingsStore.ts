import { create } from 'zustand'

interface SettingsState {
  claudeApiKey: string
  grokApiKey: string
  isSettingsOpen: boolean

  setClaudeApiKey: (key: string) => void
  setGrokApiKey: (key: string) => void
  openSettings: () => void
  closeSettings: () => void
  hasClaudeKey: () => boolean
  hasGrokKey: () => boolean
  loadFromStorage: () => void
  saveToStorage: () => void
  clearKeys: () => void
}

const STORAGE_KEY = 'imar-pro-api-keys'

// Simple obfuscation (not real encryption — keys are client-side anyway)
function encode(text: string): string {
  if (!text) return ''
  try {
    return btoa(encodeURIComponent(text))
  } catch {
    return ''
  }
}

function decode(encoded: string): string {
  if (!encoded) return ''
  try {
    return decodeURIComponent(atob(encoded))
  } catch {
    return ''
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  claudeApiKey: '',
  grokApiKey: '',
  isSettingsOpen: false,

  setClaudeApiKey: (key) => {
    set({ claudeApiKey: key })
    get().saveToStorage()
  },

  setGrokApiKey: (key) => {
    set({ grokApiKey: key })
    get().saveToStorage()
  },

  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),

  hasClaudeKey: () => get().claudeApiKey.length > 10,
  hasGrokKey: () => get().grokApiKey.length > 10,

  loadFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      set({
        claudeApiKey: decode(parsed.c || ''),
        grokApiKey: decode(parsed.g || ''),
      })
    } catch {
      // corrupted storage — ignore
    }
  },

  saveToStorage: () => {
    const { claudeApiKey, grokApiKey } = get()
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        c: encode(claudeApiKey),
        g: encode(grokApiKey),
      }))
    } catch {
      // storage full or blocked
    }
  },

  clearKeys: () => {
    set({ claudeApiKey: '', grokApiKey: '' })
    localStorage.removeItem(STORAGE_KEY)
  },
}))
