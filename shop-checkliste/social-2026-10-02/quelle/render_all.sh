#!/bin/bash
cd "$(dirname "$0")"
export NODE_PATH=/opt/node22/lib/node_modules
for f in reel feed ogvid; do node capture.js $f --workers 2 > render_$f.log 2>&1; echo "finished $f $(ls frames/$f | wc -l)"; done
echo ALLDONE
