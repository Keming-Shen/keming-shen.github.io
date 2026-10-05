# Numerical tutorial examples. Requires numpy, torch, matplotlib.
# Formula/interface checks and analysis of saved motion outputs.
# Pretrained inference is documented separately in model-run/.

# %% ch08-coordinate
import numpy as np
import matplotlib.pyplot as plt

root_a = np.array([0.0, 0.0])
root_b = np.array([1.0, 0.0])
hand_a = root_a + np.array([0.5, 0.0])
hand_b = root_b + np.array([-0.5, 0.0])
shift = np.array([2.0, 0.0])

gap_near = np.linalg.norm(hand_a - hand_b)
gap_far = np.linalg.norm(hand_a - (hand_b + shift))
local_near = hand_b - root_b
local_far = (hand_b + shift) - (root_b + shift)
global_shift = np.array([4.0, -3.0])
gap_common = np.linalg.norm((hand_a + global_shift) -
                            (hand_b + global_shift))
print(f"接触场景手部距离: {gap_near:.3f} m")
print(f"分离场景手部距离: {gap_far:.3f} m")
print(f"逐人规范化后的 B 手差异: {np.linalg.norm(local_near-local_far):.3f} m")
print(f"共同平移后的接触距离: {gap_common:.3f} m")

fig, axes = plt.subplots(1, 2, figsize=(9, 3), sharey=True)
for ax, extra, title in zip(axes, [np.zeros(2), shift],
                            ["Shared contact", "Separated placement"]):
    ax.plot([root_a[0], hand_a[0]], [0, 0], "o-", label="A")
    ax.plot([root_b[0]+extra[0], hand_b[0]+extra[0]], [0, 0],
            "o-", label="B")
    ax.set(xlim=(-0.2, 3.2), ylim=(-0.3, 0.3), title=title,
           xlabel="World x (m)", ylabel="World y (m)")
    ax.legend()
    ax.grid(alpha=0.3)
fig.tight_layout()
plt.show()

# %% ch08-equivariance
import math
import torch

torch.manual_seed(8)
torch.set_num_threads(1)
dtype = torch.float64
a = torch.randn(1, 4, 6, dtype=dtype)
b = torch.randn(1, 4, 6, dtype=dtype)
wq = torch.randn(6, 6, dtype=dtype) / math.sqrt(6)
wk = torch.randn(6, 6, dtype=dtype) / math.sqrt(6)
wv = torch.randn(6, 6, dtype=dtype) / math.sqrt(6)

def update(own, partner):
    scores = (own @ wq) @ (partner @ wk).transpose(-1, -2)
    attention = torch.softmax(scores / math.sqrt(6), dim=-1)
    return own + attention @ (partner @ wv)

def shared_pair(x, y):
    return update(x, y), update(y, x)

out_a, out_b = shared_pair(a, b)
swap_b, swap_a = shared_pair(b, a)
err = max((out_a-swap_a).abs().max().item(),
          (out_b-swap_b).abs().max().item())
# 错误顺序：B 读取 A 刚更新后的特征。
sequential_a = update(a, b)
sequential_b = update(b, sequential_a)
order_gap = (sequential_b-out_b).abs().max().item()
print("输出形状:", tuple(out_a.shape))
print(f"同步共享更新的置换误差: {err:.12f}")
print(f"顺序更新与同步更新的差异: {order_gap:.6f}")
