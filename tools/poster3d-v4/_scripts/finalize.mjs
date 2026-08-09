import fs from 'node:fs';

const greedy = JSON.parse(fs.readFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/out/match-greedy.json', 'utf8'));
const pinsMeta = JSON.parse(fs.readFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/out/pinterest-pins.json', 'utf8'));

// Manual corrections based on visual verification during calibration:
// 1) pin 841891724136118423 ("enjoy the now") was greedily grabbed by
//    "a-lot-can-happen-in-a-year" at d=61, but visual check showed this is a
//    FALSE match (different quote). The true source pin for that handle is
//    841891724136118458 (d=66, a=17, visually confirmed identical).
let list = greedy.filter(r => !(r.pinId === '841891724136118423' && r.handle === 'framed-poster-a-lot-can-happen-in-a-year-inspirational-wall-art'));
list = list.filter(r => !(r.pinId === '841891724136118458')); // drop its wrong greedy assignment (football-legends, d=97)
list.push({ pinId: '841891724136118458', handle: 'framed-poster-a-lot-can-happen-in-a-year-inspirational-wall-art', dHash: 66, aHash: 17 });

// 2) pin 841891724136118239 matched "framed-poster-focus-on-you-black-panther-wall-art-vertical"
//    at d=84, but visual check showed this pin actually depicts the leopard-on-branch photo
//    (already correctly matched elsewhere) against an unrelated black-panther product photo. Drop it.
list = list.filter(r => !(r.pinId === '841891724136118239' && r.handle === 'framed-poster-focus-on-you-black-panther-wall-art-vertical'));

function classify(dHash) {
  if (dHash <= 80) return 'sicher';
  if (dHash <= 105) return 'unsicher';
  return 'kein Treffer';
}

const withClass = list.map(r => ({ ...r, klass: classify(r.dHash) }));
const matched = withClass.filter(r => r.klass !== 'kein Treffer');

const finalOut = matched.map(r => ({
  pinId: r.pinId,
  handle: r.handle,
  distanz: r.dHash,
  sicher: r.klass === 'sicher',
}));
finalOut.sort((a, b) => a.distanz - b.distanz);
fs.writeFileSync('/home/user/NextGen-Lernen/tools/poster3d-v4/out/pinterest-match.json', JSON.stringify(finalOut, null, 2));

const totalPins = pinsMeta.length;
const sicherN = finalOut.filter(r => r.sicher).length;
const unsicherN = finalOut.filter(r => !r.sicher).length;
const keinN = totalPins - sicherN - unsicherN;

console.log('Total Pins:', totalPins);
console.log('sicher:', sicherN);
console.log('unsicher:', unsicherN);
console.log('kein Treffer:', keinN, '(', 175 - list.length, 'nie einem Handle zugewiesen +', withClass.filter(r=>r.klass==='kein Treffer').length, 'ueber Schwelle )');
