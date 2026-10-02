# Produkt-URLs: kurze deutsche Handles (02.10.2026)

Bereich: urls · Stand: 02.10.2026, ca. 13:55 UTC · Shop: gexdm4-2q (limitlessposter.com)

## Ergebnis in Kürze

- **109 von 113 Produkten** haben eine neue, kurze Adresse (`/products/...`). 4 waren schon kurz und sauber und bleiben unverändert.
- **109 Weiterleitungen (301)** von alt auf neu sind angelegt und einzeln geprüft: jede alte Adresse zeigt direkt auf die neue, keine Ketten.
- **Theme „LimitlessPoster OFE v3“** (unveröffentlicht): alle Produkt-Verweise zeigen auf die neuen Handles. Vollscan aller 459 Dateien: 0 alte Handles.
- **Live-Theme „LimitlessPoster v2.0“**: 1 betroffene Stelle (Startseite, Scroll-Showcase), von Shopify automatisch umgestellt. Vollscan danach: 0 alte Handles.
- Menüs, Seiten (inkl. AGB/Datenschutz), Blog, Collection-Beschreibungen, Shop-Metafelder: **keine** Links auf Produkt-URLs gefunden, nichts zu ändern.
- Durchschnittliche Länge: vorher **58 Zeichen**, jetzt **30 Zeichen** (längster neuer Handle: 42 Zeichen).

Beispiel: `/products/horizontal-framed-poster` → `/products/vintage-formel-1-racing-poster`

## Regeln für die neuen Handles

- Motivname + Art aus dem deutschen Produkttitel, 3 bis 6 Wörter, nur a–z, 0–9 und Bindestrich.
- Umlaute transliteriert (ä→ae, ö→oe, ü→ue, ß→ss), z. B. `haie-vor-der-kueste-poster`, `ferrari-weisser-hengst-poster`.
- Keine Füllwörter (framed, wall-art, vertical, print, motivational …).
- Art-Wort deutsch, wo der Titel es hergibt: `fussball-poster`, `motivationsposter`, `schwarz-weiss`, `skulptur`, `musik`.
- Englische Zitate bleiben englisch (das ist der Motivname). Sehr lange Zitate gekürzt auf den Kern, z. B. „Work So Hard They Think You're Crazy“ → `work-so-hard-motivationsposter`.
- Dubletten unterschieden durch ein Wort aus dem Titel: `leopard-auf-ast-schwarz-weiss-poster` / `leopard-auf-ast-minimal-poster`, `whatever-it-takes-portrait-poster` / `whatever-it-takes-typo-poster`, `perfect-time-never-comes-world-poster` / `perfect-time-never-comes-trader-poster`, `focus-gym-poster` / `focus-skulptur-poster`, `discipline-gym-poster` / `discipline-fussball-poster`, drei Mal „No Risk No Story“ (`-foto-`, `-basketball-`, `-racing-`).
- Kollisionsprüfung per Skript gegen alle bestehenden Handles: keine Konflikte.
- Plan und Prüfung: `shop-checkliste/werkzeug/handle_plan.py`, Ergebnis: `handle-plan.json` (id, titel, alt, neu, redirect_id).

Unverändert (bereits kurz und passend):
- `go-get-that-dream-leopard-poster` (Go Get That Dream – Leopard-Poster)
- `in-god-we-trust-basketball-poster` (In God We Trust – Basketball-Poster)
- `trust-god-poster` (Trust God – Faith-Poster)
- `red-icon-music-poster` (Red Icon – Music-Poster)

## Wie die Weiterleitungen entstanden sind

- `productUpdate` mit `handle` + `redirectNewHandle: true` (in 4 Paketen à max. 28 Produkte, 0 Fehler).
- Shopify legt dabei automatisch eine URL-Weiterleitung `/products/<alt>` → `/products/<neu>` an (Typ 301).
- Kontrolle danach per `urlRedirects`: 109/109 vorhanden und korrekt, keine fehlenden, keine Ketten. Insgesamt jetzt 110 Weiterleitungen (die 110. ist die alte `/collections` → `/collections/all`).

## Verweise geprüft und aktualisiert

