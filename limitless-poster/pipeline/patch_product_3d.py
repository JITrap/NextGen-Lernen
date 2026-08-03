#!/usr/bin/env python3
"""Fügt den 3D-Viewer-Block (model-viewer, klickbar) in templates/product.json ein."""
import json
import os

THEME = os.path.join(os.path.dirname(__file__), "..", "theme")

VIEWER_LIQUID = r"""{% if product.metafields.custom.poster_3d_url != blank %}
<details class="lp-3d-viewer">
  <summary>3D-Ansicht &mdash; Poster ansehen &amp; drehen</summary>
  <div class="lp-3d-viewer__stage" data-lp-3d data-src="{{ product.metafields.custom.poster_3d_url }}"></div>
</details>
<script>
  (function () {
    document.querySelectorAll('details.lp-3d-viewer:not([data-init])').forEach(function (d) {
      d.setAttribute('data-init', '');
      d.addEventListener('toggle', function () {
        if (!d.open) return;
        var stage = d.querySelector('[data-lp-3d]');
        if (!stage || stage.querySelector('model-viewer')) return;
        var ready = (window.customElements && window.customElements.get('model-viewer'))
          ? Promise.resolve()
          : new Promise(function (res) {
              var s = document.createElement('script');
              s.type = 'module';
              s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
              s.onload = res;
              document.head.appendChild(s);
            });
        ready.then(function () {
          var mv = document.createElement('model-viewer');
          mv.setAttribute('src', stage.getAttribute('data-src'));
          mv.setAttribute('alt', 'Gerahmtes Poster als interaktives 3D-Modell');
          mv.setAttribute('camera-controls', '');
          mv.setAttribute('auto-rotate', '');
          mv.setAttribute('shadow-intensity', '1');
          mv.setAttribute('exposure', '1.05');
          mv.setAttribute('camera-orbit', '15deg 82deg 105%');
          mv.setAttribute('touch-action', 'pan-y');
          stage.appendChild(mv);
        });
      });
    });
  })();
</script>
<style>
  .lp-3d-viewer { border-block: 1px solid var(--color-border, rgba(0,0,0,.15)); }
  .lp-3d-viewer summary {
    cursor: pointer; padding: 14px 0; list-style: none;
    font-family: var(--font-subheading--family); font-size: 0.75rem;
    letter-spacing: 0.12em; text-transform: uppercase;
    display: flex; align-items: center; gap: 10px;
  }
  .lp-3d-viewer summary::-webkit-details-marker { display: none; }
  .lp-3d-viewer summary::before { content: "\25C7"; color: var(--lp-cobalt, #3157FF); }
  .lp-3d-viewer[open] summary::before { content: "\25C6"; }
  .lp-3d-viewer model-viewer { width: 100%; height: 420px; background: #F4F1EA; }
</style>
{% endif %}"""

path = os.path.join(THEME, "product.json")
doc = json.load(open(path, encoding="utf-8"))
details = doc["sections"]["main"]["blocks"]["product-details"]
details["blocks"]["custom_liquid_3d"] = {
    "type": "custom-liquid",
    "name": "3D-Ansicht",
    "settings": {"custom_liquid": VIEWER_LIQUID},
    "blocks": {},
}
order = details["block_order"]
if "custom_liquid_3d" not in order:
    anchor = order.index("text_lp_trust") if "text_lp_trust" in order else len(order) - 1
    order.insert(anchor + 1, "custom_liquid_3d")
json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("product.json gepatcht:", os.path.getsize(path), "bytes; order:", order)
