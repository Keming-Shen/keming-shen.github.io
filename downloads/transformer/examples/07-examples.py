# Requires torch and matplotlib; run with linked CSV/JSON files in the working directory.
# Cells execute in reading order and may reuse earlier variables.

# %% ch07-softmax
import torch
import math

scores = torch.tensor([1.2, 2.6, 1.8], dtype=torch.float64)
print(scores.softmax(-1))

# %% ch07-dot-variance
import matplotlib.pyplot as plt

generator = torch.Generator().manual_seed(7)
fig, axes = plt.subplots(1, 2, figsize=(9, 3))
for dim in [4, 16, 64]:
    q_sample = torch.randn(20000, dim, generator=generator)
    k_sample = torch.randn(20000, dim, generator=generator)
    dot = (q_sample * k_sample).sum(-1)
    scaled = dot / math.sqrt(dim)
    axes[0].hist(dot, bins=90, density=True, histtype="step", label=f"d = {dim}")
    axes[1].hist(scaled, bins=90, density=True, histtype="step", label=f"d = {dim}")
    print(f"d={dim:2d}: variance={dot.var(unbiased=False):.3f}, scaled={scaled.var(unbiased=False):.3f}")
for ax, title in zip(axes, ["Dot product", "Scaled dot product"]):
    ax.set(title=title, xlabel="Score", ylabel="Density")
    ax.legend()
fig.tight_layout()
plt.show()

# %% ch07-matrix-attention
Q = torch.tensor([[.6, .8], [.2, 1.3], [1., 0.]], dtype=torch.float64)
K = torch.tensor([[1.2, .4], [2.6, -.5], [1.8, 1.2]], dtype=torch.float64)
V = torch.tensor([[1., 0.], [0., 2.], [-1., 1.]], dtype=torch.float64)
A = (Q @ K.T / math.sqrt(2)).softmax(-1)
O = A @ V
print(A)
print(O)
print(A.sum(dim=-1))

# %% ch07-masked-attention
import math
import torch

def attention(q, k, v, allowed=None):
    scores = (q @ k.transpose(-2, -1)) / math.sqrt(q.size(-1))
    if allowed is not None:
        if not allowed.any(dim=-1).all():
            raise ValueError("每个查询至少需要一个允许访问的键")
        scores = scores.masked_fill(~allowed, float("-inf"))
    weights = torch.softmax(scores, dim=-1)
    return weights @ v, weights

# 一句话、三个位置、每个向量两个分量。
q = torch.tensor([[[0.6, 0.8], [0.2, 1.3], [1.0, 0.0]]])
k = torch.tensor([[[1.2, 0.4], [2.6, -0.5], [1.8, 1.2]]])
v = torch.tensor([[[1.0, 0.0], [0.0, 2.0], [-1.0, 1.0]]])
output, weights = attention(q, k, v)
print(weights[0, 2])   # tensor([0.1916, 0.5156, 0.2928])
print(output[0, 2])    # tensor([-0.1012,  1.3240])

# 用右移后的目标输入演示因果约束时，禁止读取右上三角。
allowed = torch.ones(3, 3, dtype=torch.bool).tril().unsqueeze(0)
causal_output, causal_weights = attention(q, k, v, allowed)
assert causal_weights[0, 0, 1:].eq(0).all()
torch.testing.assert_close(weights.sum(-1), torch.ones(1, 3))
print(causal_weights[0])