| Bereich | Vorher (alte Handles) | Nachher | Wer |
|---|---|---|---|
| OFE v3 `templates/index.json` | 9 Stellen (Hero, Raum-Inspiration, Editorial, Scroll-Showcase) | 0 | 6 von Shopify automatisch, 3 von mir |
| OFE v3 `templates/page.rooms.json` | 6 Stellen (3 Räume à 2 Poster) | 0 | 3 von Shopify automatisch, 3 von mir |
| OFE v3 alle übrigen 457 Dateien (sections, snippets, blocks, assets, locales, config) | 0 | 0 | – |
| Live v2.0 `templates/index.json` | 1 Stelle (Scroll-Showcase) | 0 | Shopify automatisch |
| Live v2.0 übrige Dateien (templates, sections, snippets, blocks, config, layout) | 0 | 0 | – |
| Menüs (7 Menüs, inkl. „Hauptmenü OFE v3“) | 0 Produkt-Links | 0 | – |
| Seiten (12, inkl. agb und datenschutzerklaerung) | 0 | 0 | – |
| Blog „Neuigkeiten“ | 0 Artikel | – | – |
| Collection-Beschreibungen + SEO-Metafelder (16) | 0 | 0 | – |
| Shop-Metafelder | 0 | 0 | – |
| Produkt-Beschreibungen (113) | 0 Links auf /products/ | 0 | – |

**Wichtig – Shopify-Verhalten:** Shopify schreibt Produkt-Verweise in JSON-Templates nach einem Handle-Wechsel selbst um, aber bei vielen gleichzeitigen Änderungen **unvollständig** (in OFE v3 blieben 6 von 15 Stellen auf alten Handles stehen). Diese 6 habe ich per `themeFilesUpsert` nachgezogen und danach den kompletten Theme-Inhalt erneut geprüft. Das Archiv-Theme „ARCHIV – OFE v3 WIP“ wurde bewusst nicht angefasst und nicht geprüft.

**Produkt-Metafelder mit alten Handles im Dateinamen:** `custom.poster_3d_url`, `custom.poster_3d`, `custom.poster_3d_v4`, `custom.poster_detail` (je 99 Produkte) enthalten CDN-Datei-Links, deren **Dateinamen** den alten Handle tragen (z. B. `.../files/poster-3d-horizontal-framed-poster.glb`). Das sind Datei-Adressen, keine Produkt-URLs. Sie bleiben gültig, weil die Dateien nicht umbenannt wurden. Das Theme baut keine Dateinamen aus `product.handle` zusammen (geprüft), daher kein Handlungsbedarf.

## Backups (Rückbau möglich)

- `shop-checkliste/backup-2026-10-02/urls/produkt-handles-und-redirects-vorher.json` – alle 113 alten Handles + Weiterleitungen vorher.
- `shop-checkliste/backup-2026-10-02/urls/ofe-v3/templates/index.json` und `.../page.rooms.json` – Stand direkt vor meinem Schreiben.
- Rückbau eines Produkts: `productUpdate` mit altem Handle + `redirectNewHandle: true`, danach die dann überflüssige Weiterleitung löschen.

## Hinweis Printify

Printify kann beim erneuten Veröffentlichen („Publish“) eines Produkts Titel, Beschreibung, Tags und Bilder in Shopify überschreiben. Den **Handle** ändert Printify bei bestehenden Produkten normalerweise nicht – im Zweifel nach jedem Printify-Publish prüfen:
1. https://admin.shopify.com/store/gexdm4-2q/products öffnen, das Produkt anklicken.
2. Ganz unten „Suchmaschinen-Eintrag“ → Stift-Symbol: Die URL muss auf den neuen Handle aus der Tabelle unten enden.
3. Falls nicht: Handle aus der Tabelle eintragen, Haken „Weiterleitung von alter URL erstellen“ setzen, speichern.
Tipp: In Printify beim erneuten Veröffentlichen unter „Publishing settings“ nur die Punkte anhaken, die sich wirklich geändert haben (z. B. nur Preise/Varianten), dann bleiben Titel und Texte aus Shopify erhalten.

## Offene Punkte / für Julius

