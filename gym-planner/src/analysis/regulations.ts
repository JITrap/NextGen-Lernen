/**
 * Regularien-Prüfung: Fluchtwege und Notausgänge (ASR A2.3 / MBO), Verkehrswege (ASR A1.8), Brandschutz (ASR A2.2),
 * Erste Hilfe (ASR A4.3 / DGUV Vorschrift 1), Kennzeichnung (ASR A1.3), Sicherheitsbeleuchtung (ASR A2.3 Abschnitt 9),
 * Barrierefreiheit (ASR V3a.2 / DIN 18040-1), Sanitär (ASR A4.1), Gerätefreiräume (DIN EN ISO 20957-1),
 * Versammlungsstätten (MVStättVO) und organisatorische Pflichten. Jede Prüfung liefert Ist/Soll, Status,
 * Erläuterung und Quelle; `target` erlaubt das Hinspringen im Plan.
 *
 * Alle Grenzwerte stehen in `REGULATION_RULES` (zentral anpassbar). Bemessungspersonen = Kapazität (Trainierende,
 * siehe capacity) + Beschäftigte (`STAFF_DEFAULT`). Die Prüfung ist eine Planungshilfe und ersetzt kein
 * Brandschutzkonzept bzw. keine Abstimmung mit Bauaufsicht und Unfallversicherungsträger.
 */
import type { Project, Id, PlanningWarning, Vec2, Floor, PlacedItem, Room, Door, EscapeRoute } from '@/types';
import { analysisContext, memoByProject, itemName, hasFootprint, symbolOf, numParam, pointInRoom, visibleItems, type FloorContext, type AnalysisContext } from './common';
import { capacity } from './capacity';
import { warnings, ESCAPE_ROUTE_EXCLUDED_ROOM_TYPES } from './warnings';
import { emergencyExitsOf, nearestExit, polylineLength, corridorPolygon, wallCrossings, doorSwings, escapeRouteName, type EmergencyExit } from '@/geometry/escapeRoutes';
import { itemFootprint } from '@/geometry/transform';
import { convexPolygonsOverlap, doorSwingPolygon } from '@/geometry/collision';
import { findWall, openingPlacement } from '@/geometry/walls';
import { bbox, centroid, distance, distanceToSegment, pointInPolygon, segmentIntersection } from '@/geometry/polygon';
import { formatCm, formatLength, formatM2, formatNumber } from '@/geometry/units';

/* ------------------------------------------------------------------ */
/* Typen                                                               */
/* ------------------------------------------------------------------ */

export type RegulationStatus = 'ok' | 'warn' | 'fail' | 'info' | 'na';
export const REGULATION_STATUS_LABELS: Record<RegulationStatus, string> = { ok: 'erfüllt', warn: 'prüfen', fail: 'nicht erfüllt', info: 'Hinweis', na: 'nicht anwendbar' };
/** Reihenfolge für Sortierung (schwerstes zuerst). */
export const REGULATION_STATUS_RANK: Record<RegulationStatus, number> = { fail: 0, warn: 1, info: 2, ok: 3, na: 4 };

export interface RegulationCheck {
  id: string;
  /** Themenblock, z. B. „Fluchtwege“, „Brandschutz“, „Erste Hilfe“. */
  thema: string;
  titel: string;
  status: RegulationStatus;
  ist: string;
  soll: string;
  erlaeuterung: string;
  quelle: string;
  quelleUrl?: string;
  floorId?: Id;
  target?: PlanningWarning['target'];
  /** Projektweite Prüfung: erscheint in jedem Stockwerks-Umfang; floorId ist nur Sprungziel. */
  projektweit?: boolean;
}

export interface RegulationReport {
  checks: RegulationCheck[];
  counts: Record<RegulationStatus, number>;
  /** Bemessungspersonenzahl (Kapazität + Beschäftigte). */
  persons: number;
  /** Trainierende laut Kapazität. */
  trainees: number;
  /** Angenommene Beschäftigte. */
  staff: number;
  /** Schlechtester Status je gezeichnetem Fluchtweg (Anmerkungs-ID). */
  routes: Record<Id, RegulationStatus>;
}

/* ------------------------------------------------------------------ */
/* Regeln (zentral, anpassbar nach Fachrecherche)                       */
/* ------------------------------------------------------------------ */

/** Angenommene Zahl der Beschäftigten (Empfang, Trainer, Reinigung) – Bemessungsgröße für ASR/DGUV-Pflichten. */
export const STAFF_DEFAULT = 6;

export const REGULATION_RULES = {
  /** Rasterweite (cm) der Prüfpunkte je Raum (Fluchtweglänge, Feuerlöscher-Entfernung). */
  rasterCm: 50,
  /** ASR A2.3 Abs. 5: max. Fluchtweglänge (Luftlinie) bis zum nächsten Notausgang, in m. */
  fluchtweglaengeM: 35,
  /** Ab dieser Luftlinie (m) wird „prüfen“ gemeldet. */
  fluchtweglaengeWarnM: 30,
  /** Tatsächliche Lauflänge darf das 1,5-Fache der Luftlinien-Vorgabe betragen (ASR A2.3 Abs. 5 (3)). */
  lauflaengeFaktor: 1.5,
  /** Endpunkt eines gezeichneten Fluchtwegs muss höchstens so weit (cm) von einer Notausgangstür entfernt sein. */
  endpunktToleranzCm: 100,
  /** ASR A2.3 Tabelle 1: Fluchtwegbreite in Nebenräumen mit bis zu 20 Personen (Technik, Lager, Büro, Umkleiden, Sanitär …), cm. */
  korridorNebenraumCm: 100,
  /** MBO § 33 / ASR A2.3: zweiter Rettungsweg ab dieser Nettofläche (m²) bzw. Personenzahl je Stockwerk. */
  zweiterNotausgangAbM2: 200,
  zweiterNotausgangAbPersonen: 20,
  /**
   * ASR A2.3 (März 2022) Tabelle 1: lichte Mindestbreite (cm) von Fluchtwegen (Spalte „Weg“) und von Türen im
   * Fluchtweg (Spalte „Tür“) nach der höchstmöglichen Personenzahl im Einzugsgebiet. Bestand bis 30.09.2022:
   * 87,5 cm Weg (bis 5 Personen) bzw. 85 cm Tür (bis 20 Personen).
   */
  ausgangsbreite: [
    { bisPersonen: 5, cm: 90, tuerCm: 80 },
    { bisPersonen: 20, cm: 100, tuerCm: 90 },
    { bisPersonen: 50, cm: 120, tuerCm: 90 },
    { bisPersonen: 100, cm: 120, tuerCm: 100 },
    { bisPersonen: 200, cm: 120, tuerCm: 105 },
    { bisPersonen: 300, cm: 180, tuerCm: 165 },
    { bisPersonen: 400, cm: 240, tuerCm: 225 },
  ],
  /** Über 400 Personen: je weitere 100 Personen zusätzlich (cm, Weg wie Tür). */
  ausgangsbreiteJeWeitere100Cm: 60,
  /** Jede Notausgangstür mindestens (cm) – Tabelle 1 Spalte Tür bei bis zu 5 Personen. */
  mindestTuerbreiteCm: 80,
  /** ASR A2.2 Tabelle 3: Löschmitteleinheiten (LE) je Grundfläche (m²), mittlere Brandgefährdung. */
  loeschmittel: [
    { bisM2: 50, le: 6 }, { bisM2: 100, le: 9 }, { bisM2: 200, le: 12 }, { bisM2: 300, le: 15 }, { bisM2: 400, le: 18 },
    { bisM2: 500, le: 21 }, { bisM2: 600, le: 24 }, { bisM2: 700, le: 27 }, { bisM2: 800, le: 30 }, { bisM2: 900, le: 33 }, { bisM2: 1000, le: 36 },
  ],
  /** Über 1.000 m²: je weitere 250 m² zusätzlich 6 LE. */
  loeschmittelJeWeitereM2: 250,
  loeschmittelJeWeitereLe: 6,
  /** Standard-LE je Feuerlöscher ohne Angabe (params.le) – konservativ (6 kg ABC-Pulver = 10 LE, 6 l Schaum = 6 LE). */
  leJeFeuerloescher: 6,
  /** Obergrenze je üblichem 6-kg-/6-l-Gerät (10 LE): reicht das Soll nur damit, wird „prüfen“ statt „nicht erfüllt“ gemeldet. */
  leJeFeuerloescherMax: 10,
  /** ASR A2.2 Abs. 6: max. Entfernung (m) von jedem Punkt zum nächsten Feuerlöscher. */
  feuerloescherMaxEntfernungM: 20,
  /** ASR A2.2 Abs. 7: Prüfintervall Feuerlöscher (Jahre). */
  feuerloescherPruefintervallJahre: 2,
  /** ASR A4.3 Tabelle 1: ab dieser Personenzahl (Versicherte) zweiter/großer Verbandkasten. */
  verbandkastenGrossAbPersonen: 50,
  /** Rettungszeichen bzw. Rettungszeichenleuchte höchstens so weit (cm) von der Notausgangstür entfernt. */
  rettungszeichenAbstandCm: 150,
  /** Erkennungsweite (m) eines 150 mm hohen Rettungszeichens (ASR A1.3 Tabelle: Erkennungsweite ≈ 100 × Höhe bei Hinterleuchtung). */
  rettungszeichenErkennungsweiteM: 15,
  /** ASR V3a.2 / DIN 18040-1: lichte Türbreite (cm) barrierefreier Türen. */
  barrierefreiTuerbreiteCm: 90,
  /** DIN 18040-1: Bewegungsfläche (cm × cm) vor dem WC. */
  bewegungsflaecheCm: 150,
  /** MVStättVO § 1: Versammlungsräume ab dieser Personenzahl. */
  versammlungsstaetteAbPersonen: 200,
  /** ASR A2.2 Abs. 7.3: Anteil Brandschutzhelfer an den Beschäftigten (%). */
  brandschutzhelferProzent: 5,
  /** DGUV Vorschrift 1 § 26: Ersthelfer – bis 20 Versicherte 1 Ersthelfer, darüber 10 % (sonstige Betriebe). */
  ersthelferBisPersonen: 20,
  ersthelferProzent: 10,
  /** ASR A4.1 Tabelle 2: Toiletten für Beschäftigte (Anzahl Toiletten nach Zahl der Beschäftigten, je Geschlecht). */
  beschaeftigtenWc: [
    { bisBeschaeftigte: 5, wcs: 1 }, { bisBeschaeftigte: 10, wcs: 1 }, { bisBeschaeftigte: 25, wcs: 2 },
    { bisBeschaeftigte: 50, wcs: 3 }, { bisBeschaeftigte: 100, wcs: 5 },
  ],
  /** Fluchtwegbreite bis 200 Personen (Hinweiswert, ASR A2.3 Tabelle 1). */
  fluchtwegbreiteHinweisCm: 120,
} as const;

