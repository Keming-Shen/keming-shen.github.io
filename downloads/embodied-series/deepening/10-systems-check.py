"""Chapter 10: analytic inertia, data age and identification checks.

Run with Python 3.8+; no simulator, ROS or third-party packages required.
All timestamps and identification measurements below are teaching inputs.
"""
import json
from math import isclose


def main():
    mass, side, offset, torque = 0.6, 0.1, 0.05, 0.01
    inertia_com = mass * side ** 2 / 6
    parallel_axis_term = mass * offset ** 2
    inertia_joint = inertia_com + parallel_axis_term
    alpha_joint = torque / inertia_joint
    alpha_wrong = torque / inertia_com
    assert isclose(inertia_joint, 0.0025, abs_tol=1e-15)
    assert isclose(alpha_joint, 4.0, abs_tol=1e-12)
    assert isclose(alpha_wrong, 10.0, abs_tol=1e-12)

    # Integer milliseconds keep the invented time budget exact.
    sample, receive, callback, actuation = 1000, 1006, 1020, 1032
    stages_ms = [receive - sample, callback - receive, actuation - callback]
    age_ms = actuation - sample
    displacement_m = 0.5 * age_ms / 1000
    pure_delay_frequency_hz = 5.0
    pure_delay_phase_deg = -360 * pure_delay_frequency_hz * age_ms / 1000
    assert stages_ms == [6, 14, 12]
    assert age_ms == sum(stages_ms) == 32
    assert isclose(displacement_m, 0.016)
    assert isclose(pure_delay_phase_deg, -57.6)

    # tau = I * acceleration + damping * velocity after gravity subtraction.
    a1, v1, tau1 = 2.0, 1.0, 0.015
    a2, v2, tau2 = -1.0, 2.0, 0.0175
    det = a1 * v2 - a2 * v1
    identified_inertia = (tau1 * v2 - tau2 * v1) / det
    identified_damping = (a1 * tau2 - a2 * tau1) / det
    assert isclose(identified_inertia, inertia_joint, abs_tol=1e-15)
    assert isclose(identified_damping, 0.01, abs_tol=1e-15)
    residuals = [
        identified_inertia * a + identified_damping * v - tau
        for a, v, tau in [(a1, v1, tau1), (a2, v2, tau2)]
    ]
    assert max(map(abs, residuals)) < 1e-14
    print(json.dumps({
        "case_type": "analytic_teaching_inputs",
        "inertia_com_kg_m2": inertia_com,
        "parallel_axis_term_kg_m2": parallel_axis_term,
        "inertia_joint_kg_m2": inertia_joint,
        "alpha_joint_rad_s2": alpha_joint,
        "alpha_using_com_inertia_rad_s2": alpha_wrong,
        "time_budget_ms": dict(zip(["transport", "queue", "compute_and_actuate"], stages_ms)),
        "data_age_ms": age_ms,
        "constant_velocity_displacement_m": displacement_m,
        "pure_delay_frequency_hz": pure_delay_frequency_hz,
        "pure_delay_phase_deg": pure_delay_phase_deg,
        "identified_inertia_kg_m2": identified_inertia,
        "identified_damping_Nm_s_per_rad": identified_damping,
        "identification_residuals_Nm": residuals,
        "verified": True,
    }, indent=2))


if __name__ == "__main__":
    main()
