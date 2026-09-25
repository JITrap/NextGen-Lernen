// Erzeugt data/atlantis.json und data/prime.json aus den Markdown-Tabellen der Spezifikation.
// Aufruf: node scripts/build-data-from-spec.mjs <pfad/zur/PROMPT.md>
import fs from 'node:fs';
import path from 'node:path';

const specPath = process.argv[2];
if (!specPath) { console.error('Pfad zur Spezifikation fehlt'); process.exit(1); }
const md = fs.readFileSync(specPath, 'utf8');
const lines = md.split('\n');

const ATLANTIS_CATEGORY_TO_DE = {
  'Ab Crunch Machines': 'Rumpf',
  'Biceps Machines': 'Arme',
  'Chest Fly Machines': 'Brust',
  'Abductors': 'Beine',
  'Chest Press': 'Brust',
  'Forearm Machines': 'Arme',
  'Glute And Hamstring Machines': 'Beine',
  'Lateral Raise Machines': 'Schultern',
  'Pullover Machines': 'Rücken',
  'Rowing Machines': 'Rücken',
  'Shoulder Press': 'Schultern',
  'Standing Calf Raise Machines': 'Beine',
  'Lat Pulldown Machines': 'Rücken',
  'Leg Curl Machines': 'Beine',
  'Leg Extension Machines': 'Beine',
  'Leg Press': 'Beine',
  'Pull-up Machines': 'Rücken',
  'Triceps Machines': 'Arme',
  'Neck Strengthening Machines': 'Rumpf',
  'Shrug Machines': 'Schultern',
  'Hyper Extension Machines': 'Rücken',
  'Seated Calf Machines': 'Beine',
  'Hip Machines': 'Beine',
  'Benches': 'Bänke',
  'Leg Raise Machines': 'Rumpf',
  'Sit-Up Benches': 'Rumpf',
  'Dumbbell racks': 'Ablagen',
  'Olympic Bench Press': 'Bänke',
  'Tibia Dorsi Calf Machine': 'Beine',
  'Weight Racks': 'Ablagen',
  'Accessories For Gyms': 'Plattformen',
  'Bodybuilding machines': 'Racks',
  'Calf Platforms': 'Plattformen',
  'Dip Station': 'Arme',
  'Gym Racks': 'Racks',
  'Strongman': 'Kabel/Functional',
  'Weightlifting Platforms': 'Plattformen',
  'Functional Trainers': 'Kabel/Functional',
  'Multistations': 'Racks',
};

function primeCategory(name, series) {
  const n = name.toLowerCase();
  if (series === 'Benches') return 'Bänke';
  if (series === 'Prodigy Racks') return 'Racks';
  if (n.includes('dumbbell rack')) return 'Ablagen';
  if (n.includes('functional trainer') || n.includes('smart arm')) return 'Kabel/Functional';
  if (n.includes('chin') && n.includes('dip')) return 'Rücken';
  if (n.includes('preacher') || n.includes('arm curl') || n.includes('tricep') || n.includes('pushdown')) return 'Arme';
  if (n.includes('crunch') || n.includes('rotary torso')) return 'Rumpf';
  if (n.includes('chest') || n.includes('incline press') || n.includes('pec')) return 'Brust';
  if (n.includes('pulldown') || n.includes('row') || n.includes('pullover') || n.includes('back extension')) return 'Rücken';
  if (n.includes('shoulder') || n.includes('lateral raise')) return 'Schultern';
  if (n.includes('leg') || n.includes('thigh') || n.includes('hip') || n.includes('squat') || n.includes('calf')) return 'Beine';
  throw new Error('Unbekannte Prime-Kategorie: ' + name);
}

