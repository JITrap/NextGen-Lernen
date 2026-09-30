# -*- coding: utf-8 -*-
"""Checkliste nach dem Komplett-Check vom 29.09.2026 aktualisieren.
Aufruf: python3 patch_2909.py <facts.json> <basis.html> <ziel.html>
Basis ist die Fassung vom 28.09. (git 841c271). facts.json enthaelt die Texte,
die vom Ergebnis des Fix-Workflows abhaengen."""
import json, re, sys

F = json.load(open(sys.argv[1], encoding='utf-8'))
html = open(sys.argv[2], encoding='utf-8').read()
DST = sys.argv[3]
orig_len = len(html)

# ---------------------------------------------------------------- Helfer
def locate(h, iid):
    tag = f'<input type="checkbox" id="{iid}">'
    assert h.count(tag) == 1, (iid, h.count(tag))
    i = h.index(tag)
    s = h.rfind('<li class="item"', 0, i)
    lab_end = h.index('</label>', i) + len('</label>')
    if re.match(r'\s*<details class="howto">', h[lab_end:]):
        d_end = h.index('</details>', lab_end) + len('</details>')
        e = h.index('</li>', d_end) + 5
    else:
        e = h.index('</li>', lab_end) + 5
    return s, e

def parse(h, iid):
    s, e = locate(h, iid)
    block = h[s:e]
    prio = re.search(r'data-prio="(\d)"', block).group(1)
    done = 'data-done="1"' in block.split('>', 1)[0]
    title = re.search(r'<span class="it-title">(.*?)</span>', block, re.S).group(1)
    detail = re.search(r'<div class="it-detail">(.*?)</div>\s*</label>', block, re.S).group(1)
    m = re.search(r'(<details class="howto">.*</details>)', block, re.S)
    howto = m.group(1) if m else ''
    return dict(s=s, e=e, prio=prio, done=done, title=title, detail=detail, howto=howto)

TAGS = {
    'part': '<span class="state st-part">Teilweise</span>',
    'ofe':  '<span class="state st-ofe">Mit OFE v3</span>',
    'fix':  '<span class="state st-fix">Behoben 29.09.</span>',
    'new':  '<span class="state st-new">Neu 29.09.</span>',
}

def build(iid, prio, done, title, detail, howto, tags=()):
    t = ''.join(TAGS[x] for x in tags)
    head = f'<li class="item" data-prio="{prio}"' + (' data-done="1"' if done else '') + f'><input type="checkbox" id="{iid}"><label for="{iid}">'
    body = (f'\n        <span class="it-title">{title}</span><span class="prio pr{prio}">Prio {prio}</span>{t}'
            f'\n        <div class="it-detail">{detail}</div>\n      </label>')
    if howto:
        body += '\n      ' + howto
    return head + body + '</li>'

def upd(iid, *, done=None, title=None, detail=None, howto=None, tags=(), prio=None, howto_sub=()):
    global html
    p = parse(html, iid)
    h = p['howto'] if howto is None else howto
    for a, b in howto_sub:
        assert h.count(a) == 1, (iid, a[:60], h.count(a))
        h = h.replace(a, b)
    new = build(iid, prio or p['prio'], p['done'] if done is None else done,
                title if title is not None else p['title'],
                detail if detail is not None else p['detail'], h, tags)
    html = html[:p['s']] + new + html[p['e']:]

def insert_after(anchor_id, iid, prio, done, title, detail, howto='', tags=('new',)):
    global html
    assert f'id="{iid}"' not in html, iid
    p = parse(html, anchor_id)
    new = build(iid, prio, done, title, detail, howto, tags)
    html = html[:p['e']] + '\n\n      ' + new + html[p['e']:]

def rep(a, b, n=1):
    global html
    assert html.count(a) == n, (a[:80], html.count(a))
    html = html.replace(a, b)

def howto(summary, steps, hint=None):
    s = f'<details class="howto"><summary>{summary}</summary><ol>\n' + ''.join(f'        <li>{x}</li>\n' for x in steps) + '      </ol>'
    if hint:
        s += f'<div class="hint">{hint}</div>'
    return s + '</details>'

ADM = 'https://admin.shopify.com/store/gexdm4-2q'
def a(url, text):
    return f'<a href="{url}" target="_blank" rel="noopener">{text}</a>'

