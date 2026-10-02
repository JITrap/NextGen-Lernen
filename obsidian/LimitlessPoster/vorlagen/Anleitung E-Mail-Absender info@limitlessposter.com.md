---
tags: [limitlessposter, anleitung, e-mail]
stand: 2026-10-02
---
# E-Mail-Absender auf info@limitlessposter.com umstellen

**Ziel:** Kunden bekommen alle Shop-Mails von **info@limitlessposter.com**. Antworten und Anfragen an diese Adresse landen in deinem Postfach **limitless.posterje@gmail.com**.
**Kosten:** 0 €. **Dauer:** ca. 15 Minuten plus bis zu 48 Stunden Wartezeit für die Prüfung.

## Was ich am 02.10.2026 geprüft habe

| Punkt | Ergebnis |
|---|---|
| Domain gekauft bei | Shopify (Registrar Tucows, registriert am 14.06.2026, läuft bis 14.06.2027) |
| Wer verwaltet das DNS? | **Shopify** (Nameserver ns-cloud-c1 bis c4.googledomains.com, das ist Shopifys DNS). DNS-Einträge änderst du also direkt in Shopify. |
| Website-Einträge | `limitlessposter.com` → 23.227.38.65, `www` → shops.myshopify.com (korrekt) |
| MX (Posteingang) | **keiner**. Mails an @limitlessposter.com kommen im Moment nirgends an. |
| SPF | **keiner** |
| DKIM (Shopify) | **keiner**, die Absender-Domain ist noch nicht authentifiziert |
| DMARC | vorhanden: `v=DMARC1; p=none` (genau ein Eintrag, so ist es richtig) |
| Absender-E-Mail im Shop | limitless.posterje@gmail.com |

**Was das heißt:** Shopify verschickt deine Kunden-Mails im Moment von einer Gmail-Adresse. Weil Gmail-Adressen nicht über fremde Server versendet werden dürfen, ersetzt Shopify den Absender automatisch durch eine Adresse wie `store+123@shopifyemail.com`. Das wirkt unprofessionell und landet öfter im Spam.

## Weg A (empfohlen): Shopify-Weiterleitung, 0 €

Weil die Domain bei Shopify gekauft wurde, gibt es die E-Mail-Weiterleitung gratis.
Einschränkung: Du kannst damit nur **empfangen**. Antwortest du aus Gmail, sieht der Kunde limitless.posterje@gmail.com als Absender. Für den Start reicht das völlig.

### Schritt 1: Weiterleitung anlegen (2 Min)
1. Öffne https://admin.shopify.com/store/gexdm4-2q/settings/domains
2. Klicke auf **limitlessposter.com**.
3. Im Bereich **E-Mail-Weiterleitung** auf **Weiterleitungs-E-Mail hinzufügen** klicken.
4. Weiterleitungsadresse: `info` (wird zu info@limitlessposter.com)
5. Empfangsadresse: `limitless.posterje@gmail.com`
6. **Speichern**.

Weitere Adressen gehen genauso und kosten nichts, zum Beispiel `bestellung@` oder `datenschutz@`. Jede Adresse kann an genau ein Postfach weiterleiten.

### Schritt 2: DNS prüfen (3 Min)
1. Auf derselben Seite **Domaineinstellungen** > **DNS-Einstellungen bearbeiten**.
2. Prüfe, ob es jetzt **MX-Einträge** gibt (legt Shopify beim Einrichten der Weiterleitung an).
3. Prüfe, ob es **genau einen** TXT-Eintrag mit `v=spf1` gibt. Fehlt er, lege ihn an:

| Typ | Name | Wert |
|---|---|---|
| TXT | `@` | `v=spf1 include:_spf.hostedemail.com ~all` |

4. Den vorhandenen DMARC-Eintrag (`_dmarc`, `v=DMARC1; p=none`) **nicht löschen und nicht doppelt anlegen**.

### Schritt 3: Weiterleitung testen (2 Min)
Schick von einer **anderen** Adresse (nicht aus dem Gmail-Postfach selbst, z. B. vom Handy mit einer anderen Mail-Adresse) eine Mail an info@limitlessposter.com. Sie muss nach wenigen Minuten in limitless.posterje@gmail.com ankommen. Schau auch im Spam-Ordner nach.

### Schritt 4: Absender-E-Mail umstellen und authentifizieren (3 Min)
1. Öffne https://admin.shopify.com/store/gexdm4-2q/settings/notifications
2. Im Bereich **Absender-E-Mail** `info@limitlessposter.com` eintragen und **Speichern**.
3. Klicke auf **E-Mail-Domain-Authentifizierung**. Weil die Domain von Shopify verwaltet wird, trägt Shopify die nötigen CNAME-Einträge (SPF und DKIM für den Versand) selbst ein. Bietet Shopify den Knopf **Automatisch authentifizieren** an, klick ihn.
4. Warte, bis dort **Authentifiziert** steht (meist Minuten, maximal 48 Stunden).

Die Shop-E-Mail unter **Einstellungen > Allgemein > Kontaktdaten des Shops** (das ist die Adresse, über die Shopify dich erreicht) bleibt limitless.posterje@gmail.com. Das ist richtig so.

### Schritt 5: Endtest (2 Min)
1. In den Benachrichtigungen eine Vorlage öffnen, z. B. **Bestellbestätigung** > **Test-E-Mail senden**.
2. In Gmail die Test-Mail öffnen > drei Punkte > **Original anzeigen**. Dort muss stehen: **SPF: PASS**, **DKIM: PASS**, **DMARC: PASS** und als Absender `info@limitlessposter.com` (nicht shopifyemail.com).

