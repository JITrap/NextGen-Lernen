/**
 * 3D-Vorschau (react-three-fiber): Halle, Wände, Öffnungen und Objekte in echter Höhe,
 * frei drehbar, aktives Stockwerk oder alle Stockwerke. Wird lazy aus App.tsx geladen (ui.view3d).
 */
import { useCallback, useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ArrowDownToLine, Axis3d, DoorOpen, LayoutGrid, Layers, ShieldAlert, SquareStack, Sun, Tag } from 'lucide-react';
import type { Floor, Opening, Selection, Vec2 } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { useIsDark } from '@/hooks/useTheme';
import { itemFootprint } from '@/geometry/transform';
import { bbox, centroid, dot, sub } from '@/geometry/polygon';
import { findWall, isHallWallId, openingPlacement } from '@/geometry/walls';
import { cm, floorLevels, type FloorLevel } from './coords';
import { backgroundColor, gridColors } from './colors';
import { useView3dStore, type CameraPreset } from './view3dStore';
import { FloorScene, selectionKey, type SceneOptions } from './FloorScene';

/* ---------------- Szenen-Ausdehnung ---------------- */

interface SceneBounds {
  cx: number;
  cz: number;
  minZ: number;
  maxZ: number;
  /** Halbe Diagonale des Grundrisses (m), mindestens 4. */
  radius: number;
  /** Oberkante des höchsten Stockwerks (m). */
  height: number;
  empty: boolean;
}

function sceneBounds(levels: FloorLevel[]): SceneBounds {
  const pts: Vec2[] = [];
  for (const l of levels) {
    const f = l.floor;
    if (f.hall) pts.push(...f.hall.polygon);
    for (const w of f.walls) pts.push(w.start, w.end);
    for (const it of f.items) pts.push(...itemFootprint(it));
    for (const z of f.zones) pts.push(...z.polygon);
  }
  const b = pts.length ? bbox(pts) : { minX: 0, minY: 0, maxX: 2000, maxY: 1500 };
  const w = cm(b.maxX - b.minX);
  const d = cm(b.maxY - b.minY);
  return {
    cx: cm((b.minX + b.maxX) / 2),
    cz: cm((b.minY + b.maxY) / 2),
    minZ: cm(b.minY),
    maxZ: cm(b.maxY),
    radius: Math.max(4, Math.hypot(w, d) / 2),
    height: levels.length ? levels[levels.length - 1].top : 3,
    empty: pts.length === 0,
  };
}

interface EntranceView {
  /** Türmitte (m). */
  x: number;
  z: number;
  /** Nach außen zeigende Normale (Einheitsvektor, Plan). */
  nx: number;
  nz: number;
  level: number;
}

/** Erste (Außen-)Tür des Stockwerks als Standort für das Kamera-Preset „Eingang“. */
function entranceView(entry: FloorLevel | undefined, bounds: SceneBounds): EntranceView | null {
  if (!entry) return null;
  const f = entry.floor;
  const doors = f.openings.filter((o): o is Extract<Opening, { kind: 'door' }> => o.kind === 'door' && !o.hidden);
  if (!doors.length) return null;
  const score = (o: (typeof doors)[number]) => (isHallWallId(o.wallId) ? 0 : 2) + (o.doorType === 'Notausgang' ? 1 : 0);
  const door = [...doors].sort((a, b) => score(a) - score(b))[0];
  const wall = findWall(f, door.wallId);
  if (!wall) return null;
  const pl = openingPlacement(door, wall);
  const ref = f.hall && f.hall.polygon.length >= 3 ? centroid(f.hall.polygon) : { x: bounds.cx * 100, y: bounds.cz * 100 };
  const inward = dot(pl.normal, sub(ref, pl.center)) > 0;
  const n = inward ? { x: -pl.normal.x, y: -pl.normal.y } : pl.normal;
  return { x: cm(pl.center.x), z: cm(pl.center.y), nx: n.x, nz: n.y, level: entry.level };
}

/* ---------------- Kamera ---------------- */

