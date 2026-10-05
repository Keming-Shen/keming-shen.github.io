# Numerical tutorial examples. Requires numpy, torch, matplotlib.
# Formula/interface checks and analysis of saved motion outputs.
# Pretrained inference is documented separately in model-run/.

# %% ch10-sdf-path
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

def box_sdf(points, half_size=np.array([0.4, 0.6])):
    q = np.abs(points) - half_size
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + \
           np.minimum(np.max(q, axis=-1), 0)

def sample_polyline(vertices, count=101):
    return np.concatenate([np.linspace(a, b, count)
                           for a, b in zip(vertices[:-1], vertices[1:])])

straight = sample_polyline(np.array([[-2., 0.], [2., 0.]]))
detour_vertices = np.array([[-2., 0.], [-0.8, 0.9], [0.8, 0.9], [2., 0.]])
detour = sample_polyline(detour_vertices)
radius = 0.2
for name, path in [("straight", straight), ("detour", detour)]:
    margin = box_sdf(path) - radius
    length = np.linalg.norm(np.diff(path, axis=0), axis=-1).sum()
    print(f"{name}: 最小身体裕量={margin.min():.3f} m, 路径长度={length:.3f} m")

fig, ax = plt.subplots(figsize=(7, 4))
ax.add_patch(Rectangle((-0.4, -0.6), 0.8, 1.2, color="0.7", label="Obstacle"))
ax.add_patch(Rectangle((-0.6, -0.8), 1.2, 1.6, fill=False,
                       linestyle="--", label="Expanded bounding box"))
ax.plot(*straight.T, label="Straight root path", color="C3")
ax.plot(*detour.T, label="Hand-designed detour", color="C0")
ax.set(xlabel="x (m)", ylabel="y (m)", aspect="equal")
ax.legend(loc="lower right")
ax.grid(alpha=0.3)
fig.tight_layout()
plt.show()

# %% ch10-affordance-map
import numpy as np
import matplotlib.pyplot as plt

scene_x = np.linspace(-1, 1, 121)
hand_x = np.linspace(-0.7, 0.7, 21)
sigma = 0.2
def map_from_path(path):
    distances = np.abs(scene_x[:, None] - path[None, :])
    per_frame = np.exp(-(distances**2) / (2*sigma**2))
    return per_frame.max(axis=1), per_frame

forward, frames = map_from_path(hand_x)
backward, _ = map_from_path(hand_x[::-1])
print("场景点数:", len(scene_x))
print(f"正向与反向聚合图最大差异: {np.max(np.abs(forward-backward)):.12f}")
print(f"两种动作起始位置差异: {abs(hand_x[0]-hand_x[-1]):.3f} m")
fig, axes = plt.subplots(1, 2, figsize=(9, 3.5))
axes[0].imshow(frames, origin="lower", aspect="auto",
               extent=[0, 20, -1, 1], cmap="viridis")
axes[0].set(xlabel="Frame", ylabel="Scene x (m)", title="Time-resolved distance kernel")
axes[1].plot(scene_x, forward, label="Left to right")
axes[1].plot(scene_x, backward, "--", label="Right to left")
axes[1].set(xlabel="Scene x (m)", ylabel="Max-pooled proximity")
axes[1].legend()
fig.tight_layout()
plt.show()
