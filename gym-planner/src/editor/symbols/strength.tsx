/**
 * Draufsicht-Symbole: Kraftgeräte, Racks, Bänke, Plattformen, Ablagen, Freihantel-Zubehör.
 * Lokale Koordinaten: Ursprung Mitte, Breite x, Tiefe y, vorne = +y. Höchstens 8 Konva-Nodes je Symbol.
 */
import { Circle, Line } from 'react-konva';
import { Body, Box, Bars, Pad, Poly, Disc, clampInt, type SymbolRenderer } from './common';

/** Allgemeines Kraftgerät: Turm hinten, Sitz + Rückenpolster vorne. */
export const machine: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.35} y={-hd + d * 0.06} w={w * 0.7} h={d * 0.26} fill={shade} r={d * 0.02} />
      <Pad x={0} y={hd - d * 0.5} w={w * 0.36} h={d * 0.12} fill={light} />
      <Pad x={0} y={hd - d * 0.27} w={w * 0.36} h={d * 0.26} fill={light} />
    </>
  );
};

/** Hantelbank: Rückenpolster hinten, Sitzpolster vorne, zwei Fußstreben. */
export const bench: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.32} y={-hd + d * 0.05} w={w * 0.64} h={d * 0.05} fill={shade} />
      <Box x={-w * 0.32} y={hd - d * 0.1} w={w * 0.64} h={d * 0.05} fill={shade} />
      <Pad x={0} y={-hd + d * 0.33} w={w * 0.42} h={d * 0.5} fill={light} r={w * 0.04} />
      <Pad x={0} y={hd - d * 0.24} w={w * 0.42} h={d * 0.3} fill={light} r={w * 0.04} />
    </>
  );
};

/** Power Rack: vier Pfosten, Ablage hinten, zwei Sicherheitsstreben. */
export const rack: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const ps = Math.min(w, d) * 0.12;
  const off = ps * 0.9;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw + off - ps / 2} y={-hd + off - ps / 2} w={ps} h={ps} fill={shade} />
      <Box x={hw - off - ps / 2} y={-hd + off - ps / 2} w={ps} h={ps} fill={shade} />
      <Box x={-hw + off - ps / 2} y={hd - off - ps / 2} w={ps} h={ps} fill={shade} />
      <Box x={hw - off - ps / 2} y={hd - off - ps / 2} w={ps} h={ps} fill={shade} />
      <Box x={-hw + off} y={-hd + off - ps * 0.25} w={w - 2 * off} h={ps * 0.5} fill={shade} />
      <Poly pts={[-hw + off, -hd + off, -hw + off, hd - off]} stroke={ink} sw={lw} />
      <Poly pts={[hw - off, -hd + off, hw - off, hd - off]} stroke={ink} sw={lw} />
    </>
  );
};

/** Half Rack: zwei Pfosten hinten, zwei Ausleger nach vorne. */
export const halfRack: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const ps = Math.min(w, d) * 0.13;
  const off = ps * 0.9;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw + off - ps / 2} y={-hd + off - ps / 2} w={ps} h={ps} fill={shade} />
      <Box x={hw - off - ps / 2} y={-hd + off - ps / 2} w={ps} h={ps} fill={shade} />
      <Box x={-hw + off} y={-hd + off - ps * 0.25} w={w - 2 * off} h={ps * 0.5} fill={shade} />
      <Box x={-hw + off - ps * 0.25} y={-hd + off} w={ps * 0.5} h={d - off - ps} fill={shade} />
      <Box x={hw - off - ps * 0.25} y={-hd + off} w={ps * 0.5} h={d - off - ps} fill={shade} />
    </>
  );
};

/** Smith Machine: zwei Führungsschienen, Hantelstange mit Scheiben, Querträger hinten. */
export const smith: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const barY = -hd + d * 0.42;
  const r = Math.min(w * 0.06, d * 0.1);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw + w * 0.07} y={-hd + d * 0.06} w={w * 0.86} h={d * 0.06} fill={shade} />
      <Box x={-hw + w * 0.07} y={-hd + d * 0.1} w={w * 0.08} h={d * 0.82} fill={shade} />
      <Box x={hw - w * 0.15} y={-hd + d * 0.1} w={w * 0.08} h={d * 0.82} fill={shade} />
      <Poly pts={[-hw + w * 0.03, barY, hw - w * 0.03, barY]} stroke={ink} sw={lw * 2.5} cap="round" />
      <Circle x={-hw + w * 0.12} y={barY} radius={r} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={hw - w * 0.12} y={barY} radius={r} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Plattform: Gummifläche mit Holzstreifen in der Mitte. */
