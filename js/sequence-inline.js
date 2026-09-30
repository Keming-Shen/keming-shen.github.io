/* Chapter 05: shifted inputs and causal visibility, without a language model. */
(function () {
  'use strict';

  var inputs = ['<bos>', '我', '喜欢', '你'];
  var targets = ['我', '喜欢', '你', '<eos>'];

  function getFlow(mode, step) {
    mode = mode === 'generate' ? 'generate' : 'train';
    step = Number.isFinite(Number(step)) ? Math.trunc(Number(step)) : 2;
    step = Math.max(1, Math.min(inputs.length, step));
    return {
      mode: mode,
      step: step,
      target: targets[step - 1],
      visible: inputs.slice(0, step),
      positions: inputs.map(function (token, index) {
        return { token: token, exists: mode === 'train' || index < step,
          readable: index < step, current: index === step - 1 };
      }),
      mask: inputs.map(function (_, row) {
        return inputs.map(function (_, column) { return column <= row; });
      })
    };
  }

  // Expose only the pure data-flow calculation to the small Node check.
  if (typeof module === 'object' && module.exports) module.exports = { getFlow: getFlow };
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.SequenceInline) { window.SequenceInline.init(); return; }

  var mounted = new WeakSet();
  var escapeHTML = function (value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  };

  function mount(root) {
    if (mounted.has(root) || root.dataset.sequenceExample !== 'teacher-forcing') return;
    mounted.add(root);
    var state = { mode: 'train', step: 2 };
    root.innerHTML = '<div class="si-heading"><strong>右移输入与因果遮罩</strong><span>数据流示意</span></div>' +
      '<div class="si-controls"><div class="si-mode" role="group" aria-label="选择数据流模式">' +
      '<button type="button" data-mode="train" aria-pressed="true">训练输入</button>' +
      '<button type="button" data-mode="generate" aria-pressed="false">生成前缀</button></div>' +
      '<div class="si-steps" role="group" aria-label="选择预测步"><span>预测步 t</span>' +
      targets.map(function (target, index) {
        return '<button type="button" data-step="' + (index + 1) + '" aria-label="第 ' + (index + 1) +
          ' 步，参考目标 ' + escapeHTML(target) + '" aria-pressed="false">' + (index + 1) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="si-input-area"><div class="si-label">decoder 输入位置</div><div class="si-inputs"></div></div>' +
      '<div class="si-workspace"><div class="si-matrix-area"><div class="si-label">因果遮罩 M · 当前行为预测步 t</div>' +
      '<div class="si-mask" role="img"></div>' +
      '<div class="si-legend"><span><i class="si-readable"></i>0：允许读取</span>' +
      '<span><i class="si-forbidden"></i>−∞：禁止读取</span></div></div>' +
      '<div class="si-explanation"><div class="si-target-label"></div><div class="si-target"></div>' +
      '<div class="si-current"></div><div class="si-status" role="status" aria-live="polite" aria-atomic="true"></div></div></div>' +
      '<div class="si-footnote">源句固定为 I like you；生成模式沿“我 / 喜欢 / 你”的参考路径展示，不计算预测概率。</div>';

    function render() {
      var flow = getFlow(state.mode, state.step);
      root.querySelectorAll('[data-mode]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.mode === flow.mode));
      });
      root.querySelectorAll('[data-step]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(Number(button.dataset.step) === flow.step));
      });
      root.querySelector('.si-inputs').innerHTML = flow.positions.map(function (position, index) {
        var name = position.current ? ' is-current' : position.readable ? ' is-readable' : ' is-future';
        return '<div class="si-token' + name + '"><span>' + (index + 1) + '</span><strong>' +
          (position.exists ? escapeHTML(position.token) : '—') + '</strong><small>' +
          (!position.exists ? '尚未生成' : position.readable ? '可访问' : '被遮罩') + '</small></div>';
      }).join('');

      var matrix = '<div class="si-matrix"><span class="si-axis-label">t / 输入</span>' +
        flow.positions.map(function (position, index) {
          return '<span class="si-column-label">' + (index + 1) + '</span>';
        }).join('');
      flow.mask.forEach(function (row, rowIndex) {
        var active = rowIndex === flow.step - 1;
        var uncomputed = flow.mode === 'generate' && rowIndex >= flow.step;
        matrix += '<span class="si-row-label' + (active ? ' is-current' : '') + '">' + (rowIndex + 1) + '</span>';
        row.forEach(function (allowed, columnIndex) {
          matrix += '<span class="si-cell ' + (allowed ? 'is-allowed' : 'is-blocked') +
            (active ? ' is-current' : '') + (uncomputed ? ' is-uncomputed' : '') + '" title="第 ' + (rowIndex + 1) +
            ' 步读取输入位置 ' + (columnIndex + 1) + '：' + (allowed ? '允许' : '禁止') +
            (uncomputed ? '；该步尚未执行' : '') + '">' + (allowed ? '0' : '−∞') + '</span>';
        });
      });
      matrix += '</div>';
      var mask = root.querySelector('.si-mask');
      mask.innerHTML = matrix;
      mask.setAttribute('aria-label', '四乘四因果遮罩：第 ' + flow.step + ' 行高亮，允许访问输入位置 1 到 ' +
        flow.step + '，更靠右的位置禁止访问。生成模式下，尚未执行的行以淡色显示。');

      root.querySelector('.si-target-label').textContent = flow.mode === 'train' ? '当前监督目标' : '下一词（参考路径）';
      root.querySelector('.si-target').textContent = flow.target;
      root.querySelector('.si-current').textContent = '位置 ' + flow.step + ' 的输入：' + inputs[flow.step - 1];
      var remaining = inputs.length - flow.step;
      var detail = flow.mode === 'train'
        ? (remaining ? '右侧 ' + remaining + ' 个输入已经提供，但不能被当前行读取。' : '当前行可读取全部右移输入，目标是结束标记。')
        : (remaining ? '后面的输入尚未生成；上三角仍表示不允许的未来连接。' : '三个示例词已在前缀中，接下来可以选择结束标记。');
      root.querySelector('.si-status').textContent = '第 ' + flow.step + ' 步可访问：' + flow.visible.join(' / ') + '。' + detail;
    }

    root.addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (!button || !root.contains(button)) return;
      if (button.dataset.mode) state.mode = button.dataset.mode;
      else if (button.dataset.step) state.step = Number(button.dataset.step);
      else return;
      render();
    });
    render();
  }

  function init() {
    document.querySelectorAll('.sequence-inline[data-sequence-example]').forEach(mount);
  }
  window.SequenceInline = { init: init };
  document.addEventListener('pjax:complete', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
