---
created: 2026-08-27
tags: [limitlessposter, design, royal-noir]
---

# Design-System „Royal Noir"

Zurück zum [[00 Dashboard]] · Technik: [[20 Theme-Architektur OFE v3]]

> [!rose] Markenbild
> Dunkler, edler Grund — Produkte als helle Kacheln davor. Rot als Machtfarbe, Rosé als weicher Akzent, Ivory als Licht.
> (Callout-Typ aus `limitless-callouts.css`; ohne Snippet neutraler Standard-Look.)

## Farbwerte (aus `config/settings_data.json` verifiziert)

| Rolle | Wert | Verwendung |
| --- | --- | --- |
| scheme-1 | `#141215` | Basis-Dunkel (Seiten-Grund, Hero-Textseite) |
| scheme-2 | `#1C191B` | Karten/Bänder (z. B. Reviews-Band) |
| scheme-3 | `#0C0A0B` | Tiefster Grund (Kontrast-Sektionen) |
| scheme-4 | `#8B1E2D` | Royal-Band (dunkles Rot als Flächenfarbe) |
| scheme-5 | `#2B2C30` | Neutraler Dunkelgrau-Grund |
| scheme-6 | `rgba(0,0,0,0)` | Transparent (Overlay-Kontexte), Text weiß |
| Akzent | `#A32235` | Markenrot — Hover-Border der Secondary-Buttons, Akzente |
| Rosé | `#E4A7B6` | Weicher Sekundär-Akzent |
| Ivory | `#F4F1EA` | Text, Buttons, helle Produkt-Kacheln auf dunklem Grund |
| Hero-Creme | `#F6F3EE` | Studio-Hintergrund der Hero-Assets (Bildinhalt, keine Theme-Farbe) |

> [!tip] Creme ≈ Ivory — der unsichtbare Übergang
> `#F6F3EE` (Hero-Asset-Hintergrund) und `#F4F1EA` (Ivory-Kacheln) liegen so nah beieinander, dass Creme-Reste nach dem Crop **auf Ivory-Flächen unsichtbar verschmelzen**. Nur in **dunklen** Kontexten (Scroll-Showcase, 3D-Viewer, Poster-Wall) fallen Creme-Streifen auf — dort deshalb die engeren Presets `tight`/`motif` ([[20 Theme-Architektur OFE v3]]).

## Typografie-Rollen (aus `limitless-brand.css`)

| Rolle | Definition |
| --- | --- |
| Headings (`--font-heading--family`) | **Space Grotesk**, Gewicht 500 · Fallback Inter, ui-sans-serif, system-ui |
| Akzent/Display (`--font-accent--family`) | **Space Grotesk** — Wortmarke/Zahlenband Gewicht 600, Display-Größe `clamp(2.75rem, 9vw, 6.9rem)` |
| Fließtext | Horizon-Theme-Setting (nicht in brand.css überschrieben) |

Space Grotesk ist **selbst gehostet** (OFL-Lizenz, `font-display: swap`, Gewichtsbereiche 400–500 und 600–700) — keine externen Font-Requests.

## Kachel-Prinzip

> [!info] Produkte hell auf dunklem Grund
> Produktkarten zeigen das Hero-Asset (Poster + Rahmen, per CDN-Crop von der Creme-Wand befreit) als **helle Ivory-Kachel** vor dunklem Seiten-Grund — das Produkt leuchtet, der Shop bleibt Bühne. Hover blendet das **Studio-Bild** (einheitliche Sofa-Szene, 2:3) ein. Einheitliches Raster: `image_ratio: portrait` (4:5) überall.

## Kontrast-Grundsatz

> [!success] Text nie auf Bild raten lassen
> Der neue Hero setzt Text auf **soliden** Scheme-Grund (`#141215`) statt auf ein Overlay — Kontrast deterministisch ~15:1, unabhängig vom Bildmotiv ([[30 Entscheidungslog]], Entscheidung 4).
