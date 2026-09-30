# Requires torch and matplotlib; run with linked CSV/JSON files in the working directory.
# Cells execute in reading order and may reuse earlier variables.

# %% ch05-sequence-loss
import torch
import matplotlib.pyplot as plt

p = torch.tensor([.70, .80, .75, .90], dtype=torch.float64)
nll = -p.log()
print(f"P(sequence) = {p.prod():.4f}")
print(f"total NLL = {nll.sum():.4f}, mean NLL = {nll.mean():.4f}")
fig, ax = plt.subplots(figsize=(6, 2.8))
ax.bar(["token 1", "token 2", "token 3", "<eos>"], nll, color="#2679ad")
ax.set(ylabel="Negative log-likelihood", ylim=(0, .45))
ax.grid(axis="y", alpha=.2)
fig.tight_layout()
plt.show()

# %% ch05-rnn
import torch
from torch import nn

torch.manual_seed(42)
embedding = nn.Embedding(8, 12)
cell = nn.RNNCell(input_size=12, hidden_size=16)
output = nn.Linear(16, 8)

prefix_ids = torch.tensor([[1, 3, 4]])  # 一条长度为 3 的前缀
state = torch.zeros(1, 16)
for token_ids in prefix_ids.unbind(dim=1):
    state = cell(embedding(token_ids), state)
    next_logits = output(state)
assert next_logits.shape == (1, 8)
print(state.shape)
print(next_logits.shape)

# %% ch05-causal-mask
blocked = torch.ones(4, 4, dtype=torch.bool).triu(1)
print(blocked.to(torch.int))  # 1 表示禁止访问
