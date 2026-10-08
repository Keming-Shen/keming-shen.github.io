#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Original numerical implementation, 2026; no source figure or code copied.
# Formula source: Russ Tedrake, MIT OCW 6.832 (2009), Chapter 9,
# section 9.7.3, printed pp. 71-72, Figure 9.3.
# Initial distances 1 m and 4 m are editorial numerical substitutions.
"""Bounded-input double-integrator trajectories; --output-dir results."""
import argparse
import json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager


def configure():
    names = {font.name for font in font_manager.fontManager.ttflist}
    plt.rcParams["font.family"] = next((n for n in ("Microsoft YaHei", "Noto Sans CJK SC", "SimHei") if n in names), "DejaVu Sans")
    plt.rcParams.update({"font.size": 12, "axes.spines.top": False, "axes.spines.right": False, "axes.unicode_minus": False})


def trajectory(q0):
    acceleration = 1.0
    switch = np.sqrt(q0 / acceleration)
    t = np.linspace(0, 2*switch, 1201)
    before = t <= switch
    elapsed = t - switch
    q_switch, v_switch = q0/2, -acceleration*switch
    q = np.where(before, q0-.5*acceleration*t*t, q_switch+v_switch*elapsed+.5*acceleration*elapsed*elapsed)
    v = np.where(before, -acceleration*t, v_switch+acceleration*elapsed)
    u = np.where(t < switch, -acceleration, acceleration)
    u[-1] = 0.0  # Hold the target once the finite-horizon trajectory is complete.
    return t, q, v, u, switch


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=Path("results"))
    parser.add_argument("--results-dir", type=Path, help="Numerical check directory; defaults to --output-dir")
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    results_dir = args.results_dir or args.output_dir
    results_dir.mkdir(parents=True, exist_ok=True)
    configure()
    fig, axes = plt.subplots(1, 3, figsize=(13, 4.3), constrained_layout=True)
    cases = []
    for q0, color in [(1.0, "#1b4f72"), (4.0, "#c15f30")]:
        t, q, v, u, switch = trajectory(q0)
        assert np.all(np.abs(u) <= 1)
        assert np.isclose(q[0], q0) and np.isclose(v[0], 0)
        assert np.isclose(q[-1], 0) and np.isclose(v[-1], 0)
        assert np.all(q >= -1e-12)
        after = t >= switch
        # On the braking branch v^2=2q; rest-to-rest reachable distance <= T^2/4.
        cone_residual = np.max(np.abs(v[after]**2 - 2*q[after]))
        assert cone_residual < 1e-11
        assert np.isclose((t[-1]**2)/4, q0)
        label = f"初始位置 {q0:g} m"
        axes[0].plot(t, q, lw=2.5, color=color, label=label)
        axes[1].plot(q, v, lw=2.5, color=color, label=label)
        axes[1].scatter([q0/2], [-switch], color=color, s=45, zorder=3)
        axes[2].step([0, switch, 2*switch, 4.4], [-1, 1, 0, 0], where="post", color=color, lw=2.5, label=label)
        cases.append({"q0_m": q0, "v0_m_per_s": 0.0, "u_max_m_per_s2": 1.0, "switch_time_s": float(switch), "switch_q_m": q0/2, "switch_v_m_per_s": float(-switch), "arrival_time_s": float(t[-1]), "final_q_m": float(q[-1]), "final_v_m_per_s": float(v[-1]), "max_braking_curve_residual": float(cone_residual)})
    qs = np.linspace(0, 4, 300)
    axes[1].plot(qs, -np.sqrt(2*qs), color="#768491", ls="--", label="制动曲线")
    axes[0].set(xlabel="时间 / s", ylabel="位置 / m", title="到达轨迹")
    axes[1].set(xlabel="位置 / m", ylabel="速度 / (m/s)", title="加速与制动切换")
    axes[2].set(xlabel="时间 / s", ylabel="加速度 / (m/s²)", title="输入约束", ylim=(-1.3, 1.3))
    for ax in axes:
        ax.grid(alpha=.2)
        ax.legend(fontsize=9, loc="best")
    fig.savefig(args.output_dir / "06-bounded-trajectories.png", dpi=170)
    plt.close(fig)
    output = {"source": "MIT OCW 6.832 (2009), Chapter 9, section 9.7.3; Figure 9.3", "parameter_origin": "source uses |u|<=1; initial distances chosen for numerical substitution", "cases": cases, "checks": "input bound, initial/final state, nonnegative position, braking curve and rest-to-rest time bound passed"}
    (results_dir / "06-planning-results.json").write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps(output, ensure_ascii=True))


if __name__ == "__main__":
    main()
