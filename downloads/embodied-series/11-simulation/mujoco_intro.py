# Copyright 2021 DeepMind Technologies Limited
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy at https://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied.
# Adapted 2026-10-08 from MuJoCo 3.3.7 python/tutorial.ipynb:
# notebook cells assembled into a local CLI; GUI/render flags and checks added.
from argparse import ArgumentParser
from pathlib import Path
import time
import numpy as np
import mujoco

STATIC_XML = """
<mujoco>
  <worldbody>
    <light name="top" pos="0 0 1"/>
    <geom name="red_box" type="box" size=".2 .2 .2" rgba="1 0 0 1"/>
    <geom name="green_sphere" pos=".2 .2 .2" size=".1" rgba="0 1 0 1"/>
  </worldbody>
</mujoco>
"""

HINGE_XML = """
<mujoco>
  <worldbody>
    <light name="top" pos="0 0 1"/>
    <body name="box_and_sphere" euler="0 0 -30">
      <joint name="swing" type="hinge" axis="1 -1 0" pos="-.2 -.2 -.2"/>
      <geom name="red_box" type="box" size=".2 .2 .2" rgba="1 0 0 1"/>
      <geom name="green_sphere" pos=".2 .2 .2" size=".1" rgba="0 1 0 1"/>
    </body>
  </worldbody>
</mujoco>
"""

def main():
    parser = ArgumentParser()
    parser.add_argument('--seconds', type=float, default=2.0)
    parser.add_argument('--viewer', action='store_true')
    parser.add_argument('--render', type=Path)
    args = parser.parse_args()
    if args.seconds <= 0:
        parser.error('--seconds must be positive')
    static_model = mujoco.MjModel.from_xml_string(STATIC_XML)
    static_data = mujoco.MjData(static_model)
    mujoco.mj_forward(static_model, static_data)
    print('static:', 'nq=', static_model.nq, 'nv=', static_model.nv)
    print('green_sphere position:', static_data.geom('green_sphere').xpos)

    model = mujoco.MjModel.from_xml_string(HINGE_XML)
    data = mujoco.MjData(model)
    mujoco.mj_forward(model, data)
    print('hinge:', 'nq=', model.nq, 'nv=', model.nv,
          'dt=', model.opt.timestep)
    initial_q = data.qpos.copy()
    samples = []

    if args.viewer:
        from mujoco import viewer as mj_viewer
        with mj_viewer.launch_passive(model, data) as viewer:
            while viewer.is_running() and data.time < args.seconds:
                step_start = time.time()
                mujoco.mj_step(model, data)
                samples.append(data.qpos.copy())
                viewer.sync()
                remaining = model.opt.timestep - (time.time() - step_start)
                if remaining > 0:
                    time.sleep(remaining)
    else:
        while data.time < args.seconds:
            mujoco.mj_step(model, data)
            samples.append(data.qpos.copy())

    mujoco.mj_forward(model, data)
    if not np.isfinite(data.qpos).all() or not np.isfinite(data.qvel).all():
        raise RuntimeError('Non-finite simulation state')
    print('time=', data.time, 'qpos=', data.qpos, 'qvel=', data.qvel)
    print('moved=', bool(np.linalg.norm(data.qpos-initial_q) > 1e-8))
    if args.render:
        # NPY stores the renderer's original pixel output without a new image dependency.
        args.render.mkdir(parents=True, exist_ok=True)
        with mujoco.Renderer(static_model, height=360, width=640) as renderer:
            renderer.update_scene(static_data)
            np.save(args.render/'static.npy', renderer.render())
        with mujoco.Renderer(model, height=360, width=640) as renderer:
            renderer.update_scene(data)
            np.save(args.render/'hinge.npy', renderer.render())

if __name__ == '__main__':
    main()
