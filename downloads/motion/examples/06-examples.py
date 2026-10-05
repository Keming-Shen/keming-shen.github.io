# Numerical tutorial examples. Requires numpy, torch, matplotlib.
# Formula/interface checks and analysis of saved motion outputs.
# Pretrained inference is documented separately in model-run/.

# %% ch06-time-order
import numpy as np
import matplotlib.pyplot as plt

fps = 20
down = np.array([1.00, 0.94, 0.82, 0.70, 0.62, 0.60])
up = down[::-1].copy()
time = np.arange(len(down)) / fps
print(f"mean height: down={down.mean():.4f}, up={up.mean():.4f}")
print(f"net change: down={down[-1]-down[0]:.4f}, up={up[-1]-up[0]:.4f}")
print(f"mean speed: down={np.diff(down).mean()*fps:.4f}, "
      f"up={np.diff(up).mean()*fps:.4f} m/s")
fig, ax = plt.subplots(figsize=(6, 3))
ax.plot(time, down, "o-", label="lowering")
ax.plot(time, up, "s-", label="rising")
ax.set(xlabel="Time (s)", ylabel="Synthetic pelvis height (m)")
ax.grid(alpha=.25)
ax.legend()
fig.tight_layout()
plt.show()

# %% ch06-decoder-masks
import torch
from torch import nn

torch.manual_seed(6)
embedding = nn.Embedding(12, 16)
layer = nn.TransformerDecoderLayer(
    d_model=16, nhead=4, dim_feedforward=32,
    dropout=0.0, batch_first=True)
decoder = nn.TransformerDecoder(layer, num_layers=2).eval()
head = nn.Linear(16, 12)
source = torch.randn(1, 6, 16)
source_padding = torch.tensor([[False, False, False, False, True, True]])
input_ids = torch.tensor([[1, 4, 5, 6]])
labels = torch.tensor([[4, 5, 6, 2]])
causal = torch.triu(torch.ones(4, 4, dtype=torch.bool), diagonal=1)

def run(ids, memory):
    hidden = decoder(embedding(ids), memory,
                     tgt_mask=causal, memory_key_padding_mask=source_padding)
    return head(hidden)

with torch.no_grad():
    logits = run(input_ids, source)
    changed_source = source.clone()
    changed_source[:, 4:] += 100.0
    masked_logits = run(input_ids, changed_source)
    changed_ids = input_ids.clone()
    changed_ids[:, 2:] = torch.tensor([[9, 10]])
    future_logits = run(changed_ids, source)
loss = nn.functional.cross_entropy(logits.flatten(0, 1), labels.flatten())
print("logits shape:", tuple(logits.shape))
print("changed padded memory:",
      torch.allclose(logits, masked_logits, atol=1e-6))
print("changed future tokens:",
      torch.allclose(logits[:, :2], future_logits[:, :2], atol=1e-6))
print("finite training loss:", bool(torch.isfinite(loss)))

# %% ch06-retrieval-order
import numpy as np
import matplotlib.pyplot as plt

motion = np.array([[1., 1., 1.], [1., 1., -1.]])
text = np.array([[1., 1., 1.], [1., 1., -1.], [1., 0., 0.]])
def cosine(a, b):
    a = a / np.linalg.norm(a, axis=1, keepdims=True)
    b = b / np.linalg.norm(b, axis=1, keepdims=True)
    return a @ b.T

bag_scores = cosine(motion[:, :2], text[:, :2])
order_scores = cosine(motion, text)
print("event-set scores:\n", np.round(bag_scores, 3), sep="")
print("order-aware scores:\n", np.round(order_scores, 3), sep="")
print("best caption indices:", order_scores.argmax(axis=1).tolist())
fig, axes = plt.subplots(1, 2, figsize=(8, 3))
for ax, scores, title in zip(axes, [bag_scores, order_scores],
                             ["Event set", "Events and order"]):
    ax.imshow(scores, vmin=0, vmax=1, cmap="Blues")
    for i in range(2):
        for j in range(3):
            ax.text(j, i, f"{scores[i,j]:.2f}", ha="center", va="center",
                    color="white" if scores[i,j] > .8 else "black")
    ax.set(xticks=range(3), xticklabels=["sit then wave", "wave then sit", "sit"],
           yticks=range(2), yticklabels=["sit then wave", "wave then sit"],
           title=title)
    ax.tick_params(axis="x", labelrotation=25)
fig.tight_layout()
plt.show()