# ---------------------------------------------------------------- CSS fuer Status-Etiketten
rep('  .item.done .prio{opacity:.45}\n',
    '  .item.done .prio{opacity:.45}\n'
    '  .state{display:inline-block; vertical-align:2px; margin-left:6px; font-family:"Space Grotesk", Inter, sans-serif;\n'
    '    font-size:10.5px; font-weight:700; letter-spacing:.06em; padding:1px 7px; border-radius:4px; border:1px solid currentColor}\n'
    '  .state.st-part{color:var(--p2)}\n'
    '  .state.st-ofe{color:var(--p3)}\n'
    '  .state.st-fix{color:var(--accent)}\n'
    '  .state.st-new{color:var(--accent); background:var(--accent-soft); border-color:transparent}\n'
    '  .item.done .state{opacity:.6}\n'
    '  .legend{display:flex; gap:14px; flex-wrap:wrap; font-size:12.5px; color:var(--muted); margin:-12px 0 22px}\n'
    '  .legend .state{margin-left:0; margin-right:4px}\n')

# ---------------------------------------------------------------- Kopf, Callout, Fuss
rep('zuletzt geprüft am 28.&nbsp;September&nbsp;2026.', 'zuletzt komplett geprüft am 29.&nbsp;September&nbsp;2026 (Shop, Theme, Versand, Rechtstexte, Produkte; Printify soweit ohne Zugang möglich).')

legend = ('  <div class="legend">'
          f'<span>{TAGS["part"]}angefangen, Rest offen</span>'
          f'<span>{TAGS["ofe"]}erledigt sich mit dem Publish von OFE&nbsp;v3</span>'
          f'<span>{TAGS["fix"]}zurückgefallen und von Claude behoben</span>'
          f'<span>{TAGS["new"]}neu aus dem Check</span>'
          '</div>\n\n')
rep('  <a class="datalink" href="https://claude.ai/code/artifact/b78ee699-be90-44aa-b2f1-c34e5c8d98b4">',
    legend + '  <a class="datalink" href="https://claude.ai/code/artifact/b78ee699-be90-44aa-b2f1-c34e5c8d98b4">')

rep('  <div class="callout">\n    <strong>Update 28.09.:</strong>',
    '  <div class="callout">\n    ' + F['callout'] + '<br><br><strong>Update 28.09.:</strong>')

rep('<span>Stand: 28. September 2026 · Deutschland-Umstellung (03.09.), 14 neue Produkte (21./28.09.) und LUCID-Klärung (28.09.) erledigt und verifiziert',
    '<span>' + F['footer_stand'] + ' · Deutschland-Umstellung (03.09.), 14 neue Produkte (21./28.09.) und LUCID-Klärung (28.09.) erledigt und verifiziert')

# ---------------------------------------------------------------- 01 Launch-Blocker
upd('b0', detail='Stand 29.09. (per API nachgelesen): Die <strong>Versandrichtlinie</strong> nennt die EU noch an 3 Stellen, die <strong>Checkout-AGB</strong> (Stand 25.08.) in §&nbsp;4 Abs.&nbsp;2 und §&nbsp;5 Abs.&nbsp;1, und im <strong>Impressum</strong> fehlt die LUCID-Zeile. Das ist jetzt der wichtigste offene Punkt: Der Footer-Link „Versand &amp; Lieferung“ und das Hilfe-Center zeigen direkt auf die veraltete Versandrichtlinie. Claude darf Richtlinien nur lesen, nicht speichern. Dauer: ~3 Minuten, alle Texte stehen unten bei den Vorlagen.')

upd('b1', detail='✓ Technisch nur Deutschland (29.09. erneut geprüft): Nur der Markt „Deutschland“ ist aktiv, „Europäische Union“ und „America“ liegen als Entwurf. Für Österreich und alle anderen Länder gibt es keine Versandoption. Verlauf: am 24.–25.08. auf DE&nbsp;+&nbsp;EU vereinheitlicht, am 03.09. auf deine Entscheidung hin auf nur Deutschland umgestellt (Seiten, Collections, Produkte, OFE&nbsp;v3). Einziger Rest sind die zwei Checkout-Richtlinien, die stehen im Punkt „Richtlinien einfügen“ oben.')

