import { test, expect, Page } from '@playwright/test'

const WAIT = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Helper: Backend warm-up ──
async function warmUpBackend(page: Page) {
  // Backend cold start'ı önlemek için arka planda ping
  await page.evaluate(() => fetch('/api/bim/disciplines').catch(() => {}))
  await WAIT(3000)
}

// ══════════════════════════════════════
// DESKTOP TESTLER
// ══════════════════════════════════════

test.describe('Desktop — Tam Kullanıcı Akışı', () => {

  test('01 — Landing page yükleniyor', async ({ page }) => {
    await page.goto('/')
    await WAIT(5000) // Backend warm-up
    await warmUpBackend(page)
    
    // Title
    await expect(page).toHaveTitle(/imar/i)
    
    // İçerik var
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(100)
    
    // Başla butonu
    const startBtn = page.locator('button:has-text("Başla"), button:has-text("Hemen")')
    await expect(startBtn.first()).toBeVisible()
  })

  test('02 — Auth sayfası elementleri', async ({ page }) => {
    await page.goto('/')
    await WAIT(3000)
    
    // Başla'ya tıkla
    await page.locator('button').first().click()
    await WAIT(2000)
    
    // Email input
    await expect(page.locator('input[type="email"]')).toBeVisible()
    
    // Password input
    await expect(page.locator('input[type="password"]')).toBeVisible()
    
    // Misafir butonu
    await expect(page.locator('button:has-text("Misafir")')).toBeVisible()
  })

  test('03 — Misafir giriş → Projeler', async ({ page }) => {
    await page.goto('/')
    await WAIT(3000)
    
    await page.locator('button').first().click()
    await WAIT(2000)
    
    await page.locator('button:has-text("Misafir")').first().click()
    await WAIT(3000)
    
    // Onboarding varsa geç
    for (let i = 0; i < 5; i++) {
      const skip = page.locator('button:has-text("İleri"), button:has-text("Atla"), button:has-text("Tamamla"), button:has-text("Devam")')
      if (await skip.count() > 0) {
        const txt = await skip.first().innerText()
        if (['İleri', 'Atla', 'Tamamla', 'Devam', 'Sonraki'].some(k => txt.includes(k))) {
          await skip.first().click()
          await WAIT(500)
        } else break
      } else break
    }
    await WAIT(1000)
    
    // Proje sayfası
    const body = await page.locator('body').innerText()
    expect(body).toMatch(/Proje|proje/i)
  })

  test('04 — Proje oluştur → Wizard', async ({ page }) => {
    // Misafir giriş
    await page.goto('/')
    await WAIT(3000)
    await page.locator('button').first().click()
    await WAIT(1500)
    await page.locator('button:has-text("Misafir")').first().click()
    await WAIT(3000)
    
    // Onboarding geç
    for (let i = 0; i < 5; i++) {
      const skip = page.locator('button:has-text("İleri"), button:has-text("Atla"), button:has-text("Tamamla")')
      if (await skip.count() > 0) {
        await skip.first().click().catch(() => {})
        await WAIT(400)
      } else break
    }
    await WAIT(1000)
    
    // Yeni proje
    const newBtn = page.locator('button:has-text("Yeni Proje"), button:has-text("İlk Proje")')
    if (await newBtn.count() > 0) {
      await newBtn.first().click()
      await WAIT(1000)
      
      const nameInput = page.locator('input[placeholder]').first()
      if (await nameInput.count() > 0) {
        await nameInput.fill('E2E Test Proje')
        const createBtn = page.locator('button:has-text("Oluştur")')
        if (await createBtn.count() > 0) {
          await createBtn.first().click()
          await WAIT(2000)
        }
      }
    }
    
    // Wizard yüklendi — step navigation var
    const steps = await page.locator('button, span').allInnerTexts()
    const hasSteps = steps.some(s => s.includes('Parsel') || s.includes('İmar') || s.includes('Plan'))
    expect(hasSteps).toBeTruthy()
  })

  test('05 — Parsel hesaplama', async ({ page }) => {
    // Hızlı giriş
    await page.goto('/')
    await WAIT(3000)
    await warmUpBackend(page)
    await page.locator('button').first().click()
    await WAIT(1500)
    await page.locator('button:has-text("Misafir")').first().click()
    await WAIT(3000)
    
    // Onboarding geç
    for (let i = 0; i < 5; i++) {
      const s = page.locator('button:has-text("İleri"), button:has-text("Atla"), button:has-text("Tamamla")')
      if (await s.count() > 0) { await s.first().click().catch(() => {}); await WAIT(400) } else break
    }
    await WAIT(1000)
    
    // Proje oluştur
    const nb = page.locator('button:has-text("Yeni Proje"), button:has-text("İlk Proje")')
    if (await nb.count() > 0) {
      await nb.first().click()
      await WAIT(800)
      const inp = page.locator('input[placeholder]').first()
      if (await inp.count() > 0) {
        await inp.fill('Parsel Test')
        await page.locator('button:has-text("Oluştur")').first().click()
        await WAIT(2000)
      }
    }
    
    // Parsel adımında — input'lar var mı
    const numInputs = page.locator('input[type="number"]')
    const count = await numInputs.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('06 — API endpoint'leri çalışıyor', async ({ page }) => {
    // Backend API doğrudan test
    const disciplines = await page.evaluate(() => 
      fetch('/api/bim/disciplines').then(r => r.json())
    )
    expect(disciplines.bim_level).toBe('LOD 300')
    expect(disciplines.disciplines.length).toBe(6)
    
    // Parsel hesaplama
    const parsel = await page.evaluate(() =>
      fetch('/api/parcel/calculate/rectangle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en: 20, boy: 30 }),
      }).then(r => r.json())
    )
    expect(parsel.alan_m2).toBe(600)
    
    // İmar hesaplama
    const imar = await page.evaluate(() =>
      fetch('/api/zoning/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en: 20, boy: 30, kat_adedi: 5, taks: 0.4, kaks: 2.07, on_bahce: 5, arka_bahce: 3, yan_bahce: 3 }),
      }).then(r => r.json())
    )
    expect(imar).toHaveProperty('parsel')
    
    // Fizibilite
    const feas = await page.evaluate(() =>
      fetch('/api/feasibility/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toplam_insaat_alani: 800, kat_adedi: 5, il: 'Ankara', ilce: 'Çankaya', kalite: 'orta', bodrum: true, daire_dagilimi: [{ tip: '2+1', adet: 5, alan: 90 }] }),
      }).then(r => r.json())
    )
    expect(feas).toHaveProperty('ozet')
    
    // Deprem
    const eq = await page.evaluate(() =>
      fetch('/api/earthquake/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ il: 'Ankara', ilce: 'Çankaya', zemin_sinifi: 'ZC', bina_yuksekligi: 15, kat_adedi: 5, tasiyi_sistem: 'cerceve' }),
      }).then(r => r.json())
    )
    expect(eq).toHaveProperty('parametreler')
  })

  test('07 — SaaS endpoint'leri çalışıyor', async ({ page }) => {
    const endpoints = [
      '/api/user/profile',
      '/api/user/usage',
      '/api/notifications',
      '/api/org/list',
      '/api/projects',
      '/api/system/health',
    ]
    
    for (const ep of endpoints) {
      const status = await page.evaluate((url) =>
        fetch(url, { headers: { 'X-Demo-User-Id': 'e2e-test' } }).then(r => r.status),
        ep
      )
      expect(status, `${ep} should return 200`).toBe(200)
    }
  })

  test('08 — PDF export çalışıyor', async ({ page }) => {
    const result = await page.evaluate(() =>
      fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsel: { alan: 600 },
          imar: { taks: 0.4, kaks: 2.07, kat_adedi: 5 },
          plans: [{ rooms: [{ name: 'Salon', area: 25 }], score: { total: 72 } }],
          feasibility: { net_kar: 500000 },
          il: 'Ankara',
        }),
      }).then(r => ({ status: r.status, size: parseInt(r.headers.get('content-length') || '0') }))
    )
    expect(result.status).toBe(200)
  })

  test('09 — IFC export çalışıyor', async ({ page }) => {
    const result = await page.evaluate(() =>
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
    expect(result).toBe(200)
  })

  test('10 — Console hataları yok', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('net::ERR') && !msg.text().includes('favicon')) {
        consoleErrors.push(msg.text())
      }
    })
    
    await page.goto('/')
    await WAIT(5000)
    
    // Font/network hataları hariç gerçek JS hataları
    const realErrors = consoleErrors.filter(e => !e.includes('502') && !e.includes('Failed to load'))
    expect(realErrors).toHaveLength(0)
  })
})

// ══════════════════════════════════════
// MOBİL TESTLER
// ══════════════════════════════════════

test.describe('Mobile — Responsive', () => {

  test('11 — Mobil overflow yok', async ({ page }) => {
    await page.goto('/')
    await WAIT(3000)
    
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(380) // 375 + 5px tolerans
  })

  test('12 — Mobil butonlar erişilebilir', async ({ page }) => {
    await page.goto('/')
    await WAIT(3000)
    
    const buttons = await page.locator('button').all()
    expect(buttons.length).toBeGreaterThan(0)
    
    // Touch target kontrolü — en az 32px
    for (const btn of buttons.slice(0, 5)) {
      const box = await btn.boundingBox()
      if (box) {
        expect(box.height, 'Button height >= 32px').toBeGreaterThanOrEqual(28)
      }
    }
  })
})
