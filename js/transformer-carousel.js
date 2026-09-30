/* Blog index: rotates the Transformer series card; pauses on hover, focus and hidden tabs. */
(function () {
  'use strict';

  var cleanups = [];

  function mount(root) {
    var track = root.querySelector('.ts-carousel__track');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.ts-carousel__slide'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('.ts-carousel__dots button'));
    if (!track || slides.length < 2) return function () {};

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var interval = Number(root.dataset.interval) || 5000;
    var current = 0;
    var timer = null;
    var hovered = false;
    var focused = false;

    function go(index) {
      current = (index + slides.length) % slides.length;
      track.style.transform = 'translateY(' + (-100 * current) + '%)';
      slides.forEach(function (slide, i) {
        var active = i === current;
        slide.toggleAttribute('inert', !active);
        if (active) slide.removeAttribute('aria-hidden');
        else slide.setAttribute('aria-hidden', 'true');
      });
      dots.forEach(function (dot, i) {
        if (i === current) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    }

    function stop() {
      window.clearInterval(timer);
      timer = null;
    }

    function start() {
      stop();
      if (reduced || hovered || focused || document.hidden) return;
      timer = window.setInterval(function () { go(current + 1); }, interval);
    }

    function onClick(event) {
      var dot = event.target.closest('button[data-slide]');
      if (!dot) return;
      go(Number(dot.dataset.slide));
      start();
    }

    function onKey(event) {
      if (!event.target.closest('.ts-carousel__dots')) return;
      var step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[event.key];
      if (!step) return;
      event.preventDefault();
      go(current + step);
      dots[current].focus();
    }

    var listeners = [
      [root, 'click', onClick],
      [root, 'keydown', onKey],
      [root, 'mouseenter', function () { hovered = true; stop(); }],
      [root, 'mouseleave', function () { hovered = false; start(); }],
      [root, 'focusin', function () { focused = true; stop(); }],
      [root, 'focusout', function (event) {
        if (root.contains(event.relatedTarget)) return;
        focused = false;
        start();
      }],
      [document, 'visibilitychange', start]
    ];
    listeners.forEach(function (l) { l[0].addEventListener(l[1], l[2]); });
    root.classList.add('is-ready');
    go(0);
    start();

    return function () {
      stop();
      listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2]); });
    };
  }

  function init() {
    cleanups.forEach(function (cleanup) { cleanup(); });
    cleanups = Array.prototype.map.call(document.querySelectorAll('.ts-carousel'), mount);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('pjax:complete', init);
})();
