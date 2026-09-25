/**
 * Draufsicht-Symbole: Bauelemente (Säulen, Heizkörper, Lüftung, Treppen, Aufzug, Rampe) und generische Formen.
 *
 * Treppen: „vorne“ (+y) ist der Antritt, der Laufrichtungspfeil zeigt nach oben (−y bzw. entlang der Läufe).
 * Stufenzahl aus params.stufen, sonst Lauflänge / 28 cm.
 */
import { Arc, Arrow, Circle, Line } from 'react-konva';
import type { EquipmentDef, PlacedItem, StairsType } from '@/types';
import { Body, Bars, Box, Poly, Disc, clampInt, numParam, type SymbolRenderer } from './common';

/** Standard-Auftrittstiefe einer Stufe (cm). */
export const STEP_DEPTH_CM = 28;

/** Laufbreite einer L-/U-Treppe: ~42 % der kleineren Seite, höchstens 120 cm, mindestens 40 cm. */
export function flightWidth(w: number, d: number): number {
  return Math.max(Math.min(40, Math.min(w, d) / 2), Math.min(120, Math.min(w, d) * 0.42));
}

/** Lauflänge (Summe aller Läufe ohne Podeste) je Treppentyp in cm. */
export function runLength(type: StairsType, w: number, d: number): number {
  const fw = flightWidth(w, d);
  switch (type) {
    case 'L': return Math.max(1, d - fw) + Math.max(1, w - fw);
    case 'U': return 2 * Math.max(1, d - fw);
    case 'Wendeltreppe': return Math.PI * (w / 2) * 0.7 * 1.5; // ¾-Umlauf auf dem mittleren Radius
    default: return d;
  }
}

/** Standard-Stufenzahl je Typ und Maß (mindestens 3, höchstens 80). */
export function defaultStepCount(type: StairsType, w: number, d: number): number {
  return clampInt(runLength(type, w, d) / STEP_DEPTH_CM, 3, 80);
}

/** Stufenzahl eines platzierten Objekts: params.stufen (≥ 2), sonst Standard. */
export function stepCountFor(item: Pick<PlacedItem, 'params'>, def: EquipmentDef | undefined, type: StairsType, w: number, d: number): number {
  const raw = numParam(item, def, 'stufen');
  if (raw != null && raw >= 2) return clampInt(raw, 2, 80);
  return defaultStepCount(type, w, d);
}

/** Säule rund: Kreis mit Durchmesser = Breite, Achskreuz. */
export const columnRound: SymbolRenderer = (p) => {
  const { w, fill, stroke, sw, lw, light } = p;
  const r = w / 2;
  return (
    <>
      <Disc r={r} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[-r * 0.55, 0, r * 0.55, 0, 0, 0, 0, -r * 0.55, 0, r * 0.55]} stroke={light} sw={lw} />
    </>
  );
};

/** Säule eckig: gefülltes Quadrat mit Diagonalen. */
export const columnSquare: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, light } = p;
  const hw = w / 2;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[-hw, -hd, hw, hd, 0, 0, hw, -hd, -hw, hd]} stroke={light} sw={lw} />
    </>
  );
};

/** Heizkörper: Rippen, Anschlussleitung hinten. */
export const radiator: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light } = p;
  const hw = w / 2;
  const hd = d / 2;
  const n = clampInt(w / 6, 3, 120);
  const step = (w * 0.92) / n;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Bars axis="x" from={-hw + w * 0.04 + step / 2} to={hw - w * 0.04} at={0} thickness={d * 0.8} step={step} bar={Math.max(lw, step * 0.3)} color={light} />
      <Poly pts={[-hw + w * 0.04, -hd + lw, hw - w * 0.04, -hd + lw]} stroke={ink} sw={lw * 1.5} />
    </>
  );
};

/** Lüftungsauslass: Kreuzgitter. */
export const vent: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink } = p;
  const hw = w / 2;
  const hd = d / 2;
  const step = Math.max(lw * 4, Math.min(w, d) / 5);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Bars axis="x" from={-hw + step} to={hw - step * 0.5} at={0} thickness={d * 0.86} step={step} bar={lw} color={ink} offset={lw * 0.5} />
      <Bars axis="y" from={-hd + step} to={hd - step * 0.5} at={0} thickness={w * 0.86} step={step} bar={lw} color={ink} offset={lw * 0.5} />
    </>
  );
};

