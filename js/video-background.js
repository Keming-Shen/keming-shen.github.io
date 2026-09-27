(function () {
  var VIDEO_ID = 'site-bg-video';
  var VIDEO_SOURCES = [
    '/image/background/starfield_720p_loop.mp4'
  ];
  var FALLBACK_CLASS = 'video-disabled';

  var FALLBACK_IMAGE = '/image/background/bg_2.webp';
  var resizeTimer = null;
  var startTimer = null;
  var idleHandle = null;


  function shouldUseVideoBackground() {
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return window.matchMedia('(min-width: 900px)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      !(connection && (connection.saveData || /^(slow-2g|2g|3g)$/.test(connection.effectiveType || '')));
  }



  function removeVideo(bg) {
    if (!bg) return;
    var existing = document.getElementById(VIDEO_ID);
    if (existing) existing.remove();
    bg.classList.add(FALLBACK_CLASS);
    bg.style.backgroundImage = "url('" + FALLBACK_IMAGE + "')";
    bg.style.backgroundColor = '#020617';
  }


  function ensureBackgroundLayout(bg) {
    if (!bg) return;
    bg.style.position = 'fixed';
    bg.style.inset = '0';
    bg.style.overflow = 'hidden';
    bg.style.backgroundPosition = 'center center';
    bg.style.backgroundRepeat = 'no-repeat';
    bg.style.backgroundSize = 'cover';
    bg.style.backgroundColor = '#020617';
  }


  function ensureVideoLayout(video) {
    if (!video) return;
    video.style.position = 'absolute';
    video.style.top = '50%';
    video.style.left = '50%';
    video.style.width = '100vw';
    video.style.height = '100vh';
    video.style.minWidth = '100%';
    video.style.minHeight = '100%';
    video.style.objectFit = 'cover';
    video.style.objectPosition = 'center center';
    video.style.transform = 'translate(-50%, -50%)';
    video.style.pointerEvents = 'none';
  }

  function mountVideo() {
    var bg = document.getElementById('web_bg');
    if (!bg) return;

    // The academic homepage has its own plain background, including PJAX visits.
    if (document.querySelector('.academic-home')) {
      var existing = document.getElementById(VIDEO_ID);
      if (existing) {
        existing.pause();
        existing.remove();
      }
      bg.style.backgroundImage = 'none';
      bg.style.backgroundColor = '#fff';
      return;
    }

    ensureBackgroundLayout(bg);

    if (!shouldUseVideoBackground()) {

      removeVideo(bg);
      return;
    }

    bg.classList.remove(FALLBACK_CLASS);
    bg.style.backgroundImage = "url('" + FALLBACK_IMAGE + "')";

    if (document.hidden) return;

    var existingVideo = document.getElementById(VIDEO_ID);
    if (existingVideo) {
      if (document.visibilityState === 'visible' && existingVideo.paused) existingVideo.play().catch(function () {});
      return;
    }


    var video = document.createElement('video');
    video.id = VIDEO_ID;
    video.className = 'site-bg-video';
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.poster = '/image/background/bg_16.webp';
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('disablePictureInPicture', '');


    ensureVideoLayout(video);

    VIDEO_SOURCES.forEach(function (src) {
      var source = document.createElement('source');
      source.src = src;
      source.type = 'video/mp4';
      video.appendChild(source);
    });


    video.addEventListener('error', function () {
      removeVideo(bg);
    });

    bg.prepend(video);


    var playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {
        // 自动播放可能被策略暂时拦截：保留视频节点，不立即降级成静态图
        video.muted = true;
      });
    }

  }

  function initVideoBackground() {
    var bg = document.getElementById('web_bg');
    if (!bg) return;

    window.clearTimeout(startTimer);
    if (idleHandle !== null && window.cancelIdleCallback) window.cancelIdleCallback(idleHandle);
    idleHandle = null;

    if (document.querySelector('.academic-home') || !shouldUseVideoBackground()) {
      mountVideo();
      return;
    }

    ensureBackgroundLayout(bg);
    bg.style.backgroundImage = "url('" + FALLBACK_IMAGE + "')";
    if (document.getElementById(VIDEO_ID)) {
      mountVideo();
      return;
    }

    startTimer = window.setTimeout(function () {
      if (window.requestIdleCallback) {
        idleHandle = window.requestIdleCallback(mountVideo, { timeout: 3000 });
      } else {
        mountVideo();
      }
    }, 1500);
  }

  window.addEventListener('load', initVideoBackground);
  document.addEventListener('pjax:complete', initVideoBackground);
  document.addEventListener('visibilitychange', function () {
    var video = document.getElementById(VIDEO_ID);
    if (document.hidden) {
      if (video) video.pause();
    } else {
      initVideoBackground();
    }
  });
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(initVideoBackground, 160);
  });
})();
