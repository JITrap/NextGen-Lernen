# Bericht Bereich „Recht“ – 02.10.2026

## Kurzfassung

| Was | Status |
|---|---|
| AGB-Seite `/pages/agb`, § 11 | **Geändert** (nur noch eigene Rechte, Rechte Dritter bleiben bei den Inhabern, keine behauptete Verbindung, Kauf = nur das Poster). Stand-Datum auf 2. Oktober 2026. Andere Paragrafen unverändert. |
| Datenschutz-Seite `/pages/datenschutzerklaerung` | **Geändert**: Ziffer 7 „Zahlungsabwicklung“ neu (Shopify Payments, Apple Pay, Google Pay, Shop Pay, PayPal, Betrugsprävention, Speicherdauer), Hinweis Shop-App (in Ziffer 3), Printify präzisiert (Ziffer 6), Drittland/BCR (Ziffer 3 und 12), Aufbewahrungsfristen (Ziffer 13). Stand 2. Oktober 2026. |
| Checkout-Richtlinien (Einstellungen > Richtlinien) | **Nicht änderbar per API** → Julius muss AGB und Datenschutz einfügen (Anleitung unten). |
| Klarna, Judge.me | **Nicht** in der Erklärung, fertige Bausteine in `obsidian/LimitlessPoster/vorlagen/Datenschutz-Bausteine (optional).md`. |

Shopify-Rückmeldung: beide `pageUpdate` ohne Fehler, `updatedAt` 2026-10-02T13:48:43Z. AGB nach der Gegenprüfung erneut geschrieben (`updatedAt` 2026-10-02T14:45:23Z), siehe Abschnitt 7.

## Dateien

- Backups (Vorher): `shop-checkliste/backup-2026-10-02/recht/page-agb-vorher.html`, `page-datenschutzerklaerung-vorher.html`, `agb-par11-vorher.html`, `datenschutz-zahlung-vorher.html`, `vorlage-checkout-agb-vorher.html`
- Nachher: `shop-checkliste/arbeit-2026-10-02/recht/page-agb-nachher.html`, `page-datenschutzerklaerung-nachher.html`, `agb-par11-nachher.html`, `datenschutz-zahlung-nachher.html`
- Vorlagen zum Einfügen: `obsidian/LimitlessPoster/vorlagen/Checkout-Richtlinie AGB (neu, DE-only).html` (aktualisiert), `obsidian/LimitlessPoster/vorlagen/Checkout-Richtlinie Datenschutz (neu).html` (neu)
- Rückbau: Inhalt der jeweiligen `*-vorher.html` per `pageUpdate` (body) zurückschreiben.

## 1. AGB § 11 – Vorher / Nachher

**Vorher („§ 11 Urheberrecht“):**
> Alle Motive, Designs und Inhalte unseres Shops sind urheberrechtlich geschützt. Eine Vervielfältigung oder gewerbliche Nutzung ist ohne unsere Zustimmung nicht gestattet. Der Kauf eines Posters überträgt keine Nutzungs- oder Verwertungsrechte an den Motiven.

Problem: Damit beansprucht LimitlessPoster Rechte an allen Motiven, auch an denen, die Sportler, Marken oder Filme zeigen. Das ist falsch und angreifbar.

