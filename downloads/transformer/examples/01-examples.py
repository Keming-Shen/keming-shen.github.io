# Requires torch and matplotlib; run with linked CSV/JSON files in the working directory.
# Cells execute in reading order and may reuse earlier variables.

# %% ch01-affine
import torch
from torch import nn

x = torch.tensor([2., -1.])
W1 = torch.tensor([[1., -1., .5], [.5, 1., -1.]])
b1 = torch.tensor([0., .5, 1.])
a = x @ W1 + b1
print(a)

# %% ch01-linear-api
fc1 = nn.Linear(2, 3)
with torch.no_grad():
    fc1.weight.copy_(W1.T)
    fc1.bias.copy_(b1)
print(fc1(x).detach())
print(torch.allclose(fc1(x), a))

# %% ch01-relu
h = torch.relu(a)
print(h)

# %% ch01-activations
import matplotlib.pyplot as plt
import torch.nn.functional as F

u = torch.linspace(-3, 3, 401)
functions = {"ReLU": F.relu, "Sigmoid": torch.sigmoid,
             "Tanh": torch.tanh, "GELU": F.gelu}
fig, axes = plt.subplots(1, 4, figsize=(10, 2.6))
for ax, (name, function) in zip(axes, functions.items()):
    ax.plot(u, function(u), color="#2679ad", linewidth=2)
    ax.axhline(0, color="0.75", linewidth=.7)
    ax.axvline(0, color="0.75", linewidth=.7)
    ax.set(title=name, xlabel="u")
    ax.grid(alpha=.2)
fig.tight_layout()
plt.show()

# %% ch01-mlp
W2 = torch.tensor([[1., -1.], [.5, .5], [-1., 1.]])
b2 = torch.tensor([.1, -.1])
z = h @ W2 + b2
print(z)

# %% ch01-batch
X = torch.tensor([[2., -1.], [-1., 2.]])
H = torch.relu(X @ W1 + b1)
Z = H @ W2 + b2
print(H)
print(Z)