type Controls = ComponentRef<typeof OrbitControls>;

function CameraRig({ bounds, entrance, request }: { bounds: SceneBounds; entrance: EntranceView | null; request: { preset: CameraPreset; nonce: number } }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useRef<Controls>(null);

  const apply = useCallback(
    (preset: CameraPreset) => {
      const c = controls.current;
      const size = Math.max(bounds.radius, bounds.height);
      const target = new THREE.Vector3(bounds.cx, Math.min(bounds.height * 0.4, 2), bounds.cz);
      const pos = new THREE.Vector3();
      if (preset === 'top') {
        target.set(bounds.cx, 0, bounds.cz);
        pos.set(bounds.cx, size * 2.4, bounds.cz + 0.01);
      } else if (preset === 'entrance') {
        if (entrance) {
          pos.set(entrance.x + entrance.nx * 3.5, entrance.level + 1.7, entrance.z + entrance.nz * 3.5);
          target.set(entrance.x - entrance.nx * 4, entrance.level + 1.2, entrance.z - entrance.nz * 4);
        } else {
          pos.set(bounds.cx, 1.7, bounds.maxZ + Math.max(3, bounds.radius * 0.5));
          target.set(bounds.cx, 1.2, bounds.cz);
        }
      } else {
        const dist = size * 1.5;
        pos.set(target.x + dist * 0.75, target.y + dist * 0.72, target.z + dist * 0.75);
      }
      camera.position.copy(pos);
      if (c) {
        c.target.copy(target);
        c.update();
      } else {
        camera.lookAt(target);
      }
      invalidate();
    },
    [bounds, entrance, camera, invalidate],
  );

  // Beim Einblenden und bei jeder Preset-Anforderung anwenden (nicht bei bloßen Szenenänderungen).
  useEffect(() => { apply(request.preset); }, [request.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={false}
      minDistance={0.5}
      maxDistance={Math.max(60, bounds.radius * 14)}
      maxPolarAngle={Math.PI / 2 - 0.02}
      zoomSpeed={0.9}
      panSpeed={0.8}
    />
  );
}

/** Umgebungslicht (RoomEnvironment, gebündelt mit three – kein Netzwerk) für Reflexionen auf Spiegeln/Glas. */
function SceneEnvironment({ dark }: { dark: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = dark ? 0.35 : 0.5;
    pmrem.dispose();
    room.dispose();
    invalidate();
    return () => {
      if (scene.environment === env) scene.environment = null;
      env.dispose();
    };
  }, [gl, scene, dark, invalidate]);
  return null;
}

/* ---------------- Überlagerungs-UI ---------------- */

