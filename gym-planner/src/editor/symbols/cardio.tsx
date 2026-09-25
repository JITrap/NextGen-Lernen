/**
 * Draufsicht-Symbole: Cardio-Geräte. Lokale Koordinaten (Mitte, Breite x, Tiefe y, vorne = +y).
 * Konsole/Lenker liegen vorne (+y), die Sicherheitszone hinter dem Gerät (−y).
 */
import { Circle } from 'react-konva';
import { Body, Box, Bars, Pad, Poly, mix, type SymbolRenderer } from './common';

/** Laufband: Lauffläche mit Streifen, Seitenholme, Konsole vorne, Motorhaube hinten. */
export const treadmill: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.38} y={-hd + d * 0.1} w={w * 0.76} h={d * 0.72} fill={shade} />
      <Bars axis="y" from={-hd + d * 0.14} to={hd - d * 0.2} at={0} thickness={w * 0.76} step={d * 0.06} bar={lw * 1.5} color={mix(shade, ink, 0.5)} />
      <Box x={-hw + w * 0.04} y={hd - d * 0.62} w={w * 0.07} h={d * 0.48} fill={shade} r={w * 0.02} />
      <Box x={hw - w * 0.11} y={hd - d * 0.62} w={w * 0.07} h={d * 0.48} fill={shade} r={w * 0.02} />
      <Box x={-w * 0.4} y={-hd + d * 0.03} w={w * 0.8} h={d * 0.06} fill={shade} />
      <Pad x={0} y={hd - d * 0.09} w={w * 0.72} h={d * 0.1} fill={light} stroke={ink} sw={lw} />
    </>
  );
};

/** Curved Treadmill: gebogene Lauffläche, Streifen, Seitenholme, Haltebügel vorne. */
export const curvedTreadmill: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const belt = [-w * 0.38, -hd + d * 0.14, 0, -hd + d * 0.06, w * 0.38, -hd + d * 0.14, w * 0.38, hd - d * 0.14, 0, hd - d * 0.06, -w * 0.38, hd - d * 0.14];
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={w * 0.06} />
      <Poly pts={belt} closed fill={shade} tension={0.35} />
      <Bars axis="y" from={-hd + d * 0.14} to={hd - d * 0.16} at={0} thickness={w * 0.7} step={d * 0.06} bar={lw * 1.5} color={mix(shade, ink, 0.5)} />
      <Box x={-hw + w * 0.04} y={-hd + d * 0.2} w={w * 0.07} h={d * 0.6} fill={shade} r={w * 0.02} />
      <Box x={hw - w * 0.11} y={-hd + d * 0.2} w={w * 0.07} h={d * 0.6} fill={shade} r={w * 0.02} />
      <Pad x={0} y={hd - d * 0.06} w={w * 0.6} h={d * 0.06} fill={light} stroke={ink} sw={lw} />
    </>
  );
};

/** Crosstrainer: zwei Pedalschienen mit Pedalen, Schwungrad hinten, Griffe und Konsole vorne. */
export const elliptical: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Pad x={0} y={-hd + d * 0.16} w={w * 0.55} h={d * 0.22} fill={shade} r={w * 0.05} />
      <Pad x={-w * 0.21} y={d * 0.08} w={w * 0.22} h={d * 0.56} fill={light} r={w * 0.04} />
      <Pad x={w * 0.21} y={d * 0.08} w={w * 0.22} h={d * 0.56} fill={light} r={w * 0.04} />
      <Pad x={-w * 0.21} y={-d * 0.02} w={w * 0.16} h={d * 0.16} fill={shade} r={w * 0.02} />
      <Pad x={w * 0.21} y={d * 0.18} w={w * 0.16} h={d * 0.16} fill={shade} r={w * 0.02} />
      <Poly pts={[-w * 0.36, hd - d * 0.26, -w * 0.15, hd - d * 0.12, w * 0.15, hd - d * 0.12, w * 0.36, hd - d * 0.26]} stroke={ink} sw={lw * 1.5} />
      <Pad x={0} y={hd - d * 0.06} w={w * 0.5} h={d * 0.07} fill={light} stroke={ink} sw={lw} />
    </>
  );
};

/** Ergometer: Rahmen, Sattel hinten, Tretlager, Lenker und Konsole vorne. */
export const bike: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[0, -hd + d * 0.24, 0, hd - d * 0.22]} stroke={ink} sw={lw * 3} cap="round" />
      <Circle x={0} y={d * 0.05} radius={Math.min(w, d) * 0.14} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Pad x={0} y={-hd + d * 0.2} w={w * 0.45} h={d * 0.16} fill={light} stroke={ink} sw={lw} r={w * 0.1} />
      <Pad x={0} y={hd - d * 0.2} w={w * 0.82} h={d * 0.08} fill={shade} />
      <Pad x={0} y={hd - d * 0.08} w={w * 0.34} h={d * 0.08} fill={light} stroke={ink} sw={lw} />
    </>
  );
};

