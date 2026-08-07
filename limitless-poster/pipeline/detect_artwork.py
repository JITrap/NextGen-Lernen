#!/usr/bin/env python3
"""Artwork-Erkennung für alle 99 Produkte.

Alle Produktbilder sind 2048x2048 gepaddete Quadrate (Print-on-Demand).
Strategie pro Bild (@800px analysiert):
  1. Flat-Render-Check: 4 Ecken-Patches uniform + hell -> Kandidat (kein Raum-Mockup)
  2. Content-BBox gegen Hintergrundfarbe -> echtes Seitenverhältnis
  3. Rahmen-Ring-Check: dunkler Ring am BBox-Rand -> gerahmter Render -> Crop 5.5% einrücken
Wahl: ungerahmter Print > gerahmter Render > Fallback Bild 1 (mit Einrückung).
"""
import io
import json
import os
import subprocess

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..")
MANIFEST = os.path.join(ROOT, "manifest")
ART = os.path.join(ROOT, "art", "products")
os.makedirs(ART, exist_ok=True)

CA = "/root/.ccr/ca-bundle.crt"


def fetch(url, width=None):
    u = url + (("&" if "?" in url else "?") + f"width={width}" if width else "")
    raw = subprocess.run(["curl", "-sS", "--cacert", CA, u], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(raw)).convert("RGB")


def corner_stats(a):
    h, w, _ = a.shape
    p = 24
    patches = [a[:p, :p], a[:p, -p:], a[-p:, :p], a[-p:, -p:]]
    stds = [float(x.reshape(-1, 3).std(axis=0).mean()) for x in patches]
    means = [x.reshape(-1, 3).mean(axis=0) for x in patches]
    spread = float(max(np.abs(m - means[0]).max() for m in means))
    brightness = float(np.mean([m.mean() for m in means]))
    return max(stds), spread, brightness, means[0]


def dark_rect(a):
    """Findet das dominante dunkle Rechteck (den Rahmen).

    Zeilen/Spalten zählen nur, wenn ein nennenswerter Anteil dunkel ist —
    dünne Aufhängeschnüre (<1% Breite) fallen damit heraus.
    """
    lum = a.mean(axis=2)
    dark = lum < 92
    h, w = dark.shape
    rows = np.where(dark.mean(axis=1) > 0.15)[0]
    cols = np.where(dark.mean(axis=0) > 0.15)[0]
    # Auch dünne Rahmen zulassen: wenige, aber weit auseinanderliegende Zeilen/Spalten
    if len(rows) < 10 or len(cols) < 10:
        return None
    y0, y1, x0, x1 = int(rows.min()), int(rows.max()), int(cols.min()), int(cols.max())
    if (x1 - x0) < 150 or (y1 - y0) < 150:
        return None
    # Ist der Rand dieses Rechtecks wirklich dunkel? (sonst: dunkles Artwork ohne Rahmen)
    t = max(3, int((x1 - x0) * 0.015))
    ring = np.concatenate([
        dark[y0:y0 + t, x0:x1].reshape(-1), dark[max(y0, y1 - t):y1, x0:x1].reshape(-1),
        dark[y0:y1, x0:x0 + t].reshape(-1), dark[y0:y1, max(x0, x1 - t):x1].reshape(-1),
    ])
    if float(ring.mean()) < 0.6:
        return None
    # Rahmendicke pro Seite messen: von außen nach innen, solange die Linie dunkel ist
    def thickness(scan):
        n = 0
        for frac in scan:
            if frac > 0.5:
                n += 1
            else:
                break
        return n
    max_t = int((x1 - x0) * 0.14)
    tl = min(max_t, thickness(dark[y0:y1, x0:x1].mean(axis=0)))
    tr = min(max_t, thickness(dark[y0:y1, x0:x1].mean(axis=0)[::-1]))
    tt = min(max_t, thickness(dark[y0:y1, x0:x1].mean(axis=1)))
    tb = min(max_t, thickness(dark[y0:y1, x0:x1].mean(axis=1)[::-1]))
    pad = max(2, int((x1 - x0) * 0.008))  # kleine Sicherheitszugabe gegen Kantenbluten
    ax0, ay0 = x0 + tl + pad, y0 + tt + pad
    ax1, ay1 = x1 - tr - pad, y1 - tb - pad
    if ax1 - ax0 < 100 or ay1 - ay0 < 100:
        return None
    return [ax0, ay0, ax1, ay1]