- Nichts zu klicken nötig. Die Weiterleitungen siehst du unter Onlineshop → Navigation → „URL-Weiterleitungen anzeigen“ (https://admin.shopify.com/store/gexdm4-2q/menus).
- Nach dem Veröffentlichen von OFE v3 kurz prüfen: Startseite (Hero „Discipline“, Raum-Inspiration, Editorial „FOCUS“, Scroll-Showcase) und Seite /pages/rooms zeigen jeweils ein Poster.
- Bereits verschickte Links (Test-Mails, Social Posts, Printify-Mockups) mit alten Adressen funktionieren weiter über die Weiterleitungen.
- Die Datei `shop-checkliste/daten/produkte-2026-10-02.json` ist ein Export von heute früh und enthält noch die alten Handles; die Zuordnung alt → neu steht in `handle-plan.json`.

## Gegenprüfung (02.10.2026, ca. 14:30 UTC)

Unabhängig vom Bericht oben gegen den **Live-Stand in Shopify** und die Repo-Dateien geprüft (per Skript, ohne Änderungen am Shop).

| Prüfpunkt | Ergebnis |
|---|---|
| Alle 113 Produkte: Live-Handle = geplanter neuer Handle (`handle-plan.json`) | 113/113 korrekt, alle Produkte aktiv und im Onlineshop + Shop-Kanal veröffentlicht |
| Weiterleitungen: genau eine `/products/<alt>` → `/products/<neu>` je alter Adresse | 109/109 vorhanden, Ziel korrekt, IDs = `redirect_id` im Plan; keine doppelten Pfade |
| Ketten, Schleifen, tote Ziele | keine: kein Ziel ist selbst eine Weiterleitung, jedes Ziel ist ein Live-Handle, kein Weiterleitungs-Pfad überdeckt ein Live-Produkt |
| Sonstige Weiterleitungen | nur `/collections` → `/collections/all` (alt, unverändert); insgesamt 110 |
| Handles: nur a–z, 0–9, Bindestrich; Länge; Dubletten; alte Handles wiederverwendet | alles sauber; Ø 30 Zeichen, max. 42; jedes Wort stammt aus dem Produkttitel (einzige Übersetzung: „Formula“ → `formel`, gewollt); keine Tippfehler gefunden |
| OFE v3: alle 459 Dateien auf 109 alte Handles | 0 Treffer |
| OFE v3: alle Einstellungen vom Typ Produkt (aus den Section-Schemas ermittelt) | 16 Werte: 15 Handles (index.json 9, page.rooms.json 6), alle existieren live; 1 × `{{ closest.product }}` (dynamisch, korrekt); keine leeren Felder |
| OFE v3: fest eingetragene `/products/…`-Links und `shopify://products/…` | keine (einzige Fundstelle: Shopify-Hilfelink in den Editor-Übersetzungen) |
| OFE v3: Einstellungen vom Typ Collection | 8 Werte, alle existieren |
| Live-Theme v2.0 (nur gelesen): 428 Dateien | 0 alte Handles; Produkt-Einstellung im Scroll-Showcase zeigt auf `not-over-until-i-win-poster` (existiert) |
| Menüs (7, 57 Einträge), Seiten (12), Artikel (0), Collection-Beschreibungen + Metafelder (16), Shop-Metafelder, Produktbeschreibungen + SEO-Texte (113) | keine alten Handles, keine Produkt-Links auf nicht existierende Produkte |
| Metaobjekte | nur Shopify-Kategorie-Werte (Material, Ausrichtung …), keine Handles |
| Übersetzte Handles (andere Sprachen) | nicht möglich: Shop hat nur die Sprache Deutsch |
| Produkt-Metafelder `custom.poster_3d*` | alte Handles nur in CDN-**Dateinamen** (über 1.000 Fundstellen in `poster_3d`, `poster_3d_v4`, `poster_3d_url`, alle `cdn.shopify.com/.../files/...`); Stichprobe 60 Datei-Links: alle HTTP 200. OFE v3 nutzt diese Metafelder nicht → kein Handlungsbedarf |
| Repo: Bericht-Tabelle und Backups | Tabelle 109/109 identisch mit Plan; Backup enthält alle 113 alten Handles + Weiterleitungen vorher; keine Zugangsdaten in den Dateien |
| Repo: weitere Dateien mit alten Handles | nur alte Backups/Audits (Absicht), `daten/produkte-2026-10-02.json` und `launchplan.html` (bereits als Übergabe vermerkt), `social/motive.json` (nur CDN-Bilddateinamen, gültig) |

**Gefunden:** keine Fehler. **Behoben:** nichts nötig, keine Änderung am Shop oder Theme.

Grenzen der Prüfung:
- Der Shop ist passwortgeschützt; ein echter Aufruf der alten Adressen landet auf `/password` (geprüft). Ob die 301 im Browser greift, lässt sich erst ohne Passwort testen → nach dem Launch einmal `limitlessposter.com/products/horizontal-framed-poster` aufrufen, es muss `/products/vintage-formel-1-racing-poster` öffnen.
- Archiv-Theme „ARCHIV – OFE v3 WIP“ vorgabegemäß nicht geprüft. Es darf nicht veröffentlicht werden, ohne vorher die Produkt-Verweise (Startseite, Räume) neu zu wählen.
- Adressen mit Collection-Pfad (`/collections/<x>/products/<alt>`) haben keine eigene Weiterleitung. Da der Shop noch nie öffentlich war, gibt es solche Links praktisch nicht; kein Handlungsbedarf.

## Tabelle alt → neu (109 Produkte)

| # | Titel | alt | neu |
|---|---|---|---|
| 1 | Vintage Formula 1 – Racing-Poster im Ölgemälde-Stil | `horizontal-framed-poster` | `vintage-formel-1-racing-poster` |
| 2 | Yacht auf offener See – Ozean-Poster | `framed-poster-aerial-yacht-wake-ocean-print` | `yacht-auf-offener-see-poster` |
| 3 | The World Rewards Action – Space-Motivationsposter | `framed-poster-the-world-rewards-action-motivational-space-wall-art` | `the-world-rewards-action-space-poster` |
| 4 | Make Them Wonder – Messi Fußball-Poster | `messi-make-them-wonder-soccer-poster` | `make-them-wonder-messi-poster` |
| 5 | Become Unstoppable – Motivationsposter | `become-unstoppable-framed-poster-motivational-sports-wall-art` | `become-unstoppable-motivationsposter` |
| 6 | Stay Focused, Stay Dangerous – Fitness-Poster | `motivational-fitness-poster-stay-focused-stay-dangerous-vertical-wall-art` | `stay-focused-stay-dangerous-fitness-poster` |
| 7 | Start Unknown, Finish Unforgettable – Motivationsposter | `framed-poster-start-unknown-finish-unforgettable-inspirational-vertical-wall-art` | `start-unknown-finish-unforgettable-poster` |
| 8 | Set Your Own Standard – Motivationsposter | `motivational-poster-set-your-own-standard-vertical-framed-art` | `set-your-own-standard-motivationsposter` |
| 9 | Sacrifice Today, Own Tomorrow – Boxing-Poster | `sacrifice-today-own-tomorrow-framed-motivational-boxing-poster` | `sacrifice-today-own-tomorrow-boxing-poster` |
| 10 | No Excuses, Just Results – Motivationsposter | `motivational-poster-no-excuses-just-results-vertical-wall-art` | `no-excuses-just-results-motivationsposter` |
| 11 | Money Follows Value – Office-Poster | `money-follows-value-framed-poster-motivational-office-wall-art` | `money-follows-value-office-poster` |
| 12 | Stay Hungry – Gym-Poster | `stay-hungry-poster-motivational-fitness-wall-art-vertical-framed` | `stay-hungry-gym-poster` |
| 13 | Prove Yourself Right – Motivationsposter | `motivational-prove-yourself-right-framed-poster-inspiring-wall-art-for-home-or-office` | `prove-yourself-right-motivationsposter` |
| 14 | The Hard Way Builds the Strongest – Fight-Poster | `motivational-fight-club-poster-hard-way-builds-the-strongest-vertical-framed-art` | `hard-way-builds-the-strongest-poster` |
| 15 | The Goal Never Moves – Fußball-Poster | `poster-the-goal-never-moves-soccer-wall-art` | `the-goal-never-moves-fussball-poster` |
| 16 | Your Dreams Need You – Fußball-Poster | `poster-motivational-soccer-print-your-dreams-need-you` | `your-dreams-need-you-fussball-poster` |
| 17 | Don't Quit – Minimal-Motivationsposter | `dont-quit-framed-poster-minimal-motivational-wall-art` | `dont-quit-motivationsposter` |
| 18 | A Lot Can Happen in a Year – Motivationsposter | `framed-poster-a-lot-can-happen-in-a-year-inspirational-wall-art` | `a-lot-can-happen-poster` |
| 19 | Pressure Makes Diamonds – Motivationsposter | `vertical-poster-pressure-makes-diamonds-motivational-sports-wall-art` | `pressure-makes-diamonds-motivationsposter` |
| 20 | Don't Wait to Be Happy – Typo-Poster in Rot | `framed-poster-dont-wait-to-be-happy-minimal-red-script-wall-art` | `dont-wait-to-be-happy-poster` |
| 21 | La Dolce Vita – Italien-Poster | `la-dolce-vita-framed-poster-italian-phrase-wall-art` | `la-dolce-vita-italien-poster` |
| 22 | Just Do It – Aviation-Poster | `just-do-it-aviation-framed-poster` | `just-do-it-aviation-poster` |
| 23 | You Were Born an Original – Motivationsposter | `framed-motivational-poster-you-were-born-an-original-don-t-die-a-copy` | `you-were-born-an-original-poster` |
| 24 | You vs You – Berg-Motivationsposter | `motivational-mountain-poster-it-always-been-you-vs-you-framed-wall-art` | `you-vs-you-berg-poster` |
| 25 | Whatever It Takes – Portrait-Poster | `framed-poster-whatever-it-takes-motivational-portrait-wall-art` | `whatever-it-takes-portrait-poster` |
| 26 | Work So Hard They Think You're Crazy – Motivationsposter | `framed-poster-work-so-hard-that-they-think-you-are-crazy-motivational-wall-art` | `work-so-hard-motivationsposter` |
| 27 | I Always Win – Motivationsposter | `motivational-poster-i-always-win-vertical-framed-wall-art` | `i-always-win-motivationsposter` |
| 28 | Believe in Yourself – Pokal-Poster | `believe-in-yourself-poster-motivational-sports-trophy-wall-art` | `believe-in-yourself-pokal-poster` |
| 29 | I Win, That's What I Do – Motivationsposter | `poster-i-win-thats-what-i-do-motivational-photo-wall-art` | `i-win-motivationsposter` |
| 30 | I Don't Know How, But I Will – Gym-Poster | `motivational-gym-poster-i-dont-know-how-but-i-will-framed-fitness-print` | `i-dont-know-how-gym-poster` |
| 31 | Just Do Some Creative Shits – Typo-Art-Poster | `framed-poster-just-do-some-creative-shits-bold-typographic-art-print` | `just-do-some-creative-shits-poster` |
| 32 | The Only Limit Is Your Mind – Schwarz-Weiß-Poster | `motivational-framed-poster-the-only-limit-is-your-mind-black-white-wall-art` | `only-limit-is-your-mind-poster` |
| 33 | No Risk, No Story – Foto-Poster | `no-risk-no-story-poster-whimsical-baby-photo-wall-art` | `no-risk-no-story-foto-poster` |
| 34 | Never Too Late to Lock In – Portrait-Poster | `motivational-poster-it-s-never-too-late-to-lock-in-black-white-portrait-art` | `never-too-late-lock-in-poster` |
| 35 | Jaguar in Blüten – Wildlife-Poster | `roaring-jaguar-floral-poster` | `jaguar-in-blueten-wildlife-poster` |
| 36 | Schwanensee – Aquarell-Poster | `swan-lake-framed-art-print-serene-watercolor-swan-poster` | `schwanensee-aquarell-poster` |
| 37 | Haie vor der Küste – Ozean-Poster | `ocean-predator-art-poster-sharks-aerial-surf-scene-vertical-framed-print` | `haie-vor-der-kueste-poster` |
| 38 | Dobermann unter Schafen – Schwarz-Weiß-Poster | `black-doberman-among-sheep-poster-monochrome-animal-wall-art` | `dobermann-unter-schafen-poster` |
| 39 | Vintage-Sportwagen & Pferd – Retro-Poster | `vintage-sports-car-horse-art-poster-retro-automotive-wall-decor` | `vintage-sportwagen-pferd-retro-poster` |
| 40 | Pferd & Oldtimer – Surreal-Art-Poster | `poster-surreal-horse-vintage-car-art-print` | `pferd-oldtimer-surreal-poster` |
| 41 | Vintage Porsche & Karussellpferd – Retro-Poster | `vintage-porsche-poster-retro-car-carousel-horse-vertical-framed-art` | `vintage-porsche-karussellpferd-poster` |
| 42 | Dressurpferd – Equestrian-Poster | `dressage-horse-poster-equestrian-art-print-vertical-framed` | `dressurpferd-equestrian-poster` |
| 43 | Leopard auf Ast – Schwarz-Weiß-Poster | `leopard-on-branch-black-white-framed-poster` | `leopard-auf-ast-schwarz-weiss-poster` |
| 44 | Leopard auf Ast – Minimal-Wildlife-Poster | `leopard-on-branch-framed-poster-minimalist-wildlife-wall-art` | `leopard-auf-ast-minimal-poster` |
| 45 | Ferrari & weißer Hengst – Auto-Poster | `framed-poster-ferrari-and-white-stallion-art-print` | `ferrari-weisser-hengst-poster` |
| 46 | Watching Eyes – Money-Art-Poster (Querformat) | `framed-poster-watching-eyes-money-tear-wall-art-horizontal` | `watching-eyes-money-poster` |
| 47 | Marlboro F1 – Racing-Poster (Querformat) | `marlboro-f1-racing-car-poster-horizontal-framed-print` | `marlboro-f1-racing-poster` |
| 48 | The World Is Yours – Motivationsposter | `framed-poster-the-world-is-yours-motivational-wall-art` | `the-world-is-yours-poster` |
| 49 | Wimbledon von oben – Tennis-Poster | `wimbledon-tennis-court-framed-poster` | `wimbledon-von-oben-tennis-poster` |
| 50 | Class. Intensity. Grit. – Tennis-Poster | `class-intensity-grit-tennis-framed-poster` | `class-intensity-grit-tennis-poster` |
| 51 | Tennis Court Aerial – Tennis-Poster | `tennis-court-framed-poster-aerial-tennis-match-wall-art` | `tennis-court-aerial-poster` |
| 52 | Green Court von oben – Tennis-Poster | `tennis-court-framed-poster-aerial-green-court-art-print` | `green-court-von-oben-tennis-poster` |
| 53 | You Can Always Be Better – Golf-Poster | `framed-poster-you-can-always-be-better-golf-wall-art` | `always-be-better-golf-poster` |
| 54 | Risk Is Better Than Regret – Tennis-Poster | `framed-poster-risk-is-better-than-regret-tennis-photo-wall-art` | `risk-better-than-regret-tennis-poster` |
| 55 | Discipline – Gym-Poster | `discipline-motivational-poster-gym-wall-art` | `discipline-gym-poster` |
| 56 | Be Different – Jordan Basketball-Poster | `framed-poster-be-different-michael-jordan-basketball-print` | `be-different-jordan-basketball-poster` |
| 57 | Luke 1:37 – Faith & Sports Poster | `inspirational-sports-poster-luke-1-37-for-nothing-is-impossible-with-god-vertical-framed-print` | `luke-1-37-faith-poster` |
| 58 | If You Quit, Everyone Was Right – Fußball-Poster | `motivational-soccer-poster-if-you-quit-everyone-was-right-about-you-vertical-framed-poster` | `if-you-quit-fussball-poster` |
| 59 | All or Nothing – Fußball-Poster | `all-or-nothing-soccer-poster-framed-vertical-sports-print` | `all-or-nothing-fussball-poster` |
| 60 | No Risk No Story – Basketball-Poster | `framed-poster-no-risk-no-story-basketball-art-print` | `no-risk-no-story-basketball-poster` |
| 61 | No Risk, No Porsche – Retro-Poster | `no-risk-no-porsche-framed-poster-retro-palm-springs-wall-art` | `no-risk-no-porsche-retro-poster` |
| 62 | Self Respect – Vintage-Quote-Poster | `self-respect-framed-poster-vintage-godfather-quote-wall-art` | `self-respect-vintage-poster` |
| 63 | Fuck Them All – Street-Art-Poster | `vertical-poster-fuck-them-all-street-art-money-throwing-print` | `fuck-them-all-street-art-poster` |
| 64 | The Perfect Time Never Comes – World-Is-Yours-Poster | `vertical-poster-the-perfect-time-never-comes-motivational-wall-art-the-world-is-yours` | `perfect-time-never-comes-world-poster` |
| 65 | Money Talks – Franklin Money-Art-Poster | `money-talks-framed-poster-benjamin-franklin-eye-art-print` | `money-talks-franklin-poster` |
| 66 | Monochrome Player – Fußball-Poster in Schwarz-Weiß | `monochrome-soccer-poster-black-white-framed-player-print` | `monochrome-player-fussball-poster` |
| 67 | Tutto Passa – Mediterranes Vintage-Poster | `framed-poster-vintage-mediterranean-tutto-passa-seaside-portrait` | `tutto-passa-vintage-poster` |
| 68 | Pressure Is a Privilege – Motivationsposter | `pressure-is-a-privilege-framed-poster-motivational-sports-wall-art` | `pressure-is-a-privilege-poster` |
| 69 | Discipline – Fußball-Poster | `discipline-soccer-poster-motivational-framed-sports-wall-art` | `discipline-fussball-poster` |
| 70 | Signed Icon – Portrait-Poster in Schwarz-Weiß | `framed-black-white-portrait-poster-minimalist-signed-headshot-art` | `signed-icon-portrait-poster` |
| 71 | It's More Than Football – Fußball-Poster | `framed-poster-its-more-than-football-soccer-team-wall-art` | `its-more-than-football-poster` |
| 72 | Never Forgetting Where We Came From – Space-Poster | `framed-poster-never-forgetting-where-we-came-from-space-surfer-print` | `where-we-came-from-space-poster` |
| 73 | Race Track Loop – Racing-Art-Poster | `race-track-art-poster-framed-vertical-print-with-formula-car-loop-design` | `race-track-loop-poster` |
| 74 | Scuderia Ferrari – F1-Poster | `ferrari-scuderia-formula-1-vertical-framed-poster` | `scuderia-ferrari-f1-poster` |
| 75 | Neymar, Cristiano & Messi – Legenden-Poster | `framed-football-legends-poster-neymar-cristiano-messi-trio-print` | `neymar-cristiano-messi-legenden-poster` |
| 76 | Jesus Headband – Athleten-Portrait-Poster | `jesus-headband-poster-black-white-signed-athlete-portrait-wall-art` | `jesus-headband-portrait-poster` |
| 77 | World Cup Moment – Fußball-Poster | `framed-soccer-trophy-poster-inspirational-world-cup-celebration-wall-art` | `world-cup-moment-fussball-poster` |
| 78 | Messi – Portrait-Poster in Schwarz-Weiß | `framed-poster-messi-black-white-portrait-wall-art` | `messi-portrait-schwarz-weiss-poster` |
| 79 | GOAT – Vintage-Portrait-Poster | `goat-framed-poster-vintage-sports-portrait-wall-art` | `goat-vintage-portrait-poster` |
| 80 | Focus on You – Panther-Poster | `framed-poster-focus-on-you-black-panther-wall-art-vertical` | `focus-on-you-panther-poster` |
| 81 | Your Only Limit Is Your Mind – Floral-Poster | `floral-motivational-poster-your-only-limit-is-your-mind-vertical-framed-art` | `your-only-limit-floral-poster` |
| 82 | What's Behind You Doesn't Matter – Racing-Poster | `racing-poster-whats-behind-you-doesnt-matter-framed-motivational-print` | `whats-behind-you-racing-poster` |
| 83 | God Is With Me, I Can't Lose – Faith-Poster | `framed-poster-god-is-with-me-i-cant-lose-inspirational-wall-art` | `god-is-with-me-faith-poster` |
| 84 | They Overlooked Me, God Didn't – Racing-Poster | `inspirational-racing-poster-they-overlooked-me-god-didn-t-vertical-framed-print` | `they-overlooked-me-racing-poster` |
| 85 | It's Not Over Until I Win – Motivationsposter | `motivational-framed-poster-its-not-over-until-i-win` | `not-over-until-i-win-poster` |
| 86 | Whatever It Takes – Typo-Poster | `whatever-it-takes-framed-poster-motivational-bedroom-wall-art` | `whatever-it-takes-typo-poster` |
| 87 | Crystal OK – Art-Poster | `framed-poster-crystal-gloved-hand-ok-sign-wall-art` | `crystal-ok-art-poster` |
| 88 | Focus – Gym-Poster | `focus-framed-poster-motivational-gym-wall-art` | `focus-gym-poster` |
| 89 | Red Graffiti – Portrait-Poster | `framed-poster-bold-red-graffiti-portrait` | `red-graffiti-portrait-poster` |
| 90 | Do It Alone – Fußball-Poster | `motivational-soccer-poster-do-it-alone-framed-wall-art` | `do-it-alone-fussball-poster` |
| 91 | Signature – Minimal-Portrait-Poster | `framed-portrait-poster-minimal-black-white-signature-art` | `signature-minimal-portrait-poster` |
| 92 | It's You vs You – Ronaldo Fußball-Poster | `motivational-soccer-poster-its-you-vs-you-ronaldo-7-framed-print` | `its-you-vs-you-ronaldo-poster` |
| 93 | No Risk No Story – Racing-Poster | `racing-poster-no-risk-no-story-framed-motorsport-wall-art` | `no-risk-no-story-racing-poster` |
| 94 | Get Up, We Ain't Rich Yet – Motivationsposter | `get-up-we-aint-rich-yet-motivational-wall-poster` | `we-aint-rich-yet-poster` |
| 95 | The Perfect Time Never Comes – Trader-Meme-Poster | `framed-poster-the-perfect-time-never-comes-motivational-wall-art` | `perfect-time-never-comes-trader-poster` |
| 96 | Red Retro – Musik-Poster im Pop-Art-Stil | `red-retro-music-poster` | `red-retro-musik-poster` |
| 97 | Life Is Tough, So Are You – Motivations-Poster | `motivational-poster-life-is-tough-so-are-you-framed-vertical-art` | `life-is-tough-motivationsposter` |
| 98 | Nobody Is Coming to Save You – Racing-Poster | `vertical-framed-poster-nobody-is-coming-to-save-you-motivational-racing-portrait` | `nobody-is-coming-racing-poster` |
| 99 | What a Privilege – Tennis-Poster mit Augenzwinkern | `what-a-privilege-poster-humorous-work-exhaustion-wall-art` | `what-a-privilege-tennis-poster` |
| 100 | Born to Win – Panther-Poster | `panther-poster-born-to-win-motivational-wall-art` | `born-to-win-panther-poster` |
| 101 | Leopard mit Perlenkette – Wildlife-Poster (Querformat) | `framed-poster-leopard-with-pearl-necklace-wall-art` | `leopard-mit-perlenkette-poster` |
| 102 | Matchday von oben – Tennis-Poster (Querformat) | `tennis-court-framed-art-print-aerial-matchday-poster` | `matchday-von-oben-tennis-poster` |
| 103 | Winning Isn't for Everyone – Medaillen-Poster | `motivational-poster-winning-isn-t-for-everyone-medal-wall-art` | `winning-isnt-for-everyone-medaillen-poster` |
| 104 | Tiger im Pool – Vintage-Wildlife-Poster (Querformat) | `tiger-pool-framed-poster-vintage-zoo-photography-wall-art` | `tiger-im-pool-vintage-poster` |
| 105 | FOCUS – Skulptur-Poster in Schwarz-Weiß | `focus-motivational-poster-classical-sculpture-wall-art` | `focus-skulptur-poster` |
| 106 | Queens Don't Compete, They Reign – Leoparden-Poster | `framed-poster-queens-dont-compete-they-reign-leopard-wall-art` | `queens-dont-compete-leoparden-poster` |
| 107 | Designer Heels – Fashion-Poster in Schwarz-Weiß | `framed-fashion-poster-black-white-designer-heels-wall-art` | `designer-heels-fashion-poster` |
| 108 | Noir – Pistole & Perlen, Statement-Poster | `framed-poster-noir-arm-with-gun-draped-beads-vertical-art-print` | `noir-pistole-perlen-poster` |
| 109 | Batman-Silhouette – Red-Noir-Poster | `batman-silhouette-vertical-framed-poster-red-noir-superhero-wall-art` | `batman-silhouette-red-noir-poster` |
