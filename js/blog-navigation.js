(function () {
  'use strict';
  if (!window.fetch || !window.Promise || !window.AbortController) return;

  var TIMEOUT = 45000;
  var ASSET_TIMEOUT = 20000;
  var CONCURRENCY = 6;
  var retainedImages = new Map();
  var htmlCache = new Map();
  var active = null;
  var notice = null;
  var warmTimer = null;
  var warmController = null;

  function abortError() { return new DOMException('Loading cancelled', 'AbortError'); }
  function absolute(value, base) {
    if (!value || /^(?:data:|blob:|#|javascript:)/i.test(value.trim())) return '';
    try {
      var url = new URL(value, base);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }
  function urlsInCss(css) {
    var urls = [], expression = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi, match;
    while ((match = expression.exec(css || ''))) urls.push(match[1] || match[2] || match[3]);
    return urls;
  }
  function srcsetUrls(value) {
    // Inline data URLs may contain commas; consume each candidate through its
    // descriptor rather than splitting the data itself into bogus requests.
    var urls = [], expression = /(?:^|,\s*)(data:[^\s]+|[^\s,]+)(?:\s+\d+(?:\.\d+)?[wx])?/gi, match;
    while ((match = expression.exec(value || ''))) if (!/^data:/i.test(match[1])) urls.push(match[1]);
    return urls;
  }
  function selectedHero(doc) {
    return window.siteThemeBackground && window.siteThemeBackground.shouldUseHero
      ? window.siteThemeBackground.shouldUseHero(doc)
      : !doc.querySelector('.academic-home, #post, #post-info');
  }
  function collect(doc, base, current) {
    var resources = new Map();
    function add(value, type, options) {
      var url = absolute(value, base);
      if (url && !resources.has(url)) resources.set(url, { url: url, type: type, options: options || {} });
    }
    function addScript(src, options) {
      var url = absolute(src, base);
      if (!url) return;
      var parsed = new URL(url);
      // Comment service clients are asynchronous widgets. Restrict this rule
      // to their external hosts so local authored comment scripts still warm.
      if (parsed.origin !== window.location.origin && /(?:^|\.)(?:utteranc\.es|giscus\.app|disqus\.com|disquscdn\.com|disqusjs\.com|commento\.io|hyvor\.com)$/.test(parsed.hostname)) return;
      // Analytics and counters are independent of the page's content readiness.
      if (!/(?:hm\.baidu\.com|busuanzi\.ibruce\.info|google-analytics\.com|googletagmanager\.com|clarity\.ms|analytics)/i.test(url)) add(src, 'script', options);
    }
    doc.querySelectorAll('img, picture source, input[type="image"], image').forEach(function (element) {
      ['src', 'data-src', 'data-lazy-src', 'data-original', 'href', 'xlink:href'].forEach(function (attribute) {
        add(element.getAttribute(attribute), 'image');
      });
      ['srcset', 'data-srcset', 'data-lazy-srcset'].forEach(function (attribute) {
        srcsetUrls(element.getAttribute(attribute)).forEach(function (url) { add(url, 'image'); });
      });
      if (current && element.currentSrc) add(element.currentSrc, 'image');
    });
    doc.querySelectorAll('video[poster]').forEach(function (video) { add(video.getAttribute('poster'), 'image'); });
    doc.querySelectorAll('[style]').forEach(function (element) {
      if (element.id === 'web_bg' || element.id === 'footer' || (element.id === 'page-header' && selectedHero(doc))) return;
      urlsInCss(element.getAttribute('style')).forEach(function (url) { add(url, 'image'); });
    });
    doc.querySelectorAll('style').forEach(function (element) {
      cssDependencies(element.textContent, base, doc, add);
    });
    doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(function (element) {
      add(element.getAttribute('href'), 'css');
    });
    doc.querySelectorAll('script[src]').forEach(function (element) {
      addScript(element.getAttribute('src'), { crossOrigin: element.getAttribute('crossorigin') });
    });
    doc.querySelectorAll('script:not([src])').forEach(function (element) {
      // Butterfly's subtitle asks its helper for Typed.js from inline code.
      // Read explicit helper arguments without running the destination script
      // or following unrelated URLs stored in global configuration objects.
      var expression = /\bbtf\.(?:getScript|loadScript)\(\s*(["'])([^"'\\\r\n]*)\1/g, match;
      while ((match = expression.exec(element.textContent || ''))) addScript(match[2]);
      // Recognize only Butterfly's MathJax bootstrap, not arbitrary script.src
      // assignments such as optional widgets or interactive model viewers.
      if (/MathJax-script/.test(element.textContent || '') && /window\.MathJax/.test(element.textContent || '')) {
        expression = /\bscript\.src\s*=\s*(["'])([^"'\\\r\n]*)\1/g;
        while ((match = expression.exec(element.textContent || ''))) addMathJax(match[2]);
      }
    });
    function addMathJax(src) {
      addScript(src);
      var url = absolute(src, base);
      if (!url) return;
      var local = new URL(url);
      var vendor = local.pathname.match(/^(.*\/vendor\/mathjax-[^/]+\/)es5\/tex-mml-chtml(?:\.min)?\.js$/);
      if (local.origin === window.location.origin && vendor) add(local.origin + vendor[1] + 'preload.json', 'math-manifest');
    }
    // On a direct visit, the bootstrap's DCL callback has already added this node.
    doc.querySelectorAll('script#MathJax-script[src]').forEach(function (element) { addMathJax(element.getAttribute('src')); });
    if (current && window.getComputedStyle) {
      doc.querySelectorAll('#page-header, #article-container, #recent-posts, .post_cover, .avatar-img').forEach(function (element) {
        if (element.id === 'page-header' && selectedHero(doc)) return;
        urlsInCss(window.getComputedStyle(element).backgroundImage).forEach(function (url) { add(url, 'image'); });
      });
    }
    return resources;
  }

  function bounded(task, signal, timeout) {
    return new Promise(function (resolve, reject) {
      var timer, settled = false;
      var assetController = new AbortController();
      function finish(error, result) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        signal.removeEventListener('abort', cancelled);
        if (error) { assetController.abort(); reject(error); } else resolve(result);
      }
      function cancelled() { finish(abortError()); }
      if (signal.aborted) return cancelled();
      signal.addEventListener('abort', cancelled, { once: true });
      timer = window.setTimeout(function () { finish(new Error('Resource loading timed out')); }, timeout || ASSET_TIMEOUT);
      Promise.resolve().then(function () { return task(assetController.signal); }).then(function (result) { finish(null, result); }, finish);
    });
  }
  function loadImage(url, signal) {
    var cached = retainedImages.get(url);
    if (cached) return Promise.resolve(cached);
    return bounded(function (assetSignal) {
      return new Promise(function (resolve, reject) {
        var image = new Image();
        var settled = false;
        function cleanup() { image.onload = image.onerror = null; assetSignal.removeEventListener('abort', cancel); }
        function fail(error) { if (settled) return; settled = true; cleanup(); reject(error); }
        function cancel() { fail(abortError()); image.src = ''; }
        function decode() {
          if (settled) return;
          if (!image.naturalWidth) return fail(new Error('Image failed: ' + url));
          var ready = image.decode ? image.decode() : Promise.resolve();
          ready.then(function () {
            if (settled) return;
            settled = true; cleanup(); retainedImages.set(url, image);
            // Retain decoded images until departure while keeping repeated visits bounded.
            if (retainedImages.size > 350) retainedImages.delete(retainedImages.keys().next().value);
            resolve(image);
          }, fail);
        }
        if (assetSignal.aborted) { cancel(); return; }
        assetSignal.addEventListener('abort', cancel, { once: true });
        image.onload = decode;
        image.onerror = function () { fail(new Error('Image failed: ' + url)); };
        image.decoding = 'async';
        image.src = url;
        if (image.complete) decode();
      });
    }, signal);
  }
  function preloadOpaque(resource, signal) {
    return bounded(function (assetSignal) {
      return new Promise(function (resolve, reject) {
        var link = document.createElement('link');
        link.rel = 'preload'; link.as = resource.type === 'css' ? 'style' : resource.type;
        link.href = resource.url;
        if (resource.options.crossOrigin != null) link.crossOrigin = resource.options.crossOrigin;
        function clean() { link.onload = link.onerror = null; assetSignal.removeEventListener('abort', cancel); link.remove(); }
        function cancel() { clean(); reject(abortError()); }
        link.onload = function () { clean(); resolve(''); };
        link.onerror = function () { clean(); reject(new Error('Asset failed: ' + resource.url)); };
        if (assetSignal.aborted) { cancel(); return; }
        assetSignal.addEventListener('abort', cancel, { once: true });
        document.head.appendChild(link);
      });
    }, signal);
  }
  function fetchAsset(resource, signal) {
    if (new URL(resource.url).origin !== window.location.origin && resource.type === 'script') return preloadOpaque(resource, signal);
    return bounded(function (assetSignal) {
      return window.fetch(resource.url, { signal: assetSignal, credentials: 'same-origin', cache: 'default' }).then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + resource.url);
        return resource.type === 'css' || resource.type === 'math-manifest' ? response.text() : response.arrayBuffer();
      });
    }, signal);
  }
  function fontUsed(face, doc) {
    if (/fa-v4compatibility/i.test(face)) return false;
    if (/fa-solid/i.test(face)) return !!doc.querySelector('.fa, .fas, .fa-solid');
    if (/fa-regular/i.test(face)) return !!doc.querySelector('.far, .fa-regular');
    if (/fa-brands/i.test(face)) return !!doc.querySelector('.fab, .fa-brands');
    return true;
  }
  function cssDependencies(css, base, doc, add) {
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    css = css.replace(/@font-face\s*\{([^}]*)\}/gi, function (block, body) {
      if (!fontUsed(body, doc)) return '';
      var candidates = urlsInCss(body);
      var font = candidates.find(function (url) { return /\.woff2(?:[?#]|$)/i.test(url); })
        || candidates.find(function (url) { return /\.woff(?:[?#]|$)/i.test(url); })
        || candidates.find(function (url) { return /\.ttf(?:[?#]|$)/i.test(url); }) || candidates[0];
      if (font) add(absolute(font, base), 'font');
      return '';
    });
    css = css.replace(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?[^;]*;/gi, function (_, url) {
      add(absolute(url, base), 'css'); return '';
    });
    urlsInCss(css).forEach(function (url) {
      if (!/\.(?:woff2?|ttf|otf|eot)(?:[?#]|$)/i.test(url)) add(absolute(url, base), 'image');
    });
  }
  function loadResources(resources, doc, options) {
    var queue = Array.from(resources.values());
    var seen = new Set(resources.keys());
    var cursor = 0, completed = 0, failures = [];
    function report() { if (options.onProgress) options.onProgress({ completed: completed, total: queue.length, failures: failures.length }); }
    function add(url, type) {
      if (!url || seen.has(url)) return;
      seen.add(url); queue.push({ url: url, type: type, options: {} }); report();
    }
    async function worker() {
      while (cursor < queue.length) {
        if (options.signal.aborted) throw abortError();
        var resource = queue[cursor++];
        try {
          if (resource.type === 'image') await loadImage(resource.url, options.signal);
          else {
            var data = await fetchAsset(resource, options.signal);
            if (resource.type === 'css') cssDependencies(data, resource.url, doc, add);
            if (resource.type === 'math-manifest') {
              var manifest = JSON.parse(data);
              ['fonts', 'scripts'].forEach(function (key) {
                (manifest[key] || []).forEach(function (path) {
                  var url = absolute(path, resource.url);
                  if (url && new URL(url).origin === window.location.origin) add(url, key === 'fonts' ? 'font' : 'script');
                });
              });
            }
          }
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          failures.push({ url: resource.url, message: error.message });
        }
        completed++; report();
      }
    }
    report();
    return Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, queue.length)) }, worker))
      .then(function () { return { completed: completed, total: queue.length, failures: failures }; });
  }
  function activateImages(doc) {
    doc.querySelectorAll('img, picture source').forEach(function (image) {
      var src = image.getAttribute('data-lazy-src') || image.getAttribute('data-src') || image.getAttribute('data-original');
      var srcset = image.getAttribute('data-lazy-srcset') || image.getAttribute('data-srcset');
      if (src) image.setAttribute('src', src);
      if (srcset) image.setAttribute('srcset', srcset);
      if (image.tagName === 'IMG') { image.loading = 'eager'; image.setAttribute('loading', 'eager'); }
    });
  }
  function decodeDocumentImages(doc, signal) {
    return Promise.all(Array.from(doc.querySelectorAll('img')).map(function (image) {
      return bounded(function () {
        if (image.complete && image.naturalWidth) return image.decode ? image.decode().catch(function () {}) : Promise.resolve();
        if (image.complete) return Promise.resolve();
        return new Promise(function (resolve) {
          function done() {
            image.removeEventListener('load', done); image.removeEventListener('error', done);
            if (image.naturalWidth && image.decode) image.decode().then(resolve, resolve); else resolve();
          }
          image.addEventListener('load', done, { once: true }); image.addEventListener('error', done, { once: true });
        });
      }, signal).catch(function (error) { if (error.name === 'AbortError') throw error; });
    }));
  }
  function beginBackground(doc, current) {
    var background = window.siteThemeBackground;
    if (!background) return null;
    var theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    return { theme: theme, promise: current ? background.currentReady || background.ready : background.prepare(theme, { document: doc }) };
  }
  function waitForMathJax(signal) {
    var script = document.getElementById('MathJax-script');
    var math = window.MathJax;
    if (!script && !(math && math.startup && math.startup.promise)) return Promise.resolve();
    return bounded(function (assetSignal) {
      return new Promise(function (resolve, reject) {
        function cleanup() {
          if (script) { script.removeEventListener('load', loaded); script.removeEventListener('error', failed); }
          assetSignal.removeEventListener('abort', cancelled);
        }
        function ready() {
          var startup = window.MathJax && window.MathJax.startup;
          if (!startup || !startup.promise) return false;
          cleanup(); Promise.resolve(startup.promise).then(resolve, reject); return true;
        }
        function loaded() { if (!ready()) { cleanup(); reject(new Error('MathJax did not initialize')); } }
        function failed() { cleanup(); reject(new Error('MathJax failed to load')); }
        function cancelled() { cleanup(); reject(abortError()); }
        if (assetSignal.aborted) return cancelled();
        assetSignal.addEventListener('abort', cancelled, { once: true });
        if (script) { script.addEventListener('load', loaded, { once: true }); script.addEventListener('error', failed, { once: true }); }
        ready();
      });
    }, signal, TIMEOUT);
  }
  async function settleBackground(doc, current, signal, state) {
    if (!state) return null;
    while (true) {
      var result = await bounded(function () { return state.promise; }, signal).catch(function (error) {
        if (error.name === 'AbortError') throw error;
        return { loaded: false, error: error.message };
      });
      var theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      var latest = current && (window.siteThemeBackground.currentReady || window.siteThemeBackground.ready);
      var selectionMatches = current || !selectedHero(doc) || !window.siteThemeBackground.choose || !result || typeof result.url !== 'string'
        || window.siteThemeBackground.choose(theme).url === result.url;
      if (theme === state.theme && (!current || latest === state.promise) && selectionMatches) return result;
      state = beginBackground(doc, current);
    }
  }
  async function prepareDocument(doc, base, options) {
    options = options || {};
    var ownController = options.signal ? null : new AbortController();
    if (ownController) options.signal = ownController.signal;
    var current = doc === document;
    if (current) activateImages(doc);
    var resources = collect(doc, base, current);
    var backgroundState = beginBackground(doc, current);
    // Resource downloads run concurrently with the selected hero's preparation.
    var results = await Promise.all([
      loadResources(resources, doc, options),
      backgroundState ? bounded(function () { return backgroundState.promise; }, options.signal).catch(function (error) {
        if (error.name === 'AbortError') throw error;
        return { loaded: false, error: error.message };
      }) : Promise.resolve(null)
    ]);
    if (current) {
      await decodeDocumentImages(doc, options.signal);
      await waitForMathJax(options.signal).catch(function (error) {
        if (error.name === 'AbortError') throw error;
        results[0].failures.push({ url: 'MathJax', message: error.message });
      });
      if (document.fonts && document.fonts.ready) await bounded(function () { return document.fonts.ready; }, options.signal).catch(function (error) {
        if (error.name === 'AbortError') throw error;
        results[0].failures.push({ url: 'fonts', message: error.message });
      });
    }
    // A reader may change theme while the image batch is downloading. Reserve
    // and await the final theme before departure, and the latest paint on entry.
    var finalBackground = await settleBackground(doc, current, options.signal, backgroundState);
    if (current) {
      // Async DCL widgets may mount an image while fonts or the hero are being
      // prepared. Recheck the live DOM once at the final release boundary.
      await new Promise(function (resolve) { window.setTimeout(resolve, 0); });
      if (options.signal.aborted) throw abortError();
      activateImages(doc);
      await decodeDocumentImages(doc, options.signal);
      finalBackground = await settleBackground(doc, current, options.signal, beginBackground(doc, current));
    }
    if (finalBackground && finalBackground.loaded === false) results[0].failures.push({ url: finalBackground.url || 'background', message: finalBackground.error || 'Background failed' });
    return results[0];
  }
  function fetchHTML(url, signal) {
    var key = url.split('#')[0];
    var cached = htmlCache.get(key);
    if (cached && Date.now() - cached.time < 60000) return Promise.resolve(cached.html);
    return window.fetch(key, { signal: signal, credentials: 'same-origin', cache: 'default', headers: { Accept: 'text/html' } }).then(function (response) {
      if (!response.ok || response.url && new URL(response.url).origin !== window.location.origin) throw new Error('Page could not be loaded');
      if (!/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('This link is not a page');
      return response.text();
    }).then(function (html) {
      htmlCache.set(key, { html: html, time: Date.now() });
      if (htmlCache.size > 3) htmlCache.delete(htmlCache.keys().next().value);
      return html;
    });
  }
  function closeNotice() { if (notice) notice.remove(); notice = null; }
  function showNotice(message, actions) {
    closeNotice();
    notice = document.createElement('div'); notice.className = 'blog-navigation-notice';
    notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite'); notice.setAttribute('aria-atomic', 'true');
    var label = document.createElement('span'); label.className = 'blog-navigation-label'; label.textContent = message; notice.appendChild(label);
    (actions || []).forEach(function (action) {
      var button = document.createElement('button'); button.type = 'button'; button.textContent = action.label;
      button.addEventListener('click', action.run); notice.appendChild(button);
    });
    document.body.appendChild(notice);
    return label;
  }
  function stopActive() {
    if (active) { active.controller.abort(); window.clearTimeout(active.timer); active = null; }
  }
  function cancel() {
    stopActive();
    closeNotice();
    if (window.siteVisualGate && window.siteVisualGate.cancelNavigation) window.siteVisualGate.cancelNavigation();
  }
  function loading(message, actions) {
    closeNotice();
    var gate = window.siteVisualGate;
    gate.showNavigation(message, actions);
    return { update: function (text, progress) { gate.updateNavigation(text, progress); } };
  }
  function depart(url) {
    if (window.siteVisualGate && window.siteVisualGate.commitNavigation) window.siteVisualGate.commitNavigation(url);
    window.location.assign(url);
  }
  async function navigate(url) {
    cancel();
    if (warmController) warmController.abort();
    window.clearTimeout(warmTimer);
    var gate = window.siteVisualGate;
    if (!gate || ['showNavigation', 'updateNavigation', 'commitNavigation', 'cancelNavigation'].some(function (method) {
      return typeof gate[method] !== 'function';
    })) {
      // If the transition helper failed or an older cached version is active,
      // let the destination's loading screen take over without a bottom loader.
      window.location.assign(url);
      return;
    }
    var controller = new AbortController();
    var job = { controller: controller, timer: null, timedOut: false }; active = job;
    job.timer = window.setTimeout(function () { job.timedOut = true; controller.abort(); }, TIMEOUT);
    var progressView = loading('Loading…', [{ label: '取消', run: cancel }]);
    function failure(message) {
      loading(message, [
        { label: '重试', run: function () { navigate(url); } },
        { label: '继续打开', run: function () {
          if (active) { active.controller.abort(); window.clearTimeout(active.timer); active = null; }
          closeNotice(); depart(url);
        } },
        { label: '取消', run: cancel }
      ]);
    }
    try {
      var html = await fetchHTML(url, controller.signal);
      var doc = new DOMParser().parseFromString(html, 'text/html');
      if (doc.querySelector('.academic-home')) { cancel(); window.location.assign(url); return; }
      var result = await prepareDocument(doc, url, { signal: controller.signal, onProgress: function (progress) {
        if (active !== job) return;
        progressView.update('Loading ' + progress.completed + '/' + progress.total, progress);
      } });
      if (active !== job || controller.signal.aborted) return;
      window.clearTimeout(job.timer);
      if (result.failures.length) {
        active = null;
        failure('有 ' + result.failures.length + ' 项资源未能加载。');
        return;
      }
      depart(url);
    } catch (error) {
      if (active !== job) return;
      window.clearTimeout(job.timer); active = null;
      if (error.name === 'AbortError' && !job.timedOut) { closeNotice(); return; }
      failure(job.timedOut ? '准备页面超时，请重试或继续打开。' : '页面未能加载，请重试或继续打开。');
    }
  }
  function eligible(event) {
    if (event.defaultPrevented || event.button != null && event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor || anchor.hasAttribute('download') || anchor.target && anchor.target.toLowerCase() !== '_self' || anchor.hasAttribute('data-no-preload')) return null;
    var raw = anchor.getAttribute('href');
    if (!raw || raw.charAt(0) === '#') return null;
    var url;
    try { url = new URL(raw, window.location.href); } catch (_) { return null; }
    if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol) || /^\/(?:index\.html)?$/.test(url.pathname)) return null;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
    if (/\.[a-z0-9]{1,8}$/i.test(url.pathname) && !/\.html$/i.test(url.pathname)) return null;
    var isLifestyle = !document.querySelector('.academic-home');
    var route = /^\/(?:blog|archives|categories|tags|gallery|motion|transformer|embodied)(?:\/|$)/i.test(url.pathname) || /^\/\d{4}\/\d{1,2}\/\d{1,2}\//.test(url.pathname);
    var contentLink = isLifestyle && anchor.closest('#post, #recent-posts, #pagination, #archive, #category, #tag, .article-sort, .aside-list');
    return route || contentLink ? url.href : null;
  }
  document.addEventListener('click', function (event) {
    var url = eligible(event);
    if (!url) return;
    event.preventDefault();
    navigate(url);
  });
  // Intent warms only one HTML document, never its whole image collection.
  function warm(event) {
    var url = eligible(event);
    if (!url || active || navigator.connection && (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType))) return;
    window.clearTimeout(warmTimer);
    warmTimer = window.setTimeout(function () {
      if (warmController) warmController.abort();
      warmController = new AbortController();
      var timer = window.setTimeout(function () { if (warmController) warmController.abort(); }, 4000);
      fetchHTML(url, warmController.signal).catch(function () {}).finally(function () { window.clearTimeout(timer); });
    }, 180);
  }
  document.addEventListener('pointerover', warm);
  document.addEventListener('focusin', warm);
  window.addEventListener('pageshow', function () { cancel(); });
  window.addEventListener('pagehide', function () {
    // Keep the committed loading screen painted until the browser replaces the
    // document. Back/forward restoration clears it in the pageshow handler.
    stopActive(); closeNotice();
    window.clearTimeout(warmTimer);
    if (warmController) warmController.abort();
  });

  window.siteBlogResources = {
    prepareDocument: prepareDocument,
    prepareCurrent: function (options) {
      // Later DCL listeners mount known dynamic static assets (notably MathJax).
      // Let that event finish before collecting the current document.
      return new Promise(function (resolve) { window.setTimeout(resolve, 0); }).then(function () {
        if (options && options.signal && options.signal.aborted) throw abortError();
        return prepareDocument(document, window.location.href, options);
      });
    },
    preloadImage: loadImage,
    collect: collect,
    navigate: navigate,
    cancel: cancel,
    eligible: eligible,
    notify: function (message) { showNotice(message, [{ label: '关闭', run: closeNotice }]); }
  };
})();
