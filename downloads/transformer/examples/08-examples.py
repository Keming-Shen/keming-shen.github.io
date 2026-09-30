# Requires torch and matplotlib; run with linked CSV/JSON files in the working directory.
# Cells execute in reading order and may reuse earlier variables.

# %% ch08-heads
import math
import torch
import matplotlib.pyplot as plt

Q = torch.tensor([[[.6, .8], [.2, 1.3], [1., 0.]],
                  [[.2, .9], [1.1, -.2], [-.4, .7]]], dtype=torch.float64)
K = torch.tensor([[[1.2, .4], [2.6, -.5], [1.8, 1.2]],
                  [[.8, -.2], [.1, 1.2], [.9, .4]]], dtype=torch.float64)
V = torch.tensor([[[1., 0.], [0., 2.], [-1., 1.]],
                  [[.2, 1.], [1., -.4], [-.6, .5]]], dtype=torch.float64)
A = (Q @ K.transpose(-2, -1) / math.sqrt(2)).softmax(-1)
O = A @ V  # [头, 位置, 特征]
print("third query weights:", A[:, 2])
print("third query outputs:", O[:, 2])
fig, axes = plt.subplots(1, 2, figsize=(7, 3.1))
for head, ax in enumerate(axes):
    ax.imshow(A[head], vmin=0, vmax=1, cmap="Blues")
    for i in range(3):
        for j in range(3):
            ax.text(j, i, f"{A[head, i, j]:.3f}", ha="center", va="center")
    ax.set(title=f"Head {head + 1}", xlabel="Key position", ylabel="Query position",
           xticks=range(3), yticks=range(3))
fig.tight_layout()
plt.show()

# %% ch08-output-projection
WO = torch.tensor([[.7, -.2, .3, .1], [.2, .8, -.1, .3],
                   [-.3, .1, .7, .2], [.1, .4, -.2, .8]], dtype=torch.float64)
C = O.transpose(0, 1).reshape(3, 4)
M = C @ WO
print(C[2])
print(M[2])

# %% ch08-position-values
import math
import torch

def sinusoidal_positions(length, dim):
    assert dim % 2 == 0
    p = torch.arange(length, dtype=torch.float64)[:, None]
    omega = torch.exp(
        torch.arange(0, dim, 2, dtype=torch.float64)
        * (-math.log(10000.0) / dim)
    )
    pe = torch.zeros(length, dim, dtype=torch.float64)
    pe[:, 0::2] = torch.sin(p * omega)
    pe[:, 1::2] = torch.cos(p * omega)
    return pe

print(sinusoidal_positions(3, 4))

# %% ch08-position-map
pe = sinusoidal_positions(64, 32)
fig, ax = plt.subplots(figsize=(7, 3.2))
image = ax.imshow(pe.T, aspect="auto", cmap="RdBu_r", vmin=-1, vmax=1)
ax.set(xlabel="Position", ylabel="Feature dimension")
fig.colorbar(image, ax=ax, label="Encoding value")
fig.tight_layout()
plt.show()
