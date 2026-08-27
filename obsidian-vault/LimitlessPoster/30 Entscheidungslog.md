---
created: 2026-08-27
tags: [limitlessposter, shopify, entscheidungen]
---

# Entscheidungslog — Perfektionsrunde (2026-08-26/27)

Zurück zum [[00 Dashboard]] · Kontext: [[20 Theme-Architektur OFE v3]] · Regeln daraus: [[22 Konventionen]]

> [!info] Ausgangsbefund
> Die Daten waren bereits perfekt (99/99 Produkte mit kuratiertem Hero/Wohnbeispiel/Studio-Asset) — sie wurden nur **falsch adressiert** (`featured_image` traf bei 15 Produkten die Printify-Weißwand) und **falsch beschnitten** (globaler CSS-Zoom 1.42 statt serverseitigem Crop).

| # | Entscheidung | Statt | Begründung |
| --- | --- | --- | --- |
| 1 | **CDN-Region-Crop** (`image_url: crop: 'region'`, prozentuale Fenster im Snippet) | CSS-Zoom `scale(1.42/1.38/1.32)` | Pixelgenau serverseitig, live am discipline-Hero verifiziert (2026-08-26); srcset bleibt intakt; als reine URL-Parameter auch ohne Preview-Link öffentlich testbar; reversibel. Der alte scale(1.42) schnitt bei 84 Produkten ~16 % ins Motiv. |
| 2 | **Alt-Suffix-Selektion** über `limitless-media` | `featured_image` | 15 von 99 Produkten (Typ B) hatten das Hero an letzter Medien-Position → featured_image lieferte die Weißwand. Alt-Suffix („gerahmtes Poster"/„Wohnbeispiel"/„Studio") ist positionsunabhängig und 99/99 vorhanden; Fallback-Kette Dateiname → featured_media. |
| 3 | **Hover-Bild = Studio** | Wohnbeispiel als Hover | Studio ist formatstabil (95× exakt 2:3, immer dieselbe Sofa-Szene) → ruhiges Karten-Raster. Wohnbeispiele streuen über 5 Seitenverhältnisse und sind für große Flächen (Hero, PDP) reserviert. |
| 4 | **Hero als Split-Layout, EIN Primär-CTA** („Bestseller ansehen" + Textlink „Neue Drops →") | Full-Screen-Bild, Gradient-Overlay, 2 Buttons | Text links auf solidem `#141215` = Kontrast deterministisch ~15:1 statt Overlay-Glücksspiel. 1 CTA konvertiert besser als 2 (13,5 % vs. 11,9 %, foundrycro); kein Karussell (~1 % klicken Slide 2, NN/g). 65svh-Höhe lässt das Bestseller-Grid anschneiden = Scroll-Anreiz. |
| 5 | **Startseite 16 → 10 Flow-Positionen** (11 Sektions-Objekte) | 16 Sektionen | Bestseller kamen zu spät (Hauptfehler der Wettbewerber), Reviews rücken von Position 11 nach vorn; usp_row + story_facts + editorial_story + lp_stats werden in `limitless-editorial` verdichtet; New-Drop- und Mindset-Grid zusammengelegt. |
| 6 | **Countdown, Text-Marquees, Stats-Zähler raus** (`drop_countdown`, `benefits_marquee`, `marquee_lp`, `lp_stats`) | Urgency-/Laufband-Elemente behalten | Kein echtes Drop-Datum vorhanden → Fake-Timer = Misstrauen **und** Rechtsrisiko (EU Digital Fairness Act nennt Countdowns explizit). Laufband-Benefits werden statische Trust-Zeile; Stats-Zahlen leben in der Editorial-Sektion weiter. `story_wall` (rein visuell) bleibt. Dateien bleiben im Theme, nur aus index.json entfernt. |
| 7 | **`image_ratio: portrait`** überall (collection, queens, search, Index-Grids, recommendations) | `adapt` | Einheitliches 4:5-Raster statt springender Kachelhöhen; zudem robust gegen den Media-Reorder (adapt hätte nach dem Reorder live die Kachelhöhen springen lassen — deshalb Templates VOR dem Reorder hochladen). |
| 8 | **Media-Reorder der 15 Typ-B-Produkte** (Hero → Position 1 via `productReorderMedia`) | Produktdaten unangetastet lassen | Stellt Julius' eigene Konvention her (84/99 folgten ihr bereits) und repariert `featured_image` überall — auch die Kollektionsbilder im Live-Shop werden besser. **Wirkt live**, ändert aber nur die Reihenfolge, löscht nichts; Ablauf mit Dry-Run-Tabelle, Einzel-Mutationen und Re-Query-Verifikation. |

## Bewusst NICHT gemacht

> [!tip] Mit Absicht weggelassen
> - **Kein PDP-Galerie-Override**: native Zoom/Thumbnail/Variant-Logik zu riskant; nach dem Reorder beginnt die Galerie ohnehin mit dem Hero.
> - **Kein Alpha-PNG-Neurender** der 297 Assets: Region-Crop leistet dasselbe serverseitig, sofort und reversibel (bleibt späteres Upgrade, [[40 Offene Punkte]]).
> - **Keine Metafields** für Crop-Fenster: die Ein-Fenster-Strategie deckt 99/99 ab — Metafields wären Pflegeaufwand ohne Nutzen.
> - **Kein Löschen der Printify-Mockups**: Live-Shop-Sicherheit; sie dienen auf der PDP als Detail-/Rahmenbilder.
> - **Keine hartkodierten Zahlarten-Icons**: nur nach Verifikation der aktiven Methoden, sonst „Sichere Zahlung".
> - **Kein Header-/Footer-Umbau**; `limitless-stats`/`-drop-countdown` bleiben als Dateien im Theme (Löschen wäre eine unnötige riskante Mutation).

## 2026-08-27 — E2E-Testrunde über Preview-Link + Fix-Runde

| Entscheidung | Begründung |
|---|---|
| Hero-Textspalte bekommt 128 px Top-Padding (Desktop) | Horizon legt den transparenten Sticky-Header über die erste Sektion — Eyebrow/H1 kollidierten mit der Navigation |
| Scroll-Showcase-Überschrift auf `top: clamp(96px, 12svh, 140px)` | Sticky-Header überdeckte „Ein Motiv. Deine Wand." während der Sticky-Phase |
| `.lp-outline`-Stroke explizit `var(--color-foreground)` | `currentColor` war durch `color: transparent` selbst transparent — „POSTER" in der Footer-Wortmarke war unsichtbar (Julius' altes „Logo nur halb"-Feedback) |
| Gallery-Wall-Überschrift h1 → h2 | Startseite hatte drei h1 (SEO/A11y) |
| Kachel-Label-Farbe `#141215` im collection-title-Block | Ivory-Text auf #FCFBF7-Chip war unlesbar; der Template-`color`-Key wird inline geschrieben und schlägt jede Kaskade |
| `auto_open_cart_drawer: true` | Horizon-Default ist false — nach „In den Warenkorb" passierte sichtbar nichts (Badge zählte nur hoch) |
| Galerie-Reihenfolge aller 99 Produkte: Hero → Wohnbeispiel → Studio → Printify | Displate-Muster: die ersten Bilder beantworten Kauffragen (Produkt, Raumwirkung, Größe); per productReorderMedia, wirkt auch live |
| Black-Varianten bekommen den Hero als Variantenbild | Horizon zeigt das Bild der GEWÄHLTEN Variante als ersten Galerie-Slide — Printify hatte Weißwand-Mockups zugewiesen, PDPs starteten damit trotz korrekter Medienreihenfolge; White-Varianten behalten ihre weißen Rahmenbilder für den Farbwechsel |
