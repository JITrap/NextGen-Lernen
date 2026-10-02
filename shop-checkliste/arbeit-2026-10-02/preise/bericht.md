# Preise: Gewinn-Check je Größe (02.10.2026)

Bereich: Preise (nur lesen). Im Shop wurde **nichts geändert**, deshalb gibt es kein Backup.
Rechnung zum Nachvollziehen: `rechnung.py` (gleicher Ordner). Maschinenlesbar: `preise-empfehlung.json`.
Gegenprüfung gegen den Live-Stand: Abschnitt „Gegenprüfung“ am Ende und `gegenpruefung.py`. Alle Tabellen unten sind bereits korrigiert (Versand zum Kurs vom 02.10.2026).

## Kurzfazit

- **Mit den aktuellen Preisen machst du Verlust oder fast nichts.** Der Grund ist die Umsatzsteuer: Printify berechnet auf Produktion **und** Versand 19 % USt. Als Kleinunternehmer bekommst du die nicht zurück.
- Im Normalfall (Karte, ohne Rabatt) bleiben bei 28 × 36 bis 46 × 61 cm nur **2,13 bis 5,21 € pro Poster** übrig. **51 × 76 cm (−2,83 €) und 61 × 91 cm (−8,54 €) verlieren bei jedem Verkauf Geld.**
- Im schlechtesten realistischen Fall (PayPal + WELCOME10 + Kursschwankung) verliert **jede** Größe Geld, zwischen −2,93 € und −22,47 € pro Poster.
- Der einheitliche Preis für 46 × 61 cm (81,99 €) ist jetzt sauber, aber zu niedrig: Printify kostet dich dort 77,84 € inkl. USt.
- **Empfehlung: Variante „gesund“** (84,99 / 89,99 / 99,99 / 109,99 / 119,99 / 149,99 €). Damit bleiben im schlechtesten Fall 12 bis 16 € pro Poster, normal 25 bis 32 €. Die Variante „minimal“ ist die Untergrenze (7,50 bis 9 € im schlechtesten Fall).
- **Vor dem Launch ändern** und WELCOME10 erst danach anlegen. Den Code gibt es noch nicht (per API geprüft).

## 1. Ist-Stand aus den Produktdaten

113 Produkte, 1.350 Varianten. Alle Preise sind je Größe einheitlich (Schwarz = Weiß, Hoch = Quer).

| Größe (Zoll) | cm | Varianten | Preis | unitCost Spanne | Produktion (Rechenbasis) | Versand DE je Poster |
|---|---|---|---|---|---|---|
| 11″ x 14″ / 14″ x 11″ | 28 × 36 | 224 | 64,99 | 24,88–25,38 | 25,38 | 23,46 (26,39 USD) |
| 12″ x 18″ / 18″ x 12″ | 30 × 46 | 226 | 68,99 | 28,48–29,48 | 29,48 | 23,46 (26,39 USD) |
| 16" x 20" / 20" x 16" | 41 × 51 | 224 | 74,99 | 35,12–35,83 | 35,83 | 23,46 (26,39 USD) |
| 18″ x 24″ / 24″ x 18″ | 46 × 61 | 224 | 81,99 | 41,12–41,95 | 41,95 | 23,46 (26,39 USD) |
| 20" x 30" / 30" x 20" | 51 × 76 | 226 | 89,99 | 49,39–50,39 | 50,39 | 25,77 (28,99 USD) |
| 24″ x 36″ / 36″ x 24″ | 61 × 91 | 226 | 108,99 | 64,45–65,75 | 65,75 | 30,84 (34,69 USD) |

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
| Versand Printify nach DE | 23,46 € (26,39 $) bis 46 × 61 · 25,77 € (28,99 $) bei 51 × 76 · 30,84 € (34,69 $) bei 61 × 91 · **jedes weitere Poster kostet gleich viel** | Von Printify synchronisierte Versandprofile, per Admin-API gelesen: Die Gewichtsstufen steigen genau linear (26,39 / 52,78 / 79,17 $ …). Umrechnung wie im Checkout am 02.10.2026: 1 € ≈ 1,125 $ (Gegenprüfung, vorher 1,138 $) |
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
| 28 × 36 cm | 64,99 € | 58,12 € | 5,21 € (8 %) | 4,54 € | 4,73 € | -1,16 € | **-2,93 €** | -4,10 € | -58,12 € |
| 30 × 46 cm | 68,99 € | 63,00 € | 4,24 € (6 %) | 3,54 € | 3,73 € | -2,51 € | **-4,41 €** | -5,66 € | -63,00 € |
| 41 × 51 cm | 74,99 € | 70,56 € | 2,56 € (3 %) | 1,80 € | 2,00 € | -4,78 € | **-6,88 €** | -8,23 € | -70,56 € |
| 46 × 61 cm | 81,99 € | 77,84 € | 2,13 € (3 %) | 1,31 € | 1,51 € | -5,90 € | **-8,20 €** | -9,68 € | -77,84 € |
| 51 × 76 cm | 89,99 € | 90,63 € | -2,83 € (-3 %) | -3,72 € | -3,53 € | -11,64 € | **-14,26 €** | -15,88 € | -90,63 € |
| 61 × 91 cm | 108,99 € | 114,94 € | -8,54 € (-8 %) | -9,60 € | -9,41 € | -19,21 € | **-22,47 €** | -24,43 € | -114,94 € |

