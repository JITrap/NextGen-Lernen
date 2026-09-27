"""Exportiert alle Zahlen für Businessplan-Text und Diagramme nach zahlen.json (aus annahmen.json + daten.json)."""
from __future__ import annotations

import copy
import json
import math
import sys

import model as M


def r0(v):
    return int(math.floor(v + 0.5)) if isinstance(v, (int, float)) and v is not None else v


def scen_block(r: dict) -> dict:
    g = r['guv']
    return {
        'summary': M.summary(r),
        'mitglieder_monat': {m: r0(r['bestand'][m]) for m in range(1, 61)},
        'neu_monat': {m: r0(r['neu'][m]) for m in range(1, 61)},
        'kuend_monat': {m: r0(r['kuend'][m]) for m in range(1, 61)},
        'umsatz_monat': {m: r0(r['umsatz'][m]) for m in range(1, 61)},
        'kosten_monat': {m: r0(r['kosten_summe'][m]) for m in r['monate']},
        'kapitaldienst_monat': {m: r0(r['zins'][m] + r['tilg'][m]) for m in r['monate']},
        'kasse_monat': {m: r0(r['liq'][m]['ende']) for m in r['monate']},
        'betrieb_kum_monat': {m: r0(r['liq'][m]['betrieb_kum']) for m in r['monate']},
        'guv': {j: {k: (round(v, 2) if k == 'dscr' and v is not None else r0(v)) for k, v in g[j].items()} for j in g},
        'reserve_bedarf_24': r0(r['reserve_bedarf_24']),
        'min_kasse': [r['min_kasse'][0], r0(r['min_kasse'][1])],
        'be_monat_ebitda': r['be_monat_ebitda'], 'be_monat_cf': r['be_monat_cf'],
        'be_mitglieder': r['be_mitglieder'], 'be_mitglieder_ohne_kd': r['be_mitglieder_ohne_kd'],
        'kosten_j3': {k: r0(sum(r['kosten'][m][k] for m in range(25, 37))) for k in r['kosten'][36]},
        'umsatz_j3_struktur': {'beitraege': r0(sum(r['beitrag'][m] for m in range(25, 37))), 'service': r0(sum(r['service'][m] for m in range(25, 37))), 'aufnahme': r0(sum(r['aufnahme'][m] for m in range(25, 37))), 'neben': r0(sum(r['neben'][m] for m in range(25, 37)))},
        'umsatz_j1_struktur': {'beitraege': r0(sum(r['beitrag'][m] for m in range(1, 13))), 'service': r0(sum(r['service'][m] for m in range(1, 13))), 'aufnahme': r0(sum(r['aufnahme'][m] for m in range(1, 13))), 'neben': r0(sum(r['neben'][m] for m in range(1, 13)))},
        'ust_zwischenfinanzierung_max': r0(max(0.0, -min(sum(r['ust_zahlung'][mm] for mm in r['monate'][:i + 1]) for i in range(len(r['monate']))))),
        'personal_monat_j1': r0(r['kosten'][6]['personal']), 'personal_monat_j3': r0(r['kosten'][30]['personal']),
        'monat_reserve_max': r['min_kum_betrieb'][0], 'reserve_max_kum': r0(-r['min_kum_betrieb'][1]),
    }


def loan_schedule_years(a: dict, r: dict, jahre: int = 20) -> list[dict]:
    """Kapitaldienst je Jahr über die volle Laufzeit (vereinfacht: Auszahlung Jahr 0, Jahreswerte)."""
    out = []
    loans = []
    for d in r['darlehen_liste']:
        loans.append({'bal': d['betrag'], 'zins': d['zins_pa'], 'n': d['laufzeit_jahre'], 'frei': d['tilgungsfreie_jahre'], 'rate': d['betrag'] / (d['laufzeit_jahre'] - d['tilgungsfreie_jahre']) if d['laufzeit_jahre'] > d['tilgungsfreie_jahre'] else 0.0})
    for j in range(1, jahre + 1):
        z = t = 0.0
        for l in loans:
            if l['bal'] <= 0:
                continue
            z += l['bal'] * l['zins']
            if l['n'] > l['frei']:
                if j > l['frei']:
                    tt = min(l['rate'], l['bal']); t += tt; l['bal'] -= tt
            elif j == l['n']:
                t += l['bal']; l['bal'] = 0.0
        out.append({'jahr': j, 'zinsen': r0(z), 'tilgung': r0(t), 'kapitaldienst': r0(z + t), 'restschuld': r0(sum(l['bal'] for l in loans))})
    return out


