(function () {
  'use strict';
  if (window.__asunaCompanionInstalled) return;
  window.__asunaCompanionInstalled = true;
  var dispose = null;
  var assetRoot = '/image/asuna-companion/';
  var assetVersion = '20261011-performance1';
  function poseImage(action) { return assetRoot + action + '.webp?v=' + assetVersion; }
  var rigScripts;
  function loadRigScripts() {
    if (window.AsunaRig) return Promise.resolve();
    if (!rigScripts) {
      rigScripts = ['/js/vendor/asuna-rig/runtime.js', '/js/vendor/asuna-rig/renderer.js', '/js/asuna-rig.js'].reduce(function (previous, src) {
        return previous.then(function () {
          return new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = src + '?v=20261011-performance1';
            script.onload = resolve;
            script.onerror = function () { script.remove(); reject(new Error('Animation runtime unavailable')); };
            document.head.appendChild(script);
          });
        });
      }, Promise.resolve()).catch(function (error) { rigScripts = null; throw error; });
    }
    return rigScripts;
  }
  var actions = ['hello', 'welcome', 'think', 'sword', 'cake', 'clean', 'hot', 'letter', 'yeah', 'drink', 'read', 'tiring', 'delight', 'love', 'shy'];
  var durations = {hello: 23200, welcome: 21600, think: 25200, sword: 22400, cake: 24000, clean: 21200, hot: 25600,
    letter: 24000, yeah: 20000, drink: 28000, read: 32000, tiring: 24000, delight: 22000, love: 24000, shy: 26000};
  var lines = {
    origin: [
      ['慢慢看，我就在这里。', 'Take your time. I will be right here.', 'normal'],
      ['今天想先探索哪一页？', 'What would you like to explore today?', 'normal']
    ],
    hello: [
      ['你好呀，今天也要带着好心情出发！', 'Hello! Ready for a good day?', 'normal'],
      ['又见面了，刚好想和你打个招呼。', 'There you are. I was hoping to say hello.', 'warm'],
      ['别只顾着看屏幕，也记得眨眨眼。', 'A little reminder to rest your eyes, too.', 'normal']
    ],
    welcome: [
      ['欢迎！这里有研究，也有生活的小故事。', 'Welcome! There is research here, and a little everyday life.', 'normal'],
      ['今天的探索路线，就交给你决定啦。', 'You get to choose our route today.', 'normal'],
      ['给你留了个位置，要一起看下去吗？', 'I saved you a spot. Shall we keep reading together?', 'warm']
    ],
    think: [
      ['想不通的时候，先把问题拆小一点。', 'A tricky problem often gets easier in smaller pieces.', 'normal'],
      ['唔……这个想法，值得再琢磨一下。', 'Hmm… that idea deserves a little more thought.', 'normal'],
      ['你认真思考的样子，我有注意到哦。', 'I noticed that thoughtful look of yours.', 'warm']
    ],
    sword: [
      ['准备好了？把今天的小目标拿下吧！', 'Ready? Let us conquer one small goal today!', 'normal'],
      ['先稳住脚步，再向前一步。', 'Find your footing, then take the next step.', 'normal'],
      ['放心往前走，我替你守着后方。', 'Go on. I have your back.', 'warm']
    ],
    cake: [
      ['刚做好的草莓蛋糕，要尝一口吗？', 'Fresh strawberry cake. Would you like a taste?', 'normal'],
      ['休息一下吧，今天也值得一点甜。', 'Take a little break. You deserve something sweet.', 'normal'],
      ['第一口留给你，别忘了告诉我好不好吃。', 'The first bite is yours. Tell me what you think.', 'warm']
    ],
    clean: [
      ['把细节照顾好，旅程也会顺利一些。', 'Taking care of the details makes the journey smoother.', 'normal'],
      ['休息一下，顺便整理今天的思路吧。', 'Take a breath and gather your thoughts.', 'normal'],
      ['有你在旁边，连整理装备都不无聊了。', 'Even tending my gear is nicer with you here.', 'warm']
    ],
    hot: [
      ['有点热……先喝口水再继续吧。', 'A little warm… how about a sip of water?', 'normal'],
      ['被你这么看着，好像更热了呢。', 'Your attention is making me feel a little warmer.', 'warm'],
      ['靠近一点说话也可以，不过别笑我脸红。', 'You can come a little closer. Just do not tease me for blushing.', 'warm']
    ],
    letter: [
      ['这里有一封信，记得慢慢读。', 'A letter for you. Take your time reading it.', 'normal'],
      ['想说的话，都认真写在里面了。', 'I put a little thought into every word.', 'warm'],
      ['收好哦，这封信是特意写给你的。', 'Keep it safe. I wrote this one just for you.', 'warm']
    ],
    yeah: [
      ['耶！又完成了一件小事。', 'Yes! One more little victory.', 'normal'],
      ['给今天留一张好心情的照片吧。', 'Let us save a picture of this happy moment.', 'normal'],
      ['准备好了吗？看这里，笑一个！', 'Ready? Look this way and smile!', 'warm']
    ],
    drink: [
      ['茶还热着，先吹一吹。', 'The tea is still hot. Let it cool a little.', 'normal'],
      ['读累了就停一下，陪我喝杯茶吧。', 'Rest your eyes and join me for a cup of tea.', 'normal'],
      ['有你陪着，普通的茶也变得很香。', 'Even a simple cup of tea feels special with you.', 'warm']
    ],
    read: [
      ['这一页很有意思，要一起读吗？', 'This page is interesting. Shall we read it together?', 'normal'],
      ['不着急，故事可以慢慢往下读。', 'No hurry. There is time for the next chapter.', 'normal'],
      ['靠近一点，这一段我想读给你听。', 'Come a little closer. I want to read you this part.', 'warm']
    ],
    tiring: [
      ['唔……有点困了。你也别熬太晚。', 'Getting a little sleepy… Do not stay up too late.', 'normal'],
      ['伸个懒腰，记得给自己留点休息时间。', 'A little stretch. Remember to make time for rest.', 'normal'],
      ['再陪你一小会儿，然后一起休息吧。', 'A little longer together, then let us get some rest.', 'warm']
    ],
    delight: [
      ['好消息！今天值得庆祝一下。', 'Good news! That calls for a little celebration.', 'normal'],
      ['太好了，你的努力有了回报！', 'Wonderful! Your hard work paid off!', 'normal'],
      ['开心的事，第一个就想告诉你。', 'You are the first person I wanted to tell.', 'warm']
    ],
    love: [
      ['给认真努力的你，比一个心。', 'A little heart for all your hard work.', 'warm'],
      ['今天的加油，也有你的一份。', 'A little encouragement, just for you.', 'normal'],
      ['收到了吗？这是今天的小小心意。', 'Did you catch it? A small gesture for you today.', 'warm']
    ],
    shy: [
      ['突然被你注意到，还有点不好意思。', 'You caught me off guard. Now I am a little shy.', 'warm'],
      ['别急，让我想想怎么说。', 'Give me a moment to find the words.', 'normal'],
      ['也没什么……只是见到你很开心。', 'It is nothing… I am just happy to see you.', 'warm']
    ]
  };

  function init() {
    if (dispose) { dispose(); dispose = null; }
    var home = document.querySelector('.academic-home');
    if (!home) return;
    var controller = new AbortController();
    var signal = controller.signal;
    var root = document.createElement('aside');
    root.className = 'asuna-companion';
    root.hidden = true;
    root.innerHTML = '<div class="asuna-companion__bubble" role="status" aria-live="polite" aria-atomic="true" hidden>' +
      '<svg class="asuna-companion__cloud" aria-hidden="true" focusable="false" preserveAspectRatio="none"><defs><linearGradient id="asuna-cloud-wash" x1="0" y1="0" x2=".7" y2="1"><stop class="asuna-companion__cloud-sun" offset="0"/><stop class="asuna-companion__cloud-light" offset=".48"/><stop class="asuna-companion__cloud-blush" offset="1"/></linearGradient><linearGradient id="asuna-cloud-jewel" x1=".15" y1="0" x2=".85" y2="1"><stop class="asuna-companion__jewel-light" offset="0"/><stop class="asuna-companion__jewel-mid" offset=".48"/><stop class="asuna-companion__jewel-deep" offset="1"/></linearGradient><path id="asuna-cloud-star" d="M12 1C13.5 8.5 15.5 10.5 23 12C15.5 13.5 13.5 15.5 12 23C10.5 15.5 8.5 13.5 1 12C8.5 10.5 10.5 8.5 12 1Z"/><path id="asuna-cloud-heart" d="M12 21C9 18.5 2 13.5 2 7.5C2 2 9 1 12 6C15 1 22 2 22 7.5C22 13.5 15 18.5 12 21Z"/></defs><path class="asuna-companion__cloud-outline" fill="url(#asuna-cloud-wash)"/><path class="asuna-companion__cloud-rim" fill="none"/><path class="asuna-companion__cloud-glint"/></svg>' +
      '<span class="asuna-companion__ornaments" aria-hidden="true"><svg class="asuna-companion__jewel asuna-companion__jewel--1" viewBox="0 0 24 24"><use href="#asuna-cloud-heart"/></svg><svg class="asuna-companion__jewel asuna-companion__jewel--2" viewBox="0 0 24 24"><use href="#asuna-cloud-star"/></svg><svg class="asuna-companion__jewel asuna-companion__jewel--3" viewBox="0 0 24 24"><use href="#asuna-cloud-star"/></svg><svg class="asuna-companion__jewel asuna-companion__jewel--4" viewBox="0 0 24 24"><use href="#asuna-cloud-heart"/></svg><svg class="asuna-companion__jewel asuna-companion__jewel--5" viewBox="0 0 24 24"><use href="#asuna-cloud-star"/></svg></span>' +
      '<p class="asuna-companion__text" aria-hidden="true"><span class="asuna-companion__measure"></span><span class="asuna-companion__typed"></span></p><span class="asuna-companion__announcement"></span></div>' +
      '<button type="button" class="asuna-companion__figure"><img class="asuna-companion__image" alt="" draggable="false" width="440" height="528"><canvas class="asuna-companion__canvas" aria-hidden="true" hidden></canvas></button>' +
      '<button type="button" class="asuna-companion__minimize" aria-label="Minimize Asuna"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 7 4 4 4-4M6 14h8"/></svg><span>Hide</span></button>' +
      '<button type="button" class="asuna-companion__restore" hidden><span aria-hidden="true">✦</span>Asuna</button>';
    document.body.appendChild(root);
    var figure = root.querySelector('.asuna-companion__figure');
    var img = root.querySelector('img');
    var canvas = root.querySelector('canvas');
    var rig = null;
    var rigReady = null;
    var reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    var bubble = root.querySelector('.asuna-companion__bubble');
    var bubbleText = root.querySelector('.asuna-companion__typed');
    var bubbleMeasure = root.querySelector('.asuna-companion__measure');
    var bubbleAnnouncement = root.querySelector('.asuna-companion__announcement');
    var bubbleCloud = root.querySelector('.asuna-companion__cloud');
    var bubbleOutline = root.querySelector('.asuna-companion__cloud-outline');
    var bubbleGlint = root.querySelector('.asuna-companion__cloud-glint');
    var bubbleRim = root.querySelector('.asuna-companion__cloud-rim');
    var minimize = root.querySelector('.asuna-companion__minimize');
    var restore = root.querySelector('.asuna-companion__restore');
    var narrow = window.innerWidth <= 1080;
    var minimized = narrow;
    var side = 'right';
    var yRatio = 1;
    var currentLine = null;
    var previousAction = '';
    var bag = [];
    var loaded = new Map();
    var token = 0;
    var drag = null;
    var suppressClickUntil = 0;
    var resetTimer;
    var bubbleTimer;
    var typingFrame;
    var warmTimer, warmIdle;
    var frame;
    var destroyed = false;
    try {
      var saved = JSON.parse(localStorage.getItem('academic-asuna-position') || 'null');
      if (saved && (saved.side === 'left' || saved.side === 'right') && Number.isFinite(saved.y)) {
        side = saved.side; yRatio = Math.max(0, Math.min(1, saved.y));
      }
      if (localStorage.getItem('academic-asuna-minimized') === 'true') minimized = true;
    } catch (_) {}

    function chinese() { return home.lang.indexOf('zh') === 0; }
    function translate() {
      root.lang = home.lang || 'en';
      root.setAttribute('aria-label', chinese() ? '亚丝娜互动角色' : 'Asuna companion');
      figure.setAttribute('aria-label', chinese() ? '亚丝娜：点击互动，拖动换位置；方向键移动' : 'Asuna: click to interact, drag or use arrow keys to move');
      figure.title = chinese() ? '点击互动 · 拖动换位置' : 'Click to interact · Drag to move';
      minimize.setAttribute('aria-label', chinese() ? '收起亚丝娜' : 'Minimize Asuna');
      minimize.querySelector('span').textContent = chinese() ? '收起' : 'Hide';
      minimize.title = chinese() ? '收起角色' : 'Minimize companion';
      restore.setAttribute('aria-label', chinese() ? '展开亚丝娜' : 'Show Asuna');
      if (currentLine && !bubble.hidden) writeDialogue();
      if (!bubble.hidden) schedulePosition();
    }
    function stopTyping() {
      cancelAnimationFrame(typingFrame);
      typingFrame = null;
      delete bubble.dataset.typing;
    }
    function hideBubble() {
      stopTyping(); clearTimeout(bubbleTimer);
      bubble.hidden = true;
    }
    function writeDialogue() {
      stopTyping(); clearTimeout(bubbleTimer);
      var text = currentLine[chinese() ? 0 : 1];
      var characters = typeof Intl.Segmenter === 'function'
        ? Array.from(new Intl.Segmenter(chinese() ? 'zh' : 'en', {granularity: 'grapheme'}).segment(text), function (part) { return part.segment; })
        : Array.from(text);
      // Reserve the final line wrapping so neither cloud nor character jumps.
      bubbleMeasure.textContent = text;
      bubbleAnnouncement.textContent = text;
      var duration = reducedMotion.matches ? 0 : Math.min(1800, characters.length * (chinese() ? 26 : 16));
      bubbleText.textContent = duration ? characters[0] || '' : text;
      if (duration) {
        bubble.dataset.typing = 'true';
        var start = performance.now();
        function tick(now) {
          if (destroyed || bubble.hidden) { stopTyping(); return; }
          var count = Math.min(characters.length, Math.max(1, Math.floor((now - start) / duration * characters.length)));
          bubbleText.textContent = characters.slice(0, count).join('');
          if (count < characters.length) typingFrame = requestAnimationFrame(tick);
          else stopTyping();
        }
        typingFrame = requestAnimationFrame(tick);
      }
      bubbleTimer = setTimeout(function () { hideBubble(); position(); }, 7000 + duration);
    }
    function savePosition() {
      try { localStorage.setItem('academic-asuna-position', JSON.stringify({side: side, y: yRatio})); } catch (_) {}
    }
    function size() {
      // Keep facial details readable even when the page has narrow side gutters.
      var width = narrow ? Math.min(164, innerWidth * .4) : Math.max(200, Math.min(250, innerWidth * .15));
      width = Math.min(width, innerHeight * .42);
      root.style.setProperty('--asuna-width', width + 'px');
      return minimized ? 44 : width;
    }
    function verticalLimits(height) {
      return {min: 28, max: Math.max(28, innerHeight - height - (minimized ? 12 : 0))};
    }
    function drawBubble(w, tail) {
      // Text controls the box height; a stable drawing height keeps the
      // shallow cloud lobes from intersecting on short, single-line dialogue.
      var h = 132;
      bubbleCloud.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      bubbleOutline.setAttribute('d', [
        'M29 43 C12 42 14 17 38 19 C42 4 75 2 87 17',
        'C108 1', w - 84, '1', w - 67, '19',
        'C', w - 44, '7', w - 18, '19', w - 22, '42',
        'C', w - 1, '46', w - 2, h * .49, w - 14, h * .57,
        'C', w + 1, h - 31, w - 29, h - 15, w - 53, h - 23,
        'C', w - 68, h - 10, tail + 29, h - 17, tail + 10, h - 24,
        'C', tail + 5, h - 13, tail + 13, h - 6, tail + 24, h - 3,
        'C', tail + 2, h - 2, tail - 10, h - 11, tail - 15, h - 22,
        'C', tail - 39, h - 8, '53', h - 8, '41', h - 25,
        'C16', h - 26, '7', h - 47, '18', h - 62,
        'C1', h * .5 + 8, '4 49 29 43Z'
      ].join(' '));
      bubbleRim.setAttribute('d', 'M18 61Q7 75 18 87M43 107Q54 121 79 116M' + (w - 53) + ' 109Q' + (w - 22) + ' 118 ' + (w - 14) + ' 87');
      bubbleGlint.setAttribute('d', 'M26 34Q24 24 37 25M49 18Q63 9 77 17M99 19Q' + (w * .5) + ' 7 ' + (w - 81) + ' 19');
    }
    function position() {
      if (destroyed || drag) return;
      var width = size();
      var height = minimized ? 52 : width * 1.2;
      var limits = verticalLimits(height);
      var x = side === 'right' ? innerWidth - width - 10 : 10;
      var y = limits.min + yRatio * (limits.max - limits.min);
      // Make room above the head, including when the user docked near the top.
      if (!bubble.hidden) y = Math.min(limits.max, Math.max(y, bubble.offsetHeight));
      root.style.left = x + 'px'; root.style.top = y + 'px';
      root.dataset.side = side;
      var bubbleWidth = bubble.offsetWidth;
      var bubbleLeft = Math.max(8, Math.min(innerWidth - bubbleWidth - 8, x + (width - bubbleWidth) / 2));
      bubble.style.left = (bubbleLeft - x) + 'px';
      if (!bubble.hidden) drawBubble(bubbleWidth, Math.max(60, Math.min(bubbleWidth - 60, x + width / 2 - bubbleLeft)));
    }
    function schedulePosition() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(position);
    }
    function setMinimized(value, persist) {
      minimized = value;
      root.dataset.minimized = String(value);
      figure.hidden = value; minimize.hidden = value; restore.hidden = !value;
      if (value) { cancelWarmup(); cancelDrag(); hideBubble(); clearEffects(); token++; root.dataset.loading = 'false'; }
      if (persist) { try { localStorage.setItem('academic-asuna-minimized', String(value)); } catch (_) {} }
      syncRigPause();
      position();
    }
    function syncRigPause() {
      if (rig) rig.pause(minimized || document.hidden || reducedMotion.matches || canvas.hidden || root.dataset.renderer !== 'mesh');
    }
    function clearEffects() {
      figure.querySelectorAll('.asuna-companion__effect').forEach(function (effect) {
        effect.getAnimations({subtree: true}).forEach(function (animation) { animation.cancel(); });
        effect.remove();
      });
    }
    function tapEffect(point) {
      if (destroyed || minimized || drag || document.hidden || reducedMotion.matches || root.dataset.renderer !== 'mesh') return;
      var effect = document.createElement('span');
      effect.className = 'asuna-companion__effect asuna-companion__effect--tap';
      effect.setAttribute('aria-hidden', 'true');
      effect.style.left = (point.x * 100) + '%'; effect.style.top = (point.y * 100) + '%';
      figure.appendChild(effect);
      var animation = effect.animate([
        {opacity: .9, transform: 'translate(-50%, -50%) scale(.3)'},
        {opacity: .7, transform: 'translate(-50%, -50%) scale(1)', offset: .35},
        {opacity: 0, transform: 'translate(-50%, -50%) scale(1.7)'}
      ], {duration: 650, easing: 'ease-out'});
      animation.onfinish = function () { effect.remove(); };
    }
    function propEffect(point) {
      if (destroyed || minimized || drag || document.hidden || reducedMotion.matches || root.dataset.renderer !== 'mesh') return;
      if (point.type !== 'steam' && point.type !== 'page') return;
      var effect = document.createElement('span');
      effect.className = 'asuna-companion__effect asuna-companion__effect--' + point.type;
      effect.setAttribute('aria-hidden', 'true');
      effect.style.left = (point.x * 100) + '%'; effect.style.top = (point.y * 100) + '%';
      effect.style.width = (point.width * 100) + '%'; effect.style.height = (point.height * 100) + '%';
      var animation;
      if (point.type === 'steam') {
        effect.innerHTML = '<svg viewBox="0 0 48 64" aria-hidden="true"><path d="M12 62C26 48 1 38 14 20"/><path d="M24 58C40 42 13 31 28 5"/><path d="M36 63C49 49 26 39 38 23"/></svg>';
        figure.appendChild(effect);
        var angle = ' rotate(' + (point.angle || 0) + 'rad)';
        animation = effect.animate([
          {opacity: 0, transform: 'translate(-50%, -80%)' + angle + ' scale(.75)'},
          {opacity: .75, transform: 'translate(-50%, -100%)' + angle + ' scale(1)', offset: .35},
          {opacity: 0, transform: 'translate(-50%, -150%)' + angle + ' scale(1.2)'}
        ], {duration: 2600, easing: 'ease-out'});
      } else {
        // A translucent leaf turns about the book's spine. The existing book
        // and gripping fingers stay in their original contact layer.
        effect.style.transform = 'translateY(-50%) rotate(' + (point.angle || 0) + 'rad)';
        effect.innerHTML = '<svg class="asuna-companion__page-leaf" viewBox="0 0 60 80" preserveAspectRatio="none" aria-hidden="true"><path d="M1 5Q28 0 57 7L55 75Q29 69 1 76Z" fill="#fffae9" stroke="#b7a889" stroke-width=".7"/><path d="M8 19Q30 14 48 20M8 27Q30 22 48 28M8 35Q30 30 48 36M8 43Q30 38 44 43" fill="none" stroke="#c2b79e" stroke-width=".7"/></svg>';
        figure.appendChild(effect);
        effect.animate([
          {transform: 'translateY(-50%) rotate(' + (point.angle || 0) + 'rad)'},
          {transform: 'translateY(-50%) rotate(' + ((point.angle || 0) + .72) + 'rad)'}
        ], {duration: 1800, easing: 'ease-in-out', fill: 'forwards'});
        animation = effect.firstElementChild.animate([
          {opacity: 0, transform: 'rotateY(0deg)'},
          {opacity: .9, transform: 'rotateY(-35deg)', offset: .25},
          {opacity: .8, transform: 'rotateY(-105deg)', offset: .65},
          {opacity: 0, transform: 'rotateY(-170deg)'}
        ], {duration: 1800, easing: 'ease-in-out'});
      }
      animation.onfinish = function () { effect.remove(); };
    }
    async function ensureRig() {
      if (destroyed || minimized || reducedMotion.matches) return null;
      if (!rigReady) {
        rigReady = loadRigScripts().then(function () {
          if (destroyed) return null;
          rig = window.AsunaRig.create(canvas, {
            assetRoot: '/image/asuna-rig/',
            assetVersion: assetVersion,
            onTap: tapEffect,
            onEffect: propEffect,
            onError: function () { if (!destroyed) showStatic(); }
          });
          return rig;
        }).catch(function () { rigReady = null; return null; });
      }
      return rigReady;
    }
    function showStatic() {
      clearEffects();
      canvas.hidden = true; img.hidden = false; root.dataset.renderer = 'image';
      if (rig) rig.pause(true);
    }
    async function showRig(action, request) {
      var renderer = await ensureRig();
      if (!renderer || destroyed || request !== token) return false;
      try {
        var loadedRig = await renderer.load(action);
        if (loadedRig === false) return false;
        if (destroyed || request !== token || minimized || reducedMotion.matches) return false;
        renderer.play(action);
        canvas.hidden = false; img.hidden = true; root.dataset.renderer = 'mesh';
        syncRigPause(); warmNextAction();
        return true;
      } catch (_) { if (!destroyed && request === token) showStatic(); return false; }
    }
    function cancelWarmup() {
      clearTimeout(warmTimer);
      if (warmIdle != null && window.cancelIdleCallback) cancelIdleCallback(warmIdle);
      warmIdle = null;
    }
    function warmNextAction() {
      cancelWarmup();
      var connection = navigator.connection;
      if (destroyed || minimized || document.hidden || reducedMotion.matches || !rig || (connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType)))) return;
      fillBag();
      var next = bag[bag.length - 1];
      warmTimer = setTimeout(function () {
        function warm() {
          warmIdle = null;
          if (destroyed || minimized || document.hidden || reducedMotion.matches || root.dataset.loading === 'true') return;
          if (!document.documentElement.classList.contains('site-visual-ready')) { warmNextAction(); return; }
          // Warm exactly the next shuffled pose, not the whole action library.
          rig.prefetch(next);
          load(next).catch(function () {});
        }
        if (window.requestIdleCallback) warmIdle = requestIdleCallback(warm, {timeout: 1500});
        else warm();
      }, 450);
    }
    function load(action) {
      if (!loaded.has(action)) {
        loaded.set(action, new Promise(function (resolve, reject) {
          var picture = new Image();
          picture.onload = function () { resolve(picture.src); };
          picture.onerror = function () { loaded.delete(action); reject(new Error('Image unavailable')); };
          picture.src = poseImage(action);
        }));
      }
      return loaded.get(action);
    }
    function animate(action) {
      img.getAnimations().forEach(function (a) { a.cancel(); });
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var angle = action === 'sword' ? 5 : action === 'hot' ? 2 : 3;
      img.animate([
        {transform: 'translateY(0) rotate(0deg)', opacity: .65},
        {transform: 'translateY(-6px) rotate(' + (-angle) + 'deg)', opacity: 1, offset: .3},
        {transform: 'translateY(-2px) rotate(' + angle + 'deg)', offset: .6},
        {transform: 'translateY(0) rotate(0deg)', opacity: 1}
      ], {duration: 540, easing: 'ease-out'});
    }
    function speak(action) {
      var choices = lines[action].filter(function (line) { return line !== currentLine; });
      currentLine = choices[Math.floor(Math.random() * choices.length)];
      bubble.dataset.tone = currentLine[2];
      bubble.hidden = false; translate(); position();
    }
    function resetPose() {
      if (destroyed) return;
      if (drag) { resetTimer = setTimeout(resetPose, 300); return; }
      hideBubble();
      position();
      root.dataset.action = 'origin';
      clearEffects();
      img.src = poseImage('origin');
      showRig('origin', ++token);
    }
    async function trigger(action) {
      var request = ++token;
      cancelWarmup(); clearTimeout(resetTimer); clearEffects();
      root.dataset.loading = 'true';
      // Feedback is immediate; the previous mesh keeps moving during download.
      speak(action);
      var results = await Promise.all([
        load(action).catch(function () { return null; }),
        showRig(action, request)
      ]);
      if (destroyed || request !== token || minimized) return;
      var src = results[0], meshReady = results[1];
      if (src) img.src = src;
      if (meshReady || src) {
        root.dataset.action = action;
        if (!meshReady) animate(action);
        resetTimer = setTimeout(resetPose, (window.AsunaRig && window.AsunaRig.motionDurations && window.AsunaRig.motionDurations[action]) || durations[action] || 24000);
      } else {
        img.src = poseImage('origin');
        root.dataset.action = 'origin'; speak('origin');
        showRig('origin', request);
        resetTimer = setTimeout(resetPose, 8500);
      }
      root.dataset.loading = 'false';
      warmNextAction();
    }
    function fillBag() {
      if (!bag.length) {
        bag = actions.slice();
        for (var i = bag.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var temp = bag[i]; bag[i] = bag[j]; bag[j] = temp;
        }
        if (bag[bag.length - 1] === previousAction) bag.reverse();
      }
    }
    function nextAction() {
      fillBag();
      previousAction = bag.pop();
      return previousAction;
    }
    figure.addEventListener('click', function () {
      if (performance.now() < suppressClickUntil) return;
      trigger(nextAction());
    }, {signal: signal});
    figure.addEventListener('pointerdown', function (event) {
      if (!event.isPrimary || event.button !== 0) return;
      var rect = root.getBoundingClientRect();
      drag = {id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false};
      figure.setPointerCapture(event.pointerId);
    }, {signal: signal});
    figure.addEventListener('pointermove', function (event) {
      if (!drag || event.pointerId !== drag.id) return;
      var dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 7) return;
      drag.moved = true; root.dataset.dragging = 'true'; hideBubble(); clearEffects();
      var rect = root.getBoundingClientRect();
      root.style.left = Math.max(8, Math.min(innerWidth - rect.width - 8, drag.left + dx)) + 'px';
      var limits = verticalLimits(rect.height);
      root.style.top = Math.max(limits.min, Math.min(limits.max, drag.top + dy)) + 'px';
    }, {signal: signal});
    function endDrag(event) {
      if (!drag || event.pointerId !== drag.id) return;
      var moved = drag.moved;
      drag = null; delete root.dataset.dragging;
      if (moved) {
        suppressClickUntil = performance.now() + 350;
        var rect = root.getBoundingClientRect();
        side = rect.left + rect.width / 2 < innerWidth / 2 ? 'left' : 'right';
        var limits = verticalLimits(rect.height);
        yRatio = Math.max(0, Math.min(1, (rect.top - limits.min) / Math.max(1, limits.max - limits.min)));
        savePosition(); position();
      }
    }
    function cancelDrag() {
      if (!drag) return;
      var id = drag.id;
      drag = null; delete root.dataset.dragging;
      suppressClickUntil = performance.now() + 350;
      if (figure.hasPointerCapture(id)) figure.releasePointerCapture(id);
      position();
    }
    figure.addEventListener('pointerup', endDrag, {signal: signal});
    figure.addEventListener('pointercancel', endDrag, {signal: signal});
    figure.addEventListener('lostpointercapture', cancelDrag, {signal: signal});
    figure.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { setMinimized(true, true); restore.focus(); }
      if (!/^Arrow/.test(event.key)) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') side = 'left';
      if (event.key === 'ArrowRight') side = 'right';
      if (event.key === 'ArrowUp') yRatio = Math.max(0, yRatio - .06);
      if (event.key === 'ArrowDown') yRatio = Math.min(1, yRatio + .06);
      savePosition(); position();
    }, {signal: signal});
    minimize.addEventListener('click', function () { setMinimized(true, true); restore.focus(); }, {signal: signal});
    restore.addEventListener('click', function () { setMinimized(false, true); trigger('hello'); figure.focus(); }, {signal: signal});
    if (document.fonts) document.fonts.addEventListener('loadingdone', schedulePosition, {signal: signal});
    window.addEventListener('resize', function () {
      var nowNarrow = innerWidth <= 1080;
      if (nowNarrow && !narrow) setMinimized(true, false);
      narrow = nowNarrow; schedulePosition();
    }, {signal: signal});
    window.addEventListener('scroll', function () {
      if (narrow && !minimized && !drag) setMinimized(true, false);
      schedulePosition();
    }, {signal: signal, passive: true});
    document.addEventListener('pointerdown', function (event) {
      if (narrow && !minimized && !root.contains(event.target)) setMinimized(true, false);
    }, {signal: signal, passive: true});
    var languageObserver = new MutationObserver(translate);
    languageObserver.observe(home, {attributes: true, attributeFilter: ['lang']});
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelWarmup(); cancelDrag(); clearEffects(); img.getAnimations().forEach(function (a) { a.cancel(); }); hideBubble(); }
      syncRigPause();
      if (!document.hidden) warmNextAction();
    }, {signal: signal});
    document.addEventListener('pointermove', function (event) {
      if (!rig || minimized || drag || event.pointerType === 'touch') return;
      var rect = figure.getBoundingClientRect();
      rig.setGaze(Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / (innerWidth / 2))),
        Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height * .28) / (innerHeight / 2))));
    }, {signal: signal, passive: true});
    reducedMotion.addEventListener('change', function () {
      if (reducedMotion.matches) { cancelWarmup(); showStatic(); if (!bubble.hidden) writeDialogue(); }
      else showRig(root.dataset.action || 'origin', token);
    }, {signal: signal});
    translate();
    root.dataset.action = 'origin';
    setMinimized(minimized, false);
    load('origin').then(function (src) {
      if (destroyed) return;
      img.src = src; root.hidden = false; position();
      showRig('origin', token);
    }).catch(function () { root.hidden = true; });

    dispose = function () {
      destroyed = true; token++; cancelWarmup();
      cancelDrag();
      controller.abort(); languageObserver.disconnect();
      clearTimeout(resetTimer); hideBubble(); clearEffects(); cancelAnimationFrame(frame);
      img.getAnimations().forEach(function (a) { a.cancel(); }); root.remove();
      if (rig) { rig.dispose(); rig = null; }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
  document.addEventListener('pjax:send', function () { if (dispose) { dispose(); dispose = null; } });
  document.addEventListener('pjax:complete', init);
})();
