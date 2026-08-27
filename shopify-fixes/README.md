# Shopify-Theme-Fixes für „LimitlessPoster v2.0"

Zwei korrigierte Dateien aus dem Code-Review vom 15.08.2026. Die API erlaubt
aus Sicherheitsgründen kein direktes Schreiben ins live geschaltete Theme,
deshalb liegen die fertigen Dateien hier zum Einfügen bereit.

**So übernimmst du sie** (dauert ca. 1 Minute):
Shopify-Admin → Onlineshop → Themes → „LimitlessPoster v2.0" → ⋯ → **Code bearbeiten**
→ Datei links suchen → kompletten Inhalt durch die Version aus diesem Ordner ersetzen → Speichern.

Alternativ: Sag mir einfach Bescheid, dann übernehme ich beides auf einer
unveröffentlichten Theme-Kopie, die du danach prüfst und live schaltest.

## 1. `assets/limitless-brand.css`

**Problem:** `space-grotesk-600.woff` ist im Theme hochgeladen, war aber nie per
`@font-face` registriert. Alle Texte mit Schriftgewicht 600 (Footer-Wortmarke,
Zahlenband, Stats) wurden vom Browser künstlich fettgerechnet („Faux Bold") —
das sieht schwammiger aus als der echte Schnitt.

**Fix:** Zwei `@font-face`-Blöcke — der 500er-Schnitt deckt 400–500 ab, der
600er-Schnitt 600–700. Sonst ist die Datei unverändert.

## 2. `blocks/ai_gen_block_7f88c5d.liquid` (Produkt-Karussell-Loop)

**Probleme im Original:**
- **Absturz bei kleinen Kollektionen:** Hat die gewählte Kollektion weniger
  Produkte als „Produkte pro Ansicht" (z. B. 3 Produkte bei 4 pro Ansicht),
  griff `cloneItems()` auf nicht vorhandene Elemente zu → JavaScript-Fehler,
  Karussell komplett tot.
- **Falsche Karten nach Resize/Handy-Drehen:** Die Loop-Sprungpunkte wurden
  zur Laufzeit neu berechnet, die geklonten Karten aber nicht — nach einem
  Wechsel Desktop↔Mobil konnte der Loop auf falsche Karten springen.
- **Doppelklick-Desync:** Schnelles Klicken während der Animation konnte den
  Index über die Klone hinausschieben (leerer Bereich sichtbar).
- Kleinigkeiten: `gap`-Parsing ohne Fallback, englische `aria-label` im
  deutschen Shop.

**Fix:** Klon-Anzahl wird auf die vorhandenen Produkte begrenzt und einmalig
gespeichert; bei zu wenigen Produkten werden die Pfeile ausgeblendet statt zu
crashen; Loop-Sprung läuft zeitbasiert (520 ms) und sperrt währenddessen
weitere Klicks; `aria-label` auf Deutsch. Markup, Styles und Schema sind
unverändert — optisch ändert sich nichts.

## Gesamteinschätzung aus dem Review

Der übrige Custom-Code im Theme ist sauber:
`limitless-motion.js` (Reveal/Count-up/Progressbar) und die Sections
`limitless-scroll-showcase`, `limitless-drop-countdown`, `limitless-stats`
nutzen IntersectionObserver, requestAnimationFrame, passive Listener und
respektieren `prefers-reduced-motion` — genau so soll performanter
Theme-Code aussehen. Alle Nutzereingaben in den Sections werden escaped
(kein XSS-Risiko gefunden).
