# Bericht Bereich „Zahlarten“ – 02.10.2026

Auftrag: Datenschutzerklärung und AGB so anpassen, dass sie die Zahlarten beschreiben, die der Checkout **tatsächlich** anbietet. Danach Checkout-Vorlagen und den AGB-Teil der Bestellbestätigung angleichen.

## Kurzfassung

| Was | Ergebnis |
|---|---|
| Angebotene Zahlarten | Kredit-/Debitkarte, PayPal, Klarna, Shop Pay, Google Pay, Apple Pay (Abschnitt 1) |
| Seite `datenschutzerklaerung` | **Geändert:** neuer Abschnitt „b2) Klarna“ in Ziffer 7, Satz in 7 c) angepasst. Rest unverändert, Stand bleibt 2. Oktober 2026. Live geprüft: byte-gleich mit `page-datenschutzerklaerung-nachher.html` (`updatedAt` 2026-10-02T17:14:43Z). |
| Seite `agb` | **Geändert:** nur § 4 (3). Rest unverändert, Stand bleibt 2. Oktober 2026. Live geprüft: byte-gleich mit `page-agb-nachher.html` (`updatedAt` 2026-10-02T17:15:19Z). |
| Checkout-Vorlagen AGB und Datenschutz | Jetzt **byte-gleich** mit den Live-Seiten (vorher nur „bis auf Zeilenumbrüche“). |
| Bestellbestätigungs-Baustein + Vorschau | § 4 (3) angeglichen. § 11 war schon aktuell. AGB-Text § 1–13 im Baustein = Live-Seite (Textvergleich: 0 Abweichungen). Liquid-Test: alle Prüfungen OK. |
| Datenschutz-Bausteine | Baustein A als „eingefügt am 02.10.2026“ markiert, mit der tatsächlich eingefügten Fassung. |
| Checkout-Richtlinien (Einstellungen > Richtlinien) | **Nicht geändert** (kein API-Zugriff vorgesehen). Julius muss sie ersetzen, siehe Abschnitt 6. |

## 1. Welche Zahlarten zeigt der Checkout?

Quellen: die Screenshots aus dem Checkout-Bereich (`arbeit-2026-10-02/checkout/checkout-desktop-1366.png`, `checkout-mobil-iphone13.png`, Entwurfsbestellung, Chromium, de-DE) und die Admin-API (heute gelesen).

| Zahlart | Wo sichtbar | Beleg |
|---|---|---|
| Kreditkarte (Visa, Maestro, Mastercard und 2 weitere) | Zahlungsliste | Screenshot |
| PayPal | Express-Button und Zahlungsliste | Screenshot |
| Klarna | Zahlungsliste (Weiterleitung zu Klarna) | Screenshot |
| Shop Pay | Express-Button, Block „Meine Daten zum schnelleren Bezahlen speichern“ | Screenshot, API `SHOPIFY_PAY` |
| Google Pay | Express-Button | Screenshot, API `GOOGLE_PAY` |
| Apple Pay | nicht im Screenshot (Chromium ist kein Safari) | API `APPLE_PAY` |

API-Ergebnis `shop.paymentSettings.supportedDigitalWallets`: `SHOPIFY_PAY`, `APPLE_PAY`, `GOOGLE_PAY`. `shop.enabledPresentmentCurrencies`: nur `EUR`. `features.paypalExpressSubscriptionGatewayStatus`: `DISABLED` (betrifft nur Abos, unwichtig).

**Klarna-Optionen:** Welche Klarna-Optionen ein Kunde bekommt, entscheidet Klarna nach der Weiterleitung automatisch (z. B. nach Bestellhistorie). Laut Shopify-Hilfe gibt es in Deutschland über Shopify Payments: „Pay in 30 days“ (Zahlung in 30 Tagen, zinslos), „Pay in full“ (sofort per Online-Banking) und „Pay in 3“ (drei zinsfreie Raten). Der Shop ist von 2026, damit gilt die aktuelle (nicht die alte) Klarna-Version.

