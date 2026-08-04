#!/usr/bin/env python3
"""GLB-Writer v2: gerahmtes Poster in hoher Qualität.

Gegenüber v1:
- Rahmen mit 45°-Gehrung (Ring-Bänder statt 4 Boxen) + Fase an der Frontkante
- prozedurale Holzmaserung (längs zur Leiste; Gehrungsnaht wechselt die Richtung
  wie bei echten Rahmen), Schwarz oder Weiß
- Plexiglas-Scheibe (alphaMode BLEND, spiegelnde Reflexe beim Drehen)
- Artwork als eigene Textur in nativer Crop-Auflösung (UV-Subrect, kein Verzerren)
- Rückseite: Kraftpapier mit gedrucktem Label (Space Grotesk), Schrauben,
  Filzgleitern und Sägezahn-Aufhänger (echte Geometrie)

Reale Meter, +Y oben, Front +Z, zentriert.
"""
import io
import json
import math
import os
import struct

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ART_DIR = os.path.join(os.path.dirname(__file__), "..", "art")

LONG_SIDE = 0.6096   # 24" Poster, lange Außenseite
BAR = 0.020          # Rahmenprofil Ansichtsbreite
HD = 0.011           # halbe Profiltiefe (22 mm)
CH = 0.0025          # Fase Frontkante
GLASS_Z = HD - 0.002
ART_Z = HD - 0.0045
BACK_Z = -HD + 0.0015

COLORS = {
    "black": {"base": (16, 16, 18), "hi": (30, 30, 34), "lo": (8, 8, 10)},
    "white": {"base": (246, 244, 239), "hi": (253, 252, 249), "lo": (228, 224, 214)},
}
KRAFT = (199, 185, 162)
ATLAS = 2048
WOOD_H = 500                     # Holzstreifen: Zeilen 0..WOOD_H
WOOD_V = (8 / ATLAS, (WOOD_H - 8) / ATLAS)
# Metall-Patch rechts UNTER dem Holzstreifen; Rückseite bleibt links davon
METAL_RECT = (1930, 560, 2040, 700)
BACK_TOP = WOOD_H + 20
BACK_MAX_W = 1900


def font(weight, size):
    return ImageFont.truetype(os.path.join(ART_DIR, f"SpaceGrotesk-{weight}.ttf"), size)


