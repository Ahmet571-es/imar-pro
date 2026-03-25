import { create } from 'zustand'
import type { ToastType, ToastMessage } from '@/types'

interface ToastState {
  toasts: ToastMessage[]
  addToast: (type: ToastType, title: string, message?: string, duration?: number) => void
  removeToast: (id: string) => void
  clearAll: () => void
}

let toastCounter = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (type, title, message, duration = 4000) => {
    const id = `toast-${++toastCounter}-${Date.now()}`
    const toast: ToastMessage = { id, type, title, message, duration }

    set((s) => ({
      toasts: [...s.toasts.slice(-4), toast], // max 5 toasts visible
    }))

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearAll: () => set({ toasts: [] }),
}))

// ── Convenience helpers (import anywhere) ──
export const toast = {
  success: (title: string, message?: string) =>
    useToastStore.getState().addToast('success', title, message),
  error: (title: string, message?: string) =>
    useToastStore.getState().addToast('error', title, message, 6000),
  info: (title: string, message?: string) =>
    useToastStore.getState().addToast('info', title, message),
  warning: (title: string, message?: string) =>
    useToastStore.getState().addToast('warning', title, message, 5000),
}
