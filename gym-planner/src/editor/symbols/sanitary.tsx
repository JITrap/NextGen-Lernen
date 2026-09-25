/**
 * Draufsicht-Symbole: Umkleide und Sanitär (Spinde, Bänke, Duschen, WC, Waschtisch …).
 */
import { Circle, Ellipse } from 'react-konva';
import { Body, Box, Bars, Dots, Pad, Poly, Disc, clampInt, lockerColumns, lockerTiers, numParam, type SymbolRenderer } from './common';

/** Einzelspind: Tür vorne mit Griff, Scharnierseite links. */
export const locker: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw + lw} y={hd - d * 0.14} w={w - 2 * lw} h={d * 0.1} fill={shade} />
      <Circle x={hw - w * 0.22} y={hd - d * 0.09} radius={Math.max(lw * 1.5, Math.min(w, d) * 0.05)} fill={ink} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/**
 * Spindreihe: Abteile (Spalten = Fächer ÷ Stöcke, sonst Breite / Abteilbreite) mit Trennwänden und Griffen;
 * bei mehrstöckigen Reihen eine Griffreihe je Stock (hintereinander gestaffelt) als Hinweis auf die Stapelung.
 */
export const lockerRow: SymbolRenderer = (p) => {
  const { w, d, item, def, fill, stroke, sw, lw, ink, shade } = p;
  const hw = w / 2;
  const hd = d / 2;
  const n = lockerColumns(item, def);
  const tiers = lockerTiers(item, def);
  const comp = w / n;
  const dot = Math.max(lw * 2.5, Math.min(comp * 0.25, d * 0.12));
  const rows: number[] = [];
  for (let t = 0; t < tiers; t++) rows.push(hd - d * 0.18 - t * Math.max(dot * 1.6, d * 0.14));
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw} y={-hd} w={w} h={d * 0.06} fill={shade} />
      {n > 1 && <Bars axis="x" from={-hw + comp} to={hw - comp * 0.5} at={0} thickness={d} step={comp} bar={lw * 1.2} color={ink} offset={lw * 0.6} />}
      {rows.map((y, i) => <Dots key={i} axis="x" from={-hw + comp / 2} to={hw} at={y} step={comp} size={i === 0 ? dot : dot * 0.7} color={ink} />)}
    </>
  );
};

/** Umkleidebank: Latten entlang der Länge, zwei Füße. */
export const benchSeat: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, light, shade } = p;
  const hw = w / 2;
  const slats = clampInt(d / 12, 2, 8);
  const step = (d * 0.84) / slats;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Bars axis="y" from={-d * 0.42 + step * 0.2} to={d * 0.42} at={0} thickness={w * 0.92} step={step} bar={step * 0.6} color={light} />
      <Box x={-hw + w * 0.08} y={-d * 0.46} w={w * 0.04} h={d * 0.92} fill={shade} />
      <Box x={hw - w * 0.12} y={-d * 0.46} w={w * 0.04} h={d * 0.92} fill={shade} />
    </>
  );
};

/** Spiegel (freistehend/Wandspiegel): Spiegelfläche mit Schraffur. */
export const mirror: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light } = p;
  const hw = w / 2;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[-hw + lw, hd - d * 0.3, hw - lw, hd - d * 0.3]} stroke={light} sw={Math.max(lw * 2, d * 0.25)} />
      <Poly pts={[-hw + w * 0.05, -hd + d * 0.25, hw - w * 0.05, -hd + d * 0.25]} stroke={ink} sw={lw} dash={[lw * 3, lw * 3]} />
    </>
  );
};

/** Föhnplatz: Ablage, Spiegellinie hinten, Föhn. */
export const hairdryer: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[-w * 0.45, -hd + lw * 1.5, w * 0.45, -hd + lw * 1.5]} stroke={ink} sw={lw * 2} />
      <Pad x={0} y={d * 0.05} w={w * 0.86} h={d * 0.6} fill={light} r={Math.min(w, d) * 0.05} />
      <Circle x={w * 0.28} y={-hd + d * 0.32} radius={Math.min(w, d) * 0.11} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Waschtisch: Becken (Ellipse) mit Armatur hinten. */
export const sink: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Ellipse x={0} y={d * 0.06} radiusX={w * 0.32} radiusY={d * 0.28} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Circle x={0} y={-hd + d * 0.16} radius={Math.min(w, d) * 0.06} fill={shade} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Einzelkabine: Sitzbank hinten, Vorhang vorne (gestrichelt). */
export const cabin: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light } = p;
  const hw = w / 2;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-hw + w * 0.08} y={-hd + d * 0.08} w={w * 0.84} h={d * 0.24} fill={light} r={w * 0.02} />
      <Poly pts={[-hw + lw, hd - lw * 2, hw - lw, hd - lw * 2]} stroke={ink} sw={lw * 1.5} dash={[lw * 3, lw * 2]} />
    </>
  );
};

/** Dusche: Quadrat mit Abfluss-Kreis (Kreuz) und Brausekopf hinten. */
export const shower: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.09;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Circle x={0} y={d * 0.08} radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Poly pts={[-r * 0.7, d * 0.08, r * 0.7, d * 0.08, 0, d * 0.08, 0, d * 0.08 - r * 0.7, 0, d * 0.08 + r * 0.7]} stroke={ink} sw={lw} />
      <Circle x={0} y={-hd + d * 0.12} radius={Math.min(w, d) * 0.05} fill={shade} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Reihendusche: Duschplätze (params.plaetze, sonst Breite / 90 cm) mit Trennlinien und Abflüssen. */
