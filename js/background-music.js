(function () {
  const STORAGE_ENABLED = 'keming-bgm-enabled';
  const STORAGE_TRACK = 'keming-bgm-track';
  const STORAGE_POSITION = 'keming-bgm-position';
  const AUDIO_ID = 'site-bgm-audio';
  const FLOAT_ID = 'site-bgm-floating';
  const PLAYLIST = [
    { title: 'Windy Hill', src: encodeURI('/music/windy_hill.mp3') },
    { title: '穿越时空的思念', src: encodeURI('/music/穿越时空的思念.mp3') },
    { title: '飞向遥远的天空', src: encodeURI('/music/飞向遥远的天空.mp3') }
  ];

  // 吸边缩入配置 - 更宽松的阈值
  const EDGE_THRESHOLD_RATIO = 0.35; // 视口宽高的 35%
  const EDGE_HIDE_RATIO = 0.58; // 隐藏时缩入 58%
  const EDGE_SNAP_ANIMATION_DURATION = 280; // 吸附动画时长
  const EDGE_HIDE_DELAY = 400; // 拖动结束后延迟隐藏

  let audio;
  let audioContext;
  let analyser;
  let dataArray;
  let animationId;
  let eventsBound = false;
  let viewportEventsBound = false;
  let dragState = null;
  let suppressNextActionClick = false;
  let edgeHideTimer = null;
  let isExpanded = true; // 球体是否完全展开

  function normalizeIndex(value) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0 || parsed >= PLAYLIST.length) return 0;
    return parsed;
  }

  function getSelectedIndex() {
    return normalizeIndex(localStorage.getItem(STORAGE_TRACK));
  }

  function setSelectedIndex(index) {
    localStorage.setItem(STORAGE_TRACK, String(normalizeIndex(index)));
  }

  function isEnabled() {
    return localStorage.getItem(STORAGE_ENABLED) === '1';
  }

  function setEnabled(enabled) {
    localStorage.setItem(STORAGE_ENABLED, enabled ? '1' : '0');
  }

  function getCurrentTrack() {
    return PLAYLIST[getSelectedIndex()];
  }

  function getWidget() {
    return document.getElementById(FLOAT_ID);
  }

  function isPlaying() {
    return !!(audio && !audio.paused && !audio.ended && isEnabled());
  }

  function ensureAudio() {
    if (audio && document.body.contains(audio)) return audio;

    audio = document.getElementById(AUDIO_ID);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = AUDIO_ID;
      audio.loop = true;
      audio.preload = 'none';
      audio.hidden = true;
      audio.volume = 0.72;
      document.body.appendChild(audio);
      audio.addEventListener('play', function () {
        updateUi('背景音乐播放中：' + getCurrentTrack().title);
        setupAudioAnalyser();
        startVisualizer();
      });
      audio.addEventListener('pause', function () {
        updateUi(isEnabled() ? '背景音乐已暂停' : '背景音乐未开启');
        stopVisualizer();
      });
    }

    syncTrack(false);
    return audio;
  }

  // ========== 音频可视化 ==========
  let visualizerTime = 0;
  let visualizerMotion;

  function setupAudioAnalyser() {
    if (analyser) return;

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      dataArray = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      console.warn('Audio visualizer not available:', e);
    }
  }

  function startVisualizer(idleOnly) {
    if (animationId) return;

    const canvas = document.querySelector('.bgm-floating__visualizer');
    const widget = getWidget();
    if (!canvas || !widget) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!visualizerMotion && window.matchMedia) {
      visualizerMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const updateMotion = function () {
        stopVisualizer();
        if (isPlaying()) startVisualizer();
      };
      if (visualizerMotion.addEventListener) visualizerMotion.addEventListener('change', updateMotion);
      else if (visualizerMotion.addListener) visualizerMotion.addListener(updateMotion);
    }

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const unit = Math.min(width, height) / 80;
    const binCount = dataArray ? dataArray.length : 64;
    const smoothedData = new Float32Array(binCount);
    let smoothedEnergy = 0;

    function ring(radius, color, lineWidth) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * unit, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth * unit;
      ctx.stroke();
    }

    function draw() {
      animationId = null;
      const playing = isPlaying();
      const reducedMotion = visualizerMotion && visualizerMotion.matches;
      const animate = playing && !reducedMotion && !idleOnly;
      ctx.clearRect(0, 0, width, height);

      let energy = 0;
      if (animate && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        for (let i = 0; i < binCount; i++) {
          smoothedData[i] = smoothedData[i] * 0.74 + (dataArray[i] / 255) * 0.26;
          energy += smoothedData[i];
        }
        energy = Math.min(1, (energy / binCount) * 1.6);
      }
      smoothedEnergy = animate ? smoothedEnergy * 0.85 + energy * 0.15 : 0;
      widget.style.setProperty('--bgm-energy', smoothedEnergy.toFixed(3));

      // The frequency traces stay outside the central button, within the thin glass rim.
      ring(31.8, 'rgba(163, 218, 212, 0.16)', 0.55);
      ring(38.2, 'rgba(200, 222, 239, 0.20)', 0.6);
      for (let layer = 0; layer < 2; layer++) {
        ctx.beginPath();
        for (let i = 0; i <= binCount; i++) {
          const angle = (i / binCount) * Math.PI * 2 - Math.PI / 2;
          const sample = smoothedData[i % binCount];
          const ripple = animate ? Math.sin(angle * 3 + visualizerTime + layer) * 0.3 : 0;
          const radius = (layer === 0 ? 33.2 + sample * 2.5 + ripple : 36.6 + sample * 0.8 - ripple) * unit;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = layer === 0
          ? 'rgba(154, 224, 214, ' + (0.28 + smoothedEnergy * 0.36) + ')'
          : 'rgba(173, 200, 231, ' + (0.20 + smoothedEnergy * 0.24) + ')';
        ctx.lineWidth = (layer === 0 ? 0.8 : 0.55) * unit;
        ctx.stroke();
      }

      // Short, restrained highlights reveal the sound level without filling the orb.
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
        const sample = smoothedData[Math.floor(i * binCount / 24)];
        const inner = 35.3 * unit;
        const outer = (35.8 + sample * 1.9) * unit;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
        ctx.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
        ctx.strokeStyle = i % 6 === 0
          ? 'rgba(236, 218, 174, ' + (0.22 + sample * 0.34) + ')'
          : 'rgba(193, 229, 229, ' + (0.10 + sample * 0.22) + ')';
        ctx.lineWidth = 0.7 * unit;
        ctx.stroke();
      }

      if (animate) {
        visualizerTime += 0.012;
        animationId = requestAnimationFrame(draw);
      }
    }

    draw();
  }

  function stopVisualizer() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    const widget = getWidget();
    if (widget) widget.style.setProperty('--bgm-energy', '0');
    // Render the idle rim once; CSS eases its glow down after the audio pauses.
    startVisualizer(true);
  }

  // ========== 边缘检测与缩入 ==========
  function getEdgeThreshold() {
    // 动态计算阈值：基于视口大小
    return {
      horizontal: Math.max(60, window.innerWidth * EDGE_THRESHOLD_RATIO),
      vertical: Math.max(80, window.innerHeight * EDGE_THRESHOLD_RATIO)
    };
  }

  function getEdgeInfo(position) {
    const widget = getWidget();
    const width = widget ? widget.offsetWidth : 64;
    const height = widget ? widget.offsetHeight : 64;
    const threshold = getEdgeThreshold();

    const centerX = position.left + width / 2;
    const centerY = position.top + height / 2;

    const distToLeft = position.left;
    const distToRight = window.innerWidth - (position.left + width);
    const distToTop = position.top;
    const distToBottom = window.innerHeight - (position.top + height);

    // 判断靠近哪个边缘
    const nearLeft = distToLeft < threshold.horizontal;
    const nearRight = distToRight < threshold.horizontal;
    const nearTop = distToTop < threshold.vertical;
    const nearBottom = distToBottom < threshold.vertical;

    // 找出最近的边缘
    const edges = [];
    if (nearLeft) edges.push({ side: 'left', distance: distToLeft });
    if (nearRight) edges.push({ side: 'right', distance: distToRight });
    if (nearTop) edges.push({ side: 'top', distance: distToTop });
    if (nearBottom) edges.push({ side: 'bottom', distance: distToBottom });

    edges.sort((a, b) => a.distance - b.distance);

    return {
      isNearEdge: edges.length > 0,
      nearestEdge: edges[0] ? edges[0].side : null,
      nearLeft: nearLeft,
      nearRight: nearRight,
      nearTop: nearTop,
      nearBottom: nearBottom
    };
  }

  // 计算吸附后的位置
  function getSnappedPosition(position, edgeInfo) {
    const widget = getWidget();
    const width = widget ? widget.offsetWidth : 64;
    const height = widget ? widget.offsetHeight : 64;
    const margin = 6; // 边缘留白

    let left = position.left;
    let top = position.top;

    // 吸附到最近的边缘
    if (edgeInfo.nearLeft && edgeInfo.nearestEdge === 'left') {
      left = margin;
    } else if (edgeInfo.nearRight && edgeInfo.nearestEdge === 'right') {
      left = window.innerWidth - width - margin;
    }

    if (edgeInfo.nearTop && edgeInfo.nearestEdge === 'top') {
      top = margin;
    } else if (edgeInfo.nearBottom && edgeInfo.nearestEdge === 'bottom') {
      top = window.innerHeight - height - margin;
    }

    return { left, top };
  }

  function applyEdgeState(widget, edgeInfo, immediate) {
    if (!widget) return;

    const width = widget.offsetWidth;
    const height = widget.offsetHeight;
    const hideOffsetX = width * EDGE_HIDE_RATIO;
    const hideOffsetY = height * EDGE_HIDE_RATIO;

    let translateX = 0;
    let translateY = 0;

    if (edgeInfo.isNearEdge) {
      if (edgeInfo.nearestEdge === 'left') translateX = -hideOffsetX;
      else if (edgeInfo.nearestEdge === 'right') translateX = hideOffsetX;
      else if (edgeInfo.nearestEdge === 'top') translateY = -hideOffsetY;
      else if (edgeInfo.nearestEdge === 'bottom') translateY = hideOffsetY;
    }

    widget.classList.toggle('is-edge-hidden', edgeInfo.isNearEdge);
    isExpanded = !edgeInfo.isNearEdge;

    if (immediate) {
      widget.style.transition = 'none';
    }

    widget.style.setProperty('--edge-translate-x', translateX + 'px');
    widget.style.setProperty('--edge-translate-y', translateY + 'px');

    if (immediate) {
      widget.offsetHeight; // 强制重排
      widget.style.transition = '';
    }
  }

  function expandWidget(widget, immediate) {
    if (!widget) return;

    if (edgeHideTimer) {
      clearTimeout(edgeHideTimer);
      edgeHideTimer = null;
    }

    widget.classList.remove('is-edge-hidden');
    widget.style.setProperty('--edge-translate-x', '0px');
    widget.style.setProperty('--edge-translate-y', '0px');
    isExpanded = true;

    if (immediate) {
      widget.style.transition = 'none';
      widget.offsetHeight;
      widget.style.transition = '';
    }
  }

  function scheduleEdgeHide(widget, edgeInfo) {
    if (edgeHideTimer) {
      clearTimeout(edgeHideTimer);
    }

    edgeHideTimer = setTimeout(function () {
      if (widget.matches(':hover')) return;
      applyEdgeState(widget, edgeInfo, false);
    }, EDGE_HIDE_DELAY);
  }

  function syncTrack(resetTime, forceLoad) {
    const player = audio || document.getElementById(AUDIO_ID);
    if (!player) return;
    if (!isEnabled() && !forceLoad) return;

    const index = getSelectedIndex();
    if (player.dataset.trackIndex === String(index) && player.src) return;

    player.src = getCurrentTrack().src;
    player.dataset.trackIndex = String(index);
    player.load();
    if (resetTime) player.currentTime = 0;
  }

  function readStoredPosition() {
    try {
      const raw = localStorage.getItem(STORAGE_POSITION);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed.left !== 'number' || typeof parsed.top !== 'number') return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function persistWidgetPosition(position) {
    localStorage.setItem(STORAGE_POSITION, JSON.stringify({
      left: Math.round(position.left),
      top: Math.round(position.top)
    }));
  }

  function clampPosition(position) {
    const widget = getWidget();
    const width = widget ? widget.offsetWidth : 64;
    const height = widget ? widget.offsetHeight : 64;

    return {
      left: Math.min(Math.max(0, position.left), Math.max(0, window.innerWidth - width)),
      top: Math.min(Math.max(0, position.top), Math.max(0, window.innerHeight - height))
    };
  }

  function setWidgetSide(widget, left) {
    if (!widget) return;
    widget.classList.toggle('is-left-side', left < window.innerWidth / 2);
  }

  function applyWidgetPosition(position, persist) {
    const widget = getWidget();
    if (!widget || !position) return;

    const nextPosition = clampPosition(position);
    widget.style.left = nextPosition.left + 'px';
    widget.style.top = nextPosition.top + 'px';
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
    setWidgetSide(widget, nextPosition.left);

    if (persist) {
      persistWidgetPosition(nextPosition);
    }
  }

  function getDefaultPosition() {
    const marginRight = window.matchMedia('(max-width: 768px)').matches ? 16 : 24;
    const marginBottom = window.matchMedia('(max-width: 768px)').matches ? 96 : 132;
    const widget = getWidget();
    const size = widget ? widget.offsetWidth : 64;

    return {
      left: window.innerWidth - size - marginRight,
      top: window.innerHeight - size - marginBottom
    };
  }

  function syncWidgetPosition() {
    const position = readStoredPosition() || getDefaultPosition();
    applyWidgetPosition(position, false);

    const widget = getWidget();
    if (widget) {
      const edgeInfo = getEdgeInfo(position);
      if (edgeInfo.isNearEdge) {
        applyEdgeState(widget, edgeInfo, true);
      } else {
        expandWidget(widget, true);
      }
    }
  }

  function bindWidgetDrag() {
    const widget = getWidget();
    if (!widget || widget.dataset.dragBound === '1') return;
    widget.dataset.dragBound = '1';

    widget.addEventListener('pointerdown', function (event) {
      if (event.button !== 0) return;
      if (event.target.closest('[data-bgm-action="prev"], [data-bgm-action="next"]')) return;

      // 拖动开始时展开球体
      expandWidget(widget, false);

      const rect = widget.getBoundingClientRect();
      const toggleBtn = event.target.closest('[data-bgm-action="toggle"]');

      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        moved: false,
        isOnToggle: !!toggleBtn
      };

      widget.setPointerCapture(event.pointerId);
    });

    widget.addEventListener('pointermove', function (event) {
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;

      if (!dragState.moved && Math.hypot(deltaX, deltaY) > 6) {
        dragState.moved = true;
        widget.classList.add('is-dragging');
      }

      if (!dragState.moved) return;

      event.preventDefault();
      applyWidgetPosition({
        left: dragState.startLeft + deltaX,
        top: dragState.startTop + deltaY
      }, false);
    });

    function finishDrag(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      const moved = dragState.moved;
      const isOnToggle = dragState.isOnToggle;
      widget.classList.remove('is-dragging');

      if (moved) {
        suppressNextActionClick = true;

        const rect = widget.getBoundingClientRect();
        const edgeInfo = getEdgeInfo({ left: rect.left, top: rect.top });

        // 如果靠近边缘，吸附到边缘位置
        if (edgeInfo.isNearEdge) {
          const snappedPosition = getSnappedPosition({ left: rect.left, top: rect.top }, edgeInfo);
          applyWidgetPosition(snappedPosition, true);
          scheduleEdgeHide(widget, edgeInfo);
        } else {
          applyWidgetPosition({ left: rect.left, top: rect.top }, true);
          expandWidget(widget, false);
        }
      } else if (isOnToggle) {
        suppressNextActionClick = true;
        toggleCurrent();
      }

      if (widget.hasPointerCapture(event.pointerId)) {
        widget.releasePointerCapture(event.pointerId);
      }

      dragState = null;
    }

    widget.addEventListener('pointerup', finishDrag);
    widget.addEventListener('pointercancel', finishDrag);

    // 悬停展开
    widget.addEventListener('pointerenter', function () {
      expandWidget(widget, false);
    });

    widget.addEventListener('pointerleave', function () {
      if (dragState) return;

      const rect = widget.getBoundingClientRect();
      const edgeInfo = getEdgeInfo({ left: rect.left, top: rect.top });
      if (edgeInfo.isNearEdge) {
        scheduleEdgeHide(widget, edgeInfo);
      }
    });
  }

  function ensureFloatingControl() {
    if (document.getElementById(FLOAT_ID)) return;

    const widget = document.createElement('div');
    widget.id = FLOAT_ID;
    widget.className = 'bgm-floating';
    widget.innerHTML = [
      '<canvas class="bgm-floating__visualizer" width="80" height="80"></canvas>',
      '<div class="bgm-floating__details">',
      '  <div class="bgm-floating__meta">',
      '    <span class="bgm-floating__label" data-bgm-toggle-label>背景音乐已关</span>',
      '    <strong class="bgm-floating__track" data-bgm-track-name>Windy Hill</strong>',
      '  </div>',
      '  <div class="bgm-floating__actions">',
      '    <button class="bgm-floating__sub" type="button" data-bgm-action="prev" title="上一首" aria-label="上一首"><i class="fas fa-backward-step"></i></button>',
      '    <button class="bgm-floating__sub" type="button" data-bgm-action="next" title="下一首" aria-label="下一首"><i class="fas fa-forward-step"></i></button>',
      '  </div>',
      '</div>',
      '<button class="bgm-floating__toggle" type="button" data-bgm-action="toggle" title="开启背景音乐" aria-label="开启背景音乐">',
      '  <i class="fas fa-music" data-bgm-toggle-icon></i>',
      '</button>'
    ].join('');
    document.body.appendChild(widget);
  }

  function updateToggleVisual() {
    const active = isPlaying();
    const label = active ? '音乐播放中' : '背景音乐已关';
    const title = active ? '关闭背景音乐' : '开启背景音乐';

    document.querySelectorAll('[data-bgm-toggle-label]').forEach(function (el) {
      el.textContent = label;
    });

    document.querySelectorAll('[data-bgm-toggle-icon]').forEach(function (el) {
      el.className = active ? 'fas fa-pause' : 'fas fa-music';
    });

    document.querySelectorAll('[data-bgm-action="toggle"]').forEach(function (el) {
      el.setAttribute('title', title);
      el.setAttribute('aria-label', title);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
      el.classList.toggle('is-playing', active);
    });

    const widget = getWidget();
    if (widget) widget.classList.toggle('is-playing', active);
  }

  function updateUi(message) {
    const track = getCurrentTrack();

    document.querySelectorAll('[data-bgm-track-name]').forEach(function (el) {
      el.textContent = track.title;
    });

    document.querySelectorAll('[data-bgm-status]').forEach(function (el) {
      el.textContent = message || (isEnabled() ? '背景音乐待播放：' + track.title : '背景音乐默认关闭，点击右下角悬浮音乐按钮即可开启。');
    });

    document.querySelectorAll('[data-bgm-track]').forEach(function (el) {
      el.classList.toggle('is-active', Number(el.dataset.bgmTrack) === getSelectedIndex());
    });

    updateToggleVisual();
  }

  function playCurrent() {
    const player = ensureAudio();
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }

    syncTrack(false, true);
    setEnabled(true);
    return player.play().then(function () {
      updateUi('背景音乐播放中：' + getCurrentTrack().title);
    }).catch(function () {
      updateUi('浏览器拦截了自动播放，请再点一次右下角音乐按钮。');
    });
  }

  function pauseCurrent() {
    const player = ensureAudio();
    player.pause();
    setEnabled(false);
    updateUi('背景音乐已关闭');
  }

  function toggleCurrent() {
    if (isPlaying()) {
      pauseCurrent();
      return;
    }
    playCurrent();
  }

  function switchTrack(index, shouldPlay) {
    setSelectedIndex(index);
    const player = ensureAudio();
    player.dataset.trackIndex = '';
    syncTrack(true, shouldPlay);

    if (shouldPlay || isEnabled()) {
      playCurrent();
      return;
    }

    updateUi('已切换曲目：' + getCurrentTrack().title);
  }

  function nextTrack() {
    switchTrack((getSelectedIndex() + 1) % PLAYLIST.length, true);
  }

  function prevTrack() {
    switchTrack((getSelectedIndex() - 1 + PLAYLIST.length) % PLAYLIST.length, true);
  }

  function bindUiActions() {
    if (eventsBound) return;
    eventsBound = true;

    document.addEventListener('click', function (event) {
      if (suppressNextActionClick) {
        suppressNextActionClick = false;
        if (event.target.closest('#' + FLOAT_ID)) {
          event.preventDefault();
          return;
        }
      }

      const actionEl = event.target.closest('[data-bgm-action]');
      if (actionEl) {
        const action = actionEl.dataset.bgmAction;
        if (action === 'toggle') toggleCurrent();
        if (action === 'play') playCurrent();
        if (action === 'pause') pauseCurrent();
        if (action === 'prev') prevTrack();
        if (action === 'next') nextTrack();
      }

      const trackEl = event.target.closest('[data-bgm-track]');
      if (trackEl) {
        switchTrack(Number(trackEl.dataset.bgmTrack), true);
      }
    });
  }

  function bindViewportEvents() {
    if (viewportEventsBound) return;
    viewportEventsBound = true;

    window.addEventListener('resize', function () {
      syncWidgetPosition();
    });
  }

  function maybeAutoplay() {
    ensureAudio();
    if (!isEnabled()) {
      updateUi('背景音乐默认关闭，点击右下角悬浮音乐按钮即可开启。');
      return;
    }

    playCurrent();
  }

  function init() {
    // Keep the academic homepage quiet without changing the blog music preference.
    if (document.querySelector('.academic-home')) {
      if (audio) audio.pause();
      if (animationId) cancelAnimationFrame(animationId);
      animationId = null;
      return;
    }
    ensureFloatingControl();
    bindWidgetDrag();
    bindViewportEvents();
    ensureAudio();
    syncWidgetPosition();
    updateUi();
    startVisualizer();
    maybeAutoplay();
  }

  bindUiActions();
  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pjax:complete', init);
  window.KemingBgm = {
    play: playCurrent,
    pause: pauseCurrent,
    toggle: toggleCurrent,
    prev: prevTrack,
    next: nextTrack,
    switchTrack: switchTrack,
    playlist: PLAYLIST.slice()
  };
})();
