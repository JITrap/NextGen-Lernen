---
created: 2026-08-27
tags: [limitlessposter, shopify, offene-punkte]
---

# Offene Punkte

Zurück zum [[00 Dashboard]] · Entscheidungen dazu: [[30 Entscheidungslog]]

> [!todo] Bei Julius
> - [ ] **Preview-Share-Link** erzeugen: Admin → Themes → OFE v3 → „…" → „Vorschau teilen" (per API nicht möglich, kein `previewUrl`-Feld). Schaltet Testschleife B frei (Playwright-E2E, Desktop 1440×900 + Mobile 390×844).
> - [ ] **Screenshots aus dem Desktop-Ordner „Änderungen"** in den Chat ziehen — die Cloud-Session erreicht den PC nicht.
> - [ ] **Publish-Entscheidung** für OFE v3 (erst nach bestandener Testschleife B).
> - [ ] **Obsidian-Setup lokal ausführen**: Copy-Paste-Prompt aus `obsidian-setup/README.md` in einer lokalen Claude-Session (Cowork oder Claude Code auf dem PC).

> [!todo] Im Shop noch anzulegen/zu entscheiden
> - [ ] **Bundle-Rabatte als echte Shopify-Discounts** anlegen — der `limitless-bundle`-Block zeigt den Mengen-Anker, der Rabatt muss real existieren (kein Anker ohne Substanz).
> - [ ] **Review-App-Entscheidung**: echte Bewertungen sammeln. Das statische Reviews-Modul ist nur haltbar, solange „verifizierter Kauf" belegbar ist — sonst umformulieren oder ersetzen.
> - [ ] **Zahlarten-Marken** (Klarna/PayPal/Kreditkarte) erst eintragen, wenn die Methoden im Shop aktiviert und verifiziert sind (`shop.enabled_payment_types`); bis dahin generisch „Sichere Zahlung" ([[22 Konventionen]]).

> [!info] Bekannte Rest-Themen (kein Blocker)
> - **Querformat-Heroes (11 Stück)**: zeigen in dunklen Kontexten Creme-Balken ober-/unterhalb des Motivs (wirken wie Passepartout). Auf Ivory-Flächen unsichtbar (`#F6F3EE` ≈ `#F4F1EA`). Falls störend: nur die Preset-Zahlen im Snippet feinjustieren — eine Stelle.
> - **Alpha-PNG-Neurender** der 297 Assets als späteres Upgrade: würde Creme-Hintergründe ganz eliminieren; aktuell leistet der CDN-Region-Crop dasselbe serverseitig ([[30 Entscheidungslog]]).

> [!warning] Solange der Preview-Link fehlt
> E2E-Tests (Hover→Studio, Quick-Add→Cart, Sticky-ATC mobil, Reviews-Padding, CLS) laufen erst mit Link. Bis dahin: Code-/Render-Logik-Prüfung und visuelle Crop-Tests über die öffentlichen CDN-URLs.

## Reviews-Sektion (Perfektionsrunde herausgenommen)

> [!warning] „Was Kunden sagen" ist bewusst NICHT auf der Startseite
> Die Sektion `limitless-reviews` enthielt einen statischen Score (4,9) und Zitate mit „verifizierter Kauf" ohne echtes Review-System — das ist als gefälschte/ungeprüfte Bewertung abmahnbar (UWG Anhang Nr. 23b/26). Die Sektion bleibt im Theme erhalten, ist aber aus `templates/index.json` entfernt.
>
> **Wiedereinbau, sobald echte Bewertungen existieren** (z. B. via Judge.me/Loox, 5+ echte Reviews):
> 1. Inhalte der Sektion auf die echten Zahlen/Zitate umstellen (nur belegbare Aussagen, „verifiziert" nur mit App-Beleg).
> 2. Im Theme-Editor die Sektion „Kundenstimmen" zwischen „So sieht das bei dir aus." und den Gallery-Wall-Konfigurator ziehen (Conversion-Plan: Social Proof an Position 5–6).
