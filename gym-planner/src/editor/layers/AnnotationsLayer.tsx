/**
 * Ebene „Anmerkungen“: Textnotizen (Konva-Text mit Schriftgröße in Welt-cm, Drehung, Farbe), Messlinien
 * (Linie mit Endstrichen und Längentext in der Mitte, bildschirm-konstant, dezent orange) und Fluchtwege
 * (grüne Polylinie mit Pfeilspitzen je Segment in Laufrichtung, Startpunkt-Marker und Label „Name · Länge“ am Ende;
 * rot, wenn die Regularien-Prüfung für den Fluchtweg „nicht erfüllt“ meldet).
 * Versteckte Anmerkungen werden nicht gezeichnet, gewählte hervorgehoben. Nicht klickbar (hitTest übernimmt).
 */
import { memo, useMemo, type ReactNode } from 'react';
import { Arrow, Circle, Group, Line, Rect, Text } from 'react-konva';
import type { EscapeRoute, MeasureLine, TextNote } from '@/types';
import type { LayerProps } from './LayerProps';
import { distance } from '@/geometry/polygon';
import { formatLength } from '@/geometry/units';
import { polylineLength } from '@/geometry/escapeRoutes';
import { regulations, type RegulationStatus } from '@/analysis/regulations';
import { readableAngle } from './OpeningsLayer';

const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

interface Palette {
  text: string;
  measure: string;
  escape: string;
  escapeFail: string;
  accent: string;
  accentSoft: string;
  labelBg: string;
  halo: string;
}
/** Token-Farben (hell/dunkel) – entsprechen --gp-ok / --gp-danger / --gp-accent in index.css. */
function palette(dark: boolean): Palette {
  return dark
    ? { text: '#e2e8f0', measure: '#fb923c', escape: '#4ade80', escapeFail: '#f87171', accent: '#60a5fa', accentSoft: 'rgba(96,165,250,0.16)', labelBg: 'rgba(15,23,42,0.72)', halo: 'rgba(15,23,42,0.55)' }
    : { text: '#0f172a', measure: '#ea580c', escape: '#16a34a', escapeFail: '#dc2626', accent: '#2563eb', accentSoft: 'rgba(37,99,235,0.12)', labelBg: 'rgba(255,255,255,0.78)', halo: 'rgba(255,255,255,0.7)' };
}

/** Geschätzte Textbox wie in hitTest/actions (Breite ≈ Zeichen × Schriftgröße × 0,6). */
function noteBox(a: TextNote): { w: number; h: number } {
  const first = a.text.split('\n').reduce((m, l) => Math.max(m, l.length), 0);
  return { w: Math.max(60, first * a.fontSize * 0.6), h: a.fontSize * 1.4 };
}

const TextNoteNode = memo(function TextNoteNode({ a, pal, s, selected }: { a: TextNote; pal: Palette; s: number; selected: boolean }) {
  const box = noteBox(a);
  return (
    <Group x={a.x} y={a.y} rotation={a.rotation} listening={false}>
      {selected && <Rect x={-2 * s} y={-2 * s} width={box.w + 4 * s} height={box.h + 4 * s} fill={pal.accentSoft} cornerRadius={2 * s} listening={false} />}
      <Text text={a.text} fontSize={a.fontSize} fontFamily={FONT} lineHeight={1.2} fill={a.color ?? pal.text} listening={false} />
    </Group>
  );
});

const MeasureNode = memo(function MeasureNode({ a, pal, s, selected }: { a: MeasureLine; pal: Palette; s: number; selected: boolean }) {
  const len = distance(a.start, a.end);
  const color = selected ? pal.accent : pal.measure;
  const width = (selected ? 2 : 1.5) * s;
  if (len < 1e-6) return null;
  const dx = (a.end.x - a.start.x) / len;
  const dy = (a.end.y - a.start.y) / len;
  const tick = 6 * s;
  const nx = -dy * tick;
  const ny = dx * tick;
  const mid = { x: (a.start.x + a.end.x) / 2, y: (a.start.y + a.end.y) / 2 };
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const text = formatLength(len);
  const fontPx = 11;
  const fs = fontPx * s;
  const textW = (text.length * fontPx * 0.6 + 8) * s;
  const textH = (fontPx * 1.25 + 4) * s;
  return (
    <Group listening={false}>
      <Line points={[a.start.x, a.start.y, a.end.x, a.end.y]} stroke={color} strokeWidth={width} listening={false} />
      <Line points={[a.start.x + nx, a.start.y + ny, a.start.x - nx, a.start.y - ny]} stroke={color} strokeWidth={width} listening={false} />
      <Line points={[a.end.x + nx, a.end.y + ny, a.end.x - nx, a.end.y - ny]} stroke={color} strokeWidth={width} listening={false} />
      <Group x={mid.x} y={mid.y} rotation={readableAngle(angle)} listening={false}>
        <Rect x={-textW / 2} y={-textH - 3 * s} width={textW} height={textH} fill={pal.labelBg} cornerRadius={2 * s} listening={false} />
        <Text x={-textW / 2} y={-textH - 3 * s + 2 * s} width={textW} text={text} fontSize={fs} fontFamily={FONT} fill={color} align="center" listening={false} />
      </Group>
    </Group>
  );
});

