---
created: 2026-08-27
tags: [limitlessposter, shopify, dashboard]
---

# LimitlessPoster — Dashboard

> [!royal] Royal Noir
> Einstiegspunkt für alles rund um **limitlessposter.com** und das Theme **OFE v3**.
> (Dieser Callout-Typ kommt aus dem optionalen CSS-Snippet `limitless-callouts.css` — ohne Snippet wird er als neutraler Standard-Callout angezeigt.)

## Notizen

| Notiz | Inhalt |
| --- | --- |
| [[10 Projekt & Systeme]] | Shop, Shopify + Printify, Theme-Landschaft, GitHub-Repo, Design-Lab |
| [[20 Theme-Architektur OFE v3]] | Datei-Landkarte, Karten-Renderkette, `limitless-media`-Weiche, Upload-Pipeline |
| [[21 Design-System Royal Noir]] | Farbwerte, Typografie-Rollen, Kachel-Prinzip |
| [[22 Konventionen]] | **Wichtigste Notiz**: 3-Asset-System, Hero-Regeln, Checkliste neues Produkt, Preisrecht |
| [[30 Entscheidungslog]] | Kernentscheidungen der Perfektionsrunde mit Begründung |
| [[40 Offene Punkte]] | Was noch aussteht und wer am Zug ist |

## Status (Stand 2026-08-27)

> [!success] Live-Shop sicher
> Das **Live-Theme ist unberührt** — sämtliche Arbeit passiert in der unveröffentlichten Arbeitskopie **OFE v3**.

> [!info] OFE v3
> Unveröffentlichte Arbeitskopie (Horizon-basiert, dunkles Royal-Noir-Design, deutsch). Die „Perfektionsrunde" (Medien-Weiche, CDN-Crops, neuer Hero, Startseiten-Straffung, PDP-Flow) wird gerade umgesetzt und über GitHub → `themeFilesUpsert` hochgeladen.

> [!warning] Einzige live-wirksame Maßnahme
> Der geplante **Media-Reorder der 15 Typ-B-Produkte** (Hero-Bild an Medien-Position 1) wirkt auch im Live-Shop — es wird ausschließlich die **Reihenfolge** geändert, nichts gelöscht. Details: [[30 Entscheidungslog]].

> [!todo] Publish
> Die Entscheidung, OFE v3 zu veröffentlichen, liegt bei Julius — vorher Testschleife B (braucht Preview-Share-Link, siehe [[40 Offene Punkte]]).

## Kennzahlen

| Kennzahl | Wert |
| --- | --- |
| Produkte | **99** (alle mit 3 kuratierten Bild-Assets = 297 Assets, per HTTP verifiziert) |
| Kollektionen | **15** (davon 8 als Motivwelt-Kacheln auf der Startseite; u. a. Bestseller, New Drop, Queens mit eigenem Template) |
| Theme | **OFE v3** — `gid://shopify/OnlineStoreTheme/194580283725` |
| Startseite (Soll) | 10 Flow-Positionen / 11 Sektions-Objekte (vorher 16) |
| Produktkarten | Slide 1 = Hero (CDN-Crop), Hover-Slide 2 = Studio |

> [!tip] Callout-Farbsystem dieser Notizen
> `[!success]` grün = erledigt/sicher · `[!info]` blau = Fakten · `[!tip]` cyan = Empfehlung · `[!warning]` orange = Achtung/live-wirksam · `[!danger]` rot = Rechtsrisiko · `[!todo]` = Checkliste.
> Zusätzlich optional in Markenfarben: `[!royal]`, `[!rose]`, `[!noir]` — dafür `limitless-callouts.css` nach `<VAULT>/.obsidian/snippets/` kopieren und unter Einstellungen → Darstellung → CSS-Snippets aktivieren.
