# Bericht Bereich „Admin“ – 02.10.2026

Auftrag: Alles vorbereiten, was nur im Admin oder per App geht (E-Mail-Absender, Benachrichtigungs-Mails, Rechnungen, Bewertungs-App), sodass Julius nur noch klicken und einfügen muss.
**Im Shop wurde nichts geändert** (nur Lesezugriffe). Deshalb gibt es keinen Vorher-Stand zum Sichern. Der gelesene Ist-Stand steht unten.

## Kurzfassung

| Thema | Ergebnis | Was Julius tun muss | Datei |
|---|---|---|---|
| E-Mail-Absender | Domain ist bei Shopify gekauft und wird dort verwaltet, also gibt es die **kostenlose Shopify-Weiterleitung**. Heute: kein MX, kein SPF, kein DKIM, DMARC `p=none` vorhanden. Absender ist Gmail, das schreibt Shopify auf shopifyemail.com um. | Weiterleitung info@ → Gmail anlegen, Absender umstellen, automatisch authentifizieren (≈ 15 Min) | `obsidian/LimitlessPoster/vorlagen/Anleitung E-Mail-Absender info@limitlessposter.com.md` |
| Benachrichtigungs-Mails | Shop nur Deutsch, Mails also deutsch. Logo und Farbe aus OFE v3 ausgelesen, Logo für Mails zugeschnitten. Fertiger Baustein für die Bestellbestätigung (§ 19, Lieferzeit, Kontakt, **Widerrufsbelehrung + Formular, AGB im Wortlaut**). | Logo hochladen, Breite 240, Farbe #8B1E2D, Baustein einfügen, Vorlagen per Test-Mail prüfen, Double-Opt-in an (≈ 30 Min) | `…/vorlagen/Anleitung Benachrichtigungs-Mails (Deutsch + Branding).md`, `…/vorlagen/Bestellbestätigung Zusatzbaustein (§ 19, Lieferzeit, Widerruf, AGB).liquid`, `…/vorlagen/Logo E-Mail und Rechnung (zugeschnitten, 960px).png` |
| Rechnung § 19 | Vollständige Rechnungsvorlage für **Shopify Order Printer** (die alte App „Order Printer“ gibt es nicht mehr). Mit der Shopify-Liquid-Referenz (Ruby-Gem `liquid` 5.14, strict) an 3 Beispielbestellungen getestet: alle Prüfungen OK. | App installieren, Vorlage einfügen, mit Testbestellung prüfen (≈ 10 Min) | `…/vorlagen/Order Printer Rechnung (§ 19).liquid`, `…/vorlagen/Anleitung Rechnungen mit Order Printer (§ 19).md`, Beispiel-PDF `vorschau/rechnung-beispiel-1002.pdf` |
| Bewertungs-App | Sternify ist **keine** Bewertungs-App (Abschnitte/Bundles, ab 29,50 $/Monat). In keinem Theme eingebunden, nur Metafeld `sternify.onboarding_completed` übrig. Empfehlung **Judge.me Forever Free**. | Sternify ggf. deinstallieren, Judge.me installieren und nach Anleitung einstellen (≈ 30 Min) | `…/vorlagen/Anleitung Bewertungen mit Judge.me.md` |

## Ist-Stand (gelesen am 02.10.2026)

**Shop (GraphQL):** E-Mail und Kontakt-E-Mail `limitless.posterje@gmail.com`, Primärdomain `limitlessposter.com` (SSL an), Bestellnummer-Format `#` + Zahl, Kundenkonten optional, Steuern nicht im Preis, Plan Basic, einzige Sprache `de`. Geldformat `€{{amount_with_comma_separator}}` (auch in Mails). Wallets laut API: Shop Pay, Apple Pay, Google Pay.

**Domain/DNS (dns.google, RDAP):**

| Eintrag | Wert |
|---|---|
| Registrar | Tucows Domains Inc. (Shopify-Domain), registriert 14.06.2026, Ablauf 14.06.2027 |
| NS | ns-cloud-c1…c4.googledomains.com (Shopify-DNS; SOA cloud-dns-hostmaster.google.com) |
| A `@` | 23.227.38.65 (Shopify) |
| CNAME `www` | shops.myshopify.com |
| MX | keiner |
| TXT `@` (SPF) | keiner |
| TXT `_dmarc` | `v=DMARC1; p=none` |
| DKIM | keiner gefunden |

