# Requires torch and matplotlib; run with linked CSV/JSON files in the working directory.
# Cells execute in reading order and may reuse earlier variables.

# %% ch04-gradient-step
import torch

w = torch.tensor(2.)
gradient = 2 * (3 * w - 1) * 3
new_w = w - .01 * gradient
print(f"gradient = {gradient.item():.2f}")
print(f"w = {new_w.item():.2f}, loss = {(3 * new_w - 1).square().item():.2f}")

# %% ch04-classifier
class Classifier(torch.nn.Module):
    def __init__(self, hidden=32, dropout=0.1):
        super().__init__()
        self.layers = torch.nn.Sequential(
            torch.nn.Linear(2, hidden),
            torch.nn.ReLU(),
            torch.nn.Dropout(dropout),
            torch.nn.Linear(hidden, hidden),
            torch.nn.ReLU(),
            torch.nn.Linear(hidden, 2),
        )

    def forward(self, features):
        return self.layers(features)

torch.manual_seed(42)
model = Classifier()
features = torch.tensor([[.8, .6], [-.8, .6]])
print(model(features).shape)
print(sum(parameter.numel() for parameter in model.parameters()))

# %% ch04-loss
example_logits = torch.tensor([[2., -1.]])
example_label = torch.tensor([1])
loss_value = torch.nn.functional.cross_entropy(example_logits, example_label)
print(f"loss = {loss_value.item():.4f}")

# %% ch04-autograd
w = torch.tensor(2.0, requires_grad=True)
loss = (3 * w - 1).square()
loss.backward()
print(w.item(), w.grad.item())

# %% ch04-training-curves
import csv
import matplotlib.pyplot as plt

with open("04-history.csv", encoding="utf-8") as file:
    history = [{key: float(value) for key, value in row.items()}
               for row in csv.DictReader(file)]
epochs = [row["epoch"] for row in history]
best = min(history, key=lambda row: row["val_loss"])
fig, axes = plt.subplots(1, 2, figsize=(9, 3))
for prefix, label, color in [("train", "Training", "#2679ad"),
                              ("val", "Validation", "#c96c42")]:
    axes[0].plot(epochs, [r[f"{prefix}_loss"] for r in history], label=label, color=color)
    axes[1].plot(epochs, [r[f"{prefix}_acc"] for r in history], label=label, color=color)
for ax in axes:
    ax.axvline(best["epoch"], color="0.5", linestyle="--", linewidth=1)
    ax.set_xlabel("Epoch")
    ax.grid(alpha=.2)
    ax.legend()
axes[0].set_ylabel("Cross-entropy")
axes[1].set_ylabel("Accuracy")
fig.tight_layout()
print(f"selected epoch = {int(best['epoch'])}")
print(f"validation loss = {best['val_loss']:.4f}, accuracy = {best['val_acc']:.4f}")
plt.show()