**Nicht lesbar** (fehlende API-Rechte, im Bericht nur vermerkt):
- `shopifyPaymentsAccount` (aktiviert? Testmodus?): Zugriff verweigert, es fehlt `read_shopify_payments` bzw. `read_shopify_payments_accounts`.
- `paymentCustomizations` (blendet eine Funktion Zahlarten aus?): Zugriff verweigert, es fehlt `read_payment_customizations`.
- `features.usingShopifyBalance`: Zugriff verweigert.
- Ob Klarna über Shopify Payments oder über eine eigene Klarna-App angebunden ist, und welche Klarna-Optionen tatsächlich erscheinen. Der Text passt für beide Anbindungen.

## 2. Datenschutzerklärung – Vorher / Nachher

Nur Ziffer 7 wurde geändert. Nummerierung bleibt (a, b, **b2 neu**, c, d), damit keine Verweise brechen. HTML-Stil wie bei a) und b): `<h3>` + `<p>`, Link mit `rel="noopener"`. Jetzt 17 × `<h2>` (wie vorher) und 6 × `<h3>` (vorher 5).

### Neu: 7 b2) Klarna (zwischen „b) PayPal“ und „c) Betrugsprävention“)

> Wählen Sie im Checkout Klarna, werden Sie zu Klarna weitergeleitet, und wir übermitteln die dafür erforderlichen Daten (z. B. Name, Rechnungs- und Lieferadresse, E-Mail-Adresse, ggf. Telefonnummer, Bestelldaten und Betrag) an die Klarna Bank AB (publ), Sveavägen 46, 111 34 Stockholm, Schweden („Klarna“). Rechtsgrundlage für die Übermittlung ist Art. 6 Abs. 1 lit. b DSGVO. Klarna ist für die Verarbeitung im Rahmen ihrer Zahlungsdienste eigenständig verantwortlich. Welche Klarna-Zahlungsoptionen Ihnen angeboten werden (z. B. sofort bezahlen, Zahlung in 30 Tagen oder in drei Raten), legt Klarna im Einzelfall fest. Insbesondere vor einem Zahlungsaufschub oder einer Ratenzahlung prüft Klarna Ihre Identität und Ihre Kreditwürdigkeit und kann dazu Daten (z. B. Name, Anschrift, Geburtsdatum und Telefonnummer) an Auskunfteien übermitteln; über die Bewilligung entscheidet Klarna automatisiert. Rechtsgrundlagen sind nach Angaben von Klarna Art. 6 Abs. 1 lit. b DSGVO (Vertrag zwischen Ihnen und Klarna), Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Pflichten, z. B. Identitätsprüfung zur Geldwäscheprävention) und Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse von Klarna, insbesondere an der Übermittlung an Auskunfteien und an der Betrugsprävention). Einzelheiten, auch zu den eingesetzten Auskunfteien und zu Ihren Rechten gegenüber Klarna, finden Sie in der [Datenschutzerklärung von Klarna](https://cdn.klarna.com/1.0/shared/content/legal/terms/de-DE/privacy).

So wurde die Fassung gegen die aktuelle Klarna-Quelle geprüft (Klarna-Datenschutzerklärung DE, Version 18.4.0, veröffentlicht am 30.09.2026):

| Angabe | Klarna-Quelle | Änderung zum Entwurf in den Bausteinen |
|---|---|---|
| Klarna Bank AB (publ), Sveavägen 46, 111 34 Stockholm | Abschnitt 1: Klarna ist nach DSGVO verantwortlich | unverändert |
| Kreditwürdigkeitsprüfung beim Checkout | Abschnitt 4.3: „Zur Durchführung einer Kreditwürdigkeitsprüfung beim Checkout …“, Rechtsgrundlage **Art. 6 Abs. 1 b** | Entwurf nannte nur lit. f, jetzt lit. b |
| Übermittlung an Auskunfteien (Name, Adresse, Geburtsdatum, Telefonnummer) | Abschnitt 7.3.1: Rechtsgrundlage **Art. 6 Abs. 1 f**. Auskunfteien laut Klarna: SCHUFA, Creditreform Boniversum, Deutsche Post Direkt, infoscore | ergänzt |
| Identitätsprüfung (Geldwäsche) | **Art. 6 Abs. 1 c** (schwedisches Geldwäschegesetz) | ergänzt |
| Automatisierte Entscheidung | „die Entscheidung zur Freigabe oder Ablehnung des Kredits stellt eine automatisierte Entscheidung dar“ | ergänzt |
| Zahlungsoptionen | Shopify-Hilfe DE: Pay in 30 days, Pay in full, Pay in 3 | Entwurf: „Rechnung, Ratenkauf oder Sofortüberweisung“. Jetzt „sofort bezahlen, Zahlung in 30 Tagen oder in drei Raten“ (über Shopify gibt es keinen klassischen Ratenkauf mit Zinsen) |
| Link | `klarna.com/de/datenschutz` ist nur eine Übersichtsseite. Sie verlinkt selbst auf `cdn.klarna.com/…/de-DE/privacy` | Link geht jetzt direkt auf die vollständige Erklärung |

### Geändert: 7 c) Betrugsprävention, erster Satz

- **Vorher:** „Wir selbst führen keine Bonitätsprüfung durch und bieten keinen Kauf auf Rechnung an.“
- **Nachher:** „Wir selbst führen keine Bonitätsprüfung durch und gewähren keinen Zahlungsaufschub; eine Zahlung auf Rechnung oder in Raten bietet, soweit verfügbar, allein der jeweilige Zahlungsdienstleister (insbesondere Klarna, siehe b2) in eigener Verantwortung an.“
- Warum: Der alte Satz war falsch, weil Klarna „in 30 Tagen bezahlen“ anbietet. Die neue Formulierung bleibt auch richtig, falls PayPal „Später bezahlen“ zeigt.

### Unverändert geprüft

- 7 a) nennt Karten, Apple Pay, Google Pay, Shop Pay. Das passt zum Checkout.
- 7 b) PayPal passt.
- Ziffer 12 (Drittländer): Klarna sitzt in Schweden (EU), deshalb keine Änderung nötig.
- Stand-Datum „2. Oktober 2026“ bleibt.
- Andere Seiten: Die FAQ sagt nur „die verfügbaren Optionen siehst du im Checkout“, das ist kein Widerspruch.

