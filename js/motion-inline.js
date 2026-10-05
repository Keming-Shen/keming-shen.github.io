(function () {
  'use strict';

  var key = '__motionMeshPlayers';
  if (window[key]) { window[key].init(); return; }
  var script = document.currentScript;
  var moduleUrl = new URL('vendor/three-r160.module.js', script && script.src ? script.src : new URL('/js/motion-inline.js', window.location.href)).href;
  var instances = new Map(), modulePromise = null;
  var littleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

  function three() {
    if (!modulePromise) modulePromise = import(moduleUrl).catch(function (error) { modulePromise = null; throw error; });
    return modulePromise;
  }
  function uint16(buffer) {
    if (littleEndian) return new Uint16Array(buffer);
    var result = new Uint16Array(buffer.byteLength / 2), view = new DataView(buffer);
    for (var i = 0; i < result.length; i++) result[i] = view.getUint16(i * 2, true);
    return result;
  }
  function triplet(value) {
    return Array.isArray(value) && value.length === 3 && value.every(function (n) { return typeof n === 'number' && Number.isFinite(n); });
  }
  function validate(m) {
    if (!m || typeof m !== 'object') throw new Error('网格清单格式不正确');
    ['frames', 'vertices', 'faces'].forEach(function (name) {
      if (!Number.isSafeInteger(m[name]) || m[name] < 1) throw new Error('网格清单的 ' + name + ' 不正确');
    });
    if (m.vertices < 3 || m.vertices > 65536 || m.frames > 10000 || m.faces > 1000000) throw new Error('网格规模超出播放器支持范围');
    if (!Number.isFinite(m.fps) || m.fps <= 0 || m.fps > 240) throw new Error('帧率不正确');
    if (!triplet(m.min) || !triplet(m.scale) || m.scale.some(function (n) { return n < 0; })) throw new Error('顶点解码参数不正确');
    if (typeof m.positions !== 'string' || !m.positions || typeof m.triangles !== 'string' || !m.triangles) throw new Error('网格文件地址缺失');
    if (m.frames * m.vertices * 6 > 384 * 1024 * 1024) throw new Error('网格片段过大');
    if (m.roots != null && (!Array.isArray(m.roots) || m.roots.length !== m.frames || !m.roots.every(triplet))) throw new Error('根轨迹与网格帧数不一致');
    return m;
  }
  function fetchOk(url, signal) {
    return fetch(url, { signal: signal, credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) throw new Error('文件请求失败（' + response.status + '）');
      return response;
    });
  }

  function mount(root) {
    var canvas = root.querySelector('canvas'), frame = root.querySelector('[data-motion="frame"]');
    var view = root.querySelector('[data-motion="view"]'), move = root.querySelector('[data-motion="root"]');
    var play = root.querySelector('[data-motion="play"]'), output = root.querySelector('output');
    if (!canvas || !frame || !view || !move || !play || !output) return null;
    var poster = root.querySelector('.motion-poster'), stage = root.querySelector('.motion-stage');
    if (!stage) {
      stage = document.createElement('div'); stage.className = 'motion-stage';
      canvas.parentNode.insertBefore(stage, canvas); stage.appendChild(canvas);
    }
    if (poster && poster.parentNode !== stage) stage.appendChild(poster);

    var disposed = false, loading = false, loadPromise = null, abort = null;
    var THREE = null, manifest = null, packed = null, renderer = null, scene = null, camera = null;
    var geometry = null, mesh = null, trajectory = null, bounds = null, index = 0;
    var playing = false, raf = null, playOrigin = 0, yaw = Math.PI / 4, pitch = 0.16;
    var drag = null, resizeObserver = null, listeners = [], defaultRootChecked = move.checked;
    root.dataset.mounted = 'true'; root.dataset.motionState = 'idle'; root.setAttribute('aria-busy', 'false');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '三维人体网格。拖动旋转视角；空格播放或暂停，左右箭头逐帧，Home 复位。');
    frame.disabled = true; frame.min = '0'; frame.max = '0'; frame.step = '1'; frame.value = '0';
    play.disabled = false; play.textContent = '加载并播放'; play.setAttribute('aria-pressed', 'false');
    output.setAttribute('aria-live', 'polite');
    output.textContent = '点击播放后加载真实人体网格；可先查看静态预览。';

    function on(target, name, handler, options) {
      target.addEventListener(name, handler, options);
      listeners.push(function () { target.removeEventListener(name, handler, options); });
    }
    function setState(state) {
      root.dataset.motionState = state; root.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
      play.disabled = state === 'loading';
    }
    function readout() {
      if (!manifest) return;
      var text = '帧 ' + index + ' / ' + (manifest.frames - 1) + ' · ' + (index / manifest.fps).toFixed(2) + ' / ' + ((manifest.frames - 1) / manifest.fps).toFixed(2) + ' 秒 · ' + manifest.fps + ' fps';
      if (manifest.roots) {
        var r = manifest.roots[index], r0 = manifest.roots[0];
        text += ' · 根坐标 (' + (move.checked ? r[0] : r0[0]).toFixed(2) + ', ' + r[1].toFixed(2) + ', ' + (move.checked ? r[2] : r0[2]).toFixed(2) + ') 米';
      } else text += ' · 资产未提供根轨迹，仅显示整体移动';
      output.textContent = text; frame.value = String(index);
      frame.setAttribute('aria-valuetext', '第 ' + index + ' 帧，' + (index / manifest.fps).toFixed(2) + ' 秒');
    }
    function stop() {
      playing = false; if (raf !== null) cancelAnimationFrame(raf); raf = null;
      play.textContent = manifest ? '播放' : root.dataset.motionState === 'error' ? '重试加载' : '加载并播放';
      play.setAttribute('aria-pressed', 'false'); output.setAttribute('aria-live', 'polite');
    }
    function releaseGraphics() {
      stop();
      if (scene) {
        scene.traverse(function (object) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(function (material) { material.dispose(); });
          if (object.shadow && object.shadow.map) object.shadow.map.dispose();
        });
        scene.clear();
      }
      if (renderer) { renderer.dispose(); if (!root.isConnected) renderer.forceContextLoss(); }
      renderer = scene = camera = geometry = mesh = trajectory = bounds = null;
    }
    function fail(error) {
      if (disposed) return;
      releaseGraphics(); manifest = packed = null; frame.disabled = true;
      move.disabled = false; move.checked = defaultRootChecked; setState('error'); play.textContent = '重试加载';
      output.textContent = '网格加载未完成：' + (error && error.message ? error.message : '未知错误') + '。静态预览仍可查看，点击重试。';
    }
    function fitCamera() {
      if (!renderer || !camera || !bounds) return;
      var box = (move.checked ? bounds.world : bounds.stationary).clone(); box.expandByScalar(0.09);
      var center = box.getCenter(new THREE.Vector3());
      var direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      var right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), up = new THREE.Vector3().crossVectors(direction, right);
      var tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
      var distance = 0, corner = new THREE.Vector3();
      for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) for (var c = 0; c < 2; c++) {
        corner.set(a ? box.max.x : box.min.x, b ? box.max.y : box.min.y, c ? box.max.z : box.min.z).sub(center);
        var z = corner.dot(direction);
        distance = Math.max(distance, Math.abs(corner.dot(right)) / tanH + z, Math.abs(corner.dot(up)) / tanV + z);
      }
      distance = Math.max(0.7, distance * 1.09);
      camera.position.copy(center).addScaledVector(direction, distance); camera.near = 0.01;
      camera.far = Math.max(100, distance + box.getSize(new THREE.Vector3()).length() * 4);
      camera.lookAt(center); camera.updateProjectionMatrix();
    }
    function resize() {
      if (!renderer || disposed) return;
      var width = Math.max(1, stage.clientWidth), height = Math.max(1, stage.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(width, height, false);
      camera.aspect = width / height; fitCamera(); renderer.render(scene, camera);
    }
    function applyView() {
      yaw = view.value === 'front' ? 0 : view.value === 'side' ? Math.PI / 2 : Math.PI / 4;
      pitch = view.value === 'oblique' ? 0.16 : 0.04;
      fitCamera(); if (renderer) renderer.render(scene, camera);
    }
    function draw(normals) {
      if (!manifest || !geometry || disposed) return;
      var positions = geometry.attributes.position.array, start = index * manifest.vertices * 3, shiftX = 0, shiftZ = 0;
      if (!move.checked && manifest.roots) {
        shiftX = manifest.roots[index][0] - manifest.roots[0][0]; shiftZ = manifest.roots[index][2] - manifest.roots[0][2];
      }
      for (var i = 0; i < positions.length; i += 3) {
        positions[i] = manifest.min[0] + packed[start + i] * manifest.scale[0] - shiftX;
        positions[i + 1] = manifest.min[1] + packed[start + i + 1] * manifest.scale[1];
        positions[i + 2] = manifest.min[2] + packed[start + i + 2] * manifest.scale[2] - shiftZ;
      }
      geometry.attributes.position.needsUpdate = true;
      if (normals !== false) geometry.computeVertexNormals();
      if (trajectory) trajectory.visible = move.checked;
      renderer.render(scene, camera); readout();
    }
    function animate(now) {
      if (!playing || disposed) return;
      // The first RAF timestamp can precede a start() call within the same paint.
      var elapsed = Math.max(0, now - playOrigin);
      var next = Math.floor(elapsed * manifest.fps / 1000) % manifest.frames;
      if (next !== index) { index = next; draw(); }
      raf = requestAnimationFrame(animate);
    }
    function start() {
      if (!manifest || disposed || document.hidden) return;
      playing = true; play.textContent = '暂停'; play.setAttribute('aria-pressed', 'true'); output.setAttribute('aria-live', 'off');
      playOrigin = performance.now() - index * 1000 / manifest.fps; raf = requestAnimationFrame(animate);
    }
    function createScene(indices) {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      scene = new THREE.Scene(); scene.background = new THREE.Color(0xf2f4f6); camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(manifest.vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xc9a257, metalness: 0.22, roughness: 0.55, side: THREE.DoubleSide }));
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
      var worldSize = bounds.world.getSize(new THREE.Vector3()), center = bounds.world.getCenter(new THREE.Vector3());
      var floorY = Math.min(0, bounds.world.min.y) - 0.012, floorSize = Math.max(20, worldSize.x * 3, worldSize.z * 3);
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(floorSize, floorSize), new THREE.MeshStandardMaterial({ color: 0xe6e9ed, roughness: 1, metalness: 0 }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(center.x, floorY, center.z); floor.receiveShadow = true; scene.add(floor);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x7c8998, 2.2));
      var light = new THREE.DirectionalLight(0xfff4df, 2.6), span = Math.max(2.2, worldSize.x * 0.65, worldSize.z * 0.65, worldSize.y);
      light.position.set(center.x + span, bounds.world.max.y + span * 2, center.z + span * 1.5); light.target.position.copy(center); light.castShadow = true;
      light.shadow.mapSize.set(2048, 2048); light.shadow.camera.left = -span * 1.6; light.shadow.camera.right = span * 1.6;
      light.shadow.camera.top = span * 1.6; light.shadow.camera.bottom = -span * 1.6; light.shadow.camera.near = 0.1; light.shadow.camera.far = span * 8;
      light.shadow.normalBias = 0.018; light.shadow.bias = -0.0002; scene.add(light, light.target);
      var fill = new THREE.DirectionalLight(0xd5e4ff, 0.8); fill.position.set(center.x - 3, center.y + 2, center.z - 4); scene.add(fill);
      if (manifest.roots && manifest.frames > 1) {
        var linePositions = new Float32Array(manifest.frames * 3);
        manifest.roots.forEach(function (r, t) { linePositions[t * 3] = r[0]; linePositions[t * 3 + 1] = floorY + 0.007; linePositions[t * 3 + 2] = r[2]; });
        var lineGeometry = new THREE.BufferGeometry(); lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        trajectory = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0x869daf, transparent: true, opacity: 0.5 })); scene.add(trajectory);
      }
      applyView(); resize(); draw();
    }
    async function calculateBounds() {
      var world = new THREE.Box3(), stationary = new THREE.Box3(), point = new THREE.Vector3();
      for (var t = 0; t < manifest.frames; t++) {
        if (disposed || abort.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        var dx = manifest.roots ? manifest.roots[t][0] - manifest.roots[0][0] : 0, dz = manifest.roots ? manifest.roots[t][2] - manifest.roots[0][2] : 0;
        var begin = t * manifest.vertices * 3, end = begin + manifest.vertices * 3;
        for (var i = begin; i < end; i += 3) {
          point.set(manifest.min[0] + packed[i] * manifest.scale[0], manifest.min[1] + packed[i + 1] * manifest.scale[1], manifest.min[2] + packed[i + 2] * manifest.scale[2]);
          world.expandByPoint(point); point.x -= dx; point.z -= dz; stationary.expandByPoint(point);
        }
        if (t % 8 === 7) await new Promise(function (resolve) { setTimeout(resolve, 0); });
      }
      return { world: world, stationary: stationary };
    }
    function load() {
      if (manifest && renderer) return Promise.resolve(true);
      if (loadPromise) return loadPromise;
      loading = true; abort = new AbortController(); setState('loading'); play.textContent = '加载中…';
      output.textContent = '正在加载真实人体网格与本地渲染组件…';
      loadPromise = (async function () {
        try {
          var manifestUrl = new URL(root.dataset.manifest, window.location.href);
          var initial = await Promise.all([three(), fetchOk(manifestUrl.href, abort.signal).then(function (response) { return response.json(); })]);
          if (disposed) return false;
          THREE = initial[0]; manifest = validate(initial[1]);
          var positionsUrl = new URL(manifest.positions, manifestUrl), facesUrl = new URL(manifest.triangles, manifestUrl);
          if (!/^https?:$/.test(positionsUrl.protocol) || !/^https?:$/.test(facesUrl.protocol)) throw new Error('网格文件地址不正确');
          var files = await Promise.all([fetchOk(positionsUrl.href, abort.signal).then(function (response) { return response.arrayBuffer(); }), fetchOk(facesUrl.href, abort.signal).then(function (response) { return response.arrayBuffer(); })]);
          if (disposed) return false;
          if (files[0].byteLength !== manifest.frames * manifest.vertices * 6 || files[1].byteLength !== manifest.faces * 6) throw new Error('网格文件长度与清单不一致');
          packed = uint16(files[0]); var indices = uint16(files[1]);
          for (var i = 0; i < indices.length; i++) if (indices[i] >= manifest.vertices) throw new Error('三角面包含越界顶点');
          bounds = await calculateBounds(); if (disposed) return false; index = 0;
          if (!manifest.roots) { move.checked = true; move.disabled = true; }
          createScene(indices); frame.max = String(manifest.frames - 1); frame.disabled = false; setState('ready'); play.textContent = '播放'; readout();
          return true;
        } catch (error) { if (!disposed && error.name !== 'AbortError') fail(error); return false; }
        finally { loading = false; loadPromise = null; }
      }());
      return loadPromise;
    }
    async function command(action, direction) {
      if (disposed || loading) return;
      if (action === 'play' && playing) { stop(); readout(); return; }
      if (action === 'reset' && !manifest) { index = 0; frame.value = '0'; return; }
      if (action !== 'play') stop();
      if (!await load() || disposed) return;
      if (action === 'play') start();
      else if (action === 'step') { index = (index + (direction || 1) + manifest.frames) % manifest.frames; draw(); }
      else if (action === 'reset') { index = 0; draw(); }
    }
    on(root, 'click', function (event) {
      var target = event.target.closest('[data-motion]'); if (!target || !root.contains(target)) return;
      var action = target.dataset.motion;
      if (['play', 'step', 'reset', 'load', 'retry'].indexOf(action) >= 0) command(action === 'retry' ? 'load' : action);
    });
    on(frame, 'input', function () {
      if (!manifest) return; stop(); index = Math.max(0, Math.min(manifest.frames - 1, Math.round(Number(frame.value) || 0))); draw();
    });
    on(view, 'change', applyView); on(move, 'change', function () { fitCamera(); draw(false); });
    on(document, 'visibilitychange', function () { if (document.hidden) stop(); });
    on(canvas, 'keydown', function (event) {
      if (event.key === ' ' || event.code === 'Space') { event.preventDefault(); command('play'); }
      else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); command('step', event.key === 'ArrowRight' ? 1 : -1); }
      else if (event.key === 'Home') { event.preventDefault(); command('reset'); }
    });
    on(canvas, 'pointerdown', function (event) {
      if (!renderer || event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: yaw, pitch: pitch };
      canvas.setPointerCapture(event.pointerId); stage.classList.add('is-dragging');
    });
    on(canvas, 'pointermove', function (event) {
      if (!drag || drag.id !== event.pointerId || !renderer) return;
      yaw = drag.yaw - (event.clientX - drag.x) * 0.006; pitch = Math.max(-0.04, Math.min(0.7, drag.pitch + (event.clientY - drag.y) * 0.004));
      view.value = 'oblique'; fitCamera(); renderer.render(scene, camera);
    });
    function endDrag(event) {
      if (!drag || event.pointerId !== drag.id) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      drag = null; stage.classList.remove('is-dragging');
    }
    on(canvas, 'pointerup', endDrag); on(canvas, 'pointercancel', endDrag); on(canvas, 'lostpointercapture', endDrag);
    on(canvas, 'webglcontextlost', function (event) { event.preventDefault(); if (!disposed && renderer) fail(new Error('浏览器图形上下文已丢失')); });
    if (window.ResizeObserver) { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage); } else on(window, 'resize', resize);

    return function () {
      if (disposed) return; disposed = true; if (abort) abort.abort(); if (resizeObserver) resizeObserver.disconnect();
      listeners.forEach(function (remove) { remove(); }); listeners = []; releaseGraphics(); manifest = packed = THREE = null;
      root.dataset.motionState = 'idle'; root.setAttribute('aria-busy', 'false'); stage.classList.remove('is-dragging');
      frame.disabled = true; play.disabled = false; move.disabled = false; move.checked = defaultRootChecked; delete root.dataset.mounted;
    };
  }
  function dispose() { instances.forEach(function (cleanup) { cleanup(); }); instances.clear(); }
  function init() {
    instances.forEach(function (cleanup, root) { if (!root.isConnected) { cleanup(); instances.delete(root); } });
    document.querySelectorAll('.motion-inline[data-demo="mesh"][data-manifest]').forEach(function (root) {
      if (instances.has(root)) return; var cleanup = mount(root); if (cleanup) instances.set(root, cleanup);
    });
  }
  window[key] = { init: init, dispose: dispose };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
  document.addEventListener('pjax:complete', init); document.addEventListener('pjax:send', dispose); document.addEventListener('pjax:error', init);
  window.addEventListener('pagehide', dispose); window.addEventListener('pageshow', init);
}());
