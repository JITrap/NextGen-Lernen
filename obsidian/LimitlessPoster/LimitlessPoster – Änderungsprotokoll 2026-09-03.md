---
tags: [limitlessposter, changelog]
datum: 2026-09-03
---
# Änderungsprotokoll 03.09.2026 – Umstellung auf „Versand nur Deutschland"

Entscheidung Julius: erst nur in Deutschland verkaufen, später evtl. expandieren. Alles per Shopify-API umgesetzt, Backups der Vorher-Zustände liegen im Repo unter `shop-checkliste/backup-2026-09-03/`. Jede Änderung wurde von einem unabhängigen Prüf-Agenten gegen den Live-Stand verifiziert.

## Erledigt (live)
| Bereich | Änderung | Prüfung |
|---|---|---|
| Markets | „Europäische Union" (26 Länder) → Status **Entwurf**; „Deutschland" bleibt primär/aktiv; „America" war schon aus | ✅ |
| Versandprofil „Allgemeines Profil" | EU-Zone gelöscht; **Express-Methode 9,99 €** (widersprach AGB) gelöscht; übrig: Zone Deutschland, Standardversand 0 € | ✅ |
| Seite AGB (/pages/agb) | Stand 03.09.2026; § 4 (2) und § 5 (1) auf Deutschland-only | ✅ |
| Seite Hilfe & FAQ | Versandantwort DE-only; neue FAQ „Liefert ihr auch ins Ausland?"; Gewährleistung ohne „(EU)" | ✅ |
| Seite Über uns | Größen in cm, „versandkostenfrei innerhalb Deutschlands" | ✅ |
| 15 Collections | Meta-Descriptions „DE & EU" → „innerhalb Deutschlands / in Deutschland inklusive", alle ≤ 160 Zeichen, SEO-Titel erhalten | ✅ |
| 99 Produkte | Printify-Satz „2 Jahre Gewährleistung in der EU und Nordirland gemäß Richtlinie 1999/44/EG" → „versandkostenfrei innerhalb Deutschlands … gesetzliche Gewährleistung von 2 Jahren"; GPSR-Block unverändert | ✅ 99/99 byteidentisch geprüft |
| Theme OFE v3 (unveröffentlicht) | 8 Steuertexte (de.json), Announcement-Bar + Trust-Punkt + Produkt-Trust: „ab 50 €" → „Kostenloser Versand innerhalb Deutschlands"; Hilfe-/Story-/Produkt-Templates DE-only | ✅ |

## Bewusst so gelassen
- „Gedruckt & gerahmt in der EU" (Herkunftsangabe, wahr) im Theme.
- Printify-Versandprofile (Zone „Deutschland + EU") – werden von Printify verwaltet; EU-Checkout wird durch die Markets blockiert.
- AGB § 13 Klausel zu Verbrauchern in anderen EU-Staaten (Standardklausel, unschädlich).
- Datenschutzerklärung (EU-Erwähnungen betreffen Datenübermittlung, nicht Versand).

## Offen – nur Julius kann das
1. **Checkout-Richtlinien** Versand + AGB unter Einstellungen → Richtlinien einfügen (API hat keinen Scope `write_legal_policies`). Vorlagen: `vorlagen/` bzw. Checkliste.
2. **Homepage-Meta-Description** (Präferenzen) auf „Versand innerhalb Deutschlands inklusive".
3. **OFE v3 veröffentlichen** – erst dann sind Theme-Texte und die korrigierte Versandleiste live (v2.0 zeigt noch „ab 50 €").
4. Rest laut Checkliste: Finanzamt (Termin Fr 04.09. 09:30 im Google-Kalender), LUCID, Shopify Payments/PayPal, Testbestellung, Passwort.

## Sonstiges
- Kalender-Termin „Finanzamt Esslingen anrufen" für Fr 04.09.2026 09:30 angelegt (mit Nummern + Fragen).
- Shop-Grundeinstellungen geprüft: metrisch, kg, EUR, Europe/Berlin, Steuern nicht im Preis, Standort DE, Checkout deutsch.
- Verbundenes Gmail ist das private Konto – Printify-/Shopify-Mails liegen im Shop-Postfach (nicht verbunden).
