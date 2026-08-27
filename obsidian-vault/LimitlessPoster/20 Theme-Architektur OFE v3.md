---
created: 2026-08-27
tags: [limitlessposter, shopify, theme, architektur]
---

# Theme-Architektur OFE v3

Zurück zum [[00 Dashboard]] · Design: [[21 Design-System Royal Noir]] · Regeln: [[22 Konventionen]]

Basis: Shopify **Horizon**; alle eigenen Dateien mit Präfix `limitless-`. Spiegel im Repo: `shopify-theme-updates/`.

## Datei-Landkarte (Spiegel)

| Bereich | Datei | Zweck |
| --- | --- | --- |
| assets | `limitless-brand.css` | Marken-Typografie: Space Grotesk selbst gehostet (OFL, keine externen Requests), Font-Variablen, Display-Stile |
| assets | `limitless-lab.css` / `limitless-lab.js` | Styles/Verhalten der Custom-Sektionen. In dieser Runde bereinigt: CSS-Zoom-Hacks (Z. 721–732, scale 1.42/1.32) und doppeltes `padding-inline` (Z. 356) entfernt |
| snippets | **`limitless-media.liquid`** (NEU) | **Zentrale Medien-Weiche** — Erklärung unten |
| snippets | **`card-gallery.liquid`** (NEU: Override) | Ersetzt das Horizon-Original (14497 B): genau **2 Slides** pro Produktkarte — Erklärung unten |
| snippets | `limitless-shipping-bar.liquid` | Versandschwellen-Bar (50 €) im Cart |
| snippets | `header-actions.liquid` | Header-Anpassung |
| blocks | `limitless-3d-viewer` · `limitless-bundle` · `limitless-flip` · `limitless-savings` · `limitless-size-guide` · `limitless-swatches` · `limitless-trust` · `limitless-typewriter` | PDP-/Karten-Bausteine. `limitless-swatches` = rein visuelle Rahmen-Punkte (keine Inputs → kein Variant-Morphing auf Karten). `limitless-savings` mit optionalem `legal_note`-Setting (§ 11 PAngV, siehe [[22 Konventionen]]) |
| sections | **`limitless-hero`** (NEU) · **`limitless-editorial`** (NEU) · `limitless-gallery-wall` · `limitless-rooms` · `limitless-poster-wall` · `limitless-reviews` · `limitless-scroll-showcase` · `limitless-help` | Custom-Sektionen. Hero = Split-Layout (Text links auf solidem Grund, Wohnbeispiel rechts 4:5, 1 CTA); Editorial verdichtet USP/Story/Stats |
| templates | `index.json` (10 Flow-Positionen/11 Objekte) · `product.json` · `collection.json` · `collection.queens.json` · `search.json` · `page.gallery-wall/hilfe/rooms/story.json` | JSON-Templates; `image_ratio` überall fest auf `portrait` (statt `adapt`) |
| config/layout | `settings_data.json` · `theme.liquid` | Farbschemata ([[21 Design-System Royal Noir]]), globale Settings (`show_second_image_on_hover: true`, `product_card_carousel: true`) |

Im Theme (bewusst nicht im Spiegel/ungenutzt): `limitless-stats`, `limitless-drop-countdown` — aus `index.json` entfernt, Dateien bleiben harmlos liegen ([[30 Entscheidungslog]]).

## Karten-Renderkette (gilt für ALLE Karten)

Grids, Suche, Empfehlungen und Quick-Add laufen durch **eine** verifizierte Kette:

```
blocks/_product-card.liquid
  → snippets/product-card.liquid
    → blocks/_product-card-gallery.liquid
      → snippets/card-gallery.liquid   ← unser Override greift hier überall
        → snippets/slideshow(-slide).liquid
          → <img class="product-media__image">
```

Hover-Mechanik ist **nativ**: `on:pointerenter="/previewImage"` → `slideshow.next()` = Slide 2; `pointerleave` → `resetImage` → `previous()` (verifiziert gegen `assets/product-card.js`, 20710 B).

## limitless-media.liquid — die Medien-Weiche

