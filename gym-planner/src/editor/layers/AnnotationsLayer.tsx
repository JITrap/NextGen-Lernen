/**
 * Ebene „Anmerkungen“: Textnotizen (Konva-Text mit Schriftgröße in Welt-cm, Drehung, Farbe) und Messlinien
 * (Linie mit Endstrichen und Längentext in der Mitte, bildschirm-konstant, dezent orange).
 * Versteckte Anmerkungen werden nicht gezeichnet, gewählte hervorgehoben. Nicht klickbar (hitTest übernimmt).
 */
import { memo, useMemo, type ReactNode } from 'react';
import { Group, Line, Rect, Text } from 'react-konva';
import type { MeasureLine, TextNote } from '@/types';
import type { LayerProps } from './LayerProps';
import { distance } from '@/geometry/polygon';
import { formatLength } from '@/geometry/units';
import { readableAngle } from './OpeningsLayer';

const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

interface Palette {
  text: string;
  measure: string;
  accent: string;
  accentSoft: string;
  labelBg: string;
}
function palette(dark: boolean): Palette {
  return dark
    ? { text: '#e2e8f0', measure: '#fb923c', accent: '#60a5fa', accentSoft: 'rgba(96,165,250,0.16)', labelBg: 'rgba(15,23,42,0.72)' }
    : { text: '#0f172a', measure: '#ea580c', accent: '#2563eb', accentSoft: 'rgba(37,99,235,0.12)', labelBg: 'rgba(255,255,255,0.78)' };
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

export const AnnotationsLayer = memo(function AnnotationsLayer(props: LayerProps) {
  const { floor, viewport, selection, dark } = props;
  const s = 1 / viewport.scale;
  const pal = useMemo(() => palette(dark), [dark]);
  const selectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const x of selection) if (x.kind === 'annotation') set.add(x.id);
    return set;
  }, [selection]);
  const nodes: ReactNode[] = [];
  for (const a of floor.annotations) {
    if (a.hidden) continue;
    if (a.kind === 'text') nodes.push(<TextNoteNode key={a.id} a={a} pal={pal} s={s} selected={selectedIds.has(a.id)} />);
    else nodes.push(<MeasureNode key={a.id} a={a} pal={pal} s={s} selected={selectedIds.has(a.id)} />);
  }
  return <Group listening={false}>{nodes}</Group>;
});
