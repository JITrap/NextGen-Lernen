/**
 * Ebene „Halle“: Bodenfläche (Innenpolygon) mit dezenter Bodenbelag-Andeutung, Außenwandring,
 * Eckpunkte und ein kleines Maß-/Flächenlabel. Ohne Halle: Hinweistext in der Bildschirmmitte.
 * Alles listening={false} – Treffer bestimmt hitTest.ts.
 */
import { memo, useMemo } from 'react';
import { Group, Line, Circle, Text, Shape } from 'react-konva';
import type Konva from 'konva';
import type { Vec2, FloorCovering } from '@/types';
import type { LayerProps } from './LayerProps';
import { useUiStore } from '@/store/uiStore';
import { getStage } from '../stageRegistry';
import { hallInnerPolygon, hallOuterPolygon } from '@/geometry/walls';
import { bbox, flatten, polygonAreaM2 } from '@/geometry/polygon';
import { formatM, formatM2 } from '@/geometry/units';

/**
 * Abstand (px) der Hallen-Zusammenfassung über der Außenkante: außerhalb von Türmarkern/-maßen (reichen ≈ 20 px nach
 * außen), aber noch unterhalb der Maßlinie der Außenkanten (40 px), damit das Label nach „Einpassen“ sichtbar bleibt.
 */
export const HALL_LABEL_LIFT_PX = 34;

/* ------------------------------------------------------------------ */
/* Farben & Bodenbelag                                                 */
/* ------------------------------------------------------------------ */

type FloorPattern = 'none' | 'stripes' | 'grid' | 'dots';

interface FloorStyle {
  fill: string;
  pattern: FloorPattern;
  /** Abstand der Musterlinien in cm. */
  step: number;
  line: string;
}

/** Bodenfarbe + Muster je Belag (dezent, hell/dunkel). */
export function floorStyle(covering: FloorCovering, dark: boolean): FloorStyle {
  const line = dark ? 'rgba(226,232,240,0.07)' : 'rgba(15,23,42,0.07)';
  const c = String(covering).toLowerCase();
  if (c.includes('kunstrasen')) return { fill: dark ? '#17291f' : '#eaf6e4', pattern: 'dots', step: 40, line: dark ? 'rgba(134,239,172,0.12)' : 'rgba(22,101,52,0.12)' };
  if (c.includes('parkett') || c.includes('holz')) return { fill: dark ? '#25211b' : '#fbf4e8', pattern: 'stripes', step: 20, line: dark ? 'rgba(251,191,36,0.10)' : 'rgba(120,53,15,0.10)' };
  if (c.includes('fliese')) return { fill: dark ? '#18223a' : '#f7f9fc', pattern: 'grid', step: 60, line: dark ? 'rgba(148,163,184,0.14)' : 'rgba(71,85,105,0.12)' };
  if (c.includes('beton') || c.includes('epoxid')) return { fill: dark ? '#1a2130' : '#f1f3f5', pattern: 'none', step: 0, line };
  if (c.includes('teppich')) return { fill: dark ? '#231d2b' : '#f7f1f7', pattern: 'none', step: 0, line };
  if (c.includes('kautschuk') || c.includes('vinyl') || c.includes('pvc')) return { fill: dark ? '#172033' : '#fbfbfd', pattern: 'none', step: 0, line };
  // Gummiboden & Unbekanntes: Grundfarbe (entspricht --gp-hall)
  return { fill: dark ? '#162032' : '#ffffff', pattern: 'none', step: 0, line };
}

function tracePolygon(ctx: Konva.Context, poly: Vec2[]) {
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Komponenten                                                         */
/* ------------------------------------------------------------------ */

/** Boden: Innenpolygon gefüllt + Muster (im Polygon geclippt), ein einziger Konva-Shape. */
const FloorShape = memo(function FloorShape({ inner, style, s }: { inner: Vec2[]; style: FloorStyle; s: number }) {
  const b = useMemo(() => bbox(inner), [inner]);
  // Muster nur zeichnen, wenn es auf dem Bildschirm sichtbar ist (Linienabstand ≥ 4 px) und nicht zu viele Linien ergibt.
  const stepPx = style.step / s;
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const cols = style.step > 0 ? w / style.step : 0;
  const rows = style.step > 0 ? h / style.step : 0;
  const seams = stepPx >= 12 ? rows * (w / (style.step * 6)) : 0;
  const estimate = style.pattern === 'dots' ? cols * rows : style.pattern === 'grid' ? cols + rows : style.pattern === 'stripes' ? rows + seams : 0;
  const drawPattern = style.pattern !== 'none' && stepPx >= 4 && estimate <= 3000;
  return (
    <Shape
      listening={false}
      sceneFunc={(ctx) => {
        tracePolygon(ctx, inner);
        ctx.setAttr('fillStyle', style.fill);
        ctx.fill();
        if (!drawPattern) return;
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        const step = style.step;
        const x0 = Math.floor(b.minX / step) * step;
        const y0 = Math.floor(b.minY / step) * step;
        if (style.pattern === 'stripes') {
          let row = 0;
          for (let y = y0; y <= b.maxY; y += step, row++) {
            ctx.moveTo(b.minX, y);
            ctx.lineTo(b.maxX, y);
            // Versetzte Stoßfugen (Dielen), nur bei ausreichender Vergrößerung
            if (stepPx >= 12) {
              const plank = step * 6;
              const offset = (row % 2) * (plank / 2);
              for (let x = x0 + offset; x <= b.maxX; x += plank) {
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + step);
              }
            }
          }
        } else if (style.pattern === 'grid') {
          for (let x = x0; x <= b.maxX; x += step) {
            ctx.moveTo(x, b.minY);
            ctx.lineTo(x, b.maxY);
          }
          for (let y = y0; y <= b.maxY; y += step) {
            ctx.moveTo(b.minX, y);
            ctx.lineTo(b.maxX, y);
          }
        } else if (style.pattern === 'dots') {
          const r = Math.max(0.6 * s, step * 0.04);
          for (let x = x0; x <= b.maxX; x += step) {
            for (let y = y0; y <= b.maxY; y += step) {
              ctx.moveTo(x + r, y);
              ctx.arc(x, y, r, 0, Math.PI * 2, false);
            }
          }
        }
        if (style.pattern === 'dots') {
          ctx.setAttr('fillStyle', style.line);
          ctx.fill();
        } else {
          ctx.setAttr('strokeStyle', style.line);
          ctx.setAttr('lineWidth', 1 * s);
          ctx.stroke();
        }
        ctx.restore();
      }}
    />
  );
});