export const showerRow: SymbolRenderer = (p) => {
  const { w, d, item, def, fill, stroke, sw, lw, ink } = p;
  const hw = w / 2;
  const raw = numParam(item, def, 'plaetze') ?? numParam(item, def, 'anzahl');
  const n = raw != null && raw >= 1 ? clampInt(raw, 1, 60) : clampInt(w / 90, 1, 60);
  const comp = w / n;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      {n > 1 && <Bars axis="x" from={-hw + comp} to={hw - comp * 0.5} at={0} thickness={d * 0.9} step={comp} bar={lw} color={ink} offset={lw * 0.5} />}
      <Dots axis="x" from={-hw + comp / 2} to={hw} at={d * 0.1} step={comp} size={Math.max(lw * 4, Math.min(comp * 0.16, d * 0.16))} color={ink} />
    </>
  );
};

/** Duschtrennwand: dünne Wand mit Schraffur. */
export const partition: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink } = p;
  const hw = w / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Poly pts={[-hw + lw, 0, hw - lw, 0]} stroke={ink} sw={lw} dash={[lw * 3, lw * 3]} />
    </>
  );
};

/** WC: Spülkasten hinten, Schüssel (Ellipse) mit Brille. */
export const toilet: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.4} y={-hd + d * 0.05} w={w * 0.8} h={d * 0.2} fill={shade} r={w * 0.03} />
      <Ellipse x={0} y={d * 0.14} radiusX={w * 0.3} radiusY={d * 0.3} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Ellipse x={0} y={d * 0.14} radiusX={w * 0.19} radiusY={d * 0.2} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Urinal: Becken (Ellipse) mit Spülung hinten. */
export const urinal: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light, shade } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      <Box x={-w * 0.2} y={-hd + d * 0.04} w={w * 0.4} h={d * 0.12} fill={shade} r={w * 0.03} />
      <Ellipse x={0} y={d * 0.12} radiusX={w * 0.32} radiusY={d * 0.3} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
    </>
  );
};

/** Wickeltisch: Auflage mit Seitenschutz. */
export const changingTable: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light } = p;
  const hw = w / 2;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.05} />
      <Pad x={0} y={0} w={w * 0.86} h={d * 0.7} fill={light} r={Math.min(w, d) * 0.08} />
      <Poly pts={[-hw + w * 0.05, -hd + d * 0.08, hw - w * 0.05, -hd + d * 0.08]} stroke={ink} sw={lw * 2} cap="round" />
      <Poly pts={[-hw + w * 0.05, hd - d * 0.08, hw - w * 0.05, hd - d * 0.08]} stroke={ink} sw={lw * 2} cap="round" />
    </>
  );
};

/** Spender (Handtuch/Seife): Gehäuse mit Ausgabeschlitz vorne. */
export const dispenser: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink, light } = p;
  const hd = d / 2;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.1} />
      <Pad x={0} y={-d * 0.1} w={w * 0.6} h={d * 0.4} fill={light} r={lw} />
      <Poly pts={[-w * 0.3, hd - d * 0.22, w * 0.3, hd - d * 0.22]} stroke={ink} sw={lw * 2} cap="round" />
    </>
  );
};

/** Wäschesammler: Korb mit Kreuzmuster. */
export const laundry: SymbolRenderer = (p) => {
  const { w, d, def, fill, stroke, sw, lw, ink, light } = p;
  const r = Math.min(w, d) * 0.38;
  const round = def?.form === 'kreis';
  return (
    <>
      {round ? <Disc r={w / 2} fill={fill} stroke={stroke} sw={sw} /> : <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} r={Math.min(w, d) * 0.12} />}
      <Circle radius={r} fill={light} stroke={ink} strokeWidth={lw} listening={false} perfectDrawEnabled={false} />
      <Poly pts={[-r * 0.5, -r * 0.5, r * 0.5, r * 0.5, 0, 0, r * 0.5, -r * 0.5, -r * 0.5, r * 0.5]} stroke={ink} sw={lw} />
    </>
  );
};

/** Wertfächer: Raster kleiner Fächer. */
export const valuables: SymbolRenderer = (p) => {
  const { w, d, fill, stroke, sw, lw, ink } = p;
  const hw = w / 2;
  const hd = d / 2;
  const cols = clampInt(w / 15, 1, 40);
  const rows = clampInt(d / 15, 1, 40);
  const cw = w / cols;
  const rh = d / rows;
  return (
    <>
      <Body w={w} d={d} fill={fill} stroke={stroke} sw={sw} />
      {cols > 1 && <Bars axis="x" from={-hw + cw} to={hw - cw * 0.5} at={0} thickness={d} step={cw} bar={lw} color={ink} offset={lw * 0.5} />}
      {rows > 1 && <Bars axis="y" from={-hd + rh} to={hd - rh * 0.5} at={0} thickness={w} step={rh} bar={lw} color={ink} offset={lw * 0.5} />}
    </>
  );
};
