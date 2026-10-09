(function () {
  var root = document.documentElement;
  var released = false;
  var overlay = null;
  var deadline;
  var removalTimer;
  var navigation = null;
  var HANDOFF_KEY = 'site-navigation-handoff-v1';
  var controller = new AbortController();
  var isAcademicPath = window.location.pathname === '/' || window.location.pathname === '/index.html';
  var handoff = consumeHandoff();
  var startedAt = handoff ? handoff.startedAt : Date.now();
  var resolveReady;
  var ready = new Promise(function (resolve) { resolveReady = resolve; });

  root.classList.add('site-visual-loading');
  if (isAcademicPath) {
    root.classList.add('site-visual-academic');
  }

  function consumeHandoff() {
    try {
      var stored = window.sessionStorage.getItem(HANDOFF_KEY);
      window.sessionStorage.removeItem(HANDOFF_KEY);
      if (!stored) return null;
      var value = JSON.parse(stored);
      if (value.destination !== window.location.pathname + (window.location.search || '')
        || !Number.isFinite(value.at) || Date.now() - value.at < 0 || Date.now() - value.at > 15000
        || !Number.isFinite(value.startedAt) || value.startedAt > value.at || value.at - value.startedAt > 120000) return null;
      return value;
    } catch (_) { return null; }
  }

  function mountOverlay() {
    if ((released && !navigation) || !document.body) return;
    window.clearTimeout(removalTimer);
    if (overlay) { overlay.classList.remove('is-leaving'); root.classList.add('site-visual-mounted'); return; }

    var isAcademic = !navigation && (isAcademicPath || !!document.querySelector('.academic-home'));
    overlay = document.createElement('div');
    overlay.id = 'site-visual-overlay';
    overlay.className = isAcademic ? 'site-visual-overlay--academic' : '';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<div class="site-visual-content">' +
      '<span class="site-visual-grid" aria-hidden="true"></span>' +
      '<span class="site-visual-message">Loading<span class="site-visual-ellipsis" aria-hidden="true">...</span></span>' +
      '</div>';
    var grid = overlay.querySelector('.site-visual-grid');
    var colors = isAcademic
      ? ['#267fa8', '#4b80bd', '#8277bd', '#ad70a2']
      : ['#69dce9', '#83c8f6', '#afaef2', '#eda9ce'];
    // UI Ball's four projected rows form a small isometric grid.
    var positions = [
      [[24, -35], [16, -6], [8, 23], [-1, 51]],
      [[38, -17.5], [30, 10], [22, 39], [14, 67]],
      [[53, -0.8], [44.5, 27], [36, 55.7], [28.7, 84.3]],
      [[66.8, 15], [58.8, 43], [50, 72], [42, 100]]
    ];
    var scales = [
      [.94, .96, .98, 1],
      [.9, .92, .94, .96],
      [.86, .88, .9, .92],
      [.82, .84, .86, .88]
    ];
    for (var row = 0; row < 4; row++) {
      for (var col = 0; col < 4; col++) {
        var dot = document.createElement('span');
        dot.className = 'site-visual-grid-dot';
        dot.style.setProperty('--grid-bottom', positions[row][col][0] + '%');
        dot.style.setProperty('--grid-right', positions[row][col][1] + '%');
        dot.style.setProperty('--grid-scale', scales[row][col]);
        dot.style.setProperty('--grid-color', colors[row]);
        // Carry the animation phase through a full document navigation, so the
        // destination continues the click's loader rather than restarting it.
        var elapsed = ((Date.now() - startedAt) / 1000) % 1.5;
        dot.style.setProperty('--grid-delay', ((row + col - 6) * .12 - elapsed).toFixed(2) + 's');
        grid.appendChild(dot);
      }
    }
    document.body.prepend(overlay);
    root.classList.add('site-visual-mounted');
    if (handoff && handoff.progress) {
      overlay.querySelector('.site-visual-message').textContent = 'Loading ' + handoff.progress.completed + '/' + handoff.progress.total;
    }
  }

  function dismissOverlay() {
    if (!overlay) return;
    var leaving = overlay;
    leaving.classList.add('is-leaving');
    removalTimer = window.setTimeout(function () {
      if (overlay !== leaving) return;
      leaving.remove(); overlay = null;
    }, 500);
  }

  function showNavigation(message, actions) {
    if (!navigation) {
      navigation = { startedAt: Date.now(), focus: document.activeElement, academic: isAcademicPath };
      startedAt = navigation.startedAt;
    }
    root.classList.remove('site-visual-academic');
    root.classList.remove('site-visual-ready');
    root.classList.add('site-visual-loading');
    mountOverlay();
    if (!overlay) return;
    overlay.classList.remove('site-visual-overlay--academic');
    overlay.classList.add('site-visual-overlay--navigation');
    overlay.classList.toggle('is-failed', actions.length > 1);
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '页面加载');
    overlay.querySelector('.site-visual-message').textContent = message;
    var controls = overlay.querySelector('.site-visual-actions');
    if (!controls) {
      controls = document.createElement('div'); controls.className = 'site-visual-actions';
      overlay.querySelector('.site-visual-content').appendChild(controls);
    }
    controls.replaceChildren();
    actions.forEach(function (action) {
      var button = document.createElement('button'); button.type = 'button'; button.textContent = action.label;
      button.addEventListener('click', action.run); controls.appendChild(button);
    });
    var first = controls.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }

  function updateNavigation(message, progress) {
    if (!navigation || !overlay) return;
    overlay.querySelector('.site-visual-message').textContent = message;
    if (progress) navigation.progress = { completed: progress.completed, total: progress.total };
  }

  function commitNavigation(url) {
    if (!navigation) return;
    navigation.committed = true;
    // The receiver still checks decoded DOM images, fonts and MathJax, but
    // holds this final progress value instead of showing a second 0/N cycle.
    try {
      var destination = new URL(url, window.location.href);
      if (destination.origin !== window.location.origin) return;
      window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({
        destination: destination.pathname + destination.search,
        at: Date.now(), startedAt: navigation.startedAt, progress: navigation.progress || null
      }));
    } catch (_) {}
    overlay.querySelector('.site-visual-actions').replaceChildren();
    overlay.classList.remove('is-failed');
    overlay.querySelector('.site-visual-message').textContent = navigation.progress
      ? 'Loading ' + navigation.progress.completed + '/' + navigation.progress.total : 'Loading…';
  }

  function cancelNavigation() {
    if (!navigation) return;
    var previous = navigation; navigation = null;
    root.classList.remove('site-visual-loading');
    root.classList.remove('site-visual-mounted');
    root.classList.add('site-visual-ready');
    if (previous.academic) root.classList.add('site-visual-academic');
    dismissOverlay();
    if (!previous.committed && previous.focus && previous.focus.isConnected) previous.focus.focus({ preventScroll: true });
  }

  function release(result) {
    if (released) return;
    released = true;
    window.clearTimeout(deadline);
    resolveReady(result || { failures: [] });
    if (navigation) return;
    root.classList.remove('site-visual-loading');
    root.classList.remove('site-visual-mounted');
    root.classList.add('site-visual-ready');
    if (result && result.failures && result.failures.length && window.siteBlogResources && document.body) {
      window.siteBlogResources.notify(result.timedOut ? '页面准备超时，部分图片可能尚未加载。' : '部分页面资源未能加载。');
    }
    dismissOverlay();
  }

  function preloadImage(url) {
    if (!url) return Promise.resolve();
    if (window.siteBlogResources) return window.siteBlogResources.preloadImage(url, controller.signal).catch(function () {});
    return new Promise(function (resolve) {
      var image = new Image();
      image.onload = function () { if (image.decode) image.decode().then(resolve, resolve); else resolve(); };
      image.onerror = resolve;
      image.src = url;
      if (image.complete) image.onload();
    });
  }

  function backgroundUrl(element) {
    if (!element) return '';
    var match = window.getComputedStyle(element).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
    return match ? match[1] : '';
  }

  window.siteVisualGate = {
    ready: ready,
    showNavigation: showNavigation,
    updateNavigation: updateNavigation,
    commitNavigation: commitNavigation,
    cancelNavigation: cancelNavigation,
    // Older integrations may signal readiness; page resources decide release.
    backgroundReady: function () {}
  };

  function prepareFirstView() {
    if (released) return;
    mountOverlay();
    var isAcademic = !!document.querySelector('.academic-home');
    var images = [];
    if (isAcademic) {
      images.push(preloadImage(backgroundUrl(document.getElementById('page-header'))));
      var avatar = document.querySelector('.academic-home__profile > img');
      if (avatar) images.push(preloadImage(avatar.currentSrc || avatar.src));
      Promise.all(images).then(function () { release(); }, function () { release(); });
    } else if (window.siteBlogResources) {
      window.siteBlogResources.prepareCurrent({ signal: controller.signal, onProgress: function (progress) {
        if (released || !overlay || handoff) return;
        overlay.querySelector('.site-visual-message').textContent = 'Loading ' + progress.completed + '/' + progress.total;
      } }).then(release, function (error) {
        if (!released) release({ failures: [{ message: error.message }] });
      });
    } else {
      // Keep a useful bounded gate even if the navigation helper failed to load.
      images.push(preloadImage(backgroundUrl(document.getElementById('page-header'))));
      document.querySelectorAll('img').forEach(function (image) {
        image.loading = 'eager';
        images.push(preloadImage(image.currentSrc || image.getAttribute('data-src') || image.getAttribute('data-lazy-src') || image.src));
      });
      if (window.siteThemeBackground) images.push(window.siteThemeBackground.ready);
      Promise.all(images).then(function () { release(); }, function () { release(); });
    }
  }

  // The academic avatar gate stays quick. Lifestyle entries wait for every static
  // page image, with an honest finite fallback for a lost connection.
  deadline = window.setTimeout(function () {
    controller.abort();
    release({ timedOut: true, failures: [{ message: 'Page loading timed out' }] });
  }, isAcademicPath ? 2500 : 45000);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prepareFirstView, { once: true });
    if (handoff && window.MutationObserver) {
      // The source screen already displayed this animation. Mount as soon as
      // <body> exists to avoid a blank intermediate mask during HTML parsing.
      var bodyObserver = new MutationObserver(function () {
        if (document.body) { bodyObserver.disconnect(); mountOverlay(); }
      });
      bodyObserver.observe(root, { childList: true, subtree: true });
      mountOverlay();
    }
  } else {
    prepareFirstView();
  }
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) { cancelNavigation(); release(); }
  });
  document.addEventListener('keydown', function (event) {
    if (!navigation || !overlay) return;
    if (event.key === 'Escape' && !navigation.committed && window.siteBlogResources) {
      event.preventDefault(); window.siteBlogResources.cancel();
    }
    if (event.key === 'Tab') {
      var buttons = overlay.querySelectorAll('button');
      if (!buttons.length) { event.preventDefault(); return; }
      var first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
})();
