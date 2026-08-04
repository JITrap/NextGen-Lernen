/* LimitlessPoster — Produkt-Erlebnis
   Kachel 1: interaktive 3D-Ansicht (Tilt + Fullscreen model-viewer)
   Kachel 2: Detail-Zoom mit Plus-Markern (Rahmen / Glas / Design)
   Datenquelle: custom-liquid-Block [data-lp-experience] im Produkt-Template
   (GLB-URL + Metafield custom.poster_detail mit Bild, Region, Marker-Punkten). */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MV_SRC = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
  var ZOOM = 2.2;

  var SPOTS = {
    rahmen: {
      label: 'Rahmen',
      text: 'Holzrahmen in Schwarz oder Weiß — matt, aufhängfertig montiert.'
    },
    glas: {
      label: 'Glas',
      text: 'Bruchsichere Plexiglas-Front — klar, leicht und blendarm.'
    },
    design: {
      label: 'Design',
      text: 'Mattes Archivpapier, brillante Pigmenttinten — dauerhaft farbecht.'
    }
  };
  var SPOT_KEYS = ['rahmen', 'glas', 'design'];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function plusSvg() {
    return '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
      '<line x1="10" y1="4.5" x2="10" y2="15.5"/><line x1="4.5" y1="10" x2="15.5" y2="10"/></svg>';
  }

  /* ---------- Daten ---------- */

  function readContext() {
    var host = document.querySelector('[data-lp-experience]');
    if (!host) return null;
    var detail = {};
    var json = host.querySelector('script[type="application/json"]');
    if (json) {
      try { detail = JSON.parse(json.textContent) || {}; } catch (e) { detail = {}; }
    }
    var img = detail.img || host.getAttribute('data-img') || '';
    if (!img) return null;
    return {
      host: host,
      glb: host.getAttribute('data-glb') || '',
      title: host.getAttribute('data-title') || 'Poster',
      img: img,
      region: Array.isArray(detail.region) && detail.region.length === 4
        ? detail.region : [0, 0, 1, 1],
      spots: detail.spots || {
        rahmen: [0.18, 0.14], glas: [0.72, 0.24], design: [0.5, 0.55]
      }
    };
  }

  /* ---------- Kachel-Grundgerüst (Bild auf Region zugeschnitten) ---------- */

  function tileBase(ctx, cls) {
    var r = ctx.region;
    var rw = r[2] - r[0];
    var rh = r[3] - r[1];
    var tile = el('div', 'lp-xp-tile ' + cls);
    tile.style.aspectRatio = (rw / rh).toFixed(4);
    var canvas = el('div', 'lp-xp-canvas');
    var img = document.createElement('img');
    img.src = ctx.img;
    img.alt = '';
    img.loading = 'lazy';
    img.draggable = false;
    img.style.width = (100 / rw).toFixed(2) + '%';
    img.style.height = (100 / rh).toFixed(2) + '%';
    img.style.left = (-r[0] / rw * 100).toFixed(2) + '%';
    img.style.top = (-r[1] / rh * 100).toFixed(2) + '%';
    canvas.appendChild(img);
    tile.appendChild(canvas);
    return { tile: tile, canvas: canvas };
  }

  /* ---------- Kachel 1: 3D ---------- */

  function attachTilt(tile, canvas) {
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    function loop() {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      canvas.style.transform =
        'perspective(900px) rotateX(' + cy.toFixed(2) + 'deg) rotateY(' + cx.toFixed(2) + 'deg)';
      if (Math.abs(cx - tx) > 0.05 || Math.abs(cy - ty) > 0.05) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }
    tile.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var rect = tile.getBoundingClientRect();
      tx = ((e.clientX - rect.left) / rect.width - 0.5) * 16;
      ty = -((e.clientY - rect.top) / rect.height - 0.5) * 11;
      kick();
    });
    tile.addEventListener('pointerleave', function () { tx = 0; ty = 0; kick(); });
  }

  function build3d(ctx) {
    var b = tileBase(ctx, 'lp-xp-3d');
    var tile = b.tile;
    tile.setAttribute('role', 'button');
    tile.tabIndex = 0;
    tile.setAttribute('aria-label', '3D-Ansicht öffnen — ' + ctx.title);
    tile.appendChild(el('span', 'lp-xp-badge', '3D'));
    tile.appendChild(el('span', 'lp-xp-hint', 'Ansehen & drehen'));
    if (!REDUCED) attachTilt(tile, b.canvas);
    function open() { openOverlay(ctx); }
    tile.addEventListener('click', open);
    tile.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    return tile;
  }

  /* ---------- Fullscreen-Overlay mit model-viewer ---------- */

  var overlay = null;
  var mvReady = null;
  var restoreFocus = null;

  function ensureModelViewer() {
    if (window.customElements && window.customElements.get('model-viewer')) {
      return Promise.resolve();
    }
    if (!mvReady) {
      mvReady = new Promise(function (resolve) {
        var s = document.createElement('script');
        s.type = 'module';
        s.src = MV_SRC;
        s.onload = resolve;
        document.head.appendChild(s);
      });
    }
    return mvReady;
  }

  function closeOverlay() {
    if (!overlay) return;
    overlay.setAttribute('hidden', '');
    document.documentElement.classList.remove('lp-xp-lock');
    if (restoreFocus && restoreFocus.focus) restoreFocus.focus();
    restoreFocus = null;
  }

  function buildOverlay(ctx) {
    var o = el('div', 'lp-xp-overlay');
    o.setAttribute('hidden', '');
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-label', '3D-Ansicht — ' + ctx.title);
    var inner = el('div', 'lp-xp-overlay-inner');
    var head = el('div', 'lp-xp-overlay-head');
    head.appendChild(el('span', 'lp-xp-overlay-title', ctx.title));
    var close = el('button', 'lp-xp-overlay-close');
    close.type = 'button';
    close.setAttribute('aria-label', '3D-Ansicht schließen');
    close.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true">' +
      '<line x1="5" y1="5" x2="15" y2="15"/><line x1="15" y1="5" x2="5" y2="15"/></svg>';
    close.addEventListener('click', closeOverlay);
    head.appendChild(close);
    inner.appendChild(head);
    inner.appendChild(el('div', 'lp-xp-overlay-stage'));
    inner.appendChild(el('p', 'lp-xp-overlay-hint', 'Ziehen zum Drehen · Scrollen zum Zoomen'));
    o.appendChild(inner);
    o.addEventListener('click', function (e) { if (e.target === o) closeOverlay(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay && !overlay.hasAttribute('hidden')) closeOverlay();
    });
    return o;
  }

  function openOverlay(ctx) {
    if (!ctx.glb) return;
    if (!overlay) {
      overlay = buildOverlay(ctx);
      document.body.appendChild(overlay);
    }
    restoreFocus = document.activeElement;
    overlay.removeAttribute('hidden');
    document.documentElement.classList.add('lp-xp-lock');
    overlay.querySelector('.lp-xp-overlay-close').focus();
    ensureModelViewer().then(function () {
      var stage = overlay.querySelector('.lp-xp-overlay-stage');
      if (stage.querySelector('model-viewer')) return;
      var mv = document.createElement('model-viewer');
      mv.setAttribute('src', ctx.glb);
      mv.setAttribute('alt', ctx.title + ' — gerahmtes Poster als 3D-Modell');
      mv.setAttribute('camera-controls', '');
      if (!REDUCED) mv.setAttribute('auto-rotate', '');
      mv.setAttribute('shadow-intensity', '1');
      mv.setAttribute('exposure', '1.05');
      mv.setAttribute('camera-orbit', '15deg 82deg 105%');
      mv.setAttribute('touch-action', 'pan-y');
      stage.appendChild(mv);
    });
  }

  /* ---------- Kachel 2: Detail-Zoom mit Plus-Markern ---------- */

  function buildDetail(ctx) {
    var b = tileBase(ctx, 'lp-xp-detail');
    var tile = b.tile;
    var canvas = b.canvas;
    var r = ctx.region;
    var rw = r[2] - r[0];
    var rh = r[3] - r[1];
    var tabs = {};
    var current = null;

    tile.appendChild(el('span', 'lp-xp-badge lp-xp-badge--outline', 'Details'));

    var spotsWrap = el('div', 'lp-xp-spots');
    var caption = el('div', 'lp-xp-caption');
    caption.setAttribute('hidden', '');
    var tabsWrap = el('div', 'lp-xp-caption-tabs');
    var text = el('p', 'lp-xp-caption-text');

    function place(key) {
      var s = ctx.spots[key];
      return {
        x: (s[0] - r[0]) / rw * 100,
        y: (s[1] - r[1]) / rh * 100
      };
    }

    function zoomTo(key) {
      if (!ctx.spots[key]) return;
      current = key;
      var p = place(key);
      canvas.style.transformOrigin = p.x.toFixed(2) + '% ' + p.y.toFixed(2) + '%';
      canvas.style.transform = 'scale(' + ZOOM + ')';
      tile.classList.add('lp-xp-zoomed');
      text.textContent = SPOTS[key].text;
      SPOT_KEYS.forEach(function (k) {
        if (tabs[k]) tabs[k].setAttribute('aria-pressed', k === key ? 'true' : 'false');
      });
      caption.removeAttribute('hidden');
    }

    function reset() {
      current = null;
      canvas.style.transform = '';
      tile.classList.remove('lp-xp-zoomed');
      caption.setAttribute('hidden', '');
    }

    SPOT_KEYS.forEach(function (key) {
      if (!ctx.spots[key]) return;
      var p = place(key);
      var spot = document.createElement('button');
      spot.type = 'button';
      spot.className = 'lp-xp-spot lp-xp-spot--' + key;
      spot.setAttribute('aria-label', SPOTS[key].label + ' — Detail ansehen');
      spot.style.left = p.x.toFixed(2) + '%';
      spot.style.top = p.y.toFixed(2) + '%';
      spot.innerHTML = plusSvg();
      spot.addEventListener('click', function (e) {
        e.stopPropagation();
        zoomTo(key);
      });
      spotsWrap.appendChild(spot);

      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'lp-xp-caption-tab';
      tab.textContent = SPOTS[key].label;
      tab.setAttribute('aria-pressed', 'false');
      tab.addEventListener('click', function (e) {
        e.stopPropagation();
        zoomTo(key);
      });
      tabs[key] = tab;
      tabsWrap.appendChild(tab);
    });

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'lp-xp-caption-close';
    close.setAttribute('aria-label', 'Zoom schließen');
    close.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true">' +
      '<line x1="5" y1="5" x2="15" y2="15"/><line x1="15" y1="5" x2="5" y2="15"/></svg>';
    close.addEventListener('click', function (e) { e.stopPropagation(); reset(); });

    caption.appendChild(tabsWrap);
    caption.appendChild(text);
    caption.appendChild(close);

    canvas.addEventListener('click', function () { if (current) reset(); });

    tile.appendChild(spotsWrap);
    tile.appendChild(caption);
    return tile;
  }

  /* ---------- Einbau in die Galerie ---------- */

  function wrapLi(tile) {
    var li = el('li', 'product-media-container lp-xp-item');
    li.appendChild(tile);
    return li;
  }

  function injectGrid(grid, ctx) {
    if (grid.querySelector('.lp-xp-item')) return;
    var first = grid.querySelector('li');
    var li3d = wrapLi(build3d(ctx));
    var liDetail = wrapLi(buildDetail(ctx));
    if (first) {
      first.after(li3d, liDetail);
    } else {
      grid.appendChild(li3d);
      grid.appendChild(liDetail);
    }
  }

  function injectMobile(gallery, ctx, always) {
    if (gallery.querySelector('.lp-xp-mobile')) return;
    var wrap = el('div', 'lp-xp-mobile' + (always ? ' lp-xp-mobile--always' : ''));
    wrap.appendChild(build3d(ctx));
    wrap.appendChild(buildDetail(ctx));
    gallery.appendChild(wrap);
  }

  function inject(ctx) {
    var gallery = document.querySelector('media-gallery');
    if (gallery) {
      var grid = gallery.querySelector('ul.media-gallery__grid');
      if (grid) {
        injectGrid(grid, ctx);
        injectMobile(gallery, ctx, false);
      } else {
        // Carousel-Darstellung: Kacheln auf allen Viewports unter dem Slider
        injectMobile(gallery, ctx, true);
      }
      return true;
    }
    return false;
  }

  function watch(ctx) {
    // Variantenwechsel rendert die Galerie neu (Morph) — Kacheln wieder einsetzen
    var section = ctx.host.closest('.shopify-section') || document.body;
    var pending = false;
    var mo = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        inject(ctx);
      });
    });
    mo.observe(section, { childList: true, subtree: true });
  }

  function init() {
    var ctx = readContext();
    if (!ctx || ctx.host.hasAttribute('data-lp-done')) return;
    ctx.host.setAttribute('data-lp-done', '');
    if (inject(ctx)) {
      watch(ctx);
    } else {
      // Fallback: sichtbar unterhalb der Produktdetails rendern
      ctx.host.removeAttribute('hidden');
      var wrap = el('div', 'lp-xp-mobile lp-xp-mobile--always');
      wrap.appendChild(build3d(ctx));
      wrap.appendChild(buildDetail(ctx));
      ctx.host.appendChild(wrap);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('shopify:section:load', init);
})();