export const platform: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.2} y={-hd + d * 0.04} w={w * 0.4} h={d * 0.92} fill={light} />
      <Poly pts={[-w * 0.2, -hd + d * 0.04, -w * 0.2, hd - d * 0.04]} stroke={ink} sw={lw} dash={[lw * 4, lw * 3]} />
      <Poly pts={[w * 0.2, -hd + d * 0.04, w * 0.2, hd - d * 0.04]} stroke={ink} sw={lw} dash={[lw * 4, lw * 3]} />
    </>
  );
};

/** Kurzhantel-Regal: zwei Etagen mit Hantelpaaren (Balkenmuster). */
export const dumbbellRack: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const pairs = clampInt(w / 26, 2, 40);
  const step = (w * 0.9) / pairs;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Bars axis="x" from={-hw + w * 0.05 + step * 0.25} to={hw - w * 0.05} at={-hd + d * 0.3} thickness={d * 0.32} step={step} bar={step * 0.5} color={shade} />
      <Bars axis="x" from={-hw + w * 0.05 + step * 0.25} to={hw - w * 0.05} at={hd - d * 0.3} thickness={d * 0.32} step={step} bar={step * 0.5} color={shade} />
    </>
  );
};

/** Scheibenständer: Pfosten mit zwei Scheibenhörnern. */
export const plateRack: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.26;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.08} y={-hd + d * 0.12} w={w * 0.16} h={d * 0.76} fill={shade} />
      <Circle x={0} y={-hd + d * 0.3} radius={r} stroke={ink} strokeWidth={lw * 1.5} listening={false} perfectDrawEnabled={false} />
      <Circle x={0} y={hd - d * 0.3} radius={r} stroke={ink} strokeWidth={lw * 1.5} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Kabelzug / Functional Trainer: breiter Rahmen hinten, zwei Säulen, zwei Griffe vorne. */
export const cable: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.06;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw + w * 0.03} y={-hd + d * 0.05} w={w * 0.94} h={d * 0.22} fill={shade} />
      <Box x={-hw + w * 0.03} y={-hd + d * 0.05} w={w * 0.16} h={d * 0.88} fill={shade} />
      <Box x={hw - w * 0.19} y={-hd + d * 0.05} w={w * 0.16} h={d * 0.88} fill={shade} />
      <Circle x={-hw + w * 0.11} y={hd - d * 0.16} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={hw - w * 0.11} y={hd - d * 0.16} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Beinpresse: Sitz hinten, schräger Schlitten mit Fußplatte vorne, zwei Schienen. */
export const legPress: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[-w * 0.22, -hd + d * 0.42, -w * 0.22, hd - d * 0.08, w * 0.22, hd - d * 0.08, w * 0.22, -hd + d * 0.42]} stroke={ink} sw={lw} />
      <Pad x={0} y={-hd + d * 0.24} w={w * 0.5} h={d * 0.34} fill={light} r={w * 0.05} />
      <Poly pts={[-w * 0.34, hd - d * 0.4, w * 0.34, hd - d * 0.4, w * 0.42, hd - d * 0.08, -w * 0.42, hd - d * 0.08]} closed fill={shade} />
      <Poly pts={[-w * 0.38, hd - d * 0.12, w * 0.38, hd - d * 0.12]} stroke={ink} sw={lw * 2} />
    </>
  );
};

/** Hack Squat: schräger Schlitten mit Schulterpolstern, Fußplatte vorne. */
export const hackSquat: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.07;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[-w * 0.3, -hd + d * 0.08, w * 0.3, -hd + d * 0.08, w * 0.36, hd - d * 0.3, -w * 0.36, hd - d * 0.3]} closed fill={shade} />
      <Circle x={-w * 0.17} y={-hd + d * 0.2} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={w * 0.17} y={-hd + d * 0.2} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Box x={-w * 0.3} y={hd - d * 0.28} w={w * 0.6} h={d * 0.2} fill={light} stroke={ink} sw={lw} />
    </>
  );
};

