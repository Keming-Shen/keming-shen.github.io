(function () {
  try {
    var stored = localStorage.getItem('theme');
    var savedTheme;
    if (stored === 'dark' || stored === 'light') savedTheme = stored;
    else if (stored) {
      try {
        var record = JSON.parse(stored);
        if (record && record.expiry > Date.now()) savedTheme = record.value;
      } catch (error) { /* Expired or invalid preferences fall back to dark. */ }
    }
    if (savedTheme !== 'light' && savedTheme !== 'dark') savedTheme = null;
    if (!savedTheme) {
      savedTheme = 'dark';
    }
    if (window.btf && window.btf.saveToLocal) window.btf.saveToLocal.set('theme', savedTheme, 365);
    else localStorage.setItem('theme', JSON.stringify({ value: savedTheme, expiry: Date.now() + 365 * 86400000 }));
    document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : 'dark');
  } catch (error) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
