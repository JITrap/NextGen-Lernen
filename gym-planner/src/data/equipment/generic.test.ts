import { describe, it, expect } from 'vitest';
import type { EquipmentDef, LibraryArea, SymbolKind } from '@/types';
import { GENERIC_LIBRARY, BUILTIN_LIBRARY, ATLANTIS_LIBRARY, PRIME_LIBRARY, LIBRARY_AREAS, getDef } from './index';
import { createItemFromDef } from '@/store/factories';
import { lockerColumns, lockerCount, lockerTiers } from '@/editor/symbols/common';

/** Alle gültigen Draufsicht-Symbole (Kopie der Union `SymbolKind` aus src/types/model.ts). */
const SYMBOL_KINDS: readonly SymbolKind[] = [
  'machine', 'bench', 'rack', 'half-rack', 'smith', 'platform', 'dumbbell-rack',
  'plate-rack', 'cable', 'leg-press', 'hack-squat', 'lat-pulldown', 'chest-press',
  'row', 'curl', 'calf', 'dip', 'sled', 'treadmill', 'curved-treadmill', 'elliptical',
  'bike', 'recumbent-bike', 'spin-bike', 'air-bike', 'rower', 'stairmaster', 'skierg',
  'turf', 'kettlebell-rack', 'plyo-box', 'mat', 'ball-rack', 'rope-anchor', 'rig',
  'wall-bars', 'punching-bag', 'counter', 'turnstile', 'fridge', 'vending', 'sofa',
  'table', 'chair', 'wardrobe', 'screen', 'locker', 'locker-row', 'bench-seat',
  'mirror', 'hairdryer', 'sink', 'cabin', 'shower', 'shower-row', 'partition',
  'toilet', 'urinal', 'changing-table', 'dispenser', 'laundry', 'valuables', 'sauna',
  'infrared', 'steam', 'plunge', 'ice-fountain', 'kneipp', 'shower-experience',
  'lounger', 'waterbed', 'solarium', 'red-light', 'massage-chair', 'massage-table',
  'whirlpool', 'tea-station', 'step', 'mat-rack', 'podium', 'audio', 'desk',
  'office-chair', 'filing-cabinet', 'meeting-table', 'shelf', 'hvac', 'washer',
  'cleaning-cart', 'switchboard', 'plant', 'speaker', 'tv', 'water-dispenser',
  'sanitizer', 'trash', 'extinguisher', 'first-aid', 'aed', 'exit-sign', 'camera',
  'column-round', 'column-square', 'radiator', 'vent', 'stairs-straight', 'stairs-l',
  'stairs-u', 'stairs-spiral', 'elevator', 'ramp', 'barbell-rack', 'plate-tree',
  'dumbbells', 'barbell', 'generic',
];
const SYMBOL_SET = new Set<string>(SYMBOL_KINDS);
const AREA_SET = new Set<string>(LIBRARY_AREAS);

/** Cardio-Tabelle aus Abschnitt 5.3 (B × T × H in cm) – muss exakt übernommen sein. */
const CARDIO_TABLE: { id: string; name: string; b: number; t: number; h: number; symbol: SymbolKind }[] = [
  { id: 'gen-cardio-laufband', name: 'Laufband', b: 90, t: 210, h: 160, symbol: 'treadmill' },
  { id: 'gen-cardio-curved-treadmill', name: 'Curved Treadmill', b: 90, t: 190, h: 170, symbol: 'curved-treadmill' },
  { id: 'gen-cardio-crosstrainer', name: 'Crosstrainer', b: 75, t: 210, h: 170, symbol: 'elliptical' },
  { id: 'gen-cardio-ergometer', name: 'Ergometer', b: 60, t: 120, h: 140, symbol: 'bike' },
  { id: 'gen-cardio-liegeergometer', name: 'Liegeergometer', b: 70, t: 170, h: 130, symbol: 'recumbent-bike' },
  { id: 'gen-cardio-spinning-bike', name: 'Spinning-Bike', b: 55, t: 125, h: 110, symbol: 'spin-bike' },
  { id: 'gen-cardio-air-bike', name: 'Air Bike', b: 65, t: 130, h: 130, symbol: 'air-bike' },
  { id: 'gen-cardio-rudergeraet', name: 'Rudergerät', b: 60, t: 245, h: 50, symbol: 'rower' },
  { id: 'gen-cardio-stairmaster', name: 'Stairmaster', b: 80, t: 150, h: 210, symbol: 'stairmaster' },
  { id: 'gen-cardio-skierg', name: 'SkiErg', b: 60, t: 125, h: 215, symbol: 'skierg' },
];

