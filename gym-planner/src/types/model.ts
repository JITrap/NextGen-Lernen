/**
 * Domänenmodell des GymPlanners.
 * Alle Längen intern in Zentimetern (1 Einheit = 1 cm), Winkel in Grad, Gewichte in kg.
 * Koordinatensystem: x nach rechts, y nach unten (Draufsicht), Ursprung frei.
 */

export type Id = string;

export interface Vec2 {
  x: number;
  y: number;
}

/* ------------------------------------------------------------------ */
/* Bibliothek                                                          */
/* ------------------------------------------------------------------ */

export type Manufacturer = 'Atlantis' | 'Prime' | 'Generisch' | string;

/** Muskelgruppen für Kraftgeräte (Kategorie laut Auftrag). */
export type MuscleGroup =
  | 'Beine' | 'Brust' | 'Rücken' | 'Schultern' | 'Arme' | 'Rumpf'
  | 'Kabel/Functional' | 'Racks' | 'Bänke' | 'Plattformen' | 'Ablagen';

/** Übergeordneter Bereich in der Bibliothek. */
export type LibraryArea =
  | 'Kraftgeräte' | 'Freihantel-Zubehör' | 'Cardio' | 'Functional'
  | 'Empfang & Lounge' | 'Umkleide' | 'Sanitär' | 'Wellness' | 'Kursraum'
  | 'Büro & Personal' | 'Lager & Technik' | 'Ausstattung' | 'Bauelemente' | 'Eigene';

export interface SafetyZone {
  vorne: number;
  hinten: number;
  links: number;
  rechts: number;
}

export type ShapeKind = 'rechteck' | 'polygon' | 'kreis';

/**
 * Draufsicht-Symbol (vereinfachte Silhouette). Der Renderer zeichnet je Symbol eine eigene Form.
 * Neue Symbole werden in src/editor/symbols registriert.
 */
export type SymbolKind =
  | 'machine' | 'bench' | 'rack' | 'half-rack' | 'smith' | 'platform' | 'dumbbell-rack'
  | 'plate-rack' | 'cable' | 'leg-press' | 'hack-squat' | 'lat-pulldown' | 'chest-press'
  | 'row' | 'curl' | 'calf' | 'dip' | 'sled' | 'treadmill' | 'curved-treadmill' | 'elliptical'
  | 'bike' | 'recumbent-bike' | 'spin-bike' | 'air-bike' | 'rower' | 'stairmaster' | 'skierg'
  | 'turf' | 'kettlebell-rack' | 'plyo-box' | 'mat' | 'ball-rack' | 'rope-anchor' | 'rig'
  | 'wall-bars' | 'punching-bag' | 'counter' | 'turnstile' | 'fridge' | 'vending' | 'sofa'
  | 'table' | 'chair' | 'wardrobe' | 'screen' | 'locker' | 'locker-row' | 'bench-seat'
  | 'mirror' | 'hairdryer' | 'sink' | 'cabin' | 'shower' | 'shower-row' | 'partition'
  | 'toilet' | 'urinal' | 'changing-table' | 'dispenser' | 'laundry' | 'valuables' | 'sauna'
  | 'infrared' | 'steam' | 'plunge' | 'ice-fountain' | 'kneipp' | 'shower-experience'
  | 'lounger' | 'waterbed' | 'solarium' | 'red-light' | 'massage-chair' | 'massage-table'
  | 'whirlpool' | 'tea-station' | 'step' | 'mat-rack' | 'podium' | 'audio' | 'desk'
  | 'office-chair' | 'filing-cabinet' | 'meeting-table' | 'shelf' | 'hvac' | 'washer'
  | 'cleaning-cart' | 'switchboard' | 'plant' | 'speaker' | 'tv' | 'water-dispenser'
  | 'sanitizer' | 'trash' | 'extinguisher' | 'first-aid' | 'aed' | 'exit-sign' | 'camera'
  | 'column-round' | 'column-square' | 'radiator' | 'vent' | 'stairs-straight' | 'stairs-l'
  | 'stairs-u' | 'stairs-spiral' | 'elevator' | 'ramp' | 'barbell-rack' | 'plate-tree'
  | 'dumbbells' | 'barbell' | 'generic';

