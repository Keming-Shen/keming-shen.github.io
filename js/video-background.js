(function () {
  var VIDEO_ID = 'site-bg-video';
  var VIDEO_SRC = '/image/background/starfield_2k_loop.mp4';
  var FALLBACK_CLASS = 'video-disabled';

  var FALLBACK_IMAGE = '/image/background/bg_2.webp';
  var resizeTimer = null;
  var initialBackgroundReady = false;
  function signalBackgroundReady() {
    if (initialBackgroundReady) return;
    initialBackgroundReady = true;
    if (window.siteVisualGate) window.siteVisualGate.backgroundReady();
  }

  function shouldUseVideoBackground() {
    return !window.matchMedia('(max-width: 768px)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    if (!bg) {
      signalBackgroundReady();
      return;
    }

    // The academic homepage has its own plain background, including PJAX visits.
    if (document.querySelector('.academic-home')) {
      var existing = document.getElementById(VIDEO_ID);
      if (existing) {
        existing.pause();
        existing.remove();
      }
      bg.style.backgroundImage = 'none';
      bg.style.backgroundColor = '#fff';
      signalBackgroundReady();
      return;
    }

    ensureBackgroundLayout(bg);

    if (!shouldUseVideoBackground()) {

      removeVideo(bg);
      signalBackgroundReady();
      return;
    }

    bg.classList.remove(FALLBACK_CLASS);
    bg.style.backgroundImage = "url('" + FALLBACK_IMAGE + "')";

    var existingVideo = document.getElementById(VIDEO_ID);
    if (existingVideo) {
      if (existingVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) signalBackgroundReady();
      return;
    }


    var video = document.createElement('video');
    video.id = VIDEO_ID;
    video.className = 'site-bg-video';
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.poster = '/image/background/bg_16.webp';
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('disablePictureInPicture', '');


    ensureVideoLayout(video);

    var source = document.createElement('source');
    source.src = VIDEO_SRC;
    source.type = 'video/mp4';
    video.appendChild(source);


    var videoTimeout = window.setTimeout(function () {
      removeVideo(bg);
      signalBackgroundReady();
    }, 12000);

    video.addEventListener('loadeddata', function () {
      if (!video.isConnected) return;
      window.clearTimeout(videoTimeout);
      signalBackgroundReady();
    }, { once: true });
    video.addEventListener('error', function () {
      window.clearTimeout(videoTimeout);
      removeVideo(bg);
      signalBackgroundReady();
    }, { once: true });

    bg.prepend(video);


    var playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {
        window.clearTimeout(videoTimeout);
        removeVideo(bg);
        signalBackgroundReady();
      });
    }

  }

  function initVideoBackground() {
    mountVideo();
  }

  document.addEventListener('DOMContentLoaded', initVideoBackground);
  window.addEventListener('load', initVideoBackground);
  document.addEventListener('pjax:complete', initVideoBackground);
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(initVideoBackground, 160);
  });
})();
