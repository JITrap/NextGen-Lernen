import { useEffect, useMemo, useState } from 'react';
import { Save, TriangleAlert } from 'lucide-react';
import type { EquipmentDef, LibraryArea, MuscleGroup, ShapeKind, SymbolKind } from '@/types';
import { useProjectStore, transaction } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { LIBRARY_AREAS, MUSCLE_GROUPS } from '@/data/equipment';
import { newId } from '@/utils/id';
import { parseNumber } from '@/geometry/units';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { SelectField } from './fields/SelectField';
import { CheckboxField } from './fields/CheckboxField';

/* ------------------------------------------------------------------ */
/* Symbole (Draufsicht) – lokale Liste mit deutschen Bezeichnungen     */
/* ------------------------------------------------------------------ */

export const SYMBOL_KINDS: { value: SymbolKind; label: string }[] = [
  { value: 'generic', label: 'Allgemein (Rechteck)' },
  { value: 'machine', label: 'Kraftgerät' },
  { value: 'bench', label: 'Hantelbank' },
  { value: 'rack', label: 'Power Rack' },
  { value: 'half-rack', label: 'Half Rack' },
  { value: 'smith', label: 'Multipresse' },
  { value: 'platform', label: 'Plattform' },
  { value: 'dumbbell-rack', label: 'Kurzhantelablage' },
  { value: 'plate-rack', label: 'Scheibenständer' },
  { value: 'barbell-rack', label: 'Langhantelständer' },
  { value: 'plate-tree', label: 'Scheibenbaum' },
  { value: 'dumbbells', label: 'Kurzhanteln' },
  { value: 'barbell', label: 'Langhantel' },
  { value: 'cable', label: 'Kabelzug / Functional Trainer' },
  { value: 'leg-press', label: 'Beinpresse' },
  { value: 'hack-squat', label: 'Hackenschmidt' },
  { value: 'lat-pulldown', label: 'Latzug' },
  { value: 'chest-press', label: 'Brustpresse' },
  { value: 'row', label: 'Rudergerät (Kraft)' },
  { value: 'curl', label: 'Curl-Maschine' },
  { value: 'calf', label: 'Wadenmaschine' },
  { value: 'dip', label: 'Dip-Station' },
  { value: 'sled', label: 'Schlitten' },
  { value: 'treadmill', label: 'Laufband' },
  { value: 'curved-treadmill', label: 'Curved Treadmill' },
  { value: 'elliptical', label: 'Crosstrainer' },
  { value: 'bike', label: 'Ergometer' },
  { value: 'recumbent-bike', label: 'Liegeergometer' },
  { value: 'spin-bike', label: 'Spinning-Bike' },
  { value: 'air-bike', label: 'Air Bike' },
  { value: 'rower', label: 'Rudergerät (Cardio)' },
  { value: 'stairmaster', label: 'Stairmaster' },
  { value: 'skierg', label: 'SkiErg' },
  { value: 'turf', label: 'Sled-Bahn / Kunstrasen' },
  { value: 'kettlebell-rack', label: 'Kettlebell-Regal' },
  { value: 'plyo-box', label: 'Plyo-Box' },
  { value: 'mat', label: 'Matte' },
  { value: 'ball-rack', label: 'Ballregal' },
  { value: 'rope-anchor', label: 'Battle-Rope-Anker' },
  { value: 'rig', label: 'Rig / Functional-Gerüst' },
  { value: 'wall-bars', label: 'Sprossenwand' },
  { value: 'punching-bag', label: 'Boxsack' },
  { value: 'counter', label: 'Theke' },
  { value: 'turnstile', label: 'Drehkreuz' },
  { value: 'fridge', label: 'Kühlschrank' },
  { value: 'vending', label: 'Automat' },
  { value: 'sofa', label: 'Sofa' },
  { value: 'table', label: 'Tisch' },
  { value: 'chair', label: 'Stuhl' },
  { value: 'wardrobe', label: 'Garderobe' },
  { value: 'screen', label: 'Info-Bildschirm' },
  { value: 'locker', label: 'Spind' },
  { value: 'locker-row', label: 'Spindreihe' },
  { value: 'bench-seat', label: 'Sitzbank' },
  { value: 'mirror', label: 'Spiegel' },
  { value: 'hairdryer', label: 'Föhnplatz' },
  { value: 'sink', label: 'Waschtisch' },
  { value: 'cabin', label: 'Kabine' },
  { value: 'shower', label: 'Dusche' },
  { value: 'shower-row', label: 'Reihendusche' },
  { value: 'partition', label: 'Trennwand' },
  { value: 'toilet', label: 'WC' },
  { value: 'urinal', label: 'Urinal' },
  { value: 'changing-table', label: 'Wickeltisch' },
  { value: 'dispenser', label: 'Spender' },
  { value: 'laundry', label: 'Wäschesammler' },
  { value: 'valuables', label: 'Wertfächer' },
  { value: 'sauna', label: 'Sauna' },
  { value: 'infrared', label: 'Infrarotkabine' },
  { value: 'steam', label: 'Dampfbad' },
  { value: 'plunge', label: 'Tauchbecken / Cold Plunge' },
  { value: 'ice-fountain', label: 'Eisbrunnen' },
  { value: 'kneipp', label: 'Kneipp-Becken' },
  { value: 'shower-experience', label: 'Erlebnisdusche' },
  { value: 'lounger', label: 'Ruheliege' },
  { value: 'waterbed', label: 'Wasserbett' },
  { value: 'solarium', label: 'Solarium' },
  { value: 'red-light', label: 'Red-Light-Panel' },
  { value: 'massage-chair', label: 'Massagestuhl' },
  { value: 'massage-table', label: 'Massageliege' },
  { value: 'whirlpool', label: 'Whirlpool' },
  { value: 'tea-station', label: 'Teestation' },
  { value: 'step', label: 'Step' },
  { value: 'mat-rack', label: 'Mattenregal' },
  { value: 'podium', label: 'Trainer-Podest' },
  { value: 'audio', label: 'Musikanlage' },
  { value: 'desk', label: 'Schreibtisch' },
  { value: 'office-chair', label: 'Bürostuhl' },
  { value: 'filing-cabinet', label: 'Aktenschrank' },
  { value: 'meeting-table', label: 'Besprechungstisch' },
  { value: 'shelf', label: 'Regal' },
  { value: 'hvac', label: 'Lüftungsanlage' },
  { value: 'washer', label: 'Waschmaschine / Trockner' },
  { value: 'cleaning-cart', label: 'Putzwagen' },
  { value: 'switchboard', label: 'Schaltschrank' },
  { value: 'plant', label: 'Pflanze' },
  { value: 'speaker', label: 'Lautsprecher' },
  { value: 'tv', label: 'TV' },
  { value: 'water-dispenser', label: 'Wasserspender' },
  { value: 'sanitizer', label: 'Desinfektionsstation' },
  { value: 'trash', label: 'Mülleimer' },
  { value: 'extinguisher', label: 'Feuerlöscher' },
  { value: 'first-aid', label: 'Erste-Hilfe-Kasten' },
  { value: 'aed', label: 'AED / Defibrillator' },
  { value: 'exit-sign', label: 'Notausgang-Schild' },
  { value: 'camera', label: 'Kamera' },
  { value: 'column-round', label: 'Säule (rund)' },
  { value: 'column-square', label: 'Säule (eckig)' },
  { value: 'radiator', label: 'Heizkörper' },
  { value: 'vent', label: 'Lüftungsauslass' },
  { value: 'stairs-straight', label: 'Treppe (gerade)' },
  { value: 'stairs-l', label: 'Treppe (L)' },
  { value: 'stairs-u', label: 'Treppe (U)' },
  { value: 'stairs-spiral', label: 'Wendeltreppe' },
  { value: 'elevator', label: 'Aufzug' },
  { value: 'ramp', label: 'Rampe' },
];

