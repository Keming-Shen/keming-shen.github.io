# Requires torch and matplotlib; run with linked CSV/JSON files in the working directory.
# Cells execute in reading order and may reuse earlier variables.

# %% ch10-encoder
import torch
from torch import nn

torch.manual_seed(42)
encoder = nn.TransformerEncoderLayer(
    d_model=32, nhead=4, dim_feedforward=64,
    dropout=0., batch_first=True, norm_first=False,
)
source_vectors = torch.randn(1, 3, 32)
memory = encoder(source_vectors)
print(memory.shape)

# %% ch10-decoder
decoder = nn.TransformerDecoderLayer(
    d_model=32, nhead=4, dim_feedforward=64,
    dropout=0., batch_first=True, norm_first=False,
)
target_vectors = torch.randn(1, 4, 32)
future = torch.ones(4, 4, dtype=torch.bool).triu(1)
decoded = decoder(target_vectors, memory, tgt_mask=future)
print(decoded.shape)

# %% ch10-full-model
import math
import torch
from torch import nn

class TranslationTransformer(nn.Module):
    def __init__(self, vocab_size, pad_id=0, d=512,
                 heads=8, hidden=2048, layers=6):
        super().__init__()
        assert d % 2 == 0 and d % heads == 0
        self.pad_id, self.d = pad_id, d
        self.embedding = nn.Embedding(vocab_size, d, padding_idx=pad_id)
        self.input_dropout = nn.Dropout(0.1)
        options = dict(d_model=d, nhead=heads, dim_feedforward=hidden,
                       dropout=0.1, activation="relu",
                       batch_first=True, norm_first=False)
        self.encoder = nn.ModuleList([
            nn.TransformerEncoderLayer(**options) for _ in range(layers)
        ])
        self.decoder = nn.ModuleList([
            nn.TransformerDecoderLayer(**options) for _ in range(layers)
        ])
        self.readout = nn.Linear(d, vocab_size, bias=False)
        self.readout.weight = self.embedding.weight

    def embed_positions(self, ids):
        x = self.embedding(ids) * math.sqrt(self.d)
        p = torch.arange(ids.size(1), device=x.device,
                         dtype=x.dtype)[:, None]
        omega = torch.exp(torch.arange(0, self.d, 2, device=x.device,
                                      dtype=x.dtype)
                          * (-math.log(10000.0) / self.d))
        pe = torch.zeros(ids.size(1), self.d, device=x.device, dtype=x.dtype)
        pe[:, 0::2], pe[:, 1::2] = torch.sin(p * omega), torch.cos(p * omega)
        return self.input_dropout(x + pe)

    def forward(self, source, target_input):
        source_pad = source.eq(self.pad_id)
        target_pad = target_input.eq(self.pad_id)
        memory = self.embed_positions(source)
        for layer in self.encoder:
            memory = layer(memory, src_key_padding_mask=source_pad)
        h = self.embed_positions(target_input)
        length = target_input.size(1)
        future = torch.ones(length, length, dtype=torch.bool,
                            device=h.device).triu(1)
        for layer in self.decoder:
            h = layer(h, memory, tgt_mask=future,
                      tgt_key_padding_mask=target_pad,
                      memory_key_padding_mask=source_pad)
        return self.readout(h)

# 共同词表：pad=0, bos=1, eos=2, I=3, like=4, you=5,
#           我=6, 喜欢=7, 你=8
source = torch.tensor([[3, 4, 5]])
target = torch.tensor([[1, 6, 7, 8, 2]])
model = TranslationTransformer(9, d=32, heads=4, hidden=64, layers=1)
logits = model(source, target[:, :-1])
labels = target[:, 1:]
assert logits.shape == (1, 4, 9)
criterion = nn.CrossEntropyLoss(ignore_index=0, label_smoothing=0.1)
loss = criterion(logits.reshape(-1, 9), labels.reshape(-1))
assert torch.isfinite(loss)
loss.backward()
print(logits.shape)
print("finite loss:", bool(torch.isfinite(loss)))
print("embedding gradient:", model.embedding.weight.grad is not None)

# %% ch10-learning-rate
import matplotlib.pyplot as plt

steps = torch.arange(1, 20001, dtype=torch.float64)
rates = 512 ** -.5 * torch.minimum(steps ** -.5, steps * 4000 ** -1.5)
peak = rates.argmax()
print(f"peak step = {int(steps[peak])}, learning rate = {rates[peak]:.7f}")
fig, ax = plt.subplots(figsize=(7, 3))
ax.plot(steps, rates, color="#2679ad")
ax.axvline(4000, color="#c96c42", linestyle="--", label="Warmup ends")
ax.set(xlabel="Update step", ylabel="Learning rate")
ax.grid(alpha=.2)
ax.legend()
fig.tight_layout()
plt.show()