def sensitivities(a: dict, d: dict) -> list[dict]:
    base = M.compute(a, d, 'basis')
    def run(label, mutate):
        b = copy.deepcopy(a); mutate(b); r = M.compute(b, d, 'basis')
        return {'fall': label, 'ebitda_j3': r0(r['guv'][3]['ebitda']), 'ergebnis_j3': r0(r['guv'][3]['jahresergebnis']), 'dscr_j3': round(r['guv'][3]['dscr'], 2) if r['guv'][3]['dscr'] else None, 'dscr_j4': round(r['guv'][4]['dscr'], 2) if r['guv'][4]['dscr'] else None, 'min_kasse': r0(r['min_kasse'][1]), 'reserve_bedarf_24': r0(r['reserve_bedarf_24']), 'mitglieder_m24': r0(r['bestand'][24]), 'be_mitglieder': r['be_mitglieder']}
    def setneu(f):
        def m(b):
            for ph in b['mitglieder']['neuzugaenge_je_monat']: ph['n'] = ph['n'] * f
            b['mitglieder']['vorverkauf_bestand_eroeffnung'] *= f
        return m
    def setchurn(c):
        def m(b): b['szenarien']['basis']['kuendigungsquote_monat'] = c
        return m
    def setbeitrag(f):
        def m(b): b['szenarien']['basis']['beitrag_faktor'] = f
        return m
    def setmiete(v):
        def m(b): b['miete']['kalt_eur_m2'] = v
        return m
    def setzins(dz):
        def m(b):
            for l in b['finanzierung']['darlehen']: l['zins_pa'] += dz
        return m
    def setpersonal(f):
        def m(b):
            for s in b['personal']['stellen']: s['brutto_monat'] *= f
        return m
    def setenergie(v):
        def m(b): b['miete']['energie_wasser_eur_m2'] = v
        return m
    rows = [
        {'fall': 'Basis', 'ebitda_j3': r0(base['guv'][3]['ebitda']), 'ergebnis_j3': r0(base['guv'][3]['jahresergebnis']), 'dscr_j3': round(base['guv'][3]['dscr'], 2), 'dscr_j4': round(base['guv'][4]['dscr'], 2), 'min_kasse': r0(base['min_kasse'][1]), 'reserve_bedarf_24': r0(base['reserve_bedarf_24']), 'mitglieder_m24': r0(base['bestand'][24]), 'be_mitglieder': base['be_mitglieder']},
        run('Neuzugänge −20 %', setneu(0.8)),
        run('Neuzugänge −30 %', setneu(0.7)),
        run('Kündigungsquote 3,0 %/Monat (statt 2,2 %)', setchurn(0.03)),
        run('Beitragsniveau −10 %', setbeitrag(0.9)),
        run('Kaltmiete 10,00 €/m² (statt 8,50 €)', setmiete(10.0)),
        run('Zinsen +1,5 Prozentpunkte', setzins(0.015)),
        run('Personalkosten +10 %', setpersonal(1.1)),
        run('Energie/Wasser 5,50 €/m² (statt 4,00 €)', setenergie(5.5)),
    ]
    return rows


def gegenmassnahmen(a: dict, d: dict) -> dict:
    """Pessimistisches Szenario mit Gegenmaßnahmen: Personalplan −15 % (spätere Einstellung, weniger Minijobs), Marketing auf 2.500 €, Sonstiges/Reinigung −15 %."""
    b = copy.deepcopy(a)
    for s in b['personal']['stellen']:
        if 'ab Jahr 2' in s['rolle']:
            s['ab_monat'] = 25
        if s['minijob'] and 'Empfang' in s['rolle']:
            s['anzahl'] = 3
    b['personal']['stellen'] = [s for s in b['personal']['stellen'] if s['anzahl'] > 0]
    b['sachkosten_monat']['marketing_laufend'] = 2500
    b['sachkosten_monat']['sonstiges'] = round(b['sachkosten_monat']['sonstiges'] * 0.85)
    b['sachkosten_monat']['reinigung_material_hygiene'] = round(b['sachkosten_monat']['reinigung_material_hygiene'] * 0.85)
    r = M.compute(b, d, 'pessimistisch')
    return {'massnahmen': ['Dritter Vollzeittrainer erst ab Jahr 3 statt Jahr 2', 'Empfangs-Minijobs 3 statt 4', f"Marketing laufend 2.500 € statt {a['sachkosten_monat']['marketing_laufend']:,.0f} €/Monat".replace(',', '.'), 'Reinigung/Sonstiges −15 %'], **scen_block(r)}


