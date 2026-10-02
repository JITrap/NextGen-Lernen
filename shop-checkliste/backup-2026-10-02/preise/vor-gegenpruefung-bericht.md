# Preise: Gewinn-Check je Größe (02.10.2026)

Bereich: Preise (nur lesen). Im Shop wurde **nichts geändert**, deshalb gibt es kein Backup.
Rechnung zum Nachvollziehen: `rechnung.py` (gleicher Ordner). Maschinenlesbar: `preise-empfehlung.json`.

## Kurzfazit

- **Mit den aktuellen Preisen machst du Verlust oder fast nichts.** Der Grund ist die Umsatzsteuer: Printify berechnet auf Produktion **und** Versand 19 % USt. Als Kleinunternehmer bekommst du die nicht zurück.
- Im Normalfall (Karte, ohne Rabatt) bleiben bei 28 × 36 bis 46 × 61 cm nur **2,45 bis 5,53 € pro Poster** übrig. **51 × 76 cm (−2,49 €) und 61 × 91 cm (−8,12 €) verlieren bei jedem Verkauf Geld.**
- Im schlechtesten realistischen Fall (PayPal + WELCOME10 + Kursschwankung) verliert **jede** Größe Geld, zwischen −2,60 € und −22,05 € pro Poster.
- Der einheitliche Preis für 46 × 61 cm (81,99 €) ist jetzt sauber, aber zu niedrig: Printify kostet dich dort 77,52 € inkl. USt.
- **Empfehlung: Variante „gesund“** (84,99 / 89,99 / 99,99 / 109,99 / 119,99 / 149,99 €). Damit bleiben im schlechtesten Fall 12 bis 17 € pro Poster, normal 25 bis 32 €. Die Variante „minimal“ ist die Untergrenze (ca. 8 € im schlechtesten Fall).
- **Vor dem Launch ändern** und WELCOME10 erst danach anlegen. Den Code gibt es noch nicht (per API geprüft).

## 1. Ist-Stand aus den Produktdaten

113 Produkte, 1.350 Varianten. Alle Preise sind je Größe einheitlich (Schwarz = Weiß, Hoch = Quer).

| Größe (Zoll) | cm | Varianten | Preis | unitCost Spanne | Produktion (Rechenbasis) | Versand DE je Poster |
|---|---|---|---|---|---|---|
| 11″ x 14″ / 14″ x 11″ | 28 × 36 | 224 | 64,99 | 24,88–25,38 | 25,38 | 23,19 (26,39 USD) |
| 12″ x 18″ / 18″ x 12″ | 30 × 46 | 226 | 68,99 | 28,48–29,48 | 29,48 | 23,19 (26,39 USD) |
| 16" x 20" / 20" x 16" | 41 × 51 | 224 | 74,99 | 35,12–35,83 | 35,83 | 23,19 (26,39 USD) |
| 18″ x 24″ / 24″ x 18″ | 46 × 61 | 224 | 81,99 | 41,12–41,95 | 41,95 | 23,19 (26,39 USD) |
| 20" x 30" / 30" x 20" | 51 × 76 | 226 | 89,99 | 49,39–50,39 | 50,39 | 25,48 (28,99 USD) |
| 24″ x 36″ / 36″ x 24″ | 61 × 91 | 226 | 108,99 | 64,45–65,75 | 65,75 | 30,49 (34,69 USD) |

**Prüfung unitCost (Stichprobe per Admin-API, 02.10.2026):** Shop-Währung EUR, Tarif Basic. Die unitCost-Werte sind in EUR. Sie stimmen mit den Daten überein, werden aber nicht laufend aktualisiert:

