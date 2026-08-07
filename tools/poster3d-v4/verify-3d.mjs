/* Gezielter 3D-Ladetest nach dem Self-Hosting-Patch. */
import { chromium } from 'playwright';
import { routeThroughNode } from './net-route.mjs';

const PREVIEW = '?preview_theme_id=194124087629';
const pause = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, ignoreHTTPSErrors: true });
await routeThroughNode(ctx);
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
page.on('response', r => { const u = r.url(); if (r.status() >= 400 && /\.(glb|js|hdr)|cdn\.shopify/.test(u)) console.log('HTTP', r.status(), u.slice(0, 120)); });
page.on('requestfailed', r => { const u = r.url(); if (/\.(glb|js|hdr)/.test(u)) console.log('FAILED', u.slice(0, 120), r.failure() && r.failure().errorText); });

await page.goto('https://limitlessposter.com/password', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.evaluate(async () => {
  const body = new URLSearchParams({ form_type: 'storefront_password', utf8: '✓', password: 'shieya' });
  await fetch('/password', { method: 'POST', body, headers: { 'content-type': 'application/x-www-f' + 'orm-urlencoded' } }).catch(() => {});
});
await pause(1500);

const t0 = Date.now();
await page.goto('https://limitlessposter.com/products/roaring-jaguar-floral-poster' + PREVIEW, { waitUntil: 'domcontentloaded', timeout: 90000 });
const domMs = Date.now() - t0;
await page.evaluate(() => {
  window.__mvEvents = [];
  const attach = () => {
    const mv = document.querySelector('model-viewer');
    if (!mv) return setTimeout(attach, 200);
    ['load','error','model-visibility','progress'].forEach(ev => mv.addEventListener(ev, e => {
      window.__mvEvents.push(ev + (ev === 'progress' ? ':' + (e.detail && e.detail.totalProgress) : '') + (ev === 'error' ? ':' + (e.detail && e.detail.type) : ''));
    }));
  };
  attach();
});
const loadMs = await page.evaluate(() => new Promise(res => {
  const t = performance.now();
  const iv = setInterval(() => {
    const mv = document.querySelector('model-viewer');
    if (mv && mv.loaded) { clearInterval(iv); res(Math.round(performance.now() - t)); }
  }, 150);
  setTimeout(() => { clearInterval(iv); res(-1); }, 30000);
}));
console.log('DOM nach', domMs, 'ms; model-viewer.loaded nach weiteren', loadMs, 'ms');
const src = await page.evaluate(() => {
  const s = [...document.querySelectorAll('script[type=module]')].map(x => x.src).filter(u => u.includes('model-viewer'));
  const mv = document.querySelector('model-viewer');
  return { scripts: s.map(u => u.split('/').pop().split('?')[0]), mvSrc: mv ? mv.getAttribute('src').split('/').pop().split('?')[0] : null };
});
const diag = await page.evaluate(() => {
  const mv = document.querySelector('model-viewer');
  const perf = performance.getEntriesByType('resource').filter(e => /model-viewer|\.glb|\.hdr/.test(e.name)).map(e => e.name.split('/').pop().split('?')[0] + ':' + Math.round(e.duration) + 'ms/' + (e.transferSize || 0) + 'B');
  return { defined: !!(window.customElements && customElements.get('model-viewer')), loaded: mv ? mv.loaded : null, perf };
});
console.log('customElement definiert:', diag.defined, '| mv.loaded:', diag.loaded);
console.log('ressourcen:', diag.perf.join(' | '));
console.log('geladenes Modul:', src.scripts.join(','), '| GLB:', src.mvSrc);
await pause(2500);
await page.screenshot({ path: 'out/final-r/prod-3d-after-fix.png' });
const evs = await page.evaluate(() => (window.__mvEvents || []).slice(0, 20));
console.log('mv-events:', evs.join(' | ') || 'KEINE');
console.log('Konsolen-Fehler:', errors.length ? errors.join(' || ') : 'keine');
await browser.close();
