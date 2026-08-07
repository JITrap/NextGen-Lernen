/* Schlussverifikation R-Paket: v3-Preview (Homepage, Produkt, Queens, Footer)
   + v2-Gegenprobe. Bewusst langsam getaktet (Cloudflare). */
import { chromium } from 'playwright';
import { routeThroughNode } from './net-route.mjs';
import { mkdirSync } from 'node:fs';

const PREVIEW = '?preview_theme_id=194124087629';
const OUT = 'out/final-r';
mkdirSync(OUT, { recursive: true });
const pause = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, ignoreHTTPSErrors: true });
await routeThroughNode(ctx);
const page = await ctx.newPage();
const report = [];

async function login(p) {
  await p.goto('https://limitlessposter.com/password', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await p.evaluate(async () => {
    const body = new URLSearchParams({ form_type: 'storefront_password', utf8: '✓', password: 'shieya' });
    await fetch('/password', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } }).catch(() => {});
  });
  await pause(1500);
}

async function goSlow(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await pause(4000);
  const challenged = await page.evaluate(() => document.body.innerText.includes('Verify you are human') || document.body.innerText.includes('connection needs to be verified'));
  if (challenged) { report.push(['CLOUDFLARE bei', url]); return false; }
  return true;
}

await login(page);

// ---- Homepage v3
if (await goSlow('https://limitlessposter.com/' + PREVIEW)) {
  await pause(2000);
  const home = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.lp-tile img')];
    return {
      tileCount: tiles.length,
      tileSrcOk: tiles.filter(i => (i.currentSrc || i.src || '').includes('lp-tile-')).length,
      marquee: [...document.querySelectorAll('.marquee p, [class*=marquee] p')].map(e => e.textContent.trim()).filter(t => t.includes('Versand'))[0] || null,
      editorial: [...document.querySelectorAll('img')].some(i => (i.currentSrc || i.src || '').includes('LP_editorial_room')),
      showcase: [...document.querySelectorAll('img')].some(i => (i.currentSrc || i.src || '').includes('lp-showcase-inotover')),
      infoMenu: [...document.querySelectorAll('a[href*="/pages/"]')].map(a => a.getAttribute('href')),
      policyLinks: [...document.querySelectorAll('a[href*="/policies/"]')].length,
    };
  });
  report.push(['home: Kacheln (soll 8, lp-tile)', `${home.tileCount} / ${home.tileSrcOk} mit lp-tile`]);
  report.push(['home: Marquee-Versandtext', home.marquee]);
  report.push(['home: Editorial-F1-Zeichnung', home.editorial]);
  report.push(['home: Showcase-Rahmenbild', home.showcase]);
  report.push(['home: /pages/-Links', [...new Set(home.infoMenu)].join(', ') || 'KEINE']);
  report.push(['home: Policy-Links', home.policyLinks]);
  const ts = page.locator('.lp-tiles');
  if (await ts.count()) { await ts.scrollIntoViewIfNeeded(); await pause(1200); }
  await page.screenshot({ path: `${OUT}/home-tiles.png` });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pause(1200);
  await page.screenshot({ path: `${OUT}/home-footer.png` });
}
await pause(8000);

