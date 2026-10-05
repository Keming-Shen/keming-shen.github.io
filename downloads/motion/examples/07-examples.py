# Numerical tutorial examples. Requires numpy, torch, matplotlib.
# Formula/interface checks and analysis of saved motion outputs.
# Pretrained inference is documented separately in model-run/.

# %% ch07-code-vocabulary
import numpy as np

codebook = np.array([[0., 0.], [1., 0.], [0., 1.], [1., 1.]])
latent = np.array([[.1, .2], [.8, .1], [.2, .9], [.9, 1.2]])
distances = ((latent[:, None, :] - codebook[None, :, :])**2).sum(-1)
code_ids = distances.argmin(axis=1)
reconstruction = codebook[code_ids]
base_vocab = ["<pad>", "<bos>", "<eos>", "Generate", "motion", ":",
              "text", "walk", "then", "wave"]
K = len(codebook)
symbols = [f"<motion_id_{i}>" for i in range(K + 3)]
vocabulary = base_vocab + symbols
token_to_id = {token: i for i, token in enumerate(vocabulary)}
motion_symbols = [symbols[K]] + [symbols[i] for i in code_ids] + [symbols[K+1]]
language_ids = [token_to_id[token] for token in motion_symbols]
decoded_codes = [symbols.index(vocabulary[i]) for i in language_ids[1:-1]]
print("motion code ids:", code_ids.tolist())
print("language vocab ids:", language_ids)
print("decoded code ids:", decoded_codes)
print(f"quantization MSE: {np.mean((latent-reconstruction)**2):.4f}")
print("vocabulary size:", len(vocabulary))

# %% ch07-task-gradients
import torch

theta = torch.zeros(2, dtype=torch.float64, requires_grad=True)
text_target = torch.tensor([1., 0.], dtype=torch.float64)
motion_target = torch.tensor([-1., 1.], dtype=torch.float64)
text_loss = .5 * ((theta-text_target)**2).sum()
motion_loss = .5 * ((theta-motion_target)**2).sum()
gt = torch.autograd.grad(text_loss, theta, retain_graph=True)[0]
gm = torch.autograd.grad(motion_loss, theta)[0]
print("text gradient:", gt.tolist())
print("motion gradient:", gm.tolist())
print("gradient dot product:", float(gt @ gm))
for motion_weight in [.2, 1., 2.]:
    new_theta = theta.detach() - .1 * (gt + motion_weight*gm)
    new_text_loss = .5 * ((new_theta-text_target)**2).sum()
    rounded_theta = [round(float(v), 4) for v in new_theta]
    print(f"motion weight={motion_weight:.1f}: theta={rounded_theta}, "
          f"text loss={new_text_loss:.4f}")

# %% ch07-codec-causality
import numpy as np
import matplotlib.pyplot as plt

x = np.arange(8, dtype=float)
x_changed = x.copy()
x_changed[4:] += 10
def centered(values):
    padded = np.pad(values, (1, 1), mode="edge")
    return np.array([padded[i:i+3].mean() for i in range(len(values))])
def causal(values):
    padded = np.pad(values, (2, 0), mode="edge")
    return np.array([padded[i:i+3].mean() for i in range(len(values))])

a, b = centered(x), centered(x_changed)
c, d = causal(x), causal(x_changed)
print("centered prefix difference:", np.round((b-a)[:4], 4).tolist())
print("causal prefix difference:", np.round((d-c)[:4], 4).tolist())
fig, axes = plt.subplots(1, 2, figsize=(8, 3))
for ax, before, after, title in zip(axes, [a, c], [b, d],
                                   ["Centered codec", "Causal codec"]):
    ax.plot(before, "o-", label="original")
    ax.plot(after, "s--", label="future changed")
    ax.axvline(3.5, color="grey", linestyle=":")
    ax.set(xlabel="Frame index", ylabel="Filtered value", title=title)
    ax.grid(alpha=.2)
    ax.legend(fontsize=8)
fig.tight_layout()
plt.show()

# %% ch07-flow-time
import numpy as np
import matplotlib.pyplot as plt

noise = np.array([-1.0, 0.0, 1.0])
target = np.array([0.2, 0.8, 1.4])
velocity = target - noise  # 已知端点给出的精确场，非训练模型
steps = 10
state = noise.copy()
trajectory = [state.copy()]
for _ in range(steps):
    state = state + velocity / steps
    trajectory.append(state.copy())
trajectory = np.stack(trajectory)
sample_time = np.linspace(0, 1, steps+1)
print("sampled endpoint:", np.round(state, 4).tolist())
print(f"endpoint error: {np.linalg.norm(state-target):.8f}")
print("latent dimensionality:", len(state))
print("sampling steps:", steps)
fig, ax = plt.subplots(figsize=(6, 3))
for j in range(3):
    ax.plot(sample_time, trajectory[:, j], "o-", label=f"coordinate {j}")
ax.set(xlabel="Sampling time s", ylabel="One latent vector's coordinates")
ax.grid(alpha=.2)
ax.legend()
fig.tight_layout()
plt.show()