**Nachher („§ 11 Urheberrecht und Rechte Dritter“), Stand nach der Gegenprüfung:**
> (1) Soweit an den von uns selbst erstellten Inhalten dieses Shops – insbesondere Texten, Produktfotos, eigenen Gestaltungen und Grafiken sowie der Gestaltung des Shops – Urheber- oder Leistungsschutzrechte bestehen, stehen diese uns zu. Eine Vervielfältigung, Verbreitung oder sonstige Nutzung dieser Inhalte ist ohne unsere vorherige Zustimmung nicht gestattet, soweit das Gesetz nichts anderes erlaubt.
>
> (2) Soweit Motive Personen, Namen, Marken, Logos, Filme, Werke oder sonstige geschützte Inhalte Dritter zeigen oder darauf Bezug nehmen, liegen alle Rechte daran ausschließlich bei den jeweiligen Rechteinhabern. Wir beanspruchen an diesen Inhalten keine eigenen Rechte. Die Nennung oder Abbildung von Personen, Marken oder Produkten bedeutet nicht, dass diese mit uns verbunden sind oder uns bzw. unsere Produkte unterstützen oder sponsern.
>
> (3) Mit dem Kauf erwerben Sie das Eigentum an dem gelieferten Poster. Nutzungs-, Vervielfältigungs- oder Verwertungsrechte an den abgebildeten Motiven werden dabei nicht eingeräumt. Ihre gesetzlichen Rechte, etwa zur Weiterveräußerung des gekauften Posters, bleiben unberührt.
>
> (4) Sollten Sie der Ansicht sein, dass ein Motiv Ihre Rechte verletzt, schreiben Sie uns bitte an limitless.posterje@gmail.com. Wir prüfen jeden Hinweis umgehend und nehmen betroffene Motive bei berechtigter Beanstandung aus dem Sortiment.

Entscheidungen:
- Überschrift erweitert, Nummer § 11 und HTML-Stil (`<h2>`, `<p>(1) …</p>`) wie bei §§ 3, 4, 10 beibehalten.
- Abs. 3 nennt die gesetzlichen Rechte (Weiterverkauf des eigenen Posters), weil ein Weiterverkaufsverbot in AGB gegenüber Verbrauchern unwirksam wäre.
- Abs. 4 (Hinweis-Adresse für Rechteinhaber) ist neu: Er zeigt Kooperationsbereitschaft und kann Abmahnkosten vermeiden.
- Wichtig: § 11 schützt nicht vor Ansprüchen von Rechteinhabern. Motive mit echten Personen, Logos oder Filmbildern bleiben ein rechtliches Risiko, unabhängig vom AGB-Text.

## 2. Vergleich mit den Checkout-Richtlinien (nur lesbar)

| Richtlinie | Stand im Checkout | Abweichung von der Shop-Seite |
|---|---|---|
| AGB (Terms of Service) | 25. Aug. 2026 | § 4 (2) „Deutschland **und der EU**“, § 5 (1) „nach Deutschland und in die Länder der EU“ (falsch, Verkauf nur DE), alter § 11 |
| Datenschutzerklärung | 15. Aug. 2026 | Alter Stand: ohne Shopify Payments, ohne Shop-App, Klarna erwähnt |
| Versand | 25. Aug. 2026 | Nennt noch EU-Versand. Vorlage `Checkout-Richtlinie Versand (neu, DE-only).html` liegt schon bereit (unverändert) |

## 3. Datenschutzerklärung – was geändert wurde

**Ziffer 7 vorher („Zahlungsdienstleister“):**
> Zur Zahlungsabwicklung setzen wir externe Zahlungsdienstleister ein … (Art. 6 Abs. 1 lit. b DSGVO): PayPal: PayPal (Europe) S.à r.l. et Cie, S.C.A., 22–24 Boulevard Royal, L-2449 Luxemburg. … Sofern wir weitere Zahlungsarten anbieten (z. B. Kreditkarte, Apple Pay, Google Pay oder Klarna über Shopify Payments), werden Ihre Zahlungsdaten direkt vom jeweiligen Anbieter verarbeitet; die entsprechenden Anbieter … werden im Checkout angezeigt.

Mängel: Shopify Payments und Zahlungsabwickler nicht benannt, keine Rechtsgrundlage lit. c/f, keine Betrugs- oder Bonitätsprüfung, keine Speicherdauer, keine Angaben zum Drittland, Klarna erwähnt (nicht geplant).

