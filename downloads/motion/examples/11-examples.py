# Numerical tutorial examples. Requires numpy, torch, matplotlib.
# Formula/interface checks and analysis of saved motion outputs.
# Pretrained inference is documented separately in model-run/.

# %% ch11-retarget-ik
import numpy as np
import matplotlib.pyplot as plt

def inverse_kinematics(target, lengths):
    x, y = target
    l1, l2 = lengths
    cosine = (x*x+y*y-l1*l1-l2*l2) / (2*l1*l2)
    if abs(cosine) > 1:
        return None
    q2 = np.arccos(np.clip(cosine, -1, 1))
    q1 = np.arctan2(y, x) - np.arctan2(l2*np.sin(q2), l1+l2*np.cos(q2))
    return np.array([q1, q2])

def joints(angles, lengths):
    directions = np.cumsum(angles)
    offsets = np.asarray(lengths)[:, None] * \
              np.stack([np.cos(directions), np.sin(directions)], axis=-1)
    return np.vstack([np.zeros(2), np.cumsum(offsets, axis=0)])

target = np.array([0.6, 0.6])
human_lengths = [0.5, 0.5]
robot_lengths = [0.35, 0.35]
human_q = inverse_kinematics(target, human_lengths)
robot_same_target = inverse_kinematics(target, robot_lengths)
copied = joints(human_q, robot_lengths)
scaled_target = target * (sum(robot_lengths)/sum(human_lengths))
robot_q = inverse_kinematics(scaled_target, robot_lengths)
print("机器人能否到达原世界目标:", robot_same_target is not None)
print(f"直接复制关节角的手部误差: {np.linalg.norm(copied[-1]-target):.6f} m")
print("缩放后的目标:", np.array2string(scaled_target, precision=2))
print(f"机器人对缩放目标的误差: {np.linalg.norm(joints(robot_q, robot_lengths)[-1]-scaled_target):.6f} m")

fig, ax = plt.subplots(figsize=(5.5, 4))
ax.plot(*joints(human_q, human_lengths).T, "o-", label="Human proxy")
ax.plot(*copied.T, "o-", label="Robot, copied angles")
ax.scatter(*target, marker="x", s=100, label="World target")
ax.scatter(*scaled_target, marker="s", s=60, label="Scaled target")
ax.set(xlabel="x (m)", ylabel="y (m)", aspect="equal")
ax.legend()
ax.grid(alpha=0.3)
fig.tight_layout()
plt.show()

# %% ch11-contact-feasibility
import numpy as np
import matplotlib.pyplot as plt

mass, gravity, height, mu = 50.0, 9.81, 0.9, 0.6
support_half = 0.15
normal_force = mass * gravity
friction_limit = mu * normal_force
for acceleration in [0.5, 2.0, 8.0]:
    horizontal_force = mass * acceleration
    zmp = -height * acceleration / gravity
    friction_ok = abs(horizontal_force) <= friction_limit
    support_ok = abs(zmp) <= support_half
    print(f"a={acceleration:.1f}: Fx={horizontal_force:.1f} N, "
          f"ZMP={zmp:.6f} m, friction={friction_ok}, support={support_ok}")
print(f"水平摩擦上限: {friction_limit:.1f} N")

a = np.linspace(-8, 8, 301)
zmp = -height * a / gravity
fig, axes = plt.subplots(1, 2, figsize=(9, 3.5))
axes[0].plot(a, zmp)
axes[0].axhspan(-support_half, support_half, color="C2", alpha=0.2)
axes[0].set(xlabel="Horizontal acceleration (m/s²)", ylabel="ZMP (m)")
axes[1].plot(a, mass*a)
axes[1].axhspan(-friction_limit, friction_limit, color="C2", alpha=0.2)
axes[1].set(xlabel="Horizontal acceleration (m/s²)", ylabel="Required Fx (N)")
for ax in axes:
    ax.grid(alpha=0.3)
fig.tight_layout()
plt.show()
