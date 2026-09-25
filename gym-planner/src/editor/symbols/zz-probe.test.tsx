/* TEMPORÄR – Performance-Aufschlüsselung + Vorschau-Rasterizer (wird nach der Prüfung gelöscht). */
import { describe, it, beforeAll } from 'vitest';
import { createRef } from 'react';
import { render } from '@testing-library/react';
import Konva from 'konva';
import { Stage, Layer, Group } from 'react-konva';
import * as fs from 'node:fs';
import * as zlib from 'node:zlib';
import type { EquipmentDef, PlacedItem, SymbolKind } from '@/types';
import { createEmptyProject, createItemFromDef } from '@/store/factories';
import { ItemSymbol, ALL_SYMBOL_KINDS } from './index';
import { ItemsLayer } from '../layers/ItemsLayer';

beforeAll(() => {
  const noop = () => {};
  const makeCtx = (canvas: HTMLCanvasElement) => {
    const base: Record<string, unknown> = { canvas, measureText: (t: string) => ({ width: String(t).length * 6 }), getImageData: () => ({ data: new Uint8ClampedArray(4) }), createLinearGradient: () => ({ addColorStop: noop }), getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) };
    return new Proxy(base, { get: (t, k) => (k in t ? t[k as string] : noop), set: (t, k, v) => { t[k as string] = v; return true; } });
  };
  (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = function (this: HTMLCanvasElement) { return makeCtx(this); };
});

function makeDef(partial: Partial<EquipmentDef> & { id: string; symbol: SymbolKind }): EquipmentDef {
  return { kategorie: 'T', unterkategorie: 'T', hersteller: 'Generisch', name: partial.id, breite_cm: 100, tiefe_cm: 150, hoehe_cm: 120, sicherheitszone_cm: { vorne: 60, hinten: 60, links: 60, rechts: 60 }, form: 'rechteck', skalierbar: false, verifiziert: true, bereich: 'Kraftgeräte', ...partial };
}

