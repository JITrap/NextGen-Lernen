#!/usr/bin/env python3
"""Open Frame — 15 Kollektionsbilder (1600x2000) für LimitlessPoster.

Gezeichnet in 2x (3200x4000) und mit Lanczos auf Zielgröße reduziert,
damit jede Linie kupferstich-scharf steht.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..")
ART = os.path.join(ROOT, "art")
OUT = os.path.join(ROOT, "collection-images")
os.makedirs(OUT, exist_ok=True)

S = 2  # Supersampling
W, H = 1600 * S, 2000 * S

PAPER = (252, 251, 247)
CARBON = (11, 11, 12)
COBALT = (49, 87, 255)
ROSE = (196, 111, 134)
GRAPHITE = (85, 87, 92)

SG = os.path.join(ART, "SpaceGrotesk-var.ttf")
MONO = "/root/.claude/skills/canvas-design/canvas-fonts/DMMono-Regular.ttf"

MARGIN = 110 * S
FRAME_INSET = 64 * S


def font(size, weight=500):
    static = os.path.join(ART, f"SpaceGrotesk-{weight}.ttf")
    if os.path.exists(static):
        return ImageFont.truetype(static, size)
    f = ImageFont.truetype(SG, size)
    f.set_variation_by_axes([weight])
    return f


def tracked(draw, xy, text, f, fill, tracking=0.0, anchor_right=False):
    """Zeichnet Text mit Letter-Spacing (tracking als Anteil der em-Größe)."""
    sizes = [draw.textlength(ch, font=f) for ch in text]
    gap = f.size * tracking
    total = sum(sizes) + gap * (len(text) - 1)
    x, y = xy
    if anchor_right:
        x -= total
    for ch, wd in zip(text, sizes):
        draw.text((x, y), ch, font=f, fill=fill)
        x += wd + gap
    return total


def line(d, p1, p2, fill, width):
    d.line([p1, p2], fill=fill, width=width)


class Tile:
    def __init__(self, invert=False, accent=COBALT):
        self.bg = CARBON if invert else PAPER
        self.fg = PAPER if invert else CARBON
        self.muted = (150, 148, 142) if invert else GRAPHITE
        self.accent = accent
        self.img = Image.new("RGB", (W, H), self.bg)
        self.d = ImageDraw.Draw(self.img)

    # ---------------------------------------------------------------- Rahmen
    def open_frame(self):
        """Feiner Rahmen mit bewusster Öffnung unten rechts — die Signatur."""
        d, i, w = self.d, FRAME_INSET, 3
        gap_from = W - i - 460 * S
        gap_to = W - i - 130 * S
        line(d, (i, i), (W - i, i), self.fg, w)
        line(d, (i, i), (i, H - i), self.fg, w)
        line(d, (W - i, i), (W - i, H - i), self.fg, w)
        line(d, (i, H - i), (gap_from, H - i), self.fg, w)
        line(d, (gap_to, H - i), (W - i, H - i), self.fg, w)
        # Registrierkreuze in den Ecken (außerhalb des Rahmens)
        for cx, cy in ((i // 2, i // 2), (W - i // 2, i // 2), (i // 2, H - i // 2), (W - i // 2, H - i // 2)):
            r = 9 * S
            line(d, (cx - r, cy), (cx + r, cy), self.muted, 2)
            line(d, (cx, cy - r), (cx, cy + r), self.muted, 2)

    # ------------------------------------------------------------ Typografie
    def typography(self, title_lines, sub, index):
        d = self.d
        # Akzentlinie (bei zweizeiligen Titeln rückt der Block nach oben)
        rule_y = (1245 - (len(title_lines) - 1) * 150) * S
        d.rectangle([MARGIN, rule_y, MARGIN + 150 * S, rule_y + 6 * S], fill=self.accent)
        # Titel
        y = rule_y + 46 * S
        for ln in title_lines:
            size = 218 * S if len(ln) <= 8 else (168 * S if len(ln) <= 11 else 128 * S)
            f = font(size, 700)
            d.text((MARGIN - 6 * S, y), ln, font=f, fill=self.fg)
            y += size * 1.02
        # Unterzeile (genug Abstand für Versal-Unterlängen wie Q)
        y += 44 * S
        tracked(d, (MARGIN, y), sub.upper(), font(40 * S, 500), self.muted, tracking=0.28)
        # Fußzeile
        base_y = H - FRAME_INSET - 86 * S
        tracked(d, (MARGIN, base_y), "LIMITLESSPOSTER", font(30 * S, 500), self.muted, tracking=0.22)
        mono = ImageFont.truetype(MONO, 30 * S)
        idx = f"{index:02d} / 15"
        wd = d.textlength(idx, font=mono)
        d.text((W - MARGIN - wd, base_y), idx, font=mono, fill=self.muted)

    # ---------------------------------------------------------------- Motive
    def motif_zone(self):
        return (W // 2, 660 * S)  # Zentrum der Exponat-Zone

    def save(self, handle):
        out = self.img.resize((1600, 2000), Image.LANCZOS)
        path = os.path.join(OUT, f"collection-{handle}.jpg")
        out.save(path, quality=92)
        return path


LW = 5 * S  # Standard-Strichstärke der Motive


def motif_bolt(t):
    """Klassischer Blitz als geschlossene Kontur, Einschlagpunkt in Akzentfarbe."""
    cx, cy = t.motif_zone()
    s = 2.9 * S
    pts = [
        (cx + 10 * s, cy - 130 * s),   # Spitze oben
        (cx - 62 * s, cy + 14 * s),    # linke Flanke hinunter
        (cx - 6 * s, cy + 14 * s),     # Absatz nach innen
        (cx - 34 * s, cy + 130 * s),   # Spitze unten
        (cx + 62 * s, cy - 22 * s),    # rechte Flanke hinauf
        (cx + 6 * s, cy - 22 * s),     # Absatz nach innen
    ]
    t.d.polygon(pts, outline=t.fg, width=LW)
    tipx, tipy = cx - 34 * s, cy + 130 * s
    t.d.ellipse([tipx - 11 * S, tipy + 26 * S, tipx + 11 * S, tipy + 48 * S], fill=t.accent)


def motif_star(t):
    cx, cy = t.motif_zone()
    r_out, r_in = 300 * S, 96 * S
    for k in range(8):
        a = math.pi / 8 + k * math.pi / 4
        x1, y1 = cx + r_in * math.cos(a), cy + r_in * math.sin(a)
        x2, y2 = cx + r_out * math.cos(a), cy + r_out * math.sin(a)
        line(t.d, (x1, y1), (x2, y2), t.fg, LW)
    t.d.ellipse([cx - 40 * S, cy - 40 * S, cx + 40 * S, cy + 40 * S], outline=t.accent, width=LW)


def motif_apex(t):
    """Ideallinie durch die Kurve: weicher Bogen (Bézier), Apex-Punkt in Akzentfarbe."""
    cx, cy = t.motif_zone()
    p0 = (cx - 400 * S, cy + 330 * S)
    p1 = (cx, cy - 420 * S)
    p2 = (cx + 400 * S, cy + 330 * S)
    pts = []
    for i in range(61):
        u = i / 60
        x = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u ** 2 * p2[0]
        y = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u ** 2 * p2[1]
        pts.append((x, y))
    t.d.line(pts, fill=t.fg, width=LW, joint="curve")
    ax, ay = pts[30]  # Scheitelpunkt
    t.d.ellipse([ax - 13 * S, ay - 13 * S, ax + 13 * S, ay + 13 * S], fill=t.accent)
    # Curbs außen entlang des Scheitels
    for k in (-2, -1, 1, 2):
        idx = 30 + k * 6
        px, py = pts[idx]
        nx, ny = pts[idx + 1]
        tx, ty = nx - px, ny - py
        ln = math.hypot(tx, ty) or 1.0
        ox, oy = -ty / ln, tx / ln  # Normale (nach außen/oben)
        if oy > 0:
            ox, oy = -ox, -oy
        x1, y1 = px + ox * 30 * S, py + oy * 30 * S
        x2, y2 = px + ox * 58 * S, py + oy * 58 * S
        line(t.d, (x1, y1), (x2, y2), t.muted, 4)


def motif_impact(t):
    cx, cy = t.motif_zone()
    r = 170 * S
    t.d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=t.fg, width=LW)
    for k in range(12):
        a = k * math.pi / 6
        l_in, l_out = r + 40 * S, r + (110 * S if k % 3 == 0 else 74 * S)
        color = t.accent if k == 1 else t.fg
        line(t.d, (cx + l_in * math.cos(a), cy + l_in * math.sin(a)),
             (cx + l_out * math.cos(a), cy + l_out * math.sin(a)), color, LW)


def motif_laurel(t):
    """Lorbeerkranz: zwei Zweige von unten zu den Seiten hinauf, oben offen."""
    cx, cy = t.motif_zone()
    r = 250 * S
    my = cy - 30 * S
    n = 22
    for side in (1, -1):
        # rechts: -80°..65°, links: 260°..115° (Öffnung oben bei 90°)
        pts = []
        for i in range(n):
            a = math.radians(-80 + i * 145 / (n - 1)) if side > 0 else math.radians(260 - i * 145 / (n - 1))
            pts.append((cx + r * math.cos(a), my - r * math.sin(a)))
        t.d.line(pts, fill=t.fg, width=LW, joint="curve")
        # Blattpaare: symmetrisch zur Wuchsrichtung (Tangente)
        for i in range(2, n - 2, 3):
            bx, by = pts[i]
            tx, ty = pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]
            ln = math.hypot(tx, ty) or 1.0
            tx, ty = tx / ln, ty / ln
            for leaf in (-1, 1):
                a = math.radians(38) * leaf
                lx = tx * math.cos(a) - ty * math.sin(a)
                ly = tx * math.sin(a) + ty * math.cos(a)
                line(t.d, (bx, by), (bx + lx * 46 * S, by + ly * 46 * S), t.fg, 4)
    t.d.ellipse([cx - 12 * S, my - r - 12 * S, cx + 12 * S, my - r + 12 * S], fill=t.accent)


def motif_thoughtline(t):
    cx, cy = t.motif_zone()
    line(t.d, (cx - 330 * S, cy), (cx + 210 * S, cy), t.fg, LW)
    t.d.ellipse([cx + 250 * S - 14 * S, cy - 14 * S, cx + 250 * S + 14 * S, cy + 14 * S], fill=t.accent)
    for k, x in enumerate(range(-330, -90, 80)):
        line(t.d, (cx + x * S, cy - 26 * S), (cx + x * S, cy + 26 * S), t.muted, 3)


def motif_arch(t):
    cx, cy = t.motif_zone()
    w2, htop, hleg = 210 * S, 210 * S, 300 * S
    t.d.arc([cx - w2, cy - htop - w2, cx + w2, cy - htop + w2], start=180, end=360, fill=t.fg, width=LW)
    line(t.d, (cx - w2, cy - htop), (cx - w2, cy + hleg), t.fg, LW)
    line(t.d, (cx + w2, cy - htop), (cx + w2, cy + hleg), t.fg, LW)
    line(t.d, (cx - w2 - 70 * S, cy + hleg), (cx + w2 + 70 * S, cy + hleg), t.fg, LW)
    line(t.d, (cx - 40 * S, cy + hleg), (cx + 40 * S, cy + hleg), t.accent, LW + 2)


def motif_horizon(t):
    cx, cy = t.motif_zone()
    r = 210 * S
    t.d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=t.fg, width=LW)
    line(t.d, (cx - 360 * S, cy + r), (cx + 360 * S, cy + r), t.fg, LW)
    t.d.arc([cx - r + 60 * S, cy - r + 60 * S, cx + r - 60 * S, cy + r - 60 * S], start=205, end=335, fill=t.accent, width=4)


def motif_waveform(t):
    cx, cy = t.motif_zone()
    heights = [60, 130, 210, 300, 240, 150, 260, 190, 110, 60]
    bar_w, gap = 30 * S, 44 * S
    total = len(heights) * bar_w + (len(heights) - 1) * gap
    x = cx - total / 2
    for k, hh in enumerate(heights):
        color = t.accent if k == 4 else t.fg
        t.d.rectangle([x, cy - hh * S / 2, x + bar_w, cy + hh * S / 2], outline=color, width=4)
        x += bar_w + gap


def motif_crown(t):
    """Fünfzackige Krone als klare, geschlossene Silhouette."""
    cx, cy = t.motif_zone()
    w2, hh = 270 * S, 200 * S
    base = cy + 120 * S
    pts = [
        (cx - w2, base),
        (cx - w2, base - hh * 0.9),       # linker Zacken
        (cx - w2 * 0.5, base - hh * 0.42),  # Tal
        (cx, base - hh * 1.15),           # Mittelzacken
        (cx + w2 * 0.5, base - hh * 0.42),  # Tal
        (cx + w2, base - hh * 0.9),       # rechter Zacken
        (cx + w2, base),
    ]
    t.d.polygon(pts, outline=t.fg, width=LW)
    line(t.d, (cx - w2, base + 36 * S), (cx + w2, base + 36 * S), t.fg, 4)
    dot_y = base - hh * 1.15 - 56 * S
    t.d.ellipse([cx - 13 * S, dot_y - 13 * S, cx + 13 * S, dot_y + 13 * S], fill=t.accent)


def motif_quotes(t):
    cx, cy = t.motif_zone()
    f = font(560 * S // 2, 700)
    txt = "„“"
    wd = t.d.textlength(txt, font=f)
    t.d.text((cx - wd / 2, cy - 300 * S), txt, font=f, fill=t.fg)
    line(t.d, (cx - 90 * S, cy + 170 * S), (cx + 90 * S, cy + 170 * S), t.accent, LW + 2)


def motif_brackets(t):
    cx, cy = t.motif_zone()
    w2, h2, arm = 250 * S, 240 * S, 70 * S
    for side in (-1, 1):
        x = cx + side * w2
        line(t.d, (x, cy - h2), (x, cy + h2), t.fg, LW)
        line(t.d, (x, cy - h2), (x - side * arm, cy - h2), t.fg, LW)
        line(t.d, (x, cy + h2), (x - side * arm, cy + h2), t.fg, LW)
    line(t.d, (cx - 70 * S, cy), (cx + 70 * S, cy), t.accent, LW + 2)


def motif_podium(t):
    cx, cy = t.motif_zone()
    base = cy + 220 * S
    w = 190 * S
    heights = [(0, 300), (-1, 210), (1, 150)]
    for pos, hh in heights:
        x0 = cx + pos * w - w / 2
        t.d.rectangle([x0, base - hh * S, x0 + w, base], outline=t.fg, width=LW)
    line(t.d, (cx - w / 2 + 24 * S, base - 300 * S), (cx + w / 2 - 24 * S, base - 300 * S), t.accent, LW + 2)


def motif_filmframe(t):
    cx, cy = t.motif_zone()
    w2, h2 = 300 * S, 210 * S
    t.d.rectangle([cx - w2, cy - h2, cx + w2, cy + h2], outline=t.fg, width=LW)
    n, sq = 5, 26 * S
    for k in range(n):
        yy = cy - h2 + (2 * h2) * (k + 0.5) / n - sq / 2
        t.d.rectangle([cx - w2 - 58 * S, yy, cx - w2 - 58 * S + sq, yy + sq], outline=t.fg, width=4)
        t.d.rectangle([cx + w2 + 58 * S - sq, yy, cx + w2 + 58 * S, yy + sq], outline=t.fg, width=4)
    t.d.polygon([(cx - 44 * S, cy - 62 * S), (cx - 44 * S, cy + 62 * S), (cx + 64 * S, cy)], outline=t.accent, width=LW)


def motif_brushstroke(t):
    cx, cy = t.motif_zone()
    pts_top, pts_bot = [], []
    for i in range(25):
        u = i / 24
        x = cx - 330 * S + 660 * S * u
        y = cy + math.sin(u * math.pi * 1.15 + 0.3) * -120 * S
        wdt = (26 + 34 * math.sin(u * math.pi)) * S / 2
        pts_top.append((x, y - wdt))
        pts_bot.append((x, y + wdt))
    t.d.polygon(pts_top + pts_bot[::-1], outline=t.fg, width=4)
    t.d.ellipse([cx + 330 * S - 10 * S, cy + math.sin(1.45 * math.pi) * -120 * S - 40 * S,
                 cx + 330 * S + 30 * S, cy + math.sin(1.45 * math.pi) * -120 * S], outline=t.accent, width=4)


COLLECTIONS = [
    ("new-drop", ["NEW", "DROP"], "Die neuesten Motive", motif_bolt, True, COBALT),
    ("bestseller", ["BEST-", "SELLER"], "Meistverkauft", motif_star, True, COBALT),
    ("apex-motorsport-cars", ["APEX"], "Motorsport & Cars", motif_apex, False, COBALT),
    ("grit-boxing-mma", ["GRIT"], "Boxing & MMA", motif_impact, False, COBALT),
    ("legends-sports-icons", ["LEGENDS"], "Sports Icons", motif_laurel, False, COBALT),
    ("mindset-words-ambition", ["MINDSET"], "Words & Ambition", motif_thoughtline, False, COBALT),
    ("still-quiet-luxury", ["STILL"], "Quiet Luxury", motif_arch, False, COBALT),
    ("heritage-timeless-classics", ["HERITAGE"], "Timeless Classics", motif_horizon, False, COBALT),
    ("icons-music-culture", ["ICONS"], "Music & Culture", motif_waveform, False, COBALT),
    ("queens-feminine-energy", ["QUEENS"], "Feminine Energy", motif_crown, False, ROSE),
    ("quotes", ["QUOTES"], "Worte mit Gewicht", motif_quotes, False, COBALT),
    ("statements", ["STATE-", "MENTS"], "Sag es an der Wand", motif_brackets, False, COBALT),
    ("sports", ["SPORTS"], "Spiel, Satz, Sieg", motif_podium, False, COBALT),
    ("film-series", ["FILM &", "SERIES"], "Kino-Momente", motif_filmframe, False, COBALT),
    ("artists", ["ARTISTS"], "Kunst & Kultur", motif_brushstroke, False, COBALT),
]


def main(only=None):
    for idx, (handle, title, sub, motif, invert, accent) in enumerate(COLLECTIONS, 1):
        if only and handle not in only:
            continue
        t = Tile(invert=invert, accent=accent)
        t.open_frame()
        motif(t)
        t.typography(title, sub, idx)
        print(t.save(handle))


if __name__ == "__main__":
    import sys
    main(sys.argv[1:] or None)