**Ziffer 7 nachher („Zahlungsabwicklung“):** vollständiger Text in `datenschutz-zahlung-nachher.html`. Inhalt:
- Einleitung: welche Daten, Art. 6 Abs. 1 lit. b und lit. c DSGVO (starke Kundenauthentifizierung, Geldwäscheprävention, Aufbewahrung), keine vollständigen Kartendaten bei uns.
- a) Shopify Payments: Shopify International Limited als Auftragsverarbeiter. Zahlungsabwickler für Deutschland laut Shopify-Liste: Stripe Payments Europe, Limited (Dublin), Adyen N.V. (Amsterdam), PayPal (Europe) (Luxemburg), teils eigenständig verantwortlich. Stripe → USA nach EU-U.S. Data Privacy Framework bzw. Standardvertragsklauseln. Apple Pay (Apple Distribution International Ltd., Cork) und Google Pay (Google Ireland Limited, Dublin) als eigenständig Verantwortliche. Shop Pay: Konto in Verantwortung von Shopify, freiwillig.
- b) PayPal: eigenständig verantwortlich, mögliche Bonitätsprüfung über Auskunfteien (z. B. bei Lastschrift), Art. 6 Abs. 1 lit. f DSGVO (Interesse von PayPal), Link zur PayPal-Erklärung.
- c) Betrugsprävention: keine eigene Bonitätsprüfung, kein Rechnungskauf. Shopify-Risikoeinschätzung je Bestellung, manuelle Prüfung, keine automatisierte Einzelentscheidung nach Art. 22 DSGVO, Art. 6 Abs. 1 lit. f.
- d) Speicherdauer mit Verweis auf Ziffer 13.

**Weitere Änderungen:**
- Ziffer 3: Drittlandtransfer Shopify jetzt laut aktueller Shopify-Erklärung (Angemessenheitsbeschluss Kanada + genehmigte Binding Corporate Rules, Art. 47 DSGVO, bzw. Standardvertragsklauseln). Neuer Unterabschnitt „Bestellungen über die App ‚Shop‘“: Shopify ist für das Shop-Konto verantwortlich, wir erhalten die Bestelldaten, Shopify kann uns App-Interaktionen (z. B. Folgen) mitteilen. **Nötig**, weil seit heute alle 113 Produkte im Kanal Shop sind und dort ein zusätzlicher Datenfluss entsteht.
- Ziffer 6: „Printify, Inc.“ (richtige Schreibweise) inkl. verbundener Unternehmen, EU-Ansprechpartner Printify Development SIA (Riga). Printify ausdrücklich als Auftragsverarbeiter (Art. 28), Druckpartner als Unterauftragsverarbeiter, Paketdienst erwähnt. Drittland nur noch über **Standardvertragsklauseln**, weil Printify sich in seinen Datenverarbeitungsbedingungen darauf stützt; eine Zertifizierung nach dem Data Privacy Framework ist dort nicht genannt.
- Ziffer 12: BCR als Garantie ergänzt.
- Ziffer 13: Aufbewahrungsfristen nach BEG IV (seit 01.01.2025: Buchungsbelege/Rechnungen 8 Jahre, Handelsbriefe 6 Jahre, Bücher/Jahresabschlüsse 10 Jahre).
- Nummerierung 1–17 bleibt gleich (Shop-App als Unterabschnitt in Ziffer 3), damit keine Verweise brechen.

## 4. Klickanleitungen für Julius

### A) Checkout-AGB ersetzen (etwa 2 Minuten)
1. Öffnen: https://admin.shopify.com/store/gexdm4-2q/settings/legal
2. Bei „Allgemeine Geschäftsbedingungen“ auf das Textfeld klicken, dann im Editor auf das Symbol `<>` (HTML anzeigen).
3. Alles markieren (Strg+A) und löschen.
4. Den kompletten Inhalt der Datei `obsidian/LimitlessPoster/vorlagen/Checkout-Richtlinie AGB (neu, DE-only).html` einfügen.
5. Unten rechts **Speichern**.
6. Prüfen: https://admin.shopify.com/store/gexdm4-2q/settings/legal → Vorschau „Stand: 2. Oktober 2026“, § 5 (1) „ausschließlich innerhalb Deutschlands“, § 11 „Urheberrecht und Rechte Dritter“.

