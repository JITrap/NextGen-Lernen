"""
Finanzmodell "No.1 Fitness & HYROX Studio" – Python-Spiegel der Excel-Planrechnung.

Alle Beträge netto EUR (ohne USt), außer wo "brutto" im Namen steht. Monatsraster:
  Vorlauf (Ausbau/Vorverkauf) = Monate -V..-1, Eröffnung = Monat 1, Planung bis Monat 60 (5 Jahre).
compute(a, szenario) liefert alle Zeitreihen; write_excel(a, pfad) schreibt die Excel-Datei mit Formeln;
verify(a, pfad) vergleicht die per LibreOffice neu berechneten Excel-Werte mit dem Python-Spiegel.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from typing import Any

MONATE = 60


def load(path: str) -> dict[str, Any]:
    with open(path, encoding='utf-8') as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Investition (aus daten.json der App-Kalkulation, Barkauf, 8,50 €/m²)
# ---------------------------------------------------------------------------
@dataclass
class InvestPos:
    gruppe: str        # geraete | import | ausbau | sanitaer | planung | sonstiges | unvorhergesehen | kaution | gruendung | vorlauf
    bezeichnung: str
    betrag: float
    afa_jahre: int | None = None  # None = keine AfA (Kaution, Reserve, Vorlaufkosten sind Aufwand)
    zahlung: list[tuple[int, float]] = field(default_factory=list)  # (Monat, Anteil)
    vorsteuer: bool = True
    hinweis: str = ''


def investition(a: dict, daten: dict) -> list[InvestPos]:
    """Kapitalbedarf ohne Betriebsmittelreserve (die kommt aus der Liquiditätsplanung)."""
    k = daten['kosten_barkauf_850']
    lines = {l['id']: l for l in k['einmal']}
    inv = a['investition']
    zp = inv['zahlungsplan']
    afa = inv['afa_jahre']
    out: list[InvestPos] = []
    ausbau_m = [(m, 1 / len(zp['ausbau_monate'])) for m in zp['ausbau_monate']]
    plan_m = [(m, 1 / len(zp['planung_monate'])) for m in zp['planung_monate']]
    for l in k['einmal']:
        if l['id'].startswith('geraete:'):
            if l['summeEur'] <= 0:
                continue
            out.append(InvestPos('geraete', f"Geräte {l['bezeichnung']}", l['summeEur'], afa['geraete'], [(zp['geraete_monat'], 1.0)], True, f"{l['menge']} Objekte lt. Stückliste"))
    out.append(InvestPos('import', 'Import-Nebenkosten (Fracht, Zoll) Atlantis/Prime', lines['import']['summeEur'], afa['geraete'], [(zp['geraete_monat'], 1.0)], False, lines['import'].get('hinweis', '')))
    for id_, name in [('ausbau', 'Grundausbau (Trockenbau, Elektro, LED, Heizung, Maler)'), ('boden-training', 'Sportboden Trainingsfläche'), ('boden-nass', 'Nassbereich-Boden Umkleide/Sanitär'), ('lueftung', 'Lüftung (RLT-Anlage)'), ('spiegel', 'Spiegelwände'), ('brandschutz', 'Brandschutz / Sicherheitsbeleuchtung')]:
        l = lines[id_]
        out.append(InvestPos('ausbau', name, l['summeEur'], afa['ausbau'], ausbau_m, True, f"{l['menge']:.0f} {l['einheit']} × {l['einzelpreisEur']:.0f} €"))
    for id_, name in [('sanitaer-duschen', 'Sanitärinstallation Duschen'), ('sanitaer-wc', 'Sanitärinstallation WCs/Urinale'), ('sanitaer-waschtische', 'Sanitärinstallation Waschtische')]:
        l = lines[id_]
        out.append(InvestPos('sanitaer', name, l['summeEur'], afa['sanitaer'], ausbau_m, True, f"{l['menge']:.0f} Stk. × {l['einzelpreisEur']:.0f} €"))
    l = lines['planung']
    out.append(InvestPos('planung', 'Planung, Fachplaner, Genehmigung (Nutzungsänderung)', l['summeEur'], afa['ausbau'], plan_m, True, l.get('hinweis', '')))
    l = lines['sonstiges']
    out.append(InvestPos('sonstiges', 'Zutrittssystem, Studiosoftware-Einrichtung, Kleinmaterial, Brandschutzkonzept', l['summeEur'], afa['sonstiges'], [(zp['sonstiges_monat'], 1.0)], True, l.get('hinweis', '')))
    basis = sum(p.betrag for p in out)
    out.append(InvestPos('unvorhergesehen', f"Unvorhergesehenes ({inv['unvorhergesehen_prozent'] * 100:.0f} % der Investitionssumme)", math.floor(basis * inv['unvorhergesehen_prozent'] + 0.5), afa['ausbau'], ausbau_m, True, 'Reserve für Mehrkosten im Ausbau'))
    m = a['miete']
    kaution = m['kaution_monate'] * (m['kalt_eur_m2'] + m['betriebskosten_eur_m2'] + m['energie_wasser_eur_m2']) * a['projekt']['flaeche_brutto_m2']
    out.append(InvestPos('kaution', f"Mietkaution ({m['kaution_monate']} Monatsmieten inkl. Nebenkosten)", math.floor(kaution + 0.5), None, [(zp['kaution_monat'], 1.0)], False, 'Sicherheitsleistung, kein Aufwand'))
    v = a['vorlauf']
    out.append(InvestPos('gruendung', 'Gründungskosten GmbH (Notar, Handelsregister, Gewerbeanmeldung)', v['gruendungskosten_gmbh'], None, [(-a['projekt']['vorlauf_monate'], 1.0)], True, ''))
    out.append(InvestPos('gruendung', 'Beratung (Businessplan, Steuerberatung Gründung)', v['beratung_businessplan_steuer'], None, [(-a['projekt']['vorlauf_monate'], 1.0)], True, ''))
    return out


# ---------------------------------------------------------------------------
# Modellrechnung
# ---------------------------------------------------------------------------
def arpu_brutto(a: dict, faktor: float) -> float:
    t = a['tarife']
    return sum(t[k]['beitrag_brutto'] * t[k]['anteil'] for k in ('basic', 'premium', 'student')) * faktor


def neuzugang(a: dict, m: int, faktor: float) -> float:
    for ph in a['mitglieder']['neuzugaenge_je_monat']:
        if ph['von'] <= m <= ph['bis']:
            return ph['n'] * faktor
    return 0.0


def personal_monat(a: dict, m: int) -> float:
    """Personalkosten (AG-Brutto inkl. Sozialabgaben) im Monat m (negativ = Vorlauf)."""
    p = a['personal']
    jahr = max(0, (m - 1) // 12) if m >= 1 else 0
    steig = (1 + p['gehaltssteigerung_prozent_pa'] / 100) ** jahr
    total = 0.0
    for s in p['stellen']:
        if m < s['ab_monat']:
            continue
        faktor = 1 + (p['minijob_pauschalabgaben'] if s['minijob'] else p['ag_anteil_sozialversicherung'])
        total += s['anzahl'] * s['brutto_monat'] * faktor * steig
    return total


def compute(a: dict, daten: dict, szenario: str = 'basis') -> dict[str, Any]:
    sz = a['szenarien'][szenario]
    P = a['projekt']
    V = P['vorlauf_monate']
    fl = P['flaeche_brutto_m2']
    mi = a['miete']
    ust = a['tarife']['ust_satz']
    inv = investition(a, daten)
    inv_summe = sum(p.betrag for p in inv)
    geraetewert = sum(p.betrag for p in inv if p.gruppe in ('geraete', 'import'))
    fin = a['finanzierung']
    reserve = fin['betriebsmittelreserve']
    kapitalbedarf = inv_summe + reserve
    ek = fin['eigenkapital']
    darlehen = [dict(d) for d in fin['darlehen']]
    fest = sum(d['betrag'] for d in darlehen if not d.get('plug'))
    for d in darlehen:
        if d.get('plug'):
            d['betrag'] = max(0.0, kapitalbedarf - ek - fest)  # Restfinanzierung
    darlehen_summe = sum(d['betrag'] for d in darlehen)
    ek_aehnlich = sum(d['betrag'] for d in darlehen if d.get('eigenkapitalaehnlich'))
    mittel = ek + darlehen_summe
    monate = list(range(-V, 0)) + list(range(1, MONATE + 1))

    # ---- Mitglieder ----
    churn = sz['kuendigungsquote_monat']
    cap = a['mitglieder']['kapazitaet_max_mitglieder']
    bestand: dict[int, float] = {}
    anfang: dict[int, float] = {}
    neu: dict[int, float] = {}
    kuend: dict[int, float] = {}
    neu_wirksam: dict[int, float] = {}
    prev = a['mitglieder']['vorverkauf_bestand_eroeffnung'] * sz['neuzugaenge_faktor']
    for m in range(1, MONATE + 1):
        n = neuzugang(a, m, sz['neuzugaenge_faktor'])
        k = prev * churn
        b = min(cap, prev + n - k)
        anfang[m], neu[m], kuend[m], bestand[m] = prev, n, k, b
        neu_wirksam[m] = max(0.0, b - prev + k)  # tatsächlich aufgenommene Mitglieder (Kapazitätsgrenze)
        prev = b

    # ---- Umsatz (netto) ----
    t = a['tarife']
    arpu_b = arpu_brutto(a, sz['beitrag_faktor'])
    nu = a['nebenumsatz']
    neben_b = nu['getraenke_shakes_brutto_je_mitglied_monat'] + nu['solarium_wellness_zusatz_brutto_je_mitglied_monat'] + nu['personal_training_kurse_brutto_je_mitglied_monat'] + nu['merchandise_sonstiges_brutto_je_mitglied_monat']
    beitrag: dict[int, float] = {}
    service: dict[int, float] = {}
    aufnahme: dict[int, float] = {}
    neben: dict[int, float] = {}
    umsatz: dict[int, float] = {}
    wareneinsatz: dict[int, float] = {}
    avgb: dict[int, float] = {}
    serv_b = t.get('servicepauschale_halbjahr_brutto', 0)
    erh = t.get('beitragserhoehung_prozent_pa', 0) / 100
    for m in range(1, MONATE + 1):
        avg = (anfang[m] + bestand[m]) / 2  # Durchschnittsbestand des Monats (Abrechnungsbasis)
        avgb[m] = avg
        jahr = (m - 1) // 12 + 1
        beitrag[m] = avg * arpu_b * (1 + erh) ** max(0, jahr - 2) / (1 + ust)
        service[m] = avg * serv_b / 6 / (1 + ust)
        aufnahme[m] = neu_wirksam[m] * t['aufnahmegebuehr_anteil_zahlend'] * t['aufnahmegebuehr_brutto'] / (1 + ust)
        neben[m] = avg * neben_b / (1 + ust)
        wareneinsatz[m] = avg * nu['getraenke_shakes_brutto_je_mitglied_monat'] / (1 + ust) * nu['getraenke_wareneinsatz_prozent']
        umsatz[m] = beitrag[m] + service[m] + aufnahme[m] + neben[m]

    # ---- Kosten je Monat (netto) ----
    sk = a['sachkosten_monat']
    kosten: dict[int, dict[str, float]] = {}
    for m in monate:
        c: dict[str, float] = {}
        vorlauf = m < 1
        # Mietfreie Monate: die ersten Vorlaufmonate (Ausbau) sind mietfrei, danach Miete fällig
        idx_vorlauf = m + V  # 0..V-1 im Vorlauf
        mietfrei = vorlauf and idx_vorlauf < mi['mietfreie_monate_ausbau']
        jahr = 0 if vorlauf else (m - 1) // 12
        index = (1 + mi['indexierung_prozent_pa'] / 100) ** jahr
        c['miete'] = 0.0 if mietfrei else fl * mi['kalt_eur_m2'] * index
        c['betriebskosten'] = 0.0 if mietfrei else fl * mi['betriebskosten_eur_m2']
        c['energie'] = 0.0 if vorlauf else fl * mi['energie_wasser_eur_m2']
        c['personal'] = personal_monat(a, m)
        if vorlauf:
            mv = a['vorlauf']
            c['marketing'] = mv['marketing_vorverkauf_gesamt'] / mv['marketing_vorverkauf_monate'] if idx_vorlauf >= V - mv['marketing_vorverkauf_monate'] else 0.0
        else:
            c['marketing'] = sk['marketing_laufend'] + (sk['marketing_eroeffnung_monate_1_3'] if m <= 3 else 0.0) + sk['marketing_prozent_vom_umsatz'] * umsatz.get(m, 0.0)
        c['versicherungen'] = 0.0 if vorlauf else sk['versicherungen']
        c['gema_gvl'] = 0.0 if vorlauf else sk['gema_gvl']
        c['studiosoftware_zutritt'] = 0.0 if vorlauf else sk['studiosoftware_zutritt']
        c['payment'] = 0.0 if vorlauf else sk['payment_prozent_vom_beitrag_brutto'] * (beitrag[m] + service[m] + aufnahme[m]) * (1 + ust)
        c['steuerberater'] = sk['steuerberater_buchhaltung'] if (not vorlauf or idx_vorlauf >= 1) else 0.0
        c['reinigung'] = 0.0 if vorlauf else sk['reinigung_material_hygiene']
        c['telekommunikation'] = 0.0 if vorlauf else sk['telekommunikation_it']
        c['wartung'] = 0.0 if vorlauf else geraetewert * sk['wartung_prozent_geraetewert_pa'] / 12
        c['instandhaltung'] = 0.0 if vorlauf else fl * sk['instandhaltung_gebaeude_eur_m2_pa'] / 12
        c['sonstiges'] = 0.0 if vorlauf else sk['sonstiges']
        c['wareneinsatz'] = 0.0 if vorlauf else wareneinsatz[m]
        kosten[m] = c
    kosten_summe = {m: sum(kosten[m].values()) for m in monate}

    # ---- Investitionsauszahlungen je Monat ----
    inv_zahl: dict[int, float] = {m: 0.0 for m in monate}
    inv_vst: dict[int, float] = {m: 0.0 for m in monate}
    for p in inv:
        for (m, anteil) in p.zahlung:
            inv_zahl[m] += p.betrag * anteil
            if p.vorsteuer:
                inv_vst[m] += p.betrag * anteil * ust

    # ---- AfA je Jahr ----
    afa_jahr = {j: 0.0 for j in range(1, 6)}
    for p in inv:
        if p.afa_jahre:
            for j in range(1, 6):
                if j <= p.afa_jahre:
                    afa_jahr[j] += p.betrag / p.afa_jahre
    # Vorlaufkosten (Gründung/Beratung/Kaution) sind Aufwand bzw. Aktivposten – Gründung/Beratung als Aufwand Jahr 1
    aufwand_gruendung = sum(p.betrag for p in inv if p.gruppe == 'gruendung')

    # ---- Darlehen: Zins und Tilgung je Monat (linear nach tilgungsfreien Jahren, wie KfW-Ratentilgung) ----
    zins: dict[int, float] = {m: 0.0 for m in monate}
    tilg: dict[int, float] = {m: 0.0 for m in monate}
    ausz: dict[int, float] = {m: 0.0 for m in monate}
    saldo_ende: dict[int, float] = {m: 0.0 for m in monate}
    darl_detail = []
    for d in darlehen:
        bal = 0.0
        n_gesamt = d['laufzeit_jahre'] * 12
        n_frei = d['tilgungsfreie_jahre'] * 12
        rate = d['betrag'] / (n_gesamt - n_frei) if n_gesamt > n_frei else 0.0
        idx = 0  # Monate seit Auszahlung
        rows = {}
        for m in monate:
            z = t_ = az = 0.0
            if m == d['auszahlung_monat']:
                az = d['betrag']
                bal += az
            if bal > 1e-9 and m >= d['auszahlung_monat']:
                z = bal * d['zins_pa'] / 12
                if n_gesamt > n_frei:
                    if idx >= n_frei:
                        t_ = min(rate, bal)
                        bal -= t_
                elif idx == n_gesamt - 1:  # endfällig
                    t_ = bal
                    bal = 0.0
                idx += 1
            zins[m] += z
            tilg[m] += t_
            ausz[m] += az
            saldo_ende[m] += bal
            rows[m] = (az, z, t_, bal)
        darl_detail.append({'name': d['name'], 'betrag': d['betrag'], 'rows': rows, 'rate_monat': rate, 'zins_pa': d['zins_pa'], 'laufzeit_jahre': d['laufzeit_jahre'], 'tilgungsfreie_jahre': d['tilgungsfreie_jahre'], 'eigenkapitalaehnlich': bool(d.get('eigenkapitalaehnlich'))})

    # ---- USt-Zahllast / Vorsteuer ----
    vst_map = sk['vorsteuerfaehig']
    key_map = {'miete': 'miete', 'betriebskosten': 'betriebskosten', 'energie': 'energie', 'marketing': 'marketing', 'versicherungen': 'versicherungen', 'gema_gvl': 'gema_gvl', 'studiosoftware_zutritt': 'studiosoftware_zutritt', 'payment': 'payment', 'steuerberater': 'steuerberater', 'reinigung': 'reinigung', 'telekommunikation': 'telekommunikation', 'wartung': 'wartung', 'instandhaltung': 'instandhaltung', 'sonstiges': 'sonstiges', 'wareneinsatz': 'sonstiges'}
    ust_ein: dict[int, float] = {}
    vst_kosten: dict[int, float] = {}
    for m in monate:
        ust_ein[m] = umsatz.get(m, 0.0) * ust
        v = 0.0
        for k_, val in kosten[m].items():
            if k_ == 'personal':
                continue
            if vst_map.get(key_map[k_], False) and not (k_ == 'miete' and not mi['ust_auf_miete']):
                v += val * ust
        vst_kosten[m] = v
    delay = a['steuern']['ust_erstattung_verzoegerung_monate']
    ust_zahlung: dict[int, float] = {m: 0.0 for m in monate}  # + = Zahlung ans FA, − = Erstattung
    for i, m in enumerate(monate):
        saldo = ust_ein[m] - vst_kosten[m] - inv_vst[m]
        j = i + delay
        if j < len(monate):
            ust_zahlung[monate[j]] += saldo

    # ---- Steuern (jährlich, Zahlung im Folgejahr) ----
    st = a['steuern']
    gewst = st['gewerbesteuer_messzahl'] * st['gewerbesteuer_hebesatz']
    kst = st['koerperschaftsteuer'] * (1 + st['soli'])
    guv = {}
    verlustvortrag = 0.0
    steuer_zahlung: dict[int, float] = {m: 0.0 for m in monate}
    for j in range(1, 6):
        ms = range((j - 1) * 12 + 1, j * 12 + 1)
        u = sum(umsatz[m] for m in ms)
        we = sum(kosten[m]['wareneinsatz'] for m in ms)
        pers = sum(kosten[m]['personal'] for m in ms)
        raum = sum(kosten[m]['miete'] + kosten[m]['betriebskosten'] + kosten[m]['energie'] + kosten[m]['instandhaltung'] for m in ms)
        mark = sum(kosten[m]['marketing'] for m in ms)
        sonst = sum(kosten_summe[m] for m in ms) - we - pers - raum - mark
        if j == 1:
            # Vorlaufkosten (Miete/Personal/Marketing/Beratung vor Eröffnung) gehören zum Aufwand des ersten Geschäftsjahres
            vor = [m for m in monate if m < 1]
            pers += sum(kosten[m]['personal'] for m in vor)
            raum += sum(kosten[m]['miete'] + kosten[m]['betriebskosten'] for m in vor)
            mark += sum(kosten[m]['marketing'] for m in vor)
            sonst += sum(kosten_summe[m] - kosten[m]['personal'] - kosten[m]['miete'] - kosten[m]['betriebskosten'] - kosten[m]['marketing'] for m in vor) + aufwand_gruendung
        ebitda = u - we - pers - raum - mark - sonst
        ebit = ebitda - afa_jahr[j]
        zi = sum(zins[m] for m in ms) + (sum(zins[m] for m in monate if m < 1) if j == 1 else 0.0)
        ebt = ebit - zi
        vv_anfang = verlustvortrag
        steuerbasis = max(0.0, ebt - vv_anfang)
        verlustvortrag = vv_anfang - min(vv_anfang, max(ebt, 0.0)) + max(0.0, -ebt)
        steuer = steuerbasis * (gewst + kst)
        jahresergebnis = ebt - steuer
        ti = sum(tilg[m] for m in ms)
        kapitaldienst = zi + ti
        guv[j] = {'umsatz': u, 'wareneinsatz': we, 'personal': pers, 'raumkosten': raum, 'marketing': mark, 'sonstige': sonst, 'ebitda': ebitda, 'afa': afa_jahr[j], 'ebit': ebit, 'zinsen': zi, 'ebt': ebt, 'steuern': steuer, 'jahresergebnis': jahresergebnis, 'tilgung': ti, 'kapitaldienst': kapitaldienst, 'dscr': ((ebitda - steuer) / kapitaldienst) if kapitaldienst > 0 else None, 'cashflow_nach_kapitaldienst': ebitda - steuer - kapitaldienst, 'mitglieder_ende': bestand[j * 12], 'verlustvortrag_anfang': vv_anfang, 'steuerbasis': steuerbasis}
        # Steuerzahlung: im Folgejahr (Monat 12*j + 6 als Näherung: Abschlusszahlung Mitte Folgejahr)
        pay_m = j * 12 + 6
        if pay_m <= MONATE:
            steuer_zahlung[pay_m] += steuer

    # ---- Liquidität je Monat ----
    liq = {}
    kasse = 0.0
    min_kasse = (None, math.inf)
    kum_betrieb = 0.0
    min_kum_betrieb = (None, 0.0)
    for m in monate:
        ein_umsatz_brutto = umsatz.get(m, 0.0) * (1 + ust)
        ein_ek = ek if m == monate[0] else 0.0
        ein_darlehen = ausz[m]
        ein_reserve = 0.0  # Reserve ist Teil des Kapitalbedarfs → in Eigenkapital/Darlehen enthalten (Mittelherkunft)
        aus_kosten_brutto = kosten_summe[m] + vst_kosten[m]
        aus_invest_brutto = inv_zahl[m] + inv_vst[m]
        aus_ust = ust_zahlung[m]
        aus_zins = zins[m]
        aus_tilg = tilg[m]
        aus_steuer = steuer_zahlung[m]
        einz = ein_umsatz_brutto + ein_ek + ein_darlehen
        ausz_ = aus_kosten_brutto + aus_invest_brutto + aus_ust + aus_zins + aus_tilg + aus_steuer
        k_anfang = kasse
        kasse = k_anfang + einz - ausz_
        # Betriebsergebnis vor Finanzierung (für Reserve-Bedarf): Umsatz − Kosten − Zinsen − Tilgung (netto), ohne Investition/EK/Darlehen
        betrieb = umsatz.get(m, 0.0) - kosten_summe[m] - zins[m] - tilg[m] - steuer_zahlung[m]
        kum_betrieb += betrieb
        if kum_betrieb < min_kum_betrieb[1]:
            min_kum_betrieb = (m, kum_betrieb)
        if kasse < min_kasse[1]:
            min_kasse = (m, kasse)
        liq[m] = {'anfang': k_anfang, 'umsatz_brutto': ein_umsatz_brutto, 'eigenkapital': ein_ek, 'darlehen': ein_darlehen, 'kosten_brutto': aus_kosten_brutto, 'investition_brutto': aus_invest_brutto, 'ust': aus_ust, 'zinsen': aus_zins, 'tilgung': aus_tilg, 'steuern': aus_steuer, 'einzahlungen': einz, 'auszahlungen': ausz_, 'ende': kasse, 'betrieb_kum': kum_betrieb}

    # ---- Kennzahlen ----
    be_monat_ebitda = next((m for m in range(1, MONATE + 1) if umsatz[m] - kosten_summe[m] >= 0), None)
    be_monat_cf = next((m for m in range(1, MONATE + 1) if umsatz[m] - kosten_summe[m] - zins[m] - tilg[m] >= 0), None)
    # Break-even-Mitglieder bei Vollkosten Jahr 3 (inkl. Kapitaldienst) und ARPU je Mitglied (netto, inkl. Nebenumsatz)
    m3 = 36
    fix3 = kosten_summe[m3] - kosten[m3]['wareneinsatz'] - kosten[m3]['payment'] + zins[m3] + tilg[m3]
    db_je_mitglied = (arpu_b + serv_b / 6 + neben_b) / (1 + ust) - nu['getraenke_shakes_brutto_je_mitglied_monat'] / (1 + ust) * nu['getraenke_wareneinsatz_prozent'] - sk['payment_prozent_vom_beitrag_brutto'] * (arpu_b + serv_b / 6)
    be_mitglieder = math.ceil(fix3 / db_je_mitglied)
    fix3_ohne_kd = kosten_summe[m3] - kosten[m3]['wareneinsatz'] - kosten[m3]['payment']
    be_mitglieder_ohne_kd = math.ceil(fix3_ohne_kd / db_je_mitglied)
    reserve_bedarf = -min_kum_betrieb[1] * (1 + fin['reserve_sicherheitspuffer_prozent'])
    reserve_bedarf_24 = -min(liq[m]['betrieb_kum'] for m in range(-V, 25) if m != 0) * (1 + fin['reserve_sicherheitspuffer_prozent'])

    return {
        'szenario': szenario, 'monate': monate, 'investition': inv, 'inv_summe': inv_summe, 'geraetewert': geraetewert,
        'reserve': reserve, 'kapitalbedarf': kapitalbedarf, 'eigenkapital': ek, 'ek_aehnlich': ek_aehnlich, 'ek_quote': (ek + ek_aehnlich) / kapitalbedarf if kapitalbedarf else 0.0, 'darlehen_summe': darlehen_summe, 'mittel': mittel, 'darlehen_liste': darlehen,
        'bestand': bestand, 'anfang': anfang, 'avg': avgb, 'service': service, 'neu': neu, 'neu_wirksam': neu_wirksam, 'kuend': kuend, 'beitrag': beitrag, 'aufnahme': aufnahme, 'neben': neben, 'umsatz': umsatz,
        'kosten': kosten, 'kosten_summe': kosten_summe, 'inv_zahl': inv_zahl, 'inv_vst': inv_vst, 'afa_jahr': afa_jahr,
        'zins': zins, 'tilg': tilg, 'ausz': ausz, 'saldo_ende': saldo_ende, 'darlehen': darl_detail, 'ust_zahlung': ust_zahlung, 'vst_kosten': vst_kosten,
        'guv': guv, 'liq': liq, 'min_kasse': min_kasse, 'min_kum_betrieb': min_kum_betrieb,
        'be_monat_ebitda': be_monat_ebitda, 'be_monat_cf': be_monat_cf, 'be_mitglieder': be_mitglieder, 'be_mitglieder_ohne_kd': be_mitglieder_ohne_kd,
        'db_je_mitglied': db_je_mitglied, 'arpu_brutto': arpu_b, 'neben_brutto': neben_b, 'reserve_bedarf': reserve_bedarf, 'reserve_bedarf_24': reserve_bedarf_24,
        'steuersatz': gewst + kst,
    }


def reserve_fixpunkt(a: dict, daten: dict, szenario: str = 'basis', schritt: int = 10000, max_iter: int = 20) -> dict:
    """Setzt die Betriebsmittelreserve auf den berechneten 24-Monats-Bedarf (aufgerundet auf `schritt`) und iteriert,
    bis Reserve und Bedarf stabil sind (die Reserve erhöht die Restfinanzierung und damit die Zinsen)."""
    for _ in range(max_iter):
        r = compute(a, daten, szenario)
        bedarf = math.ceil(r['reserve_bedarf_24'] / schritt) * schritt
        if abs(bedarf - a['finanzierung']['betriebsmittelreserve']) < 1:
            return a
        a['finanzierung']['betriebsmittelreserve'] = bedarf
    return a


def summary(r: dict) -> dict:
    g = r['guv']
    return {
        'szenario': r['szenario'],
        'investition': round(r['inv_summe']), 'reserve': r['reserve'], 'kapitalbedarf': round(r['kapitalbedarf']),
        'eigenkapital': r['eigenkapital'], 'ek_aehnlich': round(r['ek_aehnlich']), 'ek_quote': round(r['ek_quote'], 3), 'darlehen': round(r['darlehen_summe']), 'deckung': round(r['mittel'] - r['kapitalbedarf']), 'faktoren': None,
        'mitglieder_m12': round(r['bestand'][12]), 'mitglieder_m24': round(r['bestand'][24]), 'mitglieder_m36': round(r['bestand'][36]), 'mitglieder_m60': round(r['bestand'][60]),
        'umsatz_j1': round(g[1]['umsatz']), 'umsatz_j2': round(g[2]['umsatz']), 'umsatz_j3': round(g[3]['umsatz']), 'umsatz_j5': round(g[5]['umsatz']),
        'ebitda_j1': round(g[1]['ebitda']), 'ebitda_j2': round(g[2]['ebitda']), 'ebitda_j3': round(g[3]['ebitda']),
        'ergebnis_j1': round(g[1]['jahresergebnis']), 'ergebnis_j2': round(g[2]['jahresergebnis']), 'ergebnis_j3': round(g[3]['jahresergebnis']), 'ergebnis_j5': round(g[5]['jahresergebnis']),
        'dscr_j3': round(g[3]['dscr'], 2) if g[3]['dscr'] else None, 'dscr_j4': round(g[4]['dscr'], 2) if g[4]['dscr'] else None,
        'min_kasse': (r['min_kasse'][0], round(r['min_kasse'][1])), 'reserve_bedarf_24': round(r['reserve_bedarf_24']),
        'be_monat_ebitda': r['be_monat_ebitda'], 'be_monat_cf': r['be_monat_cf'], 'be_mitglieder': r['be_mitglieder'], 'be_mitglieder_ohne_kd': r['be_mitglieder_ohne_kd'],
        'arpu_brutto': round(r['arpu_brutto'], 2), 'db_je_mitglied': round(r['db_je_mitglied'], 2),
    }


if __name__ == '__main__':
    import sys
    a = load(sys.argv[1] if len(sys.argv) > 1 else 'annahmen.json')
    d = load(sys.argv[2] if len(sys.argv) > 2 else 'daten.json')
    for s in ('pessimistisch', 'basis', 'optimistisch'):
        print(json.dumps(summary(compute(a, d, s)), ensure_ascii=False, indent=1))
