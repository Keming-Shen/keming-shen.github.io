(function () {
  var root = document.documentElement;
  var released = false;
  var overlay = null;
  var deadline;
  var controller = new AbortController();
  var isAcademicPath = window.location.pathname === '/' || window.location.pathname === '/index.html';
  var resolveReady;
  var ready = new Promise(function (resolve) { resolveReady = resolve; });

  root.classList.add('site-visual-loading');
  if (isAcademicPath) {
    root.classList.add('site-visual-academic');
  }

  function mountOverlay() {
    if (released || overlay || !document.body) return;

    var isAcademic = !!document.querySelector('.academic-home');
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
        dot.style.setProperty('--grid-delay', ((row + col - 6) * .12).toFixed(2) + 's');
        grid.appendChild(dot);
      }
    }
    document.body.prepend(overlay);
    root.classList.add('site-visual-mounted');
  }

  function release(result) {
    if (released) return;
    released = true;
    window.clearTimeout(deadline);
    root.classList.remove('site-visual-loading');
    root.classList.remove('site-visual-mounted');
    root.classList.add('site-visual-ready');
    resolveReady(result || { failures: [] });
    if (result && result.failures && result.failures.length && window.siteBlogResources && document.body) {
      window.siteBlogResources.notify(result.timedOut ? '页面准备超时，部分图片可能尚未加载。' : '部分页面资源未能加载。');
    }
    if (overlay) {
      overlay.classList.add('is-leaving');
      window.setTimeout(function () {
        overlay.remove();
        overlay = null;
      }, 500);
    }
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
        if (released || !overlay) return;
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
  } else {
    prepareFirstView();
  }
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) release();
  });
})();
