/**
 * 3D-Darstellung platzierter Objekte: Boxen je Bereich, Säulen, Treppen (gerade/L/U/Wendel),
 * Aufzugschächte, Rampen, Sicherheitszonen und Beschriftungen.
 */
import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { EquipmentDef, PlacedItem } from '@/types';
import { rotateAround } from '@/geometry/polygon';
import { zoneIsEmpty } from '@/geometry/transform';
import { cm, rotationY } from './coords';
import { UNIT_BOX, UNIT_CYLINDER, UNIT_PLANE_XZ, material, rampGeometry, useDisposeGeometries } from './geometry';
import {
  ELEVATOR_COLOR, ELEVATOR_DOOR_COLOR, LANDING_COLOR, SAFETY_ZONE_COLOR, SAFETY_ZONE_OPACITY, STAIRS_COLOR,
} from './colors';
import {
  columnIsRound, itemColor, itemHeightCm, itemLabel, stairsTypeOf, stepCount, type VerticalSpan,
} from './items3d';

/** Wie eine Treppe auf diesem Stockwerk erscheint: voll (steigt hier auf) oder nur als Ankunftsfläche. */
export type StairsMode = 'full' | 'landing';

export interface ItemMeshProps {
  item: PlacedItem;
  def: EquipmentDef | undefined;
  /** Fußbodenoberkante, auf der das Objekt steht (m, absolut). */
  level: number;
  /** Lichte Deckenhöhe dieses Stockwerks (cm). */
  ceilingCm: number;
  selected: boolean;
  shadows: boolean;
  label: boolean;
  /** Treppen/Aufzüge: vertikale Ausdehnung. */
  span?: VerticalSpan;
  stairsMode?: StairsMode;
  onSelect: (item: PlacedItem, additive: boolean) => void;
}

const LABEL_STYLE: CSSProperties = {
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  fontSize: 11,
  lineHeight: '16px',
  padding: '1px 7px',
  borderRadius: 6,
  border: '1px solid var(--gp-border)',
  background: 'var(--gp-panel)',
  color: 'var(--gp-text)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
  userSelect: 'none',
};

/** HTML-Beschriftung über einem Objekt (konstante Bildschirmgröße). */
export function Label3D({ text, y, accent }: { text: string; y: number; accent?: boolean }) {
  return (
    <Html position={[0, y, 0]} center zIndexRange={[10, 0]} pointerEvents="none" style={{ pointerEvents: 'none' }}>
      <div style={accent ? { ...LABEL_STYLE, borderColor: 'var(--gp-accent)', fontWeight: 600 } : LABEL_STYLE}>{text}</div>
    </Html>
  );
}

function setCursor(e: ThreeEvent<PointerEvent>, cursor: string) {
  const el = e.nativeEvent.target as HTMLElement | null;
  if (el?.style) el.style.cursor = cursor;
}

/* ---------------- Treppen ---------------- */

interface Run {
  /** Startpunkt (lokal, m): x rechts, z = Plan-y (vorne = +z). */
  sx: number;
  sz: number;
  /** Laufrichtung (Einheitsvektor). */
  dx: number;
  dz: number;
  length: number;
  width: number;
  /** Höhe am Anfang / Ende (m, relativ zur Unterkante). */
  h0: number;
  h1: number;
  n: number;
}
interface Landing {
  cx: number;
  cz: number;
  w: number;
  d: number;
  h: number;
}

function runSteps(run: Run, key: string, mat: ReturnType<typeof material>, shadows: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  const n = Math.max(1, run.n);
  const sd = run.length / n;
  const phi = Math.atan2(run.dx, run.dz);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) * sd;
    const h = run.h0 + ((k + 1) * (run.h1 - run.h0)) / n;
    if (h <= 0.001) continue;
    out.push(
      <mesh
        key={`${key}_${k}`}
        geometry={UNIT_BOX}
        material={mat}
        position={[run.sx + run.dx * t, 0, run.sz + run.dz * t]}
        rotation={[0, phi, 0]}
        scale={[run.width, h, sd]}
        castShadow={shadows}
        receiveShadow={shadows}
      />,
    );
  }
  return out;
}

function splitSteps(total: number, lenA: number, lenB: number): [number, number] {
  const a = Math.max(1, Math.round((total * lenA) / Math.max(0.01, lenA + lenB)));
  return [a, Math.max(1, total - a)];
}