### B) Checkout-Datenschutzerklärung ersetzen
1. Gleiche Seite: https://admin.shopify.com/store/gexdm4-2q/settings/legal
2. Falls bei der Datenschutzerklärung eine Option zur **automatischen Verwaltung durch Shopify** angezeigt wird: ausgeschaltet lassen bzw. auf manuell stellen (sonst wird unser Text ersetzt).
3. Bei „Datenschutzerklärung“ auf `<>` klicken, alles markieren und löschen.
4. Inhalt von `obsidian/LimitlessPoster/vorlagen/Checkout-Richtlinie Datenschutz (neu).html` einfügen → **Speichern**.
5. Gleich danach auch die Versand-Richtlinie mit `Checkout-Richtlinie Versand (neu, DE-only).html` ersetzen (gleicher Ablauf, Feld „Versandrichtlinie“).

## 5. Nach der Aktivierung der Zahlarten nochmal prüfen

1. **Welche Zahlarten sind wirklich aktiv?** https://admin.shopify.com/store/gexdm4-2q/settings/payments
   - Shopify Payments freigeschaltet? Wenn nein (oder anderer Anbieter): Ziffer 7 a) anpassen.
   - Apple Pay, Google Pay und Shop Pay eingeschaltet? Nicht genutzte Wallets dürfen im Text bleiben („Bezahlen Sie mit …“), sauberer ist Streichen.
   - **Klarna** oder andere lokale Zahlarten (z. B. EPS, iDEAL, Bancontact) **nicht** einschalten oder vorher Baustein A aus `Datenschutz-Bausteine (optional).md` einfügen.
   - PayPal: Bei „PayPal-Wallet“ passt Ziffer 7 b). Wenn PayPal „Später bezahlen“ oder „Rechnung“ anbietet, ist das durch „je nach Zahlungsweise“ abgedeckt.
2. **AGB § 4 (3)** nennt noch „derzeit u. a. PayPal“. Nach Aktivierung empfohlen (Recht-Bereich, nächste Runde):
   „(3) Die Zahlung erfolgt über die im Checkout angebotenen Zahlungsarten (derzeit Kredit- und Debitkarte, Apple Pay, Google Pay, Shop Pay und PayPal). Ihr Konto bzw. Zahlungsmittel wird mit Abschluss der Bestellung belastet.“
   Gilt dann für Seite **und** Checkout-AGB.
3. **Testbestellung:** In der Bestellung im Admin den Bereich „Betrugsanalyse“ ansehen. Er sollte wie in 7 c) beschrieben erscheinen.
4. **Bewertungs-App:** Erst nach der Installation Baustein B (Judge.me) einfügen und Bewertungsanfragen nur mit Einwilligung senden.
5. Optional: Die Texte sind sorgfältig recherchiert, aber keine anwaltliche Prüfung. Für die Motive mit Personen oder Marken lohnt sich eine Prüfung durch einen Anwalt oder Händlerbund bzw. IT-Recht Kanzlei, zum Beispiel per AGB-Service mit Abmahnschutz.

## 6. Quellen (abgerufen am 02.10.2026)

