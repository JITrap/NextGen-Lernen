/* Kuratierte Kategorie-Zuordnung aller Produkte. Druckt pro Kollektion die
   fertigen Variables für collectionAddProducts (id + productIds). */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const products = JSON.parse(readFileSync(resolve(ROOT, 'products.json'), 'utf8'));
const collections = JSON.parse(readFileSync(resolve(ROOT, 'out/collections.json'), 'utf8'));

/* Kürzel → Handle-Listen. Kuratiert nach Titel + Bildprüfung:
   - Signatur-/Headshot-Porträts = Messi/Ronaldo (LEGENDS)
   - Kristall-Handschuh = Michael-Jackson-Motiv (ICONS/Artists)
   - Space-Surfer = Silver Surfer (Film & Series)
   - "World is yours" = Scarface (Film & Series)
   - Blüten-Jaguar/Leoparden/Schwan = QUEENS/STILL-Ästhetik */

const A = {
  'apex-motorsport-cars': [
    'framed-poster-ferrari-and-white-stallion-art-print',
    'marlboro-f1-racing-car-poster-horizontal-framed-print',
    'racing-poster-no-risk-no-story-framed-motorsport-wall-art',
    'no-risk-no-porsche-framed-poster-retro-palm-springs-wall-art',
    'race-track-art-poster-framed-vertical-print-with-formula-car-loop-design',
    'ferrari-scuderia-formula-1-vertical-framed-poster',
    'inspirational-racing-poster-they-overlooked-me-god-didn-t-vertical-framed-print',
    'horizontal-framed-poster',
    'vintage-porsche-poster-retro-car-carousel-horse-vertical-framed-art',
    'vintage-sports-car-horse-art-poster-retro-automotive-wall-decor',
    'racing-poster-whats-behind-you-doesnt-matter-framed-motivational-print',
    'poster-surreal-horse-vintage-car-art-print',
  ],
  'grit-boxing-mma': [
    'sacrifice-today-own-tomorrow-framed-motivational-boxing-poster',
    'motivational-fight-club-poster-hard-way-builds-the-strongest-vertical-framed-art',
  ],
  'legends-sports-icons': [
    'framed-poster-be-different-michael-jordan-basketball-print',
    'motivational-soccer-poster-its-you-vs-you-ronaldo-7-framed-print',
    'goat-framed-poster-vintage-sports-portrait-wall-art',
    'jesus-headband-poster-black-white-signed-athlete-portrait-wall-art',
    'messi-make-them-wonder-soccer-poster',
    'framed-poster-messi-black-white-portrait-wall-art',
    'framed-football-legends-poster-neymar-cristiano-messi-trio-print',
    'framed-portrait-poster-minimal-black-white-signature-art',
    'framed-black-white-portrait-poster-minimalist-signed-headshot-art',
    'framed-poster-bold-red-graffiti-portrait',
    'they-doubt-me-i-deliver',
  ],
  'queens-feminine-energy': [
    'swan-lake-framed-art-print-serene-watercolor-swan-poster',
    'floral-motivational-poster-your-only-limit-is-your-mind-vertical-framed-art',
    'framed-poster-dont-wait-to-be-happy-minimal-red-script-wall-art',
    'motivational-framed-poster-the-only-limit-is-your-mind-black-white-wall-art',
    'dressage-horse-poster-equestrian-art-print-vertical-framed',
    'leopard-on-branch-framed-poster-minimalist-wildlife-wall-art',
    'go-get-that-dream-leopard-poster',
    'roaring-jaguar-floral-poster',
  ],
  'still-quiet-luxury': [
    'dressage-horse-poster-equestrian-art-print-vertical-framed',
    'swan-lake-framed-art-print-serene-watercolor-swan-poster',
    'leopard-on-branch-framed-poster-minimalist-wildlife-wall-art',
    'leopard-on-branch-black-white-framed-poster',
    'roaring-jaguar-floral-poster',
    'black-doberman-among-sheep-poster-monochrome-animal-wall-art',
    'framed-poster-focus-on-you-black-panther-wall-art-vertical',
    'tennis-court-framed-poster-aerial-green-court-art-print',
    'tennis-court-framed-poster-aerial-tennis-match-wall-art',
    'wimbledon-tennis-court-framed-poster',
    'ocean-predator-art-poster-sharks-aerial-surf-scene-vertical-framed-print',
    'framed-poster-aerial-yacht-wake-ocean-print',
    'framed-poster-vintage-mediterranean-tutto-passa-seaside-portrait',
    'motivational-mountain-poster-it-always-been-you-vs-you-framed-wall-art',
  ],
  'heritage-timeless-classics': [
    'goat-framed-poster-vintage-sports-portrait-wall-art',
    'marlboro-f1-racing-car-poster-horizontal-framed-print',
    'no-risk-no-porsche-framed-poster-retro-palm-springs-wall-art',
    'poster-surreal-horse-vintage-car-art-print',
    'la-dolce-vita-framed-poster-italian-phrase-wall-art',
    'framed-poster-vintage-mediterranean-tutto-passa-seaside-portrait',
    'horizontal-framed-poster',
    'vintage-porsche-poster-retro-car-carousel-horse-vertical-framed-art',
    'vintage-sports-car-horse-art-poster-retro-automotive-wall-decor',
    'self-respect-framed-poster-vintage-godfather-quote-wall-art',
    'framed-poster-ferrari-and-white-stallion-art-print',
  ],
  'icons-music-culture': [
    'framed-poster-crystal-gloved-hand-ok-sign-wall-art',
    'red-icon-music-poster',
    'money-talks-framed-poster-benjamin-franklin-eye-art-print',
  ],
  artists: [
    'red-icon-music-poster',
    'framed-poster-crystal-gloved-hand-ok-sign-wall-art',
  ],
  'film-series': [
    'self-respect-framed-poster-vintage-godfather-quote-wall-art',
    'motivational-fight-club-poster-hard-way-builds-the-strongest-vertical-framed-art',
    'la-dolce-vita-framed-poster-italian-phrase-wall-art',
    'framed-poster-the-world-is-yours-motivational-wall-art',
    'vertical-poster-the-perfect-time-never-comes-motivational-wall-art-the-world-is-yours',
    'framed-poster-never-forgetting-where-we-came-from-space-surfer-print',
  ],
};