**Apps:** `appInstallations` per API → „access denied“. Installierte Apps sind nicht lesbar.
**Themes:** App-Embeds in `config/settings_data.json`: OFE v3 und Live nur „Shopify Forms“. In den 19 Vorlagen/Gruppen von OFE v3 und 16 von Live kein Sternify- und kein Judge.me-Block. OFE v3 ist Horizon-basiert (`blocks/_product-card.liquid`); Produktkarten stecken in collection, collection.queens, index (2×), search, product, cart, 404.
**Shop-Metafelder:** nur `sternify.onboarding_completed = true`.
**Logo (OFE v3 und Live):** dieselbe Datei aus den Shop-Bildern (Einstellung `logo`, URL als Ersatzwert in der Rechnungsvorlage; 1211 × 808, transparent, Schriftzug nur im mittleren Streifen 1167 × 204). Daraus zugeschnittene Fassung 960 × 184 für Mails und Rechnung.
**Farben OFE v3:** Hintergrund `#141215`, Buttons/Text hell `#F4F1EA`, Markenrot `#8B1E2D` (Farbschema 4, Sale-Badge), Hover-Rot `#A32235`, Grau `#55575C`.
**Ansprache:** Shop-Seiten und Checkout duzen, Rechtstexte siezen.

## Entscheidungen (begründet)
1. **E-Mail: Shopify-Weiterleitung statt Zoho Free.** Kostet nichts, keine DNS-Handarbeit, weil Shopify das DNS verwaltet. Zoho Free hat kein IMAP/SMTP und bringt deshalb beim Antworten keinen Vorteil. Wer als info@ antworten will: Zoho Mail Lite (≈ 1 €/Monat) als Weg B in der Anleitung.
2. **DMARC bleibt vorerst `p=none`.** Das reicht für Gmail/Yahoo. Verschärfen auf `p=quarantine` erst nach 4 Wochen sauberer DKIM-Ergebnisse. Ohne `rua=`, damit keine XML-Berichte das Postfach fluten.
3. **E-Mail-Akzentfarbe #8B1E2D** (Markenrot, Kontrast zu Weiß ≈ 9 : 1), Logo-Breite 240 px.
4. **Bestellbestätigung enthält Widerrufsbelehrung, Muster-Formular und AGB im Wortlaut.** § 312f Abs. 2 BGB verlangt die Vertragsbestätigung samt Pflichtinfos auf einem dauerhaften Datenträger, ein Link reicht nicht. Printify legt nichts Gedrucktes bei, also ist die Mail der einzige Weg. AGB-Text = Stand 2. Oktober 2026 aus dem Recht-Bereich (`arbeit-2026-10-02/recht/page-agb-nachher.html`), Widerrufsbelehrung = aktuelle Checkout-Richtlinie „Widerrufsrecht“.
5. **Rechnung:** Nummer `RE-` + Bestellnummer (einmalig, aufsteigend, Lücken erlaubt). Rechnungsdatum = Datum der ersten Sendung, vor dem Versand Bestelldatum (geändert in der Gegenprüfung), Leistungsdatum = Versanddatum. Hinweistext „Steuerfreie Kleinunternehmerleistung gemäß § 19 UStG. Es wird keine Umsatzsteuer berechnet und ausgewiesen.“ (passt zur neuen Fassung seit 2025, laut BMF genügt umgangssprachlich). Versandzeile wird aus dem Gesamtbetrag zurückgerechnet, damit die Summe immer stimmt. Englische Werte (Size/Color/Black/White/Standard Delivery/Germany) werden übersetzt. Roter Warnkasten, falls Shopify je Steuern berechnet (§ 14c UStG). Logo: E-Mail-Logo, sonst Schriftzug als Text (geändert in der Gegenprüfung).
6. **Bewertungen: Judge.me Free, Anfragen nur an Kunden mit Marketing-Zustimmung** (BGH VI ZR 225/17). Alle Sterne veröffentlichen, keine Gegenleistungen, UWG-Hinweistext mitgeliefert. Widgets in OFE v3 statt Live.

