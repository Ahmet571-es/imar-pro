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
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: getApiHeaders(),
      ...options,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(error.detail || `Sunucu hatası (HTTP ${res.status})`)
    }
    return res.json()
  } catch (e) {
    if (e instanceof TypeError && e.message.includes('fetch')) {
      throw new Error('Sunucuya bağlanılamıyor. Backend çalışıyor mu? VITE_API_URL doğru mu?')
    }
    throw e
  }
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
  const headers: Record<string, string> = {}
  const { claudeApiKey } = useSettingsStore.getState()
  if (claudeApiKey) headers['X-Claude-Api-Key'] = claudeApiKey

  const res = await fetch(`${apiBase}/api/imar/parse-pdf`, {
    method: 'POST',
    headers,
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
  const res = await fetch(`${API_BASE}/api/bim/export/ifc`, {
    method: 'POST',
    headers: getApiHeaders(),
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
