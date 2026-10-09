(function () {
  'use strict';
  if (window.siteThemeBackground) return;

  var root = document.documentElement;
  var manifest = window.SITE_THEME_BACKGROUNDS || {};
  var selections = {};
  var imageCache = {};
  var requestId = 0;
  var mounted = false;
  var firstReady;
  var ready = new Promise(function (resolve) { firstReady = resolve; });
  var STORAGE_PREFIX = 'site-theme-background:';
  var RESERVE_TTL = 2 * 60 * 1000;
  var DEFAULTS = {
    light: { base: '#f1f4f4', tint: '#e2edef', glow: '#f3ece7' },
    dark: { base: '#101823', tint: '#1b293c', glow: '#25243b' }
  };

  function currentTheme() { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function themeName(theme) { return theme === 'light' || theme === 'dark' ? theme : currentTheme(); }

  function readStore(key) {
    try { return JSON.parse(window.sessionStorage.getItem(STORAGE_PREFIX + key)); }
    catch (error) { return null; }
  }
  function writeStore(key, value) {
    try { window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); }
    catch (error) { /* Storage can be unavailable in privacy modes. */ }
  }
  function clearStore(key) {
    try { window.sessionStorage.removeItem(STORAGE_PREFIX + key); }
    catch (error) { /* The in-memory choice still works. */ }
  }

  function validAsset(entry, theme) {
    if (!entry || typeof entry.url !== 'string') return false;
    try {
      var url = new URL(entry.url, window.location.href);
      var pattern = theme === 'light' ? /\/image\/background\/day\d+\.webp$/i : /\/image\/background\/(?:day|night)\d+\.webp$/i;
      return url.origin === window.location.origin && pattern.test(url.pathname) && !url.search && !url.hash;
    } catch (error) { return false; }
  }

  function safePalette(entry, theme) {
    var palette = entry && entry.palette || {};
    var result = {};
    Object.keys(DEFAULTS[theme]).forEach(function (key) {
      result[key] = /^#[\da-f]{6}$/i.test(palette[key] || '') ? palette[key] : DEFAULTS[theme][key];
    });
    return result;
  }

  var pools = {};
  ['light', 'dark'].forEach(function (theme) {
    pools[theme] = (Array.isArray(manifest[theme]) ? manifest[theme] : []).filter(function (entry) {
      return validAsset(entry, theme);
    }).map(function (entry) { return { theme: theme, url: entry.url, palette: safePalette(entry, theme) }; });
  });

  function choose(theme, options) {
    theme = themeName(theme);
    var fresh = !!(options && options.fresh);
    if (!fresh && selections[theme]) return selections[theme];
    var pool = pools[theme];
    var reserve = !fresh && readStore('reserved:' + theme);
    var selected = reserve && reserve.expires > Date.now() && pool.find(function (asset) { return asset.url === reserve.url; });
    if (!selected) {
      var last = selections[theme] && selections[theme].url || readStore('last:' + theme);
      var candidates = pool.length > 1 ? pool.filter(function (asset) { return asset.url !== last; }) : pool;
      selected = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)]
        : { theme: theme, url: '', palette: DEFAULTS[theme] };
    }
    selections[theme] = selected;
    return selected;
  }

  function shouldUseHero(doc) {
    doc = doc || document;
    return !doc.querySelector('.academic-home') && !doc.querySelector('#post, #post-info');
  }

  function loadImage(url) {
    if (!url) return Promise.resolve(false);
    if (imageCache[url]) return imageCache[url];
    var pending = new Promise(function (resolve) {
      var image = new Image();
      var settled = false;
      var timer = window.setTimeout(function () { finish(false); }, 20000);
      function finish(loaded) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        image.onload = image.onerror = null;
        resolve(loaded);
      }
      image.decoding = 'async';
      image.fetchPriority = 'high';
      image.onload = function () {
        if (typeof image.decode !== 'function') { finish(true); return; }
        image.decode().then(function () { finish(true); }, function () { finish(image.naturalWidth > 0); });
      };
      image.onerror = function () { finish(false); };
      image.src = url;
      if (image.complete && image.naturalWidth > 0) image.onload();
    });
    imageCache[url] = pending;
    pending.then(function (loaded) {
      if (!loaded && imageCache[url] === pending) delete imageCache[url];
    });
    return pending;
  }

  function prepare(theme, options) {
    theme = themeName(theme);
    if (options && options.document && !shouldUseHero(options.document)) {
      return Promise.resolve({ theme: theme, url: '', palette: DEFAULTS[theme], loaded: true });
    }
    var selected = choose(theme, options);
    if (selected.url) writeStore('reserved:' + theme, { url: selected.url, expires: Date.now() + RESERVE_TTL });
    return loadImage(selected.url).then(function (loaded) {
      return { theme: theme, url: selected.url, palette: selected.palette, loaded: loaded };
    });
  }

  function setPalette(palette) {
    ['base', 'tint', 'glow'].forEach(function (key) {
      root.style.setProperty('--site-background-' + key, palette[key]);
    });
  }

  function signalReady(result) {
    if (firstReady) { firstReady(result); firstReady = null; }
    document.dispatchEvent(new CustomEvent('site:background-ready', { detail: result }));
  }

  function refresh(options) {
    var id = ++requestId;
    var theme = currentTheme();
    var academic = !!document.querySelector('.academic-home');
    var header = document.getElementById('page-header');
    var background = document.getElementById('web_bg');
    root.classList.toggle('site-background-academic', academic);
    // Clear video nodes left behind by a previous PJAX document.
    if (background) background.querySelectorAll('video').forEach(function (video) { video.remove(); });

    if (academic || !shouldUseHero(document) || !header) {
      setPalette(DEFAULTS[theme]);
      var simple = { theme: theme, url: '', palette: DEFAULTS[theme], loaded: true };
      window.siteThemeBackground.currentReady = Promise.resolve(simple);
      signalReady(simple);
      return window.siteThemeBackground.currentReady;
    }

    var selected = choose(theme, options);
    setPalette(selected.palette);
    // A theme switch shows its matching gradient until its artwork is decoded.
    header.style.setProperty('--site-hero-image', 'none');
    var pending = loadImage(selected.url).then(function (loaded) {
      var result = { theme: theme, url: selected.url, palette: selected.palette, loaded: loaded };
      if (id !== requestId || theme !== currentTheme() || header !== document.getElementById('page-header')) return result;
      if (loaded) header.style.setProperty('--site-hero-image', 'url("' + selected.url + '")');
      if (selected.url) writeStore('last:' + theme, selected.url);
      var reserve = readStore('reserved:' + theme);
      if (reserve && reserve.url === selected.url) clearStore('reserved:' + theme);
      signalReady(result);
      return result;
    });
    window.siteThemeBackground.currentReady = pending;
    return pending;
  }

  window.siteThemeBackground = {
    choose: choose,
    prepare: prepare,
    refresh: refresh,
    shouldUseHero: shouldUseHero,
    ready: ready,
    currentReady: ready
  };

  // Mark the known academic route early enough for a white initial paint.
  if (/^\/(?:index\.html)?$/.test(window.location.pathname)) root.classList.add('site-background-academic');

  function mount() { mounted = true; refresh(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
  document.addEventListener('pjax:complete', function () {
    // A new listing visit chooses a new image unless a navigation reserved one.
    selections = {};
    mount();
  });
  var observedTheme = currentTheme();
  new MutationObserver(function () {
    var next = currentTheme();
    if (next === observedTheme) return;
    observedTheme = next;
    if (mounted) refresh({ fresh: true });
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
})();