const StairsBody = memo(function StairsBody({ item, def, rise, selected, shadows }: { item: PlacedItem; def: EquipmentDef | undefined; rise: number; selected: boolean; shadows: boolean }) {
  const w = cm(item.width);
  const d = cm(item.depth);
  const type = stairsTypeOf(item, def);
  const mat = material({ color: STAIRS_COLOR, selected, roughness: 0.9 });
  const landingMat = material({ color: LANDING_COLOR, selected, roughness: 0.9 });

  const parts = useMemo<ReactNode[]>(() => {
    const nodes: ReactNode[] = [];
    if (type === 'Wendeltreppe') {
      const r = Math.max(0.3, Math.min(w, d) / 2);
      const n = stepCount(item, def, Math.PI * r * 100 * 1.5);
      const rs = rise / n;
      const tread = 0.05;
      const tangential = Math.max(0.22, ((2 * Math.PI * (r / 2)) / n) * 1.15);
      nodes.push(
        <mesh key="pole" geometry={UNIT_CYLINDER} material={mat} scale={[Math.max(0.08, r * 0.14), rise + 0.9, Math.max(0.08, r * 0.14)]} castShadow={shadows} />,
      );
      for (let k = 0; k < n; k++) {
        const theta = (-k * 2 * Math.PI) / n;
        const y = Math.max(0, (k + 1) * rs - tread);
        nodes.push(
          <mesh
            key={`s${k}`}
            geometry={UNIT_BOX}
            material={landingMat}
            position={[Math.cos(theta) * (r / 2), y, Math.sin(theta) * (r / 2)]}
            rotation={[0, -theta, 0]}
            scale={[r * 0.92, tread, tangential]}
            castShadow={shadows}
          />,
        );
      }
      return nodes;
    }
    const runs: Run[] = [];
    const landings: Landing[] = [];
    const rw = Math.max(0.5, Math.min(w, d) / 2);
    const canTurn = w - rw > 0.05 && d - rw > 0.05;
    if (type === 'L' && canTurn) {
      const lenA = d - rw;
      const lenB = w - rw;
      const [nA, nB] = splitSteps(stepCount(item, def, (lenA + lenB) * 100), lenA, lenB);
      const rs = rise / (nA + nB);
      const hMid = nA * rs;
      runs.push({ sx: w / 2 - rw / 2, sz: d / 2, dx: 0, dz: -1, length: lenA, width: rw, h0: 0, h1: hMid, n: nA });
      landings.push({ cx: w / 2 - rw / 2, cz: -d / 2 + rw / 2, w: rw, d: rw, h: hMid });
      runs.push({ sx: w / 2 - rw, sz: -d / 2 + rw / 2, dx: -1, dz: 0, length: lenB, width: rw, h0: hMid, h1: rise, n: nB });
    } else if (type === 'U' && canTurn) {
      const rwU = Math.max(0.5, Math.min(w / 2, d / 2));
      const len = d - rwU;
      const [nA, nB] = splitSteps(stepCount(item, def, len * 2 * 100), len, len);
      const rs = rise / (nA + nB);
      const hMid = nA * rs;
      runs.push({ sx: w / 2 - rwU / 2, sz: d / 2, dx: 0, dz: -1, length: len, width: rwU, h0: 0, h1: hMid, n: nA });
      landings.push({ cx: 0, cz: -d / 2 + rwU / 2, w, d: rwU, h: hMid });
      runs.push({ sx: -w / 2 + rwU / 2, sz: -d / 2 + rwU, dx: 0, dz: 1, length: len, width: rwU, h0: hMid, h1: rise, n: nB });
    } else {
      runs.push({ sx: 0, sz: d / 2, dx: 0, dz: -1, length: d, width: w, h0: 0, h1: rise, n: stepCount(item, def, item.depth) });
    }
    runs.forEach((r, i) => nodes.push(...runSteps(r, `r${i}`, mat, shadows)));
    landings.forEach((l, i) => nodes.push(
      <mesh key={`l${i}`} geometry={UNIT_BOX} material={landingMat} position={[l.cx, 0, l.cz]} scale={[l.w, Math.max(0.02, l.h), l.d]} castShadow={shadows} receiveShadow={shadows} />,
    ));
    return nodes;
  }, [item, def, w, d, type, rise, mat, landingMat, shadows]);

  return <>{parts}</>;
});

/* ---------------- Objekt ---------------- */

