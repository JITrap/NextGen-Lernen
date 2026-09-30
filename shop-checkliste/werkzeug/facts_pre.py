# -*- coding: utf-8 -*-
import json, sys
from facts_common import *
F = dict(
 callout='<strong>Update 29.09. — Komplett-Check von Shop und Printify:</strong> Alle 69 Punkte neu bewertet, die Etiketten oben zeigen „Teilweise“ und „Mit OFE&nbsp;v3“. <strong>Wichtigster Befund:</strong> Printify hatte seine Versandprofile überschrieben, der Checkout hätte 23,19&nbsp;€ pro Poster verlangt. <strong>Von Claude behoben und per Probeberechnung geprüft:</strong> automatischer Gratisversand für Deutschland, der Testcode LAUNCH-TEST-100 ist damit kombinierbar (Testbestellung 0,00&nbsp;€). Außerdem heißt „Bestseller“ jetzt „Favoriten“, weil es noch keine Bestellungen gibt, und der kaputte Kontakt-Link auf „Über uns“ ist repariert. <strong>Gerade in Arbeit:</strong> Alt-Texte für 2.474 Bilder, Rahmen- und Größenangaben in Texten, Menü mit GRIT und ICONS, Feinschliff in OFE&nbsp;v3. <strong>Deine Reihenfolge:</strong> Richtlinien einfügen → Zahlarten → Testbestellung → OFE&nbsp;v3 veröffentlichen → Passwort raus.',
 footer_stand='Stand: 29. September 2026 · Komplett-Check von Shop und Printify mit Versand-Fix (29.09.)',
 b2=B2, b7=B7,
 b10=B10 + 'Achtung bei der Auswahl: Es gibt zwei ähnlich heißende Themes, veröffentlichen musst du „LimitlessPoster OFE v3“. Dauer: ~5 Minuten.',
 r6='Der Shopify-Cookie-Banner ist aktiv: Das Banner-Skript wird live ausgeliefert, am 25.08. erschien er deutsch. <strong>Neu 29.09.:</strong> Die Datenschutzerklärung verspricht einen Footer-Link, über den man die Einwilligung ändern kann. In OFE&nbsp;v3 führt „Datenschutz-Einstellungen“ aber auf Shopifys US-Opt-out-Seite statt zu den Cookie-Einstellungen. Claude baut das gerade in OFE&nbsp;v3 um. Bleibt für dich: nach dem Publish einmal im privaten Fenster testen.',
 s2='Die Menüs für OFE&nbsp;v3 sind angelegt (Hauptmenü, footer-shop, footer-info, footer-hilfe), alle Links funktionieren (29.09. geprüft). GRIT und ICONS fehlen noch im Untermenü „Kollektionen“, Claude ergänzt das gerade. Das Live-Theme v2.0 zeigt gar keine Footer-Menüs; das erledigt sich mit dem OFE-v3-Publish. Optional: Dubletten zwischen footer-info und footer-hilfe bereinigen (sag Bescheid).',
 p2_done=False, p2_tags=['part'],
 p2='Teilweise (29.09. gezählt): 2.474 von 3.264 Produktbildern haben keinen Alt-Text, vor allem die Varianten-Mockups von Printify. Die ersten 6–7 Bilder je Produkt sind beschriftet. Claude trägt die fehlenden gerade nach dem Schema „Titel, Rahmenfarbe, Größe“ nach.',
 p4='In allen Beschreibungen stehen cm-Angaben. Offen: Die Variantenauswahl zeigt noch Zoll und englische Optionsnamen („Size“, „Color“, „Black/White“), die kommen von Printify. Umstellen am sichersten in Printify, sonst überschreibt der nächste Sync die Änderung. Außerdem nennen 11 Querformat-Produkte die Größen noch in Hochformat-Reihenfolge; das korrigiert Claude gerade.',
 pn3=PN3,
 pn5='Stand 29.09.: <strong>19 Produkte</strong> nennen eine Marke oder Person direkt (u.&nbsp;a. Batman, Ferrari/F1, Marlboro, Porsche, Nike „Just Do It“, Wimbledon, Godfather, Messi, Ronaldo, Neymar, Jordan), dazu rund 15 Motive mit Promi-Bezug in den Tags. 5 davon liegen in der Favoriten-Collection, und OFE&nbsp;v3 zeigt Ferrari und Messi auf der Startseite (Claude tauscht sie gerade gegen eigene Motive). Ohne Lizenz ist das in Deutschland ein typischer Abmahngrund, und Printify kann solche Produkte sperren. Deine Entscheidung je Motiv: behalten, umbenennen oder entfernen. Entwurf-Status setzen oder aus Collections nehmen übernimmt Claude. Keine Rechtsberatung: im Zweifel fachlich prüfen lassen.',
 pn1='Hat nur 3 Größen (alle 2:3) statt 6. Der SEO-Text sagt noch „viele Größen“, Claude korrigiert das gerade. Bleibt nur deine Entscheidung: in Printify 11×14, 16×20 und 18×24 ergänzen oder bei 3 Größen bleiben (dann abhaken).',
 pn2=PN2,
 pn2_howto_b='(GRIT und ICONS stehen noch in keinem Menü, Claude nimmt sie gerade ins Kollektionen-Menü auf.)',
 tb1='✓ In OFE&nbsp;v3 ist die kuratierte Collection auf Startseite, Hero, 404, Warenkorb, Gallery Wall und im Hauptmenü verlinkt. Die Collection heißt seit 29.09. „Favoriten“; die Überschriften im Theme stellt Claude gerade ebenfalls um.',
 b10_pick='(die richtige ist die mit Stand 20.09., nicht „OFE v3 — Experience (Claude WIP)“)',
)
json.dump(F, open(sys.argv[1],'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print('facts ok')
