#!/usr/bin/env python3
"""Baut product.json (Trust-Row + Accordions), collection.queens.json,
header-group.json (rotierende Announcements) und footer-group.json (Wortmarke)."""
import json
import os

THEME = os.path.join(os.path.dirname(__file__), "..", "theme")
BASE = os.path.join(THEME, "base")
PAD0 = {"padding-block-start": 0, "padding-block-end": 0, "padding-inline-start": 0, "padding-inline-end": 0}


def load_base(name):
    """Liest ein Original-Template und entfernt den Auto-generated-Kommentar."""
    with open(os.path.join(BASE, name), encoding="utf-8") as f:
        raw = f.read()
    if raw.lstrip().startswith("/*"):
        raw = raw[raw.index("*/") + 2:]
    return json.loads(raw)


PRODUCT_BASE = load_base("product.json")
COLLECTION_BASE = load_base("collection.json")
HEADER_BASE = load_base("header-group.json")
FOOTER_BASE = load_base("footer-group.json")


def text_settings(text, **over):
    s = {
        "text": text, "width": "100%", "max_width": "normal", "alignment": "left",
        "type_preset": "rte", "font": "var(--font-primary--family)", "font_size": "",
        "line_height": "normal", "letter_spacing": "normal", "case": "none", "wrap": "pretty",
        "color": "", "background": False, "background_color": "#00000026", "corner_radius": 0, **PAD0,
    }
    s.update(over)
    return s


# ============================================================== product.json
# Basis: aktueller Stand des WIP-Themes; Ergänzungen: Trust-Row + Accordion.
prod = PRODUCT_BASE

trust_block = {
    "type": "text",
    "name": "Trust-Row",
    "settings": text_settings(
        "<p>✓ Gerahmt geliefert – sofort aufhängbar&nbsp;&nbsp;·&nbsp;&nbsp;✓ Museumsqualität&nbsp;&nbsp;·&nbsp;&nbsp;✓ 14 Tage Widerrufsrecht</p>",
        type_preset="custom", font="var(--font-subheading--family)", font_size="0.75rem",
        letter_spacing="loose", case="uppercase", color="var(--color-foreground)",
    ),
    "blocks": {},
}


def accordion_row(key, heading, html, open_default=False):
    return key, {
        "type": "_accordion-row",
        "settings": {"heading": heading, "open_by_default": open_default, "icon": "none", "width": 20},
        "blocks": {
            "text": {
                "type": "text",
                "settings": text_settings(html, font="var(--font-body--family)"),
                "blocks": {},
            }
        },
        "block_order": ["text"],
    }


rows = dict([
    accordion_row("row_quality", "Details & Qualität",
                  "<p>Mattes Archivpapier in Museumsqualität, farbecht und vergilbungsbeständig. "
                  "Brillante Pigmenttinten für satte Kontraste. Holzrahmen in Schwarz oder Weiß mit "
                  "bruchsicherer Plexiglas-Front, Aufhängung vormontiert.</p>", True),
    accordion_row("row_shipping", "Versand & Rückgabe",
                  "<p>Sorgfältig verpackt und schnell aus der EU versendet. 14 Tage Widerrufsrecht. "
                  "2 Jahre Gewährleistung in der EU und Nordirland gemäß Richtlinie 1999/44/EG.</p>"),
    accordion_row("row_care", "Pflege",
                  "<p>Staub sanft mit einem trockenen, weichen Tuch entfernen. "
                  "Direkte, dauerhafte Sonneneinstrahlung vermeiden.</p>"),
])

accordion_block = {
    "type": "accordion",
    "name": "Produkt-Infos",
    "settings": {
        "icon": "caret", "dividers": True, "type_preset": "h6",
        "inherit_color_scheme": True, "color_scheme": "scheme-1",
        "border": "none", "border_width": 1, "border_opacity": 100, "border_radius": 0, **PAD0,
    },
    "blocks": rows,
    "block_order": list(rows.keys()),
}

details = prod["sections"]["main"]["blocks"]["product-details"]
details["blocks"]["text_lp_trust"] = trust_block
details["blocks"]["accordion_lp"] = accordion_block
order = details["block_order"]
# Trust-Row nach den Buy-Buttons, Accordion ans Ende (nach der Beschreibung)
buy_idx = order.index("buy_buttons_eYQEYi")
order.insert(buy_idx + 1, "text_lp_trust")
order.append("accordion_lp")

