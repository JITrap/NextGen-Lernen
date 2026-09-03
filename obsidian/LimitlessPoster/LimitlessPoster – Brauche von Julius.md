---
tags: [limitlessposter, offen]
stand: 2026-09-03
---
# LimitlessPoster – Das brauche ich von Julius

> Alles, was Claude per API **nicht** selbst erledigen kann. Sobald du einen Punkt erledigt hast oder mir Daten gibst, mache ich weiter.

## 1. Zugänge / Daten für mich
- [ ] **Printify-API-Token** (Printify → Konto-Menü → *Connections* → *API tokens* → Token erzeugen, Rechte lesen/schreiben) → hier oder im Chat eintragen. Damit kann ich Produkte, Bestellungen und Store-Einstellungen bei Printify prüfen.
- [ ] **Obsidian-Vault-Ort** (Ordnerpfad, GitHub-Repo oder Google-Drive-Ordner). Bis dahin liegen meine Notizen im Repo unter `obsidian/LimitlessPoster/` – einfach in den Vault kopieren.
- [ ] **Shop-Postfach** limitless.posterje@gmail.com ist nicht mit Claude verbunden (nur das private Gmail). Wenn ich Printify-/Shopify-Mails prüfen soll: das Konto verbinden.

## 2. Shopify-Admin (nur du kannst das klicken)
- [ ] **2 Checkout-Richtlinien einfügen (2 Min, wichtig!)** – https://admin.shopify.com/store/gexdm4-2q/settings/legal → „Versandrichtlinie" und „Allgemeine Geschäftsbedingungen" jeweils komplett ersetzen durch die fertigen Texte in `vorlagen/` (Checkout-Richtlinie Versand / AGB, DE-only). Grund: Die Shopify-Verbindung von Claude hat keinen Schreibzugriff auf Richtlinien (`write_legal_policies`). Bis dahin sagt /policies/shipping-policy noch „DE + EU"; die Seiten /pages/agb und FAQ sind schon umgestellt.
- [ ] **OFE v3 veröffentlichen** – https://admin.shopify.com/store/gexdm4-2q/themes → „LimitlessPoster OFE v3" → ⋯ → Veröffentlichen. Erst danach sind die Deutschland-Texte und die korrigierte Versand-Leiste („Kostenloser Versand innerhalb Deutschlands" statt „ab 50 €") live. Die API darf kein Theme publishen.
- [ ] **Homepage-Meta-Description** auf Deutschland umstellen – https://admin.shopify.com/store/gexdm4-2q/online_store/preferences → Beschreibung ersetzen durch:
  `Premium-Poster für Sport, Mindset & Lifestyle — fertig gerahmt in Schwarz oder Weiß, Versand innerhalb Deutschlands inklusive. In 4–10 Werktagen bei dir.`
- [ ] **Shopify Payments** einrichten (Ausweis, IBAN) – https://admin.shopify.com/store/gexdm4-2q/settings/payments (2FA vorher aktivieren) · danach PayPal-Geschäftskonto verbinden.
- [ ] **Absender-E-Mail** (Zoho) – Datenmappe/Checkliste.
- [ ] **Passwort entfernen** – ganz am Schluss.

## 3. Behörden / extern
- [ ] **Finanzamt anrufen** (Termin im Kalender: Fr 04.09., 09:30) – 0711 397-2929 / -2007.
- [ ] **LUCID** registrieren + duales System – Links im Adressbuch.
- [ ] **PayPal** auf Geschäftskonto umstellen.

## 4. Printify (manuell, bis ich einen Token habe)
- [ ] Wallet → Zahlungsmittel hinterlegen · [Link](https://printify.com/app/account/payment/details)
- [ ] Store settings → Order settings → **Manual approval** · [Link](https://printify.com/app/store/settings/order-settings)
- [ ] Wallet → **Taxes** → USt-IdNr. DE463961672 hinterlegen (nach dem Finanzamt-Telefonat).
- [ ] Store settings → **GPSR**: Verantwortlicher = Julius Erb, Eugen-Bolz-Str. 28, 73732 Esslingen, limitless.posterje@gmail.com (Pflicht für EU/DE-Verkauf).
- [ ] Ship-from/Store-Adresse auf Esslingen prüfen.
- [ ] Versand: Für „nur Deutschland" muss bei Printify nichts umgestellt werden – die Länderfreigabe steuert Shopify (Markets: nur Deutschland aktiv).
