"""Arithmetic from ROS 2 URDF and MuJoCo delay documentation.

ROS doc snapshot a2f0aa76f61144a4ac3bcda0401e9d4e9a840f22:
0.1m cube / 0.6kg / diagonal inertia 1e-3; identity implies 600kg.
MuJoCo doc snapshot 118f9ade365e40f763ec93479f4aa9c27b8083a2:
dt=0.1s, nsample=2, delay=0.2s. The timestamp 0.3s is a display origin.
No simulator delay API is called.
"""
from math import ceil
side,mass=0.1,0.6
inertia=mass*side**2/6
mass_for_unit_inertia=6/side**2
print(f'cube diagonal inertia: {inertia:.6f} kg*m^2')
print(f'mass implied by unit inertia: {mass_for_unit_inertia:.1f} kg')
dt,nsample,delay=0.1,2,0.2
now=0.3
history=[round(now-k*dt,6) for k in range(nsample,0,-1)]
assert ceil(delay/dt)==nsample
print('history timestamps (s):',history)
print(f'requested timestamp (s): {now-delay:.1f}')
print('buffer samples required:',ceil(delay/dt))