upd('b2', title='Versand innerhalb Deutschlands immer kostenlos', tags=('fix',), detail=F['b2'])

upd('b3', detail='✓ Von Claude erledigt in OFE&nbsp;v3: Alle 8 Steuertext-Bausteine und der Preisblock der Produktseite zeigen den §&nbsp;19-Hinweis statt „Inkl. Steuern“ (29.09. erneut geprüft).' + F.get('b3_extra', '') + ' Kunden sehen das mit dem OFE-v3-Publish; das Live-Theme v2.0 zeigt noch „Steuern und Versand werden beim Checkout berechnet“.')

upd('b4', detail='✓ Von Claude über deinen PC erledigt (25.08.): Kompletter AGB-Text in Einstellungen → Richtlinien eingefügt, im Checkout-Footer verlinkt. Dadurch hängt Shopify AGB + Widerrufsbelehrung für deutsche Bestellungen automatisch als PDF an die Bestellbestätigung. Der Inhalt nennt aber noch DE&nbsp;+&nbsp;EU; die drei Änderungen stecken im Punkt „Richtlinien einfügen“ oben.')

upd('bd1', detail='✓ Von Claude über deinen PC erledigt (25.08.): Den „Automatisierte Richtlinie“-Schalter deaktiviert und das generische US-Template durch deine deutsche DSGVO-Version (17 Abschnitte) ersetzt, 29.09. erneut geprüft. Offen ist nur der Zahlungsabschnitt, siehe „Datenschutzerklärung nach Zahlarten-Setup konkretisieren“.')

upd('b6', detail='Stand 29.09.: weiterhin <strong>keine Digital Wallets aktiv</strong>, Shopify Payments ist also noch nicht eingerichtet. PayPal muss zum Launch laufen, weil AGB und Datenschutzerklärung es nennen. Wichtig: Die Verbindung zwischen PayPal und Claude (28.09.) ersetzt nicht die Verbindung zwischen PayPal und Shopify, die geht nur im Admin. Dafür brauchst du: Ausweis, IBAN, PayPal-Geschäftskonto (siehe Datenmappe). Dauer: ~20–30 Minuten + Prüfzeit durch Shopify.')

upd('b7', detail=F['b7'], howto=howto('Schritt für Schritt (≈ 15 Min)', [
    'Vorbereitung bei Printify: ' + a('https://printify.com/app/store/settings/order-settings', 'Store settings → Order settings') + ' → <strong>Order approval auf „Manually“</strong> stellen (so geht die Bestellung nicht ungefragt in den Druck).',
    'Shop im Browser öffnen (Passwort eingeben) → ein Poster in den Warenkorb → Checkout mit deiner echten Adresse → Rabattcode <strong>LAUNCH-TEST-100</strong> eingeben. Erwartet: Artikel 0&nbsp;€, Versand kostenlos, <strong>Gesamtsumme 0,00&nbsp;€</strong> → bestellen. (Wenn Shopify Payments schon läuft, kannst du stattdessen im ' + a(ADM + '/settings/payments', 'Testmodus') + ' mit der Testkarte 4242&nbsp;4242&nbsp;4242&nbsp;4242 auch die Zahlung testen, ' + a('https://help.shopify.com/de/manual/checkout-settings/test-orders', 'Anleitung') + '.)',
    'Dabei prüfen: Versandzeile kostenlos (Rabatt „Kostenloser Versand Deutschland“), <strong>keine Steuerzeile</strong>, §&nbsp;19-Hinweis, Kauf-Button eindeutig („Jetzt kaufen“), AGB/Widerruf im Checkout-Footer verlinkt.',
    'Bestellbestätigungs-Mail lesen: deutsch? AGB- und Widerrufs-PDF angehängt, und zwar schon in der Fassung „nur Deutschland“ (dafür vorher „Richtlinien einfügen“ erledigen)?',
    'Gegenprobe Ausland: Checkout mit Adresse in Österreich oder der Schweiz versuchen → es darf <strong>keine Versandoption</strong> geben.',
    'Entscheiden: Bestellung bei Printify <strong>freigeben</strong> (= deine Musterbestellung, Printify berechnet dir Produktion + Versand) oder in Shopify <strong>stornieren</strong> und bei Printify prüfen, dass nichts in Produktion ist.',
    '<strong>Claude Bescheid geben:</strong> Dann wird LAUNCH-TEST-100 gelöscht, damit niemand sonst ein Gratis-Poster bekommt.',
]))

