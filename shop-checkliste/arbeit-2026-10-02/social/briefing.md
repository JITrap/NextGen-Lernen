# Design-Briefing: Social-Sharing-Bild + Motion-Loop „Open Frame"

Stand 02.10.2026 · Bereich social, Teil 1 (Recherche). Umsetzung folgt in Teil 2.
Maschinenlesbare Motivliste: `motive.json` (gleicher Ordner). Quellen und Begründungen: `bericht.md`.

## 1. Entscheidung in einem Satz

Wir bauen **eine echte 3D-Szene** (Three.js: gerahmte Poster an dunkler Wand, echtes Licht, echte Schatten) und machen daraus zwei Dinge:

1. **Ein statisches OG-Bild 1200 × 630** (Link-Vorschau in WhatsApp, iMessage, Facebook, X, LinkedIn). Link-Vorschauen zeigen nur Standbilder: Video und GIF werden dort nicht abgespielt, WhatsApp und iMessage ignorieren GIFs sogar ganz.
2. **Motion-Loops aus derselben Szene** für Reels/Stories (9:16), Feed-Anzeigen (4:5) und Pinterest (2:3). Dort zählen Bewegung, ein Hook in 1–2 s und Text-Overlays.

Warum 3D und nicht nur flache Grafik: Laut Recherche überzeugen Poster im Raum mit echtem Licht mehr als freigestellte Studio-Mockups. 3D/CGI liegt im Trend, und ein Schatten zeigt sofort, dass das Poster „fertig gerahmt“ ankommt. Die flachen Shop-Motive bleiben unverändert und werden nur als Textur verwendet.

## 2. Marke (aus OFE v3: config/settings_data.json + assets/limitless-brand.css)

| Rolle | Wert |
|---|---|
| Wand/Hintergrund | `#141215` (Scheme 1), tiefer `#0C0A0B`, Fläche `#1C191B` |
| Carbon (Text dunkel, schwarzer Rahmen) | `#0B0B0C` |
| Ivory (Text hell, weißer Rahmen) | `#F4F1EA`, Paper `#FCFBF7` |
| Graphite / Warm-Line | `#55575C` / `#CEC8BD` |
| Akzent „Royal Noir“ | `#A32235` (Linien, Frame-Draw), tief `#8B1E2D`, Rosé `#E4A7B6` nur winzig |
| Headlines, Wortmarke, Buttons | **Space Grotesk** 500/600, Buttons/Labels in Versalien, Tracking +0.08 em (Labels +0.12 em) |
| Fließtext | **Inter** 400/500 |
| Wortmarke | `LIMITLESS POSTER`, Versalien, Space Grotesk 600, „POSTER“ als Outline (1,5 px Ivory-Kontur) |
| Signatur-Bewegung | **Frame-Draw**: Eine dünne rote Linie zeichnet einen Rahmen (im Theme `lp-fd`, 1 s ease-out) |

Fonts lokal holen: `npm i @fontsource/space-grotesk @fontsource/inter` (OFL, woff2 unter `node_modules/@fontsource/*/files/`).

## 3. Motive (6 eigene, ohne Marken/Personen, alle ACTIVE)

| # | Produkt (Handle) | Rolle | Flaches Motiv (CDN, `?width=2048` anhängen) | Rahmen |
|---|---|---|---|---|
| 1 | Jaguar in Blüten (`jaguar-in-blueten-wildlife-poster`) | Hero, Mitte | https://cdn.shopify.com/s/files/1/0976/9979/1181/files/13049873086004061692_2048_2326bc81-a216-4751-aa17-c8bfd691bb43.jpg | Schwarz |
| 2 | Don't Quit (`dont-quit-motivationsposter`) | Typo-Statement | https://cdn.shopify.com/s/files/1/0976/9979/1181/files/499737700845739371_2048_7572be87-bc31-4de8-967e-7ba6d162e123.jpg | Weiß |
| 3 | Yacht auf offener See (`yacht-auf-offener-see-poster`) | Blau-Kontrast | https://cdn.shopify.com/s/files/1/0976/9979/1181/files/17536018624812122136_2048_a6fb1b3d-05cf-4507-90f0-e82b55963592.jpg | Schwarz |
| 4 | Leopard auf Ast (`leopard-auf-ast-minimal-poster`) | hell/minimal | https://cdn.shopify.com/s/files/1/0976/9979/1181/files/17062383622870176123_2048_32875cc2-e188-4f4c-b6ef-28d180d08122.jpg | Weiß |
| 5 | Green Court von oben (`green-court-von-oben-tennis-poster`) | Sport ohne Marken | https://cdn.shopify.com/s/files/1/0976/9979/1181/files/11579607558239323109_2048_b25f227a-9350-40ee-ad95-d59e78ccfe7e.jpg | Schwarz |
| 6 | Born to Win – Panther (`born-to-win-panther-poster`) | Neuheit, Pink | nur Mockup: https://cdn.shopify.com/s/files/1/0976/9979/1181/files/15917099317578266262_2048.jpg → Druckfläche aus dem schwarzen Rahmen ausschneiden | Schwarz |