const SHAPES: { value: ShapeKind; label: string }[] = [
  { value: 'rechteck', label: 'Rechteck' },
  { value: 'kreis', label: 'Kreis / Ellipse' },
];

/** Standard-Sicherheitszone für eigene Geräte (Kraft: 60 cm rundum, sonst 0). */
function defaultZone(area: LibraryArea, fallbackCm: number) {
  const v = area === 'Kraftgeräte' || area === 'Cardio' ? fallbackCm : 0;
  return { vorne: v, hinten: v, links: v, rechts: v };
}

/* ------------------------------------------------------------------ */
/* Formularzustand                                                     */
/* ------------------------------------------------------------------ */

interface FormState {
  name: string;
  hersteller: string;
  serie: string;
  modell: string;
  bereich: LibraryArea;
  muskelgruppe: MuscleGroup | '';
  unterkategorie: string;
  breite: string;
  tiefe: string;
  hoehe: string;
  gewicht: string;
  extra: string;
  hinweis: string;
  zVorne: string;
  zHinten: string;
  zLinks: string;
  zRechts: string;
  form: ShapeKind;
  skalierbar: boolean;
  preis: string;
  quelle: string;
  verifiziert: boolean;
  symbol: SymbolKind;
  tags: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

const num = (v: number | null | undefined) => (v == null ? '' : String(v).replace('.', ','));

function fromDef(def: EquipmentDef | undefined, defaultZoneCm: number): FormState {
  const bereich: LibraryArea = def?.bereich ?? 'Eigene';
  const z = def?.sicherheitszone_cm ?? defaultZone(bereich, defaultZoneCm);
  return {
    name: def?.name ?? '',
    hersteller: def?.hersteller ?? 'Eigene',
    serie: def?.serie ?? '',
    modell: def?.modell ?? '',
    bereich,
    muskelgruppe: def?.muskelgruppe ?? '',
    unterkategorie: def?.unterkategorie ?? '',
    breite: num(def?.breite_cm),
    tiefe: num(def?.tiefe_cm),
    hoehe: num(def?.hoehe_cm),
    gewicht: num(def?.gewicht_kg),
    extra: def?.extra ?? '',
    hinweis: def?.hinweis ?? '',
    zVorne: num(z.vorne),
    zHinten: num(z.hinten),
    zLinks: num(z.links),
    zRechts: num(z.rechts),
    form: def?.form === 'kreis' ? 'kreis' : 'rechteck',
    skalierbar: def?.skalierbar ?? true,
    preis: num(def?.preis_eur),
    quelle: def?.quelle_url ?? '',
    verifiziert: def?.verifiziert ?? false,
    symbol: def?.symbol ?? 'generic',
    tags: def?.tags?.join(', ') ?? '',
  };
}

function parseOpt(s: string): number | null | 'invalid' {
  const t = s.trim();
  if (!t) return null;
  const v = parseNumber(t);
  return v == null ? 'invalid' : v;
}

/** Validiert das Formular; liefert Fehlertexte je Feld. Exportiert für Tests. */
export function validateForm(f: FormState): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = 'Bitte einen Namen eingeben.';
  if (!f.hersteller.trim()) e.hersteller = 'Bitte einen Hersteller eingeben (z. B. „Eigene“).';
  const positive = (key: 'breite' | 'tiefe', label: string) => {
    const v = parseOpt(f[key]);
    if (v === null || v === 'invalid' || !(v > 0)) e[key] = `${label} muss eine Zahl > 0 sein.`;
  };
  positive('breite', 'Breite');
  positive('tiefe', 'Tiefe');
  const nonNeg = (key: 'hoehe' | 'gewicht' | 'preis' | 'zVorne' | 'zHinten' | 'zLinks' | 'zRechts', label: string) => {
    const v = parseOpt(f[key]);
    if (v === 'invalid' || (v != null && v < 0)) e[key] = `${label}: Zahl ≥ 0 oder leer.`;
  };
  nonNeg('hoehe', 'Höhe');
  nonNeg('gewicht', 'Gewicht');
  nonNeg('preis', 'Preis');
  nonNeg('zVorne', 'Sicherheitszone vorne');
  nonNeg('zHinten', 'Sicherheitszone hinten');
  nonNeg('zLinks', 'Sicherheitszone links');
  nonNeg('zRechts', 'Sicherheitszone rechts');
  const q = f.quelle.trim();
  if (q && !/^https?:\/\/\S+$/i.test(q)) e.quelle = 'Bitte eine vollständige Adresse mit http(s):// angeben.';
  if (f.bereich === 'Kraftgeräte' && !f.muskelgruppe) e.muskelgruppe = 'Bitte eine Muskelgruppe wählen.';
  return e;
}

