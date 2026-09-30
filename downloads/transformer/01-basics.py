# -*- coding: utf-8 -*-
# Hand-set teaching parameters; no training or semantic claims.
import torch
from torch import nn

X = torch.tensor([[2., -1.], [-1., 2.]])

# 本文公式中的矩阵：输入维度 × 输出维度
W1 = torch.tensor([[1., -1., 0.5],
                   [0.5, 1., -1.]])
b1 = torch.tensor([0., 0.5, 1.])
W2 = torch.tensor([[1., -1.],
                   [0.5, 0.5],
                   [-1., 1.]])
b2 = torch.tensor([0.1, -0.1])

fc1, fc2 = nn.Linear(2, 3), nn.Linear(3, 2)
with torch.no_grad():
    fc1.weight.copy_(W1.T)
    fc1.bias.copy_(b1)
    fc2.weight.copy_(W2.T)
    fc2.bias.copy_(b2)

A = fc1(X)
H = torch.relu(A)
Z = fc2(H)

print(A.detach())
print(H.detach())
print(Z.detach())
assert torch.allclose(Z, torch.relu(X @ W1 + b1) @ W2 + b2)