/** Latzug: Turm hinten mit Zugstange, Sitz und Oberschenkelpolster vorne. */
export const latPulldown: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.3} y={-hd + d * 0.04} w={w * 0.6} h={d * 0.3} fill={shade} r={d * 0.02} />
      <Poly pts={[-hw + w * 0.08, -hd + d * 0.38, hw - w * 0.08, -hd + d * 0.38]} stroke={ink} sw={lw * 2} cap="round" />
      <Pad x={0} y={hd - d * 0.43} w={w * 0.5} h={d * 0.08} fill={shade} />
      <Pad x={0} y={hd - d * 0.24} w={w * 0.36} h={d * 0.22} fill={light} />
    </>
  );
};

/** Brustpresse: Gewichtsblock hinten, Sitz + Rückenpolster, zwei Griffe seitlich. */
export const chestPress: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, light, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.2} y={-hd + d * 0.05} w={w * 0.4} h={d * 0.22} fill={shade} r={d * 0.02} />
      <Pad x={0} y={hd - d * 0.5} w={w * 0.34} h={d * 0.12} fill={light} />
      <Pad x={0} y={hd - d * 0.28} w={w * 0.34} h={d * 0.26} fill={light} />
      <Box x={-hw + w * 0.16} y={hd - d * 0.5} w={w * 0.08} h={d * 0.28} fill={shade} r={w * 0.02} />
      <Box x={hw - w * 0.24} y={hd - d * 0.5} w={w * 0.08} h={d * 0.28} fill={shade} r={w * 0.02} />
    </>
  );
};

/** Rudermaschine: Gewichtsblock hinten, Brustpolster, Sitz vorne. */
export const row: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.25} y={-hd + d * 0.05} w={w * 0.5} h={d * 0.26} fill={shade} r={d * 0.02} />
      <Poly pts={[-w * 0.2, -hd + d * 0.36, w * 0.2, -hd + d * 0.36]} stroke={ink} sw={lw * 2} cap="round" />
      <Pad x={0} y={hd - d * 0.46} w={w * 0.44} h={d * 0.09} fill={shade} />
      <Pad x={0} y={hd - d * 0.25} w={w * 0.36} h={d * 0.24} fill={light} />
    </>
  );
};

/** Curl-Maschine: Sitz hinten, schräges Armpolster vorne, Gewichtsblock. */
export const curl: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.2} y={hd - d * 0.24} w={w * 0.4} h={d * 0.18} fill={shade} r={d * 0.02} />
      <Pad x={0} y={-hd + d * 0.28} w={w * 0.36} h={d * 0.28} fill={light} />
      <Poly pts={[-w * 0.34, -hd + d * 0.48, w * 0.34, -hd + d * 0.48, w * 0.28, -hd + d * 0.66, -w * 0.28, -hd + d * 0.66]} closed fill={light} />
    </>
  );
};

/** Wadenmaschine: Rahmen hinten, Schulterpolster, Fußplatte vorne. */
export const calf: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.08;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.3} y={-hd + d * 0.05} w={w * 0.6} h={d * 0.2} fill={shade} r={d * 0.02} />
      <Circle x={-w * 0.2} y={-hd + d * 0.38} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={w * 0.2} y={-hd + d * 0.38} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Box x={-w * 0.25} y={hd - d * 0.32} w={w * 0.5} h={d * 0.22} fill={light} stroke={ink} sw={lw} />
    </>
  );
};

/** Dip-/Klimmzugstation: Turm hinten, zwei parallele Holme, Trittstufe vorne. */
export const dip: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.3} y={-hd + d * 0.05} w={w * 0.6} h={d * 0.18} fill={shade} r={d * 0.02} />
      <Poly pts={[-w * 0.2, -hd + d * 0.26, -w * 0.2, hd - d * 0.24]} stroke={ink} sw={lw * 2.5} cap="round" />
      <Poly pts={[w * 0.2, -hd + d * 0.26, w * 0.2, hd - d * 0.24]} stroke={ink} sw={lw * 2.5} cap="round" />
      <Pad x={0} y={hd - d * 0.14} w={w * 0.4} h={d * 0.14} fill={light} />
    </>
  );
};