- 99 ältere Produkte: Stand **14.07.2026** (z. B. 28 × 36 cm = 24,88 €).
- 14 neuere Produkte (Collection „new-drop“, z. B. Batman, Panther, Leopard): Stand **21.09.2026**, rund **2 % höher** (25,38 €). Das passt zu einer USD→EUR-Umrechnung an einem anderen Tag. Printify kalkuliert in USD.
- **Ausreißer:** Nur bei 30 × 46 cm kostet Weiß mehr als Schwarz (28,89 bzw. 29,48 € gegenüber 28,48 bzw. 29,06 €). Alle anderen Größen kosten in Schwarz und Weiß gleich viel.
- Gerechnet wird mit dem **höchsten (neuesten) Wert** je Größe, weil er dem heutigen Kurs am nächsten liegt.
- Das Produkt „Dressurpferd“ hat nur 3 Größen (30 × 46, 51 × 76, 61 × 91). Das ist für die Preise unerheblich und wird woanders geprüft.
- Hinweis: Shopifys Gewinn-Berichte rechnen nur mit unitCost. Versand und USt fehlen dort, deshalb sieht der Gewinn in Shopify viel besser aus, als er ist.

## 2. Kosten-Annahmen (mit Quellen)

| Posten | Wert | Quelle / Begründung |
|---|---|---|
| Produktion Printify (Print Pigeons, Riga) | unitCost je Größe, höchster Wert | Admin-API, siehe oben |
| Versand Printify nach DE | 23,19 € (26,39 $) bis 46 × 61 · 25,48 € (28,99 $) bei 51 × 76 · 30,49 € (34,69 $) bei 61 × 91 · **jedes weitere Poster kostet gleich viel** | Von Printify synchronisierte Versandprofile, per Admin-API gelesen: Die Gewichtsstufen steigen genau linear (26,39 / 52,78 / 79,17 $ …). Umrechnung wie im Checkout: 1 € ≈ 1,138 $ |
| Versand für Kunden | 0 € (automatischer Rabatt „Kostenloser Versand Deutschland“) | Shop-Stammdaten |
| **USt auf Printify-Rechnung** | **19 % auf Produktion + Versand**, nicht erstattbar | Printify berechnet USt auf EU-Bestellungen und ist in DE registriert. Der Versand gehört zur Bemessungsgrundlage. Kleinunternehmer haben keinen Vorsteuerabzug. Würdest du stattdessen Reverse-Charge bzw. Erwerbsteuer anwenden (z. B. nach Eingabe der USt-IdNr. bei Printify), schuldest du die 19 % selbst. Die Last bleibt also gleich, es kommt nur Meldeaufwand dazu. |
| Kurs-/Währungspuffer | +2 % auf den Printify-Betrag (nur im schlechtesten Fall) | Printify rechnet in USD. Bei Abrechnung in USD mit einer Euro-Karte kommt die Gebühr der Bank dazu. Printify rät, die Abrechnungswährung passend zur Karte zu wählen (EUR möglich). |
| Shopify Payments (Basic, DE) | 2,1 % + 0,30 € (Karten aus dem EWR, auch Apple Pay, Google Pay und Shop Pay). Internationale Karten und Amex: 3,2 % + 0,30 € | Vergleichsseiten, Stand 07–09/2026. Verbindlich ist, was nach der Aktivierung unter Einstellungen → Zahlungen steht. |
| PayPal (Checkout, DE) | 2,99 % + 0,39 € · EWR-Zuschlag 0 % · Währungsumrechnung 3 % | PayPal-Gebührenseite, Stand 07.09.2026 |
| Shopify-Transaktionsgebühr für Drittanbieter | 2 % (Basic). **Entfällt für PayPal Express Checkout, sobald Shopify Payments aktiv ist** | Shopify-Hilfe „Third-party transaction fees“ und Vergleichsseiten |
| WELCOME10 | 10 % auf den Warenwert | Aufgabenstellung (Code existiert noch nicht) |
| Testcode LAUNCH-TEST-100 | 100 %, Bestellung kostet den Kunden 0 € | Shop-Stammdaten |
| Kanal „Shop“ (Shop-App) | keine Zusatzprovision. Zahlung läuft über Shop Pay, also zum Kartensatz | Shopify-Vertriebskanal ohne Verkaufsprovision (nach aktuellem Stand) |

**Begriffe:** DB = Deckungsbeitrag pro Poster = bezahlter Betrag − Zahlungsgebühr − Printify (Produktion + Versand) × 1,19.
\* **Schlechtester realistischer Fall:** PayPal, WELCOME10, 19 % USt, +2 % Kurspuffer, 1 Poster pro Bestellung.
\*\* **Stress:** wie *, dazu 2 % Shopify-Gebühr. Das gilt nur, falls PayPal läuft, ohne dass Shopify Payments aktiv ist.
Spalte „2 Poster“: Bei Printify kostet auch das zweite Poster vollen Versand. Dadurch spart man pro Poster nur ~0,20 € Fixgebühr.
Spalte „Testcode“: Das kostet dich die Testbestellung, wenn Printify sie wirklich produziert.

