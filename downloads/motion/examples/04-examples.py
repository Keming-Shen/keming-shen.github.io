# Numerical tutorial examples. Requires numpy, torch, matplotlib.
# Formula/interface checks and analysis of saved motion outputs.
# Pretrained inference is documented separately in model-run/.

# %% ch04-geometric-gradient
import numpy as np
import matplotlib.pyplot as plt

length = 1.0
target = np.array([1.2, 0.6])
root, angle = 0.0, 0.0
points, losses = [], []
for step in range(161):
    end = np.array([root+length*np.cos(angle), length*np.sin(angle)])
    error = end-target
    points.append(end.copy())
    losses.append(0.5*np.dot(error, error))
    if step == 160:
        break
    grad_root = error[0]
    grad_angle = np.dot(error, [-length*np.sin(angle), length*np.cos(angle)])
    root -= 0.12*grad_root
    angle -= 0.12*grad_angle
bone = end-np.array([root, 0.0])
print(f"initial_error={np.linalg.norm(points[0]-target):.6f}")
print(f"final_error={np.linalg.norm(error):.6f}")
print(f"root={root:.6f}, angle_deg={np.degrees(angle):.6f}")
print(f"bone_length={np.linalg.norm(bone):.6f}")
fig, axes = plt.subplots(1, 2, figsize=(8, 3))
path = np.array(points)
axes[0].plot(path[:, 0], path[:, 1], label="end-point updates")
axes[0].plot([root, end[0]], [0, end[1]], "o-", label="final bone")
axes[0].scatter(*target, marker="x", s=80, color="red", label="target")
axes[0].axis("equal")
axes[0].set(xlabel="World x", ylabel="World y")
axes[0].legend(fontsize=8)
axes[1].semilogy(np.maximum(losses, 1e-12))
axes[1].set(xlabel="Optimization step", ylabel="Constraint loss")
fig.tight_layout()
plt.show()

# %% ch04-zero-projection
import torch
from torch import nn

torch.manual_seed(12)
base = nn.Linear(4, 4)
control = nn.Linear(4, 4)
projection = nn.Linear(4, 4, bias=False)
nn.init.zeros_(projection.weight)
for parameter in base.parameters():
    parameter.requires_grad_(False)
x = torch.randn(6, 4)
hint = torch.randn(6, 4)
target = base(x).detach()+0.5
optimizer = torch.optim.SGD(list(control.parameters())+list(projection.parameters()), lr=0.2)
initial = base(x)+projection(control(hint))
print("initial_equals_base:", bool(torch.allclose(initial, base(x))))
for step in range(2):
    optimizer.zero_grad()
    output = base(x)+projection(control(hint))
    loss = ((output-target)**2).mean()
    loss.backward()
    print(f"step={step}, control_grad={control.weight.grad.norm().item():.6f}, "
          f"projection_grad={projection.weight.grad.norm().item():.6f}")
    optimizer.step()

# %% ch04-time-body-mask
import numpy as np
import matplotlib.pyplot as plt

fps, frames = 20, 60
time = np.arange(frames)/fps
parts = ["right_arm", "left_knee"]
source = np.column_stack([10*np.sin(2*np.pi*time), 8*np.sin(2*np.pi*time+0.5)])
edited = source.copy()
mask = np.zeros_like(source, dtype=bool)
controls = [(0, 1.0, 1.5, 60.0), (1, 2.0, 2.5, 35.0)]
for part, start, end, value in controls:
    selected = (time >= start) & (time < end)
    mask[selected, part] = True
    edited[selected, part] = value
print("controlled_frames_per_part:", mask.sum(axis=0).tolist())
print("max_change_outside_mask:", float(np.max(np.abs((edited-source)[~mask]))))
boundary_jump = np.max(np.abs(np.diff(edited, axis=0)), axis=0)
print("max_frame_angle_change_deg:", np.round(boundary_jump, 4).tolist())
fig, axes = plt.subplots(2, 1, figsize=(7, 4), sharex=True)
for part, ax in enumerate(axes):
    ax.plot(time, source[:, part], label="source", alpha=0.7)
    ax.plot(time, edited[:, part], label="masked edit")
    ax.fill_between(time, -15, 70, where=mask[:, part], alpha=0.12)
    ax.set(ylabel=f"{parts[part]} (deg)")
    ax.legend(fontsize=8)
axes[-1].set_xlabel("Time (s)")
fig.tight_layout()
plt.show()