/** Baut die EquipmentDef aus dem (validierten) Formular. */
export function buildDef(f: FormState, id: string): EquipmentDef {
  const n = (s: string) => parseNumber(s.trim()) ?? 0;
  const opt = (s: string) => (s.trim() ? parseNumber(s.trim()) : null);
  const isStrength = f.bereich === 'Kraftgeräte';
  const tags = f.tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
  const def: EquipmentDef = {
    id,
    kategorie: isStrength && f.muskelgruppe ? f.muskelgruppe : f.bereich,
    unterkategorie: f.unterkategorie.trim() || (isStrength && f.muskelgruppe ? f.muskelgruppe : f.bereich),
    hersteller: f.hersteller.trim(),
    name: f.name.trim(),
    breite_cm: n(f.breite),
    tiefe_cm: n(f.tiefe),
    hoehe_cm: opt(f.hoehe),
    gewicht_kg: opt(f.gewicht),
    sicherheitszone_cm: { vorne: n(f.zVorne), hinten: n(f.zHinten), links: n(f.zLinks), rechts: n(f.zRechts) },
    form: f.form,
    skalierbar: f.skalierbar,
    verifiziert: f.verifiziert,
    bereich: f.bereich,
    symbol: f.symbol,
    benutzerdefiniert: true,
    tags: [...new Set([f.hersteller.trim(), f.serie.trim(), f.modell.trim(), f.unterkategorie.trim(), ...tags].filter(Boolean))],
  };
  if (f.serie.trim()) def.serie = f.serie.trim();
  if (f.modell.trim()) def.modell = f.modell.trim();
  if (f.extra.trim()) def.extra = f.extra.trim();
  if (f.hinweis.trim()) def.hinweis = f.hinweis.trim();
  const preis = opt(f.preis);
  if (preis != null) def.preis_eur = preis;
  if (f.quelle.trim()) def.quelle_url = f.quelle.trim();
  if (isStrength && f.muskelgruppe) def.muskelgruppe = f.muskelgruppe;
  return def;
}

