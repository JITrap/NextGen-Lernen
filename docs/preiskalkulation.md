# Preiskalkulation LimitlessPoster (Stand 07.08.2026)

## Datenbasis
- `tools/poster3d-v4/out/pricing-data.json`: 101 aktive Produkte, 1198 Varianten,
  100 % mit Printify-Produktionskosten (von Printify als `unitCost` nach Shopify gesynct).
- `tools/poster3d-v4/out/shipping-profile.json`: Versandprofile/Zonen des Shops.

## Produktionskosten & Preise (uniform über alle Produkte)

| Größe | Produktionskosten | Preis | Marge vor Versand |
|---|---|---|---|
| 8″×11″ | 22,19 € | 62,99 € | 40,80 € |
| 11″×14″ | 24,88 € | 64,99 € | 40,11 € |
| 12″×18″ | 28,48–28,89 € | 68,99 € | ~40,30 € |
| 16″×20″ | 35,12 € | 74,99 € | 39,87 € |
| 18″×24″ | 41,12 € | 79,99 → **81,99 €** | 38,87 → 40,87 € |
| 20″×30″ | 49,39 € | 89,99 € | 40,60 € |
| 24″×36″ | 64,45 € | 108,99 € | 44,54 € |

## Versand-Situation (aus den Shop-Profilen)
- **Deutschland + EU: Versand ist bereits kostenlos** (0 € in allen relevanten Zonen,
  Printify-Profile führen die Zone „Deutschland + EU (Versand inklusive)").
  Es gibt KEINE 50-€-Schwelle — der Marquee-Text „Kostenloser Versand ab 50 €" war falsch
  und wurde ersetzt durch „Kostenloser Versand in DE & EU".
- Deutschland zusätzlich: Express 9,99 €.
- International: 19,99 € (Default-Profil) bzw. Printify-Staffeln (~26–36 USD/Stück).

## Formel
Die Preise folgen (fast exakt) der additiven Formel:

    Preis = round99( Produktionskosten + 12 € Versandanteil (EU-Schätzung) + 28 € Marge )

Einzige Abweichung nach unten war 18″×24″ (79,99 statt 81,99) → auf **81,99 €** normalisiert
(198 Varianten). 24″×36″ liegt 4 € ÜBER der Formel — bewusst beibehalten (Zusatzmarge).

**Ergebnis: jede Variante erwirtschaftet nach geschätztem EU-Versandanteil ≥ ~28 € Gewinn.**

## Offener Punkt: exakte Printify-Versandkosten
Der Versandanteil von ~12 €/Stück (EU, gerahmtes Poster) ist eine Schätzung —
die exakten Sätze, die Printify dem Händler berechnet, sind nur über die
Printify-API einsehbar (Personal Access Token nötig, liegt nicht vor).
Mit Token ließe sich die Formel pro Größe exakt nachschärfen.
