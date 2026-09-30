/* A hand-set 2 -> 3 -> 2 network, matching chapter 01 exactly. */
(() => {
  'use strict';
  if (window.NetworkInline) { window.NetworkInline.init(); return; }

  // Row-vector convention: a = x W1 + b1, h = ReLU(a), z = h W2 + b2.
  const W1 = [[1, -1, 0.5], [0.5, 1, -1]];
  const b1 = [0, 0.5, 1];
  const W2 = [[1, -1], [0.5, 0.5], [-1, 1]];
  const b2 = [0.1, -0.1];
  const mounted = new Map();
  const limit = 4;
  const plot = { left: 65, top: 28, size: 280, cx: 205, cy: 168, unit: 35 };
  const colors = ['cyan', 'yellow', 'silver'];
  const expressions = ['x₁ + 0.5x₂', '−x₁ + x₂ + 0.5', '0.5x₁ − x₂ + 1'];
  const sub = ['₁', '₂', '₃'];
  const fmt = n => (Math.abs(n) < 0.0005 ? 0 : n).toFixed(2);
  const clamp = n => Math.max(-limit, Math.min(limit, n));
  const px = x => plot.cx + x * plot.unit;
  const py = y => plot.cy - y * plot.unit;

  function evaluate(x) {
    const a = b1.map((bias, j) => bias + x[0] * W1[0][j] + x[1] * W1[1][j]);
    const h = a.map(value => Math.max(0, value));
    const z = b2.map((bias, j) => bias + h.reduce((sum, value, i) => sum + value * W2[i][j], 0));
    return { a, h, z };
  }

  function clipRegion(polygon, j, sign) {
    const score = point => sign * (point[0] * W1[0][j] + point[1] * W1[1][j] + b1[j]);
    const result = [];
    if (!polygon.length) return result;
    let previous = polygon[polygon.length - 1], prevScore = score(previous);
    polygon.forEach(current => {
      const currentScore = score(current);
      if ((prevScore >= 0) !== (currentScore >= 0)) {
        const t = prevScore / (prevScore - currentScore);
        result.push(previous.map((value, axis) => value + t * (current[axis] - value)));
      }
      if (currentScore >= 0) result.push(current);
      previous = current; prevScore = currentScore;
    });
    return result;
  }

  function boundary(j) {
    const a = W1[0][j], b = W1[1][j], c = b1[j], points = [];
    const add = (x, y) => {
      if (x < -limit - 1e-8 || x > limit + 1e-8 || y < -limit - 1e-8 || y > limit + 1e-8) return;
      if (!points.some(point => Math.hypot(point[0] - x, point[1] - y) < 1e-8)) points.push([x, y]);
    };
    if (b !== 0) [-limit, limit].forEach(x => add(x, -(a * x + c) / b));
    if (a !== 0) [-limit, limit].forEach(y => add(-(b * y + c) / a, y));
    return points.slice(0, 2);
  }

  function diagram() {
    let grid = '';
    for (let i = -limit; i <= limit; i++) {
      grid += '<path class="ni-grid' + (i === 0 ? ' ni-zero' : '') +
        '" d="M' + px(i) + ' ' + plot.top + 'V' + (plot.top + plot.size) +
        ' M' + plot.left + ' ' + py(i) + 'H' + (plot.left + plot.size) + '"/>';
      if (i !== 0 && i % 2 === 0) {
        grid += '<text x="' + px(i) + '" y="' + (plot.cy + 17) + '" text-anchor="middle">' + i + '</text>';
        grid += '<text x="' + (plot.cx - 9) + '" y="' + (py(i) + 4) + '" text-anchor="end">' + i + '</text>';
      }
    }
    const lines = colors.map((color, j) => {
      const points = boundary(j);
      return '<path class="ni-boundary ni-' + color + '" data-boundary="' + j +
        '" d="M' + px(points[0][0]) + ' ' + py(points[0][1]) +
        'L' + px(points[1][0]) + ' ' + py(points[1][1]) + '"/>';
    }).join('');
    return '<svg class="ni-svg" viewBox="0 0 410 350" role="group" aria-label="二维输入平面和三个 ReLU 激活边界">' +
      '<title>输入点 x 与三条 a 等于零的直线</title>' +
      '<polygon class="ni-region" data-region points=""/>' + grid + lines +
      '<text x="358" y="160" class="ni-axis-label">x₁</text>' +
      '<text x="214" y="19" class="ni-axis-label">x₂</text>' +
      '<text x="132" y="21" class="ni-cyan ni-line-label">a₁ = 0</text>' +
      '<text x="350" y="49" class="ni-yellow ni-line-label">a₂ = 0</text>' +
      '<text x="69" y="225" class="ni-silver ni-line-label">a₃ = 0</text>' +
      '<rect class="ni-hit" data-drag x="' + plot.left + '" y="' + plot.top + '" width="' + plot.size + '" height="' + plot.size + '"/>' +
      '<g class="ni-point" data-point data-drag tabindex="0" role="group" aria-label="二维输入点，使用方向键移动">' +
      '<circle class="ni-point-halo" r="14"/><circle class="ni-point-core" r="5"/>' +
      '<text class="ni-point-label" data-point-label x="12" y="-13">x</text></g>' +
      '<text x="205" y="337" text-anchor="middle" class="ni-caption">直线 aᵢ = 0 分隔 hᵢ 开启与关闭的区域</text>' +
      '</svg>';
  }

  function mount(root) {
    if (mounted.has(root)) return;
    let x = [2, -1], dragging = null;
    const controller = new AbortController();
    const listen = (element, event, callback) => element.addEventListener(event, callback, { signal: controller.signal });
    root.innerHTML =
      '<div class="ni-header"><strong>二维输入与 ReLU 激活边界</strong>' +
      '<button type="button" data-action="reset">重置</button></div>' +
      '<div class="ni-workspace"><div class="ni-visual">' + diagram() + '</div>' +
      '<div class="ni-panel"><div class="ni-controls">' +
      [0, 1].map(axis => '<label class="ni-range"><span>x' + sub[axis] +
        '<output data-coordinate="' + axis + '"></output></span>' +
        '<input type="range" min="-4" max="4" step="0.01" value="' + x[axis] +
        '" data-axis="' + axis + '" aria-label="输入 x' + sub[axis] + '"></label>').join('') +
      '</div><div class="ni-hidden"><div class="ni-table-head"><span>单元</span><span>线性值 a</span><span>ReLU 后 h</span></div>' +
      colors.map((color, j) => '<div class="ni-unit ni-' + color + '" data-unit="' + j + '">' +
        '<div class="ni-unit-values"><span class="ni-unit-name">h' + sub[j] +
        '</span><output data-a="' + j + '"></output><output data-h="' + j + '"></output></div>' +
        '<div class="ni-unit-formula">a' + sub[j] + ' = ' + expressions[j] +
        '<span data-state="' + j + '"></span></div></div>').join('') +
      '</div><div class="ni-output"><span class="ni-output-title">输出 · 未归一化分数</span>' +
      '<div class="ni-output-values"><span>z₁<output data-z="0"></output></span><span>z₂<output data-z="1"></output></span></div>' +
      '<span class="ni-output-formula">z₁ = h₁ + 0.5h₂ − h₃ + 0.1<br>z₂ = −h₁ + 0.5h₂ + h₃ − 0.1</span></div>' +
      '</div></div><div class="ni-footer"><span class="ni-note" data-status></span>' +
      '<button type="button" data-action="alternate">算例 x′ = [−1, 2]</button></div>' +
      '<div class="ni-access-note">拖动输入点，或使用两个滑块。输入点获得焦点后可按方向键移动 0.1，Shift + 方向键移动 0.5。全部参数固定，数值仅用于演示运算。</div>';
    const $ = selector => root.querySelector(selector);
    const $$ = selector => Array.from(root.querySelectorAll(selector));
    const svg = $('.ni-svg'), point = $('[data-point]');
    $$('output').forEach(output => output.setAttribute('aria-live', 'off'));

    function render() {
      const result = evaluate(x), onBoundary = result.a.some(value => Math.abs(value) < 1e-8);
      $$('[data-axis]').forEach(input => { input.value = x[Number(input.dataset.axis)]; });
      $$('[data-coordinate]').forEach(output => { output.textContent = fmt(x[Number(output.dataset.coordinate)]); });
      ['a', 'h', 'z'].forEach(kind => $$('[data-' + kind + ']').forEach(output => {
        output.textContent = fmt(result[kind][Number(output.dataset[kind])]);
      }));
      result.a.forEach((value, j) => {
        const active = value > 1e-8;
        $('[data-unit="' + j + '"]').classList.toggle('is-active', active);
        $('[data-state="' + j + '"]').textContent = Math.abs(value) < 1e-8 ? '边界' : active ? '开启' : '关闭';
        $('[data-boundary="' + j + '"]').classList.toggle('is-active', active);
      });
      let region = [[-limit, -limit], [limit, -limit], [limit, limit], [-limit, limit]];
      result.a.forEach((value, j) => { region = clipRegion(region, j, value >= 0 ? 1 : -1); });
      $('[data-region]').setAttribute('points', onBoundary ? '' : region.map(v => px(v[0]) + ',' + py(v[1])).join(' '));
      point.setAttribute('transform', 'translate(' + px(x[0]) + ',' + py(x[1]) + ')');
      point.setAttribute('aria-label', '输入点 x₁ ' + fmt(x[0]) + '，x₂ ' + fmt(x[1]) + '，可用方向键移动');
      const label = $('[data-point-label]');
      label.textContent = 'x = [' + fmt(x[0]) + ', ' + fmt(x[1]) + ']';
      label.setAttribute('x', x[0] > 0.5 ? '-12' : '12');
      label.setAttribute('text-anchor', x[0] > 0.5 ? 'end' : 'start');
      label.setAttribute('y', x[1] > 3 ? '24' : '-13');
      $('[data-status]').textContent = onBoundary
        ? '当前点位于激活边界，对应 hᵢ = 0。'
        : '阴影内激活模式相同；越过直线可改变某个 hᵢ 的开关状态。';
    }

    function move(next) {
      x = next.map(value => Math.round(clamp(value) * 100) / 100);
      render();
    }

    function fromPointer(event) {
      const matrix = svg.getScreenCTM();
      if (!matrix) return null;
      const position = svg.createSVGPoint();
      position.x = event.clientX; position.y = event.clientY;
      const local = position.matrixTransform(matrix.inverse());
      return [(local.x - plot.cx) / plot.unit, (plot.cy - local.y) / plot.unit];
    }

    listen(root, 'input', event => {
      const axis = event.target.dataset.axis;
      if (axis === undefined) return;
      const next = x.slice(); next[Number(axis)] = Number(event.target.value);
      if (Number.isFinite(next[Number(axis)])) move(next);
    });
    listen(root, 'click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      move(button.dataset.action === 'alternate' ? [-1, 2] : [2, -1]);
    });
    listen(svg, 'pointerdown', event => {
      if (dragging !== null || event.button !== 0 || !event.target.closest('[data-drag]')) return;
      const next = fromPointer(event);
      if (!next) return;
      dragging = event.pointerId;
      svg.setPointerCapture(event.pointerId);
      point.focus({ preventScroll: true });
      move(next); event.preventDefault();
    });
    listen(svg, 'pointermove', event => {
      if (dragging !== event.pointerId) return;
      const next = fromPointer(event);
      if (next) move(next);
    });
    const finishDrag = event => {
      if (dragging !== event.pointerId) return;
      dragging = null;
      if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => listen(svg, name, finishDrag));
    listen(point, 'keydown', event => {
      const direction = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [1, 1], ArrowDown: [1, -1] }[event.key];
      if (!direction) return;
      const next = x.slice();
      next[direction[0]] += direction[1] * (event.shiftKey ? 0.5 : 0.1);
      move(next); event.preventDefault();
    });
    mounted.set(root, {
      cancel() { if (dragging !== null && svg.hasPointerCapture(dragging)) svg.releasePointerCapture(dragging); dragging = null; },
      destroy() { controller.abort(); dragging = null; }
    });
    render();
  }

  function init() {
    for (const [root, instance] of mounted) {
      if (!root.isConnected) { instance.destroy(); mounted.delete(root); }
    }
    document.querySelectorAll('.network-inline').forEach(mount);
  }

  window.NetworkInline = { init, evaluate };
  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pjax:complete', init);
  document.addEventListener('pjax:send', () => { for (const instance of mounted.values()) instance.cancel(); });
  init();
})();
