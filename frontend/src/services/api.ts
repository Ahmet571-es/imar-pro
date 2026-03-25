const API_BASE = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
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

export async function generateRoomRender(params: Record<string, unknown>) {
  return request('/api/render/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getRenderStyles() {
  return request<Record<string, { isim: string; aciklama: string }>>('/api/render/styles')
}
