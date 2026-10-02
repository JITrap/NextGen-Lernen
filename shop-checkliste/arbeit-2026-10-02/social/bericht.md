# Bericht Social: Teil 1 Recherche, Teil 2 Umsetzung

Stand 02.10.2026. In diesem Teil wurde nichts im Shop geändert: nur gelesen (Produkte, Theme OFE v3) und lokale Werkzeuge eingerichtet. Ergebnis ist das Briefing in `briefing.md`, die Motivliste in `motive.json`.

## 1. Kernaussagen der Recherche

### Link-Vorschau (og:image)
- **Standardmaß 1200 × 630 (1.91:1).** Damit funktionieren Facebook, X, LinkedIn, Discord, Slack, WhatsApp und iMessage. LinkedIn nutzt 1200 × 627, X schneidet für `summary_large_image` auf 2:1 (1200 × 600) aus der Mitte.
- **Safe-Zone:** Wichtiges gehört ins Zentrum (ca. 1080 × 600). WhatsApp zeigt je nach Ansicht ein Quadrat, deshalb muss der Kern auch in der Mitte 630 × 630 funktionieren.
- **Dateigröße:** Allgemein unter 1 MB (Facebook erlaubt bis 8 MB). Bei WhatsApp fällt das Bild jenseits von ca. 300 KB weg. Andere Quellen nennen 600 KB, Ziel sind deshalb **≤ 250 KB**. Formate: JPG/PNG/WebP. **GIF und SVG werden in WhatsApp-Vorschauen nicht unterstützt.**
- **Statisch:** iMessage liest nur `og:title` und `og:image` und zeigt GIF bzw. animierte Bilder nicht an. Link-Vorschauen spielen kein Video ab. Bewegung gehört daher in Reels, Stories und Anzeigen, nicht ins og:image.
- **Klickrate:** Eigene Vorschaubilder statt Text-Vorschau bringen laut Branchenauswertungen deutlich mehr Interaktion und Reshares (z. B. +30 % Reshares, A/B-Tests im Schnitt +23 % CTR). Wirkungsvoll sind hoher Kontrast, wenig Text, ein klares Hauptmotiv und Marke sichtbar. Titel mit 40–60 Zeichen schneiden am besten ab.
- **Cache:** WhatsApp und Facebook speichern Vorschauen zwischen. Zum Testen hilft ein Parameter wie `?v=2` bzw. „Neu scrapen“ im Sharing Debugger.

### Motion-Anzeigen / Reels für Wandkunst
- **Hook in 0,5–2 s:** Frame 0 muss ein fertiges Bild sein. Ein kurzer Text-Hook (1–4 Wörter) mittig hält gut.
- **Länge:** Der Bereich von 10–18 s gilt als optimal, bis 30 s geht. Für Loops sind 8–12 s sinnvoll.
- **Untertitel und Text-Overlays sind Pflicht.** Viele schauen ohne Ton, deshalb muss die Botschaft komplett im Text stehen.
- **Formate:** Meta empfiehlt seit März 2026 4:5 für Bilder und 9:16 für Video (1080 × 1920, empfohlen auch 1440 × 2560). Für Reels/Stories oben 14 %, unten 35 % und seitlich 6 % frei lassen. 9:16-Video mit Ton und Botschaft in der Safe-Zone erzielte laut Meta-Auswertung doppelt so viel Auslieferung in Reels und 34,5 % geringere Kosten pro Ergebnis als Bildanzeigen.
- **Pinterest:** 2:3 (1000 × 1500) performt am besten, Video 4 s bis 15 min, H.264, 24–30 fps.
- **Was bei Postern wirkt:** Poster im echten Raum statt freigestellter Studio-Mockups (2026-Trend „real lifestyle mockups“). Dazu Masken- und Reveal-Effekte als Hook sowie große, kontrastreiche Typo. CGI/3D und Faux-OOH liegen im Trend und eignen sich für Aufmerksamkeit und Markenaufbau. Für Kaufentscheidungen schneiden echte Kundeninhalte (UGC) auf Meta oft besser ab. Am besten wirkt die Kombination aus hochwertigem Marken-Creative und später echten Kundenfotos. Empfehlung: Mit diesem 3D-Loop starten und nach den ersten Bestellungen Kundenfotos sammeln.

