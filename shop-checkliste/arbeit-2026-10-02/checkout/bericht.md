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

---

## Gegenprüfung (02.10.2026)

Geprüft gegen den **Live-Stand in Shopify** (Admin-API) und die Dateien im Repo, nicht nur gegen diesen Bericht. Vorher-Stand des Berichts: `shop-checkliste/backup-2026-10-02/checkout/bericht-vor-gegenpruefung.md`. Im Shop habe ich nichts geändert.

### Was bestätigt ist

| Prüfpunkt | Ergebnis |
|---|---|
| Entwurfsbestellung #D1 gelöscht? | Ja. `draftOrder(…/1560931303757)` liefert `null`, die Liste aller Entwürfe ist leer. Es gibt außerdem 0 Kunden, 0 abgebrochene Checkouts und 0 Bestellungen. Der Test hat also nichts hinterlassen. |
| Button-Befund belegt? | Ja, soweit möglich. Beide Screenshots zeigen „Bestellung überprüfen“, damit ist der Bestätigungsschritt aktiv. Der finale Text „Jetzt kaufen“ stammt aus den Theme-Texten (`shopify.checkout.general.pay_now_button_label`). Shopify bestätigt den Ablauf: Erst „Review order“ (Prüfseite), dann der Button „Pay now“, auf Deutsch „Jetzt kaufen“ ([Shopify-Hilfe](https://help.shopify.com/en/manual/checkout-settings/order-processing)). Ein Screenshot der Prüfseite fehlt weiterhin, das muss die Testbestellung zeigen. |
| Übersetzungen verändert? | Nein. Alle 10 gesicherten Schlüssel stimmen live mit der Sicherung überein, in beiden Themes. Live-Theme und OFE v3 haben je 2639 Checkout-Texte, es gibt 0 Unterschiede. Die Dateien `locales/de.json` wurden heute nicht geändert (Live-Theme: 03.08., OFE v3: 29.09.). |
| Rechtliche Einschätzung | Stimmt, und die Quellen sind nachgeprüft. Das LG Hildesheim (07.03.2023, 6 O 156/22) hält „Mit PayPal bezahlen“ für unzulässig. Das AG München (11.06.2025) hält „Jetzt kaufen“ grundsätzlich für eindeutig; dort scheiterte es am Warenkorb-Symbol daneben. Der BGH (09.10.2025, I ZR 159/24) hält „Senden“ für unzulässig. „Kaufen“ und „Jetzt kaufen“ gelten als zulässig. |
| Pflicht-Links im Checkout | Alle 6 Richtlinien sind angelegt: Kontakt, Impressum, Datenschutzerklärung, Widerrufsrecht, Versand und AGB. |
| Versand-Ursache | Bestätigt, die Tarife überlappen. Genauer: Es betrifft **5** Printify-Versandprofile, jedes mit 12 Gewichtsstufen „Standard Delivery / 7-15 business days“ in der Zone Germany. Die Stufen gehen 0–0,22 lb, 0,22–0,44 lb usw., die Grenzen überlappen also. Der Rabatt „Kostenloser Versand Deutschland“ ist aktiv und hat keine Obergrenze, deshalb sind beide Optionen 0 €. |

### Was neu gefunden wurde

1. **Checkout-Links zeigen alte AGB und alte Datenschutzerklärung.** Der Checkout verlinkt die Richtlinien unter Einstellungen > Richtlinien, nicht die Shop-Seiten. Diese Richtlinien haben den Stand vom 25.08.2026, die Seiten `agb` und `datenschutzerklaerung` wurden dagegen heute aktualisiert. Im Checkout stehen also noch der alte § 11 und der alte Zahlungsteil. Der Recht-Bereich hat die Vorlagen und die Klickanleitung schon fertig (`shop-checkliste/arbeit-2026-10-02/recht/bericht.md`, Abschnitt 4 A/B). **Das muss vor dem Start erledigt sein.**
2. **Klarna ist im Checkout sichtbar, steht aber nicht in der Datenschutzerklärung.** Die Live-Seite nennt Klarna kein einziges Mal. Unter Ziffer 7 c) steht sogar „bieten keinen Kauf auf Rechnung an“, und genau das bietet Klarna an. Der Recht-Bereich hat dafür den Baustein A in `obsidian/LimitlessPoster/vorlagen/Datenschutz-Bausteine (optional).md` vorbereitet, gedacht „nur wenn Klarna im Checkout aktiv ist“. Genau das ist jetzt der Fall. Du hast zwei Möglichkeiten:
   - Klarna behalten: Dann Baustein A in die Seite und in die Checkout-Richtlinie einfügen. Das ist als Übergabe an den Recht-Bereich vermerkt.
   - Oder Klarna ausschalten: https://admin.shopify.com/store/gexdm4-2q/settings/payments > Shopify Payments > Verwalten > Klarna deaktivieren > Speichern.
3. **Apple Pay ist ebenfalls aktiv.** Laut API unterstützt der Shop die Wallets Shop Pay, Apple Pay und Google Pay. Apple Pay fehlte im Test nur deshalb, weil Chromium kein Safari ist. Die Datenschutzerklärung nennt Apple Pay bereits, dort ist also nichts zu tun.
4. **Express-Zahlungen sind nicht geprüft.** Shopify dokumentiert nicht, ob Shop Pay, Google Pay und Apple Pay über die Express-Buttons oben (und „Sofort kaufen“ auf der Produktseite, falls im Theme aktiv) danach noch die Prüfseite mit „Jetzt kaufen“ zeigen. Wird die Bestellung direkt im Wallet-Fenster abgeschlossen, steht dort ein Button wie „Bezahlen“, den du nicht ändern kannst. Das ist eine Grauzone, vergleiche LG Hildesheim zu „Mit … bezahlen“. Siehe Testschritt 4 unten.
5. **Kleinigkeit:** Die Überschrift über den Express-Buttons lautet auf Englisch „Express Checkout“ (Schlüssel `shopify.checkout.alternative_payment_method_banner.express_checkout`). Das kann so bleiben. Wer es ändern will, setzt es auf „Express-Checkout“, wie bei Punkt C über „Standardinhalte des Themes bearbeiten“.

### Was behoben wurde

Nichts im Shop. Es gab keinen sicheren Fehler im Besitz dieses Bereichs: Der Entwurf ist weg, und an den Übersetzungen wurde nichts geändert. Die Versandprofile, die Richtlinien und die Zahlungseinstellungen gehören nicht zu diesem Bereich bzw. sind per API nicht beschreibbar. Ergänzt habe ich nur diesen Bericht.

### Genauere Klickanleitung für Punkt B (Versand)

1. Öffne https://admin.shopify.com/store/gexdm4-2q/settings/shipping
2. Diese 5 Profile sind betroffen, ihre Namen beginnen mit „Standard: Print Pigeons, 492, 493, Poster, …“:
   - 11″ x 14″ … (450 Varianten)
   - 16" x 20" (224)
   - 18″ x 24″ (224)
   - 20" x 30" (226)
   - 24″ x 36″ (226)
3. In jedem Profil gehst du zur Zone **Germany** und dort auf **„Tarif hinzufügen“**:
   - Name: `Standardversand`
   - Lieferzeit/Beschreibung: `7–15 Werktage`
   - Preis: `0 €`
   - **Fertig**
4. Lösche danach die 12 Tarife „Standard Delivery“ in dieser Zone und klicke auf **Speichern**.
5. Kontrolle bei der Testbestellung: Es darf nur eine Option erscheinen, „Standardversand · 7–15 Werktage · Kostenlos“.
6. Prüfe nach jedem neuen Veröffentlichen aus Printify kurz, ob Printify die Tarife zurückgesetzt hat.

### Testbestellung: zusätzliche Prüfschritte

Zusätzlich zu Punkt E:

1. Prüfe den Footer im Checkout: Ein Klick auf „AGB“ muss den neuen § 11 zeigen, ein Klick auf „Datenschutzerklärung“ den neuen Zahlungsteil. Das klappt erst, wenn Punkt 1 oben erledigt ist.
2. Das Newsletter-Kästchen muss leer sein (Punkt A).
3. Es darf nur eine Versandoption geben, und sie muss deutsch beschriftet sein (Punkt B).
4. **Express-Wege einzeln testen**, jeweils bis kurz vor dem letzten Klick und ohne abzuschicken:
   - PayPal
   - Shop Pay
   - Google Pay (Chrome)
   - Apple Pay (iPhone/Safari)

   Notiere jeweils, welcher Button zuletzt kommt:
   - Kommt die Prüfseite mit „Jetzt kaufen“, ist alles in Ordnung.
   - Schließt ein Wallet direkt im eigenen Fenster mit „Bezahlen“ ab, entscheidest du: Diesen Express-Button ausschalten (https://admin.shopify.com/store/gexdm4-2q/settings/payments > Shopify Payments > Verwalten > Wallets) oder das Restrisiko bewusst tragen.
5. Falls die Prüfseite gar nicht erscheint: Unter https://admin.shopify.com/store/gexdm4-2q/settings/checkout im Bereich „Auftragsabwicklung“ (je nach Admin-Version auch unter Einstellungen > Allgemein) die Option **„Bestätigungsschritt erforderlich“** einschalten.
6. Im Block „Meine Daten zum schnelleren Bezahlen speichern“ darf nichts vorausgewählt sein, das ein Shop-Konto ohne aktive Eingabe (z. B. Handynummer) anlegt.

### Gesamtergebnis Bereich Checkout

Der Bestell-Button ist rechtlich in Ordnung, und am Shop musste nichts geändert werden. Vor dem Start sind diese 4 Punkte offen. Alle kann nur Julius im Admin erledigen:
1. Newsletter-Vorauswahl ausschalten (A).
2. Die Checkout-Richtlinien AGB, Datenschutz und Versand mit den Vorlagen aus dem Recht-Bereich ersetzen.
3. Klarna entweder in der Datenschutzerklärung ergänzen oder ausschalten.
4. Versandtarife auf einen deutschen 0-€-Tarif umstellen (B).

Danach die Testbestellung mit den Prüfschritten oben machen.

Quellen der Gegenprüfung: [Shopify-Hilfe Auftragsabwicklung/Bestätigungsschritt](https://help.shopify.com/en/manual/checkout-settings/order-processing), [IT-Recht Kanzlei zu LG Hildesheim](https://www.it-recht-kanzlei.de/beschriftung-bestellbutton-mit-zahlungsart-unzulaessig.html), [IT-Recht Kanzlei zu AG München](https://www.it-recht-kanzlei.de/ag-muenchen-jetzt-kaufen-button-irrefuehrende-gestaltung.html), [rechtsklar24 zu BGH I ZR 159/24](https://rechtsklar24.de/ratgeber/button-loesung.html).