/** Hinweis in der Bildschirmmitte, wenn noch keine Halle existiert. */
function EmptyHint({ viewport, dark }: { viewport: LayerProps['viewport']; dark: boolean }) {
  const stage = getStage();
  const width = stage?.width() ?? 800;
  const height = stage?.height() ?? 600;
  const s = 1 / viewport.scale;
  const cx = (width / 2 - viewport.x) * s;
  const cy = (height / 2 - viewport.y) * s;
  const boxW = Math.min(width - 32, 560) * s;
  const color = dark ? '#94a3b8' : '#64748b';
  return (
    <Group listening={false}>
      <Text x={cx - boxW / 2} y={cy - 26 * s} width={boxW} align="center" text="Noch keine Halle" fontSize={17 * s} fontStyle="bold" fill={dark ? '#cbd5e1' : '#334155'} fontFamily="Inter, system-ui, sans-serif" />
      <Text
        x={cx - boxW / 2}
        y={cy}
        width={boxW}
        align="center"
        text="Halle anlegen: Werkzeug ‚Halle‘ (H) – Rechteck aufziehen oder Polygon zeichnen"
        fontSize={13 * s}
        lineHeight={1.3}
        fill={color}
        fontFamily="Inter, system-ui, sans-serif"
      />
    </Group>
  );
}

export const HallLayer = memo(function HallLayer(props: LayerProps) {
  const { floor, viewport, dark, presentation } = props;
  const hall = floor.hall;
  const tool = useUiStore((st) => st.tool);
  const s = 1 / viewport.scale;

  const geo = useMemo(() => {
    if (!hall || hall.polygon.length < 3) return null;
    const outer = hallOuterPolygon(hall);
    const inner = hallInnerPolygon(hall);
    const b = bbox(outer);
    const axisAligned = outer.length === 4 && outer.every((p) => (Math.abs(p.x - b.minX) < 1e-6 || Math.abs(p.x - b.maxX) < 1e-6) && (Math.abs(p.y - b.minY) < 1e-6 || Math.abs(p.y - b.maxY) < 1e-6));
    return { outer, inner, b, axisAligned, areaM2: polygonAreaM2(outer) };
  }, [hall]);
  const style = useMemo(() => floorStyle(hall?.floorCovering ?? 'Gummiboden', dark), [hall?.floorCovering, dark]);

  if (!geo) {
    // Während die Hallenwerkzeuge aktiv sind, zeichnet deren Overlay – Hinweis ausblenden.
    if (tool === 'hall-rect' || tool === 'hall-polygon') return <Group />;
    return <EmptyHint viewport={viewport} dark={dark} />;
  }
  const { outer, inner, b } = geo;
  const wallFill = dark ? '#cbd5e1' : '#334155';
  const edge = dark ? '#94a3b8' : '#1e293b';
  const label = geo.axisAligned ? `Halle · ${formatM(b.maxX - b.minX)} × ${formatM(b.maxY - b.minY)} · ${formatM2(geo.areaM2)}` : `Halle · ${formatM2(geo.areaM2)}`;
  return (
    <Group listening={false}>
      {/* Außenwandring: Außenpolygon in Wandfarbe, darüber der Boden (Innenpolygon) */}
      <Line points={flatten(outer)} closed fill={wallFill} />
      {inner.length >= 3 ? <FloorShape inner={inner} style={style} s={s} /> : null}
      <Line points={flatten(outer)} closed stroke={edge} strokeWidth={1 * s} opacity={0.9} />
      {inner.length >= 3 && <Line points={flatten(inner)} closed stroke={edge} strokeWidth={0.75 * s} opacity={0.6} />}
      {!presentation && outer.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={2.5 * s} fill={dark ? '#0f172a' : '#ffffff'} stroke={edge} strokeWidth={1 * s} />)}
      <Text x={b.minX + 2 * s} y={b.minY - HALL_LABEL_LIFT_PX * s} text={label} fontSize={11 * s} fill={dark ? '#94a3b8' : '#64748b'} fontFamily="Inter, system-ui, sans-serif" />
    </Group>
  );
});
