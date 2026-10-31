/* A spider lowers itself on a silk thread into the left margin. Pendulum physics on an elastic
   thread (reeling conserves angular momentum); it climbs back under the navigation bar when the
   pointer comes close and returns a little later. Canvas created by academic-halloween.js. */
(function () {
  var season = window.academicSeason;
  var canvas = document.querySelector('.hw-spider');
  if (!season || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wide = window.matchMedia('(min-width: 1081px)');
  var TAU = Math.PI * 2, W = 120, H = 330, AX = 60, REST = 250, HIDDEN = -58, G = 1400;
  var reel = HIDDEN, length = HIDDEN, lengthVel = 0, theta = 0.06, omega = 0;
  var mode = 'wait', modeTime = 0, hideFor = 4, clock = 0, gait = 0, dpr = 1;
  var running = false, inView = true, raf = 0, last = 0;
  var pointer = { x: -1e4, y: -1e4, vx: 0, t: 0 };
  // Right legs, from the front pair (toward the head, which hangs downward) to the back pair.
  var LEGS = [{ a: 34, l: 1.12 }, { a: 72, l: 0.92 }, { a: 112, l: 0.86 }, { a: 148, l: 1.04 }];

  function place() {
    var nav = document.getElementById('nav');
    var hero = canvas.parentElement;
    if (!nav || !hero) return;
    // The thread is tied to the navigation bar's lower edge; the canvas clips anything above it.
    canvas.style.top = Math.round(nav.getBoundingClientRect().bottom - hero.getBoundingClientRect().top) + 'px';
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }

  function leg(side, spec, index, sway) {
    var a = (spec.a + sway) * Math.PI / 180, bend = (90 - spec.a) * 0.45 * Math.PI / 180;
    var hipX = side * 4.6 * Math.sin(a), hipY = 5 + 5.2 * Math.cos(a);
    var kneeX = hipX + side * 13 * spec.l * Math.sin(a + bend), kneeY = hipY + 13 * spec.l * Math.cos(a + bend);
    var tipX = kneeX + side * 14 * spec.l * Math.sin(a - bend * 0.5), tipY = kneeY + 14 * spec.l * Math.cos(a - bend * 0.5);
    ctx.strokeStyle = '#3d2f4f';
    ctx.lineWidth = 2.1;
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
    ctx.strokeStyle = '#342840';
    ctx.lineWidth = 1.35;
    ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.quadraticCurveTo(kneeX + side * 2 * Math.sin(a), kneeY + 2, tipX, tipY); ctx.stroke();
  }

  function drawSpider(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-angle);
    ctx.translate(0, 18.5);
    ctx.shadowColor = 'rgba(206,188,255,0.45)';
    ctx.shadowBlur = 3.5 * dpr;
    ctx.lineCap = 'round';
    var climbing = mode === 'flee', dropping = mode === 'drop';
    LEGS.forEach(function (spec, i) {
      [1, -1].forEach(function (side) {
        var sway = climbing
          ? 26 * Math.sin(gait + i * 1.6 + (side > 0 ? 0 : Math.PI))
          : (dropping ? -10 + 4 * (i - 1.5) : 0) + 3.5 * Math.sin(clock * 1.4 + i * 0.9 + side);
        leg(side, spec, i, sway);
      });
    });
    var shell = ctx.createRadialGradient(-2.6, -12.5, 0.5, 0, -9, 10.5);
    shell.addColorStop(0, '#5d4b72');
    shell.addColorStop(0.35, '#211830');
    shell.addColorStop(1, '#09070d');
    ctx.fillStyle = shell;
    ctx.beginPath(); ctx.ellipse(0, -9, 7.2, 9.6, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#100b16';
    ctx.beginPath(); ctx.ellipse(0, 5, 5.1, 5.7, 0, 0, TAU); ctx.fill();
    // Faint dorsal chevrons on the abdomen.
    ctx.strokeStyle = 'rgba(176,150,206,0.22)';
    ctx.lineWidth = 0.8;
    for (var c = 0; c < 3; c++) {
      ctx.beginPath(); ctx.moveTo(-3 + c * 0.6, -13 + c * 3.4); ctx.lineTo(0, -11.4 + c * 3.4); ctx.lineTo(3 - c * 0.6, -13 + c * 3.4); ctx.stroke();
    }
    ctx.fillStyle = '#ffb35a';
    ctx.shadowColor = 'rgba(255,170,80,0.8)';
    ctx.shadowBlur = 2.5 * dpr;
    [-1.7, 1.7].forEach(function (ex) { ctx.beginPath(); ctx.arc(ex, 8.9, 0.85, 0, TAU); ctx.fill(); });
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var shown = length + (mode === 'hang' ? 1.6 * Math.sin(clock * 1.3) : 0);
    var x = AX + shown * Math.sin(theta), y = shown * Math.cos(theta);
    if (shown > 0) {
      var silk = ctx.createLinearGradient(AX, 0, x, y);
      silk.addColorStop(0, 'rgba(232,224,246,0.12)');
      silk.addColorStop(1, 'rgba(232,224,246,0.55)');
      ctx.strokeStyle = silk;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(AX, 0); ctx.lineTo(x, y); ctx.stroke();
      // Moonlight catching the silk now and then.
      var glint = (clock * 0.32) % 1.6;
      if (running && glint < 1) {
        var gx = AX + (x - AX) * glint, gy = y * glint;
        var spark = ctx.createRadialGradient(gx, gy, 0, gx, gy, 10);
        spark.addColorStop(0, 'rgba(255,250,240,' + (0.75 * Math.sin(Math.PI * glint)).toFixed(3) + ')');
        spark.addColorStop(1, 'rgba(255,250,240,0)');
        ctx.fillStyle = spark;
        ctx.fillRect(gx - 10, gy - 10, 20, 20);
      }
    }
    drawSpider(x, y, theta);
  }

  function setMode(next) { mode = next; modeTime = 0; }

  function step(dt) {
    clock += dt;
    modeTime += dt;
    gait += dt * 15;
    if (mode === 'wait' && modeTime > 1.2) setMode('drop');
    if (mode === 'drop') {
      reel = Math.min(REST, reel + Math.max(24, (REST - reel) * 1.9) * dt);
      if (REST - reel < 0.5) setMode('hang');
    } else if (mode === 'flee') {
      reel -= 360 * dt;
      if (reel <= HIDDEN) { reel = HIDDEN; hideFor = 3.5 + Math.random() * 2.5; setMode('hide'); }
    } else if (mode === 'hide' && modeTime > hideFor) {
      setMode('drop');
    }
    var before = Math.max(length, 20);
    lengthVel += ((reel - length) * 70 - lengthVel * 7.5) * dt;
    length += lengthVel * dt;
    var after = Math.max(length, 20);
    omega *= (before * before) / (after * after);
    var breeze = 0.22 * Math.sin(clock * 0.63) + 0.12 * Math.sin(clock * 1.71 + 1.3);
    var rect = canvas.getBoundingClientRect();
    var bodyX = rect.left + AX + length * Math.sin(theta), bodyY = rect.top + length * Math.cos(theta) + 20;
    var distance = Math.hypot(pointer.x - bodyX, pointer.y - bodyY);
    // A passing pointer stirs the air; one that comes close sends the spider home.
    var push = performance.now() - pointer.t < 120 && distance < 170 ? pointer.vx * 0.0026 * (1 - distance / 170) : 0;
    omega += (-(G / after) * Math.sin(theta) - 0.32 * omega + breeze + push) * dt;
    theta += omega * dt;
    if ((mode === 'hang' || mode === 'drop') && distance < 88 && length > 30) setMode('flee');
  }

  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    if (now - last < 15) return;
    var dt = Math.min(0.04, Math.max(0, (now - last) / 1000));
    last = now;
    step(dt);
    draw();
  }

  function sync() {
    var on = season.isActive() && wide.matches && inView && !document.hidden && !reduced.matches;
    if (on && !running) {
      running = true;
      last = performance.now();
      raf = window.requestAnimationFrame(frame);
    } else if (!on && running) {
      running = false;
      window.cancelAnimationFrame(raf);
    }
  }

  function prime() {
    place();
    if (reduced.matches) { reel = length = REST; theta = 0.03; setMode('hang'); }
    else { reel = length = HIDDEN; lengthVel = omega = 0; theta = 0.06; setMode('wait'); }
    draw();
  }

  window.addEventListener('pointermove', function (event) {
    var now = performance.now();
    pointer.vx = (event.clientX - pointer.x) / Math.max(1, now - pointer.t) * 1000;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.t = now;
  }, { passive: true });
  window.addEventListener('resize', place);
  new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; sync(); }).observe(canvas);
  document.addEventListener('visibilitychange', sync);
  wide.addEventListener('change', sync);
  reduced.addEventListener('change', function () { prime(); sync(); });
  document.addEventListener('academic-season-change', function () { if (season.isActive()) prime(); sync(); });
  prime();
  sync();
})();
