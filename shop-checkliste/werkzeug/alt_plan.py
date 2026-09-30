# -*- coding: utf-8 -*-
"""Alt-Texte fuer Produktbilder planen (LimitlessPoster, 30.09.2026).
Aufruf: python3 alt_plan.py <nodes-antwort.json> <ausgabe-ordner>
Schreibt vorher.json (Stand vor der Aenderung) und plan.json (Liste {id, alt} fuer fileUpdate).
Regel: Titel; bei eindeutiger Rahmenfarbe ', schwarzer/weißer Rahmen'; bei eindeutiger Groesse ', ca. B × H cm';
Bilder ohne Variantenbezug: ', gerahmtes Poster – Ansicht N' (fortlaufend ab 1, wie bei den bereits beschrifteten Produkten).
Vorhandene Alt-Texte bleiben unveraendert."""
import json, os, re, sys

CM = {11: 28, 12: 30, 14: 36, 16: 41, 18: 46, 20: 51, 24: 61, 30: 76, 36: 91}
FARBE = {'black': 'schwarzer Rahmen', 'white': 'weißer Rahmen'}

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
data = json.load(open(src, encoding='utf-8'))['data']['nodes']

vorher, plan = {}, []
for p in data:
    if not p:
        continue
    title = p['title'].strip()
    imgs = [m for m in p['media']['nodes'] if m and m.get('id')]
    vorher[p['id']] = [{'id': m['id'], 'alt': m.get('alt')} for m in imgs]
    by_media = {}
    for v in p['variants']['nodes']:
        opts = {o['name'].lower(): o['value'] for o in v['selectedOptions']}
        for m in v['media']['nodes']:
            by_media.setdefault(m['id'], []).append(opts)
    n = 0
    for m in imgs:
        if (m.get('alt') or '').strip():
            continue
        vs = by_media.get(m['id'], [])
        colors = {o.get('color', '').lower() for o in vs if o.get('color')}
        sizes = {o.get('size', '') for o in vs if o.get('size')}
        parts = []
        if len(colors) == 1 and next(iter(colors)) in FARBE:
            parts.append(FARBE[next(iter(colors))])
        if len(sizes) == 1:
            nums = [int(x) for x in re.findall(r'\d+', next(iter(sizes)))]
            if len(nums) == 2 and all(x in CM for x in nums):
                parts.append(f'ca. {CM[nums[0]]} × {CM[nums[1]]} cm')
        if parts:
            alt = title + ', ' + ', '.join(parts)
        else:
            n += 1
            alt = f'{title}, gerahmtes Poster – Ansicht {n}'
        assert len(alt) <= 125, (alt, len(alt))
        plan.append({'id': m['id'], 'alt': alt})

json.dump(vorher, open(os.path.join(out, 'vorher.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
json.dump(plan, open(os.path.join(out, 'plan.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('produkte', len(vorher), 'neue alt-texte', len(plan))
for x in plan[:4] + plan[-2:]:
    print(' ', x['alt'])
