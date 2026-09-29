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

## Per Workflow „shop-fixes-2909“
_(wird nach Abschluss ergänzt)_

## Weiter offen (nur Julius, siehe „Brauche von Julius“)
Richtlinien Versand/AGB + LUCID im Impressum · Meta-Description · Shopify Payments + PayPal · Testbestellung · OFE v3 veröffentlichen · Passwort entfernen · Printify: Versandprofil-Sync abschalten, Order approval, Zahlungsmittel · Entscheidungen zu Marken-Motiven, dünnen Collections, 46×61-Preis, URLs, Shop-App-Kanal.

## Status 29.09.
113 aktive Produkte · 0 Bestellungen · 0 Kunden · Passwortschutz aktiv · Live-Theme v2.0, OFE v3 unveröffentlicht · 127 Sitzungen in 30 Tagen (alle direkt) · keine Digital Wallets aktiv.
