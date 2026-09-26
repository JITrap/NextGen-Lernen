import type { EquipmentDef, LibraryArea, MuscleGroup, SymbolKind, Project, PriceConfidence } from '@/types';
import atlantisJson from '../../../data/atlantis.json';
import primeJson from '../../../data/prime.json';
import genericJson from './generic.json';
import pricesJson from './prices.json';

/** Rohformat der Herstellerdateien (Schema laut Auftrag 5.1). */
export interface RawEquipment {
  id: string;
  kategorie: string;
  unterkategorie: string;
  hersteller: string;
  serie?: string;
  modell?: string;
  name: string;
  breite_cm: number;
  tiefe_cm: number;
  hoehe_cm: number | null;
  gewicht_kg?: number | null;
  extra?: string;
  hinweis?: string;
  sicherheitszone_cm: { vorne: number; hinten: number; links: number; rechts: number };
  form: 'rechteck' | 'polygon' | 'kreis';
  polygon?: [number, number][];
  skalierbar: boolean;
  preis_eur?: number;
  quelle_url?: string;
  verifiziert: boolean;
  nur_an_rack?: boolean;
  wandmontage?: boolean;
}

export interface RawDataFile {
  hersteller: string;
  quelle: string;
  stand: string;
  hinweis?: string;
  anzahl: number;
  geraete: RawEquipment[];
}

export const ATLANTIS_DATA = atlantisJson as RawDataFile;
export const PRIME_DATA = primeJson as RawDataFile;

/* ------------------------------------------------------------------ */
/* Preise (prices.json)                                                */
/* ------------------------------------------------------------------ */

/** Ein Preiseintrag aus prices.json (netto EUR, ohne Fracht/Zoll/MwSt.). */
export interface PriceEntry {
  preis_eur: number;
  quelle: string;
  quelle_url?: string;
  stand?: string;
  konfidenz: PriceConfidence;
  hinweis?: string;
}
export interface PriceFile {
  stand: string;
  hinweis?: string;
  preise: Record<string, PriceEntry>;
}

export const PRICE_DATA = pricesJson as PriceFile;

const PRICE_CONFIDENCES: ReadonlySet<string> = new Set<PriceConfidence>(['liste', 'haendler', 'schaetzung']);

/** Preiseintrag zu einer Bibliotheks-ID (nur gültige Einträge: endliche Zahl ≥ 0). */
export function priceEntry(id: string): PriceEntry | undefined {
  const e = Object.prototype.hasOwnProperty.call(PRICE_DATA.preise, id) ? PRICE_DATA.preise[id] : undefined;
  if (!e || typeof e.preis_eur !== 'number' || !Number.isFinite(e.preis_eur) || e.preis_eur < 0) return undefined;
  return e;
}

/**
 * Ergänzt eine Definition um den Bibliothekspreis aus prices.json samt Quelle/Stand/Konfidenz.
 * Ein Preis im Rohdatensatz (Herstellerdaten) hat Vorrang und wird als Listenpreis ausgewiesen.
 */
export function withPrice(def: EquipmentDef): EquipmentDef {
  const own = typeof def.preis_eur === 'number' && Number.isFinite(def.preis_eur);
  const e = priceEntry(def.id);
  if (own) {
    return { ...def, preisQuelle: def.preisQuelle ?? 'Herstellerdaten', preisQuelleUrl: def.preisQuelleUrl ?? def.quelle_url, preisKonfidenz: def.preisKonfidenz ?? 'liste', preisStand: def.preisStand ?? (e?.stand ?? PRICE_DATA.stand) };
  }
  if (!e) return def;
  const out: EquipmentDef = {
    ...def,
    preis_eur: e.preis_eur,
    preisQuelle: e.quelle,
    preisStand: e.stand ?? PRICE_DATA.stand,
    preisKonfidenz: PRICE_CONFIDENCES.has(e.konfidenz) ? e.konfidenz : 'schaetzung',
  };
  if (e.quelle_url) out.preisQuelleUrl = e.quelle_url;
  if (e.hinweis) out.preisHinweis = e.hinweis;
  return out;
}

/** Lesbare Bezeichnung der Preis-Konfidenz. */
export const PRICE_CONFIDENCE_LABELS: Record<PriceConfidence, string> = {
  liste: 'Listenpreis',
  haendler: 'Händlerangabe',
  schaetzung: 'Schätzung',
};

