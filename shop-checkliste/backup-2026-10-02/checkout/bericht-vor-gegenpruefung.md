# Checkout: Kauf-Button-Beschriftung (Stand 02.10.2026)

## Ergebnis in einem Satz

Der Button, mit dem die Bestellung verbindlich wird, heißt im Checkout **„Jetzt kaufen“** (bei manuellen Zahlungsarten **„Kaufen“**). Beides ist nach § 312j Abs. 3 BGB zulässig. **Es war keine Änderung nötig, und ich habe nichts geändert.**

Beim Test sind aber drei andere Punkte aufgefallen, die du vor dem Start beheben solltest. Der wichtigste ist das vorab angehakte Newsletter-Häkchen (siehe „Weitere Befunde“).

---

## 1. Rechtliche Einordnung

| Quelle | Kernaussage |
|---|---|
| § 312j Abs. 3 BGB | Der Bestell-Button darf nur mit „zahlungspflichtig bestellen“ oder einer **entsprechenden eindeutigen Formulierung** beschriftet sein. |
| EuGH, 07.04.2022, C-249/21 (Fuhrmann-2) | Es kommt **nur auf die Worte auf dem Button** an. Die Umstände des Bestellvorgangs zählen nicht. Die Worte müssen für sich allein klarmachen, dass man sich zur Zahlung verpflichtet. |
| Gesetzesbegründung (BT-Drs. 17/7745, S. 12) | Nennt „kaufen“ ausdrücklich als zulässige Alternative. |
| IT-Recht Kanzlei | „Zahlungspflichtig bestellen“ und „Kaufen“ gelten als sichere Formulierungen. Shopify erfüllt die Pflicht standardmäßig mit einem „Kaufen“-Button. |
| LG Hildesheim, 07.03.2023, 6 O 156/22 | **Unzulässig** sind Beschriftungen wie „Mit PayPal bezahlen“, weil sie nur die Zahlungsart zu bestätigen scheinen. |
| AG München, 11.06.2025 | Kein Vertrag trotz „Jetzt kaufen“. Grund war aber nicht das Wort, sondern die irreführende Gestaltung: Ein Warenkorb-Symbol daneben und eine fehlende Gesamtübersicht vor dem Klick. |
| BGH, 09.10.2025, I ZR 159/24 | Der Button „Senden“ ist unzulässig, der Vertrag ist unwirksam. |

**Bewertung:**
- **„Jetzt kaufen“ und „Kaufen“ sind zulässig.** Das Wort „kaufen“ enthält die Zahlungspflicht bereits, und die Gesetzesbegründung nennt es ausdrücklich.
- **„Zahlungspflichtig bestellen“** ist der Wortlaut aus dem Gesetz und damit die sicherste Formulierung, aber nicht vorgeschrieben.
- **„Jetzt bezahlen“** ist umstritten und steht auf keiner sicheren Liste. Im Shop erscheint es nur bei `order_payment_collection.pay_now`, also beim Nachzahlen einer **bereits bestehenden** Bestellung. Dieser Klick schließt keinen Vertrag, deshalb ist es dort unkritisch.
- Shopify zeigt vor dem letzten Klick eine eigene Prüfseite mit Gesamtübersicht. Das Problem aus dem AG-München-Fall tritt hier also nicht auf.

## 2. Live-Prüfung

**Ablauf:**
1. Entwurfsbestellung #D1 angelegt (gid://shopify/DraftOrder/1560931303757):
   - 1 × „Vintage Formula 1“, 14″ x 11″ / Black, 64,99 €
   - Lieferland DE, keine Kunden-E-Mail
   - Notiz „Button-Test, wird gelöscht“ (sinngemäß)
2. Rechnungslink in Chromium geöffnet, Sprache de-DE:
   - Desktop 1366 × 900
   - iPhone 13
