/* ============================================================
   LimitlessPoster — Raum-Galerie (Produktseite)
   Liest Größe/Rahmenfarbe aus dem Varianten-Wähler und skaliert den
   gezeichneten Rahmen maßstabsgetreu an der Wand (cm → Pixel über CSS-
   Variablen). Ansichten: 5 Raum-Szenen, Motiv groß, echte Fotos.
   Ansichten: fuenf gezeichnete Raum-Szenen; das Motiv laesst sich ueber den
   Rahmen in voller Groesse oeffnen.
   Kein Markup aus Daten, keine externen Requests. Globale Listener werden
   genau einmal registriert (Theme-Editor / Section-Reload sicher).
   ============================================================ */
(function () {
  'use strict';

  var SCENE_LABELS = {
    gallery: 'Galerie',
    living: 'Wohnzimmer',
    office: 'Büro',
    bedroom: 'Schlafzimmer',
    gym: 'Home-Gym'
  };

  /* Versteht die Optionswerte seit 02.10.2026 („28 × 36 cm") und die alten
     Printify-Zollwerte („11″ x 14″", „16" x 20""). w/h immer in cm. */
  function parseSize(value) {
    var raw = String(value || '');
    var m = raw
      .replace(/[″”"]/g, '')
      .match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
    if (!m) return null;
    var a = parseFloat(m[1].replace(',', '.'));
    var b = parseFloat(m[2].replace(',', '.'));
    if (!a || !b) return null;
    if (/cm/i.test(raw)) {
      return { wIn: Math.round(a / 2.54), hIn: Math.round(b / 2.54), w: Math.round(a), h: Math.round(b) };
    }
    return { wIn: a, hIn: b, w: Math.round(a * 2.54), h: Math.round(b * 2.54) };
  }

  function isColorValue(value) {
    return /^(black|white|schwarz|wei(ss|ß))$/i.test(String(value || '').trim());
  }

  function isWhite(value) {
    return /white|wei/i.test(String(value || ''));
  }

  function translateValue(value) {
    var size = parseSize(value);
    if (size) return size.w + ' × ' + size.h + ' cm';
    if (isColorValue(value)) return isWhite(value) ? 'Weiß' : 'Schwarz';
    return String(value || '');
  }

  function findPicker(productId) {
    if (!productId) return null;
    return document.querySelector('variant-picker[data-product-id="' + productId + '"]');
  }

  function readSelection(picker) {
    var size = null;
    var color = null;
    if (!picker) return { size: size, color: color };
    var inputs = picker.querySelectorAll('input[type="radio"]:checked, select');
    Array.prototype.forEach.call(inputs, function (el) {
      var value = el.value;
      var parsed = parseSize(value);
      if (parsed && !size) {
        size = parsed;
      } else if (isColorValue(value)) {
        color = value;
      }
    });
    return { size: size, color: color };
  }

  function applySelection(root) {
    var picker = findPicker(root.getAttribute('data-product-id'));
    var sel = readSelection(picker);
    if (sel.size) {
      root.style.setProperty('--lp-pw', String(sel.size.w));
      root.style.setProperty('--lp-ph', String(sel.size.h));
      /* Kleine Formate bekommen einen näheren Wandausschnitt, sonst stand
         das kleinste Poster (28 × 36 cm) als ~75-px-Briefmarke in der Szene.
         --lp-zoom bleibt zwischen 0,72 und 1, damit große Formate weiterhin
         sichtbar größer wirken als kleine — der Größenvergleich bleibt also. */
      var outer = sel.size.w + 4;
      var zoom = 0.72 + 0.28 * Math.min(outer / 65, 1);
      root.style.setProperty('--lp-zoom', (Math.round(zoom * 1000) / 1000).toString());
      var chip = root.querySelector('[data-lp-rg-chip-size]');
      if (chip) chip.textContent = sel.size.w + ' × ' + sel.size.h + ' cm';
    }
    if (sel.color) {
      var frame = root.querySelector('[data-lp-rg-frame-el]');
      var white = isWhite(sel.color);
      if (frame) {
        frame.classList.toggle('lp-frame--white', white);
        frame.classList.toggle('lp-frame--black', !white);
      }
      root.style.setProperty('--lp-thumb-frame', white ? '#F2F0EA' : '#15110F');
    }
  }

  function applyAll() {
    var roots = document.querySelectorAll('[data-lp-rg]');
    Array.prototype.forEach.call(roots, applySelection);
  }

  /* Sticky-Add-to-Cart: Horizon schreibt bei einer nicht existierenden
     Optionskombination die rohen Zoll-Werte in die Leiste — hier in cm/deutsch
     nachziehen (läuft im Bubbling nach dem Section-Listener). */
  function fixStickyTitle(event) {
    if (!event || !event.detail || event.detail.resource != null) return;
    var bars = document.querySelectorAll('sticky-add-to-cart');
    Array.prototype.forEach.call(bars, function (bar) {
      var el = bar.querySelector('.sticky-add-to-cart__variant');
      var picker = findPicker(bar.getAttribute('data-product-id'));
      if (!el || !picker) return;
      var parts = Array.prototype.map.call(picker.querySelectorAll('input:checked'), function (input) {
        return translateValue(input.value);
      }).filter(Boolean);
      if (parts.length) el.textContent = parts.join(' / ');
    });
  }

  function setView(root, button) {
    var stage = root.querySelector('[data-lp-rg-stage]');
    if (!stage) return;
    /* Seit 20.09.2026 gibt es nur noch die gezeichneten Szenen —
       keine Motiv- und keine Foto-Ansicht mehr. */
    var scene = button.getAttribute('data-lp-rg-scene') || '';

    stage.setAttribute('data-view', 'scene');
    if (scene) stage.setAttribute('data-scene', scene);
    if (button.id) stage.setAttribute('aria-labelledby', button.id);

    var tabs = root.querySelectorAll('[data-lp-rg-thumb]');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.setAttribute('aria-selected', tab === button ? 'true' : 'false');
      tab.setAttribute('tabindex', tab === button ? '0' : '-1');
    });

    var chipScene = root.querySelector('[data-lp-rg-chip-scene]');
    if (chipScene) {
      chipScene.textContent = button.getAttribute('data-lp-rg-label') || SCENE_LABELS[scene] || '';
    }
  }

  function onTabKey(root, event) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-lp-rg-thumb]'));
    var idx = tabs.indexOf(document.activeElement);
    if (idx < 0 || !tabs.length) return;
    var next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = tabs[(idx + 1) % tabs.length];
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = tabs[(idx - 1 + tabs.length) % tabs.length];
    else if (event.key === 'Home') next = tabs[0];
    else if (event.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    event.preventDefault();
    next.focus();
    setView(root, next);
  }

  function init(root) {
    if (root.hasAttribute('data-lp-rg-init')) return;
    root.setAttribute('data-lp-rg-init', '');
    applySelection(root);

    var tabs = root.querySelectorAll('[data-lp-rg-thumb]');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () { setView(root, tab); });
    });
    var list = root.querySelector('[data-lp-rg-thumbs]');
    if (list) list.addEventListener('keydown', function (e) { onTabKey(root, e); });

    /* Lupe: Die Raum-Galerie ersetzt die Horizon-Lightbox — ohne eigene
       Vergrößerung ließ sich das Motiv nirgends groß prüfen. */
    var zoomBtn = root.querySelector('[data-lp-rg-zoom]');
    var dialog = root.querySelector('[data-lp-rg-zoom-dialog]');
    if (zoomBtn && dialog && typeof dialog.showModal === 'function') {
      zoomBtn.addEventListener('click', function () {
        dialog.showModal();
      });
      dialog.addEventListener('close', function () { zoomBtn.focus(); });
      var closeBtn = root.querySelector('[data-lp-rg-zoom-close]');
      if (closeBtn) closeBtn.addEventListener('click', function () { dialog.close(); });
      /* Klick auf den Hintergrund schließt ebenfalls. */
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) dialog.close();
      });
      /* Der Hinweis liegt neben dem Rahmen, nicht darin — sonst waere er die
         einzige sichtbare Aufforderung, auf die ein Klick nichts bewirkt. */
      var hintBtn = root.querySelector('[data-lp-rg-zoom-hint]');
      if (hintBtn) hintBtn.addEventListener('click', function () { dialog.showModal(); });
    } else if (zoomBtn) {
      /* Kein <dialog>-Support: Der Rahmen bleibt sichtbar, verspricht aber
         keine Vergroesserung mehr. */
      zoomBtn.style.cursor = 'default';
      zoomBtn.removeAttribute('aria-label');
      var hint = root.querySelector('[data-lp-rg-zoom-hint]');
      if (hint) hint.hidden = true;
    }
  }

  function boot() {
    var roots = document.querySelectorAll('[data-lp-rg]');
    Array.prototype.forEach.call(roots, init);
  }

  if (!window.__lpRoomsBound) {
    window.__lpRoomsBound = true;
    document.addEventListener('change', function (event) {
      var target = event.target;
      if (target && target.closest && target.closest('variant-picker')) applyAll();
    });
    document.addEventListener('variant:update', function (event) {
      applyAll();
      fixStickyTitle(event);
    });
    document.addEventListener('shopify:section:load', boot);

    /* Das Quick-Add-Fenster holt die Produktseite per fetch und morpht sie in
       einen Dialog — dabei feuert weder DOMContentLoaded noch
       shopify:section:load. Ohne diesen Beobachter blieben dort die
       Szenen-Reiter und die Lupe ohne Funktion. */
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var added = records[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var node = added[j];
            if (!node || node.nodeType !== 1) continue;
            if (node.matches && node.matches('[data-lp-rg]')) init(node);
            if (node.querySelectorAll) {
              Array.prototype.forEach.call(node.querySelectorAll('[data-lp-rg]'), init);
            }
          }
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