### 2a. Rechnung mit den aktuellen Preisen

| Größe | Preis | Printify inkl. 19 % USt | DB Karte | DB PayPal | DB 2 Poster PayPal (je Poster) | DB Karte + WELCOME10 | DB schlechtester Fall* | DB Stress** | Testcode 100 % |
|---|---|---|---|---|---|---|---|---|---|
| 28 × 36 cm | 64,99 € | 57,80 € | 5,53 € (9 %) | 4,86 € | 5,05 € | -0,84 € | **-2,60 €** | -3,77 € | -57,80 € |
| 30 × 46 cm | 68,99 € | 62,68 € | 4,56 € (7 %) | 3,86 € | 4,05 € | -2,19 € | **-4,09 €** | -5,33 € | -62,68 € |
| 41 × 51 cm | 74,99 € | 70,23 € | 2,88 € (4 %) | 2,12 € | 2,32 € | -4,46 € | **-6,56 €** | -7,91 € | -70,23 € |
| 46 × 61 cm | 81,99 € | 77,52 € | 2,45 € (3 %) | 1,63 € | 1,83 € | -5,58 € | **-7,87 €** | -9,35 € | -77,52 € |
| 51 × 76 cm | 89,99 € | 90,29 € | -2,49 € (-3 %) | -3,38 € | -3,18 € | -11,30 € | **-13,91 €** | -15,53 € | -90,29 € |
| 61 × 91 cm | 108,99 € | 114,53 € | -8,12 € (-7 %) | -9,18 € | -8,99 € | -18,79 € | **-22,05 €** | -24,01 € | -114,53 € |

### 2b. Variante „minimal“ (schlechtester Fall ca. 8 €)

| Größe | Preis | Printify inkl. 19 % USt | DB Karte | DB PayPal | DB 2 Poster PayPal (je Poster) | DB Karte + WELCOME10 | DB schlechtester Fall* | DB Stress** | Testcode 100 % |
|---|---|---|---|---|---|---|---|---|---|
| 28 × 36 cm | 77,99 € | 57,80 € | 18,25 € (23 %) | 17,47 € | 17,66 € | 10,62 € | **8,75 €** | 7,34 € | -57,80 € |
| 30 × 46 cm | 82,99 € | 62,68 € | 18,27 € (22 %) | 17,44 € | 17,64 € | 10,15 € | **8,14 €** | 6,64 € | -62,68 € |
| 41 × 51 cm | 91,99 € | 70,23 € | 19,52 € (21 %) | 18,62 € | 18,81 € | 10,52 € | **8,29 €** | 6,63 € | -70,23 € |
| 46 × 61 cm | 99,99 € | 77,52 € | 20,07 € (20 %) | 19,09 € | 19,29 € | 10,28 € | **7,84 €** | 6,04 € | -77,52 € |
| 51 × 76 cm | 115,99 € | 90,29 € | 22,97 € (20 %) | 21,85 € | 22,04 € | 11,61 € | **8,79 €** | 6,70 € | -90,29 € |
| 61 × 91 cm | 144,99 € | 114,53 € | 27,12 € (19 %) | 25,74 € | 25,93 € | 12,93 € | **9,38 €** | 6,77 € | -114,53 € |

### 2c. Variante „gesund“ (schlechtester Fall ca. 12–17 €, empfohlen)