Die Motive 1–5 sind 1204 × 1492 px groß. Seitenverhältnis des Bildes beibehalten, nicht verzerren. Raumfotos (`wohnbeispiel`) und Reserve-Motive (Haie, Tiger im Pool) stehen in `motive.json`.
Ausgeschlossen und warum: Become Unstoppable (echter Profi + Logos), Sacrifice Today (Boxfoto), Race Track Loop (F1-Lackierungen), Matchday (Wimbledon-Optik), Dressurpferd (wird gerade geprüft).

## 4. OG-Bild 1200 × 630 (statisch)

**Komposition (zentriert, damit auch der quadratische WhatsApp-Ausschnitt funktioniert):**
- Dunkle Wand `#141215` mit feiner Putzstruktur (2–3 % Rauschen), ein warmer Spot von oben (ca. 2900 K, `#FFD9B0`), Vignette ca. 12 %.
- Drei gerahmte Poster als 3D-Render, Kamera leicht von links (Gieren 6–10°, Brennweite ca. 50 mm, FOV ~30°):
  - Mitte: **Jaguar**, schwarzer Rahmen, Höhe ca. 360 px, Mittelpunkt bei x = 600, y ≈ 280
  - links: **Don't Quit**, weißer Rahmen, ca. 290 px hoch, bei x ≈ 330
  - rechts: **Yacht**, schwarzer Rahmen, ca. 290 px hoch, bei x ≈ 870
  - Weiche Schlagschatten nach rechts unten, der Rahmen steht ca. 2,5 cm von der Wand ab
- Eine Akzentlinie `#A32235` (1,5 px) als offener Rahmen, 14 px versetzt um das mittlere Poster und an einer Ecke offen (Frame-Draw-Zitat)
- Text unten zentriert, Grundlinie bei y ≈ 585:
  - Wortmarke `LIMITLESS POSTER` (Space Grotesk 600, 30–34 px, Tracking 0.06 em, Ivory, POSTER als Outline)
  - darunter, kleiner: `Fertig gerahmt · Versand in Deutschland inklusive` (Inter 500, 17–18 px, Ivory 85 %)
- Text darf höchstens ca. 15 % der Fläche belegen.

**Safe-Zones:** Alles Wichtige liegt im zentralen Bereich 1080 × 600. Der Kern (mittleres Poster und Wortmarke) liegt im quadratischen Ausschnitt 630 × 630 (x 285–915). X schneidet für 2:1 oben und unten je ca. 15 px ab.

**Datei:** `limitlessposter-og-1200x630.jpg`, sRGB, progressives JPEG, Qualität ca. 82, **Ziel ≤ 250 KB** (WhatsApp lässt das Bild über ca. 300 KB weg; manche Quellen nennen 600 KB, wir bleiben sicher darunter). Zusätzlich einen PNG-Master aufbewahren.
Alt-Text: „Drei gerahmte Poster von LimitlessPoster an einer dunklen Wand: Jaguar in Blüten, Don't Quit, Yacht auf offener See“.

## 5. Motion-Loop „Open Frame“ (9:16 Master)

1080 × 1920, 30 fps, **12,0 s = 360 Frames**, nahtloser Loop (letzter Frame = erster Frame), ohne Ton exportiert.
Text-Safe-Zone bei Meta Reels/Stories: oben 270 px, unten 670 px, seitlich je 65 px freilassen, also Text nur in y 270–1250.

