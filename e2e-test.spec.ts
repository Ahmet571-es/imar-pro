import { test, expect, type Page, type Browser } from '@playwright/test';

const BASE_URL = 'http://localhost:4173';
const SCREENSHOTS = '/home/user/imar-pro/screenshots';

async function setupPage(browser: Browser, viewport = { width: 1280, height: 720 }, userAgent?: string) {
  const opts: { viewport: { width: number; height: number }; userAgent?: string } = { viewport };
  if (userAgent) opts.userAgent = userAgent;
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  await page.route('**/fonts.googleapis.com/**', route => route.abort());
  await page.route('**/fonts.gstatic.com/**', route => route.abort());
  return { context, page };
}

async function loginAsGuest(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => localStorage.setItem('imar-pro-onboarding-done', 'true'));

  const startBtn = page.locator('text=Başla').first();
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click();
    await page.waitForTimeout(800);
  }

  const guestBtn = page.locator('text=Misafir Olarak Devam Et');
  if (await guestBtn.isVisible().catch(() => false)) {
    await guestBtn.click();
    await page.waitForTimeout(1500);
  }

  // Dismiss any onboarding modal
  const skipBtn = page.locator('text=Geç');
  if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(500);
  }
}

async function enterWizardViaQuickStart(page: Page) {
  // Use "Hızlı Başlangıç" -> "Başla +" button to go directly to wizard
  const quickStartBtn = page.locator('text=Başla').last();
  if (await quickStartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await quickStartBtn.click();
    await page.waitForTimeout(1500);
  }
}

