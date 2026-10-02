---
tags: [limitlessposter, changelog]
datum: 2026-09-29
---
# Änderungsprotokoll 29.09.2026 – Komplett-Check Shop + Printify, Versand-Fix

Auftrag von Julius: „Shopify und Printify komplett durchgehen, schauen was fehlt und was erledigt ist, Checkliste updaten.“

## Vorgehen
- Read-only-Audit mit 5 Prüfern (Recht, Checkout, Produkte, Theme, Betrieb) + Gegenprüfer. Alle 69 Checklisten-Punkte bewertet, Befunde in `audit/` (Scratchpad) gesichert.
- Printify: kein API-Zugang. Geprüft wurde, was Printify in Shopify hinterlässt (Versandprofile, Standort, Produkte), plus Printify-Hilfeartikel.

## Kritischer Befund: Versandkosten zurückgefallen
- Printify hat seine 5 Versandprofile („Standard: Print Pigeons …“, Version 342–346, neue Location-Group-IDs) neu synchronisiert, vermutlich beim Veröffentlichen der Motive am 17./21.09. Der 0-€-Fix vom 03.09. war damit weg.
- Alle 1.350 Varianten hingen an Profilen mit DE-Tarif 26,39 $ je Poster. Probeberechnung (draftOrderCalculate, Esslingen): **1 Poster 23,19 €, 2 Poster 46,39 €, 61×91: 30,49 €**. Überall im Shop steht „versandkostenfrei“.
- **Fix:** automatischer Rabatt **„Kostenloser Versand Deutschland“** (`discountAutomaticFreeShippingCreate`, gid://shopify/DiscountAutomaticNode/1806649098573): nur DE, ohne Mindestbestellwert, ohne Enddatum, kombinierbar mit Bestell- und Produktrabatten. Wirkt unabhängig von den Printify-Profilen.
- **Verifiziert:** 1 Poster Versand 23,19 → 0,00 €; 2 Poster 46,39 → 0,00 €, Gesamt = Warenwert.
- **LAUNCH-TEST-100** (`gid://shopify/DiscountCodeNode/1798567657805`) war nicht mit Versandrabatten kombinierbar: Testbestellung hätte 23,19 € gekostet. `combinesWith.shippingDiscounts = true` gesetzt. Probeberechnung mit Code: **0,00 € gesamt**.
- Merkregel: Jeder künftige Rabattcode braucht „mit Versandrabatten kombinierbar“.

## Direkt von Claude korrigiert (29.09.)
- Collection `bestseller`: Titel „Bestseller“ → **„Favoriten“**, Text und SEO neutral („Kuratierte Highlights …“), Handle bleibt. Grund: 0 Bestellungen, „am häufigsten bestellt“ wäre irreführend.
- Seite „Über uns“: Link „Schreib uns“ `/pages/kontakt` (existiert nicht) → `/pages/contact`.
- Vorher-Zustand gesichert: `backup-2026-09-29/direkt/vorher.json` (Scratchpad).

## Per Workflow und Agenten (29.09.–01.10.)
Drei Container-Neustarts haben laufende Workflows abgebrochen. Alle Schritte wurden danach gegen den Live-Stand geprüft und, wo nötig, nachgeholt. Berichte und Vorher-Stände: `shop-checkliste/backup-2026-09-29/` im Repo.
- **Theme OFE v3** (unveröffentlicht, 29.09. 07:53–08:07 UTC): Startseite „Unsere Favoriten“, Hero-Button „Favoriten ansehen“, 404-Button „FAVORITEN“; Editorial-Produkt Ferrari → `focus-motivational-poster-classical-sculpture-wall-art`; Raum „Wohnzimmer“ Messi → `framed-poster-queens-dont-compete-they-reign-leopard-wall-art`; Hilfe-FAQ Erstattung passend zur Widerrufsbelehrung; `locales/de.json` taxes_included und alle duties_*-Keys auf § 19; `meta theme-color` aus Farbschema 1 (#141215).
- **Cookie-Link:** neues Snippet `snippets/lp-cookie-settings.liquid`, eingebunden vor `</body>` in `layout/theme.liquid`. Klicks auf „Datenschutz-Einstellungen“ (data-sharing-opt-out) öffnen `privacyBanner.showPreferences()`, sonst normale Navigation. Live erst nach Publish testbar.
- **Theme umbenannt:** 194124087629 → „ARCHIV – OFE v3 WIP (nicht veröffentlichen)“.
- **Collections:** 12 Beschreibungen „im klaren Rahmen in Schwarz oder Weiß“, SEO unverändert.
- **Menü main-menu-ofe:** GRIT und ICONS im Untermenü „Kollektionen“; Menüpunkt „Bestseller“ → „Favoriten“. 7 Menüs geprüft, nichts verloren, keine Dubletten.
- **Seiten:** Größen-Guide und FAQ in ganzen cm (28 × 36 … 61 × 91).
- **Produkte:** 11 Querformat-Produkte mit Größen als Breite × Höhe und Querformat-Text (29.09. 20:11–20:35 UTC); Dressurpferd SEO „drei Größen“. Alle 14 Querformat-Produkte jetzt korrekt.
- **Alt-Texte:** 2.474 fehlende Alt-Texte gesetzt (1.697 durch Agenten, 777 am 01.10. durch Claude). Nachgezählt: alle 3.264 Produktbilder beschriftet. Schema: Titel + Rahmenfarbe + cm-Größe, sonst „gerahmtes Poster – Ansicht N“. Werkzeug: `shop-checkliste/werkzeug/alt_plan.py`.
- **Unabhängig geprüft (30.09.):** Collections/Menü/Seiten, Theme-Inhalte, Produkttexte, Rabatte.

## Hinweise aus der Prüfung (noch offen)
- OFE v3 Startseite: Raum „Büro“ zeigt weiter das Vintage-Formula-1-Motiv (`horizontal-framed-poster`); Seite „Raum-Inspiration“ (`templates/page.rooms.json`) nutzt weiter Messi. Teil der pn5-Entscheidung.
- Editorial-Block auf der Startseite hat keine eigenen Zahlen; evtl. zeigt Shopify den Standard „99 Kuratierte Motive“ (aktiv: 113). Im Theme-Editor prüfen.
- Favoriten-Collection enthält 5 Marken-/Personenmotive (Ronaldo, Messi, Ferrari, Jordan, Marlboro).

## Checkliste
Launchplan-Artifact Version 14 (01.10.): 77 Punkte, 33 erledigt, 6 × Prio 1 offen. Neue Etiketten „Teilweise“, „Mit OFE v3“, „Behoben 29.09.“, „Neu 29.09.“. Skript: `shop-checkliste/werkzeug/patch_2909.py` + `facts_final.py`.

## Weiter offen (nur Julius, siehe „Brauche von Julius“)
Richtlinien Versand/AGB + LUCID im Impressum · Meta-Description · Shopify Payments + PayPal · Testbestellung · OFE v3 veröffentlichen · Passwort entfernen · Printify: Versandprofil-Sync abschalten, Order approval, Zahlungsmittel · Entscheidungen zu Marken-Motiven, dünnen Collections, 46×61-Preis, URLs, Shop-App-Kanal.

## Status 29.09.
113 aktive Produkte · 0 Bestellungen · 0 Kunden · Passwortschutz aktiv · Live-Theme v2.0, OFE v3 unveröffentlicht · 127 Sitzungen in 30 Tagen (alle direkt) · keine Digital Wallets aktiv.
