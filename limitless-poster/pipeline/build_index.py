#!/usr/bin/env python3
"""Baut templates/index.json für das WIP-Theme (Open Frame Editorial v2)."""
import json
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "theme", "index.json")

PAD0 = {"padding-block-start": 0, "padding-block-end": 0, "padding-inline-start": 0, "padding-inline-end": 0}


def text_block(text, *, preset="rte", font="var(--font-body--family)", size="", align="left",
               width="100%", max_width="normal", case="none", spacing="normal", line="normal",
               color="var(--color-foreground)", wrap="pretty", **extra):
    s = {
        "text": text, "width": width, "max_width": max_width, "alignment": align,
        "type_preset": preset, "font": font, "font_size": size, "line_height": line,
        "letter_spacing": spacing, "case": case, "wrap": wrap, "color": color,
        "background": False, "background_color": "#00000026", "corner_radius": 0, **PAD0,
    }
    s.update(extra)
    return {"type": "text", "name": "t:names.text", "settings": s, "blocks": {}}


def icon_block(icon, width=14):
    return {"type": "icon", "settings": {"icon": icon, "width": width, "link": "", "open_in_new_tab": False}, "blocks": {}}


def group_settings(**over):
    s = {
        "content_direction": "column", "vertical_on_mobile": True,
        "horizontal_alignment": "flex-start", "vertical_alignment": "center", "align_baseline": False,
        "horizontal_alignment_flex_direction_column": "center",
        "vertical_alignment_flex_direction_column": "flex-start",
        "gap": 10, "width": "fill", "custom_width": 100, "width_mobile": "fill", "custom_width_mobile": 100,
        "height": "fit", "custom_height": 100, "inherit_color_scheme": True, "color_scheme": "",
        "background_media": "none", "video_position": "cover", "background_image_position": "cover",
        "border": "none", "border_width": 1, "border_opacity": 100, "border_radius": 0,
        "toggle_overlay": False, "overlay_color": "#00000026", "overlay_style": "solid",
        "gradient_direction": "to top", "link": "", "open_in_new_tab": False, "placeholder": "", **PAD0,
    }
    s.update(over)
    return s


def usp_group(name, icon, heading, body):
    return {
        "type": "group", "name": name, "settings": group_settings(),
        "blocks": {
            "icon": icon_block(icon, 28),
            "h": text_block(f"<p>{heading}</p>", preset="h5", font="var(--font-subheading--family)",
                            align="center", case="uppercase", color="var(--color-foreground-heading)",
                            **{"padding-block-start": 4}),
            "t": text_block(f"<p>{body}</p>", size="0.875rem", align="center"),
        },
        "block_order": ["icon", "h", "t"],
    }


