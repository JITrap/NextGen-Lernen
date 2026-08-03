#!/usr/bin/env python3
"""Baut pro Produkt ein GLB: gerahmtes Poster (schwarzer Holzrahmen, Artwork-Textur).

Reale Maße in Metern (+Y oben, Front +Z, zentriert) — wichtig für Shopifys
AR-Ansicht ("View in your space"). Lange Seite = 0.61 m (24-Zoll-Poster).
"""
import json
import os

import numpy as np
import trimesh
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
MANIFEST = os.path.join(ROOT, "manifest")
GLB = os.path.join(ROOT, "glb")
os.makedirs(GLB, exist_ok=True)

LONG_SIDE = 0.6096      # 24 Zoll
BAR_FACE = 0.020        # Rahmenprofil: 20 mm Ansichtsbreite
BAR_DEPTH = 0.022       # 22 mm Tiefe
POSTER_RECESS = 0.0045  # Posterfläche 4.5 mm hinter der Rahmenfront
FRAME_COLOR = [0.055, 0.055, 0.06, 1.0]   # #0E0E0F — nicht ganz schwarz
BACK_COLOR = [0.95, 0.94, 0.91, 1.0]


def frame_material():
    return trimesh.visual.material.PBRMaterial(
        name="frame", baseColorFactor=FRAME_COLOR, roughnessFactor=0.5, metallicFactor=0.0)


def bar(w, h, d):
    return trimesh.creation.box(extents=[w, h, d])


def textured_quad(w, h, z, img):
    vertices = np.array([[-w / 2, -h / 2, z], [w / 2, -h / 2, z], [w / 2, h / 2, z], [-w / 2, h / 2, z]])
    faces = np.array([[0, 1, 2], [0, 2, 3]])
    uv = np.array([[0, 0], [1, 0], [1, 1], [0, 1]])
    mat = trimesh.visual.material.PBRMaterial(
        name="poster", baseColorTexture=img, roughnessFactor=0.85, metallicFactor=0.0)
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    mesh.visual = trimesh.visual.TextureVisuals(uv=uv, material=mat)
    return mesh


def color_quad(w, h, z, color, flip=False):
    vertices = np.array([[-w / 2, -h / 2, z], [w / 2, -h / 2, z], [w / 2, h / 2, z], [-w / 2, h / 2, z]])
    faces = np.array([[0, 2, 1], [0, 3, 2]]) if flip else np.array([[0, 1, 2], [0, 2, 3]])
    mat = trimesh.visual.material.PBRMaterial(
        name="back", baseColorFactor=color, roughnessFactor=0.9, metallicFactor=0.0)
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    mesh.visual = trimesh.visual.TextureVisuals(
        uv=np.array([[0, 0], [1, 0], [1, 1], [0, 1]]), material=mat)
    return mesh


def build(handle, art_path, aspect):
    if aspect >= 1.0:
        W, H = LONG_SIDE, LONG_SIDE / aspect
    else:
        W, H = LONG_SIDE * aspect, LONG_SIDE
    img = Image.open(art_path).convert("RGB")
    # Shopify verlangt Power-of-Two-Texturen; das Seitenverhältnis steckt in der
    # Geometrie, daher ist nicht-uniformes Skalieren der Textur verzerrungsfrei.
    if aspect > 1.15:
        tex_size = (2048, 1024)
    elif aspect < 0.87:
        tex_size = (1024, 2048)
    else:
        tex_size = (1024, 1024)
    img = img.resize(tex_size, Image.LANCZOS)

    scene = trimesh.Scene()
    fm = frame_material()
    half_d = BAR_DEPTH / 2
    # Rahmen: 4 Leisten, stumpf gestoßen (oben/unten volle Breite)
    top = bar(W, BAR_FACE, BAR_DEPTH)
    top.apply_translation([0, H / 2 - BAR_FACE / 2, 0])
    bottom = bar(W, BAR_FACE, BAR_DEPTH)
    bottom.apply_translation([0, -H / 2 + BAR_FACE / 2, 0])
    left = bar(BAR_FACE, H - 2 * BAR_FACE, BAR_DEPTH)
    left.apply_translation([-W / 2 + BAR_FACE / 2, 0, 0])
    right = bar(BAR_FACE, H - 2 * BAR_FACE, BAR_DEPTH)
    right.apply_translation([W / 2 - BAR_FACE / 2, 0, 0])
    for m in (top, bottom, left, right):
        m.visual = trimesh.visual.TextureVisuals(
            uv=np.zeros((len(m.vertices), 2)), material=fm)
        scene.add_geometry(m)
    # Poster (leicht zurückversetzt) + Rückplatte
    pw, ph = W - 2 * BAR_FACE + 0.004, H - 2 * BAR_FACE + 0.004
    scene.add_geometry(textured_quad(pw, ph, half_d - POSTER_RECESS, img))
    scene.add_geometry(color_quad(W - 0.004, H - 0.004, -half_d + 0.001, BACK_COLOR, flip=True))
    out = os.path.join(GLB, f"{handle}.glb")
    scene.export(out, include_normals=True)
    return out


def main(only=None):
    det = json.load(open(os.path.join(MANIFEST, "detection.json")))
    n = 0
    for handle, e in det.items():
        if only and handle not in only:
            continue
        if not e.get("art_done") or e.get("glb_done"):
            continue
        out = build(handle, e["art_path"], e["aspect"])
        # Validierung: neu laden, Bounding-Box prüfen
        re = trimesh.load(out)
        ext = re.bounding_box.extents
        assert 0.3 < max(ext) < 0.7, f"{handle}: unerwartete Größe {ext}"
        e["glb_done"] = True
        e["glb_path"] = out
        e["glb_bytes"] = os.path.getsize(out)
        n += 1
        if n % 10 == 0:
            json.dump(det, open(os.path.join(MANIFEST, "detection.json"), "w"), ensure_ascii=False, indent=1)
            print(f"{n} GLBs...")
    json.dump(det, open(os.path.join(MANIFEST, "detection.json"), "w"), ensure_ascii=False, indent=1)
    print(f"fertig: {n} GLBs gebaut")


if __name__ == "__main__":
    import sys
    main(sys.argv[1:] or None)
