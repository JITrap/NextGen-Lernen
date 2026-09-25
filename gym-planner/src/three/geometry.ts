/**
 * three.js-Helfer der 3D-Vorschau: Extrusion von Grundriss-Polygonen, gemeinsame Primitive, Material-Cache.
 */
import * as THREE from 'three';
import { useEffect } from 'react';
import type { Vec2 } from '@/types';
import { cm } from './coords';
import { SELECTION_EMISSIVE } from './colors';

function toVec2(p: Vec2): THREE.Vector2 {
  return new THREE.Vector2(cm(p.x), cm(p.y));
}

/** three.Shape aus einem Grundriss-Polygon (cm) mit optionalen Löchern (z. B. Lufträume). */
export function polygonToShape(outer: Vec2[], holes: Vec2[][] = []): THREE.Shape {
  const shape = new THREE.Shape(outer.map(toVec2));
  for (const h of holes) {
    if (h.length >= 3) shape.holes.push(new THREE.Path(h.map(toVec2)));
  }
  return shape;
}

/**
 * Extrudiert ein Grundriss-Polygon (cm) nach oben. Ergebnis: y ∈ [0, heightM], Welt-y → z.
 * (ExtrudeGeometry extrudiert entlang +z; die Geometrie wird um die x-Achse gedreht und angehoben.)
 */
export function extrudePolygon(outer: Vec2[], heightM: number, holes: Vec2[][] = []): THREE.BufferGeometry {
  const h = Math.max(0.001, heightM);
  const g = new THREE.ExtrudeGeometry(polygonToShape(outer, holes), { depth: h, bevelEnabled: false, steps: 1 });
  g.rotateX(Math.PI / 2);
  g.translate(0, h, 0);
  return g;
}

/** Flache Fläche aus einem Grundriss-Polygon in der xz-Ebene (y = 0). Material sollte DoubleSide sein. */
export function flatPolygon(outer: Vec2[], holes: Vec2[][] = []): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(polygonToShape(outer, holes));
  g.rotateX(Math.PI / 2);
  return g;
}

/** Keil (Rampe): steigt entlang lokal −z (vorne → hinten) von 0 auf heightM; Breite entlang x. */
export function rampGeometry(widthM: number, depthM: number, heightM: number): THREE.BufferGeometry {
  const w = Math.max(0.01, widthM);
  const d = Math.max(0.01, depthM);
  const h = Math.max(0.005, heightM);
  // Profil in der (shape-x, shape-y)-Ebene; shape-x wird nach der Drehung zu −z.
  const shape = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(d / 2, h)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, steps: 1 });
  g.rotateY(Math.PI / 2);
  g.translate(-w / 2, 0, 0);
  return g;
}

/* ---------------- Gemeinsame Primitive (einmalig, nie entsorgen) ---------------- */

/** Einheitswürfel mit Unterkante bei y = 0 (skalieren mit Breite/Höhe/Tiefe). */
export const UNIT_BOX: THREE.BufferGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
/** Einheitszylinder (Ø 1, Höhe 1) mit Unterkante bei y = 0. */
export const UNIT_CYLINDER: THREE.BufferGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 28).translate(0, 0.5, 0);
/** Flache 1 × 1-Fläche in der xz-Ebene, Normale nach oben. */
export const UNIT_PLANE_XZ: THREE.BufferGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/* ---------------- Material-Cache ---------------- */

export interface MaterialSpec {
  color: string;
  opacity?: number;
  selected?: boolean;
  metalness?: number;
  roughness?: number;
  doubleSide?: boolean;
  /** Bei transparenten Flächen meist false (weniger Sortierartefakte). */
  depthWrite?: boolean;
  /** Leicht nach hinten versetzen (gegen Z-Fighting auf Böden). */
  polygonOffset?: boolean;
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

/** Liefert ein (gecachtes) MeshStandardMaterial – identische Spezifikation → identische Instanz. */
export function material(spec: MaterialSpec): THREE.MeshStandardMaterial {
  const opacity = spec.opacity ?? 1;
  const key = [
    spec.color, opacity, spec.selected ? 1 : 0, spec.metalness ?? 0, spec.roughness ?? 0.85,
    spec.doubleSide ? 1 : 0, spec.depthWrite === false ? 0 : 1, spec.polygonOffset ? 1 : 0,
  ].join('|');
  let m = materialCache.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color: spec.color,
    transparent: opacity < 1,
    opacity,
    metalness: spec.metalness ?? 0,
    roughness: spec.roughness ?? 0.85,
    side: spec.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    depthWrite: spec.depthWrite ?? true,
    polygonOffset: !!spec.polygonOffset,
    polygonOffsetFactor: spec.polygonOffset ? -1 : 0,
    polygonOffsetUnits: spec.polygonOffset ? -1 : 0,
  });
  if (spec.selected) {
    m.emissive = new THREE.Color(SELECTION_EMISSIVE);
    m.emissiveIntensity = 0.55;
  }
  materialCache.set(key, m);
  return m;
}

/** Entsorgt Geometrien, sobald sie durch neue ersetzt werden oder die Komponente verschwindet. */
export function useDisposeGeometries(geometries: THREE.BufferGeometry[]) {
  useEffect(() => () => { for (const g of geometries) g.dispose(); }, [geometries]);
}
