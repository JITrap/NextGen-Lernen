# Größen in Zentimetern + Quick-Add – Bericht 02.10.2026

Bereich: **groessen** · Shop gexdm4-2q · Ziel-Theme „LimitlessPoster OFE v3“ (194580283725, unveröffentlicht)

## Kurzfassung

- Alle **113 Produkte** heißen jetzt in Shopify **„Größe“** (Werte wie „28 × 36 cm“, Querformat „36 × 28 cm“) und **„Rahmen“** („Schwarz“ / „Weiß“).
  Varianten-IDs, SKUs und Preise sind unverändert (per Skript gegen den Vorher-Stand geprüft: 0 Abweichungen).
- Alle **113 Produktbeschreibungen** nennen die Größen nur noch in cm (Zoll-Klammern entfernt, Server-Stand per Skript geprüft: 0 Abweichungen, 0 Zoll-Zeichen).
- Seiten **Größen-Guide** und **Hilfe & FAQ** auf cm umgestellt.
- Theme OFE v3: 10 Dateien so angepasst, dass alle Funktionen (Größenwähler, 3D-Viewer, Raum-Galerie, Gallery Wall, Rahmen-Punkte, Warenkorb, Sticky-Leiste) mit den neuen **und** den alten Optionsnamen laufen. Zoll wird Kunden nirgends mehr angezeigt.
- Quick-Add-Fenster: Ursache gefunden und bereits von der parallelen Quick-Add-Runde (13:58 UTC, im Browser geprüft) behoben. Ich habe den Fix geprüft und nicht überschrieben.

## 1. Recherche: Ist das Umbenennen Printify-sicher?

Quellen (Printify-Hilfe, Stand 09/2026):
- „Why is there a product missing from the order in Printify?“: Ein Artikel fehlt im Printify-Auftrag, wenn die **SKU** im Shop geändert wurde – Zuordnung läuft über SKU.
- „What should I keep in mind when selling on Shopify?“: Probleme entstehen, wenn Tools **Produkt-/Varianten-IDs oder SKUs** ändern.
- „How do I use selective publishing…“ / „Why was my product information overwritten?“: Beim erneuten Veröffentlichen aus Printify werden nur die angehakten Bereiche überschrieben; wer Farben/Größen/Varianten neu veröffentlicht, bekommt die Printify-Namen zurück („Size“, „11″ x 14″“, „Black“).
- Shopify-Community (POD-Varianten übersetzen): keine Gegenbelege, Printify-Support verweist auf Übersetzungs-Apps.

Ergebnis: `productOptionUpdate` ändert nur Namen. IDs und SKUs bleiben → **Bestellweiterleitung an Printify bleibt intakt.** Einziges Risiko: ein späterer Printify-Publish mit „Colors/Sizes“ setzt die englischen Zoll-Namen zurück. Das Theme versteht beide Schreibweisen, es bricht also nichts. Nur Checkout und Mails zeigen dann wieder Zoll (siehe Klickanleitung B).

## 2. Entscheidung: Variante A (Optionen in Shopify umbenennen)

Begründung:
- Nur Variante A erreicht Stellen, die das Theme nicht steuert: **Checkout, Bestell- und Versandmails, Shop-App** (alle 113 Produkte sind dort gelistet), Kundenkonto, Rechnungen, Admin-Bestellungen, Filter.
- Printify-sicher (siehe 1), Theme-Code war anpassbar.
- Live-Theme v2.0 hat keine Größen-Logik und zeigt die Optionswerte direkt an. Es zeigt jetzt also ebenfalls „28 × 36 cm“ und „Schwarz“, was eine Verbesserung ist. Der alte cm-Umrechner hätte cm-Werte falsch umgerechnet (aus 28 × 36 cm wäre 71 × 91 cm geworden), deshalb wurde **zuerst das Theme** angepasst und erst danach umbenannt.

Ablauf: Theme-Dateien hochgeladen (14:09 UTC) → Test an **einem** Produkt (Vintage Formel 1, Querformat, 14:12 UTC, Ergebnis geprüft) → restliche 112 in 4 Batches → Gesamtprüfung.

Zuordnung (wie im Größen-Guide, gerundet): 11″=28, 12″=30, 14″=36, 16″=41, 18″=46, 20″=51, 24″=61, 30″=76, 36″=91 cm.

