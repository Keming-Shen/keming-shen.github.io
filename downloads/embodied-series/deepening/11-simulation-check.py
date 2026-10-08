"""Chapter 11: coordinate dimensions and exact multirate scheduling.

Only analytic counting is performed, with no MuJoCo execution.
Video requests use [0, duration), rounded to the first physics state at or
after each requested time. Fractions avoid floating-point boundary effects.
"""
import json
from fractions import Fraction
from math import ceil, isclose


def main():
    joint_dims = {"free": (7, 6), "hinge": (1, 1), "ball": (4, 3)}
    layouts = [("free", "hinge", "hinge"), ("free", "hinge", "hinge", "ball")]
    dimensions = [
        {"joints": layout,
         "nq": sum(joint_dims[j][0] for j in layout),
         "nv": sum(joint_dims[j][1] for j in layout)}
        for layout in layouts
    ]
    assert [(x["nq"], x["nv"]) for x in dimensions] == [(9, 8), (13, 11)]
    physics_dt, control_dt, video_dt = Fraction(1, 500), Fraction(1, 50), Fraction(1, 60)
    duration = Fraction(2)
    physics_steps = duration / physics_dt
    control_intervals = duration / control_dt
    decimation = control_dt / physics_dt
    assert physics_steps.denominator == control_intervals.denominator == decimation.denominator == 1
    requests = [i * video_dt for i in range(int(duration / video_dt))]
    actual_times = [ceil(t / physics_dt) * physics_dt for t in requests]
    offsets = [actual - request for actual, request in zip(actual_times, requests)]
    assert len(requests) == 120
    assert all(Fraction(0) <= e < physics_dt for e in offsets)
    assert max(offsets) == Fraction(1, 750)
    refined_physics_dt = physics_dt / 2
    refined_steps = duration / refined_physics_dt
    refined_decimation = control_dt / refined_physics_dt
    assert refined_steps == 2000 and refined_decimation == 20
    natural_frequency = 20.0
    nondimensional_step = natural_frequency * float(physics_dt)
    assert isclose(nondimensional_step, 0.04)
    assert nondimensional_step < 2.0  # unforced scalar semi-implicit Euler oscillator only
    print(json.dumps({
        "case_type": "analytic_coordinate_and_schedule_checks",
        "dimensions": dimensions,
        "physics_steps": int(physics_steps),
        "control_intervals": int(control_intervals),
        "decimation": int(decimation),
        "video_frames_on_half_open_grid": len(requests),
        "max_video_grid_offset_ms": float(max(offsets) * 1000),
        "refined_physics_steps_at_1_ms": int(refined_steps),
        "refined_decimation_at_same_control_period": int(refined_decimation),
        "natural_frequency_rad_s": natural_frequency,
        "omega_dt": nondimensional_step,
        "scalar_semi_implicit_euler_oscillator_stable": nondimensional_step < 2.0,
        "verified": True,
    }, indent=2))


if __name__ == "__main__":
    main()