3. Es wurden **keine Zahlungsdaten** eingegeben und nichts abgeschickt.
4. Danach `draftOrderDelete` ausgeführt. Kontrolle: `draftOrder` liefert `null`, und es gibt keine Entwürfe mehr im Shop.

**Screenshots:**
- `shop-checkliste/arbeit-2026-10-02/checkout/checkout-desktop-1366.png`
- `shop-checkliste/arbeit-2026-10-02/checkout/checkout-mobil-iphone13.png`

**Was zu sehen ist (Desktop und Mobil gleich, mobil sauber dargestellt):**

| Prüfpunkt | Befund |
|---|---|
| Button auf der Checkout-Seite | **„Bestellung überprüfen“**. Der Bestätigungsschritt ist aktiv, dieser Klick schließt noch keinen Vertrag. Er heißt gleich, egal ob Kreditkarte, PayPal oder Klarna gewählt ist. |
| Finaler Button auf der Prüfseite | **„Jetzt kaufen“** (Schlüssel `general.pay_now_button_label`). Bei manuellen Zahlungsarten (z. B. Vorkasse) erscheint **„Kaufen“** (`general.complete_purchase_button_label`). |
| Zahlungsarten | Kreditkarte (Visa, Maestro, Mastercard und 2 weitere), PayPal, Klarna. Als Express-Buttons: Shop Pay, PayPal und Google Pay. **Sie sind also im Checkout sichtbar**, obwohl die Planung sagte, sie seien noch nicht aktiv. |
| Pflicht-Links | Unten stehen Widerrufsrecht, Versand, Datenschutzerklärung, AGB, Impressum und Kontakt. Alles vorhanden. |
| Versand | Angezeigt wird ~~23,46 €~~ → **KOSTENLOS** mit dem Hinweis „KOSTENLOSER VERSAND DEUTSCHLAND“. Passt. |
| USt / § 19 | Es gibt keine Steuerzeile und kein „inkl. MwSt.“, und der Gesamtbetrag ist 64,99 €. Das ist korrekt für einen Kleinunternehmer. Einen § 19-Hinweis gibt es im Checkout nicht. Er ist dort nicht Pflicht, ein Vorschlag steht unten. |
| Shop Pay | Der Block „Meine Daten zum schnelleren Bezahlen speichern“ mit „Nicht jetzt“ und Links zu den Bedingungen und der Datenschutzerklärung von Shop. |

**Woher weiß ich, wie der finale Button heißt, ohne die Prüfseite zu öffnen?** Die Prüfseite erscheint erst nach Eingabe von Zahlungsdaten oder nach einer Weiterleitung zu PayPal oder Klarna. Beides war ausgeschlossen. Deshalb habe ich es auf zwei andere Wege geprüft:
- Ich habe den Checkout-Code des Shops ausgewertet. Für den letzten Schritt (`thankYou`) wählt Shopify „Zur Prüfung einreichen“ (nur B2B), „Bestellung bestätigen“ (nur bei Zahlungszielen/B2B), „Kaufen“ (bei manuellen Zahlungen bzw. Nachnahme) oder sonst „Jetzt kaufen“.
- Ich habe die deutschen Texte beider Themes per Admin-API gelesen. Live-Theme und OFE v3 sind identisch, es sind 2639 Checkout-Texte ohne eigene Überschreibungen.

Sicherung der Texte: `shop-checkliste/backup-2026-10-02/checkout/checkout-texte-vorher.json`

## 3. Entscheidung: keine Änderung

- „Jetzt kaufen“ ist rechtlich zulässig und für Kunden gewohnt.
- Eine Änderung per API wäre ohnehin nicht möglich gewesen:
  - Deutsch ist die **Hauptsprache** des Shops (einzige Sprache). `translationsRegister` ist für Übersetzungen in **weitere** Sprachen gedacht.
  - Die Texte der Hauptsprache liegen in der Theme-Datei `locales/de.json`.
  - Diese Datei ist im Live-Theme per API nicht beschreibbar.
  - Im OFE v3 gehört `locales/*.json` dem Größen-Agenten.

