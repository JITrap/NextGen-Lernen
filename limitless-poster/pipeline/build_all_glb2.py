#!/usr/bin/env python3
"""Baut alle GLB-v2-Modelle: 99 Produkte x Schwarz/Weiß."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from glb_writer_v2 import write_glb_v2  # noqa: E402

from PIL import Image  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
MANIFEST = os.path.join(ROOT, "manifest", "detection.json")
OUT = os.path.join(ROOT, "glb2")
os.makedirs(OUT, exist_ok=True)

det = json.load(open(MANIFEST))
state_path = os.path.join(ROOT, "manifest", "glb2.json")
state = json.load(open(state_path)) if os.path.exists(state_path) else {}
n = 0
for handle, e in det.items():
    if state.get(handle, {}).get("done"):
        continue
    img = Image.open(e["art_path"])
    entry = {"gid": e["gid"], "title": e["title"], "files": {}}
    for color in ("black", "white"):
        out = os.path.join(OUT, f"{handle}-{color}.glb")
        write_glb_v2(out, img, e["aspect"], e["title"], color)
        entry["files"][color] = {"path": out, "bytes": os.path.getsize(out)}
    entry["done"] = True
    state[handle] = entry
    n += 1
    if n % 10 == 0:
        json.dump(state, open(state_path, "w"), ensure_ascii=False, indent=1)
        print(f"{n} Produkte...", flush=True)
json.dump(state, open(state_path, "w"), ensure_ascii=False, indent=1)
total = sum(f["bytes"] for s in state.values() for f in s["files"].values())
print(f"fertig: {len(state)} Produkte, {total/1e6:.0f} MB")
