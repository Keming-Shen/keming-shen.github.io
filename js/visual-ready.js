(function () {
  var root = document.documentElement;
  var backgroundReady;
  var backgroundPromise = new Promise(function (resolve) {
    backgroundReady = resolve;
  });
  var released = false;
  var overlay = null;

  root.classList.add('site-visual-loading');
  if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
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

  function release() {
    if (released) return;
    released = true;
    root.classList.remove('site-visual-loading');
    root.classList.remove('site-visual-mounted');
    root.classList.add('site-visual-ready');
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
    return new Promise(function (resolve) {
      var image = new Image();
      image.onload = resolve;
      image.onerror = resolve;
      image.src = url;
      if (image.complete) resolve();
    });
  }

  function backgroundUrl(element) {
    if (!element) return '';
    var match = window.getComputedStyle(element).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
    return match ? match[1] : '';
  }

  window.siteVisualGate = {
    backgroundReady: backgroundReady
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountOverlay, { once: true });
  } else {
    mountOverlay();
  }

  window.addEventListener('load', function () {
    var isAcademic = !!document.querySelector('.academic-home');
    var images = [preloadImage(backgroundUrl(document.getElementById('page-header')))];
    if (!isAcademic) {
      images.push(preloadImage('/image/background/bg_2.webp'));
      images.push(backgroundPromise);
    }
    if (document.fonts && document.fonts.ready) images.push(document.fonts.ready);

    Promise.all(images).then(release, release);
  });

  // A failed asset or blocked external resource must never trap the visitor.
  window.setTimeout(release, 18000);
})();
