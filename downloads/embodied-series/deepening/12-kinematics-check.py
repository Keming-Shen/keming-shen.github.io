"""Chapter 12: diagonal damped least squares and a 2x2 dynamics identity.

Uses only the standard library. These are analytic toy models, not results
from Pinocchio's sample manipulator or the separate Modern Robotics 2R arm.
"""
import json
from math import isclose, sqrt


def main():
    singular_values, error = (1.0, 0.001), (0.1, 0.01)
    undamped = [-e / s for s, e in zip(singular_values, error)]
    damping = 1e-4
    damped = [-s * e / (s * s + damping) for s, e in zip(singular_values, error)]
    dt = 0.1
    increment = [dt * x for x in damped]
    residual_unit_step = [e + s * x for e, s, x in zip(error, singular_values, damped)]
    for s, e, x in zip(singular_values, error, damped):
        assert isclose((s * s + damping) * x, -s * e, abs_tol=1e-15)
    assert isclose(undamped[1], -10.0)
    assert isclose(damped[1], -0.099009900990099, abs_tol=1e-14)
    assert isclose(residual_unit_step[1], 0.009900990099009901, abs_tol=1e-15)
    assert sqrt(sum(x*x for x in damped)) < sqrt(sum(x*x for x in undamped))

    m11, m12, m22 = 2.0, 0.5, 1.0
    a, bias = (0.4, -0.6), (0.3, -0.2)
    tau = [m11 * a[0] + m12 * a[1] + bias[0],
           m12 * a[0] + m22 * a[1] + bias[1]]
    det = m11 * m22 - m12 ** 2
    rhs = [t - h for t, h in zip(tau, bias)]
    recovered = [(m22 * rhs[0] - m12 * rhs[1]) / det,
                 (m11 * rhs[1] - m12 * rhs[0]) / det]
    assert det > 0 and m11 > 0
    assert all(isclose(x, y, abs_tol=1e-14) for x, y in zip(a, recovered))
    assert all(isclose(x, y, abs_tol=1e-14) for x, y in zip(tau, [0.8, -0.6]))
    # omega=(0,0,1), spatial v=(0,0,0), tool p=(1,0,0).
    tool_velocity = [0.0, 1.0, 0.0]  # v + omega cross p
    print(json.dumps({
        "case_type": "analytic_toy_models",
        "singular_values": singular_values,
        "undamped_update": undamped,
        "lambda": damping,
        "damped_update": damped,
        "DT": dt,
        "configuration_increment": increment,
        "linear_residual_with_unit_step": residual_unit_step,
        "inertia_matrix": [[m11, m12], [m12, m22]],
        "inertia_determinant": det,
        "bias": bias,
        "requested_acceleration": a,
        "torque": tau,
        "recovered_acceleration": recovered,
        "round_trip_error": max(abs(x-y) for x, y in zip(a, recovered)),
        "world_tool_point_velocity_m_s": tool_velocity,
        "verified": True,
    }, indent=2))


if __name__ == "__main__":
    main()