**Entscheidung:** Ein **3D-Render als statisches OG-Bild** plus ein **Motion-Loop aus derselben 3D-Szene** (9:16 / 4:5 / 2:3). Details stehen in `briefing.md`.

## 2. Skills und Werkzeuge (GitHub, lokal installiert)

Die Skills liegen unter `/root/.claude/skills/<name>/`, jeweils mit `QUELLE.txt` (Repo, Commit, Lizenz). Sie wurden nicht ins öffentliche Repo kopiert. Die Skripte wurden vor der Nutzung geprüft: Sie rufen nur lokal ffmpeg auf und laden nichts nach.

| Skill | Quelle | Lizenz | Wofür |
|---|---|---|---|
| `business-motion-film` | github.com/echris6/motion-video-kit | MIT | Storyboard-Regeln, Bewegungsgrammatik aus 28 Launch-Filmen, Qualitätsmaßstab, unabhängige Kritik-Schleife, Skripte für Kontaktbogen und Standbild-Prüfung |
| `threejs-fundamentals`, `-lighting`, `-materials`, `-textures`, `-animation`, `-postprocessing` | github.com/CloudAI-X/threejs-skills | MIT (laut README) | genaue Three.js-API für die 3D-Szene |
| `remotion-best-practices` (inkl. Unterkapitel create/render/captions/…) | github.com/remotion-dev/skills | keine Lizenzdatei → nur lokal nutzen | Alternative Pipeline in React/Remotion. Remotion selbst ist für Einzelpersonen und Firmen bis 3 Mitarbeiter kostenlos |
| `slack-gif-creator` | github.com/anthropics/skills | Apache-2.0 | Easing-Funktionen, GIF-Builder und Prüfungen (optionale kleine GIF-/WebP-Vorschau) |
| `algorithmic-art` | github.com/anthropics/skills | Apache-2.0 | generative Hintergründe mit p5.js (optional) |
| `canvas-design` (war schon als Plugin-Skill vorhanden) | anthropics/skills | Apache-2.0 | Gestaltung statischer Bilder, 81 OFL-Fonts lokal |

Angesehen, aber nicht installiert:
- `iart-ai/webgl-animation-skills` (MIT): Namenskonflikt mit `threejs-animation`, inhaltlich doppelt.
- `freshtechbro/claudedesignskills`: Web-3D und Scroll-Effekte für Websites, kein Video-Export.
- `haidrrrry/claude-remotion-skill`: überschneidet sich mit dem offiziellen Remotion-Skill.

**Lokale Werkzeuge (getestet):**
- Node 22.22 und Playwright 1.56 mit Chromium: **WebGL2 läuft headless über SwiftShader (CPU)**.
- npm erreichbar: `three` 0.186.1, `gsap` 3.15, `@fontsource/space-grotesk` und `@fontsource/inter` 5.3, `remotion`/`@remotion/three` 4.0.532.
- `pip install imageio-ffmpeg` liefert ffmpeg 7.0.2 mit libx264, libvpx-vp9, libwebp(_anim) und gif.
- Pillow 12 ist vorhanden, numpy fehlt (nachinstallieren).
- GitHub-Repos lassen sich per `git clone --depth 1` laden. Die GitHub-API ist für fremde Repos gesperrt.
- Es gibt keine KI-Bild- oder KI-Video-Generatoren mit Zugang. Alle Visuals entstehen aus den echten Produktbildern und Code. Das ist auch rechtlich sauber, weil keine erfundenen Räume oder Kunden gezeigt werden.

**Was Claude Code für Julius in diesem Bereich bauen kann:** statische Grafiken (Pillow/HTML → PNG/JPG), 3D-Szenen mit echten Schatten (Three.js), Videos aus Code (Three.js/GSAP/Remotion → Frames → MP4), GIF/WebP-Animationen, Kontaktbögen und automatische Prüfungen (Größe, Safe-Zones, Loop-Naht), Upload in die Shopify Files sowie die og-Tags im Theme.