upd('b10', detail=F['b10'], howto_sub=[
    ('<li>In der Liste der Theme-Bibliothek <strong>„LimitlessPoster OFE v3"</strong> suchen → Menü <strong>⋯</strong> → <strong>„Veröffentlichen"</strong> → bestätigen.</li>',
     '<li>In der Theme-Bibliothek genau <strong>„LimitlessPoster OFE v3“</strong> suchen ' + F['b10_pick'] + ' → Menü <strong>⋯</strong> → <strong>„Veröffentlichen“</strong> → bestätigen.</li>'),
    ('deutsch? „BESTSELLER"-Button führt zur Bestseller-Collection?)', 'deutsch? Button führt zur Favoriten-Collection?), Footer-Link „Datenschutz-Einstellungen“ (öffnet die Cookie-Einstellungen?)'),
])

upd('b8', detail='Stand 29.09.: Passwortschutz aktiv, 0 Bestellungen, 0 Kunden. Die Passwortseite von v2.0 ist englisch („Opening soon“), die von OFE&nbsp;v3 deutsch, also erst OFE&nbsp;v3 veröffentlichen. Passwort erst entfernen, wenn Richtlinien, Zahlarten, Testbestellung und OFE-v3-Publish erledigt sind. Danach direkt: „Google Search Console“ in Abschnitt&nbsp;6.')

# ---------------------------------------------------------------- 02 Recht
upd('r1', done=False, tags=('ofe',), detail='Das Impressum ist als Shop-Richtlinie hinterlegt (/policies/legal-notice) und im Ziel-Theme OFE&nbsp;v3 direkt im Footer verlinkt. Im aktuellen Live-Theme v2.0 steckt es nur im Richtlinien-Popover (29.09. geprüft). Erledigt sich mit „Theme OFE v3 veröffentlichen“, dann abhaken.')

upd('r2', detail='✓ Von Claude auf deine Anweisung eingetragen und live verifiziert (27.08.): „Umsatzsteuer-Identifikationsnummer gemäß §&nbsp;27a UStG: DE463961672“ steht im veröffentlichten Impressum. Alles andere im Impressum war bereits vollständig. Die LUCID-Zeile (Printify-Nummer) kommt mit dem Punkt „Richtlinien einfügen“.')

upd('r4', detail='✓ Byte-identisch verifiziert (24.08.), am 29.09. erneut bestätigt. Kleinigkeit: Im Footer-Menü „Hilfe“ führen „Widerrufsrecht“ (Seite) und „Rückgaben &amp; Stornierungen“ (Richtlinie) auf denselben Inhalt. Stört nicht, kann Claude auf Wunsch zusammenlegen.')

upd('r5', detail='Die Datenschutz-Seite ist stark (17 Abschnitte, DSGVO-konform). Sobald feststeht, welche Zahlarten live sind, Abschnitt&nbsp;7 (Zahlungsabwicklung) konkretisieren: Anbieter nennen und den Satz „Sofern wir weitere Zahlungsarten anbieten …“ streichen, auf der Seite UND in der Checkout-Richtlinie. Die Seite kann Claude anpassen, die Richtlinie machst du im Admin. Google Fonts: geprüft, lokal gehostet.')

upd('r6', done=False, tags=('part',), detail=F['r6'])

upd('r7', detail='✓ In allen 113 aktiven Produkten, jeweils mit §&nbsp;19-Hinweis (29.09. geprüft). Regel für die Zukunft: bei jedem neuen Produkt und jedem Beschreibungs-Edit erhalten!')

upd('r11', detail='✓ Gescannt (24.08., am 29.09. erneut): kein OS-Plattform- oder ODR-Link in Richtlinien, Seiten und Theme-Vorlagen. Der §&nbsp;36 VSBG-Hinweis ist korrekt und bleibt.')

insert_after('r11', 'rn2', '3', False, 'AGB §&nbsp;11: nur eigene Rechte beanspruchen',
    '§&nbsp;11 sagt, alle Motive und Designs seien urheberrechtlich geschützt und ohne Zustimmung nicht nutzbar. Mehrere Motive zeigen aber fremde Marken oder reale Personen (siehe „Marken- und Bildrechte“ in Abschnitt&nbsp;4). Formuliere §&nbsp;11 bei dieser Entscheidung so, dass er nur Rechte an eigenen Texten, Fotos und Designs beansprucht. Die Seite /pages/agb kann Claude anpassen, die Checkout-AGB änderst du im Admin. Keine Rechtsberatung.')