### 2b. Variante „minimal“ (schlechtester Fall ca. 7,50–9 €)

| Größe | Preis | Printify inkl. 19 % USt | DB Karte | DB PayPal | DB 2 Poster PayPal (je Poster) | DB Karte + WELCOME10 | DB schlechtester Fall* | DB Stress** | Testcode 100 % |
|---|---|---|---|---|---|---|---|---|---|
| 28 × 36 cm | 77,99 € | 58,12 € | 17,93 € (23 %) | 17,15 € | 17,34 € | 10,30 € | **8,42 €** | 7,02 € | -58,12 € |
| 30 × 46 cm | 82,99 € | 63,00 € | 17,95 € (22 %) | 17,12 € | 17,31 € | 9,82 € | **7,81 €** | 6,32 € | -63,00 € |
| 41 × 51 cm | 91,99 € | 70,56 € | 19,20 € (21 %) | 18,29 € | 18,49 € | 10,20 € | **7,96 €** | 6,30 € | -70,56 € |
| 46 × 61 cm | 99,99 € | 77,84 € | 19,75 € (20 %) | 18,77 € | 18,97 € | 9,96 € | **7,52 €** | 5,72 € | -77,84 € |
| 51 × 76 cm | 115,99 € | 90,63 € | 22,62 € (20 %) | 21,50 € | 21,70 € | 11,27 € | **8,44 €** | 6,35 € | -90,63 € |
| 61 × 91 cm | 144,99 € | 114,94 € | 26,70 € (18 %) | 25,32 € | 25,52 € | 12,51 € | **8,96 €** | 6,35 € | -114,94 € |

### 2c. Variante „gesund“ (schlechtester Fall ca. 12–16 €, empfohlen)

| Größe | Preis | Printify inkl. 19 % USt | DB Karte | DB PayPal | DB 2 Poster PayPal (je Poster) | DB Karte + WELCOME10 | DB schlechtester Fall* | DB Stress** | Testcode 100 % |
|---|---|---|---|---|---|---|---|---|---|
| 28 × 36 cm | 84,99 € | 58,12 € | 24,79 € (29 %) | 23,94 € | 24,13 € | 16,47 € | **14,53 €** | 13,00 € | -58,12 € |
| 30 × 46 cm | 89,99 € | 63,00 € | 24,80 € (28 %) | 23,91 € | 24,11 € | 15,99 € | **13,92 €** | 12,30 € | -63,00 € |
| 41 × 51 cm | 99,99 € | 70,56 € | 27,04 € (27 %) | 26,06 € | 26,25 € | 17,25 € | **14,94 €** | 13,14 € | -70,56 € |
| 46 × 61 cm | 109,99 € | 77,84 € | 29,54 € (27 %) | 28,47 € | 28,67 € | 18,77 € | **16,25 €** | 14,27 € | -77,84 € |
| 51 × 76 cm | 119,99 € | 90,63 € | 26,54 € (22 %) | 25,38 € | 25,58 € | 14,79 € | **11,93 €** | 9,77 € | -90,63 € |
| 61 × 91 cm | 149,99 € | 114,94 € | 31,60 € (21 %) | 30,17 € | 30,37 € | 16,91 € | **13,32 €** | 10,62 € | -114,94 € |

