---
tags: [limitlessposter, changelog]
datum: 2026-09-21
---
# Änderungsprotokoll 21.09.2026 – 11 neue Motive auf Shop-Konvention

## Ausgangslage (Live-Check 21.09.)
- **110 aktive Produkte** (vorher 99): Julius hat am 17.09. **11 neue Printify-Motive** veröffentlicht. Sie kamen mit englischen Printify-Texten, alter EU-Gewährleistungsformel, ohne GPSR-Block, ohne SEO-Text, ohne Alt-Texte und **ohne Collection** (also im Shop nicht auffindbar außer über „Alle Poster").
- Theme **OFE v3** wurde am 14./20.09. weiter ausgebaut (Rooms-Sektion, 3D-Viewer, Gallery Wall, Trust-Block, `de.json`-Feinschliff). Geprüft: alle Deutschland-only-Texte vom 03.09. sind erhalten, der Produkt-Accordion-Text wurde sogar sauberer formuliert. Live ist weiterhin v2.0.
- Seiten `story`, `gallery-wall` am 14.09. veröffentlicht (Inhalt kommt aus Theme-Sektionen, Body leer – ok).
- Unverändert offen: Checkout-Richtlinien Versand/AGB (noch „DE + EU"), Homepage-Meta-Description (noch „DE & EU"), Shopify Payments inaktiv, 0 Bestellungen.

## Erledigt (live, verifiziert)
| Produkt (Handle) | Neuer Titel | Collections |
|---|---|---|
| red-retro-music-poster | Red Retro – Musik-Poster im Pop-Art-Stil | New Drop, Icons, Artists, Statements |
| …life-is-tough-so-are-you… | Life Is Tough, So Are You – Motivations-Poster | New Drop, Mindset, Quotes |
| …nobody-is-coming-to-save-you… | Nobody Is Coming to Save You – Racing-Poster | New Drop, Mindset, Apex, Sports |
| what-a-privilege-poster… | What a Privilege – Tennis-Poster mit Augenzwinkern | New Drop, Sports, Statements, Quotes |
| panther-poster-born-to-win… | Born to Win – Panther-Poster | New Drop, Mindset, Statements |
| …leopard-with-pearl-necklace… | Leopard mit Perlenkette – Wildlife-Poster (Querformat) | New Drop, Still, Queens, Statements |
| tennis-court…aerial-matchday… | Matchday von oben – Tennis-Poster (Querformat) | New Drop, Sports, Still |
| …winning-isn-t-for-everyone… | Winning Isn't for Everyone – Medaillen-Poster | New Drop, Mindset, Quotes, Sports |
| tiger-pool-framed-poster… | Tiger im Pool – Vintage-Wildlife-Poster (Querformat) | New Drop, Still, Heritage |
| focus-motivational-poster… | FOCUS – Skulptur-Poster in Schwarz-Weiß | New Drop, Mindset, Quotes, Statements |
| …queens-dont-compete-they-reign… | Queens Don't Compete, They Reign – Leoparden-Poster | New Drop, Queens, Statements, Mindset |

Je Produkt gesetzt: deutscher Titel · Beschreibung nach Konvention (Hook, Qualität & Details mit **cm-Größen – Querformat mit korrekten Querformat-Maßen**, Versand nur DE, GPSR-Block, § 19-Hinweis) · SEO-Description ≤ 160 Zeichen · Alt-Texte für die ersten 7 Bilder (Motiv/Studio/Wohnbeispiel/Weißer Rahmen/Wohnszene/gerahmtes Poster) · Collections. Tags, Preise (64,99–108,99 €), Varianten unverändert. Alle 132 neuen Varianten sind kaufbar und in den Printify-Versandprofilen (1.314 Varianten gesamt).
„New Drop": die 11 Neuheiten stehen jetzt vorn (neueste zuerst), 29 Produkte gesamt.

Verifikation: alle 110 Produkte per Python gegen die Vorgaben geprüft (Formel, GPSR, SEO, Collection, byteidentisch zum Payload) – 110/110 ok.

## Regel ab jetzt
Nach jedem Printify-Publish kurz Bescheid geben (oder Claude findet es beim nächsten Routine-Check) → Claude übernimmt Titel, Beschreibung, SEO, Alt-Texte, Collections.

## Backups
`shop-checkliste/backup-2026-09-21/` (Ist-Zustand der 11 Produkte vor der Änderung, Theme-Dateiliste).