/* ------------------------------------------------------------------ */
/* Formular-Bausteine                                                  */
/* ------------------------------------------------------------------ */

function Field({ label, error, children, hint, className = '' }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="gp-label">{label}</span>
      {children}
      {error ? <span className="text-[11px] gp-danger">{error}</span> : hint ? <span className="text-[11px] gp-muted">{hint}</span> : null}
    </label>
  );
}

function Input({ value, onChange, error, unit, inputMode, placeholder, autoFocus, name }: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  unit?: string;
  inputMode?: 'text' | 'decimal';
  placeholder?: string;
  autoFocus?: boolean;
  name?: string;
}) {
  return (
    <span className="relative inline-flex w-full items-center">
      <input
        type="text"
        name={name}
        autoComplete="off"
        inputMode={inputMode}
        placeholder={placeholder}
        className={`gp-input min-h-[36px] ${unit ? 'pr-9 tabular-nums' : ''} ${error ? 'ring-2 ring-red-500/50' : ''}`}
        value={value}
        aria-invalid={error ? true : undefined}
        data-autofocus={autoFocus ? 'true' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && <span className="pointer-events-none absolute right-2 text-[11px] gp-muted">{unit}</span>}
    </span>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="border-b pb-1 pt-2 text-xs font-semibold uppercase tracking-wide gp-border gp-muted">{children}</h3>;
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

export interface CustomEquipmentFormProps {
  open: boolean;
  onClose: () => void;
  /** Bearbeiten eines bestehenden eigenen Geräts; ohne: neu anlegen. */
  initial?: EquipmentDef;
  /** Wird nach dem Speichern mit der gespeicherten Definition aufgerufen. */
  onSaved?: (def: EquipmentDef) => void;
}

/**
 * Formular für eigene Geräte (alle Felder aus Abschnitt 5.1 plus App-Felder). Speichert per
 * store.addCustomEquipment / updateCustomEquipment (ein Undo-Schritt). Modal schließt mit Esc/Backdrop,
 * Fokus liegt im ersten Feld.
 */
export function CustomEquipmentForm({ open, onClose, initial, onSaved }: CustomEquipmentFormProps) {
  const defaultZoneCm = useProjectStore((s) => s.project.settings.defaultSafetyZoneCm);
  const [form, setForm] = useState<FormState>(() => fromDef(initial, defaultZoneCm));
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  // Beim Öffnen (neu) bzw. Wechsel des zu bearbeitenden Geräts Formular zurücksetzen
  useEffect(() => {
    if (open) {
      setForm(fromDef(initial, defaultZoneCm));
      setErrors({});
      setSubmitted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Bereichswechsel: Standard-Sicherheitszone übernehmen, wenn noch alle Werte 0/leer bzw. Standard sind
      if (key === 'bereich') {
        const old = defaultZone(f.bereich, defaultZoneCm);
        const untouched = [f.zVorne, f.zHinten, f.zLinks, f.zRechts].every((v, i) => parseNumber(v || '0') === [old.vorne, old.hinten, old.links, old.rechts][i]);
        if (untouched) {
          const z = defaultZone(value as LibraryArea, defaultZoneCm);
          next.zVorne = num(z.vorne);
          next.zHinten = num(z.hinten);
          next.zLinks = num(z.links);
          next.zRechts = num(z.rechts);
        }
        if (value !== 'Kraftgeräte') next.muskelgruppe = '';
      }
      if (submitted) setErrors(validateForm(next));
      return next;
    });
  };

  const areaOptions = useMemo(() => LIBRARY_AREAS.map((a) => ({ value: a, label: a })), []);
  const muscleOptions = useMemo(() => [{ value: '' as MuscleGroup | '', label: '– bitte wählen –' }, ...MUSCLE_GROUPS.map((m) => ({ value: m as MuscleGroup | '', label: m }))], []);
  const symbolOptions = useMemo(() => [...SYMBOL_KINDS].sort((a, b) => a.label.localeCompare(b.label, 'de')), []);

  const submit = () => {
    const errs = validateForm(form);
    setErrors(errs);
    setSubmitted(true);
    if (Object.keys(errs).length) {
      // erstes fehlerhaftes Feld fokussieren
      window.setTimeout(() => document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.focus(), 0);
      return;
    }
    const store = useProjectStore.getState();
    const id = initial?.id ?? `custom-${newId()}`;
    const def = buildDef(form, id);
    transaction(() => {
      if (initial) {
        const { id: _id, ...patch } = def;
        // Felder, die im Formular geleert wurden, explizit entfernen (Object.assign überschreibt sonst nicht)
        const cleared: Partial<EquipmentDef> = {};
        for (const k of ['serie', 'modell', 'extra', 'hinweis', 'preis_eur', 'quelle_url', 'muskelgruppe'] as const) if (!(k in patch)) cleared[k] = undefined;
        store.updateCustomEquipment(id, { ...cleared, ...patch });
      } else {
        store.addCustomEquipment(def);
      }
    });
    useUiStore.getState().toast(initial ? `„${def.name}“ aktualisiert` : `„${def.name}“ zur Bibliothek hinzugefügt`, 'success');
    onSaved?.(def);
    onClose();
  };

  const isStrength = form.bereich === 'Kraftgeräte';
  const errorCount = Object.keys(errors).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? `Eigenes Gerät bearbeiten` : 'Eigenes Gerät anlegen'}
      width={560}
      footer={
        <>
          {submitted && errorCount > 0 && (
            <span className="mr-auto inline-flex items-center gap-1 text-xs gp-danger">
              <TriangleAlert size={14} /> {errorCount === 1 ? '1 Feld prüfen' : `${errorCount} Felder prüfen`}
            </span>
          )}
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" data-primary="true" icon={<Save size={15} />} onClick={submit}>
            {initial ? 'Speichern' : 'Anlegen'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Heading>Bezeichnung</Heading>
        <Field label="Name *" error={errors.name}>
          <Input name="name" value={form.name} onChange={(v) => set('name', v)} error={errors.name} placeholder="z. B. Kabelzugturm 2 Stationen" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hersteller *" error={errors.hersteller}>
            <Input value={form.hersteller} onChange={(v) => set('hersteller', v)} error={errors.hersteller} placeholder="Eigene" />
          </Field>
          <Field label="Serie">
            <Input value={form.serie} onChange={(v) => set('serie', v)} />
          </Field>
          <Field label="Modell">
            <Input value={form.modell} onChange={(v) => set('modell', v)} />
          </Field>
          <Field label="Unterkategorie" hint="z. B. Leg Press, Bänke">
            <Input value={form.unterkategorie} onChange={(v) => set('unterkategorie', v)} />
          </Field>
          <SelectField label="Bereich" value={form.bereich} options={areaOptions} onChange={(v) => set('bereich', v)} />
          {isStrength ? (
            <SelectField label="Muskelgruppe *" value={form.muskelgruppe} options={muscleOptions} onChange={(v) => set('muskelgruppe', v)} hint={errors.muskelgruppe ? <span className="gp-danger">{errors.muskelgruppe}</span> : undefined} />
          ) : (
            <SelectField label="Symbol (Draufsicht)" value={form.symbol} options={symbolOptions} onChange={(v) => set('symbol', v)} />
          )}
          {isStrength && <SelectField label="Symbol (Draufsicht)" value={form.symbol} options={symbolOptions} onChange={(v) => set('symbol', v)} className="col-span-2" />}
        </div>

        <Heading>Maße & Gewicht</Heading>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Breite *" error={errors.breite}>
            <Input value={form.breite} onChange={(v) => set('breite', v)} error={errors.breite} unit="cm" inputMode="decimal" />
          </Field>
          <Field label="Tiefe *" error={errors.tiefe}>
            <Input value={form.tiefe} onChange={(v) => set('tiefe', v)} error={errors.tiefe} unit="cm" inputMode="decimal" />
          </Field>
          <Field label="Höhe" error={errors.hoehe}>
            <Input value={form.hoehe} onChange={(v) => set('hoehe', v)} error={errors.hoehe} unit="cm" inputMode="decimal" placeholder="–" />
          </Field>
          <Field label="Gewicht" error={errors.gewicht}>
            <Input value={form.gewicht} onChange={(v) => set('gewicht', v)} error={errors.gewicht} unit="kg" inputMode="decimal" placeholder="–" />
          </Field>
          <Field label="Extra" hint="z. B. Steckgewicht 100 kg" className="col-span-2">
            <Input value={form.extra} onChange={(v) => set('extra', v)} />
          </Field>
          <SelectField label="Form" value={form.form} options={SHAPES} onChange={(v) => set('form', v)} />
          <div className="col-span-2 flex flex-col justify-end gap-1">
            <CheckboxField checked={form.skalierbar} onChange={(v) => set('skalierbar', v)} label="Frei skalierbar" hint="Aus: Maße sind auf Originalmaß gesperrt" />
          </div>
        </div>

        <Heading>Sicherheits- und Nutzungszone (cm)</Heading>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Vorne" error={errors.zVorne}>
            <Input value={form.zVorne} onChange={(v) => set('zVorne', v)} error={errors.zVorne} unit="cm" inputMode="decimal" />
          </Field>
          <Field label="Hinten" error={errors.zHinten}>
            <Input value={form.zHinten} onChange={(v) => set('zHinten', v)} error={errors.zHinten} unit="cm" inputMode="decimal" />
          </Field>
          <Field label="Links" error={errors.zLinks}>
            <Input value={form.zLinks} onChange={(v) => set('zLinks', v)} error={errors.zLinks} unit="cm" inputMode="decimal" />
          </Field>
          <Field label="Rechts" error={errors.zRechts}>
            <Input value={form.zRechts} onChange={(v) => set('zRechts', v)} error={errors.zRechts} unit="cm" inputMode="decimal" />
          </Field>
        </div>
        <p className="text-[11px] gp-muted">DIN EN ISO 20957: Kraftgeräte i. d. R. 60 cm rundum, Laufband 200 cm hinter dem Gerät. Werte sind je platziertem Objekt später anpassbar.</p>

        <Heading>Kaufmännisch & Quelle</Heading>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preis" error={errors.preis}>
            <Input value={form.preis} onChange={(v) => set('preis', v)} error={errors.preis} unit="€" inputMode="decimal" placeholder="–" />
          </Field>
          <Field label="Quelle (URL)" error={errors.quelle}>
            <Input value={form.quelle} onChange={(v) => set('quelle', v)} error={errors.quelle} placeholder="https://…" />
          </Field>
        </div>
        <Field label="Hinweis" hint="z. B. „Maße aus Katalog, nicht am Gerät gemessen“">
          <Input value={form.hinweis} onChange={(v) => set('hinweis', v)} />
        </Field>
        <Field label="Tags" hint="durch Komma getrennt, für die Suche">
          <Input value={form.tags} onChange={(v) => set('tags', v)} placeholder="z. B. Kabelzug, Functional" />
        </Field>
        <CheckboxField checked={form.verifiziert} onChange={(v) => set('verifiziert', v)} label="Maße verifiziert" hint="Maße stammen von der offiziellen Herstellerseite oder wurden am Gerät gemessen" />
        {/* Enter im Formular sendet ab */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
