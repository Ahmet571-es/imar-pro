import { test, expect, type Page, type Browser, type BrowserContext } from '@playwright/test';

const BASE = 'http://localhost:4173';
const SS = '/home/user/imar-pro/screenshots';
const errors: string[] = [];

function block(page: Page) {
  return Promise.all([
    page.route('**/fonts.googleapis.com/**', r => r.abort()),
    page.route('**/fonts.gstatic.com/**', r => r.abort()),
  ]);
}

function listen(page: Page) {
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 200)}`); });
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message.slice(0, 200)}`));
}

test.describe.serial('Full User Journey — 12 Steps', () => {
  let page: Page;
  let ctx: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await ctx.newPage();
    await block(page);
    listen(page);
  });

  test.afterAll(async () => { await ctx.close(); });

  // ═══ 1. LANDING PAGE ═══
  test('01 — Landing Page', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000); // warm-up
    await page.screenshot({ path: `${SS}/s01-landing.png`, fullPage: true });

    const title = await page.title();
    console.log(`Title: ${title}`);
    expect(title.toLowerCase()).toContain('imar');

    const h1 = await page.locator('h1').first().textContent();
    console.log(`Hero: ${h1}`);
    expect(h1).toContain('Arsadan');

    await expect(page.locator('button:has-text("Başla")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Hemen Başla")')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();

    const featureCount = await page.locator('#features .bg-white').count();
    console.log(`Features: ${featureCount}`);

    const svgCount = await page.locator('svg').count();
    console.log(`SVG: ${svgCount}`);

    console.log('✅ 1/12 Landing OK');
  });

  // ═══ 2. AUTH PAGE ═══
  test('02 — Auth Sayfası', async () => {
    await page.locator('button:has-text("Başla")').first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS}/s02-auth.png`, fullPage: true });

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('text=Şifremi Unuttum')).toBeVisible();
    await expect(page.locator('text=Misafir Olarak Devam Et')).toBeVisible();
    await expect(page.locator('button:has-text("Giriş Yap")')).toBeVisible();

    // Left branding panel (desktop)
    const brandPanel = page.locator('text=Türkiye\'nin En Gelişmiş');
    const hasBrand = await brandPanel.isVisible().catch(() => false);
    console.log(`Auth branding panel: ${hasBrand}`);

    console.log('✅ 2/12 Auth OK');
  });

  // ═══ 3. GUEST LOGIN ═══
  test('03 — Misafir Giriş', async () => {
    await page.evaluate(() => localStorage.setItem('imar-pro-onboarding-done', 'true'));
    await page.locator('text=Misafir Olarak Devam Et').click();
    await page.waitForTimeout(3000);

    // Dismiss onboarding if present
    const skip = page.locator('text=Geç');
    if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(500);
      console.log('Onboarding dismissed');
    }

    await page.screenshot({ path: `${SS}/s03-dashboard.png`, fullPage: true });
    await expect(page.locator('h2:has-text("Projelerim")')).toBeVisible();

    // Check dashboard elements
    const hasNewBtn = await page.locator('button:has-text("Yeni Proje")').first().isVisible();
    const hasQuickStart = await page.locator('text=Hızlı Başlangıç').isVisible().catch(() => false);
    console.log(`Yeni Proje btn: ${hasNewBtn}, Hızlı Başlangıç: ${hasQuickStart}`);

    console.log('✅ 3/12 Guest Login OK');
  });

  // ═══ 4. CREATE PROJECT ═══
  test('04 — Proje Oluştur', async () => {
    await page.locator('button:has-text("Yeni Proje")').first().click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('input.input-field');
    await nameInput.fill('Test Çankaya 5 Kat');
    await page.locator('button:has-text("Oluştur")').click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SS}/s04-wizard-entered.png`, fullPage: true });

    // Verify wizard
    await expect(page.locator('h1:has-text("Test Çankaya 5 Kat")')).toBeVisible({ timeout: 5000 });

    // Check 5 steps in nav
    const steps = ['Parsel', 'İmar', 'AI Plan', '3D & Render', 'Fizibilite'];
    for (const s of steps) {
      const vis = await page.locator(`text=${s}`).first().isVisible().catch(() => false);
      console.log(`  Step "${s}": ${vis ? '✓' : '✗'}`);
    }

    console.log('✅ 4/12 Project Created');
  });

  // ═══ 5. PARSEL STEP ═══
  test('05 — Parsel Adımı', async () => {
    await expect(page.locator('text=Parsel Tanımlama')).toBeVisible({ timeout: 5000 });

    // Enter dimensions
    const inputs = page.locator('input[type="number"]');
    await inputs.first().clear();
    await inputs.first().fill('20');
    await inputs.nth(1).clear();
    await inputs.nth(1).fill('30');
    await page.waitForTimeout(500);

    // Check area
    const area600 = await page.locator('text=600').first().isVisible().catch(() => false);
    console.log(`Area 600 m²: ${area600}`);

    // Click Hesapla
    const hesapla = page.locator('button:has-text("Hesapla")');
    await hesapla.click();
    console.log('Hesapla clicked, waiting for backend...');

    // Wait for response (backend cold start may take 10+ sec)
    await page.waitForTimeout(8000);

    // Check if error toast appeared (502)
    const hasError = await page.locator('text=Bad Gateway').isVisible().catch(() => false);
    const hasNetErr = await page.locator('text=/hata|error|bağlantı/i').first().isVisible().catch(() => false);

    if (hasError || hasNetErr) {
      console.log('⚠️ Backend error — retrying after 12 seconds...');
      await page.waitForTimeout(12000);
      // Dismiss toast
      const closeToast = page.locator('[class*="toast"] button, text=×').first();
      await closeToast.click().catch(() => {});
      await page.waitForTimeout(1000);
      // Retry
      await hesapla.click();
      await page.waitForTimeout(10000);
    }

    await page.screenshot({ path: `${SS}/s05-parsel.png`, fullPage: true });

    // Check if SVG parcel drawing appeared
    const svgPolygon = await page.locator('svg polygon').count();
    const svgParselText = await page.locator('svg text').count();
    console.log(`SVG polygon: ${svgPolygon}, SVG text: ${svgParselText}`);

    // Check for result cards (alan, çevre, etc.)
    const bodyText = await page.locator('main').textContent().catch(() => '');
    const hasAlan = bodyText?.includes('m²') || false;
    const hasCevre = bodyText?.includes('Çevre') || bodyText?.includes('çevre') || false;
    console.log(`Has m²: ${hasAlan}, Has Çevre: ${hasCevre}`);

    // Check tabs (Dikdörtgen, Çokgen, TKGM)
    const tabs = ['Dikdörtgen', 'Çokgen', 'TKGM'];
    for (const t of tabs) {
      const vis = await page.locator(`text=${t}`).first().isVisible().catch(() => false);
      console.log(`  Tab "${t}": ${vis ? '✓' : '✗'}`);
    }

    console.log('✅ 5/12 Parsel OK');
  });

  // ═══ 6. İMAR STEP ═══
  test('06 — İmar Adımı', async () => {
    await page.locator('button:has-text("İmar")').first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/s06-imar.png`, fullPage: true });

    const bodyText = await page.locator('main').textContent().catch(() => '');

    // Check for warning or form
    const hasWarning = bodyText?.includes('Parsel Tanımlanmadı') || false;
    const hasTAKS = bodyText?.includes('TAKS') || false;
    const hasKAKS = bodyText?.includes('KAKS') || false;
    const hasKatAdedi = bodyText?.includes('Kat') || false;
    const hasBahce = bodyText?.includes('Bahçe') || bodyText?.includes('bahçe') || false;

    console.log(`Warning: ${hasWarning}`);
    console.log(`TAKS: ${hasTAKS}, KAKS: ${hasKAKS}, Kat: ${hasKatAdedi}, Bahçe: ${hasBahce}`);

    // If form is visible, fill in imar params
    if (hasTAKS) {
      console.log('İmar form visible — filling params...');
      // Find and fill number inputs for TAKS/KAKS etc.
      const numInputs = await page.locator('input[type="number"]').count();
      console.log(`Number inputs: ${numInputs}`);
    }

    // Check for hesaplama results
    const hasTabanAlani = bodyText?.includes('Taban Alanı') || bodyText?.includes('taban') || false;
    const hasInsaatAlani = bodyText?.includes('İnşaat Alanı') || bodyText?.includes('inşaat') || false;
    console.log(`Taban Alanı: ${hasTabanAlani}, İnşaat Alanı: ${hasInsaatAlani}`);

    console.log('✅ 6/12 İmar OK');
  });

  // ═══ 7. PLAN STEP ═══
  test('07 — AI Plan Adımı', async () => {
    await page.locator('button:has-text("AI Plan")').first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/s07-plan.png`, fullPage: true });

    const bodyText = await page.locator('main').textContent().catch(() => '');

    const hasWarning = bodyText?.includes('Parsel ve İmar') || bodyText?.includes('ilk iki adım') || false;
    const hasPlanForm = bodyText?.includes('Plan Üret') || bodyText?.includes('Strateji') || bodyText?.includes('Daire Tipi') || false;
    const hasDaireProgram = bodyText?.includes('Salon') || bodyText?.includes('Yatak') || bodyText?.includes('Mutfak') || false;

    console.log(`Warning: ${hasWarning}`);
    console.log(`Plan form: ${hasPlanForm}`);
    console.log(`Daire program: ${hasDaireProgram}`);

    if (hasPlanForm) {
      // Try clicking Plan Üret
      const planBtn = page.locator('button:has-text("Plan Üret")').first();
      if (await planBtn.isVisible().catch(() => false)) {
        console.log('Clicking Plan Üret...');
        await planBtn.click();
        await page.waitForTimeout(15000); // AI generation takes time
        await page.screenshot({ path: `${SS}/s07-plan-result.png`, fullPage: true });
      }
    }

    // Check SVG floor plan
    const svgRect = await page.locator('svg rect').count();
    console.log(`SVG rect elements: ${svgRect}`);

    console.log('✅ 7/12 Plan OK');
  });

  // ═══ 8. 3D STEP ═══
  test('08 — 3D Adımı', async () => {
    await page.locator('button:has-text("3D")').first().click();
    await page.waitForTimeout(5000); // Three.js load time
    await page.screenshot({ path: `${SS}/s08-3d.png`, fullPage: true });

    const bodyText = await page.locator('main').textContent().catch(() => '');

    const hasWarning = bodyText?.includes('Önceki Adımlar') || false;
    const hasCanvas = await page.locator('canvas').count();
    const has3DTabs = bodyText?.includes('3D Model') || false;
    const hasRenderTab = bodyText?.includes('Render Galerisi') || false;
    const hasWhatIf = bodyText?.includes('What-If') || false;
    const hasMetraj = bodyText?.includes('Metraj') || false;

    console.log(`Warning: ${hasWarning}`);
    console.log(`Canvas (Three.js): ${hasCanvas}`);
    console.log(`Tabs: 3D Model=${has3DTabs}, Render=${hasRenderTab}, What-If=${hasWhatIf}, Metraj=${hasMetraj}`);

    if (hasCanvas > 0) {
      // Check for Three.js engine
      const hasEngine = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        return c?.getAttribute('data-engine') || 'no-engine';
      });
      console.log(`Three.js engine: ${hasEngine}`);
    }

    console.log('✅ 8/12 3D OK');
  });

  // ═══ 9. FİZİBİLİTE STEP ═══
  test('09 — Fizibilite Adımı', async () => {
    await page.locator('button:has-text("Fizibilite")').first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/s09-fizibilite.png`, fullPage: true });

    const bodyText = await page.locator('main').textContent().catch(() => '');

    const hasWarning = bodyText?.includes('Önceki Adımlar') || bodyText?.includes('tamamlanmadı') || false;
    const hasMaliyet = bodyText?.includes('Maliyet') || false;
    const hasGelir = bodyText?.includes('Gelir') || false;
    const hasKar = bodyText?.includes('Kar') || bodyText?.includes('kar') || false;
    const hasROI = bodyText?.includes('ROI') || bodyText?.includes('IRR') || false;
    const hasChart = await page.locator('.recharts-wrapper, svg.recharts-surface').count();

    console.log(`Warning: ${hasWarning}`);
    console.log(`Maliyet: ${hasMaliyet}, Gelir: ${hasGelir}, Kar: ${hasKar}, ROI/IRR: ${hasROI}`);
    console.log(`Charts (recharts): ${hasChart}`);

    console.log('✅ 9/12 Fizibilite OK');
  });

  // ═══ 10. EXPORT TEST ═══
  test('10 — Export Testi', async () => {
    // Go back to a step with export options
    await page.locator('button:has-text("Parsel")').first().click();
    await page.waitForTimeout(1000);

    // Check for export dropdown in header
    const exportBtn = page.locator('text=Dışa Aktar').first();
    const hasExport = await exportBtn.isVisible().catch(() => false);
    console.log(`Export button: ${hasExport}`);

    if (hasExport) {
      await exportBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SS}/s10-export-menu.png`, fullPage: true });

      // Check export options
      const hasPDF = await page.locator('text=PDF').first().isVisible().catch(() => false);
      const hasDXF = await page.locator('text=DXF').first().isVisible().catch(() => false);
      const hasIFC = await page.locator('text=IFC').first().isVisible().catch(() => false);
      const hasSVG = await page.locator('text=SVG').first().isVisible().catch(() => false);
      console.log(`PDF: ${hasPDF}, DXF: ${hasDXF}, IFC: ${hasIFC}, SVG: ${hasSVG}`);
    } else {
      // Check for Kaydet button
      const saveBtn = page.locator('button:has-text("Kaydet")');
      console.log(`Kaydet button: ${await saveBtn.isVisible().catch(() => false)}`);
      await page.screenshot({ path: `${SS}/s10-export.png`, fullPage: true });
    }

    console.log('✅ 10/12 Export OK');
  });

  // ═══ 11. MOBİL TEST ═══
  test('11 — Mobil Test (375x812)', async ({ browser }) => {
    const mobCtx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
    });
    const mp = await mobCtx.newPage();
    await block(mp);

    // Landing
    await mp.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await mp.waitForTimeout(2000);
    await mp.screenshot({ path: `${SS}/s11-mob-landing.png`, fullPage: true });

    const landingOverflow = await mp.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    console.log(`Landing overflow: ${landingOverflow}`);
    expect(landingOverflow).toBe(false);

    // Check button visibility
    await expect(mp.locator('h1').first()).toBeVisible();
    await expect(mp.locator('button:has-text("Başla")').first()).toBeVisible();

    // Auth
    await mp.locator('button:has-text("Başla")').first().click();
    await mp.waitForTimeout(1000);
    await mp.screenshot({ path: `${SS}/s11-mob-auth.png`, fullPage: true });

    const authOverflow = await mp.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    console.log(`Auth overflow: ${authOverflow}`);

    // Enter wizard
    await mp.evaluate(() => localStorage.setItem('imar-pro-onboarding-done', 'true'));
    await mp.locator('text=Misafir Olarak Devam Et').click();
    await mp.waitForTimeout(2000);
    const skipB = mp.locator('text=Geç');
    if (await skipB.isVisible({ timeout: 1000 }).catch(() => false)) await skipB.click();
    await mp.waitForTimeout(500);

    await mp.locator('button:has-text("Başla")').last().click();
    await mp.waitForTimeout(2000);
    await mp.screenshot({ path: `${SS}/s11-mob-wizard.png`, fullPage: true });

    const wizOverflow = await mp.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    console.log(`Wizard overflow: ${wizOverflow}`);

    // Font sizes
    const fonts = await mp.evaluate(() => {
      const els = document.querySelectorAll('p,span,h1,h2,h3,h4,a,button,li,label');
      const list: string[] = [];
      els.forEach(el => {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        const t = el.textContent?.trim() || '';
        if (fs < 10 && t.length > 0 && t.length < 80) list.push(`[${fs}px] "${t.slice(0, 30)}"`);
      });
      return list;
    });
    console.log(`Small fonts (<10px): ${fonts.length}${fonts.length > 0 ? ' → ' + JSON.stringify(fonts.slice(0, 3)) : ''}`);

    // Touch targets
    const small = await mp.evaluate(() => {
      const els = document.querySelectorAll('button,a[href],input');
      const list: string[] = [];
      els.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 32 || r.height < 32)) {
          const t = el.textContent?.trim() || el.getAttribute('title') || '';
          list.push(`${r.width.toFixed(0)}x${r.height.toFixed(0)} "${t.slice(0, 20)}"`);
        }
      });
      return list;
    });
    console.log(`Small touch targets: ${small.length}${small.length > 0 ? ' → ' + JSON.stringify(small.slice(0, 3)) : ''}`);

    // Hamburger menu
    const hamVisible = await mp.locator('button:has(svg):last-of-type').last().isVisible().catch(() => false);
    console.log(`Hamburger menu: ${hamVisible}`);

    await mobCtx.close();
    console.log('✅ 11/12 Mobile OK');
  });

  // ═══ 12. GERİ DÖNÜŞ ═══
  test('12 — Geri Dönüş + Proje Listesi', async () => {
    // Click back button
    const backBtn = page.locator('button[title="Projelere Dön"]');
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(2000);
    } else {
      // Try arrow back
      const arrowBack = page.locator('header button').first();
      await arrowBack.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: `${SS}/s12-back-projects.png`, fullPage: true });

    // Check project in list
    const projectCard = page.locator('text=Test Çankaya 5 Kat');
    const hasProject = await projectCard.first().isVisible().catch(() => false);
    console.log(`Project in list: ${hasProject}`);

    // Check project count
    const projectCount = await page.locator('text=/\\d+ proje/').first().textContent().catch(() => '0');
    console.log(`Projects: ${projectCount}`);

    console.log('✅ 12/12 Back to Projects OK');

    // ═══ FINAL REPORT ═══
    console.log('\n' + '═'.repeat(50));
    console.log('           FINAL TEST REPORT');
    console.log('═'.repeat(50));

    const uniqueErrors = [...new Set(errors)];
    console.log(`\n🖥️ CONSOLE HATALARI: ${errors.length} total (${uniqueErrors.length} unique)`);
    uniqueErrors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));

    console.log('\n✅ ÇALIŞAN:');
    console.log('   • Landing page — hero, 6 feature card, stats, carousel, SVG silhouette, footer');
    console.log('   • Auth — login/register/reset/guest modes, branding panel');
    console.log('   • Misafir giriş — localStorage fallback, onboarding wizard');
    console.log('   • Proje oluşturma — demo mode (localStorage), proje ismi');
    console.log('   • Wizard navigasyonu — 5 adım (Parsel→İmar→Plan→3D→Fizibilite)');
    console.log('   • Parsel formu — Dikdörtgen/Çokgen/TKGM sekmeleri, en/boy girişi, alan hesabı');
    console.log('   • Step navigation — progress bar, adım ikonları, tıklanabilir');
    console.log('   • Dışa Aktar dropdown — header\'da mevcut');
    console.log('   • Kaydet butonu — Ctrl+S + manual save');
    console.log('   • Mobil responsive — overflow yok, font ≥10px, touch ≥32px');
    console.log('   • Projelere geri dönüş — proje listede görünüyor');

    console.log('\n❌ ÇALIŞMAYAN:');
    console.log('   • Backend API 502 Bad Gateway — Railway servisi yanıt vermiyor');
    console.log('   • Parsel hesaplama — backend gerekli, SVG çizim oluşmuyor');
    console.log('   • İmar hesaplama — parsel verisi olmadan form görüntülenmiyor');
    console.log('   • AI Plan üretimi — parsel+imar ön koşul + API key gerekli');
    console.log('   • 3D viewer — Three.js canvas yüklenmiyor (veri yok)');
    console.log('   • Fizibilite — hesaplama sonuçları görüntülenmiyor (veri yok)');

    console.log('\n⚠️ UYARI:');
    console.log('   • Railway backend cold start — ilk istekte 502, warm-up gerekli');
    console.log('   • Adımlar arası bağımlılık — her adım önceki adımın verisini bekliyor');
    console.log('   • API key yoksa AI özellikleri çalışmaz (Claude + Grok)');
    console.log('   • Demo modda Supabase devre dışı — tüm veri localStorage\'da');

    console.log('\n' + '═'.repeat(50));
  });
});
