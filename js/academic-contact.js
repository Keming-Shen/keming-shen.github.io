(function () {
  var messages = {
    en: {
      email: 'Email',
      wechat: 'WeChat ID',
      pending: ' · Copying…',
      copied: ' copied',
      failed: ' copy failed. Please copy below.'
    },
    zh: {
      email: '邮箱',
      wechat: '微信号',
      pending: '复制中…',
      copied: '已复制',
      failed: '复制失败，请手动复制'
    }
  };

  function initAcademicContact() {
    var home = document.querySelector('.academic-home');
    if (!home || home.dataset.contactReady === 'true') return;

    var toast = home.querySelector('.academic-contact-toast');
    if (!toast) return;

    var valueElement = toast.querySelector('.academic-contact-value');
    var status = toast.querySelector('.academic-contact-status');
    if (!valueElement || !status) return;

    var current = null;
    var copyVersion = 0;
    var hideTimer = null;

    function render() {
      var language = /^zh\b/i.test(home.lang) ? 'zh' : 'en';
      var labels = messages[language];
      if (!current) return;
      toast.lang = language === 'zh' ? 'zh-CN' : 'en';
      toast.dataset.state = current.status;
      // Keep the existing text node so language/status updates preserve a manual-copy selection.
      if (valueElement.textContent !== current.value) valueElement.textContent = current.value;
      status.textContent = labels[current.type] + labels[current.status];
    }

    function isCurrent(request) {
      return current === request && request.version === copyVersion &&
        home.isConnected;
    }

    function copyWithSelection(value) {
      var field = document.createElement('textarea');
      var previousFocus = document.activeElement;
      field.value = value;
      field.readOnly = true;
      field.tabIndex = -1;
      field.setAttribute('aria-hidden', 'true');
      field.className = 'academic-contact-copy-field';
      home.appendChild(field);
      var copied = false;
      try {
        field.focus({ preventScroll: true });
        field.select();
        copied = document.execCommand('copy') === true;
      } catch (error) {
        copied = false;
      } finally {
        field.remove();
        if (previousFocus && previousFocus.isConnected) {
          previousFocus.focus({ preventScroll: true });
        }
      }
      return copied;
    }

    function selectValue() {
      try {
        var selection = window.getSelection();
        if (!selection) return false;
        var range = document.createRange();
        range.selectNodeContents(valueElement);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      } catch (error) {
        return false;
      }
    }

    async function copyCurrent(request) {
      var copied = false;
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          // Begin within the trigger's click activation so browser clipboard permission can apply.
          await navigator.clipboard.writeText(request.value);
          copied = true;
        }
      } catch (error) {
        copied = false;
      }
      // A newer click or a PJAX navigation must invalidate earlier results.
      if (!isCurrent(request)) return;
      if (!copied) copied = copyWithSelection(request.value);
      if (!isCurrent(request)) return;
      request.status = copied ? 'copied' : 'failed';
      render();
      if (!copied) selectValue();
      hideTimer = setTimeout(function () {
        // Clearing a timer cannot cancel its callback if it was already queued.
        if (!isCurrent(request)) return;
        hideTimer = null;
        toast.hidden = true;
        current = null;
        copyVersion += 1;
      }, copied ? 3000 : 7000);
    }

    function beginCopy(type, value) {
      if (hideTimer !== null) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      current = { type: type, value: value, status: 'pending', version: ++copyVersion };
      toast.hidden = false;
      render();
      copyCurrent(current);
    }

    home.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      var trigger = target.closest('[data-contact-copy]');
      if (!trigger || !home.contains(trigger)) return;
      var type = trigger.dataset.contactCopy;
      var value = trigger.dataset.contactValue;
      if ((type !== 'email' && type !== 'wechat') || !value) return;
      event.preventDefault();
      beginCopy(type, value);
    });

    new MutationObserver(function () {
      if (!toast.hidden && home.isConnected) render();
    }).observe(home, { attributes: true, attributeFilter: ['lang'] });

    home.dataset.contactReady = 'true';
    toast.hidden = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAcademicContact);
  } else {
    initAcademicContact();
  }
  document.addEventListener('pjax:complete', initAcademicContact);
})();
