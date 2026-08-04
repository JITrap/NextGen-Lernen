#!/usr/bin/env python3
"""Ersetzt den alten Aufklapp-3D-Block in templates/product.json durch den
versteckten Daten-Block für limitless-experience.js (3D-Kachel + Detail-Zoom
landen über das Script direkt in der Produktgalerie)."""
import json
import os

THEME = os.path.join(os.path.dirname(__file__), "..", "theme")

DATA_LIQUID = r"""{% if product.metafields.custom.poster_detail != blank or product.metafields.custom.poster_3d_url != blank %}
<div
  data-lp-experience
  data-glb="{{ product.metafields.custom.poster_3d_url }}"
  data-title="{{ product.title | escape }}"
  data-img="{{ product.featured_image | image_url: width: 2048 }}"
  hidden
>
  {% if product.metafields.custom.poster_detail != blank %}
    <script type="application/json">{{ product.metafields.custom.poster_detail.value }}</script>
  {% endif %}
</div>
{% endif %}"""

path = os.path.join(THEME, "product.json")
doc = json.load(open(path, encoding="utf-8"))
details = doc["sections"]["main"]["blocks"]["product-details"]
blocks = details["blocks"]
order = details["block_order"]

blocks.pop("custom_liquid_3d", None)
blocks["custom_liquid_experience"] = {
    "type": "custom-liquid",
    "name": "Produkt-Erlebnis (3D + Details)",
    "settings": {"custom_liquid": DATA_LIQUID},
    "blocks": {},
}
if "custom_liquid_3d" in order:
    order[order.index("custom_liquid_3d")] = "custom_liquid_experience"
elif "custom_liquid_experience" not in order:
    anchor = order.index("text_lp_trust") if "text_lp_trust" in order else len(order) - 1
    order.insert(anchor + 1, "custom_liquid_experience")

json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("product.json gepatcht:", os.path.getsize(path), "bytes; order:", order)
