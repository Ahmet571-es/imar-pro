import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

/** Supabase İngilizce hata mesajlarını Türkçeye çevir */
function turkishError(msg: string): string {
  const map: Record<string, string> = {
    'Password should be at least 6 characters': 'Şifre en az 6 karakter olmalıdır',
    'Unable to validate email address: invalid format': 'Geçersiz email formatı',
    'Signup requires a valid password': 'Geçerli bir şifre gerekli',
    'To signup, please provide your email': 'Kayıt için email adresinizi girin',
    'User already registered': 'Bu email zaten kayıtlı',
  }
  return map[msg] || msg
}

interface User {
  id: string
  email: string
  name: string
  role?: string
  plan?: string
}

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  isDemo: boolean
  initialized: boolean

  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<boolean>
  signUp: (email: string, password: string, name: string) => Promise<boolean>
  signOut: () => Promise<void>
  continueAsGuest: () => void
  resetPassword: (email: string) => Promise<boolean>
  updateProfile: (data: Partial<{ name: string; company: string; phone: string }>) => Promise<boolean>
  refreshSession: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,
  isDemo: !isSupabaseConfigured,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return

    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('imar-pro-guest')
      if (saved) {
        try {
          set({ user: JSON.parse(saved), loading: false, isDemo: true, initialized: true })
        } catch {
          set({ loading: false, isDemo: true, initialized: true })
        }
      } else {
        set({ loading: false, isDemo: true, initialized: true })
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
          initialized: true,
        })
      } else {
        set({ loading: false, initialized: true })
      }
    } catch {
      set({ loading: false, initialized: true })
    }

    // Auth state change listener
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '',
          },
        })
      } else {
        set({ user: null })
      }
    })

    // Session auto-refresh (her 10 dakikada)
    setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) await supabase.auth.refreshSession()
      } catch { /* sessiz */ }
    }, 600_000)
  },

  signIn: async (email, password) => {
    set({ error: null, loading: true })

    if (!isSupabaseConfigured) {
      const user = { id: 'demo-' + Date.now(), email, name: email.split('@')[0] }
      localStorage.setItem('imar-pro-guest', JSON.stringify(user))
      set({ user, loading: false, isDemo: true })
      return true
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const msg = error.message === 'Invalid login credentials'
          ? 'Email veya şifre hatalı'
          : error.message === 'Email not confirmed'
          ? 'Email adresiniz henüz onaylanmamış. Lütfen email kutunuzu kontrol edin.'
          : error.message.includes('fetch')
          ? 'Sunucuya bağlanılamadı. Lütfen tekrar deneyin.'
          : turkishError(error.message)
        set({ error: msg, loading: false })
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      if (error) {
        const msg = error.message === 'User already registered'
          ? 'Bu email adresi zaten kayıtlı. Giriş yapmayı deneyin.'
          : error.message.includes('Email address') && error.message.includes('invalid')
          ? 'Geçersiz email adresi. Lütfen doğru bir email girin.'
          : error.message.includes('fetch')
          ? 'Sunucuya bağlanılamadı. Lütfen tekrar deneyin.'
          : turkishError(error.message)
        set({ error: msg, loading: false })
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
      localStorage.removeItem('imar-pro-onboarding-done')
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

  resetPassword: async (email) => {
    set({ error: null })
    if (!isSupabaseConfigured) {
      set({ error: 'Demo modda şifre sıfırlama devre dışı' })
      return false
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      })
      if (error) { set({ error: error.message }); return false }
      return true
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Şifre sıfırlama hatası' })
      return false
    }
  },

  updateProfile: async (data) => {
    if (!isSupabaseConfigured) return true
    try {
      const { error } = await supabase.auth.updateUser({ data })
      if (error) return false
      const user = get().user
      if (user && data.name) set({ user: { ...user, name: data.name } })
      return true
    } catch { return false }
  },

  refreshSession: async () => {
    if (!isSupabaseConfigured) return
    try { await supabase.auth.refreshSession() } catch { /* sessiz */ }
  },

  clearError: () => set({ error: null }),
}))