| Vorher | Nachher |
|---|---|
| Option „Size“ | „Größe“ |
| 11″ x 14″ / 12″ x 18″ / 16" x 20" / 18″ x 24″ / 20" x 30" / 24″ x 36″ | 28 × 36 cm / 30 × 46 cm / 41 × 51 cm / 46 × 61 cm / 51 × 76 cm / 61 × 91 cm |
| Querformat 14″ x 11″ … 36″ x 24″ | 36 × 28 cm … 91 × 61 cm |
| Option „Color“: Black / White | „Rahmen“: Schwarz / Weiß |
| Variantentitel „18″ x 24″ / Black“ | „46 × 61 cm / Schwarz“ |

Hinweis: Das Dressurpferd-Produkt (gid://shopify/Product/10762180460877) hat nur 3 Größen (30 × 46, 51 × 76, 61 × 91 cm). Ich habe es mit umbenannt.

## 3. Theme OFE v3 – geänderte Dateien

Vorher-Stand: `backup-2026-10-02/groessen/ofe-v3/…`, Nachher: `arbeit-2026-10-02/groessen/ofe-v3/…` (MD5 im Theme = lokal geprüft).

| Datei | Änderung |
|---|---|
| snippets/limitless-size.liquid | Zentraler Helfer: versteht „28 × 36 cm“ **und** „11″ x 14″“; Optionsnamen Größe/Size/Format bzw. Rahmen/Color/Farbe; Ausgabe nur noch cm (Zoll-Zeile in Buttons und aria-label entfernt); neue Ausgabe `kind`. Mit Ruby-Liquid getestet (27 Fälle). |
| snippets/variant-main-picker.liquid | Erkennung Größe/Rahmen über `kind` statt fest „size“/„color“ |
| sections/product-information.liquid | Sticky-Leiste: Rahmen/Weiß erkannt |
| snippets/cart-products.liquid | Warenkorb-Rahmenbild: Rahmen/Weiß erkannt |
| snippets/limitless-room-gallery.liquid | Raum-Galerie: Größe/Rahmen/Weiß erkannt |
| snippets/limitless-media.liquid | Mockup-Auswahl erkennt „41 × 51 cm“ wie „16 x 20“ |
| blocks/limitless-3d-viewer.liquid | Liquid + JS: cm-Werte, „Weiß“ |
| blocks/limitless-swatches.liquid | Rahmen-Punkte bei Option „Rahmen“, Tooltip deutsch |
| assets/limitless-rooms.js | `parseSize` versteht cm (Raumskalierung, Chip, Sticky-Titel) |
| assets/limitless-rooms.css | Größen-Buttons einzeilig (min-height 48 px), sonst unverändert (Quick-Add-Block der Parallelrunde erhalten) |

`blocks/*` war keinem Bereich zugeteilt. Ich habe nur die zwei Größen-Blöcke angefasst.

## 4. Texte

- Produktbeschreibungen: „ca. 28 × 36 cm (11″ × 14″)“ → „ca. 28 × 36 cm“ (113/113). SEO-Titel und SEO-Beschreibungen von Produkten und Kollektionen enthielten keine Zoll-Angaben.
- Seite Größen-Guide: Zoll-Spalte entfernt, Beispiele in cm, Hinweis „auf ganze Zentimeter gerundet“.
- Seite Hilfe & FAQ: „Jedes Motiv gibt es in bis zu sechs Größen – von ca. 28 × 36 cm bis 61 × 91 cm.“ (statt Zoll; „bis zu“, weil das Dressurpferd nur 3 Größen hat).
- Theme-Texte (Templates, Sections, de.json) enthielten keine Zoll-Angaben für Kunden.

## 5. Quick-Add („+“-Icon auf der Produktkarte)

Implementierung: `snippets/quick-add.liquid` (Button), `assets/quick-add.js` (lädt die Produktseite, übernimmt `[data-product-grid-content]`), `snippets/quick-add-modal(-styles).liquid`. Diese Dateien sind in OFE v3 und Live v2.0 identisch (Stock-Horizon).

Ursache: In OFE v3 rendert die Produktseite statt der Horizon-Galerie die **Raum-Galerie** (`limitless-room-gallery`, Einstellung „Raum-Galerie“ an). Das Fenster ist für die Standard-Galerie gebaut. Folgen: kleine 4:3-Bühne mit leerer Fläche darunter, vertikale Szenen-Tabs („Ansichten“) mit abgeschnittenen Labels, Chip über „Vergrößern“. Am Handy lag die Galerie in einer ca. 76 px breiten Zelle und der Chip über dem Titel. Dazu war der Kauf-Block im Fenster `sticky` und verdeckte die Rahmen-Auswahl.

Fix: von der parallelen Quick-Add-Runde am 02.10. um 13:58 UTC in `assets/limitless-rooms.css` eingespielt und bei 1280 × 800 sowie 390 × 844 im Theme-Preview geprüft (Bericht `arbeit-2026-10-02/quick-add/bericht.md`). Meine Code-Analyse kam auf dieselben Ursachen. Ich habe den Block unverändert gelassen.

Offen bzw. optional:
- Handy-Vorschau im Fenster: Das Motiv ist in der kleinen Szene sehr klein. Möglich wäre ein näherer Wandausschnitt im Fenster (`--lp-wall-base: 105`, Möbel und Boden aus). Das ist noch nicht eingespielt, weil es nicht im Browser geprüft ist.
- Gewählter Größen- bzw. Rahmen-Button ist nur schwach markiert (Punkt aus dem Quick-Add-Bericht).
- Live v2.0 hat die Raum-Galerie nicht. Falls Julius das Problem im Live-Theme gesehen hat, erledigt es sich mit dem Publish von OFE v3.

## 6. Klickanleitungen für Julius

**A) Kollektionsfilter prüfen (Search & Discovery)**
1. https://admin.shopify.com/store/gexdm4-2q/apps → „Search & Discovery“ öffnen → „Filter“.
2. Falls dort Filter „Size“ oder „Color“ stehen: entfernen und „Größe“ bzw. „Rahmen“ hinzufügen (Typ: Produktoption) → Speichern.
3. Falls kein Größen-Filter existiert: optional „Größe“ hinzufügen.

