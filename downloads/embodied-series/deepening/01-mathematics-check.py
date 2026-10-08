"""Projection, QR, positive definiteness, Jacobian and ODE examples.

Python standard library only. Run: python 01-mathematics-check.py
The fine RK4 solution is a numerical reference, not an analytic exact solution.
"""
import json
import math


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def f(x, y):
    return y * y - x


def integrate(method, steps):
    h, y = 1.0 / steps, -1.0
    for i in range(steps):
        x = i * h
        k1 = f(x, y)
        if method == "Euler":
            y += h * k1
        elif method == "Heun":
            k2 = f(x + h, y + h * k1)
            y += h * (k1 + k2) / 2
        elif method == "RK4":
            k2 = f(x + h / 2, y + h * k1 / 2)
            k3 = f(x + h / 2, y + h * k2 / 2)
            k4 = f(x + h, y + h * k3)
            y += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6
        else:
            raise ValueError(method)
    return y


def main():
    q1 = [1 / math.sqrt(3)] * 3
    q2 = [0.0, -1 / math.sqrt(2), 1 / math.sqrt(2)]
    obs = [2.1, 0.9, 3.0]
    rhs = [dot(q1, obs), dot(q2, obs)]
    coeff2 = rhs[1] / math.sqrt(2)
    coeff1 = (rhs[0] - math.sqrt(3) * coeff2) / math.sqrt(3)
    predicted = [coeff1 + coeff2, coeff1, coeff1 + 2 * coeff2]
    residual = [o - p for o, p in zip(obs, predicted)]
    assert math.isclose(coeff1, 0.95, abs_tol=1e-12)
    assert math.isclose(coeff2, 1.05, abs_tol=1e-12)
    assert math.isclose(dot(residual, residual), 0.015, abs_tol=1e-12)
    assert math.isclose(sum(residual), 0.0, abs_tol=1e-12)
    assert math.isclose(dot([1, 0, 2], residual), 0.0, abs_tol=1e-12)
    times, values, weights = [1, 2, 3], [1, 2, 2], [100, 100, 4]
    s0 = sum(weights)
    s1 = sum(w * t for w, t in zip(weights, times))
    s2 = sum(w * t * t for w, t in zip(weights, times))
    b0 = sum(w * b for w, b in zip(weights, values))
    b1 = sum(w * t * b for w, t, b in zip(weights, times, values))
    determinant = s0 * s2 - s1 * s1
    intercept = (s2 * b0 - s1 * b1) / determinant
    slope = (s0 * b1 - s1 * b0) / determinant
    weighted_predictions = [intercept + slope * t for t in times]
    weighted_cost = sum(w * (b - p)**2 for w, b, p in zip(weights, values, weighted_predictions))
    assert math.isclose(intercept, 2 / 15, abs_tol=1e-12)
    assert math.isclose(slope, 0.9, abs_tol=1e-12)
    assert math.isclose(weighted_cost, 10 / 3, abs_tol=1e-12)
    # A = [[5,2],[2,3]], with v=[1,-1].
    velocity = [1.0, -1.0]
    Av = [5 * velocity[0] + 2 * velocity[1],
          2 * velocity[0] + 3 * velocity[1]]
    kinetic_energy = 0.5 * dot(velocity, Av)
    assert kinetic_energy == 2.0
    # Position Jacobian at q=[0, pi/2], unit-length links.
    J = [[-1.0, -1.0], [1.0, 0.0]]
    qdot = [0.0, -0.1]
    end_velocity = [dot(row, qdot) for row in J]
    singular_J = [[0.0, 0.0], [2.0, 1.0]]
    assert end_velocity == [0.1, 0.0]
    assert [dot(row, [1, -2]) for row in singular_J] == [0.0, 0.0]
    reference = integrate("RK4", 10000)
    refined_reference = integrate("RK4", 20000)
    assert abs(reference - refined_reference) < 1e-11
    budget = []
    for method, steps, evals in [("Euler", 8, 1), ("Heun", 4, 2), ("RK4", 2, 4)]:
        result = integrate(method, steps)
        budget.append({"method": method, "steps": steps,
                       "step": 1 / steps, "function_evaluations": steps * evals,
                       "y_at_1": result, "absolute_error": abs(result - reference)})
    convergence = []
    for method in ["Euler", "Heun", "RK4"]:
        errors = [abs(integrate(method, n) - reference) for n in [20, 40, 80]]
        convergence.append({"method": method, "steps": [20, 40, 80],
                            "errors": errors,
                            "error_ratios": [errors[0] / errors[1], errors[1] / errors[2]]})
    print(json.dumps({
        "projection": {"b": [2, 3], "projected": [2, 0], "residual": [0, 3],
                       "residual_norm": 3},
        "qr": {"R": [[math.sqrt(3), math.sqrt(3)], [0, math.sqrt(2)]],
               "Q_transpose_observation": rhs, "coefficients": [coeff1, coeff2],
               "predicted": predicted, "residual": residual,
               "residual_squared_norm": dot(residual, residual)},
        "weighted_least_squares": {"weights": weights,
                                   "coefficients": [intercept, slope],
                                   "predicted": weighted_predictions,
                                   "weighted_residual_cost": weighted_cost},
        "positive_definite_example": {"eigenvalues": [4 + math.sqrt(5), 4 - math.sqrt(5)],
                                      "kinetic_energy_J": kinetic_energy},
        "jacobian_example": {"J": J, "qdot": qdot, "end_velocity": end_velocity,
                             "singular_J": singular_J, "null_direction": [1, -2]},
        "ode_reference": {"method": "RK4", "steps": 10000, "y_at_1": reference,
                          "refinement_difference": abs(reference - refined_reference)},
        "equal_evaluation_budget": budget, "convergence": convergence,
        "explicit_euler_decay": {"alpha_per_s": 100, "step_s": 0.03,
                                 "discrete_multiplier": 1 - 100 * 0.03,
                                 "continuous_multiplier": math.exp(-100 * 0.03),
                                 "strict_decay_step_bound_s": 0.02},
        "checks_passed": True,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
