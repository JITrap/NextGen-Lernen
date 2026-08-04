#!/usr/bin/env python3
"""Berechnet pro Produkt die Detail-Zoom-Daten (Displate-Style Plus-Marker).

Quelle: manifest/detection.json (Schwarz-Rahmen-Render + Artwork-BBox crop_rel).
Die Render sind standardisiert (gleicher Anbieter): Rahmenleiste ≈ 3,5 % der
langen Posterseite — empirisch über 260 saubere Messungen ermittelt (Median
0.0349, enge Verteilung). Kein Download nötig, reine Geometrie.

Ergebnis: manifest/detail_spots.json → Metafield custom.poster_detail:
  img     Render-URL (CDN)
  region  Bildausschnitt [x0,y0,x1,y1] für die Galerie-Kachel (Rahmen + Luft)
  spots   rahmen/glas/design als [x,y] relativ zum GESAMTEN Bild
"""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
MANIFEST = os.path.join(ROOT, "manifest")

BAR_RATIO = 0.035  # Rahmenleiste relativ zur langen Posterseite
PAD_RATIO = 0.10   # Luft um den Rahmen in der Kachel


def compute(entry):
    x0, y0, x1, y1 = entry["crop_rel"]
    aw, ah = x1 - x0, y1 - y0
    t = BAR_RATIO * max(aw, ah)  # Bild ist quadratisch → x/y-Einheiten gleich
    fx0, fy0, fx1, fy1 = x0 - t, y0 - t, x1 + t, y1 + t
    pad = PAD_RATIO * max(fx1 - fx0, fy1 - fy0)
    region = [max(0.0, fx0 - pad), max(0.0, fy0 - pad),
              min(1.0, fx1 + pad), min(1.0, fy1 + pad)]
    spots = {
        # Ecke oben links auf der Rahmen-Innenkante — sitzt bei jeder
        # Rahmendicke sichtbar auf der Grenze Rahmen/Artwork
        "rahmen": [x0, y0],
        "glas": [x0 + 0.76 * aw, y0 + 0.16 * ah],
        "design": [x0 + 0.50 * aw, y0 + 0.55 * ah],
    }
    r4 = lambda v: round(v, 4)
    return {
        "gid": entry["gid"],
        "img": entry["media_url"],
        "region": [r4(v) for v in region],
        "spots": {k: [r4(v[0]), r4(v[1])] for k, v in spots.items()},
    }


def main():
    det = json.load(open(os.path.join(MANIFEST, "detection.json")))
    out = {h: compute(e) for h, e in det.items()}
    out_path = os.path.join(MANIFEST, "detail_spots.json")
    json.dump(out, open(out_path, "w"), ensure_ascii=False, indent=1)
    print(f"fertig: {len(out)} Einträge → {out_path}")


if __name__ == "__main__":
    main()
