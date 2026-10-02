# Datenschutz-Bausteine (optional)

Stand: 2. Oktober 2026. Diese Bausteine sind **noch nicht** in der Datenschutzerklärung, weil die Dienste (noch) nicht genutzt werden. Erst einfügen, wenn der Dienst wirklich aktiv ist.

**Einfügen:** Shopify Admin > Onlineshop > Seiten > „Datenschutzerklärung“ > Inhalt mit dem Symbol `<>` (HTML) öffnen > Baustein an der genannten Stelle einfügen > Datum in „Stand: …“ anpassen > Speichern. Danach dieselbe Änderung in der Checkout-Richtlinie machen (Einstellungen > Richtlinien > Datenschutzerklärung).

---

## Baustein A: Klarna (nur wenn Klarna im Checkout aktiv ist)

Einfügen in Ziffer 7, direkt **nach** dem Abschnitt „b) PayPal“ (vor „c) Betrugsprävention“). Danach in „c)“ den Satz „…und bieten keinen Kauf auf Rechnung an“ ändern zu „…; Rechnungs- und Ratenkauf bietet ausschließlich Klarna in eigener Verantwortung an“.

```html
<h3>b2) Klarna</h3><p>Wählen Sie eine Zahlungsart von Klarna (z. B. Rechnung, Ratenkauf oder Sofortüberweisung), übermitteln wir die dafür erforderlichen Daten (z. B. Name, Rechnungs- und Lieferadresse, E-Mail-Adresse, Telefonnummer, Bestelldaten, Betrag) an die Klarna Bank AB (publ), Sveavägen 46, 111 34 Stockholm, Schweden („Klarna“). Klarna ist für diese Verarbeitung eigenständig verantwortlich. Rechtsgrundlage für die Übermittlung ist Art. 6 Abs. 1 lit. b DSGVO. Für Rechnungs- und Ratenkauf führt Klarna eine Identitäts- und Bonitätsprüfung durch und kann dazu Daten an Auskunfteien übermitteln; Rechtsgrundlage ist das berechtigte Interesse von Klarna an der Vermeidung von Zahlungsausfällen (Art. 6 Abs. 1 lit. f DSGVO). Einzelheiten finden Sie in der Datenschutzerklärung von Klarna: <a href="https://www.klarna.com/de/datenschutz/" rel="noopener">klarna.com/de/datenschutz</a>.</p>
```

Quelle Firmenname/Adresse: Klarna-Datenschutzerklärung DE (cdn.klarna.com/1.0/shared/content/legal/terms/0/de/privacy) und Klarna-Impressum (klarna.com/de/impressum). Vor dem Einfügen kurz prüfen, ob Klarna in Deutschland über Shopify Payments oder über die Klarna-App angebunden ist; der Text passt für beide Wege.

---

## Baustein B: Bewertungs-App Judge.me (nur wenn installiert)

Einfügen als **eigene Ziffer nach „10. Newsletter“**. Die folgenden Ziffern verschieben sich dann um eins (11 → 12 usw.); Verweise im Text („siehe Ziffer 13“ in 7 d) entsprechend auf „Ziffer 14“ ändern.

