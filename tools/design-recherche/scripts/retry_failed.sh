#!/bin/bash
cd /home/user/NextGen-Lernen/tools/design-recherche

for f in downloads/*; do
  sz=$(stat -c%s "$f")
  if [ "$sz" -lt 10000 ]; then
    nrpad=$(basename "$f" | cut -d- -f1)
    nr=$((10#$nrpad))
    url=$(python3 -c "
import json
d = json.load(open('scripts/resolved_urls.json'))
print(d[str($nr)]['url'])
")
    echo "Retrying [$nrpad] $f from $url"
    for attempt in 1 2 3 4; do
      curl -sS -L -o "$f" -w "  attempt $attempt -> HTTP %{http_code}, %{size_download} bytes\n" --max-time 60 \
        -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" \
        "$url"
      newsz=$(stat -c%s "$f")
      if [ "$newsz" -gt 10000 ]; then
        break
      fi
      sleep 8
    done
    sleep 3
  fi
done
echo "RETRY PASS COMPLETE"
