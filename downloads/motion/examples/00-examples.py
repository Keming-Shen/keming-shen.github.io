# Numerical tutorial examples. Requires numpy, torch, matplotlib.
# Formula/interface checks and analysis of saved motion outputs.
# Pretrained inference is documented separately in model-run/.

# %% ch00-sampling
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt

data_dir = Path(__file__).resolve().parents[1] / "model-run/motionlcm-v2"
motion = np.load(data_dir / "raw-motion.npz")["joints"][0]
fps, frames = 20, len(motion)
t = np.arange(frames) / fps
root, wrist = motion[:, 0], motion[:, 21]  # pelvis, right wrist
print(f"frames={frames}, fps={fps}, playback={frames/fps:.2f}s")
print(f"sample span={t[-1]:.2f}s, final root x={root[-1,0]:.4f}m")
print(f"100 frames at 30 fps: {frames/30:.4f}s")
fig, axes = plt.subplots(1, 2, figsize=(7.2, 2.8))
axes[0].plot(root[:, 0], root[:, 2], color="#a77b2c")
axes[0].scatter(root[::fps, 0], root[::fps, 2], color="#a77b2c", s=22)
axes[0].set(xlabel="World x (m)", ylabel="World z (m)", title="Root trajectory")
axes[0].set_aspect("equal", adjustable="datalim")
axes[1].plot(t, wrist[:, 1], color="#367f96")
axes[1].set(xlabel="Time (s)", ylabel="World y (m)", title="Right wrist height")
for ax in axes:
    ax.grid(alpha=.2)
fig.tight_layout()
plt.show()
