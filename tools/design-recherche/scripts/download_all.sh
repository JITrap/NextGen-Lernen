#!/bin/bash
set -e
cd /home/user/NextGen-Lernen/tools/design-recherche
mkdir -p downloads

declare -A SLUG=(
[1]="classic-car-front" [2]="classic-car-side" [3]="vintage-car-headlight" [4]="vintage-steering-wheel"
[5]="vintage-motorcycle" [6]="race-car-cockpit" [7]="turner-fighting-temeraire" [8]="church-twilight-wilderness"
[9]="coastal-cliff-sunset" [10]="ocean-sunset" [11]="palm-trees-sunset" [12]="golden-mountain-landscape"
[13]="monet-villas-bordighera" [14]="monet-grand-canal-venice" [15]="positano-sunset" [16]="santorini-blue-domes"
[17]="heda-still-life-oysters" [18]="manet-the-brioche" [19]="espresso-pour" [20]="wine-glass-closeup"
[21]="friedrich-wanderer-fog" [22]="friedrich-woman-window" [23]="woman-backview-ocean-sunset" [24]="silhouette-surfer-sunset"
[25]="stubbs-whistlejacket-horse" [26]="white-horse-iceland" [27]="leopard-resting-tree" [28]="whippet-painting-baker"
)

URLS=$(python3 -c "
import json
d = json.load(open('scripts/resolved_urls.json'))
for nr in sorted(d, key=int):
    print(nr, d[nr]['url'])
")

echo "$URLS" | while read -r nr url; do
  slug="${SLUG[$nr]}"
  nrpad=$(printf '%02d' "$nr")
  ext="${url##*.}"
  ext="${ext,,}"
  if [[ "$ext" != "jpg" && "$ext" != "jpeg" && "$ext" != "png" ]]; then
    ext="jpg"
  fi
  outfile="downloads/${nrpad}-${slug}.${ext}"
  echo "Downloading [$nrpad] $slug from $url"
  curl -sS -L -o "$outfile" -w "  -> HTTP %{http_code}, %{size_download} bytes\n" --max-time 60 \
    -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" \
    "$url"
  sleep 0.5
done
echo "ALL DOWNLOADS COMPLETE"
