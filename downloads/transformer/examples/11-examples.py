# Requires torch and matplotlib; run with linked CSV/JSON files in the working directory.
# Cells execute in reading order and may reuse earlier variables.

# %% ch11-shift
import torch

target = torch.tensor([[1, 4, 5, 6, 2], [1, 7, 8, 2, 0]])
prefix = target[:, :-1]   # 解码器已知的前缀
labels = target[:, 1:]    # 每个位置需要预测的下一项
print(prefix)
print(labels)

# %% ch11-masked-loss
import torch.nn.functional as F

logits_example = torch.tensor([[[0., 2., -1.], [0., -1., 2.], [4., 0., 0.]]])
labels_example = torch.tensor([[1, 2, 0]])  # 0 为填充标签
losses = F.cross_entropy(logits_example.reshape(-1, 3),
                         labels_example.reshape(-1), ignore_index=0, reduction="none")
valid_count = labels_example.ne(0).sum()
loss_mean = losses.sum() / valid_count
print(losses)
print(f"valid tokens = {valid_count}, mean loss = {loss_mean:.4f}")

# %% ch11-training-curves
import json
import matplotlib.pyplot as plt

with open("11-history.json", encoding="utf-8") as file:
    history = json.load(file)
epochs = [row["epoch"] for row in history]
best = min(history, key=lambda row: row["loss_per_token"])
fig, axes = plt.subplots(1, 2, figsize=(9, 3))
axes[0].semilogy(epochs, [r["train_loss"] for r in history], label="Training updates")
axes[0].semilogy(epochs, [r["loss_per_token"] for r in history], label="Validation")
axes[1].plot(epochs, [r["token_accuracy"] for r in history], color="#2679ad")
for ax in axes:
    ax.set_xlabel("Epoch")
    ax.axvline(best["epoch"], color="0.5", linestyle="--", linewidth=1)
    ax.grid(alpha=.2)
axes[0].set_ylabel("Cross-entropy (log scale)")
axes[0].legend()
axes[1].set(ylabel="Validation token accuracy", ylim=(0, 1.03))
fig.tight_layout()
print(f"selected epoch = {best['epoch']}")
print(f"validation loss = {best['loss_per_token']:.6f}")
plt.show()
