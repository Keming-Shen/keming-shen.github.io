# Numerical tutorial examples. Requires numpy, torch, matplotlib.
# Formula/interface checks and analysis of saved motion outputs.
# Pretrained inference is documented separately in model-run/.

# %% ch09-rigid-contact
import numpy as np
import matplotlib.pyplot as plt

t = np.linspace(0, 1, 61)
theta = t * np.pi / 2
rotation = np.stack([np.stack([np.cos(theta), -np.sin(theta)], -1),
                     np.stack([np.sin(theta), np.cos(theta)], -1)], -2)
translation = np.stack([0.4*t, 0.2*t], -1)
grip_local = np.array([0.5, 0.0])
hand_follow = np.einsum("tij,j->ti", rotation, grip_local) + translation
hand_fixed = np.repeat(hand_follow[:1], len(t), axis=0)
back_follow = np.einsum("tji,tj->ti", rotation, hand_follow-translation)
back_fixed = np.einsum("tji,tj->ti", rotation, hand_fixed-translation)
error_follow = np.linalg.norm(back_follow-grip_local, axis=-1)
error_fixed = np.linalg.norm(back_fixed-grip_local, axis=-1)
print(f"随动抓握最大局部误差: {error_follow.max():.6f} m")
print(f"固定世界位置末帧误差: {error_fixed[-1]:.6f} m")
fig, axes = plt.subplots(1, 2, figsize=(9, 3.5))
axes[0].plot(*hand_follow.T, label="Object-attached hand")
axes[0].plot(*translation.T, "--", label="Object origin")
axes[0].scatter(*hand_fixed[0], label="Fixed world hand", color="C3")
axes[0].set(xlabel="x (m)", ylabel="y (m)", aspect="equal")
axes[1].plot(t, error_follow, label="Attached")
axes[1].plot(t, error_fixed, label="Fixed in world")
axes[1].set(xlabel="Normalized time", ylabel="Local contact error (m)")
for ax in axes:
    ax.legend()
    ax.grid(alpha=0.3)
fig.tight_layout()
plt.show()

# %% ch09-soft-constraint
import numpy as np
import matplotlib.pyplot as plt

n = 7
diff = np.diff(np.eye(n), axis=0)
lap = diff.T @ diff
weight = 1.0
matrix = lap.copy()
matrix[0, 0] += weight
matrix[-1, -1] += weight
rhs = np.zeros(n)
rhs[-1] = weight
soft = np.linalg.solve(matrix, rhs)
hard = np.linspace(0, 1, n)
for name, path in [("soft", soft), ("hard", hard)]:
    end_error = max(abs(path[0]), abs(path[-1]-1))
    roughness = np.sum(np.diff(path)**2)
    print(f"{name}: 端点最大误差={end_error:.6f}, 差分能量={roughness:.6f}")
fig, ax = plt.subplots(figsize=(6, 3.5))
ax.plot(np.arange(n), soft, "o-", label="Soft endpoint loss")
ax.plot(np.arange(n), hard, "s--", label="Exact endpoints")
ax.scatter([0, n-1], [0, 1], s=100, facecolors="none", edgecolors="black",
           label="Requested endpoints")
ax.set(xlabel="Frame", ylabel="Position (m)")
ax.legend()
ax.grid(alpha=0.3)
fig.tight_layout()
plt.show()