/** Gerade Treppe: Stufen quer, Laufrichtungspfeil vom Antritt (vorne) nach oben. */
export const stairsStraight: SymbolRenderer = (p) => {
  const { w, d, item, def, fill, stroke, sw, lw, ink } = p;
  const hd = d / 2;
  const n = stepCountFor(item, def, 'gerade', w, d);
  const step = d / n;
  const head = Math.min(w * 0.35, d * 0.1, Math.max(lw * 4, 12));
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Bars axis="y" from={-hd + step} to={hd - step * 0.5} at={0} thickness={w} step={step} bar={lw} color={ink} offset={lw * 0.5} />
      <Circle x={0} y={hd - step * 0.5} radius={lw * 2} fill={ink} listening={false} perfectDrawEnabled={false} />
      <Arrow points={[0, hd - step * 0.5, 0, -hd + step * 0.6]} pointerLength={head} pointerWidth={head * 0.8} fill={ink} stroke={ink} strokeWidth={lw * 1.5} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** L-Treppe: Lauf 1 links nach oben, Podest oben links, Lauf 2 oben nach rechts. */
export const stairsL: SymbolRenderer = (p) => {
  const { w, d, item, def, fill, stroke, sw, lw, ink, light } = p;
  const hw = w / 2;
  const hd = d / 2;
  const fw = flightWidth(w, d);
  const runA = Math.max(1, d - fw);
  const runB = Math.max(1, w - fw);
  const n = stepCountFor(item, def, 'L', w, d);
  const nA = Math.max(1, Math.round((n * runA) / (runA + runB)));
  const nB = Math.max(1, n - nA);
  const stepA = runA / nA;
  const stepB = runB / nB;
  const cx = -hw + fw / 2; // Achse Lauf 1
  const cy = -hd + fw / 2; // Achse Lauf 2 / Podestmitte
  const head = Math.min(fw * 0.4, Math.max(lw * 4, 12));
  const outline = [-hw, -hd, hw, -hd, hw, -hd + fw, -hw + fw, -hd + fw, -hw + fw, hd, -hw, hd];
  return (
    <>
      <Poly pts={outline} closed fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw} y={-hd} w={fw} h={fw} fill={light} />
      <Bars axis="y" from={-hd + fw + stepA} to={hd - stepA * 0.5} at={cx} thickness={fw} step={stepA} bar={lw} color={ink} offset={lw * 0.5} />
      <Bars axis="x" from={-hw + fw + stepB} to={hw - stepB * 0.5} at={cy} thickness={fw} step={stepB} bar={lw} color={ink} offset={lw * 0.5} />
      <Circle x={cx} y={hd - stepA * 0.5} radius={lw * 2} fill={ink} listening={false} perfectDrawEnabled={false} />
      <Arrow points={[cx, hd - stepA * 0.5, cx, cy, hw - stepB * 0.6, cy]} pointerLength={head} pointerWidth={head * 0.8} fill={ink} stroke={ink} strokeWidth={lw * 1.5} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** U-Treppe: Lauf 1 links nach oben, Podest hinten, Lauf 2 rechts zurück nach vorne. */
export const stairsU: SymbolRenderer = (p) => {
  const { w, d, item, def, fill, stroke, sw, lw, ink, light } = p;
  const hw = w / 2;
  const hd = d / 2;
  const fw = flightWidth(w, d);
  const run = Math.max(1, d - fw);
  const n = stepCountFor(item, def, 'U', w, d);
  const nA = Math.max(1, Math.round(n / 2));
  const nB = Math.max(1, n - nA);
  const stepA = run / nA;
  const stepB = run / nB;
  const cxA = -hw + fw / 2;
  const cxB = hw - fw / 2;
  const cy = -hd + fw / 2;
  const gap = Math.max(0, w - 2 * fw);
  const head = Math.min(fw * 0.4, Math.max(lw * 4, 12));
  const outline = gap > 0.5
    ? [-hw, -hd, hw, -hd, hw, hd, hw - fw, hd, hw - fw, -hd + fw, -hw + fw, -hd + fw, -hw + fw, hd, -hw, hd]
    : [-hw, -hd, hw, -hd, hw, hd, -hw, hd];
  return (
    <>
      <Poly pts={outline} closed fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw} y={-hd} w={w} h={fw} fill={light} />
      <Bars axis="y" from={-hd + fw + stepA} to={hd - stepA * 0.5} at={cxA} thickness={fw} step={stepA} bar={lw} color={ink} offset={lw * 0.5} />
      <Bars axis="y" from={-hd + fw + stepB} to={hd - stepB * 0.5} at={cxB} thickness={fw} step={stepB} bar={lw} color={ink} offset={lw * 0.5} />
      <Circle x={cxA} y={hd - stepA * 0.5} radius={lw * 2} fill={ink} listening={false} perfectDrawEnabled={false} />
      <Arrow points={[cxA, hd - stepA * 0.5, cxA, cy, cxB, cy, cxB, hd - stepB * 0.6]} pointerLength={head} pointerWidth={head * 0.8} fill={ink} stroke={ink} strokeWidth={lw * 1.5} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Wendeltreppe: Kreis (Durchmesser = Breite) mit radialen Stufen, Spindel und Richtungsbogen. */
export const stairsSpiral: SymbolRenderer = (p) => {
  const { w, d, item, def, fill, stroke, sw, lw, ink, shade } = p;
  const r = w / 2;
  const n = stepCountFor(item, def, 'Wendeltreppe', w, d);
  const spokes: number[] = [];
  const total = 270; // ¾-Umlauf vom Antritt (vorne, +y) im Uhrzeigersinn
  for (let i = 0; i <= n; i++) {
    const a = ((90 + (total * i) / n) * Math.PI) / 180;
    spokes.push(0, 0, Math.cos(a) * r, Math.sin(a) * r);
  }
  const rm = r * 0.62;
  const endA = ((90 + total - 12) * Math.PI) / 180;
  const head = Math.min(r * 0.25, Math.max(lw * 4, 10));
  return (
    <>
      <Disc r={r} fill={fill} stroke={stroke} sw={sw} />
      <Line points={spokes} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle radius={Math.max(r * 0.12, lw * 2)} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Arc innerRadius={rm} outerRadius={rm} angle={total - 14} rotation={90} stroke={ink} strokeWidth={lw * 1.5} listening={false} perfectDrawEnabled={false} />
      <Arrow points={[Math.cos(endA - 0.15) * rm, Math.sin(endA - 0.15) * rm, Math.cos(endA) * rm, Math.sin(endA) * rm]} pointerLength={head} pointerWidth={head * 0.8} fill={ink} stroke={ink} strokeWidth={lw * 1.5} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Aufzug: Rechteck mit X, Türlinie vorne. */
export const elevator: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light } = p;
  const hw = w / 2;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[-hw, -hd, hw, hd]} stroke={ink} sw={lw} />
      <Poly pts={[hw, -hd, -hw, hd]} stroke={ink} sw={lw} />
      <Poly pts={[-w * 0.3, hd - lw * 2, w * 0.3, hd - lw * 2]} stroke={light} sw={lw * 3} />
    </>
  );
};

/** Rampe: Steigungslinien und Pfeil in Steigungsrichtung (nach oben = −y). */
export const ramp: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink } = p;
  const hd = d / 2;
  const step = Math.max(lw * 5, d / 10);
  const head = Math.min(w * 0.3, d * 0.12, Math.max(lw * 4, 12));
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Bars axis="y" from={-hd + step} to={hd - step * 0.5} at={0} thickness={w * 0.9} step={step} bar={lw} color={ink} offset={lw * 0.5} />
      <Arrow points={[0, hd - d * 0.1, 0, -hd + d * 0.14]} pointerLength={head} pointerWidth={head * 0.8} fill={ink} stroke={ink} strokeWidth={lw * 2} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Generisches Objekt: Rechteck mit innerer gestrichelter Kontur. */
export const generic: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink } = p;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.4} y={-d * 0.4} w={w * 0.8} h={d * 0.8} stroke={ink} sw={lw} dash={[lw * 3, lw * 3]} />
    </>
  );
};

/** Runde Grundfläche für Objekte mit form „kreis“, deren Symbol keine eigene runde Form hat. */
export const disc: SymbolRenderer = (p) => {
  const { w, fill, stroke, sw, lw, ink } = p;
  return (
    <>
      <Disc r={w / 2} fill={fill} stroke={stroke} sw={sw} />
      <Disc r={w * 0.36} stroke={ink} sw={lw} dash={[lw * 3, lw * 3]} />
    </>
  );
};