## 3. AGB § 4 (3) – Vorher / Nachher

- **Vorher:** „(3) Die Zahlung erfolgt über die im Checkout angebotenen Zahlungsarten (derzeit u. a. PayPal). Ihr Konto bzw. Zahlungsmittel wird mit Abschluss der Bestellung belastet.“
- **Nachher:** „(3) Die verfügbaren Zahlungsarten werden Ihnen im Checkout angezeigt. Derzeit bieten wir insbesondere Kredit- und Debitkarten, Apple Pay, Google Pay, Shop Pay, PayPal und Klarna an; welche davon Ihnen im Einzelfall angezeigt werden, kann z. B. vom Gerät, vom Browser oder von Prüfungen des Zahlungsdienstleisters abhängen. Bei Zahlung per Karte, Apple Pay, Google Pay, Shop Pay oder PayPal wird Ihr Zahlungsmittel bzw. Konto mit Abschluss der Bestellung belastet. Wählen Sie Klarna, werden Sie zu Klarna weitergeleitet; dort zeigt Klarna Ihnen die für Sie verfügbaren Zahlungsoptionen an, und es gelten die dort angegebenen Zahlungsfristen sowie ergänzend die Bedingungen von Klarna.“

Entscheidungen:
- **„Derzeit insbesondere …“ und „werden im Checkout angezeigt“**: Fällt eine Zahlart weg oder kommt eine hinzu, ist der Satz nicht sofort falsch. Der Hinweis auf Gerät/Browser erklärt, warum z. B. Apple Pay nur in Safari erscheint.
- **Klarna-Rechnung und Ratenkauf werden in den AGB nicht genannt.** Ob ein Kunde „in 30 Tagen“ oder „in 3 Raten“ bekommt, entscheidet Klarna im Einzelfall, und aus dem Admin ist es nicht lesbar. Die AGB sagen deshalb nur, dass Klarna die verfügbaren Optionen anzeigt und dass deren Fristen gelten.
- **Der alte zweite Satz „wird mit Abschluss der Bestellung belastet“** wäre bei Klarna-Zahlung in 30 Tagen falsch gewesen. Er gilt jetzt nur noch für Karte, Wallets und PayPal.
- Sonst ist an der AGB nichts geändert: 13 × `<h2>`, alle anderen Absätze byte-gleich zum Vorher-Stand.