/** Symbol für Kraftgeräte anhand Unterkategorie / Name. */
export function strengthSymbol(raw: RawEquipment): SymbolKind {
  const sub = raw.unterkategorie.toLowerCase();
  const n = raw.name.toLowerCase();
  if (sub.includes('weightlifting platform') || sub.includes('calf platform') || sub.includes('accessories')) return 'platform';
  if (sub.includes('dumbbell rack') || n.includes('dumbbell rack')) return 'dumbbell-rack';
  if (sub.includes('weight rack') || n.includes('plate rack') || n.includes('barbell rack') || n.includes('accessory rack') || n.includes('bar holder')) return 'plate-rack';
  if (n.includes('smith')) return 'smith';
  if (n.includes('half rack')) return 'half-rack';
  if (n.includes('power rack') || sub.includes('prodigy') || n.includes('hlp') || sub.includes('multistation') || n.includes('chin-up beam')) return 'rack';
  if (sub.includes('functional trainer') || n.includes('functional trainer') || n.includes('pulley') || n.includes('smart arm') || n.includes('cable')) return 'cable';
  if (sub.includes('leg press') || n.includes('leg press') || n.includes('pendulum') || n.includes('belt squat') || n.includes('pivot press') || n.includes('power squat')) return 'leg-press';
  if (n.includes('hack squat')) return 'hack-squat';
  if (sub.includes('lat pulldown') || n.includes('pulldown') || n.includes('chin') || sub.includes('pull-up')) return 'lat-pulldown';
  if (sub.includes('chest press') || sub.includes('olympic bench') || n.includes('chest press') || n.includes('incline press') || n.includes('bench press')) return 'chest-press';
  if (sub.includes('rowing') || n.includes('row')) return 'row';
  if (sub.includes('biceps') || n.includes('curl') || n.includes('preacher')) return 'curl';
  if (sub.includes('calf') || n.includes('calf') || n.includes('tibia')) return 'calf';
  if (sub.includes('dip') || n.includes('dip')) return 'dip';
  if (sub.includes('strongman') || n.includes('sled') || n.includes('farmer')) return 'sled';
  if (sub.includes('bench') || n.includes('bench')) return 'bench';
  return 'machine';
}

const STRENGTH_MUSCLES = new Set<string>(['Beine', 'Brust', 'Rücken', 'Schultern', 'Arme', 'Rumpf', 'Kabel/Functional', 'Racks', 'Bänke', 'Plattformen', 'Ablagen']);

/** Wandelt einen Hersteller-Rohdatensatz in eine EquipmentDef um. */
export function fromRaw(raw: RawEquipment): EquipmentDef {
  const isStrength = STRENGTH_MUSCLES.has(raw.kategorie);
  return {
    ...raw,
    bereich: isStrength ? 'Kraftgeräte' : ((raw.kategorie as LibraryArea) ?? 'Eigene'),
    muskelgruppe: isStrength ? (raw.kategorie as MuscleGroup) : undefined,
    symbol: strengthSymbol(raw),
    tags: [raw.hersteller, raw.serie ?? '', raw.modell ?? '', raw.unterkategorie].filter(Boolean),
  };
}

/** Generische Einträge liegen bereits im EquipmentDef-Format (mit bereich/symbol). */
export const GENERIC_LIBRARY: EquipmentDef[] = (genericJson as { geraete: EquipmentDef[] }).geraete.map(withPrice);

export const ATLANTIS_LIBRARY: EquipmentDef[] = ATLANTIS_DATA.geraete.map((r) => withPrice(fromRaw(r)));
export const PRIME_LIBRARY: EquipmentDef[] = PRIME_DATA.geraete.map((r) => withPrice(fromRaw(r)));

/** Gesamte eingebaute Bibliothek. */
export const BUILTIN_LIBRARY: EquipmentDef[] = [...ATLANTIS_LIBRARY, ...PRIME_LIBRARY, ...GENERIC_LIBRARY];

const BUILTIN_MAP = new Map(BUILTIN_LIBRARY.map((d) => [d.id, d]));

/** Sucht eine Definition (eingebaut oder benutzerdefiniert). */
export function getDef(id: string, project?: Pick<Project, 'customEquipment'>): EquipmentDef | undefined {
  return BUILTIN_MAP.get(id) ?? project?.customEquipment.find((d) => d.id === id);
}

/** Vollständige Bibliothek inkl. eigener Geräte. */
export function fullLibrary(project?: Pick<Project, 'customEquipment'>): EquipmentDef[] {
  return project?.customEquipment.length ? [...BUILTIN_LIBRARY, ...project.customEquipment] : BUILTIN_LIBRARY;
}

export const LIBRARY_AREAS: LibraryArea[] = [
  'Kraftgeräte', 'Freihantel-Zubehör', 'Cardio', 'Functional', 'Empfang & Lounge', 'Umkleide', 'Sanitär', 'Wellness',
  'Kursraum', 'Büro & Personal', 'Lager & Technik', 'Ausstattung', 'Bauelemente', 'Eigene',
];
export const MUSCLE_GROUPS: MuscleGroup[] = ['Beine', 'Brust', 'Rücken', 'Schultern', 'Arme', 'Rumpf', 'Kabel/Functional', 'Racks', 'Bänke', 'Plattformen', 'Ablagen'];

export function manufacturers(lib: EquipmentDef[]): string[] {
  return [...new Set(lib.map((d) => d.hersteller))].sort();
}
export function seriesOf(lib: EquipmentDef[], manufacturer?: string): string[] {
  return [...new Set(lib.filter((d) => !manufacturer || d.hersteller === manufacturer).map((d) => d.serie).filter((s): s is string => !!s))].sort();
}
