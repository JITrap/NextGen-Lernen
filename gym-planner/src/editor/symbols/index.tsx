/**
 * Symbolsystem: Draufsicht-Silhouetten für alle SymbolKind-Werte.
 *
 * - `ItemSymbol` zeichnet ein platziertes Objekt in LOKALEN Koordinaten (Ursprung = Objektmitte,
 *   Breite entlang x, Tiefe entlang y, „vorne“ = +y). Rotation/Translation macht die aufrufende Group.
 * - `symbolFor(kind)` liefert den Renderer aus der Registry (vollständig über alle SymbolKind-Werte,
 *   TypeScript erzwingt das per Record-Typ).
 * - `SYMBOL_COLORS` / `SYMBOL_COLORS_DARK` sind die Bereichsfarben, `areaColors(area, dark)` wählt passend.
 *
 * Jedes Symbol besteht aus höchstens 8 Konva-Nodes (alle `listening={false}`), damit 500+ Objekte flüssig bleiben.
 * Bei sehr kleiner Bildschirmgröße (< LOD_MIN_PX) wird nur die Grundfläche gezeichnet.
 */
import type { ReactElement } from 'react';
import type { EquipmentDef, PlacedItem, SymbolKind } from '@/types';
import {
  Body, Disc, Poly, mix, symbolColors, statePalette,
  type ItemSymbolProps, type SymbolRenderProps, type SymbolRenderer,
} from './common';
import * as strength from './strength';
import * as cardio from './cardio';
import * as fn from './functional';
import * as furn from './furniture';
import * as san from './sanitary';
import * as well from './wellness';
import * as bld from './building';

export type { ItemSymbolProps, SymbolRenderProps, SymbolRenderer, AreaColor, StatePalette } from './common';
export { SYMBOL_COLORS, SYMBOL_COLORS_DARK, areaColors, symbolColors, statePalette, mix, withAlpha, lockerCount, numParam, strParam } from './common';
export { defaultStepCount, stepCountFor, flightWidth, runLength, STEP_DEPTH_CM } from './building';

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

const REGISTRY: Record<SymbolKind, SymbolRenderer> = {
  // Kraftgeräte & Freihantel
  'machine': strength.machine,
  'bench': strength.bench,
  'rack': strength.rack,
  'half-rack': strength.halfRack,
  'smith': strength.smith,
  'platform': strength.platform,
  'dumbbell-rack': strength.dumbbellRack,
  'plate-rack': strength.plateRack,
  'cable': strength.cable,
  'leg-press': strength.legPress,
  'hack-squat': strength.hackSquat,
  'lat-pulldown': strength.latPulldown,
  'chest-press': strength.chestPress,
  'row': strength.row,
  'curl': strength.curl,
  'calf': strength.calf,
  'dip': strength.dip,
  'sled': strength.sled,
  'barbell-rack': strength.barbellRack,
  'plate-tree': strength.plateTree,
  'dumbbells': strength.dumbbells,
  'barbell': strength.barbell,
  // Cardio
  'treadmill': cardio.treadmill,
  'curved-treadmill': cardio.curvedTreadmill,
  'elliptical': cardio.elliptical,
  'bike': cardio.bike,
  'recumbent-bike': cardio.recumbentBike,
  'spin-bike': cardio.spinBike,
  'air-bike': cardio.airBike,
  'rower': cardio.rower,
  'stairmaster': cardio.stairmaster,
  'skierg': cardio.skierg,
  // Functional & Kursraum
  'turf': fn.turf,
  'kettlebell-rack': fn.kettlebellRack,
  'plyo-box': fn.plyoBox,
  'mat': fn.mat,
  'ball-rack': fn.ballRack,
  'rope-anchor': fn.ropeAnchor,
  'rig': fn.rig,
  'wall-bars': fn.wallBars,
  'punching-bag': fn.punchingBag,
  'step': fn.step,
  'mat-rack': fn.matRack,
  'podium': fn.podium,
  'audio': fn.audio,
  // Empfang, Büro, Lager, Ausstattung
  'counter': furn.counter,
  'turnstile': furn.turnstile,
  'fridge': furn.fridge,
  'vending': furn.vending,
  'sofa': furn.sofa,
  'table': furn.table,
  'chair': furn.chair,
  'wardrobe': furn.wardrobe,
  'screen': furn.screen,
  'desk': furn.desk,
  'office-chair': furn.officeChair,
  'filing-cabinet': furn.filingCabinet,
  'meeting-table': furn.meetingTable,
  'shelf': furn.shelf,
  'hvac': furn.hvac,
  'washer': furn.washer,
  'cleaning-cart': furn.cleaningCart,
  'switchboard': furn.switchboard,
  'plant': furn.plant,
  'speaker': furn.speaker,
  'tv': furn.tv,
  'water-dispenser': furn.waterDispenser,
  'sanitizer': furn.sanitizer,
  'trash': furn.trash,
  'extinguisher': furn.extinguisher,
  'first-aid': furn.firstAid,
  'aed': furn.aed,
  'exit-sign': furn.exitSign,
  'camera': furn.camera,
  // Umkleide & Sanitär
  'locker': san.locker,
  'locker-row': san.lockerRow,
  'bench-seat': san.benchSeat,
  'mirror': san.mirror,
  'hairdryer': san.hairdryer,
  'sink': san.sink,
  'cabin': san.cabin,
  'shower': san.shower,
  'shower-row': san.showerRow,
  'partition': san.partition,
  'toilet': san.toilet,
  'urinal': san.urinal,
  'changing-table': san.changingTable,
  'dispenser': san.dispenser,
  'laundry': san.laundry,
  'valuables': san.valuables,
  // Wellness
  'sauna': well.sauna,
  'infrared': well.infrared,
  'steam': well.steam,
  'plunge': well.plunge,
  'ice-fountain': well.iceFountain,
  'kneipp': well.kneipp,
  'shower-experience': well.showerExperience,
  'lounger': well.lounger,
  'waterbed': well.waterbed,
  'solarium': well.solarium,
  'red-light': well.redLight,
  'massage-chair': well.massageChair,
  'massage-table': well.massageTable,
  'whirlpool': well.whirlpool,
  'tea-station': well.teaStation,
  // Bauelemente & generisch
  'column-round': bld.columnRound,
  'column-square': bld.columnSquare,
  'radiator': bld.radiator,
  'vent': bld.vent,
  'stairs-straight': bld.stairsStraight,
  'stairs-l': bld.stairsL,
  'stairs-u': bld.stairsU,
  'stairs-spiral': bld.stairsSpiral,
  'elevator': bld.elevator,
  'ramp': bld.ramp,
  'generic': bld.generic,
};

