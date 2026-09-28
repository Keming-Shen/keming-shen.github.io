(function () {
  var revealObserver = null;
  var progressBar = null;
  var progressQueued = false;
  var scrollBound = false;
  var sidebarObserver = null;
  var sidebarQueued = false;

  function alignListingSidebar() {
    sidebarQueued = false;
    var posts = document.getElementById('recent-posts');
    var aside = document.getElementById('aside-content');
    if (!posts || !aside) return;

    var recentItems = Array.from(aside.querySelectorAll('.card-recent-post .aside-list-item'));
    var lastCard = aside.querySelector('.card-webinfo');
    recentItems.forEach(function (item) { item.classList.remove('life-recent-hidden'); });
    if (!lastCard || window.matchMedia('(max-width: 960px)').matches) return;

    // Measure the sidebar at its natural height before the last card is anchored.
    aside.classList.add('life-aside-measuring');
    for (var i = recentItems.length - 1; i >= 1; i--) {
      if (lastCard.getBoundingClientRect().bottom <= posts.getBoundingClientRect().bottom + 2) break;
      recentItems[i].classList.add('life-recent-hidden');
    }
    aside.classList.remove('life-aside-measuring');
  }

  function scheduleSidebarAlignment() {
    if (sidebarQueued) return;
    sidebarQueued = true;
    window.requestAnimationFrame(alignListingSidebar);
  }

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

    if (sidebarObserver) {
      sidebarObserver.disconnect();
      sidebarObserver = null;
    }

    if (progressBar) {
      progressBar.remove();
      progressBar = null;
    }

    if (document.querySelector('.academic-home')) return;

    var isArticle = !!document.querySelector('#post #article-container');
    var currentPath = window.location.pathname;

    if (document.getElementById('recent-posts')) {
      scheduleSidebarAlignment();
      if (window.ResizeObserver) {
        sidebarObserver = new ResizeObserver(scheduleSidebarAlignment);
        ['#recent-posts', '#aside-content', '#aside-content .card-recent-post'].forEach(function (selector) {
          var element = document.querySelector(selector);
          if (element) sidebarObserver.observe(element);
        });
      }
      if (document.fonts) document.fonts.ready.then(scheduleSidebarAlignment);
    }
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
  window.addEventListener('resize', scheduleSidebarAlignment, { passive: true });
})();
