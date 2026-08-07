/* LimitlessPoster — Motion System v2
   Reveal-on-Scroll, Count-up, Frame-Draw, Scroll-Progressbar.
   Ohne JS oder mit prefers-reduced-motion bleibt alles statisch sichtbar. */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var docEl = document.documentElement;

  function initProgress() {
    if (document.getElementById('lp-progress')) return;
    var bar = document.createElement('div');
    bar.id = 'lp-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var ticking = false;
    var update = function () {
      var max = docEl.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(window.scrollY / max, 1) : 0) + ')';
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  function initReveal() {
    docEl.classList.add('lp-motion');
    var targets = [];
    if (document.querySelector('main[data-template="index"]')) {
      var sections = document.querySelectorAll('main .shopify-section');
      sections.forEach(function (s, i) {
        if (i === 0) return; /* Hero ist beim Laden sichtbar */
        if (s.querySelector('.lp-scrollshow')) return; /* hat eigene Animation */
        s.classList.add('lp-reveal');
        targets.push(s);
      });
    }
    document.querySelectorAll('.lp-reveal').forEach(function (el) {
      if (targets.indexOf(el) === -1) targets.push(el);
    });
    if (!targets.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('lp-inview'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
    targets.forEach(function (el) { io.observe(el); });
  }

  function initCountUp() {
    var els = document.querySelectorAll('.lp-count[data-target]:not([data-lp-counted])');
    if (!els.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target;
        el.setAttribute('data-lp-counted', '');
        var n = parseFloat(el.getAttribute('data-target')) || 0;
        var suffix = el.getAttribute('data-suffix') || '';
        var t0 = null;
        var step = function (ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / 1200, 1);
          el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3))) + suffix;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    els.forEach(function (el) { io.observe(el); });
  }

  function initFrameDraw() {
    var els = document.querySelectorAll('.lp-fd:not(.lp-fd-visible)');
    if (!els.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('lp-fd-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.3 });
    els.forEach(function (el) { io.observe(el); });
  }

  function init() {
    initProgress();
    if (reduced) { docEl.classList.add('lp-reduced'); return; }
    initReveal();
    initCountUp();
    initFrameDraw();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('shopify:section:load', function () {
    if (!reduced) { initCountUp(); initFrameDraw(); }
  });
})();