## Test der Liquid-Vorlagen
`ruby shop-checkliste/arbeit-2026-10-02/admin/test_vorlagen.rb` (Shopify-Liquid 5.14, strict parsing, strikte Filter)
- Rechnung: 3 Beispielbestellungen (seit der Gegenprüfung 4, siehe unten) (PayPal + Gratisversand; 2 Artikel + Rabattcode + versendet + Karte; Fehlerfall ohne Rechnungsadresse, storniert, mit Steuer). Geprüft: keine Liquid-Reste, Rechnungsnummer, § 19-Hinweis, USt-IdNr., Gesamtbetrag stimmt, kein MwSt-Ausweis, nichts Englisches, Versand „kostenlos 0,00 €“, Warnkasten im Fehlerfall. **Alle OK.**
- Baustein Bestellbestätigung: keine Liquid-Reste, § 19, Lieferzeit 4–10 Werktage, Widerrufsbelehrung + Formular, AGB § 1–13, Kontakt, keine EU-Lieferung. **Alle OK.**
- Vorschauen: `shop-checkliste/arbeit-2026-10-02/admin/vorschau/` (HTML je Fall, PDF der Beispielrechnung).
- Grenze des Tests: Echte Shopify-Felder können leicht abweichen (z. B. `gateway_display_name`). Die Vorlage fällt dann auf Ersatzwerte zurück. Die finale Prüfung macht Julius mit der Testbestellung (Checkliste in der Anleitung).

## Klickanleitungen (Reihenfolge)
1. **E-Mail-Weiterleitung + Absender** – https://admin.shopify.com/store/gexdm4-2q/settings/domains und https://admin.shopify.com/store/gexdm4-2q/settings/notifications (Details: Anleitung E-Mail-Absender, Schritte 1–5)
2. **Logo/Farbe in Mails** – https://admin.shopify.com/store/gexdm4-2q/settings/notifications/customer > „E-Mail-Vorlagen anpassen“ > Logo-Datei aus vorlagen/, Breite 240, Akzentfarbe `#8B1E2D`
3. **Bestellbestätigung** – erst wenn die Checkout-AGB unter https://admin.shopify.com/store/gexdm4-2q/settings/legal auf Stand 2. Oktober 2026 ist (Recht-Bericht): Kundenbenachrichtigungen > Bestellbestätigung > Code bearbeiten > Baustein vor `<table class="row footer">` einfügen > Test-E-Mail
4. **Double-Opt-in** – Kundenbenachrichtigungen > Marketing-Double-Opt-in > „Bestätigung des Kunden-Marketings“ an
5. **Checkout-Marketing-Häkchen nicht vorauswählen** – https://admin.shopify.com/store/gexdm4-2q/settings/checkout > Marketingoptionen (Befund auch im Checkout-Bericht)
6. **Order Printer** – https://apps.shopify.com/shopify-order-printer > Installieren > Apps > Order Printer > Templates > Create a template > Code einfügen > Preview mit Testbestellung > Save
7. **Sternify prüfen** – https://admin.shopify.com/store/gexdm4-2q/settings/apps > wenn vorhanden: deinstallieren
8. **Judge.me** – https://apps.shopify.com/judgeme > Forever Free > Einstellungen laut Anleitung > Widgets in OFE v3: https://admin.shopify.com/store/gexdm4-2q/themes/194580283725/editor
9. Optional: **Geldformat „81,99 €“** – https://admin.shopify.com/store/gexdm4-2q/settings/general > Währungsformatierung (Werte in der Benachrichtigungs-Anleitung, Punkt 5)
10. Nach erfolgreichem Weiterleitungs-Test: info@ in Rechtstexten, Rechnungsvorlage (`lp_mail`) und Baustein (`lp_mail`) eintragen.

## Offene Punkte
- **Versandart heißt „Standard Delivery“** (englischer Name aus Printifys Versandprofilen). Erscheint in Checkout und Mails. In der Rechnung übersetzt die Vorlage es, in Shopify-Mails nicht. Lösung über Printify-Versandprofil-Namen oder Checkout-Übersetzung klären.
- **Rechnungen per Mail:** Shopify Order Printer kann nicht automatisch versenden. Ab vielen Bestellungen: Order Printer Pro (Free bis 50 Bestellungen/Monat), dann Vorlage anpassen.
- **Bestellbestätigung pflegen:** Bei jeder Änderung von AGB oder Widerrufsbelehrung den Baustein mitändern (Teil B/C).
- **Repo ist öffentlich:** In `obsidian/LimitlessPoster/LimitlessPoster – Shop-Stammdaten.md` steht bereits die Steuernummer. Eine Passwort-Sammlung darf auf keinen Fall in dieses Repo. Sie gehört in einen Passwort-Manager oder in einen privaten, nicht synchronisierten Vault.

