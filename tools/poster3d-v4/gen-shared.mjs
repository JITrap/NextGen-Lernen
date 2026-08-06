import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('shared', { recursive: true });

// ---------- painted wood frame textures (1024²) ----------
function woodSvg({ base, streak, sheen }) {
  let streaks = '';
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 1024, w = 0.6 + rnd() * 2.2, o = 0.03 + rnd() * 0.08;
    streaks += `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="1024" fill="${streak}" opacity="${o.toFixed(3)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${sheen}" stop-opacity="0.10"/>
      <stop offset="0.5" stop-color="${sheen}" stop-opacity="0"/>
      <stop offset="1" stop-color="${sheen}" stop-opacity="0.07"/>
    </linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.012" numOctaves="2" seed="11" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.05 0"/>
      <feComposite operator="over" in2="SourceGraphic"/></filter>
  </defs>
  <rect width="1024" height="1024" fill="${base}" filter="url(#grain)"/>
  ${streaks}
  <rect width="1024" height="1024" fill="url(#sheen)"/>
</svg>`;
}

await sharp(Buffer.from(woodSvg({ base: '#131314', streak: '#000000', sheen: '#8a8f99' })))
  .jpeg({ quality: 82, mozjpeg: true }).toFile('shared/wood-black.jpg');
await sharp(Buffer.from(woodSvg({ base: '#F2F0EA', streak: '#D9D5CB', sheen: '#ffffff' })))
  .jpeg({ quality: 82, mozjpeg: true }).toFile('shared/wood-white.jpg');

// ---------- kraft backing board texture (1024²) ----------
const kraftSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs>
    <filter id="fiber">
      <feTurbulence type="fractalNoise" baseFrequency="0.035 0.05" numOctaves="4" seed="4" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.72  0 0 0 0 0.60  0 0 0 0 0.44  0 0 0 0.35 0"/>
      <feComposite operator="over" in2="SourceGraphic"/>
    </filter>
    <filter id="speck">
      <feTurbulence type="turbulence" baseFrequency="0.6" numOctaves="2" seed="9" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 0.10 0"/>
      <feComposite operator="over" in2="SourceGraphic"/>
    </filter>
    <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75">
      <stop offset="0.65" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.10"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="#C6A678" filter="url(#fiber)"/>
  <rect width="1024" height="1024" fill="none" filter="url(#speck)"/>
  <rect width="1024" height="1024" fill="url(#vig)"/>
</svg>`;
await sharp(Buffer.from(kraftSvg)).jpeg({ quality: 80, mozjpeg: true }).toFile('shared/kraft.jpg');

// ---------- neutral studio HDR (256×128, RGBE with adaptive RLE) ----------
function studioHdr(w, h) {
  // float RGB buffer; linear-light values, softboxes brighter than 1.0
  const px = new Float32Array(w * h * 3);
  const put = (x, y, r, g, b) => { const i = (y * w + x) * 3; px[i] += r; px[i + 1] += g; px[i + 2] += b; };
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1); // 0 = up (zenith), 1 = down
    // gradient: bright soft ceiling, mid walls, darker floor — slightly warm
    const up = Math.max(0, 1 - v * 1.8);
    const base = 0.32 + 0.55 * up - 0.18 * Math.max(0, v - 0.62);
    for (let x = 0; x < w; x++) put(x, y, base * 1.0, base * 0.99, base * 0.96);
  }
  // three softboxes (equirect rectangles) — key, fill, rim
  const box = (cx, cy, bw, bh, inten, r, g, b) => {
    for (let y = Math.max(0, cy - bh); y < Math.min(h, cy + bh); y++)
      for (let x0 = cx - bw; x0 < cx + bw; x0++) {
        const x = ((x0 % w) + w) % w;
        const fx = 1 - Math.abs(x0 - cx) / bw, fy = 1 - Math.abs(y - cy) / bh;
        const f = Math.pow(Math.max(0, Math.min(fx, fy)), 0.6);
        put(x, y, inten * r * f, inten * g * f, inten * b * f);
      }
  };
  box(Math.round(w * 0.22), Math.round(h * 0.28), Math.round(w * 0.10), Math.round(h * 0.16), 9, 1, 1, 0.97);
  box(Math.round(w * 0.68), Math.round(h * 0.34), Math.round(w * 0.13), Math.round(h * 0.20), 5, 0.95, 0.97, 1);
  box(Math.round(w * 0.94), Math.round(h * 0.22), Math.round(w * 0.05), Math.round(h * 0.10), 12, 1, 1, 1);
  // encode RGBE
  const scan = new Uint8Array(w * 4);
  const out = [];
  out.push(Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`, 'ascii'));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const m = Math.max(r, g, b);
      let re = 0, ge = 0, be = 0, e = 0;
      if (m >= 1e-32) {
        const exp = Math.ceil(Math.log2(m));
        const scale = Math.pow(2, -exp) * 256.0;
        re = Math.min(255, Math.floor(r * scale)); ge = Math.min(255, Math.floor(g * scale));
        be = Math.min(255, Math.floor(b * scale)); e = exp + 128;
      }
      scan[x] = re; scan[w + x] = ge; scan[2 * w + x] = be; scan[3 * w + x] = e;
    }
    // adaptive RLE header: 2,2,hi,lo then 4 component streams
    out.push(Buffer.from([2, 2, (w >> 8) & 0xff, w & 0xff]));
    for (let c = 0; c < 4; c++) {
      const comp = scan.subarray(c * w, (c + 1) * w);
      let x = 0;
      const bytes = [];
      while (x < w) {
        // find run
        let run = 1;
        while (x + run < w && run < 127 && comp[x + run] === comp[x]) run++;
        if (run >= 4) { bytes.push(128 + run, comp[x]); x += run; }
        else {
          // literal: gather until next long run or 128 max
          let lit = run;
          while (x + lit < w && lit < 128) {
            let r2 = 1;
            while (x + lit + r2 < w && r2 < 4 && comp[x + lit + r2] === comp[x + lit]) r2++;
            if (r2 >= 4) break;
            lit++;
          }
          bytes.push(lit);
          for (let k = 0; k < lit; k++) bytes.push(comp[x + k]);
          x += lit;
        }
      }
      out.push(Buffer.from(bytes));
    }
  }
  return Buffer.concat(out);
}
writeFileSync('shared/studio.hdr', studioHdr(256, 128));

console.log('shared assets written: wood-black.jpg, wood-white.jpg, kraft.jpg, studio.hdr');