with open(os.path.join(THEME, "product.json"), "w", encoding="utf-8") as f:
    json.dump(prod, f, ensure_ascii=False, indent=2)

# ====================================================== collection.queens.json
queens = COLLECTION_BASE
queens_css = (
    "<style>\n"
    '  main[data-template="collection.queens"] .price { color: #B0526B; }\n'
    '  main[data-template="collection.queens"] h1 { position: relative; }\n'
    '  main[data-template="collection.queens"] h1::after { content: ""; display: block; width: 64px; height: 4px; background: #E4A7B6; margin-top: 12px; }\n'
    '  main[data-template="collection.queens"] product-card:hover .card-gallery,\n'
    '  main[data-template="collection.queens"] product-card:hover .product-card__gallery { box-shadow: 0 0 0 1px rgba(228, 167, 182, 0.55), 0 18px 36px rgba(11, 11, 12, 0.12); }\n'
    "</style>"
)
queens["sections"] = {
    "queens_style": {
        "type": "custom-liquid",
        "name": "Queens-Akzent",
        "settings": {
            "custom_liquid": queens_css, "color_scheme": "scheme-1", "section_width": "page-width",
            "padding-block-start": 0, "padding-block-end": 0,
        },
    },
    **queens["sections"],
}
queens["order"] = ["queens_style"] + [k for k in queens["order"]]

with open(os.path.join(THEME, "collection.queens.json"), "w", encoding="utf-8") as f:
    json.dump(queens, f, ensure_ascii=False, indent=2)

# ========================================================== header-group.json
hg = HEADER_BASE
ann = hg["sections"]["header_announcements_9jGBFp"]
base_settings = ann["blocks"]["announcement_BxgCk9"]["settings"]


def announcement(text, link=""):
    s = dict(base_settings)
    s["text"] = text
    s["link"] = link
    return {"type": "_announcement", "settings": s, "blocks": {}}


ann["blocks"]["announcement_BxgCk9"]["settings"]["text"] = "Neu sortiert: Acht Kollektionen — finde deinen Stil"
ann["blocks"]["announcement_lp_drop"] = announcement("New Drop ist da — die neuesten Motive", "/collections/new-drop")
ann["blocks"]["announcement_lp_ship"] = announcement("Kostenloser Versand ab 50 €")
ann["blocks"]["announcement_lp_frame"] = announcement("Gerahmt geliefert — sofort aufhängbar")
ann["block_order"] = ["announcement_lp_drop", "announcement_BxgCk9", "announcement_lp_ship", "announcement_lp_frame"]

with open(os.path.join(THEME, "header-group.json"), "w", encoding="utf-8") as f:
    json.dump(hg, f, ensure_ascii=False, indent=2)

# ========================================================== footer-group.json
fg = FOOTER_BASE
fg["sections"]["section_MDRXbf"]["blocks"]["group_GkmwCG"]["blocks"]["text_HmFnTH"]["settings"]["text"] = (
    "<p>Acht Kollektionen, ein Anspruch: Motive, die etwas in dir auslösen — von Motorsport bis Mindset.</p>"
)
wordmark_html = (
    '<div class="lp-wordmark-wrap">\n'
    '  <div class="lp-wordmark lp-fd">\n'
    '    <svg class="lp-fd-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="0.75" y="0.75" width="98.5" height="98.5" pathLength="1"/></svg>\n'
    '    LIMITLESS<span class="lp-outline">POSTER</span>\n'
    "  </div>\n"
    "</div>"
)
fg["sections"] = {
    "lp_wordmark": {
        "type": "custom-liquid",
        "name": "Wortmarke",
        "settings": {
            "custom_liquid": wordmark_html, "color_scheme": "scheme-2", "section_width": "page-width",
            "padding-block-start": 36, "padding-block-end": 0,
        },
    },
    **fg["sections"],
}
fg["order"] = ["lp_wordmark"] + [k for k in fg["order"]]

with open(os.path.join(THEME, "footer-group.json"), "w", encoding="utf-8") as f:
    json.dump(fg, f, ensure_ascii=False, indent=2)

for name in ("product.json", "collection.queens.json", "header-group.json", "footer-group.json"):
    print(name, os.path.getsize(os.path.join(THEME, name)), "bytes")
