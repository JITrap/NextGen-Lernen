#!/bin/bash
# Baut die Arbeitsumgebung fuer scene.html neu auf (Texturen, three.js, Schriften, ffmpeg).
# Aufruf: bash einrichten.sh  (im Ordner quelle/), danach:
#   http-server -p 5173 -s -c-1 . &
#   node capture.js og        -> test/og.png      (Standbild 1200x630)
#   node capture.js ogsq      -> test/ogsq.png    (Standbild 1200x1200)
#   ./render_all.sh           -> frames/reel|feed|ogvid/*.png, danach mit ffmpeg zu MP4
set -e
cd "$(dirname "$0")"
npm init -y >/dev/null 2>&1 || true
npm i three@0.186 @fontsource/space-grotesk @fontsource/inter
pip install -q imageio-ffmpeg
mkdir -p bin tex && ln -sf "$(python3 -c 'import imageio_ffmpeg as i;print(i.get_ffmpeg_exe())')" bin/ffmpeg
B=https://cdn.shopify.com/s/files/1/0976/9979/1181/files
curl -sS -o tex/jaguar.jpg   "$B/13049873086004061692_2048_2326bc81-a216-4751-aa17-c8bfd691bb43.jpg?width=2048"
curl -sS -o tex/dontquit.jpg "$B/499737700845739371_2048_7572be87-bc31-4de8-967e-7ba6d162e123.jpg?width=2048"
curl -sS -o tex/yacht.jpg    "$B/17536018624812122136_2048_a6fb1b3d-05cf-4507-90f0-e82b55963592.jpg?width=2048"
curl -sS -o tex/leopard.jpg  "$B/17062383622870176123_2048_32875cc2-e188-4f4c-b6ef-28d180d08122.jpg?width=2048"
curl -sS -o tex/court.jpg    "$B/11579607558239323109_2048_b25f227a-9350-40ee-ad95-d59e78ccfe7e.jpg?width=2048"
curl -sS -o tex/panther_mock.jpg "$B/15917099317578266262_2048.jpg?width=2048"
# Panther: nur Rahmen-Mockup vorhanden -> Druckflaeche (pinker Bereich) ausschneiden
python3 -c "from PIL import Image; Image.open('tex/panther_mock.jpg').convert('RGB').crop((470,302,1585,1744)).save('tex/panther.jpg',quality=95)"
# Video kodieren (Beispiel Reel):
# bin/ffmpeg -y -framerate 30 -i frames/reel/%04d.png -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level 4.2 -movflags +faststart -an limitlessposter-reel-1080x1920.mp4