> [!info] Funktionsweise (3 Stufen)
> **1. Auswahl** — loopt einmal über `product.media` (nur Bilder) und matcht den **Alt-Text-Suffix**: „gerahmtes Poster" → Hero, „Wohnbeispiel", „Studio" (bewusst ohne Gedankenstrich — robust gegen –/—-Varianten). Fallback 1: Dateiname `-hero.` / `-wohnbeispiel.` / `-studio.`; Fallback 2: `featured_media`. Dadurch **unabhängig von der Medien-Reihenfolge** (bei 15 Typ-B-Produkten zeigte `featured_image` die Printify-Weißwand).
> **2. Crop** — Hero-Bilder werden **serverseitig per CDN-Region-Crop** beschnitten: `image_url: crop: 'region', crop_left/top/width/height` (+ `width`). Das Fenster wird prozentual aus den Bildmaßen gerechnet; Standard-Hero 1600×2000 mit Inset 9 %/7 % ⇒ Region 1312×1720. Live verifiziert (2026-08-26): die CDN liefert die exakt beschnittene Datei; die Crop-Parameter überleben auch im `srcset`.
> **3. Output** — `output: 'img'` rendert das `<img>` via `image_tag` (srcset/sizes/loading/fetchpriority/preload/ref), `'url'` gibt nur die nackte URL aus (capture-fähig, z. B. fürs Gallery-Wall-JS-JSON), `'index'` gibt den `product.media`-Index zurück (−1 = nichts gefunden; so bekommen Aufrufer echte media-Objekte für Slide-IDs).

**Crop-Presets:** `standard` 9/7 (Default bei hero) · `tight` 9.5/9.5 · `motif` 11.5/9.5 · `none` (Default bei studio/wohnbeispiel). Kein `<style>` im Snippet, keine Metafields, **keine CSS-Transforms** — Regel: nie mehr `transform: scale` als Bild-Crop ([[22 Konventionen]]).

**Capture-Muster für den URL-Modus:**

```liquid
{%- capture lm_u -%}{% render 'limitless-media', product: product, kind: 'hero', output: 'url', width: 300 %}{%- endcapture -%}
{%- assign lm_u = lm_u | strip -%}
```

## card-gallery.liquid — Override

- Genau **2 Slides**: Slide 1 = Hero (preset `standard`, gecroppt), Slide 2 = Studio (preset `none`, `loading="lazy"`) als Hover-Bild. Fehlt das Studio-Asset → 1 Slide, keine toten Pointer-Handler.
- `show_arrows` fest aus; Quick-Add/Badges laufen unverändert als `children` durch; View-Transition-`ref` bleibt erhalten.
- Bei `image_ratio: adapt` wird das Ratio aus der **Crop-AR** gerechnet (statt featured_media) — robust, falls ein Template auf adapt bleibt.
- Variant-Bild-Zweig des Originals entfällt: Karten haben keinen Variant-Picker (nur visuelle `limitless-swatches`, verifiziert).

## Layout-Grundmuster (Horizon)

> [!tip] `section spacing-style` nicht vergessen
> Horizon wendet `--padding-block-*` **nur** über die Klasse `.spacing-style` an (base.css Z. 2511). Fehlte sie, kollabierte das Padding auf 0 — Root Cause des abgeschnittenen „Was Kunden sagen". In dieser Runde ergänzt in: reviews, help, gallery-wall, rooms; poster-wall und scroll-showcase brauchten zusätzlich die Klasse `section` (positionierter Vorfahre für `.section-background`).

## Upload-Pipeline (GitHub → Theme)

> [!warning] Reihenfolge ist Pflicht — sonst stiller Template-Verwurf
> Ein Template, das einen noch nicht existierenden Sektions-Typ referenziert, wird von Shopify **stillschweigend verworfen**. Deshalb Templates immer zuletzt.

1. `git commit` + `push` auf den Branch → **Commit-SHA notieren**.
2. `themeFilesUpsert` mit Quell-URLs `raw.githubusercontent.com/JITrap/NextGen-Lernen/<SHA>/shopify-theme-updates/…` — der SHA-Pin eliminiert CDN-Stale/Branch-Races.
3. **Batch 1 (Fundament):** assets + snippets + blocks → ~12 s warten → verifizieren.
4. **Batch 2:** sections → verifizieren.
5. **Batch 3:** templates (erst nach bestätigtem Batch 1+2) → verifizieren.

**Verify-Gate je Batch:** GraphQL `files`-Query — `size` == lokales `wc -c` (byte-gleich), `updatedAt` frischer als Batch-Start, `userErrors` leer; bei Mismatch die Datei einzeln erneut upserten. Vor dem Upload: Spiegel-Drift-Check (erneuter size-Vergleich aller Zieldateien; bei Diff Theme-Version pullen und rebasen).