export const ItemMesh = memo(function ItemMesh(props: ItemMeshProps) {
  const { item, def, level, ceilingCm, selected, shadows, label, span, stairsMode, onSelect } = props;
  const w = cm(Math.max(1, item.width));
  const d = cm(Math.max(1, item.depth));
  const hCm = itemHeightCm(item, def, ceilingCm);
  const h = cm(hCm);
  const color = itemColor(item, def);
  const mat = material({ color, selected, roughness: 0.8 });

  const rampGeo = useMemo(() => (item.kind === 'ramp' ? rampGeometry(w, d, h) : null), [item.kind, w, d, h]);
  useDisposeGeometries(useMemo(() => (rampGeo ? [rampGeo] : []), [rampGeo]));

  let body: ReactNode;
  let labelY = h;
  switch (item.kind) {
    case 'column': {
      const round = columnIsRound(item, def);
      const dia = Math.min(w, d);
      body = round
        ? <mesh geometry={UNIT_CYLINDER} material={mat} scale={[dia, h, dia]} castShadow={shadows} receiveShadow={shadows} />
        : <mesh geometry={UNIT_BOX} material={mat} scale={[w, h, d]} castShadow={shadows} receiveShadow={shadows} />;
      break;
    }
    case 'elevator': {
      const bottom = span ? span.bottom - level : 0;
      const height = span ? Math.max(0.5, span.top - span.bottom) : h;
      const shaft = material({ color: ELEVATOR_COLOR, selected, roughness: 0.6, metalness: 0.2 });
      const door = material({ color: ELEVATOR_DOOR_COLOR, selected, roughness: 0.4, metalness: 0.5 });
      const doorLevels = span ? span.floors.map((f) => f.level - level) : [0];
      body = (
        <group position={[0, bottom, 0]}>
          <mesh geometry={UNIT_BOX} material={shaft} scale={[w, height, d]} castShadow={shadows} receiveShadow={shadows} />
          {doorLevels.map((y, i) => (
            <mesh key={i} geometry={UNIT_BOX} material={door} position={[0, y - bottom + 0.01, d / 2 + 0.015]} scale={[Math.max(0.6, w * 0.6), Math.min(2.1, height - 0.05), 0.03]} />
          ))}
        </group>
      );
      labelY = bottom + height;
      break;
    }
    case 'stairs': {
      if (stairsMode === 'landing' || !span) {
        const plate = material({ color: LANDING_COLOR, selected, opacity: 0.55, depthWrite: false });
        body = <mesh geometry={UNIT_BOX} material={plate} position={[0, 0.005, 0]} scale={[w, 0.02, d]} />;
        labelY = 0.1;
      } else {
        const bottom = span.bottom - level;
        const rise = Math.max(0.2, span.top - span.bottom);
        body = (
          <group position={[0, bottom, 0]}>
            <StairsBody item={item} def={def} rise={rise} selected={selected} shadows={shadows} />
          </group>
        );
        labelY = bottom + rise;
      }
      break;
    }
    case 'vent': {
      const y = Math.max(0, cm(ceilingCm) - h);
      body = <mesh geometry={UNIT_BOX} material={mat} position={[0, y, 0]} scale={[w, h, d]} />;
      labelY = y + h;
      break;
    }
    case 'ramp': {
      body = rampGeo ? <mesh geometry={rampGeo} material={mat} castShadow={shadows} receiveShadow={shadows} /> : null;
      break;
    }
    default:
      body = <mesh geometry={UNIT_BOX} material={mat} scale={[w, h, d]} castShadow={shadows} receiveShadow={shadows} />;
  }

  return (
    <group
      position={[cm(item.x), level, cm(item.y)]}
      rotation={[0, rotationY(item.rotation), 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(item, e.nativeEvent.shiftKey); }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setCursor(e, 'pointer'); }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => setCursor(e, '')}
    >
      {body}
      {(label || selected) && <Label3D text={itemLabel(item, def)} y={labelY + 0.25} accent={selected} />}
    </group>
  );
});

/* ---------------- Sicherheitszonen ---------------- */

export const SafetyZoneMesh = memo(function SafetyZoneMesh({ item, level }: { item: PlacedItem; level: number }) {
  const z = item.safetyZone;
  if (!item.safetyZoneEnabled || zoneIsEmpty(z)) return null;
  const w = item.width + z.links + z.rechts;
  const d = item.depth + z.vorne + z.hinten;
  const dx = (z.rechts - z.links) / 2;
  const dy = (z.vorne - z.hinten) / 2;
  const c = rotateAround({ x: item.x + dx, y: item.y + dy }, { x: item.x, y: item.y }, item.rotation);
  const mat = material({ color: SAFETY_ZONE_COLOR, opacity: SAFETY_ZONE_OPACITY, depthWrite: false, doubleSide: true, polygonOffset: true });
  return (
    <mesh geometry={UNIT_PLANE_XZ} material={mat} position={[cm(c.x), level + 0.01, cm(c.y)]} rotation={[0, rotationY(item.rotation), 0]} scale={[cm(w), 1, cm(d)]} />
  );
});
