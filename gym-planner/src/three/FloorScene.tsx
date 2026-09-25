/**
 * Ein Stockwerk in 3D: Bodenplatte (mit Lufträumen als Löcher), Außen-/Innenwände (segmentiert um Öffnungen),
 * Türen/Fenster/Spiegel, Raumflächen, Objekte, Sicherheitszonen, Beschriftungen, optionale Decke.
 */
import { memo, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { Door, EquipmentDef, Floor, LayerVisibility, Mirror, Opening, PlacedItem, Selection, Vec2, Wall, Window } from '@/types';
import { hallInnerPolygon, hallOuterPolygon, findWall, openingPlacement, isHallWallId } from '@/geometry/walls';
import { polygonInside } from '@/geometry/polygon';
import { floorRooms } from '@/geometry/rooms';
import { floorVisibleItems } from '@/store/selectors';
import { getDef } from '@/data/equipment';
import { roomColor } from '@/data/roomTypes';
import { cm, ceilingCmOf, rotationY, SLAB_M, type FloorLevel } from './coords';
import { extrudePolygon, flatPolygon, material, UNIT_BOX, useDisposeGeometries } from './geometry';
import { floorWallPieces } from './walls3d';
import { wallHeightOf } from './wallSegments';
import {
  wallAppearance, floorCoveringColor, doorAppearance, GLASS_COLOR, GLASS_OPACITY, MIRROR_COLOR, CEILING_COLOR,
  CEILING_COLOR_DARK, DOOR_FRAME_COLOR, FURNITURE_AREAS,
} from './colors';
import { ItemMesh, SafetyZoneMesh, Label3D, type StairsMode } from './Items3D';
import { isLinkedCopy, verticalSpan } from './items3d';

export interface SceneOptions {
  showSafetyZones: boolean;
  showLabels: boolean;
  showCeilings: boolean;
  showRooms: boolean;
  shadows: boolean;
}

export interface FloorSceneProps {
  entry: FloorLevel;
  /** Alle gerenderten Stockwerke (für Treppen/Aufzüge über mehrere Ebenen). */
  levels: FloorLevel[];
  /** Alle Stockwerke des Projekts (für verlinkte Treppen/Aufzüge). */
  floors: Floor[];
  allFloors: boolean;
  isLowest: boolean;
  isTopmost: boolean;
  isActive: boolean;
  dark: boolean;
  layers: LayerVisibility;
  customEquipment: EquipmentDef[];
  /** Auswahl als „kind:id“. */
  selectedKeys: ReadonlySet<string>;
  opts: SceneOptions;
  onSelect: (sel: Selection, additive: boolean, floorId: string) => void;
}

/** Höchstzahl gleichzeitig eingeblendeter Objekt-Beschriftungen (DOM-Elemente). */
const LABEL_LIMIT = 200;
const DOOR_OPEN_DEG = 30;

export function selectionKey(kind: Selection['kind'], id: string): string {
  return `${kind}:${id}`;
}

function setCursor(e: ThreeEvent<PointerEvent>, cursor: string) {
  const el = e.nativeEvent.target as HTMLElement | null;
  if (el?.style) el.style.cursor = cursor;
}

interface OpeningView {
  opening: Opening;
  wall: Wall;
  center: Vec2;
  dir: Vec2;
  normal: Vec2;
  angle: number;
  a: Vec2;
  b: Vec2;
  /** Wandhöhe (cm). */
  wallH: number;
}

/** Wie eine Treppe auf diesem Stockwerk erscheint (nur Einzelansicht relevant). */
function stairsModeFor(item: PlacedItem, floor: Floor, floors: Floor[]): StairsMode {
  if (isLinkedCopy(item)) {
    const home = floors.find((f) => f.id === item.params?.__linkedFrom);
    return home && home.order > floor.order ? 'full' : 'landing';
  }
  const linked = (item.linkedFloorIds ?? []).map((id) => floors.find((f) => f.id === id)).filter((f): f is Floor => !!f);
  const hasAbove = linked.some((f) => f.order > floor.order);
  const hasBelow = linked.some((f) => f.order < floor.order);
  return !hasAbove && hasBelow ? 'landing' : 'full';
}

/* ---------------- Öffnungen ---------------- */

const DoorMesh = memo(function DoorMesh({ view, level, selected, shadows, onClick }: { view: OpeningView; level: number; selected: boolean; shadows: boolean; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const door = view.opening as Door;
  const t = cm(view.wall.thickness);
  const w = cm(door.width);
  const h = cm(Math.max(20, Math.min(door.height, view.wallH)));
  const look = doorAppearance(door.doorType);
  const leafMat = material({ color: look.color, opacity: look.opacity, selected, roughness: 0.6, depthWrite: look.opacity >= 1 });
  const frameMat = material({ color: DOOR_FRAME_COLOR, selected, roughness: 0.7 });
  const wallRot = rotationY(view.angle);
  const parts: ReactNode[] = [];
  // Zargen
  for (const [i, p] of [view.a, view.b].entries()) {
    parts.push(<mesh key={`j${i}`} geometry={UNIT_BOX} material={frameMat} position={[cm(p.x), 0, cm(p.y)]} rotation={[0, wallRot, 0]} scale={[0.05, h, t + 0.02]} />);
  }
  const swing = door.swingSide === 'a' ? -1 : 1;
  const leaf = (key: string, hinge: Vec2, sign: 1 | -1, width: number) => (
    <group key={key} position={[cm(hinge.x), 0, cm(hinge.y)]} rotation={[0, rotationY(view.angle + swing * sign * DOOR_OPEN_DEG), 0]}>
      <mesh geometry={UNIT_BOX} material={leafMat} position={[(sign * width) / 2, 0.01, 0]} scale={[Math.max(0.05, width - 0.02), h - 0.02, 0.04]} castShadow={shadows} />
    </group>
  );
  switch (door.doorType) {
    case 'zweiflügelig':
      parts.push(leaf('la', view.a, 1, w / 2), leaf('lb', view.b, -1, w / 2));
      break;
    case 'Schiebetür': {
      const side = door.swingSide === 'a' ? 1 : -1;
      const shift = door.hinge === 'left' ? -1 : 1;
      const cx = view.center.x + view.normal.x * side * (view.wall.thickness / 2 + 2) + view.dir.x * shift * (door.width / 2);
      const cy = view.center.y + view.normal.y * side * (view.wall.thickness / 2 + 2) + view.dir.y * shift * (door.width / 2);
      parts.push(<mesh key="slide" geometry={UNIT_BOX} material={leafMat} position={[cm(cx), 0.01, cm(cy)]} rotation={[0, wallRot, 0]} scale={[w, h - 0.02, 0.03]} castShadow={shadows} />);
      break;
    }
    case 'Rolltor':
      parts.push(<mesh key="roll" geometry={UNIT_BOX} material={leafMat} position={[cm(view.center.x), Math.max(0, h - 0.3), cm(view.center.y)]} rotation={[0, wallRot, 0]} scale={[w, 0.3, Math.max(0.06, t * 0.8)]} />);
      break;
    default:
      parts.push(door.hinge === 'left' ? leaf('l', view.a, 1, w) : leaf('l', view.b, -1, w));
  }
  return (
    <group position={[0, level, 0]} onClick={onClick} onPointerOver={(e) => { e.stopPropagation(); setCursor(e, 'pointer'); }} onPointerOut={(e) => setCursor(e, '')}>
      {parts}
    </group>
  );
});

const WindowMesh = memo(function WindowMesh({ view, level, selected, onClick }: { view: OpeningView; level: number; selected: boolean; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const win = view.opening as Window;
  const t = cm(view.wall.thickness);
  const w = cm(win.width);
  const sill = Math.max(0, Math.min(win.sillHeight, view.wallH));
  const h = cm(Math.max(5, Math.min(win.height, view.wallH - sill)));
  const glass = material({ color: GLASS_COLOR, opacity: GLASS_OPACITY, selected, roughness: 0.1, metalness: 0.1, depthWrite: false, doubleSide: true });
  const frame = material({ color: DOOR_FRAME_COLOR, selected, roughness: 0.7 });
  const rot = rotationY(view.angle);
  const x = cm(view.center.x);
  const z = cm(view.center.y);
  return (
    <group position={[0, level, 0]} onClick={onClick} onPointerOver={(e) => { e.stopPropagation(); setCursor(e, 'pointer'); }} onPointerOut={(e) => setCursor(e, '')}>
      <mesh geometry={UNIT_BOX} material={frame} position={[x, cm(sill) - 0.03, z]} rotation={[0, rot, 0]} scale={[w + 0.04, 0.03, t + 0.06]} />
      <mesh geometry={UNIT_BOX} material={glass} position={[x, cm(sill), z]} rotation={[0, rot, 0]} scale={[w, h, 0.02]} />
    </group>
  );
});

const MirrorMesh = memo(function MirrorMesh({ view, level, selected, onClick }: { view: OpeningView; level: number; selected: boolean; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const mirror = view.opening as Mirror;
  const w = cm(mirror.width);
  const h = cm(Math.max(5, Math.min(mirror.height, view.wallH)));
  const bottomCm = Math.max(0, Math.min(20, view.wallH - mirror.height));
  const side = mirror.side === 'a' ? 1 : -1;
  const off = view.wall.thickness / 2 + 0.8;
  const x = cm(view.center.x + view.normal.x * side * off);
  const z = cm(view.center.y + view.normal.y * side * off);
  const mat = material({ color: MIRROR_COLOR, selected, metalness: 1, roughness: 0.1 });
  return (
    <mesh
      geometry={UNIT_BOX}
      material={mat}
      position={[x, level + cm(bottomCm), z]}
      rotation={[0, rotationY(view.angle), 0]}
      scale={[w, h, 0.012]}
      onClick={onClick}
      onPointerOver={(e) => { e.stopPropagation(); setCursor(e, 'pointer'); }}
      onPointerOut={(e) => setCursor(e, '')}
    />
  );
});

/* ---------------- Stockwerk ---------------- */

export const FloorScene = memo(function FloorScene(props: FloorSceneProps) {
  const { entry, levels, floors, allFloors, isLowest, isTopmost, isActive, dark, layers, customEquipment, selectedKeys, opts, onSelect } = props;
  const floor = entry.floor;
  const level = entry.level;
  const ceilingCm = ceilingCmOf(floor);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => { invalidate(); });

  /* ---- Halle: Bodenplatte & Dach ---- */
  const inner = useMemo(() => (floor.hall && floor.hall.polygon.length >= 3 ? hallInnerPolygon(floor.hall) : null), [floor.hall]);
  const holes = useMemo(
    () => (inner ? floor.voids.filter((v) => v.polygon.length >= 3 && polygonInside(v.polygon, inner)).map((v) => v.polygon) : []),
    [floor.voids, inner],
  );
  const slabGeo = useMemo(() => (inner && inner.length >= 3 ? extrudePolygon(inner, SLAB_M, holes) : null), [inner, holes]);
  const roofGeo = useMemo(() => (inner && inner.length >= 3 ? extrudePolygon(inner, 0.06) : null), [inner]);
  useDisposeGeometries(useMemo(() => [slabGeo, roofGeo].filter((g): g is NonNullable<typeof g> => !!g), [slabGeo, roofGeo]));
  const slabOpaque = isLowest || opts.showCeilings;
  const slabMat = material({
    color: floorCoveringColor(floor.hall?.floorCovering),
    opacity: slabOpaque ? 1 : 0.35,
    depthWrite: slabOpaque,
    roughness: 0.9,
  });
  const roofMat = material({ color: dark ? CEILING_COLOR_DARK : CEILING_COLOR, opacity: 0.3, depthWrite: false, doubleSide: true });

  /* ---- Wände ---- */
  const pieces = useMemo(
    () => (layers.walls ? floorWallPieces({ walls: floor.walls, hall: floor.hall, openings: floor.openings }, ceilingCm) : []),
    [floor.walls, floor.hall, floor.openings, ceilingCm, layers.walls],
  );
  const wallGeos = useMemo(() => pieces.map((p) => extrudePolygon(p.polygon, cm(p.segment.top - p.segment.bottom))), [pieces]);
  useDisposeGeometries(wallGeos);

  /* ---- Öffnungen ---- */
  const openings = useMemo<OpeningView[]>(() => {
    if (!layers.openings) return [];
    const out: OpeningView[] = [];
    const ctx = { walls: floor.walls, hall: floor.hall };
    for (const opening of floor.openings) {
      if (opening.hidden || !(opening.width > 0)) continue;
      const wall = findWall(ctx, opening.wallId);
      if (!wall || wall.hidden) continue;
      const pl = openingPlacement(opening, wall);
      out.push({ opening, wall, ...pl, wallH: wallHeightOf(wall, ceilingCm) });
    }
    return out;
  }, [floor.openings, floor.walls, floor.hall, ceilingCm, layers.openings]);

  /* ---- Räume / Zonen ---- */
  const rooms = useMemo(() => (layers.rooms && opts.showRooms ? floorRooms(floor) : []), [floor, layers.rooms, opts.showRooms]);
  const roomGeos = useMemo(() => rooms.map((r) => flatPolygon(r.polygon)), [rooms]);
  useDisposeGeometries(roomGeos);

  /* ---- Objekte ---- */
  const items = useMemo(
    () => (allFloors ? floor.items : floorVisibleItems(floor, floors)),
    [allFloors, floor, floors],
  );
  const visibleItems = useMemo(() => {
    if (!layers.items) return [] as { item: PlacedItem; def: EquipmentDef | undefined }[];
    const lib = { customEquipment };
    const out: { item: PlacedItem; def: EquipmentDef | undefined }[] = [];
    for (const item of items) {
      if (item.hidden) continue;
      const def = getDef(item.defId, lib);
      if (def?.ohne_stellflaeche) continue;
      if (!layers.furniture && def && FURNITURE_AREAS.has(def.bereich)) continue;
      out.push({ item, def });
    }
    return out;
  }, [items, customEquipment, layers.items, layers.furniture]);

  const selectItem = useCallback((item: PlacedItem, additive: boolean) => onSelect({ kind: 'item', id: item.id }, additive, floor.id), [onSelect, floor.id]);
  const clickOpening = useCallback((id: string) => (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect({ kind: 'opening', id }, e.nativeEvent.shiftKey, floor.id); }, [onSelect, floor.id]);

  const labelAll = opts.showLabels && layers.labels;
  let labelBudget = LABEL_LIMIT;
  const showZones = opts.showSafetyZones && layers.safetyZones;
  const outer = floor.hall && floor.hall.polygon.length >= 3 ? hallOuterPolygon(floor.hall) : null;

  return (
    <group>
      {slabGeo && <mesh geometry={slabGeo} material={slabMat} position={[0, level - SLAB_M, 0]} receiveShadow />}

      {rooms.map((r, i) => (
        <mesh
          key={r.id}
          geometry={roomGeos[i]}
          material={material({ color: roomColor(r.type, r.color), opacity: 0.35, depthWrite: false, doubleSide: true, polygonOffset: true, selected: selectedKeys.has(selectionKey(r.source === 'zone' ? 'zone' : 'room', r.id)) })}
          position={[0, level + 0.004, 0]}
          onClick={(e) => { e.stopPropagation(); onSelect({ kind: r.source === 'zone' ? 'zone' : 'room', id: r.id }, e.nativeEvent.shiftKey, floor.id); }}
        >
          {labelAll && (
            <group position={[cm(r.centroid.x), 0.05, cm(r.centroid.y)]}>
              <Label3D text={r.name} y={0} />
            </group>
          )}
        </mesh>
      ))}

      {pieces.map((p, i) => {
        const hall = isHallWallId(p.wall.id);
        const key = hall ? selectionKey('hallEdge', p.wall.id.slice(5)) : selectionKey('wall', p.wall.id);
        const look = wallAppearance(p.wall.type, dark);
        const mat = material({ color: look.color, opacity: look.opacity, selected: selectedKeys.has(key), roughness: look.opacity < 1 ? 0.2 : 0.85, depthWrite: look.opacity >= 1 });
        return (
          <mesh
            key={`${p.wall.id}_${i}`}
            geometry={wallGeos[i]}
            material={mat}
            position={[0, level + cm(p.segment.bottom), 0]}
            castShadow={opts.shadows && look.opacity >= 1}
            receiveShadow
            onClick={(e) => {
              e.stopPropagation();
              onSelect(hall ? { kind: 'hallEdge', id: p.wall.id.slice(5) } : { kind: 'wall', id: p.wall.id }, e.nativeEvent.shiftKey, floor.id);
            }}
            onPointerOver={(e) => { e.stopPropagation(); setCursor(e, 'pointer'); }}
            onPointerOut={(e) => setCursor(e, '')}
          />
        );
      })}

      {openings.map((v) => {
        const selected = selectedKeys.has(selectionKey('opening', v.opening.id));
        const onClick = clickOpening(v.opening.id);
        if (v.opening.kind === 'door') return <DoorMesh key={v.opening.id} view={v} level={level} selected={selected} shadows={opts.shadows} onClick={onClick} />;
        if (v.opening.kind === 'window') return <WindowMesh key={v.opening.id} view={v} level={level} selected={selected} onClick={onClick} />;
        return <MirrorMesh key={v.opening.id} view={v} level={level} selected={selected} onClick={onClick} />;
      })}

      {visibleItems.map(({ item, def }) => {
        const vertical = item.kind === 'stairs' || item.kind === 'elevator';
        const span = vertical ? verticalSpan(item, floor, levels) : undefined;
        const stairsMode: StairsMode | undefined = item.kind === 'stairs' ? (allFloors ? 'full' : stairsModeFor(item, floor, floors)) : undefined;
        const selected = selectedKeys.has(selectionKey('item', item.id));
        const label = labelAll && labelBudget-- > 0;
        return (
          <ItemMesh
            key={item.id}
            item={item}
            def={def}
            level={level}
            ceilingCm={ceilingCm}
            selected={selected}
            shadows={opts.shadows}
            label={label}
            span={span}
            stairsMode={stairsMode}
            onSelect={selectItem}
          />
        );
      })}

      {showZones && visibleItems.map(({ item }) => <SafetyZoneMesh key={`z_${item.id}`} item={item} level={level} />)}

      {opts.showCeilings && (isTopmost || !allFloors) && roofGeo && (
        <mesh geometry={roofGeo} material={roofMat} position={[0, entry.top, 0]} />
      )}

      {allFloors && outer && (
        <group position={[cm(outer[0].x), level + 0.05, cm(outer[0].y)]}>
          <Label3D text={floor.name} y={0} accent={isActive} />
        </group>
      )}
    </group>
  );
});
