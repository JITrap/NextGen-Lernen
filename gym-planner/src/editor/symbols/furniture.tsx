/**
 * Draufsicht-Symbole: Empfang & Lounge, Büro & Personal, Lager & Technik, Ausstattung.
 */
import { Arrow, Circle, Ellipse, Star, Wedge } from 'react-konva';
import { Body, Box, Bars, Dots, Pad, Poly, Disc, clampInt, mix, withAlpha, type SymbolRenderer } from './common';

/** Theke: Arbeitsfläche, Kundenkante vorne. */
export const counter: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.08} />
      <Pad x={0} y={-d * 0.08} w={w * 0.9} h={d * 0.6} fill={light} r={Math.min(w, d) * 0.05} />
      <Poly pts={[-w * 0.46, hd - d * 0.12, w * 0.46, hd - d * 0.12]} stroke={ink} sw={lw * 2} cap="round" />
    </>
  );
};

/** Drehkreuz: Gehäuse, drei Sperrarme um die Nabe. */
export const turnstile: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.44;
  const tip = (deg: number) => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.14} y={-hd + d * 0.08} w={w * 0.28} h={d * 0.84} fill={shade} r={w * 0.04} />
      <Poly pts={[...tip(30), 0, 0, ...tip(150), 0, 0, ...tip(270)]} stroke={ink} sw={lw * 2} cap="round" />
      <Circle radius={Math.min(w, d) * 0.08} fill={ink} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Kühlschrank: Türkante vorne, Griff, Fachböden. */
export const fridge: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Bars axis="y" from={-hd + d * 0.2} to={hd - d * 0.24} at={0} thickness={w * 0.8} step={d * 0.22} bar={lw} color={light} />
      <Box x={-hw + w * 0.04} y={hd - d * 0.14} w={w * 0.92} h={d * 0.06} fill={shade} />
      <Box x={hw - w * 0.24} y={hd - d * 0.1} w={w * 0.16} h={d * 0.04} fill={ink} r={lw} />
    </>
  );
};

/** Getränkeautomat: Frontblende mit Ausgabefach und Display. */
export const vending: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.42} y={hd - d * 0.24} w={w * 0.84} h={d * 0.18} fill={shade} />
      <Pad x={-w * 0.12} y={hd - d * 0.15} w={w * 0.4} h={d * 0.08} fill={light} stroke={ink} sw={lw} />
      <Pad x={w * 0.28} y={hd - d * 0.15} w={w * 0.16} h={d * 0.08} fill={light} stroke={ink} sw={lw} />
    </>
  );
};

/** Sofa: Rückenlehne hinten, Armlehnen, Sitzkissen. */
export const sofa: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, light, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const n = clampInt(w / 80, 1, 12);
  const inner = w * 0.72;
  const stepW = inner / n;
  const gap = Math.min(4, stepW * 0.1);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.1} />
      <Box x={-hw + w * 0.04} y={-hd + d * 0.05} w={w * 0.92} h={d * 0.24} fill={shade} r={d * 0.06} />
      <Box x={-hw + w * 0.04} y={-hd + d * 0.05} w={w * 0.1} h={d * 0.9} fill={shade} r={w * 0.02} />
      <Box x={hw - w * 0.14} y={-hd + d * 0.05} w={w * 0.1} h={d * 0.9} fill={shade} r={w * 0.02} />
      <Bars axis="x" from={-inner / 2 + gap / 2} to={inner / 2} at={d * 0.14} thickness={d * 0.6} step={stepW} bar={stepW - gap} color={light} />
    </>
  );
};

/** Tisch: Platte mit innerer Fläche (rund bei form „kreis“). */
export const table: SymbolRenderer = (p) => {
  const { w, d, def, fill, stroke, sw, light } = p;
  if (def?.form === 'kreis') {
    return (
      <>
        <Disc r={w / 2} fill={fill} stroke={stroke} sw={sw} />
        <Disc r={w * 0.4} fill={light} sw={0} />
      </>
    );
  }
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.08} />
      <Pad x={0} y={0} w={w * 0.84} h={d * 0.8} fill={light} r={Math.min(w, d) * 0.06} />
    </>
  );
};

/** Stuhl: Sitzfläche, Rückenlehne hinten. */
export const chair: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.1} />
      <Pad x={0} y={d * 0.1} w={w * 0.8} h={d * 0.66} fill={light} r={Math.min(w, d) * 0.1} />
      <Box x={-w * 0.4} y={-hd + d * 0.03} w={w * 0.8} h={d * 0.15} fill={shade} r={d * 0.05} />
    </>
  );
};

