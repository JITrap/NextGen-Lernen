#!/usr/bin/env python3
"""Eigener GLB-Writer: gerahmtes Poster als EIN Mesh mit EINEM Material.

Lehrbuch-glTF: bufferView.target gesetzt, POSITION mit min/max, Sampler mit
CLAMP_TO_EDGE, JPEG-Textur als Atlas (Artwork + Farbfelder für Rahmen/Rückseite).
Reale Meter, +Y oben, Front +Z, zentriert — korrekt für Shopifys AR.
"""
import io
import json
import struct

import numpy as np
from PIL import Image

FRAME_RGB = (14, 14, 15)
PAPER_RGB = (242, 240, 235)

ATLAS = 2048
ART_H = 1840  # Artwork-Region oben; unten 208px Farbstreifen

LONG_SIDE = 0.6096
BAR_FACE = 0.020
BAR_DEPTH = 0.022
POSTER_RECESS = 0.0045

UV_FRAME = (0.25, 0.975)
UV_PAPER = (0.75, 0.975)
UV_ART_VMAX = ART_H / ATLAS


class MeshBuilder:
    def __init__(self):
        self.pos, self.nrm, self.uv, self.idx = [], [], [], []

    def quad(self, corners, normal, uvs):
        """corners: 4 Punkte gegen den Uhrzeigersinn (von der Normalen aus gesehen)."""
        base = len(self.pos)
        self.pos += list(corners)
        self.nrm += [normal] * 4
        self.uv += list(uvs)
        self.idx += [base, base + 1, base + 2, base, base + 2, base + 3]

    def box(self, center, size, uv_point):
        cx, cy, cz = center
        sx, sy, sz = size[0] / 2, size[1] / 2, size[2] / 2
        u = [uv_point] * 4
        # +Z Front
        self.quad([(cx - sx, cy - sy, cz + sz), (cx + sx, cy - sy, cz + sz),
                   (cx + sx, cy + sy, cz + sz), (cx - sx, cy + sy, cz + sz)], (0, 0, 1), u)
        # -Z
        self.quad([(cx + sx, cy - sy, cz - sz), (cx - sx, cy - sy, cz - sz),
                   (cx - sx, cy + sy, cz - sz), (cx + sx, cy + sy, cz - sz)], (0, 0, -1), u)
        # +X
        self.quad([(cx + sx, cy - sy, cz + sz), (cx + sx, cy - sy, cz - sz),
                   (cx + sx, cy + sy, cz - sz), (cx + sx, cy + sy, cz + sz)], (1, 0, 0), u)
        # -X
        self.quad([(cx - sx, cy - sy, cz - sz), (cx - sx, cy - sy, cz + sz),
                   (cx - sx, cy + sy, cz + sz), (cx - sx, cy + sy, cz - sz)], (-1, 0, 0), u)
        # +Y
        self.quad([(cx - sx, cy + sy, cz + sz), (cx + sx, cy + sy, cz + sz),
                   (cx + sx, cy + sy, cz - sz), (cx - sx, cy + sy, cz - sz)], (0, 1, 0), u)
        # -Y
        self.quad([(cx - sx, cy - sy, cz - sz), (cx + sx, cy - sy, cz - sz),
                   (cx + sx, cy - sy, cz + sz), (cx - sx, cy - sy, cz + sz)], (0, -1, 0), u)


