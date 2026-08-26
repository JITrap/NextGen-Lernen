/* LimitlessPoster — Design-Lab Layer v1
   Verhalten für: HOV-05 (Tilt), SCR-08 (Vorhang-Reveal), TXT-04 (Marker),
   TXT-06 (Typewriter), FX-02 (Toasts), FX-03 (Konfetti bei Gratisversand),
   FX-06 (Zurück nach oben), CNV-01/NAV-05 (Versand-Balken live),
   CNV-07 (Bundle-Auswahl), CNV-08 (Bewertungs-Balken), CNV-10 (Größen-Guide).
   Ohne JS bleibt alles statisch sichtbar; prefers-reduced-motion wird respektiert. */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  /* ---------- FX-02 · Toasts ---------- */
  var toastWrap = null;
  function toast(message, kind) {
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'lp-toasts';
      toastWrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastWrap);
    }
    var t = document.createElement('div');
    t.className = 'lp-toast lp-toast--' + (kind === 'error' ? 'error' : 'success');
    var icon = document.createElement('span');
    icon.className = 'lp-toast__icon';
    icon.textContent = kind === 'error' ? '!' : '✓';
    var txt = document.createElement('span');
    txt.textContent = message;
    t.appendChild(icon);
    t.appendChild(txt);
    toastWrap.appendChild(t);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { t.classList.add('on'); });
    });
    setTimeout(function () { t.classList.remove('on'); }, 2800);
    setTimeout(function () { t.remove(); }, 3200);
  }
  window.LimitlessToast = toast;

  /* ---------- FX-03 · Mini-Konfetti (Canvas) ---------- */
  function confettiBurst(host) {
    if (reduced || !host) return;
    var canvas = document.createElement('canvas');
    canvas.className = 'lp-shipbar__confetti';
    var rect = host.getBoundingClientRect();
    canvas.width = Math.max(rect.width, 10);
    canvas.height = Math.max(rect.height, 10);
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }
    var colors = ['#A32235', '#E4A7B6', '#D8B25C', '#F4F1EA', '#8B1E2D'];
    var parts = [];
    for (var i = 0; i < 42; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = 1.4 + Math.random() * 3.4;
      parts.push({
        x: canvas.width / 2,
        y: canvas.height * 0.55,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 2.2,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.28,
        s: 3 + Math.random() * 4,
        life: 46 + Math.random() * 26,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    (function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts = parts.filter(function (p) { return p.life > 0; });
      if (!parts.length) { canvas.remove(); return; }
      parts.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.13; p.rot += p.vr; p.life -= 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 26));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62);
        ctx.restore();
      });
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- CNV-01 / NAV-05 · Versand-Balken beobachten ---------- */
  /* Der Balken selbst wird serverseitig (Liquid) gerendert und vom Theme
     bei jeder Warenkorb-Änderung neu ausgespielt — hier feiern wir nur
     den Moment, in dem der Gratisversand freigeschaltet wird. */
  var lastRemaining = null;
  function checkShipbar() {
    var bar = document.querySelector('[data-lp-shipbar]');
    if (!bar) return;
    var remaining = parseInt(bar.getAttribute('data-remaining'), 10);
    if (isNaN(remaining)) return;
    if (lastRemaining !== null && lastRemaining > 0 && remaining === 0) {
      confettiBurst(bar);
    }
    lastRemaining = remaining;
  }

  document.addEventListener('cart:update', function (event) {
    var detail = event && event.detail ? event.detail : {};
    var data = detail.data || {};
    if (data.didError) {
      toast('Das hat leider nicht geklappt. Bitte versuch es nochmal.', 'error');
      return;
    }
    /* Warenkorb-DOM wird asynchron aktualisiert — kurz warten, dann lesen. */
    setTimeout(checkShipbar, 400);
    setTimeout(function () {
      var drawerOpen = document.querySelector('.cart-drawer__dialog[open]');
      if (!drawerOpen && data.source === 'product-form-component') {
        toast('Zum Warenkorb hinzugefügt', 'success');
      }
    }, 600);
  });
  document.addEventListener('cart:error', function () {
    toast('Das hat leider nicht geklappt. Bitte versuch es nochmal.', 'error');
  });

  /* ---------- HOV-05 · 3D-Tilt für Kollektionskarten ---------- */
  function initTilt() {
    if (reduced || !finePointer) return;
    document.querySelectorAll('.collection-card:not([data-lp-tilt])').forEach(function (card) {
      card.setAttribute('data-lp-tilt', '');
      card.classList.add('lp-tilt');
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(700px) rotateY(' + (x * 5).toFixed(2) + 'deg) rotateX(' + (-y * 4).toFixed(2) + 'deg)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  }

  /* ---------- SCR-08 · Vorhang-Reveal für Kollektionsbilder ---------- */
  var curtainIO = null;
  function initCurtain() {
    if (reduced || !('IntersectionObserver' in window)) return;
    if (!curtainIO) {
      curtainIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('lp-curtain-in');
            curtainIO.unobserve(en.target);
          }
        });
      }, { threshold: 0.25 });
    }
    document.querySelectorAll('.collection-card img:not(.lp-curtain), .lp-curtain-target:not(.lp-curtain)').forEach(function (img) {
      img.classList.add('lp-curtain');
      curtainIO.observe(img);
    });
  }

  /* ---------- TXT-04 · Marker-Highlight bei Sichtbarkeit ---------- */
  var markIO = null;
  function initMarker() {
    if (!('IntersectionObserver' in window)) return;
    if (!markIO) {
      markIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('lp-mark-in');
            markIO.unobserve(en.target);
          }
        });
      }, { threshold: 0.6 });
    }
    document.querySelectorAll('main h1 em, main h2 em, main h3 em, main .h1 em, main .h2 em, main .h3 em').forEach(function (em) {
      var target = em.closest('h1, h2, h3, .h1, .h2, .h3');
      if (target && !target.hasAttribute('data-lp-mark')) {
        target.setAttribute('data-lp-mark', '');
        markIO.observe(target);
      }
    });
  }

  /* ---------- TXT-06 · Typewriter ---------- */
  function initTypewriter() {
    document.querySelectorAll('[data-lp-type]:not([data-lp-type-init])').forEach(function (el) {
      el.setAttribute('data-lp-type-init', '');
      var words = (el.getAttribute('data-words') || '')
        .split('|')
        .map(function (w) { return w.trim(); })
        .filter(Boolean);
      if (!words.length) return;
      if (reduced) { el.textContent = words[0]; return; }
      var wi = 0, chars = 0, deleting = false;
      (function tick() {
        if (!el.isConnected) return;
        var word = words[wi];
        chars += deleting ? -1 : 1;
        el.textContent = word.slice(0, chars);
        var wait = deleting ? 34 : 64;
        if (!deleting && chars === word.length) { wait = 1600; deleting = true; }
        else if (deleting && chars === 0) { deleting = false; wi = (wi + 1) % words.length; wait = 340; }
        setTimeout(tick, wait);
      })();
    });
  }

  /* ---------- CNV-08 · Bewertungs-Balken animieren ---------- */
  var barIO = null;
  function initBars() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-lp-bar]').forEach(function (b) {
        b.style.width = b.getAttribute('data-lp-bar') + '%';
      });
      return;
    }
    if (!barIO) {
      barIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.querySelectorAll('[data-lp-bar]').forEach(function (b) {
            b.style.width = b.getAttribute('data-lp-bar') + '%';
          });
          barIO.unobserve(en.target);
        });
      }, { threshold: 0.35 });
    }
    document.querySelectorAll('[data-lp-bars]:not([data-lp-bars-init])').forEach(function (host) {
      host.setAttribute('data-lp-bars-init', '');
      barIO.observe(host);
    });
  }

  /* ---------- CNV-07 · Bundle-Auswahl ---------- */
  function initBundle() {
    document.querySelectorAll('[data-lp-bundle]:not([data-lp-bundle-init])').forEach(function (wrap) {
      wrap.setAttribute('data-lp-bundle-init', '');
      var buttons = wrap.querySelectorAll('.lp-bundle__opt');
      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          buttons.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
          var qty = parseInt(btn.getAttribute('data-qty'), 10) || 1;
          var section = wrap.closest('.shopify-section') || document;
          var input = section.querySelector('input[name="quantity"]');
          if (input) {
            input.value = String(qty);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      });
    });
  }

  /* ---------- CNV-10 · Größen-Guide ---------- */
  function initSizeGuide() {
    document.querySelectorAll('[data-lp-sizeguide]:not([data-lp-sizeguide-init])').forEach(function (wrap) {
      wrap.setAttribute('data-lp-sizeguide-init', '');
      var poster = wrap.querySelector('.lp-sizeguide__poster');
      var chips = wrap.querySelectorAll('.lp-sizeguide__chip');
      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          chips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
          if (poster) poster.style.width = chip.getAttribute('data-width') + '%';
        });
      });
    });
  }

  /* ---------- FX-06 · Zurück nach oben + Fortschrittsring ---------- */
  function initBackToTop() {
    if (document.querySelector('.lp-top')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lp-top';
    btn.setAttribute('aria-label', 'Nach oben scrollen');
    btn.innerHTML =
      '<svg class="lp-top__ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20"></circle><circle class="p" cx="22" cy="22" r="20"></circle></svg>' +
      '<svg class="lp-top__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>';
    document.body.appendChild(btn);
    var ring = btn.querySelector('.lp-top__ring .p');
    var CIRC = 126;
    var ticking = false;
    function update() {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      btn.classList.toggle('show', window.scrollY > 600);
      if (ring) ring.style.strokeDashoffset = String(CIRC * (1 - p));
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
    update();
  }

  function initAll() {
    initTilt();
    initCurtain();
    initMarker();
    initTypewriter();
    initBars();
    initBundle();
    initSizeGuide();
    initBackToTop();
    checkShipbar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
  document.addEventListener('shopify:section:load', initAll);
})();
