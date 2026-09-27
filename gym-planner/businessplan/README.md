# Businessplan und Finanzierungsplan „No.1 Fitness & HYROX Studio“

Bankfähige Unterlagen für das Projekt **No.1 (überarbeitet)** aus GymPlanner (`examples/No1-ueberarbeitet.gymplanner.json`):
1.975 m² Bruttofläche, Kaltmiete 8,50 €/m², Anlaufreserve für 24 Monate, Eröffnung geplant 01.09.2027.

| Datei | Inhalt |
|---|---|
| `Businessplan_No1.pdf` | Businessplan (Kapitel 1–11 nach BMWK/KfW-Gliederung, Anhang A–I mit Investitionsliste, Tilgungsplänen, monatlichem Liquiditätsplan, Plan-GuV, Annahmen, Grundriss, Immobilien-Shortlist, Regularien-Checkliste, Quellen) – zum Ausdrucken/Versenden |
| `Businessplan_No1.docx` | dieselbe Fassung als Word-Datei zum Bearbeiten (Platzhalter `[…]` mit persönlichen Angaben füllen) |
| `Finanzplan_No1.xlsx` | Excel-Planrechnung mit Formeln: Annahmen (änderbar), Investition/Kapitalbedarf, Finanzierung + Tilgungspläne, Mitglieder, Umsatz, Kosten, Liquidität (Vorlauf + 60 Monate), GuV 5 Jahre, Kennzahlen, Szenarien-Schalter |
| `modell/kapitel/` | Kapiteltexte des Businessplans als JSON (Schema in `modell/SCHEMA.md`) – hier Text ändern und neu bauen |
| `modell/` | Quellskripte: `model.py` (Python-Spiegel der Planrechnung), `excel.py` (Workbook-Generator), `verify.py` (Excel ↔ Python-Abgleich nach LibreOffice-Neuberechnung), `zahlen.py`/`charts.py`/`anhang.py`/`assemble.js`/`export_pdf.py` (Zahlen, Diagramme, Anhangtabellen, Word/PDF-Erzeugung) |
| `recherche/` | Rechercheprotokolle mit Quellen: Markt (DSSV Eckdaten 2026), Finanzierung/Förderung (KfW, L-Bank, Bürgschaftsbank, MBG), Betriebs-Benchmarks, Standort (Bodensee/Stuttgart), Datenauszug der Planung |

## Vor dem Bankgespräch ausfüllen

- Kapitel 2 (Gründerperson): alle Platzhalter in eckigen Klammern, Lebenslauf/Zeugnisse/Lizenzen beilegen.
- Blatt „Annahmen“ der Excel-Datei (gelbe Zellen): Eröffnungstermin, Eigenkapital (Bareinlage), Darlehensbeträge nach Vorgespräch mit Hausbank/L-Bank, Anlaufreserve (≥ berechneter Bedarf im Blatt „Kennzahlen“).
- Investitionspositionen durch Angebote der Hersteller/Handwerker ersetzen (Anhang A, Blatt „Investition“).
- Standort konkretisieren (Kapitel 5, Immobilien-Shortlist Anhang G) und Mietvertragsentwurf beilegen.

## Aktualisieren der Unterlagen

```bash
cd businessplan/modell
python3 zahlen.py annahmen.json daten.json zahlen.json        # Planzahlen aus Annahmen + Datenauszug
python3 charts.py zahlen.json charts                          # Diagramme
python3 excel.py annahmen.json daten.json ../Finanzplan_No1.xlsx && python3 verify.py annahmen.json daten.json ../Finanzplan_No1.xlsx
python3 anhang.py annahmen.json daten.json zahlen.json standort.json anhang.json
cp kapitel/kapitel-*.json . && ./build_doc.sh                # Textbereinigung, DOCX (docx-js), Inhaltsverzeichnis + PDF (LibreOffice/UNO)
```

Benötigt: Python 3 mit openpyxl/matplotlib, Node mit `docx`, LibreOffice (Calc, Writer, python3-uno), poppler-utils.

`daten.json` entsteht aus dem GymPlanner-Projekt (Vitest-Auszug, siehe `recherche/daten.md`), `annahmen.json` enthält alle Planannahmen mit Quellenhinweisen.
Alle Beträge netto; Mitgliedsbeiträge brutto inkl. 19 % USt.