def product_list_section(collection, scheme, max_products=8):
    """Repliziert die Produktlisten-Sektion des Live-Themes 1:1."""
    header_settings = {
        "content_direction": "row", "vertical_on_mobile": False,
        "horizontal_alignment": "space-between", "vertical_alignment": "flex-end", "align_baseline": True,
        "horizontal_alignment_flex_direction_column": "flex-start",
        "vertical_alignment_flex_direction_column": "center",
        "gap": 12, "width": "fill", "custom_width": 100, "width_mobile": "fill", "custom_width_mobile": 100,
        "height": "fit", "custom_height": 100, "inherit_color_scheme": True, "color_scheme": "",
        "background_media": "none", "video_position": "cover", "background_image_position": "cover",
        "border": "none", "border_width": 1, "border_opacity": 100, "border_radius": 0,
        "padding-block-start": 0, "padding-block-end": 8, "padding-inline-start": 0, "padding-inline-end": 0,
    }
    return {
        "type": "product-list",
        "blocks": {
            "static-header": {
                "type": "_product-list-content", "name": "t:names.header", "static": True,
                "settings": header_settings,
                "blocks": {
                    "pl_title": {
                        "type": "_product-list-text", "name": "t:names.collection_title",
                        "settings": {
                            "text": "<h3>{{ closest.collection.title }}</h3>", "width": "fit-content",
                            "max_width": "normal", "alignment": "left", "type_preset": "h3",
                            "font": "var(--font-accent--family)", "font_size": "", "line_height": "normal",
                            "letter_spacing": "normal", "case": "none", "wrap": "pretty",
                            "color": "var(--color-foreground-heading)", "background": False,
                            "background_color": "#00000026", "corner_radius": 0, **PAD0,
                        },
                        "blocks": {},
                    },
                    "pl_btn": {
                        "type": "_product-list-button", "name": "t:names.product_list_button",
                        "settings": {
                            "label": "Alle ansehen", "open_in_new_tab": False, "style_class": "link",
                            "width": "fit-content", "custom_width": 100,
                            "width_mobile": "fit-content", "custom_width_mobile": 100,
                        },
                        "blocks": {},
                    },
                },
                "block_order": ["pl_title", "pl_btn"],
            },
            "static-product-card": {
                "type": "_product-card", "name": "t:names.product_card", "static": True,
                "settings": {
                    "product_card_gap": 8, "inherit_color_scheme": True, "color_scheme": "",
                    "border": "none", "border_width": 1, "border_opacity": 100, "border_radius": 0, **PAD0,
                },
                "blocks": {
                    "pc_gallery": {
                        "type": "_product-card-gallery", "name": "t:names.product_card_media",
                        "settings": {
                            "image_ratio": "adapt", "border": "none", "border_width": 1,
                            "border_opacity": 100, "border_radius": 0, **PAD0,
                        },
                        "blocks": {},
                    },
                    "pc_title": {
                        "type": "product-title", "name": "t:names.product_title",
                        "settings": {
                            "width": "100%", "max_width": "normal", "alignment": "left",
                            "type_preset": "rte", "font": "var(--font-body--family)",
                            "font_size": "0.9375rem", "line_height": "normal", "letter_spacing": "normal",
                            "case": "none", "wrap": "pretty", "color": "var(--color-foreground)",
                            "background": False, "background_color": "#00000026", "corner_radius": 0,
                            "padding-block-start": 6, "padding-block-end": 0,
                            "padding-inline-start": 0, "padding-inline-end": 0,
                        },
                        "blocks": {},
                    },
                    "pc_price": {
                        "type": "price", "name": "t:names.product_price",
                        "settings": {
                            "show_sale_price_first": True, "show_installments": False, "show_tax_info": False,
                            "type_preset": "h6", "width": "100%", "alignment": "left",
                            "font": "var(--font-subheading--family)", "font_size": "0.8125rem",
                            "line_height": "normal", "letter_spacing": "normal", "case": "none",
                            "color": "var(--color-primary)", **PAD0,
                        },
                        "blocks": {},
                    },
                },
                "block_order": ["pc_gallery", "pc_title", "pc_price"],
            },
        },
        "name": "Featured collection",
        "settings": {
            "collection": collection, "layout_type": "grid", "carousel_on_mobile": True,
            "max_products": max_products, "columns": 4, "mobile_columns": "2", "mobile_card_size": "60cqw",
            "columns_gap": 8, "rows_gap": 28, "icons_style": "arrow", "icons_shape": "none",
            "section_width": "page-width", "horizontal_alignment": "flex-start", "gap": 24,
            "color_scheme": scheme, "padding-block-start": 56, "padding-block-end": 64,
        },
    }