# ---------------------------------------------------------------- 03 Settings
upd('s2', done=False, tags=('ofe',), detail=F['s2'])

upd('s0', detail='Die Beschreibung im Google-Snippet und beim Teilen (og:description) sagt noch „Versand nach DE &amp; EU inklusive“. Die Präferenzen sind per API nicht erreichbar. Seit dem Versand-Fix vom 29.09. stimmt „versandkostenfrei innerhalb Deutschlands“ auch im Checkout. Dauer: ~1 Minute, Text unten bei den Vorlagen. Tipp: im selben Formular gleich das Social-Sharing-Bild hochladen (Abschnitt&nbsp;5).')

upd('s3', detail='Stand 29.09.: Absender ist noch Gmail. info@limitlessposter.com statt Gmail, sonst landen Bestellmails im Spam und wirken unseriös. Danach kann Claude die Adresse in allen Seiten per API ersetzen, die Richtlinien machst du im Admin. Dauer: ~30–45 Minuten (plus DNS-Wartezeit).')

upd('s5', detail='Stand 29.09.: noch keine Rechnungs-App. Shopify erstellt von sich aus keine deutschen Rechnungen. Für den Start reicht die kostenlose Shopify-App „Order Printer“; am besten mit der Testbestellung prüfen. Dauer: ~15 Minuten.')

upd('s6', title='Markets auf Deutschland begrenzt', detail='✓ Seit 03.09. ist nur der Markt „Deutschland“ aktiv (29.09. erneut geprüft). „Europäische Union“ und „America“ liegen als Entwurf bereit. Vor einer späteren Aktivierung prüfen: Versand, Steuer-Einstellungen und Rechtstexte.')

insert_after('s8', 'sn1', '3', False, 'Vertriebskanal „Shop“ (Shop-App) nutzen?',
    'Der Kanal „Shop“ ist installiert, zeigt aber 0 Produkte (Onlineshop: 113). Wenn du willst, veröffentlicht Claude alle Produkte per API in der Shop-App: zusätzliche Reichweite ohne Mehraufwand. Sag einfach Bescheid. Den ebenfalls installierten Kanal Point of Sale kannst du ignorieren.')

# ---------------------------------------------------------------- 04 Produkte
upd('p1', detail='✓ Auf allen 113 aktiven Produkten (29.09. geprüft): deutscher Titel, Beschreibung nach Konvention (Hook + Qualität &amp; Details + Versand &amp; Garantie + GPSR), SEO-Description ≤&nbsp;160 Zeichen. Möglicher Feinschliff: englische URLs, siehe neuer Punkt unten.')

upd('p2', done=F['p2_done'], tags=F['p2_tags'], detail=F['p2'])

upd('p3', detail='✓ Deine Entscheidung (24.08.): Die Staffel 64,99–108,99&nbsp;€ bleibt. Zusätzlich zum Produktionspreis fallen bei Printify echte Versandkosten pro Bestellung an. Offen ist nur ein Ausreißer bei 46&nbsp;×&nbsp;61&nbsp;cm, siehe neuer Punkt unten.')

upd('p4', done=False, tags=('part',), detail=F['p4'])

upd('p6', detail='✓ Geprüft (24.08.): Alle Produkte tragen Tags, die Grundlage für Filter und Suche steht. Kür (29.09.): Es sind 568 englische Printify-Schlagwörter; ein eigenes System (z.&nbsp;B. thema:*, format:hoch/quer) würde echte Filter und Smart-Collections ermöglichen.')

upd('p7', detail='Damit ab der ersten Bestellung automatisch Review-Anfragen rausgehen, Social Proof ist bei Premium-Preisen entscheidend. Neu 29.09.: Am Shop hängt eine Spur der App <strong>„Sternify“</strong>. Schau unter ' + a(ADM + '/apps', 'Apps') + ' nach, ob sie noch installiert ist, und entscheide dich für eine Lösung, damit keine doppelten Widgets oder Kosten entstehen. Dauer: ~20 Minuten.')

