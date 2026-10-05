# -*- coding: utf-8 -*-
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