# ---------------------------------------------------------------- Hero (Live, CTAs angepasst)
hero = {
    "type": "hero",
    "blocks": {
        "text_eyebrow": text_block(
            "<p>KURATIERTE WANDKUNST · ACHT KOLLEKTIONEN</p>", preset="h6",
            font="var(--font-subheading--family)", align="center", case="uppercase",
            spacing="loose", width="100%",
        ),
        "text_YLPk4p": text_block(
            "<h1>FRAME YOUR AMBITION.</h1>", preset="h1", font="var(--font-accent--family)",
            align="center", color="var(--color-foreground-heading)", width="100%",
        ),
        "text_sub": text_block(
            "<p>Wandkunst für Menschen, die mehr vorhaben — ausdrucksstarke Motive im klaren schwarzen Rahmen.</p>",
            align="center", max_width="narrow", width="100%",
        ),
        "button_H9gpTf": {
            "type": "button", "name": "t:names.button",
            "settings": {
                "label": "Jetzt shoppen", "link": "shopify://collections/all", "open_in_new_tab": False,
                "style_class": "button", "width": "fit-content", "custom_width": 100,
                "width_mobile": "fit-content", "custom_width_mobile": 100,
            },
            "blocks": {},
        },
        "button_all": {
            "type": "button", "name": "t:names.button",
            "settings": {
                "label": "New Drop", "link": "shopify://collections/new-drop", "open_in_new_tab": False,
                "style_class": "button-secondary", "width": "fit-content", "custom_width": 100,
                "width_mobile": "fit-content", "custom_width_mobile": 100,
            },
            "blocks": {},
        },
    },
    "block_order": ["text_eyebrow", "text_YLPk4p", "text_sub", "button_H9gpTf", "button_all"],
    "name": "t:names.hero",
    "settings": {
        "media_type_1": "image",
        "image_1": "shopify://shop_images/ChatGPT_Image_13._Juni_2026_21_33_32_c698746d-a67c-476b-aa61-9cf8af17dbf1.png",
        "media_type_2": "image", "stack_media_on_mobile": False, "custom_mobile_media": False,
        "media_type_1_mobile": "image", "media_type_2_mobile": "image", "link": "", "open_in_new_tab": False,
        "content_direction": "column", "vertical_on_mobile": True, "horizontal_alignment": "space-between",
        "vertical_alignment": "flex-end", "align_baseline": True,
        "horizontal_alignment_flex_direction_column": "center",
        "vertical_alignment_flex_direction_column": "center",
        "gap": 20, "section_width": "full-width", "section_height": "full-screen",
        "section_height_custom": 50, "color_scheme": "scheme-6", "toggle_overlay": True,
        "overlay_color": "#0B0B0C59", "overlay_style": "gradient", "gradient_direction": "to top",
        "blurred_reflection": False, "reflection_opacity": 75,
        "padding-block-start": 100, "padding-block-end": 88,
    },
}

# ------------------------------------------------- Benefits-Marquee (aus Dark-Premium portiert)
benefit_texts = ["Kostenloser Versand ab 50 €", "Museumsqualität", "Sichere Zahlung", "14 Tage Rückgaberecht"]
benefits_blocks, benefits_order = {}, []
for i, t in enumerate(benefit_texts, 1):
    benefits_blocks[f"mt{i}"] = text_block(
        f"<p>{t}</p>", preset="custom", font="var(--font-accent--family)", size="0.875rem",
        align="center", case="uppercase", width="fit-content", wrap="nowrap",
    )
    benefits_blocks[f"mi{i}"] = icon_block("star", 14)
    benefits_order += [f"mt{i}", f"mi{i}"]
benefits_marquee = {
    "type": "marquee", "blocks": benefits_blocks, "block_order": benefits_order,
    "name": "Vorteile Laufband",
    "settings": {
        "movement_direction": "normal", "color_scheme": "scheme-3",
        "padding-block-start": 14, "padding-block-end": 14, "gap_between_elements": 48,
    },
}