- Shopify Payments Terms of Service, Deutschland: https://www.shopify.com/legal/terms-payments/de (Shopify International Limited als Vertragspartner; Shopify als Auftragsverarbeiter der Zahlungsdaten; Zahlungsabwickler teils eigenständig verantwortlich)
- Shopify Payment-Processor-Liste: https://www.shopify.com/legal/processor-list (Deutschland: Stripe Payments Europe, Limited; PayPal (Europe) S.à r.l. et Cie, S.C.A.; Adyen N.V., Simon Carmiggeltstraat 6-50, 1011 DJ Amsterdam)
- Shopify Privacy Policy (aktualisiert 07.07.2026): https://www.shopify.com/legal/privacy (EWR: Shopify International Ltd., Victoria Buildings, 1–2 Haddington Road, Dublin 4, D04 XN32; BCR; Angemessenheitsbeschluss Kanada)
- Shopify Consumer Privacy Policy (aktualisiert 02.03.2026): https://www.shopify.com/legal/privacy/consumers (Shop-App: Händler erhalten Daten über Interaktionen; Betrugsprävention)
- Stripe-Datenschutzerklärung (Stand 16.01.2026): https://stripe.com/de/privacy (EU-U.S. Data Privacy Framework, Standardvertragsklauseln). Anschrift Stripe Payments Europe, Limited: 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210 (Stripe-Impressum, LEI-Register 549300DSKP4KJP52XY61)
- PayPal-Datenschutzerklärung DE: https://www.paypal.com/de/legalhub/paypal/privacy-full (Verantwortlicher EU: PayPal (Europe) S.à r.l. et Cie, S.C.A., 22–24 Boulevard Royal, L-2449 Luxemburg; interne/externe Bonitätsprüfungen; Standardvertragsklauseln). Anhang zu Auskunfteien (z. B. bei Lastschrift): https://www.paypal.com/de/legalhub/paypal/privacypps-full
- Printify Legal Imprint: https://printify.com/legal-imprint/ (Printify, Inc., 108 West 13th Street, Wilmington 19801, Delaware; EU-Ansprechpartner Printify Development SIA, Riga). Printify Data Processing Terms (Version 1.1, 11.03.2026): https://printify.com/data-processing-terms/ (Printify = Auftragsverarbeiter, SCC Modul 2, Unterauftragsverarbeiter). Hinweis: Die Printify-AGB nennen zusätzlich die Anschrift 1000 N. West Street, Suite 1200, Wilmington. In der Erklärung steht die Impressums-Anschrift.
- Google Payments Nutzungsbedingungen DE: https://wallet.google.com/legaldocument?family=0.buyertos&gl=DE (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4)
- Apple Distribution International Ltd., Hollyhill Industrial Estate, Hollyhill, Cork: https://www.apple.com/legal/privacy/de-ww/affiliated-company/
- Aufbewahrungsfristen BEG IV: https://www.haufe.de/finance/buchfuehrung-kontierung/buerokratieentlastungsgesetz-aufbewahrungspflichten-verkuerzt_186_634670.html
- Bausteine: Klarna-Datenschutzerklärung DE (Klarna Bank AB (publ), Sveavägen 46, 111 34 Stockholm): https://cdn.klarna.com/1.0/shared/content/legal/terms/0/de/privacy · Judge.me Ltd, Companies House 12157706: https://find-and-update.company-information.service.gov.uk/company/12157706 · Judge.me GDPR: https://judge.me/help/en/articles/8364277-gdpr-compliance

## 7. Gegenprüfung (02.10.2026, nachmittags)

Geprüft wurde gegen den **Live-Stand in Shopify** (Seiten `agb`, `datenschutzerklaerung`, Checkout-Richtlinien, Märkte, Versandprofile, übrige Seiten) und gegen die Dateien im Repo, nicht nur gegen diesen Bericht.

### Was geprüft wurde und Ergebnis

| Prüfpunkt | Ergebnis |
|---|---|
| Live-Seiten = Nachher-Dateien im Repo | AGB und Datenschutz waren byte-gleich mit `page-*-nachher.html`. |
| Übrige Paragrafen/Ziffern unverändert | AGB: nur Stand-Datum und § 11 geändert. Datenschutz: nur Stand, Ziffer 3, 6, 7, 12, 13 geändert. Alles andere byte-gleich zum Backup. |
| HTML sauber | Keine offenen oder falsch verschachtelten Tags. AGB: 13 × `<h2>` wie vorher. Datenschutz: 17 × `<h2>` wie vorher, neu 5 × `<h3>` als Unterpunkte (Hierarchie korrekt). |
| Checkout-Vorlagen = Seitentext | AGB-Vorlage und Datenschutz-Vorlage stimmen (bis auf Zeilenumbrüche) exakt mit den Live-Seiten überein, auch nach der Korrektur unten. |
| Firmen und Anschriften | Gegen die Originalquellen geprüft: Shopify International Limited (Vertragspartner Shopify Payments DE, Auftragsverarbeiter für Zahlungsdaten, Zahlungsabwickler teils eigenständig verantwortlich), Abwickler für DE laut Shopify-Liste: Stripe Payments Europe, Limited, PayPal (Europe) S.à r.l. et Cie, S.C.A., Adyen N.V. (Simon Carmiggeltstraat 6-50, 1011 DJ Amsterdam). Shopify-BCR (von EU-Datenschutzbehörden genehmigt) und Datum 07.07.2026 bestätigt. Google Ireland Limited ist für Google Pay im EWR verantwortlich. Printify, Inc., 108 West 13th Street, Wilmington; EU-Vertreter SIA „Printify Development“, Riga. Alles korrekt. |
| Rechtsgrundlagen | Art. 6 Abs. 1 lit. b (Zahlung), lit. c (SCA, Geldwäsche, Aufbewahrung), lit. f (Betrugsprävention, PayPal-Bonitätsprüfung), Art. 28, Art. 46 Abs. 2 lit. c, Art. 47 DSGVO: passend. § 25 TDDDG korrekt benannt. Fristen § 147 AO (8/6/10 Jahre nach BEG IV) korrekt. |
| Impressum, § 19 UStG, Versand nur DE | Kein Widerspruch. Name, Anschrift und E-Mail stimmen mit Impressum überein. § 4 (1) AGB nennt § 19 UStG. Nur der Markt „Deutschland“ ist aktiv (EU und America sind Entwurf), daher passt „Lieferung ausschließlich innerhalb Deutschlands“, obwohl die Printify-Versandprofile viele Länder enthalten. |
| Andere Seiten (FAQ, Über uns, Größen-Guide, Widerruf) | Keine Aussagen zu Lizenzen, „offiziell“ oder EU-Versand, die § 11 oder der Datenschutzerklärung widersprechen. |
| Übersetzungen | Shop hat nur Deutsch, keine veralteten englischen Übersetzungen der Seiten. |

