"""Recalculate the introductory examples; Python standard library only.

All parameters are teaching assumptions, not measurements of a real robot.
Run: python 00-task-chain.py
"""
import json
import math


def position(q):
    return [math.cos(q[0]) + math.cos(sum(q)),
            math.sin(q[0]) + math.sin(sum(q))]


def main():
    q = [0.0, math.pi / 2]
    qdot = [0.0, -0.1]
    dt = 0.01
    p0 = position(q)
    p1 = position([qi + dt * vi for qi, vi in zip(q, qdot)])
    displacement = [b - a for a, b in zip(p0, p1)]
    mass, gravity = 0.5, 9.81
    # Gravity compensation for an extra point mass at the end effector.
    payload_torque = [mass * gravity * p0[0],
                      mass * gravity * math.cos(sum(q))]
    delay_error = 0.1 * 0.02
    contact_force = 10000.0 * 0.0005
    friction_limit = 0.6 * 100.0
    assert math.isclose(p0[0], 1.0, abs_tol=1e-12)
    assert math.isclose(p0[1], 1.0, abs_tol=1e-12)
    assert math.isclose(displacement[0], math.sin(0.001), abs_tol=1e-12)
    assert math.isclose(displacement[1], math.cos(0.001) - 1, abs_tol=1e-12)
    assert math.isclose(payload_torque[0], 4.905, abs_tol=1e-12)
    assert math.isclose(payload_torque[1], 0.0, abs_tol=1e-12)
    assert math.isclose(delay_error, 0.002, abs_tol=1e-12)
    assert contact_force == 5.0 and friction_limit == 60.0
    print(json.dumps({
        "two_link_position_m": p0,
        "joint_velocity_rad_s": qdot,
        "step_s": dt,
        "exact_position_after_step_m": p1,
        "exact_displacement_m": displacement,
        "extra_payload_gravity_compensation_Nm": payload_torque,
        "constant_velocity_delay_error_m": delay_error,
        "linear_spring_contact_force_N": contact_force,
        "coulomb_tangential_force_limit_N": friction_limit,
        "requested_tangential_force_N": 70.0,
        "checks_passed": True,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
