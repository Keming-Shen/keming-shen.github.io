(function () {
  const DATA_URL = '/announcement-data.json';
  const DEFAULT_LOCATION = { city: '宁波市', cityKey: 'ningbo', latitude: 29.87819, longitude: 121.54945 };
  const WEATHER_CACHE_MS = 20 * 60 * 1000;
  let disposeHeadlineLayout = null;
  const WMO_DESCRIPTIONS = {
    0: '晴', 1: '少云', 2: '多云', 3: '阴', 45: '雾', 48: '冻雾',
    51: '轻微毛毛雨', 53: '毛毛雨', 55: '强毛毛雨', 56: '冻毛毛雨', 57: '冻毛毛雨',
    61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨',
    71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
    80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '阵雪',
    95: '雷暴', 96: '雷暴伴冰雹', 97: '强雷暴', 99: '雷暴伴冰雹'
  };
  const FEATURED_ACHIEVEMENT = {
    badge: '科研成果',
    title: '[AAAI-2026] 细粒度运动生成 FineXtrol',
    link: 'https://ojs.aaai.org/index.php/AAAI/article/view/37845'
  };


  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Shanghai'
    }).format(date);
  }

  function getWeatherKind(code) {
    if (code === null || code === undefined || code === '') return 'unknown';
    const value = Number(code);
    if (value === 0) return 'clear';
    if (value === 1 || value === 2) return 'partly-cloudy';
    if (value === 3) return 'cloudy';
    if (value === 45 || value === 48) return 'fog';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return 'rain';
    if ([71, 73, 75, 77, 85, 86].includes(value)) return 'snow';
    if ([95, 96, 97, 99].includes(value)) return 'thunder';
    return 'unknown';
  }

  function buildWeatherIcon(code, isDay) {
    const kind = getWeatherKind(code);
    const icons = {
      clear: isDay === false ? 'clear-night' : 'clear-day',
      'partly-cloudy': isDay === false ? 'partly-cloudy-night' : 'partly-cloudy-day',
      cloudy: 'cloudy', fog: 'fog', rain: 'rain', snow: 'snow',
      thunder: 'thunderstorms', unknown: 'not-available'
    };
    const icon = icons[kind];
    const base = '/image/weather/icons';
    return `<picture class="auto-announcement__weather-icon" data-weather-kind="${kind}" aria-hidden="true"><source media="(prefers-reduced-motion: reduce)" srcset="${base}/static/${icon}.svg"><img src="${base}/animated/${icon}.svg" width="76" height="76" alt="" loading="lazy" decoding="async"></picture>`;
  }

  function formatReading(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return '—';
    const number = Number(value);
    return Number.isFinite(number) ? String(Math.round(number)) : '—';
  }

  function getLocation(data) {
    const location = data.weatherLocation;
    if (!location?.cityKey) return DEFAULT_LOCATION;
    return location.cityKey === DEFAULT_LOCATION.cityKey ? { ...DEFAULT_LOCATION, ...location } : location;
  }

  function isUsableWeather(weather, location) {
    const observedTime = Date.parse(weather?.observedAt);
    const age = Date.now() - observedTime;
    return weather?.cityKey === location.cityKey && weather.source === 'open-meteo' &&
      Number.isFinite(observedTime) && age >= -15 * 60 * 1000 && age <= 6 * 60 * 60 * 1000;
  }

  function buildWeatherPanel(data) {
    const location = getLocation(data);
    const weather = isUsableWeather(data.weather, location) ? data.weather : null;
    const temperature = formatReading(weather?.tempC);
    const feelsLike = formatReading(weather?.feelsLikeC);
    const humidity = formatReading(weather?.humidity);
    const observationLabel = formatTime(weather?.observedAt);
    const updateLabel = observationLabel ? `${observationLabel.slice(-5)} ${weather.status === 'cached' ? '缓存' : '更新'}` : '等待更新';
    const condition = weather?.description || '天气暂不可用';
    return `
      <section class="auto-announcement__panel auto-announcement__panel--weather" aria-label="${escapeHtml(location.city)}天气">
        <div class="auto-announcement__weather-head">
          <span class="auto-announcement__weather-city"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true" focusable="false"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/></svg>${escapeHtml(location.city)}</span>
          <span class="auto-announcement__weather-updated" title="${escapeHtml(observationLabel ? `天气数据时间：${observationLabel}（北京时间）` : '暂无可用天气数据')}">${escapeHtml(updateLabel)}</span>
        </div>
        <div class="auto-announcement__weather-main">
          <div>
            <div class="auto-announcement__weather-temp">${temperature}<span class="auto-announcement__weather-unit">°C</span></div>
            <div class="auto-announcement__weather-text">${escapeHtml(condition)}</div>
          </div>
          ${buildWeatherIcon(weather?.weatherCode, weather?.isDay)}
        </div>
        <dl class="auto-announcement__weather-meta">
          <div><dt>体感</dt><dd>${feelsLike}${feelsLike === '—' ? '' : '<span>°C</span>'}</dd></div>
          <div><dt>湿度</dt><dd>${humidity}${humidity === '—' ? '' : '<span>%</span>'}</dd></div>
        </dl>

      </section>
    `;
  }

  function buildHeadlineList(items) {
    if (!Array.isArray(items) || !items.length) {
      return '<div class="auto-announcement__empty">今日头条暂时不可用</div>';
    }

    return `
      <ol class="auto-announcement__list" aria-label="IT资讯">
        ${items.slice(0, 10)
          .map((item, index) => {
            const title = escapeHtml(item.title);
            const link = escapeHtml(item.link || '#');
            return `
              <li class="auto-announcement__item">
                <span class="auto-announcement__item-index">${index + 1}</span>
                <a href="${link}" target="_blank" rel="noopener noreferrer">${title}</a>
              </li>
            `;
          })
          .join('')}
      </ol>
    `;
  }

  // Fill the available sidebar height with news while preserving widget gaps.
  function observeHeadlineLayout(el, visibleCount) {
    if (disposeHeadlineLayout) disposeHeadlineLayout();
    const list = el.querySelector('.auto-announcement__list');
    const aside = el.closest('#aside-content');
    const articles = document.querySelector('#recent-posts > .recent-post-items');
    if (!list || !aside || !articles) return;
    const items = [...list.children];
    const baseline = items.slice(0, visibleCount);
    let frame = 0;
    let disposed = false;

    const fit = () => {
      frame = 0;
      if (!el.isConnected) { dispose(); return; }
      const desktop = window.matchMedia('(min-width: 961px)').matches &&
        getComputedStyle(aside).display === 'flex' &&
        getComputedStyle(aside.parentElement).display === 'grid';
      if (!desktop) {
        list.classList.remove('auto-announcement__list--fit');
        list.style.removeProperty('height');
        list.removeAttribute('tabindex');

        return;
      }

      list.classList.add('auto-announcement__list--fit');
      list.tabIndex = 0;
      const minimum = baseline.at(-1).getBoundingClientRect().bottom - baseline[0].getBoundingClientRect().top;
      const widgets = [...aside.querySelectorAll('.card-widget')].filter(widget => getComputedStyle(widget).display !== 'none');
      const gap = parseFloat(getComputedStyle(aside).rowGap) || 0;
      const fixedHeight = widgets.reduce((height, widget) => height + widget.getBoundingClientRect().height, 0)
        - list.getBoundingClientRect().height + gap * Math.max(0, widgets.length - 1);
      const available = aside.getBoundingClientRect().height - fixedHeight;
      if (available < minimum) {
        // Short pages scroll the sidebar as a whole, without nested news scrolling.
        list.style.removeProperty('height');
        list.removeAttribute('tabindex');

        return;
      }
      const height = available;
      const nextHeight = `${Math.round(height * 100) / 100}px`;
      if (list.style.height !== nextHeight) list.style.height = nextHeight;

    };

    const schedule = () => {
      if (!disposed && !frame) frame = window.requestAnimationFrame(fit);
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    const dispose = () => {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
    };
    disposeHeadlineLayout = dispose;
    [articles, aside, ...aside.querySelectorAll('.card-widget'), ...baseline].forEach(node => observer?.observe(node));
    window.addEventListener('resize', schedule, { passive: true });
    document.fonts?.ready.then(schedule);
    schedule();
  }

  function render(el, data) {
    const weatherHtml = buildWeatherPanel(data);
    const visibleCount = Number.isInteger(data.headlineVisibleCount) && data.headlineVisibleCount > 0 ? data.headlineVisibleCount : 7;

    const featuredHtml = `
      <a class="auto-announcement__panel auto-announcement__panel--featured auto-announcement__featured" href="${escapeHtml(FEATURED_ACHIEVEMENT.link)}" target="_blank" rel="noopener noreferrer">
        <div class="auto-announcement__panel-head">
          <span class="auto-announcement__badge auto-announcement__badge--featured">${escapeHtml(FEATURED_ACHIEVEMENT.badge)}</span>
        </div>
        <div class="auto-announcement__featured-title">${escapeHtml(FEATURED_ACHIEVEMENT.title)}</div>
      </a>
    `;

    el.innerHTML = `
      <div class="auto-announcement__inner">
        ${weatherHtml}
        ${featuredHtml}
        <section class="auto-announcement__panel auto-announcement__panel--headlines">
          <div class="auto-announcement__section-title-row">
            <div class="auto-announcement__section-title">${escapeHtml(data.labels?.headlines || '今日摘要')}</div>
          </div>
          ${buildHeadlineList(data.headlines)}
        </section>
        ${data.generatedAt ? `<div class="auto-announcement__meta">摘要更新于 ${escapeHtml(formatTime(data.generatedAt))}</div>` : ''}
      </div>
    `;

    el.dataset.loaded = 'true';
    observeHeadlineLayout(el, visibleCount);
  }

  function weatherStorage() {
    try { return window.localStorage; } catch { return null; }
  }

  async function fetchLiveWeather(location) {
    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      throw new Error('天气位置缺少坐标');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const params = new URLSearchParams({
        latitude: String(location.latitude), longitude: String(location.longitude),
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day',
        timezone: 'Asia/Shanghai', timeformat: 'unixtime'
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { current = {} } = await response.json();
      if (!Number.isFinite(current.temperature_2m) || !Number.isFinite(current.time)) {
        throw new Error('天气响应缺少温度或数据时间');
      }
      const weather = {
        ...location,
        tempC: current.temperature_2m,
        feelsLikeC: Number.isFinite(current.apparent_temperature) ? current.apparent_temperature : null,
        humidity: Number.isFinite(current.relative_humidity_2m) ? current.relative_humidity_2m : null,
        weatherCode: Number.isFinite(current.weather_code) ? current.weather_code : null,
        isDay: current.is_day === 1 ? true : current.is_day === 0 ? false : null,
        description: WMO_DESCRIPTIONS[current.weather_code] || '天气未知',
        observedAt: new Date(current.time * 1000).toISOString(), source: 'open-meteo', status: 'fresh'
      };
      if (!isUsableWeather(weather, location)) throw new Error('天气响应的数据时间已过期');
      return weather;
    } finally {
      clearTimeout(timer);
    }
  }

  async function revalidateWeather(location, staticWeather, { storage = weatherStorage(), fetchWeather = fetchLiveWeather, onCached = () => {} } = {}) {
    const cacheKey = `blog-weather-v1:${location.cityKey}`;
    let cached;
    try { cached = JSON.parse(storage?.getItem(cacheKey) || 'null'); } catch { /* Storage may be disabled. */ }
    const sameCoordinates = cached?.weather?.latitude === location.latitude && cached?.weather?.longitude === location.longitude;
    const usableCache = sameCoordinates && isUsableWeather(cached?.weather, location);
    const candidates = [staticWeather, usableCache ? cached.weather : null]
      .filter((weather) => isUsableWeather(weather, location))
      .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
    const fallback = candidates[0] || null;
    if (fallback) onCached(fallback);
    const cacheAge = Date.now() - cached?.fetchedAt;
    if (usableCache && cacheAge >= 0 && cacheAge < WEATHER_CACHE_MS) return fallback;
    try {
      const weather = await fetchWeather(location);
      if (!isUsableWeather(weather, location)) throw new Error('天气响应城市或时间无效');
      try { storage?.setItem(cacheKey, JSON.stringify({ fetchedAt: Date.now(), weather })); } catch { /* Keep live data when storage is unavailable. */ }
      return weather;
    } catch {
      return fallback ? { ...fallback, status: 'cached' } : null;
    }
  }

  async function refreshWeatherPanel(el, data) {
    const location = getLocation(data);
    const update = (weather) => {
      if (!el.isConnected) return;
      const panel = el.querySelector('.auto-announcement__panel--weather');
      if (panel) panel.outerHTML = buildWeatherPanel({ weatherLocation: location, weather });
    };
    const weather = await revalidateWeather(location, data.weather, { onCached: update });
    update(weather);
  }

  async function loadAnnouncement() {
    const el = document.getElementById('auto-announcement');
    if (!el) {
      if (disposeHeadlineLayout) disposeHeadlineLayout();
      disposeHeadlineLayout = null;
      return;
    }
    if (el.dataset.loaded === 'true') return;

    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      render(el, data);
      void refreshWeatherPanel(el, data);
    } catch (error) {
      const fallback = { weather: null, headlines: [] };
      render(el, fallback);
      void refreshWeatherPanel(el, fallback);
      console.warn('[announcement] 公告摘要加载失败：', error);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildWeatherIcon, buildWeatherPanel, fetchLiveWeather, formatReading, getWeatherKind, revalidateWeather };
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', loadAnnouncement);
    document.addEventListener('pjax:complete', loadAnnouncement);
  }
})();
