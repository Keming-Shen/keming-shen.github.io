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
      audio.preload = 'auto';
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

  function startVisualizer() {
    if (animationId) return;

    const canvas = document.querySelector('.bgm-floating__visualizer');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 2;

    // 平滑值数组
    const smoothedData = new Array(64).fill(0);
    let smoothedAvg = 0;

    function draw() {
      animationId = requestAnimationFrame(draw);
      visualizerTime += 0.016;

      ctx.clearRect(0, 0, width, height);

      const playing = isPlaying();

      // 获取音频数据
      let avgValue = 0;
      if (playing && analyser) {
        analyser.getByteFrequencyData(dataArray);
        // 只使用前 64 个频率点
        for (let i = 0; i < 64; i++) {
          const raw = dataArray[i] / 255;
          smoothedData[i] = smoothedData[i] * 0.7 + raw * 0.3;
          avgValue += smoothedData[i];
        }
        avgValue /= 64;
      }
      smoothedAvg = smoothedAvg * 0.85 + avgValue * 0.15;

      // === 绘制水球效果 ===
      // 外层光晕
      const glowRadius = maxRadius + smoothedAvg * 8;
      const glowGradient = ctx.createRadialGradient(centerX, centerY, maxRadius * 0.3, centerX, centerY, glowRadius);
      glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      glowGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.02)');
      glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // 绘制水波纹 - 多层涟漪
      const waveCount = playing ? 5 : 3;
      for (let w = 0; w < waveCount; w++) {
        const phase = visualizerTime * (playing ? 1.5 : 0.3) + w * 0.8;
        const baseRadius = maxRadius * (0.25 + w * 0.15);
        const alpha = (playing ? 0.12 : 0.06) * (1 - w * 0.15);

        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const angle = (i / 64) * Math.PI * 2;
          const dataIndex = i % 64;

          // 基础波浪 + 音频响应
          let wave = Math.sin(angle * 3 + phase) * 2;
          wave += Math.sin(angle * 5 - phase * 0.7) * 1.5;

          if (playing) {
            wave += smoothedData[dataIndex] * 12;
            wave += smoothedAvg * 6 * Math.sin(angle * 2 + phase * 2);
          }

          const radius = baseRadius + wave;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        const waveGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
        waveGradient.addColorStop(0, 'rgba(255, 255, 255, ' + (alpha + 0.05) + ')');
        waveGradient.addColorStop(0.5, 'rgba(255, 255, 255, ' + alpha + ')');
        waveGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = waveGradient;
        ctx.fill();
      }

      // 中心水滴效果
      const dropRadius = 8 + smoothedAvg * 18 + Math.sin(visualizerTime * (playing ? 3 : 1)) * 2;
      const dropGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, dropRadius);
      dropGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      dropGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.25)');
      dropGradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.08)');
      dropGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, dropRadius, 0, Math.PI * 2);
      ctx.fillStyle = dropGradient;
      ctx.fill();

      // 高光点
      const highlightX = centerX - dropRadius * 0.3;
      const highlightY = centerY - dropRadius * 0.3;
      const highlightGradient = ctx.createRadialGradient(highlightX, highlightY, 0, highlightX, highlightY, 4);
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.beginPath();
      ctx.arc(highlightX, highlightY, 4, 0, Math.PI * 2);
      ctx.fillStyle = highlightGradient;
      ctx.fill();
    }

    draw();
  }

  function stopVisualizer() {
    // 保持原有的平静水波动画。
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

  function syncTrack(resetTime) {
    const player = audio || document.getElementById(AUDIO_ID);
    if (!player) return;

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

    syncTrack(false);
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
    syncTrack(true);

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
