# LimitlessPoster — Launch-Checkliste: Bearbeitungsstand

**Stand: 15. August 2026, abends** · Bearbeitet von Claude per Shopify-Admin-API · Basis: Launch-Checkliste vom 09.08.2026

## ✅ Heute erledigt (per API, live im Shop)

| Checklisten-Punkt | Was gemacht wurde |
|---|---|
| **P0 · Steuern § 19 UStG (Teil 2)** | Haken „Steuer beim Verkauf berechnen" bei **allen 101 Produkten / 1.198 Varianten** entfernt (`taxable=false`). Unabhängig per API verifiziert: 0 Varianten mehr steuerpflichtig. |
| **P0 · § 19-Hinweis (Teil 4, produktseitig)** | Satz „Alle Preise sind Endpreise. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung)." steht jetzt in **allen 101 Produktbeschreibungen**. |
| **P0 · Datenschutzerklärung** | Vollständige deutsche DSGVO-Erklärung erstellt (Verantwortlicher, Shopify/Irland, Printify/Print Pigeons, PayPal, Cookies/TDDDG, Drittland/DPF, Betroffenenrechte, LfDI BW). Live als Seite `/pages/datenschutzerklaerung` + im Footer verlinkt. **Rest-Schritt für dich:** Text zusätzlich in Einstellungen → Richtlinien einfügen (Datei liegt bei), damit auch die Checkout-Links den neuen Text zeigen. |
| **P0 · Cookie-Banner** | Per API geprüft: Consent-Pflicht ist bereits für **alle EU-Länder aktiv** (`consentRequired=true`, DE bis SK). Nach dem Launch einmal im Inkognito-Fenster gegenprüfen. |
| **P0 · Testbestellung (Vorbereitung)** | 100 %-Rabattcode **`LAUNCH-TEST-100`** angelegt (max. 1 Verwendung, 1× pro Kunde, ab sofort gültig). |
| **P1 · AGB** | Vollständige AGB erstellt (Vertragsschluss, § 19-Preise, Lieferung 4–10 Werktage, Gewährleistung, Haftung, Widerrufs-Verweis, § 36 VSBG, Rom-I-Klausel für EU-Verkauf). Live als `/pages/agb` + Footer-Link. Rest-Schritt wie oben: in Richtlinien einfügen. |
| **P1 · GPSR-Pflichtangaben** | Block „Verantwortlich im Sinne der GPSR: LimitlessPoster — Julius Erb, Eugen-Bolz-Straße 28, 73732 Esslingen am Neckar, E-Mail" in **allen 101 Produktbeschreibungen** ergänzt. |
| **P1 · Footer-Rechtslinks** | Alle drei Footer-Menüs aktualisiert: **Impressum, Datenschutzerklärung, AGB, Widerrufsrecht, Versand & Lieferung** jetzt verlinkt. Der irreführende Link „Rückgaben & Stornierungen" → Kunden-Login zeigt jetzt auf die **Widerrufsbelehrung**. |
| **P1 · Theme umbenennen** | Live-Theme „OFE v2 — Scroll+NewDrop (Claude WIP)" → **„LimitlessPoster v2.0"**. Alte Themes bleiben als Backup. |
| **P1 · Doppelte Kontaktseiten** | `/pages/kontakt` gelöscht, `/pages/contact` behalten (Inhalte zusammengeführt, jetzt mit Anschrift), alle Menülinks vereinheitlicht, tote Links in der FAQ gefixt. |
| **P1 · Dünne Kollektionen** | Geprüft: Bestseller (1), Artists (2), GRIT (2), ICONS (3) sind **weder im Menü noch auf der Startseite verlinkt** — im Live-Shop unsichtbar, kein Handlungsdruck. Die Startseite nutzt `new-drop` + `mindset-words-ambition`. Achtung: Die Kollektionen „Bestseller" und „Startseite" enthalten nur das Draft-Produkt „They Doubt Me I Deliver". Empfehlung: Bestseller nach den ersten echten Verkäufen füllen. |
| **P2 · Content-Seiten** | **Größen-Guide** neu erstellt (`/pages/groessen-guide`: alle 6 Größen in Zoll + cm, Platzierungs-Faustregeln, Rahmen-Infos) und **FAQ erweitert** (Versandkosten, Lieferzeit 4–10 Werktage, § 19-Frage, Rücksendungs-Ablauf, Transportschäden-Kulanz). Beides im Footer verlinkt. |
| **Impressum/Versandrichtlinie (§ 19)** | Aktualisierte Texte mit § 19-Absatz vorbereitet (API-Schreibzugriff auf Richtlinien ist gesperrt) → Dateien in `richtlinien-texte/`, Copy-Paste ≈ 2 Minuten. |

