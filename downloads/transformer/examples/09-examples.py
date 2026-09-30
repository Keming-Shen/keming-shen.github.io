# Requires torch and matplotlib; run with linked CSV/JSON files in the working directory.
# Cells execute in reading order and may reuse earlier variables.

# %% ch09-basic-block
import torch
from torch import nn

class BasicBlock(nn.Module):
    def __init__(self, in_channels, out_channels, stride=1):
        super().__init__()
        self.branch = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, 3,
                      stride=stride, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(),
            nn.Conv2d(out_channels, out_channels, 3,
                      padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
        )
        self.skip = nn.Identity()
        if stride != 1 or in_channels != out_channels:
            self.skip = nn.Sequential(
                nn.Conv2d(in_channels, out_channels, 1,
                          stride=stride, bias=False),
                nn.BatchNorm2d(out_channels),
            )
        self.relu = nn.ReLU()

    def forward(self, x):
        return self.relu(self.skip(x) + self.branch(x))

block = BasicBlock(16, 32, stride=2)
print(block(torch.randn(2, 16, 32, 32)).shape)

# %% ch09-layernorm
r = torch.tensor([
    0.09113097424710079, 1.1757215219086419,
    1.081850974728331,   0.5796295297039902,
], dtype=torch.float64)

manual = (r - r.mean()) / torch.sqrt(
    r.var(unbiased=False) + 1e-5
)
ln = nn.LayerNorm(4, eps=1e-5, elementwise_affine=False)
assert torch.allclose(manual, ln(r))
print(manual)
print(f"mean = {manual.mean():.6f}, variance = {manual.var(unbiased=False):.6f}")

# %% ch09-ffn
ffn = nn.Sequential(
    nn.Linear(4, 8),
    nn.ReLU(),
    nn.Linear(8, 4),
)
sample = torch.zeros(2, 3, 4)  # 两个样本，每个三个位置
assert ffn(sample).shape == (2, 3, 4)
print(ffn(sample).shape)
changed = sample.clone()
changed[0, 0] = 1.
print(torch.allclose(ffn(sample)[0, 1:], ffn(changed)[0, 1:]))
