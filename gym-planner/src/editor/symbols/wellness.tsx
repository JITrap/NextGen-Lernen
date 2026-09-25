/**
 * Draufsicht-Symbole: Wellness (Sauna, Dampfbad, Tauchbecken, Liegen, Massage, Whirlpool …).
 */
import { Circle } from 'react-konva';
import { Body, Box, Bars, Dots, Pad, Poly, Disc, statePalette, mix, clampInt, type SymbolRenderer } from './common';

/** Finnische Sauna: Innenwand, zwei Bänke (L-förmig), Ofen mit Steinen, Tür vorne. */
export const sauna: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const t = Math.max(lw * 2, Math.min(w, d) * 0.05);
  const ov = Math.min(w, d) * 0.2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw + t} y={-hd + t} w={w - 2 * t} h={d - 2 * t} stroke={ink} sw={lw} />
      <Box x={-hw + t} y={-hd + t} w={w - 2 * t} h={d * 0.28} fill={light} />
      <Box x={-hw + t} y={-hd + t} w={w * 0.3} h={d - 2 * t} fill={light} />
      <Box x={hw - t - ov} y={hd - t - ov} w={ov} h={ov} fill={shade} r={ov * 0.1} />
      <Circle x={hw - t - ov / 2} y={hd - t - ov / 2} radius={ov * 0.28} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Poly pts={[-w * 0.2, hd - t / 2, w * 0.12, hd - t / 2]} stroke={light} sw={t} />
    </>
  );
};

/** Infrarotkabine: Sitzbank hinten, Strahler an den Seiten, Tür vorne. */
export const infrared: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, light, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const t = Math.max(lw * 2, Math.min(w, d) * 0.06);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw + t} y={-hd + t} w={w - 2 * t} h={d * 0.3} fill={light} />
      <Box x={-hw + t} y={-hd + d * 0.36} w={t} h={d * 0.5} fill={shade} />
      <Box x={hw - 2 * t} y={-hd + d * 0.36} w={t} h={d * 0.5} fill={shade} />
      <Poly pts={[-w * 0.25, hd - t / 2, w * 0.25, hd - t / 2]} stroke={light} sw={t} />
    </>
  );
};

/** Dampfbad: umlaufende Bank, Dampfdüse, Tür vorne. */
export const steam: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const t = Math.max(lw * 2, Math.min(w, d) * 0.05);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw + t} y={-hd + t} w={w - 2 * t} h={d * 0.26} fill={light} />
      <Box x={hw - t - w * 0.26} y={-hd + t} w={w * 0.26} h={d - 2 * t} fill={light} />
      <Circle x={-hw + t + w * 0.12} y={hd - t - d * 0.12} radius={Math.min(w, d) * 0.06} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Poly pts={[-w * 0.2, hd - t / 2, w * 0.1, hd - t / 2]} stroke={light} sw={t} />
    </>
  );
};

/** Cold Plunge / Tauchbecken: Wanne mit Wasser und Einstiegsleiter vorne. */
export const plunge: SymbolRenderer = (p) => {
  const { w, d, def, fill, stroke, sw, lw, ink, dark } = p;
  const water = statePalette(dark).water;
  const hd = d / 2;
  if (def?.form === 'kreis') {
    return (
      <>
        <Disc r={w / 2} fill={fill} stroke={stroke} sw={sw} />
        <Disc r={w * 0.4} fill={water} stroke={ink} sw={lw} />
      </>
    );
  }
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.1} />
      <Pad x={0} y={0} w={w * 0.84} h={d * 0.8} fill={water} stroke={ink} sw={lw} r={Math.min(w, d) * 0.08} />
      <Bars axis="y" from={hd - d * 0.36} to={hd - d * 0.1} at={0} thickness={w * 0.36} step={d * 0.08} bar={lw} color={ink} />
    </>
  );
};

/** Eisbrunnen: Schale mit Eis. */
export const iceFountain: SymbolRenderer = (p) => {
  const { w, d, def, fill, stroke, sw, lw, ink, light, dark } = p;
  const r = Math.min(w, d) * 0.4;
  return (
    <>
      {def?.form === 'kreis' ? <Disc r={w / 2} fill={fill} stroke={stroke} sw={sw} /> : <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.15} />}
      <Circle radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle radius={r * 0.5} fill={dark ? '#bae6fd' : '#e0f2fe'} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Kneipp-Becken: Wasserbecken mit Handlauf in der Mitte und Stufen an beiden Enden. */
export const kneipp: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, dark } = p;
  const water = statePalette(dark).water;
  const hw = w / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Pad x={0} y={0} w={w * 0.9} h={d * 0.8} fill={water} stroke={ink} sw={lw} r={Math.min(w, d) * 0.05} />
      <Poly pts={[-hw + w * 0.1, 0, hw - w * 0.1, 0]} stroke={ink} sw={lw * 2} cap="round" />
      <Bars axis="x" from={-hw + w * 0.07} to={-hw + w * 0.22} at={0} thickness={d * 0.8} step={w * 0.05} bar={lw} color={ink} />
      <Bars axis="x" from={hw - w * 0.2} to={hw - w * 0.05} at={0} thickness={d * 0.8} step={w * 0.05} bar={lw} color={ink} />
    </>
  );
};

