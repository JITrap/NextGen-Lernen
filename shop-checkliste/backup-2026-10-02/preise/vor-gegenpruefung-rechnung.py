#!/usr/bin/env python3
"""Deckungsbeitrag je Postergroesse (LimitlessPoster, Stand 02.10.2026).
Liest Preise/unitCost aus shop-checkliste/daten/produkte-2026-10-02.json,
schreibt preise-empfehlung.json und gibt die Markdown-Tabellen fuer den Bericht aus.
Aufruf aus dem Repo-Root: python3 shop-checkliste/arbeit-2026-10-02/preise/rechnung.py
Optional: --plan minimal|gesund schreibt preis-update-<variante>.json
([{productId, variants:[{id, price}]}] fuer productVariantsBulkUpdate; Varianten-IDs bleiben
bei der Umbenennung der Optionswerte auf cm gleich). Nichts davon aendert den Shop.
"""
import json, re, os
from collections import defaultdict

HIER = os.path.dirname(os.path.abspath(__file__))
DATEN = os.path.join(HIER, '..', '..', 'daten', 'produkte-2026-10-02.json')

# --- Annahmen (Quellen im Bericht) ---------------------------------------
UST = 0.19            # USt, die Printify auf Produkt + Versand berechnet (kein Vorsteuerabzug, § 19 UStG)
FX = 0.02             # Waehrungs-/Kurspuffer auf Printify-Betrag (Printify kalkuliert in USD) - nur im schlechtesten Fall
KARTE = (0.021, 0.30) # Shopify Payments Basic, Karten aus EWR (inkl. Apple/Google Pay, Shop Pay)
PAYPAL = (0.0299, 0.39)  # PayPal Checkout DE; bei aktivem Shopify Payments keine Shopify-Transaktionsgebuehr
SHOPIFY_DRITT = 0.02  # Shopify-Transaktionsgebuehr Basic fuer Drittanbieter (nur falls Shopify Payments NICHT aktiv)
WELCOME = 0.10
# Printify-Versand nach DE je Poster (jedes weitere Poster gleich teuer), USD laut Versandprofil -> EUR wie im Checkout berechnet
VERSAND = {'11x14': 23.19, '12x18': 23.19, '16x20': 23.19, '18x24': 23.19, '20x30': 25.48, '24x36': 30.49}
VERSAND_USD = {'11x14': 26.39, '12x18': 26.39, '16x20': 26.39, '18x24': 26.39, '20x30': 28.99, '24x36': 34.69}
CM = {11: 28, 12: 30, 14: 36, 16: 41, 18: 46, 20: 51, 24: 61, 30: 76, 36: 91}

# Empfehlungen (je Groesse, Hoch- und Querformat gleich)
MINIMAL = {'11x14': 77.99, '12x18': 82.99, '16x20': 91.99, '18x24': 99.99, '20x30': 115.99, '24x36': 144.99}
GESUND = {'11x14': 84.99, '12x18': 89.99, '16x20': 99.99, '18x24': 109.99, '20x30': 119.99, '24x36': 149.99}
REIHENFOLGE = ['11x14', '12x18', '16x20', '18x24', '20x30', '24x36']


def zahl(t):
    return [int(x) for x in re.findall(r'\d+', t)[:2]]


def schluessel(t):
    a, b = zahl(t)
    return f'{min(a, b)}x{max(a, b)}'


def lade():
    d = json.load(open(DATEN))
    g = defaultdict(lambda: {'preise': set(), 'kosten': [], 'titel': set(), 'var': 0})
    for p in d:
        for v in p['variants']['nodes']:
            groesse = v['title'].split(' / ')[0]
            k = schluessel(groesse)
            g[k]['preise'].add(float(v['price']))
            g[k]['kosten'].append(float(v['inventoryItem']['unitCost']['amount']))
            g[k]['titel'].add(groesse)
            g[k]['var'] += 1
    return g


def db(preis, prod, versand, rabatt=0.0, zahlung=KARTE, fx=0.0, n=1, dritt=0.0):
    """Deckungsbeitrag je Poster in EUR."""
    umsatz = preis * (1 - rabatt) * n
    gebuehr = umsatz * (zahlung[0] + dritt) + zahlung[1] if umsatz > 0 else 0.0
    printify = (prod + versand) * (1 + UST) * (1 + fx) * n
    return (umsatz - gebuehr - printify) / n


def worst(preis, prod, versand):
    return db(preis, prod, versand, WELCOME, PAYPAL, FX)


def aus(text=''):
    """Markdown-Ausgabe mit deutschem Dezimalkomma."""
    print(re.sub(r'(\d)\.(\d\d)\b', r'\1,\2', text))