## Übergaben an andere Bereiche
- **Checkout:** Text am Marketing-Häkchen im Checkout per `translationsRegister` so ändern, dass Bewertungsanfragen genannt werden, z. B. „Ja, schickt mir Neuigkeiten, Angebote und nach der Lieferung eine Bitte um Bewertung per E-Mail. Abmeldung jederzeit möglich.“ (Voraussetzung für Judge.me-Anfragen mit Einwilligung).
- **Recht:** (a) Nach der Judge.me-Installation Baustein B aus `vorlagen/Datenschutz-Bausteine (optional).md` in die Datenschutzerklärung übernehmen (Seite und Checkout-Richtlinie). (b) Nach erfolgreichem Weiterleitungs-Test info@limitlessposter.com in AGB/Datenschutz-Seiten eintragen (Checkout-Richtlinien macht Julius). (c) Falls Julius Weg B (Zoho) wählt: Zoho als Auftragsverarbeiter aufnehmen.
- **Größen:** Die Rechnung übersetzt Optionsnamen „Size“/„Color“ und Werte „Black“/„White“. Werden Optionen umbenannt (z. B. „Größe“, „Rahmen“, „Schwarz“), funktioniert die Vorlage weiter, ohne Änderung.

## Dateien (dieser Bereich)
- `obsidian/LimitlessPoster/vorlagen/Anleitung E-Mail-Absender info@limitlessposter.com.md`
- `obsidian/LimitlessPoster/vorlagen/Anleitung Benachrichtigungs-Mails (Deutsch + Branding).md`
- `obsidian/LimitlessPoster/vorlagen/Bestellbestätigung Zusatzbaustein (§ 19, Lieferzeit, Widerruf, AGB).liquid`
- `obsidian/LimitlessPoster/vorlagen/Logo E-Mail und Rechnung (zugeschnitten, 960px).png`
- `obsidian/LimitlessPoster/vorlagen/Order Printer Rechnung (§ 19).liquid`
- `obsidian/LimitlessPoster/vorlagen/Anleitung Rechnungen mit Order Printer (§ 19).md`
- `obsidian/LimitlessPoster/vorlagen/Anleitung Bewertungen mit Judge.me.md`
- `shop-checkliste/arbeit-2026-10-02/admin/bericht.md` (dieser Bericht)
- `shop-checkliste/arbeit-2026-10-02/admin/test_vorlagen.rb` und `vorschau/` (Test und Vorschauen)
- `shop-checkliste/backup-2026-10-02/admin/gegenpruefung-vorher/` (Vorher-Stand vor der Gegenprüfung)

## Quellen (Auswahl)
- Shopify Hilfe: E-Mail-Weiterleitung https://help.shopify.com/en/manual/domains/managing-domains/email-forwarding · Absender und Authentifizierung https://help.shopify.com/en/manual/intro-to-shopify/initial-setup/setup-your-email · E-Mail-Vorlagen https://help.shopify.com/en/manual/fulfillment/setup/notifications/customizing-notification-template · Order-Printer-Variablen https://help.shopify.com/en/manual/fulfillment/managing-orders/printing-orders/shopify-order-printer/liquid-variables-and-filters-reference
- BMF-Schreiben 18.03.2025 Kleinunternehmer: https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Umsatzsteuer/Umsatzsteuer-Anwendungserlass/2025-03-18-sonderregelung-kleinunternehmer.pdf
- Judge.me Hilfe (Horizon-Sterne, Marketing-Zustimmung, DSGVO) und Sternify App-Seite, siehe Judge.me-Anleitung

## Gegenprüfung (02.10.2026, zweiter Agent)

