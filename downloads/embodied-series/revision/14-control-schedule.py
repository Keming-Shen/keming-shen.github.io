"""Schedule arithmetic for MimicKit's pinned Isaac Lab engine configuration.
Source: control_freq=30, sim_freq=120; engine asserts an integer frequency ratio.
No simulator, model inference, or robot control is executed.
"""
control_freq,sim_freq=30,120
assert sim_freq>=control_freq and sim_freq%control_freq==0
sim_steps=sim_freq//control_freq
print('physics steps per control:',sim_steps)
print(f'control period: {1000/control_freq:.3f} ms')
print(f'physics period: {1000/sim_freq:.3f} ms')
print('physics endpoints in one control interval (ms):',
      [round(1000*k/sim_freq,3) for k in range(1,sim_steps+1)])
