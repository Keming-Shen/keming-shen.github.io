/* Interactions for the journal design (blog-journal.css): a theme switch in the navigation
   bar, and a circular reveal from the pressed button whenever the theme changes, including
   from Butterfly's floating #darkmode button. */
(function () {
  if (window.__journalInstalled) return;
  window.__journalInstalled = true;
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var bypass = false;

  var MOON = '<svg class="j-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.2 14.6A8.5 8.5 0 0 1 9.4 3.8a8.5 8.5 0 1 0 10.8 10.8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  var SUN = '<svg class="j-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g></svg>';

  function onBlog() { return !document.querySelector('.academic-home'); }
  function wait(ms) { return new Promise(function (resolve) { window.setTimeout(resolve, ms); }); }

  function switchTheme(origin) {
    var darkmode = document.getElementById('darkmode');
    if (!darkmode) return;
    var run = function () {
      bypass = true;
      try { darkmode.click(); } finally { bypass = false; }
    };
    if (!document.startViewTransition || reduced.matches || !origin) { run(); return; }
    var box = origin.getBoundingClientRect();
    var x = box.left + box.width / 2, y = box.top + box.height / 2;
    root.style.setProperty('--j-reveal-x', x + 'px');
    root.style.setProperty('--j-reveal-y', y + 'px');
    root.style.setProperty('--j-reveal-r', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 'px');
    root.setAttribute('data-journal-transition', '');
    document.startViewTransition(function () {
      run();
      // theme-background.js swaps the hero art on the next microtask; give it a moment so the
      // reveal shows the new artwork rather than its placeholder gradient.
      return wait(0).then(function () {
        var background = window.siteThemeBackground;
        return Promise.race([background && background.currentReady || Promise.resolve(), wait(650)]);
      });
    }).finished.finally(function () { root.removeAttribute('data-journal-transition'); });
  }

  // Butterfly's floating button keeps its behavior and gains the same reveal.
  document.addEventListener('click', function (event) {
    if (bypass || !onBlog() || !document.startViewTransition || reduced.matches) return;
    var button = event.target.closest && event.target.closest('#darkmode');
    if (!button) return;
    event.stopPropagation();
    switchTheme(button);
  }, true);

  function mount() {
    if (!onBlog()) return;
    var menus = document.getElementById('menus');
    if (!menus || menus.querySelector('.j-theme-toggle')) return;
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'j-theme-toggle';
    toggle.innerHTML = MOON + SUN;
    var label = function () {
      var dark = root.getAttribute('data-theme') === 'dark';
      toggle.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
      toggle.title = toggle.getAttribute('aria-label');
    };
    toggle.addEventListener('click', function () { switchTheme(toggle); });
    menus.insertBefore(toggle, document.getElementById('toggle-menu'));
    label();
    new MutationObserver(label).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // The author card: a printed banner and a glare layer; on fine pointers it tilts toward the
  // cursor (blog-journal.css gives its layers depth), and its figures count up when first seen.
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  function mountCard() {
    var card = document.querySelector('#aside-content .card-info');
    if (!card || card.dataset.journalCard) return;
    card.dataset.journalCard = 'true';
    var banner = document.createElement('div');
    banner.className = 'j-card-banner';
    banner.setAttribute('aria-hidden', 'true');
    card.insertBefore(banner, card.firstChild);
    var glare = document.createElement('span');
    glare.className = 'j-card-glare';
    glare.setAttribute('aria-hidden', 'true');
    card.appendChild(glare);

    var rect = null, frame = 0, point = null;
    function apply() {
      frame = 0;
      if (!point || !rect) return;
      var x = Math.min(1, Math.max(0, (point.x - rect.left) / rect.width));
      var y = Math.min(1, Math.max(0, (point.y - rect.top) / rect.height));
      card.style.setProperty('--j-ry', ((x - .5) * 16).toFixed(2) + 'deg');
      card.style.setProperty('--j-rx', ((.5 - y) * 12).toFixed(2) + 'deg');
      card.style.setProperty('--j-mx', (x * 100).toFixed(1) + '%');
      card.style.setProperty('--j-my', (y * 100).toFixed(1) + '%');
    }
    function measure() { rect = card.getBoundingClientRect(); }
    card.addEventListener('pointerenter', function (event) {
      if (!finePointer.matches || reduced.matches || event.pointerType !== 'mouse') return;
      measure();
      card.classList.add('is-tilting');
    });
    card.addEventListener('pointermove', function (event) {
      if (!card.classList.contains('is-tilting')) return;
      point = { x: event.clientX, y: event.clientY };
      if (!frame) frame = window.requestAnimationFrame(apply);
    });
    card.addEventListener('pointerleave', function () {
      card.classList.remove('is-tilting');
      point = null;
      ['--j-rx', '--j-ry', '--j-mx', '--j-my'].forEach(function (name) { card.style.removeProperty(name); });
    });
    window.addEventListener('scroll', function () { if (point) measure(); }, { passive: true });

    var figures = card.querySelectorAll('.site-data .length-num');
    if (reduced.matches || !window.IntersectionObserver) return;
    var seen = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      seen.disconnect();
      figures.forEach(function (figure) {
        var target = parseInt(figure.textContent, 10);
        if (!(target > 0)) return;
        var start = performance.now();
        (function tick(now) {
          var t = Math.min(1, (now - start) / 1100);
          figure.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
          if (t < 1) window.requestAnimationFrame(tick);
        })(start);
      });
    }, { threshold: .6 });
    seen.observe(card);
  }

  // Index pages: the sidebar matches the article column exactly (blog-journal.css). The headline
  // list fills the space; if even its minimum does not fit, the least important cards fold away,
  // and as a last resort the sidebar keeps its natural height.
  var TRIM = ['.card-webinfo', '.card-archives'];
  var wide = window.matchMedia('(min-width: 961px)');
  var fitToken = 0;
  function nextFrames() {
    return new Promise(function (resolve) {
      window.requestAnimationFrame(function () { window.requestAnimationFrame(resolve); });
    });
  }
  async function fitAside() {
    var aside = document.getElementById('aside-content');
    if (!aside || !document.querySelector('#content-inner > #recent-posts')) return;
    var token = ++fitToken;
    aside.classList.remove('j-aside-natural');
    aside.querySelectorAll('.j-aside-trim').forEach(function (card) { card.classList.remove('j-aside-trim'); });
    if (!wide.matches) return;
    var overflows = function () { return aside.scrollHeight > aside.clientHeight + 1; };
    // custom-announcement.js re-fits its list on the next frame after each change.
    await nextFrames();
    for (var i = 0; token === fitToken && overflows() && i < TRIM.length; i++) {
      var card = aside.querySelector(TRIM[i]);
      if (card) card.classList.add('j-aside-trim');
      await nextFrames();
    }
    if (token === fitToken && overflows()) aside.classList.add('j-aside-natural');
  }
  var fitTimer = 0;
  function scheduleFit() {
    window.clearTimeout(fitTimer);
    fitTimer = window.setTimeout(fitAside, 120);
  }
  function mountFit() {
    var announcement = document.getElementById('auto-announcement');
    if (announcement && !announcement.dataset.journalFit) {
      announcement.dataset.journalFit = 'true';
      new MutationObserver(scheduleFit).observe(announcement, { attributes: true, attributeFilter: ['data-loaded'] });
    }
    scheduleFit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleFit);
  }
  window.addEventListener('resize', scheduleFit);
  window.addEventListener('load', scheduleFit);

  function mountAll() { mount(); mountCard(); mountFit(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
  else mountAll();
  document.addEventListener('pjax:complete', mountAll);
})();