/* ---------------- PNG ---------------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf: Uint8Array): number { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Uint8Array): Uint8Array { const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, data.length); const td = new Uint8Array(4 + data.length); td.set(type.split('').map((c) => c.charCodeAt(0))); td.set(data, 4); const crc = new Uint8Array(4); new DataView(crc.buffer).setUint32(0, crc32(td)); return new Uint8Array([...len, ...td, ...crc]); }
function writePng(path: string, w: number, h: number, rgb: Uint8Array) {
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1); }
  const ihdr = new Uint8Array(13); const dv = new DataView(ihdr.buffer); dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 2;
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', ihdr), ...chunk('IDAT', new Uint8Array(zlib.deflateSync(raw))), ...chunk('IEND', new Uint8Array(0))]);
  fs.writeFileSync(path, png);
}

/* ---------------- Rasterizer ---------------- */
type P = { x: number; y: number };
class Bitmap {
  rgb: Uint8Array;
  constructor(public w: number, public h: number) { this.rgb = new Uint8Array(w * h * 3).fill(255); }
  blend(x: number, y: number, c: [number, number, number], a: number) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 3; this.rgb[i] = this.rgb[i] + (c[0] - this.rgb[i]) * a; this.rgb[i + 1] = this.rgb[i + 1] + (c[1] - this.rgb[i + 1]) * a; this.rgb[i + 2] = this.rgb[i + 2] + (c[2] - this.rgb[i + 2]) * a; }
  fillPoly(poly: P[], c: [number, number, number], a: number) {
    if (poly.length < 3) return;
    let minY = Infinity, maxY = -Infinity; for (const p of poly) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.h - 1, Math.ceil(maxY)); y++) {
      const sy = y + 0.5; const xs: number[] = [];
      for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; if ((p.y <= sy && q.y > sy) || (q.y <= sy && p.y > sy)) xs.push(p.x + ((sy - p.y) * (q.x - p.x)) / (q.y - p.y)); }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(this.w, Math.round(xs[k + 1])); x++) this.blend(x, y, c, a);
    }
  }
  strokeSeg(p: P, q: P, wpx: number, c: [number, number, number], a: number, round: boolean) {
    const dx = q.x - p.x, dy = q.y - p.y; const len = Math.hypot(dx, dy); const hw = Math.max(0.5, wpx / 2);
    if (len < 0.05) { if (round) this.fillCircle(p, hw, c, a); else this.fillPoly([{ x: p.x - hw, y: p.y - hw }, { x: p.x + hw, y: p.y - hw }, { x: p.x + hw, y: p.y + hw }, { x: p.x - hw, y: p.y + hw }], c, a); return; }
    const nx = (-dy / len) * hw, ny = (dx / len) * hw;
    this.fillPoly([{ x: p.x + nx, y: p.y + ny }, { x: q.x + nx, y: q.y + ny }, { x: q.x - nx, y: q.y - ny }, { x: p.x - nx, y: p.y - ny }], c, a);
    if (round) { this.fillCircle(p, hw, c, a); this.fillCircle(q, hw, c, a); }
  }
  fillCircle(cp: P, r: number, c: [number, number, number], a: number) { const pts: P[] = []; for (let i = 0; i < 16; i++) pts.push({ x: cp.x + Math.cos((i / 16) * 2 * Math.PI) * r, y: cp.y + Math.sin((i / 16) * 2 * Math.PI) * r }); this.fillPoly(pts, c, a); }
}
function parseColor(s: string | undefined): [[number, number, number], number] | null {
  if (!s) return null;
  const m = /^#([0-9a-f]{6})$/i.exec(s); if (m) { const n = parseInt(m[1], 16); return [[(n >> 16) & 255, (n >> 8) & 255, n & 255], 1]; }
  const r = /^rgba?\(([^)]+)\)$/.exec(s); if (r) { const p = r[1].split(',').map(Number); return [[p[0], p[1], p[2]], p[3] ?? 1]; }
  return null;
}
function localGeometry(n: Konva.Shape): { polys: P[][]; closed: boolean[] } {
  const cls = n.getClassName(); const polys: P[][] = []; const closed: boolean[] = [];
  const circle = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = 360, center = false) => { const pts: P[] = []; if (center) pts.push({ x: cx, y: cy }); const steps = 40; for (let i = 0; i <= steps; i++) { const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180; pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }); } return pts; };
  if (cls === 'Rect') { const w = n.width(), h = n.height(); polys.push([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]); closed.push(true); }
  else if (cls === 'Circle') { const r = (n as Konva.Circle).radius(); polys.push(circle(0, 0, r, r)); closed.push(true); }
  else if (cls === 'Ellipse') { const e = n as Konva.Ellipse; polys.push(circle(0, 0, e.radiusX(), e.radiusY())); closed.push(true); }
  else if (cls === 'Line' || cls === 'Arrow') { const l = n as Konva.Line; const p = l.points(); const pts: P[] = []; for (let i = 0; i + 1 < p.length; i += 2) pts.push({ x: p[i], y: p[i + 1] }); polys.push(pts); closed.push(l.closed()); if (cls === 'Arrow' && pts.length >= 2) { const a = pts[pts.length - 2], b = pts[pts.length - 1]; const ar = n as Konva.Arrow; const L = ar.pointerLength(), W = ar.pointerWidth(); const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1; const ux = dx / len, uy = dy / len; polys.push([{ x: b.x, y: b.y }, { x: b.x - ux * L + -uy * W / 2, y: b.y - uy * L + ux * W / 2 }, { x: b.x - ux * L - -uy * W / 2, y: b.y - uy * L - ux * W / 2 }]); closed.push(true); } }
  else if (cls === 'Star') { const s = n as Konva.Star; const pts: P[] = []; const np = s.numPoints(); for (let i = 0; i < np * 2; i++) { const r = i % 2 === 0 ? s.outerRadius() : s.innerRadius(); const a = (Math.PI * i) / np - Math.PI / 2; pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); } polys.push(pts); closed.push(true); }
  else if (cls === 'Wedge') { const wd = n as Konva.Wedge; polys.push(circle(0, 0, wd.radius(), wd.radius(), 0, wd.angle(), true)); closed.push(true); }
  else if (cls === 'Arc') { const ac = n as Konva.Arc; polys.push(circle(0, 0, ac.outerRadius(), ac.outerRadius(), 0, ac.angle())); closed.push(false); }
  else if (cls === 'Text') { const w = n.width() || 40, h = n.height() || 12; polys.push([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]); closed.push(true); }
  return { polys, closed };
}
function rasterize(stage: Konva.Stage, bmp: Bitmap) {
  const shapes = stage.find((n: Konva.Node) => n instanceof Konva.Shape) as Konva.Shape[];
  for (const s of shapes) {
    if (!s.isVisible()) continue;
    const tr = s.getAbsoluteTransform(); const alpha = s.getAbsoluteOpacity();
    const sc = Math.hypot(tr.m[0], tr.m[1]);
    const { polys, closed } = localGeometry(s);
    const isText = s.getClassName() === 'Text';
    const fill = isText ? null : parseColor(s.fill() as string);
    const stroke = isText ? parseColor('#999999') : parseColor(s.stroke() as string);
    const sw = (isText ? 0.5 : s.strokeWidth()) * sc; const dash = (s.dash() as number[] | undefined) ?? []; const off = -(s.dashOffset?.() ?? 0);
    for (let k = 0; k < polys.length; k++) {
      const abs = polys[k].map((p) => tr.point(p));
      if (fill && (closed[k] || s.getClassName() === 'Star')) bmp.fillPoly(abs, fill[0], fill[1] * alpha);
      if (stroke && sw > 0 && !(isText && false)) {
        const segs: [P, P][] = []; for (let i = 0; i + 1 < abs.length; i++) segs.push([abs[i], abs[i + 1]]); if (closed[k] && abs.length > 2) segs.push([abs[abs.length - 1], abs[0]]);
        const round = s.lineCap() === 'round';
        if (dash.length) { let pat = 0, rem = dash[0] * sc - off * sc, on = true; while (rem <= 0) { pat = (pat + 1) % dash.length; rem += dash[pat] * sc; on = !on; }
          for (const [p, q] of segs) { const len = Math.hypot(q.x - p.x, q.y - p.y); let t = 0; while (t < len) { const step = Math.min(rem, len - t); if (on) { const a = { x: p.x + ((q.x - p.x) * t) / len, y: p.y + ((q.y - p.y) * t) / len }; const b = { x: p.x + ((q.x - p.x) * (t + step)) / len, y: p.y + ((q.y - p.y) * (t + step)) / len }; bmp.strokeSeg(a, b, sw, stroke[0], stroke[1] * alpha, round); } t += step; rem -= step; if (rem <= 1e-6) { pat = (pat + 1) % dash.length; rem = Math.max(0.01, dash[pat] * sc); on = !on; } } } }
        else for (const [p, q] of segs) bmp.strokeSeg(p, q, sw, stroke[0], stroke[1] * alpha, round);
      }
    }
  }
}

