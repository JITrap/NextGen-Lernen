#!/usr/bin/env python3
"""Crop-Audit aller Produkte: prüft, ob crop_rel wirklich das Artwork trifft.

Zwei automatische Checks pro Produkt (Render @1000px, lokal gecacht):
  1. Outer-Bbox-Konsistenz (nur gerahmte Quellen): äußere Kante der
     Dunkel-Maske (lum < 92, wie Detektor), eingerückt um die empirische
     Leistenbreite 0.035 x lange Seite = erwarteter Artwork-Crop.
     Weicht crop_rel an einer Kante > 3% der langen Seite ab -> verdächtig.
  2. Aspekt-Sanity: Crop-Verhältnis muss ~ einem Postermaß entsprechen
     (0.60-0.85 bzw. Kehrwert; Quadrate gibt es nicht im Sortiment).

Ausgabe: manifest/crop_audit.json + Kontaktbögen shots/audit-sheet-*.jpg
(rote Box = aktueller crop_rel, grüne Box = erwarteter Crop) zur
visuellen Durchsicht jedes einzelnen Produkts.
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from detect_artwork import fetch

ROOT = os.path.join(os.path.dirname(__file__), "..")
MANIFEST = os.path.join(ROOT, "manifest")
RENDERS = os.path.join(ROOT, "art", "renders")
SHOTS = os.path.join(ROOT, "shots")
os.makedirs(RENDERS, exist_ok=True)

BAR_RATIO = 0.035  # Leistenbreite / lange Poster-Seite (empirisch, Median 0.0349)
DARK_T = 92
EDGE_TOL = 0.03    # max. Abweichung pro Kante, relativ zur langen Seite


def get_render(handle, url):
    path = os.path.join(RENDERS, f"{handle}.jpg")
    if not os.path.exists(path):
        img = fetch(url, width=1000)
        img.save(path, quality=90)
    return Image.open(path).convert("RGB")


def outer_bbox(a):
    """Äußere Bbox der Dunkel-Maske (identisch zum Detektor-Kriterium)."""
    lum = a.mean(axis=2)
    dark = lum < DARK_T
    rows = np.where(dark.mean(axis=1) > 0.15)[0]
    cols = np.where(dark.mean(axis=0) > 0.15)[0]
    if len(rows) < 10 or len(cols) < 10:
        return None
    return [int(cols.min()), int(rows.min()), int(cols.max()), int(rows.max())]


def expected_crop(bbox):
    """Erwarteter Artwork-Crop: Außenkante um Leistenbreite eingerückt."""
    x0, y0, x1, y1 = bbox
    bar = BAR_RATIO * max(x1 - x0, y1 - y0)
    return [x0 + bar, y0 + bar, x1 - bar, y1 - bar]


def aspect_ok(aspect):
    a = aspect if aspect >= 1 else 1 / max(aspect, 1e-6)
    return 1 / 0.85 - 0.06 <= a <= 1 / 0.60 + 0.10  # ~1.12 .. ~1.77


def audit_one(handle, entry):
    img = get_render(handle, entry["media_url"])
    W, H = img.size
    a = np.asarray(img, dtype=np.float32)
    cr = entry["crop_rel"]
    crop_px = [cr[0] * W, cr[1] * H, cr[2] * W, cr[3] * H]
    res = {"handle": handle, "framed_source": entry.get("framed_source", False),
           "crop_rel": cr, "flags": []}

    aspect = (cr[2] - cr[0]) / max(1e-6, cr[3] - cr[1]) * (W / H if W != H else 1)
    if not aspect_ok(entry.get("aspect", aspect)):
        res["flags"].append("aspect")

    bbox = outer_bbox(a) if res["framed_source"] else None
    if res["framed_source"]:
        if bbox is None:
            res["flags"].append("no-dark-bbox")
        else:
            exp = expected_crop(bbox)
            long_side = max(bbox[2] - bbox[0], bbox[3] - bbox[1])
            devs = [abs(crop_px[i] - exp[i]) / long_side for i in range(4)]
            res["bbox"] = bbox
            res["expected_rel"] = [round(exp[0] / W, 4), round(exp[1] / H, 4),
                                   round(exp[2] / W, 4), round(exp[3] / H, 4)]
            res["edge_dev"] = [round(d, 4) for d in devs]
            if max(devs) > EDGE_TOL:
                res["flags"].append("bbox-dev")
    res["suspect"] = bool(res["flags"])
    return res, img


def contact_sheets(items, cols=3, rows=7, thumb_w=300):
    """items: Liste (idx, handle, img, crop_rel, expected_rel|None, flags)."""
    try:
        font = ImageFont.truetype(os.path.join(ROOT, "art", "SpaceGrotesk-500.ttf"), 15)
    except Exception:
        font = ImageFont.load_default()
    per = cols * rows
    sheets = []
    cell_h = thumb_w + 26
    for s in range(0, len(items), per):
        chunk = items[s:s + per]
        sheet = Image.new("RGB", (cols * (thumb_w + 8) + 8, rows * (cell_h + 8) + 8), (24, 24, 26))
        d = ImageDraw.Draw(sheet)
        for k, (idx, handle, img, cr, exp, flags) in enumerate(chunk):
            t = img.copy()
            t.thumbnail((thumb_w, thumb_w))
            tw, th = t.size
            td = ImageDraw.Draw(t)
            sx, sy = tw / img.width * img.width / img.width, th / img.height
            # Overlays in Thumb-Koordinaten
            def box(rel, color, wpx=2):
                td.rectangle([rel[0] * tw, rel[1] * th, rel[2] * tw, rel[3] * th],
                             outline=color, width=wpx)
            if exp:
                box(exp, (60, 220, 120), 2)
            box(cr, (255, 60, 60), 2)
            cx = 8 + (k % cols) * (thumb_w + 8)
            cy = 8 + (k // cols) * (cell_h + 8)
            sheet.paste(t, (cx + (thumb_w - tw) // 2, cy))
            label = f"{idx:03d} {handle[:30]}"
            col = (255, 120, 120) if flags else (200, 200, 205)
            d.text((cx + 2, cy + thumb_w + 4), label, fill=col, font=font)
            if flags:
                d.text((cx + 2, cy + thumb_w + 4 + 0), " " * 0, fill=col, font=font)
                d.text((cx + thumb_w - 90, cy + thumb_w + 4), ",".join(flags)[:14],
                       fill=(255, 90, 90), font=font)
        sheets.append(sheet)
    return sheets


def main():
    det = json.load(open(os.path.join(MANIFEST, "detection.json")))
    handles = sorted(h for h, e in det.items() if e.get("art_done"))
    audit, items = {}, []
    for i, h in enumerate(handles, 1):
        e = det[h]
        try:
            res, img = audit_one(h, e)
        except Exception as ex:
            res, img = {"handle": h, "flags": [f"error:{ex}"], "suspect": True}, None
        audit[h] = res
        if img is not None:
            items.append((i, h, img, res["crop_rel"], res.get("expected_rel"), res["flags"]))
        mark = " <-- " + ",".join(res["flags"]) if res.get("suspect") else ""
        print(f"[{i:03d}] {h}{mark}")
    json.dump(audit, open(os.path.join(MANIFEST, "crop_audit.json"), "w"),
              ensure_ascii=False, indent=1)
    sheets = contact_sheets(items)
    for k, sh in enumerate(sheets, 1):
        sh.save(os.path.join(SHOTS, f"audit-sheet-{k}.jpg"), quality=88)
    n = sum(1 for r in audit.values() if r.get("suspect"))
    print(f"\nVerdächtig: {n}/{len(handles)}; {len(sheets)} Kontaktbögen geschrieben")


if __name__ == "__main__":
    main()