**Geprüft gegen den Live-Stand**, nicht nur gegen diesen Bericht:
- Shopify (GraphQL, nur lesen): Shop-E-Mail und Kontakt-E-Mail, Geldformate (Shop und Mails), Steuer-Einstellungen (`taxesIncluded` false), alle Checkout-Richtlinien (Wortlaut), Seite `agb` (Wortlaut, `updatedAt` 14:45 UTC), Produktoptionen aller 113 Produkte.
- DNS erneut per DNS-over-HTTPS: NS ns-cloud-c1…c4.googledomains.com, A 23.227.38.65, www → shops.myshopify.com, kein MX, kein SPF, kein Shopify-DKIM (`shopify1/2._domainkey` NXDOMAIN), DMARC `v=DMARC1; p=none`. Stimmt mit dem Bericht überein.
- Shopify-Hilfe 2026: E-Mail-Weiterleitung (Menü Einstellungen > Domains > E-Mail-Weiterleitung > „Weiterleitungs-E-Mail hinzufügen“, SPF `include:_spf.hostedemail.com`, keine Antworten als Domain-Adresse), Absender-E-Mail und Authentifizierung (bei Shopify-Domains automatisch), Double-Opt-in (Kundenbenachrichtigungen > Marketing-Double-Opt-in). Anleitungen stimmen.
- Order-Printer-Referenz (Liquid-Variablen): Jede in der Rechnungsvorlage genutzte Variable existiert (`shop.email_logo_url`, `order.discount_applications[].target_type/total_allocated_amount/title`, `order.shipping_methods[].title`, `order.fulfillments[].created_at`, `order.transactions[].gateway_display_name/kind/status/payment_details`, `line_item.options_with_values/original_price/original_line_price`, `address.translated_country_name`, `order.tax_price/total_refunded_amount/cancelled/cancelled_at/financial_status/order_number`, Filter `money_without_currency`).
- Rechtliches: § 34a UStDV (Mindestangaben Kleinunternehmer-Rechnung), § 19-Hinweis, kein USt-Ausweis, Kleinbetragsrechnung § 33; Widerrufsbelehrung im Baustein = Checkout-Richtlinie „Widerrufsrecht“ (Wortlaut gleich); DMARC-Syntax; Zoho-EU-Einträge (mx/mx2/mx3.zoho.eu 10/20/50, `include:zohomail.eu`, smtp.zoho.eu:465).
- Apps: Shopify Order Printer (kostenlos, Liquid, kein Mailversand), Judge.me (Free-Plan ohne Limit bei Anfragen), Sternify (Abschnitte/Bundles ab 29,50 $) laut App-Store bestätigt.

**Gefunden und behoben** (Vorher-Stand: `shop-checkliste/backup-2026-10-02/admin/gegenpruefung-vorher/`):