/** Garderobe: Stange mit Haken. */
export const wardrobe: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hw = w / 2;
  const n = clampInt(w / 15, 2, 60);
  const step = (w * 0.9) / n;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[-hw + w * 0.04, 0, hw - w * 0.04, 0]} stroke={ink} sw={lw * 2} cap="round" />
      <Dots axis="x" from={-hw + w * 0.05 + step / 2} to={hw - w * 0.05} at={d * 0.22} step={step} size={Math.min(step * 0.5, d * 0.3)} color={shade} />
    </>
  );
};

/** Info-Bildschirm auf Standfuß. */
export const screen: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Circle x={0} y={d * 0.2} radius={Math.min(w * 0.3, d * 0.22)} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Poly pts={[0, -hd + d * 0.3, 0, d * 0.2]} stroke={ink} sw={lw * 2} />
      <Box x={-w * 0.46} y={-hd + d * 0.12} w={w * 0.92} h={d * 0.2} fill={shade} r={lw} />
    </>
  );
};

/** Schreibtisch: Platte, Monitor hinten, Tastatur. */
export const desk: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.04} />
      <Pad x={0} y={0} w={w * 0.92} h={d * 0.86} fill={light} r={Math.min(w, d) * 0.03} />
      <Box x={-w * 0.16} y={-hd + d * 0.12} w={w * 0.32} h={d * 0.08} fill={shade} r={lw} />
      <Pad x={0} y={d * 0.12} w={w * 0.36} h={d * 0.14} fill={fill} stroke={ink} sw={lw} r={lw} />
    </>
  );
};

/** Bürostuhl: Fußkreuz, Sitz, Rückenlehne. */
export const officeChair: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.48;
  const tip = (deg: number) => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];
  return (
    <>
      <Body w={w} d={d} fill={withAlpha(fill, 0.5)} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.2} />
      <Poly pts={[...tip(-90), 0, 0, ...tip(-18), 0, 0, ...tip(54), 0, 0, ...tip(126), 0, 0, ...tip(198)]} stroke={ink} sw={lw * 1.5} cap="round" />
      <Pad x={0} y={d * 0.08} w={w * 0.72} h={d * 0.6} fill={light} r={Math.min(w, d) * 0.12} />
      <Box x={-w * 0.34} y={-hd + d * 0.06} w={w * 0.68} h={d * 0.16} fill={shade} r={d * 0.05} />
    </>
  );
};

/** Aktenschrank: Front mit Griff vorne. */
export const filingCabinet: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.46} y={hd - d * 0.16} w={w * 0.92} h={d * 0.08} fill={shade} />
      <Box x={-w * 0.15} y={hd - d * 0.13} w={w * 0.3} h={d * 0.03} fill={ink} r={lw} />
      <Poly pts={[-w * 0.46, -hd + d * 0.04, w * 0.46, -hd + d * 0.04]} stroke={ink} sw={lw} />
    </>
  );
};

/** Besprechungstisch: Platte mit Mittelfuge (rund bei form „kreis“). */
export const meetingTable: SymbolRenderer = (p) => {
  const { w, d, def, fill, stroke, sw, lw, ink, light } = p;
  if (def?.form === 'kreis') {
    return (
      <>
        <Disc r={w / 2} fill={fill} stroke={stroke} sw={sw} />
        <Disc r={w * 0.42} fill={light} sw={0} />
      </>
    );
  }
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.12} />
      <Pad x={0} y={0} w={w * 0.88} h={d * 0.8} fill={light} r={Math.min(w, d) * 0.1} />
      <Poly pts={[-w * 0.4, 0, w * 0.4, 0]} stroke={ink} sw={lw} dash={[lw * 4, lw * 3]} />
    </>
  );
};

/** Regal: Fächer, offene Vorderkante gestrichelt. */
export const shelf: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const n = clampInt(w / 80, 1, 30);
  const step = w / n;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      {n > 1 && <Bars axis="x" from={-hw + step} to={hw - step * 0.5} at={0} thickness={d * 0.9} step={step} bar={lw * 1.5} color={shade} />}
      <Poly pts={[-hw + lw, hd - lw * 1.5, hw - lw, hd - lw * 1.5]} stroke={ink} sw={lw} dash={[lw * 4, lw * 3]} />
    </>
  );
};

