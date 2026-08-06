import sharp from 'sharp';

// Detect the artwork rectangle inside a Printify "black frame on wall" mockup photo.
// Per side: per-row/col first-dark position -> robust outer edge (20th pct), then
// run-length from that edge -> robust bar thickness (20th pct; dark artwork inflates
// some rows, bright rows reveal the true bar width).
export async function detectArtwork(input) {
  const { data, info } = await sharp(input).greyscale().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const dark = (x, y) => data[y * w + x] < 55;
  let minx = w, maxx = 0, miny = h, maxy = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    if (dark(x, y)) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  }
  if (maxx - minx < w * 0.2 || maxy - miny < h * 0.2) throw new Error('no frame bbox found');
  const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * p)];
  const N = 140;
  const span = (lo, hi) => { const m = (hi - lo) * 0.06; return [lo + m, hi - m]; };
  const [ry0, ry1] = span(miny, maxy), [rx0, rx1] = span(minx, maxx);

  function side(scanCoords, firstDarkAt, innerAfter) {
    const firsts = [];
    for (const c of scanCoords) { const f = firstDarkAt(c); if (f !== null) firsts.push({ c, f }); }
    if (firsts.length < N / 2) throw new Error('side detection failed');
    const edge = pct(firsts.map(o => o.f), 0.2);
    const inners = [];
    for (const { c, f } of firsts) { if (Math.abs(f - edge) <= 8) inners.push(innerAfter(c, f)); }
    if (inners.length < N / 4) throw new Error('side runs failed');
    return { edge, t: Math.max(1, pct(inners.map(v => Math.abs(v - edge)), 0.2)) };
  }
  const rows = Array.from({ length: N }, (_, i) => Math.round(ry0 + (i + 0.5) * (ry1 - ry0) / N));
  const cols = Array.from({ length: N }, (_, i) => Math.round(rx0 + (i + 0.5) * (rx1 - rx0) / N));
  const L = side(rows, y => { for (let x = Math.max(0, minx - 8); x < maxx; x++) if (dark(x, y)) return x; return null; },
    (y, f) => { let x = f; while (x < maxx && dark(x, y)) x++; return x; });
  const R = side(rows, y => { for (let x = Math.min(w - 1, maxx + 8); x > minx; x--) if (dark(x, y)) return x; return null; },
    (y, f) => { let x = f; while (x > minx && dark(x, y)) x--; return x; });
  const T = side(cols, x => { for (let y = Math.max(0, miny - 8); y < maxy; y++) if (dark(x, y)) return y; return null; },
    (x, f) => { let y = f; while (y < maxy && dark(x, y)) y++; return y; });
  const B = side(cols, x => { for (let y = Math.min(h - 1, maxy + 8); y > miny; y--) if (dark(x, y)) return y; return null; },
    (x, f) => { let y = f; while (y > miny && dark(x, y)) y--; return y; });

  const base = Math.min(L.t, R.t, T.t, B.t);
  const cap = Math.round(base * 1.15);
  const t = { left: Math.min(L.t, cap), right: Math.min(R.t, cap), top: Math.min(T.t, cap), bottom: Math.min(B.t, cap) };
  const inset = Math.max(4, Math.round(base * 0.10)); // avoid frame edge / glass-sheen bleed
  const art = { x0: L.edge + t.left + inset, y0: T.edge + t.top + inset, x1: R.edge - t.right - inset, y1: B.edge - t.bottom - inset };
  const aw = art.x1 - art.x0, ah = art.y1 - art.y0;
  const outerW = R.edge - L.edge, outerH = B.edge - T.edge;
  const result = {
    outer: [L.edge, T.edge, R.edge, B.edge], thickness: t, art,
    artAspect: +(aw / ah).toFixed(4), artPx: [aw, ah], frameRatio: +(base / outerW).toFixed(4),
    outerAspect: +(outerW / outerH).toFixed(4),
  };
  const a = result.artAspect;
  const plausible = (a > 0.55 && a < 0.95) || (a > 1.05 && a < 1.85);
  if (!plausible || result.frameRatio < 0.02 || result.frameRatio > 0.12) result.warn = 'implausible geometry — review manually';
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const f of process.argv.slice(2)) {
    try { console.log(f.split('/').pop(), JSON.stringify(await detectArtwork(f))); }
    catch (e) { console.log(f.split('/').pop(), 'ERROR', e.message); }
  }
}