**B) Printify: beim erneuten Veröffentlichen Optionen schützen** (nach der Gegenprüfung korrigiert)
1. Printify → My Products → Produkt → „Publish“.
2. Printify hat für Varianten **nur ein gemeinsames Häkchen: „Colors, sizes, prices, and SKUs“**. Farben und Größen lassen sich nicht getrennt von Preisen und Lagerstand veröffentlichen. Dieses Häkchen setzt die Shopify-Optionen auf „Size“ / „11″ x 14″“ / „Black“ zurück, und zwar auch dann, wenn du es nur für Preise oder den Lagerstand setzt.
3. Deshalb: Preise am besten direkt in Shopify ändern und in Printify nur speichern, ohne „Publish“. Veröffentliche nur, wenn es nötig ist (neue Größen oder Farben, neues Motiv, Lagerstand).
4. Hast du veröffentlicht, aktuellen Stand exportieren und `python3 arbeit-2026-10-02/groessen/neu-anwenden.py <export.json>` ausführen. Das kann auch ein Agent für dich tun. Das Skript erzeugt die Mutationen mit den dann gültigen IDs. Das Theme läuft in der Zwischenzeit weiter, nur Checkout, Mails und Shop-App zeigen bis dahin wieder Zoll.
5. Achtung: Laut Printify wird bei geänderten Farben oder Größen (z. B. Größen beim Dressurpferd ergänzen) **das ganze Produkt überschrieben** (Titel, Beschreibung, Bilder). Danach Titel, Beschreibung, SEO und Bilder prüfen.

**C) Sichtprüfung nach Shop-Passwort / OFE-v3-Vorschau**
Produktseite (Größe/Rahmen, Buttons „28 × 36 cm“), 3D-Viewer und Raum-Galerie beim Größenwechsel, Warenkorb, Quick-Add Desktop und Handy, Seite Gallery Wall, Testbestellung (Checkout und Bestellmail zeigen „46 × 61 cm / Schwarz“). **Wichtig bei der Testbestellung:** In Printify unter „Orders“ muss die Bestellung bei **„Printify orders“ mit allen Positionen** auftauchen, nicht unter „Other orders“. Erst das beweist, dass die Zuordnung nach der Umbenennung klappt. Taucht sie unter „Other orders“ auf, Rückbau nach Abschnitt 7 ausführen und Bescheid geben.

## 7. Rückbau

