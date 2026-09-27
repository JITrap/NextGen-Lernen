"""Bereinigt interne Dateiverweise in den Kapiteltexten (kapitel-NN.json) zu bankverständlichen Formulierungen und prüft das Schema."""
from __future__ import annotations

import glob
import json
import re
import sys

SUBS = [
    (r'\(\s*(?:Quelle:\s*)?zahlen\.json\s*[,;/]\s*(?:Annahmen|annahmen)[^)]*\)', '(Excel-Planrechnung, Blatt „Annahmen“)'),
    (r'\(\s*(?:Quelle:\s*)?zahlen\.json[^)]*\)', '(Excel-Planrechnung)'),
    (r'\(\s*(?:Quelle:\s*)?daten\.(?:json|md)[^)]*\)', '(GymPlanner-Planungsdaten)'),
    (r'\(\s*(?:Quelle:\s*)?(?:betrieb|markt|finanzierung|standort)\.(?:json|md)[^)]*\)', '(Rechercheprotokoll, Anhang I)'),
    (r'\bzahlen\.json\b(?:\s*\([^)]*\))?', 'Excel-Planrechnung'),
    (r'\bannahmen\.json\b', 'Blatt „Annahmen“ der Excel-Planrechnung'),
    (r'\bdaten\.(?:json|md)\b', 'GymPlanner-Planungsdaten'),
    (r'\b(?:betrieb|markt|finanzierung|standort)\.(?:json|md)\b', 'Rechercheprotokoll (Anhang I)'),
    (r'\bszenarien\.(?:basis|pessimistisch|optimistisch)(?:\.[a-z_0-9]+)*', 'Excel-Planrechnung, Blatt „Szenarien“'),
    (r'\bannahmen\.[a-z_]+(?:\.[a-z_0-9]+)*', 'Blatt „Annahmen“'),
    (r'\b(?:kosten_j3|umsatz_j[13]_struktur|reserve_bedarf_24|be_monat_(?:ebitda|cf)|be_mitglieder(?:_ohne_kd)?|personal_monat_j[13]|inv_summe|investition_gruppen|kapitaldienst_jahre|rate_m(?:1|25|61_naeherung)|ust_zwischenfinanzierung_max|min_kasse|ek_quote|db_je_mitglied|arpu\.(?:brutto|netto|neben_brutto))\b', 'Excel-Planrechnung'),
    (r'\bGymPlanner-Planungsdaten\s*\(GymPlanner-Planungsdaten\)', 'GymPlanner-Planungsdaten'),
    (r'\(Excel-Planrechnung\)\s*\(Excel-Planrechnung\)', '(Excel-Planrechnung)'),
    (r'  +', ' '),
    (r'\s+([,;.])', r'\1'),
]
ALLOWED = {'h2', 'h3', 'absatz', 'liste', 'tabelle', 'abbildung', 'hinweis', 'kennzahlen'}
# Zweiter Durchgang: wiederholte Quellenfloskeln im Fließtext straffen (die Herkunft aller Planzahlen ist in Vorbemerkung und Anhang erklärt)
TEXT_SUBS = [
    (r'\s*\((?:Excel-Planrechnung)(?:, Blatt „[^“]+“)?(?:, [^()]{0,40})?\)', ''),
    (r'\((?:Excel-Planrechnung|Blatt „Annahmen“(?: der Excel-Planrechnung)?)[,;] ', '('),
    (r'[,;] (?:Excel-Planrechnung|Blatt „Annahmen“(?: der Excel-Planrechnung)?|Excel-Planrechnung, Blatt „[^“]+“)\)', ')'),
    (r',\s*Rechercheprotokoll \(Anhang I\)\)', ')'),
    (r';\s*Rechercheprotokoll \(Anhang I\)\)', ')'),
    (r'\(Rechercheprotokoll \(Anhang I\)\)', '(Quellen: Anhang I)'),
    (r'\(Rechercheprotokoll \(Anhang I\),\s*', '('),
    (r'Rechercheprotokoll \(Anhang I\),\s*', ''),
    (r'\s+([,;.])', r'\1'),
    (r'  +', ' '),
]


def clean_text(v: str) -> str:
    out = v
    for pat, rep in TEXT_SUBS:
        out = re.sub(pat, rep, out)
    return out


def clean(v):
    if isinstance(v, str):
        out = v
        for pat, rep in SUBS:
            out = re.sub(pat, rep, out)
        return out
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    return v


def main(dirpath: str) -> None:
    left = []
    for f in sorted(glob.glob(f'{dirpath}/kapitel-*.json')):
        k = json.load(open(f, encoding='utf-8'))
        k = clean(k)
        for b in k.get('bloecke', []):
            if b.get('typ') in ('absatz', 'hinweis', 'h2', 'h3'):
                b['text'] = clean_text(b['text'])
            elif b.get('typ') == 'liste':
                b['punkte'] = [clean_text(x) for x in b.get('punkte', [])]
            elif b.get('typ') == 'kennzahlen':
                b['items'] = [[clean_text(str(x)) for x in it] for it in b.get('items', [])]
            elif b.get('typ') == 'tabelle':
                b['zeilen'] = [[clean_text(str(x)) for x in z] for z in b.get('zeilen', [])]
        bad = [b.get('typ') for b in k.get('bloecke', []) if b.get('typ') not in ALLOWED]
        if bad:
            print(f, 'unbekannte Blocktypen:', bad)
        for b in k.get('bloecke', []):
            if b.get('typ') == 'abbildung' and not (b.get('datei', '').startswith('charts/') or b.get('datei') == 'grundriss-no1.png'):
                print(f, 'Abbildung ungültig:', b.get('datei'))
            if b.get('typ') == 'tabelle':
                n = len(b.get('spalten', []))
                for z in b.get('zeilen', []):
                    if len(z) != n:
                        print(f, 'Tabellenzeile mit falscher Spaltenzahl in', b.get('titel'), '→ aufgefüllt')
                        while len(z) < n:
                            z.append('')
                        del z[n:]
                if b.get('breiten') and len(b['breiten']) != n:
                    b['breiten'] = None
        json.dump(k, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        txt = json.dumps(k, ensure_ascii=False)
        for m in re.finditer(r'[a-z_]+\.(?:json|md)\b', txt):
            left.append((f.split('/')[-1], txt[max(0, m.start() - 40):m.end() + 20]))
    print('bereinigt;', len(left), 'verbleibende Dateiverweise')
    for x in left[:30]:
        print('  ', x)


if __name__ == '__main__':
    main(sys.argv[1])
