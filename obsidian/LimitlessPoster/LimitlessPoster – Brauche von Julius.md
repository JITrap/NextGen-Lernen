---
tags: [limitlessposter, offen]
stand: 2026-09-29
---
# LimitlessPoster – Das brauche ich von Julius

> Alles, was Claude per API **nicht** selbst erledigen kann. Sobald du einen Punkt erledigt hast oder mir Daten gibst, mache ich weiter.
> Stand 29.09.2026 nach dem Komplett-Check von Shop und Printify. Versandkosten-Problem ist von Claude behoben (automatischer Gratisversand für Deutschland).

## 1. Shopify-Admin, in dieser Reihenfolge (nur du kannst das klicken)
- [ ] **Richtlinien einfügen (≈ 3 Min, wichtigster Punkt)** – https://admin.shopify.com/store/gexdm4-2q/settings/legal
  - Versandrichtlinie: komplett ersetzen durch `vorlagen/Checkout-Richtlinie Versand (neu, DE-only).html` (nennt die EU noch 3×).
  - AGB: Text von /pages/agb (Stand 3.9.) übernehmen bzw. `vorlagen/Checkout-Richtlinie AGB (neu, DE-only).html` (§ 4 Abs. 2 und § 5 Abs. 1 nennen noch die EU).
  - Impressum: unter der USt-IdNr. einfügen:
    `Verpackungsregister (LUCID): DE4139628009499 – Registrierung und Systembeteiligung der Versandverpackungen erfolgen über unseren Fulfillment-Partner Printify, über den alle unsere Bestellungen gefertigt und versendet werden.`
  - Grund: Claude hat nur Leserechte auf Richtlinien (`write_legal_policies` fehlt). Footer-Link „Versand & Lieferung" und Hilfe-Center zeigen direkt auf die veraltete Versandrichtlinie.
- [ ] **Homepage-Meta-Description** – https://admin.shopify.com/store/gexdm4-2q/online_store/preferences → Beschreibung ersetzen durch:
  `Premium-Poster für Sport, Mindset & Lifestyle — fertig gerahmt in Schwarz oder Weiß, Versand innerhalb Deutschlands inklusive. In 4–10 Werktagen bei dir.`
  Im selben Formular: Social-Sharing-Bild (1200×630) hochladen.
- [ ] **Shopify Payments** einrichten (Ausweis, IBAN, 2FA vorher) – https://admin.shopify.com/store/gexdm4-2q/settings/payments
- [ ] **PayPal mit Shopify verbinden** – gleiche Seite → PayPal → „Aktivieren" → mit dem PayPal-Geschäftskonto anmelden. Die PayPal-Verbindung zu Claude ersetzt das nicht.
- [ ] **Testbestellung** mit Code `LAUNCH-TEST-100` (ergibt jetzt 0,00 € inkl. Versand). Vorher bei Printify Order approval auf „Manually". **Danach Claude Bescheid geben → Code wird gelöscht.**
- [ ] **OFE v3 veröffentlichen** – https://admin.shopify.com/store/gexdm4-2q/themes → genau **„LimitlessPoster OFE v3"** → ⋯ → Veröffentlichen. Nicht „ARCHIV – OFE v3 WIP (nicht veröffentlichen)". Danach im privaten Fenster testen: Cookie-Banner erscheint, Footer-Link „Datenschutz-Einstellungen" öffnet die Cookie-Einstellungen.
- [ ] **Passwort entfernen** – ganz am Schluss (Onlineshop → Präferenzen).
- [ ] **Apps prüfen:** Ist „Sternify" noch installiert? Entscheide dich für Sternify oder Judge.me, nicht beides.
- [ ] **Absender-E-Mail** (Zoho, info@limitlessposter.com) – Datenmappe/Checkliste.

