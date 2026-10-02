#!/usr/bin/env python3
"""Gegenpruefung Preise (LimitlessPoster, 02.10.2026) - unabhaengige Nachrechnung.

1. Rechnet alle Zahlen der Tabellen 2a-2d, 3 und 4 in bericht.md mit den Annahmen des
   Berichts nach (eigener Code, Mindestpreise per Bisektion statt Formel) und vergleicht
   jede Zelle.
2. Rechnet dieselben Tabellen mit dem Live-Versand neu (Shopify-Umrechnung vom 02.10.2026).
   Mit --schreibe werden die Tabellen in bericht.md durch die korrigierten Werte ersetzt.

Aufruf aus dem Repo-Root:
  python3 shop-checkliste/arbeit-2026-10-02/preise/gegenpruefung.py [--schreibe]
Aendert nichts im Shop.
"""
import math, os, re, sys

HIER = os.path.dirname(os.path.abspath(__file__))
BERICHT = os.path.join(HIER, 'bericht.md')

UST, FX, WELCOME, FIXKOSTEN = 0.19, 0.02, 0.10, 40.0
KARTE, PAYPAL, DRITT = (0.021, 0.30), (0.0299, 0.39), 0.02

# Live 02.10.2026 (Admin-API): hoechster unitCost je Groesse ueber alle 1.350 Varianten (EUR)
PROD = {'28x36': 25.38, '30x46': 29.48, '41x51': 35.83, '46x61': 41.95, '51x76': 50.39, '61x91': 65.75}
# Versandprofile (Printify-Sync) in USD, live gelesen
VERSAND_USD = {'28x36': 26.39, '30x46': 26.39, '41x51': 26.39, '46x61': 26.39, '51x76': 28.99, '61x91': 34.69}
# Annahme im Bericht (Kurs 1,138, Stand 29.09.)
VERSAND_ALT = {'28x36': 23.19, '30x46': 23.19, '41x51': 23.19, '46x61': 23.19, '51x76': 25.48, '61x91': 30.49}
# Live: draftOrderCalculate.availableShippingRates, Lieferland DE, 02.10.2026 (= Checkout-Anzeige 23,46 EUR)
VERSAND_LIVE = {'28x36': 23.46, '30x46': 23.46, '41x51': 23.46, '46x61': 23.46, '51x76': 25.77, '61x91': 30.84}

PREISE = {
    'aktuell': {'28x36': 64.99, '30x46': 68.99, '41x51': 74.99, '46x61': 81.99, '51x76': 89.99, '61x91': 108.99},
    'minimal': {'28x36': 77.99, '30x46': 82.99, '41x51': 91.99, '46x61': 99.99, '51x76': 115.99, '61x91': 144.99},
    'gesund': {'28x36': 84.99, '30x46': 89.99, '41x51': 99.99, '46x61': 109.99, '51x76': 119.99, '61x91': 149.99},
}
GR = list(PROD)
CM = {k: k.replace('x', ' × ') for k in GR}
ABSCHNITT = {'2a': 'aktuell', '2b': 'minimal', '2c': 'gesund'}


def deckungsbeitrag(preis, netto, anzahl=1, rabatt=0.0, gebuehr=KARTE, kurs=0.0, dritt=0.0):
    """Ergebnis je Poster: Erloes - Zahlungsgebuehr - Printify brutto (inkl. USt, ggf. Kurspuffer)."""
    erloes = anzahl * preis * (1 - rabatt)
    zahlung = erloes * (gebuehr[0] + dritt) + gebuehr[1] if erloes > 0 else 0.0
    einkauf = anzahl * netto * (1 + UST) * (1 + kurs)
    return (erloes - zahlung - einkauf) / anzahl


def zeile(preis, netto):
    """Spalten der Tabellen 2a-2c."""
    return {
        'printify': netto * (1 + UST),
        'karte': deckungsbeitrag(preis, netto),
        'paypal': deckungsbeitrag(preis, netto, gebuehr=PAYPAL),
        'paypal2': deckungsbeitrag(preis, netto, anzahl=2, gebuehr=PAYPAL),
        'welcome': deckungsbeitrag(preis, netto, rabatt=WELCOME),
        'worst': deckungsbeitrag(preis, netto, rabatt=WELCOME, gebuehr=PAYPAL, kurs=FX),
        'stress': deckungsbeitrag(preis, netto, rabatt=WELCOME, gebuehr=PAYPAL, kurs=FX, dritt=DRITT),
        'test': deckungsbeitrag(preis, netto, rabatt=1.0),
    }


