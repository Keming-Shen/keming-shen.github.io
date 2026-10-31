/* Seasonal costume for the academic homepage. Runs in <head> before first paint.
   Active every year from START to END (visitor's local date, inclusive), unless the
   visitor switched it off this year. Preview any day with ?halloween=on / ?halloween=off. */
(function () {
  var START = { month: 10, day: 20 };
  var END = { month: 11, day: 2 };
  var STORAGE_KEY = 'academic-season-preference';
  var HANDOFF_KEY = 'site-navigation-handoff-v1';
  var NIGHT = '#120e19';
  var root = document.documentElement;
  var path = window.location.pathname;
  if (path !== '/' && path !== '/index.html') return;

  var now = new Date();
  var today = (now.getMonth() + 1) * 100 + now.getDate();
  var inSeason = today >= START.month * 100 + START.day && today <= END.month * 100 + END.day;

  var forced = null;
  try {
    var query = new URLSearchParams(window.location.search).get('halloween');
    if (query === 'on' || query === '1') forced = true;
    else if (query === 'off' || query === '0') forced = false;
  } catch (error) { /* Older browsers simply follow the calendar. */ }

  function readPreference() {
    try {
      var record = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
      // A choice belongs to one Halloween; next year starts in costume again.
      if (record && record.year === now.getFullYear()) return record.value;
    } catch (error) { /* Storage may be unavailable or hold an old format. */ }
    return null;
  }

  function hasHandoff() {
    try {
      var value = JSON.parse(window.sessionStorage.getItem(HANDOFF_KEY) || 'null');
      return !!value && value.destination === path + (window.location.search || '') && Date.now() - value.at < 15000;
    } catch (error) { return false; }
  }

  function setThemeColor(color) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', color);
  }

  function apply(active) {
    if (active) {
      root.setAttribute('data-season', 'halloween');
      setThemeColor(NIGHT);
    } else {
      root.removeAttribute('data-season');
      setThemeColor('#ffffff');
    }
  }

  var available = inSeason || forced === true;
  var active = forced !== null ? forced : inSeason && readPreference() !== 'off';
  if (available) root.setAttribute('data-season-available', 'halloween');
  apply(active);
  // A navigation from another page keeps its own loader palette (see visual-ready.js).
  if (active && !hasHandoff()) root.setAttribute('data-season-loader', 'halloween');

  window.academicSeason = {
    name: 'halloween',
    available: available,
    isActive: function () { return root.getAttribute('data-season') === 'halloween'; },
    set: function (on) {
      apply(on);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ year: now.getFullYear(), value: on ? 'on' : 'off' }));
      } catch (error) { /* The switch still works for this visit. */ }
      document.dispatchEvent(new CustomEvent('academic-season-change', { detail: { active: on } }));
    }
  };
})();