| Größe | Preis | Printify inkl. 19 % USt | DB Karte | DB PayPal | DB 2 Poster PayPal (je Poster) | DB Karte + WELCOME10 | DB schlechtester Fall* | DB Stress** | Testcode 100 % |
|---|---|---|---|---|---|---|---|---|---|
| 28 × 36 cm | 84,99 € | 57,80 € | 25,11 € (30 %) | 24,26 € | 24,46 € | 16,79 € | **14,86 €** | 13,33 € | -57,80 € |
| 30 × 46 cm | 89,99 € | 62,68 € | 25,12 € (28 %) | 24,23 € | 24,43 € | 16,31 € | **14,25 €** | 12,63 € | -62,68 € |
| 41 × 51 cm | 99,99 € | 70,23 € | 27,36 € (27 %) | 26,38 € | 26,57 € | 17,57 € | **15,27 €** | 13,47 € | -70,23 € |
| 46 × 61 cm | 109,99 € | 77,52 € | 29,86 € (27 %) | 28,79 € | 28,99 € | 19,10 € | **16,57 €** | 14,59 € | -77,52 € |
| 51 × 76 cm | 119,99 € | 90,29 € | 26,88 € (22 %) | 25,73 € | 25,92 € | 15,14 € | **12,28 €** | 10,12 € | -90,29 € |
| 61 × 91 cm | 149,99 € | 114,53 € | 32,01 € (21 %) | 30,59 € | 30,78 € | 17,33 € | **13,75 €** | 11,05 € | -114,53 € |

### 2d. Rechnerische Mindestpreise (schlechtester Fall)

| Größe | DB 0 € | DB 8 € | DB 12 € | DB 15 € |
|---|---|---|---|---|
| 28 × 36 cm | 67,97 € | 77,13 € | 81,71 € | 85,15 € |
| 30 × 46 cm | 73,67 € | 82,83 € | 87,41 € | 90,85 € |
| 41 × 51 cm | 82,50 € | 91,66 € | 96,24 € | 99,68 € |
| 46 × 61 cm | 91,01 € | 100,17 € | 104,75 € | 108,19 € |
| 51 × 76 cm | 105,92 € | 115,09 € | 119,67 € | 123,10 € |
| 61 × 91 cm | 134,24 € | 143,41 € | 147,99 € | 151,42 € |

## 3. Fertige Preistabelle je Optionswert

Gilt für Schwarz und Weiß. In den Daten stehen die Optionswerte noch in Zoll. Im Shop heißen sie seit heute in cm (Spalte „live“). Die Varianten-IDs bleiben gleich.

| Optionswert (Daten) | Optionswert (live) | Format | aktuell | **minimal** | **gesund** | DB worst aktuell | DB worst minimal | DB worst gesund |
|---|---|---|---|---|---|---|---|---|
| 11″ x 14″ | 28 × 36 cm | hoch | 64,99 € | **77,99 €** | **84,99 €** | -2,60 € | 8,75 € | 14,86 € |
| 14″ x 11″ | 36 × 28 cm | quer | 64,99 € | **77,99 €** | **84,99 €** | -2,60 € | 8,75 € | 14,86 € |
| 12″ x 18″ | 30 × 46 cm | hoch | 68,99 € | **82,99 €** | **89,99 €** | -4,09 € | 8,14 € | 14,25 € |
| 18″ x 12″ | 46 × 30 cm | quer | 68,99 € | **82,99 €** | **89,99 €** | -4,09 € | 8,14 € | 14,25 € |
| 16" x 20" | 41 × 51 cm | hoch | 74,99 € | **91,99 €** | **99,99 €** | -6,56 € | 8,29 € | 15,27 € |
| 20" x 16" | 51 × 41 cm | quer | 74,99 € | **91,99 €** | **99,99 €** | -6,56 € | 8,29 € | 15,27 € |
| 18″ x 24″ | 46 × 61 cm | hoch | 81,99 € | **99,99 €** | **109,99 €** | -7,87 € | 7,84 € | 16,57 € |
| 24″ x 18″ | 61 × 46 cm | quer | 81,99 € | **99,99 €** | **109,99 €** | -7,87 € | 7,84 € | 16,57 € |
| 20" x 30" | 51 × 76 cm | hoch | 89,99 € | **115,99 €** | **119,99 €** | -13,91 € | 8,79 € | 12,28 € |
| 30" x 20" | 76 × 51 cm | quer | 89,99 € | **115,99 €** | **119,99 €** | -13,91 € | 8,79 € | 12,28 € |
| 24″ x 36″ | 61 × 91 cm | hoch | 108,99 € | **144,99 €** | **149,99 €** | -22,05 € | 9,38 € | 13,75 € |
| 36″ x 24″ | 91 × 61 cm | quer | 108,99 € | **144,99 €** | **149,99 €** | -22,05 € | 9,38 € | 13,75 € |