### 2d. Rechnerische Mindestpreise (schlechtester Fall)

| Größe | DB 0 € | DB 8 € | DB 12 € | DB 15 € |
|---|---|---|---|---|
| 28 × 36 cm | 68,35 € | 77,51 € | 82,09 € | 85,53 € |
| 30 × 46 cm | 74,05 € | 83,21 € | 87,79 € | 91,23 € |
| 41 × 51 cm | 82,87 € | 92,04 € | 96,62 € | 100,05 € |
| 46 × 61 cm | 91,38 € | 100,54 € | 105,13 € | 108,56 € |
| 51 × 76 cm | 106,33 € | 115,49 € | 120,07 € | 123,51 € |
| 61 × 91 cm | 134,73 € | 143,89 € | 148,47 € | 151,91 € |

## 3. Fertige Preistabelle je Optionswert

Gilt für Schwarz und Weiß. In den Daten stehen die Optionswerte noch in Zoll. Im Shop heißen sie seit heute in cm (Spalte „live“). Die Varianten-IDs bleiben gleich.

| Optionswert (Daten) | Optionswert (live) | Format | aktuell | **minimal** | **gesund** | DB worst aktuell | DB worst minimal | DB worst gesund |
|---|---|---|---|---|---|---|---|---|
| 11″ x 14″ | 28 × 36 cm | hoch | 64,99 € | **77,99 €** | **84,99 €** | -2,93 € | 8,42 € | 14,53 € |
| 14″ x 11″ | 36 × 28 cm | quer | 64,99 € | **77,99 €** | **84,99 €** | -2,93 € | 8,42 € | 14,53 € |
| 12″ x 18″ | 30 × 46 cm | hoch | 68,99 € | **82,99 €** | **89,99 €** | -4,41 € | 7,81 € | 13,92 € |
| 18″ x 12″ | 46 × 30 cm | quer | 68,99 € | **82,99 €** | **89,99 €** | -4,41 € | 7,81 € | 13,92 € |
| 16" x 20" | 41 × 51 cm | hoch | 74,99 € | **91,99 €** | **99,99 €** | -6,88 € | 7,96 € | 14,94 € |
| 20" x 16" | 51 × 41 cm | quer | 74,99 € | **91,99 €** | **99,99 €** | -6,88 € | 7,96 € | 14,94 € |
| 18″ x 24″ | 46 × 61 cm | hoch | 81,99 € | **99,99 €** | **109,99 €** | -8,20 € | 7,52 € | 16,25 € |
| 24″ x 18″ | 61 × 46 cm | quer | 81,99 € | **99,99 €** | **109,99 €** | -8,20 € | 7,52 € | 16,25 € |
| 20" x 30" | 51 × 76 cm | hoch | 89,99 € | **115,99 €** | **119,99 €** | -14,26 € | 8,44 € | 11,93 € |
| 30" x 20" | 76 × 51 cm | quer | 89,99 € | **115,99 €** | **119,99 €** | -14,26 € | 8,44 € | 11,93 € |
| 24″ x 36″ | 61 × 91 cm | hoch | 108,99 € | **144,99 €** | **149,99 €** | -22,47 € | 8,96 € | 13,32 € |
| 36″ x 24″ | 91 × 61 cm | quer | 108,99 € | **144,99 €** | **149,99 €** | -22,47 € | 8,96 € | 13,32 € |

**Warum diese Staffel:** Alle Preise enden auf ,99. Bei „gesund“ sind die Schritte sauber (+5, +10, +10, +10, +30 €), und jede größere Größe kostet spürbar mehr. Bei „minimal“ liegen 30 × 46, 41 × 51 und 46 × 61 cm knapp unter 8 € (7,52–7,96 €). 46 × 61 cm bleibt bewusst bei 99,99 €, weil das deutlich besser wirkt als 100,99 €.

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
| 46 × 61 cm | 19 | 3 | 2 |
| 61 × 91 cm | nie (Verlust) | 2 | 2 |

