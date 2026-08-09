import { chromium } from 'playwright';
import { routeThroughNode } from '../net-route.mjs';
import fs from 'node:fs';

const STATE = '/tmp/claude-0/-home-user-NextGen-Lernen/eb861b94-8a1f-55cc-82cb-3d816f432094/scratchpad/pinterest-state.json';
const OUTDIR = '/tmp/claude-0/-home-user-NextGen-Lernen/eb861b94-8a1f-55cc-82cb-3d816f432094/scratchpad';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({
  storageState: STATE,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  locale: 'de-DE',
  viewport: { width: 1400, height: 1000 },
});
await routeThroughNode(context);
const page = await context.newPage();

console.log('Navigating to profile ...');
await page.goto('https://www.pinterest.com/juliuserb2006/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);

// Click the "Boards" tab if present, otherwise assume default view shows boards.
try {
  const boardsTab = page.getByRole('link', { name: /boards/i }).first();
  if (await boardsTab.count()) { await boardsTab.click({ timeout: 5000 }).catch(()=>{}); await page.waitForTimeout(1500); }
} catch {}

// scroll a bit to load all board tiles
for (let i = 0; i < 6; i++) {
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(600);
}

await page.screenshot({ path: `${OUTDIR}/pin-profile.png`, fullPage: false }).catch(()=>{});

const boards = await page.evaluate(() => {
  const out = [];
  const seen = new Set();
  document.querySelectorAll('a[href^="/juliuserb2006/"]').forEach(a => {
    const href = a.getAttribute('href');
    // board links look like /username/board-slug/
    const m = href.match(/^\/juliuserb2006\/([^/]+)\/$/);
    if (!m) return;
    const slug = m[1];
    if (['_saved','pins','_created'].includes(slug)) return;
    if (seen.has(slug)) return;
    // find name text within this anchor or its container
    let container = a.closest('div');
    let text = a.getAttribute('aria-label') || a.textContent || '';
    text = text.trim();
    if (!text) return;
    seen.add(slug);
    out.push({ slug, text });
  });
  return out;
});

fs.writeFileSync(`${OUTDIR}/pin-boards-raw.json`, JSON.stringify(boards, null, 2));
console.log('boards found:', boards.length);
console.log(JSON.stringify(boards, null, 2).slice(0, 3000));

await browser.close();