### Schritt 6: Adresse in Texten nachziehen (erst nach erfolgreichem Test)
Erst wenn Schritt 3 und 5 funktionieren, die neue Adresse nach außen nennen:
- Impressum, Kontakt, Widerrufsrecht, AGB, Datenschutz (Einstellungen > Richtlinien und die Seiten /pages/agb, /pages/datenschutzerklaerung)
- Rechnungsvorlage `Order Printer Rechnung (§ 19).liquid` (Zeile `lp_mail`)
- Baustein Bestellbestätigung (Zeile `lp_mail`)
- Printify (Support-E-Mail auf Packzetteln, falls eingetragen)

Die Gmail-Adresse kann in den Texten bis dahin stehen bleiben, sie funktioniert ja weiter.

### Später (optional): DMARC verschärfen
Wenn alle Shop-Mails 4 Wochen lang sauber mit DKIM PASS ankommen, kannst du den DMARC-Eintrag ändern. Das schützt deine Domain davor, dass Betrüger sie als Absender missbrauchen:

| Typ | Name | Wert |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r` |

Vorher prüfen: **Jeder Dienst, der als @limitlessposter.com sendet, muss DKIM PASS haben** (Shopify-Benachrichtigungen, Shopify Messaging/Newsletter, bei Weg B auch Zoho). Judge.me sendet standardmäßig von einer eigenen Adresse (requests+limitlessposter.com@judge.me) und ist davon nicht betroffen. Stellst du dort später einen eigenen Absender @limitlessposter.com ein, erst dessen DKIM- und Return-Path-Einträge in Shopify eintragen und in Judge.me prüfen lassen. Sonst landen diese Mails nach dem Verschärfen im Spam.

Den alten Eintrag dabei **ersetzen**, nicht einen zweiten anlegen. Einen Bericht-Empfänger (`rua=`) lasse ich bewusst weg, sonst bekommst du täglich technische XML-Berichte ins Postfach.

## Weg B (optional): echtes Postfach, um auch ALS info@ zu antworten

Nur nötig, wenn Kunden deine Antworten von info@limitlessposter.com bekommen sollen.
Empfehlung: **Zoho Mail Lite** im EU-Rechenzentrum (zoho.eu), ab ca. 1 € pro Nutzer und Monat bei jährlicher Zahlung (Preis vor Abschluss prüfen). Der kostenlose Zoho-Plan reicht hier nicht: Er hat kein IMAP/SMTP, du könntest also nicht aus Gmail heraus als info@ senden.

Reihenfolge (wichtig, sonst gehen Mails verloren):
1. Bei zoho.eu Mail Lite mit der Domain limitlessposter.com registrieren.
2. Zoho zeigt einen TXT-Eintrag zur Bestätigung (`zoho-verification=...`). In Shopify unter Domains > DNS-Einstellungen als TXT mit Name `@` eintragen, in Zoho **Verifizieren**.
3. In Zoho das Postfach `info@limitlessposter.com` anlegen.
4. In Shopify die **E-Mail-Weiterleitung aus Weg A löschen** (beide Wege gleichzeitig gehen nicht, weil es nur einen Posteingang pro Domain gibt).
5. In Shopify DNS die MX-Einträge auf Zoho setzen (alte MX-Einträge entfernen):

| Typ | Name | Wert | Priorität |
|---|---|---|---|
| MX | `@` | `mx.zoho.eu` | 10 |
| MX | `@` | `mx2.zoho.eu` | 20 |
| MX | `@` | `mx3.zoho.eu` | 50 |

6. Den SPF-Eintrag **ersetzen** durch: TXT `@` = `v=spf1 include:zohomail.eu ~all`
7. In der Zoho-Admin-Konsole DKIM erzeugen (Domains > E-Mail-Konfiguration > DKIM) und den angezeigten TXT-Eintrag (Name z. B. `zmail._domainkey`) in Shopify eintragen. Verbindlich sind immer die Werte aus deiner Zoho-Konsole.
8. In Zoho eine Weiterleitung an limitless.posterje@gmail.com einrichten.
9. In Gmail: Einstellungen > Konten und Import > **Senden als** > Adresse hinzufügen: info@limitlessposter.com, SMTP-Server `smtp.zoho.eu`, Port 465, SSL, Benutzer `info@limitlessposter.com`, Passwort = in Zoho erzeugtes App-Passwort.
10. Datenschutz: Zoho als Auftragsverarbeiter in die Datenschutzerklärung aufnehmen und den Auftragsverarbeitungsvertrag in Zoho annehmen.

Die Shopify-Absender-Authentifizierung aus Schritt 4 bleibt dabei unverändert, sie nutzt eigene CNAME-Einträge.

## Quellen
- Shopify Hilfe: E-Mail-Weiterleitung (nur für von Shopify verwaltete Domains, SPF `include:_spf.hostedemail.com`, Antworten nicht als Domain-Adresse möglich): https://help.shopify.com/en/manual/domains/managing-domains/email-forwarding
- Shopify Hilfe: Absender-E-Mail, Domain-Authentifizierung, DMARC-Pflicht von Gmail/Yahoo seit 01.02.2024, Umschreiben auf shopifyemail.com: https://help.shopify.com/en/manual/intro-to-shopify/initial-setup/setup-your-email
- DNS-Abfrage per DNS-over-HTTPS (dns.google) und RDAP (Verisign) am 02.10.2026