## 3. Marke (gelesen aus OFE v3)

Farben `#141215` / `#0B0B0C` / `#F4F1EA` / `#FCFBF7` / `#55575C` / `#CEC8BD`, Akzent `#A32235` (tief `#8B1E2D`, Rosé `#E4A7B6`). Schriften: Space Grotesk 500/600 für Headlines und Wortmarke, Inter für Fließtext. Die Signatur „Frame-Draw“ (rote Linie zeichnet einen Rahmen) wird zum roten Faden des Videos.

## 4. Motive

Gewählt wurden **Jaguar in Blüten, Don't Quit, Yacht auf offener See, Leopard auf Ast, Green Court von oben, Born to Win (Panther)**, Reserve: Haie vor der Küste, Tiger im Pool. Alle sind aktiv, Preis 64,99–108,99 €. Bild-URLs und Raumfotos stehen in `motive.json` und im Briefing.

Ausgeschlossen wurden alle Motive mit Marken, Personen oder Filmen, zusätzlich:
- **Become Unstoppable:** echter Fußballprofi mit Vereins- und Herstellerlogo auf dem Trikot.
- **Sacrifice Today:** Boxfoto, vermutlich eine reale Person.
- **Race Track Loop:** F1-Team-Lackierungen.
- **Matchday von oben:** Stadion-Optik ähnlich Wimbledon.
- **Dressurpferd:** wird parallel geprüft.

## 5. Befunde für Teil 2 (Übergabe, nicht geändert)

`snippets/meta-tags.liquid` im OFE v3 gehört dem Social-Agent:
- `og:image` wird mit `http:` statt `https:` ausgegeben.
- Das Bild kommt in Originalgröße. Gemessen als JPEG (so wie Crawler es abrufen): Yacht 548 KB, Jaguar 316 KB, also zu groß für die WhatsApp-Vorschau. Mit `image_url: width: 1200, height: 630, crop: 'center'` sind es 244 KB bzw. 133 KB.
- `og:image:alt` und `twitter:image` fehlen.
- Für Startseite und Passwortseite gibt es kein Marken-Fallback.

Ein Liquid-Vorschlag steht in `briefing.md` (Abschnitt 8).

## 6. Offene Punkte