```html
<h2>11. Produktbewertungen (Judge.me)</h2><p>Für Produktbewertungen nutzen wir die App Judge.me der Judge.me Ltd, C/O Buckworths, 2nd Floor, 1-3 Worship Street, London, EC2A 2AB, Vereinigtes Königreich. Judge.me verarbeitet die Daten in unserem Auftrag (Art. 28 DSGVO).</p><p><strong>Bewertungsanfrage per E-Mail:</strong> Nach dem Kauf bitten wir Sie per E-Mail um eine Bewertung, wenn Sie dem im Checkout zugestimmt haben (Art. 6 Abs. 1 lit. a DSGVO, § 7 Abs. 2 UWG). Dafür verwenden wir Ihren Namen, Ihre E-Mail-Adresse und die gekauften Produkte. Sie können Ihre Einwilligung jederzeit widerrufen, z. B. über den Abmeldelink in jeder E-Mail.</p><p><strong>Veröffentlichung:</strong> Wenn Sie eine Bewertung abgeben, verarbeiten wir die Sterne-Bewertung, Ihren Text, ggf. Fotos, Ihren Namen in der von Ihnen gewählten Form sowie das Datum und veröffentlichen sie in unserem Shop (Art. 6 Abs. 1 lit. a DSGVO). Sie können die Löschung Ihrer Bewertung jederzeit per E-Mail an uns verlangen.</p><p><strong>Anzeige im Shop:</strong> Beim Laden der Bewertungen werden technisch erforderliche Daten (z. B. IP-Adresse) an Server von Judge.me übermittelt (Art. 6 Abs. 1 lit. f DSGVO; berechtigtes Interesse an der Darstellung von Kundenbewertungen).</p><p><strong>Drittländer:</strong> Für das Vereinigte Königreich besteht ein Angemessenheitsbeschluss der EU-Kommission. Soweit Judge.me Unterauftragsverarbeiter in den USA einsetzt, erfolgt die Übermittlung auf Grundlage der EU-Standardvertragsklauseln, die Bestandteil des Auftragsverarbeitungsvertrags von Judge.me sind.</p><p><strong>Speicherdauer:</strong> Bewertungen bleiben veröffentlicht, bis Sie die Löschung verlangen oder wir die Bewertung entfernen. Daten für Bewertungsanfragen löschen wir, sobald die Anfrage abgeschlossen ist oder Sie widersprechen.</p>
```

Quellen: Companies House, JUDGE.ME LTD, Nr. 12157706 (eingetragene Anschrift); Judge.me Hilfe-Artikel „GDPR compliance“ (Rolle als Auftragsverarbeiter, DPA mit EU-Standardvertragsklauseln). Vor dem Einfügen in der App prüfen:

- Bewertungsanfragen nur an Kunden mit Einwilligung senden (in Judge.me: E-Mail-Einstellungen, Option „nur an Kunden mit Marketing-Zustimmung“ bzw. eigene Checkbox). Ohne Einwilligung gelten Bewertungsanfragen in Deutschland als Werbung (BGH, Urteil vom 10.07.2018, VI ZR 225/17).
- Auftragsverarbeitungsvertrag (DPA) von Judge.me im App-Dashboard akzeptieren und als PDF ablegen.
- Wenn Judge.me Cookies oder Tracking setzt, die nicht technisch nötig sind: Einwilligung über den Cookie-Banner einholen und den Abschnitt „Anzeige im Shop“ anpassen.

---

## Baustein C: E-Mail-Postfach bei Zoho Mail (nur wenn „Weg B“ aus der E-Mail-Anleitung umgesetzt ist)

Einfügen in **Ziffer 9 „Kontaktaufnahme“** als zusätzlicher Absatz am Ende. Vorher im Zoho-Konto den Auftragsverarbeitungsvertrag (Data Processing Addendum) abschließen und als PDF ablegen.

```html
<p>Für unser E-Mail-Postfach nutzen wir Zoho Mail der Zoho Corporation B.V., Beneluxlaan 4B, 3527 HT Utrecht, Niederlande, mit Datenspeicherung in einem Rechenzentrum in der EU. Zoho verarbeitet die E-Mails in unserem Auftrag (Art. 28 DSGVO). Soweit Konzerngesellschaften von Zoho außerhalb des EWR (z. B. für Support) Zugriff erhalten, erfolgt dies auf Grundlage der EU-Standardvertragsklauseln.</p>
```

Hinweis zu Gmail: Solange Kundenmails in einem kostenlosen Gmail-Konto landen (auch über die Shopify-Weiterleitung, „Weg A“), gibt es mit Google keinen Auftragsverarbeitungsvertrag. Das ist bei vielen kleinen Shops üblich, aber nicht ideal. Sauber wird es mit Zoho Mail (Baustein C) oder Google Workspace (dann Baustein sinngemäß mit „Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland“).

Quelle: Zoho-Datenschutzkontakt (Zoho Corporation B.V., Attn: Data Protection, Beneluxlaan 4B, 3527 HT Utrecht), abgerufen am 02.10.2026.