/** Erlebnisdusche / Schwallbrause: Abfluss und drei Düsen. */
export const showerExperience: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const r = Math.min(w, d) * 0.08;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Circle x={0} y={d * 0.05} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={-w * 0.26} y={-d * 0.26} radius={r * 0.7} fill={shade} listening={false} perfectDrawEnabled={false} />
      <Circle x={w * 0.26} y={-d * 0.26} radius={r * 0.7} fill={shade} listening={false} perfectDrawEnabled={false} />
      <Circle x={0} y={-d * 0.34} radius={r * 0.9} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Ruheliege: Polster, Kopfteil hinten, Knicklinie. */
export const lounger: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.1} />
      <Pad x={0} y={d * 0.04} w={w * 0.82} h={d * 0.86} fill={light} r={Math.min(w, d) * 0.1} />
      <Box x={-w * 0.36} y={-hd + d * 0.06} w={w * 0.72} h={d * 0.18} fill={shade} r={Math.min(w, d) * 0.06} />
      <Poly pts={[-w * 0.38, d * 0.22, w * 0.38, d * 0.22]} stroke={ink} sw={lw} />
    </>
  );
};

/** Wasserbett: Polster mit Wellenlinie. */
export const waterbed: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, dark } = p;
  const water = mix(statePalette(dark).water, fill, 0.4);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.12} />
      <Pad x={0} y={0} w={w * 0.86} h={d * 0.86} fill={water} r={Math.min(w, d) * 0.1} />
      <Poly pts={[-w * 0.34, 0, -w * 0.17, -d * 0.08, 0, 0, w * 0.17, d * 0.08, w * 0.34, 0]} stroke={ink} sw={lw * 1.5} tension={0.5} cap="round" />
    </>
  );
};

/** Solarium: Liegefläche mit Röhren. */
export const solarium: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, light, shade } = p;
  const hd = d / 2;
  const n = clampInt(d / 12, 3, 20);
  const step = (d * 0.8) / n;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.15} />
      <Pad x={0} y={0} w={w * 0.88} h={d * 0.86} fill={light} r={Math.min(w, d) * 0.12} />
      <Bars axis="y" from={-hd + d * 0.1 + step / 2} to={hd - d * 0.1} at={0} thickness={w * 0.7} step={step} bar={lw * 1.5} color={shade} />
    </>
  );
};

/** Red-Light-Panel: flaches Panel mit LED-Reihe. */
export const redLight: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, light, dark } = p;
  const hw = w / 2;
  const n = clampInt(w / 10, 3, 60);
  const step = (w * 0.9) / n;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Pad x={0} y={0} w={w * 0.94} h={d * 0.6} fill={mix(fill, dark ? '#ef4444' : '#f87171', 0.6)} r={lw} />
      <Dots axis="x" from={-hw + w * 0.05 + step / 2} to={hw - w * 0.05} at={0} step={step} size={Math.min(step * 0.5, d * 0.3)} color={light} />
    </>
  );
};

/** Massagestuhl: Sitz, Rückenlehne, Armlehnen, Fußteil. */
export const massageChair: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, light, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.1} />
      <Box x={-w * 0.32} y={-hd + d * 0.05} w={w * 0.64} h={d * 0.24} fill={shade} r={Math.min(w, d) * 0.06} />
      <Pad x={0} y={d * 0.02} w={w * 0.6} h={d * 0.34} fill={light} r={Math.min(w, d) * 0.06} />
      <Box x={-hw + w * 0.05} y={-hd + d * 0.28} w={w * 0.12} h={d * 0.4} fill={shade} r={w * 0.03} />
      <Box x={hw - w * 0.17} y={-hd + d * 0.28} w={w * 0.12} h={d * 0.4} fill={shade} r={w * 0.03} />
      <Pad x={0} y={hd - d * 0.14} w={w * 0.5} h={d * 0.18} fill={shade} r={Math.min(w, d) * 0.05} />
    </>
  );
};

/** Massageliege: Polster mit Gesichtsöffnung hinten. */
export const massageTable: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.05} />
      <Pad x={0} y={0} w={w * 0.86} h={d * 0.9} fill={light} r={Math.min(w, d) * 0.08} />
      <Circle x={0} y={-hd + d * 0.14} radius={Math.min(w, d) * 0.09} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Whirlpool: Wanne mit Wasser und Sitzring (gestrichelt). */
export const whirlpool: SymbolRenderer = (p) => {
  const { w, d, def, fill, stroke, sw, lw, ink, dark } = p;
  const water = statePalette(dark).water;
  if (def?.form === 'kreis') {
    const r = w / 2;
    return (
      <>
        <Disc r={r} fill={fill} stroke={stroke} sw={sw} />
        <Disc r={r * 0.82} fill={water} stroke={ink} sw={lw} />
        <Disc r={r * 0.5} stroke={ink} sw={lw} dash={[lw * 3, lw * 3]} />
      </>
    );
  }
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.2} />
      <Pad x={0} y={0} w={w * 0.82} h={d * 0.82} fill={water} stroke={ink} sw={lw} r={Math.min(w, d) * 0.16} />
      <Pad x={0} y={0} w={w * 0.5} h={d * 0.5} stroke={ink} sw={lw} r={Math.min(w, d) * 0.1} />
    </>
  );
};

/** Teestation: Ablage, Wasserkocher, Tassen. */
export const teaStation: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hw = w / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Pad x={0} y={0} w={w * 0.9} h={d * 0.8} fill={light} r={Math.min(w, d) * 0.04} />
      <Circle x={-w * 0.25} y={-d * 0.05} radius={Math.min(w, d) * 0.14} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Dots axis="x" from={0} to={hw - w * 0.08} at={d * 0.15} step={Math.max(6, w * 0.12)} size={Math.min(w * 0.08, d * 0.2)} color={shade} />
    </>
  );
};
