---
tags: [limitlessposter, anleitung, e-mail, benachrichtigungen]
stand: 2026-10-02
---
# Benachrichtigungs-Mails: Deutsch, einheitlich, im LimitlessPoster-Look

**Dauer:** ca. 30 Minuten. **Kosten:** 0 €.
**Mach vorher:** `Anleitung E-Mail-Absender info@limitlessposter.com.md` (sonst kommen die Test-Mails noch von shopifyemail.com).

## Ausgangslage (geprüft am 02.10.2026)
- Einzige Shop-Sprache: **Deutsch** (`de`, primär, veröffentlicht). Shopify verschickt die Standard-Vorlagen deshalb auf Deutsch.
- Wichtig: Eine Vorlage, deren Betreff **und** Text du bearbeitet hast, ändert ihre Sprache danach nicht mehr automatisch. Das ist bei einem rein deutschen Shop kein Problem.
- Ansprache: Shop-Texte, FAQ und Checkout **duzen** („dein Warenkorb“). Die Rechtstexte (AGB, Widerruf, Datenschutz) siezen, das ist bei Rechtstexten üblich und in Ordnung. Die Mails sollen **duzen**.
- Steuern: Preise ohne Steuer-Aufschlag, Kleinunternehmer § 19 UStG. In keiner Mail darf „inkl. MwSt.“ oder ein Steuerbetrag stehen.
- Geldformat im Shop: `€81,99` (Shopify-Standard). Üblich in Deutschland ist `81,99 €` (siehe Punkt 5).

## 1. Logo und Akzentfarbe (5 Min)
1. Öffne https://admin.shopify.com/store/gexdm4-2q/settings/notifications/customer
2. Klicke auf **E-Mail-Vorlagen anpassen**.
3. **Logo:** **Datei auswählen** > `vorlagen/Logo E-Mail und Rechnung (zugeschnitten, 960px).png` hochladen. Das ist dein Theme-Logo aus OFE v3 (Einstellung „Logo“), aber ohne den großen durchsichtigen Rand. Mit dem Original-Logo wäre der Schriftzug in der Mail winzig.
4. **Logobreite:** `240` px (ergibt ca. 46 px Höhe, auf dem Handy gut lesbar).
5. **Akzentfarbe:** `#8B1E2D` (dein Markenrot aus OFE v3, Farbschema 4 und Sale-Badge). Weißer Text auf diesem Rot ist gut lesbar (Kontrast ca. 9 : 1). Alternative, falls dir Rot zu laut ist: `#141215` (der dunkle Seitenhintergrund aus OFE v3).
6. **Speichern**.

Das Logo erscheint danach automatisch auch auf der Rechnung aus Order Printer (die Vorlage nimmt das E-Mail-Logo).

## 2. Bestellbestätigung ergänzen (10 Min)
1. In den Kundenbenachrichtigungen **Bestellbestätigung** öffnen > **Code bearbeiten**.
2. Im Feld **E-Mail-Text (HTML)** mit Strg+F nach `row footer` suchen.
3. Den kompletten Inhalt von `vorlagen/Bestellbestätigung Zusatzbaustein (§ 19, Lieferzeit, Widerruf, AGB).liquid` direkt **vor** der Zeile `<table class="row footer">` einfügen.
   Findest du `row footer` nicht: vor dem Abschnitt mit „Kundeninformationen“ einfügen (vor dessen `<table class="row section">`).
4. **Vorschau** ansehen > **Speichern** > **Test-E-Mail senden**.

Der Baustein bringt mit:
- **Gut zu wissen:** Lieferzeit 4–10 Werktage, § 19-Hinweis, Kontakt mit Bestellnummer
- **Widerrufsbelehrung + Muster-Widerrufsformular** (Pflicht: muss spätestens bei Lieferung als E-Mail oder Papier beim Kunden sein, § 312f Abs. 2 BGB; ein Link allein reicht nicht)
- **AGB** im Wortlaut, Stand 2. Oktober 2026 (§ 11 neu)
- Links zu Widerrufsrecht, AGB und Datenschutz

Wenn sich AGB oder Widerrufsbelehrung ändern, muss der Baustein mitgeändert werden. Die E-Mail-Adresse steht nur einmal oben im Baustein (`lp_mail`).

## 3. Diese Vorlagen prüfen (Test-E-Mail an dich senden und lesen)