Optional **Printify Premium** (ab 34,99 €/Monat oder 299 €/Jahr): bis zu 20 % Rabatt auf die Produktion. Das spart bis zu ca. 6 € (28 × 36) bzw. ca. 10 € (46 × 61) pro Poster inkl. USt. Es lohnt sich ab etwa **4–7 Postern im Monat**. Vorher in Printify nachsehen, wie hoch der Rabatt beim Framed Poster von Print Pigeons wirklich ist.

## 5. Weitere Risiken und Hebel

- **Widerruf/Retouren:** Printify nimmt nichts zurück, wenn es nur nicht gefällt. Bei Widerruf trägst du die Erstattung. Bei 3 % Widerrufen entspricht das ca. 1,75 € (28 × 36) bis 3,45 € (61 × 91) pro Bestellung. Auch deshalb ist „gesund“ besser als „minimal“.
- **Versand ist der größte Kostenblock** (23–30 € pro Poster aus Riga). Ein Hebel ohne Preiserhöhung: In Printify prüfen, ob ein anderer Anbieter das gerahmte Poster in DE oder näher produziert und billiger nach DE schickt. Dafür vorher eine Musterbestellung machen.
- **WELCOME10:** erst nach der Preiserhöhung anlegen. Mit „mit Versandrabatten kombinierbar“, einmal pro Kunde. Mit den aktuellen Preisen macht jede WELCOME10-Bestellung Verlust.
- **Testbestellung:** Am billigsten ist 28 × 36 cm (58,12 €). Wird sie in Printify vor der Produktion storniert, kostet sie 0 €. Dafür muss die Order approval auf „Manually“ stehen.
- **Kleinunternehmer-Grenze** (seit 2025: 25.000 € Vorjahr / 100.000 € laufendes Jahr): Wird sie überschritten, enthalten deine Preise 19 % USt. Dafür kannst du dann die Printify-USt abziehen. Dann neu rechnen.
- **Printify überschreibt Preise:** Wenn ein Produkt in Printify erneut veröffentlicht wird, schickt Printify seine Verkaufspreise (und Variantennamen) wieder an Shopify. Deshalb die neuen Preise **auch in Printify** eintragen. Printify zeigt „USD“ an, überträgt aber die Zahl unverändert (84,99 in Printify = 84,99 € im Shop). Alternativ beim Veröffentlichen nur Titel, Beschreibung und Bilder auswählen.

## 6. Klickanleitungen für Julius

1. **Variante wählen** („gesund“ empfohlen) und im Chat sagen: „Preise Variante gesund anwenden“. Dann werden alle 1.350 Varianten per API aktualisiert. Der Plan dafür entsteht mit `python3 shop-checkliste/arbeit-2026-10-02/preise/rechnung.py --plan gesund <frischer-live-export.json>` (vorher Backup der alten Preise; das Skript bricht ab, wenn eine Größe keine Preisregel hat).
   Manuell geht es auch: https://admin.shopify.com/store/gexdm4-2q/products → alle Produkte auswählen → „Bearbeiten“ → im Massen-Editor die Spalte „Preis“ je Größe setzen.
2. **Preise in Printify nachziehen:** printify.com → My Products → Produkt → Edit → Preise je Größe eintragen (Zahl wie oben, „USD“ ignorieren) → Save. Nur „Publish“ klicken, wenn die Preise in Printify stimmen.
3. **Printify-Abrechnungswährung auf EUR stellen** (falls du mit Euro-Karte zahlst): Printify → Wallet → Payment details → Billing currency → EUR.
4. **USt-IdNr. bei Printify** besser nicht hinterlegen, solange du Kleinunternehmer bist. Sonst musst du die Erwerbsteuer selbst melden, bei gleicher Kostenlast. Das Verwenden der USt-IdNr. gilt als Verzicht auf die Erwerbsschwelle und bindet dich 2 Jahre (§ 1a Abs. 4 UStG). Kurz mit dem Steuerberater abstimmen.
5. **Nach Aktivierung von Shopify Payments** die echten Gebühren ablesen: https://admin.shopify.com/store/gexdm4-2q/settings/payments → Shopify Payments → Gebühren. Liegen sie über 2,1 % + 0,30 €, Bescheid geben, dann wird neu gerechnet.
6. **WELCOME10** erst nach Schritt 1 anlegen: https://admin.shopify.com/store/gexdm4-2q/discounts → Rabatt erstellen → Betrag von Bestellung → 10 % → „Mit Versandrabatten kombinierbar“ anhaken.
7. **LAUNCH-TEST-100 nach der Testbestellung deaktivieren:** https://admin.shopify.com/store/gexdm4-2q/discounts → „Testbestellung Launch (100 %)“ → Deaktivieren. Der Code gilt einmal, aber ohne Enddatum und ohne Mengenlimit im Warenkorb.

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

