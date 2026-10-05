# Numerical tutorial examples. Requires numpy, torch, matplotlib.
# Formula/interface checks and analysis of saved motion outputs.
# Pretrained inference is documented separately in model-run/.

# %% ch05-finite-dpo
import numpy as np
import torch
import matplotlib.pyplot as plt

torch.manual_seed(5)
ref = torch.tensor([0.40, 0.35, 0.25], dtype=torch.float64)
log_ref = ref.log()
logits = torch.nn.Parameter(log_ref.clone())
optimizer = torch.optim.SGD([logits], lr=0.12)
beta = 0.8
history = []

for step in range(121):
    log_p = torch.log_softmax(logits, dim=0)
    gap = (log_p[0] - log_ref[0]) - (log_p[1] - log_ref[1])
    loss = -torch.nn.functional.logsigmoid(beta * gap)
    p = log_p.exp()
    kl = (p * (log_p - log_ref)).sum()
    history.append([*p.detach().numpy(), gap.item(), kl.item()])
    if step < 120:
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

history = np.array(history)
print("initial probabilities:", np.round(history[0, :3], 6))
print("final probabilities:", np.round(history[-1, :3], 6))
print("relative preference gap:", round(history[-1, 3], 6))
print("KL to reference:", round(history[-1, 4], 6))
fig, axes = plt.subplots(1, 2, figsize=(10, 3.3))
for k, name in enumerate(["preferred", "rejected", "uncompared"]):
    axes[0].plot(history[:, k], label=name)
axes[0].set(xlabel="update", ylabel="candidate probability")
axes[0].legend()
axes[1].plot(history[:, 3], label="relative gap")
axes[1].plot(history[:, 4], label="KL")
axes[1].set(xlabel="update", ylabel="value")
axes[1].legend()
fig.tight_layout()
plt.show()

# %% ch05-local-gradient
import numpy as np
import torch
import matplotlib.pyplot as plt

dtype = torch.float64
theta = torch.tensor(0.65, dtype=dtype, requires_grad=True)
x0 = torch.tensor(1.2, dtype=dtype)
steps = 6
x = x0
for _ in range(steps):
    x = theta * x
full_grad = torch.autograd.grad(x, theta)[0]

state = x0
for _ in range(steps - 1):
    state = (theta * state).detach()
local_output = theta * state
local_grad = torch.autograd.grad(local_output, theta)[0]
analytic_full = steps * theta.detach() ** (steps - 1) * x0
analytic_local = theta.detach() ** (steps - 1) * x0
print("same forward value:", torch.allclose(x.detach(), local_output.detach()))
print("full gradient:", round(full_grad.item(), 8))
print("local gradient:", round(local_grad.item(), 8))
print("matches analytic:", bool(torch.allclose(full_grad, analytic_full)
                                and torch.allclose(local_grad, analytic_local)))

lengths = np.arange(1, 21)
full = lengths * 0.65 ** (lengths - 1) * 1.2
local = 0.65 ** (lengths - 1) * 1.2
plt.figure(figsize=(7, 3.2))
plt.plot(lengths, full, "o-", label="complete chain")
plt.plot(lengths, local, "s-", label="last step with detached history")
plt.xlabel("number of repeated multiplications")
plt.ylabel("output derivative w.r.t. shared parameter")
plt.legend()
plt.tight_layout()
plt.show()
