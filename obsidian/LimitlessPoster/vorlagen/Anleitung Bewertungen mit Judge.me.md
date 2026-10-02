---
tags: [limitlessposter, anleitung, bewertungen, apps]
stand: 2026-10-02
---
# Kundenbewertungen mit Judge.me einrichten

**Ergebnis:** Echte, verifizierte Bewertungen mit Sternen auf Produktseiten und Produktkarten, Bewertungsanfragen per Mail nach der Lieferung, Sterne in Google und in der Shop-App.
**Kosten:** 0 € (Plan „Forever Free“, mit kleinem „Powered by Judge.me“). **Dauer:** ca. 30 Minuten.

## Entscheidung: Judge.me statt Sternify

| | Judge.me | Sternify |
|---|---|---|
| Was ist das? | Bewertungs-App: sammelt echte Bewertungen | Baukasten für Abschnitte (Bundles, Upsells, Banner); Bewertungen nur als Anzeige von Texten, die du selbst einträgst |
| Bewertungsanfrage per Mail | ja, unbegrenzt, auch im Free-Plan | nein |
| „Verifizierter Käufer“ | ja | nein |
| Sterne auf Produktkarten (Horizon/OFE v3) | ja, eigener App-Block „Star Ratings“ | nein |
| Google-Sterne (Rich Snippets), Shop-App-Sync | ja | nein |
| Kosten | 0 € | ab 29,50 $ pro Monat nach 7 Tagen Test |

**Empfehlung: Judge.me.** Sternify passt nicht zu dem, was du brauchst, und kostet Geld. Selbst eingetragene „Bewertungen“ ohne Nachweis wären außerdem rechtlich riskant (gefälschte oder nicht belegte Bewertungen sind nach UWG verboten).

**Stand Sternify (geprüft 02.10.2026):** Am Shop hängt nur noch das Metafeld `sternify.onboarding_completed = true`. In keinem Theme (OFE v3 und Live) ist ein Sternify-App-Embed oder -Block eingebaut. Ob die App noch installiert ist, kann ich per API nicht lesen (keine Berechtigung).
→ Bitte unter https://admin.shopify.com/store/gexdm4-2q/settings/apps nachsehen. Steht Sternify dort: **Deinstallieren**, damit nach dem Test keine Kosten entstehen.

## Schritt 1: Installieren (3 Min)
1. https://apps.shopify.com/judgeme > **Installieren**.
2. Plan **Forever Free** wählen.
3. Im Einrichtungsassistenten **nicht** auf „Zum Live-Theme hinzufügen“ klicken, falls er das anbietet. Wir bauen die Widgets in **OFE v3** ein, weil du dieses Theme veröffentlichen wirst (Schritt 3).
4. Den Auftragsverarbeitungsvertrag (DPA) von Judge.me im Dashboard annehmen und als PDF ablegen (Google Drive „Verträge“).

## Schritt 2: Grundeinstellungen in Judge.me (10 Min)

| Wo in Judge.me | Einstellung | Warum |
|---|---|---|
| Settings > Language | **Widget and notification emails language: German** | Widgets und Mails auf Deutsch |
| Settings > Request scheduling | Auslöser **Delivered** (Zugestellt), **Send review request after: 5 days** | Poster ist da und hängt schon |
| Settings > Request scheduling | Fallback: **12 Tage nach Fulfillment**, falls kein Zustellstatus kommt | Printify meldet nicht immer „zugestellt“ |
| Settings > Request scheduling > Advanced | Häkchen **ENTFERNEN** bei „Send review requests to customers who have opted out of Shopify marketing emails“ | Rechtlich nötig, siehe unten |
| Reminder | 1 Erinnerung nach 7 Tagen (falls im Free-Plan angeboten) | mehr Rückläufer, nicht nervig |
| Review request email | Betreff z. B. „Wie gefällt dir dein Poster?“ (Vornamen über den Platzhalter einfügen, den Judge.me im Editor anbietet). Text mit **du**, Abmeldelink drin lassen | passt zum Shop |
| Moderation / Auto-publish | **Alle** Bewertungen (1–5 Sterne) automatisch veröffentlichen, nur rechtswidrige Inhalte entfernen | Nur gute Bewertungen zu zeigen wäre irreführend |
| Verified badge | an („Verifizierter Käufer“) | Vertrauen, UWG-Hinweis |
| Star Rating Badge | **ausblenden, wenn noch keine Bewertung** existiert | sonst leere Sterne bei allen Produkten zum Start |
| Farben | Sterne `#F4F1EA` (helles Creme wie deine Buttons), Text passend zum dunklen Hintergrund `#141215` | passt zum OFE-v3-Look; Alternative Gold `#D4A84B` |
| Rewards / Gutscheine für Bewertungen | **aus** | Bezahlte Bewertungen müssten gekennzeichnet werden |

