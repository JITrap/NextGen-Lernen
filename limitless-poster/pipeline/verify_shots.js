/* Playwright-Verifikation des WIP-Themes (passwortgeschützter Store).
   Aufruf: STORE_PW="..." node verify_shots.js  */
const { chromium } = require('playwright');

const BASE = 'https://limitlessposter.com';
const PREVIEW = '?preview_theme_id=194055668045';
const OUT = '/tmp/claude-0/-home-user-NextGen-Lernen/63ab0ad8-60a3-581d-81ff-d61970094d1f/scratchpad/shots';
const PDP = '/products/whatever-it-takes-framed-poster-motivational-bedroom-wall-art';

async function unlock(page) {
  await page.goto(BASE + '/password', { waitUntil: 'domcontentloaded' });
  const input = page.locator('input[type="password"], input[name="password"]').first();
  if (await input.count()) {
    await input.fill(process.env.STORE_PW || '');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
      input.press('Enter'),
    ]);
  }
}

(async () => {
  const browser = await chromium.launch();
  const fs = require('fs');
  fs.mkdirSync(OUT, { recursive: true });

  // Desktop
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await unlock(page);

  await page.goto(BASE + '/' + PREVIEW, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/landing-top.png' });
  await page.screenshot({ path: OUT + '/landing-full.png', fullPage: true });

  // Scroll-Showcase: 25/50/75 % der Sektion
  const show = page.locator('[data-lp-scrollshow]');
  if (await show.count()) {
    const box = await show.boundingBox();
    for (const frac of [0.25, 0.5, 0.75]) {
      await page.evaluate(({ top, frac, h }) => window.scrollTo(0, top + (h - innerHeight) * frac), {
        top: box.y, frac, h: box.height,
      });
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/scrollshow-${frac * 100}.png` });
    }
  } else {
    console.log('WARN: Scroll-Showcase nicht gefunden');
  }

  // PDP mit 3D-Viewer
  await page.goto(BASE + PDP + PREVIEW, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/pdp-top.png' });
  const d3 = page.locator('details.lp-3d-viewer summary');
  if (await d3.count()) {
    await d3.scrollIntoViewIfNeeded();
    await d3.click();
    await page.waitForTimeout(6000); // model-viewer laden + rendern
    await page.screenshot({ path: OUT + '/pdp-3d.png' });
  } else {
    console.log('WARN: 3D-Viewer-Block nicht gefunden');
  }

  // New-Drop-Kollektion
  await page.goto(BASE + '/collections/new-drop' + PREVIEW, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: OUT + '/new-drop.png', fullPage: true });

  // Kollektionsübersicht (neue Kollektionsbilder)
  await page.goto(BASE + '/collections' + PREVIEW, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: OUT + '/collections.png', fullPage: true });
  await ctx.close();

  // Mobil
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mpage = await mctx.newPage();
  await unlock(mpage);
  await mpage.goto(BASE + '/' + PREVIEW, { waitUntil: 'networkidle' });
  await mpage.waitForTimeout(1500);
  await mpage.screenshot({ path: OUT + '/landing-mobile.png', fullPage: true });
  await mctx.close();

  // Reduced Motion
  const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const rpage = await rctx.newPage();
  await unlock(rpage);
  await rpage.goto(BASE + '/' + PREVIEW, { waitUntil: 'networkidle' });
  await rpage.waitForTimeout(1200);
  await rpage.screenshot({ path: OUT + '/landing-reduced-motion.png', fullPage: true });
  await rctx.close();

  await browser.close();
  console.log('Screenshots fertig in', OUT);
})();
