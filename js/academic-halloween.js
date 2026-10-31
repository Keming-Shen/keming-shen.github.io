/* Halloween costume for the academic homepage (see academic-season.js and academic-halloween.css).
   Builds the decorative layers once while the season is available; CSS shows them only while it is on.
   The sky, spider and footer scene are animated by academic-halloween-{sky,spider,ground}.js. */
(function () {
  var season = window.academicSeason;
  var root = document.documentElement;
  var home = document.querySelector('.academic-home');
  if (!season || !season.available || !home || home.dataset.halloweenReady === 'true') return;
  home.dataset.halloweenReady = 'true';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MOON = '/image/academic/halloween/hunters-moon-2026-';
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var ICON_PUMPKIN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path class="hw-pumpkin__body" d="M12 6.2c-1.2-.9-3.4-1.2-5.3-.3C3.4 7.3 2 10.6 2.6 14.2c.6 3.7 3.4 6.3 6.6 6.3 1 0 1.9-.3 2.8-.8.9.5 1.8.8 2.8.8 3.2 0 6-2.6 6.6-6.3.6-3.6-.8-6.9-4.1-8.3-1.9-.9-4.1-.6-5.3.3Z"/>' +
    '<path class="hw-pumpkin__rib" d="M12 6.6c-1.7 2.8-1.9 9.6 0 13.1M12 6.6c1.7 2.8 1.9 9.6 0 13.1"/>' +
    '<path class="hw-pumpkin__stem" d="M11.1 6.5c-.2-1.7.3-3.1 1.6-4.2l1.3 1c-.9.8-1.3 1.9-1.1 3.2Z"/>' +
    '<path class="hw-pumpkin__face" d="M6.9 11.2l2.9-1.9.5 3.1ZM17.1 11.2l-2.9-1.9-.5 3.1ZM6.6 14.4c1.3 2.3 3.2 3.4 5.4 3.4s4.1-1.1 5.4-3.4l-1.8.6-.9 1.3-1.1-1.2-1.6 1.4-1.6-1.4-1.1 1.2-.9-1.3Z"/>' +
    '</svg>';

  function element(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  }

  // Sky layers behind the hero, back to front: moon, drifting clouds, a canvas for stars and bats.
  var hero = home.querySelector('.academic-home__hero');
  var sky = null;
  if (hero) {
    sky = element('div', 'hw-decor hw-sky',
      '<img class="hw-moon no-lightbox" alt="" decoding="async" src="' + MOON + '480.webp" srcset="' + MOON + '288.webp 288w, ' + MOON + '480.webp 480w" sizes="(max-width: 600px) 120px, (max-width: 1080px) 150px, 212px">' +
      '<div class="hw-clouds"><i></i><i></i></div><canvas class="hw-sky__canvas"></canvas>');
    sky.setAttribute('aria-hidden', 'true');
    var spider = element('canvas', 'hw-decor hw-spider');
    spider.setAttribute('aria-hidden', 'true');
    hero.prepend(sky, spider);
    var moon = sky.querySelector('.hw-moon');
    var rise = function () { sky.classList.add('is-risen'); };
    if (moon.complete) rise(); else moon.addEventListener('load', rise, { once: true });
  }

  // The sky lags behind the page while scrolling, which reads as depth.
  var ticking = false;
  function parallax() {
    ticking = false;
    if (!sky || reducedMotion.matches || !season.isActive()) return;
    var y = Math.min(window.scrollY, 900);
    sky.style.transform = 'translate3d(0,' + (y * 0.32).toFixed(1) + 'px,0)';
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(parallax); }
  }, { passive: true });

  // The seasonal greeting is also the switch, so both looks keep one layout. Visitors can put the
  // costume away until next Halloween; the new look spreads from the pumpkin in a circle.
  var masthead = home.querySelector('.academic-home__masthead');
  if (masthead) {
    var toggle = element('button', 'hw-eyebrow', ICON_PUMPKIN +
      '<span data-zh="万圣节快乐">Happy Halloween</span><span class="hw-switch" aria-hidden="true"></span>');
    toggle.type = 'button';
    toggle.setAttribute('role', 'switch');
    masthead.parentNode.insertBefore(toggle, masthead);
    if (home.dataset.languageReady === 'true' && root.getAttribute('data-academic-language') === 'zh') {
      toggle.querySelector('[data-zh]').textContent = '万圣节快乐';
    }
    var syncToggle = function () {
      var zh = root.getAttribute('data-academic-language') === 'zh';
      var on = season.isActive();
      toggle.setAttribute('aria-checked', on ? 'true' : 'false');
      toggle.title = on ? (zh ? '关闭万圣节主题' : 'Turn off the Halloween theme') : (zh ? '开启万圣节主题' : 'Turn on the Halloween theme');
    };
    toggle.addEventListener('click', function () {
      var next = !season.isActive();
      var change = function () { season.set(next); parallax(); };
      if (!document.startViewTransition || reducedMotion.matches) { change(); return; }
      var box = toggle.querySelector('svg').getBoundingClientRect();
      var x = box.left + box.width / 2, y = box.top + box.height / 2;
      root.style.setProperty('--hw-reveal-x', x + 'px');
      root.style.setProperty('--hw-reveal-y', y + 'px');
      root.style.setProperty('--hw-reveal-r', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 'px');
      root.setAttribute('data-season-transition', '');
      document.startViewTransition(change).finished.finally(function () { root.removeAttribute('data-season-transition'); });
    });
    syncToggle();
    new MutationObserver(syncToggle).observe(root, { attributes: true, attributeFilter: ['data-academic-language', 'data-season'] });
  }

  // The GitHub card's cat gets a pair of lantern eyes.
  var cat = home.querySelector('.action-github-cat');
  if (cat) {
    [96, 123].forEach(function (cx) {
      var eye = document.createElementNS(SVG_NS, 'ellipse');
      eye.setAttribute('class', 'hw-cat-eye');
      eye.setAttribute('cx', cx);
      eye.setAttribute('cy', '46');
      eye.setAttribute('rx', '2.8');
      eye.setAttribute('ry', '3.4');
      cat.appendChild(eye);
    });
  }

  var footerWrap = document.getElementById('footer-wrap');
  if (footerWrap) {
    footerWrap.appendChild(element('div', 'hw-credit',
      'Moon imagery: <a href="https://svs.gsfc.nasa.gov/5587/" target="_blank" rel="noopener">NASA\'s Scientific Visualization Studio</a>'));
  }

  // Paper copies use the everyday palette.
  var printing = false;
  window.addEventListener('beforeprint', function () {
    if (!season.isActive()) return;
    printing = true;
    root.removeAttribute('data-season');
  });
  window.addEventListener('afterprint', function () {
    if (!printing) return;
    printing = false;
    root.setAttribute('data-season', 'halloween');
  });

  // The night loader is only for the first view; later navigations keep their own palette.
  var gate = window.siteVisualGate;
  function releaseLoader() { window.setTimeout(function () { root.removeAttribute('data-season-loader'); }, 700); }
  if (gate && gate.ready) gate.ready.then(releaseLoader, releaseLoader);
  else releaseLoader();
  parallax();
})();
