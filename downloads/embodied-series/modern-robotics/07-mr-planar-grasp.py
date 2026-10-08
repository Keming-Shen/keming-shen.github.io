#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Original planar numerical example for grasp-matrix and wrench-cone analysis.
# Mathematical background: Modern Robotics, Chapter 12, 12.1.7 / 12.2.3.
import argparse
import json
from pathlib import Path
import numpy as np
import modern_robotics as mr
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import Rectangle


def wrench(point, force):
    # Use MR's [moment;force] convention and retain planar [mz,fx,fy].
    spatial = np.r_[mr.VecToso3(point) @ force, force]
    return spatial[[2, 3, 4]]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets-dir", type=Path, default=Path("assets"))
    parser.add_argument("--results-dir", type=Path, default=Path("results"))
    args = parser.parse_args()
    args.assets_dir.mkdir(parents=True, exist_ok=True); args.results_dir.mkdir(parents=True, exist_ok=True)
    a, mu, normal = .05, .5, 10.
    left, right = np.array([-a, 0., 0.]), np.array([a, 0., 0.])
    G = np.column_stack([wrench(left, [1, 0, 0]), wrench(left, [0, 1, 0]), wrench(right, [-1, 0, 0]), wrench(right, [0, 1, 0])])
    edge_forces = [np.array([1, mu, 0]), np.array([1, -mu, 0]), np.array([-1, mu, 0]), np.array([-1, -mu, 0])]
    F = np.column_stack([wrench(p, f) for p, f in zip([left, left, right, right], edge_forces)])
    k = np.ones(4)
    assert np.linalg.matrix_rank(F) == 3 and np.allclose(F @ k, 0) and np.all(k > 0)
    support = np.array([normal, 5., normal, 5.])
    pure_moment = np.array([normal, -2., normal, 2.])
    assert np.allclose(G @ support, [0, 0, 10])
    assert np.allclose(G @ pure_moment, [.2, 0, 0])
    assert np.all(np.abs(support[[1, 3]]) <= mu*support[[0, 2]])
    assert np.all(np.abs(pure_moment[[1, 3]]) <= mu*pure_moment[[0, 2]])
    frictionless = np.column_stack([wrench(left, [1, 0, 0]), wrench(right, [-1, 0, 0])])
    assert np.linalg.matrix_rank(frictionless) == 1
    # Vertical translation does not penetrate either side contact: no form closure.
    planar_twist = np.array([0., 0., 1.])
    assert np.allclose(frictionless.T @ planar_twist, 0)
    available = {f.name for f in font_manager.fontManager.ttflist}
    plt.rcParams["font.family"] = next((n for n in ("Microsoft YaHei", "Noto Sans CJK SC", "SimHei") if n in available), "DejaVu Sans")
    plt.rcParams.update({"font.size": 11, "axes.unicode_minus": False, "axes.spines.top": False, "axes.spines.right": False})
    fig, axes = plt.subplots(1, 2, figsize=(10.5, 4.4), constrained_layout=True)
    ax = axes[0]; ax.add_patch(Rectangle((-a, -.06), 2*a, .12, facecolor="#edf3f7", edgecolor="#1b4f72", lw=2))
    ax.scatter([-a, a], [0, 0], s=45, color="#1b4f72")
    ax.quiver([-a, a], [0, 0], [.028, -.028], [.014, .014], angles="xy", scale_units="xy", scale=1, color="#c15f30", width=.008)
    ax.annotate("左接触： (10, 5) N", xy=(-a, 0), xytext=(-.102, .068), fontsize=10)
    ax.annotate("右接触： (-10, 5) N", xy=(a, 0), xytext=(.003, .068), fontsize=10)
    ax.arrow(0, -.01, 0, -.028, width=.001, head_width=.006, color="#768491")
    ax.text(.004, -.036, "重力 10 N", fontsize=10)
    ax.set(xlim=(-.11, .11), ylim=(-.09, .09), xlabel="x / m", ylabel="y / m", title="两侧平面摩擦接触", aspect="equal")
    ax.grid(alpha=.15)
    ax = axes[1]; limit = mu*normal
    ax.add_patch(Rectangle((-limit, -limit), 2*limit, 2*limit, facecolor="#e7f0f5", edgecolor="#1b4f72", lw=2))
    xs=np.linspace(-5, 5, 200)
    ax.plot(xs, xs+4, ls="--", color="#c15f30", label="净力矩 0.2 N·m")
    ax.scatter([5, -2], [5, 2], color=["#1b4f72", "#c15f30"], s=50, zorder=3)
    ax.annotate("支撑 10 N", (5, 5), xytext=(-8, 8), textcoords="offset points", ha="right", fontsize=10)
    ax.annotate("纯力矩", (-2, 2), xytext=(8, -16), textcoords="offset points", fontsize=10)
    ax.set(xlim=(-6.5, 6.5), ylim=(-6.5, 6.5), xlabel="左切向力 / N", ylabel="右切向力 / N", title="各 10 N 法向预紧力下的分配", aspect="equal")
    ax.grid(alpha=.15); ax.legend(fontsize=9, loc="lower right")
    fig.savefig(args.assets_dir / "07-mr-planar-grasp.png", dpi=180); plt.close(fig)
    output = {"spatial_order": "[mx,my,mz,fx,fy,fz]", "planar_order": "[mz,fx,fy]", "contact_distance_from_origin_m": a,
        "mu": mu, "normal_preload_each_N": normal, "grasp_matrix": G.tolist(), "friction_edge_wrench_matrix": F.tolist(),
        "friction_edge_rank": int(np.linalg.matrix_rank(F)), "positive_null_weights": k.tolist(), "null_residual": float(np.linalg.norm(F @ k)),
        "frictionless_rank": int(np.linalg.matrix_rank(frictionless)), "support_contact_vector_N": support.tolist(),
        "support_wrench": (G @ support).tolist(), "pure_moment_contact_vector_N": pure_moment.tolist(), "pure_moment_wrench": (G @ pure_moment).tolist(),
        "maximum_support_force_with_fixed_preload_N": float(2*mu*normal), "maximum_pure_moment_with_fixed_preload_Nm": float(2*a*mu*normal),
        "geometric_free_twist": planar_twist.tolist(), "checks": "full rank and strictly positive null vector; wrench balance; fixed-load friction constraints; non-form-closure translation passed",
        "scope": "Ideal planar rigid point contacts; force closure assumes unbounded admissible normal forces, while the fixed-preload examples have finite wrench capacity."}
    (args.results_dir / "07-mr-planar-grasp-results.json").write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(output, ensure_ascii=True))


if __name__ == "__main__":
    main()