- Optionen und Beschreibungen: `python3 arbeit-2026-10-02/groessen/rueckbau.py optionen|beschreibungen` erzeugt die Rückbau-Mutationen aus `backup-2026-10-02/groessen/optionen-vorher.json` bzw. `beschreibungen-vorher.json`. Ich habe das Skript getestet: 226 Options- und 113 Beschreibungs-Mutationen.
- Theme: Dateien aus `backup-2026-10-02/groessen/ofe-v3/` per themeFilesUpsert zurückspielen.
- Seiten: `backup-2026-10-02/groessen/seiten/`.
- Plan mit allen IDs: `arbeit-2026-10-02/groessen/umbenennung-plan.json`.

## 8. Übergaben

- **Dressurpferd / Printify-Bereich:** Wenn Größen in Printify ergänzt und mit „Sizes“ veröffentlicht werden, kommen bei diesem Produkt „Size“ und Zoll-Werte zurück. Danach Umbenennung für dieses Produkt wiederholen (Größe/Rahmen, cm) und Beschreibung „Größen:“ ergänzen.
- **Preis-Bereich und alle Skripte, die Variantentitel lesen:** Variantentitel lauten jetzt „46 × 61 cm / Schwarz“ statt „18″ x 24″ / Black“. Der Datenschnappschuss `daten/produkte-2026-10-02.json` hat noch die alten Titel. Zuordnung am besten über Varianten-ID oder SKU.
- **Später Google & YouTube-Kanal:** Option „Rahmen“ wird nicht automatisch als Farbe erkannt. Falls der Kanal kommt, die Zuordnung in der App einstellen.
- **Preis-Bereich (aus der Gegenprüfung):** Der Preisbericht empfiehlt, die Preise in Printify einzutragen und dann gegebenenfalls „Publish“ zu klicken. Dieser Publish läuft über das Häkchen „Colors, sizes, prices, and SKUs“ und setzt Größe und Rahmen auf Zoll und Englisch zurück. Hinweis in der Preis-Anleitung ergänzen: Preise direkt in Shopify ändern und in Printify nur speichern. Nach einem Publish `groessen/neu-anwenden.py` ausführen.
- **Dressurpferd-Bereich (aus der Gegenprüfung):** Ergänzt Printify Größen, wird das ganze Produkt überschrieben (Titel, Beschreibung, Bilder, Optionen). Danach Titel, Beschreibung und SEO prüfen und `neu-anwenden.py` ausführen.

## 9. Gegenprüfung (02.10.2026, unabhängiger Durchgang)

Geprüft wurde der Live-Stand in Shopify und im Theme, nicht nur dieser Bericht.

### Was geprüft wurde

