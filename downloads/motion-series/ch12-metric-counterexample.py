# -*- coding: utf-8 -*-
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
