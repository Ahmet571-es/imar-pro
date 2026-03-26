import { useSettingsStore } from '@/stores/settingsStore'

const API_BASE = import.meta.env.VITE_API_URL || ''

function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const { claudeApiKey, grokApiKey } = useSettingsStore.getState()
  if (claudeApiKey) headers['X-Claude-Api-Key'] = claudeApiKey
  if (grokApiKey) headers['X-Grok-Api-Key'] = grokApiKey
  return headers
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: getApiHeaders(),
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || `HTTP ${res.status}`)
  }
  return res.json()
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
  const res = await fetch(`${API_BASE}/api/export/pdf`, {
    method: 'POST',
    headers: getApiHeaders(),
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