/** Schlitten (Sled / Strongman): zwei Kufen, Pfosten, Schubbügel. */
export const sled: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.06;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[-w * 0.3, -hd + d * 0.1, -w * 0.3, hd - d * 0.1]} stroke={ink} sw={lw * 2.5} cap="round" />
      <Poly pts={[w * 0.3, -hd + d * 0.1, w * 0.3, hd - d * 0.1]} stroke={ink} sw={lw * 2.5} cap="round" />
      <Box x={-w * 0.36} y={hd - d * 0.28} w={w * 0.72} h={d * 0.08} fill={shade} />
      <Circle x={-w * 0.3} y={-hd + d * 0.28} radius={r} fill={shade} listening={false} perfectDrawEnabled={false} />
      <Circle x={w * 0.3} y={-hd + d * 0.28} radius={r} fill={shade} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Langhantelständer: Reihe senkrecht stehender Stangen. */
export const barbellRack: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hw = w / 2;
  const n = clampInt(w / 22, 2, 30);
  const step = (w * 0.86) / n;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw + w * 0.05} y={-d * 0.08} w={w * 0.9} h={d * 0.16} fill={shade} />
      <Bars axis="x" from={-hw + w * 0.07 + step * 0.5} to={hw - w * 0.05} at={0} thickness={d * 0.7} step={step} bar={Math.max(lw * 2, Math.min(step * 0.35, 5))} color={ink} />
    </>
  );
};

/** Scheibenbaum: Pfosten mit gestapelten Scheiben (Ringe). */
export const plateTree: SymbolRenderer = (p) => {
  const { w, d, def, fill, stroke, sw, lw, ink, shade } = p;
  const r = Math.min(w, d) * 0.46;
  const round = def?.form === 'kreis';
  return (
    <>
      {round ? <Disc r={w / 2} fill={fill} stroke={stroke} sw={sw} /> : <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />}
      <Circle radius={r} stroke={ink} strokeWidth={lw * 1.5} listening={false} perfectDrawEnabled={false} />
      <Circle radius={r * 0.68} stroke={ink} strokeWidth={lw * 1.5} listening={false} perfectDrawEnabled={false} />
      <Circle radius={r * 0.22} fill={shade} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Kurzhantelpaar am Boden (zwei Hanteln nebeneinander). */
export const dumbbells: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hd = d / 2;
  const items = [-w * 0.25, w * 0.25].flatMap((cx) => [
    <Line key={`h${cx}`} points={[cx, -hd + d * 0.14, cx, hd - d * 0.14]} stroke={ink} strokeWidth={lw * 2} listening={false} perfectDrawEnabled={false} />,
    <Box key={`a${cx}`} x={cx - w * 0.12} y={-hd + d * 0.08} w={w * 0.24} h={d * 0.18} fill={shade} r={w * 0.02} />,
    <Box key={`b${cx}`} x={cx - w * 0.12} y={hd - d * 0.26} w={w * 0.24} h={d * 0.18} fill={shade} r={w * 0.02} />,
  ]);
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      {items}
    </>
  );
};

/** Langhantel mit Scheiben, entlang der längeren Seite. */
export const barbell: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const alongX = w >= d;
  const L = alongX ? w : d; // Länge
  const T = alongX ? d : w; // Dicke
  const hl = L / 2;
  const ht = T / 2;
  // Koordinaten im „Hantel-System“ (u entlang der Stange, v quer) → lokal
  const P = (u: number, v: number) => (alongX ? [u, v] : [v, u]);
  const plate = (u0: number, len: number, key: string) => {
    const a = P(u0, -ht + T * 0.08);
    const b = P(u0 + len, ht - T * 0.08);
    return <Box key={key} x={Math.min(a[0], b[0])} y={Math.min(a[1], b[1])} w={Math.abs(b[0] - a[0])} h={Math.abs(b[1] - a[1])} fill={shade} r={T * 0.04} />;
  };
  const bar = [...P(-hl + L * 0.02, 0), ...P(hl - L * 0.02, 0)];
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={bar} stroke={ink} sw={lw * 2} cap="round" />
      {plate(-hl + L * 0.06, L * 0.08, 'l1')}
      {plate(-hl + L * 0.16, L * 0.05, 'l2')}
      {plate(hl - L * 0.14, L * 0.08, 'r1')}
      {plate(hl - L * 0.21, L * 0.05, 'r2')}
    </>
  );
};
