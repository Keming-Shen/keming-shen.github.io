"""Independent, standard-library numerical checks for chapter 07. MIT License."""
import json
import math


def grasp(weight, external_moment, normal=10.0, mu=0.5, a=0.05):
    # Contact moment must cancel the external positive moment.
    left = weight / 2 + external_moment / (2 * a)
    right = weight / 2 - external_moment / (2 * a)
    margin = [mu * normal - abs(left), mu * normal - abs(right)]
    return {"tangential_forces": [left, right], "contact_wrench": [a * (right - left), 0.0, left + right],
            "friction_margins": margin, "feasible": min(margin) >= -1e-12,
            "minimum_symmetric_normal": max(abs(left), abs(right)) / mu}


boundary, infeasible, restored = grasp(8.0, 0.1), grasp(8.0, 0.2), grasp(8.0, 0.2, normal=12.0)
assert boundary["feasible"] and not infeasible["feasible"] and restored["feasible"]
assert boundary["tangential_forces"] == [5.0, 3.0]
assert infeasible["tangential_forces"] == [6.0, 2.0]
alpha, slope, gravity, length = math.pi / 8, 0.1, 9.81, 1.0
c = math.cos(2 * alpha)
d = 4 * gravity / length * math.sin(alpha) * math.sin(slope)
fixed_point = c * math.sqrt(d / (1 - c * c))
minimum_speed = math.sqrt(2 * gravity / length * (1 - math.cos(slope - alpha)))
mapping = lambda omega: c * math.sqrt(omega * omega + d)
assert abs(mapping(fixed_point) - fixed_point) < 1e-12
assert fixed_point > minimum_speed
derivative = c * fixed_point / math.sqrt(fixed_point * fixed_point + d)
assert abs(derivative - c * c) < 1e-12
trajectory = [1.0]
for _ in range(6):
    assert trajectory[-1] > minimum_speed
    trajectory.append(mapping(trajectory[-1]))
s1, c1, s2, c2 = math.sin(math.pi / 6), math.cos(math.pi / 6), math.sin(5 * math.pi / 12), math.cos(5 * math.pi / 12)
k11, k12, k22 = 100 * s1 * s1 + 400 * c1 * c1, 100 * s1 * s2 + 400 * c1 * c2, 100 * s2 * s2 + 400 * c2 * c2
k_absolute = [[k11, k12], [k12, k22]]
k_relative = [[k11 + 2 * k12 + k22, k12 + k22], [k12 + k22, k22]]
assert k11 * k22 - k12 * k12 > 0
print(json.dumps({"grasp_boundary": boundary, "grasp_excess_moment": infeasible, "grasp_more_normal_force": restored,
                  "rimless_wheel": {"alpha_rad": alpha, "slope_rad": slope, "energy_term": d,
                                    "fixed_point_rad_s": fixed_point, "minimum_forward_speed_rad_s": minimum_speed,
                                    "return_derivative": derivative, "post_impact_sequence": trajectory},
                  "stiffness_absolute_angles": k_absolute, "stiffness_relative_joint_angles": k_relative}, indent=2))
