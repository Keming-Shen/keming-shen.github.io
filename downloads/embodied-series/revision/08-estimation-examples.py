#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Original numerical implementation, 2026; no source figure or code copied.
# Formula sources: Asada, MIT OCW 2.160 (2006), Lecture 6, equations 38/41/45;
# Horn et al., MIT OCW 6.801 (2020), Lecture 2, perspective-projection equations.
# All numerical measurements, noise variances and camera coordinates are editorial inputs.
"""Scalar Kalman updates and projective scale ambiguity; --output-dir results."""
import argparse
import json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager


def update(mean, variance, measurement, r):
    k = variance/(variance+r)
    new_mean = mean+k*(measurement-mean)
    joseph = (1-k)**2*variance + k*k*r
    assert np.isclose(joseph, (1-k)*variance)
    assert 0 < joseph < variance
    return new_mean, joseph, k


def gaussian(x, mean, variance):
    return np.exp(-(x-mean)**2/(2*variance))/np.sqrt(2*np.pi*variance)


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
    mean0, p0, r, process_q = 1.0, 4.0, 1.0, .2
    mean1, p1, k1 = update(mean0, p0, 2.0, r)
    p2_prior = p1 + process_q
    mean2, p2, k2 = update(mean1, p2_prior, 1.6, r)
    assert np.allclose([mean1,p1,k1,p2_prior,mean2,p2,k2], [1.8,.8,.8,1.0,1.7,.5,.5])
    focal_px = 800.0
    point1 = np.array([.2, .1, 2.0])
    point2 = 2*point1
    uv1 = focal_px*point1[:2]/point1[2]
    uv2 = focal_px*point2[:2]/point2[2]
    assert np.allclose(uv1, [80,40]) and np.allclose(uv1, uv2)
    fig, axes = plt.subplots(1, 2, figsize=(11.5, 4.6), constrained_layout=True)
    xs = np.linspace(-4, 6, 1200)
    for mean, var, color, label in [(mean0,p0,"#768491","第一次观测前"),(mean1,p1,"#1b4f72","第一次校正后"),(mean2,p2,"#c15f30","第二次校正后")]:
        axes[0].plot(xs, gaussian(xs,mean,var), color=color, lw=2.5, label=label)
    axes[0].set(xlabel="位置 / m", ylabel="概率密度 / (1/m)", title="均值与不确定性", xlim=(-4,6))
    variances = [p0,p1,p2_prior,p2]
    axes[1].plot(range(4), variances, "o-", color="#1b4f72", lw=2.5, ms=7)
    for i,v in enumerate(variances):
        axes[1].annotate(f"{v:g}", (i,v), xytext=(0,9), textcoords="offset points", ha="center")
    axes[1].set_xticks(range(4), ["初始预测","第一次校正","过程传播","第二次校正"], fontsize=10)
    axes[1].set(ylabel="误差方差 / m²", title="预测与校正递推", ylim=(0,4.6))
    for ax in axes:
        ax.grid(alpha=.2)
    axes[0].legend(fontsize=10)
    fig.savefig(args.output_dir / "08-kalman-uncertainty.png", dpi=170)
    plt.close(fig)
    output = {"sources": ["MIT OCW 2.160 (2006), Lecture 6, equations 38, 41, 45", "MIT OCW 6.801 (2020), Lecture 2, perspective projection"], "parameter_origin": "all numeric parameters chosen for source-formula substitution; plotted densities additionally assume Gaussian state/noise", "kalman": {"A":1,"H":1,"G":1,"first_prior_mean_m":mean0,"first_prior_variance_m2":p0,"R_m2":r,"Q_m2":process_q,"first_measurement_m":2.0,"first_gain":k1,"first_posterior_mean_m":mean1,"first_posterior_variance_m2":p1,"second_prior_variance_m2":p2_prior,"second_measurement_m":1.6,"second_gain":k2,"second_posterior_mean_m":mean2,"second_posterior_variance_m2":p2}, "projection": {"focal_length_pixels":focal_px,"points_m":[point1.tolist(),point2.tolist()],"image_points_pixels":[uv1.tolist(),uv2.tolist()]}, "checks": "gain, posterior, process covariance propagation, Joseph equivalence and projective scale invariance passed"}
    (results_dir / "08-estimation-results.json").write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps(output, ensure_ascii=True))


if __name__ == "__main__":
    main()
