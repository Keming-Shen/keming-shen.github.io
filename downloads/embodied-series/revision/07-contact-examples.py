#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Original numerical implementation, 2026; no source figure or code copied.
# Formula source: MuJoCo Computation, Contact / Friction cones.
# mu=0.5, normal force=10 N and two tangential forces are editorial inputs.
"""Coulomb friction-cone feasibility; --output-dir results."""
import argparse
import json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=Path("results"))
    parser.add_argument("--results-dir", type=Path, help="Numerical check directory; defaults to --output-dir")
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    results_dir = args.results_dir or args.output_dir
    results_dir.mkdir(parents=True, exist_ok=True)
    names = {font.name for font in font_manager.fontManager.ttflist}
    plt.rcParams["font.family"] = next((n for n in ("Microsoft YaHei", "Noto Sans CJK SC", "SimHei") if n in names), "DejaVu Sans")
    plt.rcParams.update({"font.size": 12, "axes.spines.top": False, "axes.spines.right": False, "axes.unicode_minus": False})
    mu, fn = .5, 10.0
    cases = []
    for name, ft in [("A", [4.0, 3.0]), ("B", [6.0, 0.0])]:
        magnitude = float(np.linalg.norm(ft))
        margin = mu*fn - magnitude
        cases.append({"name": name, "mu": mu, "normal_force_N": fn, "tangential_force_N": ft, "tangential_magnitude_N": magnitude, "friction_limit_N": mu*fn, "margin_N": margin, "minimum_required_normal_force_N": magnitude/mu, "feasible": bool(fn >= 0 and margin >= -1e-12)})
    assert cases[0]["feasible"] and np.isclose(cases[0]["margin_N"], 0)
    assert not cases[1]["feasible"] and np.isclose(cases[1]["margin_N"], -1)
    assert np.isclose(cases[1]["minimum_required_normal_force_N"], 12)
    assert np.isclose(np.sqrt((cases[0]["tangential_force_N"][0]/mu)**2 + (cases[0]["tangential_force_N"][1]/mu)**2), fn)
    fig, axes = plt.subplots(1, 2, figsize=(11.5, 4.7), constrained_layout=True)
    normals = np.linspace(0, 15, 100)
    axes[0].fill_between(normals, 0, mu*normals, color="#cfe6e4", label="可行接触力")
    axes[0].plot(normals, mu*normals, color="#1b4f72", lw=2.3, label="摩擦边界")
    axes[0].axvline(fn, color="#768491", ls="--", lw=1)
    angle = np.linspace(0, 2*np.pi, 300)
    axes[1].fill(mu*fn*np.cos(angle), mu*fn*np.sin(angle), color="#cfe6e4", label="法向力 10 N 的截面")
    axes[1].plot(mu*fn*np.cos(angle), mu*fn*np.sin(angle), color="#1b4f72", lw=2.3)
    for case, color in zip(cases, ("#1b4f72", "#c15f30")):
        axes[0].scatter([fn], [case["tangential_magnitude_N"]], color=color, s=60, zorder=4)
        axes[0].annotate(case["name"], (fn, case["tangential_magnitude_N"]), xytext=(9, 5), textcoords="offset points", color=color, weight="bold")
        x, y = case["tangential_force_N"]
        axes[1].quiver(0, 0, x, y, angles="xy", scale_units="xy", scale=1, width=.008, color=color)
        axes[1].scatter([x], [y], color=color, s=60, zorder=4)
        axes[1].annotate(case["name"], (x, y), xytext=(6, 7), textcoords="offset points", color=color, weight="bold")
    axes[0].set(xlabel="法向力 / N", ylabel="切向力大小 / N", title="摩擦锥截面", xlim=(0, 15), ylim=(0, 8.5))
    axes[1].set(xlabel="第一切向分量 / N", ylabel="第二切向分量 / N", title="切向力合成", xlim=(-6.5, 7), ylim=(-6, 6))
    axes[1].set_aspect("equal")
    for ax in axes:
        ax.grid(alpha=.2)
        ax.legend(fontsize=10, loc="upper left")
    fig.savefig(args.output_dir / "07-friction-cone.png", dpi=170)
    plt.close(fig)
    output = {"source": "MuJoCo Computation, Contact / Friction cones", "parameter_origin": "source Coulomb/elliptic cone formula; all numerical inputs chosen for substitution", "cases": cases, "checks": "norm, circular/elliptic cone equivalence, boundary feasibility and outside infeasibility passed"}
    (results_dir / "07-contact-results.json").write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps(output, ensure_ascii=True))


if __name__ == "__main__":
    main()