const byId = new Map(GENERIC_LIBRARY.map((d) => [d.id, d]));
const def = (id: string): EquipmentDef => {
  const d = byId.get(id);
  if (!d) throw new Error(`Generischer Eintrag fehlt: ${id}`);
  return d;
};

describe('Generische Objektbibliothek (generic.json)', () => {
  it('enthält mindestens 110 Einträge', () => {
    expect(GENERIC_LIBRARY.length).toBeGreaterThanOrEqual(110);
  });

  it('IDs folgen dem Schema gen-<bereich>-<slug> und sind eindeutig – auch gegenüber Atlantis/Prime', () => {
    const ids = GENERIC_LIBRARY.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, id).toMatch(/^gen-[a-z0-9]+(-[a-z0-9]+)+$/);
    const foreign = new Set([...ATLANTIS_LIBRARY, ...PRIME_LIBRARY].map((d) => d.id));
    for (const id of ids) expect(foreign.has(id), id).toBe(false);
    const all = BUILTIN_LIBRARY.map((d) => d.id);
    expect(new Set(all).size).toBe(all.length);
    expect(BUILTIN_LIBRARY.length).toBe(ATLANTIS_LIBRARY.length + PRIME_LIBRARY.length + GENERIC_LIBRARY.length);
  });

  it('alle Einträge sind über getDef auffindbar', () => {
    for (const d of GENERIC_LIBRARY) expect(getDef(d.id)).toBe(d);
  });

  it('Pflichtfelder sind vorhanden und plausibel', () => {
    for (const d of GENERIC_LIBRARY) {
      const ctx = d.id;
      expect(typeof d.name, ctx).toBe('string');
      expect(d.name.trim().length, ctx).toBeGreaterThan(0);
      expect(d.hersteller, ctx).toBe('Generisch');
      expect(d.verifiziert, ctx).toBe(false);
      expect(typeof d.kategorie, ctx).toBe('string');
      expect(d.kategorie.length, ctx).toBeGreaterThan(0);
      expect(typeof d.unterkategorie, ctx).toBe('string');
      expect(d.unterkategorie.length, ctx).toBeGreaterThan(0);
      expect(typeof d.skalierbar, ctx).toBe('boolean');
      expect(['rechteck', 'polygon', 'kreis'], ctx).toContain(d.form);
      expect(Number.isFinite(d.breite_cm) && d.breite_cm > 0, ctx).toBe(true);
      expect(Number.isFinite(d.tiefe_cm) && d.tiefe_cm > 0, ctx).toBe(true);
      expect(d.hoehe_cm === null || (Number.isFinite(d.hoehe_cm) && d.hoehe_cm > 0), ctx).toBe(true);
      expect(d.gewicht_kg == null || (Number.isFinite(d.gewicht_kg) && d.gewicht_kg > 0), ctx).toBe(true);
      const z = d.sicherheitszone_cm;
      expect(z, ctx).toBeDefined();
      for (const k of ['vorne', 'hinten', 'links', 'rechts'] as const) {
        expect(Number.isFinite(z[k]) && z[k] >= 0, `${ctx}.${k}`).toBe(true);
      }
      if (d.form === 'kreis') expect(d.breite_cm, `${ctx}: Kreis braucht B = T`).toBe(d.tiefe_cm);
      expect(d.muskelgruppe, ctx).toBeUndefined();
      expect(Array.isArray(d.tags) && d.tags!.length > 0, ctx).toBe(true);
    }
  });

  it('bereich ∈ LIBRARY_AREAS (nie „Kraftgeräte“/„Eigene“) und symbol ist ein gültiger SymbolKind', () => {
    for (const d of GENERIC_LIBRARY) {
      expect(AREA_SET.has(d.bereich), `${d.id}: bereich ${d.bereich}`).toBe(true);
      expect(d.bereich, d.id).not.toBe('Kraftgeräte');
      expect(d.bereich, d.id).not.toBe('Eigene');
      expect(SYMBOL_SET.has(d.symbol), `${d.id}: symbol ${d.symbol}`).toBe(true);
    }
  });

  it('deckt alle Bereiche aus Abschnitt 5.3 und die Bauelemente ab', () => {
    const areas = new Set(GENERIC_LIBRARY.map((d) => d.bereich));
    const expected: LibraryArea[] = [
      'Freihantel-Zubehör', 'Cardio', 'Functional', 'Empfang & Lounge', 'Umkleide', 'Sanitär', 'Wellness',
      'Kursraum', 'Büro & Personal', 'Lager & Technik', 'Ausstattung', 'Bauelemente',
    ];
    for (const a of expected) expect(areas.has(a), a).toBe(true);
  });

  it('Cardio-Tabelle ist exakt übernommen (10 Einträge)', () => {
    const cardio = GENERIC_LIBRARY.filter((d) => d.bereich === 'Cardio');
    expect(cardio.length).toBe(10);
    for (const row of CARDIO_TABLE) {
      const d = def(row.id);
      expect(d.name, row.id).toBe(row.name);
      expect([d.breite_cm, d.tiefe_cm, d.hoehe_cm], row.id).toEqual([row.b, row.t, row.h]);
      expect(d.symbol, row.id).toBe(row.symbol);
      expect(d.bereich, row.id).toBe('Cardio');
      expect(d.skalierbar, row.id).toBe(false);
    }
  });

  it('Sicherheitszonen: Laufbänder 200 cm hinten, Crosstrainer/Stairmaster/SkiErg/Rudergerät 60 cm hinten, Bikes 30 rundum', () => {
    for (const id of ['gen-cardio-laufband', 'gen-cardio-curved-treadmill']) {
      expect(def(id).sicherheitszone_cm, id).toEqual({ vorne: 0, hinten: 200, links: 0, rechts: 0 });
    }
    for (const id of ['gen-cardio-crosstrainer', 'gen-cardio-stairmaster', 'gen-cardio-skierg', 'gen-cardio-rudergeraet']) {
      expect(def(id).sicherheitszone_cm, id).toEqual({ vorne: 0, hinten: 60, links: 0, rechts: 0 });
    }
    for (const id of ['gen-cardio-ergometer', 'gen-cardio-liegeergometer', 'gen-cardio-spinning-bike', 'gen-cardio-air-bike']) {
      expect(def(id).sicherheitszone_cm, id).toEqual({ vorne: 30, hinten: 30, links: 30, rechts: 30 });
    }
  });

  it('Ständer/Racks haben 100 cm Bewegungsfläche vorne; Möbel, Sanitär und Wellness sind zonenfrei', () => {
    for (const id of ['gen-freihantel-scheibenstaender', 'gen-freihantel-langhantelstaender', 'gen-freihantel-kurzhantel-rack', 'gen-umkleide-spindreihe']) {
      expect(def(id).sicherheitszone_cm, id).toEqual({ vorne: 100, hinten: 0, links: 0, rechts: 0 });
    }
    const zero = { vorne: 0, hinten: 0, links: 0, rechts: 0 };
    for (const id of ['gen-sanitaer-einzeldusche', 'gen-sanitaer-wc-kabine', 'gen-sanitaer-wc-barrierefrei', 'gen-wellness-sauna-300', 'gen-wellness-ruheliege', 'gen-empfang-theke', 'gen-ausstattung-muelleimer']) {
      expect(def(id).sicherheitszone_cm, id).toEqual(zero);
    }
    for (const d of GENERIC_LIBRARY) {
      if (['Empfang & Lounge', 'Sanitär', 'Wellness', 'Büro & Personal', 'Ausstattung'].includes(d.bereich)) {
        const z = d.sicherheitszone_cm;
        expect(z.hinten + z.links + z.rechts, `${d.id}: nur Bewegungsfläche vorne erlaubt`).toBe(0);
      }
    }
  });

  it('Spindreihe und Einzelspinde tragen die Fächer-Parameter', () => {
    const row = def('gen-umkleide-spindreihe');
    expect([row.breite_cm, row.tiefe_cm, row.hoehe_cm]).toEqual([400, 50, 180]);
    expect(row.skalierbar).toBe(true);
    expect(row.symbol).toBe('locker-row');
    expect(row.params).toEqual({ faecher: 10, abteilbreite: 40, stoeckig: 1 });
    for (const n of [1, 2, 3, 4]) {
      const s = def(`gen-umkleide-spind-${n}`);
      expect([s.breite_cm, s.tiefe_cm, s.hoehe_cm], s.id).toEqual([40, 50, 180]);
      expect(s.symbol, s.id).toBe('locker');
      expect(s.params?.faecher, s.id).toBe(n);
      expect(s.params?.stoeckig, s.id).toBe(n);
      expect(s.skalierbar, s.id).toBe(false);
    }
    expect(def('gen-umkleide-spind-30-1').params?.abteilbreite).toBe(30);
  });

  it('Mengenpositionen (Scheiben, Kurzhanteln, Stangen) haben keine Stellfläche und 30 × 30 Platzhaltermaß', () => {
    const ids = ['gen-freihantel-hantelscheiben-satz', 'gen-freihantel-kurzhantelsatz', 'gen-freihantel-langhantelstange'];
    for (const id of ids) {
      const d = def(id);
      expect(d.ohne_stellflaeche, id).toBe(true);
      expect([d.breite_cm, d.tiefe_cm], id).toEqual([30, 30]);
      expect(d.gewicht_kg, id).toBeGreaterThan(0);
    }
    for (const d of GENERIC_LIBRARY) {
      if (d.ohne_stellflaeche) {
        expect(d.skalierbar, d.id).toBe(false);
        expect(d.sicherheitszone_cm, d.id).toEqual({ vorne: 0, hinten: 0, links: 0, rechts: 0 });
      }
    }
  });

  it('nur die laut Auftrag frei skalierbaren Objektarten sind skalierbar', () => {
    const scalable = ['gen-umkleide-bank', 'gen-functional-matte', 'gen-umkleide-spiegel', 'gen-empfang-theke', 'gen-functional-rig',
      'gen-functional-sled-bahn', 'gen-wellness-sauna-200', 'gen-bau-rampe', 'gen-lager-regal', 'gen-kursraum-trainer-podest', 'gen-functional-kunstrasen'];
    for (const id of scalable) expect(def(id).skalierbar, id).toBe(true);
    const fixed = ['gen-cardio-laufband', 'gen-empfang-getraenkeautomat', 'gen-sanitaer-wc-kabine', 'gen-wellness-cold-plunge', 'gen-bau-aufzug', 'gen-bau-treppe-gerade', 'gen-umkleide-spind-1'];
    for (const id of fixed) expect(def(id).skalierbar, id).toBe(false);
  });

  it('Sanitär: barrierefreies WC 150 × 220 enthält die Bewegungsfläche, WC-Kabine 90 × 150, Einzeldusche 90 × 90', () => {
    const wc = def('gen-sanitaer-wc-barrierefrei');
    expect([wc.breite_cm, wc.tiefe_cm]).toEqual([150, 220]);
    expect(wc.hinweis).toContain('Bewegungsfläche');
    expect(wc.symbol).toBe('toilet');
    expect([def('gen-sanitaer-wc-kabine').breite_cm, def('gen-sanitaer-wc-kabine').tiefe_cm]).toEqual([90, 150]);
    expect([def('gen-sanitaer-einzeldusche').breite_cm, def('gen-sanitaer-einzeldusche').tiefe_cm]).toEqual([90, 90]);
    expect([def('gen-sanitaer-dusche-barrierefrei').breite_cm, def('gen-sanitaer-dusche-barrierefrei').tiefe_cm]).toEqual([150, 150]);
    expect(def('gen-sanitaer-urinal').symbol).toBe('urinal');
  });

  it('Wellness: Cold Plunge und Red-Light-Panel sind als ungeprüft markiert', () => {
    const plunge = def('gen-wellness-cold-plunge');
    expect([plunge.breite_cm, plunge.tiefe_cm, plunge.hoehe_cm]).toEqual([180, 80, 75]);
    expect(plunge.hinweis).toContain('ungeprüft');
    expect(plunge.symbol).toBe('plunge');
    const rl = def('gen-wellness-red-light-panel');
    expect(rl.hinweis).toContain('ungeprüft');
    expect(rl.symbol).toBe('red-light');
    expect(rl.wandmontage).toBe(true);
    expect(def('gen-wellness-infrarotkabine').breite_cm).toBe(120);
    expect(def('gen-wellness-infrarotkabine').tiefe_cm).toBe(105);
    expect(def('gen-wellness-ruheliege').breite_cm).toBe(200);
    expect(def('gen-wellness-ruheliege').tiefe_cm).toBe(70);
  });

  it('Wandmontage-Objekte sind markiert (Spiegel, Heizkörper, TV, Feuerlöscher …)', () => {
    for (const id of ['gen-umkleide-spiegel', 'gen-bau-heizkoerper', 'gen-ausstattung-tv-55', 'gen-ausstattung-feuerloescher', 'gen-functional-sprossenwand', 'gen-umkleide-waschtisch']) {
      expect(def(id).wandmontage, id).toBe(true);
    }
    expect(def('gen-cardio-laufband').wandmontage).toBeUndefined();
  });

  describe('Bauelemente (Abschnitt 4.5)', () => {
    const KINDS = ['column', 'radiator', 'vent', 'stairs', 'elevator', 'ramp'] as const;

    it('alle Arten sind vorhanden und tragen params.kind', () => {
      const bau = GENERIC_LIBRARY.filter((d) => d.bereich === 'Bauelemente');
      const kinds = new Set(bau.map((d) => d.params?.kind));
      for (const k of KINDS) expect(kinds.has(k), k).toBe(true);
      for (const d of bau) {
        if (d.params?.kind !== undefined) expect(KINDS as readonly string[], d.id).toContain(d.params.kind);
      }
    });

    it('Säulen: rund Ø 30 (Kreis) und eckig 30 × 30 mit params.form', () => {
      const r = def('gen-bau-saeule-rund');
      expect(r.form).toBe('kreis');
      expect([r.breite_cm, r.tiefe_cm]).toEqual([30, 30]);
      expect(r.params).toMatchObject({ kind: 'column', form: 'rund' });
      expect(r.symbol).toBe('column-round');
      const e = def('gen-bau-saeule-eckig');
      expect(e.form).toBe('rechteck');
      expect([e.breite_cm, e.tiefe_cm]).toEqual([30, 30]);
      expect(e.params).toMatchObject({ kind: 'column', form: 'eckig' });
      expect(e.symbol).toBe('column-square');
    });

    it('Treppen: gerade 100 × 360 (18 Stufen), L 240 × 240, U 240 × 300, Wendeltreppe Ø 200', () => {
      const g = def('gen-bau-treppe-gerade');
      expect([g.breite_cm, g.tiefe_cm]).toEqual([100, 360]);
      expect(g.params).toMatchObject({ kind: 'stairs', typ: 'gerade', stufen: 18, steigung: 18 });
      expect(g.symbol).toBe('stairs-straight');
      const l = def('gen-bau-treppe-l');
      expect([l.breite_cm, l.tiefe_cm]).toEqual([240, 240]);
      expect(l.params).toMatchObject({ kind: 'stairs', typ: 'L' });
      expect(l.symbol).toBe('stairs-l');
      const u = def('gen-bau-treppe-u');
      expect([u.breite_cm, u.tiefe_cm]).toEqual([240, 300]);
      expect(u.params).toMatchObject({ kind: 'stairs', typ: 'U' });
      expect(u.symbol).toBe('stairs-u');
      const w = def('gen-bau-wendeltreppe');
      expect([w.breite_cm, w.tiefe_cm, w.form]).toEqual([200, 200, 'kreis']);
      expect(w.params).toMatchObject({ kind: 'stairs', typ: 'Wendeltreppe' });
      expect(w.symbol).toBe('stairs-spiral');
      const types = new Set(GENERIC_LIBRARY.filter((d) => d.params?.kind === 'stairs').map((d) => d.params?.typ));
      expect(types).toEqual(new Set(['gerade', 'L', 'U', 'Wendeltreppe']));
    });

    it('Aufzug 180 × 200 (Kabine 140 × 160), Rampe 120 × 600 skalierbar, Heizkörper 100 × 10 Wandmontage, Lüftungsauslass 60 × 60', () => {
      const a = def('gen-bau-aufzug');
      expect([a.breite_cm, a.tiefe_cm]).toEqual([180, 200]);
      expect(a.params).toMatchObject({ kind: 'elevator', kabine_breite: 140, kabine_tiefe: 160 });
      expect(a.symbol).toBe('elevator');
      const r = def('gen-bau-rampe');
      expect([r.breite_cm, r.tiefe_cm, r.skalierbar]).toEqual([120, 600, true]);
      expect(r.params).toMatchObject({ kind: 'ramp' });
      const h = def('gen-bau-heizkoerper');
      expect([h.breite_cm, h.tiefe_cm, h.wandmontage]).toEqual([100, 10, true]);
      expect(h.params).toMatchObject({ kind: 'radiator' });
      const v = def('gen-bau-lueftungsauslass');
      expect([v.breite_cm, v.tiefe_cm]).toEqual([60, 60]);
      expect(v.params).toMatchObject({ kind: 'vent' });
    });

    it('createItemFromDef übernimmt kind und params aus der Definition', () => {
      const stairs = createItemFromDef(def('gen-bau-treppe-l'), 100, 200);
      expect(stairs.kind).toBe('stairs');
      expect(stairs.params).toMatchObject({ typ: 'L', stufen: 18 });
      expect(stairs.params).not.toBe(def('gen-bau-treppe-l').params);
      expect(createItemFromDef(def('gen-bau-saeule-rund'), 0, 0).kind).toBe('column');
      expect(createItemFromDef(def('gen-bau-aufzug'), 0, 0).kind).toBe('elevator');
      expect(createItemFromDef(def('gen-bau-rampe'), 0, 0).kind).toBe('ramp');
      expect(createItemFromDef(def('gen-bau-heizkoerper'), 0, 0).kind).toBe('radiator');
      expect(createItemFromDef(def('gen-bau-lueftungsauslass'), 0, 0).kind).toBe('vent');
      expect(createItemFromDef(def('gen-cardio-laufband'), 0, 0).kind).toBe('equipment');
      expect(createItemFromDef(def('gen-bau-podest'), 0, 0).kind).toBe('equipment');
    });
  });
});

