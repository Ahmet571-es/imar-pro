import { useSettingsStore } from '@/stores/settingsStore'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const API_BASE = import.meta.env.VITE_API_URL || ''

async function getApiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const { claudeApiKey, grokApiKey } = useSettingsStore.getState()
  if (claudeApiKey) headers['X-Claude-Api-Key'] = claudeApiKey
  if (grokApiKey) headers['X-Grok-Api-Key'] = grokApiKey

  // Supabase auth token — backend JWT doğrulaması için
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
    } catch { /* sessiz */ }
  }

  // Demo mod — localStorage'dan user ID
  if (!headers['Authorization']) {
    const guest = localStorage.getItem('imar-pro-guest')
    if (guest) {
      try {
        const user = JSON.parse(guest)
        if (user?.id) headers['X-Demo-User-Id'] = user.id
      } catch { /* sessiz */ }
    }
  }

  return headers
}

async function request<T>(path: string, options?: RequestInit, retries = 2): Promise<T> {
  // Offline detection
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('İnternet bağlantınız yok. Lütfen bağlantınızı kontrol edin.')
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const headers = await getApiHeaders()
      const res = await fetch(`${API_BASE}${path}`, {
        headers,
        ...options,
      })

      // 429 — rate limit
      if (res.status === 429) {
        throw new Error('Çok fazla istek gönderildi. Lütfen biraz bekleyin.')
      }

      // 401 — session expired
      if (res.status === 401) {
        // Session refresh dene
        if (isSupabaseConfigured && attempt === 0) {
          try {
            await supabase.auth.refreshSession()
            continue // Retry with new token
          } catch { /* fall through */ }
        }
        throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.')
      }

      // 403 — forbidden
      if (res.status === 403) {
        const error = await res.json().catch(() => ({ detail: 'Yetkiniz yok' }))
        throw new Error(error.detail || 'Bu işlem için yetkiniz yok.')
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(error.detail || `Sunucu hatası (HTTP ${res.status})`)
      }

      return res.json()
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))

      // Network error — retry
      if (e instanceof TypeError && e.message.includes('fetch') && attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))) // Exponential backoff
        continue
      }

      // Don't retry non-network errors
      if (!(e instanceof TypeError && e.message.includes('fetch'))) {
        throw e
      }
    }
  }

  throw lastError || new Error('Sunucuya bağlanılamıyor. Lütfen tekrar deneyin.')
}

// ── Parsel API ──

export async function calculateRectangle(en: number, boy: number, yon = 'kuzey') {
  return request('/api/parcel/calculate/rectangle', {
    method: 'POST',
    body: JSON.stringify({ en, boy, yon }),
  })
}

export async function calculateFromEdges(kenarlar: number[], acilar?: number[], yon = 'kuzey') {
  return request('/api/parcel/calculate/edges', {
    method: 'POST',
    body: JSON.stringify({ kenarlar, acilar, yon }),
  })
}

export async function queryTKGM(il: string, ilce: string, mahalle: string, ada: string, parsel: string) {
  return request('/api/parcel/tkgm', {
    method: 'POST',
    body: JSON.stringify({ il, ilce, mahalle, ada, parsel }),
  })
}

export async function getIller() {
  return request<Record<string, string[]>>('/api/parcel/tkgm/iller')
}

// ── İmar API ──

