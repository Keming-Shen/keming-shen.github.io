#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Original numerical implementation, 2026. No source figure or code is copied.
# Formula source: Russ Tedrake, MIT OCW 6.832 (2009), Chapter 9,
# section 9.7.1, printed pp. 70-71, Figure 9.2 (k1=1, k2=4).
# The 1 m reference step and critical-damping comparison are editorial inputs.
"""Analytic PD step responses; run with --output-dir results."""
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


def response(t, k2):
    # k1=1 s^-2; q(0)=0, qdot(0)=0; constant reference q_ref=1 m.
    # e=q-q_ref satisfies e'' + k2 e' + e=0.
    if k2 == 2.0:
        e = -(1 + t) * np.exp(-t)
        v = t * np.exp(-t)
        eig = [-1.0, -1.0]
    else:
        r1, r2 = (-k2 + np.sqrt(k2*k2 - 4))/2, (-k2 - np.sqrt(k2*k2 - 4))/2
        c1, c2 = r2/(r1-r2), -r1/(r1-r2)
        e = c1*np.exp(r1*t) + c2*np.exp(r2*t)
        v = c1*r1*np.exp(r1*t) + c2*r2*np.exp(r2*t)
        eig = [float(r1), float(r2)]
    q = 1 + e
    u = -e - k2*v
    return q, v, u, eig


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=Path("results"))
    parser.add_argument("--results-dir", type=Path, help="Numerical check directory; defaults to --output-dir")
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    results_dir = args.results_dir or args.output_dir
    results_dir.mkdir(parents=True, exist_ok=True)
    configure()
    t = np.linspace(0, 8, 1601)
    fig, axes = plt.subplots(1, 2, figsize=(11.5, 4.6), constrained_layout=True)
    records = []
    for k2, color, label in [(4.0, "#1b4f72", "过阻尼：k2=4"), (2.0, "#c15f30", "临界阻尼：k2=2")]:
        q, v, u, eig = response(t, k2)
        assert np.isclose(q[0], 0) and np.isclose(v[0], 0)
        assert np.all(np.diff(q) >= -1e-12)
        assert np.all(np.array(eig) < 0)
        assert np.max(np.abs(u)) <= 1.0 + 1e-12
        # Closed-form residual verified independently by a central difference.
        dt = t[1] - t[0]
        residual = np.gradient(v, dt)[1:-1] - u[1:-1]
        assert np.max(np.abs(residual)) < 3e-4
        q2, v2, u2, _ = response(np.array([2.0]), k2)
        records.append({"k1_per_s2": 1.0, "k2_per_s": k2, "eigenvalues_per_s": eig, "q_at_2s_m": float(q2[0]), "v_at_2s_m_per_s": float(v2[0]), "u_at_2s_m_per_s2": float(u2[0]), "max_dynamics_residual": float(np.max(np.abs(residual)))})
        axes[0].plot(t, q, color=color, lw=2.5, label=label)
        axes[0].scatter([2], q2, color=color, zorder=4)
        axes[1].plot(q-1, v, color=color, lw=2.5, label=label)
        axes[1].scatter([-1], [0], color=color, zorder=4)
    axes[0].axhline(1, color="#768491", ls="--", lw=1.2, label="目标位置：1 m")
    axes[0].set(xlabel="时间 / s", ylabel="位置 / m", title="单位质量轴的阶跃响应", xlim=(0, 8), ylim=(-0.03, 1.05))
    axes[1].scatter([0], [0], color="#303b44", marker="*", s=100, label="目标状态")
    axes[1].set(xlabel="位置误差 / m", ylabel="速度 / (m/s)", title="闭环相轨迹", xlim=(-1.06, 0.03))
    for ax in axes:
        ax.grid(alpha=.2)
        ax.legend(loc="best", fontsize=10)
    fig.savefig(args.output_dir / "05-pd-response.png", dpi=170)
    plt.close(fig)
    output = {"source": "MIT OCW 6.832 (2009), Chapter 9, section 9.7.1 and Figure 9.2", "parameter_origin": "k1=1,k2=4 from source figure; q_ref=1 m and k2=2 comparison chosen for numerical substitution", "cases": records, "checks": "initial state, eigenvalues, monotone response, input amplitude and differential-equation residual passed"}
    (results_dir / "05-control-results.json").write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps(output, ensure_ascii=True))


if __name__ == "__main__":
    main()