/** Ein Eintrag der Objektbibliothek (Schema laut Auftrag, Abschnitt 5.1, plus App-Felder). */
export interface EquipmentDef {
  id: string;
  kategorie: string;
  unterkategorie: string;
  hersteller: Manufacturer;
  serie?: string;
  modell?: string;
  name: string;
  breite_cm: number;
  tiefe_cm: number;
  hoehe_cm: number | null;
  gewicht_kg?: number | null;
  extra?: string;
  hinweis?: string;
  sicherheitszone_cm: SafetyZone;
  form: ShapeKind;
  polygon?: [number, number][];
  skalierbar: boolean;
  preis_eur?: number;
  quelle_url?: string;
  verifiziert: boolean;
  /* --- App-Felder (nicht Teil der Herstellerdaten) --- */
  /** Übergeordneter Bibliotheks-Bereich (Kraftgeräte, Cardio, Umkleide …). */
  bereich: LibraryArea;
  /** Muskelgruppe, nur bei Kraftgeräten gesetzt. */
  muskelgruppe?: MuscleGroup;
  /** Draufsicht-Symbol. */
  symbol: SymbolKind;
  /** Nur an Atlantis-Racks andockbar. */
  nur_an_rack?: boolean;
  /** Muss an einer Wand hängen. */
  wandmontage?: boolean;
  /** Mengenposition ohne Stellfläche (z. B. Hantelscheiben) – nur in Stückliste. */
  ohne_stellflaeche?: boolean;
  /** Vom Nutzer angelegt (im Projekt gespeichert). */
  benutzerdefiniert?: boolean;
  /** Spezielle Parameter, z. B. Spindreihe (Fächer), Treppen (Stufen). */
  params?: Record<string, number | string | boolean>;
  /** Suchbegriffe/Tags. */
  tags?: string[];
}

/* ------------------------------------------------------------------ */
/* Gebäude                                                             */
/* ------------------------------------------------------------------ */

export type FloorCovering =
  | 'Gummiboden' | 'Kautschuk' | 'Vinyl/PVC' | 'Kunstrasen' | 'Parkett' | 'Fliesen'
  | 'Beton' | 'Teppich' | 'Holz' | 'Epoxid' | string;

export interface Hall {
  /** Außenkante der Außenwände (Polygon, im Uhrzeigersinn oder gegen – wird normalisiert). */
  polygon: Vec2[];
  /** Wandstärke der Außenwände in cm. */
  wallThickness: number;
  floorCovering: FloorCovering;
}

export type WallType = 'Trockenbau' | 'Mauerwerk' | 'Glaswand' | 'Brüstung' | 'Trennwand/Netz' | 'Außenwand';

export interface Wall {
  id: Id;
  start: Vec2;
  end: Vec2;
  /** Stärke in cm (10 / 12,5 / 17,5 / 24 …). */
  thickness: number;
  type: WallType;
  /** Höhe in cm; null = bis zur Decke. */
  height: number | null;
  locked?: boolean;
  hidden?: boolean;
}

export type RoomType =
  | 'Trainingsfläche Freihantel' | 'Maschinen' | 'Cardio' | 'Functional/Stretching' | 'Kursraum'
  | 'Empfang/Lounge' | 'Umkleide Damen' | 'Umkleide Herren' | 'Umkleide Divers' | 'Duschen' | 'WC'
  | 'Wellness/Sauna' | 'Ruheraum' | 'Büro' | 'Lager' | 'Technik/Lüftung' | 'Putzraum' | 'Personalraum'
  | 'Kinderbetreuung' | 'Physio/Massage' | 'Flur/Verkehrsfläche' | 'Treppenhaus' | 'Sonstiges';

export type RoomLabelMode = 'name+area' | 'name' | 'area' | 'none';

/** Metadaten eines Raums. Für automatisch erkannte Räume per Schlüssel des Wandzugs, für Zonen per Polygon. */
export interface RoomMeta {
  name: string;
  type: RoomType;
  /** Farbe überschreibt Typ-Farbe. */
  color?: string;
  floorCovering?: FloorCovering;
  labelMode?: RoomLabelMode;
  note?: string;
}