/* Sports: alles mit echtem Sportbezug (Fußball, Basketball, Tennis, Gym/Fitness,
   Golf, Boxen, Racing/F1, Sport-Trophäen). */
const sportsRx = /(soccer|football|basketball|tennis|gym|fitness|golf|boxing|fight-club|racing|formula|f1|wimbledon|trophy|world-cup|jordan|messi|ronaldo|athlete|sports)/;
A.sports = products.map(p => p.handle).filter(h =>
  sportsRx.test(h)
  && !/dressage/.test(h)
);
A.sports.push('they-doubt-me-i-deliver', 'goat-framed-poster-vintage-sports-portrait-wall-art',
  'framed-portrait-poster-minimal-black-white-signature-art',
  'framed-black-white-portrait-poster-minimalist-signed-headshot-art',
  'framed-poster-bold-red-graffiti-portrait');

/* MINDSET (Words & Ambition): Titel IST ein Motivations-Statement. */
const mindsetRx = /(a-lot-can-happen|become-unstoppable|believe-in-yourself|all-or-nothing|class-intensity-grit|discipline|do-it-alone|dont-quit|dont-wait-to-be-happy|focus|get-up-we-aint|go-get-that-dream|god-is-with-me|i-always-win|i-dont-know-how|i-win-thats|if-you-quit|in-god-we-trust|its-more-than-football|its-not-over|you-vs-you|just-do-it|just-do-some-creative|luke-1-37|make-them-wonder|money-follows-value|motivational-quote-vertical|never-forgetting|never-too-late-to-lock-in|no-excuses|no-risk-no-story|no-risk-no-porsche|pressure-is-a-privilege|pressure-makes-diamonds|prove-yourself-right|risk-is-better-than-regret|sacrifice-today|set-your-own-standard|start-unknown|stay-focused|stay-hungry|the-goal-never-moves|the-only-limit|the-perfect-time|the-world-is-yours|the-world-rewards-action|they-doubt-me|they-overlooked-me|trust-god|whatever-it-takes|work-so-hard|your-dreams-need-you|your-only-limit|hard-way-builds|be-different|you-were-born-an-original)/;
const mindsetExcl = /(soccer|football|basketball|tennis|gym|fitness|golf|boxing|fight-club|racing|ronaldo|messi|jordan|trophy|world-cup)/;
A['mindset-words-ambition'] = products.map(p => p.handle).filter(h => mindsetRx.test(h) && !mindsetExcl.test(h));