## 2. Entscheidungen (sag mir einfach, was du willst, ich setze es per API um)
- [ ] **Marken-/Bildrechte (19 Produkte):** Batman, Ferrari/F1, Marlboro, Porsche, Nike „Just Do It", Wimbledon, Godfather, Messi, Ronaldo, Neymar, Jordan u. a. Behalten, umbenennen oder entfernen? 5 davon liegen in „Favoriten". Dazu AGB § 11 (beansprucht Urheberrecht an allen Motiven).
- [ ] **Dünne Collections:** GRIT (2), Artists (3), ICONS (4). Vorschlag: Artists mit ICONS zusammenlegen; GRIT mit vorhandenen Gym-Motiven füllen als „GRIT: Gym, Boxing & MMA".
- [ ] **Dressurpferd:** bei 3 Größen bleiben (SEO-Text passt jetzt) oder in Printify 11×14, 16×20, 18×24 ergänzen?
- [ ] **Preis 46×61 cm:** 79,99 € (14 neue Motive) oder 81,99 € (übrige 99)? Am besten in Printify angleichen.
- [ ] **Variantenauswahl:** „Size/Color" mit Zoll auf „Größe/Rahmen" mit cm umstellen? Geht am sichersten in Printify.
- [ ] **Englische Produkt-URLs** jetzt (vor dem Launch, noch nicht indexiert) auf kurze deutsche umstellen? Mache ich samt Weiterleitungen.
- [ ] **Shop-App-Kanal:** alle 113 Produkte auch in der Shop-App veröffentlichen?
- [ ] **Kraftausdrücke** („Fuck Them All", „Just Do Some Creative Shits"): für Google/Meta-Feeds neutrale Titel oder rausnehmen?
- [ ] **WELCOME10** anlegen (10 %, mit Versandrabatt kombinierbar)?

## 3. Zugänge / Daten für mich
- [ ] **Nach jedem Printify-Publish Bescheid geben** – neue Motive kommen englisch, ohne GPSR und ohne Collection an.
- [ ] **Printify-API-Token** (Printify → Konto-Menü → *Connections* → *API tokens*). Damit prüfe ich Bestellungen, Freigabe-Einstellung und Versandprofil-Sync direkt.
- [ ] **Shop-Postfach** limitless.posterje@gmail.com verbinden oder an das verbundene Gmail weiterleiten (dort kam in 45 Tagen keine Printify-Mail an).
- [ ] **Obsidian-Vault-Ort** (Ordnerpfad, GitHub-Repo oder Google-Drive-Ordner). Bis dahin liegen die Notizen im Repo unter `obsidian/LimitlessPoster/`.

## 4. Behörden / extern
- [ ] **Finanzamt anrufen** – § 19 bestätigen, Reverse-Charge bei Printify-Rechnungen klären – 0711 397-2929 / -2007.
- [x] ~~**LUCID** registrieren + duales System~~ – entfällt: Printify-LUCID DE4139628009499 deckt alles ab (28.09.).
- [ ] **PayPal** auf Geschäftskonto umstellen.

## 5. Printify (manuell, bis ich einen Token habe)
- [ ] Wallet → Zahlungsmittel hinterlegen · [Link](https://printify.com/app/account/payment/details)
- [ ] Store settings → Order settings → **Manual approval** · [Link](https://printify.com/app/store/settings/order-settings)
- [ ] **Versandprofil-Sync abschalten, falls möglich** – Printify hat die Shopify-Versandprofile überschrieben (DE ≈ 23 € pro Poster). Der Gratisversand-Rabatt fängt das ab, aber ohne Sync bleibt es sauberer.
- [ ] Wallet → **Taxes** → USt-IdNr. DE463961672 hinterlegen (nach dem Finanzamt-Telefonat).
- [ ] Store settings → **GPSR**: Verantwortlicher = Julius Erb, Eugen-Bolz-Str. 28, 73732 Esslingen, limitless.posterje@gmail.com.
- [ ] Ship-from/Store-Adresse auf Esslingen prüfen.