upd('pn3', title='Favoriten-Collection kuratiert (ehemals „Bestseller“)', tags=('fix',), detail=F['pn3'])

upd('pn4', detail='✓ Von Claude erledigt und verifiziert (21./28.09.): Red Retro, Life Is Tough, Nobody Is Coming, What a Privilege, Born to Win, Leopard mit Perlenkette, Matchday von oben, Winning Isn\'t for Everyone, Tiger im Pool, FOCUS, Queens Don\'t Compete, Designer Heels, Noir – Pistole &amp; Perlen und Batman-Silhouette: deutscher Titel, Beschreibung nach Konvention (cm-Größen, Versand nur DE, GPSR-Block), SEO-Text, Alt-Texte und Collections (New Drop + Thema). Rest daraus: Preis für 46&nbsp;×&nbsp;61&nbsp;cm (neuer Punkt unten). Regel bleibt: Nach jedem Printify-Publish kurz melden, dann übernimmt Claude Texte, Collections und Prüfung.')

upd('pn5', detail=F['pn5'])

upd('pn1', detail=F['pn1'], howto_sub=[
    ('<li><strong>Wichtig danach:</strong> Shopify-Admin → Einstellungen → Versand: Die neuen Varianten landen im Printify-Profil — sie dem <strong>„Allgemeinen Profil"</strong> zuordnen (das gilt bei jedem Printify-Republish!).</li>',
     '<li>Danach Claude Bescheid geben: Größenzeile und SEO-Text werden angepasst. Versand bleibt dank Gratisversand-Rabatt automatisch kostenlos, im Versandprofil musst du nichts umziehen.</li>'),
])

upd('pn2', done=False, tags=('part',), detail=F['pn2'], howto_sub=[
    ('(Aktuell verlinken die Hauptmenüs sie ohnehin nicht — nur prüfen, ob sie über „Finde deinen Stil" auf der Startseite auftauchen.)',
     F['pn2_howto_b']),
])

insert_after('pn2', 'p9', '3', False, 'Preis für 46&nbsp;×&nbsp;61&nbsp;cm vereinheitlichen',
    'Die 14 Motive vom 17./21.09. kosten in 46&nbsp;×&nbsp;61&nbsp;cm 79,99&nbsp;€, die übrigen 99 kosten 81,99&nbsp;€. Alle anderen Größen sind überall gleich (64,99 / 68,99 / 74,99 / 89,99 / 108,99&nbsp;€). Entscheide dich für einen Preis und stell ihn in Printify ein, sonst setzt der nächste Sync eine Änderung in Shopify zurück.')
insert_after('p9', 'p10', '3', False, 'Kraftausdrücke in 2 Titeln: Werbe-Feeds bedenken',
    '„Fuck Them All“ und „Just Do Some Creative Shits“ (plus Tag „profanity art“) können von Google Shopping, Meta- und Pinterest-Katalogen abgelehnt werden. Entscheide vor dem Merchant Center (Abschnitt&nbsp;6), ob diese Motive neutrale Feed-Titel bekommen oder aus den Werbekatalogen bleiben.')
insert_after('p10', 'p11', '3', False, 'Englische Produkt-URLs vor dem Launch umstellen?',
    'Alle 113 Adressen sind lange englische Printify-Namen, z.&nbsp;B. „horizontal-framed-poster“ für Vintage Formula&nbsp;1. Solange das Passwort aktiv ist, ist nichts bei Google indexiert: Jetzt wäre der günstigste Zeitpunkt für kurze deutsche URLs. Claude kann das samt Weiterleitungen und Theme-Verweisen übernehmen, wenn du willst. Sonst einfach abhaken.')
if F.get('pn6'):
    insert_after('p11', 'pn6', '3', True, 'Texte korrigiert: Rahmenfarbe, Größen, Kontakt-Link', F['pn6'])

# ---------------------------------------------------------------- 05 Theme
upd('t1', detail='✓ Von Claude erledigt, unabhängig gegengeprüft und in der Theme-Vorschau bestätigt (25.08., Deutschland-Texte 03.09., erneut geprüft 29.09.): 404-Seite deutsch, Warenkorb + Upsell deutsch, Kollektionen-Seite, „Zur Kasse“, Newsletter „Anmelden“, „Powered by Shopify“ aus, §&nbsp;19-Steuertexte, Produktseiten voll kaufbar. Live gehen die Fixes mit dem OFE-v3-Publish.')

