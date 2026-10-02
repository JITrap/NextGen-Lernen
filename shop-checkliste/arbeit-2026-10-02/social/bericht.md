# Bericht Social, Teil 1: Recherche, Skills, Motive

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