**Warum diese Staffel:** Alle Preise enden auf ,99. Bei „gesund“ sind die Schritte sauber (+5, +10, +10, +10, +30 €), und jede größere Größe kostet spürbar mehr. Bei „minimal“ liegt nur 46 × 61 cm mit 7,84 € knapp unter 8 €, weil 99,99 € deutlich besser wirkt als 100,99 €.

## 4. Fixkosten pro Monat und Break-even

| Posten | pro Monat |
|---|---|
| Shopify Basic | ca. 27–33 € bei monatlicher Zahlung (ca. 24–25 € bei Jahreszahlung). Quellen nennen leicht unterschiedliche Beträge; dein echter Betrag steht unter Einstellungen → Tarif |
| + 19 % USt darauf (Shopify sitzt in Irland, § 13b UStG gilt auch für Kleinunternehmer) | ca. 5–6 € |
| Apps (Printify Free, Bewertungs-App Free-Plan, Order Printer) | 0 € |
| Domain (falls über Shopify gekauft) | ca. 1 € |
| **Summe (vorsichtig)** | **ca. 40 €** |

Nötige Bestellungen pro Monat, um ca. 40 € Fixkosten zu decken (1 Poster, Karte, ohne Rabatt):

| Größe | aktuell | minimal | gesund |
|---|---|---|---|
| 28 × 36 cm | 8 | 3 | 2 |
| 46 × 61 cm | 17 | 2 | 2 |
| 61 × 91 cm | nie (Verlust) | 2 | 2 |

Optional **Printify Premium** (ab 34,99 €/Monat oder 299 €/Jahr): bis zu 20 % Rabatt auf die Produktion. Das spart bis zu ca. 6 € (28 × 36) bzw. ca. 10 € (46 × 61) pro Poster inkl. USt. Es lohnt sich ab etwa **4–7 Postern im Monat**. Vorher in Printify nachsehen, wie hoch der Rabatt beim Framed Poster von Print Pigeons wirklich ist.

## 5. Weitere Risiken und Hebel

- **Widerruf/Retouren:** Printify nimmt nichts zurück, wenn es nur nicht gefällt. Bei Widerruf trägst du die Erstattung. Bei 3 % Widerrufen entspricht das ca. 1,70 € (28 × 36) bis 3,40 € (61 × 91) pro Bestellung. Auch deshalb ist „gesund“ besser als „minimal“.
- **Versand ist der größte Kostenblock** (23–30 € pro Poster aus Riga). Ein Hebel ohne Preiserhöhung: In Printify prüfen, ob ein anderer Anbieter das gerahmte Poster in DE oder näher produziert und billiger nach DE schickt. Dafür vorher eine Musterbestellung machen.
- **WELCOME10:** erst nach der Preiserhöhung anlegen. Mit „mit Versandrabatten kombinierbar“, einmal pro Kunde. Mit den aktuellen Preisen macht jede WELCOME10-Bestellung Verlust.
- **Testbestellung:** Am billigsten ist 28 × 36 cm (57,80 €). Wird sie in Printify vor der Produktion storniert, kostet sie 0 €. Dafür muss die Order approval auf „Manually“ stehen.
- **Kleinunternehmer-Grenze** (seit 2025: 25.000 € Vorjahr / 100.000 € laufendes Jahr): Wird sie überschritten, enthalten deine Preise 19 % USt. Dafür kannst du dann die Printify-USt abziehen. Dann neu rechnen.
- **Printify überschreibt Preise:** Wenn ein Produkt in Printify erneut veröffentlicht wird, schickt Printify seine Verkaufspreise (und Variantennamen) wieder an Shopify. Deshalb die neuen Preise **auch in Printify** eintragen. Printify zeigt „USD“ an, überträgt aber die Zahl unverändert (84,99 in Printify = 84,99 € im Shop). Alternativ beim Veröffentlichen nur Titel, Beschreibung und Bilder auswählen.

## 6. Klickanleitungen für Julius

