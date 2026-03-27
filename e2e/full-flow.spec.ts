import { test, expect } from '@playwright/test'

// ══════════════════════════════════════
// UI TESTLER
// ══════════════════════════════════════

test.describe('UI — Temel Akış', () => {

  test('01 — Landing page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await expect(page).toHaveTitle(/imar/i)
    const btn = page.locator('button').first()
    await expect(btn).toBeVisible()
  })

  test('02 — Auth sayfasi', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await page.locator('button').first().click()
    await page.waitForTimeout(2000)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button:has-text("Misafir")')).toBeVisible()
  })

  test('03 — Misafir giris', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await page.locator('button').first().click()
    await page.waitForTimeout(1500)
    await page.locator('button:has-text("Misafir")').first().click()
    await page.waitForTimeout(3000)
    const body = await page.locator('body').innerText()
    expect(body.toLowerCase()).toContain('proje')
  })

  test('04 — Console hatalari yok', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('net::ERR') && !msg.text().includes('favicon') && !msg.text().includes('502')) {
        errors.push(msg.text())
      }
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(5000)
    expect(errors).toHaveLength(0)
  })
})

// ══════════════════════════════════════
// API TESTLER (fetch ile — hızlı ve güvenilir)
// ══════════════════════════════════════

test.describe('API — Backend Endpointleri', () => {

  test('05 — BIM disiplinleri', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const data = await page.evaluate(() =>
      fetch('/api/bim/disciplines').then(r => r.json())
    )
    expect(data.bim_level).toBe('LOD 300')
    expect(data.disciplines).toHaveLength(6)
  })

  test('06 — Parsel hesaplama', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const data = await page.evaluate(() =>
      fetch('/api/parcel/calculate/rectangle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en: 20, boy: 30 }),
      }).then(r => r.json())
    )
    expect(data.alan_m2).toBe(600)
  })

  test('07 — Imar hesaplama', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const data = await page.evaluate(() =>
      fetch('/api/zoning/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en: 20, boy: 30, kat_adedi: 5, taks: 0.4, kaks: 2.07, on_bahce: 5, arka_bahce: 3, yan_bahce: 3 }),
      }).then(r => r.json())
    )
    expect(data).toHaveProperty('parsel')
  })

  test('08 — Fizibilite hesaplama', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const data = await page.evaluate(() =>
      fetch('/api/feasibility/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toplam_insaat_alani: 800, kat_adedi: 5, il: 'Ankara', ilce: 'Cankaya', kalite: 'orta', bodrum: true, daire_dagilimi: [{ tip: '2+1', adet: 5, alan: 90 }] }),
      }).then(r => r.json())
    )
    expect(data).toHaveProperty('ozet')
    expect(data.ozet.kar).toBeGreaterThan(0)
  })

  test('09 — Deprem analizi', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const data = await page.evaluate(() =>
      fetch('/api/earthquake/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ il: 'Ankara', ilce: 'Cankaya', zemin_sinifi: 'ZC', bina_yuksekligi: 15, kat_adedi: 5, tasiyi_sistem: 'cerceve' }),
      }).then(r => r.json())
    )
    expect(data).toHaveProperty('parametreler')
  })

  test('10 — PDF export', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const status = await page.evaluate(() =>
      fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsel: { alan: 600 }, imar: { taks: 0.4, kaks: 2.07, kat_adedi: 5 },
          plans: [{ rooms: [{ name: 'Salon', area: 25 }], score: { total: 72 } }],
          feasibility: { net_kar: 500000 }, il: 'Ankara',
        }),
      }).then(r => r.status)
    )
    expect(status).toBe(200)
  })

  test('11 — IFC export', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const status = await page.evaluate(() =>
      fetch('/api/bim/export/ifc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kat_adedi: 3, taban_alani: 150, kat_yuksekligi: 3,
          plans: [{ rooms: [{ name: 'Salon', x: 0, y: 0, width: 6, height: 5, type: 'salon' }] }],
          proje_adi: 'E2E Test',
        }),
      }).then(r => r.status)
    )
    expect(status).toBe(200)
  })

  test('12 — SaaS endpointleri', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const endpoints = ['/api/user/profile', '/api/user/usage', '/api/notifications', '/api/org/list', '/api/projects', '/api/system/health']
    for (const ep of endpoints) {
      const status = await page.evaluate((url) =>
        fetch(url, { headers: { 'X-Demo-User-Id': 'e2e-test' } }).then(r => r.status), ep
      )
      expect(status, `${ep} = 200`).toBe(200)
    }
  })
})

// ══════════════════════════════════════
// MOBİL
// ══════════════════════════════════════

test.describe('Mobile — Responsive', () => {

  test('13 — Mobil overflow yok', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    const w = await page.evaluate(() => document.body.scrollWidth)
    expect(w).toBeLessThanOrEqual(380)
  })
})
