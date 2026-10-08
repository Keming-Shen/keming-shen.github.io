#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Original example calling the Modern Robotics MIT-licensed code library.
# Fixed upstream commit: cbd41fdf0bf75dbd5e986d832ae14226964ff0ac
import argparse
import json
from pathlib import Path
import numpy as np
import modern_robotics as mr
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets-dir", type=Path, default=Path("assets"))
    parser.add_argument("--results-dir", type=Path, default=Path("results"))
    args = parser.parse_args()
    args.assets_dir.mkdir(parents=True, exist_ok=True); args.results_dir.mkdir(parents=True, exist_ok=True)
    Tf = 2.; t = np.linspace(0, Tf, 401); z = t/Tf
    cubic = np.array([mr.CubicTimeScaling(Tf, ti) for ti in t])
    quintic = np.array([mr.QuinticTimeScaling(Tf, ti) for ti in t])
    assert np.isclose(mr.CubicTimeScaling(2, .6), .216)
    assert np.isclose(mr.QuinticTimeScaling(2, .6), .16308)
    cubic_velocity = (6*z-6*z*z)/Tf
    quintic_velocity = (30*z*z-60*z**3+30*z**4)/Tf
    cubic_acceleration = (6-12*z)/Tf**2
    quintic_acceleration = (60*z-180*z*z+120*z**3)/Tf**2
    assert np.allclose(cubic[[0, -1]], [0, 1]) and np.allclose(quintic[[0, -1]], [0, 1])
    assert np.allclose(cubic_velocity[[0, -1]], 0) and np.allclose(quintic_velocity[[0, -1]], 0)
    assert np.allclose(quintic_acceleration[[0, -1]], 0)
    assert 1.5/Tf*np.pi/2 <= 1.3 < 1.875/Tf*np.pi/2
    # One joint moves from 0 to pi/2; API midpoint and analytical peaks are checked.
    joint = mr.JointTrajectory(np.array([0.]), np.array([np.pi/2]), Tf, len(t), 5)
    assert np.isclose(joint[len(t)//2, 0], np.pi/4)
    Xstart = np.eye(4); Xend = np.eye(4)
    Xend[:3, :3] = mr.MatrixExp3(mr.VecToso3(np.array([0., 0., np.pi/2])))
    Xend[:3, 3] = [.2, .1, .1]
    screw = np.array(mr.ScrewTrajectory(Xstart, Xend, Tf, len(t), 5))
    cartesian = np.array(mr.CartesianTrajectory(Xstart, Xend, Tf, len(t), 5))
    assert np.allclose(screw[0], Xstart) and np.allclose(screw[-1], Xend)
    assert np.allclose(cartesian[0], Xstart) and np.allclose(cartesian[-1], Xend)
    assert np.allclose(np.linalg.det(screw[:, :3, :3]), 1)
    assert np.allclose(np.einsum('nji,njk->nik', screw[:, :3, :3], screw[:, :3, :3]), np.eye(3))
    available = {f.name for f in font_manager.fontManager.ttflist}
    plt.rcParams["font.family"] = next((n for n in ("Microsoft YaHei", "Noto Sans CJK SC", "SimHei") if n in available), "DejaVu Sans")
    plt.rcParams.update({"font.size": 11, "axes.unicode_minus": False, "axes.spines.top": False, "axes.spines.right": False})
    fig = plt.figure(figsize=(12, 4.2), constrained_layout=True)
    ax1 = fig.add_subplot(131); ax2 = fig.add_subplot(132); ax3 = fig.add_subplot(133, projection="3d")
    ax1.plot(t, cubic, color="#1b4f72", label="三次"); ax1.plot(t, quintic, color="#c15f30", label="五次")
    ax1.set(xlabel="时间 / s", ylabel="路径进度 s", title="时间缩放")
    ax2.plot(t, cubic_velocity*np.pi/2, color="#1b4f72", label="三次"); ax2.plot(t, quintic_velocity*np.pi/2, color="#c15f30", label="五次")
    ax2.set(xlabel="时间 / s", ylabel="关节速度 / (rad/s)", title="相同行程、相同总时间")
    for ax in [ax1, ax2]: ax.grid(alpha=.2); ax.legend()
    for trajectory, label, color in [(screw, "螺旋路径", "#1b4f72"), (cartesian, "平移直线", "#c15f30")]:
        p = trajectory[:, :3, 3]
        ax3.plot(p[:, 0], p[:, 1], p[:, 2], label=label, color=color, lw=2)
    ax3.scatter([0, .2], [0, .1], [0, .1], color="#303b44", s=25)
    ax3.set(xlabel="x / m", ylabel="y / m", zlabel="z / m", title="SE(3) 端点之间的路径")
    ax3.set_xticks([0, .1, .2]); ax3.set_yticks([0, .05, .1]); ax3.set_zticks([0, .05, .1])
    ax3.view_init(elev=24, azim=-62); ax3.legend(fontsize=9, loc="upper left"); ax3.set_box_aspect((1.6, 1, 1))
    fig.savefig(args.assets_dir / "06-mr-time-scaling.png", dpi=180, bbox_inches="tight", pad_inches=.15); plt.close(fig)
    output = {"Tf_s": Tf, "official_docstring_examples": {"CubicTimeScaling_2_0_6": mr.CubicTimeScaling(2, .6), "QuinticTimeScaling_2_0_6": mr.QuinticTimeScaling(2, .6)},
        "joint_displacement_rad": float(np.pi/2), "joint_midpoint_rad": float(joint[len(t)//2, 0]),
        "cubic_peak_joint_velocity_rad_per_s": float(1.5/Tf*np.pi/2), "quintic_peak_joint_velocity_rad_per_s": float(1.875/Tf*np.pi/2),
        "cubic_endpoint_acceleration_rad_per_s2": (cubic_acceleration[[0, -1]]*np.pi/2).tolist(),
        "quintic_endpoint_acceleration_rad_per_s2": (quintic_acceleration[[0, -1]]*np.pi/2).tolist(),
        "Xend": Xend.tolist(), "screw_midpoint_position_m": screw[len(t)//2, :3, 3].tolist(),
        "cartesian_midpoint_position_m": cartesian[len(t)//2, :3, 3].tolist(),
        "checks": "official cubic/quintic examples, endpoint position/velocity/acceleration, joint midpoint and SE(3) validity passed"}
    (args.results_dir / "06-mr-time-scaling-results.json").write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(output, ensure_ascii=True))


if __name__ == "__main__":
    main()