def mindestpreis(netto, ziel):
    lo, hi = 0.0, 1000.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if deckungsbeitrag(mid, netto, rabatt=WELCOME, gebuehr=PAYPAL, kurs=FX) < ziel:
            lo = mid
        else:
            hi = mid
    return hi


def eur(x):
    s = f'{x:.2f}'.replace('.', ',')
    return ('-' + s[1:] if s.startswith('-') else s) + ' €'


def groesse_aus_cm(text):
    """'36 × 28 cm' -> '28x36' (Hoch- und Querformat gleich)."""
    a, b = sorted(int(x) for x in re.findall(r'\d+', text)[:2])
    return f'{a}x{b}'


def zahlen(text):
    return [float(z.replace(',', '.')) for z in re.findall(r'-?\d+,\d\d', text)]


def tabellen(versand):
    """Alle Werte je Abschnitt fuer einen Versandansatz."""
    netto = {k: PROD[k] + versand[k] for k in GR}
    t = {a: {k: zeile(PREISE[v][k], netto[k]) for k in GR} for a, v in ABSCHNITT.items()}
    t['2d'] = {k: [mindestpreis(netto[k], z) for z in (0, 8, 12, 15)] for k in GR}
    t['4'] = {k: [('nie (Verlust)' if (d := zeile(PREISE[v][k], netto[k])['karte']) <= 0
                   else str(math.ceil(FIXKOSTEN / d))) for v in ('aktuell', 'minimal', 'gesund')] for k in GR}
    return t


def zeilen_2abc(a, w):
    out = []
    for k in GR:
        p, r = PREISE[ABSCHNITT[a]][k], w[a][k]
        out.append(f"| {CM[k]} cm | {eur(p)} | {eur(r['printify'])} | {eur(r['karte'])} ({r['karte'] / p * 100:.0f} %) | "
                   f"{eur(r['paypal'])} | {eur(r['paypal2'])} | {eur(r['welcome'])} | **{eur(r['worst'])}** | "
                   f"{eur(r['stress'])} | {eur(r['test'])} |")
    return out


def bericht_bloecke(text):
    """Liefert {abschnitt: [(zeilennr, zeile)]} fuer die Datenzeilen der Tabellen."""
    zl = text.split('\n')
    bl, akt = {}, None
    for i, z in enumerate(zl):
        if z.startswith('#'):
            m = re.match(r'^#{2,3} (2[abcd])\.|^## ([134])\.', z)
            akt = (m.group(1) or m.group(2)) if m else None
            continue
        if akt == '1' and not re.match(r'^\| [^|]+ \| \d+ × \d+ \|', z):
            continue
        if akt and z.startswith('| ') and re.search(r'\d+ × \d+', z) and not z.startswith('| Größe'):
            # in Abschnitt 4 nur die Break-even-Tabelle (beginnt mit Groesse in cm)
            if akt == '4' and not re.match(r'^\| \d+ × \d+ cm \|', z):
                continue
            bl.setdefault(akt, []).append((i, z))
    return zl, bl