/** Alle bekannten Symbol-Arten (Reihenfolge der Registry). */
export const ALL_SYMBOL_KINDS: readonly SymbolKind[] = Object.keys(REGISTRY) as SymbolKind[];

/** Renderer für ein Symbol; unbekannte Werte (z. B. aus alten Projektdateien) fallen auf „generic“ zurück. */
export function symbolFor(kind: SymbolKind): SymbolRenderer {
  return REGISTRY[kind] ?? REGISTRY.generic;
}

/** Symbole, deren Grundfläche bereits rund ist (Durchmesser = Breite). */
const ROUND_KINDS: ReadonlySet<SymbolKind> = new Set<SymbolKind>(['column-round', 'stairs-spiral', 'plant', 'extinguisher']);
/** Symbole, die form „kreis“ selbst berücksichtigen. */
const ROUND_AWARE: ReadonlySet<SymbolKind> = new Set<SymbolKind>([
  'plate-tree', 'punching-bag', 'table', 'meeting-table', 'trash', 'plunge', 'ice-fountain', 'laundry', 'whirlpool',
]);

/* ------------------------------------------------------------------ */
/* Effektives Symbol                                                   */
/* ------------------------------------------------------------------ */

function stairsKindFromParams(item: Pick<PlacedItem, 'params'>, def: EquipmentDef | undefined): SymbolKind | null {
  const raw = item.params?.typ ?? def?.params?.typ;
  const typ = raw == null ? '' : String(raw).toLowerCase();
  if (!typ) return null;
  if (typ.startsWith('wendel') || typ === 'spiral' || typ.startsWith('spiral')) return 'stairs-spiral';
  if (typ === 'l' || typ.startsWith('l-')) return 'stairs-l';
  if (typ === 'u' || typ.startsWith('u-')) return 'stairs-u';
  if (typ.startsWith('gerade')) return 'stairs-straight';
  return null;
}

function columnKindFromParams(item: Pick<PlacedItem, 'params'>, def: EquipmentDef | undefined): SymbolKind | null {
  const rawForm = item.params?.form ?? def?.params?.form;
  const form = rawForm == null ? '' : String(rawForm).toLowerCase();
  if (form === 'rund') return 'column-round';
  if (form === 'eckig') return 'column-square';
  const rund = item.params?.rund ?? def?.params?.rund;
  if (typeof rund === 'boolean') return rund ? 'column-round' : 'column-square';
  return null;
}

/**
 * Effektive Symbol-Art eines Objekts: Bibliothekssymbol, überschrieben durch Objekt-Parameter
 * (Treppe: params.typ; Säule: params.form/rund) und Objekt-Art (kind) bei fehlender Definition.
 */
export function effectiveSymbolKind(item: Pick<PlacedItem, 'kind' | 'params'>, def: EquipmentDef | undefined): SymbolKind {
  let kind: SymbolKind = def?.symbol && def.symbol in REGISTRY ? def.symbol : 'generic';
  if (item.kind === 'stairs' || kind.startsWith('stairs-')) {
    kind = stairsKindFromParams(item, def) ?? (kind.startsWith('stairs-') ? kind : 'stairs-straight');
  } else if (item.kind === 'column' || kind === 'column-round' || kind === 'column-square') {
    kind = columnKindFromParams(item, def) ?? (kind.startsWith('column-') ? kind : 'column-square');
  } else if (!def) {
    if (item.kind === 'elevator') kind = 'elevator';
    else if (item.kind === 'radiator') kind = 'radiator';
    else if (item.kind === 'vent') kind = 'vent';
    else if (item.kind === 'ramp') kind = 'ramp';
  }
  return kind;
}

