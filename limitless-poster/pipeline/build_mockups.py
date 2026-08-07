#!/usr/bin/env python3
"""Raum-Mockups: 2 gebaute Szenen (Ivory Gallery, Graphite Studio) + Compositor.

Templates werden programmatisch in 2560x2560 erzeugt (Open-Frame-Ästhetik:
ruhige Flächen, weiches Licht, eine Cobalt-Note im Studio). Das Artwork wird
mit schwarzem Rahmen + Papierrand eingesetzt, bekommt einen weichen Schatten
und ein gemeinsames Licht-Overlay.
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..")
MANIFEST = os.path.join(ROOT, "manifest")
MOCK = os.path.join(ROOT, "mockups")
TPL = os.path.join(ROOT, "art", "templates")
os.makedirs(MOCK, exist_ok=True)
os.makedirs(TPL, exist_ok=True)

SIZE = 2560
OUT_SIZE = 2048

IVORY = (238, 234, 224)
IVORY_LIGHT = (246, 243, 236)
OAK = (208, 186, 156)
OAK_DARK = (188, 165, 134)
SKIRT = (250, 248, 243)
GRAPHITE_TOP = (64, 66, 72)
CARBON = (24, 24, 27)
SIDEBOARD = (52, 52, 58)
COBALT = (49, 87, 255)


def vertical_gradient(size, top, bottom):
    top_a, bot_a = np.array(top, float), np.array(bottom, float)
    t = np.linspace(0, 1, size[1])[:, None, None]
    grad = top_a * (1 - t) + bot_a * t
    return Image.fromarray(np.broadcast_to(grad, (size[1], size[0], 3)).astype(np.uint8))


def build_template_a():
    """Ivory Gallery: warme Wand, Eichenboden, weiches Tageslicht von links."""
    img = vertical_gradient((SIZE, SIZE), IVORY_LIGHT, IVORY)
    d = ImageDraw.Draw(img)
    floor_y = int(SIZE * 0.82)
    # Fußleiste + Boden
    d.rectangle([0, floor_y - 26, SIZE, floor_y], fill=SKIRT)
    floor = vertical_gradient((SIZE, SIZE - floor_y), OAK, OAK_DARK)
    img.paste(floor, (0, floor_y))
    # Dielenfugen mit leichter Perspektive
    for k in range(-2, 9):
        x_top = k * 420 - 200
        x_bot = x_top + 160
        d.line([(x_top, floor_y), (x_bot, SIZE)], fill=(178, 156, 126), width=5)
    # Weiches Licht von links oben (Screen)
    light = Image.new("L", (SIZE, SIZE), 0)
    ld = ImageDraw.Draw(light)
    ld.ellipse([-SIZE * 0.55, -SIZE * 0.55, SIZE * 0.75, SIZE * 0.75], fill=70)
    light = light.filter(ImageFilter.GaussianBlur(280))
    img = Image.composite(Image.new("RGB", img.size, (255, 255, 252)), img,
                          light.point(lambda v: v // 2))
    img.save(os.path.join(TPL, "template-a.jpg"), quality=92)
    return img


def build_template_b():
    """Graphite Studio: dunkler Verlauf, Sideboard-Silhouette, Cobalt-Objekt."""
    img = vertical_gradient((SIZE, SIZE), GRAPHITE_TOP, CARBON)
    d = ImageDraw.Draw(img)
    floor_y = int(SIZE * 0.84)
    floor = vertical_gradient((SIZE, SIZE - floor_y), (30, 30, 33), (16, 16, 18))
    img.paste(floor, (0, floor_y))
    # Sideboard
    sb_top = floor_y - 300
    d.rounded_rectangle([SIZE * 0.58, sb_top, SIZE * 0.96, floor_y - 10], radius=14, fill=SIDEBOARD)
    d.rectangle([SIZE * 0.60, floor_y - 10, SIZE * 0.615, floor_y + 40], fill=(30, 30, 33))
    d.rectangle([SIZE * 0.945, floor_y - 10, SIZE * 0.96, floor_y + 40], fill=(30, 30, 33))
    # Cobalt-Vase auf dem Sideboard
    d.rounded_rectangle([SIZE * 0.66, sb_top - 150, SIZE * 0.695, sb_top - 6], radius=18, fill=COBALT)
    # Kaltes Licht von rechts oben
    light = Image.new("L", (SIZE, SIZE), 0)
    ld = ImageDraw.Draw(light)
    ld.ellipse([SIZE * 0.35, -SIZE * 0.5, SIZE * 1.55, SIZE * 0.7], fill=60)
    light = light.filter(ImageFilter.GaussianBlur(300))
    img = Image.composite(Image.new("RGB", img.size, (216, 222, 238)), img,
                          light.point(lambda v: v // 3))
    img.save(os.path.join(TPL, "template-b.jpg"), quality=92)
    return img


def framed_artwork(art, target_h):
    """Artwork + Papierrand + schwarzer Rahmen als PIL-Bild."""
    aw, ah = art.size
    scale = target_h / ah
    art = art.resize((int(aw * scale), int(ah * scale)), Image.LANCZOS)
    paper = 14
    frame = max(26, int(art.width * 0.045))
    w = art.width + 2 * paper + 2 * frame
    h = art.height + 2 * paper + 2 * frame
    out = Image.new("RGB", (w, h), (14, 14, 15))
    inner = Image.new("RGB", (art.width + 2 * paper, art.height + 2 * paper), (250, 249, 245))
    inner.paste(art, (paper, paper))
    out.paste(inner, (frame, frame))
    # feine Innenschattenlinie am Rahmen
    d = ImageDraw.Draw(out)
    d.rectangle([frame - 2, frame - 2, w - frame + 1, h - frame + 1], outline=(5, 5, 6), width=2)
    return out


def composite(template, art, wall_center, wall_height, shadow_alpha=90):
    """Setzt das gerahmte Artwork frontal + weichen Schatten in die Szene."""
    persp = framed_artwork(art, wall_height).convert("RGBA")
    cx, cy = wall_center
    px, py = cx - persp.width // 2, cy - persp.height // 2
    # Schatten
    shadow = Image.new("RGBA", template.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([px + 20, py + 26, px + persp.width + 34, py + persp.height + 40],
                         radius=18, fill=(8, 8, 10, shadow_alpha))
    shadow = shadow.filter(ImageFilter.GaussianBlur(38))
    base = template.convert("RGBA")
    base.alpha_composite(shadow)
    base.alpha_composite(persp, (px, py))
    return base.convert("RGB")


def main(only=None):
    det = json.load(open(os.path.join(MANIFEST, "detection.json")))
    tpl_a_path = os.path.join(TPL, "template-a.jpg")
    tpl_b_path = os.path.join(TPL, "template-b.jpg")
    tpl_a = Image.open(tpl_a_path) if os.path.exists(tpl_a_path) else build_template_a()
    tpl_b = Image.open(tpl_b_path) if os.path.exists(tpl_b_path) else build_template_b()
    n = 0
    for handle, e in det.items():
        if only and handle not in only:
            continue
        if not e.get("art_done") or e.get("mockups_done"):
            continue
        art = Image.open(e["art_path"])
        landscape = e["orientation"] == "landscape"
        h_a = int(SIZE * (0.34 if landscape else 0.46))
        h_b = int(SIZE * (0.32 if landscape else 0.44))
        m1 = composite(tpl_a, art, (int(SIZE * 0.5), int(SIZE * 0.44)), h_a)
        m2 = composite(tpl_b, art, (int(SIZE * 0.36), int(SIZE * 0.42)), h_b, shadow_alpha=120)
        p1 = os.path.join(MOCK, f"{handle}-room1.jpg")
        p2 = os.path.join(MOCK, f"{handle}-room2.jpg")
        m1.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS).save(p1, quality=88)
        m2.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS).save(p2, quality=88)
        e["mockups_done"] = True
        e["mockup_paths"] = [p1, p2]
        n += 1
        if n % 10 == 0:
            json.dump(det, open(os.path.join(MANIFEST, "detection.json"), "w"), ensure_ascii=False, indent=1)
            print(f"{n} Mockup-Paare...")
    json.dump(det, open(os.path.join(MANIFEST, "detection.json"), "w"), ensure_ascii=False, indent=1)
    print(f"fertig: {n} Mockup-Paare")


if __name__ == "__main__":
    import sys
    main(sys.argv[1:] or None)
