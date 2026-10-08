"""A two-link planar teaching model using Modern Robotics' public API.

Library: NxRLab/ModernRobotics, cbd41fdf0bf75dbd5e986d832ae14226964ff0ac.
The official core.py is unmodified; its complete MIT LICENSE is in modern_robotics/.
The 2R dimensions, target, analytic checks and finite differences are new examples.
This script uses NumPy only, and runs independently of the Pinocchio examples.
"""
import numpy as np
import modern_robotics as mr

np.set_printoptions(precision=9, suppress=True)
M_mr = np.eye(4)
M_mr[0, 3] = 2.0
S_mr = np.array([[0, 0], [0, 0], [1, 1],
                 [0, 0], [0, -1], [0, 0]], dtype=float)
theta_mr = np.deg2rad([30.0, 60.0])
T_mr = mr.FKinSpace(M_mr, S_mr, theta_mr)
Js_mr = mr.JacobianSpace(S_mr, theta_mr)
p_mr = T_mr[:3, 3]
Jp_mr = Js_mr[3:] - mr.VecToso3(p_mr) @ Js_mr[:3]

# An independent trigonometric forward-kinematics check.
q1, q2 = theta_mr
p_analytic = np.array([np.cos(q1) + np.cos(q1 + q2),
                       np.sin(q1) + np.sin(q1 + q2), 0.0])
np.testing.assert_allclose(p_mr, p_analytic, atol=1e-12, rtol=0)

# The space twist's linear component is not the derivative of the tip position.
h = 1e-6
Jp_fd = np.column_stack([
    (mr.FKinSpace(M_mr, S_mr, theta_mr + h * e)[:3, 3]
     - mr.FKinSpace(M_mr, S_mr, theta_mr - h * e)[:3, 3]) / (2 * h)
    for e in np.eye(2)
])
np.testing.assert_allclose(Jp_mr, Jp_fd, atol=1e-9, rtol=0)

theta_ik, success = mr.IKinSpace(
    S_mr, M_mr, T_mr, np.deg2rad([20.0, 70.0]), 1e-8, 1e-8)
T_ik = mr.FKinSpace(M_mr, S_mr, theta_ik)
assert success
np.testing.assert_allclose(T_ik, T_mr, atol=1e-8, rtol=0)

print('FK position (m):', p_mr)
print('Space Jacobian [omega; v]:\n', Js_mr)
print('Tip-position Jacobian (m/rad):\n', Jp_mr)
print('Finite-difference max error:', f'{np.max(np.abs(Jp_mr - Jp_fd)):.3e}')
print('IK success:', success)
print('IK angles (deg):', np.rad2deg(theta_ik))
print('FK recovery max error:', f'{np.max(np.abs(T_ik - T_mr)):.3e}')
