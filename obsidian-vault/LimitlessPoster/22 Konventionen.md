---
created: 2026-08-27
tags: [limitlessposter, shopify, konventionen, checkliste]
---

# Konventionen (verbindlich)

Zurück zum [[00 Dashboard]] · Technik dahinter: [[20 Theme-Architektur OFE v3]]

> [!warning] Warum diese Notiz die wichtigste ist
> Das gesamte Theme (Medien-Weiche, Karten, Hero, Gallery-Wall) verlässt sich auf diese Konventionen. Ein Produkt, das sie bricht, fällt auf `featured_media` zurück — im schlimmsten Fall zeigt die Karte wieder eine Printify-Weißwand.

## 1 · Das 3-Asset-System pro Produkt

Jedes Produkt hat **genau drei kuratierte Bild-Assets** (Stand Audit 2026-08-26: 99/99 Produkte, per HTTP verifiziert). Erkennung läuft primär über den **Alt-Text-Suffix**, sekundär über den Dateinamen:

| Asset | Dateiname | Alt-Text | Inhalt |
| --- | --- | --- | --- |
| **Hero** | `<handle>-hero.jpg` | „… – gerahmtes Poster" | Tight Shot: Rahmen + Motiv zentriert auf Creme `#F6F3EE`, 1600×2000 (4:5) |
| **Wohnbeispiel** | `<handle>-wohnbeispiel.jpg` | „… – Wohnbeispiel" | Thematische Raumszene (Formate variieren, 5 ARs im Bestand) |
| **Studio** | `<handle>-studio.jpg` | „… – Studio" | Immer dieselbe Sofa-Szene, 2:3 (95× im Bestand) — Hover-Bild der Karten |

Daneben existieren ~24 Printify-Weißwand-Mockups (Dateiname nur Ziffern, Alt leer) — sie bleiben als PDP-Detailbilder erhalten, werden aber nie von der Medien-Weiche gewählt.

## 2 · Hero-Geometrie

> [!info] Deterministisch — darauf bauen die Crops
> Poster **zentriert**, exakt **9 % Rand** je Seite, Hintergrund **Creme `#F6F3EE`**, Datei **1600×2000** (4:5).
> Ist-Bestand: 87× Poster-BBox 82 %×82 %, 11× Querformat 82 %×54 %, 1× 76 %×86 % (dressage-horse). Die Snippet-Presets (`standard` 9/7, `tight` 9.5/9.5, `motif` 11.5/9.5) sind auf genau diese Geometrie gerechnet — neue Heroes müssen ihr folgen.

## 3 · Hero IMMER an Medien-Position 1

> [!warning] featured_image hängt daran
> Kollektionsbilder, Live-Shop-Karten und die View-Transition nutzen `featured_media` = Position 1. 84/99 Produkte folgten der Konvention bereits (Julius' eigenes Muster); die 15 „Typ-B"-Ausreißer werden per `productReorderMedia` repariert ([[30 Entscheidungslog]]). **Jedes neue Produkt: Hero sofort an Position 1 ziehen.**

## 4 · Checkliste: Neues Produkt anlegen

> [!todo] Pro Produkt abhaken
> - [ ] Hero-Asset rendern: Poster zentriert, 9 % Rand, Creme `#F6F3EE`, 1600×2000
> - [ ] Drei Dateien nach Schema benennen: `<handle>-hero.jpg`, `<handle>-wohnbeispiel.jpg`, `<handle>-studio.jpg`
> - [ ] Alt-Texte exakt setzen: „<Titel> – gerahmtes Poster" / „<Titel> – Wohnbeispiel" / „<Titel> – Studio"
> - [ ] Hero an **Medien-Position 1** schieben (Printify-Mockups dahinter lassen, nicht löschen)
> - [ ] `compare_at`-Preis NUR setzen, wenn er dem **niedrigsten Gesamtpreis der letzten 30 Tage** entspricht (§ 11 PAngV, s. u.)
> - [ ] Passenden Kollektionen zuordnen (Bestseller/New Drop/Motivwelt)
> - [ ] Sichtprüfung im Grid: Slide 1 ohne Creme-/Weißrand, Hover zeigt das Studio-Bild

## 5 · Code-Regeln

- **Nie `featured_image`** in Karten/Sektionen verwenden — immer `{% render 'limitless-media', … %}` (Signatur in [[20 Theme-Architektur OFE v3]]).
- **Nie `transform: scale`** als Bild-Crop — Crops passieren serverseitig per CDN-Region-Crop.
- Sektions-Wrapper brauchen `section spacing-style color-…`, sonst greift das Block-Padding nicht.

## 6 · Preisrecht & Vertrauen

> [!danger] § 11 PAngV — Streichpreise
> Ein Streichpreis (`compare_at`) ist nur zulässig mit Bezug auf den **niedrigsten Gesamtpreis der letzten 30 Tage**. Konvention: `compare_at` wird ausschließlich dann gepflegt, wenn genau das gilt — sonst leer lassen. Der `limitless-savings`-Block ist compare_at-gated und hat ein optionales `legal_note`-Setting für die Fußnote.

> [!danger] Keine Fake-Urgency
> **Keine Fake-Countdowns** — der EU Digital Fairness Act nennt Countdown-Timer explizit; ohne echtes Drop-Datum ist ein Timer Rechts- und Vertrauensrisiko. Deshalb wurde `drop_countdown` von der Startseite entfernt ([[30 Entscheidungslog]]). Rabatt-Anker nur über **echte** Mengenrabatte (Bundle), nie über erfundene Fristen.

## 7 · Versandschwelle 50 €

> [!info] Eine Zahl, überall gleich
> „Kostenloser Versand ab 50 €" muss konsistent bleiben in: Trust-Zeile der Startseite, PDP-Reassurance (`limitless-trust`: „Versandfrei ab 50 €") und Cart-Versandbar (`limitless-shipping-bar`). Ändert sich die Schwelle, alle drei Stellen anfassen. Zahlarten-Marken (Klarna/PayPal/…) erst nennen, wenn die Methoden wirklich aktiviert sind — bis dahin „Sichere Zahlung" ([[40 Offene Punkte]]).