| Zeit | Bild | Text (Overlay, deutsch) | Bewegung |
|---|---|---|---|
| 0,0–1,4 s | **Hook.** Leere dunkle Wand im Spotlicht, eine rote Linie hat bereits einen leeren Rahmen gezeichnet. Frame 0 ist ein fertiges Bild, kein halb eingeblendetes Wort. | **Leere Wand?** | Push-in 3 %, Linie „atmet“ leicht |
| 1,4–3,0 s | Der Jaguar im schwarzen Rahmen schiebt sich in den roten Umriss und landet bei 2,2 s an der Wand: Der Schatten zieht sich von weich auf kurz zusammen, die rote Linie läuft einmal herum und erlischt. | **Fertig gerahmt.** | Ease-out mit kleinem Überschwinger, Kamera leicht gegenläufig |
| 3,0–6,6 s | Kamerafahrt seitlich entlang einer Galeriewand: Don't Quit (weiß) → Yacht (schwarz) → Leopard (weiß) → Green Court (schwarz) → Panther (schwarz). Jedes Poster ist ca. 0,6 s lesbar, danach geht es schnell weiter. Die rote Linie ist der durchgehende „Akteur“ und springt von Rahmen zu Rahmen. Bei einem Poster wechselt der Rahmen per Lichtsweep sichtbar von Schwarz zu Weiß. | **Schwarz oder Weiß.** | Tempowechsel statt gleichmäßigem Gleiten: lesbar → schneller Abgang → weiche Landung |
| 6,6–9,0 s | Die Kamera fährt zurück und aus der Wand wird ein Raum: 3er-Galerie (Jaguar, Don't Quit, Yacht) über einem schlichten Sideboard mit warmem Licht. Alternativ 2,5D-Parallax im Raumfoto von Don't Quit (Raum im Querformat). | **Versand in Deutschland inklusive.** | Pull-back mit langer, weicher Landung |
| 9,0–12,0 s | **End-Card.** Die Wand dunkelt ab, die rote Linie zeichnet ein Rechteck um die Wortmarke. Darunter `limitlessposter.com` und `Jetzt dein Motiv finden`. In den letzten 0,5 s zoomt die Kamera in die rote Rahmenecke, sodass das Bild wieder Frame 0 entspricht. | Wortmarke · URL · CTA | 3 % Push, Loop-Naht |

Drei Signatur-Momente: (1) Die rote Linie wird zum Rahmen, in den das Poster einrastet. (2) Ein Rahmen wechselt per Lichtsweep von Schwarz zu Weiß. (3) Aus der Wand wird beim Rückzug ein Raum.

**Typo im Video:** Headline Space Grotesk 600, 92–104 px, höchstens 4 Wörter und 2 Zeilen, Ivory auf dunklem Grund. Micro-Labels Space Grotesk 500, 28 px, Versalien, +0.12 em. Text fährt gegen die Kamerabewegung herein und verlässt das Bild vor dem nächsten Wechsel. Die gesamte Botschaft steht im Text, damit sie auch ohne Ton funktioniert.

**Ableitungen aus derselben Szene (gleiche Zeitlogik, Kamera neu kadriert):**

| Format | Größe | Länge | Text-Ränder | Datei |
|---|---|---|---|---|
| Reels/Stories/Shop-Video | 1080 × 1920 | 12 s | oben 14 %, unten 35 %, Seiten 6 % | `limitlessposter-reel-1080x1920.mp4` |
| Feed-Anzeige IG/FB | 1080 × 1350 (4:5) | 10 s (Hook 0–1,2 · Rahmen –2,8 · Galerie –5,8 · Raum –7,8 · End –10) | je 6 %, unten 10 % | `limitlessposter-feed-1080x1350.mp4` |
| Pinterest | 1000 × 1500 (2:3) | 10 s | Text in der oberen Hälfte, unten 10 % frei | `limitlessposter-pin-1000x1500.mp4` |
| Standbilder für Bildanzeigen | 1080 × 1350 und 1080 × 1920 | – | wie oben | `…-still-*.jpg` (Frame bei 2,6 s und 10,5 s) |

**Video-Encoding:** H.264 High, yuv420p, CRF 18, `-preset slow`, `-movflags +faststart`. Ziel ca. 6–15 MB für 12 s. Das Video wird ohne Ton geliefert. Musik fügt Julius in der Instagram-/Meta-App aus der lizenzierten Bibliothek hinzu (keine fremde Musik ins Video einbauen).

## 6. Werkzeug-Pipeline (lokal getestet)

Vorhanden bzw. geprüft: Node 22, Playwright 1.56 + Chromium mit **WebGL2 (SwiftShader, CPU)**. Laut Test funktioniert WebGL2 headless. `three` 0.186, `gsap` 3.15 und `@fontsource/*` sind per npm installierbar. `pip install imageio-ffmpeg` liefert ffmpeg 7 mit libx264, libvpx-vp9, libwebp_anim und gif. Pillow 12 ist vorhanden, numpy fehlt (`pip install numpy`). Globale Server: `http-server` und `serve`.

```bash
W=<scratchpad>/social-build; mkdir -p $W && cd $W
npm init -y >/dev/null && npm i three@0.186 @fontsource/space-grotesk @fontsource/inter
pip install -q imageio-ffmpeg numpy
mkdir -p bin && ln -sf "$(python3 -c 'import imageio_ffmpeg as i;print(i.get_ffmpeg_exe())')" bin/ffmpeg && export PATH=$W/bin:$PATH
# 1) Assets: motive.json lesen, ?width=2048 laden, Panther-Druckfläche ausschneiden (Pillow: dunkle Rahmen-BBox finden, nach innen bis zur ersten hellen Kante)
# 2) scene.html: Three.js per importmap (./node_modules/three/build/three.module.js), HTML/CSS-Layer für Text darüber
#    window.renderFrame(t, format) setzt ALLE Zustände nur aus t (kein requestAnimationFrame, kein Date.now, Zufall nur mit Seed)
# 3) http-server -p 5173 -s . &   (Playwright braucht http, damit Texturen geladen werden)
# 4) NODE_PATH=/opt/node22/lib/node_modules node capture.js --format reel|feed|pin|og
#    Viewport = Zielgröße, deviceScaleFactor 1, pro Frame: await page.evaluate(t => renderFrame(t)), page.screenshot → frames/<format>/%04d.png
# 5) ffmpeg -y -framerate 30 -i frames/reel/%04d.png -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -movflags +faststart out/limitlessposter-reel-1080x1920.mp4
# 6) OG: frames/og/0000.png → Pillow JPEG q=82 progressive optimize; Qualität senken bis ≤ 250 KB
```

**3D-Details:**
- `renderer.outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping`, Belichtung ca. 1,0
- Schatten: `PCFSoftShadowMap` mit 2048er Map. Licht: SpotLight warm mit Schatten plus schwache HemisphereLight
- Rahmen aus 4 Box-Leisten, ca. 2 cm breit und 2,5 cm tief. Schwarz: `#0B0B0C`, Rauheit 0,6. Weiß: `#F4F1EA`, Rauheit 0,5
- Druck als Plane mit `MeshStandardMaterial` (Textur sRGB, anisotropy 8, Rauheit 0,85 für matten Look). Glas weglassen oder höchstens 4 % Reflex-Gradient
- Wand: Plane mit prozeduraler Putz-Normal-Map
- Post-Processing nur minimal: Vignette und 2 % Korn, kein Bloom
- SwiftShader rendert auf der CPU, das dauert ca. 0,5–2 s pro Frame in 1080 × 1920. Bei 360 Frames sind das ca. 3–12 min. Erst Testframes bei 0 / 2,2 / 4,5 / 8 / 11 s ansehen, dann alles rendern.

**Skills zum Lesen vor dem Bauen** (lokal installiert):
- `/root/.claude/skills/business-motion-film/` – Storyboard-Regeln, Qualitätsmaßstab und Kritik-Schleife; `scripts/contact-sheet.sh` und `scripts/frozen-time.sh` brauchen `ffmpeg` im PATH
- `/root/.claude/skills/threejs-fundamentals|lighting|materials|textures|animation|postprocessing/` – Three.js-API
- `/root/.claude/skills/remotion-best-practices/` – Alternative, falls die Pipeline in React/Remotion gebaut werden soll (`@remotion/three` 4.0.532). Den Browser über `browserExecutable: /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell` angeben, weil der eigene Download vermutlich blockiert ist
- `/root/.claude/skills/slack-gif-creator/` – Easing-Funktionen und GIF-Builder (für optionale kleine GIF- oder WebP-Vorschau)
- `/root/.claude/skills/algorithmic-art/` – für generative Hintergründe (nur bei Bedarf)
- Plugin-Skill `anthropic-skills:canvas-design` – Gestaltungsprinzipien für statische Bilder. Die Fonts liegen unter `/root/.claude/skills/synced/*/canvas-design/canvas-fonts/` (Space Grotesk ist nicht dabei, deshalb @fontsource)

## 7. Qualitätsprüfung vor Abgabe

- [ ] OG-Bild: 1200 × 630, JPEG sRGB, ≤ 250 KB. Verkleinert auf 300 × 157 und als Quadrat 630 × 630 aus der Mitte noch lesbar (selbst ansehen)
- [ ] Videos: richtige Auflösung, 30 fps, H.264 yuv420p, faststart, ≤ 15 MB. Frame 0 ist ein fertiges Bild. Die Loop-Naht ist unsichtbar (Differenz zwischen erstem und letztem Frame minimal)
- [ ] Safe-Zone-Overlay über Kontaktbögen gelegt: kein Text in gesperrten Zonen
- [ ] Kein Abschnitt ist länger als ca. 0,6 s eingefroren (`frozen-time.sh`). Kontaktbogen pro Sekunde erstellt
- [ ] Unabhängige Prüfung: Ein frischer Prüfer bekommt nur das Render, dieses Briefing und `business-motion-film/references/critic-prompts.md`. Die wichtigsten Punkte beheben, 2–3 Runden
- [ ] Wahrheit: kein „Bestseller“ (0 Bestellungen), keine Sterne/Bewertungen, keine Rabatte, keine Preise im Bild (Preise können sich ändern; „ab 64,99 €“ höchstens in der Caption). Nur belegte Aussagen: fertig gerahmt · Rahmen Schwarz oder Weiß · Versand in Deutschland inklusive · 4–10 Werktage
- [ ] Nur die 6 Motive oben, keine Marken, Logos oder realen Personen

## 8. Einbindung in Shopify (Teil 2 und Julius)

**Social-Agent Teil 2 (besitzt `snippets/meta-tags.liquid` im OFE v3 und Datei-Uploads):**
1. Vorher-Stand von `snippets/meta-tags.liquid` (OFE v3) nach `shop-checkliste/backup-2026-10-02/social/` sichern.
2. OG-JPG per `stagedUploadsCreate` + `fileCreate` als `limitlessposter-og-1200x630.jpg` mit Alt-Text hochladen. Die MP4s und Standbilder ebenfalls in die Files hochladen, damit Julius sie dort herunterladen kann; große MP4s nicht ins öffentliche Repo legen.
3. Befunde im aktuellen `meta-tags.liquid`:
   - `og:image` wird mit `http:` ausgegeben; es sollte https sein.
   - Das Bild kommt in Originalgröße. Beim Yacht-Motiv sind das 548 KB, beim Jaguar 316 KB, also zu groß für WhatsApp. Gemessen mit `?width=1200&height=630&crop=center`: Yacht 244 KB, Jaguar 133 KB.
   - `og:image:alt` und `twitter:image` fehlen.
   - Für Startseite, Passwortseite und Seiten ohne Bild gibt es kein Marken-Fallback.

   Vorschlag (vor dem Einsatz mit `images[...]` in der Vorschau testen):
   ```liquid
   {%- liquid
     assign og_img = page_image
     if request.page_type == 'product'
       for m in product.media
         if m.media_type == 'image' and m.preview_image.aspect_ratio >= 1.4
           assign og_img = m.preview_image
           break
         endif
       endfor
     endif
     if og_img == blank or request.page_type == 'index' or request.page_type == 'password'
       assign og_brand = images['limitlessposter-og-1200x630.jpg']
       if og_brand != blank
         assign og_img = og_brand
       endif
     endif
   -%}
   {%- if og_img -%}
     {%- assign og_img_url = og_img | image_url: width: 1200, height: 630, crop: 'center' -%}
     <meta property="og:image" content="https:{{ og_img_url }}">
     <meta property="og:image:secure_url" content="https:{{ og_img_url }}">
     <meta property="og:image:width" content="1200">
     <meta property="og:image:height" content="630">
     <meta property="og:image:alt" content="{{ og_img.alt | default: og_title | escape }}">
     <meta name="twitter:image" content="https:{{ og_img_url }}">
   {%- endif -%}
   ```
   Bei Produkten wird damit zuerst das Raumfoto im Querformat genommen (ein gerahmtes Poster im Raum wirkt als Vorschau stärker als ein Ausschnitt des Motivs), sonst das Hauptbild. Beide werden auf 1200 × 630 zugeschnitten, und die Dateigröße bleibt unter dem WhatsApp-Limit.

**Julius (Klick, ca. 2 min):**
1. https://admin.shopify.com/store/gexdm4-2q/online_store/preferences → Bereich für das Bild zum Teilen in sozialen Medien („Social sharing image“) → `limitlessposter-og-1200x630.jpg` hochladen → Speichern. Das ist das Fallback für das aktuelle Live-Theme v2.0 und für alle Seiten ohne eigenes Bild.
2. Nach dem Entfernen des Shop-Passworts testen. Solange das Passwort aktiv ist, sehen die Plattformen nur die Passwortseite.
   - Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/ („Neu scrapen“)
   - LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/
   - WhatsApp speichert Vorschauen tagelang zwischen. Zum Testen `https://limitlessposter.com/?v=2` senden.
3. Das Reel als Anzeige nutzen: in Meta Ads Manager Platzierung Reels/Stories, die 4:5-Version für den Feed. Musik in der App aus der lizenzierten Bibliothek hinzufügen.