function ToggleButton({ on, onClick, icon, label, title }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; title?: string }) {
  return (
    <button type="button" className={`gp-btn px-2 py-1 text-xs ${on ? 'gp-btn-active' : ''}`} onClick={onClick} title={title ?? label} aria-pressed={on}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ---------------- Hauptkomponente ---------------- */

export function View3D() {
  const dark = useIsDark();
  const floors = useProjectStore((s) => s.project.floors);
  const activeFloorId = useProjectStore((s) => s.project.activeFloorId);
  const layers = useProjectStore((s) => s.project.layers);
  const customEquipment = useProjectStore((s) => s.project.customEquipment);
  const allFloors = useUiStore((s) => s.view3dAllFloors);
  const setAllFloors = useUiStore((s) => s.setView3dAllFloors);
  const setView3d = useUiStore((s) => s.setView3d);
  const selection = useUiStore((s) => s.selection);
  const v3 = useView3dStore();

  const activeFloor: Floor | undefined = floors.find((f) => f.id === activeFloorId) ?? floors[0];
  const levels = useMemo(() => floorLevels(allFloors ? floors : activeFloor ? [activeFloor] : []), [allFloors, floors, activeFloor]);
  const bounds = useMemo(() => sceneBounds(levels), [levels]);
  const activeEntry = levels.find((l) => l.floor.id === activeFloorId) ?? levels[0];
  const entrance = useMemo(() => entranceView(activeEntry, bounds), [activeEntry, bounds]);

  const selectedKeys = useMemo(() => new Set(selection.map((s) => selectionKey(s.kind, s.id))), [selection]);
  const opts: SceneOptions = useMemo(
    () => ({ showSafetyZones: v3.showSafetyZones, showLabels: v3.showLabels, showCeilings: v3.showCeilings, showRooms: v3.showRooms, shadows: v3.shadows }),
    [v3.showSafetyZones, v3.showLabels, v3.showCeilings, v3.showRooms, v3.shadows],
  );

  const onSelect = useCallback((sel: Selection, additive: boolean, floorId: string) => {
    const ps = useProjectStore.getState();
    if (ps.project.activeFloorId !== floorId && ps.project.floors.some((f) => f.id === floorId)) ps.setActiveFloor(floorId);
    useUiStore.getState().select(sel, additive);
  }, []);

  const bg = backgroundColor(dark);
  const grid = gridColors(dark);
  const size = Math.max(bounds.radius, bounds.height);
  const itemCount = levels.reduce((n, l) => n + l.floor.items.length, 0);
  const wallCount = levels.reduce((n, l) => n + l.floor.walls.length + (l.floor.hall ? l.floor.hall.polygon.length : 0), 0);
  const lightPos: [number, number, number] = [bounds.cx + size * 0.8, bounds.height + size * 1.2, bounds.cz + size * 0.5];

  return (
    <div className="relative h-full w-full overflow-hidden select-none" style={{ background: bg, touchAction: 'none' }}>
      <Canvas
        frameloop="demand"
        shadows
        dpr={[1, 2]}
        camera={{ fov: 50, near: 0.05, far: Math.max(500, size * 40), position: [bounds.cx + size, size, bounds.cz + size] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={(e) => { if (e.button === 0) useUiStore.getState().clearSelection(); }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={[bg]} />
        <fog attach="fog" args={[bg, size * 6, size * 16]} />
        <ambientLight intensity={dark ? 0.55 : 0.7} />
        <hemisphereLight args={[dark ? '#94a3b8' : '#ffffff', dark ? '#1e293b' : '#cbd5e1', dark ? 0.35 : 0.45]} />
        <directionalLight
          position={lightPos}
          intensity={dark ? 1.2 : 1.5}
          castShadow={v3.shadows}
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-camera-near={0.5}
          shadow-camera-far={size * 6}
          shadow-camera-left={-size * 1.6}
          shadow-camera-right={size * 1.6}
          shadow-camera-top={size * 1.6}
          shadow-camera-bottom={-size * 1.6}
        />
        <SceneEnvironment dark={dark} />
        <Grid
          position={[bounds.cx, -0.012, bounds.cz]}
          args={[1, 1]}
          infiniteGrid
          cellSize={1}
          cellThickness={0.6}
          cellColor={grid.cell}
          sectionSize={5}
          sectionThickness={1.1}
          sectionColor={grid.section}
          fadeDistance={size * 8}
          fadeStrength={1.4}
          side={THREE.DoubleSide}
        />
        {levels.map((entry, i) => (
          <FloorScene
            key={entry.floor.id}
            entry={entry}
            levels={levels}
            floors={floors}
            allFloors={allFloors}
            isLowest={i === 0}
            isTopmost={i === levels.length - 1}
            isActive={entry.floor.id === activeFloorId}
            dark={dark}
            layers={layers}
            customEquipment={customEquipment}
            selectedKeys={selectedKeys}
            opts={opts}
            onSelect={onSelect}
          />
        ))}
        <CameraRig bounds={bounds} entrance={entrance} request={v3.cameraRequest} />
      </Canvas>

      {/* Steuerung oben links */}
      <div className="gp-panel absolute left-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-col gap-2 rounded-lg border p-2 shadow-md">
        <div className="flex items-center gap-1">
          <button type="button" className={`gp-tab ${!allFloors ? 'active' : ''}`} onClick={() => setAllFloors(false)}>
            Aktives Stockwerk
          </button>
          <button type="button" className={`gp-tab ${allFloors ? 'active' : ''}`} onClick={() => setAllFloors(true)} disabled={floors.length < 2} title={floors.length < 2 ? 'Nur ein Stockwerk vorhanden' : 'Alle Stockwerke übereinander anzeigen'}>
            Alle Stockwerke
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <ToggleButton on={v3.showSafetyZones} onClick={() => v3.setShowSafetyZones(!v3.showSafetyZones)} icon={<ShieldAlert size={14} />} label="Sicherheitszonen" />
          <ToggleButton on={v3.showLabels} onClick={() => v3.setShowLabels(!v3.showLabels)} icon={<Tag size={14} />} label="Beschriftungen" title="Modellnamen einblenden (ausgewählte Objekte immer)" />
          <ToggleButton on={v3.showCeilings} onClick={() => v3.setShowCeilings(!v3.showCeilings)} icon={<Layers size={14} />} label="Decke/Dach" title="Decken als halbtransparente Platten anzeigen" />
          <ToggleButton on={v3.showRooms} onClick={() => v3.setShowRooms(!v3.showRooms)} icon={<LayoutGrid size={14} />} label="Räume" title="Raum-/Zonenflächen farbig anzeigen" />
          <ToggleButton on={v3.shadows} onClick={() => v3.setShadows(!v3.shadows)} icon={<Sun size={14} />} label="Schatten" />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="gp-label mr-1">Kamera</span>
          <button type="button" className="gp-btn px-2 py-1 text-xs" onClick={() => v3.requestCamera('iso')} title="Isometrische Ansicht">
            <Axis3d size={14} /> Iso
          </button>
          <button type="button" className="gp-btn px-2 py-1 text-xs" onClick={() => v3.requestCamera('top')} title="Draufsicht">
            <ArrowDownToLine size={14} /> Oben
          </button>
          <button type="button" className="gp-btn px-2 py-1 text-xs" onClick={() => v3.requestCamera('entrance')} title={entrance ? 'Blick durch die erste Tür' : 'Keine Tür vorhanden – Blick von der Südseite'}>
            <DoorOpen size={14} /> Eingang
          </button>
          <button type="button" className="gp-btn gp-btn-primary ml-auto px-2 py-1 text-xs" onClick={() => setView3d(false)} title="Zurück zur 2D-Draufsicht">
            <SquareStack size={14} /> 2D <span className="gp-kbd ml-1 border-white/40 bg-white/15 text-white">3</span>
          </button>
        </div>
      </div>

      {/* Info oben rechts */}
      <div className="gp-panel absolute right-3 top-3 z-20 rounded-lg border px-3 py-1.5 text-xs shadow-md">
        <div className="font-semibold">{allFloors ? `${levels.length} Stockwerke` : activeFloor?.name ?? 'Kein Stockwerk'}</div>
        <div className="gp-muted">
          {itemCount} Objekte · {wallCount} Wände
          {!allFloors && activeFloor ? ` · Decke ${Math.round(activeFloor.ceilingHeight)} cm` : ''}
        </div>
      </div>

      {/* Bedienhinweis unten links */}
      <div className="gp-panel absolute bottom-3 left-3 z-20 rounded-md border px-2 py-1 text-[11px] shadow-sm gp-muted">
        Drehen: Ziehen · Zoom: Mausrad / Pinch · Verschieben: rechte Maustaste / zwei Finger · Klick wählt aus · Esc hebt Auswahl auf
      </div>

      {bounds.empty && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="gp-card max-w-sm text-center text-sm shadow-md">
            <div className="mb-1 font-semibold">Noch nichts zu zeigen</div>
            <div className="gp-muted">
              Zeichne zuerst in der 2D-Ansicht eine Halle (Taste <span className="gp-kbd">H</span>) und platziere Wände und Geräte. Die 3D-Vorschau baut daraus Wände, Türen, Fenster und Objekte in echter Höhe auf.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