/* Quellen */
const SRC = {
  a23: { quelle: 'ASR A2.3 „Fluchtwege und Notausgänge“', url: 'https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A2-3.html' },
  a22: { quelle: 'ASR A2.2 „Maßnahmen gegen Brände“', url: 'https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A2-2.html' },
  a18: { quelle: 'ASR A1.8 „Verkehrswege“', url: 'https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A1-8.html' },
  a13: { quelle: 'ASR A1.3 „Sicherheits- und Gesundheitsschutzkennzeichnung“', url: 'https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A1-3.html' },
  a347: { quelle: 'ASR A2.3 Abschnitt 9 „Sicherheitsbeleuchtung“ (ehem. ASR A3.4/7, zurückgezogen GMBl 2022 S. 248)', url: 'https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A2-3.html' },
  a41: { quelle: 'ASR A4.1 „Sanitärräume“', url: 'https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A4-1.html' },
  a43: { quelle: 'ASR A4.3 „Erste-Hilfe-Räume, Mittel und Einrichtungen zur Ersten Hilfe“', url: 'https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A4-3.html' },
  v3a2: { quelle: 'ASR V3a.2 „Barrierefreie Gestaltung von Arbeitsstätten“ / DIN 18040-1', url: 'https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-V3a-2.html' },
  dguv1: { quelle: 'DGUV Vorschrift 1 „Grundsätze der Prävention“', url: 'https://publikationen.dguv.de/regelwerk/dguv-vorschriften/' },
  dguv204: { quelle: 'DGUV Information 204-010 „Automatisierte Defibrillation im Rahmen der betrieblichen Ersten Hilfe“', url: 'https://publikationen.dguv.de/regelwerk/dguv-informationen/' },
  dguv205: { quelle: 'DGUV Information 205-023 „Brandschutzhelfer“', url: 'https://publikationen.dguv.de/regelwerk/dguv-informationen/' },
  mbo: { quelle: 'MBO § 33 „Erster und zweiter Rettungsweg“', url: 'https://www.is-argebau.de/' },
  mvstaett: { quelle: 'MVStättVO „Muster-Versammlungsstättenverordnung“', url: 'https://www.is-argebau.de/' },
  iso20957: { quelle: 'DIN EN ISO 20957-1 „Stationäre Trainingsgeräte – Allgemeine sicherheitstechnische Anforderungen“', url: 'https://www.din.de/' },
  iso23601: { quelle: 'ASR A2.3 Abs. 9 / DIN ISO 23601 „Flucht- und Rettungspläne“', url: 'https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A2-3.html' },
  trinkw: { quelle: 'TrinkwV § 31 „Untersuchungspflichten Legionellen“', url: 'https://www.gesetze-im-internet.de/trinkwv_2023/' },
} as const;

export const THEMA = {
  flucht: 'Fluchtwege & Notausgänge',
  verkehr: 'Verkehrswege',
  brand: 'Brandschutz',
  ersteHilfe: 'Erste Hilfe',
  kennzeichnung: 'Kennzeichnung & Sicherheitsbeleuchtung',
  barrierefrei: 'Barrierefreiheit',
  sanitaer: 'Sanitär & Umkleiden',
  geraete: 'Gerätefreiräume',
  versammlung: 'Versammlungsstätte',
  orga: 'Organisatorisches',
} as const;
/** Reihenfolge der Themen im Panel/PDF. */
export const THEMA_ORDER: string[] = Object.values(THEMA);

/* Bibliotheks-IDs der Sicherheitsausstattung */
export const DEF_EXTINGUISHER = 'gen-ausstattung-feuerloescher';
export const DEF_FIRST_AID = 'gen-ausstattung-erste-hilfe';
export const DEF_AED = 'gen-ausstattung-aed';
export const DEF_EXIT_SIGN = 'gen-ausstattung-notausgang-schild';
export const DEF_EXIT_LIGHT = 'gen-ausstattung-rettungszeichenleuchte';
export const DEF_ESCAPE_PLAN = 'gen-ausstattung-fluchtplan';
export const DEF_WC_ACCESSIBLE = 'gen-sanitaer-wc-barrierefrei';

/* ------------------------------------------------------------------ */
/* Reine Regelfunktionen (exportiert, getestet)                         */
/* ------------------------------------------------------------------ */

/** Sollbreite (cm) der Fluchtwege/Notausgänge in Summe nach ASR A2.3 Tabelle 1 (Spalte Weg). */
export function requiredExitWidthCm(persons: number): number {
  const p = Math.max(0, persons);
  for (const row of REGULATION_RULES.ausgangsbreite) if (p <= row.bisPersonen) return row.cm;
  const last = REGULATION_RULES.ausgangsbreite[REGULATION_RULES.ausgangsbreite.length - 1];
  return last.cm + Math.ceil((p - last.bisPersonen) / 100) * REGULATION_RULES.ausgangsbreiteJeWeitere100Cm;
}

/** Mindestbreite (cm) einer Tür im Fluchtweg nach ASR A2.3 Tabelle 1 (Spalte Tür) für die Personenzahl ihres Einzugsgebiets. */
export function requiredDoorWidthCm(persons: number): number {
  const p = Math.max(0, persons);
  for (const row of REGULATION_RULES.ausgangsbreite) if (p <= row.bisPersonen) return row.tuerCm;
  const last = REGULATION_RULES.ausgangsbreite[REGULATION_RULES.ausgangsbreite.length - 1];
  return last.tuerCm + Math.ceil((p - last.bisPersonen) / 100) * REGULATION_RULES.ausgangsbreiteJeWeitere100Cm;
}

/** Soll-Löschmitteleinheiten nach ASR A2.2 Tabelle 3 (mittlere Brandgefährdung) für eine Grundfläche in m². */
export function requiredExtinguisherLe(areaM2: number): number {
  const a = Math.max(0, areaM2);
  for (const row of REGULATION_RULES.loeschmittel) if (a <= row.bisM2) return row.le;
  const last = REGULATION_RULES.loeschmittel[REGULATION_RULES.loeschmittel.length - 1];
  return last.le + Math.ceil((a - last.bisM2) / REGULATION_RULES.loeschmittelJeWeitereM2) * REGULATION_RULES.loeschmittelJeWeitereLe;
}

/** Toiletten für Beschäftigte nach ASR A4.1 Tabelle 2 (je Geschlecht; hier als Gesamtmindestzahl). */
export function requiredStaffToilets(staff: number): number {
  for (const row of REGULATION_RULES.beschaeftigtenWc) if (staff <= row.bisBeschaeftigte) return row.wcs;
  return REGULATION_RULES.beschaeftigtenWc[REGULATION_RULES.beschaeftigtenWc.length - 1].wcs + Math.ceil((staff - 100) / 50);
}

/** Ersthelfer nach DGUV Vorschrift 1 § 26 (sonstige Betriebe: 10 % ab 21 Versicherten). */
export function requiredFirstAiders(staff: number): number {
  if (staff <= 1) return 0;
  if (staff <= REGULATION_RULES.ersthelferBisPersonen) return 1;
  return Math.max(1, Math.ceil((staff * REGULATION_RULES.ersthelferProzent) / 100));
}

/** Brandschutzhelfer nach ASR A2.2 Abs. 7.3 (mind. 5 % der Beschäftigten, mindestens 1). */
export function requiredFireWardens(staff: number): number {
  return staff <= 0 ? 0 : Math.max(1, Math.ceil((staff * REGULATION_RULES.brandschutzhelferProzent) / 100));
}

/**
 * Rasterpunkte (Schrittweite `step`) innerhalb eines Raums (Polygon ohne Löcher). Liegt kein Rasterpunkt im Raum
 * (sehr kleine Räume), wird der Schwerpunkt geliefert.
 */
export function gridPointsInRoom(room: Pick<Room, 'polygon' | 'holes' | 'centroid'>, step = REGULATION_RULES.rasterCm): Vec2[] {
  const out: Vec2[] = [];
  if (room.polygon.length < 3) return out;
  const b = bbox(room.polygon);
  const x0 = Math.ceil(b.minX / step) * step;
  const y0 = Math.ceil(b.minY / step) * step;
  for (let y = y0; y <= b.maxY; y += step) {
    for (let x = x0; x <= b.maxX; x += step) {
      const p = { x, y };
      if (pointInRoom(p, room as Room)) out.push(p);
    }
  }
  if (!out.length) out.push(room.centroid);
  return out;
}

