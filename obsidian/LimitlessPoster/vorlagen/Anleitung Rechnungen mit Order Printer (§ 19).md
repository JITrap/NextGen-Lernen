---
tags: [limitlessposter, anleitung, rechnung, steuer]
stand: 2026-10-02
---
# Rechnungen mit Shopify Order Printer (Kleinunternehmer § 19 UStG)

**Ergebnis:** Zu jeder Bestellung ein sauberes PDF „RECHNUNG RE-1001“ mit allen Pflichtangaben.
**Kosten:** 0 € (App von Shopify). **Dauer:** Einrichtung 10 Minuten, danach ca. 1 Minute pro Rechnung.
**Vorlage:** `vorlagen/Order Printer Rechnung (§ 19).liquid` (mit Shopify-Liquid getestet, Beispiel-PDF: `shop-checkliste/arbeit-2026-10-02/admin/vorschau/rechnung-beispiel-1002.pdf`)

## Was muss auf deine Rechnung? (Stand 2026)
Seit 01.01.2025 sind Umsätze von Kleinunternehmern **steuerfrei** (§ 19 Abs. 1 UStG neu). Für ihre Rechnungen gilt der vereinfachte § 34a UStDV:

| Pflicht nach § 34a UStDV | In der Vorlage |
|---|---|
| Name und Anschrift von dir und vom Kunden | Kopfzeile, Rechnungsadresse, Fußzeile |
| Ausstellungsdatum | Rechnungsdatum |
| Menge und Art der Ware | Positionen mit Größe in cm und Rahmenfarbe |
| Betrag in einer Summe | Gesamtbetrag |
| Hinweis auf die Steuerbefreiung für Kleinunternehmer | „Steuerfreie Kleinunternehmerleistung gemäß § 19 UStG. Es wird keine Umsatzsteuer berechnet und ausgewiesen.“ |

Freiwillig, aber sinnvoll und drin: fortlaufende Rechnungsnummer, Liefer-/Leistungsdatum, Zahlart, USt-IdNr. DE463961672.
Rechnungsnummer und Leistungsdatum verlangt § 34a nicht. Die Nummer brauchst du aber für deine Buchhaltung.

**Nie** eine Umsatzsteuer ausweisen. Sonst schuldest du sie trotzdem (§ 14c UStG). Die Vorlage zeigt einen roten Warnkasten, falls Shopify je Steuern berechnet.

**Musst du überhaupt Rechnungen schicken?** Privatkunden gegenüber gibt es keine Pflicht. Kauft eine Firma (Firmenname in der Rechnungsadresse), musst du innerhalb von 6 Monaten eine Rechnung ausstellen. Empfehlung: Zu jeder Bestellung das PDF erzeugen und ablegen, an Firmen und auf Wunsch per Mail schicken.

**E-Rechnung:** Kleinunternehmer müssen keine E-Rechnungen ausstellen, ein PDF ist erlaubt. Empfangen musst du E-Rechnungen können, dein Gmail-Postfach reicht dafür.

**Aufbewahren:** Rechnungen 8 Jahre (seit 2025). Ordner z. B. Google Drive „Buchhaltung/Rechnungen 2026“.

**Grenzen:** Kleinunternehmer bleibst du, solange der Umsatz im Vorjahr unter 25.000 € liegt und im laufenden Jahr 100.000 € nicht überschreitet. Wird die 100.000-€-Grenze überschritten, ist ab genau diesem Umsatz Schluss: Dann muss die Vorlage geändert werden (Umsatzsteuer ausweisen).

## Schritt 1: App installieren (2 Min)
1. https://apps.shopify.com/shopify-order-printer öffnen > **Installieren**.
   (Achtung: Die alte App „Order Printer“ gibt es nicht mehr. Richtig ist **Shopify Order Printer**, Entwickler Shopify, kostenlos.)
2. Die App fragt nach Berechtigungen für Bestellungen > bestätigen.

## Schritt 2: Vorlage anlegen (5 Min)
1. In Shopify links **Apps** > **Order Printer** > **Templates** > **Create a template**.
2. Name: `Rechnung (§ 19)`
3. Unter **Edit code** alles löschen und den kompletten Inhalt von `Order Printer Rechnung (§ 19).liquid` einfügen.
4. **Preview** anklicken und eine Bestellung wählen (z. B. die Testbestellung). Prüfen, siehe Checkliste unten.
5. **Save**.
6. Damit du nicht aus Versehen die englische Standardvorlage nimmst: die Vorlage **Invoice** in `Invoice (EN, nicht nutzen)` umbenennen oder löschen.

Die App selbst ist nur englisch, die Rechnung ist komplett deutsch.

## Schritt 3: Rechnung erzeugen (1 Min pro Bestellung)
1. https://admin.shopify.com/store/gexdm4-2q/orders > Bestellung öffnen.
2. Oben **Drucken** bzw. **Weitere Aktionen** > **Mit Order Printer drucken** (englisch: „Print with Order Printer“).
3. Vorlage **Rechnung (§ 19)** wählen > **Drucken** bzw. **Download** > im Druckfenster **Als PDF speichern**.
4. Dateiname: `RE-1001 LimitlessPoster.pdf` (Nummer = Bestellnummer).
5. Mehrere auf einmal: In der Bestellliste Bestellungen anhaken > **...** > **Mit Order Printer drucken** (bis 50 Stück).