upd('tb1', title='Favoriten-Collection im Theme verlinkt', detail=F['tb1'])

upd('t2', detail='Über die Hälfte des Traffics kommt mobil. Per API nicht prüfbar; die Konfiguration ist mobil vorbereitet (2 Spalten, Sticky-Header, Galerie als Karussell). Am echten Handy, geht über die OFE-v3-Vorschau auch schon vor dem Launch. Dauer: ~15 Minuten.')

upd('t3', detail='✓ Deine Entscheidung (24.08.): kein Löschen. Live ist v2.0, Ziel-Theme ist „LimitlessPoster OFE&nbsp;v3“; die übrigen bleiben als Archiv liegen.' + F.get('t3_extra', ''))

upd('t4', detail='Das Bild erscheint, wenn jemand den Shop auf WhatsApp/Instagram teilt; aktuell ist keins gesetzt (29.09. geprüft). Favicon: ✓ bereits im Theme gesetzt. Im selben Formular die Meta-Beschreibung korrigieren (Punkt in Abschnitt&nbsp;3). Dauer: ~15 Minuten.')

upd('t5', detail='In OFE&nbsp;v3 sind die Social-Links leer, es erscheinen also keine Icons. Das Live-Theme v2.0 zeigt Platzhalter auf die Startseiten von Facebook, Instagram, YouTube, TikTok und X; die verschwinden mit dem OFE-v3-Publish. Sobald deine Profile existieren (Abschnitt&nbsp;6):')

upd('tn2', tags=('ofe',), detail='Stand 29.09.: Im Live-Theme v2.0 lädt der 3D-Viewer bei 99 Produkten (Metafeld poster_3d_url ist gesetzt) auf Klick ein Script von Google. OFE&nbsp;v3 nutzt einen eigenen 3D-Viewer ohne externe Quelle. Das Thema erledigt sich also mit dem OFE-v3-Publish, dann abhaken.', howto='')

if F.get('tn3'):
    insert_after('t6', 'tn3', '2', True, 'OFE v3: Startseite, Cookie-Link und Feinschliff (29.09.)', F['tn3'])

# ---------------------------------------------------------------- 06 Marketing
upd('m2', detail='✓ Von Claude über deinen PC erledigt (25.08.): „LimitlessPoster — Gerahmte Motivations- &amp; Sport-Poster“ (54 Zeichen) + Beschreibung (143 Zeichen) in den Präferenzen gespeichert. Die Beschreibung nennt noch „DE &amp; EU“, die Korrektur steckt im Punkt „Homepage-Meta-Description“ in Abschnitt&nbsp;3.')

upd('mn1', detail='✓ Von Claude erledigt und verifiziert (25.08., 29.09. erneut geprüft): Alle 15 sichtbaren Collections haben deutsche SEO-Titel und Meta-Descriptions ≤&nbsp;160 Zeichen. Die Favoriten-Collection hat am 29.09. neue, neutrale Texte bekommen.')

upd('m3', detail='Stand 29.09.: Shopify Analytics läuft (127 Sitzungen in 30 Tagen, alle direkt, also vor allem du selbst). Zum Start reicht das; so steht es auch in der Datenschutzerklärung. Pixel erst mit Cookie-Einwilligung und passender Ergänzung der Datenschutzerklärung.')

upd('m5', detail='✓ Verifiziert (25.08.): „Marketing-Bestätigung für Kunden“ ist aktiv, Double-Opt-in läuft DSGVO-konform. Per API nicht lesbar (29.09.), bisher 0 Abonnenten: Bei der Testbestellung einmal mit eigener Adresse anmelden und prüfen, ob die Bestätigungsmail kommt. Kür: Willkommens-Rabatt im Footer-Text erwähnen.')

