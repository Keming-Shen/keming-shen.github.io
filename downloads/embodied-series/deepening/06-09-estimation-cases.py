"""Independent, standard-library numerical checks for chapter 08. MIT License."""
import json
import math


def multiply(a, b):
    return [[sum(ai[k] * b[k][j] for k in range(len(b))) for j in range(len(b[0]))] for ai in a]


def transpose(a):
    return [list(row) for row in zip(*a)]


def add(a, b):
    return [[x + y for x, y in zip(arow, brow)] for arow, brow in zip(a, b)]


a, p0, g, q, r = [[1.0, 1.0], [0.0, 1.0]], [[1.0, 0.0], [0.0, 1.0]], [0.5, 1.0], 0.04, 0.25
p_minus = add(multiply(multiply(a, p0), transpose(a)), [[q * x * y for y in g] for x in g])
s = p_minus[0][0] + r
k = [row[0] / s for row in p_minus]
innovation = 1.2 - 1.0
x_plus = [1.0 + gain * innovation for gain in k]
ikh = [[1.0 - k[0], 0.0], [-k[1], 1.0]]
p_plus = add(multiply(multiply(ikh, p_minus), transpose(ikh)), [[r * x * y for y in k] for x in k])
compact = [[p_minus[i][j] - k[i] * p_minus[0][j] for j in range(2)] for i in range(2)]
assert max(abs(p_plus[i][j] - compact[i][j]) for i in range(2) for j in range(2)) < 1e-12
assert p_plus[0][0] * p_plus[1][1] - p_plus[0][1] * p_plus[1][0] > 0
scale = 0.01
same_k = [scale * row[0] / (scale * s) for row in p_minus]
assert max(abs(x - y) for x, y in zip(k, same_k)) < 1e-12
larger_r_k = [row[0] / (p_minus[0][0] + 2.5) for row in p_minus]
ekf_k = 0.25 * 4 / (4 * 0.25 * 4 + 0.04)
ekf_state = 2 + ekf_k * (5 - 4)
f, x, y, z = 800.0, 0.2, 0.1, 2.0
projection_jacobian = [[f / z, 0, -f * x / (z * z)], [0, f / z, -f * y / (z * z)]]
image_velocity = [sum(a * b for a, b in zip(row, [0.1, 0.0, 0.2])) for row in projection_jacobian]
trials = math.ceil(math.log(1 - 0.99) / math.log(1 - 0.6 ** 3))
assert trials == 19
print(json.dumps({"position_velocity_filter": {"prior_state": [0.0, 1.0], "predicted_state": [1.0, 1.0],
                                              "predicted_covariance": p_minus, "innovation_variance": s,
                                              "gain": k, "posterior_state": x_plus, "posterior_covariance": p_plus,
                                              "normalized_innovation_squared": innovation * innovation / s},
                  "scaled_covariances_gain": same_k, "measurement_variance_2_5_gain": larger_r_k,
                  "square_measurement_ekf": {"gain": ekf_k, "posterior": ekf_state, "positive_exact_root": math.sqrt(5)},
                  "projection_jacobian": projection_jacobian, "image_velocity_px_s": image_velocity,
                  "ransac_trials": trials, "ransac_success_probability": 1 - (1 - 0.6 ** 3) ** trials}, indent=2))