| Prüfung | Ergebnis |
|---|---|
| **Theme OFE v3**: MD5 aller 10 geänderten Dateien im Theme gegen `arbeit-…/ofe-v3/` | 10/10 identisch. Seit dem Upload (14:09 UTC) hat niemand diese Dateien geändert. Die übrigen 361 Textdateien entsprechen dem Download von 13:54 (Ausnahme: `config/settings_data.json` und `templates/list-collections.json`, beide gehören zum URLs-Bereich). |
| **Diff jeder Datei gegen ihr Backup** | Keine Liquid-Syntaxfehler, keine kaputte Logik. Alle Stellen, die Größe oder Rahmen lesen, kennen jetzt beide Schreibweisen: Größenwähler, Sticky-Leiste, Warenkorb, Raum-Galerie, Mockup-Auswahl, 3D-Viewer (Liquid und JS), Rahmen-Punkte und Gallery Wall (über den Helfer). |
| **Ganzes Theme nach vergessenen Stellen durchsucht** (`'size'`, `'color'`, `Black/White`, `″`, `2.54`, `options[…]`) | Keine weitere Stelle. Hochformat oder Querformat erkennen Produktkarte, Szene, Rahmen, Poster-Wall und Scroll-Showcase über `options_with_values[0]` und den Helfer (`ratio`). Bei allen 113 Produkten ist „Größe“ Option 1. Zoll steht nur noch in Code-Kommentaren. Die Horizon-Swatches arbeiten mit Farbmustern, nicht mit Optionsnamen. |
| **Helfer `limitless-size` eigenständig getestet** (Ruby-Liquid 5.14, 34 Fälle, inkl. Großschreibung, geschütztes Leerzeichen, unbekannte Werte) | Alle 9 cm-Größen hoch und quer ergeben die richtigen Verhältnisse (11/14 … 36/24). `w`, `h`, `label` und `text` liefern nur cm. „Weiß“, „WEISS“ und „White“ ergeben jeweils „Weiß“. `kind` erkennt Größe/Size/GRÖSSE und Rahmen/Color. |
| **JS `parseSize` (Raum-Galerie) und `parseFormat` (3D-Viewer)** mit Node getestet | cm- und Zoll-Werte ergeben dieselben cm-Werte. Querformat bleibt quer. „Weiß“ wird als weißer Rahmen erkannt. |
| **Shopify: alle 113 Produkte** (nicht nur 10 Stichproben) gegen `optionen-vorher.json` und den Preis-Stand `daten/produkte-2026-10-02.json` | 0 Abweichungen. Optionen heißen genau „Größe“ (Position 1) und „Rahmen“ (Position 2). Options- und Wert-IDs sind gleich geblieben, ebenso alle 1.350 Varianten-IDs, SKUs und Preise. Jeder alte Wert hat den erwarteten cm- bzw. deutschen Namen. Variantentitel = Optionswerte. Jeder Wert hat Varianten, im Text stehen nur normale Leerzeichen und „ד. |
| **Bilder-Zuordnung**: alle Varianten haben ein Bild. Schwarz: gemeinsames Rahmenbild, Weiß: eigenes Mockup je Größe | Unverändert und plausibel. Bei 562 Varianten nennt der Alt-Text die Rahmenfarbe, und sie passt jedes Mal zur Variante. |
| **Beschreibungen** (113) gegen `beschreibungen-vorher.json` | Einzige Änderung: die Zoll-Klammer fehlt jetzt. Die cm-Größen im Text stimmen bei allen 113 Produkten mit den Optionen überein (Querformat und Dressurpferd eingeschlossen). |
| **Seiten Größen-Guide und Hilfe & FAQ** live | Kein Zoll mehr. Die Werte passen zur Zuordnungstabelle. |
| **Live-Theme v2.0** (sichtbar, bis OFE v3 veröffentlicht wird) | Es hat keine eigene Größen-Logik und zeigt die neuen Werte direkt an. Die 3D-Ansicht dort nutzt nur `custom.poster_3d_url` (größenunabhängig). Nichts ist kaputt. |
| **Rückbau-Skript** | Es erzeugt korrekte Mutationen aus dem Backup. Der Seiten-Backup von Hilfe & FAQ enthält nur den geänderten Absatz. Das reicht für den Rückbau. |

Stichproben im Detail (alle ohne Abweichung; Preis 46 × 61 bzw. 61 × 46 cm):

| Produkt | Format | Größe | Varianten | Preis 46×61 |
|---|---|---|---|---|
| vintage-formel-1-racing-poster | quer | 36 × 28 … 91 × 61 cm (6) | 12 | 81,99 € |
| dressurpferd-equestrian-poster | hoch | 30 × 46 … 61 × 91 cm (3) | 6 | – |
| leopard-mit-perlenkette-poster | quer | 36 × 28 … 91 × 61 cm (6) | 12 | 81,99 € |
| matchday-von-oben-tennis-poster | quer | 36 × 28 … 91 × 61 cm (6) | 12 | 81,99 € |
| tiger-im-pool-vintage-poster | quer | 36 × 28 … 91 × 61 cm (6) | 12 | 81,99 € |
| leopard-auf-ast-schwarz-weiss-poster | quer | 36 × 28 … 91 × 61 cm (6) | 12 | 81,99 € |
| life-is-tough-motivationsposter | hoch | 28 × 36 … 61 × 91 cm (6) | 12 | 81,99 € |
| batman-silhouette-red-noir-poster | hoch | 28 × 36 … 61 × 91 cm (6) | 12 | 81,99 € |
| yacht-auf-offener-see-poster | hoch | 28 × 36 … 61 × 91 cm (6) | 12 | 81,99 € |
| make-them-wonder-messi-poster | hoch | 28 × 36 … 61 × 91 cm (6) | 12 | 81,99 € |

### Was gefunden wurde

