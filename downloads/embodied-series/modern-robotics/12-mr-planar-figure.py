"""Plot the computed 2R target and recovered IK pose; no fabricated trajectory."""
from pathlib import Path
import argparse
import os
import numpy as np
import modern_robotics as mr

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1]/'assets'/'12-mr-planar-check.png')
args = parser.parse_args()
os.environ.setdefault('MPLCONFIGDIR', str(Path(__file__).resolve().parents[1]/'review'/'12-mpl-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Arc

M = np.eye(4)
M[0, 3] = 2.0
S = np.array([[0, 0], [0, 0], [1, 1], [0, 0], [0, -1], [0, 0]], dtype=float)
target_q = np.deg2rad([30.0, 60.0])
target = mr.FKinSpace(M, S, target_q)
ik_q, success = mr.IKinSpace(S, M, target, np.deg2rad([20.0, 70.0]), 1e-8, 1e-8)
assert success
recovered = mr.FKinSpace(M, S, ik_q)
np.testing.assert_allclose(recovered, target, atol=1e-8, rtol=0)
elbow = np.array([np.cos(target_q[0]), np.sin(target_q[0])])
tip = target[:2, 3]
fig, ax = plt.subplots(figsize=(8, 6), constrained_layout=True)
ax.plot([0, 1, 2], [0, 0, 0], '--o', color='#94a3b8', lw=2, label='Home pose: [0°, 0°]')
ax.plot([0, elbow[0], tip[0]], [0, elbow[1], tip[1]], '-o', color='#2563eb', lw=4, ms=9, label='FK target: [30°, 60°]')
ax.scatter(*recovered[:2, 3], s=180, facecolors='none', edgecolors='#0f766e', lw=2.5, zorder=5, label='Recovered IK tip')
ax.plot([elbow[0], elbow[0]+.5*np.cos(target_q[0])],
        [elbow[1], elbow[1]+.5*np.sin(target_q[0])], ':', color='#94a3b8')
ax.add_patch(Arc((0, 0), .6, .6, theta1=0, theta2=30, color='#ea580c', lw=2))
ax.add_patch(Arc(elbow, .6, .6, theta1=30, theta2=90, color='#ea580c', lw=2))
ax.text(.35, .07, r'$\theta_1=30^\circ$', color='#c2410c', fontsize=12)
ax.text(elbow[0]+.18, elbow[1]+.37, r'$\theta_2=60^\circ$', color='#c2410c', fontsize=12)
ax.annotate('(0.866025404, 1.5) m', xy=tip, xytext=(1.1, 1.4), fontsize=11,
            arrowprops={'arrowstyle':'-','color':'#64748b'})
ax.text(.33, .38, '$L_1=1$ m', fontsize=12, color='#2563eb')
ax.text(.5, 1.03, '$L_2=1$ m', fontsize=12, color='#2563eb')
ax.set_aspect('equal');ax.set_xlim(-.2, 2.15);ax.set_ylim(-.2, 1.85)
ax.set_xlabel('x (m)');ax.set_ylabel('y (m)')
ax.set_title('2R planar model: POE forward kinematics and recovered IK', fontsize=13, pad=14)
ax.grid(alpha=.15);ax.legend(loc='upper right', fontsize=10)
args.output.parent.mkdir(parents=True, exist_ok=True)
fig.savefig(args.output, dpi=180)
print('Saved:', args.output.name)