**Warum nur an Kunden mit Marketing-Zustimmung?** Eine Bewertungsanfrage per Mail gilt in Deutschland als Werbung (BGH, 10.07.2018, VI ZR 225/17). Sie darf nur mit vorheriger Einwilligung verschickt werden. Die Ausnahme für Bestandskunden (§ 7 Abs. 3 UWG) ist für Bewertungsanfragen umstritten und an strenge Bedingungen geknüpft (Hinweis auf das Widerspruchsrecht schon bei der Bestellung und in jeder Mail; im BGH-Fall fehlte genau das). Mit Einwilligung bist du auf der sicheren Seite. Deshalb:
1. Judge.me schickt nur an Kunden, die im Checkout Marketing zugestimmt haben (Einstellung oben).
2. Das Marketing-Häkchen im Checkout darf **nicht vorausgewählt** sein: https://admin.shopify.com/store/gexdm4-2q/settings/checkout > **Marketingoptionen** > E-Mail: „Anmeldeoption beim Checkout anzeigen“ an, „vorausgewählt“ **aus**.
3. Der Text am Häkchen soll die Bewertungsanfrage nennen, z. B.: „Ja, schickt mir Neuigkeiten, Angebote und nach der Lieferung eine Bitte um Bewertung per E-Mail. Abmeldung jederzeit möglich.“ (wird als Übergabe an den Checkout-Bereich gemeldet)
4. Double-Opt-in einschalten (siehe `Anleitung Benachrichtigungs-Mails (Deutsch + Branding).md`, Punkt 4).

Ergebnis: Du bekommst anfangs weniger Bewertungen, bist aber abmahnsicher.

## Schritt 3: Widgets in OFE v3 einbauen (10 Min)
Theme-Editor öffnen: https://admin.shopify.com/store/gexdm4-2q/themes/194580283725/editor

1. **App-Einbettungen** (drittes Symbol links oben) > **Judge.me** (Core) **einschalten** > Speichern.
2. **Produktseite** (oben Vorlage „Standardprodukt“ wählen):
   - Im Abschnitt mit den Produktinfos > **Block hinzufügen** > Reiter **Apps** > **Star Rating** (Judge.me) > direkt unter den Produkttitel ziehen.
   - Darunter **Abschnitt hinzufügen** > **Apps** > **Judge.me Review Widget** > unter die Produktinfos ziehen.
3. **Produktkarten** (Horizon-Weg, OFE v3 basiert auf Horizon):
   - Vorlage **Kollektionen > Standardkollektion** > Abschnitt mit den Produkten > Pfeil **>** > unter **Produktkarte** auf **Block hinzufügen** > Suche „Star Ratings“ > Reiter **Apps** > **Star Ratings** von Judge.me.
   - Dasselbe in der Kollektionsvorlage **queens**, auf der **Startseite** (beide Produktlisten) und in der **Suche**.
4. **Speichern** und eine Produktseite in der Vorschau ansehen.

Das Live-Theme „LimitlessPoster v2.0“ brauchst du nicht anzufassen, wenn OFE v3 bald veröffentlicht wird.

## Schritt 4: Pflichthinweis zu Bewertungen (UWG § 5b Abs. 3)
Wer Bewertungen zeigt, muss sagen, ob und wie er prüft, dass sie von echten Käufern stammen. Text für die Kopfzeile des Review-Widgets (Judge.me > Widgets > Review Widget > Texte) oder für die FAQ:

> **So prüfen wir Bewertungen:** Bewertungen mit dem Hinweis „Verifizierter Käufer“ stammen von Kundinnen und Kunden, die das Poster bei uns gekauft haben. Sie werden über einen persönlichen Link aus unserer Bewertungs-E-Mail abgegeben. Bewertungen ohne diesen Hinweis sind nicht verifiziert. Wir veröffentlichen positive wie negative Bewertungen und entfernen nur rechtswidrige Inhalte. Für Bewertungen gibt es keine Gegenleistung.

## Schritt 5: Datenschutz
Den fertigen Abschnitt „Produktbewertungen (Judge.me)“ aus `vorlagen/Datenschutz-Bausteine (optional).md` (Baustein B) in die Datenschutzerklärung übernehmen: Seite /pages/datenschutzerklaerung **und** Einstellungen > Richtlinien > Datenschutzerklärung. Erst dann Bewertungsanfragen aktivieren.

## Test
- [ ] Produktseite zeigt nach Freigabe einer Testbewertung Sterne unter dem Titel und das Widget darunter, alles deutsch
- [ ] Produktkarten zeigen Sterne nur bei Produkten mit Bewertung
- [ ] Testbestellung mit Marketing-Häkchen: Judge.me plant eine Anfrage („Waiting for delivery“)
- [ ] Testbestellung ohne Häkchen: Status „Email does not accept marketing“ (wird übersprungen)
- [ ] Mobil ansehen: Sterne verschieben die Produktkarte nicht

## Quellen
- Judge.me, Sterne auf Kollektionsseiten in Horizon-Themes: https://judge.me/help/en/articles/12257453-adding-the-star-rating-badge-to-collection-pages-horizon-themes
- Judge.me, Bewertungsanfragen nach Marketing-Zustimmung: https://judge.me/help/en/articles/14288340-sending-review-requests-based-on-shopify-marketing-consent
- Judge.me, Zeitpunkt nach Zustellung: https://help.judge.me/en/articles/8336812-scheduling-review-requests-after-delivery
- Judge.me, Sprache: https://judge.me/help/en/articles/8389808-translating-judge-me-widgets-emails-and-settings
- Judge.me, DSGVO (Judge.me als Auftragsverarbeiter, DPA): https://judge.me/help/en/articles/8364277-gdpr-compliance
- Sternify, App-Seite: https://apps.shopify.com/sternify
- IT-Recht Kanzlei, Bewertungsanfragen per Mail: https://www.it-recht-kanzlei.de/anforderungen-bewertungsanfrage-mail.html
