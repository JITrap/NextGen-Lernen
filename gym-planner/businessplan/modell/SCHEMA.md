# Kapitel-Schema für den Businessplan (Datei je Kapitel: `kapitel-NN.json`)

Jedes Kapitel ist eine JSON-Datei mit dieser Struktur (UTF-8, deutsch, bankfähiger Ton: sachlich, präzise, keine Werbesprache, keine Ausrufezeichen):

```json
{
  "nummer": 4,
  "titel": "Markt und Wettbewerb",
  "bloecke": [
    { "typ": "h2", "text": "4.1 Fitnessmarkt Deutschland" },
    { "typ": "absatz", "text": "Fließtext … (3–8 Sätze, Zahlen mit Quelle in Klammern: (DSSV Eckdaten 2026))" },
    { "typ": "liste", "punkte": ["Punkt 1", "Punkt 2"] },
    { "typ": "tabelle", "titel": "Tabelle 4.1: …", "spalten": ["Spalte A", "Spalte B"], "zeilen": [["a", "b"], ["c", "d"]], "quelle": "Quelle: …", "breiten": [40, 60] },
    { "typ": "abbildung", "datei": "charts/chart_mitglieder.png", "titel": "Abbildung 4.1: …" },
    { "typ": "hinweis", "text": "Kasten mit Hinweis (z. B. was der Gründer vor dem Bankgespräch ergänzen muss)" },
    { "typ": "kennzahlen", "items": [["Kapitalbedarf", "2.602.583 €"], ["Eigenkapitalquote", "15,4 %"]] }
  ],
  "quellen": ["Kurzzitat – URL (Stand)"]
}
```

Regeln:
- Zahlenformat deutsch: 1.234.567 €, 15,4 %, 8,50 €/m². Beträge netto, außer Beiträge (brutto inkl. USt) – immer sagen, was gemeint ist.
- Nur Zahlen aus den bereitgestellten Dateien (zahlen.json, daten.json, markt/finanzierung/betrieb/standort.json bzw. .md). Nichts schätzen, was dort nicht steht; wenn etwas fehlt: als „[vom Gründer zu ergänzen: …]“ markieren.
- Platzhalter für persönliche Angaben des Gründers immer in eckigen Klammern: [Name], [Geburtsdatum], [Ausbildung], [Wohnort], [Eigenmittel] …
- Tabellen höchstens 6 Spalten, Zeilen kurz; `breiten` in Prozent (Summe 100), optional.
- Abbildungen nur aus dem Ordner `charts/` (vorhanden: chart_mitglieder, chart_umsatz_kosten, chart_liquiditaet, chart_finanzierung, chart_guv, chart_kosten_j3, chart_investition, chart_kapitaldienst) und `grundriss-no1.png`.
- Keine Markdown-Syntax innerhalb der Texte (kein **fett**, keine # Überschriften, keine Aufzählungszeichen im Fließtext).
- `quellen`: Liste der im Kapitel verwendeten Quellen (Kurzform); die Quellen werden im Anhang gesammelt.