### Gefunden und behoben (AGB § 11, Seite und Checkout-Vorlage)

1. **§ 11 (3) „Eigentum … für Ihre private Nutzung“** – Diese Einschränkung des Eigentums geht über das Urheberrecht hinaus (ein gekauftes Poster darf z. B. auch im Büro hängen). In AGB gegenüber Verbrauchern ist sie unklar (§ 305c Abs. 2 BGB) und als Abweichung vom gesetzlichen Leitbild des Kaufs (§§ 433, 903 BGB) nach § 307 BGB angreifbar. Sie bringt Julius keinen Vorteil, weil Nutzungs- und Vervielfältigungsrechte ohnehin nicht eingeräumt werden. **Behoben:** „Mit dem Kauf erwerben Sie das Eigentum an dem gelieferten Poster.“
2. **§ 11 (1) „… sind urheberrechtlich geschützt“** – pauschale Behauptung eines Schutzes. Für Inhalte ohne Schutz (z. B. mit KI erzeugte Bilder ohne menschliche Schöpfung oder einfache Texte) würde LimitlessPoster damit Rechte beanspruchen, die nicht bestehen. Das passt nicht zum Ziel „nur eigene Rechte“. **Behoben:** „Soweit an den von uns selbst erstellten Inhalten … Urheber- oder Leistungsschutzrechte bestehen, stehen diese uns zu. Eine Vervielfältigung … dieser Inhalte ist ohne unsere vorherige Zustimmung nicht gestattet, soweit das Gesetz nichts anderes erlaubt.“

Geschrieben per `pageUpdate` (keine Fehler, `updatedAt` 2026-10-02T14:45:23Z), danach live abgerufen: byte-gleich mit `page-agb-nachher.html`. Die Checkout-Vorlage `Checkout-Richtlinie AGB (neu, DE-only).html` ist identisch angepasst.
Backups: `backup-2026-10-02/recht/page-agb-vor-gegenpruefung.html`, `vorlage-checkout-agb-vor-gegenpruefung.html`, `datenschutz-bausteine-vor-gegenpruefung.md`, `bericht-vor-gegenpruefung.md`.

§ 11 (2) und (4) bleiben: Sie enthalten keine Zusicherung über Rechte Dritter und keinen Haftungsausschluss, sondern nur die Klarstellung, dass Rechte Dritter bei den Inhabern liegen, sowie eine Kontaktadresse.

### Ergänzt

- `Datenschutz-Bausteine (optional).md`: **Baustein C** für ein Zoho-Mail-Postfach („Weg B“ der E-Mail-Anleitung) und ein Hinweis zu Gmail.

