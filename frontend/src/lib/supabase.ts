import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
// Yeni format (sb_publishable_) veya eski format (eyJhbGci) — ikisini de destekle
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || ''

// Demo mode: if no Supabase config, use local storage
export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey)

// Only create real client if configured
// Demo modda: autoRefreshToken ve persistSession kapalı → arka plan ağ istekleri yok
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (() => Promise.resolve(new Response('{}', { status: 200 }))) as unknown as typeof fetch,
      },
    })
