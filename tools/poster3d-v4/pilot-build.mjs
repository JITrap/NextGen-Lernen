import { writeFileSync, mkdirSync } from 'node:fs';
import { detectArtwork } from './detect-artwork.mjs';
import { bakeArtwork, bakeLabel, buildGlb, classForSize, CLASSES } from './build-glb.mjs';

const PILOTS = [
  {
    handle: 'motivational-framed-poster-its-not-over-until-i-win',
    id: 'gid://shopify/Product/10787994992973',
    title: "It's Not Over Until I Win – Motivationsposter",
    image: 'https://cdn.shopify.com/s/files/1/0976/9979/1181/files/18423014083823160707_2048.jpg?v=1785668601',
    sizes: ['11″ x 14″', '12″ x 18″', '16" x 20"', '18″ x 24″', '20" x 30"', '24″ x 36″'],
  },
  {
    handle: 'horizontal-framed-poster',
    id: 'gid://shopify/Product/10753336901965',
    title: 'Vintage Formula 1 – Racing-Poster im Ölgemälde-Stil',
    image: 'https://cdn.shopify.com/s/files/1/0976/9979/1181/files/10552578111311885299_2048.jpg?v=1783994736',
    sizes: ['14″ x 11″', '18″ x 12″', '20" x 16"', '24″ x 18″', '30" x 20"', '36″ x 24″'],
  },
  {
    handle: 'they-doubt-me-i-deliver',
    id: 'gid://shopify/Product/10792468808013',
    title: 'They Doubt Me I Deliver',
    image: 'https://cdn.shopify.com/s/files/1/0976/9979/1181/files/13683113285103522742_2048.jpg?v=1785866675',
    sizes: ['8" x 11"'],
  },
];

export function parseSize(s) {
  const nums = String(s).match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;
  return [parseFloat(nums[0]), parseFloat(nums[1])];
}

const manifest = [];
mkdirSync('out', { recursive: true });
for (const p of PILOTS) {
  const t0 = Date.now();
  const res = await fetch(p.image);
  if (!res.ok) throw new Error(`fetch ${p.handle}: ${res.status}`);
  const src = Buffer.from(await res.arrayBuffer());
  const det = await detectArtwork(src);
  if (det.warn) console.log(`WARN ${p.handle}: ${det.warn}`, JSON.stringify(det));
  const orientation = det.artAspect < 1 ? 'portrait' : 'landscape';
  const sizeMap = {};
  for (const s of p.sizes) {
    const wh = parseSize(s);
    sizeMap[s] = wh ? classForSize(wh[0], wh[1]) : 'c23';
  }
  const classes = [...new Set(Object.values(sizeMap))];
  const label = bakeLabel(p.title);
  const entry = { ...p, orientation, sizeMap, classes, glbs: [], artPx: det.artPx };
  for (const cls of classes) {
    const art = await bakeArtwork(src, det.art, cls, orientation);
    for (const color of ['black', 'white']) {
      const out = `out/lp4-${p.handle}-${color}-${cls}.glb`;
      const r = await buildGlb({ outPath: out, artworkJpeg: art, labelPng: label, color, classKey: cls, orientation });
      entry.glbs.push({ file: out, color, cls, bytes: r.bytes });
    }
  }
  manifest.push(entry);
  console.log(`${p.handle}: ${orientation}, classes [${classes}], ${entry.glbs.length} GLBs, art ${det.artPx.join('x')}px, ${Date.now() - t0} ms`);
}
writeFileSync('out/pilot-manifest.json', JSON.stringify(manifest, null, 2));
console.log('total GLBs:', manifest.reduce((n, e) => n + e.glbs.length, 0));