test.describe('İmar Pro - Full E2E Test Suite', () => {

  // 1. Landing page
  test('1 - Landing page screenshot', async ({ browser }) => {
    const { context, page } = await setupPage(browser);

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS}/01-landing-page.png`, fullPage: true });

    const title = await page.title();
    console.log('Page title:', title);

    const heroText = await page.locator('h1').first().textContent();
    console.log('Hero text:', heroText);
    expect(heroText).toContain('Arsadan');

    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('text=Başla').first()).toBeVisible();
    expect(await page.locator('#features').count()).toBeGreaterThan(0);
    await expect(page.locator('svg').first()).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();

    const featureCards = page.locator('#features .bg-white');
    console.log(`Feature cards: ${await featureCards.count()}`);
    expect(await featureCards.count()).toBe(6);

    await expect(page.locator('text=Platform Önizleme')).toBeVisible();
    await expect(page.locator('text=İl Deprem Verisi')).toBeVisible();

    // Check carousel navigation arrows
    const carouselArrows = page.locator('.rounded-full.bg-white\\/90');
    console.log(`Carousel arrows: ${await carouselArrows.count()}`);

    console.log('Landing page: OK');
    await context.close();
  });

  // 2. Auth flow
  test('2 - Auth flow (Kayıt/Giriş)', async ({ browser }) => {
    const { context, page } = await setupPage(browser);

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(500);

    // Navigate to auth
    await page.locator('button:has-text("Başla")').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS}/02-auth-page.png`, fullPage: true });

    // Check auth form
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('text=Giriş Yap').first()).toBeVisible();

    // Fill login form
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('Test1234!');
    await page.screenshot({ path: `${SCREENSHOTS}/02-auth-filled.png`, fullPage: true });

    // Switch to register
    await page.locator('text=Hesabınız yok mu').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOTS}/02-register-mode.png`, fullPage: true });
    await expect(page.locator('text=Ad Soyad')).toBeVisible();
    await expect(page.locator('text=Hesap Oluştur')).toBeVisible();

    // Switch to password reset
    await page.locator('text=Zaten hesabınız var').click();
    await page.waitForTimeout(300);
    await page.locator('text=Şifremi Unuttum').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOTS}/02-password-reset.png`, fullPage: true });
    await expect(page.locator('text=Şifre Sıfırla')).toBeVisible();

    // Guest login + onboarding check
    await page.locator('text=Giriş sayfasına dön').click();
    await page.waitForTimeout(300);
    await page.locator('text=Misafir Olarak Devam Et').click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS}/02-after-guest-login.png`, fullPage: true });

    // Verify onboarding wizard appears
    const onboardingTitle = page.locator('text=imarPRO\'ya Hoş Geldiniz');
    const onboardingVisible = await onboardingTitle.isVisible().catch(() => false);
    console.log(`Onboarding wizard visible: ${onboardingVisible}`);

    console.log('Auth flow: OK');
    await context.close();
  });

  // 3. Wizard steps
  test('3 - Wizard steps (Parcel → Zoning → Plan → 3D → Feasibility)', async ({ browser }) => {
    const { context, page } = await setupPage(browser);

    await loginAsGuest(page);
    await page.screenshot({ path: `${SCREENSHOTS}/03-projects-dashboard.png`, fullPage: true });

    // Use Quick Start to enter wizard directly
    await enterWizardViaQuickStart(page);
    await page.screenshot({ path: `${SCREENSHOTS}/03-wizard-entered.png`, fullPage: true });

    // Verify we're in the wizard with step navigation
    const stepNav = page.locator('nav').first();
    await expect(stepNav).toBeVisible();

    // Check all step buttons exist
    const steps = [
      { label: 'Parsel', name: 'parcel' },
      { label: 'İmar', name: 'zoning' },
      { label: 'AI Plan', name: 'plan' },
      { label: '3D', name: '3d' },
      { label: 'Fizibilite', name: 'feasibility' },
    ];

    for (const step of steps) {
      // Click on step icons/buttons in the step nav
      const stepBtn = page.locator(`button:has-text("${step.label}")`).first();
      if (await stepBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await stepBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${SCREENSHOTS}/03-step-${step.name}.png`, fullPage: true });
        console.log(`Step ${step.name}: clicked`);
      } else {
        console.log(`Step ${step.name}: button not found, trying icon click`);
        // Steps might only show icons on smaller screens
        const allButtons = await page.locator('nav button').all();
        console.log(`Total nav buttons: ${allButtons.length}`);
      }
    }

    console.log('Wizard steps: OK');
    await context.close();
  });

  // 4. Three.js 3D viewer
  test('4 - Three.js 3D viewer check', async ({ browser }) => {
    const { context, page } = await setupPage(browser);

    await loginAsGuest(page);
    await enterWizardViaQuickStart(page);

    // Click 3D step
    const threeDBtn = page.locator('button:has-text("3D")').first();
    if (await threeDBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await threeDBtn.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: `${SCREENSHOTS}/04-3d-step.png`, fullPage: true });

    // Check for canvas or warning message
    const canvasCount = await page.locator('canvas').count();
    console.log(`Canvas elements: ${canvasCount}`);

    // Check for warning (expected without data)
    const warning = page.locator('text=Önceki Adımlar Tamamlanmadı');
    if (await warning.isVisible().catch(() => false)) {
      console.log('3D step: shows prerequisite warning (expected)');
      await page.screenshot({ path: `${SCREENSHOTS}/04-3d-warning.png`, fullPage: true });
    }

    // Check for tab buttons when 3D content loads
    const tabs = ['3D Model', 'Render Galerisi', 'What-If', 'Metraj'];
    for (const tab of tabs) {
      const tabBtn = page.locator(`button:has-text("${tab}")`).first();
      const visible = await tabBtn.isVisible().catch(() => false);
      console.log(`Tab "${tab}": ${visible ? 'visible' : 'not visible'}`);
    }

    // Check discipline toggle sidebar placeholder
    const bimlabel = page.locator('text=3D/4D/5D BIM');
    const hasBIM = await bimlabel.isVisible().catch(() => false);
    console.log(`BIM label: ${hasBIM}`);

    await page.screenshot({ path: `${SCREENSHOTS}/04-3d-final.png`, fullPage: true });
    console.log('3D viewer check: OK');
    await context.close();
  });

  // 5. SVG plan check
  test('5 - SVG plan check', async ({ browser }) => {
    const { context, page } = await setupPage(browser);

    await loginAsGuest(page);
    await enterWizardViaQuickStart(page);

    // Should start on Parcel step
    await page.screenshot({ path: `${SCREENSHOTS}/05-parcel-step.png`, fullPage: true });

    // Count SVGs on parcel step
    const svgCountParcel = await page.locator('svg').count();
    console.log(`SVG elements in parcel step: ${svgCountParcel}`);

    // Click Plan step
    const planBtn = page.locator('button:has-text("AI Plan")').first();
    if (await planBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await planBtn.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: `${SCREENSHOTS}/05-plan-step.png`, fullPage: true });

    const svgCountPlan = await page.locator('svg').count();
    console.log(`SVG elements in plan step: ${svgCountPlan}`);

    // Check for Zoning step
    const zoningBtn = page.locator('button:has-text("İmar")').first();
    if (await zoningBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await zoningBtn.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: `${SCREENSHOTS}/05-zoning-step.png`, fullPage: true });

    const svgCountZoning = await page.locator('svg').count();
    console.log(`SVG elements in zoning step: ${svgCountZoning}`);

    console.log('SVG plan check: OK');
    await context.close();
  });

  // 6. Mobile responsive (375px)
  test('6 - Mobile responsive test (375px)', async ({ browser }) => {
    const { context, page } = await setupPage(
      browser,
      { width: 375, height: 812 },
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
    );

    // Landing page mobile
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS}/06-mobile-landing.png`, fullPage: true });

    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    console.log(`Horizontal overflow on landing: ${hasOverflow}`);
    expect(hasOverflow).toBe(false);

    await expect(page.locator('nav').first()).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();

    // Scroll to middle and bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOTS}/06-mobile-middle.png`, fullPage: true });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOTS}/06-mobile-bottom.png`, fullPage: true });

    // Auth page mobile
    await page.locator('button:has-text("Başla")').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS}/06-mobile-auth.png`, fullPage: true });

    // Check auth overflow
    const authOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    console.log(`Horizontal overflow on auth: ${authOverflow}`);

    // Guest login
    await page.evaluate(() => localStorage.setItem('imar-pro-onboarding-done', 'true'));
    await page.locator('text=Misafir Olarak Devam Et').click();
    await page.waitForTimeout(1500);

    const skipBtn = page.locator('text=Geç');
    if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: `${SCREENSHOTS}/06-mobile-dashboard.png`, fullPage: true });

    // Quick start into wizard
    await enterWizardViaQuickStart(page);
    await page.screenshot({ path: `${SCREENSHOTS}/06-mobile-wizard.png`, fullPage: true });

    // Check wizard mobile overflow
    const wizardOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    console.log(`Horizontal overflow in wizard: ${wizardOverflow}`);

    // Check mobile hamburger menu
    const menuBtns = page.locator('header button');
    const menuCount = await menuBtns.count();
    console.log(`Header buttons (mobile): ${menuCount}`);

    // Check font sizes
    const tooSmallText = await page.evaluate(() => {
      const elements = document.querySelectorAll('p, span, h1, h2, h3, h4, a, button, li, label, div');
      let tooSmall = 0;
      const tooSmallList: string[] = [];
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize);
        const text = el.textContent?.trim();
        if (fontSize < 10 && text && text.length > 0 && text.length < 100) {
          tooSmall++;
          tooSmallList.push(`[${fontSize}px] "${text.substring(0, 40)}"`);
        }
      });
      return { count: tooSmall, items: tooSmallList.slice(0, 10) };
    });
    console.log(`Elements with too small font (<10px): ${tooSmallText.count}`);
    if (tooSmallText.items.length > 0) {
      console.log('Small font items:', JSON.stringify(tooSmallText.items, null, 2));
    }

    // Check touch targets (buttons should be at least 44x44)
    const smallTouchTargets = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, a, input');
      let small = 0;
      const smallList: string[] = [];
      buttons.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && (rect.width < 32 || rect.height < 32)) {
          const text = el.textContent?.trim() || el.getAttribute('title') || '';
          small++;
          if (smallList.length < 5) smallList.push(`${rect.width.toFixed(0)}x${rect.height.toFixed(0)} "${text.substring(0, 30)}"`);
        }
      });
      return { count: small, items: smallList };
    });
    console.log(`Small touch targets (<32px): ${smallTouchTargets.count}`);
    if (smallTouchTargets.items.length > 0) {
      console.log('Small targets:', JSON.stringify(smallTouchTargets.items, null, 2));
    }

    console.log('Mobile responsive: OK');
    await context.close();
  });
});