/** Lüftungsanlage: Lüfterrad mit Flügeln, Lamellengitter vorne. */
export const hvac: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  const r = Math.min(w * 0.3, d * 0.26);
  const cy = -d * 0.1;
  const tip = (deg: number) => [Math.cos((deg * Math.PI) / 180) * r * 0.9, cy + Math.sin((deg * Math.PI) / 180) * r * 0.9];
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Circle x={0} y={cy} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Poly pts={[...tip(-90), 0, cy, ...tip(30), 0, cy, ...tip(150)]} stroke={ink} sw={lw * 1.5} cap="round" />
      <Bars axis="x" from={-w * 0.4} to={w * 0.4} at={hd - d * 0.12} thickness={d * 0.12} step={w * 0.08} bar={lw} color={shade} />
    </>
  );
};

/** Waschmaschine / Trockner: Bullauge mit Trommel, Bedienblende hinten. */
export const washer: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.3;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.42} y={-hd + d * 0.05} w={w * 0.84} h={d * 0.14} fill={shade} />
      <Circle x={0} y={d * 0.1} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={0} y={d * 0.1} radius={r * 0.55} fill={shade} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Putzwagen: zwei Eimer, Schiebegriff, Mopp. */
export const cleaningCart: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light } = p;
  const hd = d / 2;
  const r = Math.min(w * 0.2, d * 0.2);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.06} />
      <Circle x={-w * 0.22} y={d * 0.12} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={w * 0.22} y={d * 0.12} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Poly pts={[-w * 0.4, -hd + d * 0.1, w * 0.4, -hd + d * 0.1]} stroke={ink} sw={lw * 2.5} cap="round" />
      <Poly pts={[-w * 0.38, hd - d * 0.08, w * 0.38, -hd + d * 0.28]} stroke={ink} sw={lw} />
    </>
  );
};

/** Schaltschrank: Front, Blitzsymbol. */
export const switchboard: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hd = d / 2;
  const s = Math.min(w, d) * 0.4;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.46} y={hd - d * 0.14} w={w * 0.92} h={d * 0.06} fill={shade} />
      <Poly pts={[s * 0.15, -s * 0.5, -s * 0.35, s * 0.05, s * 0.05, s * 0.05, -s * 0.15, s * 0.5, s * 0.35, -s * 0.1, s * 0.0, -s * 0.1]} closed fill={ink} sw={lw} />
    </>
  );
};

/** Pflanze: Blattstern mit Topf. */
export const plant: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const r = Math.min(w, d) / 2;
  return (
    <>
      <Star numPoints={7} innerRadius={r * 0.5} outerRadius={r} fill={fill} stroke={stroke} strokeWidth={sw} lineJoin="round" listening={false} perfectDrawEnabled={false} />
      <Circle radius={r * 0.28} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Lautsprecher: Tief- und Hochtöner. */
export const speaker: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.3;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Circle x={0} y={d * 0.12} radius={r} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={0} y={-hd + d * 0.24} radius={r * 0.4} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** TV an der Wand: flaches Panel, Wandhalterung hinten. */
export const tv: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.47} y={-hd + d * 0.25} w={w * 0.94} h={d * 0.45} fill={shade} r={lw} />
      <Poly pts={[-w * 0.15, -hd + lw, w * 0.15, -hd + lw]} stroke={ink} sw={lw * 3} />
    </>
  );
};

/** Wasserspender: Flasche oben, Zapfstelle vorne. */
export const waterDispenser: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade, dark } = p;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.3;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.1} />
      <Circle x={0} y={-d * 0.08} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={0} y={-d * 0.08} radius={r * 0.55} fill={dark ? '#0ea5e9' : '#7dd3fc'} listening={false} perfectDrawEnabled={false} />
      <Box x={-w * 0.16} y={hd - d * 0.2} w={w * 0.32} h={d * 0.12} fill={shade} r={lw} />
    </>
  );
};

/** Desinfektionsstation: Standfuß, Spenderflasche, Tropfen. */
export const sanitizer: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.15} />
      <Box x={-w * 0.2} y={-hd + d * 0.14} w={w * 0.4} h={d * 0.44} fill={shade} r={w * 0.05} />
      <Circle x={0} y={hd - d * 0.22} radius={Math.min(w, d) * 0.1} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Mülleimer: Deckelring und Einwurfschlitz. */