/** Wird das Objekt als Kreis (Durchmesser = Breite) gezeichnet? */
export function isRoundSymbol(item: Pick<PlacedItem, 'kind' | 'params'>, def: EquipmentDef | undefined): boolean {
  const kind = effectiveSymbolKind(item, def);
  return ROUND_KINDS.has(kind) || def?.form === 'kreis';
}

/* ------------------------------------------------------------------ */
/* ItemSymbol                                                          */
/* ------------------------------------------------------------------ */

/** Unterhalb dieser Bildschirmgröße (px, größere Seite) wird nur die Grundfläche gezeichnet. */
export const LOD_MIN_PX = 9;

/** Strichbreiten in Bildschirm-Pixeln. */
const OUTLINE_PX = 1.25;
const OUTLINE_SELECTED_PX = 2.2;
const OUTLINE_HOVER_PX = 1.8;
const DETAIL_PX = 1;

interface ResolvedStyle {
  fill: string;
  stroke: string;
  ink: string;
  light: string;
  shade: string;
  sw: number;
  lw: number;
  px: number;
}

/** Farben/Strichbreiten eines Objekts nach Zustand (Kollision > Auswahl > Hover; Sperre entsättigt). */
export function resolveSymbolStyle(kind: SymbolKind, item: Pick<PlacedItem, 'locked'>, def: EquipmentDef | undefined, scale: number, dark: boolean, selected: boolean, colliding: boolean, hovered: boolean): ResolvedStyle {
  const px = 1 / Math.max(scale, 1e-4);
  const base = symbolColors(kind, def?.bereich, dark);
  const st = statePalette(dark);
  let fill = base.fill;
  let stroke = base.stroke;
  let ink = base.stroke;
  if (item.locked) {
    fill = mix(fill, st.lockedMix, 0.45);
    ink = mix(ink, st.lockedMix, 0.35);
    stroke = ink;
  }
  let outline = OUTLINE_PX;
  if (colliding) {
    fill = mix(fill, st.dangerFill, 0.4);
    stroke = st.danger;
    ink = mix(ink, st.danger, 0.4);
    outline = OUTLINE_HOVER_PX;
  }
  if (selected) {
    stroke = st.accent;
    outline = OUTLINE_SELECTED_PX;
  } else if (hovered && !colliding) {
    stroke = st.hover;
    outline = OUTLINE_HOVER_PX;
  }
  const light = mix(fill, dark ? '#e2e8f0' : '#ffffff', dark ? 0.22 : 0.5);
  const shade = mix(fill, ink, dark ? 0.55 : 0.42);
  return { fill, stroke, ink, light, shade, sw: outline * px, lw: DETAIL_PX * px, px };
}

/** Polygon-Grundfläche (def.polygon) in lokale Koordinaten: normiert (0..1) oder in cm ab linker oberer Ecke. */
function polygonPoints(def: EquipmentDef, w: number, d: number): number[] | null {
  const poly = def.polygon;
  if (!poly || poly.length < 3) return null;
  const normalized = poly.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1);
  const out: number[] = [];
  for (const [x, y] of poly) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    out.push((normalized ? x * w : x) - w / 2, (normalized ? y * d : y) - d / 2);
  }
  return out;
}

/**
 * Draufsicht-Symbol eines platzierten Objekts in lokalen Koordinaten (Ursprung = Mitte, vorne = +y).
 * Gibt ein Fragment aus höchstens 8 Konva-Nodes zurück; die aufrufende Group setzt x/y/rotation.
 */
export function ItemSymbol(props: ItemSymbolProps): ReactElement {
  const { item, def, scale, dark, selected, colliding, hovered } = props;
  const kind = effectiveSymbolKind(item, def);
  const w = Number.isFinite(item.width) && item.width > 0 ? item.width : 1;
  const d = Number.isFinite(item.depth) && item.depth > 0 ? item.depth : 1;
  const style = resolveSymbolStyle(kind, item, def, scale, dark, selected, colliding, hovered);
  const round = ROUND_KINDS.has(kind) || (def?.form === 'kreis' && !ROUND_AWARE.has(kind));

  // Sehr klein auf dem Bildschirm: nur Grundfläche
  if (Math.max(w, d) * scale < LOD_MIN_PX) {
    if (round) return <Disc r={w / 2} fill={style.fill} stroke={style.stroke} sw={style.sw} />;
    return <Body w={w} d={d} fill={style.fill} stroke={style.stroke} sw={style.sw} />;
  }

  // Polygon-Grundflächen (nur bei nicht-runden Symbolen ohne eigene Form)
  if (def?.form === 'polygon' && !round) {
    const pts = polygonPoints(def, w, d);
    if (pts) return <Poly pts={pts} closed fill={style.fill} stroke={style.stroke} sw={style.sw} />;
  }

  const render = round && !ROUND_KINDS.has(kind) ? bld.disc : symbolFor(kind);
  const rp: SymbolRenderProps = { ...props, kind, w, d, ...style };
  return render(rp);
}
