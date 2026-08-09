import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsTransmission, KHRMaterialsIOR, KHRMaterialsSpecular } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Aspect classes: key → { aspect (portrait form), size in meters of the smallest
// print size in the class (drives AR real-world scale) }
export const CLASSES = {
  c23: { aspect: 2 / 3, size: [0.3048, 0.4572] }, // 12×18 (also 20×30, 24×36)
  c34: { aspect: 3 / 4, size: [0.4572, 0.6096] }, // 18×24 (also 8×11 ≈ 0.727)
  c1114: { aspect: 11 / 14, size: [0.2794, 0.3556] }, // 11×14
  c45: { aspect: 4 / 5, size: [0.4064, 0.5080] }, // 16×20
};

export function classForSize(wIn, hIn) {
  const a = Math.min(wIn, hIn) / Math.max(wIn, hIn);
  let best = 'c23', d = Infinity;
  for (const [k, c] of Object.entries(CLASSES)) {
    const dd = Math.abs(c.aspect - a);
    if (dd < d) { d = dd; best = k; }
  }
  return best;
}

// ---------- texture bakes ----------

export async function bakeArtwork(srcBuffer, artRect, classKey, orientation, { texMax = 2048, quality = 82 } = {}) {
  const { aspect } = CLASSES[classKey];
  const target = orientation === 'landscape' ? 1 / aspect : aspect; // W/H
  const cw = artRect.x1 - artRect.x0, ch = artRect.y1 - artRect.y0;
  let ex = { left: artRect.x0, top: artRect.y0, width: cw, height: ch };
  const srcA = cw / ch;
  if (srcA > target) { const w = Math.round(ch * target); ex.left += Math.round((cw - w) / 2); ex.width = w; }
  else { const h = Math.round(cw / target); ex.top += Math.round((ch - h) / 2); ex.height = h; }
  const long = Math.max(ex.width, ex.height);
  const scale = Math.min(texMax / long, 4); // never upscale more than 4×
  const outW = Math.round(ex.width * scale), outH = Math.round(ex.height * scale);
  for (const q of [quality, 80]) {
    const buf = await sharp(srcBuffer).extract(ex)
      .resize(outW, outH, { kernel: 'lanczos3' })
      .sharpen({ sigma: 1.1, m1: 0.4, m2: 0.2 })
      .jpeg({ quality: q, mozjpeg: true, progressive: false }).toBuffer();
    if (buf.length <= 2_400_000 || q === 80) return buf;
  }
}

export function bakeLabel(title) {
  const safe = String(title).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const short = safe.length > 44 ? safe.slice(0, 42).trimEnd() + '…' : safe;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256">
  <rect width="512" height="256" fill="#FAF9F5"/>
  <rect x="6" y="6" width="500" height="244" fill="none" stroke="#0B0B0C" stroke-width="3"/>
  <text x="256" y="86" text-anchor="middle" font-family="Space Grotesk" font-size="44" letter-spacing="6" fill="#0B0B0C">LIMITLESSPOSTER</text>
  <rect x="96" y="112" width="320" height="3" fill="#3157FF"/>
  <text x="256" y="162" text-anchor="middle" font-family="Space Grotesk" font-size="26" fill="#0B0B0C">${short}</text>
  <text x="256" y="216" text-anchor="middle" font-family="Space Grotesk" font-size="20" letter-spacing="2" fill="#55575C">limitlessposter.com</text>
</svg>`;
  const r = new Resvg(svg, {
    font: { fontFiles: [resolve(ROOT, 'fonts/SpaceGrotesk.ttf')], loadSystemFonts: true, defaultFontFamily: 'Space Grotesk' },
    fitTo: { mode: 'width', value: 512 },
  });
  return Buffer.from(r.render().asPng());
}

// ---------- geometry ----------

class Bucket {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.idx = []; }
  quad(a, b, c, d, uvs) {
    // a,b,c,d counter-clockwise as seen from the front of the face
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
    const base = this.pos.length / 3;
    for (const p of [a, b, c, d]) this.pos.push(...p);
    for (let i = 0; i < 4; i++) this.nrm.push(...n);
    for (const t of uvs) this.uv.push(t[0], t[1]);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  tri(a, b, c, uvs) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
    const base = this.pos.length / 3;
    for (const p of [a, b, c]) this.pos.push(...p);
    for (let i = 0; i < 3; i++) this.nrm.push(...n);
    for (const t of uvs) this.uv.push(t[0], t[1]);
    this.idx.push(base, base + 1, base + 2);
  }
}

export function buildGeometry(classKey, orientation) {
  const cls = CLASSES[classKey];
  const [pw, ph] = cls.size;
  const [W, H] = orientation === 'landscape' ? [ph, pw] : [pw, ph];
  const iw = W / 2, ih = H / 2;           // inner opening half-extents
  const fw = 0.022;                        // frame face width
  const ow = iw + fw, oh = ih + fw;        // outer half-extents
  const zF = 0.011, zB = -0.011;           // frame front/back
  const zGlass = 0.0065, zArt = 0.002;
  const bm = 0.004;                        // back ring margin to board
  const bw = ow - bm, bh = oh - bm;        // board half-extents
  const zBoard = -0.0095;                  // board back surface (recessed 1.5mm)

  const wood = new Bucket(), art = new Bucket(), glass = new Bucket(),
    back = new Bucket(), metal = new Bucket(), label = new Bucket(), tape = new Bucket();

  const um = p => [(p[0] + ow) / (2 * ow), (p[1] + oh) / (2 * oh)]; // planar map
  const Q = (bkt, a, b, c, d) => bkt.quad(a, b, c, d, [um(a), um(b), um(c), um(d)]);

  // frame front ring (4 mitered trapezoids), facing +Z
  Q(wood, [-ow, oh, zF], [-iw, ih, zF], [iw, ih, zF], [ow, oh, zF]);          // top
  Q(wood, [-ow, -oh, zF], [ow, -oh, zF], [iw, -ih, zF], [-iw, -ih, zF]);     // bottom
  Q(wood, [-ow, oh, zF], [-ow, -oh, zF], [-iw, -ih, zF], [-iw, ih, zF]);     // left
  Q(wood, [ow, oh, zF], [iw, ih, zF], [iw, -ih, zF], [ow, -oh, zF]);         // right
  // outer side walls
  Q(wood, [-ow, oh, zB], [-ow, oh, zF], [ow, oh, zF], [ow, oh, zB]);         // top (+Y)
  Q(wood, [-ow, -oh, zF], [-ow, -oh, zB], [ow, -oh, zB], [ow, -oh, zF]);     // bottom (−Y)
  Q(wood, [-ow, oh, zB], [-ow, -oh, zB], [-ow, -oh, zF], [-ow, oh, zF]);     // left (−X)
  Q(wood, [ow, oh, zF], [ow, -oh, zF], [ow, -oh, zB], [ow, oh, zB]);         // right (+X)
  // rabbet walls: inner opening from front face down to artwork, facing the opening
  Q(wood, [-iw, ih, zF], [-iw, ih, zArt], [iw, ih, zArt], [iw, ih, zF]);     // top → faces −Y
  Q(wood, [-iw, -ih, zArt], [-iw, -ih, zF], [iw, -ih, zF], [iw, -ih, zArt]); // bottom → +Y
  Q(wood, [-iw, ih, zArt], [-iw, ih, zF], [-iw, -ih, zF], [-iw, -ih, zArt]); // left → +X
  Q(wood, [iw, ih, zF], [iw, ih, zArt], [iw, -ih, zArt], [iw, -ih, zF]);     // right → −X
  // frame back ring (outer → board rect), facing −Z
  Q(wood, [-ow, oh, zB], [ow, oh, zB], [bw, bh, zB], [-bw, bh, zB]);
  Q(wood, [-ow, -oh, zB], [-bw, -bh, zB], [bw, -bh, zB], [ow, -oh, zB]);
  Q(wood, [-ow, oh, zB], [-bw, bh, zB], [-bw, -bh, zB], [-ow, -oh, zB]);
  Q(wood, [ow, oh, zB], [ow, -oh, zB], [bw, -bh, zB], [bw, bh, zB]);

  // recess step walls (board rect, z from zB to zBoard), facing inward
  Q(back, [-bw, bh, zB], [bw, bh, zB], [bw, bh, zBoard], [-bw, bh, zBoard]);
  Q(back, [-bw, -bh, zBoard], [bw, -bh, zBoard], [bw, -bh, zB], [-bw, -bh, zB]);
  Q(back, [-bw, bh, zBoard], [-bw, -bh, zBoard], [-bw, -bh, zB], [-bw, bh, zB]);
  Q(back, [bw, bh, zB], [bw, -bh, zB], [bw, -bh, zBoard], [bw, bh, zBoard]);
  // board back face, facing −Z (u/v full kraft texture)
  back.quad([-bw, bh, zBoard], [bw, bh, zBoard], [bw, -bh, zBoard], [-bw, -bh, zBoard],
    [[0, 0], [1, 0], [1, 1], [0, 1]]);

  // artwork, facing +Z, full texture
  art.quad([-iw, ih, zArt], [-iw, -ih, zArt], [iw, -ih, zArt], [iw, ih, zArt],
    [[0, 0], [0, 1], [1, 1], [1, 0]]);
  // glass, facing +Z
  glass.quad([-iw, ih, zGlass], [-iw, -ih, zGlass], [iw, -ih, zGlass], [iw, ih, zGlass],
    [[0, 0], [0, 1], [1, 1], [1, 0]]);

  // Zwei schwarze Zackenaufhänger in den oberen Ecken (wie beim echten Produkt)
  const hw = 0.016, hh = 0.0075, zH = zBoard - 0.002;
  const uv0 = [[0.1, 0.1], [0.1, 0.9], [0.9, 0.9], [0.9, 0.1]];
  const hangerAt = (cx) => {
    const hy = bh - 0.030;
    metal.quad([cx - hw, hy + hh, zH], [cx + hw, hy + hh, zH], [cx + hw, hy - hh, zH], [cx - hw, hy - hh, zH], uv0);
    metal.quad([cx - hw, hy + hh, zBoard], [cx - hw, hy + hh, zH], [cx + hw, hy + hh, zH], [cx + hw, hy + hh, zBoard], uv0);
    metal.quad([cx - hw, hy - hh, zH], [cx - hw, hy - hh, zBoard], [cx + hw, hy - hh, zBoard], [cx + hw, hy - hh, zH], uv0);
    metal.quad([cx - hw, hy + hh, zBoard], [cx - hw, hy - hh, zBoard], [cx - hw, hy - hh, zH], [cx - hw, hy + hh, zH], uv0);
    metal.quad([cx + hw, hy + hh, zH], [cx + hw, hy - hh, zH], [cx + hw, hy - hh, zBoard], [cx + hw, hy + hh, zBoard], uv0);
    const teeth = 7, tw = (2 * hw) / teeth;
    for (let i = 0; i < teeth; i++) {
      const x0 = cx - hw + i * tw;
      metal.tri([x0, hy - hh, zH], [x0 + tw, hy - hh, zH], [x0 + tw / 2, hy - hh - 0.0035, zH],
        [[0.2, 0.2], [0.8, 0.2], [0.5, 0.8]]);
    }
  };
  hangerAt(-(bw - 0.045));
  hangerAt(bw - 0.045);

  // Vier weiße Wandabstandshalter (runde Puffer) mit Kreppband-Streifen
  const discAt = (cx, cy) => {
    const r = 0.015, zD = zBoard - 0.0035, seg = 10;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
      // Deckfläche (−Z)
      label.tri([cx, cy, zD], [p1[0], p1[1], zD], [p0[0], p0[1], zD], [[0.5, 0.5], [0.8, 0.5], [0.5, 0.8]]);
      // Mantel
      label.quad([p0[0], p0[1], zBoard], [p0[0], p0[1], zD], [p1[0], p1[1], zD], [p1[0], p1[1], zBoard], uv0);
    }
    // Kreppband quer über den Puffer (dünner Streifen, minimal über der Deckfläche)
    const tw2 = 0.010, tl = 0.030, zT = zD - 0.0004;
    tape.quad([cx - tl, cy + tw2, zT], [cx + tl, cy + tw2, zT], [cx + tl, cy - tw2, zT], [cx - tl, cy - tw2, zT],
      [[0, 0], [1, 0], [1, 1], [0, 1]]);
  };
  discAt(-(bw - 0.05), -(bh - 0.05));
  discAt(bw - 0.05, -(bh - 0.05));
  discAt(-(bw - 0.045), 0);
  discAt(bw - 0.045, bh * 0.35);

  return { wood, art, glass, back, metal, label, tape, dims: { W: 2 * ow, H: 2 * oh } };
}

// ---------- assembly ----------

export async function buildGlb({ outPath, artworkJpeg, labelPng, color = 'black', classKey, orientation = 'portrait' }) {
  const geo = buildGeometry(classKey, orientation);
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene('scene');

  const transmissionExt = doc.createExtension(KHRMaterialsTransmission);
  const iorExt = doc.createExtension(KHRMaterialsIOR);
  const specExt = doc.createExtension(KHRMaterialsSpecular);

  const woodTex = doc.createTexture('wood').setImage(readFileSync(resolve(ROOT, `shared/wood-${color}.jpg`))).setMimeType('image/jpeg');
  const kraftTex = doc.createTexture('mdf').setImage(readFileSync(resolve(ROOT, 'shared/mdf.jpg'))).setMimeType('image/jpeg');
  const artTex = doc.createTexture('artwork').setImage(artworkJpeg).setMimeType('image/jpeg');

  const matWood = doc.createMaterial('wood').setBaseColorTexture(woodTex)
    .setRoughnessFactor(color === 'black' ? 0.45 : 0.55).setMetallicFactor(0);
  const matArt = doc.createMaterial('artwork').setBaseColorTexture(artTex)
    .setRoughnessFactor(0.92).setMetallicFactor(0);
  const matGlass = doc.createMaterial('glass').setBaseColorFactor([1, 1, 1, 1])
    .setRoughnessFactor(0.03).setMetallicFactor(0);
  matGlass.setExtension('KHR_materials_transmission', transmissionExt.createTransmission().setTransmissionFactor(1.0));
  matGlass.setExtension('KHR_materials_ior', iorExt.createIOR().setIOR(1.52));
  matGlass.setExtension('KHR_materials_specular', specExt.createSpecular().setSpecularFactor(1.0));
  const matBack = doc.createMaterial('back').setBaseColorTexture(kraftTex)
    .setRoughnessFactor(0.85).setMetallicFactor(0.05);
  const matMetal = doc.createMaterial('hanger').setBaseColorFactor([0.09, 0.09, 0.10, 1])
    .setRoughnessFactor(0.55).setMetallicFactor(0);
  const matLabel = doc.createMaterial('spacer').setBaseColorFactor([0.96, 0.96, 0.95, 1])
    .setRoughnessFactor(0.45).setMetallicFactor(0);
  const matTape = doc.createMaterial('tape').setBaseColorFactor([0.92, 0.87, 0.62, 1])
    .setRoughnessFactor(0.7).setMetallicFactor(0);

  const mesh = doc.createMesh('poster');
  const pairs = [['wood', matWood], ['art', matArt], ['glass', matGlass], ['back', matBack], ['metal', matMetal], ['label', matLabel], ['tape', matTape]];
  for (const [key, mat] of pairs) {
    const b = geo[key];
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(b.pos)))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(b.nrm)))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(b.uv)))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(b.idx)))
      .setMaterial(mat);
    mesh.addPrimitive(prim);
  }
  scene.addChild(doc.createNode('poster').setMesh(mesh));
  await doc.transform(prune());

  const io = new NodeIO().registerExtensions([KHRMaterialsTransmission, KHRMaterialsIOR, KHRMaterialsSpecular]);
  const glb = await io.writeBinary(doc);
  if (glb.byteLength > 3_500_000) throw new Error(`GLB too large: ${glb.byteLength} bytes (${outPath})`);
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, glb);
  return { outPath, bytes: glb.byteLength, dims: geo.dims };
}