### Falls du trotzdem „Zahlungspflichtig bestellen“ willst (optional, ca. 2 Minuten)

1. Öffne https://admin.shopify.com/store/gexdm4-2q/themes
2. Klicke beim **Live-Theme** auf **„…“** und dann auf **„Standardinhalte des Themes bearbeiten“** (englisch: „Edit default theme content“).
3. Öffne den Tab **„Checkout und System“** und suche nach **„Jetzt kaufen“**.
4. Im Feld **„Pay now button label“** bzw. „Jetzt bezahlen-Schaltflächen-Beschriftung“ trägst du `Zahlungspflichtig bestellen` ein und klickst auf **Speichern**.
5. Optional: Ändere auch das Feld mit dem Wert **„Kaufen“** (`complete_purchase_button_label`).
6. Wiederhole die Schritte 2 bis 5 beim Theme **„LimitlessPoster OFE v3“**. Nach dem Veröffentlichen nimmt der Checkout die Texte aus diesem Theme.

---

## 4. Weitere Befunde aus dem Test (bitte erledigen)

### A) Newsletter-Häkchen ist vorab gesetzt (wichtig, vor dem Start)
Im Test war **„Neuigkeiten und Angebote via E-Mail erhalten“ schon angehakt**. Eine vorab gesetzte Einwilligung ist unwirksam:
- EuGH C-673/17 „Planet49“
- DSGVO
- § 7 UWG

Ein vorab gesetztes Häkchen kann abgemahnt werden, und Werbemails an so gewonnene Adressen sind unzulässig.

**Klickanleitung:**
1. Öffne https://admin.shopify.com/store/gexdm4-2q/settings/checkout
2. Gehe zum Abschnitt **„Marketingoptionen“** und dort zu **„E-Mail“**.
3. Entferne das Häkchen bei **„Anmeldeoption vorab auswählen“** (heißt je nach Version auch „Registrierungsoption vorab auswählen“). Die Option „Anmeldeoption anzeigen“ darf an bleiben.
4. Klicke auf **Speichern**.

Danach sollte das Kästchen im Checkout leer sein. Prüfe das bei deiner Testbestellung.

### B) Zwei gleiche Versandarten „Standard Delivery“ (auf Englisch)
Kunden sehen zwei Optionen „Standard Delivery / 7-15 business days“: eine zu ~~23,46 €~~ und eine zu ~~46,92 €~~, beide KOSTENLOS.

**Ursache:** Die Printify-Versandprofile staffeln nach Gewicht. Die Stufen überlappen an der Grenze, z. B. 0–0,22 lb **und** 0,22–0,44 lb. Ein Poster wiegt genau 0,22 lb und passt damit in beide Stufen. Das ist verwirrend, und ohne den Gratis-Versand-Rabatt könnte jemand die teurere Option wählen.

**Klickanleitung:**
1. Öffne https://admin.shopify.com/store/gexdm4-2q/settings/shipping
2. Öffne die Profile „Standard: Print Pigeons …“ und dort jeweils die Zone **Germany**.
3. Benenne die Versandart in **„Standardversand“** um und ändere die Beschreibung auf **„7–15 Werktage“**.
4. Behebe die überlappenden Stufen: Lass jede Stufe knapp über der vorherigen beginnen, z. B. 0,23 lb statt 0,22 lb. Die einfachere Alternative: Da Versand für Kunden ohnehin gratis ist, ersetzt du die Staffel in Zone Germany durch **einen** Tarif „Standardversand (kostenlos)“ zu 0 €. So ist schon das „Allgemeine Profil“ eingerichtet.

Hinweis: Printify kann seine Profile beim Synchronisieren überschreiben, also nach Änderungen kurz nachprüfen. Diese Profile gehören keinem Agenten, ich habe sie deshalb nicht angefasst.

