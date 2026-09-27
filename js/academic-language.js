(function () {
  var defaultDocumentLanguage = document.documentElement.lang || 'zh-CN';

  function initAcademicLanguage() {
    var home = document.querySelector('.academic-home');
    if (!home) {
      if (document.documentElement.dataset.academicLanguage) {
        document.documentElement.lang = defaultDocumentLanguage;
        delete document.documentElement.dataset.academicLanguage;
      }
      return;
    }

    if (home.dataset.languageReady === 'true') return;

    var button = home.querySelector('.academic-home__language-switch');
    if (!button) return;

    var label = button.querySelector('span');
    var translations = Array.from(home.querySelectorAll('[data-zh]')).map(function (element) {
      return { element: element, english: element.textContent };
    });
    var languageBlocks = home.querySelectorAll('[data-language]');
    var currentLanguage = 'en';

    function setLanguage(language) {
      currentLanguage = language;
      translations.forEach(function (item) {
        item.element.textContent = language === 'zh' ? item.element.dataset.zh : item.english;
      });
      languageBlocks.forEach(function (block) {
        block.hidden = block.dataset.language !== language;
      });

      home.lang = language === 'zh' ? 'zh-CN' : 'en';
      document.documentElement.lang = home.lang;
      document.documentElement.dataset.academicLanguage = language;

      var targetIsChinese = language === 'en';
      label.textContent = targetIsChinese ? 'CN' : 'EN';
      button.lang = targetIsChinese ? 'zh-CN' : 'en';
      button.setAttribute('aria-label', targetIsChinese ? '切换为中文' : 'Switch to English');
      button.title = targetIsChinese ? '切换为中文' : 'Switch to English';
    }

    button.addEventListener('click', function () {
      setLanguage(currentLanguage === 'en' ? 'zh' : 'en');
    });

    home.dataset.languageReady = 'true';
    setLanguage('en');
    button.hidden = false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAcademicLanguage);
  } else {
    initAcademicLanguage();
  }
  document.addEventListener('pjax:complete', initAcademicLanguage);
})();
