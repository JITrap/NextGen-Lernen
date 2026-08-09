/* LimitlessPoster — Displate-Style Produktgalerie
   Startansicht 3D (model-viewer inline), Thumbnail-Rail, Detail-Tour mit
   Plus-Markern (Rahmen/Glas/Design), Fullscreen-3D. Varianten-Morph-sicher:
   das Liquid rendert die Galerie pro Variante neu, dieses Script bindet
   per Delegation auf der Galerie-Wurzel und synchronisiert nach jedem Morph. */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MV_SRC = 'https://cdn.shopify.com/s/files/1/0976/9979/1181/files/lp5-model-viewer.min.js?v=1786123026';
  var MV_FALLBACK = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
  var ZOOM = 2.4;
  var TOUR = ['rahmen', 'glas', 'design', 'rueckseite'];
  var BACK_ORBIT = '198deg 82deg 108%';
  var SPOTS = {
    rahmen: {
      label: 'Rahmen',
      text: 'Holzrahmen in Schwarz oder Weiß — matt, auf Gehrung gefertigt und aufhängfertig montiert.'
    },
    glas: {
      label: 'Glas',
      text: 'Bruchsichere Plexiglas-Front — klar, leicht und blendarm.'
    },
    design: {
      label: 'Design',
      text: 'Mattes Archivpapier, brillante Pigmenttinten — dauerhaft farbecht.'
    },
    rueckseite: {
      label: 'Rückseite',
      text: 'MDF-Rückwand mit zwei Zackenaufhängern und Wandabstandshaltern — auspacken, aufhängen, fertig.'
    }
  };

  var mvReady = null;
  var overlay = null;
  var overlayRestore = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function readData(root) {
    var s = root.querySelector('script[data-lp-data]');
    if (!s) return {};
    try { return JSON.parse(s.textContent) || {}; } catch (e) { return {}; }
  }

  function ensureMV() {
    if (window.customElements && window.customElements.get('model-viewer')) {
      return Promise.resolve();
    }
    if (!mvReady) {
      mvReady = new Promise(function (resolve) {
        var s = document.createElement('script');
        s.type = 'module';
        s.src = MV_SRC;
        s.onload = resolve;
        s.onerror = function () {
          var f = document.createElement('script');
          f.type = 'module';
          f.src = MV_FALLBACK;
          f.onload = resolve;
          document.head.appendChild(f);
        };
        document.head.appendChild(s);
      });
    }
    return mvReady;
  }

  function makeViewer(d, poster) {
    var mv = document.createElement('model-viewer');
    mv.setAttribute('src', d.glb);
    mv.setAttribute('alt', d.title + ' — gerahmtes Poster als interaktives 3D-Modell');
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('interaction-prompt', 'none');
    if (!REDUCED) {
      mv.setAttribute('auto-rotate', '');
      mv.setAttribute('auto-rotate-delay', '1600');
      mv.setAttribute('rotation-per-second', '18deg');
    }
    mv.setAttribute('environment-image', d.env || 'neutral');
    mv.setAttribute('tone-mapping', 'neutral');
    mv.setAttribute('exposure', '1.05');
    mv.setAttribute('interpolation-decay', '150');
    mv.setAttribute('shadow-intensity', '1');
    mv.setAttribute('shadow-softness', '0.9');
    mv.setAttribute('camera-orbit', '18deg 82deg 108%');
    mv.setAttribute('min-camera-orbit', 'auto auto 55%');
    mv.setAttribute('max-camera-orbit', 'auto auto 160%');
    mv.setAttribute('touch-action', 'pan-y');
    mv.setAttribute('ar', '');
    mv.setAttribute('ar-modes', 'webxr scene-viewer');
    if (poster) mv.setAttribute('poster', poster);
    var arBtn = document.createElement('button');
    arBtn.type = 'button';
    arBtn.setAttribute('slot', 'ar-button');
    arBtn.className = 'lp-ar-btn';
    arBtn.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2 3 6v8l7 4 7-4V6l-7-4Zm0 0v8m0 0-7-4m7 4 7-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> In deinem Raum ansehen';
    mv.appendChild(arBtn);
    return mv;
  }

  /* ---------- 3D-Panel ---------- */

  function mount3d(root) {
    var mount = root.querySelector('.lp-3d-mount');
    if (!mount) return;
    var d = readData(root);
    if (!d.glb) return;
    if (mount.dataset.state === d.glb) return;
    mount.dataset.state = d.glb;
    mount.innerHTML = '';
    var loading = root.querySelector('[data-lp-3d-loading]');
    if (loading) loading.removeAttribute('hidden');
    ensureMV().then(function () {
      if (mount.dataset.state !== d.glb || mount.querySelector('model-viewer')) return;
      var mv = makeViewer(d, mount.getAttribute('data-poster'));
      mv.addEventListener('load', function () {
        var l = root.querySelector('[data-lp-3d-loading]');
        if (l) l.setAttribute('hidden', '');
        prefetchVariants(d);
      });
      mount.appendChild(mv);
    });
  }

  /* Die übrigen Größen-GLBs derselben Farbe im Leerlauf vorwärmen, damit der
     Wechsel der Größen-Variante ohne sichtbares Nachladen auskommt. */
  var prefetched = {};
  function prefetchVariants(d) {
    if (!d.map) return;
    var idle = window.requestIdleCallback || function (fn) { setTimeout(fn, 1200); };
    idle(function () {
      Object.keys(d.map).forEach(function (k) {
        var u = d.map[k];
        if (!u || u === d.glb || prefetched[u]) return;
        prefetched[u] = true;
        fetch(u).catch(function () { delete prefetched[u]; });
      });
    });
  }

  /* Rückseiten-Ansicht: 3D-Panel aktivieren und die Kamera weich nach hinten
     fahren (model-viewer interpoliert Attributwechsel selbst). */
  function showBack(root) {
    activate(root, '3d');
    ensureMV().then(function () {
      requestAnimationFrame(function () {
        var mv = root.querySelector('.lp-3d-mount model-viewer');
        if (!mv) return;
        var go = function () {
          mv.removeAttribute('auto-rotate');
          mv.setAttribute('camera-orbit', BACK_ORBIT);
        };
        if (mv.loaded) go();
        else mv.addEventListener('load', go, { once: true });
        showBackCard(root);
      });
    });
  }

  /* Info-Karte zur Rückseite direkt im 3D-Panel — mit Weg zurück zur Tour. */
  function removeBackCard(root) {
    var c = root.querySelector('.lp-dcard--back');
    if (c) c.remove();
  }

  function showBackCard(root) {
    var panel = root.querySelector('.lp-panel--3d');
    if (!panel || panel.querySelector('.lp-dcard--back')) return;
    var card = el('div', 'lp-dcard lp-dcard--back');
    card.setAttribute('data-side', 'left');
    card.style.setProperty('--cy', '50%');
    card.innerHTML =
      '<div class="lp-dcard-head"><strong class="lp-dcard-title">' + SPOTS.rueckseite.label + '</strong>' +
      '<span class="lp-dcard-idx">04/04</span></div>' +
      '<p class="lp-dcard-text">' + SPOTS.rueckseite.text + '</p>' +
      '<div class="lp-dcard-nav">' +
      '<button type="button" class="lp-dcard-btn" data-dback-tour aria-label="Zurück zur Detail-Tour">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6"/></svg></button>' +
      '<button type="button" class="lp-dcard-btn lp-dcard-close" data-dback-close aria-label="Hinweis schließen">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><line x1="5" y1="5" x2="15" y2="15"/><line x1="15" y1="5" x2="5" y2="15"/></svg></button>' +
      '</div>';
    card.addEventListener('click', function (e) {
      var mv = root.querySelector('.lp-3d-mount model-viewer');
      if (e.target.closest('[data-dback-tour]')) {
        removeBackCard(root);
        if (mv) mv.setAttribute('camera-orbit', '18deg 82deg 108%');
        activate(root, 'detail');
      } else if (e.target.closest('[data-dback-close]')) {
        removeBackCard(root);
      }
    });
    panel.appendChild(card);
  }

  /* ---------- Fullscreen-Overlay ---------- */

  function closeOverlay() {
    if (!overlay) return;
    overlay.setAttribute('hidden', '');
    var stage = overlay.querySelector('.lp-xp-overlay-stage');
    if (stage) stage.innerHTML = '';
    document.documentElement.classList.remove('lp-xp-lock');
    if (overlayRestore && overlayRestore.focus) overlayRestore.focus();
    overlayRestore = null;
  }

  function openOverlay(root) {
    var d = readData(root);
    if (!d.glb) return;
    if (!overlay) {
      overlay = el('div', 'lp-xp-overlay');
      overlay.setAttribute('hidden', '');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      var inner = el('div', 'lp-xp-overlay-inner');
      var head = el('div', 'lp-xp-overlay-head');
      head.appendChild(el('span', 'lp-xp-overlay-title', ''));
      var close = el('button', 'lp-xp-overlay-close');
      close.type = 'button';
      close.setAttribute('aria-label', '3D-Ansicht schließen');
      close.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><line x1="5" y1="5" x2="15" y2="15"/><line x1="15" y1="5" x2="5" y2="15"/></svg>';
      close.addEventListener('click', closeOverlay);
      head.appendChild(close);
      inner.appendChild(head);
      inner.appendChild(el('div', 'lp-xp-overlay-stage'));
      inner.appendChild(el('p', 'lp-xp-overlay-hint', 'Ziehen zum Drehen · Scrollen zum Zoomen'));
      overlay.appendChild(inner);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay && !overlay.hasAttribute('hidden')) closeOverlay();
      });
      document.body.appendChild(overlay);
    }
    overlay.setAttribute('aria-label', '3D-Ansicht — ' + d.title);
    overlay.querySelector('.lp-xp-overlay-title').textContent = d.title;
    overlayRestore = document.activeElement;
    overlay.removeAttribute('hidden');
    document.documentElement.classList.add('lp-xp-lock');
    overlay.querySelector('.lp-xp-overlay-close').focus();
    ensureMV().then(function () {
      var stage = overlay.querySelector('.lp-xp-overlay-stage');
      if (!stage.querySelector('model-viewer')) {
        stage.appendChild(makeViewer(d, null));
      }
    });
  }

  /* ---------- Detail-Tour ---------- */

  function buildDetail(root) {
    var panel = root.querySelector('[data-panel="detail"]');
    if (!panel || panel.dataset.built) return;
    var d = readData(root);
    var dd = d.detail;
    if (!dd || !dd.img || !dd.region || !dd.spots) return;
    panel.dataset.built = '1';
    panel.innerHTML = '';

    var r = dd.region;
    var rw = r[2] - r[0];
    var rh = r[3] - r[1];
    var current = null;

    // Panel-Seitenverhältnis folgt jetzt der Größen-Variante — die Leinwand
    // wird deshalb auf das Regions-Verhältnis fixiert und zentriert (contain),
    // sonst verzerren die unabhängigen Breiten-/Höhen-Prozente das Bild.
    panel.style.setProperty('--lp-detail-ratio', (rw / rh).toFixed(4));

    var canvas = el('div', 'lp-detail-canvas');
    var img = document.createElement('img');
    img.src = dd.img;
    img.alt = '';
    img.draggable = false;
    img.style.width = (100 / rw).toFixed(2) + '%';
    img.style.height = (100 / rh).toFixed(2) + '%';
    img.style.left = (-r[0] / rw * 100).toFixed(2) + '%';
    img.style.top = (-r[1] / rh * 100).toFixed(2) + '%';
    canvas.appendChild(img);
    panel.appendChild(canvas);

    function place(key) {
      var s = dd.spots[key];
      return { x: (s[0] - r[0]) / rw * 100, y: (s[1] - r[1]) / rh * 100 };
    }

    var spotsWrap = el('div', 'lp-detail-spots');
    TOUR.forEach(function (key) {
      var isBack = key === 'rueckseite';
      if (isBack ? !d.glb : !dd.spots[key]) return;
      var p = isBack ? { x: 84, y: 87 } : place(key);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lp-spot';
      b.setAttribute('data-spot', key);
      b.setAttribute('aria-label', SPOTS[key].label + ' — Detail ansehen');
      b.style.left = p.x.toFixed(2) + '%';
      b.style.top = p.y.toFixed(2) + '%';
      b.innerHTML = '<span class="lp-spot-plus"><svg viewBox="0 0 20 20" aria-hidden="true">' +
        '<line x1="10" y1="4.5" x2="10" y2="15.5"/><line x1="4.5" y1="10" x2="15.5" y2="10"/></svg></span>' +
        '<span class="lp-spot-label">' + SPOTS[key].label + '</span>';
      spotsWrap.appendChild(b);
    });
    panel.appendChild(spotsWrap);

    var card = el('div', 'lp-dcard');
    card.setAttribute('hidden', '');
    card.innerHTML =
      '<div class="lp-dcard-head"><strong class="lp-dcard-title"></strong>' +
      '<span class="lp-dcard-idx"></span></div>' +
      '<p class="lp-dcard-text"></p>' +
      '<div class="lp-dcard-nav">' +
      '<button type="button" class="lp-dcard-btn" data-dnav="-1" aria-label="Vorheriges Detail">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6"/></svg></button>' +
      '<button type="button" class="lp-dcard-btn" data-dnav="1" aria-label="Nächstes Detail">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4l6 6-6 6"/></svg></button>' +
      '<button type="button" class="lp-dcard-btn lp-dcard-close" data-dclose aria-label="Zoom schließen">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><line x1="5" y1="5" x2="15" y2="15"/><line x1="15" y1="5" x2="5" y2="15"/></svg></button>' +
      '</div>';
    panel.appendChild(card);

    var keys = TOUR.filter(function (k) {
      return k === 'rueckseite' ? !!d.glb : !!dd.spots[k];
    });

    function zoomTo(key) {
      if (key === 'rueckseite') { reset(); showBack(root); return; }
      current = key;
      var p = place(key);
      canvas.style.transformOrigin = p.x.toFixed(2) + '% ' + p.y.toFixed(2) + '%';
      canvas.style.transform = 'scale(' + ZOOM + ')';
      panel.classList.add('lp-zoomed');
      card.querySelector('.lp-dcard-title').textContent = SPOTS[key].label;
      card.querySelector('.lp-dcard-idx').textContent =
        '0' + (keys.indexOf(key) + 1) + '/0' + keys.length;
      card.querySelector('.lp-dcard-text').textContent = SPOTS[key].text;
      card.style.setProperty('--cy', Math.min(78, Math.max(22, p.y)) + '%');
      card.setAttribute('data-side', p.x < 50 ? 'right' : 'left');
      card.removeAttribute('hidden');
    }

    function reset() {
      current = null;
      canvas.style.transform = '';
      panel.classList.remove('lp-zoomed');
      card.setAttribute('hidden', '');
    }

    panel.addEventListener('click', function (e) {
      var spot = e.target.closest('.lp-spot');
      if (spot) { zoomTo(spot.getAttribute('data-spot')); return; }
      var nav = e.target.closest('[data-dnav]');
      if (nav && current) {
        var i = keys.indexOf(current) + parseInt(nav.getAttribute('data-dnav'), 10);
        zoomTo(keys[(i + keys.length) % keys.length]);
        return;
      }
      if (e.target.closest('[data-dclose]')) { reset(); return; }
      if (current && e.target.closest('.lp-detail-canvas')) reset();
    });
  }

  /* ---------- Größenvergleich ----------
     Minimalistische Silhouetten-Szene (Sofa 2,2 m + Person 1,75 m), das Poster
     maßstabsgetreu an der Wand. Baut nach jedem Varianten-Morph neu. */

  function buildSizeCompare(root) {
    var d = readData(root);
    var stage = root.querySelector('.lp-gallery__stage');
    if (!stage || !d.size) return;
    var nums = String(d.size).match(/\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 2) return;
    var wIn = parseFloat(nums[0]);
    var hIn = parseFloat(nums[1]);
    if (!wIn || !hIn) return;
    var key = wIn + 'x' + hIn;
    var box = root.querySelector('.lp-sizecomp');
    if (box && box.dataset.size === key) return;
    if (!box) {
      box = el('div', 'lp-sizecomp');
      stage.insertAdjacentElement('afterend', box);
    }
    box.dataset.size = key;
    var S = 84; // px pro Meter
    var floorY = 186;
    var cmW = Math.round(wIn * 2.54);
    var cmH = Math.round(hIn * 2.54);
    var pw = (wIn * 0.0254) * S;
    var ph = (hIn * 0.0254) * S;
    var px = 210 - pw / 2; // Poster mittig über dem Sofa
    var py = floorY - 63 - 34 - ph; // Sofa 0,75 m + Abstand
    if (py < 12) py = 12;
    box.innerHTML =
      '<svg viewBox="0 0 640 210" role="img" aria-label="Größenvergleich: ' + wIn + ' mal ' + hIn + ' Zoll an der Wand">' +
      '<line x1="16" y1="' + floorY + '" x2="624" y2="' + floorY + '" stroke="currentColor" stroke-opacity="0.5" stroke-width="1.6"/>' +
      /* Sofa (2,2 m), Seitenlinie */
      '<path d="M118 ' + (floorY - 63) + ' h184 a12 12 0 0 1 12 12 v34 a8 8 0 0 1 -8 8 H114 a8 8 0 0 1 -8 -8 v-34 a12 12 0 0 1 12 -12 Z" fill="none" stroke="currentColor" stroke-opacity="0.65" stroke-width="2"/>' +
      '<line x1="114" y1="' + (floorY - 9) + '" x2="114" y2="' + floorY + '" stroke="currentColor" stroke-opacity="0.65" stroke-width="2"/>' +
      '<line x1="306" y1="' + (floorY - 9) + '" x2="306" y2="' + floorY + '" stroke="currentColor" stroke-opacity="0.65" stroke-width="2"/>' +
      '<path d="M106 ' + (floorY - 51) + ' a10 10 0 0 1 20 0" fill="none" stroke="currentColor" stroke-opacity="0.65" stroke-width="2"/>' +
      /* Person (1,75 m) */
      '<circle cx="500" cy="' + (floorY - 147 + 11) + '" r="11" fill="none" stroke="currentColor" stroke-opacity="0.65" stroke-width="2"/>' +
      '<path d="M500 ' + (floorY - 147 + 22) + ' v58 m0 0 -12 67 m12 -67 12 67 m-12 -105 -13 30 m13 -30 13 30" fill="none" stroke="currentColor" stroke-opacity="0.65" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      /* Poster maßstabsgetreu */
      '<rect x="' + px.toFixed(1) + '" y="' + py.toFixed(1) + '" width="' + pw.toFixed(1) + '" height="' + ph.toFixed(1) + '" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="2.4"/>' +
      '</svg>' +
      '<p class="lp-sizecomp-label">Größe im Raum: <strong>' + d.size + '</strong> · ca. ' + cmW + ' × ' + cmH + ' cm</p>';
  }

  /* ---------- Panelwechsel ---------- */

  function activate(root, id) {
    if (id !== '3d') removeBackCard(root);
    var found = false;
    root.querySelectorAll('.lp-panel').forEach(function (p) {
      var on = p.getAttribute('data-panel') === id;
      if (on) found = true;
      if (on) p.removeAttribute('hidden');
      else p.setAttribute('hidden', '');
    });
    if (!found) return;
    root.querySelectorAll('.lp-thumb').forEach(function (t) {
      t.setAttribute('aria-selected', t.getAttribute('data-target') === id ? 'true' : 'false');
    });
    if (id === '3d') mount3d(root);
    if (id === 'detail') buildDetail(root);
    root.dataset.lpActive = id;
    window.__lpGalleryPanel = id;
  }

  function bind(root) {
    if (root.dataset.lpBound) return;
    root.dataset.lpBound = '1';
    root.addEventListener('click', function (e) {
      var fs = e.target.closest('[data-lp-fs]');
      if (fs) { openOverlay(root); return; }
      var thumb = e.target.closest('.lp-thumb');
      if (thumb) activate(root, thumb.getAttribute('data-target'));
    });
    root.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' &&
          e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var thumb = e.target.closest('.lp-thumb');
      if (!thumb) return;
      e.preventDefault();
      var thumbs = Array.prototype.slice.call(root.querySelectorAll('.lp-thumb'));
      var dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
      var i = (thumbs.indexOf(thumb) + dir + thumbs.length) % thumbs.length;
      thumbs[i].focus();
      activate(root, thumbs[i].getAttribute('data-target'));
    });
  }

  function sync(root) {
    bind(root);
    buildSizeCompare(root);
    var want = root.dataset.lpActive || window.__lpGalleryPanel;
    var hasWant = want && root.querySelector('.lp-panel[data-panel="' + want + '"]');
    if (!hasWant) {
      var firstThumb = root.querySelector('.lp-thumb');
      want = firstThumb ? firstThumb.getAttribute('data-target') : null;
    }
    if (want) activate(root, want);
  }

  function initAll() {
    document.querySelectorAll('[data-lp-gallery]').forEach(function (root) {
      sync(root);
      // Varianten-Morph beobachten: Sektion re-rendert -> Galerie neu binden
      if (!root.dataset.lpWatched) {
        root.dataset.lpWatched = '1';
        var section = root.closest('.shopify-section') || root.parentElement;
        if (section && !section.dataset.lpWatched) {
          section.dataset.lpWatched = '1';
          var pending = false;
          new MutationObserver(function () {
            if (pending) return;
            pending = true;
            requestAnimationFrame(function () {
              pending = false;
              section.querySelectorAll('[data-lp-gallery]').forEach(sync);
            });
          }).observe(section, { childList: true, subtree: true });
        }
      }
    });
  }

  /* ---------- Variantenwechsel ----------
     Horizons variant-picker.js morpht nur den Picker und feuert danach
     'variant:update' mit dem frisch gerenderten Dokument der Produktseite.
     Unser Snippet rendert pro Variante serverseitig (Bild, Seitenverhältnis,
     GLB-Farbe) — wir übernehmen die neue Galerie daraus komplett. */

  function onVariantUpdate(event) {
    var data = event.detail && event.detail.data;
    if (!data || !data.html || !data.html.querySelector) return;
    var next = data.html.querySelector('[data-lp-gallery]');
    if (!next) return;
    var pid = data.productId ? String(data.productId) : '';
    document.querySelectorAll('[data-lp-gallery]').forEach(function (root) {
      var rid = root.getAttribute('data-product-id') || '';
      if (pid && rid && pid !== rid) return;
      var fresh = next.cloneNode(true);
      root.replaceWith(fresh);
      sync(fresh);
      if (overlay && !overlay.hasAttribute('hidden')) {
        var d = readData(fresh);
        var mv = overlay.querySelector('model-viewer');
        if (mv && d.glb && mv.getAttribute('src') !== d.glb) {
          mv.setAttribute('src', d.glb);
        }
        if (d.title) {
          overlay.querySelector('.lp-xp-overlay-title').textContent = d.title;
          overlay.setAttribute('aria-label', '3D-Ansicht — ' + d.title);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
  document.addEventListener('shopify:section:load', initAll);
  document.addEventListener('variant:update', onVariantUpdate);
})();
