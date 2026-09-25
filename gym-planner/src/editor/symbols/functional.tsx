/**
 * Draufsicht-Symbole: Functional-Bereich und Kursraum (Sled-Bahn, Regale, Boxen, Matten, Rig, Sprossenwand …).
 */
import { Circle } from 'react-konva';
import { Body, Box, Bars, Dots, Pad, Poly, Disc, clampInt, withAlpha, type SymbolRenderer } from './common';

/** Kunstrasen-/Sled-Bahn: Meter-Markierungen quer, gestrichelte Mittellinie längs. */
export const turf: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light } = p;
  const hd = d / 2;
  const step = d >= 400 ? 100 : Math.max(20, d / 6);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Bars axis="y" from={-hd + step} to={hd - 1} at={0} thickness={w * 0.9} step={step} bar={lw * 1.5} color={light} />
      <Poly pts={[0, -hd + d * 0.03, 0, hd - d * 0.03]} stroke={ink} sw={lw} dash={[lw * 6, lw * 5]} />
    </>
  );
};

/** Kettlebell-Regal: zwei Etagen mit Kugeln. */
export const kettlebellRack: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const n = clampInt(w / 30, 2, 30);
  const step = (w * 0.9) / n;
  const size = Math.min(step * 0.7, d * 0.36);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Dots axis="x" from={-hw + w * 0.05 + step / 2} to={hw - w * 0.05} at={-hd + d * 0.28} step={step} size={size} color={shade} />
      <Dots axis="x" from={-hw + w * 0.05 + step / 2} to={hw - w * 0.05} at={hd - d * 0.28} step={step} size={size} color={shade} />
    </>
  );
};

/** Plyo-Box: Deckfläche mit Griffausschnitt. */
export const plyoBox: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, light, shade } = p;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Pad x={0} y={0} w={w * 0.82} h={d * 0.82} fill={light} r={w * 0.03} />
      <Pad x={0} y={0} w={w * 0.3} h={d * 0.1} fill={shade} r={d * 0.04} />
    </>
  );
};

/** Matte: abgerundete Fläche mit innerer gestrichelter Kontur. */
export const mat: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink } = p;
  const r = Math.min(w, d) * 0.1;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={r} />
      <Pad x={0} y={0} w={w * 0.86} h={d * 0.86} stroke={ink} sw={lw} r={r * 0.7} />
    </>
  );
};

/** Medizinball-Regal: zwei Reihen Bälle. */
export const ballRack: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, light } = p;
  const hw = w / 2;
  const hd = d / 2;
  const n = clampInt(w / 35, 2, 20);
  const step = (w * 0.9) / n;
  const size = Math.min(step * 0.8, d * 0.4);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Dots axis="x" from={-hw + w * 0.05 + step / 2} to={hw - w * 0.05} at={-hd + d * 0.27} step={step} size={size} color={light} />
      <Dots axis="x" from={-hw + w * 0.05 + step / 2} to={hw - w * 0.05} at={hd - d * 0.27} step={step} size={size} color={light} />
    </>
  );
};

/** Battle-Rope-Anker: Ankerplatte hinten, zwei geschwungene Seile nach vorne. */
export const ropeAnchor: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hd = d / 2;
  const rope = (s: number) => [s * w * 0.05, -hd + d * 0.2, s * w * 0.3, -hd + d * 0.38, s * w * 0.08, -hd + d * 0.56, s * w * 0.32, -hd + d * 0.74, s * w * 0.12, hd - d * 0.06];
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Circle x={0} y={-hd + d * 0.12} radius={Math.min(w, d) * 0.09} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Poly pts={rope(-1)} stroke={ink} sw={lw * 2} tension={0.6} cap="round" />
      <Poly pts={rope(1)} stroke={ink} sw={lw * 2} tension={0.6} cap="round" />
    </>
  );
};