# ------------------------------------------------------- Kollektionsliste (Live + New Drop = 8)
collection_list = {
    "type": "collection-list",
    "blocks": {
        "group_header": {
            "type": "group", "name": "t:names.header",
            "settings": group_settings(
                gap=8, **{"padding-block-end": 16},
                horizontal_alignment_flex_direction_column="flex-start",
                vertical_alignment_flex_direction_column="center",
            ),
            "blocks": {
                "cl_eyebrow": text_block(
                    "<p>ACHT KOLLEKTIONEN</p>", preset="h6", font="var(--font-subheading--family)",
                    case="uppercase", spacing="loose", width="fit-content",
                ),
                "cl_heading": text_block(
                    "<h2>Finde deinen Stil</h2>", preset="h2", font="var(--font-accent--family)",
                    color="var(--color-foreground-heading)", width="fit-content",
                ),
            },
            "block_order": ["cl_eyebrow", "cl_heading"],
        },
        "static-collection-card": {
            "type": "_collection-card", "name": "t:names.collection_card", "static": True,
            "settings": {
                "horizontal_alignment": "flex-start", "vertical_alignment": "flex-end",
                "placement": "on_image", "inherit_color_scheme": True, "color_scheme": "",
                "border": "none", "border_width": 1, "border_opacity": 100, "border_radius": 0,
            },
            "blocks": {
                "collection-card-image": {
                    "type": "_collection-card-image", "name": "t:names.collection_card_image",
                    "static": True, "settings": {"image_ratio": "portrait"},
                },
                "collection-title": {
                    "type": "collection-title", "name": "t:names.collection_title",
                    "settings": {
                        "type_preset": "h6", "font": "var(--font-accent--family)", "font_size": "",
                        "line_height": "normal", "letter_spacing": "loose", "case": "uppercase",
                        "wrap": "pretty", "width": "fit-content", "max_width": "normal",
                        "alignment": "left", "background": True, "background_color": "#FCFBF7",
                        "padding-block-start": 6, "padding-block-end": 6,
                        "padding-inline-start": 10, "padding-inline-end": 10,
                    },
                },
            },
            "block_order": ["collection-title"],
        },
    },
    "block_order": ["group_header"],
    "name": "t:names.collections_grid",
    "settings": {
        "collection_list": [
            "new-drop", "apex-motorsport-cars", "grit-boxing-mma", "legends-sports-icons",
            "mindset-words-ambition", "still-quiet-luxury", "heritage-timeless-classics",
            "icons-music-culture",
        ],
        "layout_type": "grid", "carousel_on_mobile": True, "columns": 4, "mobile_columns": "2",
        "mobile_card_size": "60cqw", "columns_gap": 8, "rows_gap": 24, "max_collections": 8,
        "icons_style": "arrow", "icons_shape": "none", "section_width": "page-width", "gap": 20,
        "color_scheme": "scheme-1", "padding-block-start": 64, "padding-block-end": 48,
    },
}

# ----------------------------------------------------------------------- Neue Custom-Sektionen
scroll_showcase = {
    "type": "limitless-scroll-showcase",
    "settings": {
        "product": "motivational-framed-poster-its-not-over-until-i-win",
        "eyebrow": "NEW DROP",
        "heading": "Ein Motiv. Deine Wand.",
        "cta_label": "Zum Poster",
        "color_scheme": "scheme-2",
        "section_height": 300,
    },
}

lp_stats = {
    "type": "limitless-stats",
    "settings": {
        "num_1": 99, "suffix_1": "+", "label_1": "Werke",
        "num_2": 8, "suffix_2": "", "label_2": "Kollektionen",
        "num_3": 14, "suffix_3": "", "label_3": "Tage Widerrufsrecht",
        "num_4": 2, "suffix_4": "", "label_4": "Jahre Gewährleistung",
        "color_scheme": "scheme-1", "padding-block-start": 44, "padding-block-end": 44,
    },
}

drop_countdown = {
    "type": "limitless-drop-countdown",
    "settings": {
        "kicker": "NEW DROP",
        "heading_solid": "Neue Motive.",
        "heading_outline": "Regelmäßig.",
        "text": "<p>Frisch kuratierte Motive, sauber gerahmt. Wer den Newsletter abonniert, sieht jeden Drop zuerst.</p>",
        "deadline": "",
        "cta_label": "New Drop ansehen",
        "link": "/collections/new-drop",
        "color_scheme": "scheme-3",
        "padding-block-start": 72, "padding-block-end": 72,
    },
}

