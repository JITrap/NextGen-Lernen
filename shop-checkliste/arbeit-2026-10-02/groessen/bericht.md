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

**B) Printify: beim erneuten Veröffentlichen Optionen schützen**
1. Printify → My Products → Produkt → „Publish“.
2. Bei „Sync product details“ **Colors und Sizes nur anhaken, wenn wirklich neue Größen oder Farben dazukommen.** Sonst werden Shopify-Optionen auf „Size“ / „11″ x 14″“ / „Black“ zurückgesetzt.
3. Wenn das passiert ist (z. B. nach dem Ergänzen von Größen beim Dressurpferd): Bescheid geben. Die Umbenennung lässt sich per Agent erneut ausführen. Das Theme funktioniert in der Zwischenzeit weiter, nur Checkout und Mails zeigen dann wieder Zoll.

**C) Sichtprüfung nach Shop-Passwort / OFE-v3-Vorschau**
Produktseite (Größe/Rahmen, Buttons „28 × 36 cm“), 3D-Viewer und Raum-Galerie beim Größenwechsel, Warenkorb, Quick-Add Desktop und Handy, Seite Gallery Wall, Testbestellung (Checkout und Bestellmail zeigen „46 × 61 cm / Schwarz“).

## 7. Rückbau

- Optionen und Beschreibungen: `python3 arbeit-2026-10-02/groessen/rueckbau.py optionen|beschreibungen` erzeugt die Rückbau-Mutationen aus `backup-2026-10-02/groessen/optionen-vorher.json` bzw. `beschreibungen-vorher.json`. Ich habe das Skript getestet: 226 Options- und 113 Beschreibungs-Mutationen.
- Theme: Dateien aus `backup-2026-10-02/groessen/ofe-v3/` per themeFilesUpsert zurückspielen.
- Seiten: `backup-2026-10-02/groessen/seiten/`.
- Plan mit allen IDs: `arbeit-2026-10-02/groessen/umbenennung-plan.json`.

## 8. Übergaben

- **Dressurpferd / Printify-Bereich:** Wenn Größen in Printify ergänzt und mit „Sizes“ veröffentlicht werden, kommen bei diesem Produkt „Size“ und Zoll-Werte zurück. Danach Umbenennung für dieses Produkt wiederholen (Größe/Rahmen, cm) und Beschreibung „Größen:“ ergänzen.
- **Preis-Bereich und alle Skripte, die Variantentitel lesen:** Variantentitel lauten jetzt „46 × 61 cm / Schwarz“ statt „18″ x 24″ / Black“. Der Datenschnappschuss `daten/produkte-2026-10-02.json` hat noch die alten Titel. Zuordnung am besten über Varianten-ID oder SKU.
- **Später Google & YouTube-Kanal:** Option „Rahmen“ wird nicht automatisch als Farbe erkannt. Falls der Kanal kommt, die Zuordnung in der App einstellen.
