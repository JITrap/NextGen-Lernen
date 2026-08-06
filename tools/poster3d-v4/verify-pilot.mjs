import { chromium } from 'playwright';
import { routeThroughNode } from './net-route.mjs';
import { mkdirSync } from 'node:fs';

const PREVIEW = '?preview_theme_id=194124087629';
const BASE = 'https://limitlessposter.com/products/';
const OUT = 'out/verify';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  await routeThroughNode(ctx);
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  return { page, errors };
}

async function waitForMV(page, timeout = 45000) {
  return page.waitForFunction(() => {
    const mv = document.querySelector('.lp-3d-mount model-viewer');
    return mv && mv.loaded;
  }, { timeout }).then(() => true).catch(() => false);
}

async function run() {
  const report = [];

  // --- Desktop: they-doubt-me-i-deliver ---
  {
    const { page, errors } = await newPage({ width: 1440, height: 900 });
    await page.goto(BASE + 'they-doubt-me-i-deliver' + PREVIEW, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    const glbSrc = await page.evaluate(() => {
      const s = document.querySelector('[data-lp-data]');
      return s ? JSON.parse(s.textContent).glb : null;
    });
    report.push(['doubt: GLB source', glbSrc]);
    const loaded = await waitForMV(page);
    report.push(['doubt: model-viewer loaded', loaded]);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/doubt-front.png` });
    if (loaded) {
      // Rückseite via Kamera
      await page.evaluate(() => {
        const mv = document.querySelector('.lp-3d-mount model-viewer');
        mv.removeAttribute('auto-rotate');
        mv.cameraOrbit = '198deg 82deg 108%';
      });
      await page.waitForTimeout(2200);
      await page.screenshot({ path: `${OUT}/doubt-back.png` });
      // Detail-Tour: Thumb klicken, Rückseite-Spot prüfen
      await page.evaluate(() => {
        const mv = document.querySelector('.lp-3d-mount model-viewer');
        mv.cameraOrbit = '18deg 82deg 108%';
      });
      const detailThumb = page.locator('.lp-thumb[data-target="detail"]');
      if (await detailThumb.count()) {
        await detailThumb.click();
        await page.waitForTimeout(1500);
        const spots = await page.locator('.lp-spot').count();
        report.push(['doubt: detail spots (erwartet 4)', spots]);
        // Verzerrungscheck: Canvas-Box vs. Regionsverhältnis
        const ratio = await page.evaluate(() => {
          const c = document.querySelector('.lp-detail-canvas');
          const cs = getComputedStyle(c.closest('.lp-panel--detail'));
          const b = c.getBoundingClientRect();
          const want = parseFloat(c.closest('.lp-panel--detail').style.getPropertyValue('--lp-detail-ratio') || c.style.aspectRatio || '0');
          return { box: +(b.width / b.height).toFixed(3), want: +want.toFixed(3) };
        });
        report.push(['doubt: detail canvas ratio box vs soll', JSON.stringify(ratio)]);
        await page.screenshot({ path: `${OUT}/doubt-detail.png` });
        const backSpot = page.locator('.lp-spot[data-spot="rueckseite"]');
        report.push(['doubt: Rückseite-Spot vorhanden', await backSpot.count() === 1]);
        if (await backSpot.count()) {
          await backSpot.click();
          await page.waitForTimeout(2600);
          await page.screenshot({ path: `${OUT}/doubt-tour-back.png` });
          const orbit = await page.evaluate(() => {
            const mv = document.querySelector('.lp-3d-mount model-viewer');
            return mv ? mv.getCameraOrbit().theta : null;
          });
          report.push(['doubt: Orbit nach Rückseite-Stopp (rad, soll ~3.46)', orbit && orbit.toFixed(2)]);
        }
      }
    }
    report.push(['doubt: Konsolen-/Seitenfehler', errors.length ? errors.slice(0, 4) : 'keine']);
    await page.close();
  }

  // --- Desktop: its-not-over — Größenwechsel ---
  {
    const { page, errors } = await newPage({ width: 1440, height: 900 });
    await page.goto(BASE + 'motivational-framed-poster-its-not-over-until-i-win' + PREVIEW, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => {
      const s = document.querySelector('[data-lp-data]');
      const stage = document.querySelector('.lp-gallery__stage');
      return { glb: s ? JSON.parse(s.textContent).glb : null, ratio: stage ? stage.style.getPropertyValue('--lp-stage-ratio') : null };
    });
    report.push(['inow: initial GLB + ratio', JSON.stringify({ glb: before.glb && before.glb.split('/').pop().split('?')[0], ratio: before.ratio })]);
    const loaded = await waitForMV(page);
    report.push(['inow: model-viewer loaded', loaded]);
    await page.screenshot({ path: `${OUT}/inow-front.png` });
    // Größe wechseln: 24″ x 36″ (c23)
    const sizeBtn = page.locator('label, button, input[type="radio"] + label').filter({ hasText: '24″ x 36″' }).first();
    if (await sizeBtn.count()) {
      await sizeBtn.click();
      await page.waitForTimeout(3500);
      const after = await page.evaluate(() => {
        const s = document.querySelector('[data-lp-data]');
        const stage = document.querySelector('.lp-gallery__stage');
        return { glb: s ? JSON.parse(s.textContent).glb : null, ratio: stage ? stage.style.getPropertyValue('--lp-stage-ratio') : null };
      });
      report.push(['inow: nach Größenwechsel 24×36', JSON.stringify({ glb: after.glb && after.glb.split('/').pop().split('?')[0], ratio: after.ratio })]);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/inow-c23.png` });
    } else {
      report.push(['inow: Größen-Button 24×36 nicht gefunden', false]);
    }
    report.push(['inow: Fehler', errors.length ? errors.slice(0, 4) : 'keine']);
    await page.close();
  }

  // --- Desktop: F1 landscape ---
  {
    const { page, errors } = await newPage({ width: 1440, height: 900 });
    await page.goto(BASE + 'horizontal-framed-poster' + PREVIEW, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    const loaded = await waitForMV(page);
    report.push(['f1: model-viewer loaded (landscape)', loaded]);
    const ratio = await page.evaluate(() => {
      const stage = document.querySelector('.lp-gallery__stage');
      return stage ? stage.style.getPropertyValue('--lp-stage-ratio') : null;
    });
    report.push(['f1: stage ratio (soll >1)', ratio]);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/f1-front.png` });
    report.push(['f1: Fehler', errors.length ? errors.slice(0, 4) : 'keine']);
    await page.close();
  }

  // --- Mobil ---
  {
    const { page, errors } = await newPage({ width: 390, height: 844 });
    await page.goto(BASE + 'they-doubt-me-i-deliver' + PREVIEW, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    const loaded = await waitForMV(page);
    report.push(['mobil: model-viewer loaded', loaded]);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/doubt-mobile.png`, fullPage: false });
    report.push(['mobil: Fehler', errors.length ? errors.slice(0, 4) : 'keine']);
    await page.close();
  }

  console.log('\n===== VERIFY REPORT =====');
  for (const [k, v] of report) console.log('-', k, '→', typeof v === 'object' ? JSON.stringify(v) : v);
}

await run();
await browser.close();