/** Manuell gezeichnete Zone (Rechteck/Polygon) ohne Wände. */
export interface Zone extends RoomMeta {
  id: Id;
  polygon: Vec2[];
  locked?: boolean;
  hidden?: boolean;
}

/** Ein Raum, wie ihn die App anzeigt (automatisch erkannt oder Zone). */
export interface Room extends RoomMeta {
  id: Id;
  polygon: Vec2[];
  source: 'auto' | 'zone';
  /** Bei auto: stabiler Schlüssel des Wandzugs (für RoomMeta). */
  loopKey?: string;
  areaM2: number;
  perimeterCm: number;
  centroid: Vec2;
  /** Löcher (Raum im Raum), werden von areaM2 abgezogen; polygon bleibt die Außenkante. */
  holes?: Vec2[][];
}

export type DoorType = 'einflügelig' | 'zweiflügelig' | 'Schiebetür' | 'Glastür' | 'Notausgang' | 'Rolltor';

export interface OpeningBase {
  id: Id;
  wallId: Id;
  /** Mittelpunkt entlang der Wand, in cm ab Wandanfang. */
  offset: number;
  width: number;
  locked?: boolean;
  hidden?: boolean;
  note?: string;
}

export interface Door extends OpeningBase {
  kind: 'door';
  doorType: DoorType;
  height: number;
  /** Anschlag links/rechts (Aufschlagrichtung) */
  hinge: 'left' | 'right';
  /** Öffnet zur „linken“ Wandseite (Normalenrichtung) oder zur rechten. */
  swingSide: 'a' | 'b';
}

export interface Window extends OpeningBase {
  kind: 'window';
  height: number;
  sillHeight: number;
}

export interface Mirror extends OpeningBase {
  kind: 'mirror';
  height: number;
  /** Auf welcher Wandseite hängt der Spiegel. */
  side: 'a' | 'b';
}

export type Opening = Door | Window | Mirror;

export type ItemKind = 'equipment' | 'stairs' | 'elevator' | 'column' | 'radiator' | 'vent' | 'ramp';

export type StairsType = 'gerade' | 'L' | 'U' | 'Wendeltreppe';

/** Platziertes Objekt (Gerät, Möbel, Bauelement). */
export interface PlacedItem {
  id: Id;
  kind: ItemKind;
  /** Verweis auf EquipmentDef.id (Bibliothek oder benutzerdefiniert). */
  defId: string;
  /** Mittelpunkt. */
  x: number;
  y: number;
  /** Drehung in Grad, im Uhrzeigersinn (0 = „vorne“ zeigt nach unten/+y). */
  rotation: number;
  /** Aktuelle Maße (bei nicht skalierbaren = Originalmaß). */
  width: number;
  depth: number;
  height: number | null;
  /** Sicherheitszone (kann pro Gerät angepasst werden). */
  safetyZone: SafetyZone;
  safetyZoneEnabled: boolean;
  locked?: boolean;
  hidden?: boolean;
  groupId?: Id;
  /** Überschreibt den Bibliotheksnamen. */
  label?: string;
  priceEur?: number;
  note?: string;
  /** Für Treppen/Aufzüge: alle Stockwerke, auf denen das Element erscheint. */
  linkedFloorIds?: Id[];
  /** Zusatzparameter (Spindreihe: faecher; Treppe: typ, stufen; Säule: rund/eckig …). */
  params?: Record<string, number | string | boolean>;
  /** Für Rack-Module: an welches Rack angedockt. */
  dockedTo?: Id;
  /** Für Wandmontage-Objekte: an welche Wand. */
  wallId?: Id;
}

export interface Group {
  id: Id;
  name?: string;
  itemIds: Id[];
}

/** Luftraum („offen nach unten“), zählt nicht zur Nutzfläche. */
export interface VoidArea {
  id: Id;
  polygon: Vec2[];
  name?: string;
}

export interface TextNote {
  id: Id;
  kind: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  rotation: number;
  color?: string;
  locked?: boolean;
  hidden?: boolean;
}

export interface MeasureLine {
  id: Id;
  kind: 'measure';
  start: Vec2;
  end: Vec2;
  locked?: boolean;
  hidden?: boolean;
}