## Gegenprüfung (02.10.2026)

Die Prüfung lief gegen den Live-Stand im Shop (Admin-API), gegen die Dateien im Repo und gegen die Quellen. Im Shop wurde nichts geändert: Es gab nur Lesezugriffe und drei reine Berechnungen per `draftOrderCalculate`. Dabei entsteht kein Entwurf und keine Bestellung.

### Was geprüft wurde und was herauskam

| Prüfpunkt | Ergebnis |
|---|---|
| Preise live | 113 Produkte und 1.350 Varianten. Alle Varianten-IDs aus der Datendatei gibt es noch, neue sind nicht dazugekommen. Je Größe gibt es genau einen Preis (64,99 / 68,99 / 74,99 / 81,99 / 89,99 / 108,99 €) und keine Vergleichspreise. **Stimmt mit dem Bericht überein.** Die Optionswerte heißen live inzwischen „28 × 36 cm / Schwarz“ bzw. „Weiß“. |
| unitCost live | Höchstwerte je Größe: 25,38 / 29,48 / 35,83 / 41,95 / 50,39 / 65,75 €. Auch der Ausreißer bei 30 × 46 Weiß ist bestätigt. **Stimmt.** |
| Versandprofile | 26,39 / 28,99 / 34,69 USD je Poster, die Stufen steigen linear. Alle 1.350 Varianten liegen in Printify-Profilen. Ein gemischter Warenkorb wird addiert (2 × 28 × 36 + 1 × 61 × 91 = 77,76 €). **Stimmt.** |
| **Umrechnung Versand** | **Fehler:** Shopify rechnet heute mit 1 € ≈ 1,125 $, also 23,46 / 25,77 / 30,84 €. Der Checkout-Test zeigt ebenfalls 23,46 €. Im Bericht standen 23,19 / 25,48 / 30,49 € (Kurs 1,138 aus der Checkliste vom 29.09.). Dadurch war der DB je Poster um 0,32 bis 0,42 € zu hoch. **Behoben.** |
| Rechnung | Eigenes Skript `gegenpruefung.py` mit eigenem Code; die Mindestpreise rechnet es per Bisektion statt per Formel. Geprüft wurden 249 Zellen in den Tabellen 2a–2d, 3 und 4. Mit den Annahmen des Berichts gab es **0 Abweichungen**, die Formeln sind also richtig. Mit dem Live-Versand stimmen jetzt alle 249 Zellen. |
| Gebühren-Quellen | Shopify Payments DE 2,1 % + 0,30 €: mehrere Quellen von 2026 bestätigen das. PayPal 2,99 % + 0,39 €: PayPal-Seite direkt abgerufen, Stand 07.09.2026. Für PayPal Express fällt keine Shopify-Drittanbietergebühr an, solange Shopify Payments aktiv ist (Shopify-Hilfe). Printify Premium kostet ab 34,99 €/Monat bzw. 299 €/Jahr (Printify-Hilfe, Stand 25.09.2026). **Alles aktuell.** |
| USt Printify | Laut Printify-Hilfe (Stand 02.10.2026) berechnet Printify USt auf alle Lieferungen in die EU. Der Versand gehört zur Bemessungsgrundlage, es gilt der Satz des Ziellands, also 19 %. **Ohne USt-IdNr.** berechnet Printify die 19 % selbst. Du liegst als Kleinunternehmer unter der Erwerbsschwelle von 12.500 €, es ist also ein Fernverkauf. **Mit USt-IdNr.** berechnet Printify 0 %, dann schuldest du 19 % Erwerbsteuer und musst sie melden. Das bindet dich 2 Jahre (§ 1a Abs. 4 UStG). Die Kosten sind in beiden Fällen gleich, **die Logik im Bericht stimmt also.** Nicht belegbar ist die Aussage „Printify ist in DE registriert“, weil die Länderkarte in der Hilfe nur ein Bild ist. Für die Rechnung spielt das keine Rolle: „In both cases, VAT will be charged.“ |
| USt Shopify-Abo und Apps | Die 19 % fallen in jedem Fall an. Hast du die USt-IdNr. bei Shopify hinterlegt, läuft das über § 13b. Dann musst du für den betreffenden Monat eine USt-Voranmeldung abgeben (§ 18 Abs. 4a UStG), auch als Kleinunternehmer. Im Bericht stand nur die Kostenseite. **Ergänzt, bitte mit dem Steuerberater klären.** |
| Steuer im Checkout | 168 Varianten (14 neuere Produkte) stehen auf „steuerpflichtig“, die übrigen 1.182 nicht. Eine Probe per `draftOrderCalculate` mit Lieferland DE ergab 0,00 € Steuer. Es ist also keine Steuererhebung aktiv, und die Preise stimmen. Das Feld ist aber uneinheitlich: Wird später eine Steuererhebung eingerichtet, würden nur diese 168 Varianten besteuert. **Siehe Übergabe.** |
| Rabatte | WELCOME10 gibt es nicht (bestätigt). Der Gratisversand ist aktiv, gilt nur für DE und ist kombinierbar. **LAUNCH-TEST-100 ist aktiv**: 1 Nutzung, einmal pro Kunde, aber **ohne Enddatum und ohne Mengenlimit**. Eine einzige fremde Nutzung mit vollem Warenkorb würde komplett auf deine Kosten gehen. **Klickanleitung 7 ergänzt** (nach dem Test deaktivieren). |
| `rechnung.py --plan` | Das Skript kannte nur die Zoll-Titel der Datendatei. Ein frischer Live-Export (Titel „28 × 36 cm / Schwarz“) wäre mit einem KeyError abgebrochen. **Behoben:** Es versteht jetzt Zoll und cm, nimmt optional eine Exportdatei und bricht ab, wenn eine Größe keine Preisregel hat. Getestet mit den Live-Titeln (1.250 Varianten) und mit der Datendatei (1.350 Varianten, 6 Preisstufen richtig verteilt). |

