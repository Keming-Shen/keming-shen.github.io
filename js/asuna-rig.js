/*!
 * Asuna companion: transparent, layered 2.5D WebGL animation.
 * Mesh/eye masking and spring mechanics adapted from Anime2.5DRig (MIT).
 * See vendor/asuna-rig/LICENSE.txt and NOTICE.txt.
 */
(() => {
  'use strict';
  const CYCLES = Object.freeze({
    origin: 13.8, hello: 11.6, welcome: 10.8, think: 12.6,
    sword: 11.2, cake: 12, clean: 10.6, hot: 12.8,
    letter: 12, yeah: 10, drink: 14, read: 16,
    tiring: 12, delight: 11, love: 12, shy: 13
  });
  const ACTIONS = new Set(Object.keys(CYCLES));
  const motionDurations = Object.freeze(Object.fromEntries(Object.entries(CYCLES).map(([name, period]) => [name, period * 2000])));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const cue = (t, start, end) => smooth((t - start) / 0.45) * (1 - smooth((t - end) / 0.7));
  const pulse = (t, center, radius) => Math.abs(t - center) < radius ? (1 + Math.cos(Math.PI * (t - center) / radius)) / 2 : 0;
  const baseName = n => n.replace(/_(l|r)$/, '').replace(/_\d+$/, '');

  function create(canvas, options = {}) {
    if (!window.RigRuntime || !window.RigRenderer) throw new Error('Rig dependencies are unavailable');
    const RT = window.RigRuntime;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!gl) throw new Error('WebGL is unavailable');
    const renderer = window.RigRenderer.create(gl);
    const assetRoot = new URL(options.assetRoot || '/image/asuna-rig/', location.href);
    const assetURL = (name, base) => {
      const url = new URL(name, base);
      if (options.assetVersion) url.searchParams.set('v', String(options.assetVersion));
      return url;
    };
    const events = new AbortController(), cache = new Map(), pending = new Map();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false, paused = true, contextLost = false, loadId = 0, gpuEpoch = 0;
    let frameCost = 0, targetFPS = 60;
    let active = null, action = 'origin', started = 0, clock = 0, last = 0, raf = 0, frames = 0;
    let gaze = { x: 0, y: 0 }, current = {}, lastParameters = {}, nextBlink = 2.4, blinkStart = -1;
    let hasDrawn = false, tapActive = false, nextEffect = 0;

    async function prepare(model, images, signal) {
      const layers = [], W = model.canvas.w, epoch = gpuEpoch;
      let yieldedAt = performance.now();
      try {
        for (let index = 0; index < model.layers.length; index++) {
          if (disposed || signal?.aborted || epoch !== gpuEpoch) throw new DOMException('Aborted', 'AbortError');
          const rec = model.layers[index];
          const L = { ...rec, bn: baseName(rec.name), visible: true };
          const { nx, ny } = RT.meshSize(L.w, L.h, (L.phys ? 28 : 40) * Math.max(0.6, W / 768));
          const vertices = (nx + 1) * (ny + 1);
          const base = new Float32Array(vertices * 2), uv = new Float32Array(vertices * 2);
          let at = 0;
          for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) {
            base[at] = L.x + L.w * x / nx; base[at + 1] = L.y + L.h * y / ny;
            uv[at] = x / nx; uv[at + 1] = y / ny; at += 2;
          }
          const indices = new Uint16Array(nx * ny * 6); at = 0;
          for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
            const a = y * (nx + 1) + x, b = a + 1, c = a + nx + 1, d = c + 1;
            indices.set([a, b, c, b, d, c], at); at += 6;
          }
          L.base = base; L.cur = new Float32Array(base);
          const strands = L.strands || [], count = strands.length;
          if (count) {
            L.weights = new Float32Array(vertices * count); L.tipWeight = new Float32Array(vertices);
            L.springs = strands.map((s, i) => ({
              stiff: { x: 0, v: 0 }, soft: { x: 0, v: 0 }, breeze: { x: 0, v: 0 },
              phase: i * 0.52 + (L.bn === 'front hair' ? 0.65 : 0),
              length: clamp((s.tipY - s.rootY) / model.canvas.h, 0.12, 1)
            }));
            const spacing = count > 1 ? Math.max(28, (strands[count - 1].x - strands[0].x) / (count - 1)) : 120;
            for (let v = 0; v < vertices; v++) {
              let total = 0, rootY = 0, tipY = 0;
              for (let s = 0; s < count; s++) {
                const weight = Math.exp(-Math.pow((base[v * 2] - strands[s].x) / (spacing * 0.6), 2));
                L.weights[v * count + s] = weight; total += weight;
              }
              if (total < 1e-7) { L.weights[v * count] = 1; total = 1; }
              for (let s = 0; s < count; s++) {
                const weight = L.weights[v * count + s] /= total;
                rootY += weight * strands[s].rootY; tipY += weight * strands[s].tipY;
              }
              L.tipWeight[v] = clamp((base[v * 2 + 1] - rootY) / Math.max(1, tipY - rootY), 0, 1);
            }
          }
          // These weights depend only on the original geometry, not the frame.
          const A = model.anchors, FS = A.faceScale || 1;
          L.field = new Float64Array(vertices * 5);
          for (let v = 0; v < vertices; v++) {
            const y = base[v * 2 + 1], at = v * 5;
            L.field[at] = smooth((A.neckBottom + 24 * FS - y) / Math.max(1, A.neckBottom - A.neckTop + 24 * FS));
            const faceDepth = smooth((A.neckTop + 30 * FS - y) / Math.max(1, 110 * FS));
            L.field[at + 1] = L.group === 'body' || L.contact ? 1 : 1 + (L.depth - 1) * faceDepth;
            L.field[at + 2] = smooth((A.bodyPivot.cy - y) / (model.canvas.h * .24));
            L.field[at + 3] = smooth((y - A.neckBottom + 60 * FS) / (180 * FS)) * L.field[at + 2];
            L.field[at + 4] = L.tipWeight ? Math.pow(L.tipWeight[v], L.bn === 'front hair' ? 1.8 : 1.6) : 0;
          }
          layers.push(L);
          renderer.upload(L, { positions: L.cur, uvs: uv, indices, image: images[index] });
          // Keep the current pose animating while preparing its successor.
          if (performance.now() - yieldedAt >= 4) {
            await new Promise(resolve => setTimeout(resolve, 0));
            yieldedAt = performance.now();
          }
        }
        if (disposed || signal?.aborted || epoch !== gpuEpoch) throw new DOMException('Aborted', 'AbortError');
        renderer.check();
      } catch (error) { layers.forEach(renderer.dispose); throw error; }
      const hand = layers.find(L => L.wave);
      return { model, images, layers, wave: hand ? { ...hand.wave, left: hand.x, right: hand.x + hand.w } : null, lastUsed: performance.now() };
    }

    function validate(model) {
      if (model?.format !== 'asuna-rig-v1' || !Array.isArray(model.layers) || !model.layers.length || model.layers.length > 100) throw new Error('Invalid rig model');
      if (!model.anchors?.face || !model.anchors?.neckPivot || !model.anchors?.bodyPivot) throw new Error('Missing rig anchors');
      for (const key of ['w', 'h']) if (!(model.canvas[key] > 0 && model.canvas[key] <= 4096)) throw new Error('Invalid rig size');
      for (const L of model.layers) {
        if (!/^part-\d+\.webp$/.test(L.texture)) throw new Error('Invalid rig texture');
        for (const key of ['x', 'y', 'w', 'h', 'depth', 'opacity']) if (!Number.isFinite(L[key])) throw new Error('Invalid rig geometry');
      }
      return model;
    }

    async function decodeBlob(blob, signal) {
      const objectURL = URL.createObjectURL(blob);
      try {
        const img = new Image(); img.decoding = 'async'; img.src = objectURL;
        await img.decode();
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        return img;
      } finally { URL.revokeObjectURL(objectURL); }
    }
    async function decodeTexture(url, signal) {
      const response = await fetch(url, { signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Rig texture: HTTP ${response.status}`);
      return decodeBlob(await response.blob(), signal);
    }
    async function loadImages(model, baseURL, signal) {
      const bundle = model.textureBundle;
      if (bundle && options.useTextureBundle !== false) {
        if (bundle.file !== 'textures.bin' || !Number.isInteger(bundle.byteLength) || bundle.byteLength < 1 || bundle.byteLength > 16 * 1024 * 1024 || !Array.isArray(bundle.entries) || bundle.entries.length !== model.layers.length) throw new Error('Invalid texture bundle');
        const response = await fetch(assetURL(bundle.file, baseURL), { signal, credentials: 'same-origin' });
        // Old mirrors can still use the individual layers if the bundle is absent.
        if (response.ok) {
          const bytes = await response.arrayBuffer();
          if (bytes.byteLength !== bundle.byteLength) throw new Error('Incomplete texture bundle');
          const images = new Array(model.layers.length);
          for (let i = 0; i < images.length; i += 4) {
            await Promise.all(bundle.entries.slice(i, i + 4).map(async (entry, j) => {
              const {offset, length} = entry;
              if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 1 || offset + length > bytes.byteLength) throw new Error('Invalid texture offset');
              images[i + j] = await decodeBlob(new Blob([new Uint8Array(bytes, offset, length)], {type: 'image/webp'}), signal);
            }));
          }
          return images;
        }
        if (response.status !== 404) throw new Error(`Rig bundle: HTTP ${response.status}`);
      }
      const images = new Array(model.layers.length); let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(6, images.length) }, async () => {
        while (cursor < images.length) {
          const i = cursor++; images[i] = await decodeTexture(assetURL(model.layers[i].texture, baseURL), signal);
        }
      }));
      return images;
    }
    function trimCache(keep) {
      // Pin idle and retain only the current and next gesture beside it.
      while (cache.size > 3) {
        const oldest = [...cache].filter(([key, value]) => key !== 'origin' && key !== keep && value !== active).sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
        if (!oldest) break;
        oldest[1].layers.forEach(renderer.dispose); cache.delete(oldest[0]);
      }
    }
    function getRig(nextAction) {
      if (cache.has(nextAction)) return Promise.resolve(cache.get(nextAction));
      if (pending.has(nextAction)) return pending.get(nextAction).promise;
      const job = {controller: new AbortController()};
      const signal = job.controller.signal;
      job.promise = (async () => {
        const baseURL = new URL(`${nextAction}/`, assetRoot);
        const response = await fetch(assetURL('model.json', baseURL), { signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error(`Rig model: HTTP ${response.status}`);
        const model = validate(await response.json());
        const images = await loadImages(model, baseURL, signal);
        if (disposed || contextLost || signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const rig = await prepare(model, images, signal);
        cache.set(nextAction, rig); trimCache(nextAction);
        return rig;
      })().finally(() => { if (pending.get(nextAction) === job) pending.delete(nextAction); });
      pending.set(nextAction, job);
      return job.promise;
    }
    async function prefetch(nextAction) {
      if (disposed || contextLost || !ACTIONS.has(nextAction)) return false;
      try { await getRig(nextAction); return true; } catch (_) { return false; }
    }
    async function load(nextAction = 'origin') {
      if (disposed) throw new Error('Rig is disposed');
      if (contextLost) throw new Error('WebGL context is temporarily unavailable');
      if (!ACTIONS.has(nextAction)) throw new Error('Unknown rig action');
      const ticket = ++loadId;
      for (const [key, job] of pending) if (key !== nextAction) { job.controller.abort(); pending.delete(key); }
      let rig;
      try { rig = await getRig(nextAction); }
      catch (error) { if (disposed || ticket !== loadId || error.name === 'AbortError') return false; throw error; }
      if (disposed || ticket !== loadId || contextLost) return false;
      active = rig; action = nextAction; rig.lastUsed = performance.now();
      current = {}; nextBlink = clock + 2 + Math.random() * 2; blinkStart = -1;
      started = clock; hasDrawn = false; tapActive = false; nextEffect = clock + 0.8;
      trimCache(nextAction);
      draw(parameters(0), 0); schedule();
      return true;
    }

    function parameters(dt) {
      const t = clock, age = Math.max(0, clock - started);
      const still = motion.matches;
      const e = {
        // Persistent idle channels remain active between gestures and after
        // their first cycle. Body and head lead/lag one another instead of
        // moving the entire drawing as one flat, rigid oscillation.
        angleX: still ? 0 : Math.sin(t * 0.65) * 0.24 + gaze.x * 0.38,
        angleY: still ? 0 : Math.sin(t * 0.58 + 1.2) * 0.13 - gaze.y * 0.17,
        angleZ: still ? 0 : Math.sin(t * 0.73 + 0.6) * 0.23,
        body: still ? 0 : Math.sin(t * 0.86) * 0.36 + Math.sin(t * 0.37 + 1.1) * 0.11,
        eyeX: still ? 0 : gaze.x * 0.65, eyeY: still ? 0 : gaze.y * 0.34,
        eyeOpenL: 1, eyeOpenR: 1, brow: 0, arm: 0,
        breath: still ? 0 : Math.sin(t * Math.PI * 2 / 3.8),
        breathHead: still ? 0 : Math.sin(t * Math.PI * 2 / 3.8 - 0.4),
        mouth: 1, hair: 1.18, tap: 0
      };
      if (!still) {
        const enter = smooth(age / 0.65);
        if (action === 'origin') {
          const look = cue(age % 13.8, 5.4, 8.8);
          e.angleX += Math.sin(age * 0.9) * 0.13 * look;
          e.angleY += 0.16 * look; e.brow += 0.045 * look;
        }
        if (action === 'hello') {
          const cycle = age % 11.6, wave = cue(cycle, 0.15, 2.6);
          const tap = pulse(cycle, 3.65, 0.22) + pulse(cycle, 4.16, 0.22);
          e.angleZ += Math.sin(age * 2.6) * 0.18 * wave;
          e.arm = (Math.sin(age * 6.0) * 0.32 * wave + 0.28 * tap) * enter;
          e.body += 0.16 * cue(cycle, 2.8, 4.4);
          e.angleY += 0.14 * cue(cycle, 2.8, 4.5);
          e.brow = 0.12 * cue(cycle, 0.1, 4.6); e.tap = tap * enter;
        }
        if (action === 'welcome') {
          const greet = cue(age % 10.8, 0.4, 5.3);
          e.angleY += Math.sin(age * 1.8) * 0.22 * greet;
          e.body += Math.sin(age * 1.2) * 0.17 * greet;
          e.arm = Math.sin(age * 2.3) * 0.10 * enter; e.brow = 0.08 * greet;
        }
        if (action === 'think') {
          const ponder = cue(age % 12.6, 0.4, 6.6);
          e.angleZ -= 0.26 * ponder; e.angleY += Math.sin(age * 1.7) * 0.09 * ponder;
          e.eyeX -= 0.27 * ponder; e.eyeY -= 0.18 * ponder;
          e.body += Math.sin(age * 0.7) * 0.10 * enter;
        }
        if (action === 'sword') {
          const ready = cue(age % 11.2, 0.4, 6.0);
          e.body += Math.sin(age * 1.4) * 0.18 * ready;
          e.angleX -= 0.20 * ready; e.angleY -= 0.11 * ready; e.hair = 1.3;
        }
        if (action === 'cake') {
          const offer = cue(age % 12.0, 0.4, 6.8);
          e.angleY += Math.sin(age * 1.45) * 0.16 * offer;
          e.angleZ += Math.sin(age * 0.8) * 0.11 * offer;
          e.brow = 0.08 * offer;
          // The palms, plate and cake travel with the same body transform;
          // an independent hand oscillation would break the carrying contact.
          e.arm = 0; e.body += Math.sin(age * 0.9) * 0.10 * offer;
        }
        if (action === 'clean') {
          const polish = cue(age % 10.6, 0.3, 6.6);
          e.angleY -= 0.23 * polish; e.eyeY += 0.20 * polish;
          e.arm = Math.sin(age * 3.6) * 0.13 * polish;
          e.body += Math.sin(age * 1.8) * 0.13 * polish;
        }
        if (action === 'hot') {
          const shy = cue(age % 12.8, 0.4, 7.0);
          e.angleZ += 0.28 * shy; e.eyeX -= 0.20 * shy;
          e.brow = -0.07 * shy; e.body += Math.sin(age * 0.8) * 0.11 * shy;
        }
        if (action === 'letter') {
          const offer = cue(age % CYCLES.letter, 0.5, 6.8);
          e.angleY += Math.sin(age * 1.2) * 0.17 * offer;
          e.angleZ -= 0.18 * offer; e.brow += 0.06 * offer;
          e.body += Math.sin(age * 0.9) * 0.13 * offer;
        }
        if (action === 'yeah') {
          const cheer = cue(age % CYCLES.yeah, 0.3, 5.8);
          e.angleZ += Math.sin(age * 1.8) * 0.21 * cheer;
          e.body += Math.sin(age * 1.8) * 0.18 * cheer;
          e.breath += Math.sin(age * 2.2) * 0.35 * cheer;
          e.brow += 0.10 * cheer;
        }
        if (action === 'drink') {
          const sip = cue(age % CYCLES.drink, 2.0, 6.7);
          e.angleY -= 0.10 * sip; e.eyeY += 0.12 * sip;
          e.angleX *= 0.65; e.angleZ *= 0.65;
          e.body *= 0.82;
        }
        if (action === 'read') {
          const scan = cue(age % CYCLES.read, 0.5, 12.8);
          e.eyeX = e.eyeX * 0.35 + Math.sin(age * 0.95) * 0.24 * scan;
          e.eyeY += 0.18 * scan; e.angleY -= 0.10 * scan;
          e.angleX *= 0.7; e.angleZ *= 0.72; e.body *= 0.85;
        }
        if (action === 'tiring') {
          const yawn = cue(age % CYCLES.tiring, 1.0, 6.0);
          e.angleY += Math.sin(age * 0.9) * 0.13 * yawn;
          e.angleZ -= 0.20 * yawn;
          e.breath += Math.sin(age * 1.2) * 0.35 * yawn;
          e.body *= 0.85;
        }
        if (action === 'delight') {
          const cheer = cue(age % CYCLES.delight, 0.2, 6.5);
          e.angleZ += Math.sin(age * 1.7) * 0.21 * cheer;
          e.body += Math.sin(age * 1.9) * 0.15 * cheer;
          e.breath += Math.sin(age * 2.8) * 0.50 * cheer;
          e.arm = Math.sin(age * 2.8) * 0.10 * cheer;
          e.brow += 0.11 * cheer;
        }
        if (action === 'love') {
          const heart = cue(age % CYCLES.love, 0.4, 7.2);
          e.angleZ += Math.sin(age * 0.75) * 0.22 * heart;
          e.angleY += Math.sin(age * 1.2) * 0.10 * heart;
          e.brow += 0.05 * heart; e.body += Math.sin(age * 0.8) * 0.10 * heart;
        }
        if (action === 'shy') {
          const coy = cue(age % CYCLES.shy, 0.6, 7.4);
          e.angleZ -= 0.25 * coy; e.angleY -= 0.10 * coy;
          e.eyeX -= 0.20 * coy; e.brow -= 0.05 * coy;
          e.body += Math.sin(age * 0.75) * 0.10 * coy;
        }
        // These drawings place a hand beside the chin/neck. A quieter head
        // channel preserves that contact rather than separating the two parts.
        if (['think', 'hot', 'shy', 'tiring'].includes(action)) {
          e.angleX *= 0.55; e.angleY *= 0.55; e.angleZ *= 0.55;
        }
        e.body = clamp(e.body, -0.62, 0.62);
        if (t >= nextBlink && blinkStart < 0) { blinkStart = t; nextBlink = t + 2.5 + Math.random() * 3.5; }
        if (blinkStart >= 0) {
          const elapsed = t - blinkStart;
          const open = elapsed < 0.07 ? 1 - elapsed / 0.07 : elapsed < 0.115 ? 0 : (elapsed - 0.115) / 0.14;
          e.eyeOpenL = e.eyeOpenR = clamp(open, 0, 1);
          if (elapsed > 0.255) blinkStart = -1;
        }
      }
      const blend = dt ? 1 - Math.exp(-dt * 12) : 1;
      for (const key of Object.keys(e)) {
        if (key === 'eyeOpenL' || key === 'eyeOpenR') current[key] = e[key];
        else current[key] = current[key] == null ? e[key] : current[key] + (e[key] - current[key]) * blend;
      }
      lastParameters = { ...current }; return lastParameters;
    }

    function deform(L, e, dt) {
      const A = active.model.anchors, NP = A.neckPivot, BP = A.bodyPivot, F = A.face;
      const FS = A.faceScale || 1, bn = L.bn, EA = L.side ? A[`eye${L.side}`] : null;
      const az = e.angleZ * 0.07, cz = Math.cos(az), sz = Math.sin(az);
      const ab = e.body * 0.042, cb = Math.cos(ab), sb = Math.sin(ab);
      const eyeOpen = L.side === 'L' ? e.eyeOpenL : e.eyeOpenR;
      if (L.springs) {
        const target = (e.angleX * 14 + e.angleZ * 0.07 * (NP.cy - F.cy) + e.body * 20) * FS;
        for (const sp of L.springs) {
          if (motion.matches) {
            for (const state of [sp.stiff, sp.soft, sp.breeze]) state.x = state.v = 0;
            sp.dx = sp.softDx = sp.wind = 0;
            continue;
          }
          // Neighbouring locks share the same breeze with a small phase lag.
          // Longer locks react more slowly; roots remain pinned in the mesh.
          const wind = (Math.sin(clock * 0.92 + sp.phase) * 9 + Math.sin(clock * 0.41 + sp.phase * 0.45) * 4) * FS;
          RT.spring(sp.stiff, target, 62, 10, dt);
          RT.spring(sp.soft, target, 18, 5.7, dt);
          RT.spring(sp.breeze, wind, 13 - sp.length * 5, 4.4, dt);
          sp.dx = -(sp.stiff.x - target) * 1.5;
          sp.softDx = -(sp.soft.x - target) * 1.9;
          sp.wind = sp.breeze.x;
        }
      }
      for (let i = 0; i < L.base.length; i += 2) {
        let x = L.base[i], y = L.base[i + 1];
        const wave = active.wave;
        if (wave && action === 'hello' && (L.group === 'body' || L.contact)) {
          // The raised forearm folds back toward the shoulder: a y-only
          // wrist mask also caught the sleeve's shoulder attachment. Bound
          // the free-hand region and pin its inner/lower corner. Every body
          // surface (including original-art seam patches) shares this field.
          const lateral = smooth((x - wave.left + 10 * FS) / (20 * FS)) * (1 - smooth((x - wave.right + 5 * FS) / (20 * FS)));
          const shoulder = smooth((y - wave.y + wave.falloff * 2.7) / (wave.falloff * 1.7)) * smooth((x - wave.x - 10 * FS) / (25 * FS));
          const weight = smooth((wave.y - y) / wave.falloff + 0.5) * lateral * (1 - shoulder);
          const angle = e.arm * 0.48 * weight, c = Math.cos(angle), s = Math.sin(angle);
          const rx = x - wave.x, ry = y - wave.y;
          x = wave.x + rx * c - ry * s; y = wave.y + rx * s + ry * c;
        }
        if (EA && L.fade === 'eyeOpen') {
          if (bn === 'irides') {
            x += e.eyeX * 8 * FS; y += e.eyeY * 5 * FS;
            y = EA.closeY + (y - EA.closeY) * (1 - 0.8 * smooth((0.32 - eyeOpen) / 0.32));
          } else y = EA.closeY + (y - EA.closeY) * (1 - 0.86 * (1 - eyeOpen));
        }
        if (bn === 'eyebrow') y += (-e.brow * 6 + (1 - eyeOpen) * 1.3) * FS;
        // A single spatial field joins chin, exposed neck and high collar.
        // Part-specific weights previously pulled these adjoining surfaces
        // apart. Original-art contact patches use this same field as well.
        const originalY = L.base[i + 1];
        const at = i / 2 * 5;
        const headWeight = L.field ? L.field[at] : smooth((A.neckBottom + 24 * FS - originalY) / Math.max(1, A.neckBottom - A.neckTop + 24 * FS));
        const depth = L.field ? L.field[at + 1] : 1;
        if (headWeight) {
          const rx = x - NP.cx, ry = y - NP.cy;
          x += (rx * cz - ry * sz - rx) * headWeight;
          y += (rx * sz + ry * cz - ry) * headWeight;
          x += headWeight * FS * (e.angleX * (14 + 40 * (depth - 1)) + e.angleX * (NP.cy - originalY) * 0.028);
          y += headWeight * FS * (-e.angleY * (9 + 30 * (depth - 1)) - e.angleY * (depth - 1) * (originalY - F.cy) * 0.05);
        }
        const baseWeight = L.field ? L.field[at + 2] : smooth((BP.cy - L.base[i + 1]) / (active.model.canvas.h * 0.24));
        y -= (e.breath * (1 - headWeight) + e.breathHead * headWeight) * 3.4 * FS * baseWeight;
        // Keep contact-bearing arms, cups, swords and clothing on one field;
        // the subtle horizontal breath expansion fades below the collar.
        x = NP.cx + (x - NP.cx) * (1 + e.breath * 0.0028 * baseWeight * (1 - headWeight));
        if (action !== 'hello') {
          // Shoulder/sleeve seams and held objects must not inherit separate
          // offsets based on their cropped texture rectangles. Use one gentle
          // shoulder-and-arm pulse in model coordinates, fading at the neck
          // and fixed lower edge, for every overlapping surface.
          const armWeight = L.field ? L.field[at + 3] : smooth((originalY - A.neckBottom + 60 * FS) / (180 * FS)) * baseWeight;
          y -= e.arm * 14 * FS * armWeight;
        }
        if (L.springs) {
          const v = i / 2, count = L.springs.length;
          const tip = L.field[at + 4];
          let delta = 0;
          for (let s = 0; s < count; s++) delta += L.weights[v * count + s] * (L.springs[s].dx * 0.4 + L.springs[s].softDx * 0.6 + L.springs[s].wind);
          delta = clamp(delta, -25 * FS, 25 * FS) * tip * e.hair * (bn === 'front hair' ? 0.65 : 1);
          x += delta; y += Math.abs(delta) * 0.05 * baseWeight;
        }
        const rx = x - BP.cx, ry = y - BP.cy;
        // Taper body rotation to zero at the portrait's cut edge. Enlarged
        // idle sway must not make the bottom float above the viewport edge.
        L.cur[i] = x + (rx * cb - ry * sb - rx) * baseWeight;
        L.cur[i + 1] = y + (rx * sb + ry * cb - ry) * baseWeight;
      }
    }

    function draw(e, dt) {
      if (!active || contextLost || disposed) return;
      const model = active.model, bounds = model.bounds || { x: 0, y: 0, w: model.canvas.w, h: model.canvas.h };
      const width = Math.max(180, Math.min(640, Math.round((canvas.clientWidth || 220) * Math.min(devicePixelRatio || 1, 2))));
      const height = Math.round(width * 6 / 5);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const pad = Math.max(bounds.w, bounds.h) * 0.038;
      const scale = Math.min(width / (bounds.w + pad * 2), height / (bounds.h + pad * 2));
      const offsetX = (width - bounds.w * scale) / 2 - bounds.x * scale;
      // Anchor the cut edge of the portrait at the canvas bottom. Keep the
      // existing top/side allowance for hair motion, without a transparent footer.
      const offsetY = height - (bounds.y + bounds.h) * scale;
      const masks = [], items = [];
      let tapPoint = null;
      for (const L of active.layers) {
        let opacity = L.opacity;
        const open = L.side === 'L' ? e.eyeOpenL : e.eyeOpenR;
        if (L.fade === 'eyeOpen') opacity *= smooth((open - 0.22) / 0.15);
        if (L.fade === 'eyeClose') opacity *= 1 - smooth((open - 0.22) / 0.15);
        if (L.fade === 'eyeClose2' || L.fade === 'mouthClose') opacity = 0;
        const isMask = L.bn === 'eyewhite' && !!L.side;
        if (opacity < 0.004 && !isMask) continue;
        deform(L, e, dt);
        for (let i = 0; i < L.cur.length; i += 2) { L.cur[i] = L.cur[i] * scale + offsetX; L.cur[i + 1] = L.cur[i + 1] * scale + offsetY; }
        if (L.wave && action === 'hello') {
          const palmY = L.wave.y - L.wave.falloff * 2.2;
          let nearest = 0, distance = Infinity;
          for (let i = 0; i < L.base.length; i += 2) {
            const d = (L.base[i] - L.wave.x) ** 2 + (L.base[i + 1] - palmY) ** 2;
            if (d < distance) { distance = d; nearest = i; }
          }
          tapPoint = { x: clamp(L.cur[nearest] / width, 0, 1), y: clamp(L.cur[nearest + 1] / height, 0, 1) };
        }
        renderer.positions(L, L.cur);
        if (isMask) masks.push({ L, side: L.side });
        if (opacity >= 0.004) items.push({ L, alpha: opacity, clip: L.bn === 'irides' ? L.side : null });
      }
      renderer.draw({ width, height, background: [0, 0, 0, 0], masks, items });
      if (e.tap < 0.2 || action !== 'hello') tapActive = false;
      if (!paused && !motion.matches && !document.hidden && !tapActive && e.tap > 0.45 && tapPoint) {
        tapActive = true; options.onTap?.(tapPoint);
      }
      const effectType = action === 'drink' ? 'steam' : action === 'read' ? 'page' : null;
      const effect = effectType && model.anchors.effects?.[effectType];
      if (effect && !paused && !motion.matches && !document.hidden && clock >= nextEffect) {
        nextEffect = clock + (effectType === 'steam' ? 2.8 : 8);
        const angle = Number(effect.angle) || 0, c = Math.cos(angle), s = Math.sin(angle);
        const effectLayer = {
          bn: 'objects', group: 'body', depth: 1,
          base: new Float32Array([
            effect.x, effect.y,
            effect.x + effect.width * c, effect.y + effect.width * s,
            effect.x - effect.height * s, effect.y + effect.height * c
          ]), cur: new Float32Array(6)
        };
        deform(effectLayer, e, dt);
        const p = effectLayer.cur;
        options.onEffect?.({
          type: effectType,
          x: clamp((p[0] * scale + offsetX) / width, 0, 1),
          y: clamp((p[1] * scale + offsetY) / height, 0, 1),
          width: Math.hypot(p[2] - p[0], p[3] - p[1]) * scale / width,
          height: Math.hypot(p[4] - p[0], p[5] - p[1]) * scale / height,
          angle: Math.atan2(p[3] - p[1], p[2] - p[0])
        });
      }
      frames++; hasDrawn = true;
    }

    function schedule() {
      if (!raf && !disposed && !paused && !contextLost && active && !document.hidden && !motion.matches) raf = requestAnimationFrame(tick);
    }
    function tick(now) {
      raf = 0;
      if (disposed || paused || contextLost || document.hidden || !active) { last = 0; return; }
      if (last && now - last < 1000 / targetFPS - 1) { schedule(); return; }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / targetFPS;
      const frameStart = performance.now();
      last = now; clock += dt;
      try { draw(parameters(dt), dt); } catch (error) { pause(true); options.onError?.(error); return; }
      frameCost = frameCost * .95 + (performance.now() - frameStart) * .05;
      if (frameCost > 12) targetFPS = 30;
      else if (frameCost < 7) targetFPS = 60;
      schedule();
    }
    function pause(value = true) {
      paused = !!value;
      if (paused) { cancelAnimationFrame(raf); raf = 0; last = 0; }
      else { if (!hasDrawn) draw(parameters(0), 0); schedule(); }
    }
    function play(value = action) {
      if (ACTIONS.has(value)) action = value;
      started = clock; tapActive = false; nextEffect = clock + (action === 'read' ? 4 : 0.8); schedule();
    }
    function setGaze(x, y) { gaze = { x: clamp(Number(x) || 0, -1, 1), y: clamp(Number(y) || 0, -1, 1) }; }
    function dispose() {
      if (disposed) return;
      disposed = true; loadId++; pending.forEach(job => job.controller.abort()); pending.clear(); events.abort(); cancelAnimationFrame(raf); raf = 0;
      cache.forEach(rig => rig.layers.forEach(renderer.dispose)); cache.clear(); active = null;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); contextLost = true; gpuEpoch++; pending.forEach(job => job.controller.abort()); pending.clear(); cancelAnimationFrame(raf); raf = 0;
      options.onError?.(new Error('WebGL context lost'));
    }, { signal: events.signal });
    canvas.addEventListener('webglcontextrestored', async () => {
      if (disposed) return;
      try {
        renderer.init();
        for (const [key, rig] of cache) {
          const replacement = await prepare(rig.model, rig.images);
          if (disposed) return;
          cache.set(key, replacement); if (rig === active) active = replacement;
        }
        contextLost = false; draw(parameters(0), 0); last = 0; schedule();
      } catch (error) { contextLost = true; options.onError?.(error); }
    }, { signal: events.signal });
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf); raf = 0; last = 0; if (!document.hidden) schedule();
    }, { signal: events.signal });
    motion.addEventListener('change', () => {
      cancelAnimationFrame(raf); raf = 0; last = 0; draw(parameters(0), 0); schedule();
    }, { signal: events.signal });
    window.addEventListener('resize', () => draw(parameters(0), 0), { signal: events.signal });
    return {
      load, prefetch, play, pause, setGaze, dispose,
      render(time = clock) { clock = Math.max(0, Number(time) || 0); draw(parameters(1 / 30), 1 / 30); },
      getState() { return { action, frames, layerCount: active?.layers.length || 0, paused, contextLost, cachedPoses: cache.size, cachedActions: [...cache.keys()], pendingPoses: pending.size, targetFPS, parameters: { ...lastParameters } }; }
    };
  }
  window.AsunaRig = { create, motionDurations };
})();
