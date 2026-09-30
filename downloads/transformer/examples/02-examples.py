# Requires torch and matplotlib; run with linked CSV/JSON files in the working directory.
# Cells execute in reading order and may reuse earlier variables.

# %% ch02-softmax
import torch

z = torch.tensor([-1.4, 1.4], dtype=torch.float64)
p = z.softmax(dim=-1)
print(p)
print(f"sum = {p.sum().item():.4f}")

# %% ch02-temperature
import matplotlib.pyplot as plt

z4 = torch.tensor([2., 1., 0., -1.], dtype=torch.float64)
fig, axes = plt.subplots(1, 3, figsize=(9, 2.8), sharey=True)
for ax, tau in zip(axes, [.5, 1., 2.]):
    probability = (z4 / tau).softmax(-1)
    ax.bar(range(4), probability, color="#2679ad")
    ax.set(title=f"tau = {tau:g}", xlabel="Class", xticks=range(4), ylim=(0, 1))
    print(f"tau={tau:g}:", [round(v, 4) for v in probability.tolist()])
axes[0].set_ylabel("Probability")
fig.tight_layout()
plt.show()

# %% ch02-nll
probability = torch.linspace(.01, 1., 300, dtype=torch.float64)
fig, ax = plt.subplots(figsize=(6, 3))
ax.plot(probability, -probability.log(), color="#2679ad", label="-log(p)")
example = torch.tensor([.0573, .9427], dtype=torch.float64)
ax.scatter(example, -example.log(), color="#c96c42", zorder=3)
for value in example:
    ax.annotate(f"({value:.4f}, {-value.log():.3f})",
                (value.item(), -value.log().item()), xytext=(6, 8),
                textcoords="offset points", ha="left" if value < .5 else "right")
ax.set(xlabel="Probability of the target class", ylabel="Negative log-likelihood")
ax.grid(alpha=.2)
fig.tight_layout()
plt.show()

# %% ch02-cross-entropy
import torch
import torch.nn.functional as F

logits = torch.tensor([[-1.4, 1.4], [1.85, 1.65]],
                      dtype=torch.float64)
target = torch.tensor([1, 0], dtype=torch.long)

probabilities = logits.softmax(dim=-1)
loss_each = F.cross_entropy(logits, target, reduction="none")
loss_mean = F.cross_entropy(logits, target)

manual = -logits.log_softmax(dim=-1).gather(
    dim=1, index=target[:, None]
).squeeze(1)

print(probabilities)
print(loss_each)
print(loss_mean)
assert torch.allclose(loss_each, manual)

# %% ch02-entropy
P = torch.tensor([.5, .5], dtype=torch.float64)
Q = torch.tensor([.9, .1], dtype=torch.float64)
entropy = -(P * P.log()).sum()
cross_entropy = -(P * Q.log()).sum()
kl = (P * (P / Q).log()).sum()
print(f"H(P) = {entropy:.4f}, H(P,Q) = {cross_entropy:.4f}, KL = {kl:.4f}")
print(torch.allclose(cross_entropy, entropy + kl))