/** Liegeergometer: Sitz mit Rückenlehne hinten, Tretlager-Gehäuse und Konsole vorne. */
export const recumbentBike: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[0, -hd + d * 0.36, 0, hd - d * 0.3]} stroke={ink} sw={lw * 3} cap="round" />
      <Box x={-w * 0.3} y={-hd + d * 0.05} w={w * 0.6} h={d * 0.09} fill={shade} r={w * 0.03} />
      <Pad x={0} y={-hd + d * 0.27} w={w * 0.6} h={d * 0.24} fill={light} r={w * 0.06} />
      <Pad x={0} y={hd - d * 0.22} w={w * 0.5} h={d * 0.22} fill={shade} r={w * 0.06} />
      <Pad x={0} y={hd - d * 0.07} w={w * 0.34} h={d * 0.07} fill={light} stroke={ink} sw={lw} />
    </>
  );
};

/** Spinning-Bike: Schwungrad vorne, Rahmen, Sattel hinten, Lenker. */
export const spinBike: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[0, -hd + d * 0.22, 0, hd - d * 0.14]} stroke={ink} sw={lw * 3} cap="round" />
      <Circle x={0} y={hd - d * 0.3} radius={Math.min(w * 0.4, d * 0.18)} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Pad x={0} y={-hd + d * 0.18} w={w * 0.4} h={d * 0.14} fill={light} stroke={ink} sw={lw} r={w * 0.1} />
      <Pad x={0} y={hd - d * 0.08} w={w * 0.7} h={d * 0.08} fill={shade} />
    </>
  );
};

/** Air Bike: großes Lüfterrad vorne, Sattel hinten, bewegliche Griffe. */
export const airBike: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  const r = Math.min(w * 0.42, d * 0.22);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[0, -hd + d * 0.24, 0, hd - d * 0.3]} stroke={ink} sw={lw * 3} cap="round" />
      <Circle x={0} y={hd - d * 0.26} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={0} y={hd - d * 0.26} radius={r * 0.25} fill={shade} listening={false} perfectDrawEnabled={false} />
      <Pad x={0} y={-hd + d * 0.18} w={w * 0.42} h={d * 0.14} fill={light} stroke={ink} sw={lw} r={w * 0.1} />
      <Poly pts={[-w * 0.4, hd - d * 0.16, 0, hd - d * 0.48, w * 0.4, hd - d * 0.16]} stroke={ink} sw={lw * 1.5} cap="round" />
    </>
  );
};

/** Rudergerät: lange Schiene, Rollsitz, Fußplatten, Schwungrad-Gehäuse vorne. */
export const rower: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.12} y={-hd + d * 0.05} w={w * 0.24} h={d * 0.76} fill={shade} r={w * 0.03} />
      <Pad x={0} y={-hd + d * 0.42} w={w * 0.42} h={d * 0.08} fill={light} stroke={ink} sw={lw} r={w * 0.04} />
      <Box x={-w * 0.4} y={hd - d * 0.34} w={w * 0.2} h={d * 0.12} fill={light} stroke={ink} sw={lw} r={w * 0.02} />
      <Box x={w * 0.2} y={hd - d * 0.34} w={w * 0.2} h={d * 0.12} fill={light} stroke={ink} sw={lw} r={w * 0.02} />
      <Pad x={0} y={hd - d * 0.1} w={w * 0.9} h={d * 0.16} fill={shade} r={w * 0.08} />
      <Circle x={0} y={hd - d * 0.1} radius={Math.min(w * 0.3, d * 0.06)} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Stairmaster: Stufenband, Handläufe, Konsole vorne, Sockel hinten. */
export const stairmaster: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.3} y={-hd + d * 0.04} w={w * 0.6} h={d * 0.1} fill={shade} />
      <Bars axis="y" from={-hd + d * 0.18} to={hd - d * 0.22} at={0} thickness={w * 0.56} step={d * 0.09} bar={d * 0.045} color={shade} />
      <Box x={-hw + w * 0.06} y={-hd + d * 0.3} w={w * 0.07} h={d * 0.55} fill={shade} r={w * 0.02} />
      <Box x={hw - w * 0.13} y={-hd + d * 0.3} w={w * 0.07} h={d * 0.55} fill={shade} r={w * 0.02} />
      <Pad x={0} y={hd - d * 0.08} w={w * 0.6} h={d * 0.09} fill={light} stroke={ink} sw={lw} />
    </>
  );
};

/** SkiErg: Turm mit Lüfterrad hinten, zwei Zugseile mit Griffen nach vorne. */
export const skierg: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.05;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.32} y={-hd + d * 0.05} w={w * 0.64} h={d * 0.3} fill={shade} r={w * 0.03} />
      <Circle x={0} y={-hd + d * 0.2} radius={Math.min(w * 0.22, d * 0.11)} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Poly pts={[-w * 0.18, -hd + d * 0.36, -w * 0.28, hd - d * 0.16]} stroke={ink} sw={lw} />
      <Poly pts={[w * 0.18, -hd + d * 0.36, w * 0.28, hd - d * 0.16]} stroke={ink} sw={lw} />
      <Circle x={-w * 0.28} y={hd - d * 0.14} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={w * 0.28} y={hd - d * 0.14} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};
