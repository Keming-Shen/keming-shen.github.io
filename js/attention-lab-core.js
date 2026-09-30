/* Attention Lab: deterministic teaching model; every weight below is hand-set and untrained. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.AttentionLabCore = api;
    if (typeof root.dispatchEvent === 'function' && typeof root.Event === 'function') root.dispatchEvent(new root.Event('attention-lab:core-ready'));
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var PRESETS = [
    {
      id: 'cat', label: '观察一句话',
      tokens: ['我', '今天', '在', '公园', '看见', '小猫'],
      x: [[1.2, 0.3, -0.6, 0.2], [0.2, 1.1, 0.2, -0.5], [-0.6, 0.2, 0.5, 0.1], [0.3, -0.7, 1.1, 0.4], [0.8, 0.5, -0.2, 1.0], [1.0, -0.4, 0.8, -0.7]]
    },
    {
      id: 'reference', label: '寻找上下文',
      tokens: ['小猫', '追着', '毛球', '它', '跑得', '很快'],
      x: [[1.0, -0.4, 0.8, -0.7], [0.8, 0.5, -0.2, 1.0], [0.7, -0.5, 0.9, 0.3], [0.9, 0.1, 0.5, -0.4], [-0.3, 0.9, -0.6, 0.8], [-0.5, 1.0, 0.3, 0.6]]
    },
    {
      id: 'learning', label: '学习与表达',
      tokens: ['学生', '阅读', '论文', '然后', '画出', '图解'],
      x: [[1.1, 0.2, -0.4, 0.5], [0.6, 0.8, -0.3, 0.9], [0.7, -0.6, 1.0, -0.2], [-0.6, 0.6, 0.1, -0.3], [0.2, 0.9, 0.4, 0.8], [0.8, -0.3, 1.2, 0.2]]
    },
    {
      id: 'article-likes', label: '本文例子：我喜欢你',
      tokens: ['我', '喜欢', '你'],
      ffnActivation: 'relu',
      // Basis inputs make each projection row directly inspectable in the article.
      x: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]],
      heads: [
        {
          label: 'Head 1',
          wq: [[0.6, 0.8], [0.2, 1.3], [1, 0], [0, 0]],
          wk: [[1.2, 0.4], [2.6, -0.5], [1.8, 1.2], [0, 0]],
          wv: [[1, 0], [0, 2], [-1, 1], [0, 0]]
        },
        {
          label: 'Head 2',
          wq: [[0.2, 0.9], [1.1, -0.2], [-0.4, 0.7], [0, 0]],
          wk: [[0.8, -0.2], [0.1, 1.2], [0.9, 0.4], [0, 0]],
          wv: [[0.2, 1], [1, -0.4], [-0.6, 0.5], [0, 0]]
        }
      ]
    }
  ];
  var ARTICLE_PRESET_INDEX = PRESETS.findIndex(function (preset) { return preset.id === 'article-likes'; });

  // Row-vector convention throughout: X (n × 4) · Wq (4 × 2) = Q (n × 2).
  var HEADS = [
    {
      label: 'Head 1',
      wq: [[1.0, 0.1], [0.2, 0.9], [0.6, -0.4], [-0.3, 0.5]],
      wk: [[0.8, -0.2], [0.1, 0.7], [0.7, 0.3], [-0.2, 0.6]],
      wv: [[0.8, 0.2], [-0.3, 0.7], [0.5, -0.6], [0.2, 0.9]]
    },
    {
      label: 'Head 2',
      wq: [[-0.3, 0.7], [0.8, 0.1], [0.2, 0.9], [0.7, -0.4]],
      wk: [[0.1, 0.8], [0.9, -0.2], [-0.5, 0.7], [0.6, 0.3]],
      wv: [[-0.5, 0.6], [0.7, 0.2], [0.8, 0.4], [-0.2, -0.9]]
    }
  ];
  var WO = [[0.7, -0.2, 0.3, 0.1], [0.2, 0.8, -0.1, 0.3], [-0.3, 0.1, 0.7, 0.2], [0.1, 0.4, -0.2, 0.8]];
  var W1 = [[0.6, -0.4, 0.2, 0.7, -0.3, 0.1, 0.5, -0.2], [-0.2, 0.8, 0.4, -0.1, 0.5, -0.6, 0.2, 0.3], [0.3, 0.1, -0.7, 0.2, 0.6, 0.4, -0.3, 0.5], [0.5, -0.3, 0.6, 0.1, -0.2, 0.7, 0.4, -0.4]];
  var B1 = [0.1, -0.05, 0, 0.08, -0.06, 0.02, 0.04, -0.03];
  var W2 = [[0.4, -0.2, 0.3, 0.1], [-0.1, 0.5, 0.2, -0.3], [0.3, 0.1, -0.4, 0.2], [0.2, -0.3, 0.1, 0.5], [-0.4, 0.2, 0.5, 0.1], [0.1, 0.4, -0.2, 0.3], [0.5, 0.1, 0.2, -0.2], [-0.2, 0.3, 0.1, 0.4]];
  var B2 = [0.02, -0.03, 0.01, 0.04];
  var VOCAB_LABELS = ['继续', '停下', '转身', '休息', '。'];
  var VOCAB_W = [[0.5, -0.2, 0.7, -0.3, 0.1], [0.1, 0.6, -0.3, 0.4, -0.2], [-0.4, 0.3, 0.2, 0.6, 0.1], [0.3, -0.5, 0.1, 0.2, 0.7]];
  var EPSILON = 1e-5;

  function dot(a, b) {
    if (a.length !== b.length) throw new RangeError('Dot-product dimensions must match.');
    var sum = 0;
    for (var i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
  }

  function matmul(a, b) {
    if (!a.length || !b.length || !b[0].length) return [];
    var width = b[0].length;
    if (a.some(function (row) { return row.length !== b.length; }) || b.some(function (row) { return row.length !== width; })) {
      throw new RangeError('Matrix dimensions must match.');
    }
    return a.map(function (row) {
      return b[0].map(function (_, j) {
        var sum = 0;
        for (var k = 0; k < b.length; k++) sum += row[k] * b[k][j];
        return sum;
      });
    });
  }

  function softmax(values) {
    if (!values.length) return [];
    // Masked entries are exactly zero. The all-masked case is defined as all zero.
    var max = Math.max.apply(null, values);
    if (max === -Infinity) return values.map(function () { return 0; });
    if (max === Infinity) {
      var count = values.filter(function (v) { return v === Infinity; }).length;
      return values.map(function (v) { return v === Infinity ? 1 / count : 0; });
    }
    var exp = values.map(function (v) { return Math.exp(v - max); });
    var sum = exp.reduce(function (a, b) { return a + b; }, 0);
    return exp.map(function (v) { return v / sum; });
  }

  function stats(row) {
    var mean = row.reduce(function (a, b) { return a + b; }, 0) / row.length;
    var variance = row.reduce(function (sum, v) { return sum + Math.pow(v - mean, 2); }, 0) / row.length;
    return { mean: mean, variance: variance };
  }

  function layerNorm(row, epsilon) {
    var s = stats(row);
    var denominator = Math.sqrt(s.variance + (epsilon === undefined ? EPSILON : epsilon));
    // Teaching version uses gamma = 1 and beta = 0; normalization is per token.
    return row.map(function (v) { return (v - s.mean) / denominator; });
  }

  function rotate(vector, angle) {
    var c = Math.cos(angle), s = Math.sin(angle);
    return [vector[0] * c - vector[1] * s, vector[0] * s + vector[1] * c];
  }

  function entropy(probabilities) {
    return -probabilities.reduce(function (sum, p) { return sum + (p > 0 ? p * Math.log(p) : 0); }, 0);
  }

  function gelu(x) {
    // Standard tanh approximation of GELU (not a trained activation).
    return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
  }

  function createState() {
    return { preset: 0, query: 5, key: 0, head: 0, temperature: 1, causal: false, scale: true, position: 'none', positionStrength: 1, positionOffset: 0, overrides: { q: {}, k: {}, v: {} } };
  }

  function finite(value, fallback) { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function add(a, b) {
    return a.map(function (row, i) { return row.map(function (v, j) { return v + b[i][j]; }); });
  }

  function applyOverrides(vectors, overrides, head) {
    return vectors.map(function (vector, token) {
      var replacement = overrides && overrides[head + ':' + token];
      return Array.isArray(replacement) && replacement.length === 2 && replacement.every(Number.isFinite) ? replacement.slice() : vector;
    });
  }

  function compute(input) {
    var state = Object.assign(createState(), input || {});
    var preset = PRESETS[clamp(Math.trunc(finite(state.preset, 0)), 0, PRESETS.length - 1)];
    var temperature = clamp(finite(state.temperature, 1), 0.05, 10);
    var strength = clamp(finite(state.positionStrength, 1), 0, 4);
    var offset = clamp(finite(state.positionOffset, 0), 0, 12);
    var queryIndex = clamp(Math.trunc(finite(state.query, 5)), 0, preset.tokens.length - 1);
    var position = state.position === 'sinusoidal' || state.position === 'rope' ? state.position : 'none';
    var overrides = state.overrides || {};
    var x = preset.x.map(function (row, token) {
      return row.map(function (value, dimension) {
        if (position !== 'sinusoidal') return value;
        var angle = (token + offset) / Math.pow(10000, 2 * Math.floor(dimension / 2) / 4);
        return value + strength * (dimension % 2 === 0 ? Math.sin(angle) : Math.cos(angle));
      });
    });
    var headSpecs = preset.heads || HEADS;
    var heads = headSpecs.map(function (head, h) {
      var q = matmul(x, head.wq), k = matmul(x, head.wk), v = matmul(x, head.wv);
      if (position === 'rope') {
        // One coordinate pair per head: RoPE's lowest frequency is 1 radian/token.
        q = q.map(function (row, i) { return rotate(row, (i + offset) * strength); });
        k = k.map(function (row, i) { return rotate(row, (i + offset) * strength); });
      }
      q = applyOverrides(q, overrides.q, h);
      k = applyOverrides(k, overrides.k, h);
      v = applyOverrides(v, overrides.v, h);
      var scores = q.map(function (query) { return k.map(function (key) { return dot(query, key); }); });
      var logits = scores.map(function (row, i) {
        return row.map(function (score, j) {
          return state.causal && j > i ? -Infinity : score / (state.scale === false ? 1 : Math.sqrt(2)) / temperature;
        });
      });
      var weights = logits.map(softmax);
      return { q: q, k: k, v: v, scores: scores, logits: logits, weights: weights, out: matmul(weights, v) };
    });
    var concat = x.map(function (_, i) { return heads[0].out[i].concat(heads[1].out[i]); });
    var projected = matmul(concat, WO);
    var residual = add(x, projected);
    var normStats = residual.map(stats);
    var norm1 = residual.map(function (row) { return layerNorm(row); });
    // The article follows Attention Is All You Need §3.3: max(0, ZW1 + b1)W2 + b2.
    // Preserve GELU for the older exploratory presets.
    var ffnActivation = preset.ffnActivation === 'relu' ? 'relu' : 'gelu';
    var hidden = matmul(norm1, W1).map(function (row) {
      return row.map(function (value, j) {
        var preactivation = value + B1[j];
        return ffnActivation === 'relu' ? Math.max(0, preactivation) : gelu(preactivation);
      });
    });
    var ffn = matmul(hidden, W2).map(function (row) { return row.map(function (value, j) { return value + B2[j]; }); });
    // Original post-LN block illustration: LN(X + MHA(X)), then LN(H + FFN(H)).
    var block = add(norm1, ffn).map(function (row) { return layerNorm(row); });
    // Untrained output projection from the selected query token; not a language-model prediction.
    var nextLogits = matmul([block[queryIndex]], VOCAB_W)[0];
    return {
      tokens: preset.tokens.slice(), x: x, heads: heads, headSpecs: headSpecs, concat: concat, projected: projected,
      residual: residual, norm1: norm1, ffn: ffn, ffnActivation: ffnActivation, block: block, normStats: normStats,
      next: { labels: VOCAB_LABELS.slice(), logits: nextLogits, probs: softmax(nextLogits) }, dk: 2
    };
  }

  return { PRESETS: PRESETS, ARTICLE_PRESET_INDEX: ARTICLE_PRESET_INDEX, HEADS: HEADS, WO: WO, EPSILON: EPSILON, createState: createState, compute: compute, dot: dot, softmax: softmax, matmul: matmul, layerNorm: layerNorm, rotate: rotate, entropy: entropy, gelu: gelu };
});
