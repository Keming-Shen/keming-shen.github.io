# Copyright 2021 DeepMind Technologies Limited
# Licensed under the Apache License, Version 2.0. See 11-mujoco-LICENSE.txt.
# Adapted from MuJoCo 3.3.7 python/tutorial.ipynb: record the official hinge model
# to CSV with a finite CPU simulation; no policy, training, or hardware execution.
import argparse
import csv
from pathlib import Path
import numpy as np
import mujoco

XML='''<mujoco>
  <worldbody>
    <light name="top" pos="0 0 1"/>
    <body name="box_and_sphere" euler="0 0 -30">
      <joint name="swing" type="hinge" axis="1 -1 0" pos="-.2 -.2 -.2"/>
      <geom name="red_box" type="box" size=".2 .2 .2" rgba="1 0 0 1"/>
      <geom name="green_sphere" pos=".2 .2 .2" size=".1" rgba="0 1 0 1"/>
    </body>
  </worldbody>
</mujoco>'''
parser=argparse.ArgumentParser()
parser.add_argument('--seconds',type=float,default=2.0)
parser.add_argument('--csv',type=Path,default=Path('11-hinge-trace.csv'))
args=parser.parse_args()
if args.seconds<=0: parser.error('--seconds must be positive')
model=mujoco.MjModel.from_xml_string(XML)
data=mujoco.MjData(model)
rows=[(data.time,float(data.qpos[0]),float(data.qvel[0]))]
while data.time<args.seconds:
    mujoco.mj_step(model,data)
    rows.append((data.time,float(data.qpos[0]),float(data.qvel[0])))
assert np.isfinite(np.asarray(rows)).all()
args.csv.parent.mkdir(parents=True,exist_ok=True)
with args.csv.open('w',newline='',encoding='utf-8') as out:
    writer=csv.writer(out)
    writer.writerow(['time_s','q_rad','v_rad_s'])
    writer.writerows(rows)
print('MuJoCo:',mujoco.__version__)
print('nq, nv:',model.nq,model.nv)
print('timestep:',model.opt.timestep)
print('steps:',len(rows)-1)
print('final time:',data.time)
print('finite states:',bool(np.isfinite(data.qpos).all() and np.isfinite(data.qvel).all()))
print('CSV:',args.csv)
