"""Chapter 14: multirate control, position-action mapping and reward scale.

Teaching joint parameters are deliberately separate from the G1 asset.
No GPU, Isaac Lab, training, simulation or hardware validation is performed.
"""
import json
from fractions import Fraction
from math import ceil, exp, isclose


def main():
    control_hz, physics_hz, environments, steps_per_block = 30, 120, 4, 32
    control_dt, physics_dt = Fraction(1, control_hz), Fraction(1, physics_hz)
    decimation = physics_hz // control_hz
    assert physics_hz % control_hz == 0 and decimation == 4
    samples_per_block = environments * steps_per_block
    budget, blocks = 1000000, ceil(1000000 / samples_per_block)
    assert blocks == 7813 and blocks * samples_per_block == 1000064
    low, high, normalized_action = -0.6, 1.0, 0.5
    zero_center, expansion = 0.0, 1.4
    action_scale = expansion * max(abs(high-zero_center), abs(low-zero_center))
    action_box = [zero_center - action_scale, zero_center + action_scale]
    target = zero_center + action_scale * normalized_action
    mechanical_mid, mechanical_half_width = (low+high)/2, (high-low)/2
    wrong_target = mechanical_mid + mechanical_half_width * normalized_action
    q, velocity, kp, kd, torque_limit = 0.6, -0.2, 40.0, 2.0, 3.0
    requested_torque = kp * (target-q) - kd * velocity
    clamped_torque = max(-torque_limit, min(torque_limit, requested_torque))
    assert isclose(target, 0.7, abs_tol=1e-14)
    assert isclose(wrong_target, 0.6, abs_tol=1e-14)
    assert isclose(requested_torque, 4.4, abs_tol=1e-14)
    assert clamped_torque == 3.0
    key_rewards = [0.15 * exp(-10 * e) for e in [0.01, 0.09]]
    latency_s, angular_speed = 0.012, 2.0
    assert isclose(latency_s * angular_speed, 0.024)
    print(json.dumps({
        "case_type": "analytic_schedule_and_teaching_joint",
        "decimation": decimation,
        "control_period_ms": float(control_dt * 1000),
        "physics_period_ms": float(physics_dt * 1000),
        "reference_preview_ms": [float(control_dt * i * 1000) for i in [1, 2, 3]],
        "samples_per_4_environment_32_step_block": samples_per_block,
        "simulated_seconds_per_environment_per_block": float(control_dt * steps_per_block),
        "physics_steps_per_environment_per_block": decimation * steps_per_block,
        "minimum_fixed_blocks_for_budget": blocks,
        "samples_in_fixed_blocks": blocks * samples_per_block,
        "teaching_mechanical_limits_rad": [low, high],
        "zero_centered_expanded_action_box_rad": action_box,
        "normalized_action": normalized_action,
        "target_rad": target,
        "wrong_target_from_mechanical_limits_rad": wrong_target,
        "ideal_continuous_PD_requested_torque_Nm": requested_torque,
        "teaching_clamped_torque_Nm": clamped_torque,
        "key_position_reward_for_squared_errors_0_01_and_0_09": key_rewards,
        "angle_travel_in_12_ms_at_2_rad_s": latency_s * angular_speed,
        "hardware_500_hz_to_policy_30_hz_ratio": 500 / control_hz,
        "verified": True,
    }, indent=2))


if __name__ == "__main__":
    main()
