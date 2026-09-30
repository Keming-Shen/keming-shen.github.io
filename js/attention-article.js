(function () {
  'use strict';

  // A single delegated handler survives Butterfly PJAX swaps without duplicate listeners.
  if (window.AttentionArticle) {
    window.AttentionArticle.init();
    return;
  }

  function init() {
    var present = Boolean(document.getElementById('attention-article-marker'));
    document.body.classList.toggle('attention-article-page', present);
  }

  function onExperimentClick(event) {
    var trigger = event.target.closest('a[data-lab-scene]');
    if (!trigger || !document.getElementById('attention-article-marker')) return;
    // Keep modified clicks and browser-native open-in-new-tab behavior intact.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    var lab = document.getElementById('transformer-lab');
    if (!lab) return;

    event.preventDefault();
    document.dispatchEvent(new CustomEvent('attention-lab:navigate', {
      detail: { scene: trigger.getAttribute('data-lab-scene') }
    }));
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    lab.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    lab.focus({ preventScroll: true });
  }

  window.AttentionArticle = { init: init };
  document.addEventListener('click', onExperimentClick);
  document.addEventListener('pjax:complete', init);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