function slug(s) {
  return s.toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function num(v) {
  const t = v.trim();
  if (t === '' || t === '–' || t === '-') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error('Keine Zahl: ' + v);
  return n;
}

function zoneFor(kategorieDe, hersteller, name) {
  const n = name.toLowerCase();
  if (kategorieDe === 'Plattformen') return { vorne: 0, hinten: 0, links: 0, rechts: 0 };
  if (kategorieDe === 'Ablagen') return { vorne: 100, hinten: 0, links: 0, rechts: 0 };
  if (n.includes('wall mount')) return { vorne: 150, hinten: 0, links: 60, rechts: 60 };
  if (n.includes('chin-up beam')) return { vorne: 60, hinten: 60, links: 0, rechts: 0 };
  return { vorne: 60, hinten: 60, links: 60, rechts: 60 };
}

const atlantis = [];
const prime = [];
let section = null; // 'atlantis' | 'prime'
let series = null;
let inTable = false;
let header = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const h = line.match(/^#### (Atlantis|Prime) – (.+?) \((\d+) Geräte\)/);
  if (h) {
    section = h[1] === 'Atlantis' ? 'atlantis' : 'prime';
    series = h[2].replace(/ \(nur als Anbau.*\)$/, '').trim();
    inTable = false;
    continue;
  }
  if (line.startsWith('#### ') || line.startsWith('### ') || line.startsWith('## ')) {
    if (!/^#### (Atlantis|Prime)/.test(line)) { inTable = false; if (line.startsWith('### ')) section = null; }
    continue;
  }
  if (!section) continue;
  if (line.startsWith('| Modell')) { header = line.split('|').map(s => s.trim()).filter(Boolean); inTable = true; continue; }
  if (inTable && line.startsWith('|---')) continue;
  if (inTable && line.startsWith('|')) {
    const cells = line.split('|').slice(1, -1).map(s => s.trim());
    if (section === 'atlantis') {
      const [modell, bezeichnung, kategorie, b, t, hh, kg, extra] = cells;
      const kategorieDe = ATLANTIS_CATEGORY_TO_DE[kategorie];
      if (!kategorieDe) throw new Error('Unbekannte Atlantis-Kategorie: ' + kategorie);
      const isRackModule = series.startsWith('Rack-Module');
      const hinweise = [];
      if (modell === 'B7272') hinweise.push('Gewicht auf Herstellerseite vermutlich fehlerhaft (das kleinere Modell B4872 wiegt 251 kg)');
      else if (extra && extra.startsWith('Gewicht auf Herstellerseite')) hinweise.push(extra);
      if (isRackModule) hinweise.push('Rack-Modul: nur als Anbau an Atlantis-Racks/Multistationen (Snap an Rackseite)');
      const extraClean = extra && !extra.startsWith('Gewicht auf Herstellerseite') ? extra : undefined;
      const entry = {
        id: 'atlantis-' + slug(modell),
        kategorie: kategorieDe,
        unterkategorie: kategorie,
        hersteller: 'Atlantis',
        serie: isRackModule ? 'Rack-Module' : series,
        modell,
        name: bezeichnung,
        breite_cm: num(b),
        tiefe_cm: num(t),
        hoehe_cm: num(hh),
        gewicht_kg: num(kg),
        ...(extraClean ? { extra: extraClean } : {}),
        ...(hinweise.length ? { hinweis: [...new Set(hinweise)].join('; ') } : {}),
        sicherheitszone_cm: zoneFor(kategorieDe, 'Atlantis', bezeichnung),
        form: 'rechteck',
        skalierbar: false,
        quelle_url: 'https://atlantisstrength.com/gym-equipment/' + slug(modell),
        verifiziert: true,
        ...(isRackModule ? { nur_an_rack: true } : {}),
      };
      atlantis.push(entry);
    } else {
      const [modell, b, t, hh, kg, extra] = cells;
      const kategorieDe = primeCategory(modell, series);
      let extraClean; let hinweis;
      if (extra) {
        const m = extra.match(/^(Steckgewicht \d+ kg|mit Beinpolster-Aufsatz: T \d+ cm)(?:, (.*))?$/);
        if (m) { extraClean = m[1]; if (m[2]) hinweis = m[2]; }
        else hinweis = extra;
      }
      if (series === 'Evolution') hinweis = (hinweis ? hinweis + '; ' : '') + 'L/W-Werte wie vom Hersteller angegeben; Maße vor Kauf beim Händler bestätigen';
      const handle = slug(series === 'Benches' || series === 'Specialty' || series === 'Wall Mounts' ? modell : series + ' ' + modell);
      const entry = {
        id: 'prime-' + slug(series) + '-' + slug(modell),
        kategorie: kategorieDe,
        unterkategorie: series,
        hersteller: 'Prime',
        serie: series,
        modell,
        name: modell,
        breite_cm: num(b),
        tiefe_cm: num(t),
        hoehe_cm: num(hh),
        gewicht_kg: num(kg),
        ...(extraClean ? { extra: extraClean } : {}),
        ...(hinweis ? { hinweis } : {}),
        sicherheitszone_cm: zoneFor(kategorieDe, 'Prime', modell),
        form: 'rechteck',
        skalierbar: false,
        quelle_url: 'https://www.primefitnessusa.com/products/' + handle,
        verifiziert: true,
        ...(modell.toLowerCase().includes('wall mount') ? { wandmontage: true } : {}),
      };
      prime.push(entry);
    }
    continue;
  }
  if (inTable && !line.startsWith('|')) inTable = false;
}

const ids = new Set();
for (const e of [...atlantis, ...prime]) {
  if (ids.has(e.id)) throw new Error('Doppelte ID: ' + e.id);
  ids.add(e.id);
}

const out = (name, arr, meta) => fs.writeFileSync(
  path.join('data', name),
  JSON.stringify({ ...meta, anzahl: arr.length, geraete: arr }, null, 2) + '\n'
);
out('atlantis.json', atlantis, {
  hersteller: 'Atlantis Strength',
  quelle: 'https://atlantisstrength.com/gym-equipment/',
  stand: '2026-09-25',
  hinweis: 'Alle Maße in cm, Gewicht in kg, direkt von der Herstellerseite übernommen (Außenmaße ohne Sicherheitszone).',
});
out('prime.json', prime, {
  hersteller: 'Prime Fitness',
  quelle: 'https://www.primefitnessusa.com/products/',
  stand: '2026-09-25',
  hinweis: 'Alle Maße in cm, Gewicht in kg, direkt von der Herstellerseite übernommen (Zoll-Angaben mit 1 in = 2,54 cm umgerechnet).',
});
console.log('Atlantis:', atlantis.length, 'Prime:', prime.length);
const bySeries = {};
for (const e of [...atlantis, ...prime]) bySeries[e.hersteller + ' / ' + e.serie] = (bySeries[e.hersteller + ' / ' + e.serie] || 0) + 1;
console.log(bySeries);