const DIMS: Partial<Record<SymbolKind, [number, number]>> = {
  'treadmill': [90, 210], 'curved-treadmill': [90, 190], 'elliptical': [75, 210], 'bike': [60, 120], 'recumbent-bike': [70, 170], 'spin-bike': [55, 125], 'air-bike': [65, 130], 'rower': [60, 245], 'stairmaster': [80, 150], 'skierg': [60, 125],
  'locker-row': [400, 50], 'locker': [40, 50], 'bench-seat': [150, 40], 'shower': [90, 90], 'shower-row': [270, 90], 'partition': [100, 5], 'toilet': [40, 70], 'urinal': [40, 40], 'mirror': [200, 5], 'sink': [60, 50],
  'sauna': [300, 300], 'infrared': [120, 105], 'steam': [250, 250], 'plunge': [180, 80], 'lounger': [70, 200], 'massage-table': [70, 190], 'whirlpool': [220, 220], 'solarium': [90, 220],
  'stairs-straight': [100, 360], 'stairs-l': [240, 240], 'stairs-u': [240, 300], 'stairs-spiral': [200, 200], 'elevator': [180, 200], 'column-round': [30, 30], 'column-square': [30, 30], 'radiator': [120, 10], 'vent': [60, 60], 'ramp': [120, 400],
  'rack': [165, 203], 'half-rack': [137, 124], 'smith': [200, 220], 'platform': [250, 300], 'dumbbell-rack': [246, 81], 'plate-rack': [60, 60], 'cable': [168, 119], 'leg-press': [120, 191], 'hack-squat': [150, 259], 'lat-pulldown': [71, 125], 'chest-press': [152, 150], 'row': [87, 163], 'bench': [69, 130], 'barbell-rack': [120, 40], 'plate-tree': [60, 60], 'dumbbells': [40, 40], 'barbell': [220, 30],
  'turf': [150, 1000], 'rig': [360, 180], 'wall-bars': [100, 15], 'punching-bag': [60, 60], 'mat': [180, 60], 'kettlebell-rack': [120, 40], 'ball-rack': [100, 40], 'plyo-box': [60, 75], 'rope-anchor': [40, 300],
  'counter': [300, 80], 'sofa': [220, 90], 'table': [80, 80], 'chair': [50, 50], 'desk': [160, 80], 'office-chair': [60, 60], 'meeting-table': [240, 100], 'shelf': [200, 40], 'tv': [120, 10], 'plant': [50, 50], 'exit-sign': [40, 10], 'extinguisher': [20, 20], 'first-aid': [30, 12], 'aed': [30, 15], 'camera': [15, 15], 'turnstile': [90, 90], 'fridge': [60, 60], 'vending': [90, 90], 'wardrobe': [120, 30], 'screen': [60, 40],
};

