# Numerical tutorial examples. Requires numpy, torch, matplotlib.
# Formula/interface checks and analysis of saved motion outputs.
# Pretrained inference is documented separately in model-run/.

# %% ch01-rotation6d
import numpy as np
import matplotlib.pyplot as plt

def rotz(degrees):
    a = np.deg2rad(degrees)
    return np.array([[np.cos(a), -np.sin(a), 0.],
                     [np.sin(a),  np.cos(a), 0.], [0., 0., 1.]])
def to6d(R):
    return np.concatenate([R[:, 0], R[:, 1]])
def from6d(values):
    a1, a2 = values[:3], values[3:]
    if np.linalg.norm(a1) < 1e-8:
        raise ValueError("degenerate first axis")
    b1 = a1 / np.linalg.norm(a1)
    u2 = a2 - (b1 @ a2) * b1
    if np.linalg.norm(u2) < 1e-8:
        raise ValueError("parallel axes")
    b2 = u2 / np.linalg.norm(u2)
    return np.column_stack([b1, b2, np.cross(b1, b2)])

Ra, Rb = rotz(179), rotz(-179)
Rmid = from6d((to6d(Ra)+to6d(Rb))/2)
print("angle-coordinate midpoint: 0.0 deg")
print(f"6D midpoint: {np.rad2deg(np.arctan2(Rmid[1,0], Rmid[0,0])):.1f} deg")
print(f"orthogonality error: {np.linalg.norm(Rmid.T@Rmid-np.eye(3)):.8f}")
print(f"determinant: {np.linalg.det(Rmid):.4f}")
fig, ax = plt.subplots(figsize=(5, 4))
for R, label, color in [(Ra,"179 deg","#2874aa"), (Rb,"-179 deg","#159887"),
                        (rotz(0),"angle mean","#d98b2d"), (Rmid,"6D mean","#835ab3")]:
    v = R[:2, 0]
    ax.quiver(0,0,v[0],v[1],angles="xy",scale_units="xy",scale=1,
              color=color,label=label)
ax.set(xlim=(-1.3,1.3),ylim=(-.7,.7),xlabel="X",ylabel="Y")
ax.set_aspect("equal")
ax.grid(alpha=.25)
ax.legend(loc="upper center",fontsize=8,ncol=2)
fig.tight_layout()
plt.show()

# %% ch01-fk-ik
import numpy as np
import matplotlib.pyplot as plt

def forward(local_degrees):
    points = [np.array([0., 1.])]
    angle = 0.
    for degree in local_degrees:
        angle += np.deg2rad(degree)
        points.append(points[-1] + np.array([np.cos(angle), np.sin(angle)]))
    return np.stack(points)

upper = forward([30., -60.])
lower = forward([-30., 60.])
print("upper joints:\n", np.round(upper,4), sep="")
print("lower joints:\n", np.round(lower,4), sep="")
print(f"wrist distance: {np.linalg.norm(upper[-1]-lower[-1]):.8f}")
print("bone lengths:", np.round(np.linalg.norm(np.diff(upper,axis=0),axis=1),4).tolist())
fig, ax = plt.subplots(figsize=(6, 3))
ax.plot(upper[:,0],upper[:,1],"o-",linewidth=3,label="elbow up")
ax.plot(lower[:,0],lower[:,1],"s--",linewidth=3,label="elbow down")
for i, name in enumerate(["shoulder","elbow","wrist"]):
    ax.annotate(name,upper[i],xytext=(5,7),textcoords="offset points",fontsize=9)
ax.set(xlabel="X",ylabel="Y",xlim=(-.2,2.1),ylim=(.2,1.8))
ax.set_aspect("equal")
ax.grid(alpha=.25)
ax.legend(fontsize=9)
fig.tight_layout()
plt.show()

# %% ch01-root-recovery
import numpy as np
import matplotlib.pyplot as plt

T, fps = 81, 20
features = np.zeros((T, 263))
features[:, 0] = np.pi / (4*(T-1))  # 80 个半角增量累积为 pi/4
features[:, 1] = .05
features[:, 3] = 1.0
def recover_root(data):
    half = np.cumsum(np.r_[0., data[:-1,0]])
    root = np.zeros((len(data),3))
    for t in range(1,len(data)):
        yaw = -2*half[t]  # 恢复使用根对齐旋转的逆
        c,s = np.cos(yaw),np.sin(yaw)
        rotation = np.array([[c,0,s],[0,1,0],[-s,0,c]])
        displacement = np.array([data[t-1,1],0.,data[t-1,2]])
        root[t] = root[t-1] + rotation @ displacement
    root[:,1] = data[:,3]
    return root,half

root,half = recover_root(features)
biased = features.copy()
biased[:,1] += .001
drifting,_ = recover_root(biased)
print("root shape:", root.shape)
print(f"alignment yaw: {np.rad2deg(2*half[-1]):.1f} deg")
print(f"per-frame displacement: {features[0,1]:.3f} m, speed: {features[0,1]*fps:.3f} m/s")
print(f"final path drift: {np.linalg.norm(drifting[-1]-root[-1]):.4f} m")
fig,ax = plt.subplots(figsize=(5,4))
ax.plot(root[:,0],root[:,2],label="reference displacement")
ax.plot(drifting[:,0],drifting[:,2],"--",label="+1 mm per frame")
ax.scatter(root[0,0],root[0,2],c="black",s=30,label="start")
ax.set(xlabel="World X (m)",ylabel="World Z (m)")
ax.set_aspect("equal")
ax.grid(alpha=.25)
ax.legend(fontsize=8)
fig.tight_layout()
plt.show()
