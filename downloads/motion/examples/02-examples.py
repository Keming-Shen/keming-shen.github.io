# Numerical tutorial examples. Requires numpy, torch, matplotlib.
# Formula/interface checks and analysis of saved motion outputs.
# Pretrained inference is documented separately in model-run/.

# %% ch02-conditional-mean
import numpy as np
import matplotlib.pyplot as plt

angle = np.deg2rad(60)
samples = np.array([[-np.sin(angle),np.cos(angle)],
                    [ np.sin(angle),np.cos(angle)]])
mean = samples.mean(axis=0)
errors = ((samples-mean)**2).mean()
print("sample bone lengths:", np.round(np.linalg.norm(samples,axis=1),4).tolist())
print("mean endpoint:", np.round(mean,4).tolist())
print(f"mean bone length: {np.linalg.norm(mean):.4f}")
print(f"per-coordinate MSE: {errors:.4f}")
fig,axes = plt.subplots(1,2,figsize=(8,3))
for v,label,color in [(samples[0],"mode A","#2874aa"),
                       (samples[1],"mode B","#159887"),(mean,"coordinate mean","#d98b2d")]:
    axes[0].plot([0,v[0]],[0,v[1]],"o-",linewidth=3,label=label,color=color)
circle = np.linspace(0,2*np.pi,200)
axes[0].plot(np.cos(circle),np.sin(circle),":",color="grey",alpha=.5)
axes[0].set(xlabel="X",ylabel="Y",xlim=(-1.1,1.1),ylim=(-.15,1.1))
axes[0].set_aspect("equal")
axes[0].legend(fontsize=8,loc="upper center")
candidate_y = np.linspace(0,1,100)
loss = np.array([((samples-np.array([0.,y]))**2).mean() for y in candidate_y])
axes[1].plot(candidate_y,loss)
axes[1].axvline(mean[1],linestyle=":",color="#d98b2d")
axes[1].set(xlabel="Predicted endpoint Y",ylabel="Per-coordinate MSE")
for ax in axes: ax.grid(alpha=.2)
fig.tight_layout()
plt.show()

# %% ch02-quantization
import numpy as np
import matplotlib.pyplot as plt

z = np.array([[.85,1.1],[-.9,.7],[.2,-.1],[-.4,.35]])
coarse = np.array([[-1.,-1.],[-1.,1.],[1.,-1.],[1.,1.],[0.,0.]])
levels = np.array([-.25,0.,.25])
fine = np.array([(a,b) for a in levels for b in levels])
def nearest(values,codebook):
    indices = ((values[:,None,:]-codebook[None,:,:])**2).sum(-1).argmin(-1)
    return codebook[indices],indices

vq,indices = nearest(z,coarse)
correction,_ = nearest(z-vq,fine)
rvq = vq+correction
fsq = np.round(np.clip(z,-1,1)*2)/2  # 五级网格的简化演示
errors = [np.mean((z-r)**2) for r in [vq,rvq,fsq]]
print("first-stage code ids:",indices.tolist())
for name,error in zip(["VQ","RVQ","FSQ grid"],errors):
    print(f"{name} MSE: {error:.6f}")
print("FSQ combinations:",5**2)
fig,axes = plt.subplots(1,2,figsize=(8,3))
axes[0].scatter(z[:,0],z[:,1],marker="*",s=110,label="original")
axes[0].scatter(vq[:,0],vq[:,1],marker="s",s=45,label="VQ")
axes[0].scatter(rvq[:,0],rvq[:,1],marker="o",s=40,label="RVQ")
for start,end in zip(vq,rvq):
    axes[0].annotate("",xy=end,xytext=start,arrowprops=dict(arrowstyle="->",color="grey"))
axes[0].set(xlabel="Latent coordinate 1",ylabel="Latent coordinate 2")
axes[0].legend(fontsize=8)
axes[0].set_aspect("equal",adjustable="datalim")
axes[1].bar(["VQ","RVQ","FSQ grid"],errors,color=["#2874aa","#159887","#d98b2d"])
axes[1].set(ylabel="Mean squared error")
for ax in axes: ax.grid(alpha=.2)
fig.tight_layout()
plt.show()

# %% ch02-diffusion-target
import numpy as np
import matplotlib.pyplot as plt

rng = np.random.default_rng(2)
time = np.arange(80)/20
clean = np.sin(2*np.pi*time/4)
noise = rng.normal(size=len(clean))
alphas = [.9,.5,.1]
fig,axes = plt.subplots(1,3,figsize=(10,3),sharey=True)
for ax,a in zip(axes,alphas):
    noisy = np.sqrt(a)*clean+np.sqrt(1-a)*noise
    exact = (noisy-np.sqrt(1-a)*noise)/np.sqrt(a)
    estimate = (noisy-np.sqrt(1-a)*(noise+.05))/np.sqrt(a)
    print(f"alpha_bar={a:.1f}: oracle error={np.max(np.abs(exact-clean)):.8f}, "
          f"biased MAE={np.mean(np.abs(estimate-clean)):.6f}")
    ax.plot(time,noisy,color="grey",alpha=.45,label="noisy")
    ax.plot(time,clean,color="#2874aa",label="clean")
    ax.plot(time,estimate,"--",color="#d98b2d",label="biased estimate")
    ax.set(xlabel="Motion time (s)",title=f"alpha_bar = {a}")
    ax.grid(alpha=.2)
axes[0].set_ylabel("Synthetic feature")
axes[0].legend(fontsize=7)
fig.tight_layout()
plt.show()