describe('Spinde: Breite = Abteile × Abteilbreite, Abteile = Fächer ÷ Stöcke (M5)', () => {
  const lockers = GENERIC_LIBRARY.filter((d) => d.params?.faecher != null);
  it('alle Spind-Einträge sind in sich konsistent', () => {
    expect(lockers.length).toBeGreaterThanOrEqual(8);
    for (const d of lockers) {
      const faecher = Number(d.params!.faecher);
      const stoeckig = Number(d.params!.stoeckig ?? 1);
      const ab = Number(d.params!.abteilbreite);
      expect(Math.ceil(faecher / stoeckig) * ab, d.id).toBe(d.breite_cm);
    }
  });
  it('2-stöckige Spindreihe: 20 Fächer, 2 Stöcke, 40 cm → 10 Abteile, 400 cm breit', () => {
    const d = def('gen-umkleide-spindreihe-2');
    const it = createItemFromDef(d, 0, 0);
    expect(lockerTiers(it, d)).toBe(2);
    expect(lockerColumns(it, d)).toBe(10);
    expect(lockerCount(it, d)).toBe(20);
    expect(lockerColumns(it, d) * Number(d.params!.abteilbreite)).toBe(it.width);
    // ohne Fächerangabe: Abteile aus Breite / Abteilbreite, Fächer = Abteile × Stöcke
    const noF = { ...it, params: { abteilbreite: 40, stoeckig: 2 } };
    expect(lockerColumns(noF, undefined)).toBe(10);
    expect(lockerCount(noF, undefined)).toBe(20);
  });
});
