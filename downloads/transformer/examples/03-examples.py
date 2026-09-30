# Requires torch and matplotlib; run with linked CSV/JSON files in the working directory.
# Cells execute in reading order and may reuse earlier variables.

# %% ch03-lookup
import torch
import torch.nn.functional as F
from torch import nn

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


ids = torch.tensor([2, 4, 5, 6, 3], dtype=torch.long)
X = embedding(ids)
one_hot = F.one_hot(ids, num_classes=9).to(E.dtype)
print(X.detach())
print(torch.allclose(X, one_hot @ E))

# %% ch03-batch
ids = torch.tensor([[2, 4, 5, 6, 3], [2, 4, 5, 3, 0]])
X = embedding(ids)
print(X.shape)
print(X[0, 1].detach())
print(nn.Linear(4, 6)(X).shape)

# %% ch03-axes
small = torch.arange(6).reshape(2, 3)
print(small.transpose(0, 1))
print(small.reshape(3, 2))

# %% ch03-padding
valid = ids.ne(0)
masked_sum = (X * valid[..., None]).sum(dim=1)
mean_valid = masked_sum / valid.sum(dim=1, keepdim=True)
print(valid)
print(mean_valid[1].detach())
print(X.mean(dim=1)[1].detach())