Prüfpunkte für **jede** Vorlage:
- [ ] Betreff und Text deutsch, kein englischer Rest
- [ ] Ansprache **du** (nicht gemischt mit „Sie“)
- [ ] kein „inkl. MwSt.“, „zzgl. Steuer“, keine Steuerzeile mit Betrag
- [ ] kein Hinweis auf Lieferung in die EU oder ins Ausland
- [ ] Logo sichtbar, Buttons im Markenrot
- [ ] Absender info@limitlessposter.com (nach der Umstellung)

| Vorlage (Shopify-Name) | Wird bei LimitlessPoster gebraucht? | Zusätzlich prüfen |
|---|---|---|
| **Bestellbestätigung** | ja, jede Bestellung | Baustein aus Punkt 2 drin; Versand als 0 € oder „Kostenlos“ (nicht 23,19 €); Versandart heißt noch englisch „Standard Delivery“ (Name kommt von Printify, siehe offene Punkte); Größen in cm |
| **Versandbestätigung** | ja, sobald Printify versendet | Sendungsnummer + Link sichtbar; Text passt zu „gedruckt und gerahmt“ |
| **Versandaktualisierung** | ja | kurz, deutsch |
| **In Zustellung / Zugestellt** | optional | nur aktivieren, wenn die Texte deutsch sind |
| **Bestellung storniert** | ja | Hinweis, dass das Geld über dieselbe Zahlart zurückkommt |
| **Rückerstattung der Bestellung** | ja | Betrag korrekt, kein Steuerhinweis |
| **Bestellung bearbeitet** | selten | deutsch, du |
| **Entwurfsbestellung-Rechnung** | ja, für Sonderbestellungen und Tests | § 19-Satz ergänzen (Zeile aus Teil A des Bausteins reicht); Button „Jetzt bezahlen“ ist hier zulässig, weil der Vertrag erst beim Bezahlen im Checkout entsteht |
| **Kundenkonto: Anmeldecode / Einladung / Willkommen / Passwort zurücksetzen** | ja (Kundenkonten sind optional aktiv) | deutsch, du |
| **Bestätigung des Kunden-Marketings** (Double-Opt-in) | **ja, einschalten** | siehe Punkt 4 |
| **Abgebrochener Checkout** | nur mit Einwilligung | nur an Kunden senden, die Marketing zugestimmt haben (in Deutschland sonst Werbung ohne Einwilligung) |
| Geschenkkarte, Abholung, lokale Zustellung, POS, Rücksendungen | nein | nichts tun |

## 4. Double-Opt-in für Marketing einschalten (2 Min)
https://admin.shopify.com/store/gexdm4-2q/settings/notifications/customer > Bereich **Marketing-Double-Opt-in** > **Bestätigung des Kunden-Marketings** aktivieren und, falls angeboten, **Kunden müssen ihr Abonnement bestätigen** anhaken. Das brauchst du auch für Bewertungsanfragen (siehe Judge.me-Anleitung).

## 5. Optional: Geldformat auf „81,99 €“ (3 Min)
https://admin.shopify.com/store/gexdm4-2q/settings/general > **Shop-Standards** > **Währungsformatierung ändern**:

| Feld | heute | neu |
|---|---|---|
| HTML ohne Währung | `€{{amount_with_comma_separator}}` | `{{amount_with_comma_separator}} €` |
| HTML mit Währung | `€{{amount_with_comma_separator}} EUR` | `{{amount_with_comma_separator}} EUR` |
| E-Mail ohne Währung | `€{{amount_with_comma_separator}}` | `{{amount_with_comma_separator}} €` |
| E-Mail mit Währung | `€{{amount_with_comma_separator}} EUR` | `{{amount_with_comma_separator}} EUR` |

Das ändert die Preisanzeige im ganzen Shop und in allen Mails. Danach einmal Startseite, Produktseite und Warenkorb ansehen.

## 6. Mitarbeiter-Benachrichtigung (1 Min)
https://admin.shopify.com/store/gexdm4-2q/settings/notifications/staff > **Empfänger hinzufügen** > limitless.posterje@gmail.com, damit du jede neue Bestellung sofort siehst (falls noch nicht eingetragen).

## Quellen
- Shopify Hilfe, E-Mail-Vorlagen anpassen (Logo, Akzentfarbe, Code bearbeiten, Test-E-Mail, Sprache bearbeiteter Vorlagen): https://help.shopify.com/en/manual/fulfillment/setup/notifications/customizing-notification-template
- Shopify Hilfe, Variablen in Benachrichtigungen: https://help.shopify.com/en/manual/fulfillment/setup/notifications/email-variables
- Theme-Werte aus `config/settings_data.json` von „LimitlessPoster OFE v3“ (gelesen am 02.10.2026)