# ------------------------------------------------------------ USP-Reihe (aus Dark-Premium portiert)
usp_row = {
    "type": "section",
    "blocks": {
        "usp1": usp_group("USP 1", "star", "Museumsqualität", "Schweres Premium-Papier, satte Farben und brillante Details."),
        "usp2": usp_group("USP 2", "truck", "Schneller Versand", "Gedruckt und versendet aus der EU – schnell bei dir zu Hause."),
        "usp3": usp_group("USP 3", "lock", "Sichere Zahlung", "SSL-verschlüsselt bezahlen – mit den gängigen Zahlungsarten."),
        "usp4": usp_group("USP 4", "return", "Einfache Rückgabe", "14 Tage Widerrufsrecht – ohne Wenn und Aber."),
    },
    "block_order": ["usp1", "usp2", "usp3", "usp4"],
    "name": "Warum Limitless",
    "settings": {
        "content_direction": "row", "vertical_on_mobile": True, "horizontal_alignment": "center",
        "vertical_alignment": "flex-start", "align_baseline": False,
        "horizontal_alignment_flex_direction_column": "center",
        "vertical_alignment_flex_direction_column": "center",
        "gap": 32, "section_width": "page-width", "section_height": "", "section_height_custom": 50,
        "color_scheme": "scheme-2", "background_media": "none", "video_position": "cover",
        "background_image_position": "cover", "border": "none", "border_width": 1,
        "border_opacity": 100, "border_radius": 0, "toggle_overlay": False,
        "overlay_color": "#00000026", "overlay_style": "solid", "gradient_direction": "to top",
        "padding-block-start": 56, "padding-block-end": 56,
    },
}

# ------------------------------------------------------------------ Editorial (Live, unverändert)
editorial_story = {
    "type": "media-with-content",
    "blocks": {
        "media": {
            "type": "_media-without-appearance", "static": True,
            "settings": {
                "media_type": "image", "image": "shopify://shop_images/LP_editorial_room.jpg",
                "link": "", "image_position": "cover",
            },
        },
        "content": {
            "type": "_content-without-appearance", "static": True,
            "settings": {
                "horizontal_alignment_flex_direction_column": "flex-start",
                "vertical_alignment_flex_direction_column": "space-between",
            },
            "blocks": {
                "caption": text_block(
                    "<p>LIMITLESSPOSTER</p>", preset="h6", font="var(--font-subheading--family)",
                    case="uppercase", spacing="loose", width="fit-content",
                ),
                "group": {
                    "type": "group",
                    "settings": {"height": "fit"},
                    "blocks": {
                        "heading": text_block(
                            "<h2>Die Marke ordnet. Das Artwork spricht.</h2>", preset="h3",
                            font="var(--font-accent--family)", color="var(--color-foreground-heading)",
                            width="fit-content",
                        ),
                        "text": text_block(
                            "<p>Ausdrucksstarke Motive aus Motorsport, Sport, Kultur und Mindset — verbunden durch einen klaren schwarzen Rahmen und eine ruhige, galerieartige Inszenierung. Kein Lärm, keine Filter: Das Artwork bleibt unverändert und steht im Mittelpunkt.</p>",
                            max_width="narrow",
                        ),
                    },
                    "block_order": ["heading", "text"],
                },
                "button": {
                    "type": "button",
                    "settings": {
                        "label": "Kollektionen entdecken", "link": "/collections", "open_in_new_tab": False,
                        "style_class": "link", "width": "fit-content", "custom_width": 100,
                        "width_mobile": "fit-content", "custom_width_mobile": 100,
                    },
                },
            },
            "block_order": ["caption", "group", "button"],
        },
    },
    "name": "t:names.editorial",
    "settings": {
        "media_position": "right", "media_width": "medium", "media_height": "60svh",
        "section_width": "page-width", "extend_media": False, "color_scheme": "scheme-3",
        "padding-block-start": 0, "padding-block-end": 0,
    },
}