describe('probe', () => {
  it('rasterisiert alle Symbole in Vorschau-PNGs', () => {
    const kinds = [...ALL_SYMBOL_KINDS];
    const perPage = 30, cols = 5, cell = 160;
    const out = '/tmp/claude-0/-home-user-NextGen-Lernen/1981c239-da0e-50dc-88ca-d8915f8ebdd2/scratchpad';
    for (let page = 0; page * perPage < kinds.length; page++) {
      const slice = kinds.slice(page * perPage, (page + 1) * perPage);
      const rows = Math.ceil(slice.length / cols);
      const W = cols * cell, H = rows * cell;
      const ref = createRef<Konva.Stage>();
      const nodes = slice.map((kind, i) => {
        const [w, d] = DIMS[kind] ?? [100, 150];
        const def = makeDef({ id: kind, symbol: kind, breite_cm: w, tiefe_cm: d, form: kind === 'column-round' || kind === 'stairs-spiral' ? 'kreis' : 'rechteck', bereich: page === 0 ? 'Kraftgeräte' : 'Cardio' });
        const item = createItemFromDef(def, 0, 0, { params: kind === 'locker-row' ? { faecher: 10 } : undefined });
        const s = Math.min((cell * 0.8) / w, (cell * 0.8) / d);
        const cx = (i % cols) * cell + cell / 2, cy = Math.floor(i / cols) * cell + cell / 2;
        return (
          <Group key={kind} x={cx} y={cy} scaleX={s} scaleY={s}>
            <ItemSymbol item={item} def={def} scale={s} dark={false} selected={false} colliding={false} hovered={false} />
          </Group>
        );
      });
      const r = render(<Stage ref={ref} width={W} height={H}><Layer>{nodes}</Layer></Stage>);
      const bmp = new Bitmap(W, H);
      // Zellrahmen
      for (let i = 0; i < slice.length; i++) { const x0 = (i % cols) * cell, y0 = Math.floor(i / cols) * cell; bmp.fillPoly([{ x: x0, y: y0 }, { x: x0 + cell, y: y0 }, { x: x0 + cell, y: y0 + 1 }, { x: x0, y: y0 + 1 }], [220, 220, 220], 1); bmp.fillPoly([{ x: x0, y: y0 }, { x: x0 + 1, y: y0 }, { x: x0 + 1, y: y0 + cell }, { x: x0, y: y0 + cell }], [220, 220, 220], 1); }
      rasterize(ref.current!, bmp);
      writePng(`${out}/symbols-page${page + 1}.png`, W, H, bmp.rgb);
      console.info(`page${page + 1}: ${slice.map((k, i) => `${i + 1}:${k}`).join(' ')}`);
      r.unmount();
    }
  });

  it('Performance-Aufschlüsselung 600 Objekte', () => {
    const project = createEmptyProject('Perf');
    const floor = project.floors[0];
    const defs = [
      makeDef({ id: 'p1', symbol: 'treadmill', bereich: 'Cardio', breite_cm: 90, tiefe_cm: 210, sicherheitszone_cm: { vorne: 0, hinten: 200, links: 0, rechts: 0 } }),
      makeDef({ id: 'p2', symbol: 'rack', breite_cm: 165, tiefe_cm: 203 }),
      makeDef({ id: 'p3', symbol: 'locker-row', bereich: 'Umkleide', breite_cm: 400, tiefe_cm: 50, sicherheitszone_cm: { vorne: 0, hinten: 0, links: 0, rechts: 0 } }),
      makeDef({ id: 'p4', symbol: 'leg-press', breite_cm: 120, tiefe_cm: 191 }),
    ];
    project.customEquipment.push(...defs);
    const items: PlacedItem[] = [];
    for (let i = 0; i < 600; i++) items.push(createItemFromDef(defs[i % defs.length], (i % 30) * 300, Math.floor(i / 30) * 300, { rotation: (i % 4) * 90 }));
    const base = { project, floor, walls: [], rooms: [], items, viewport: { scale: 0.5, x: 0, y: 0 }, selection: [], hoverId: null, dark: false, lowerFloor: null, collidingIds: new Set<string>(), presentation: false };
    const variants: [string, typeof base][] = [
      ['voll', base],
      ['ohne Labels', { ...base, project: { ...project, layers: { ...project.layers, labels: false } } }],
      ['ohne Zonen', { ...base, project: { ...project, layers: { ...project.layers, safetyZones: false } } }],
      ['ohne Labels+Zonen', { ...base, project: { ...project, layers: { ...project.layers, labels: false, safetyZones: false } } }],
      ['LOD (winzig)', { ...base, viewport: { scale: 0.02, x: 0, y: 0 } }],
    ];
    for (const [name, props] of variants) {
      const times: number[] = [];
      for (let k = 0; k < 3; k++) {
        const t0 = performance.now();
        const r = render(<Stage width={800} height={600}><Layer><ItemsLayer {...props} /></Layer></Stage>);
        times.push(performance.now() - t0);
        r.unmount();
      }
      console.info(`${name}: ${times.map((t) => t.toFixed(0)).join(' / ')} ms`);
    }
    const t0 = performance.now();
    const rr = render(<Stage width={800} height={600}><Layer>{items.map((it) => <Group key={it.id} x={it.x} y={it.y} />)}</Layer></Stage>);
    console.info(`nur 600 leere Groups: ${(performance.now() - t0).toFixed(0)} ms`);
    rr.unmount();
  });
});