**Hinweis zur Technik:** Die Shopify-MCP-Anbindung hat keinen Scope `write_legal_policies` — Richtlinien (Einstellungen → Richtlinien) kann ich lesen, aber nicht schreiben. Deshalb liegen alle vier Texte fertig in `richtlinien-texte/` zum Einfügen.

## 📋 Offene Punkte — nur du kannst sie erledigen (Logins/Identität nötig)

**P0 — vor dem Launch:**
1. **Printify → Payments:** Zahlungsmethode hinterlegen (Karte oder PayPal). Ohne das bleibt jede Bestellung „On Hold".
2. **Printify → Settings → Orders:** Bestell-Freigabe auf **manuell** stellen (für die ersten 10–20 Bestellungen).
3. **Shopify → Einstellungen → Steuern und Zölle:** Steuererhebung für Deutschland/EU **deaktivieren** und Haken „Alle Preise inkl. Steuer" **entfernen**. (Produktseitig ist schon alles steuerfrei — diese zwei Schalter gibt es nur im Admin-UI.)
4. **Richtlinien einfügen:** Die 4 Dateien aus `richtlinien-texte/` unter Einstellungen → Richtlinien einsetzen (Datenschutzerklärung, AGB, Impressum, Versandrichtlinie).
5. **Widerrufsbutton-App** installieren (Shopify App Store, z. B. „EU Widerrufsbutton") — App-Installationen gehen nicht per API. Sag mir danach Bescheid, ich prüfe/verlinke den Button.
6. **Shopify Payments aktivieren** (Einstellungen → Zahlungen; Ausweis + Bankkonto, 1–3 Tage Vorlauf) → Kreditkarte, Apple Pay, Google Pay, Klarna.
7. **LUCID-Registrierung** (verpackungsregister.org, kostenlos) + Versandverpackung bei einem dualen System lizenzieren (z. B. Lizenzero, ~30 Min.).
8. **§ 19-Satz im Footer:** Onlineshop → Anpassen (Theme-Editor) → Footer-Text: „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet." (Das Live-Theme ist für API-Schreibzugriffe gesperrt.)
9. **Testbestellung** mit Code `LAUNCH-TEST-100` durchspielen: Checkout → Bestellbestätigung → kommt die Bestellung bei Printify an? → dort stornieren, bevor sie in Produktion geht.
10. **E-Mail-Benachrichtigungen** einmal testen (Einstellungen → Benachrichtigungen): Sprache, Logo, kein MwSt.-Ausweis.
11. **Launch:** Onlineshop → Präferenzen → Passwortschutz deaktivieren. Danach: Handy-Check + Google Search Console + Sitemap.

**P1/P2 — kann nach dem Launch:**
- Eigene Domain-E-Mail (z. B. Zoho kostenlos) → dann ersetze ich die Gmail-Adresse überall per API.
- 30 Min. Steuerberater: § 19-Grenzen (25k/100k), OSS ab 10.000 € EU-Umsatz, Reverse Charge § 13b auf Printify-Rechnungen (ggf. USt-IdNr beantragen).
- Bewertungs-App (Judge.me), Marketing-Kanäle, Newsletter-Liste anschreiben, EU-Print-Provider-Vergleich, EN-Sprachversion.

## 📨 Was ich von dir brauche (einfach hier in den Chat schicken)

- Bestätigung: Printify-Zahlungsmethode hinterlegt + Order-Approval umgestellt
- Bestätigung: Steuererhebung im Shopify-Admin deaktiviert („inkl. Steuer"-Haken raus)
- Name der installierten Widerrufsbutton-App → ich verlinke den Button im Footer
- LUCID-Registrierungsnummer (sobald vorhanden) → ich hinterlege sie im Impressum
- Neue Domain-E-Mail-Adresse (sobald eingerichtet) → ich tausche die Gmail überall aus
- USt-IdNr., falls beantragt → kommt ins Impressum
- Optional: Telefonnummer fürs Impressum (Vertrauen, keine Pflicht)
- Ergebnis der Testbestellung (ging alles durch? Screenshot bei Problemen)
- Entscheidung: Shopify Payments beantragt? (Empfehlung: ja, wegen 60–110-€-Warenkörben)

## Verifikation

- `taxable=false`: alle 1.198 Varianten per API nachgeprüft (3 Seiten Pagination, 0 Treffer mit `taxable=true`)
- GPSR-Block: String-Prüfung über alle 101 `descriptionHtml` — überall vorhanden
- Menüs: Rückgabe der `menuUpdate`-Mutationen zeigt alle neuen Links inkl. korrekter Ziele
- Cookie-Consent: `consentPolicy`-Abfrage — alle 28 EU-Staaten (+ GB) auf `consentRequired=true`
