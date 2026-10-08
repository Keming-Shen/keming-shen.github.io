"""Independent, standard-library numerical checks for chapter 06. MIT License."""
import json
import math


def clamp(value, lower=-1.0, upper=1.0):
    return min(upper, max(lower, value))


def remaining_one(x):
    u = clamp(-x / 2.0)
    return 0.5 * u * u + 0.5 * (x + u) ** 2


def two_step(x):
    u0 = clamp(-x / 3.0)
    u1 = clamp(-(x + u0) / 2.0)
    states = [x, x + u0, x + u0 + u1]
    cost = 0.5 * (u0 * u0 + u1 * u1 + states[-1] ** 2)
    return {"states": states, "controls": [u0, u1], "cost": cost}


result = two_step(4.0)
assert result["controls"] == [-1.0, -1.0]
assert result["states"] == [4.0, 3.0, 2.0]
assert result["cost"] == 3.0
multiplier = [1.0, 1.0]
gradient = [u + result["states"][-1] for u in result["controls"]]
stationarity = [g - m for g, m in zip(gradient, multiplier)]
assert max(map(abs, stationarity)) == 0.0
# Direct enumeration independently checks the continuous closed form to mesh accuracy.
mesh_minimum = min(0.5 * (-1 + i / 10000) ** 2 + remaining_one(4 - 1 + i / 10000) for i in range(20001))
assert abs(mesh_minimum - result["cost"]) < 1e-12
alpha, step = 0.2, 1e-6
objective = lambda a: 0.5 * math.exp(2 * a)
analytic_gradient = math.exp(2 * alpha)
finite_difference = (objective(alpha + step) - objective(alpha - step)) / (2 * step)
assert abs(analytic_gradient - finite_difference) < 1e-9
time_minimum = (15.0 / 8.0) * (math.pi / 2.0) / 1.3
nominal = two_step(2.0)
disturbed_state = nominal["states"][1] + 1.0
replanned = two_step(disturbed_state)
print(json.dumps({
    "bounded_qp_and_bellman": result,
    "unconstrained_controls": [-4.0 / 3.0] * 2,
    "unconstrained_cost": 8.0 / 3.0,
    "lower_bound_multipliers": multiplier,
    "kkt_stationarity_residual": stationarity,
    "enumerated_cost": mesh_minimum,
    "shooting_gradient": {"analytic": analytic_gradient, "finite_difference": finite_difference},
    "quintic_minimum_duration_for_speed": time_minimum,
    "mpc_replan": {"nominal": nominal, "disturbed_state": disturbed_state, "new_plan": replanned},
}, indent=2, ensure_ascii=False))