/** Schlechtester Rasterpunkt eines Raums bezogen auf die Luftlinie zum nächsten Ziel (Punktliste). */
export function worstDistanceInRoom(room: Pick<Room, 'polygon' | 'holes' | 'centroid'>, targets: Vec2[], step = REGULATION_RULES.rasterCm): { point: Vec2; distance: number } | null {
  if (!targets.length) return null;
  let worst: { point: Vec2; distance: number } | null = null;
  for (const p of gridPointsInRoom(room, step)) {
    let best = Infinity;
    for (const t of targets) {
      const d = distance(p, t);
      if (d < best) best = d;
    }
    if (!worst || best > worst.distance) worst = { point: p, distance: best };
  }
  return worst;
}

/** Schlechtester Status einer Liste. */
export function worstStatus(list: RegulationStatus[]): RegulationStatus {
  let w: RegulationStatus = 'na';
  for (const s of list) if (REGULATION_STATUS_RANK[s] < REGULATION_STATUS_RANK[w]) w = s;
  return w;
}

/* ------------------------------------------------------------------ */
/* Helfer                                                              */
/* ------------------------------------------------------------------ */

const q = (s: string) => `„${s}“`;
const fmtM = (cm: number) => `${formatNumber(cm / 100, 1)} m`;

interface FloorSafety {
  fc: FloorContext;
  exits: EmergencyExit[];
  /** Sichtbare Objekte mit Stellfläche (ohne Wandmontage) – Hindernisse für Fluchtwege. */
  obstacles: PlacedItem[];
  extinguishers: PlacedItem[];
  firstAid: PlacedItem[];
  aeds: PlacedItem[];
  exitSigns: PlacedItem[];
  exitLights: PlacedItem[];
  escapePlans: PlacedItem[];
  accessibleWcs: PlacedItem[];
  /** Räume für Rasterprüfungen (Räume/Zonen des Stockwerks; ohne Räume die Halle selbst). */
  rooms: Room[];
}

function isDef(it: PlacedItem, ctx: AnalysisContext, defId: string, symbol?: string): boolean {
  if (it.defId === defId) return true;
  return !!symbol && symbolOf(ctx.def(it.defId)) === symbol;
}

function hallRoom(fc: FloorContext): Room | null {
  if (!fc.inner || fc.inner.length < 3) return null;
  return { id: `hall:${fc.floor.id}`, name: 'Halle', type: 'Sonstiges', polygon: fc.inner, source: 'auto', areaM2: fc.innerM2, perimeterCm: 0, centroid: centroid(fc.inner) };
}

function floorSafety(fc: FloorContext, project: Project, ctx: AnalysisContext): FloorSafety {
  const all = visibleItems(fc.floor, project.floors).filter((it) => !it.hidden);
  const obstacles = all.filter((it) => {
    const def = ctx.def(it.defId);
    return hasFootprint(def) && !def?.wandmontage && it.kind !== 'ramp';
  });
  const pick = (defId: string, symbol?: string) => all.filter((it) => isDef(it, ctx, defId, symbol));
  // Lufträume (Deckenöffnungen) sind kein begehbarer Boden: als zusätzliche Löcher an die Räume der Rasterprüfungen hängen
  const voids = fc.floor.voids.filter((v) => v.polygon.length >= 3).map((v) => v.polygon);
  const withVoids = (r: Room): Room => (voids.length ? { ...r, holes: [...(r.holes ?? []), ...voids] } : r);
  const base = fc.rooms.length ? fc.rooms : (() => { const h = hallRoom(fc); return h ? [h] : []; })();
  const rooms = base.map(withVoids);
  return {
    fc,
    exits: emergencyExitsOf(fc.floor),
    obstacles,
    extinguishers: pick(DEF_EXTINGUISHER, 'extinguisher'),
    firstAid: pick(DEF_FIRST_AID, 'first-aid'),
    aeds: pick(DEF_AED, 'aed'),
    exitSigns: pick(DEF_EXIT_SIGN, 'exit-sign'),
    exitLights: pick(DEF_EXIT_LIGHT),
    escapePlans: pick(DEF_ESCAPE_PLAN),
    accessibleWcs: pick(DEF_WC_ACCESSIBLE),
    rooms,
  };
}

function roomTarget(room: Room): PlanningWarning['target'] {
  if (room.id.startsWith('hall:')) return { point: room.centroid };
  return { kind: room.source === 'zone' ? 'zone' : 'room', id: room.id };
}

function doorLabel(e: EmergencyExit): string {
  const note = e.door.note?.trim();
  return note ? `${e.door.doorType} ${q(note)}` : `${e.door.doorType} (${formatCm(e.width)})`;
}

function distanceToPolygon(p: Vec2, poly: Vec2[]): number {
  if (poly.length < 3) return Infinity;
  if (pointInPolygon(p, poly)) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, distanceToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  return best;
}

function nearestItemDistance(p: Vec2, items: PlacedItem[]): number {
  let best = Infinity;
  for (const it of items) best = Math.min(best, distance(p, { x: it.x, y: it.y }));
  return best;
}

/* ------------------------------------------------------------------ */
/* Einzelprüfungen                                                     */
/* ------------------------------------------------------------------ */

/** a) Fluchtweglänge je Raum (Rasterpunkte, Luftlinie zum nächsten Notausgang). */
function escapeLengthChecks(fs: FloorSafety, out: RegulationCheck[]) {
  const R = REGULATION_RULES;
  const floorId = fs.fc.floor.id;
  const maxCm = R.fluchtweglaengeM * 100;
  const warnCm = R.fluchtweglaengeWarnM * 100;
  const targets = fs.exits.map((e) => e.center);
  const soll = `≤ ${R.fluchtweglaengeM} m Luftlinie`;
  for (const room of fs.rooms) {
    if (room.areaM2 < 1) continue;
    const id = `escape-length:${floorId}:${room.id}`;
    if (!targets.length) {
      out.push({
        id, thema: THEMA.flucht, titel: `Fluchtweglänge ${q(room.name)}`, status: 'fail', ist: 'kein Notausgang', soll, floorId, target: roomTarget(room),
        erlaeuterung: 'Auf diesem Stockwerk ist keine Notausgangstür vorhanden. Türen in Hallen-Außenwänden oder Türen vom Typ „Notausgang“ zählen als Notausgang.',
        quelle: `${SRC.a23.quelle}, Abs. 5`, quelleUrl: SRC.a23.url,
      });
      continue;
    }
    const worst = worstDistanceInRoom(room, targets);
    if (!worst) continue;
    const status: RegulationStatus = worst.distance > maxCm ? 'fail' : worst.distance > warnCm ? 'warn' : 'ok';
    out.push({
      id, thema: THEMA.flucht, titel: `Fluchtweglänge ${q(room.name)}`, status, ist: `max. ${fmtM(worst.distance)}`, soll, floorId,
      target: { point: worst.point },
      erlaeuterung: `Der entfernteste Punkt des Raums liegt ${fmtM(worst.distance)} (Luftlinie) vom nächsten Notausgang entfernt. Die ASR A2.3 erlaubt für Räume mit normaler Brandgefährdung höchstens 35 m; die tatsächliche Lauflänge darf das 1,5-Fache betragen.`,
      quelle: `${SRC.a23.quelle}, Abs. 5 (3)`, quelleUrl: SRC.a23.url,
    });
  }
}

/** Kleinster Raum/Zone, der den Punkt enthält (Zonen und Auto-Räume gleichrangig, kleinste Fläche gewinnt). */
function smallestRoomAt(p: Vec2, fs: FloorSafety): Room | null {
  let best: Room | null = null;
  for (const r of fs.fc.rooms) if (pointInRoom(p, r) && (!best || r.areaM2 < best.areaM2)) best = r;
  return best;
}

/** Korridorbreite an einem Punkt: in Nebenräumen (bis 20 Personen) die Tabellenbreite, sonst die eingestellte Mindestbreite. */
function corridorWidthAt(p: Vec2, fs: FloorSafety, settingCm: number): number {
  const room = smallestRoomAt(p, fs);
  if (room && ESCAPE_ROUTE_EXCLUDED_ROOM_TYPES.has(room.type)) return Math.min(settingCm, REGULATION_RULES.korridorNebenraumCm);
  return settingCm;
}