## 4. Vorlagen und Bausteine

| Datei | Änderung | Prüfung |
|---|---|---|
| `obsidian/LimitlessPoster/vorlagen/Checkout-Richtlinie Datenschutz (neu).html` | = neuer Seiteninhalt | byte-gleich mit Live-Seite |
| `obsidian/LimitlessPoster/vorlagen/Checkout-Richtlinie AGB (neu, DE-only).html` | = neuer Seiteninhalt | byte-gleich mit Live-Seite |
| `obsidian/LimitlessPoster/vorlagen/Bestellbestätigung Zusatzbaustein (§ 19, Lieferzeit, Widerruf, AGB).liquid` | § 4 (3) ersetzt. § 11 war schon auf Live-Stand (Abs. 1 „Soweit … Urheber- oder Leistungsschutzrechte bestehen“, Abs. 3 ohne „private Nutzung“) | AGB-Text § 1–13 nach dem Rendern = Live-Seite (0 Abweichungen) |
| `shop-checkliste/arbeit-2026-10-02/admin/vorschau/bestellbestaetigung-baustein.html` | § 4 (3) ersetzt | byte-gleich mit neuem Rendering durch `test_vorlagen.rb` |
| `obsidian/LimitlessPoster/vorlagen/Datenschutz-Bausteine (optional).md` | Baustein A „eingefügt am 02.10.2026“, mit eingefügter Fassung, Quellen und Rückbau-Hinweis | – |

Test: Ich habe `ruby test_vorlagen.rb` in einer Kopie im Arbeitsordner laufen lassen, damit die Rechnungs-Vorschauen des Admin-Bereichs nicht überschrieben werden. Ergebnis: **ALLE PRÜFUNGEN OK**. Die 4 Rechnungs-Vorschauen wären unverändert geblieben.

Hinweis für den Admin-Bereich (keine Änderung nötig): Die Rechnungsvorlage kennt keinen eigenen Namen für Klarna und zeigt dann den Shopify-Namen der Zahlungsart, voraussichtlich „Klarna“. Das passt.

## 5. Gegenprüfung nach dem Schreiben

- `pageUpdate` für beide Seiten: `userErrors` leer.
- Danach alle Seiten und Richtlinien neu gelesen (als Datei, per Python verglichen):
  - `datenschutzerklaerung` und `agb` sind byte-gleich mit den Nachher-Dateien.
  - Die 10 anderen Seiten haben unveränderten Inhalt und unverändertes `updatedAt`.
  - Die 6 Checkout-Richtlinien sind unverändert.
- Vor dem Schreiben waren die Live-Seiten byte-gleich mit `arbeit-2026-10-02/recht/page-*-nachher.html`. Es gab also keine fremde Zwischenänderung.

## 6. Was Julius tun muss

1. **Checkout-Richtlinien ersetzen (vor dem Start, wichtig):** Der Checkout verlinkt die Richtlinien unter Einstellungen > Richtlinien. Dort stehen noch die alten Fassungen vom 25.08.2026: Datenschutz mit „Klarna über Shopify Payments“ nur als Möglichkeit, AGB mit EU-Versand und „derzeit u. a. PayPal“.
   - Öffnen: https://admin.shopify.com/store/gexdm4-2q/settings/legal
   - „Datenschutzerklärung“ > `<>` > alles markieren und löschen > Inhalt von `obsidian/LimitlessPoster/vorlagen/Checkout-Richtlinie Datenschutz (neu).html` einfügen > **Speichern**. Falls angeboten: automatische Verwaltung durch Shopify **aus**.
   - „Allgemeine Geschäftsbedingungen“: genauso mit `Checkout-Richtlinie AGB (neu, DE-only).html`.
   - Prüfen: In der Datenschutz-Vorschau steht „b2) Klarna“, in der AGB-Vorschau § 4 (3) „… PayPal und Klarna an“.