export type Annotation = TextNote | MeasureLine;

export interface Floor {
  id: Id;
  name: string;
  /** Sortierreihenfolge (UG negativ, EG 0, OG 1 …). */
  order: number;
  ceilingHeight: number;
  hall: Hall | null;
  walls: Wall[];
  zones: Zone[];
  /** Metadaten automatisch erkannter Räume, Schlüssel = Wandzug-Schlüssel. */
  roomMeta: Record<string, RoomMeta>;
  openings: Opening[];
  items: PlacedItem[];
  groups: Group[];
  voids: VoidArea[];
  annotations: Annotation[];
}

/* ------------------------------------------------------------------ */
/* Projekt                                                             */
/* ------------------------------------------------------------------ */

export type GridSize = 5 | 10 | 25 | 50 | 100;

export interface ProjectSettings {
  gridSize: GridSize;
  showGrid: boolean;
  snapEnabled: boolean;
  /** kg/m² Grenzwert für Bodenlast-Warnung. */
  floorLoadLimitKgM2: number;
  /** m² Trainingsfläche pro Person. */
  m2PerPerson: number;
  /** Mindestbreite Lauf-/Fluchtweg in cm. */
  minEscapeRouteCm: number;
  /** Standard-Sicherheitszone bei Kraftgeräten (cm rundum). */
  defaultSafetyZoneCm: number;
  showLowerFloor: boolean;
  lowerFloorOpacity: number;
}

export interface LayerVisibility {
  grid: boolean;
  walls: boolean;
  rooms: boolean;
  items: boolean;
  safetyZones: boolean;
  dimensions: boolean;
  labels: boolean;
  furniture: boolean;
  lowerFloor: boolean;
  openings: boolean;
  annotations: boolean;
  voids: boolean;
}

export interface Project {
  id: Id;
  /** Schema-Version für Migrationen. */
  schemaVersion: number;
  name: string;
  /** Für Varianten: ID des Ursprungsprojekts und Variantenname. */
  parentId?: Id;
  variantName?: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  layers: LayerVisibility;
  floors: Floor[];
  activeFloorId: Id;
  /** Vom Nutzer angelegte Geräte. */
  customEquipment: EquipmentDef[];
  favorites: string[];
  /** Preisüberschreibungen je Bibliotheks-ID. */
  priceOverrides: Record<string, number>;
}

/** Eintrag in der Projektliste (localStorage), Daten liegen in IndexedDB. */
export interface ProjectSummary {
  id: Id;
  name: string;
  parentId?: Id;
  variantName?: string;
  updatedAt: string;
  createdAt: string;
  floorCount: number;
  totalAreaM2: number;
}

export interface ProjectVersion {
  id: Id;
  projectId: Id;
  savedAt: string;
  label?: string;
  project: Project;
}

/* ------------------------------------------------------------------ */
/* Werkzeuge & UI                                                      */
/* ------------------------------------------------------------------ */

export type Tool =
  | 'select' | 'hall-rect' | 'hall-polygon' | 'wall' | 'zone-rect' | 'zone-polygon'
  | 'door' | 'window' | 'mirror' | 'stairs' | 'elevator' | 'column' | 'measure' | 'text'
  | 'void' | 'pan';

export type SelectableKind = 'item' | 'wall' | 'zone' | 'room' | 'opening' | 'annotation' | 'void' | 'hallVertex' | 'hallEdge';

export interface Selection {
  kind: SelectableKind;
  id: Id;
}

/* ------------------------------------------------------------------ */
/* Analyse                                                             */
/* ------------------------------------------------------------------ */

export type WarningKind =
  | 'collision' | 'door-swing' | 'emergency-exit' | 'escape-route' | 'ceiling-height'
  | 'floor-load' | 'changing-room' | 'wellness' | 'outside-hall' | 'unverified' | 'rack-module'
  | 'capacity';

export interface PlanningWarning {
  id: string;
  kind: WarningKind;
  severity: 'error' | 'warning' | 'info';
  message: string;
  floorId: Id;
  /** Ziel zum Hinspringen. */
  target?: { kind: SelectableKind; id: Id } | { point: Vec2 };
}