/* Quotes (Worte mit Gewicht): typografie-/zitatdominante Blätter. */
A.quotes = [
  'framed-poster-a-lot-can-happen-in-a-year-inspirational-wall-art',
  'dont-quit-framed-poster-minimal-motivational-wall-art',
  'framed-poster-dont-wait-to-be-happy-minimal-red-script-wall-art',
  'get-up-we-aint-rich-yet-motivational-wall-poster',
  'framed-poster-god-is-with-me-i-cant-lose-inspirational-wall-art',
  'motivational-poster-i-always-win-vertical-framed-wall-art',
  'framed-poster-just-do-some-creative-shits-bold-typographic-art-print',
  'la-dolce-vita-framed-poster-italian-phrase-wall-art',
  'money-follows-value-framed-poster-motivational-office-wall-art',
  'motivational-quote-vertical-framed-poster-black-text-on-white-canvas',
  'motivational-poster-it-s-never-too-late-to-lock-in-black-white-portrait-art',
  'motivational-poster-no-excuses-just-results-vertical-wall-art',
  'no-risk-no-story-poster-whimsical-baby-photo-wall-art',
  'motivational-prove-yourself-right-framed-poster-inspiring-wall-art-for-home-or-office',
  'self-respect-framed-poster-vintage-godfather-quote-wall-art',
  'motivational-poster-set-your-own-standard-vertical-framed-art',
  'framed-poster-start-unknown-finish-unforgettable-inspirational-vertical-wall-art',
  'framed-poster-the-perfect-time-never-comes-motivational-wall-art',
  'framed-poster-the-world-rewards-action-motivational-space-wall-art',
  'trust-god-poster',
  'framed-poster-vintage-mediterranean-tutto-passa-seaside-portrait',
  'whatever-it-takes-framed-poster-motivational-bedroom-wall-art',
  'framed-poster-work-so-hard-that-they-think-you-are-crazy-motivational-wall-art',
  'framed-motivational-poster-you-were-born-an-original-don-t-die-a-copy',
];

/* Statements (Sag es, ohne zu reden): Quotes + laute/attitüdenstarke Blätter. */
A.statements = [...new Set([
  ...A.quotes,
  'vertical-poster-fuck-them-all-street-art-money-throwing-print',
  'framed-poster-watching-eyes-money-tear-wall-art-horizontal',
  'money-talks-framed-poster-benjamin-franklin-eye-art-print',
  'black-doberman-among-sheep-poster-monochrome-animal-wall-art',
  'framed-poster-the-world-is-yours-motivational-wall-art',
  'motivational-framed-poster-its-not-over-until-i-win',
  'become-unstoppable-framed-poster-motivational-sports-wall-art',
  'motivational-poster-i-always-win-vertical-framed-wall-art',
  'get-up-we-aint-rich-yet-motivational-wall-poster',
])];

/* New Drop: die 20 zuletzt angelegten Produkte (products.json ist in Anlage-Reihenfolge). */
A['new-drop'] = products.slice(-20).map(p => p.handle);

// ---- Validierung + Ausgabe ----
const byHandle = Object.fromEntries(products.map(p => [p.handle, p.id]));
let total = 0;
const out = {};
for (const [col, handles] of Object.entries(A)) {
  const meta = collections[col];
  if (!meta) throw new Error('Kollektion fehlt: ' + col);
  const uniq = [...new Set(handles)];
  const bad = uniq.filter(h => !byHandle[h]);
  if (bad.length) throw new Error(col + ': unbekannte Handles: ' + bad.join(', '));
  const existing = new Set(meta.products || []);
  const add = uniq.filter(h => !existing.has(h));
  out[col] = { id: meta.id, count: add.length, variables: { id: meta.id, productIds: add.map(h => byHandle[h]) } };
  total += add.length;
}
for (const [col, o] of Object.entries(out)) console.log(`### ${col} (+${o.count})`);
console.log('Gesamt-Zuordnungen:', total);
process.stdout.write('\n' + JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.variables]))) + '\n');