### Vergessene Kosten (jetzt ergänzt)

- **Chargeback/Konflikt:** Shopify Payments verlangt 15 € je Fall (zurück, wenn du gewinnst). PayPal verlangt 14 € Konfliktgebühr bzw. 16 € bei Rückbuchung (PayPal-Seite, Stand 07.09.2026).
- **Erstattungen:** PayPal behält bei einer Rückzahlung die Festgebühr von 0,39 €. Bei Shopify Payments wird die Bearbeitungsgebühr nicht zurückerstattet.
- **Erwartete Risikokosten** je Bestellung: 3 % Widerrufe (Printify-Kosten verloren) und 0,5 % Chargebacks zu je 15 €. Das sind 1,82 € (28 × 36) bis 3,52 € (61 × 91). Danach bleiben bei „gesund“ mit Karte noch 22,84 bis 28,07 €, im schlechtesten Fall 9,14 bis 13,84 €. Bei „minimal“ bleiben im schlechtesten Fall 5,11 bis 6,60 €. **In beiden Varianten macht also keine Größe Verlust, auch nicht inklusive dieser Risiken.**
- **Währung:** Wird der Euro um 1 % schwächer, kostet dich jedes Poster 0,58 € (28 × 36) bis 1,15 € (61 × 91) mehr (inkl. USt). Die 2 % Puffer im schlechtesten Fall decken etwa 2 % Kursverlust ab.
- **Reklamationen** wegen Druck- oder Transportschäden laufen über Printify. Die Fristen und Nachweise stehen in der Printify-Hilfe; bitte vor dem Launch nachlesen.
- **Einkommensteuer:** Alle DB-Werte sind vor Steuern berechnet.

### Konsistenz der Empfehlung

- Beide Varianten steigen mit der Größe, und keine Größe macht Verlust (siehe oben). **Die Empfehlung „gesund“ bleibt richtig.**
- Schwachstelle: Bei „gesund“ hat **51 × 76 cm den kleinsten Puffer** (11,93 € im schlechtesten Fall, 9,14 € nach Risiko), obwohl es das zweitteuerste Format ist. Wer mehr Puffer will, nimmt **124,99 € statt 119,99 €**. Dann bleiben 16,29 € im schlechtesten Fall, und die Staffel lautet +5 / +10 / +10 / +15 / +25 €. Das ist optional, die Empfehlung im Bericht bleibt unverändert.

