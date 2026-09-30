# -*- coding: utf-8 -*-
# Hand-set teaching parameters; no training or semantic claims.
import torch
import torch.nn.functional as F
from torch import nn

ids = torch.tensor([[2, 4, 5, 6, 3],
                    [2, 4, 5, 3, 0]], dtype=torch.long)

E = torch.tensor([
    [0., 0., 0., 0.],       # <pad>
    [.1, .1, .1, .1],       # <unk>
    [0., 0., 1., 0.],       # <bos>
    [0., 0., 0., 1.],       # <eos>
    [1., 0., .5, -.5],      # 我
    [0., 1., -.5, .5],      # 喜欢
    [-1., 0., .5, .5],      # 你
    [.2, -.3, .7, .1],      # bank
    [.1, .8, -.2, .4],      # river
])

embedding = nn.Embedding(9, 4, padding_idx=0)
with torch.no_grad():
    embedding.weight.copy_(E)

X = embedding(ids)
one_hot = F.one_hot(ids, num_classes=9).to(E.dtype)
assert torch.allclose(X, one_hot @ E)

valid = ids.ne(0)
masked_sum = (X * valid[..., None]).sum(dim=1)
mean_valid = masked_sum / valid.sum(dim=1, keepdim=True)

print(X.shape)                 # torch.Size([2, 5, 4])
print(X[0, 1].detach())        # tensor([1., 0., .5, -.5])
print(mean_valid[1].detach())  # tensor([.25, .25, .25, .25])
print(X.mean(dim=1)[1].detach())  # tensor([.2, .2, .2, .2])
print(nn.Linear(4, 6)(X).shape)   # torch.Size([2, 5, 6])
