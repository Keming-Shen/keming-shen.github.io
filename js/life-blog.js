(function () {
  var revealObserver = null;
  var progressBar = null;
  var progressQueued = false;
  var scrollBound = false;

  function updateProgress() {
    progressQueued = false;
    if (!progressBar) return;
    var article = document.querySelector('#post #article-container');
    if (!article) return;

    var top = window.scrollY + article.getBoundingClientRect().top;
    var end = top + article.offsetHeight - window.innerHeight * .55;
    var fraction = end > top ? (window.scrollY - top) / (end - top) : 0;
    progressBar.style.transform = 'scaleX(' + Math.max(0, Math.min(1, fraction)) + ')';
  }

  function scheduleProgress() {
    if (progressQueued) return;
    progressQueued = true;
    window.requestAnimationFrame(updateProgress);
  }

  function initLifeBlog() {
    if (revealObserver) {
      revealObserver.disconnect();
      revealObserver = null;
    }

    if (progressBar) {
      progressBar.remove();
      progressBar = null;
    }

    if (document.querySelector('.academic-home')) return;

    // External media can keep window.load pending long after the page is usable.
    var loadingBox = document.getElementById('loading-box');
    if (loadingBox) {
      loadingBox.classList.add('loaded');
      document.body.style.overflow = '';
    }

    var isArticle = !!document.querySelector('#post #article-container');
    var currentPath = window.location.pathname;
    document.querySelectorAll('#nav .site-page[aria-current]').forEach(function (link) {
      link.removeAttribute('aria-current');
    });
    document.querySelectorAll('#nav .site-page[href]').forEach(function (link) {
      var path = new URL(link.href, window.location.href).pathname;
      if (path === currentPath || (isArticle && path === '/blog/')) {
        link.setAttribute('aria-current', 'page');
      }
    });

    if (isArticle) {
      progressBar = document.createElement('div');
      progressBar.className = 'life-reading-progress';
      progressBar.setAttribute('aria-hidden', 'true');
      document.body.appendChild(progressBar);
      if (!scrollBound) {
        window.addEventListener('scroll', scheduleProgress, { passive: true });
        window.addEventListener('resize', scheduleProgress);
        scrollBound = true;
      }
      scheduleProgress();
    }

    if (!window.IntersectionObserver || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cards = document.querySelectorAll('#recent-posts .recent-post-item:not(.ads-wrap)');
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('life-revealed');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px 70px 0px', threshold: .08 });
    cards.forEach(function (card) {
      card.classList.add('life-reveal-pending');
      revealObserver.observe(card);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLifeBlog);
  } else {
    initLifeBlog();
  }
  document.addEventListener('pjax:complete', initLifeBlog);
})();