### Vorher/Nachher (DB je Poster)

| Größe | Karte aktuell | schlechtester Fall aktuell | schlechtester Fall minimal | schlechtester Fall gesund |
|---|---|---|---|---|
| 28 × 36 cm | 5,53 → 5,21 € | -2,60 → -2,93 € | 8,75 → 8,42 € | 14,86 → 14,53 € |
| 30 × 46 cm | 4,56 → 4,24 € | -4,09 → -4,41 € | 8,14 → 7,81 € | 14,25 → 13,92 € |
| 41 × 51 cm | 2,88 → 2,56 € | -6,56 → -6,88 € | 8,29 → 7,96 € | 15,27 → 14,94 € |
| 46 × 61 cm | 2,45 → 2,13 € | -7,87 → -8,20 € | 7,84 → 7,52 € | 16,57 → 16,25 € |
| 51 × 76 cm | -2,49 → -2,83 € | -13,91 → -14,26 € | 8,79 → 8,44 € | 12,28 → 11,93 € |
| 61 × 91 cm | -8,12 → -8,54 € | -22,05 → -22,47 € | 9,38 → 8,96 € | 13,75 → 13,32 € |

### Was behoben wurde

- `rechnung.py`: Versand auf die Live-Umrechnung umgestellt (23,46 / 25,77 / 30,84 €); `--plan` versteht jetzt Zoll und cm, nimmt optional eine Exportdatei und bricht bei unbekannten Größen ab.
- `preise-empfehlung.json` neu erzeugt.
- `bericht.md`: Die Tabellen 1, 2a–2d, 3 und 4 sowie alle Zahlen im Text sind korrigiert. Klickanleitung 1 (frischer Export), 4 (2 Jahre Bindung) und 7 (Testcode deaktivieren) sind ergänzt.
- Neu: `gegenpruefung.py` (unabhängige Nachrechnung; mit `--schreibe` aktualisiert es die Tabellen).
- Backup des Vorher-Stands: `shop-checkliste/backup-2026-10-02/preise/vor-gegenpruefung-*`.

### Übergaben

- **Steuer-Feld der Varianten** (Besitz: Produktdaten, nicht Preise): 168 Varianten der 14 neueren Produkte stehen auf „steuerpflichtig“, die übrigen 1.182 nicht. Solange keine Steuererhebung eingerichtet ist, wirkt sich das nicht aus. Vereinheitlichen spätestens dann, wenn du die Kleinunternehmergrenze überschreitest.
- **Preisänderung:** Wie im Bericht beschrieben, aber vorher einen frischen Live-Export ziehen und `rechnung.py --plan gesund <export.json>` darauf laufen lassen.

### Quellen der Gegenprüfung

- PayPal Gebühren DE (Stand 07.09.2026; Konflikt 14 €, Rückbuchung 16 €, Festgebühr bei Erstattung einbehalten): https://www.paypal.com/de/business/paypal-business-fees
- Printify: USt auf Bestellungen (Stand 02.10.2026): https://help.printify.com/hc/en-us/articles/4483635869073
- Printify: Berechnung der USt (Versand zählt mit, Stand 10.09.2026): https://help.printify.com/hc/en-us/articles/4483628906513
- Printify Premium (Stand 25.09.2026): https://help.printify.com/hc/en-us/articles/4483625875601
- Printify: Währung und Abrechnung (Stand 27.09.2026): https://help.printify.com/hc/en-us/articles/12203640151953
- Printify: Verkauf in anderer Währung (Zahl wird 1:1 übertragen, Stand 09.08.2026): https://help.printify.com/hc/en-us/articles/4483625794577
- Shopify Payments DE 2026: https://falkeconsulting.com/blogs/blog/shopify-gebuehren · https://www.we-site.de/blog/shopify-payments
- Shopify Chargeback-Gebühr EU 15 €: https://www.chargeback.io/blog/whats-the-shopify-chargeback-fee
- Live-Daten: Admin-API vom 02.10.2026 (Varianten, unitCost, Versandprofile, Rabatte, `draftOrderCalculate`)