export const trash: SymbolRenderer = (p) => {
  const { w, d, def, fill, stroke, sw, lw, ink, shade } = p;
  const round = def?.form === 'kreis' || Math.abs(w - d) < 1;
  if (round) {
    const r = w / 2;
    return (
      <>
        <Disc r={r} fill={fill} stroke={stroke} sw={sw} />
        <Disc r={r * 0.7} fill={shade} stroke={ink} sw={lw} />
        <Poly pts={[-r * 0.35, 0, r * 0.35, 0]} stroke={ink} sw={lw * 2} cap="round" />
      </>
    );
  }
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.15} />
      <Pad x={0} y={0} w={w * 0.7} h={d * 0.7} fill={shade} stroke={ink} sw={lw} r={Math.min(w, d) * 0.1} />
      <Poly pts={[-w * 0.2, 0, w * 0.2, 0]} stroke={ink} sw={lw * 2} cap="round" />
    </>
  );
};

/** Feuerlöscher (rot): Flasche mit Griffbügel und Schlauch. */
export const extinguisher: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, dark } = p;
  const r = Math.min(w, d) / 2;
  const white = dark ? '#fee2e2' : '#ffffff';
  return (
    <>
      <Disc r={r} fill={fill} stroke={stroke} sw={sw} />
      <Disc r={r * 0.55} fill={mix(fill, white, 0.25)} stroke={white} sw={lw} />
      <Poly pts={[-r * 0.6, 0, r * 0.6, 0]} stroke={white} sw={lw * 2} cap="round" />
      <Poly pts={[r * 0.3, -r * 0.25, r * 0.85, -r * 0.55]} stroke={white} sw={lw * 1.5} cap="round" />
    </>
  );
};

/** Erste-Hilfe-Kasten (grün): weißes Kreuz. */
export const firstAid: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, dark } = p;
  const s = Math.min(w, d);
  const white = dark ? '#f0fdf4' : '#ffffff';
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={s * 0.12} />
      <Box x={-s * 0.1} y={-s * 0.34} w={s * 0.2} h={s * 0.68} fill={white} r={s * 0.02} />
      <Box x={-s * 0.34} y={-s * 0.1} w={s * 0.68} h={s * 0.2} fill={white} r={s * 0.02} />
    </>
  );
};

/** AED / Defibrillator (grün): Herz mit Blitz. */
export const aed: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, dark } = p;
  const s = Math.min(w, d) * 0.38;
  const white = dark ? '#f0fdf4' : '#ffffff';
  const heart = [0, s * 0.95, -s * 0.95, -s * 0.05, -s * 0.55, -s * 0.85, 0, -s * 0.4, s * 0.55, -s * 0.85, s * 0.95, -s * 0.05];
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.12} />
      <Poly pts={heart} closed fill={white} tension={0.35} />
      <Poly pts={[s * 0.15, -s * 0.5, -s * 0.2, s * 0.05, s * 0.05, s * 0.05, -s * 0.15, s * 0.55]} stroke={fill} sw={lw * 1.5} cap="round" />
    </>
  );
};

/** Notausgang-Schild (grün): Tür und Pfeil. */
export const exitSign: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, dark } = p;
  const white = dark ? '#f0fdf4' : '#ffffff';
  const s = Math.min(w, d);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={s * 0.08} />
      <Box x={-w * 0.42} y={-d * 0.3} w={Math.min(w * 0.16, s * 0.3)} h={d * 0.6} fill={white} r={lw} />
      <Arrow points={[-w * 0.1, 0, w * 0.34, 0]} pointerLength={Math.min(w * 0.12, d * 0.3)} pointerWidth={Math.min(w * 0.12, d * 0.4)} fill={white} stroke={white} strokeWidth={lw * 2} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Kamera: Gehäuse, Objektiv und Sichtkegel nach vorne. */
export const camera: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.5;
  return (
    <>
      <Wedge x={0} y={-hd + d * 0.3} radius={r * 1.6} angle={60} rotation={60} fill={withAlpha(light, 0.45)} listening={false} perfectDrawEnabled={false} />
      <Body w={w * 0.8} d={d * 0.6} fill={fill} stroke={stroke} sw={sw} r={r * 0.2} />
      <Ellipse x={0} y={-hd + d * 0.3} radiusX={r * 0.4} radiusY={r * 0.3} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};
