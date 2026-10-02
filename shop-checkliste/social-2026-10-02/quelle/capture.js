// node capture.js <fmt> [--times a,b,c] [--workers N] [--fps 30]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FM = { reel:[1080,1920,12], feed:[1080,1350,12], ogvid:[1200,630,10], pin:[1000,1500,10], og:[1200,630,0], ogsq:[1200,1200,0] };
const args = process.argv.slice(2); const fmt = args[0];
const opt = k => { const i = args.indexOf('--'+k); return i>=0 ? args[i+1] : null; };
const [w,h,dur] = FM[fmt]; const fps = +(opt('fps')||30); const workers = +(opt('workers')||2);
const base = 'http://127.0.0.1:5173/scene.html?f='+fmt;
async function openPage(browser){
  const page = await browser.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:1 });
  page.on('console', m => { if (m.type()==='error' || m.type()==='warning') console.log('[page]', m.text().slice(0,300)); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(base); await page.waitForFunction(() => window.SCENE_READY === true, null, { timeout: 180000 });
  return page;
}
(async () => {
  const browser = await chromium.launch({ args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'] });
  const times = opt('times');
  if (times || dur===0) {
    const page = await openPage(browser); const out = opt('out') || 'test'; fs.mkdirSync(out,{recursive:true});
    const list = times ? times.split(',').map(Number) : [0];
    for (const t of list) { const t0=Date.now(); await page.evaluate(t => window.renderFrame(t), t);
      const f = path.join(out, dur===0 ? `${fmt}.png` : `${fmt}_${t.toFixed(2)}.png`); await page.screenshot({ path:f, clip:{x:0,y:0,width:w,height:h} });
      console.log(f, Date.now()-t0, 'ms'); }
    await browser.close(); return;
  }
  const n = Math.round(dur*fps); const dir = `frames/${fmt}`; fs.mkdirSync(dir,{recursive:true});
  const pages = []; for (let i=0;i<workers;i++) pages.push(await openPage(browser));
  let next = 0; const t0 = Date.now();
  await Promise.all(pages.map(async page => { while (true) { const i = next++; if (i>=n) break;
    const f = path.join(dir, String(i).padStart(4,'0')+'.png'); if (fs.existsSync(f) && !args.includes('--force')) continue;
    await page.evaluate(t => window.renderFrame(t), i/fps); await page.screenshot({ path:f, clip:{x:0,y:0,width:w,height:h} });
    if (i%30===0) console.log(fmt, i, '/', n, ((Date.now()-t0)/1000).toFixed(0)+'s'); } }));
  console.log('done', fmt, ((Date.now()-t0)/1000).toFixed(0)+'s');
  await browser.close();
})();