1. **Klickanleitung B war zu optimistisch (korrigiert).** In Printify gibt es kein getrenntes Häkchen für Farben und Größen. Es gibt nur „Colors, sizes, prices, and SKUs“, und Printify empfiehlt genau dieses Häkchen auch für Preis- und Lager-Updates. Die Rückkehr zu „Size“, Zoll und „Black“ ist also nicht nur beim Ergänzen von Größen wahrscheinlich, sondern bei jedem solchen Publish. Laut Printify überschreibt eine Änderung an Farben oder Größen außerdem das **ganze Produkt**. Quellen: Printify-Hilfe „How do I use selective publishing…“, „Why was my product information overwritten?“, „What happens when some product variants go out of stock?“, „How can I update my retail prices?“.
2. **Printify-Schluss: plausibel, aber erst mit der Testbestellung bewiesen.** Belegt ist, dass Printify Bestellungen über die SKU zuordnet: Eine geänderte SKU führt zu einer fehlenden Position. Die SKUs sind nachweislich unverändert, 1.350 von 1.350. Printify rät aber allgemein davon ab, Produktdaten im Shop zu ändern („Orders will be synced … using the information that is available on the Printify side“). Ein Beleg, dass nur die SKU zählt, steht noch aus. Printify selbst konnte ich nicht prüfen, weil es keinen gültigen API-Zugang gab. Deshalb gibt es bei der Testbestellung jetzt einen Prüfschritt: Die Bestellung muss unter „Printify orders“ stehen, nicht unter „Other orders“ (Abschnitt 6 C).
3. **Veralteter Produkt-Metafeld-Inhalt, ohne aktuelle Wirkung:** `custom.poster_3d_v4` (bei 99 Produkten) ordnet 3D-Modelle über die **alten Zoll-Werte** zu (`"11″ x 14″": "c1114"`). Weder OFE v3 noch Live v2.0 lesen dieses Feld. Es ist also nichts kaputt. Wer später einen 3D-Viewer auf v4-Basis baut, muss die Werte über `limitless-size` (Ausgabe `in`) in Zoll umrechnen oder die Schlüssel auf cm ändern. Ich habe nichts geändert, weil es keinen Nutzer des Feldes gibt.
4. **Kleinigkeit Alt-Texte:** Bei 2 Querformat-Produkten (Leopard auf Ast; Neymar/Cristiano/Messi) nennen die 5 Weiß-Mockups die Größe hochkant („ca. 28 × 36 cm“ statt „36 × 28 cm“). Die Angabe ist nicht falsch, aber uneinheitlich. Ich habe das nicht geändert (Medien gehören keinem Bereich fest, und es hat keine Wirkung auf Kunden).
5. **Quick-Add-Fix:** Alle Regeln gelten nur im Fenster (`.quick-add-modal__content`). Die einzige Ausnahme ist gewollt und im Quick-Add-Bericht beschrieben: Auf der **Produktseite** stehen die Raum-Labels unter den Vorschaubildern jetzt in normaler Schreibweise mit „…“ statt in Großbuchstaben. Das ist noch nicht im Browser bestätigt, also bei der Sichtprüfung C mit ansehen. Der Quick-Add-Block in `limitless-rooms.css` ist Byte für Byte gleich mit dem der Quick-Add-Runde.
6. Kleinigkeiten ohne aktuelle Wirkung: Den Rahmen-Tooltip in `blocks/limitless-swatches.liquid` würden Sonderzeichen in anderen Farbnamen doppelt escapen. Der Helfer erkennt ein schmales geschütztes Leerzeichen (U+202F) nicht. Beides kommt bei den heutigen Werten nicht vor, deshalb habe ich am Theme nichts geändert.

### Was behoben bzw. ergänzt wurde

- Abschnitt 6 B (Printify) korrigiert, Abschnitt 6 C um den Printify-Import-Check ergänzt.
- Neues Skript `arbeit-2026-10-02/groessen/neu-anwenden.py`: Es baut die Umbenennung aus dem **aktuellen** Stand neu, mit den dann gültigen IDs, und überspringt Produkte, die schon stimmen. Test: Aus dem Vorher-Stand entsteht genau der ausgeführte Plan (113/113 identisch). Auf den Live-Stand angewendet meldet es „0 Produkte zu ändern“. Die erzeugte Mutation ist gegen das Admin-Schema validiert.
- Shop und Theme: keine Änderung nötig. Ich habe keinen sicheren Fehler gefunden.

### Gesamturteil

Bereich **erledigt**. Umbenennung, Texte und Theme-Anpassung sind sauber und vollständig. Es bleiben zwei Restrisiken außerhalb des Codes: (a) Die Testbestellung muss den Printify-Import bestätigen. (b) Jeder Printify-Publish mit Varianten-Häkchen macht die Umbenennung rückgängig. Dann `neu-anwenden.py` ausführen.