### C) Hinweistext auf der Prüfseite ist leer (optional, empfohlen)
Der Text `shopify.checkout.review.review_notice_html` ist leer (nur ein Leerzeichen). Vorschlag für die Prüfseite direkt über „Jetzt kaufen“:

```
Es gelten unsere {{ terms_of_service }}. Bitte beachte unser {{ refund_policy }}. Als Kleinunternehmer berechnen wir gemäß § 19 UStG keine Umsatzsteuer.
```

Die Platzhalter werden zu Links: „AGB“ und „Widerrufsrecht“.

**Klickanleitung:**
1. Öffne **„Standardinhalte des Themes bearbeiten“** (wie oben).
2. Wähle den Tab **„Checkout und System“** und suche nach **„review“**.
3. Trage den Text im Feld **„Review notice html“** ein und klicke auf **Speichern**.
4. Mach das im Live-Theme und im OFE v3.

### D) Zahlungsarten sind sichtbar
Im Checkout erscheinen Kreditkarte, PayPal, Klarna, Shop Pay und Google Pay. Der Status ist per API nicht lesbar, weil die Berechtigung `read_shopify_payments` fehlt.

**Bitte prüfen:**
- Öffne https://admin.shopify.com/store/gexdm4-2q/settings/payments
- Ist alles aktiv oder im Testmodus?
- Sollen Klarna und Google Pay wirklich angeboten werden?

### E) Bei deiner Testbestellung bitte zusätzlich prüfen
1. Nach „Bestellung überprüfen“ muss die Prüfseite erscheinen, mit dem Button **„Jetzt kaufen“** (bzw. „Zahlungspflichtig bestellen“, falls du es geändert hast).
2. Teste einmal den **PayPal-Express-Button** oben. Nach der Rückkehr von PayPal muss ebenfalls die Prüfseite mit „Jetzt kaufen“ kommen, und es darf nicht direkt abgeschlossen werden.
3. Das Newsletter-Kästchen muss leer sein (Punkt A).

---

## Übergaben an andere Bereiche
- **Recht-Agent:** Die Datenschutzerklärung muss die im Checkout sichtbaren Dienste nennen:
  - Shopify Payments (Kreditkarte)
  - PayPal
  - Klarna
  - Google Pay
  - Shop Pay / Shop-App (Kontoerstellung „Meine Daten speichern“)
- **Größen-Agent (OFE v3, `locales/de.json`):** Nur falls Julius die Punkte C und optional 3 per Datei statt per Klick will. Dann ergänzt er in `locales/de.json` des OFE v3 unter `shopify.checkout.review.review_notice_html` den Text aus C und optional `shopify.checkout.general.pay_now_button_label` = „Zahlungspflichtig bestellen“. Vorher-Stand: siehe Sicherung.

## Quellen
- EuGH C-249/21 (Fuhrmann-2), Zusammenfassungen: https://www.cmshs-bloggt.de/commercial/eugh-online-bestellbutton-muss-zahlungspflicht-ausweisen/ und https://itmr-legal.de/blog/eugh-buchung-button
- IT-Recht Kanzlei, Shopify-Leitfaden: https://www.it-recht-kanzlei.de/shopify-shop-rechtlich-absichern-anleitung.html
- LG Hildesheim „Mit … bezahlen“: https://www.it-recht-kanzlei.de/beschriftung-bestellbutton-mit-zahlungsart-unzulaessig.html
- AG München „Jetzt kaufen“: https://www.it-recht-kanzlei.de/ag-muenchen-jetzt-kaufen-button-irrefuehrende-gestaltung.html
- Button-Texte und BGH I ZR 159/24: https://rechtsklar24.de/ratgeber/button-loesung.html
- Shopify-Hilfe, Checkout für Deutschland (Bestätigungsschritt, Review notice): https://help.shopify.com/de/manual/intro-to-shopify/initial-setup/sell-in-germany/german-merchant-checkout-page
