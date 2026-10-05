# Numerical tutorial examples. Requires numpy, torch, matplotlib.
# Formula/interface checks and analysis of saved motion outputs.
# Pretrained inference is documented separately in model-run/.

# %% ch12-data-coverage
import itertools
import numpy as np
import matplotlib.pyplot as plt

all_cells = np.array(list(itertools.product(range(4), range(3), range(2))))
base = np.array([[0, 0, 0], [0, 1, 0], [0, 2, 0],
                 [1, 1, 0], [2, 1, 0], [3, 1, 0]])
repeated = np.repeat(base, 100, axis=0)
datasets = [("base", base), ("repeated", repeated), ("covered", all_cells)]
counts, coverages = [], []
for name, samples in datasets:
    unique, frequency = np.unique(samples, axis=0, return_counts=True)
    probability = frequency / frequency.sum()
    support = 1 / np.sum(probability**2)
    coverage = len(unique) / len(all_cells)
    counts.append(len(samples))
    coverages.append(coverage)
    print(f"{name}: 样本={len(samples)}, 条件覆盖={coverage:.1%}, "
          f"有效单元数={support:.1f}")
fig, axes = plt.subplots(1, 2, figsize=(9, 3.5))
labels = [name for name, _ in datasets]
axes[0].bar(labels, counts)
axes[0].set(ylabel="Sample count")
axes[1].bar(labels, coverages)
axes[1].set(ylabel="Condition coverage", ylim=(0, 1.05))
fig.tight_layout()
plt.show()

# %% ch12-command-latency
import numpy as np
import matplotlib.pyplot as plt

buffer = np.array([0.0, 0.1, 0.25, 0.5, 1.0])
compute = 0.08
transition = 0.20
start_fifo = np.maximum(buffer, compute)
finish_fifo = start_fifo + transition
start_replace = np.full_like(buffer, compute)
for b, start, finish in zip(buffer, start_fifo, finish_fifo):
    print(f"旧缓存={b:.2f} s: 首次新响应={start:.2f} s, "
          f"过渡完成={finish:.2f} s")
print(f"理想可替换接口首次响应: {compute:.2f} s")
fig, ax = plt.subplots(figsize=(7, 3.5))
ax.plot(buffer, start_fifo, "o-", label="Queue preserved: response starts")
ax.plot(buffer, finish_fifo, "s--", label="Queue preserved: transition ends")
ax.plot(buffer, start_replace, ":", label="Ideal replaceable queue")
ax.set(xlabel="Remaining old buffer (s)", ylabel="Time after new command (s)")
ax.legend()
ax.grid(alpha=0.3)
fig.tight_layout()
plt.show()

# %% ch12-metric-counterexample
import numpy as np
import matplotlib.pyplot as plt

t = np.linspace(0, 1, 21)
reference = np.zeros((len(t), 2, 3))
reference[:, 0, 0] = 0.3*t
reference[:, 0, 1] = 1.0
floating = reference + np.array([0.0, 0.2, 0.0])
offset = np.zeros((len(t), 1, 3))
offset[:, 0, 0] = 0.2*t
sliding = reference + offset
def local_pose(x):
    return x-x[:, :1]
samples = [("reference", reference), ("floating", floating), ("sliding", sliding)]
for name, x in samples:
    local_error = np.linalg.norm(local_pose(x)-local_pose(reference), axis=-1).mean()
    foot_gap = np.abs(x[:, 1, 1]).mean()
    foot_slide = np.abs(np.diff(x[:, 1, 0])).sum()
    print(f"{name}: 局部姿态误差={local_error:.6f} m, "
          f"足部高度误差={foot_gap:.3f} m, 足部滑动={foot_slide:.3f} m")
fig, axes = plt.subplots(1, 2, figsize=(9, 3.5))
for name, x in samples:
    axes[0].plot(t, x[:, 1, 1], label=name)
    axes[1].plot(t, x[:, 1, 0], label=name)
axes[0].set(xlabel="Time (s)", ylabel="Support foot height (m)")
axes[1].set(xlabel="Time (s)", ylabel="Support foot x (m)")
for ax in axes:
    ax.legend()
    ax.grid(alpha=0.3)
fig.tight_layout()
plt.show()
