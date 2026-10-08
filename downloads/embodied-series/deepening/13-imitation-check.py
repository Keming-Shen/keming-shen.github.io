"""Chapter 13: independent episodes, preprocessing and hypothetical rates.

No HDF5 files are read or changed; no training or rollouts are performed.
The population standard deviation is used in the toy preprocessing case.
"""
import json
from math import isclose, sqrt
from statistics import mean, pstdev


def wilson(successes, trials, z=1.96):
    assert 0 <= successes <= trials and trials > 0
    p = successes / trials
    denominator = 1 + z*z / trials
    center = (p + z*z / (2 * trials)) / denominator
    radius = z * sqrt(p * (1-p) / trials + z*z / (4 * trials*trials)) / denominator
    return [center - radius, center + radius]


def main():
    validation_count = int(0.1 * 200)
    training_count = 200 - validation_count
    assert (training_count, validation_count) == (180, 20)
    mixed_episode_probability = 1 - 0.9 ** 100 - 0.1 ** 100
    lengths = [10] * 8 + [100] * 2
    episode_ratio = 2 / len(lengths)
    frame_ratio = sum(lengths[-2:]) / sum(lengths)
    assert isclose(frame_ratio, 5/7)
    training_actions, held_out = [-0.2, 0.0, 0.2], 0.8
    train_mean, train_std = mean(training_actions), pstdev(training_actions)
    leaked_mean, leaked_std = mean(training_actions + [held_out]), pstdev(training_actions + [held_out])
    normalized_train_only = (held_out - train_mean) / train_std
    normalized_leaked = (held_out - leaked_mean) / leaked_std
    assert isclose(train_std, sqrt(0.08/3), abs_tol=1e-14)
    assert isclose(leaked_std, sqrt(0.14), abs_tol=1e-14)
    intervals = {"40_of_50": wilson(40, 50), "10_of_10": wilson(10, 10)}
    assert 0.669 < intervals["40_of_50"][0] < 0.671
    assert 0.887 < intervals["40_of_50"][1] < 0.889
    assert 0.721 < intervals["10_of_10"][0] < 0.723
    print(json.dumps({
        "case_type": "hypothetical_data_and_success_counts",
        "training_episodes": training_count,
        "validation_episodes": validation_count,
        "probability_one_100_frame_episode_crosses_random_frame_split": mixed_episode_probability,
        "variable_length_holdout_episode_ratio": episode_ratio,
        "variable_length_holdout_frame_ratio": frame_ratio,
        "training_action_mean": train_mean,
        "training_action_population_std": train_std,
        "held_out_action_train_only_normalized": normalized_train_only,
        "leaked_action_mean": leaked_mean,
        "leaked_action_population_std": leaked_std,
        "held_out_action_leaked_normalized": normalized_leaked,
        "wilson_approx_95_percent_intervals_z_1_96": intervals,
        "normalized_rmse_0_1_position_error_m_at_scale_0_05": 0.1 * 0.05,
        "normalized_rmse_0_1_rotation_error_rad_at_scale_0_5": 0.1 * 0.5,
        "verified": True,
    }, indent=2))


if __name__ == "__main__":
    main()