def tracked_text(draw, xy, text, f, fill, tracking, anchor="mm"):
    """Zeichnet Text mit Letter-Spacing, zentriert um xy (nur anchor mm)."""
    widths = [draw.textlength(c, font=f) for c in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = xy[0] - total / 2
    for c, w in zip(text, widths):
        draw.text((x, xy[1]), c, font=f, fill=fill, anchor="lm")
        x += w + tracking


# ---------------------------------------------------------------- Texturen

def wood_strip(color, w=ATLAS, h=WOOD_H, seed=7):
    """Holzmaserung, Faser horizontal."""
    rng = np.random.default_rng(seed)
    c = COLORS[color]
    base = np.array(c["base"], dtype=np.float32)
    hi = np.array(c["hi"], dtype=np.float32)
    lo = np.array(c["lo"], dtype=np.float32)
    y = np.linspace(0, 1, h)[:, None]
    x = np.linspace(0, 1, w)[None, :]
    grain = np.zeros((h, w), dtype=np.float32)
    for freq, amp in [(6, 0.45), (13, 0.3), (29, 0.18)]:
        phase = rng.uniform(0, 2 * math.pi)
        wobble = np.sin(x * 2 * math.pi * rng.uniform(0.6, 1.8) + phase) * 0.35
        grain += amp * np.sin((y * freq + wobble) * 2 * math.pi + phase)
    fine = rng.normal(0, 1, (h, w // 16)).astype(np.float32)
    fine = np.asarray(Image.fromarray((fine * 40 + 128).clip(0, 255).astype(np.uint8))
                      .resize((w, h), Image.BILINEAR), dtype=np.float32)
    grain += (fine - 128) / 128 * 0.35
    t = np.clip(grain * 0.5 + 0.5, 0, 1)[..., None]
    img = lo + (hi - lo) * t
    mix = 0.75 if color == "white" else 0.6
    img = base * (1 - mix) + img * mix
    return img.clip(0, 255).astype(np.uint8)


def back_canvas(title, aspect, w_px):
    """Kraftpapier-Rückseite mit Label, Schrauben, Filzgleitern (Pixel-Seitenverhältnis = Poster)."""
    h_px = int(round(w_px / aspect))
    rng = np.random.default_rng(11)
    base = np.full((h_px, w_px, 3), KRAFT, dtype=np.float32)
    noise = rng.normal(0, 4.5, (h_px // 3, w_px // 3, 1)).astype(np.float32)
    noise = np.asarray(Image.fromarray((noise[..., 0] + 128).clip(0, 255).astype(np.uint8))
                       .resize((w_px, h_px), Image.BILINEAR), dtype=np.float32)[..., None] - 128
    streaks = rng.normal(0, 2.5, (h_px, w_px // 40, 1)).astype(np.float32)
    streaks = np.asarray(Image.fromarray((streaks[..., 0] + 128).clip(0, 255).astype(np.uint8))
                         .resize((w_px, h_px), Image.BILINEAR), dtype=np.float32)[..., None] - 128
    img = Image.fromarray((base + noise + streaks).clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    s = w_px / 1000  # Skalierungsfaktor

    # Umlaufende dunklere Kante (Einfassband)
    band = int(26 * s)
    dark = (172, 158, 136)
    for i in range(band):
        f = 1 - i / band
        col = tuple(int(KRAFT[j] + (dark[j] - KRAFT[j]) * f) for j in range(3))
        d.rectangle([i, i, w_px - 1 - i, h_px - 1 - i], outline=col)

    # Schrauben in den Ecken
    for cx, cy in [(int(64 * s), int(64 * s)), (w_px - int(64 * s), int(64 * s)),
                   (int(64 * s), h_px - int(64 * s)), (w_px - int(64 * s), h_px - int(64 * s))]:
        r = int(15 * s)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(94, 92, 88), outline=(60, 58, 55), width=2)
        d.line([cx - r * 0.55, cy, cx + r * 0.55, cy], fill=(50, 48, 46), width=max(2, int(3 * s)))

    # Filzgleiter unten
    for cx in [int(150 * s), w_px - int(150 * s)]:
        r = int(22 * s)
        cy = h_px - int(120 * s)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(52, 52, 54), outline=(38, 38, 40), width=2)

    # Aufhänge-Zone: dezente Druckmarkierung oben mittig
    zx, zy = w_px // 2, int(95 * s)
    d.line([zx - int(90 * s), zy, zx + int(90 * s), zy], fill=(150, 138, 118), width=max(2, int(2 * s)))

    # Label
    lw = int(w_px * 0.64)
    lh = int(lw * 0.62)
    lx0 = (w_px - lw) // 2
    ly0 = int(h_px * 0.56) - lh // 2
    d.rectangle([lx0, ly0, lx0 + lw, ly0 + lh], fill=(252, 251, 247), outline=(11, 11, 12),
                width=max(2, int(3 * s)))
    cx = w_px // 2
    f_brand = font(700, int(52 * s * lw / 640))
    f_title = font(500, int(34 * s * lw / 640))
    f_small = font(500, int(26 * s * lw / 640))
    y = ly0 + int(lh * 0.2)
    tracked_text(d, (cx, y), "LIMITLESSPOSTER", f_brand, (11, 11, 12), int(6 * s))
    d.rectangle([cx - int(26 * s), y + int(lh * 0.13), cx + int(26 * s), y + int(lh * 0.13) + max(2, int(4 * s))],
                fill=(49, 87, 255))
    ty = y + int(lh * 0.30)
    t = title if len(title) <= 34 else title[:33].rstrip() + "…"
    d.text((cx, ty), t, font=f_title, fill=(11, 11, 12), anchor="mm")
    d.line([lx0 + int(lw * 0.12), ty + int(lh * 0.16), lx0 + lw - int(lw * 0.12), ty + int(lh * 0.16)],
           fill=(85, 87, 92), width=max(1, int(2 * s)))
    tracked_text(d, (cx, ty + int(lh * 0.32)), "HOLZRAHMEN · PLEXIGLAS · ARCHIVPAPIER",
                 f_small, (58, 60, 64), int(2 * s))
    return img


def build_atlas_b(title, aspect, color):
    """Material-Atlas: Holzstreifen + Metall-Patch + Rückseite. Liefert (jpeg, uv-Infos)."""
    atlas = Image.fromarray(np.vstack([
        wood_strip(color),
        np.full((ATLAS - WOOD_H, ATLAS, 3), KRAFT, dtype=np.uint8),
    ]))
    d = ImageDraw.Draw(atlas)
    # Metall-Patch (gebürstet)
    mx0, my0, mx1, my1 = METAL_RECT
    rng = np.random.default_rng(3)
    streak = rng.normal(0, 7, (my1 - my0, 24)).astype(np.float32)
    streak = np.asarray(Image.fromarray((streak + 128).clip(0, 255).astype(np.uint8))
                        .resize((mx1 - mx0, my1 - my0), Image.BILINEAR), dtype=np.float32)
    metal = (np.array([185, 188, 192], dtype=np.float32) + (streak[..., None] - 128) * 0.25)
    atlas.paste(Image.fromarray(metal.clip(0, 255).astype(np.uint8)), (mx0, my0))
    d = ImageDraw.Draw(atlas)
    # Sägezahn-Silhouette auf dem Patch
    teeth_y = (my0 + my1) // 2 + 24
    for tx in range(mx0 + 24, mx1 - 24, 18):
        d.polygon([(tx, teeth_y), (tx + 9, teeth_y - 16), (tx + 18, teeth_y)], fill=(120, 122, 126))

    # Rückseite einpassen (rechts Platz für den Metall-Patch lassen)
    avail_w, avail_h = BACK_MAX_W, ATLAS - BACK_TOP - 8
    bw = avail_w
    bh = int(round(bw / aspect))
    if bh > avail_h:
        bh = avail_h
        bw = int(round(bh * aspect))
    back = back_canvas(title, aspect, 1000).resize((bw, bh), Image.LANCZOS)
    bx, by = 4, BACK_TOP
    atlas.paste(back, (bx, by))

    buf = io.BytesIO()
    atlas.save(buf, format="JPEG", quality=82)
    uv = {
        "wood_v": WOOD_V,
        "metal": (((mx0 + mx1) / 2) / ATLAS, ((my0 + my1) / 2) / ATLAS),
        "back": (bx / ATLAS, by / ATLAS, (bx + bw) / ATLAS, (by + bh) / ATLAS),
    }
    return buf.getvalue(), uv


def build_artwork_tex(art_img):
    """Artwork in nativer Auflösung, POT-gepaddet (Kanten repliziert), UV-Subrect."""
    img = art_img.convert("RGB")
    w, h = img.size
    scale = min(1.0, 2048 / max(w, h))
    if scale < 1.0:
        w, h = int(w * scale), int(h * scale)
        img = img.resize((w, h), Image.LANCZOS)
    pw = 1 << (w - 1).bit_length()
    ph = 1 << (h - 1).bit_length()
    a = np.asarray(img)
    a = np.pad(a, ((0, ph - h), (0, pw - w), (0, 0)), mode="edge")
    buf = io.BytesIO()
    Image.fromarray(a).save(buf, format="JPEG", quality=92)
    return buf.getvalue(), (w / pw, h / ph)


# ---------------------------------------------------------------- Geometrie

class Part:
    def __init__(self):
        self.pos, self.nrm, self.uv, self.idx = [], [], [], []

    def quad(self, corners, normal, uvs):
        c = [np.asarray(p, dtype=np.float64) for p in corners]
        n = np.cross(c[1] - c[0], c[2] - c[0])
        if np.dot(n, np.asarray(normal)) < 0:
            corners = corners[::-1]
            uvs = uvs[::-1]
        base = len(self.pos)
        self.pos += list(corners)
        self.nrm += [tuple(normal)] * 4
        self.uv += list(uvs)
        self.idx += [base, base + 1, base + 2, base, base + 2, base + 3]


def norm3(v):
    l = math.sqrt(sum(x * x for x in v))
    return (v[0] / l, v[1] / l, v[2] / l)


def build_frame(part, W, H, wood_v):
    """Gehrungsrahmen aus Ring-Bändern; UVs: Maserung längs der Leiste."""
    profile = [(BAR, HD), (CH, HD), (0.0, HD - CH), (0.0, -HD), (BAR, -HD), (BAR, HD)]
    kinds = ["front", "chamfer", "outer", "back", "inner"]
    # Bogenlängen für die Quer-UV (v)
    arcs = [0.0]
    for (u1, z1), (u2, z2) in zip(profile[:-1], profile[1:]):
        arcs.append(arcs[-1] + math.hypot(u2 - u1, z2 - z1))
    total = arcs[-1]
    v0, v1 = wood_v
    L = max(W, H)

    def ring(u):
        return {"xl": -W / 2 + u, "xr": W / 2 - u, "yb": -H / 2 + u, "yt": H / 2 - u}

    sides = {
        "top": {"o": (0, 1, 0)}, "bottom": {"o": (0, -1, 0)},
        "left": {"o": (-1, 0, 0)}, "right": {"o": (1, 0, 0)},
    }
    for bi, ((u1, z1), (u2, z2)) in enumerate(zip(profile[:-1], profile[1:])):
        kind = kinds[bi]
        t1 = v0 + (v1 - v0) * (arcs[bi] / total)
        t2 = v0 + (v1 - v0) * (arcs[bi + 1] / total)
        r1, r2 = ring(u1), ring(u2)
        for name, s in sides.items():
            o = s["o"]
            if kind == "front":
                n = (0, 0, 1)
            elif kind == "chamfer":
                n = norm3((o[0], o[1], 1))
            elif kind == "outer":
                n = o
            elif kind == "back":
                n = (0, 0, -1)
            else:
                n = (-o[0], -o[1], 0)
            if name == "top":
                c1 = [(r1["xl"], r1["yt"], z1), (r1["xr"], r1["yt"], z1)]
                c2 = [(r2["xr"], r2["yt"], z2), (r2["xl"], r2["yt"], z2)]
                uu1 = [(r1["xl"] + W / 2) / L, (r1["xr"] + W / 2) / L]
                uu2 = [(r2["xr"] + W / 2) / L, (r2["xl"] + W / 2) / L]
            elif name == "bottom":
                c1 = [(r1["xr"], r1["yb"], z1), (r1["xl"], r1["yb"], z1)]
                c2 = [(r2["xl"], r2["yb"], z2), (r2["xr"], r2["yb"], z2)]
                uu1 = [(r1["xr"] + W / 2) / L, (r1["xl"] + W / 2) / L]
                uu2 = [(r2["xl"] + W / 2) / L, (r2["xr"] + W / 2) / L]
            elif name == "left":
                c1 = [(r1["xl"], r1["yb"], z1), (r1["xl"], r1["yt"], z1)]
                c2 = [(r2["xl"], r2["yt"], z2), (r2["xl"], r2["yb"], z2)]
                uu1 = [(r1["yb"] + H / 2) / L, (r1["yt"] + H / 2) / L]
                uu2 = [(r2["yt"] + H / 2) / L, (r2["yb"] + H / 2) / L]
            else:
                c1 = [(r1["xr"], r1["yt"], z1), (r1["xr"], r1["yb"], z1)]
                c2 = [(r2["xr"], r2["yb"], z2), (r2["xr"], r2["yt"], z2)]
                uu1 = [(r1["yt"] + H / 2) / L, (r1["yb"] + H / 2) / L]
                uu2 = [(r2["yb"] + H / 2) / L, (r2["yt"] + H / 2) / L]
            part.quad(c1 + c2, n, [(uu1[0], t1), (uu1[1], t1), (uu2[0], t2), (uu2[1], t2)])


def build_hanger(part, W, H, metal_uv):
    cx, cy = 0.0, H / 2 - 0.035
    sx, sy = 0.03, 0.004
    z0, z1 = BACK_Z - 0.0035, BACK_Z + 0.0005
    u = [metal_uv] * 4
    part.quad([(cx - sx, cy - sy, z0), (cx + sx, cy - sy, z0),
               (cx + sx, cy + sy, z0), (cx - sx, cy + sy, z0)], (0, 0, -1), u)
    part.quad([(cx - sx, cy + sy, z0), (cx + sx, cy + sy, z0),
               (cx + sx, cy + sy, z1), (cx - sx, cy + sy, z1)], (0, 1, 0), u)
    part.quad([(cx - sx, cy - sy, z1), (cx + sx, cy - sy, z1),
               (cx + sx, cy - sy, z0), (cx - sx, cy - sy, z0)], (0, -1, 0), u)
    part.quad([(cx - sx, cy - sy, z1), (cx - sx, cy - sy, z0),
               (cx - sx, cy + sy, z0), (cx - sx, cy + sy, z1)], (-1, 0, 0), u)
    part.quad([(cx + sx, cy - sy, z0), (cx + sx, cy - sy, z1),
               (cx + sx, cy + sy, z1), (cx + sx, cy + sy, z0)], (1, 0, 0), u)


# ---------------------------------------------------------------- GLB

def pad4(data, fill=b"\x00"):
    return data + fill * (-len(data) % 4)


def write_glb_v2(path, art_img, aspect, title, color="black"):
    if aspect >= 1.0:
        W, H = LONG_SIDE, LONG_SIDE / aspect
    else:
        W, H = LONG_SIDE * aspect, LONG_SIDE

    img_art, (art_u, art_v) = build_artwork_tex(art_img)
    img_atlas, uvinfo = build_atlas_b(title, aspect, color)

    wood = Part()
    build_frame(wood, W, H, uvinfo["wood_v"])

    art = Part()
    aw, ah = W / 2 - BAR + 0.002, H / 2 - BAR + 0.002
    art.quad([(-aw, -ah, ART_Z), (aw, -ah, ART_Z), (aw, ah, ART_Z), (-aw, ah, ART_Z)],
             (0, 0, 1),
             [(0, art_v), (art_u, art_v), (art_u, 0), (0, 0)])

    glass = Part()
    glass.quad([(-aw, -ah, GLASS_Z), (aw, -ah, GLASS_Z), (aw, ah, GLASS_Z), (-aw, ah, GLASS_Z)],
               (0, 0, 1), [(0, 0)] * 4)

    back = Part()
    bx0, by0, bx1, by1 = uvinfo["back"]
    bw, bh = W / 2 - 0.002, H / 2 - 0.002
    # Betrachter hinter dem Bild: Welt-x gespiegelt
    back.quad([(bw, -bh, BACK_Z), (-bw, -bh, BACK_Z), (-bw, bh, BACK_Z), (bw, bh, BACK_Z)],
              (0, 0, -1),
              [(bx0, by1), (bx1, by1), (bx1, by0), (bx0, by0)])
    build_hanger(back, W, H, uvinfo["metal"])

    materials = [
        {"name": "wood", "pbrMetallicRoughness": {
            "baseColorTexture": {"index": 1}, "metallicFactor": 0.0, "roughnessFactor": 0.42}},
        {"name": "artwork", "pbrMetallicRoughness": {
            "baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.72}},
        {"name": "glass", "alphaMode": "BLEND", "pbrMetallicRoughness": {
            "baseColorFactor": [1.0, 1.0, 1.0, 0.07], "metallicFactor": 0.0, "roughnessFactor": 0.04}},
        {"name": "back", "pbrMetallicRoughness": {
            "baseColorTexture": {"index": 1}, "metallicFactor": 0.05, "roughnessFactor": 0.85}},
    ]
    parts = [(wood, 0), (back, 3), (art, 1), (glass, 2)]

    views, blobs, offset = [], [], 0

    def add_view(data, target=None):
        nonlocal offset
        data = pad4(data)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target:
            view["target"] = target
        views.append(view)
        blobs.append(data)
        offset += len(data)
        return len(views) - 1

    accessors, primitives = [], []
    for part, mat in parts:
        pos = np.asarray(part.pos, dtype="<f4")
        nrm = np.asarray(part.nrm, dtype="<f4")
        uv = np.asarray(part.uv, dtype="<f4")
        idx = np.asarray(part.idx, dtype="<u4")
        a0 = len(accessors)
        accessors.append({"bufferView": add_view(pos.tobytes(), 34962), "componentType": 5126,
                          "count": len(pos), "type": "VEC3",
                          "min": [float(x) for x in pos.min(axis=0)],
                          "max": [float(x) for x in pos.max(axis=0)]})
        accessors.append({"bufferView": add_view(nrm.tobytes(), 34962), "componentType": 5126,
                          "count": len(nrm), "type": "VEC3"})
        accessors.append({"bufferView": add_view(uv.tobytes(), 34962), "componentType": 5126,
                          "count": len(uv), "type": "VEC2"})
        accessors.append({"bufferView": add_view(idx.tobytes(), 34963), "componentType": 5125,
                          "count": len(idx), "type": "SCALAR"})
        primitives.append({"attributes": {"POSITION": a0, "NORMAL": a0 + 1, "TEXCOORD_0": a0 + 2},
                           "indices": a0 + 3, "material": mat, "mode": 4})

    v_art = add_view(img_art)
    v_atlas = add_view(img_atlas)

    doc = {
        "asset": {"version": "2.0", "generator": "limitless-poster-glb-v2"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": title}],
        "meshes": [{"primitives": primitives}],
        "materials": materials,
        "textures": [{"source": 0, "sampler": 0}, {"source": 1, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": v_art, "mimeType": "image/jpeg"},
                   {"bufferView": v_atlas, "mimeType": "image/jpeg"}],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": offset}],
    }
    json_chunk = pad4(json.dumps(doc, separators=(",", ":")).encode(), b" ")
    bin_chunk = b"".join(blobs)
    total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(json_chunk), 0x4E4F534A))
        f.write(json_chunk)
        f.write(struct.pack("<II", len(bin_chunk), 0x004E4942))
        f.write(bin_chunk)
    return path