2. **Erst danach** den Bestellbestätigungs-Baustein einfügen (Anleitung im Admin-Bericht). Sonst bekommen Kunden per Mail andere AGB als im Checkout.
3. **Zahlungseinstellungen kurz ansehen:** https://admin.shopify.com/store/gexdm4-2q/settings/payments
   - Ist Shopify Payments aktiv und nicht im Testmodus?
   - Klarna: Soll es bleiben? Wenn ja, ist alles erledigt. Wenn **nein**: Klarna ausschalten und Bescheid geben. Dann müssen „b2) Klarna“, der Halbsatz in 7 c) und „und Klarna“ / „Wählen Sie Klarna …“ in AGB § 4 (3) wieder raus (Rückbau-Hinweis in der Bausteine-Datei).
   - Kommt eine neue Zahlart dazu (z. B. Vorkasse, EPS, iDEAL): Die AGB bleiben durch „insbesondere“ richtig. Die Datenschutzerklärung braucht dann evtl. einen eigenen Absatz.
4. **Bei der Testbestellung** einmal Klarna anklicken, bis zur Klarna-Seite gehen, ohne abzuschließen, und notieren, welche Optionen Klarna zeigt (sofort / 30 Tage / 3 Raten). Die Texte passen für jede Kombination.

## 7. Dateien

- **Backups (Vorher):** `shop-checkliste/backup-2026-10-02/zahlarten/`
  - `page-agb-vorher.html`, `page-datenschutzerklaerung-vorher.html` (live gelesen vor dem Schreiben)
  - `vorlage-checkout-agb-vorher.html`, `vorlage-checkout-datenschutz-vorher.html`
  - `bestellbestaetigung-baustein-vorher.liquid`, `vorschau-bestellbestaetigung-baustein-vorher.html`
  - `datenschutz-bausteine-vorher.md`
  - `checkout-richtlinien-stand-nur-lesen.json` (nur zur Dokumentation, nicht geändert)
- **Nachher:** `shop-checkliste/arbeit-2026-10-02/zahlarten/`
  - `page-agb-nachher.html`, `page-datenschutzerklaerung-nachher.html` (= live)
  - `datenschutz-klarna-b2.html` (nur der neue Abschnitt)
  - `agb-par4-abs3-nachher.txt` (nur der neue Absatz)
- **Hinweis:** `arbeit-2026-10-02/recht/page-agb-nachher.html` und `page-datenschutzerklaerung-nachher.html` zeigen jetzt den Stand **vor** dieser Runde. Aktuell sind die Dateien in `arbeit-2026-10-02/zahlarten/`.
- **Rückbau:** Inhalt von `backup-2026-10-02/zahlarten/page-*-vorher.html` per `pageUpdate` (body) zurückschreiben. Die Vorlagen und Bausteine aus demselben Ordner zurückkopieren.

## 8. Quellen (abgerufen am 02.10.2026)

- Klarna-Datenschutzerklärung DE, v18.4.0 vom 30.09.2026: https://cdn.klarna.com/1.0/shared/content/legal/terms/de-DE/privacy (gleicher Inhalt wie `…/terms/0/de_de/privacy`; verlinkt von https://www.klarna.com/de/datenschutz/)
- Klarna-Auskunfteien Deutschland: https://cdn.klarna.com/1.0/shared/content/legal/terms/0/de_de/credit_rating_agencies
- Shopify-Hilfe, Klarna mit Shopify Payments in Österreich, Deutschland und Schweden: https://help.shopify.com/de/manual/payments/shopify-payments/local-payment-methods/klarna/klarna-shopify-payments-austria-germany-sweden (Optionen Pay in 30 days / Pay in full / Pay in 3, Auswahl automatisch durch Klarna, nur bei Checkout mit E-Mail-Adresse)
- Klarna-Doku „Klarna for Shopify Payments“: https://docs.klarna.com/platform/shopify/payments/klarna-for-shopify-payments/ (Händler kann die Klarna-Optionen nicht selbst auswählen)
- Shopify Changelog „Klarna Pay Later is available on Shopify Payments“: https://changelog.shopify.com/posts/klarna-pay-later-is-available-on-shopify-payments
