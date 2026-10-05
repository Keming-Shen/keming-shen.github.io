# -*- coding: utf-8 -*-
import numpy as np
import matplotlib.pyplot as plt

buffer = np.array([0.0, 0.1, 0.25, 0.5, 1.0])
compute = 0.08
transition = 0.20
start_fifo = np.maximum(buffer, compute)
finish_fifo = start_fifo + transition
start_replace = np.full_like(buffer, compute)
for b, start, finish in zip(buffer, start_fifo, finish_fifo):
    print(f"旧缓存={b:.2f} s: 首次新响应={start:.2f} s, "
          f"过渡完成={finish:.2f} s")
print(f"理想可替换接口首次响应: {compute:.2f} s")
fig, ax = plt.subplots(figsize=(7, 3.5))
ax.plot(buffer, start_fifo, "o-", label="Queue preserved: response starts")
ax.plot(buffer, finish_fifo, "s--", label="Queue preserved: transition ends")
ax.plot(buffer, start_replace, ":", label="Ideal replaceable queue")
ax.set(xlabel="Remaining old buffer (s)", ylabel="Time after new command (s)")
ax.legend()
ax.grid(alpha=0.3)
fig.tight_layout()
plt.show()
