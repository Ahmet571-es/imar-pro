import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

interface User {
  id: string
  email: string
  name: string
}

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  isDemo: boolean

  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<boolean>
  signUp: (email: string, password: string, name: string) => Promise<boolean>
  signOut: () => Promise<void>
  continueAsGuest: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  isDemo: !isSupabaseConfigured,

  initialize: async () => {
    if (!isSupabaseConfigured) {
      // Check localStorage for guest session
      const saved = localStorage.getItem('imar-pro-guest')
      if (saved) {
        set({ user: JSON.parse(saved), loading: false, isDemo: true })
      } else {
        set({ loading: false, isDemo: true })
      }
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '',
          },
          loading: false,
        })
      } else {
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || '',
          },
        })
      } else {
        set({ user: null })
      }
    })
  },

  signIn: async (email, password) => {
    set({ error: null, loading: true })

    if (!isSupabaseConfigured) {
      // Demo login
      const user = { id: 'demo-' + Date.now(), email, name: email.split('@')[0] }
      localStorage.setItem('imar-pro-guest', JSON.stringify(user))
      set({ user, loading: false, isDemo: true })
      return true
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        set({ error: error.message, loading: false })
        return false
      }
      set({ loading: false })
      return true
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Giriş hatası', loading: false })
      return false
    }
  },

  signUp: async (email, password, name) => {
    set({ error: null, loading: true })

    if (!isSupabaseConfigured) {
      const user = { id: 'demo-' + Date.now(), email, name }
      localStorage.setItem('imar-pro-guest', JSON.stringify(user))
      set({ user, loading: false, isDemo: true })
      return true
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      if (error) {
        set({ error: error.message, loading: false })
        return false
      }
      set({ loading: false })
      return true
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Kayıt hatası', loading: false })
      return false
    }
  },

  signOut: async () => {
    if (!isSupabaseConfigured) {
      localStorage.removeItem('imar-pro-guest')
      localStorage.removeItem('imar-pro-projects')
      set({ user: null })
      return
    }
    await supabase.auth.signOut()
    set({ user: null })
  },

  continueAsGuest: () => {
    const user = { id: 'guest-' + Date.now(), email: 'misafir@imarpro.dev', name: 'Misafir' }
    localStorage.setItem('imar-pro-guest', JSON.stringify(user))
    set({ user, isDemo: true, loading: false })
  },
}))