def analyze(img):
    a = np.asarray(img.filter(ImageFilter.BoxBlur(1)), dtype=np.float32)
    max_std, spread, brightness, bg = corner_stats(a)
    flat = max_std < 7 and spread < 10 and brightness > 185
    frame_art = dark_rect(a)
    if frame_art:
        return {"flat": flat, "bbox": frame_art, "framed": True}
    diff = np.abs(a - bg).max(axis=2)
    mask = diff > 14
    ys, xs = np.where(mask)
    if len(xs) < 500:
        return {"flat": flat, "bbox": None, "framed": False}
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    if (x1 - x0) < 80 or (y1 - y0) < 80:
        return {"flat": flat, "bbox": None, "framed": False}
    return {"flat": flat, "bbox": [x0, y0, x1, y1], "framed": False}


def choose(product):
    """Wählt das beste Medium + Crop; Rückgabe (media, crop_rel, orientation)."""
    results = []
    for m in product["media"]["nodes"]:
        if m["mediaContentType"] != "IMAGE" or not m.get("image"):
            continue
        try:
            img = fetch(m["image"]["url"], width=800)
        except Exception as e:
            print("  fetch failed:", e)
            continue
        r = analyze(img)
        r["media"] = m
        r["size"] = img.size
        results.append(r)
    # Priorität: Schwarz-Rahmen-Render (zuverlässig innen croppbar) > ungerahmter Flat > Rest
    framed_hits = [r for r in results if r["framed"] and r["bbox"]]
    flats = [r for r in results if r["flat"] and r["bbox"] and not r["framed"]]
    pick_from = framed_hits or flats or [r for r in results if r["bbox"]]
    if not pick_from:
        return None
    # größte Content-Fläche gewinnt
    r = max(pick_from, key=lambda x: (x["bbox"][2] - x["bbox"][0]) * (x["bbox"][3] - x["bbox"][1]))
    x0, y0, x1, y1 = r["bbox"]
    W, H = r["size"]
    crop_rel = [x0 / W, y0 / H, x1 / W, y1 / H]
    aspect = (x1 - x0) / max(1e-6, (y1 - y0))
    return {
        "media_id": r["media"]["id"],
        "media_url": r["media"]["image"]["url"],
        "crop_rel": crop_rel,
        "aspect": round(aspect, 4),
        "orientation": "landscape" if aspect > 1.15 else ("square" if aspect > 0.87 else "portrait"),
        "framed_source": bool(r.get("framed")),
    }


def extract(entry, handle):
    """Lädt das gewählte Bild in 2048 und speichert den Artwork-Crop."""
    img = fetch(entry["media_url"], width=2048)
    W, H = img.size
    x0, y0, x1, y1 = [c * (W if i % 2 == 0 else H) for i, c in enumerate(entry["crop_rel"])]
    art = img.crop((int(x0), int(y0), int(x1), int(y1)))
    path = os.path.join(ART, f"{handle}.jpg")
    art.save(path, quality=92)
    return path, art.size


def main(limit=None, only=None):
    products = json.load(open(os.path.join(MANIFEST, "products_all.json")))
    det_path = os.path.join(MANIFEST, "detection.json")
    det = json.load(open(det_path)) if os.path.exists(det_path) else {}
    count = 0
    for p in products:
        h = p["handle"]
        if only and h not in only:
            continue
        if h in det and det[h].get("art_done"):
            continue
        if limit and count >= limit:
            break
        count += 1
        print(f"[{count}] {h}")
        entry = choose(p)
        if not entry:
            det[h] = {"error": "no artwork found", "gid": p["id"], "title": p["title"]}
            continue
        path, size = extract(entry, h)
        entry.update({"gid": p["id"], "title": p["title"], "art_path": path,
                      "art_size": list(size), "art_done": True})
        det[h] = entry
        json.dump(det, open(det_path, "w"), ensure_ascii=False, indent=1)
    json.dump(det, open(det_path, "w"), ensure_ascii=False, indent=1)
    done = sum(1 for v in det.values() if v.get("art_done"))
    print(f"done: {done}/{len(products)}")


if __name__ == "__main__":
    import sys
    args = sys.argv[1:]
    if args and args[0].isdigit():
        main(limit=int(args[0]))
    elif args:
        main(only=args)
    else:
        main()
