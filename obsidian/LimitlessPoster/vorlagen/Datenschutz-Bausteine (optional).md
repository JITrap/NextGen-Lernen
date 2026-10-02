# Datenschutz-Bausteine (optional)

Stand: 2. Oktober 2026. **Baustein A (Klarna) ist eingefügt am 02.10.2026** (Seite `datenschutzerklaerung`, Ziffer 7 b2). Die Bausteine B und C sind **noch nicht** in der Datenschutzerklärung, weil die Dienste (noch) nicht genutzt werden. Erst einfügen, wenn der Dienst wirklich aktiv ist.

**Einfügen:** Shopify Admin > Onlineshop > Seiten > „Datenschutzerklärung“ > Inhalt mit dem Symbol `<>` (HTML) öffnen > Baustein an der genannten Stelle einfügen > Datum in „Stand: …“ anpassen > Speichern. Danach dieselbe Änderung in der Checkout-Richtlinie machen (Einstellungen > Richtlinien > Datenschutzerklärung).

---

## Baustein A: Klarna – eingefügt am 02.10.2026

**Status:** Am 02.10.2026 in die Seite `datenschutzerklaerung` eingefügt (Ziffer 7, als „b2) Klarna“ zwischen „b) PayPal“ und „c) Betrugsprävention“), weil Klarna im Checkout sichtbar ist. Gleichzeitig wurde in „c)“ der Satz „…und bieten keinen Kauf auf Rechnung an“ ersetzt durch „…und gewähren keinen Zahlungsaufschub; eine Zahlung auf Rechnung oder in Raten bietet, soweit verfügbar, allein der jeweilige Zahlungsdienstleister (insbesondere Klarna, siehe b2) in eigener Verantwortung an“. Die Checkout-Vorlage `Checkout-Richtlinie Datenschutz (neu).html` enthält denselben Text. **Offen:** Julius muss die Checkout-Richtlinie Datenschutz noch per Hand ersetzen (Einstellungen > Richtlinien).

Eingefügt wurde diese gegen die Klarna-Datenschutzerklärung (Version 18.4.0, veröffentlicht am 30.09.2026) geprüfte Fassung. Gegenüber dem ersten Entwurf geändert: Zahlungsoptionen laut Shopify-Hilfe für Deutschland (sofort bezahlen, in 30 Tagen, in drei Raten; Auswahl trifft Klarna), Rechtsgrundlagen so, wie Klarna sie nennt (lit. b Vertrag, lit. c Geldwäscheprävention, lit. f Auskunfteien und Betrugsprävention), automatisierte Entscheidung erwähnt, Link direkt auf die vollständige Erklärung statt auf die Übersichtsseite klarna.com/de/datenschutz.

```html
<h3>b2) Klarna</h3><p>Wählen Sie im Checkout Klarna, werden Sie zu Klarna weitergeleitet, und wir übermitteln die dafür erforderlichen Daten (z. B. Name, Rechnungs- und Lieferadresse, E-Mail-Adresse, ggf. Telefonnummer, Bestelldaten und Betrag) an die Klarna Bank AB (publ), Sveavägen 46, 111 34 Stockholm, Schweden („Klarna“). Rechtsgrundlage für die Übermittlung ist Art. 6 Abs. 1 lit. b DSGVO. Klarna ist für die Verarbeitung im Rahmen ihrer Zahlungsdienste eigenständig verantwortlich. Welche Klarna-Zahlungsoptionen Ihnen angeboten werden (z. B. sofort bezahlen, Zahlung in 30 Tagen oder in drei Raten), legt Klarna im Einzelfall fest. Insbesondere vor einem Zahlungsaufschub oder einer Ratenzahlung prüft Klarna Ihre Identität und Ihre Kreditwürdigkeit und kann dazu Daten (z. B. Name, Anschrift, Geburtsdatum und Telefonnummer) an Auskunfteien übermitteln; über die Bewilligung entscheidet Klarna automatisiert. Rechtsgrundlagen sind nach Angaben von Klarna Art. 6 Abs. 1 lit. b DSGVO (Vertrag zwischen Ihnen und Klarna), Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Pflichten, z. B. Identitätsprüfung zur Geldwäscheprävention) und Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse von Klarna, insbesondere an der Übermittlung an Auskunfteien und an der Betrugsprävention). Einzelheiten, auch zu den eingesetzten Auskunfteien und zu Ihren Rechten gegenüber Klarna, finden Sie in der <a href="https://cdn.klarna.com/1.0/shared/content/legal/terms/de-DE/privacy" rel="noopener">Datenschutzerklärung von Klarna</a>.</p>
```

Quellen (abgerufen am 02.10.2026): Klarna-Datenschutzerklärung DE https://cdn.klarna.com/1.0/shared/content/legal/terms/de-DE/privacy (Abschnitt 1 Verantwortlicher Klarna Bank AB (publ), Sveavägen 46, 111 34 Stockholm; Abschnitt 4.3 Kreditwürdigkeitsprüfung, Art. 6 Abs. 1 lit. b; Abschnitt 7.3.1 Auskunfteien, Art. 6 Abs. 1 lit. f; Geldwäsche Art. 6 Abs. 1 lit. c), Klarna-Auskunfteien DE https://cdn.klarna.com/1.0/shared/content/legal/terms/0/de_de/credit_rating_agencies (SCHUFA, Creditreform Boniversum, Deutsche Post Direkt, infoscore), Shopify-Hilfe Klarna in Deutschland https://help.shopify.com/de/manual/payments/shopify-payments/local-payment-methods/klarna/klarna-shopify-payments-austria-germany-sweden (Pay in 30 days, Pay in full, Pay in 3; Optionen bestimmt Klarna automatisch).

Wenn Klarna später **ausgeschaltet** wird: Abschnitt „b2) Klarna“ wieder entfernen, in „c)“ den Halbsatz zu Rechnung/Raten streichen und in den AGB § 4 (3) „und Klarna“ sowie den Satz „Wählen Sie Klarna …“ entfernen (Seite, Checkout-Vorlagen und Bestellbestätigungs-Baustein).

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