upd('m6', detail='Ein Einführungsangebot für die ersten 2 Wochen gibt dem Launch Schwung; WELCOME10 gibt es noch nicht. <strong>Neu 29.09.:</strong> Jeder Rabattcode muss „mit Versandrabatten kombinierbar“ sein, sonst verliert der Kunde beim Einlösen den Gratisversand. Claude kann WELCOME10 richtig eingestellt anlegen, sag einfach Bescheid. Dauer: ~10 Minuten.',
    howto_sub=[('<li>Zeitraum: Launch-Tag + 14 Tage; keine Mindestbestellmenge nötig; Kombination mit anderen Rabatten aus.</li>',
                '<li>Zeitraum: Launch-Tag + 14 Tage; keine Mindestbestellmenge nötig. <strong>Kombination: „Versandrabatte“ anhaken</strong> (sonst entfällt der Gratisversand), andere Rabatte aus.</li>')])

upd('m7', detail='Kostenlose Shopping-Listings + ggf. Ads, erst angehen, wenn der Shop ein paar Wochen rund läuft (29.09.: Google-Kanal noch nicht installiert). Vorher die zwei Titel mit Kraftausdrücken klären (Abschnitt&nbsp;4).')

# ---------------------------------------------------------------- 07 Betrieb
upd('o1', detail='Per API nicht prüfbar, Claude hat keinen Printify-Zugang. <strong>Neu 29.09.:</strong> Printify synchronisiert seine Versandprofile in Shopify und hat dabei den 0-€-Versand überschrieben. Der Gratisversand-Rabatt fängt das jetzt ab; schau trotzdem, ob du die Synchronisierung der Versandprofile abschalten kannst. Dauer: ~10 Minuten. Tipp: Mit einem <strong>Printify-API-Token</strong> (Konto → Connections) kann Claude Produkte und Bestellungen dort direkt prüfen, siehe Datenmappe.',
    howto_sub=[('<li>Gute Nachricht: Neue Printify-Produkte landen automatisch in den richtigen Printify-Versandprofilen — da muss nichts mehr umgezogen werden (Stand 25.08.).</li>',
                '<li>Versandprofile: Neue Printify-Produkte landen in Printifys eigenen Profilen mit Versandkosten. Das ist okay, der Rabatt „Kostenloser Versand Deutschland“ macht den Versand im Checkout trotzdem kostenlos. Falls Printify anbietet, den Versandprofil-Sync abzuschalten: abschalten.</li>')])

upd('o2', tags=('part',), detail='Kundenseitig ist alles kommuniziert (✓ FAQ + Widerrufsbelehrung mit Esslinger Adresse, 29.09. geprüft). Intern nur noch den Ablauf festzurren; die Support-Vorlage „Widerruf“ unten ist seit 29.09. an die Widerrufsbelehrung angeglichen.')

upd('o3', detail='Stand 29.09.: noch nicht bestellt. Zwei Wege: über Printify „Order sample“ (günstiger) oder als echte Shop-Bestellung mit LAUNCH-TEST-100 (testet zusätzlich Checkout, Weitergabe an Printify und Tracking-Mail, siehe Testbestellung). Qualität, Rahmen, Verpackung und Laufzeit einmal selbst erleben und Material für eigene Fotos bekommen. Budget: ~50–90&nbsp;€.')

upd('o6', detail='Erst ab ~500 Sessions/Woche lassen sich echte Schlüsse ziehen, vorher nicht an jedem Rädchen drehen. Claude kann dir die Zahlen per ShopifyQL als wöchentliche Routine liefern.')

insert_after('o6', 'on1', '3', False, 'Shop-Postfach für Claude freigeben (optional)',
    'Die Shop-Mails von Shopify, Printify und Kunden gehen an limitless.posterje@gmail.com. Mit Claude verbunden ist aber dein privates Gmail, dort kam in 45 Tagen keine Printify-Mail an. Wenn Claude Bestellungen, Printify-Meldungen und Support mitprüfen soll: Weiterleitung einrichten oder das Shop-Postfach verbinden.')

# ---------------------------------------------------------------- Vorlagen
rep('Sobald das Poster hier eintrifft (oder du mir den Versandnachweis schickst),\nerstatte ich dir den vollen Kaufpreis innerhalb von 14 Tagen auf dein\nursprüngliches Zahlungsmittel.',
    'Den vollen Kaufpreis erstatte ich dir spätestens 14 Tage nach deinem\nWiderruf auf dein ursprüngliches Zahlungsmittel, sobald das Poster hier\nist oder du mir den Versandnachweis schickst.')

open(DST, 'w', encoding='utf-8').write(html)
print('ok', orig_len, '->', len(html))
