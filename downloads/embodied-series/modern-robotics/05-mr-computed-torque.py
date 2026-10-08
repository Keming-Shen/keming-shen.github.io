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


def configure():
    available = {f.name for f in font_manager.fontManager.ttflist}
    plt.rcParams["font.family"] = next((n for n in ("Microsoft YaHei", "Noto Sans CJK SC", "SimHei") if n in available), "DejaVu Sans")
    plt.rcParams.update({"font.size": 12, "axes.unicode_minus": False, "axes.spines.top": False, "axes.spines.right": False})


def translation(x):
    T = np.eye(4)
    T[0, 3] = x
    return T


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets-dir", type=Path, default=Path("assets"))
    parser.add_argument("--results-dir", type=Path, default=Path("results"))
    args = parser.parse_args()
    args.assets_dir.mkdir(parents=True, exist_ok=True)
    args.results_dir.mkdir(parents=True, exist_ok=True)
    # Planar 2R rods: both 1 m, 1 kg; link frames at their centers of mass.
    Mlist = np.array([translation(.5), translation(1), translation(.5)])
    G = np.diag([.001, 1/12, 1/12, 1., 1., 1.])
    Glist = np.array([G, G])
    Slist = np.array([[0, 0, 1, 0, 0, 0], [0, 0, 1, 0, -1, 0]]).T
    g = np.array([0., -9.81, 0.])
    q = np.array([.2, -.3]); dq = np.array([.1, -.2])
    qd = np.array([.4, -.1]); dqd = np.array([.2, 0.]); ddqd = np.array([.3, .2])
    Kp, Ki, Kd = 4., 0., 4.
    tau = mr.ComputedTorque(q, dq, np.zeros(2), g, Mlist, Glist, Slist,
                            qd, dqd, ddqd, Kp, Ki, Kd)
    M = mr.MassMatrix(q, Mlist, Glist, Slist)
    feedback_acceleration = Kp * (qd-q) + Kd * (dqd-dq)
    inverse_torque = mr.InverseDynamics(q, dq, ddqd, g, np.zeros(6), Mlist, Glist, Slist)
    feedback_torque = M @ feedback_acceleration
    recovered_acceleration = mr.ForwardDynamics(q, dq, tau, g, np.zeros(6), Mlist, Glist, Slist)
    assert np.allclose(tau, inverse_torque + feedback_torque, atol=1e-12)
    assert np.allclose(recovered_acceleration, ddqd + feedback_acceleration, atol=1e-12)
    assert np.all(np.linalg.eigvalsh(M) > 0)
    configure()
    fig, ax = plt.subplots(figsize=(7.5, 4.3), constrained_layout=True)
    x = np.arange(2); width = .24
    for offset, values, label, color in [(-width, inverse_torque, "逆动力学项", "#7b8d9c"), (0, feedback_torque, "误差反馈项", "#c15f30"), (width, tau, "合计力矩", "#1b4f72")]:
        ax.bar(x + offset, values, width, label=label, color=color)
    ax.set(xticks=x, xticklabels=["关节 1", "关节 2"], ylabel="力矩 / (N·m)", title="两关节计算力矩的组成")
    ax.grid(axis="y", alpha=.2); ax.legend()
    fig.savefig(args.assets_dir / "05-mr-computed-torque.png", dpi=180)
    plt.close(fig)
    output = {"model": "planar 2R, 1 m/1 kg rods, COM frames, no friction, no external tip wrench",
        "q_rad": q.tolist(), "dq_rad_per_s": dq.tolist(), "qd_rad": qd.tolist(), "dqd_rad_per_s": dqd.tolist(), "ddqd_rad_per_s2": ddqd.tolist(),
        "Kp": Kp, "Ki": Ki, "Kd": Kd, "mass_matrix": M.tolist(), "inverse_dynamics_torque_Nm": inverse_torque.tolist(),
        "feedback_acceleration_rad_per_s2": feedback_acceleration.tolist(), "feedback_torque_Nm": feedback_torque.tolist(),
        "computed_torque_Nm": tau.tolist(), "forward_dynamics_acceleration_rad_per_s2": recovered_acceleration.tolist(),
        "maximum_acceleration_residual": float(np.max(np.abs(recovered_acceleration-ddqd-feedback_acceleration))),
        "checks": "torque decomposition, positive inertia matrix and exact-model forward/inverse consistency passed",
        "upstream_integral_note": "Ki=0; fixed upstream ComputedTorque uses Ki*(eint+e), so its nonzero-Ki discretization is not asserted to equal the continuous integral law."}
    (args.results_dir / "05-mr-computed-torque-results.json").write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(output, ensure_ascii=True))


if __name__ == "__main__":
    main()