def main():
    g = lade()
    aus('## Ist-Daten je Groesse\n')
    aus('| Groesse (Zoll) | cm | Varianten | Preis | unitCost Spanne | Rechenbasis Produktion | Versand DE |')
    aus('|---|---|---|---|---|---|---|')
    basis = {}
    for k in REIHENFOLGE:
        x = g[k]
        a, b = map(int, k.split('x'))
        prod = max(x['kosten'])
        basis[k] = prod
        aus(f"| {' / '.join(sorted(x['titel']))} | {CM[a]} × {CM[b]} | {x['var']} | "
              f"{', '.join(f'{p:.2f}' for p in sorted(x['preise']))} | {min(x['kosten']):.2f}–{max(x['kosten']):.2f} | "
              f"{prod:.2f} | {VERSAND[k]:.2f} ({VERSAND_USD[k]:.2f} USD) |")

    def tabelle(titel, preise):
        aus(f'\n## {titel}\n')
        aus('| Groesse | Preis | Printify inkl. 19 % USt | DB Karte | DB PayPal | DB 2 Poster PayPal (je Poster) '
              '| DB Karte + WELCOME10 | DB schlechtester Fall* | DB Stress** | Testcode 100 % |')
        aus('|---|---|---|---|---|---|---|---|---|---|')
        for k in REIHENFOLGE:
            a, b = map(int, k.split('x'))
            P, prod, v = preise[k], basis[k], VERSAND[k]
            pr = (prod + v) * (1 + UST)
            r = [db(P, prod, v), db(P, prod, v, zahlung=PAYPAL), db(P, prod, v, zahlung=PAYPAL, n=2),
                 db(P, prod, v, WELCOME), worst(P, prod, v), db(P, prod, v, WELCOME, PAYPAL, FX, dritt=SHOPIFY_DRITT),
                 db(P, prod, v, rabatt=1.0)]
            pct = r[0] / P * 100
            aus(f'| {CM[a]} × {CM[b]} cm | {P:.2f} € | {pr:.2f} € | {r[0]:.2f} € ({pct:.0f} %) | {r[1]:.2f} € | {r[2]:.2f} € | '
                  f'{r[3]:.2f} € | **{r[4]:.2f} €** | {r[5]:.2f} € | {r[6]:.2f} € |')

    aktuell = {k: max(g[k]['preise']) for k in REIHENFOLGE}
    tabelle('Aktuelle Preise', aktuell)
    tabelle('Empfehlung minimal', MINIMAL)
    tabelle('Empfehlung gesund', GESUND)

    # Mindestpreise (rechnerisch)
    aus('\n## Rechnerische Untergrenzen (schlechtester Fall)\n')
    aus('| Groesse | DB 0 € | DB 8 € | DB 12 € | DB 15 € |')
    aus('|---|---|---|---|---|')
    for k in REIHENFOLGE:
        a, b = map(int, k.split('x'))
        G = (basis[k] + VERSAND[k]) * (1 + UST) * (1 + FX)
        f = (1 - WELCOME) * (1 - PAYPAL[0])
        aus(f'| {CM[a]} × {CM[b]} cm | ' + ' | '.join(f'{(z + PAYPAL[1] + G) / f:.2f} €' for z in (0, 8, 12, 15)) + ' |')

    # JSON je Optionswert-Titel
    out = []
    for k in REIHENFOLGE:
        a, b = map(int, k.split('x'))
        prod, v = basis[k], VERSAND[k]
        for t in sorted(g[k]['titel'], key=lambda s: zahl(s)[0] > zahl(s)[1]):
            x, y = zahl(t)
            out.append({
                'groesse_zoll': t,
                'groesse_cm': f'{CM[x]} × {CM[y]} cm',
                'format': 'hoch' if x < y else 'quer',
                'preis_aktuell': aktuell[k],
                'preis_minimal': MINIMAL[k],
                'preis_gesund': GESUND[k],
                'db_aktuell_worst': round(worst(aktuell[k], prod, v), 2),
                'db_minimal_worst': round(worst(MINIMAL[k], prod, v), 2),
                'db_gesund_worst': round(worst(GESUND[k], prod, v), 2),
                'kosten_produktion_eur': prod,
                'kosten_versand_eur': v,
                'kosten_printify_inkl_ust_eur': round((prod + v) * (1 + UST), 2),
            })
    json.dump(out, open(os.path.join(HIER, 'preise-empfehlung.json'), 'w'), ensure_ascii=False, indent=2)
    aus(f'\npreise-empfehlung.json geschrieben ({len(out)} Optionswerte)')


def plan(variante):
    preise = {'minimal': MINIMAL, 'gesund': GESUND}[variante]
    d = json.load(open(DATEN))
    out = []
    for p in d:
        vs = [{'id': v['id'], 'price': f"{preise[schluessel(v['title'].split(' / ')[0])]:.2f}"}
              for v in p['variants']['nodes']]
        out.append({'productId': p['id'], 'handle': p['handle'], 'variants': vs})
    ziel = os.path.join(HIER, f'preis-update-{variante}.json')
    json.dump(out, open(ziel, 'w'), ensure_ascii=False, indent=1)
    print(f'{ziel}: {len(out)} Produkte, {sum(len(x["variants"]) for x in out)} Varianten')


if __name__ == '__main__':
    import sys
    if len(sys.argv) == 3 and sys.argv[1] == '--plan':
        plan(sys.argv[2])
    else:
        main()
