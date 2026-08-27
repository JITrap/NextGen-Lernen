---
created: 2026-08-27
tags: [limitlessposter, shopify, projekt, systeme]
---

# Projekt & Systeme

Zurück zum [[00 Dashboard]].

## Shop

> [!info] limitlessposter.com
> Poster-Shop (dunkles Royal-Noir-Design, deutschsprachig). Motivwelten: Motivation/Ambition (u. a. Discipline, Messi, Ferrari, Queens). **rund 100 Produkte** in **15 Kollektionen** (8 davon als Motivwelt-Kacheln auf der Startseite).

- **Plattform:** Shopify (Online Store 2.0, Theme-Basis Horizon)
- **Fulfillment:** Printify (Print-on-Demand) — Druck in der EU. Konkrete Produktions-/Lieferzeiten variieren je Produkt (Printify) — im Shop bewusst ohne Tageszahlen kommuniziert („Versand aus der EU"), bis verlässliche Zahlen vorliegen. Die Reassurance sitzt als `limitless-trust`-Block direkt unter dem Kauf-Button.
- **Versandschwelle:** Kostenloser Versand ab 50 € — konsistent in Trust-Zeile, PDP und Cart-Versandbar (siehe [[22 Konventionen]]).

## Theme-Landschaft

| Theme | Rolle | Status |
| --- | --- | --- |
| Live-Theme | Veröffentlichter Shop | **Unberührt** — keine Änderungen in dieser Runde |
| **OFE v3** | Arbeitskopie „Perfektionsrunde" | Unveröffentlicht, aktiv in Arbeit |

> [!info] OFE v3 — ID
> `gid://shopify/OnlineStoreTheme/194580283725`
> Horizon-basiert; alle Custom-Dateien tragen das Präfix `limitless-`. Architektur: [[20 Theme-Architektur OFE v3]].

> [!warning] Preview-Link
> Die Theme-Vorschau lässt sich **nicht per API teilen** (`OnlineStoreTheme` hat kein `previewUrl`-Feld — Schema geprüft). Nur Julius kann im Admin klicken: Themes → OFE v3 → „…" → **„Vorschau teilen"**. Solange der Link fehlt, ist die End-to-End-Testschleife blockiert ([[40 Offene Punkte]]).

## Code & Deployment

- **GitHub-Repo:** `JITrap/NextGen-Lernen`
- **Branch:** `claude/shop-design-showcase-s9imp9` — **PR #3**
- **Theme-Spiegel:** Ordner `shopify-theme-updates/` im Repo (Baseline 2026-08-26 byte-identisch verifiziert; nach jedem Upload-Batch per size+updatedAt neu abgleichen)
- **Upload-Weg:** `themeFilesUpsert` (Shopify Admin GraphQL) zieht die Dateien von `raw.githubusercontent.com` — gepinnt auf den Commit-SHA (Details: [[20 Theme-Architektur OFE v3]])

## Design-Lab

> [!info] Artifact
> Interne Design-Referenz (Showcase mit Effekten, Paletten, Seiten-Ideen):
> https://claude.ai/code/artifact/9c364889-6aca-4d26-b7ac-abcf363ae0fc

## Arbeitsmodell dieser Runde

> [!tip] Multi-Agent-Workflow
> Eine Orchestrator-Session friert die Snippet-Signatur von `limitless-media` ein, 5 parallele Builder bauen dagegen (Media-Kern, Sections-Refit, Hero/Editorial/Index, PDP/Kataloge, Obsidian), 2 blockierende Reviewer-Gates prüfen Kontrakt/Statik und Copy/Recht. **Nur die Orchestrator-Session schreibt Richtung Shopify.**
