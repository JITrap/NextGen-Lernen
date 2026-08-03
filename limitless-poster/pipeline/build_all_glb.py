#!/usr/bin/env python3
"""Baut alle GLBs mit dem eigenen Writer (Single-Mesh-Atlas, JPEG)."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from glb_writer import write_glb  # noqa: E402

from PIL import Image  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
MANIFEST = os.path.join(ROOT, "manifest", "detection.json")
GLB = os.path.join(ROOT, "glb")

det = json.load(open(MANIFEST))
n = 0
for handle, e in det.items():
    if not e.get("art_done"):
        continue
    out = os.path.join(GLB, f"{handle}.glb")
    write_glb(out, Image.open(e["art_path"]), e["aspect"], e["title"])
    e["glb_done"] = True
    e["glb_path"] = out
    e["glb_bytes"] = os.path.getsize(out)
    n += 1
    if n % 20 == 0:
        print(f"{n} GLBs...")
        json.dump(det, open(MANIFEST, "w"), ensure_ascii=False, indent=1)
json.dump(det, open(MANIFEST, "w"), ensure_ascii=False, indent=1)
print(f"fertig: {n}")