## Schritt 4: an den Kunden schicken
Shopify Order Printer kann **keine** Rechnungen automatisch per Mail verschicken und keinen Link in die Bestellbestätigung setzen.
- **Manuell (empfohlen für den Start):** Antwort auf die Bestellmail des Kunden, PDF anhängen. Textvorschlag:
  > Hallo [Vorname], anbei deine Rechnung RE-[Nummer] zu deiner Bestellung #[Nummer]. Danke für deinen Einkauf! Viele Grüße, Julius von LimitlessPoster
- **Automatisch (wenn es mehr Bestellungen werden):** App „Order Printer Pro: PDF Invoice“, Free-Plan bis 50 Bestellungen im Monat mit automatischem PDF-Versand, Deutsch möglich. Die Vorlage nutzt ebenfalls Liquid, muss aber an deren Variablen angepasst werden. Dann Shopify Order Printer wieder deinstallieren, damit nicht zwei Rechnungen entstehen.

## Rechnungsnummer
- Format `RE-` + Shopify-Bestellnummer (z. B. #1001 → RE-1001). Damit ist jede Nummer einmalig und aufsteigend, so wie das Gesetz es verlangt.
- Lücken (Testbestellungen, Stornos) sind erlaubt. Eine Rechnung, die schon raus ist, nie löschen oder ändern. Bei Storno oder Erstattung: Stornobeleg bzw. Gutschrift mit Verweis auf RE-Nummer (die Vorlage zeigt bei stornierten Bestellungen einen Hinweis und bei Erstattungen den erstatteten Betrag).
- Präfix ändern: in der Vorlage Zeile `lp_re_prefix`. Nur vor der ersten echten Rechnung ändern.

## Datum
- **Rechnungsdatum** = Bestelldatum (Zahlung erfolgt bei der Bestellung). Willst du lieber das Druckdatum: Kommentar oben in der Vorlage befolgen.
- **Liefer-/Leistungsdatum** = Versanddatum von Printify. Erzeugst du die Rechnung vor dem Versand, steht dort „entspricht dem Versanddatum laut Versandbestätigung“. Empfehlung: Rechnung erst nach dem Versand erzeugen.

## Checkliste mit der Testbestellung
- [ ] Logo oben links gut sichtbar (wird schärfer, sobald du das E-Mail-Logo hochgeladen hast)
- [ ] Rechnungsnummer = RE- + Bestellnummer
- [ ] Rechnungsdatum und Bestelldatum stimmen
- [ ] Rechnungs- und Lieferadresse vollständig, Land „Deutschland“
- [ ] Artikel mit Größe in cm und Rahmenfarbe auf Deutsch
- [ ] Versand „kostenlos 0,00 €“
- [ ] Gesamtbetrag = Betrag der Bestellung in Shopify
- [ ] § 19-Hinweis vorhanden, **keine** MwSt-Zeile, **kein** roter Warnkasten
- [ ] Zahlart richtig (bei der Testzahlung steht „Testzahlung (keine echte Zahlung)“)
- [ ] Fußzeile: Name, Anschrift, E-Mail, Website, USt-IdNr.
- [ ] PDF passt auf eine A4-Seite

## Anpassen
Alle festen Angaben (Anschrift, E-Mail, USt-IdNr., Farbe, Logo) stehen gesammelt oben im Block **EINSTELLUNGEN**. Wenn du info@limitlessposter.com eingerichtet hast: `lp_mail` ändern.

## Quellen
- § 19 UStG, § 34a und § 33 UStDV in der Fassung ab 01.01.2025; BMF-Schreiben vom 18.03.2025 zur Kleinunternehmerregelung (umgangssprachlicher Hinweis genügt, Rechnungsnummer und Leistungsdatum nicht Pflicht, keine E-Rechnungspflicht beim Ausstellen): https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Umsatzsteuer/Umsatzsteuer-Anwendungserlass/2025-03-18-sonderregelung-kleinunternehmer.pdf
- Zusammenfassung Haufe: https://www.haufe.de/steuern/finanzverwaltung/bmf-anwendungsschreiben-zur-neuen-kleinunternehmerbesteuerung_164_644410.html
- Shopify Order Printer, Liquid-Variablen: https://help.shopify.com/en/manual/fulfillment/managing-orders/printing-orders/shopify-order-printer/liquid-variables-and-filters-reference
- Shopify Order Printer, App-Seite (kostenlos, kein E-Mail-Versand an Kunden): https://apps.shopify.com/shopify-order-printer
- Order Printer Pro, Preise: https://apps.shopify.com/order-printer-pro

Keine Steuerberatung. Bei Unsicherheit kurz beim Finanzamt Esslingen oder einem Steuerberater nachfragen.