1. Teil 2: OG-Bild und Videos nach dem Briefing bauen, prüfen und hochladen sowie `meta-tags.liquid` im OFE v3 anpassen.
2. Julius: Bild zum Teilen in sozialen Medien unter Einstellungen → Onlineshop → Präferenzen hochladen (https://admin.shopify.com/store/gexdm4-2q/online_store/preferences).
3. Julius: Nach dem Launch (Passwort entfernt) die Vorschau mit dem Facebook Sharing Debugger und dem LinkedIn Post Inspector testen.
4. Hinweis Recht/Marken: „Become Unstoppable“ (Profi + Logos) und „Race Track Loop“ (Team-Lackierungen) sind auch im Shop selbst ein Risiko. Siehe die bestehende Liste markenbehafteter Motive.

## Quellen

- OG-Maße/Safe-Zone/Dateigröße: [krumzi.com – OG Image Sizes 2026](https://www.krumzi.com/blog/open-graph-image-sizes-for-social-media-the-complete-2026-guide), [pagethen.com – OG Image Best Practices 2026](https://pagethen.com/blog/og-image-best-practices), [env.dev – Open Graph Guide 2026](https://env.dev/guides/opengraph), [opengraphdebug.com – Requirements](https://opengraphdebug.com/posts/og-image-requirements)
- WhatsApp/iMessage/GIF: [ogrilla.com – WhatsApp Link Preview Guide 2026](https://www.ogrilla.com/blog/whatsapp-link-preview-guide), [ogimagechecker.com – WhatsApp](https://ogimagechecker.com/blog/whatsapp-link-preview/), [Meta – WhatsApp Link Previews](https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews/), [Apple TN2444 – Link Previews in Messages](https://developer.apple.com/library/archive/technotes/tn2444/_index.html), [Apple Forum – GIF in iMessage-Vorschau](https://developer.apple.com/forums/thread/54931)
- X/Twitter Card: [opengraphplus.com – Twitter Card Images](https://opengraphplus.com/consumers/twitter/images), [ogmagic.dev – Twitter Card Guide](https://ogmagic.dev/blog/twitter-card-image-guide)
- Pinterest: [socialrails.com – Pin Size 2026](https://socialrails.com/blog/pinterest-pin-size-dimensions-guide), [xroadstudio.com – Pinterest Specs 2026](https://xroadstudio.com/platform-specs/pinterest)
- Meta Safe-Zones/Formate: [behaviour.digital – Reels Safe Zone 14/35/6](https://behaviour.digital/post/meta-reels-safe-zone-14-top-35-bottom-6-sides-the-2026-official-guide), [superscale.ai – Meta Ad Sizes 2026](https://superscale.ai/learn/meta-ad-sizes), [1clickreport.com – Meta Safe Zones 2026](https://www.1clickreport.com/blog/meta-ads-creative-safe-zones-2026-guide)
- Reels/Hooks: [cropink.com – Reels Ads 2026](https://cropink.com/reels-ads), [metalla.digital – Meta Ad Hooks](https://metalla.digital/meta-ad-hooks-that-drive-conversions-in-2025/), [brandwatch.com – Video Ads Best Practices](https://www.brandwatch.com/blog/facebook-video-ads-best-practices/), [hootsuite – Reels for Business 2026](https://blog.hootsuite.com/instagram-reels/)
- Wandkunst/Mockups/Creative: [merchize.com – Wall Art Trends 2026](https://merchize.com/wall-art-trends/), [billo.app – Meta Ads Best Practices](https://billo.app/blog/meta-ads-best-practices/)
- CTR durch OG-Bilder: [seojuice.com – OG Images & CTR](https://seojuice.com/blog/open-graph-images-boost-your-click-through-rates/), [blogseo.io – CTR Uplift OG Images](https://www.blogseo.io/blog/ctr-uplift-ai-generated-og-images-tests-templates-results)
- 3D/CGI und UGC: [transparenthouse.com – 3D Social Media Ads](https://www.transparenthouse.com/post/3d-social-media-ads-cgi), [welpix.com – CGI in Marketing](https://welpix.com/cgi-in-marketing-and-advertising/), [stackmatix.com – UGC Ads Strategy](https://www.stackmatix.com/blog/ugc-ads-strategy-for-brands), [dialectinc.com – Faux OOH](https://www.dialectinc.com/thoughts/fake-out-of-home)
- Shopify page_image/Social-Bild: [shopify.dev – page_image](https://shopify.dev/docs/api/liquid/objects/page_image), [Shopify Hilfe – Social-Media-Vorschaubilder](https://help.shopify.com/en/manual/online-store/images/showing-social-media-thumbnail-images)
- Skills: [remotion.dev – Agent Skills](https://www.remotion.dev/docs/ai/skills), [github.com/anthropics/skills](https://github.com/anthropics/skills), [github.com/remotion-dev/skills](https://github.com/remotion-dev/skills), [github.com/CloudAI-X/threejs-skills](https://github.com/cloudai-x/threejs-skills), [github.com/echris6/motion-video-kit](https://github.com/echris6/motion-video-kit), [github.com/iart-ai/webgl-animation-skills](https://github.com/iart-ai/webgl-animation-skills), [github.com/freshtechbro/claudedesignskills](https://github.com/freshtechbro/claudedesignskills)


---

# Teil 2: Umsetzung (02.10.2026)

## Ergebnis in Kürze

- **Social-Sharing-Bild** als echtes 3D-Render gebaut (Three.js in Chromium): drei gerahmte Poster an dunkler Wand mit Spotlicht, weichen Schatten, Glasreflex und der roten „Open Frame“-Linie. Dazu die Wortmarke und der Satz „Premium-Poster, fertig gerahmt · Versand in Deutschland inklusive“. Das Bild gibt es in 1200 × 630 und 1200 × 1200.
- **Motion-Loops** aus derselben 3D-Szene: Reel 9:16 (12 s), Feed 4:5 (12 s) und Querformat 1200 × 630 (10 s). Ablauf: Hook „Leere Wand?“, Poster rastet ein, Kamerafahrt durch die Galerie mit Rahmenwechsel Weiß → Schwarz, Rückzug in einen Raum mit Sideboard, Endkarte. Die Loops laufen nahtlos und haben keinen Ton.
- **Shopify Files:** OG-Bild hochgeladen und READY, außerdem die 3 Videos und das quadratische Bild.
- **OFE v3 `snippets/meta-tags.liquid`:** Fallback auf das Marken-Bild eingebaut, `https` statt `http` erzwungen, Bildgröße WhatsApp-tauglich, `og:image:alt` und `twitter:image` ergänzt.

## Dateien (`shop-checkliste/social-2026-10-02/`)

| Datei | Format | Größe | Einsatz |
|---|---|---|---|
| `og-image-1200x630.jpg` | JPEG progressiv, sRGB | 114 KB | Link-Vorschau (WhatsApp, iMessage, Facebook, LinkedIn, X), Shopify „Bild für soziale Medien“ |
| `og-image-1200x1200.jpg` | JPEG progressiv | 196 KB | Quadrat: Instagram-/Facebook-Post, WhatsApp-Status, Google Merchant/Shop-Banner |
| `limitlessposter-reel-1080x1920.mp4` | H.264 High, yuv420p, 30 fps, 12 s, faststart, ohne Ton | 4,9 MB | Instagram/Facebook Reels und Stories, TikTok, YouTube Shorts, Shop-App |
| `limitlessposter-reel-1080x1920-vorschau.jpg` / `-endcard.jpg` | 1080 × 1920 | 171 / 73 KB | Titelbild (Cover) des Reels / Story-Bildanzeige |
| `limitlessposter-feed-1080x1350.mp4` | H.264, 12 s | 4,3 MB | Feed-Anzeige und Feed-Post 4:5 (Instagram, Facebook), Pinterest |
| `limitlessposter-feed-1080x1350-vorschau.jpg` / `-endcard.jpg` | 1080 × 1350 | 161 / 60 KB | Cover / Bildanzeige im Feed |
| `limitlessposter-video-1200x630.mp4` | H.264, 10 s | 1,9 MB | Querformat für LinkedIn, X, Facebook-Linkposts, Website-Banner |
| `limitlessposter-video-1200x630-vorschau.jpg` | 1200 × 630 | 71 KB | Vorschaubild dazu |
| `quelle/` | `scene.html`, `capture.js`, `render_all.sh`, `einrichten.sh`, `sheet.py` | – | Quellcode der 3D-Szene. `einrichten.sh` lädt three.js, Schriften, ffmpeg und die Motive nach. Damit lässt sich jedes Format neu rendern, z. B. mit anderen Motiven oder Texten |

Nicht im Repo (absichtlich): Einzelframes (ca. 1000 PNG), `node_modules`, Texturen.

**Motive:** nur eigene Produkte ohne Marken oder Personen: Jaguar in Blüten, Don't Quit, Yacht auf offener See, Leopard auf Ast, Green Court von oben, Born to Win – Panther. Die Druckfläche des Panthers wurde aus dem Rahmen-Mockup ausgeschnitten, ein flaches Motiv gibt es dafür nicht.
**Texte im Bild (alle belegt):** Leere Wand? · Premium-Poster · Fertig gerahmt. · Rahmen nach Wahl · Schwarz oder Weiß. · In Deutschland · 4–10 Werktage · Versand inklusive. · limitlessposter.com · Jetzt dein Motiv finden. Es gibt keine Preise, keine Sterne, kein „Bestseller“ und keine Rabatte.
**Marke:** Wand #141215 (gemessen nach Tonemapping), Ivory #F4F1EA, Akzent #A32235, Space Grotesk 500/600 und Inter 400/500, Wortmarke mit „POSTER“ als Outline.

## Änderungen im Shop

### Shopify Files (Inhalte → Dateien)

| Datei | ID | Status | CDN-URL |
|---|---|---|---|
| `limitlessposter-og-1200x630.jpg` | gid://shopify/MediaImage/65550516289869 | READY | https://cdn.shopify.com/s/files/1/0976/9979/1181/files/limitlessposter-og-1200x630.jpg?v=1790954916 |
| `limitlessposter-og-1200x1200.jpg` | gid://shopify/MediaImage/65551231254861 | READY | https://cdn.shopify.com/s/files/1/0976/9979/1181/files/limitlessposter-og-1200x1200.jpg?v=1790958822 |
| `limitlessposter-reel-1080x1920.mp4` | gid://shopify/Video/65551231287629 | READY | (Shopify-Video, Stream m3u8 + MP4 bis 1080p) |
| `limitlessposter-feed-1080x1350.mp4` | gid://shopify/Video/65551231320397 | READY | (Shopify-Video) |
| `limitlessposter-video-1200x630.mp4` | gid://shopify/Video/65551231353165 | READY | (Shopify-Video) |

Alt-Text des OG-Bilds: „Drei gerahmte Poster von LimitlessPoster an einer dunklen Wand: Don't Quit, Jaguar in Blüten und Yacht auf offener See. Premium-Poster, fertig gerahmt, Versand in Deutschland inklusive.“
Das CDN liefert das OG-Bild mit 95 KB aus und liegt damit weit unter dem WhatsApp-Limit von ca. 300 KB.
Hinweis: Shopify rechnet Videos für den Shop herunter (Reel z. B. auf 606 × 1080). **Für Instagram, TikTok oder Ads deshalb immer die Originale aus dem Repo-Ordner verwenden.**

### Theme „LimitlessPoster OFE v3“ (unveröffentlicht) – `snippets/meta-tags.liquid`

- Vorher-Stand gesichert: `shop-checkliste/backup-2026-10-02/social/meta-tags.liquid.ofe-v3.vorher` (MD5 155b3355…, identisch mit dem Shop)
- Nachher-Stand: `shop-checkliste/arbeit-2026-10-02/social/meta-tags.liquid.ofe-v3.nachher` (MD5 27371865…). Nach dem Upload erneut gelesen: Prüfsumme und Größe (4680 B) stimmen. Shopify hat die Datei ohne Liquid-Fehler angenommen.

| | Vorher | Nachher |
|---|---|---|
| Protokoll | `og:image` mit `http:` | überall `https:` |
| Startseite, Passwortseite, Seiten, Collections ohne Bild | kein `og:image` | Marken-Bild `images['limitlessposter-og-1200x630.jpg']` |
| Produktseiten | Hauptbild in Originalgröße (Yacht 548 KB) | zuerst ein Produktbild im Querformat (Raumbild, Seitenverhältnis ≥ 1,4), zugeschnitten auf 1200 × 630 (Yacht-Raumbild 79 KB). Gibt es keins, das Hauptbild mit 720 px Breite (Yacht 259 KB, Jaguar 154 KB) |
| Größenangaben | Originalmaße | tatsächliche Ausgabemaße (`og:image:width/height`) |
| Alt-Text / Twitter | fehlte | `og:image:alt`, `twitter:image`, `twitter:image:alt` |

Entscheidungen:
- Ein Bild, das unter Präferenzen hinterlegt ist, hat weiterhin Vorrang, weil Shopify es als `page_image` liefert. Das Fallback greift nur, wenn kein Bild da ist. So bleibt die Einstellung im Admin maßgeblich.
- Auf Produktseiten bleibt es beim Produktbild. Bevorzugt wird aber dessen Raumansicht im Querformat, weil sie als große Vorschau-Kachel erscheint (statt eines kleinen Hochformat-Ausschnitts) und das gerahmte Poster im Raum zeigt.
- Rückbau: Den Inhalt der Vorher-Datei im Code-Editor des OFE v3 einfügen und speichern.

## Einsatz je Plattform

| Plattform | Datei | Hinweise |
|---|---|---|
| WhatsApp, iMessage, Telegram (Link teilen) | `og-image-1200x630.jpg` (automatisch über `og:image`) | Video oder GIF zeigen diese Apps in der Vorschau nicht. Das Wichtigste liegt im mittleren Quadrat, also passt auch der quadratische Ausschnitt von WhatsApp (geprüft) |
| Facebook / LinkedIn / X (Link-Post) | automatisch über `og:image`. Alternativ als nativer Video-Post `limitlessposter-video-1200x630.mp4` | X nutzt `twitter:card = summary_large_image` |
| Instagram/Facebook Reels und Stories | `limitlessposter-reel-1080x1920.mp4` | Text steht nur zwischen y 270 und 1250, also frei von App-Oberfläche und Untertiteln. Cover: `…-vorschau.jpg`. Musik in der App aus der lizenzierten Bibliothek hinzufügen |
| Instagram/Facebook Feed | `limitlessposter-feed-1080x1350.mp4` oder `og-image-1200x1200.jpg` | 4:5 nimmt im Feed die größte Fläche ein |
| TikTok, YouTube Shorts | Reel-Datei | Die rechte Seite bleibt frei, nur Kurztext steht links oben |
| Pinterest | Feed-Video 4:5 oder `og-image-1200x1200.jpg` | Ein eigenes 2:3-Format wurde nicht gerendert (bei Bedarf: `node capture.js pin`; Szene ist vorbereitet, Text-Layout prüfen) |
| Shop-App / Online Store | Videos liegen in Inhalte → Dateien | z. B. als Hintergrundvideo in einer Sektion des OFE v3 nutzbar |

## Hinweise für Anzeigen (Meta Ads)

1. **Platzierungen:** Reels und Stories mit dem 9:16-Video, Feed mit dem 4:5-Video. Bei „Advantage+ Platzierungen“ beide Formate in derselben Anzeige hinterlegen, damit Meta nichts selbst zuschneidet.
2. **Ziel-Link:** besser die Startseite oder eine starke Collection (z. B. Favoriten) als eine einzelne Produktseite. UTM-Parameter verwenden, z. B. `?utm_source=meta&utm_medium=paid&utm_campaign=launch_reel`.
3. **Primärtext (Vorschlag):** „Leere Wand? Unsere Premium-Poster kommen fertig gerahmt – Rahmen in Schwarz oder Weiß, Versand in Deutschland inklusive.“ Überschrift: „Jetzt dein Motiv finden“. Button: „Jetzt shoppen“. Preise nur im Text und nur, wenn sie aktuell stimmen (z. B. „ab 64,99 €“).
4. **Testen:** Reel gegen das statische Bild (`og-image-1200x1200.jpg`) laufen lassen und nach 3–5 Tagen anhand von Kosten pro Klick und Add-to-Cart entscheiden. Die ersten 1–2 Sekunden tragen den Hook; das Video funktioniert auch ohne Ton.
5. **Recht:** Keine Aussagen ergänzen, die nicht belegt sind (z. B. „Bestseller“, Bewertungen, Lieferzeit unter 4 Werktagen). Musik nur aus der Meta-Bibliothek. Das Konto braucht ein vollständiges Impressum auf der Website, das ist vorhanden.
6. **Vor dem Start:** Shop-Passwort entfernen, Zahlungsarten aktivieren und das Meta-Pixel über die App „Facebook & Instagram“ verbinden. Ohne diese Schritte laufen Anzeigen ins Leere.

## Klickanleitung für Julius

1. **Social-Sharing-Bild im Live-Theme (optional, empfohlen, 2 min).** Es greift sofort, auch im aktuellen Live-Theme v2.0:
   https://admin.shopify.com/store/gexdm4-2q/online_store/preferences → Bereich „Bild für soziale Medien“ → „Bild hinzufügen“ → `og-image-1200x630.jpg` (aus dem Repo-Ordner oder vorher unter Inhalte → Dateien herunterladen) → **Speichern**.
2. **OFE v3 vor dem Veröffentlichen prüfen (1 min):** https://admin.shopify.com/store/gexdm4-2q/themes → bei „LimitlessPoster OFE v3“ auf „…“ → **Vorschau** → im Browser Strg+U (Seitenquelltext) → mit Strg+F nach `og:image` suchen. Auf der Startseite muss `limitlessposter-og-1200x630.jpg` erscheinen, auf einer Produktseite ein Bild mit `width=1200&height=630` oder `width=720`. Fehlt es auf der Startseite, ist das kein Fehler, solange unter Punkt 1 ein Bild hinterlegt ist.
3. **Videos und Bilder herunterladen:** https://admin.shopify.com/store/gexdm4-2q/content/files → Datei anklicken → Herunterladen. Für volle Qualität besser die Dateien aus dem Repo-Ordner `shop-checkliste/social-2026-10-02/` nehmen.
4. **Nach dem Launch (Passwort entfernt):** Vorher sehen Plattformen nur die Passwortseite.
   - Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/ → `https://limitlessposter.com` → „Neu scrapen“
   - LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/
   - WhatsApp speichert Vorschauen lange zwischen. Zum Testen `https://limitlessposter.com/?v=2` an dich selbst senden.

## Qualitätsprüfung (gemessen bzw. angesehen)

- OG 1200 × 630: 114 KB (CDN 95 KB). Verkleinert auf 300 × 157 und als mittleres 630er-Quadrat angesehen: Jaguar, Wortmarke und Unterzeile sind vollständig sichtbar und lesbar.
- Videos: 1080 × 1920 / 1080 × 1350 / 1200 × 630, H.264 High, yuv420p, 30 fps, `moov` vor `mdat` (faststart), keine Tonspur.
- Loop-Naht: Der Unterschied zwischen letztem und erstem Frame ist so groß wie zwischen zwei normalen Frames (Reel 0,4–0,7 / 255, nur Filmkorn). Der Übergang ist also unsichtbar.
- Standzeit (`frozen-time.sh` des Skills business-motion-film): Ein Stillstand gibt es nur auf der Endkarte mit CTA (ca. 1 s, so gewollt). Den Hook gibt es jetzt mit Push-in; anfangs war er ca. 1 s fast eingefroren.
- Frame 0 ist ein fertiges Bild („Leere Wand?“ vollständig, Rahmenlinie gezeichnet).
- Kontaktbögen jede 0,5 s geprüft: kein Text über Postern, keine abgeschnittenen Wörter (außer in den gewollten Masken-Übergängen), Text in den Safe-Zones. Im Querformat liegt eine dunkle Abdunklung hinter dem Text, damit er nicht über weiße Rahmen läuft.
- Genutzte Skills: business-motion-film (Qualitätsmaßstab, Bewegungsregeln, Render-Vertrag „jeder Zustand nur aus der Zeit t“, Prüfskripte `contact-sheet.sh` und `frozen-time.sh`) sowie threejs-lighting als Referenz für Schatten und Tonemapping.
- Grenze: Ein unabhängiger zweiter Prüfer (Gauntlet) war in diesem Lauf nicht verfügbar. Die Bewertung beruht auf eigener Sichtprüfung der Standbilder und Kontaktbögen sowie den Messungen.

## Offene Punkte

1. Julius: Bild unter Präferenzen hochladen (Klickanleitung Punkt 1). Bis OFE v3 veröffentlicht ist, ist das der einzige Weg zu einer Link-Vorschau mit Bild. Das Live-Theme v2.0 gibt außerdem weiter `http:` aus.
2. Julius: OFE v3 in der Vorschau prüfen (Punkt 2), ob `images['…']` die Datei auflöst. Wegen des Shop-Passworts ließ sich das von hier aus nicht abrufen, die Passwortseite kommt immer aus dem Live-Theme.
3. Musik für Reels in der App hinzufügen (die Videos haben bewusst keinen Ton).
4. Optional: Pinterest-Version 1000 × 1500 oder weitere Motiv-Varianten aus `quelle/` rendern.