def vergleiche(bl, w):
    fehler, n = [], 0
    for a in ('2a', '2b', '2c'):
        for (i, z), k in zip(bl[a], GR):
            r = w[a][k]
            ist = zahlen(z)[1:]
            soll = [r['printify'], r['karte'], r['paypal'], r['paypal2'], r['welcome'], r['worst'], r['stress'], r['test']]
            for x, y in zip(ist, soll):
                n += 1
                if abs(x - y) > 0.006:
                    fehler.append(f'{a} {k}: Bericht {x:.2f}, nachgerechnet {y:.2f}')
    for (i, z), k in zip(bl['2d'], GR):
        for x, y in zip(zahlen(z), w['2d'][k]):
            n += 1
            if abs(x - y) > 0.006:
                fehler.append(f'2d {k}: Bericht {x:.2f}, nachgerechnet {y:.2f}')
    for i, z in bl['3']:
        werte = zahlen(z)
        k = groesse_aus_cm(z.split(' | ')[1])
        soll = [PREISE['aktuell'][k], PREISE['minimal'][k], PREISE['gesund'][k],
                w['2a'][k]['worst'], w['2b'][k]['worst'], w['2c'][k]['worst']]
        for x, y in zip(werte, soll):
            n += 1
            if abs(x - y) > 0.006:
                fehler.append(f'3 {k}: Bericht {x:.2f}, nachgerechnet {y:.2f}')
    for (i, z), k in ((p, next(g for g in GR if f'| {CM[g]} cm |' in p[1])) for p in bl['4']):
        ist = [c.strip() for c in z.strip('|').split('|')[1:]]
        n += len(ist)
        if ist != w['4'][k]:
            fehler.append(f'4 {k}: Bericht {ist}, nachgerechnet {w["4"][k]}')
    return n, fehler


def schreibe(zl, bl, w):
    for a in ('2a', '2b', '2c'):
        for (i, _), neu in zip(bl[a], zeilen_2abc(a, w)):
            zl[i] = neu
    for (i, _), k in zip(bl['2d'], GR):
        zl[i] = f"| {CM[k]} cm | " + ' | '.join(eur(x) for x in w['2d'][k]) + ' |'
    for i, z in bl['3']:
        teile = z.split(' | ')
        k = groesse_aus_cm(teile[1])
        zl[i] = ' | '.join(teile[:3]) + f" | {eur(PREISE['aktuell'][k])} | **{eur(PREISE['minimal'][k])}** | " \
            f"**{eur(PREISE['gesund'][k])}** | {eur(w['2a'][k]['worst'])} | {eur(w['2b'][k]['worst'])} | {eur(w['2c'][k]['worst'])} |"
    for i, z in bl['4']:
        k = next(g for g in GR if f'| {CM[g]} cm |' in z)
        zl[i] = f"| {CM[k]} cm | " + ' | '.join(w['4'][k]) + ' |'
    for i, z in bl.get('1', []):
        k = next(g for g in GR if f'| {CM[g]} |' in z)
        zl[i] = re.sub(r'\| [\d,]+ \([\d,]+ USD\) \|$', f"| {eur(VERSAND_LIVE[k])[:-2]} ({eur(VERSAND_USD[k])[:-2]} USD) |", z)
    return '\n'.join(zl)


def main():
    text = open(BERICHT, encoding='utf-8').read()
    zl, bl = bericht_bloecke(text)
    alt, neu = tabellen(VERSAND_ALT), tabellen(VERSAND_LIVE)
    n, fehler = vergleiche(bl, alt)
    n2, diff = vergleiche(bl, neu)
    print(f'{n} Zellen im Bericht geprueft (eigene Nachrechnung):')
    print(f'  gegen Annahme alter Versand (23,19 EUR): {len(fehler)} Abweichungen')
    print(f'  gegen Live-Versand (23,46 EUR):          {len(diff)} Abweichungen')
    if fehler and diff:
        for f in diff[:20]:
            print('   ', f)
    print('\nKurs laut Shopify heute: ' + ', '.join(f'{VERSAND_USD[k] / VERSAND_LIVE[k]:.4f}' for k in ('28x36', '51x76', '61x91')))
    print('\nKorrigiert (Live-Versand), schlechtester Fall je Variante:')
    for a, v in ABSCHNITT.items():
        print(f'  {v:8s}', ' | '.join(f'{CM[k]}: {neu[a][k]["worst"]:7.2f}' for k in GR))
    print('  Karte aktuell', ' | '.join(f'{CM[k]}: {neu["2a"][k]["karte"]:6.2f}' for k in GR))
    if '--schreibe' in sys.argv:
        if diff:
            open(BERICHT, 'w', encoding='utf-8').write(schreibe(zl, bl, neu))
            print('\nbericht.md: Tabellen 1, 2a-2d, 3 und 4 auf Live-Versand umgestellt')
        else:
            print('\nbericht.md ist bereits aktuell')


if __name__ == '__main__':
    main()