def build_atlas(art_img):
    atlas = Image.new("RGB", (ATLAS, ATLAS), FRAME_RGB)
    atlas.paste(art_img.convert("RGB").resize((ATLAS, ART_H), Image.LANCZOS), (0, 0))
    strip_y = ART_H + 4
    atlas.paste(Image.new("RGB", (ATLAS // 2 - 8, ATLAS - strip_y), FRAME_RGB), (0, strip_y))
    atlas.paste(Image.new("RGB", (ATLAS // 2 - 8, ATLAS - strip_y), PAPER_RGB), (ATLAS // 2 + 8, strip_y))
    buf = io.BytesIO()
    atlas.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def build_geometry(aspect):
    if aspect >= 1.0:
        W, H = LONG_SIDE, LONG_SIDE / aspect
    else:
        W, H = LONG_SIDE * aspect, LONG_SIDE
    m = MeshBuilder()
    hd = BAR_DEPTH / 2
    # Rahmen
    m.box((0, H / 2 - BAR_FACE / 2, 0), (W, BAR_FACE, BAR_DEPTH), UV_FRAME)
    m.box((0, -H / 2 + BAR_FACE / 2, 0), (W, BAR_FACE, BAR_DEPTH), UV_FRAME)
    m.box((-W / 2 + BAR_FACE / 2, 0, 0), (BAR_FACE, H - 2 * BAR_FACE, BAR_DEPTH), UV_FRAME)
    m.box((W / 2 - BAR_FACE / 2, 0, 0), (BAR_FACE, H - 2 * BAR_FACE, BAR_DEPTH), UV_FRAME)
    # Posterfläche (zurückversetzt), Artwork-UVs (glTF: v=0 oben)
    pw, ph = W / 2 - BAR_FACE + 0.002, H / 2 - BAR_FACE + 0.002
    z = hd - POSTER_RECESS
    m.quad([(-pw, -ph, z), (pw, -ph, z), (pw, ph, z), (-pw, ph, z)], (0, 0, 1),
           [(0, UV_ART_VMAX), (1, UV_ART_VMAX), (1, 0), (0, 0)])
    # Rückplatte (nach hinten gerichtet)
    bz = -hd + 0.001
    bw, bh = W / 2 - 0.002, H / 2 - 0.002
    m.quad([(bw, -bh, bz), (-bw, -bh, bz), (-bw, bh, bz), (bw, bh, bz)], (0, 0, -1),
           [UV_PAPER] * 4)
    return m


def pad4(data, fill=b"\x00"):
    return data + fill * (-len(data) % 4)


def write_glb(path, art_img, aspect, name="Framed Poster"):
    m = build_geometry(aspect)
    pos = np.asarray(m.pos, dtype="<f4")
    nrm = np.asarray(m.nrm, dtype="<f4")
    uv = np.asarray(m.uv, dtype="<f4")
    idx = np.asarray(m.idx, dtype="<u4")
    img = build_atlas(art_img)

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

    v_pos = add_view(pos.tobytes(), 34962)
    v_nrm = add_view(nrm.tobytes(), 34962)
    v_uv = add_view(uv.tobytes(), 34962)
    v_idx = add_view(idx.tobytes(), 34963)
    v_img = add_view(img)

    doc = {
        "asset": {"version": "2.0", "generator": "limitless-poster-glb"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": name}],
        "meshes": [{"primitives": [{
            "attributes": {"POSITION": v_pos, "NORMAL": v_nrm, "TEXCOORD_0": v_uv},
            "indices": v_idx, "material": 0, "mode": 4}]}],
        "materials": [{
            "name": "poster",
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": 0},
                "metallicFactor": 0.0,
                "roughnessFactor": 0.65,
            },
            "doubleSided": False,
        }],
        "textures": [{"source": 0, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": v_img, "mimeType": "image/jpeg"}],
        "accessors": [
            {"bufferView": v_pos, "componentType": 5126, "count": len(pos), "type": "VEC3",
             "min": [float(x) for x in pos.min(axis=0)], "max": [float(x) for x in pos.max(axis=0)]},
            {"bufferView": v_nrm, "componentType": 5126, "count": len(nrm), "type": "VEC3"},
            {"bufferView": v_uv, "componentType": 5126, "count": len(uv), "type": "VEC2"},
            {"bufferView": v_idx, "componentType": 5125, "count": len(idx), "type": "SCALAR"},
        ],
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