### Offen (nicht behoben, mit Begründung)

- **AGB-Kopie in der Bestellbestätigung** (Admin-Bereich, `Bestellbestätigung Zusatzbaustein (§ 19, Lieferzeit, Widerruf, AGB).liquid` und `arbeit-2026-10-02/admin/vorschau/bestellbestaetigung-baustein.html`) enthält noch den alten Wortlaut von § 11 (1) und (3). Siehe Übergabe unten. Julius sollte den Baustein erst nach dieser Anpassung in die Bestellbestätigung einfügen.
- **Gmail als Postfach:** Kundenmails liegen in einem kostenlosen Gmail-Konto, mit Google gibt es dafür keinen Auftragsverarbeitungsvertrag. Die Datenschutzerklärung nennt keinen E-Mail-Anbieter. Das lässt sich nicht durch Text lösen. Empfehlung: Zoho Mail mit DPA (dann Baustein C einfügen) oder Google Workspace.
- **Zahlarten noch nicht aktiv:** Ziffer 7 a) beschreibt Shopify Payments, Apple Pay, Google Pay und Shop Pay schon jetzt. Nach der Freischaltung wie in Abschnitt 5 prüfen. Wenn PayPal „Rechnung“ oder „Später bezahlen“ aktiv wird, ist der Satz in 7 c) „bieten keinen Kauf auf Rechnung an“ anzupassen.
- **Anschrift Shopify International Limited:** Die Zahlungsbedingungen nennen „The Sidings, 4th Floor, Grand Canal Quay, Dublin D02 E7K8“, die Datenschutzerklärung von Shopify nennt „Victoria Buildings, 1–2 Haddington Road, Dublin 4“. Beides sind Anschriften derselben Gesellschaft. Wir verwenden die aus Shopifys Datenschutzerklärung, das ist in Ordnung.
- **Checkout-Richtlinien** (AGB, Datenschutz, Versand) sind weiter alt (EU-Versand, alter § 11). Nur Julius kann sie ersetzen (Abschnitt 4). Die Vorlagen sind jetzt auf dem neuesten Stand.

### Übergabe an den Admin-Bereich

In `obsidian/LimitlessPoster/vorlagen/Bestellbestätigung Zusatzbaustein (§ 19, Lieferzeit, Widerruf, AGB).liquid` und in `shop-checkliste/arbeit-2026-10-02/admin/vorschau/bestellbestaetigung-baustein.html` ersetzen:

- „(1) Die von uns selbst erstellten Inhalte dieses Shops – insbesondere Texte, Produktfotos, eigene Gestaltungen und Grafiken sowie die Gestaltung des Shops – sind urheberrechtlich geschützt. Ihre Vervielfältigung, Verbreitung oder sonstige Nutzung ist ohne unsere vorherige Zustimmung nicht gestattet, soweit das Gesetz nichts anderes erlaubt.“
  → „(1) Soweit an den von uns selbst erstellten Inhalten dieses Shops – insbesondere Texten, Produktfotos, eigenen Gestaltungen und Grafiken sowie der Gestaltung des Shops – Urheber- oder Leistungsschutzrechte bestehen, stehen diese uns zu. Eine Vervielfältigung, Verbreitung oder sonstige Nutzung dieser Inhalte ist ohne unsere vorherige Zustimmung nicht gestattet, soweit das Gesetz nichts anderes erlaubt.“
- „Poster für Ihre private Nutzung.“ → „Poster.“

### Quellen der Gegenprüfung (abgerufen am 02.10.2026)

- https://www.shopify.com/legal/processor-list · https://www.shopify.com/legal/terms-payments/de · https://www.shopify.com/legal/privacy · https://www.shopify.com/legal/privacy/consumers
- Google Payments Datenschutzhinweis (DE): https://payments.google.com/payments/apis-secure/u/0/get_legal_document?ldo=0&ldt=privacynotice&ldl=de
- https://printify.com/legal-imprint/
- Zoho-Datenschutzkontakt: https://www.datenanfragen.de/company/zoho/ und https://www.zoho.com/privacy.html