/** Rig / Functional-Gerüst: Pfosten entlang beider Längsseiten, Querträger. */
export const rig: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const ps = Math.max(4, Math.min(w, d) * 0.06);
  const n = clampInt(w / 150, 1, 30) + 1;
  const step = (w - 2 * ps) / n;
  return (
    <>
      <Body w={w} d={d} fill={withAlpha(fill, 0.55)} stroke={stroke} sw={sw} />
      <Poly pts={[-hw + ps / 2, -hd + ps / 2, hw - ps / 2, -hd + ps / 2]} stroke={ink} sw={lw * 1.5} />
      <Poly pts={[-hw + ps / 2, hd - ps / 2, hw - ps / 2, hd - ps / 2]} stroke={ink} sw={lw * 1.5} />
      <Poly pts={[-hw + ps / 2, -hd + ps / 2, -hw + ps / 2, hd - ps / 2]} stroke={ink} sw={lw * 1.5} />
      <Poly pts={[hw - ps / 2, -hd + ps / 2, hw - ps / 2, hd - ps / 2]} stroke={ink} sw={lw * 1.5} />
      <Bars axis="x" from={-hw} to={hw} at={-hd + ps / 2} thickness={ps} step={step} bar={ps} color={shade} />
      <Bars axis="x" from={-hw} to={hw} at={hd - ps / 2} thickness={ps} step={step} bar={ps} color={shade} />
    </>
  );
};

/** Sprossenwand: zwei Holme, oberste Sprosse. */
export const wallBars: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hw = w / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw + w * 0.02} y={-d * 0.4} w={w * 0.08} h={d * 0.8} fill={shade} />
      <Box x={hw - w * 0.1} y={-d * 0.4} w={w * 0.08} h={d * 0.8} fill={shade} />
      <Poly pts={[-hw + w * 0.1, 0, hw - w * 0.1, 0]} stroke={ink} sw={lw * 2} cap="round" />
    </>
  );
};

/** Boxsack: runder Sack, Ständerarm hinten. */
export const punchingBag: SymbolRenderer = (p) => {
  const { w, d, def, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  const round = def?.form === 'kreis';
  const r = round ? w * 0.34 : Math.min(w, d) * 0.32;
  return (
    <>
      {round ? <Disc r={w / 2} fill={fill} stroke={stroke} sw={sw} /> : <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />}
      {!round && <Box x={-w * 0.4} y={-hd + d * 0.05} w={w * 0.8} h={d * 0.07} fill={shade} />}
      <Circle x={0} y={round ? 0 : d * 0.08} radius={r} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={0} y={round ? 0 : d * 0.08} radius={r * 0.45} fill={light} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Aerobic-Step: Trittfläche mit zwei Riser-Blöcken. */
export const step: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, light, shade } = p;
  const hw = w / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.08} />
      <Pad x={0} y={0} w={w * 0.7} h={d * 0.8} fill={light} r={d * 0.08} />
      <Box x={-hw + w * 0.04} y={-d * 0.36} w={w * 0.1} h={d * 0.72} fill={shade} r={w * 0.02} />
      <Box x={hw - w * 0.14} y={-d * 0.36} w={w * 0.1} h={d * 0.72} fill={shade} r={w * 0.02} />
    </>
  );
};

/** Mattenregal: gerollte Matten nebeneinander. */
export const matRack: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, light, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const n = clampInt(w / 22, 2, 40);
  const step = (w * 0.9) / n;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw + w * 0.03} y={-hd + d * 0.04} w={w * 0.94} h={d * 0.1} fill={shade} />
      <Dots axis="x" from={-hw + w * 0.05 + step / 2} to={hw - w * 0.05} at={d * 0.08} step={step} size={Math.min(step * 0.8, d * 0.7)} color={light} />
    </>
  );
};

/** Trainer-Podest: Deckfläche, Stufen an der Vorderkante. */
export const podium: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.46} y={-hd + d * 0.05} w={w * 0.92} h={d * 0.68} fill={light} />
      <Bars axis="y" from={hd - d * 0.24} to={hd - d * 0.02} at={0} thickness={w * 0.92} step={d * 0.08} bar={lw} color={ink} />
    </>
  );
};

/** Musikanlage: zwei Lautsprecher-Kreise, Bedienfeld. */
export const audio: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  const r = Math.min(w * 0.3, d * 0.18);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Circle x={0} y={-hd + d * 0.28} radius={r} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={0} y={hd - d * 0.28} radius={r} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Pad x={0} y={0} w={w * 0.5} h={d * 0.12} fill={light} stroke={ink} sw={lw} />
    </>
  );
};
