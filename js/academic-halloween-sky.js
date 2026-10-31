/* Night sky for the Halloween costume: scintillating stars, an occasional Orionid meteor (the shower
   is active from early October to early November) and a few hunting bats, drawn on one canvas that
   sits above the moon. Layers are created by academic-halloween.js. */
(function () {
  var season = window.academicSeason;
  var sky = document.querySelector('.hw-sky');
  var canvas = sky && sky.querySelector('.hw-sky__canvas');
  if (!season || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var moon = sky.querySelector('.hw-moon');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var TAU = Math.PI * 2;
  var width = 0, height = 0, dpr = 1, scale = 1, disk = null;
  var stars = [], bats = [], meteor = null;
  var running = false, inView = true, raf = 0, last = 0, clock = 0;
  var nextBat = 2, nextMeteor = 8 + Math.random() * 12;

  // One wing in units of the half-span, y up: leading root, wrist, digit tips III-V, ankle.
  var SPREAD = [[0.07, 0.1], [0.45, 0.17], [1, 0.1], [0.78, -0.22], [0.5, -0.36], [0.09, -0.3]];
  var FOLDED = [[0.07, 0.1], [0.34, 0.25], [0.64, 0.07], [0.5, -0.15], [0.33, -0.27], [0.09, -0.27]];

  function random(min, max) { return min + Math.random() * (max - min); }
  function wrap(angle) { return Math.atan2(Math.sin(angle), Math.cos(angle)); }

  function measure() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = sky.clientWidth;
    height = sky.clientHeight;
    scale = Math.max(0.7, Math.min(1.15, window.innerWidth / 1440));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    // Layout offsets ignore the moon's entrance transform.
    disk = moon && moon.offsetWidth ? { x: moon.offsetLeft + moon.offsetWidth / 2, y: moon.offsetTop + moon.offsetWidth / 2, r: moon.offsetWidth / 2 } : null;
    seedStars();
    if (!running) draw();
  }

  function seedStars() {
    stars = [];
    var count = Math.round(width * height / 5200);
    for (var i = 0; i < count; i++) {
      var x = Math.random() * width, y = Math.pow(Math.random(), 1.35) * height * 0.9;
      if (disk && Math.hypot(x - disk.x, y - disk.y) < disk.r * 1.55) continue;
      var bright = Math.random() < 0.05, tint = Math.random();
      stars.push({
        x: x, y: y, bright: bright,
        r: bright ? random(1, 1.7) : random(0.35, 0.95),
        a: (bright ? 0.9 : random(0.3, 0.75)) * (1 - 0.8 * y / height),
        rgb: tint < 0.18 ? '255,212,168' : tint < 0.36 ? '198,210,255' : '255,247,236',
        f: random(0.7, 2.6), p: random(0, TAU)
      });
    }
  }

  function spawnBat(fromMoon) {
    var dir = Math.random() < 0.5 ? 1 : -1;
    var bat = {
      dir: dir, base: dir > 0 ? 0 : Math.PI, swerve: 0, turn: 0, roll: 0, age: 0,
      d0: random(0.45, 1), d1: 0, grow: 0, wander: random(0, TAU), dart: random(0.4, 1.6),
      phase: Math.random(), x: dir > 0 ? -60 : width + 60, y: height * random(0.12, 0.5)
    };
    bat.d1 = bat.d0;
    bat.heading = bat.base + random(-0.25, 0.25);
    if (fromMoon && disk) {
      // Emerging from the moon: small and far at first, then coming closer.
      bat.x = disk.x + random(-0.35, 0.35) * disk.r;
      bat.y = disk.y + random(-0.3, 0.2) * disk.r;
      bat.d0 = 0.2;
      bat.grow = random(1.8, 2.6);
      bat.heading = bat.base + (dir > 0 ? random(0.15, 0.5) : -random(0.15, 0.5));
    }
    bats.push(bat);
  }

  function depth(bat) {
    if (bat.age >= bat.grow) return bat.d1;
    var t = bat.age / bat.grow;
    return bat.d0 + (bat.d1 - bat.d0) * (1 - Math.pow(1 - t, 3));
  }

  function stepBat(bat, dt) {
    bat.age += dt;
    bat.dart -= dt;
    // A sudden swerve after an insect, then the course relaxes back.
    if (bat.dart <= 0) { bat.swerve = random(-1, 1) * 1.1; bat.dart = random(0.5, 2.2); }
    bat.swerve *= Math.pow(0.06, dt);
    var band = bat.y < height * 0.08 ? 1 : bat.y > height * 0.6 ? -1 : 0;
    var target = bat.base + bat.swerve + 0.32 * Math.sin(clock * 0.9 + bat.wander) + band * 0.55 * bat.dir;
    var before = bat.heading;
    bat.heading += wrap(target - bat.heading) * Math.min(1, dt * 3.2);
    bat.turn = wrap(bat.heading - before) / Math.max(dt, 1e-3);
    bat.roll += (Math.max(-0.6, Math.min(0.6, bat.turn * 0.22)) - bat.roll) * Math.min(1, dt * 5);
    var d = depth(bat), speed = (62 + 70 * d) * scale;
    bat.x += Math.cos(bat.heading) * speed * dt;
    bat.y += Math.sin(bat.heading) * speed * dt;
    // Smaller, farther bats beat their wings faster.
    bat.phase = (bat.phase + dt * (8.4 - 2.6 * d)) % 1;
    return bat.x > -90 && bat.x < width + 90;
  }

  function wing(side, flex, lift) {
    var pivotX = 0.06, pivotY = 0.08, cos = Math.cos(lift), sin = Math.sin(lift);
    var points = SPREAD.map(function (p, i) {
      var x = p[0] + (FOLDED[i][0] - p[0]) * flex - pivotX, y = p[1] + (FOLDED[i][1] - p[1]) * flex - pivotY;
      return [side * (pivotX + x * cos - y * sin), pivotY + x * sin + y * cos];
    });
    var root = points[0], wrist = points[1];
    var nodes = [[side * 0.04, 0.14], wrist, points[2], points[3], points[4], points[5], [side * 0.035, -0.17]];
    var controls = [[(root[0] + wrist[0]) / 2, Math.max(root[1], wrist[1]) + 0.07], null];
    // Membrane edges sag toward the wrist between the finger tips.
    for (var i = 2; i < 5; i++) {
      var a = points[i], b = points[i + 1], pull = i < 4 ? wrist : [0, 0];
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      controls.push([mx + (pull[0] - mx) * 0.38, my + (pull[1] - my) * 0.38]);
    }
    controls.push(null);
    // Mirroring flips the winding; walk the left wing backwards so the whole silhouette fills as one.
    if (side < 0) { nodes.reverse(); controls.reverse(); }
    ctx.moveTo(nodes[0][0], nodes[0][1]);
    for (var j = 1; j < nodes.length; j++) {
      var c = controls[j - 1];
      if (c) ctx.quadraticCurveTo(c[0], c[1], nodes[j][0], nodes[j][1]);
      else ctx.lineTo(nodes[j][0], nodes[j][1]);
    }
    ctx.closePath();
  }

  function drawBat(bat) {
    var d = depth(bat), span = (12 + 18 * d) * scale, beat = bat.phase * TAU;
    var lift = 0.2 + 0.78 * Math.cos(beat), flex = Math.max(0, Math.sin(beat - Math.PI));
    ctx.save();
    ctx.translate(bat.x, bat.y - Math.sin(beat) * 0.07 * span);
    ctx.rotate(bat.roll);
    ctx.scale(span, -span);
    ctx.beginPath();
    wing(1, flex, lift);
    wing(-1, flex, lift);
    ctx.moveTo(0.07, -0.02);
    // Body, head and ears share the wings' clockwise winding, so the silhouette fills as one shape.
    ctx.ellipse(0, -0.02, 0.07, 0.17, 0, 0, TAU, true);
    ctx.moveTo(0.065, 0.16);
    ctx.arc(0, 0.16, 0.065, 0, TAU, true);
    [1, -1].forEach(function (s) {
      var ear = [[s * 0.022, 0.2], [s * 0.06, 0.31], [s * 0.068, 0.17]];
      if (s < 0) ear.reverse();
      ctx.moveTo(ear[0][0], ear[0][1]); ctx.lineTo(ear[1][0], ear[1][1]); ctx.lineTo(ear[2][0], ear[2][1]); ctx.closePath();
    });
    // Moonlit rim: stronger for nearer bats; distant ones fade into the haze.
    ctx.shadowColor = 'rgba(196,176,255,' + (0.18 + 0.3 * d).toFixed(3) + ')';
    ctx.shadowBlur = (2 + 4 * d) * dpr;
    ctx.fillStyle = d < 0.6 ? '#1b1526' : '#09070d';
    ctx.fill();
    ctx.restore();
  }

  function drawStars() {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      // Two incommensurate waves give an irregular, atmospheric twinkle.
      var a = running ? s.a * (0.7 + 0.3 * Math.sin(clock * s.f + s.p) * Math.sin(clock * s.f * 0.37 + s.p * 1.7)) : s.a * 0.85;
      ctx.fillStyle = 'rgba(' + s.rgb + ',' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
      if (s.bright) {
        var glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6);
        glow.addColorStop(0, 'rgba(' + s.rgb + ',' + (a * 0.35).toFixed(3) + ')');
        glow.addColorStop(1, 'rgba(' + s.rgb + ',0)');
        ctx.fillStyle = glow;
        ctx.fillRect(s.x - s.r * 6, s.y - s.r * 6, s.r * 12, s.r * 12);
      }
    }
  }

  function drawMeteor() {
    var t = meteor.age / meteor.life, head = { x: meteor.x + meteor.vx * meteor.age, y: meteor.y + meteor.vy * meteor.age };
    var norm = Math.hypot(meteor.vx, meteor.vy), length = meteor.length * Math.min(1, t * 3);
    var tail = { x: head.x - meteor.vx / norm * length, y: head.y - meteor.vy / norm * length };
    var alpha = Math.sin(Math.PI * Math.min(1, t)) * 0.9;
    var trail = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    trail.addColorStop(0, 'rgba(255,246,228,' + alpha.toFixed(3) + ')');
    trail.addColorStop(0.25, 'rgba(255,214,170,' + (alpha * 0.45).toFixed(3) + ')');
    trail.addColorStop(1, 'rgba(255,214,170,0)');
    ctx.strokeStyle = trail;
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawStars();
    if (meteor) drawMeteor();
    bats.forEach(drawBat);
  }

  function step(dt) {
    clock += dt;
    bats = bats.filter(function (bat) { return stepBat(bat, dt); });
    nextBat -= dt;
    if (nextBat <= 0 && bats.length < (window.innerWidth < 700 ? 2 : 4)) { spawnBat(false); nextBat = random(2.5, 6.5); }
    if (meteor && (meteor.age += dt) > meteor.life) meteor = null;
    if (!meteor && (nextMeteor -= dt) <= 0) {
      var angle = random(0.3, 0.55), speed = random(720, 980);
      meteor = { x: width * random(0.3, 0.95), y: height * random(0.04, 0.25), vx: -Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        age: 0, life: random(0.55, 0.9), length: random(90, 160) * scale };
      nextMeteor = random(16, 38);
    }
  }

  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    // A background needs no more than 60 fps, even on high-refresh displays.
    if (now - last < 15) return;
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    step(dt);
    draw();
  }

  function sync() {
    var on = season.isActive() && inView && !document.hidden && !reduced.matches;
    if (on && !running) {
      running = true;
      last = performance.now();
      raf = window.requestAnimationFrame(frame);
    } else if (!on && running) {
      running = false;
      window.cancelAnimationFrame(raf);
      draw();
    }
  }

  function prime() {
    measure();
    bats = [];
    spawnBat(true);
    spawnBat(true);
    bats[1].dir = -bats[0].dir;
    bats[1].base = bats[1].dir > 0 ? 0 : Math.PI;
    bats[1].heading = bats[1].base + bats[1].dir * random(0.15, 0.45);
    if (reduced.matches) bats.forEach(function (bat) { bat.age = bat.grow; bat.x += bat.dir * 70 * scale; bat.phase = 0.2; });
    draw();
  }

  new ResizeObserver(function () { if (sky.clientWidth && Math.abs(sky.clientWidth - width) + Math.abs(sky.clientHeight - height) > 1) measure(); }).observe(sky);
  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    sky.classList.toggle('is-idle', !inView);
    sync();
  }).observe(sky);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', function () { prime(); sync(); });
  document.addEventListener('academic-season-change', function () { if (season.isActive()) prime(); sync(); });
  prime();
  sync();
})();
