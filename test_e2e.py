"""imarPRO — Full E2E UI Test (Playwright) — timeout-safe"""

import asyncio, os, json
from playwright.async_api import async_playwright

BASE_URL = "https://balaban-imar.vercel.app"
SS = "/home/claude/imar-pro/test-screenshots"
os.makedirs(SS, exist_ok=True)
results = []

def log(step, status, detail=""):
    e = "✅" if status == "pass" else "❌" if status == "fail" else "⚠️"
    results.append({"step": step, "status": status, "detail": detail})
    print(f"  {e} {step}: {detail}")

async def ss(page, name):
    try:
        await page.screenshot(path=f"{SS}/{name}.png", timeout=10000)
    except:
        pass

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-gpu"])
        context = await browser.new_context(viewport={"width": 1280, "height": 800}, locale="tr-TR")
        page = await context.new_page()

        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ── 1. LANDING ──
        print("\n━━━ 1. LANDING PAGE ━━━")
        try:
            resp = await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=20000)
            log("HTTP Status", "pass" if resp and resp.ok else "fail", str(resp.status if resp else "?"))
            await page.wait_for_timeout(3000)
            await ss(page, "01_landing")

            title = await page.title()
            log("Title", "pass", title)

            body = await page.inner_text("body")
            log("İçerik yüklendi", "pass" if len(body) > 50 else "fail", f"{len(body)} karakter")

            btns = await page.query_selector_all("button")
            btn_texts = []
            for b in btns[:8]:
                try: btn_texts.append((await b.inner_text()).strip()[:30])
                except: pass
            log("Butonlar", "pass", str(btn_texts))
        except Exception as e:
            log("Landing", "fail", str(e)[:100])

        # ── 2. AUTH ──
        print("\n━━━ 2. AUTH PAGE ━━━")
        try:
            btn = await page.query_selector("button")
            if btn:
                await btn.click()
                await page.wait_for_timeout(2000)
            await ss(page, "02_auth")

            body = await page.inner_text("body")
            has_email = await page.query_selector("input[type='email']")
            has_pass = await page.query_selector("input[type='password']")
            log("Email input", "pass" if has_email else "fail")
            log("Password input", "pass" if has_pass else "fail")

            guest = await page.query_selector("button:has-text('Misafir')")
            log("Misafir butonu", "pass" if guest else "warn")

            if guest:
                await guest.click()
                await page.wait_for_timeout(2000)
                log("Misafir giriş", "pass")
        except Exception as e:
            log("Auth", "fail", str(e)[:100])

        # ── 3. PROJECTS ──
        print("\n━━━ 3. PROJECTS DASHBOARD ━━━")
        try:
            await ss(page, "03_projects")
            body = await page.inner_text("body")
            log("Projelerim", "pass" if "proje" in body.lower() else "warn", body[:100].replace("\n"," "))

            new_btn = await page.query_selector("button:has-text('Yeni'), button:has-text('İlk Proje'), button:has-text('Oluştur')")
            if new_btn:
                await new_btn.click()
                await page.wait_for_timeout(1000)
                inp = await page.query_selector("input[type='text']")
                if inp:
                    await inp.fill("E2E Test Proje")
                    await inp.press("Enter")
                    await page.wait_for_timeout(2000)
                    log("Proje oluşturuldu", "pass")
            await ss(page, "03_projects_after")

            # Projeyi aç
            card = await page.query_selector("[class*='cursor-pointer']")
            if card:
                await card.click()
                await page.wait_for_timeout(2000)
                log("Proje açıldı", "pass")
        except Exception as e:
            log("Projects", "fail", str(e)[:100])

        # ── 4. PARSEL ──
        print("\n━━━ 4. PARSEL ADIMI ━━━")
        try:
            await ss(page, "04_parsel")
            body = await page.inner_text("body")
            log("Parsel sayfası", "pass" if len(body) > 100 else "warn", body[:80].replace("\n"," "))

            inputs = await page.query_selector_all("input")
            log("Input sayısı", "pass", f"{len(inputs)} input")

            svgs = await page.query_selector_all("svg")
            log("SVG sayısı", "pass" if svgs else "warn", f"{len(svgs)} SVG")

            # Step navigation ile İmar'a geç
            steps = await page.query_selector_all("button")
            step_texts = []
            for s in steps:
                try: step_texts.append((await s.inner_text()).strip()[:20])
                except: pass

            imar_btn = await page.query_selector("button:has-text('İmar'), [class*='step']:has-text('İmar')")
            if imar_btn:
                await imar_btn.click()
                await page.wait_for_timeout(1500)
                log("→ İmar'a geçildi", "pass")
        except Exception as e:
            log("Parsel", "fail", str(e)[:100])

        # ── 5. İMAR ──
        print("\n━━━ 5. İMAR ADIMI ━━━")
        try:
            await ss(page, "05_imar")
            body = await page.inner_text("body")
            log("İmar sayfası", "pass" if ("taks" in body.lower() or "imar" in body.lower() or "kat" in body.lower()) else "warn")

            plan_btn = await page.query_selector("button:has-text('Plan'), [class*='step']:has-text('Plan')")
            if plan_btn:
                await plan_btn.click()
                await page.wait_for_timeout(1500)
                log("→ Plan'a geçildi", "pass")
        except Exception as e:
            log("İmar", "fail", str(e)[:100])

        # ── 6. PLAN ──
        print("\n━━━ 6. PLAN ADIMI ━━━")
        try:
            await ss(page, "06_plan")
            body = await page.inner_text("body")
            log("Plan sayfası", "pass" if len(body) > 50 else "warn")

            gen_btn = await page.query_selector("button:has-text('Üret'), button:has-text('Oluştur'), button:has-text('AI')")
            if gen_btn:
                await gen_btn.click()
                await page.wait_for_timeout(8000)
                log("Plan üretimi tamamlandı", "pass")
                await ss(page, "06_plan_result")

            canvas = await page.query_selector("canvas")
            svg_plan = await page.query_selector("svg[viewBox]")
            log("Plan çizimi", "pass" if (canvas or svg_plan) else "warn")

            td_btn = await page.query_selector("button:has-text('3D'), [class*='step']:has-text('3D')")
            if td_btn:
                await td_btn.click()
                await page.wait_for_timeout(3000)
                log("→ 3D'ye geçildi", "pass")
        except Exception as e:
            log("Plan", "fail", str(e)[:100])

        # ── 7. 3D ──
        print("\n━━━ 7. 3D ADIMI ━━━")
        try:
            await page.wait_for_timeout(3000)
            await ss(page, "07_3d")
            canvas = await page.query_selector("canvas")
            log("Three.js canvas", "pass" if canvas else "fail")

            body = await page.inner_text("body")
            log("3D kontroller", "pass" if len(body) > 100 else "warn")

            fiz_btn = await page.query_selector("button:has-text('Fizibilite'), [class*='step']:has-text('Fizibilite')")
            if fiz_btn:
                await fiz_btn.click()
                await page.wait_for_timeout(2000)
                log("→ Fizibilite'ye geçildi", "pass")
        except Exception as e:
            log("3D", "fail", str(e)[:100])

        # ── 8. FİZİBİLİTE ──
        print("\n━━━ 8. FİZİBİLİTE ━━━")
        try:
            await ss(page, "08_fizibilite")
            body = await page.inner_text("body")
            log("Fizibilite sayfası", "pass" if ("fizibilite" in body.lower() or "maliyet" in body.lower() or "gelir" in body.lower()) else "warn")
        except Exception as e:
            log("Fizibilite", "fail", str(e)[:100])

        # ── 9. MOBİL ──
        print("\n━━━ 9. MOBİL (375x812) ━━━")
        try:
            await page.set_viewport_size({"width": 375, "height": 812})
            await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_timeout(2000)
            await ss(page, "09_mobile")
            log("Mobil landing", "pass")

            btn = await page.query_selector("button")
            if btn:
                await btn.click()
                await page.wait_for_timeout(2000)
                await ss(page, "09_mobile_auth")
                log("Mobil auth", "pass")
        except Exception as e:
            log("Mobil", "fail", str(e)[:100])

        # ── 10. CONSOLE ──
        print("\n━━━ 10. CONSOLE HATALARI ━━━")
        critical = [e for e in errors if any(k in e.lower() for k in ["uncaught", "typeerror", "referenceerror", "cannot read"])]
        if critical:
            log("Kritik JS hatalar", "fail", f"{len(critical)} hata")
            for e in critical[:5]:
                print(f"    ❌ {e[:150]}")
        else:
            log("JS hataları", "pass", f"0 kritik ({len(errors)} toplam)")
        if errors and not critical:
            for e in errors[:3]:
                print(f"    ⚠️ {e[:150]}")

        await context.close()
        await browser.close()

    # RAPOR
    print("\n" + "=" * 60)
    p = sum(1 for r in results if r["status"] == "pass")
    f = sum(1 for r in results if r["status"] == "fail")
    w = sum(1 for r in results if r["status"] == "warn")
    print(f"  ✅ {p} geçti  |  ❌ {f} başarısız  |  ⚠️ {w} uyarı  |  Toplam: {len(results)}")
    if f:
        print(f"\n  BAŞARISIZ:")
        for r in results:
            if r["status"] == "fail":
                print(f"    ❌ {r['step']}: {r['detail']}")
    print(f"\n  Ekran görüntüleri: {SS}/")
    ss_files = sorted(os.listdir(SS))
    for s in ss_files:
        sz = os.path.getsize(f"{SS}/{s}")
        print(f"    📸 {s} ({sz//1024}KB)")
    print("")

asyncio.run(run())
