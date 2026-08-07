#!/usr/bin/env python3
"""Klassifiziert Produktmedien: Rückseiten-Fotos (Kraftpapier-Ecken mit
Sägezahn-Aufhängern) vs. behalten (Render, Raum-Mockups, eigene Mockups).

Hart ausgeschlossen vom Löschen: Varianten-featured-Media, Produkt-featured,
unsere Wohnbeispiel-/Studio-Mockups, das Detection-Quellbild.
"""
import concurrent.futures
import io
import json
import os
import subprocess

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
MANIFEST = os.path.join(ROOT, "manifest")
CA = "/root/.ccr/ca-bundle.crt"


def fetch(url, width=256, tries=4):
    import time
    sep = "&" if "?" in url else "?"
    for attempt in range(tries):
        try:
            raw = subprocess.run(["curl", "-sS", "--cacert", CA, f"{url}{sep}width={width}"],
                                 capture_output=True, check=True).stdout
            return Image.open(io.BytesIO(raw)).convert("RGB")
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(2 ** attempt)


def stats(img):
    a = np.asarray(img.resize((128, 128)), dtype=np.float32) / 255.0
    hsv = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).convert("HSV"),
                     dtype=np.float32)
    h, s, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
    kraft = ((h > 12) & (h < 48) & (s > 0.12) & (s < 0.6) & (v > 0.35) & (v < 0.92))
    dark = (v < 0.25)
    return {
        "kraft": float(kraft.mean()),
        "dark": float(dark.mean()),
        "sat_mean": float(s.mean()),
        "v_mean": float(v.mean()),
    }


def is_back(st):
    return st["kraft"] > 0.42 and st["dark"] < 0.25


def main():
    census = json.load(open(os.path.join(MANIFEST, "media_census.json")))
    det = json.load(open(os.path.join(MANIFEST, "detection.json")))
    det_urls = {e["media_url"].split("?")[0] for e in det.values() if e.get("media_url")}
    out_path = os.path.join(MANIFEST, "back_class.json")
    out = json.load(open(out_path)) if os.path.exists(out_path) else {}

    jobs = []
    for pid, p in census.items():
        protected = set(p["variant_featured"])
        if p.get("featured"):
            protected.add(p["featured"])
        entry = out.setdefault(pid, {"handle": p["handle"], "media": {}})
        for m in p["media"]:
            mid = m["id"]
            if mid in entry["media"]:
                continue
            url = m["url"] or ""
            if mid in protected:
                entry["media"][mid] = {"verdict": "keep", "why": "variant/featured", "url": url}
            elif "Wohnbeispiel" in m["alt"] or "Studio" in m["alt"] or "-room" in url:
                entry["media"][mid] = {"verdict": "keep", "why": "our-mockup", "url": url}
            elif url.split("?")[0] in det_urls:
                entry["media"][mid] = {"verdict": "keep", "why": "detection-source", "url": url}
            else:
                jobs.append((pid, mid, url))

    print(f"{len(jobs)} Bilder zu klassifizieren")

    def work(job):
        pid, mid, url = job
        st = stats(fetch(url))
        return pid, mid, url, st

    n = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        for pid, mid, url, st in ex.map(work, jobs):
            out[pid]["media"][mid] = {
                "verdict": "delete" if is_back(st) else "keep",
                "why": "back-photo" if is_back(st) else "front/room",
                "url": url, "stats": {k: round(v, 3) for k, v in st.items()},
            }
            n += 1
            if n % 200 == 0:
                print(f"{n}...", flush=True)
                json.dump(out, open(out_path, "w"), ensure_ascii=False)
    json.dump(out, open(out_path, "w"), ensure_ascii=False)
    dele = sum(1 for p in out.values() for m in p["media"].values() if m["verdict"] == "delete")
    keep = sum(1 for p in out.values() for m in p["media"].values() if m["verdict"] == "keep")
    print(f"fertig: {dele} löschen, {keep} behalten")


if __name__ == "__main__":
    main()