export async function calculateZoning(params: Record<string, unknown>) {
  return request('/api/zoning/calculate', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getZoningDefaults() {
  return request('/api/zoning/defaults')
}

// ── Plan API ──

export async function generatePlan(params: Record<string, unknown>) {
  return request('/api/plan/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ── 3D & Render API ──

export async function getBuildingData(params: Record<string, unknown>) {
  return request('/api/3d/building-data', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function whatIfAnalysis(params: Record<string, unknown>) {
  return request('/api/3d/what-if', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function generateRoomRender(params: Record<string, unknown>) {
  return request('/api/render/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function generateExteriorRender(params: Record<string, unknown>) {
  return request('/api/render/exterior', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getRenderStyles() {
  return request<Record<string, { isim: string; aciklama: string }>>('/api/render/styles')
}

// ── Feasibility API ──

export async function calculateFeasibility(params: Record<string, unknown>) {
  return request('/api/feasibility/calculate', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ── Earthquake API ──

export async function analyzeEarthquake(params: Record<string, unknown>) {
  return request('/api/earthquake/analyze', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getAfadIller() {
  return request<{ il: string; plaka: number; ss: number; s1: number; latitude: number; longitude: number }[]>('/api/earthquake/afad-iller')
}

// ── Energy API ──

export async function calculateEnergy(params: Record<string, unknown>) {
  return request('/api/energy/calculate', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ── Export API ──

export function getExportDXFUrl() {
  return `${API_BASE}/api/export/dxf`
}

export function getExportSVGUrl() {
  return `${API_BASE}/api/export/svg`
}

export async function downloadPDFReport(params: Record<string, unknown>) {
  const headers = await getApiHeaders()
  const res = await fetch(`${API_BASE}/api/export/pdf`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || `PDF oluşturulamadı (HTTP ${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = `imarPRO_rapor_${Date.now()}.pdf`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

export async function generateAICommentary(params: Record<string, unknown>) {
  return request<{ yorum: string }>('/api/feasibility/ai-yorum', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ── Level 6: Çoklu Kat ──

export async function generateMultiFloorPlan(params: Record<string, unknown>) {
  return request('/api/plan/multi-floor', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ── Level 6: DOP ──

export async function calculateDOP(params: Record<string, unknown>) {
  return request('/api/feasibility/dop', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ── Level 6: İmar PDF Okuma ──

export async function parseImarPDF(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const apiBase = import.meta.env.VITE_API_URL || ''
  const allHeaders = await getApiHeaders()
  // FormData — Content-Type otomatik ayarlanmalı
  delete allHeaders['Content-Type']

  const res = await fetch(`${apiBase}/api/imar/parse-pdf`, {
    method: 'POST',
    headers: allHeaders,
    body: formData,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || `PDF okuma hatası (HTTP ${res.status})`)
  }
  return res.json()
}

// ── Level 6: Proje Karşılaştırma ──

export async function compareProjects(projects: Record<string, unknown>[]) {
  return request('/api/projects/compare', {
    method: 'POST',
    body: JSON.stringify({ projects }),
  })
}

// ══════════════════════════════════════
// Derinleştirme API'leri
// ══════════════════════════════════════

// ── BIM API ──

export async function getBIMDisciplines() {
  return request<{
    disciplines: {
      id: string; name: string; icon: string; color: string
      elements: string[]; default_visible: boolean
    }[]
    bim_level: string
  }>('/api/bim/disciplines')
}

export async function getBIMSummary(params: Record<string, unknown>) {
  return request('/api/bim/summary', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function runClashDetection(params: Record<string, unknown>) {
  return request('/api/bim/clash-detection', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getMEPSchematic(params: Record<string, unknown>) {
  return request('/api/bim/mep-schematic', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function downloadIFC(params: Record<string, unknown>) {
  const headers = await getApiHeaders()
  const res = await fetch(`${API_BASE}/api/bim/export/ifc`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(`IFC export hatası (HTTP ${res.status})`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = `imarPRO_LOD300.ifc`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

// ── Fizibilite Derinleştirme ──

export async function calculateScenarios(params: Record<string, unknown>) {
  return request('/api/feasibility/senaryo', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function calculateLoan(params: Record<string, unknown>) {
  return request('/api/feasibility/kredi', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function calculateInflation(params: Record<string, unknown>) {
  return request('/api/feasibility/enflasyon', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function calculateRentYield(params: Record<string, unknown>) {
  return request('/api/feasibility/kira', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ── Deprem Derinleştirme ──

export async function getDesignSpectrum(params: Record<string, unknown>) {
  return request('/api/earthquake/spektrum', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getBuildingPeriod(params: Record<string, unknown>) {
  return request('/api/earthquake/periyod', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getSeismicForces(params: Record<string, unknown>) {
  return request('/api/earthquake/kuvvet', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ── Enerji Derinleştirme ──

export async function getMonthlyEnergy(params: Record<string, unknown>) {
  return request('/api/energy/aylik', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getSolarROI(params: Record<string, unknown>) {
  return request('/api/energy/solar', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getHeatLossMap(params: Record<string, unknown>) {
  return request('/api/energy/heat-loss', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ══════════════════════════════════════
// SaaS API'leri (Genişletilmiş)
// ══════════════════════════════════════

// ── Auth ──

export async function requestPasswordReset(email: string) {
  return request<{ success: boolean; message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function updatePassword(newPassword: string) {
  return request<{ success: boolean }>('/api/user/password', {
    method: 'PUT',
    body: JSON.stringify({ new_password: newPassword }),
  })
}

// ── Profil ──

export async function getProfile() {
  return request<Record<string, unknown>>('/api/user/profile')
}

export async function updateProfile(data: Record<string, unknown>) {
  return request('/api/user/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function getUsageStats() {
  return request<Record<string, unknown>>('/api/user/usage')
}

// ── Organizasyon ──

export async function createOrganization(name: string, slug: string) {
  return request('/api/org/create', {
    method: 'POST',
    body: JSON.stringify({ name, slug }),
  })
}

export async function listOrganizations() {
  return request<{ organizations: Record<string, unknown>[] }>('/api/org/list')
}

export async function getOrgMembers(orgId: string) {
  return request<{ members: Record<string, unknown>[] }>(`/api/org/${orgId}/members`)
}

export async function inviteToOrg(orgId: string, email: string, role = 'member') {
  return request(`/api/org/${orgId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  })
}

export async function acceptInvite(inviteId: string) {
  return request(`/api/org/invite/${inviteId}/accept`, { method: 'POST' })
}

export async function rejectInvite(inviteId: string) {
  return request(`/api/org/invite/${inviteId}/reject`, { method: 'POST' })
}

// ── Bildirimler ──

export async function getNotifications() {
  return request<{ notifications: Record<string, unknown>[]; unread_count: number }>('/api/notifications')
}

export async function markNotificationsRead() {
  return request('/api/notifications/read-all', { method: 'PUT' })
}

// ── Proje CRUD (Supabase) ──

export async function createProjectAPI(name: string, description = '', il = '', ilce = '') {
  return request<{ success: boolean; project: Record<string, unknown> }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description, il, ilce }),
  })
}

export async function listProjectsAPI() {
  return request<{ projects: Record<string, unknown>[] }>('/api/projects')
}

export async function getProjectAPI(projectId: string) {
  return request<{ project: Record<string, unknown> }>(`/api/projects/${projectId}`)
}

export async function updateProjectAPI(projectId: string, data: Record<string, unknown>) {
  return request(`/api/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteProjectAPI(projectId: string) {
  return request(`/api/projects/${projectId}`, { method: 'DELETE' })
}

export async function shareProject(projectId: string, email: string, permission = 'view') {
  return request(`/api/project/${projectId}/share`, {
    method: 'POST',
    body: JSON.stringify({ email, permission }),
  })
}

export async function getShareLink(projectId: string) {
  return request<{ share_url: string; token: string }>(`/api/project/${projectId}/share-link`, {
    method: 'POST',
  })
}

// ── Admin ──

export async function getAdminDashboard() {
  return request<Record<string, unknown>>('/api/admin/dashboard')
}

export async function getAdminUsers() {
  return request<{ users: Record<string, unknown>[]; total: number }>('/api/admin/users')
}

export async function updateAdminUser(userId: string, data: Record<string, unknown>) {
  return request(`/api/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function getAuditLog() {
  return request<{ logs: Record<string, unknown>[]; total: number }>('/api/admin/audit')
}

// ── Sistem ──

export async function getSystemHealth() {
  return request<Record<string, unknown>>('/api/system/health')
}
