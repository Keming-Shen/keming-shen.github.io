(function () {
  var root = document.documentElement;
  var backgroundReady;
  var backgroundPromise = new Promise(function (resolve) {
    backgroundReady = resolve;
  });
  var released = false;

  root.classList.add('site-visual-loading');

  function release() {
    if (released) return;
    released = true;
    root.classList.remove('site-visual-loading');
    root.classList.add('site-visual-ready');
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