1. **Variante wählen** („gesund“ empfohlen) und Claude sagen: „Preise Variante gesund anwenden“. Dann werden alle 1.350 Varianten per API aktualisiert. Der Plan dafür entsteht mit `python3 shop-checkliste/arbeit-2026-10-02/preise/rechnung.py --plan gesund` (vorher Backup der alten Preise).
   Manuell geht es auch: https://admin.shopify.com/store/gexdm4-2q/products → alle Produkte auswählen → „Bearbeiten“ → im Massen-Editor die Spalte „Preis“ je Größe setzen.
2. **Preise in Printify nachziehen:** printify.com → My Products → Produkt → Edit → Preise je Größe eintragen (Zahl wie oben, „USD“ ignorieren) → Save. Nur „Publish“ klicken, wenn die Preise in Printify stimmen.
3. **Printify-Abrechnungswährung auf EUR stellen** (falls du mit Euro-Karte zahlst): Printify → Wallet → Payment details → Billing currency → EUR.
4. **USt-IdNr. bei Printify** besser nicht hinterlegen, solange du Kleinunternehmer bist. Sonst musst du die Erwerbsteuer selbst melden, bei gleicher Kostenlast. Kurz mit dem Steuerberater abstimmen.
5. **Nach Aktivierung von Shopify Payments** die echten Gebühren ablesen: https://admin.shopify.com/store/gexdm4-2q/settings/payments → Shopify Payments → Gebühren. Liegen sie über 2,1 % + 0,30 €, Bescheid geben, dann wird neu gerechnet.
6. **WELCOME10** erst nach Schritt 1 anlegen: https://admin.shopify.com/store/gexdm4-2q/discounts → Rabatt erstellen → Betrag von Bestellung → 10 % → „Mit Versandrabatten kombinierbar“ anhaken.

## 7. Offene Punkte

- Entscheidung „minimal“ oder „gesund“ (Empfehlung: gesund) und Freigabe für die API-Preisänderung.
- Shopify-Tarifpreis in EUR und die echten Shopify-Payments-Sätze nach der Aktivierung bestätigen.
- Printify: Abrechnungswährung, Premium-Rabatt beim Framed Poster und ein günstigerer Anbieter für DE.
- WELCOME10 existiert noch nicht.

## Quellen

- Shopify Preise (öffentliche Seite, über den Proxy in USD angezeigt: Basic 2,9 % + 30 ¢, Drittanbieter 2 %): https://www.shopify.com/de/preise
- Shopify Gebühren DE, Stand 09/2026 (2,1 % + 0,30 € EWR, 3,2 % international/Amex, 2 % Drittanbieter, Basic 27 €): https://falkeconsulting.com/blogs/blog/shopify-gebuehren
- Shopify Payments in DE, Stand 07/2026 (2,1 % + 0,30 €): https://www.yagemi.de/blog/e-commerce/shopify-payments-deutschland/
- Shopify Basic 33 €/25 €: https://www.it-boltwise.de/shopify-basic-in-deutschland-preise-funktionen-und-technische-basis.html
- Shopify-Hilfe, Drittanbieter-Transaktionsgebühren (PayPal Express Checkout ausgenommen, wenn Shopify Payments aktiv ist): https://help.shopify.com/en/manual/your-account/manage-billing/billing-charges/types-of-charges/third-party-charges/third-party-transaction-fees
- PayPal Gebühren DE, Stand 07.09.2026: https://www.paypal.com/de/business/paypal-business-fees
- Printify: USt auf EU-Bestellungen: https://help.printify.com/hc/en-us/articles/4483635869073
- Printify: Berechnung der USt (Versand zählt mit): https://help.printify.com/hc/en-us/articles/4483628906513
- Printify: Abrechnungswährung: https://help.printify.com/hc/en-us/articles/12203640151953
- Printify: Verkauf in anderer Währung (Zahlen werden 1:1 veröffentlicht, Versand in USD): https://help.printify.com/hc/en-us/articles/4483625794577
- Printify Premium (ab 34,99 €/Monat, 299 €/Jahr, bis 20 % Rabatt): https://help.printify.com/hc/en-us/articles/4483625875601
- Eigene Daten: Admin-API (Preise, unitCost, Versandprofile, Rabattcodes) vom 02.10.2026
