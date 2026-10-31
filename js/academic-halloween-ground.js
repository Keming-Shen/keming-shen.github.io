/* The page ends on a moonlit hill: gnarled trees, tombstones, an iron fence, drifting fog and a
   patch of jack-o'-lanterns that light up when the footer comes into view. */
(function () {
  var season = window.academicSeason;
  var footer = document.getElementById('footer');
  if (!season || !season.available || !footer) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var seed = 20261031;
  function random() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function range(min, max) { return min + random() * (max - min); }
  function f(n) { return Math.round(n * 10) / 10; }

  // Recursive, slightly curved limbs; one path per depth so strokes taper toward the twigs.
  function tree(x, y, height, lean) {
    var paths = [];
    (function branch(x0, y0, angle, length, depth) {
      var x1 = x0 + Math.cos(angle) * length, y1 = y0 - Math.sin(angle) * length;
      var bow = range(-0.22, 0.22) * length;
      var cx = (x0 + x1) / 2 + Math.sin(angle) * bow, cy = (y0 + y1) / 2 + Math.cos(angle) * bow;
      paths[depth] = (paths[depth] || '') + 'M' + f(x0) + ' ' + f(y0) + 'Q' + f(cx) + ' ' + f(cy) + ' ' + f(x1) + ' ' + f(y1);
      if (depth === 5) return;
      var forks = depth < 2 ? 2 : random() < 0.6 ? 2 : 3;
      for (var i = 0; i < forks; i++) {
        var spread = (i - (forks - 1) / 2) * range(0.45, 0.8) + range(-0.15, 0.15);
        branch(x1, y1, Math.max(0.12, Math.min(Math.PI - 0.12, angle + spread)), length * range(0.6, 0.78), depth + 1);
      }
    })(x, y, Math.PI / 2 + lean, height * 0.36, 0);
    return paths.map(function (d, depth) {
      return '<path stroke-width="' + [7, 4.2, 2.6, 1.6, 1, 0.7][depth] + '" d="' + d + '"/>';
    }).join('');
  }

  function fence(x, y, count) {
    var d = 'M' + (x - 6) + ' ' + (y - 24) + 'h' + (count * 14 + 10) + 'v2.4h-' + (count * 14 + 10) + 'Z' +
      'M' + (x - 6) + ' ' + (y - 8) + 'h' + (count * 14 + 10) + 'v2.4h-' + (count * 14 + 10) + 'Z';
    for (var i = 0; i < count; i++) {
      var px = x + i * 14;
      d += 'M' + (px - 1) + ' ' + (y + 4) + 'V' + (y - 31) + 'l1-1 1 1V' + (y + 4) + 'Z' +
        'M' + (px - 3) + ' ' + (y - 31) + 'L' + px + ' ' + (y - 39) + 'L' + (px + 3) + ' ' + (y - 31) + 'Z';
    }
    return '<path d="' + d + '"/><circle cx="' + (x - 8) + '" cy="' + (y - 40) + '" r="3.4"/><path d="M' + (x - 11) + ' ' + (y + 4) + 'V' + (y - 37) + 'h6V' + (y + 4) + 'Z"/>';
  }

  function grass(fromX, toX, baseY, count) {
    var d = '';
    for (var i = 0; i < count; i++) {
      var x = range(fromX, toX), y = baseY(x), h = range(5, 13), lean = range(-4, 4);
      d += 'M' + f(x - 1.4) + ' ' + f(y + 2) + 'Q' + f(x + lean * 0.4) + ' ' + f(y - h * 0.5) + ' ' + f(x + lean) + ' ' + f(y - h) + 'Q' + f(x + 0.3) + ' ' + f(y - h * 0.4) + ' ' + f(x + 1.4) + ' ' + f(y + 2) + 'Z';
    }
    return '<path d="' + d + '"/>';
  }

  // Five overlapping lobes shaded from the candle within, a moonlit rim, carved holes with depth.
  // Each carved hole: path and centroid. The lit inner cut is inset toward its own centre, so a
  // rim of candle-lit flesh shows the thickness of the wall.
  var HOLES = [['M38 57 46.5 42.5 54 57.5Z', 46.2, 52.3], ['M66 57.5 73.5 42.5 82 57Z', 73.8, 52.3], ['M57 67.5 60 61.5 63 67.5Z', 60, 65.5],
    ['M33 69.5Q60 96 87 69.5L81 72.5 77.5 69.8 73 76.8 68.6 71.2 64 74.6 60 70.8 56 74.6 51.4 71.2 47 76.8 42.5 69.8 39 72.5Z', 60, 77]];
  var FACE = HOLES.map(function (h) { return h[0]; }).join('');
  var FIRE = HOLES.map(function (h) {
    return '<path d="' + h[0] + '" transform="translate(' + h[1] + ' ' + (h[2] - 1.3) + ') scale(.86) translate(' + -h[1] + ' ' + -h[2] + ')"/>';
  }).join('');
  function lobe(cx, rx, fill) {
    var tx = f(60 + (cx - 60) * 0.32), bx = f(60 + (cx - 60) * 0.4);
    return '<path d="M' + tx + ' 27C' + f(cx - rx) + ' 21 ' + f(cx - rx * 1.08) + ' 101 ' + bx + ' 98C' + f(cx + rx * 1.08) + ' 101 ' + f(cx + rx) + ' 21 ' + tx + ' 27Z" fill="url(#hw-jol-' + fill + ')"/>';
  }
  function lantern(x, y, scale, index) {
    var body = lobe(25, 23, 'side') + lobe(95, 23, 'side') + lobe(41, 25, 'skin') + lobe(79, 25, 'skin') + lobe(60, 25, 'skin');
    var clip = 'hw-jol-clip-' + index;
    return '<g class="hw-lantern" transform="translate(' + x + ' ' + y + ') scale(' + scale + ')">' +
      '<ellipse class="hw-lantern__pool" cx="60" cy="98" rx="74" ry="10" fill="url(#hw-jol-pool)"/>' +
      '<ellipse class="hw-lantern__halo" cx="60" cy="62" rx="86" ry="62" fill="url(#hw-jol-halo)"/>' +
      '<clipPath id="' + clip + '">' + body.replace(/ fill="[^"]*"/g, '') + '</clipPath>' + body +
      '<rect x="4" y="20" width="112" height="82" fill="url(#hw-jol-rim)" clip-path="url(#' + clip + ')"/>' +
      '<path d="M57.6 27.5c-1-6.5.8-12 5.4-16.5l4.6 3c-3.6 3.4-5 7.6-4.5 13.4Z" fill="url(#hw-jol-stem)"/>' +
      '<path d="' + FACE + '" fill="#e7832f"/>' +
      '<g class="hw-lantern__fire" fill="url(#hw-jol-fire)">' + FIRE + '</g>' +
      '</g>';
  }

  var DEFS = '<defs>' +
    '<radialGradient id="hw-jol-skin" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#e57a2b"/><stop offset=".55" stop-color="#ad4a11"/><stop offset="1" stop-color="#3c1404"/></radialGradient>' +
    '<radialGradient id="hw-jol-side" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#b85818"/><stop offset="1" stop-color="#2e0f03"/></radialGradient>' +
    '<linearGradient id="hw-jol-rim" x1="0" y1="0" x2=".55" y2=".7"><stop offset="0" stop-color="#cdbfff" stop-opacity=".5"/><stop offset=".3" stop-color="#cdbfff" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="hw-jol-stem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b8a45"/><stop offset="1" stop-color="#2c3416"/></linearGradient>' +
    '<radialGradient id="hw-jol-fire" cx=".5" cy=".62" r=".62"><stop offset="0" stop-color="#fff7cf"/><stop offset=".42" stop-color="#ffd25a"/><stop offset="1" stop-color="#f2801f"/></radialGradient>' +
    '<radialGradient id="hw-jol-halo"><stop offset="0" stop-color="#ff9a3d" stop-opacity=".5"/><stop offset=".45" stop-color="#ff8a2e" stop-opacity=".16"/><stop offset="1" stop-color="#ff8a2e" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="hw-jol-pool"><stop offset="0" stop-color="#ffb35c" stop-opacity=".55"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>' +
    '</defs>';

  function farHill(x) { return 112 + 9 * Math.sin(x / 260) + 5 * Math.sin(x / 97 + 1); }
  function nearHill(x) { return 146 + 6 * Math.sin(x / 210 + 2) + 3 * Math.sin(x / 71); }
  function hill(fn) {
    var d = 'M0 ' + f(fn(0));
    for (var x = 40; x <= 1600; x += 40) d += 'L' + x + ' ' + f(fn(x));
    return d + 'V240H0Z';
  }

  var scene = '<svg class="hw-ground__scene" viewBox="0 0 1600 240" preserveAspectRatio="xMidYMax slice" focusable="false">' + DEFS + '<g transform="translate(0 50)">' +
    '<path class="hw-ground__far" d="' + hill(farHill) + '"/>' +
    '<path class="hw-ground__crest" d="' + hill(farHill).replace(/V240H0Z$/, '') + '"/>' +
    '<g class="hw-ground__tree">' + tree(222, farHill(222) + 4, 124, 0.06) + tree(1362, farHill(1362) + 4, 138, -0.08) + tree(1480, farHill(1480) + 4, 100, 0.12) + '</g>' +
    '<path class="hw-ground__near" d="' + hill(nearHill) + '"/>' +
    '<g class="hw-ground__near">' +
      '<path d="M596 153v-30a15 15 0 0 1 30 0v30Z" transform="rotate(-6 611 150)"/>' +
      '<path d="M652 151v-31h-10v-7h10v-10h7v10h10v7h-10v31Z" transform="rotate(4 657 148)"/>' +
      '<path d="M1010 147v-24a12 12 0 0 1 24 0v24Z" transform="rotate(3 1022 146)"/>' +
      fence(1116, 145, 11) + grass(0, 1600, nearHill, 150) +
    '</g>' +
    lantern(732, 92, 0.94, 0) + lantern(806, 116, 0.6, 1) + lantern(680, 122, 0.46, 2) +
    '</g></svg>';

  var ground = document.createElement('div');
  ground.className = 'hw-decor hw-ground';
  ground.setAttribute('aria-hidden', 'true');
  ground.innerHTML = '<div class="hw-fog"></div>' + scene + '<div class="hw-fog hw-fog--front"></div>';
  footer.prepend(ground);

  // Candlelight: two octaves of smoothed 1D value noise per lantern, plus an ignition flare.
  var lanterns = Array.prototype.map.call(ground.querySelectorAll('.hw-lantern'), function (node, i) {
    var table = [];
    for (var k = 0; k < 64; k++) table.push(Math.random());
    return { fire: node.querySelector('.hw-lantern__fire'), halo: node.querySelector('.hw-lantern__halo'),
      pool: node.querySelector('.hw-lantern__pool'), table: table, lit: -1, delay: [0, 0.32, 0.58][i] || 0 };
  });
  function noise(table, t) {
    var i = Math.floor(t), u = t - i, s = u * u * (3 - 2 * u);
    return table[i & 63] * (1 - s) + table[(i + 1) & 63] * s;
  }
  function paint(l, level) {
    l.fire.style.opacity = (0.06 + 0.94 * Math.min(1, level)).toFixed(3);
    l.halo.style.opacity = Math.max(0, level).toFixed(3);
    l.pool.style.opacity = (0.85 * Math.max(0, level)).toFixed(3);
  }
  lanterns.forEach(function (l) { paint(l, 0); });

  var running = false, inView = false, raf = 0, painted = 0;
  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    // Candlelight reads naturally at 30 fps.
    if (now - painted < 32) return;
    painted = now;
    var t = now / 1000;
    lanterns.forEach(function (l) {
      if (l.lit < 0) l.lit = t + l.delay;
      var age = t - l.lit;
      if (age < 0) return;
      var flame = 0.78 + 0.16 * noise(l.table, t * 3.1) + 0.1 * noise(l.table, t * 9.7 + 17) - 0.08;
      // Strike: a quick flare that settles into the steady flame.
      var strike = age < 0.9 ? Math.min(1, age / 0.18) * (1 + 0.35 * Math.max(0, 1 - age / 0.9)) : 1;
      paint(l, flame * strike);
    });
  }
  function sync() {
    var on = season.isActive() && inView && !document.hidden;
    if (on && reduced.matches) { lanterns.forEach(function (l) { paint(l, 0.92); }); return; }
    if (on && !running) { running = true; raf = window.requestAnimationFrame(frame); }
    else if (!on && running) { running = false; window.cancelAnimationFrame(raf); }
  }
  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    ground.classList.toggle('is-idle', !inView);
    sync();
  }, { rootMargin: '0px 0px -40px 0px' }).observe(ground);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('academic-season-change', sync);
})();