/** Name eines Fluchtwegs für Label/Panel („Fluchtweg n“ als Ersatz, n = Position unter den Fluchtwegen). */
export function escapeRouteName(a: EscapeRoute, index: number): string {
  return a.label?.trim() || `Fluchtweg ${index + 1}`;
}

/**
 * Fluchtweg: Polylinie mit Pfeilspitze je Segment in Laufrichtung, Startpunkt-Marker und Label „Name · Länge“ am
 * Endpunkt. Grün (Token ok), rot bei „nicht erfüllt“, Akzentfarbe bei Auswahl.
 */
export const EscapeRouteNode = memo(function EscapeRouteNode({ a, name, status, pal, s, selected }: { a: EscapeRoute; name: string; status: RegulationStatus; pal: Palette; s: number; selected: boolean }) {
  if (a.points.length < 2) return null;
  const base = status === 'fail' ? pal.escapeFail : pal.escape;
  const color = selected ? pal.accent : base;
  const width = (selected ? 3.5 : 3) * s;
  const pts: number[] = [];
  for (const p of a.points) pts.push(p.x, p.y);
  const segments: ReactNode[] = [];
  for (let i = 0; i + 1 < a.points.length; i++) {
    const p = a.points[i];
    const q = a.points[i + 1];
    if (distance(p, q) < 1e-6) continue;
    segments.push(<Arrow key={i} points={[p.x, p.y, q.x, q.y]} stroke={color} fill={color} strokeWidth={width} pointerLength={12 * s} pointerWidth={11 * s} lineCap="round" lineJoin="round" listening={false} />);
  }
  const start = a.points[0];
  const end = a.points[a.points.length - 1];
  const prev = a.points[a.points.length - 2];
  const text = `${name} · ${formatLength(polylineLength(a.points))}`;
  const fontPx = 11;
  const fs = fontPx * s;
  const textW = (text.length * fontPx * 0.6 + 10) * s;
  const textH = (fontPx * 1.25 + 5) * s;
  // Label auf der Seite des Endpunkts, gegen die Laufrichtung des letzten Segments verschoben und gedreht
  const angle = (Math.atan2(end.y - prev.y, end.x - prev.x) * 180) / Math.PI;
  return (
    <Group listening={false}>
      <Line points={pts} stroke={pal.halo} strokeWidth={width + 6 * s} lineCap="round" lineJoin="round" listening={false} />
      {segments}
      <Circle x={start.x} y={start.y} radius={5 * s} fill={color} stroke={pal.halo} strokeWidth={2 * s} listening={false} />
      <Group x={end.x} y={end.y} rotation={readableAngle(angle)} listening={false}>
        <Rect x={-textW / 2} y={-textH - 9 * s} width={textW} height={textH} fill={pal.labelBg} stroke={color} strokeWidth={1 * s} cornerRadius={3 * s} listening={false} />
        <Text x={-textW / 2} y={-textH - 9 * s + 2.5 * s} width={textW} text={text} fontSize={fs} fontFamily={FONT} fontStyle="600" fill={color} align="center" listening={false} />
      </Group>
    </Group>
  );
});

export const AnnotationsLayer = memo(function AnnotationsLayer(props: LayerProps) {
  const { floor, viewport, selection, dark } = props;
  const s = 1 / viewport.scale;
  const pal = useMemo(() => palette(dark), [dark]);
  const selectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const x of selection) if (x.kind === 'annotation') set.add(x.id);
    return set;
  }, [selection]);
  const hasRoutes = floor.annotations.some((a) => a.kind === 'escape-route' && !a.hidden);
  const routeStatus = useMemo(() => (hasRoutes ? regulations(props.project).routes : {}), [props.project, hasRoutes]);
  const nodes: ReactNode[] = [];
  let routeIndex = 0;
  for (const a of floor.annotations) {
    if (a.kind === 'escape-route') routeIndex += 1;
    if (a.hidden) continue;
    if (a.kind === 'text') nodes.push(<TextNoteNode key={a.id} a={a} pal={pal} s={s} selected={selectedIds.has(a.id)} />);
    else if (a.kind === 'measure') nodes.push(<MeasureNode key={a.id} a={a} pal={pal} s={s} selected={selectedIds.has(a.id)} />);
    else nodes.push(<EscapeRouteNode key={a.id} a={a} name={escapeRouteName(a, routeIndex - 1)} status={routeStatus[a.id] ?? 'na'} pal={pal} s={s} selected={selectedIds.has(a.id)} />);
  }
  return <Group listening={false}>{nodes}</Group>;
});
