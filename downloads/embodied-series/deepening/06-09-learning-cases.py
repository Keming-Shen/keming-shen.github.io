"""Independent, standard-library numerical checks for chapter 09. MIT License."""
import json
import math


def mdp(discount):
    # State B: success -> terminal (p=.8,r=5), failure -> B (p=.2,r=-1).
    vb = (0.8 * 5 + 0.2 * -1) / (1 - 0.2 * discount)
    go, safe = -0.5 + discount * vb, 2.0
    policy_va = 0.25 * go + 0.75 * safe
    value = 0.0
    for _ in range(100):
        value = 0.8 * 5 + 0.2 * (-1 + discount * value)
    assert abs(value - vb) < 1e-12
    advantages = [go - policy_va, safe - policy_va]
    assert abs(0.25 * advantages[0] + 0.75 * advantages[1]) < 1e-12
    return {"B_value": vb, "A_action_values": {"go": go, "safe": safe}, "A_optimal_action": "go" if go > safe else "safe",
            "A_policy_value": policy_va, "A_advantages": advantages,
            "B_success_td_target": 5.0, "B_failure_td_target": -1 + discount * vb}


long_horizon, short_horizon = mdp(0.9), mdp(0.4)
assert long_horizon["A_optimal_action"] == "go" and short_horizon["A_optimal_action"] == "safe"
alpha_bar, clean_action, noise = 0.25, 1.0, 0.4
noisy_action = math.sqrt(alpha_bar) * clean_action + math.sqrt(1 - alpha_bar) * noise
restored_action = (noisy_action - math.sqrt(1 - alpha_bar) * noise) / math.sqrt(alpha_bar)
assert abs(restored_action - clean_action) < 1e-12
delta_bias = [0.1 * (i + 1) for i in range(4)]
relative_bias = [0.1] * 4
open_loop_drift = [0.02 * i for i in range(11)]
corrected = [0.0]
for _ in range(10):
    corrected.append(0.2 * corrected[-1] + 0.02)
ppo_contribution = lambda ratio, advantage: min(ratio * advantage, min(1.2, max(0.8, ratio)) * advantage)
assert abs(ppo_contribution(1.4, 1.0) - 1.2) < 1e-12
assert abs(ppo_contribution(0.6, -1.0) + 0.8) < 1e-12
print(json.dumps({"discount_0_9": long_horizon, "discount_0_4": short_horizon,
                  "incremental_action_bias_deg": delta_bias, "common_reference_action_bias_deg": relative_bias,
                  "behavior_cloning_drift_m": open_loop_drift, "corrective_feedback_bias_m": corrected,
                  "ppo_clipped_contributions": [ppo_contribution(1.4, 1.0), ppo_contribution(0.6, -1.0)],
                  "diffusion_forward_and_clean_recovery": {"alpha_bar": alpha_bar, "clean_action": clean_action,
                                                            "noise": noise, "noisy_action": noisy_action, "recovered_action": restored_action}}, indent=2))