| # | Fehler | Folge | Behoben |
|---|---|---|---|
| 1 | **AGB § 11 im Bestellbestätigungs-Baustein veraltet.** Der Recht-Bereich hat § 11 Abs. 1 und 3 auf der Seite `agb` nach der Admin-Arbeit noch einmal geändert (14:45 UTC). Der Baustein hatte die Zwischenfassung („sind urheberrechtlich geschützt“, „für Ihre private Nutzung“). | Kunde hätte per Mail andere AGB bekommen als im Shop stehen; die Zwischenfassung beanspruchte pauschalen Schutz statt nur eigener Rechte. | Abs. 1 und 3 wortgleich zur Live-Seite. Text-Abgleich AGB § 1–13 Baustein ↔ Live-Seite: 0 Abweichungen. Neuer Test „AGB § 11 = Live“. |
| 2 | **Anleitung nannte die USt-IdNr. auf der Rechnung „freiwillig“.** § 34a Nr. 2 UStDV verlangt Steuernummer oder USt-IdNr. | Hätte Julius die Zeile entfernt, wäre die Rechnung unvollständig. | Als Pflichtangabe in Tabelle und Vorlagen-Kommentar („nicht entfernen“). Die Vorlage selbst enthielt sie schon. |
| 3 | **Rechnungsdatum widersprach der Empfehlung.** Vorlage: Rechnungsdatum = Bestelldatum; Anleitung: Rechnung erst nach dem Versand erzeugen. Damit wäre jede Rechnung rückdatiert. | Ausstellungsdatum ≠ tatsächlicher Ausstellungstag. | Rechnungsdatum = Datum der ersten Sendung, vor dem Versand Bestelldatum (bleibt beim erneuten Drucken gleich). Anleitung „Datum“ und Checkliste angepasst. |
| 4 | **Spaltenköpfe Menge/Einzelpreis/Gesamt linksbündig, Werte rechtsbündig** (CSS-Spezifität `table.lp-pos th` schlägt `.lp-r`). | Unsaubere Tabelle. | `th.lp-r` rechtsbündig. |
| 5 | **Beispiel-PDF hatte 2 Seiten**, obwohl die Checkliste „passt auf eine A4-Seite“ verlangt. | Fußzeile mit USt-IdNr. landete allein auf Seite 2. | Abstände/Schrift leicht verdichtet (10 pt), Seitenumbruch-Schutz für Positionen, Summen, Hinweis, Fußzeile. 1–2 Artikel = 1 Seite (PDF neu erzeugt), ab 3 Artikeln sauber 2 Seiten; Checkliste angepasst. |
| 6 | **Ersatz-Logo war ein Theme-Bild-Link mit KI-Tool-Namen im Dateinamen** (Regelverstoß, Link hängt am Theme). | — | Ersatz ist jetzt der Schriftzug LIMITLESSPOSTER als Text; mit hochgeladenem E-Mail-Logo wird dieses genutzt (`shop.email_logo_url`, in Order Printer vorhanden). Vorschauen ohne den Link neu erzeugt. |
| 7 | **Reihenfolge-Risiko:** Checkout-AGB (Einstellungen > Richtlinien) stehen live noch auf 25. August (EU-Versand, alter § 11). | Baustein vor der Richtlinien-Aktualisierung eingefügt → Mail-AGB ≠ Checkout-AGB. | Voraussetzung in Benachrichtigungs-Anleitung (Punkt 2) und Klickanleitung 3 ergänzt. |
| 8 | **DMARC-Verschärfung ohne Blick auf andere Absender.** | Mails anderer Dienste mit @limitlessposter.com könnten im Spam landen. | Hinweis ergänzt: vor `p=quarantine` alle Absender mit DKIM PASS; Judge.me sendet standardmäßig von requests+limitlessposter.com@judge.me. |
| 9 | **Judge.me-Anleitung: „§ 7 Abs. 3 UWG greift nach h. M. nicht“** war zu absolut. | — | Richtiggestellt: umstritten, strenge Bedingungen; Einwilligung ist der sichere Weg (Ergebnis unverändert). |

**Ohne Befund:** E-Mail-Anleitung (DNS-Einträge passen zum Shopify-DNS, Weg A/B, DMARC-Syntax), Logo (Chrom-Schriftzug mit dunklen Kanten, auf weißem Mail-Hintergrund lesbar; 240 px → 46 px hoch), Akzentfarbe (#8B1E2D zu Weiß 9,0 : 1), Geldformat-Tabelle (= Live-Werte), Widerrufsbelehrung im Baustein, § 19-Hinweistext, Warnkasten bei Steuern/Storno, Versand-Rückrechnung, Datenschutz-Baustein B (Ziffern-Hinweis vorhanden).

**Live-Stand Optionen:** Alle 113 Produkte heißen jetzt „Größe“ (cm-Werte, z. B. „46 × 61 cm“) und „Rahmen“ (Schwarz/Weiß). Neuer Testfall 4 mit genau diesen Namen und hochgeladenem E-Mail-Logo: Rechnung zeigt „Größe: 46 × 61 cm · Rahmen: Schwarz“. Die Übersetzung Size/Color bleibt als Rückfall, falls Printify die Namen zurücksetzt.

**Test nach der Gegenprüfung:** `ruby shop-checkliste/arbeit-2026-10-02/admin/test_vorlagen.rb` → 4 Rechnungsfälle + Baustein, **alle Prüfungen OK** (neu: Rechnungsdatum, Logo-Ersatz/E-Mail-Logo, kein fremder Bild-Link, Live-Optionsnamen, AGB § 11 = Live).

**Weiter offen (nur Julius / andere Bereiche):** Checkout-Richtlinien AGB, Datenschutz, Versand ersetzen (Recht-Bericht); danach Baustein einfügen. Versandart „Standard Delivery“ in Checkout/Mails (Checkout-Bereich). Ob Sternify noch installiert ist, kann nur Julius unter https://admin.shopify.com/store/gexdm4-2q/settings/apps sehen.

**Gesamtergebnis Bereich Admin:** erledigt im Rahmen der API-Rechte (Vorbereitung vollständig, Umsetzung = Klicks von Julius).
