# Numerical tutorial examples. Requires numpy, torch, matplotlib.
# Formula/interface checks and analysis of saved motion outputs.
# Pretrained inference is documented separately in model-run/.

# %% ch03-forward-noise
import numpy as np
import matplotlib.pyplot as plt

rng = np.random.default_rng(7)
time = np.arange(80) / 20.0
clean = np.sin(2 * np.pi * time / 2.0)
noise = rng.standard_normal(clean.shape)
fig, axes = plt.subplots(1, 3, figsize=(10, 2.8), sharey=True)
for ax, alpha_bar in zip(axes, [0.95, 0.60, 0.15]):
    observed = np.sqrt(alpha_bar) * clean + np.sqrt(1-alpha_bar) * noise
    recovered = (observed - np.sqrt(1-alpha_bar)*noise) / np.sqrt(alpha_bar)
    error = np.max(np.abs(recovered-clean))
    print(f"alpha_bar={alpha_bar:.2f}, oracle_max_error={error:.2e}")
    ax.plot(time, clean, label="clean", linewidth=2)
    ax.plot(time, observed, label="noisy", alpha=0.65)
    ax.set(title=f"alpha_bar={alpha_bar}", xlabel="Time (s)")
    ax.grid(alpha=0.2)
axes[0].set_ylabel("Synthetic joint coordinate")
axes[0].legend()
fig.tight_layout()
plt.show()

# %% ch03-masked-denoiser
import torch
from torch import nn

torch.manual_seed(3)
B, D, T, H = 2, 12, 8, 16
project = nn.Linear(D, H)
layer = nn.TransformerEncoderLayer(H, 4, 32, dropout=0.0)
encoder = nn.TransformerEncoder(layer, 1)
readout = nn.Linear(H, D)
x = torch.randn(B, D, 1, T)
lengths = torch.tensor([8, 5])
valid = torch.arange(T)[None, :] < lengths[:, None]
frames = x.permute(3, 0, 1, 2).reshape(T, B, D)
condition = torch.zeros(1, B, H)
tokens = torch.cat([condition, project(frames)], dim=0)
pad = torch.cat([torch.zeros(B, 1, dtype=torch.bool), ~valid], dim=1)
pred = readout(encoder(tokens, src_key_padding_mask=pad)[1:])
target = torch.zeros_like(pred)
mask = valid.T[..., None]
loss = (((pred-target)**2)*mask).sum() / (valid.sum()*D)
changed = pred.clone()
changed[~valid.T] = 1000.0
loss_changed = (((changed-target)**2)*mask).sum() / (valid.sum()*D)
print("input:", tuple(x.shape), "prediction:", tuple(pred.shape))
print("valid_frames:", int(valid.sum()))
print("padding_invariance:", bool(torch.allclose(loss, loss_changed)))

# %% ch03-residual-quantization
import numpy as np
import matplotlib.pyplot as plt

latent = np.array([-0.83, -0.37, 0.18, 0.74])
codebooks = [np.array([-1.0, -0.5, 0.0, 0.5, 1.0]),
             np.array([-0.2, -0.1, 0.0, 0.1, 0.2])]
residual = latent.copy()
reconstruction = np.zeros_like(latent)
history = [reconstruction.copy()]
for level, codebook in enumerate(codebooks, 1):
    ids = np.abs(residual[:, None]-codebook[None, :]).argmin(axis=1)
    chosen = codebook[ids]
    reconstruction += chosen
    residual -= chosen
    history.append(reconstruction.copy())
    print(f"level={level}, ids={ids.tolist()}, rmse={np.sqrt(np.mean(residual**2)):.4f}")
assert np.allclose(latent, reconstruction+residual)
fig, ax = plt.subplots(figsize=(6, 3))
ax.plot(latent, "ko-", label="latent")
for level, values in enumerate(history[1:], 1):
    ax.plot(values, "o--", label=f"reconstruction, level {level}")
ax.set(xlabel="Temporal token index", ylabel="Latent value")
ax.legend()
ax.grid(alpha=0.2)
fig.tight_layout()
plt.show()
