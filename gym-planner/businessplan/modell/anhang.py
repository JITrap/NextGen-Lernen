"""Erzeugt die Anhang-Tabellen (anhang.json) aus zahlen.json, daten.json, standort.json und model.compute für das Assemblierungsskript."""
from __future__ import annotations

import json
import sys

import model as M


def eur(v) -> str:
    if v is None:
        return '–'
    s = f'{int(round(v)):,}'.replace(',', '.')
    return s


def eur2(v) -> str:
    s = f'{v:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    return s


def pct(v, dec=1) -> str:
    return f'{v * 100:.{dec}f}'.replace('.', ',') + ' %'


def num(v, dec=0) -> str:
    s = f'{v:,.{dec}f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    return s


def main(annahmen: str, daten: str, zahlen: str, standort: str, out: str) -> None:
    a = M.load(annahmen); d = M.load(daten); z = M.load(zahlen)
    st = M.load(standort)
    r = M.compute(a, d, 'basis')
    V = a['projekt']['vorlauf_monate']
    tables: list[dict] = []

    # ---------- A Investitionsliste ----------
    rows = [[p['bezeichnung'], p['gruppe'].capitalize(), eur(p['betrag']), str(p['afa_jahre'] or '–'), f"{p['zahlung_ab']} ({p['monate']} Mon.)", p['hinweis'][:60]] for p in z['investition']]
    rows.append(['Investitionssumme (ohne Anlaufreserve)', '', eur(z['inv_summe']), '', '', ''])
    rows.append(['Anlaufreserve / Betriebsmittel (24 Monate)', 'Reserve', eur(z['reserve']), '', '', ''])
    rows.append(['Kapitalbedarf gesamt', '', eur(z['kapitalbedarf']), '', '', ''])
    tables.append({'anhang': 'A', 'id': 'A1', 'titel': 'Tabelle A.1: Investitionsplan (netto, EUR)', 'spalten': ['Position', 'Gruppe', 'Betrag netto', 'AfA Jahre', 'Zahlung ab Monat', 'Hinweis'], 'zeilen': rows, 'breiten': [34, 10, 12, 8, 12, 24], 'quelle': 'Quelle: Kostenkalkulation GymPlanner (Projekt No.1 überarbeitet), Miete 8,50 €/m²; Stand ' + z['stand']})
    # A2 Geräte je Bereich
    kv = d['geraete']['konfidenzVerteilung']
    konf_txt = ', '.join(f"{x.get('konfidenz', x.get('key', '?'))} {x.get('anzahl', x.get('count', x.get('objekte', '')))}" for x in kv) if isinstance(kv, list) else ', '.join(f'{k} {v}' for k, v in kv.items())
    rows = [[b['bereich'], str(b['positionen']), str(b['objekte']), eur(b['summeEur'])] for b in d['geraete']['summenJeBereich']]
    rows.append(['Summe', str(d['geraete']['anzahlPositionen']), str(d['geraete']['anzahlObjekte']), eur(d['geraete']['gesamtEur'])])
    tables.append({'anhang': 'A', 'id': 'A2', 'titel': 'Tabelle A.2: Geräte und Ausstattung je Bibliotheksbereich (Stückliste, netto EUR)', 'spalten': ['Bereich', 'Positionen', 'Objekte', 'Summe netto'], 'zeilen': rows, 'breiten': [46, 18, 18, 18], 'quelle': f"Quelle: Stückliste GymPlanner; Preise recherchiert (Preisbasis: {konf_txt}); Import-Anteil Atlantis/Prime {eur(d['geraete']['importAnteilEur'])} €"})
    # A3 Top-30 Positionen
    rows = [[t['name'], t['hersteller'], t['bereich'], str(t['count']), eur(t['unitPriceEur']), eur(t['totalEur']), t['preisKonfidenz']] for t in d['geraete']['top30']]
    tables.append({'anhang': 'A', 'id': 'A3', 'titel': 'Tabelle A.3: Die 30 größten Gerätepositionen (netto EUR)', 'spalten': ['Position', 'Hersteller', 'Bereich', 'Anzahl', 'Stückpreis', 'Summe', 'Preisbasis'], 'zeilen': rows, 'breiten': [30, 12, 14, 8, 12, 12, 12], 'quelle': 'Preisbasis: liste = Herstellerliste, haendler = Händlerangebot, schaetzung = Richtwert; vor Bestellung durch Angebote zu ersetzen'})
    # A4 komplette Geräteliste je Bereich
    jb = d['geraete']['jeBereich']
    items = jb.items() if isinstance(jb, dict) else [(b['bereich'], b.get('positionen') or []) for b in jb]
    for bereich, pos in items:
        if not pos:
            continue
        pos = sorted(pos, key=lambda p: -(p.get('totalEur') or 0))
        rows = [[p.get('name', ''), f"{p.get('hersteller', '')} {p.get('modell', '') or ''}".strip(), str(p.get('count', '')), eur(p.get('unitPriceEur')) if p.get('unitPriceEur') is not None else '–', eur(p.get('totalEur')) if p.get('totalEur') is not None else '–'] for p in pos]
        objekte = sum(p.get('count', 0) for p in pos); summe = sum(p.get('totalEur') or 0 for p in pos)
        tables.append({'anhang': 'A', 'id': f"A4-{bereich}", 'titel': f"Tabelle A.4: Geräteliste Bereich {bereich} ({objekte} Objekte, {eur(summe)} €)", 'spalten': ['Position', 'Hersteller / Modell', 'Anzahl', 'Stückpreis', 'Summe'], 'zeilen': rows, 'breiten': [38, 26, 10, 13, 13], 'quelle': ''})

    # ---------- B Tilgungspläne ----------
    for bi, dl in enumerate(r['darlehen'], start=1):
        rows = []
        for j in range(1, 6):
            ms = [m for m in r['monate'] if (m < 1 and j == 1) or (m >= 1 and (m - 1) // 12 + 1 == j)]
            az = sum(dl['rows'][m][0] for m in ms); zi = sum(dl['rows'][m][1] for m in ms); ti = sum(dl['rows'][m][2] for m in ms)
            rest = dl['rows'][ms[-1]][3]
            rows.append([f'Jahr {j}', eur(az), eur(zi), eur(ti), eur(zi + ti), eur(rest)])
        tables.append({'anhang': 'B', 'id': f"B-{dl['name'][:20]}", 'titel': f"Tabelle B.{bi}: {dl['name']} – {eur(dl['betrag'])} €, {pct(dl['zins_pa'], 2)} p. a., {dl['laufzeit_jahre']} Jahre, {dl['tilgungsfreie_jahre']} tilgungsfreie Jahre" + (' (endfällig, wirtschaftliches Eigenkapital)' if dl['eigenkapitalaehnlich'] else ''), 'spalten': ['Jahr', 'Auszahlung', 'Zinsen/Vergütung', 'Tilgung', 'Kapitaldienst', 'Restschuld Ende'], 'zeilen': rows, 'breiten': [12, 17, 18, 17, 18, 18], 'quelle': 'Jahr 1 inkl. Vorlaufmonate; lineare Tilgung nach der tilgungsfreien Zeit (KfW-/L-Bank-üblich); Zinssätze Planannahmen'})
    rows = [[f"Jahr {k['jahr']}", eur(k['zinsen']), eur(k['tilgung']), eur(k['kapitaldienst']), eur(k['restschuld'])] for k in z['finanzierung']['kapitaldienst_jahre']]
    tables.append({'anhang': 'B', 'id': 'B-gesamt', 'titel': 'Tabelle B.5: Kapitaldienst gesamt über 20 Jahre (Jahreswerte, Näherung)', 'spalten': ['Jahr', 'Zinsen', 'Tilgung', 'Kapitaldienst', 'Restschuld Ende'], 'zeilen': rows, 'breiten': [16, 21, 21, 21, 21], 'quelle': 'Vereinfachte Jahresrechnung (Auszahlung zu Beginn, Zins auf Jahresanfangssaldo)'})

    # ---------- C Liquiditätsplan monatlich ----------
    keys = [('umsatz_brutto', 'Umsatz brutto (inkl. USt)'), ('eigenkapital', 'Eigenkapital'), ('darlehen', 'Darlehen/Beteiligung'), ('einzahlungen', 'Summe Einzahlungen'), ('kosten_brutto', 'Betriebskosten brutto'), ('investition_brutto', 'Investition brutto'), ('ust', 'USt-Zahllast (−) / Erstattung (+)'), ('zinsen', 'Zinsen'), ('tilgung', 'Tilgung'), ('steuern', 'Ertragsteuern'), ('auszahlungen', 'Summe Auszahlungen'), ('anfang', 'Kassenbestand Anfang'), ('ende', 'Kassenbestand Ende')]
    blocks = [[m for m in r['monate'] if -V <= m <= 6], list(range(7, 19)), list(range(19, 31)), list(range(31, 37))]
    for bi, ms in enumerate(blocks, start=1):
        rows = []
        for k, lab in keys:
            vals = []
            for m in ms:
                v = r['liq'][m][k]
                if k == 'ust':
                    v = -v  # Zahllast negativ, Erstattung positiv
                vals.append(eur(v))
            rows.append([lab] + vals)
        tables.append({'anhang': 'C', 'id': f'C{bi}', 'titel': f"Tabelle C.{bi}: Liquiditätsplan Monate {ms[0]} bis {ms[-1]} (EUR, Zahlungsströme brutto)", 'spalten': ['Position'] + [f'M {m}' for m in ms], 'zeilen': rows, 'breiten': None, 'quelle': 'Monat −5 bis −1 = Ausbau/Vorverkauf; USt-Erstattung im Folgemonat; Ertragsteuern im Folgejahr (Monat 18/30)', 'quer': True})

    # ---------- D Plan-GuV ----------
    g = r['guv']
    labels = [('umsatz', 'Umsatzerlöse'), ('wareneinsatz', 'Wareneinsatz'), ('personal', 'Personalkosten'), ('raumkosten', 'Raumkosten'), ('marketing', 'Marketing'), ('sonstige', 'Sonstige betriebliche Aufwendungen'), ('ebitda', 'EBITDA'), ('afa', 'Abschreibungen'), ('ebit', 'EBIT'), ('zinsen', 'Zinsaufwand'), ('ebt', 'Ergebnis vor Steuern'), ('steuern', 'Ertragsteuern'), ('jahresergebnis', 'Jahresergebnis'), ('tilgung', 'Tilgung'), ('kapitaldienst', 'Kapitaldienst'), ('cashflow_nach_kapitaldienst', 'Cashflow nach Kapitaldienst'), ('mitglieder_ende', 'Mitglieder am Jahresende')]
    rows = [[lab] + [eur(g[j][k]) for j in range(1, 6)] for k, lab in labels]
    rows.append(['Kapitaldienstfähigkeit (DSCR)'] + [(f"{g[j]['dscr']:.2f}".replace('.', ',') if g[j]['dscr'] else '–') for j in range(1, 6)])
    tables.append({'anhang': 'D', 'id': 'D1', 'titel': 'Tabelle D.1: Rentabilitätsvorschau Jahr 1–5, Basis-Szenario (netto EUR)', 'spalten': ['Position', 'Jahr 1', 'Jahr 2', 'Jahr 3', 'Jahr 4', 'Jahr 5'], 'zeilen': rows, 'breiten': [30, 14, 14, 14, 14, 14], 'quelle': 'Jahr 1 = Vorlauf + Betriebsmonate 1–12; DSCR = (EBITDA − Steuern) ÷ Kapitaldienst'})
    for sname in ('pessimistisch', 'optimistisch'):
        rs = M.compute(a, d, sname); gs = rs['guv']
        rows = [[lab] + [eur(gs[j][k]) for j in range(1, 6)] for k, lab in labels if k in ('umsatz', 'personal', 'raumkosten', 'ebitda', 'jahresergebnis', 'kapitaldienst', 'cashflow_nach_kapitaldienst', 'mitglieder_ende')]
        rows.append(['DSCR'] + [(f"{gs[j]['dscr']:.2f}".replace('.', ',') if gs[j]['dscr'] else '–') for j in range(1, 6)])
        tables.append({'anhang': 'D', 'id': f'D-{sname}', 'titel': f'Tabelle D.{2 if sname == "pessimistisch" else 3}: Rentabilitätsvorschau Szenario {sname} (Kurzfassung, netto EUR)', 'spalten': ['Position', 'Jahr 1', 'Jahr 2', 'Jahr 3', 'Jahr 4', 'Jahr 5'], 'zeilen': rows, 'breiten': [30, 14, 14, 14, 14, 14], 'quelle': ''})

    # ---------- E Annahmen ----------
    rows = []
    mi = a['miete']; t = a['tarife']; nu = a['nebenumsatz']; mg = a['mitglieder']; sk = a['sachkosten_monat']; fin = a['finanzierung']; stx = a['steuern']
    rows += [['Bruttofläche', num(a['projekt']['flaeche_brutto_m2'], 1) + ' m²', 'Planung GymPlanner'], ['Nettofläche', num(a['projekt']['flaeche_netto_m2'], 1) + ' m²', ''], ['Trainingsfläche', num(a['projekt']['trainingsflaeche_m2'], 1) + ' m²', '9 m² je Person → 126 Personen'], ['Eröffnung', '01.09.2027', f"{V} Vorlaufmonate"]]
    rows += [['Kaltmiete', eur2(mi['kalt_eur_m2']) + ' €/m²/Monat', 'Vorgabe'], ['Betriebskosten', eur2(mi['betriebskosten_eur_m2']) + ' €/m²/Monat', ''], ['Energie und Wasser', eur2(mi['energie_wasser_eur_m2']) + ' €/m²/Monat', 'DSSV-Richtwerte 3,00–3,50 + ab 2,50 €/m² (Sauna)'], ['Kaution', f"{mi['kaution_monate']} Monatsmieten inkl. NK", ''], ['Mietfreie Ausbauzeit', f"{mi['mietfreie_monate_ausbau']} Monate", 'Verhandlungsziel'], ['Mietindexierung', pct(mi['indexierung_prozent_pa'] / 100) + ' p. a.', 'ab Jahr 2']]
    rows += [['Tarif Basic', eur2(t['basic']['beitrag_brutto']) + ' € brutto/Monat', f"Anteil {pct(t['basic']['anteil'], 0)}"], ['Tarif Premium', eur2(t['premium']['beitrag_brutto']) + ' € brutto/Monat', f"Anteil {pct(t['premium']['anteil'], 0)}"], ['Tarif Student/Azubi/Senior', eur2(t['student']['beitrag_brutto']) + ' € brutto/Monat', f"Anteil {pct(t['student']['anteil'], 0)}"], ['Ø Beitrag (Mix)', eur2(z['arpu']['brutto']) + ' € brutto = ' + eur2(z['arpu']['netto']) + ' € netto', 'DSSV Ø 48,55 €, Einzelanlagen 59,24 €'], ['Servicepauschale', eur2(t['servicepauschale_halbjahr_brutto']) + ' € je Halbjahr', ''], ['Aufnahmegebühr', eur2(t['aufnahmegebuehr_brutto']) + ' €', f"{pct(t['aufnahmegebuehr_anteil_zahlend'], 0)} der Neuzugänge zahlen"], ['Beitragsanpassung', pct(t['beitragserhoehung_prozent_pa'] / 100) + ' p. a.', 'ab Jahr 3'], ['Nebenumsatz je Mitglied/Monat', eur2(z['arpu']['neben_brutto']) + ' € brutto', 'Getränke 3,00 / Wellness 1,20 / PT-Kurse 1,50 / Merch 0,50'], ['Wareneinsatz Getränke', pct(nu['getraenke_wareneinsatz_prozent'], 0), '']]
    rows += [['Vorverkauf', f"{mg['vorverkauf_bestand_eroeffnung']} Mitglieder zur Eröffnung", ''], ['Neuzugänge je Monat', ' / '.join(f"M{p['von']}–{p['bis']}: {p['n']}" for p in mg['neuzugaenge_je_monat']), 'Basis-Szenario'], ['Kündigungsquote', pct(mg['kuendigungsquote_monat']) + ' je Monat', '≈ 23 % p. a. (Branche Ø 25 %)'], ['Obergrenze Mitglieder', num(mg['kapazitaet_max_mitglieder']), f"{mg['kapazitaet_max_mitglieder'] / a['projekt']['flaeche_brutto_m2']:.2f}".replace('.', ',') + ' je m²'], ['Spitzenlast gleichzeitig', pct(mg['spitzenlast_anteil_gleichzeitig']), 'gegen 126 Personen Kapazität']]
    for s in a['personal']['stellen']:
        rows.append([f"Personal: {s['rolle']}", f"{s['anzahl']} × {eur(s['brutto_monat'])} € brutto/Monat", f"ab Monat {s['ab_monat']}" + (', Minijob' if s['minijob'] else '')])
    rows += [['Arbeitgeberabgaben', pct(a['personal']['ag_anteil_sozialversicherung']) + ' / Minijob ' + pct(a['personal']['minijob_pauschalabgaben'], 2), 'Gehaltssteigerung ' + pct(a['personal']['gehaltssteigerung_prozent_pa'] / 100) + ' p. a.']]
    sk_lab = {'marketing_laufend': 'Marketing laufend', 'marketing_eroeffnung_monate_1_3': 'Marketing Eröffnung (M 1–3 zusätzlich)', 'versicherungen': 'Versicherungen', 'gema_gvl': 'GEMA/GVL', 'studiosoftware_zutritt': 'Studiosoftware/Zutritt', 'steuerberater_buchhaltung': 'Steuerberatung/Buchhaltung', 'reinigung_material_hygiene': 'Reinigung/Hygiene/Verbrauch', 'telekommunikation_it': 'Telekommunikation/IT', 'sonstiges': 'Sonstiges'}
    for k, lab in sk_lab.items():
        rows.append([lab, eur(sk[k]) + ' €/Monat', ''])
    rows += [['Zahlungsverkehr', pct(sk['payment_prozent_vom_beitrag_brutto']) + ' vom Beitragsumsatz brutto', ''], ['Wartung Geräte', pct(sk['wartung_prozent_geraetewert_pa'], 0) + ' vom Gerätewert p. a.', ''], ['Instandhaltung Gebäude', eur2(sk['instandhaltung_gebaeude_eur_m2_pa']) + ' €/m²/Jahr', ''], ['Marketing Vorverkauf', eur(a['vorlauf']['marketing_vorverkauf_gesamt']) + ' €', f"{a['vorlauf']['marketing_vorverkauf_monate']} Monate"], ['Unvorhergesehenes', pct(a['investition']['unvorhergesehen_prozent'], 0) + ' der Investition', ''], ['Abschreibung', f"Geräte {a['investition']['afa_jahre']['geraete']} J., Ausbau {a['investition']['afa_jahre']['ausbau']} J., Sonstiges {a['investition']['afa_jahre']['sonstiges']} J.", '']]
    rows += [['Eigenkapital Bareinlage', eur(fin['eigenkapital']) + ' €', 'vom Gründer zu bestätigen']]
    for dl in z['finanzierung']['darlehen']:
        rows.append([dl['name'][:60], f"{eur(dl['betrag'])} €, {pct(dl['zins_pa'], 2)}, {dl['laufzeit_jahre']} J., {dl['tilgungsfreie_jahre']} tilgungsfrei", 'wirtschaftliches EK' if dl['eigenkapitalaehnlich'] else ''])
    rows += [['Anlaufreserve', eur(z['reserve']) + ' €', f"Bedarf 24 Monate {eur(z['szenarien']['basis']['reserve_bedarf_24'])} € inkl. {pct(fin['reserve_sicherheitspuffer_prozent'], 0)} Puffer"], ['Kontokorrent (USt-Vorfinanzierung)', eur(fin['kontokorrent_rahmen']) + ' €', 'nicht im Kapitalbedarf'], ['Gewerbesteuer-Hebesatz', f"{int(stx['gewerbesteuer_hebesatz'] * 100)} %", 'Planannahme (Friedrichshafen 350, Ravensburg 390, Konstanz 410)'], ['Ertragsteuersatz gesamt', pct(z['steuersatz'], 2), 'KSt 15 % + Soli + GewSt']]
    tables.append({'anhang': 'E', 'id': 'E1', 'titel': 'Tabelle E.1: Planungsannahmen (Auszug aus dem Blatt „Annahmen“ der Excel-Planrechnung)', 'spalten': ['Annahme', 'Wert', 'Hinweis'], 'zeilen': rows, 'breiten': [34, 36, 30], 'quelle': 'Alle Annahmen sind im Blatt „Annahmen“ der Datei Finanzplan_No1.xlsx änderbar; die Planung rechnet automatisch nach'})

    # ---------- G Immobilien-Shortlist ----------
    for region_key, titel in (('bodensee', 'Bodenseeregion'), ('stuttgart', 'Region Stuttgart')):
        sl = (st.get('5_immobilien_shortlist') or {}).get(region_key) or []
        if not sl:
            continue
        rows = []
        for o in sl[:12]:
            rows.append([str(o.get('titel') or o.get('objekt') or o.get('name') or '')[:70], str(o.get('ort', ''))[:30], (num(o['flaeche_m2']) + ' m²') if o.get('flaeche_m2') else '–', (eur2(o['miete_eur_m2']) + ' €/m²') if o.get('miete_eur_m2') else '–', (str(o.get('deckenhoehe_m')) + ' m') if o.get('deckenhoehe_m') else '–', ('Immowelt' if 'immowelt' in str(o.get('url', '')) else 'ImmoScout24' if 'immobilienscout24' in str(o.get('url', '')) else str(o.get('portal') or '')[:20])])
        tables.append({'anhang': 'G', 'id': f'G-{region_key}', 'titel': f'Tabelle G: Immobilien-Shortlist {titel} (Recherche ImmoScout24/Immowelt, Stand September 2026)', 'spalten': ['Objekt', 'Ort', 'Fläche', 'Miete', 'Höhe', 'Portal'], 'zeilen': rows, 'breiten': [36, 16, 12, 12, 8, 16], 'quelle': 'Angaben aus den Suchseiten der Portale; Exposés und Verfügbarkeit sind zu prüfen'})

    # ---------- H Regularien-Checkliste ----------
    pr = d['sicherheit'].get('pruefungen') or []
    status_lab = {'ok': 'erfüllt', 'warn': 'prüfen', 'fail': 'nicht erfüllt', 'info': 'Hinweis', 'na': 'n. a.'}
    themen: dict[str, dict[str, int]] = {}
    for x in pr:
        t_ = themen.setdefault(str(x.get('thema', '')), {'ok': 0, 'warn': 0, 'fail': 0, 'info': 0, 'na': 0})
        t_[x.get('status', 'na')] = t_.get(x.get('status', 'na'), 0) + 1
    rows = [[th, str(c['ok']), str(c['warn']), str(c['fail']), str(c['info'])] for th, c in themen.items()]
    rows.append(['Summe', str(sum(c['ok'] for c in themen.values())), str(sum(c['warn'] for c in themen.values())), str(sum(c['fail'] for c in themen.values())), str(sum(c['info'] for c in themen.values()))])
    tables.append({'anhang': 'H', 'id': 'H1', 'titel': 'Tabelle H.1: Ergebnis der Regularien-Prüfung der Planung je Themenfeld', 'spalten': ['Themenfeld', 'erfüllt', 'prüfen', 'nicht erfüllt', 'Hinweis'], 'zeilen': rows, 'breiten': [44, 14, 14, 14, 14], 'quelle': 'Automatische Prüfung der Planungssoftware GymPlanner gegen ASR A2.3 (Fluchtwege), ASR A1.8, ASR A4.1/A4.2 (Sanitär), DIN EN 957/ISO 20957 (Geräteabstände), LBO BW; ersetzt keine Prüfung durch Behörden und Fachplaner'})
    rows = [[str(x.get('thema', '')), str(x.get('titel', ''))[:90], str(x.get('soll', ''))[:70], str(x.get('ist', ''))[:70], status_lab.get(x.get('status', ''), '')] for x in pr if x.get('status') in ('warn', 'fail', 'info')]
    if rows:
        tables.append({'anhang': 'H', 'id': 'H2', 'titel': 'Tabelle H.2: Offene Hinweise der Regularien-Prüfung (Status prüfen / Hinweis)', 'spalten': ['Thema', 'Prüfung', 'Soll', 'Ist', 'Status'], 'zeilen': rows, 'breiten': [14, 34, 20, 20, 12], 'quelle': ''})
    wichtig = [x for x in pr if x.get('status') == 'ok' and any(k in str(x.get('titel', '')).lower() for k in ('notausg', 'fluchtweg', 'feuerlösch', 'erste', 'aed', 'dusch', 'wc', 'spind', 'barrierefrei', 'rettungszeichen', 'flucht- und rettungsplan', 'lüftung', 'decken', 'türbreite', 'ausgangsbreite'))]
    rows = [[str(x.get('thema', '')), str(x.get('titel', ''))[:90], str(x.get('soll', ''))[:70], str(x.get('ist', ''))[:70]] for x in wichtig[:40]]
    if rows:
        tables.append({'anhang': 'H', 'id': 'H3', 'titel': 'Tabelle H.3: Wichtige erfüllte Anforderungen (Auswahl)', 'spalten': ['Thema', 'Prüfung', 'Soll', 'Ist'], 'zeilen': rows, 'breiten': [16, 40, 22, 22], 'quelle': 'Vollständige Liste (121 Prüfungen) in der Planungssoftware bzw. im PDF-Export des Projekts'})

    json.dump({'tables': tables}, open(out, 'w'), ensure_ascii=False, indent=1)
    print('anhang.json:', len(tables), 'Tabellen')


if __name__ == '__main__':
    main(*sys.argv[1:6])