# ------------------------------------------------------ Statement-CTA (aus Dark-Premium portiert)
statement_cta = {
    "type": "section",
    "blocks": {
        "st_head": text_block(
            "<h2>Umgib dich mit dem, was dich antreibt.</h2>", preset="h2",
            font="var(--font-accent--family)", align="center", max_width="narrow",
            color="var(--color-foreground-heading)", width="100%",
        ),
        "st_sub": text_block(
            "<p>Poster, die mehr sind als Deko – eine tägliche Erinnerung an deine Ziele.</p>",
            preset="custom", size="1.0625rem", align="center", max_width="narrow", width="100%",
            **{"padding-block-end": 8},
        ),
        "st_cta": {
            "type": "button",
            "settings": {
                "label": "Katalog entdecken", "link": "shopify://collections/all", "open_in_new_tab": False,
                "style_class": "button", "width": "fit-content", "custom_width": 100,
                "width_mobile": "fit-content", "custom_width_mobile": 100,
            },
            "blocks": {},
        },
    },
    "block_order": ["st_head", "st_sub", "st_cta"],
    "name": "Statement",
    "settings": {
        "content_direction": "column", "vertical_on_mobile": True, "horizontal_alignment": "center",
        "vertical_alignment": "center", "align_baseline": False,
        "horizontal_alignment_flex_direction_column": "center",
        "vertical_alignment_flex_direction_column": "center",
        "gap": 16, "section_width": "full-width", "section_height": "", "section_height_custom": 50,
        "color_scheme": "scheme-3", "background_media": "none", "video_position": "cover",
        "background_image_position": "cover", "border": "none", "border_width": 1,
        "border_opacity": 100, "border_radius": 0, "toggle_overlay": False,
        "overlay_color": "#00000026", "overlay_style": "solid", "gradient_direction": "to top",
        "padding-block-start": 72, "padding-block-end": 72,
    },
}

# ---------------------------------------------------------------- Brand-Marquee (Live, ans Ende)
brand_marquee = {
    "type": "marquee",
    "blocks": {
        "marq_text": text_block(
            "<p>FRAME YOUR AMBITION&nbsp;&nbsp;·&nbsp;&nbsp;LIMITLESSPOSTER&nbsp;&nbsp;·&nbsp;&nbsp;</p>",
            preset="custom", font="var(--font-accent--family)", size="var(--font-size--h4)",
            line="tight", spacing="loose", case="uppercase", wrap="nowrap", width="fit-content",
            color="var(--color-foreground-heading)",
        ),
    },
    "block_order": ["marq_text"],
    "name": "t:names.marquee_section",
    "settings": {
        "movement_direction": "normal", "color_scheme": "scheme-3",
        "padding-block-start": 18, "padding-block-end": 18, "gap_between_elements": 24,
    },
}

index = {
    "sections": {
        "hero_jVaWmY": hero,
        "benefits_marquee": benefits_marquee,
        "collection_list_lp": collection_list,
        "product_list_newdrop": product_list_section("new-drop", "scheme-1", 8),
        "scroll_showcase": scroll_showcase,
        "lp_stats": lp_stats,
        "usp_row": usp_row,
        "product_list_mindset": product_list_section("mindset-words-ambition", "scheme-2", 8),
        "editorial_story": editorial_story,
        "drop_countdown": drop_countdown,
        "statement_cta": statement_cta,
        "marquee_lp": brand_marquee,
    },
    "order": [
        "hero_jVaWmY", "benefits_marquee", "collection_list_lp", "product_list_newdrop",
        "scroll_showcase", "lp_stats", "usp_row", "product_list_mindset", "editorial_story",
        "drop_countdown", "statement_cta", "marquee_lp",
    ],
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(index, f, ensure_ascii=False, indent=2)
print("written", OUT, os.path.getsize(OUT), "bytes")
