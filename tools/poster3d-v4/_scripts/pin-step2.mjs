import { chromium } from 'playwright';
import { routeThroughNode } from '../net-route.mjs';
import fs from 'node:fs';

const STATE = '/tmp/claude-0/-home-user-NextGen-Lernen/eb861b94-8a1f-55cc-82cb-3d816f432094/scratchpad/pinterest-state.json';
const OUTDIR = '/tmp/claude-0/-home-user-NextGen-Lernen/eb861b94-8a1f-55cc-82cb-3d816f432094/scratchpad';
const TARGET = 176;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({
  storageState: STATE,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  locale: 'de-DE',
  viewport: { width: 1400, height: 1000 },
});
await routeThroughNode(context);
const page = await context.newPage();

console.log('Navigating to board ...');
await page.goto('https://www.pinterest.com/juliuserb2006/limitless/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);

async function collect() {
  return await page.evaluate(() => {
    const map = new Map();
    document.querySelectorAll('a[href^="/pin/"]').forEach(a => {
      const m = a.getAttribute('href').match(/^\/pin\/(\d+)\/?/);
      if (!m) return;
      const id = m[1];
      const img = a.querySelector('img');
      if (!img) return;
      let best = img.currentSrc || img.src || '';
      let bestW = 0;
      const srcset = img.getAttribute('srcset') || img.srcset || '';
      if (srcset) {
        srcset.split(',').forEach(part => {
          const bits = part.trim().split(/\s+/);
          if (bits.length < 2) return;
          const url = bits[0];
          const w = parseInt(bits[1]);
          if (w > bestW) { bestW = w; best = url; }
        });
      }
      if (!best) return;
      if (!map.has(id) || bestW > (map.get(id).w || 0)) map.set(id, { id, url: best, w: bestW });
    });
    return [...map.values()];
  });
}

let all = new Map();
let stableRounds = 0;
let lastCount = -1;
for (let round = 0; round < 400; round++) {
  const batch = await collect();
  for (const p of batch) {
    const prev = all.get(p.id);
    if (!prev || p.w > prev.w) all.set(p.id, p);
  }
  if (all.size === lastCount) stableRounds++; else stableRounds = 0;
  lastCount = all.size;
  if (round % 5 === 0) console.log(`round ${round}: collected ${all.size} / target ${TARGET}`);
  if (all.size >= TARGET) { console.log('reached target count'); break; }
  if (stableRounds >= 8) { console.log('no growth for 8 rounds, stopping (likely reached end)'); break; }
  await page.mouse.wheel(0, 2200);
  await page.waitForTimeout(900);
}

const finalBatch = await collect();
for (const p of finalBatch) {
  const prev = all.get(p.id);
  if (!prev || p.w > prev.w) all.set(p.id, p);
}

console.log('FINAL collected:', all.size);
fs.writeFileSync(`${OUTDIR}/pin-raw-collected.json`, JSON.stringify([...all.values()], null, 2));
await page.screenshot({ path: `${OUTDIR}/pin-board-final.png` }).catch(()=>{});

await browser.close();
