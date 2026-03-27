import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/** Supabase gerçekten kullanılabilir mi? (yapılandırılmış VE kullanıcı gerçek oturum açmış) */
function shouldUseSupabase(): boolean {
  return isSupabaseConfigured && !useAuthStore.getState().isDemo
}

export interface SavedProject {
  id: string
  name: string
  created_at: string
  updated_at: string
  data: Record<string, unknown>
}

interface ProjectListState {
  projects: SavedProject[]
  loadingProjects: boolean
  
  fetchProjects: (userId: string) => Promise<void>
  saveProject: (userId: string, name: string, data: Record<string, unknown>) => Promise<string | null>
  updateProject: (projectId: string, data: Record<string, unknown>) => Promise<boolean>
  deleteProject: (projectId: string) => Promise<boolean>
  loadProject: (projectId: string) => SavedProject | null
}

export const useProjectListStore = create<ProjectListState>((set, get) => ({
  projects: [],
  loadingProjects: false,

  fetchProjects: async (userId) => {
    set({ loadingProjects: true })

    if (!shouldUseSupabase()) {
      const raw = localStorage.getItem('imar-pro-projects')
      const all: SavedProject[] = raw ? JSON.parse(raw) : []
      // Demo/guest mode: show all local projects (no user isolation needed)
      set({ projects: all, loadingProjects: false })
      return
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (!error && data) {
        set({
          projects: data.map((d: Record<string, unknown>) => ({
            id: d.id as string,
            name: d.name as string,
            created_at: d.created_at as string,
            updated_at: d.updated_at as string,
            data: (d.data || {}) as Record<string, unknown>,
          })),
          loadingProjects: false,
        })
      } else {
        set({ loadingProjects: false })
      }
    } catch {
      set({ loadingProjects: false })
    }
  },

  saveProject: async (userId, name, data) => {
    const id = 'proj-' + Date.now()
    const now = new Date().toISOString()
    const project: SavedProject = { id, name, created_at: now, updated_at: now, data: { ...data, userId } }

    if (!shouldUseSupabase()) {
      const raw = localStorage.getItem('imar-pro-projects')
      const all: SavedProject[] = raw ? JSON.parse(raw) : []
      all.unshift(project)
      localStorage.setItem('imar-pro-projects', JSON.stringify(all))
      set((s) => ({ projects: [project, ...s.projects] }))
      return id
    }

    try {
      const { data: result, error } = await supabase
        .from('projects')
        .insert({ user_id: userId, name, data })
        .select()
        .single()

      if (error) {
        console.error('Supabase project insert error:', error.message, error.details, error.hint)
      }

      if (!error && result) {
        const saved: SavedProject = {
          id: result.id,
          name: result.name,
          created_at: result.created_at,
          updated_at: result.updated_at,
          data: result.data,
        }
        set((s) => ({ projects: [saved, ...s.projects] }))
        return result.id
      }
    } catch {}
    return null
  },

  updateProject: async (projectId, data) => {
    const now = new Date().toISOString()

    if (!shouldUseSupabase()) {
      const raw = localStorage.getItem('imar-pro-projects')
      const all: SavedProject[] = raw ? JSON.parse(raw) : []
      const idx = all.findIndex((p) => p.id === projectId)
      if (idx >= 0) {
        all[idx].data = data
        all[idx].updated_at = now
        localStorage.setItem('imar-pro-projects', JSON.stringify(all))
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId ? { ...p, data, updated_at: now } : p
          ),
        }))
        return true
      }
      return false
    }

    try {
      const { error } = await supabase
        .from('projects')
        .update({ data, updated_at: now })
        .eq('id', projectId)
      return !error
    } catch {
      return false
    }
  },

  deleteProject: async (projectId) => {
    if (!shouldUseSupabase()) {
      const raw = localStorage.getItem('imar-pro-projects')
      const all: SavedProject[] = raw ? JSON.parse(raw) : []
      const filtered = all.filter((p) => p.id !== projectId)
      localStorage.setItem('imar-pro-projects', JSON.stringify(filtered))
      set((s) => ({ projects: s.projects.filter((p) => p.id !== projectId) }))
      return true
    }

    try {
      const { error } = await supabase.from('projects').delete().eq('id', projectId)
      if (!error) {
        set((s) => ({ projects: s.projects.filter((p) => p.id !== projectId) }))
        return true
      }
    } catch {}
    return false
  },

  loadProject: (projectId) => {
    return get().projects.find((p) => p.id === projectId) || null
  },
}))