// ---- Produktseite: lp5-GLB, Ladezeit, Foto-Mockups, Rückseiten-Karte
for (const h of ['roaring-jaguar-floral-poster', 'framed-poster-messi-black-white-portrait-wall-art']) {
  if (await goSlow(`https://limitlessposter.com/products/${h}${PREVIEW}`)) {
    const d = await page.evaluate(() => {
      const s = document.querySelector('[data-lp-data]');
      const j = s ? JSON.parse(s.textContent) : {};
      const mocks = [...document.querySelectorAll('.lp-panel--img img')].map(i => (i.currentSrc || i.src || '').split('/').pop().split('?')[0]);
      return { glb: j.glb ? j.glb.split('/').pop().split('?')[0] : null, env: !!j.env, mocks };
    });
    report.push([`produkt ${h.slice(0, 24)}: glb`, d.glb]);
    report.push([`  mockup-panels`, d.mocks.filter(m => m.includes('wohnbeispiel') || m.includes('studio')).join(', ') || 'keine Foto-Mockups!']);
    // 3D-Ladezeit: warte auf model-viewer load-Event
    const loadMs = await page.evaluate(() => new Promise(res => {
      const t0 = performance.now();
      const check = () => {
        const mv = document.querySelector('model-viewer');
        if (mv && mv.loaded) return res(Math.round(performance.now() - t0));
        if (mv) mv.addEventListener('load', () => res(Math.round(performance.now() - t0)), { once: true });
        else setTimeout(check, 200);
      };
      check();
      setTimeout(() => res(-1), 25000);
    }));
    report.push([`  3D geladen nach (ms, seit Check-Start)`, loadMs]);
    await pause(1500);
    await page.screenshot({ path: `${OUT}/prod-${h.slice(0, 20)}.png` });
    // Rückseiten-Spot: Detail-Panel → 4. Spot klicken → Karte?
    const backOk = await page.evaluate(async () => {
      const thumb = document.querySelector('[data-target="detail"]');
      if (!thumb) return 'kein detail-thumb';
      thumb.click();
      await new Promise(r => setTimeout(r, 800));
      const spot = document.querySelector('.lp-spot[data-spot="rueckseite"]');
      if (!spot) return 'kein rueckseite-spot';
      spot.click();
      await new Promise(r => setTimeout(r, 1600));
      return document.querySelector('.lp-dcard--back') ? 'karte sichtbar' : 'KEINE karte';
    });
    report.push([`  rückseiten-karte`, backOk]);
    await page.screenshot({ path: `${OUT}/prod-${h.slice(0, 20)}-back.png` });
  }
  await pause(8000);
}

// ---- Währungs-Selector (SSR-Liste im DOM)
if (await goSlow('https://limitlessposter.com/' + PREVIEW)) {
  const cur = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.localization-form__list-item[data-value]')];
    return items.map(li => (li.getAttribute('aria-label') || '') + '→' + li.getAttribute('data-value'));
  });
  report.push(['währungs-liste', cur.join(' | ') || 'LEER (kein Selector im DOM?)']);
}
await pause(8000);

// ---- Queens
if (await goSlow('https://limitlessposter.com/collections/queens-feminine-energy' + PREVIEW)) {
  const lily = await page.evaluate(() => [...document.querySelectorAll('img')].some(i => (i.currentSrc || i.src || '').includes('lp-queens-lily')));
  report.push(['queens: foto-lilie', lily]);
  await page.screenshot({ path: `${OUT}/queens.png` });
}
await pause(8000);

// ---- v2-Gegenprobe (frischer Kontext, ohne Preview)
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 950 }, ignoreHTTPSErrors: true });
await routeThroughNode(ctx2);
const p2 = await ctx2.newPage();
await login(p2);
await p2.goto('https://limitlessposter.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await pause(3000);
const v2home = await p2.evaluate(() => ({
  lpTiles: document.querySelectorAll('.lp-tile').length,
  currencyList: document.querySelectorAll('.localization-form__list-item[id][data-value]').length,
  marquee: [...document.querySelectorAll('p')].map(e => e.textContent.trim()).filter(t => t.includes('Versand ab 50'))[0] || null,
}));
report.push(['v2: lp-tiles (soll 0)', v2home.lpTiles]);
report.push(['v2: hat noch alten Marquee-Text?', v2home.marquee || 'nein (Text nicht gefunden)']);
await pause(6000);
await p2.goto('https://limitlessposter.com/products/roaring-jaguar-floral-poster', { waitUntil: 'domcontentloaded', timeout: 90000 });
await pause(3000);
const v2prod = await p2.evaluate(() => ({
  v4marker: !!document.querySelector('.lp-sizecomp, .lp-spot[data-spot="rueckseite"]'),
  mocks: [...document.querySelectorAll('img')].map(i => (i.currentSrc || i.src || '')).filter(u => u.includes('wohnbeispiel')).length,
}));
report.push(['v2 produkt: v4-Marker (soll false)', v2prod.v4marker]);
report.push(['v2 produkt: zeigt Foto-Mockups (erwartet: ja, Medien sind shopweit)', v2prod.mocks]);

console.log('\n===== FINAL REPORT (R-Paket) =====');
for (const [k, v] of report) console.log('-', k, '→', v);
await browser.close();
