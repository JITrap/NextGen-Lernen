#!/usr/bin/env python3
"""Korrigiert die Artwork-Crops der im Audit geflaggten Produkte.

Regel: crop_rel = äußere Bbox der Dunkel-Maske, eingerückt um die
Leistenbreite 0.035 x lange Seite — aber NUR, wenn das Randband innen an
der Bbox rundum gleichmäßig dunkel ist (= schwarze Rahmenleiste).
Sonst (weißer Rahmen, Dunkel-Bbox = Artwork selbst, z. B.
its-you-vs-you) wird die Bbox mit minimaler Sicherheitszugabe direkt
übernommen.

Aktualisiert detection.json (crop_rel/aspect/orientation/art_size),
extrahiert die Art-Crops neu und schreibt Verifikations-Kontaktbögen
shots/fixcheck-sheet-*.jpg (Render mit neuem Crop + extrahierter Crop
nebeneinander) für die visuelle Abnahme jedes Fixes.
"""
import json
import os
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import detect_artwork
from audit_crops import outer_bbox, BAR_RATIO

ROOT = os.path.join(os.path.dirname(__file__), "..")
MANIFEST = os.path.join(ROOT, "manifest")
RENDERS = os.path.join(ROOT, "art", "renders")
SHOTS = os.path.join(ROOT, "shots")

DARK_T = 92
SAFE_RATIO = 0.007  # Zugabe ohne schwarze Leiste (Kantenbluten/Rahmenlippe)


def band_uniform_dark(a, bbox, bar):
    """True, wenn das Band [Kante, Kante+bar] innen rundum dunkel ist."""
    lum = a.mean(axis=2)
    dark = lum < DARK_T
    x0, y0, x1, y1 = bbox
    b = max(3, int(round(bar)))
    segs = []
    n = 24
    xs = np.linspace(x0, x1, n + 1).astype(int)
    ys = np.linspace(y0, y1, n + 1).astype(int)
    for i in range(n):
        segs.append(dark[y0:y0 + b, xs[i]:xs[i + 1]].mean())          # oben
        segs.append(dark[y1 - b:y1, xs[i]:xs[i + 1]].mean())          # unten
        segs.append(dark[ys[i]:ys[i + 1], x0:x0 + b].mean())          # links
        segs.append(dark[ys[i]:ys[i + 1], x1 - b:x1].mean())          # rechts
    bright = sum(1 for s in segs if s < 0.85)
    return bright <= 2, bright


def fix_one(handle, entry):
    img = Image.open(os.path.join(RENDERS, f"{handle}.jpg")).convert("RGB")
    W, H = img.size
    a = np.asarray(img, dtype=np.float32)
    bbox = outer_bbox(a)
    if bbox is None:
        return None
    x0, y0, x1, y1 = bbox
    long_side = max(x1 - x0, y1 - y0)
    bar = BAR_RATIO * long_side
    framed, bright = band_uniform_dark(a, bbox, bar)
    inset = bar if framed else SAFE_RATIO * long_side
    nx0, ny0, nx1, ny1 = x0 + inset, y0 + inset, x1 - inset, y1 - inset
    crop_rel = [round(nx0 / W, 5), round(ny0 / H, 5),
                round(nx1 / W, 5), round(ny1 / H, 5)]
    aspect = (nx1 - nx0) / max(1e-6, ny1 - ny0)
    a_norm = aspect if aspect >= 1 else 1 / aspect
    return {"crop_rel": crop_rel, "aspect": round(aspect, 4),
            "orientation": "landscape" if aspect > 1.15 else ("square" if aspect > 0.87 else "portrait"),
            "inset_mode": "bar" if framed else "safe", "bright_segs": bright,
            "aspect_sane": 1.10 <= a_norm <= 1.85}


def extract_retry(entry, handle, tries=3):
    for t in range(tries):
        try:
            return detect_artwork.extract(entry, handle)
        except Exception as e:
            if t == tries - 1:
                raise
            print(f"  extract retry {t + 1}: {e}")
            time.sleep(2 ** (t + 1))


def verify_sheets(rows, cols=3, thumb=300):
    try:
        font = ImageFont.truetype(os.path.join(ROOT, "art", "SpaceGrotesk-500.ttf"), 15)
    except Exception:
        font = ImageFont.load_default()
    per = cols * 6
    cell_w, cell_h = thumb * 2 + 12, thumb + 26
    for s in range(0, len(rows), per):
        chunk = rows[s:s + per]
        sheet = Image.new("RGB", (cols * (cell_w + 8) + 8, 6 * (cell_h + 8) + 8), (24, 24, 26))
        d = ImageDraw.Draw(sheet)
        for k, (idx, handle, res) in enumerate(chunk):
            render = Image.open(os.path.join(RENDERS, f"{handle}.jpg")).convert("RGB")
            W, H = render.size
            rd = ImageDraw.Draw(render)
            cr = res["crop_rel"]
            rd.rectangle([cr[0] * W, cr[1] * H, cr[2] * W, cr[3] * H],
                         outline=(255, 60, 60), width=4)
            render.thumbnail((thumb, thumb))
            art = Image.open(os.path.join(ROOT, "art", "products", f"{handle}.jpg")).convert("RGB")
            art.thumbnail((thumb, thumb))
            cx = 8 + (k % cols) * (cell_w + 8)
            cy = 8 + (k // cols) * (cell_h + 8)
            sheet.paste(render, (cx, cy + (thumb - render.height) // 2))
            sheet.paste(art, (cx + thumb + 12, cy + (thumb - art.height) // 2))
            note = f"{idx:03d} {handle[:40]}  [{res['inset_mode']}]"
            col = (200, 200, 205) if res["aspect_sane"] else (255, 90, 90)
            d.text((cx + 2, cy + thumb + 4), note, fill=col, font=font)
        sheet.save(os.path.join(SHOTS, f"fixcheck-sheet-{s // per + 1}.jpg"), quality=88)
    return (len(rows) + per - 1) // per


def main():
    det = json.load(open(os.path.join(MANIFEST, "detection.json")))
    aud = json.load(open(os.path.join(MANIFEST, "crop_audit.json")))
    targets = sorted(h for h, r in aud.items() if r.get("suspect"))
    print(f"Zu fixen: {len(targets)}")
    fixed, rows = {}, []
    for i, h in enumerate(targets, 1):
        e = det[h]
        res = fix_one(h, e)
        if res is None:
            print(f"[{i:03d}] {h} — KEINE BBOX, übersprungen")
            continue
        old = {"crop_rel": e["crop_rel"], "aspect": e.get("aspect")}
        e.update({"crop_rel": res["crop_rel"], "aspect": res["aspect"],
                  "orientation": res["orientation"]})
        path, size = extract_retry(e, h)
        e["art_path"], e["art_size"] = path, list(size)
        fixed[h] = {"old": old, "new": res}
        rows.append((i, h, res))
        flag = "" if res["aspect_sane"] else "  !! ASPEKT"
        print(f"[{i:03d}] {h} {res['inset_mode']} a={res['aspect']}{flag}")
        json.dump(det, open(os.path.join(MANIFEST, "detection.json"), "w"),
                  ensure_ascii=False, indent=1)
        json.dump(fixed, open(os.path.join(MANIFEST, "crop_fixed.json"), "w"),
                  ensure_ascii=False, indent=1)
    n = verify_sheets(rows)
    insane = [h for h, f in fixed.items() if not f["new"]["aspect_sane"]]
    print(f"\nGefixt: {len(fixed)}, Kontaktbögen: {n}, Aspekt-Warnungen: {insane}")


if __name__ == "__main__":
    main()