def main(annahmen: str, daten: str, out: str) -> None:
    a = M.load(annahmen); d = M.load(daten)
    a = M.reserve_fixpunkt(a, d, 'basis')
    json.dump(a, open(annahmen, 'w'), ensure_ascii=False, indent=1)
    base = M.compute(a, d, 'basis')
    inv = [{'gruppe': p.gruppe, 'bezeichnung': p.bezeichnung, 'betrag': r0(p.betrag), 'afa_jahre': p.afa_jahre, 'vorsteuer': p.vorsteuer, 'hinweis': p.hinweis, 'zahlung_ab': min(m for m, _ in p.zahlung), 'monate': len(p.zahlung)} for p in base['investition']]
    gruppen = {}
    for p in inv:
        gruppen[p['gruppe']] = gruppen.get(p['gruppe'], 0) + p['betrag']
    z = {
        'stand': '2026-09-27',
        'annahmen': a,
        'projekt': {k: v for k, v in d['projekt'].items() if k not in ('raeume', 'settings')},
        'raeume': d['projekt'].get('raeume'), 'zonen': d['projekt'].get('zonen'),
        'kapazitaet': d['kapazitaet'], 'sicherheit': {k: v for k, v in d['sicherheit'].items() if k not in ('pruefungen', 'planungswarnungen')},
        'pruefungen': d['sicherheit'].get('pruefungen'),
        'ausstattung': d['ausstattung_zaehlung'],
        'geraete': {k: v for k, v in d['geraete'].items() if k != 'jeBereich'}, 'geraete_je_bereich': d['geraete'].get('jeBereich'),
        'investition': inv, 'investition_gruppen': gruppen, 'inv_summe': r0(base['inv_summe']), 'geraetewert': r0(base['geraetewert']),
        'reserve': base['reserve'], 'kapitalbedarf': r0(base['kapitalbedarf']),
        'inv_vorsteuer': r0(sum(p['betrag'] for p in inv if p['vorsteuer']) * a['tarife']['ust_satz']),
        'finanzierung': {'eigenkapital': base['eigenkapital'], 'ek_aehnlich': r0(base['ek_aehnlich']), 'ek_quote': round(base['ek_quote'], 4), 'darlehen': [{'name': x['name'], 'betrag': r0(x['betrag']), 'zins_pa': x['zins_pa'], 'laufzeit_jahre': x['laufzeit_jahre'], 'tilgungsfreie_jahre': x['tilgungsfreie_jahre'], 'eigenkapitalaehnlich': x['eigenkapitalaehnlich'], 'rate_monat_nach_tf': r0(x['rate_monat'])} for x in base['darlehen']], 'darlehen_summe': r0(base['darlehen_summe']), 'kapitaldienst_jahre': loan_schedule_years(a, base, 20), 'rate_m25': r0(base['zins'][25] + base['tilg'][25]), 'rate_m1': r0(base['zins'][1] + base['tilg'][1]), 'rate_m61_naeherung': None},
        'szenarien': {s: scen_block(M.compute(a, d, s)) for s in ('pessimistisch', 'basis', 'optimistisch')},
        'pessimistisch_mit_massnahmen': gegenmassnahmen(a, d),
        'sensitivitaet': sensitivities(a, d),
        'arpu': {'brutto': round(base['arpu_brutto'], 2), 'netto': round(base['arpu_brutto'] / (1 + a['tarife']['ust_satz']), 2), 'neben_brutto': round(base['neben_brutto'], 2), 'db_je_mitglied': round(base['db_je_mitglied'], 2)},
        'afa_jahr': {j: r0(v) for j, v in base['afa_jahr'].items()},
        'steuersatz': round(base['steuersatz'], 4),
    }
    # Rate nach Ende aller tilgungsfreien Zeiten (Jahr 6): aus Jahresplan
    kj = z['finanzierung']['kapitaldienst_jahre']
    z['finanzierung']['rate_m61_naeherung'] = r0(kj[5]['kapitaldienst'] / 12)
    json.dump(z, open(out, 'w'), ensure_ascii=False, indent=1)
    print('zahlen.json geschrieben; Basis:', json.dumps(z['szenarien']['basis']['summary'], ensure_ascii=False)[:600])


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