/** Schneidet die Strecke a–b das Polygon (Kante geschnitten oder Endpunkt innen)? */
function segmentHitsPolygon(a: Vec2, b: Vec2, poly: Vec2[]): boolean {
  if (pointInPolygon(a, poly) || pointInPolygon(b, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    if (segmentIntersection(a, b, poly[i], poly[(i + 1) % poly.length])) return true;
  }
  return false;
}

/** a) Gezeichnete Fluchtwege: Lauflänge, Luftlinie, Endpunkt am Notausgang, freier Korridor, Wände nur durch Türen. */
function drawnRouteChecks(fs: FloorSafety, project: Project, ctx: AnalysisContext, out: RegulationCheck[], routes: Record<Id, RegulationStatus>) {
  const R = REGULATION_RULES;
  const floor = fs.fc.floor;
  const floorId = floor.id;
  const maxAir = R.fluchtweglaengeM * 100;
  const maxWalk = maxAir * R.lauflaengeFaktor;
  const width = project.settings.minEscapeRouteCm;
  const footprints = fs.obstacles.map((it) => ({ it, fp: itemFootprint(it) }));
  const routeList = floor.annotations.filter((a): a is EscapeRoute => a.kind === 'escape-route' && !a.hidden && a.points.length >= 2);
  routeList.forEach((a) => {
    const name = escapeRouteName(floor, a);
    const target = { kind: 'annotation' as const, id: a.id };
    const statuses: RegulationStatus[] = [];
    const push = (c: RegulationCheck) => { statuses.push(c.status); out.push(c); };
    const walk = polylineLength(a.points);
    const air = distance(a.points[0], a.points[a.points.length - 1]);
    const lengthOk = walk <= maxWalk && air <= maxAir;
    push({
      id: `route:${a.id}:length`, thema: THEMA.flucht, titel: `${name}: Länge`, status: lengthOk ? 'ok' : 'fail',
      ist: `Lauflänge ${fmtM(walk)} · Luftlinie ${fmtM(air)}`, soll: `≤ ${formatNumber(maxWalk / 100, 1)} m Lauflänge, ≤ ${R.fluchtweglaengeM} m Luftlinie`, floorId, target,
      erlaeuterung: lengthOk
        ? 'Lauflänge und Luftlinie liegen innerhalb der zulässigen Fluchtweglänge.'
        : 'Der Fluchtweg ist zu lang. Die Luftlinie vom Start zum Notausgang darf 35 m, die tatsächliche Lauflänge das 1,5-Fache (52,5 m) nicht überschreiten – zusätzlicher Notausgang oder kürzere Wegführung nötig.',
      quelle: `${SRC.a23.quelle}, Abs. 5 (3)`, quelleUrl: SRC.a23.url,
    });
    const end = a.points[a.points.length - 1];
    const near = nearestExit(end, fs.exits);
    const endOk = !!near && near.distance <= R.endpunktToleranzCm;
    push({
      id: `route:${a.id}:end`, thema: THEMA.flucht, titel: `${name}: Endpunkt am Notausgang`, status: endOk ? 'ok' : 'fail',
      ist: near ? `${formatLength(near.distance)} bis ${doorLabel(near.exit)}` : 'kein Notausgang vorhanden', soll: `≤ ${formatCm(R.endpunktToleranzCm)} zur Notausgangstür`, floorId,
      target: endOk ? target : { point: end },
      erlaeuterung: endOk
        ? 'Der Fluchtweg endet an einer Notausgangstür.'
        : 'Der Fluchtweg endet nicht an einem Notausgang. Beim Zeichnen rastet der letzte Punkt in der Nähe einer Notausgangstür (≤ 60 cm) automatisch auf die Türmitte.',
      quelle: `${SRC.a23.quelle}, Abs. 4`, quelleUrl: SRC.a23.url,
    });
    // Korridor frei: Breite je Segment nach Raumart (Nebenräume ≤ 20 Personen: 100 cm, sonst Einstellung);
    // Objekte auf der Linie selbst → „nicht erfüllt“, Objekte nur im Korridor → „prüfen“; Drehkreuze/Schranken zählen
    // nicht (Paniköffnung in Fluchtrichtung, ASR A2.3 Abs. 6), Bodenmatten nur als Hinweis.
    const onLine = new Map<string, PlacedItem>();
    const inCorridor = new Map<string, PlacedItem>();
    let minWidth = width;
    for (let i = 0; i + 1 < a.points.length; i++) {
      const p0 = a.points[i];
      const p1 = a.points[i + 1];
      const segWidth = corridorWidthAt({ x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }, fs, width);
      minWidth = Math.min(minWidth, segWidth);
      const rect = corridorPolygon(p0, p1, segWidth);
      if (rect.length < 4) continue;
      const rb = bbox(rect);
      for (const { it, fp } of footprints) {
        if (onLine.has(it.id)) continue;
        if (symbolOf(ctx.def(it.defId)) === 'turnstile') continue;
        const ib = bbox(fp);
        if (ib.maxX < rb.minX || ib.minX > rb.maxX || ib.maxY < rb.minY || ib.minY > rb.maxY) continue;
        if (segmentHitsPolygon(p0, p1, fp)) { onLine.set(it.id, it); inCorridor.delete(it.id); continue; }
        if (!inCorridor.has(it.id) && convexPolygonsOverlap(fp, rect, 1)) inCorridor.set(it.id, it);
      }
    }
    const isMat = (it: PlacedItem) => symbolOf(ctx.def(it.defId)) === 'mat';
    const hard = [...onLine.values()].filter((it) => !isMat(it));
    const soft = [...inCorridor.values(), ...[...onLine.values()].filter(isMat)];
    const blockers = [...hard, ...soft];
    const names = blockers.slice(0, 3).map((it) => q(itemName(it, ctx.def(it.defId)))).join(', ') + (blockers.length > 3 ? ` … (+${blockers.length - 3})` : '');
    const widthText = minWidth === width ? formatCm(width) : `${formatCm(minWidth)}–${formatCm(width)}`;
    push({
      id: `route:${a.id}:corridor`, thema: THEMA.flucht, titel: `${name}: Korridor frei (${widthText})`, status: hard.length ? 'fail' : soft.length ? 'warn' : 'ok',
      ist: blockers.length ? `${blockers.length} Objekt${blockers.length === 1 ? '' : 'e'} im Weg: ${names}` : 'frei', soll: `Breite ${widthText} ohne Objekte`, floorId,
      target: blockers.length ? { kind: 'item', id: blockers[0].id } : target,
      erlaeuterung: hard.length
        ? `Der Fluchtweg führt durch Geräte oder Möbel. Entlang des Fluchtwegs muss ein Korridor in der Mindestbreite (${formatCm(width)} in der Halle, ${formatCm(REGULATION_RULES.korridorNebenraumCm)} in Nebenräumen bis 20 Personen) frei bleiben – Weg verlegen oder Objekte umstellen.`
        : soft.length
          ? `Objekte ragen in den Korridor (${widthText}) hinein oder liegen als Matten auf dem Weg. Drehkreuze/Schranken zählen nicht, wenn sie sich in Fluchtrichtung ohne Hilfsmittel öffnen lassen (Paniköffnung).`
          : `Der Korridor in der Mindestbreite (${widthText}) ist frei von Geräten und Möbeln.`,
      quelle: `${SRC.a23.quelle}, Abs. 5 (2), Abs. 6 / ${SRC.a18.quelle}`, quelleUrl: SRC.a23.url,
    });
    const crossings = wallCrossings(a.points, floor);
    push({
      id: `route:${a.id}:walls`, thema: THEMA.flucht, titel: `${name}: Wände nur durch Türen`, status: crossings.length ? 'fail' : 'ok',
      ist: crossings.length ? `${crossings.length} Wanddurchdringung${crossings.length === 1 ? '' : 'en'} ohne Tür` : 'keine Wanddurchdringung', soll: 'Wände nur innerhalb einer Türöffnung kreuzen', floorId,
      target: crossings.length ? { point: crossings[0].point } : target,
      erlaeuterung: crossings.length
        ? 'Der Fluchtweg kreuzt eine Wand außerhalb einer Türöffnung. Wegführung ändern oder eine Tür (Fluchttür ≥ 0,80 m, bis 100 Personen ≥ 1,00 m, in Fluchtrichtung aufschlagend) einplanen.'
        : 'Der Fluchtweg führt nur durch Türöffnungen.',
      quelle: `${SRC.a23.quelle}, Abs. 4`, quelleUrl: SRC.a23.url,
    });
    routes[a.id] = worstStatus(statuses);
  });
}

/** b) Anzahl Notausgänge je Stockwerk, Lage an Außenwänden. */
function exitCountChecks(fs: FloorSafety, floorPersons: number, out: RegulationCheck[]) {
  const R = REGULATION_RULES;
  const fc = fs.fc;
  const floorId = fc.floor.id;
  const area = fc.nettoM2;
  const needsTwo = area >= R.zweiterNotausgangAbM2 || floorPersons > R.zweiterNotausgangAbPersonen;
  const n = fs.exits.length;
  const status: RegulationStatus = n === 0 ? 'fail' : needsTwo && n < 2 ? 'fail' : 'ok';
  out.push({
    id: `exits:count:${floorId}`, thema: THEMA.flucht, titel: `Anzahl Notausgänge ${q(fc.floor.name)}`, status,
    ist: `${n} Notausg${n === 1 ? 'ang' : 'änge'} · ${formatM2(area)} · ${floorPersons} Personen`,
    soll: needsTwo ? '≥ 2 unabhängige Rettungswege' : '≥ 1 Rettungsweg (2 empfohlen)', floorId,
    target: fs.exits[0] ? { kind: 'opening', id: fs.exits[0].door.id } : (fc.inner ? { point: centroid(fc.inner) } : undefined),
    erlaeuterung: `Ab ${R.zweiterNotausgangAbM2} m² Nettofläche oder mehr als ${R.zweiterNotausgangAbPersonen} Personen sind zwei voneinander unabhängige Fluchtwege in unterschiedliche Richtungen erforderlich (ASR A2.3 Abschnitt 4: Nebenfluchtweg bei hoher Personenzahl bzw. Räumen über 400 m²; MBO § 33 verlangt für Nutzungseinheiten zwei Rettungswege, bei ebenerdigen Einheiten genügt nach MBO 2024 ein direkter Ausgang ins Freie – die Landesbauordnungen weichen ab). Als Notausgang zählen Türen vom Typ „Notausgang“ und aufschlagende Türen in der Hallen-Außenwand.`,
    quelle: `${SRC.mbo.quelle} / ${SRC.a23.quelle}, Abs. 4`, quelleUrl: SRC.a23.url,
  });
  const inner = fs.exits.filter((e) => !e.onHallWall);
  if (fc.hasHall && inner.length) {
    out.push({
      id: `exits:inner:${floorId}`, thema: THEMA.flucht, titel: `Notausgänge an Innenwänden ${q(fc.floor.name)}`, status: 'warn',
      ist: `${inner.length} Notausgangstür${inner.length === 1 ? '' : 'en'} an Innenwänden`, soll: 'Notausgänge führen ins Freie oder in einen gesicherten Bereich', floorId,
      target: { kind: 'opening', id: inner[0].door.id },
      erlaeuterung: 'Eine als „Notausgang“ typisierte Tür sitzt in einer Innenwand. Sie zählt nur, wenn sie in einen notwendigen Flur, ein Treppenhaus oder ins Freie führt – im Plan prüfen.',
      quelle: `${SRC.a23.quelle}, Abs. 3 (Begriffe)`, quelleUrl: SRC.a23.url,
    });
  }
}

/** c) Ausgangsbreiten und Aufschlagrichtung. */
function exitWidthChecks(fs: FloorSafety, persons: number, out: RegulationCheck[]) {
  const R = REGULATION_RULES;
  const fc = fs.fc;
  const floorId = fc.floor.id;
  const sum = fs.exits.reduce((s, e) => s + e.width, 0);
  const soll = requiredExitWidthCm(persons);
  if (fs.exits.length) {
    out.push({
      id: `exits:width:${floorId}`, thema: THEMA.flucht, titel: `Ausgangsbreite gesamt ${q(fc.floor.name)}`, status: sum >= soll ? 'ok' : 'fail',
      ist: `${formatCm(sum)} (${fs.exits.map((e) => formatCm(e.width)).join(' + ')})`, soll: `≥ ${formatCm(soll)} für ${persons} Personen`, floorId,
      target: { kind: 'opening', id: fs.exits[0].door.id },
      erlaeuterung: 'Die Summe der lichten Breiten aller Notausgänge muss die Sollbreite nach Personenzahl erreichen (ASR A2.3 Tabelle 1, Fluchtweg: bis 5 Personen 0,90 m; bis 20: 1,00 m; bis 200: 1,20 m; bis 300: 1,80 m; bis 400: 2,40 m; je weitere 100 Personen + 0,60 m). Türen im Fluchtweg: bis 5 Personen 0,80 m; bis 50: 0,90 m; bis 100: 1,00 m; bis 200: 1,05 m; bis 300: 1,65 m; bis 400: 2,25 m.',
      quelle: `${SRC.a23.quelle}, Tabelle 1`, quelleUrl: SRC.a23.url,
    });
  }
  const doorSoll = requiredDoorWidthCm(persons);
  const widest = fs.exits.reduce((m, e) => Math.max(m, e.width), 0);
  if (fs.exits.length) {
    // Haupt-Notausgang: mindestens eine Tür muss die Türbreite für die gesamte Personenzahl haben (Einzugsgebiet = Stockwerk).
    out.push({
      id: `exits:doorwidth:${floorId}`, thema: THEMA.flucht, titel: `Türbreite Hauptausgang ${q(fc.floor.name)}`, status: widest >= doorSoll ? 'ok' : 'warn',
      ist: `breiteste Notausgangstür ${formatCm(widest)}`, soll: `≥ ${formatCm(doorSoll)} für ${persons} Personen`, floorId,
      target: { kind: 'opening', id: fs.exits.reduce((a, b) => (b.width > a.width ? b : a)).door.id },
      erlaeuterung: widest >= doorSoll
        ? 'Mindestens eine Notausgangstür erreicht die Türbreite nach ASR A2.3 Tabelle 1 (Spalte Tür) für die Personenzahl des Stockwerks.'
        : 'Keine Notausgangstür erreicht die Türbreite für die Personenzahl des Stockwerks (ASR A2.3 Tabelle 1, Spalte Tür: bis 20 Personen 0,90 m, bis 100 Personen 1,00 m, bis 200 Personen 1,05 m). Verteilen sich die Personen auf mehrere Ausgänge, gilt je Tür die Personenzahl ihres Einzugsgebiets.',
      quelle: `${SRC.a23.quelle}, Tabelle 1`, quelleUrl: SRC.a23.url,
    });
  }
  for (const e of fs.exits) {
    const tooNarrow = e.width < R.mindestTuerbreiteCm;
    const target = { kind: 'opening' as const, id: e.door.id };
    out.push({
      id: `exit:${e.door.id}:width`, thema: THEMA.flucht, titel: `Türbreite ${doorLabel(e)}`, status: tooNarrow ? 'fail' : 'ok',
      ist: formatCm(e.width), soll: `≥ ${formatCm(R.mindestTuerbreiteCm)}`, floorId, target,
      erlaeuterung: tooNarrow ? 'Jede Tür im Fluchtweg braucht eine lichte Breite von mindestens 0,80 m (bis 5 Personen); bis 50 Personen 0,90 m, bis 100 Personen 1,00 m, bis 200 Personen 1,05 m (ASR A2.3 Tabelle 1, Spalte Tür).' : 'Die lichte Breite der Notausgangstür ist ausreichend.',
      quelle: `${SRC.a23.quelle}, Tabelle 1`, quelleUrl: SRC.a23.url,
    });
    if (!doorSwings(e.door)) {
      out.push({
        id: `exit:${e.door.id}:swing`, thema: THEMA.flucht, titel: `Aufschlagrichtung ${doorLabel(e)}`, status: 'fail',
        ist: `${e.door.doorType} (nicht aufschlagend)`, soll: 'Drehflügeltür, in Fluchtrichtung aufschlagend', floorId, target,
        erlaeuterung: 'Schiebetüren und Rolltore sind als Notausgang unzulässig; Türen im Verlauf von Fluchtwegen müssen Drehflügeltüren sein, die in Fluchtrichtung aufschlagen.',
        quelle: `${SRC.a23.quelle}, Abs. 6 (2)`, quelleUrl: SRC.a23.url,
      });
      continue;
    }
    if (e.onHallWall && fc.inner) {
      const poly = doorSwingPolygon(e.door, e.wall);
      const c = poly.length ? centroid(poly) : null;
      const outward = !!c && !pointInPolygon(c, fc.inner);
      out.push({
        id: `exit:${e.door.id}:swing`, thema: THEMA.flucht, titel: `Aufschlagrichtung ${doorLabel(e)}`, status: outward ? 'ok' : 'warn',
        ist: outward ? 'schlägt nach außen auf' : 'schlägt nach innen auf', soll: 'in Fluchtrichtung (nach außen) aufschlagend', floorId, target,
        erlaeuterung: outward
          ? 'Die Tür öffnet ins Freie – in Fluchtrichtung.'
          : 'Die Notausgangstür öffnet in die Halle. Türen im Verlauf von Fluchtwegen müssen in Fluchtrichtung aufschlagen – Aufschlagseite in den Türeigenschaften wechseln oder (z. B. Haupteingang) eine Pendel-/Fluchttür mit Panikbeschlag vorsehen.',
        quelle: `${SRC.a23.quelle}, Abs. 6 (2)`, quelleUrl: SRC.a23.url,
      });
    } else {
      out.push({
        id: `exit:${e.door.id}:swing`, thema: THEMA.flucht, titel: `Aufschlagrichtung ${doorLabel(e)}`, status: 'info',
        ist: `Aufschlag zur Wandseite ${e.door.swingSide === 'a' ? 'A' : 'B'}`, soll: 'in Fluchtrichtung aufschlagend', floorId, target,
        erlaeuterung: 'Bei Türen in Innenwänden ist die Fluchtrichtung nicht automatisch bestimmbar – manuell prüfen, dass die Tür vom Raum weg in Richtung Ausgang öffnet.',
        quelle: `${SRC.a23.quelle}, Abs. 6 (2)`, quelleUrl: SRC.a23.url,
      });
    }
  }
}

/** d) Verkehrs-/Fluchtwegbreite aus den bestehenden Laufweg-Warnungen. */
function corridorWidthChecks(project: Project, persons: number, ctx: AnalysisContext, out: RegulationCheck[]) {
  const R = REGULATION_RULES;
  const min = project.settings.minEscapeRouteCm;
  const list = warnings(project).filter((w) => w.kind === 'escape-route');
  const required = requiredExitWidthCm(persons);
  for (const fc of ctx.floors) {
    const floorId = fc.floor.id;
    const mine = list.filter((w) => w.floorId === floorId);
    let count = 0;
    let narrowest = Infinity;
    let target: PlanningWarning['target'];
    for (const w of mine) {
      const m = /(\d+) Engpässe/.exec(w.message);
      count += m ? Number(m[1]) : 1;
      const cm = /(?:nur|schmalster) (\d+(?:,\d+)?) cm/.exec(w.message);
      const v = cm ? Number(cm[1].replace(',', '.')) : NaN;
      if (Number.isFinite(v) && v < narrowest) {
        narrowest = v;
        target = w.target;
      }
    }
    out.push({
      id: `corridor:${floorId}`, thema: THEMA.verkehr, titel: `Laufwegbreite ${q(fc.floor.name)}`, status: count ? 'warn' : 'ok',
      ist: count ? `${count} Engpass${count === 1 ? '' : 'stellen'}, schmalster ${Number.isFinite(narrowest) ? formatCm(narrowest) : '–'}` : 'keine Engpässe', soll: `≥ ${formatCm(min)} (Einstellung; ≥ ${formatCm(R.fluchtwegbreiteHinweisCm)} bis 200 Personen)`, floorId, target,
      erlaeuterung: count
        ? 'Zwischen Geräten wurden Laufwege unterhalb der eingestellten Mindestbreite gefunden (Details unter „Planungs-Warnungen“). Haupt-Verkehrswege und Fluchtwege müssen die Sollbreite nach Personenzahl durchgehend einhalten.'
        : 'Alle Laufwege zwischen Trainingsgeräten erreichen die eingestellte Mindestbreite.',
      quelle: `${SRC.a18.quelle} / ${SRC.a23.quelle}, Tabelle 1`, quelleUrl: SRC.a23.url,
    });
  }
  if (min < required) {
    out.push({
      id: 'corridor:setting', thema: THEMA.verkehr, titel: 'Eingestellte Mindestbreite Fluchtweg', status: 'warn',
      ist: formatCm(min), soll: `≥ ${formatCm(required)} für ${persons} Personen`,
      erlaeuterung: `Die in den Projekteinstellungen hinterlegte Mindestbreite ist kleiner als die Sollbreite nach ASR A2.3 Tabelle 1 für ${persons} Personen. Wert unter Einstellungen → Fluchtwegbreite anheben.`,
      quelle: `${SRC.a23.quelle}, Tabelle 1`, quelleUrl: SRC.a23.url,
    });
  }
}

/** e) Feuerlöscher: Löschmitteleinheiten und Entfernung. */
function extinguisherChecks(fs: FloorSafety, ctx: AnalysisContext, out: RegulationCheck[]) {
  const R = REGULATION_RULES;
  const fc = fs.fc;
  const floorId = fc.floor.id;
  const area = fc.hasHall ? fc.bruttoM2 : fc.nettoM2;
  const soll = requiredExtinguisherLe(area);
  let le = 0;
  let leMax = 0;
  for (const it of fs.extinguishers) {
    const given = numParam(it, ctx.def(it.defId), 'le');
    le += Math.max(1, Math.round(given ?? R.leJeFeuerloescher));
    leMax += Math.max(1, Math.round(given ?? R.leJeFeuerloescherMax));
  }
  const n = fs.extinguishers.length;
  const leStatus: RegulationStatus = le >= soll ? 'ok' : leMax >= soll ? 'warn' : 'fail';
  out.push({
    id: `fire:le:${floorId}`, thema: THEMA.brand, titel: `Löschmitteleinheiten ${q(fc.floor.name)}`, status: leStatus,
    ist: `${n} Feuerlöscher · ${le} LE (à ${R.leJeFeuerloescher} LE)${leStatus === 'warn' ? ` bzw. ${leMax} LE à ${R.leJeFeuerloescherMax} LE` : ''}`, soll: `≥ ${soll} LE für ${formatM2(area)}`, floorId,
    target: n ? { kind: 'item', id: fs.extinguishers[0].id } : (fc.inner ? { point: centroid(fc.inner) } : undefined),
    erlaeuterung: `Grundausstattung nach ASR A2.2 Tabelle 3 (mittlere Brandgefährdung, Grundfläche ${formatM2(area)}). Ohne Angabe wird je Feuerlöscher konservativ mit ${R.leJeFeuerloescher} LE gerechnet (6 l Schaumlöscher: 6 LE; 6 kg ABC-Pulverlöscher: 10 LE)${leStatus === 'warn' ? ' – mit 10-LE-Geräten wäre das Soll erreicht, Gerätetyp festlegen' : ''}. LE je Gerät über den Parameter „le“ am Objekt anpassen; Objekte mit Symbol „Feuerlöscher“ werden gezählt.`,
    quelle: `${SRC.a22.quelle}, Abs. 5.2, Tabelle 3`, quelleUrl: SRC.a22.url,
  });
  const targets = fs.extinguishers.map((it) => ({ x: it.x, y: it.y }));
  const maxCm = R.feuerloescherMaxEntfernungM * 100;
  let worst: { point: Vec2; distance: number; room: Room } | null = null;
  if (targets.length) {
    for (const room of fs.rooms) {
      if (room.areaM2 < 1) continue;
      const w = worstDistanceInRoom(room, targets);
      if (w && (!worst || w.distance > worst.distance)) worst = { ...w, room };
    }
  }
  out.push({
    id: `fire:distance:${floorId}`, thema: THEMA.brand, titel: `Entfernung zum Feuerlöscher ${q(fc.floor.name)}`, status: !targets.length ? 'fail' : worst && worst.distance > maxCm ? 'fail' : 'ok',
    ist: !targets.length ? 'kein Feuerlöscher' : worst ? `max. ${fmtM(worst.distance)} (${worst.room.name})` : '–', soll: `≤ ${R.feuerloescherMaxEntfernungM} m Luftlinie`, floorId,
    target: worst ? { point: worst.point } : (fc.inner ? { point: centroid(fc.inner) } : undefined),
    erlaeuterung: 'Von jedem Punkt der Fläche darf der nächste Feuerlöscher höchstens 20 m (tatsächliche Laufweglänge) entfernt sein. Die Prüfung misst die Luftlinie auf einem 50-cm-Raster.',
    quelle: `${SRC.a22.quelle}, Abs. 6.2`, quelleUrl: SRC.a22.url,
  });
}

/** f) Erste Hilfe: Verbandkästen je Stockwerk, AED. */
function firstAidChecks(fs: FloorSafety, persons: number, out: RegulationCheck[]) {
  const R = REGULATION_RULES;
  const fc = fs.fc;
  const floorId = fc.floor.id;
  const n = fs.firstAid.length;
  const large = persons > R.verbandkastenGrossAbPersonen;
  const status: RegulationStatus = n === 0 ? 'fail' : large && n < 2 ? 'info' : 'ok';
  out.push({
    id: `firstaid:${floorId}`, thema: THEMA.ersteHilfe, titel: `Verbandkasten ${q(fc.floor.name)}`, status,
    ist: `${n} Verbandk${n === 1 ? 'asten' : 'ästen'}`, soll: large ? '≥ 2 kleine (DIN 13157) oder 1 großer (DIN 13169)' : '≥ 1 Verbandkasten (DIN 13157)', floorId,
    target: n ? { kind: 'item', id: fs.firstAid[0].id } : (fc.inner ? { point: centroid(fc.inner) } : undefined),
    erlaeuterung: n === 0
      ? 'Je Stockwerk muss mindestens ein Verbandkasten gut erreichbar und gekennzeichnet vorhanden sein.'
      : large
        ? `Bei mehr als ${R.verbandkastenGrossAbPersonen} anwesenden Personen sind zwei kleine oder ein großer Verbandkasten vorzusehen (ASR A4.3 Tabelle 1; Studio mit Mitgliedern konservativ wie Beschäftigte gerechnet).`
        : 'Verbandkasten vorhanden; Standort mit Rettungszeichen E003 kennzeichnen und Inhalt regelmäßig prüfen.',
    quelle: `${SRC.a43.quelle}, Abs. 4 / ${SRC.dguv1.quelle} § 25`, quelleUrl: SRC.a43.url,
  });
}

/** g) Rettungszeichen und Sicherheitsbeleuchtung je Notausgang. */
function signageChecks(fs: FloorSafety, out: RegulationCheck[]) {
  const R = REGULATION_RULES;
  const floorId = fs.fc.floor.id;
  for (const e of fs.exits) {
    const target = { kind: 'opening' as const, id: e.door.id };
    const sign = nearestItemDistance(e.center, fs.exitSigns);
    const hasSign = sign <= R.rettungszeichenAbstandCm;
    out.push({
      id: `sign:${e.door.id}`, thema: THEMA.kennzeichnung, titel: `Rettungszeichen ${doorLabel(e)}`, status: hasSign ? 'ok' : 'warn',
      ist: hasSign ? `Rettungszeichen in ${formatLength(sign)}` : Number.isFinite(sign) ? `nächstes Rettungszeichen ${formatLength(sign)} entfernt` : 'kein Rettungszeichen', soll: `Rettungszeichen E001/E002 ≤ ${formatCm(R.rettungszeichenAbstandCm)} an der Tür`, floorId, target,
      erlaeuterung: `Notausgänge sind mit dem Rettungszeichen „Notausgang“ (DIN EN ISO 7010 E001/E002) zu kennzeichnen; Erkennungsweite eines 15 cm hohen Schilds ca. ${R.rettungszeichenErkennungsweiteM} m – im Verlauf längerer Fluchtwege zusätzliche Richtungszeichen setzen.`,
      quelle: `${SRC.a13.quelle}, Abs. 5 / DIN EN ISO 7010`, quelleUrl: SRC.a13.url,
    });
    const light = nearestItemDistance(e.center, fs.exitLights);
    const hasLight = light <= R.rettungszeichenAbstandCm;
    out.push({
      id: `light:${e.door.id}`, thema: THEMA.kennzeichnung, titel: `Sicherheitsbeleuchtung ${doorLabel(e)}`, status: hasLight ? 'ok' : 'warn',
      ist: hasLight ? `Rettungszeichenleuchte in ${formatLength(light)}` : 'keine Rettungszeichenleuchte', soll: `Rettungszeichenleuchte ≤ ${formatCm(R.rettungszeichenAbstandCm)} je Notausgang`, floorId, target,
      erlaeuterung: 'In Arbeitsstätten mit erhöhter Gefährdung sowie in Versammlungsstätten ist eine Sicherheitsbeleuchtung mit hinterleuchteten Rettungszeichen erforderlich; für ein Fitnessstudio mit Publikumsverkehr wird sie regelmäßig gefordert (Objekt „Sicherheitsleuchte / Rettungszeichenleuchte“ aus der Bibliothek platzieren).',
      quelle: `${SRC.a347.quelle}, Abs. 4`, quelleUrl: SRC.a347.url,
    });
  }
}

/** Türen am Rand eines Raums (Türmitte auf der Raumkontur, Wandstärke als Toleranz). */
function doorsOfRoom(room: Room, floor: Floor): { door: Door; wallId: string }[] {
  const out: { door: Door; wallId: string }[] = [];
  for (const o of floor.openings) {
    if (o.kind !== 'door' || o.hidden) continue;
    const w = findWall(floor, o.wallId);
    if (!w) continue;
    const c = openingPlacement(o, w).center;
    if (distanceToPolygon(c, room.polygon) <= w.thickness / 2 + 2) out.push({ door: o, wallId: w.id });
  }
  return out;
}

/** h) Barrierefreiheit. */
function accessibilityChecks(fs: FloorSafety, out: RegulationCheck[]) {
  const R = REGULATION_RULES;
  const fc = fs.fc;
  const floor = fc.floor;
  const floorId = floor.id;
  for (const wc of fs.accessibleWcs) {
    const roomIdx = fc.items.indexOf(wc) >= 0 ? fc.itemRooms[fc.items.indexOf(wc)] : [];
    const room = roomIdx.map((i) => fc.rooms[i]).sort((a, b) => a.areaM2 - b.areaM2)[0];
    const target = { kind: 'item' as const, id: wc.id };
    if (room) {
      const doors = doorsOfRoom(room, floor);
      if (doors.length) {
        const rated = doors.map(({ door, wallId }) => {
          const w = findWall(floor, wallId);
          const poly = w ? doorSwingPolygon(door, w) : [];
          const inward = doorSwings(door) && poly.length > 0 && pointInPolygon(centroid(poly), room.polygon);
          const narrow = door.width < R.barrierefreiTuerbreiteCm;
          return { door, inward, narrow, bad: narrow || inward };
        });
        const bad = rated.filter((r) => r.bad);
        const r0 = bad[0] ?? rated[0];
        const d0 = r0.door;
        const swingText = doorSwings(d0) ? (r0.inward ? 'schlägt nach innen auf' : 'schlägt nach außen auf') : d0.doorType;
        out.push({
          id: `access:door:${wc.id}`, thema: THEMA.barrierefrei, titel: `Tür zum barrierefreien WC ${q(room.name)}`, status: bad.length ? 'info' : 'ok',
          ist: `${formatCm(d0.width)}, ${swingText}`, soll: `≥ ${formatCm(R.barrierefreiTuerbreiteCm)} lichte Breite, nach außen aufschlagend`, floorId,
          target: { kind: 'opening', id: d0.id },
          erlaeuterung: 'Die Tür eines barrierefreien Sanitärraums muss mindestens 90 cm lichte Breite haben, nach außen aufschlagen und von außen entriegelbar sein (DIN 18040-1 Abs. 5.3.3).',
          quelle: `${SRC.v3a2.quelle}, Abs. 5.3.3`, quelleUrl: SRC.v3a2.url,
        });
      }
    }
    out.push({
      id: `access:space:${wc.id}`, thema: THEMA.barrierefrei, titel: 'Bewegungsfläche vor dem barrierefreien WC', status: 'info',
      ist: `Objektmaß ${formatCm(wc.width)} × ${formatCm(wc.depth)} (Bewegungsfläche enthalten)`, soll: `${R.bewegungsflaecheCm} × ${R.bewegungsflaecheCm} cm frei, seitlich 90 cm neben dem WC`, floorId, target,
      erlaeuterung: 'Die Bewegungsfläche 150 × 150 cm vor dem WC ist im Bibliotheksobjekt enthalten; ob sie tatsächlich frei bleibt (keine Waschtische, Spender oder Türflügel darin), ist im Plan nicht automatisch prüfbar – bitte manuell kontrollieren.',
      quelle: `${SRC.v3a2.quelle}, Abs. 5.3.3`, quelleUrl: SRC.v3a2.url,
    });
  }
  const narrow = fs.exits.filter((e) => e.width < R.barrierefreiTuerbreiteCm);
  if (fs.exits.length) {
    out.push({
      id: `access:exits:${floorId}`, thema: THEMA.barrierefrei, titel: `Barrierefreie Ein-/Ausgänge ${q(fc.floor.name)}`, status: narrow.length ? 'info' : 'ok',
      ist: narrow.length ? `${narrow.length} von ${fs.exits.length} Türen unter ${formatCm(R.barrierefreiTuerbreiteCm)}` : `alle ${fs.exits.length} Türen ≥ ${formatCm(R.barrierefreiTuerbreiteCm)}`, soll: `Haupteingang und Rettungswege ≥ ${formatCm(R.barrierefreiTuerbreiteCm)} lichte Breite, schwellenlos`, floorId,
      target: { kind: 'opening', id: (narrow[0] ?? fs.exits[0]).door.id },
      erlaeuterung: 'Für öffentlich zugängliche Gebäude (Sportstätten) verlangt DIN 18040-1 barrierefreie Eingänge mit mindestens 90 cm lichter Durchgangsbreite und schwellenlosen Übergängen; Rettungswege sollen auch für Rollstuhlnutzer nutzbar sein.',
      quelle: `${SRC.v3a2.quelle}, Abs. 4.3.3`, quelleUrl: SRC.v3a2.url,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Öffentliche API                                                     */
/* ------------------------------------------------------------------ */

/** Sortiert nach Themenreihenfolge, dann Status (schwerstes zuerst), dann Titel. */
export function sortRegulationChecks(list: RegulationCheck[]): RegulationCheck[] {
  const idx = (t: string) => { const i = THEMA_ORDER.indexOf(t); return i < 0 ? THEMA_ORDER.length : i; };
  return [...list].sort((a, b) => idx(a.thema) - idx(b.thema) || REGULATION_STATUS_RANK[a.status] - REGULATION_STATUS_RANK[b.status] || a.titel.localeCompare(b.titel, 'de'));
}

export function countRegulationChecks(list: RegulationCheck[]): Record<RegulationStatus, number> {
  const c: Record<RegulationStatus, number> = { ok: 0, warn: 0, fail: 0, info: 0, na: 0 };
  for (const x of list) c[x.status] += 1;
  return c;
}

export const regulations = memoByProject((project: Project): RegulationReport => {
  const ctx = analysisContext(project);
  const cap = capacity(project);
  const staff = STAFF_DEFAULT;
  const trainees = cap.persons;
  const persons = trainees + staff;
  const out: RegulationCheck[] = [];
  const routes: Record<Id, RegulationStatus> = {};
  const safeties = ctx.floors.map((fc) => floorSafety(fc, project, ctx));
  const anyAccessible = safeties.some((fs) => fs.accessibleWcs.length > 0);
  const anyAed = safeties.some((fs) => fs.aeds.length > 0);
  const anyPlan = safeties.some((fs) => fs.escapePlans.length > 0);

  safeties.forEach((fs, i) => {
    const floorPersons = (cap.floors[i]?.persons ?? 0) + (ctx.floors.length === 1 || i === 0 ? staff : 0);
    escapeLengthChecks(fs, out);
    drawnRouteChecks(fs, project, ctx, out, routes);
    exitCountChecks(fs, floorPersons, out);
    exitWidthChecks(fs, ctx.floors.length === 1 ? persons : floorPersons, out);
    extinguisherChecks(fs, ctx, out);
    firstAidChecks(fs, persons, out);
    signageChecks(fs, out);
    accessibilityChecks(fs, out);
  });
  corridorWidthChecks(project, persons, ctx, out);

  /* AED (projektweit) */
  const aedFloor = safeties.find((fs) => fs.aeds.length);
  out.push({
    id: 'firstaid:aed', projektweit: true, thema: THEMA.ersteHilfe, titel: 'AED / Defibrillator', status: anyAed ? 'ok' : 'warn',
    ist: anyAed ? `${safeties.reduce((s, fs) => s + fs.aeds.length, 0)} AED` : 'kein AED', soll: '≥ 1 AED, zentral und gekennzeichnet (E010)',
    floorId: aedFloor?.fc.floor.id, target: aedFloor ? { kind: 'item', id: aedFloor.aeds[0].id } : undefined,
    erlaeuterung: 'Ein AED ist gesetzlich nicht zwingend, wird für Sportstätten mit hoher körperlicher Belastung aber von den Unfallversicherungsträgern dringend empfohlen (DGUV Information 204-010); Standort mit Rettungszeichen E010 kennzeichnen und Ersthelfer einweisen.',
    quelle: SRC.dguv204.quelle, quelleUrl: SRC.dguv204.url,
  });

  /* Barrierefreies WC (projektweit) */
  const wcFloor = safeties.find((fs) => fs.accessibleWcs.length);
  out.push({
    id: 'access:wc', projektweit: true, thema: THEMA.barrierefrei, titel: 'Barrierefreies WC vorhanden', status: anyAccessible ? 'ok' : 'warn',
    ist: anyAccessible ? `${safeties.reduce((s, fs) => s + fs.accessibleWcs.length, 0)} barrierefreies WC` : 'kein barrierefreies WC',
    soll: '≥ 1 barrierefreies WC (DIN 18040-1)', floorId: wcFloor?.fc.floor.id, target: wcFloor ? { kind: 'item', id: wcFloor.accessibleWcs[0].id } : undefined,
    erlaeuterung: 'Öffentlich zugängliche Gebäude brauchen nach den Landesbauordnungen mindestens eine barrierefreie Toilette (Objekt „Barrierefreies WC“ aus der Bibliothek Sanitär, Maße inkl. Bewegungsfläche).',
    quelle: `${SRC.v3a2.quelle}, Abs. 5.3.3`, quelleUrl: SRC.v3a2.url,
  });

  /* i) Sanitär/Umkleiden aus der Kapazität */
  for (const c of cap.counters) {
    out.push({
      id: `sanitary:${c.key}`, thema: THEMA.sanitaer, titel: c.label, status: c.status === 'danger' ? 'warn' : c.status === 'warn' ? 'info' : 'ok',
      ist: `${c.actual}`, soll: c.recommended > c.required ? `≥ ${c.required} (empfohlen ${c.recommended})` : `≥ ${c.required}`,
      erlaeuterung: `${c.detail}. Richtwert der Fitnessbranche für ${trainees} gleichzeitig Trainierende (${formatNumber(cap.m2PerPerson, 1)} m² je Person); keine gesetzliche Mindestzahl.`,
      quelle: 'Richtwert (Kapazität) / ASR A4.1 Abs. 5 (Umkleide- und Waschräume)', quelleUrl: SRC.a41.url,
    });
  }
  const staffWc = requiredStaffToilets(staff);
  out.push({
    id: 'sanitary:staff-wc', thema: THEMA.sanitaer, titel: 'Toiletten für Beschäftigte', status: 'info',
    ist: `${cap.toilets} WC + ${cap.urinals} Urinale gesamt · ${staff} Beschäftigte angenommen`, soll: `≥ ${staffWc} Toilette${staffWc === 1 ? '' : 'n'} (bis 5 Beschäftigte je Geschlecht 1)`,
    erlaeuterung: `ASR A4.1 Tabelle 2 verlangt bei bis zu 5 Beschäftigten je Geschlecht mindestens eine Toilette; Mitglieds-WCs dürfen mitgenutzt werden, wenn sie in der Nähe des Arbeitsplatzes liegen. Beschäftigtenzahl ist als Konstante (${STAFF_DEFAULT}) hinterlegt.`,
    quelle: `${SRC.a41.quelle}, Abs. 5.3, Tabelle 2`, quelleUrl: SRC.a41.url,
  });

  /* j) Gerätefreiräume */
  const collisions = warnings(project).filter((w) => w.kind === 'collision');
  out.push({
    id: 'equipment:clearance', projektweit: true, thema: THEMA.geraete, titel: 'Freiräume und Sicherheitszonen der Trainingsgeräte', status: collisions.length ? 'warn' : 'ok',
    ist: collisions.length ? `${collisions.length} Kollisions-/Sicherheitszonen-Warnung${collisions.length === 1 ? '' : 'en'}` : 'keine Kollisionen',
    soll: 'Freiraum nach Herstellerangabe (DIN EN ISO 20957-1: mind. 60 cm Trainingsfreiraum)', floorId: collisions[0]?.floorId, target: collisions[0]?.target,
    erlaeuterung: 'Um Trainingsgeräte muss ein Freiraum entsprechend der Herstellerangaben eingehalten werden (Sicherheitszone je Objekt). Überlappungen sind unter „Planungs-Warnungen“ einzeln aufgeführt.',
    quelle: SRC.iso20957.quelle, quelleUrl: SRC.iso20957.url,
  });

  /* k) Versammlungsstätte */
  const R = REGULATION_RULES;
  const vs = persons > R.versammlungsstaetteAbPersonen;
  out.push({
    id: 'assembly', thema: THEMA.versammlung, titel: 'Versammlungsstättenverordnung', status: vs ? 'info' : 'na',
    ist: `${persons} Bemessungspersonen`, soll: `Anwendbar ab ${R.versammlungsstaetteAbPersonen} Personen`,
    erlaeuterung: vs
      ? 'VStättVO anwendbar: Rettungswegbreite 1,20 m je 200 Personen, Sicherheitsbeleuchtung, Brandmeldeanlage und Brandschutzordnung erforderlich; Genehmigung als Versammlungsstätte mit Bestuhlungs-/Rettungswegeplan.'
      : `Unter ${R.versammlungsstaetteAbPersonen} Personen gilt die Versammlungsstättenverordnung nicht; maßgeblich bleiben ASR und Landesbauordnung.`,
    quelle: `${SRC.mvstaett.quelle} § 1`, quelleUrl: SRC.mvstaett.url,
  });

  /* l) Organisatorisches */
  const planFloor = safeties.find((fs) => fs.escapePlans.length);
  out.push({
    id: 'orga:escape-plan', projektweit: true, thema: THEMA.orga, titel: 'Flucht- und Rettungsplan aushängen', status: anyPlan ? 'ok' : 'info',
    ist: anyPlan ? `${safeties.reduce((s, fs) => s + fs.escapePlans.length, 0)} Aushang platziert` : 'kein Aushang platziert', soll: 'Aushang je Stockwerk an zentraler Stelle (DIN ISO 23601)',
    floorId: planFloor?.fc.floor.id, target: planFloor ? { kind: 'item', id: planFloor.escapePlans[0].id } : undefined,
    erlaeuterung: 'Bei unübersichtlicher Fluchtwegführung oder Publikumsverkehr ist ein Flucht- und Rettungsplan nach DIN ISO 23601 auszuhängen (Objekt „Flucht- und Rettungsplan (Aushang)“ aus der Bibliothek). Die gezeichneten Fluchtwege dienen als Grundlage.',
    quelle: SRC.iso23601.quelle, quelleUrl: SRC.iso23601.url,
  });
  out.push({
    id: 'orga:fire-wardens', thema: THEMA.orga, titel: 'Brandschutzhelfer', status: 'info',
    ist: `${staff} Beschäftigte angenommen`, soll: `≥ ${requiredFireWardens(staff)} Brandschutzhelfer (5 %, mind. 1)`,
    erlaeuterung: 'Mindestens 5 % der Beschäftigten sind als Brandschutzhelfer auszubilden; bei Schichtbetrieb muss in jeder Schicht einer anwesend sein.',
    quelle: `${SRC.a22.quelle}, Abs. 7.3 / ${SRC.dguv205.quelle}`, quelleUrl: SRC.a22.url,
  });
  out.push({
    id: 'orga:first-aiders', thema: THEMA.orga, titel: 'Ersthelfer', status: 'info',
    ist: `${staff} Beschäftigte angenommen`, soll: `≥ ${requiredFirstAiders(staff)} Ersthelfer`,
    erlaeuterung: 'Bei 2 bis 20 Versicherten ist ein Ersthelfer erforderlich, darüber 10 % der Beschäftigten (sonstige Betriebe). Trainer mit Erste-Hilfe-Ausbildung zählen; Fortbildung alle 2 Jahre.',
    quelle: `${SRC.dguv1.quelle} § 26`, quelleUrl: SRC.dguv1.url,
  });
  out.push({
    id: 'orga:extinguisher-check', thema: THEMA.orga, titel: 'Prüfung der Feuerlöscher', status: 'info',
    ist: `${safeties.reduce((s, fs) => s + fs.extinguishers.length, 0)} Feuerlöscher`, soll: `Sachkundigenprüfung alle ${R.feuerloescherPruefintervallJahre} Jahre`,
    erlaeuterung: 'Feuerlöscher sind mindestens alle zwei Jahre durch eine befähigte Person zu prüfen und mit Prüfplakette zu versehen; Standorte mit Brandschutzzeichen F001 kennzeichnen.',
    quelle: `${SRC.a22.quelle}, Abs. 7.1`, quelleUrl: SRC.a22.url,
  });
  if (cap.showers > 0) {
    out.push({
      id: 'orga:legionella', thema: THEMA.orga, titel: 'Legionellenprüfung (Duschen)', status: 'info',
      ist: `${cap.showers} Duschen`, soll: 'Untersuchung der Trinkwasser-Installation alle 3 Jahre (gewerblich), Warmwasser ≥ 60 °C',
      erlaeuterung: 'Bei gewerblich genutzten Großanlagen zur Trinkwassererwärmung mit Duschen ist eine regelmäßige Legionellenuntersuchung durch ein zugelassenes Labor vorgeschrieben.',
      quelle: SRC.trinkw.quelle, quelleUrl: SRC.trinkw.url,
    });
  }

  const checks = sortRegulationChecks(out);
  return { checks, counts: countRegulationChecks(checks), persons, trainees, staff, routes };
});

/** Fluchtweg-Status eines gezeichneten Fluchtwegs (für Ebenen/Export); 'na' ohne Prüfung. */
export function escapeRouteStatus(project: Project, id: Id): RegulationStatus {
  return regulations(project).routes[id] ?? 'na';
}

/** Prüfungen eines Stockwerks (inkl. projektweiter Prüfungen ohne floorId). */
export function regulationChecksFor(report: RegulationReport, scope: 'active' | 'all', activeFloorId: Id | null): RegulationCheck[] {
  if (scope === 'all' || !activeFloorId) return report.checks;
  return report.checks.filter((c) => c.projektweit || !c.floorId || c.floorId === activeFloorId);
}
