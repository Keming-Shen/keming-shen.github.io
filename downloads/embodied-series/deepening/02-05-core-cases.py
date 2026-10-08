"""Reproduce the Chapter 02--05 examples with the Python standard library.

Run: python 02-05-core-cases.py [--chapter 02|03|04|05]
The output is JSON. All models are explicitly idealized in the articles.
"""

import argparse
import json
import math


def transpose(a):
    return [list(row) for row in zip(*a)]


def matmul(a, b):
    return [[sum(x * y for x, y in zip(row, col)) for col in zip(*b)]
            for row in a]


def matvec(a, x):
    return [sum(v * w for v, w in zip(row, x)) for row in a]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]]


def skew(x):
    return [[0.0, -x[2], x[1]], [x[2], 0.0, -x[0]],
            [-x[1], x[0], 0.0]]


def eye(n):
    return [[float(i == j) for j in range(n)] for i in range(n)]


def exp_se3(rho, theta):
    angle = math.sqrt(dot(theta, theta))
    w = skew(theta)
    w2 = matmul(w, w)
    if angle < 1e-8:
        a, b, c = 1.0, 0.5, 1.0 / 6.0
    else:
        a = math.sin(angle) / angle
        b = (1 - math.cos(angle)) / angle**2
        c = (angle - math.sin(angle)) / angle**3
    r = [[float(i == j) + a * w[i][j] + b * w2[i][j]
          for j in range(3)] for i in range(3)]
    v = [[float(i == j) + b * w[i][j] + c * w2[i][j]
          for j in range(3)] for i in range(3)]
    p = matvec(v, rho)
    return [r[i] + [p[i]] for i in range(3)] + [[0, 0, 0, 1]]


def chapter02():
    t = [[0, -1, 0, 1], [1, 0, 0, 2], [0, 0, 1, 0], [0, 0, 0, 1]]
    rb = [row[:3] for row in t[:3]]
    p = [row[3] for row in t[:3]]
    translation = exp_se3([0.1, 0, 0], [0, 0, 0])
    right = matmul(t, translation)
    left = matmul(translation, t)
    theta_b = [0, 0, math.pi / 6]
    theta_s = matvec(rb, theta_b)
    rho_s = cross(p, theta_s)
    right_rotation = matmul(t, exp_se3([0, 0, 0], theta_b))
    left_equivalent = matmul(exp_se3(rho_s, theta_s), t)
    left_naive = matmul(exp_se3([0, 0, 0], theta_s), t)
    error = max(abs(x - y) for a, b in zip(right_rotation, left_equivalent)
                for x, y in zip(a, b))
    assert error < 1e-12
    point = [0.2, 0.1, 0.0]
    h = 1e-6
    perturbed = matmul(rb, [row[:3] for row in
                           exp_se3([0, 0, 0], [0, 0, h])[:3]])
    fd = [(x - y) / h for x, y in zip(matvec(perturbed, point), matvec(rb, point))]
    analytic = matvec(rb, cross([0, 0, 1], point))
    assert max(abs(x - y) for x, y in zip(fd, analytic)) < 2e-7
    return {
        'initial_origin_m': p,
        'right_local_translation_origin_m': [row[3] for row in right[:3]],
        'left_world_translation_origin_m': [row[3] for row in left[:3]],
        'body_rotation_vector_rad': theta_b,
        'equivalent_spatial_rho_m': rho_s,
        'body_rotation_origin_m': [row[3] for row in right_rotation[:3]],
        'naive_world_rotation_origin_m': [row[3] for row in left_naive[:3]],
        'adjoint_conjugacy_max_error': error,
        'point_rotation_derivative_analytic': analytic,
        'point_rotation_derivative_finite_difference': fd,
    }


def fk2(q):
    a, b = q
    return [math.cos(a) + math.cos(a + b), math.sin(a) + math.sin(a + b)]


def jac2(q):
    a, b = q
    return [[-math.sin(a) - math.sin(a + b), -math.sin(a + b)],
            [math.cos(a) + math.cos(a + b), math.cos(a + b)]]


def solve2(a, b):
    determinant = a[0][0] * a[1][1] - a[0][1] * a[1][0]
    return [(a[1][1] * b[0] - a[0][1] * b[1]) / determinant,
            (-a[1][0] * b[0] + a[0][0] * b[1]) / determinant]


def chapter03():
    velocity = [0.1, 0.0]
    branches = [[0.0, math.pi / 2], [math.pi / 2, -math.pi / 2]]
    checks = []
    for q in branches:
        dq = solve2(jac2(q), velocity)
        result = matvec(jac2(q), dq)
        assert max(abs(x - y) for x, y in zip(result, velocity)) < 1e-12
        checks.append({'q_2r_rad': q, 'q_3r_rad': q + [-sum(q)],
                       'wrist_position_m': fk2(q), 'joint_velocity_3r_rad_s': dq + [-sum(dq)],
                       'recovered_wrist_velocity_m_s': result})
    q = branches[0]
    phi = [q[0], sum(q)]
    ja = [[-math.sin(phi[0]), -math.sin(phi[1])],
          [math.cos(phi[0]), math.cos(phi[1])]]
    rebuilt = matmul(ja, [[1, 0], [1, 1]])
    assert max(abs(x - y) for r, s in zip(rebuilt, jac2(q))
               for x, y in zip(r, s)) < 1e-12
    x = 1.9999
    q2 = math.acos((x * x - 2) / 2)
    q_near = [-q2 / 2, q2]
    dq_near = solve2(jac2(q_near), [0.2, 0])
    scale = min(1.0, 1.0 / max(map(abs, dq_near)))
    limited = [scale * x for x in dq_near]
    return {'branches': checks, 'absolute_angle_jacobian': ja,
            'relative_angle_jacobian': jac2(q),
            'near_singular_q_rad': q_near, 'requested_velocity_m_s': [0.2, 0],
            'unlimited_joint_velocity_rad_s': dq_near,
            'joint_speed_limit_rad_s': 1.0, 'common_scale': scale,
            'limited_joint_velocity_rad_s': limited,
            'achieved_velocity_m_s': matvec(jac2(q_near), limited)}


def model2(q, dq):
    a, b = q
    c = math.cos(b)
    h = 0.5 * math.sin(b)
    inertia = [[5 / 3 + c, 1 / 3 + 0.5 * c],
               [1 / 3 + 0.5 * c, 1 / 3]]
    bias = [-h * dq[1]**2 - 2 * h * dq[0] * dq[1], h * dq[0]**2]
    gravity = [14.715 * math.cos(a) + 4.905 * math.cos(a + b),
               4.905 * math.cos(a + b)]
    return inertia, bias, gravity


def energy2(q, dq):
    inertia, _, _ = model2(q, dq)
    kinetic = 0.5 * dot(dq, matvec(inertia, dq))
    potential = 14.715 * math.sin(q[0]) + 4.905 * math.sin(sum(q))
    return kinetic + potential


def chapter04():
    q, dq, ddq = [0.3, 0.4], [0.1, 0.2], [0.2, -0.1]
    inertia, bias, gravity = model2(q, dq)
    inertial = matvec(inertia, ddq)
    torque = [a + b + c for a, b, c in zip(inertial, bias, gravity)]
    power = dot(dq, torque)
    eps = 1e-6
    def along(t):
        return energy2([x + v * t + 0.5 * a * t * t for x, v, a in zip(q, dq, ddq)],
                       [v + a * t for v, a in zip(dq, ddq)])
    derivative = (along(eps) - along(-eps)) / (2 * eps)
    assert abs(power - derivative) < 1e-8
    h_dot = [[-math.sin(q[1]) * dq[1], -0.5 * math.sin(q[1]) * dq[1]],
             [-0.5 * math.sin(q[1]) * dq[1], 0]]
    assert abs(dot(dq, bias) - 0.5 * dot(dq, matvec(h_dot, dq))) < 1e-12
    force = [2.0, -1.0]
    ext = matvec(transpose(jac2(q)), force)
    external_power = dot(force, matvec(jac2(q), dq))
    assert abs(external_power - dot(ext, dq)) < 1e-12
    tau_relative, relative_velocity = [5.0, 2.0], [0.1, 0.2]
    tau_absolute = [tau_relative[0] - tau_relative[1], tau_relative[1]]
    absolute_velocity = [relative_velocity[0], sum(relative_velocity)]
    assert abs(dot(tau_relative, relative_velocity) - dot(tau_absolute, absolute_velocity)) < 1e-12
    locked_inertia, _, _ = model2([0, math.pi / 2], [0, 0])
    free_acceleration = solve2(locked_inertia, [1, 0])
    locked_acceleration = 1 / locked_inertia[0][0]
    holding_torque = locked_inertia[1][0] * locked_acceleration
    effective_inertia = (locked_inertia[0][0]
                         - locked_inertia[0][1]**2 / locked_inertia[1][1])
    assert abs(locked_acceleration - 0.6) < 1e-12
    assert abs(holding_torque - 0.2) < 1e-12
    assert max(abs(x - y) for x, y in zip(free_acceleration, [0.75, -0.75])) < 1e-12
    return {'q_rad': q, 'dq_rad_s': dq, 'ddq_rad_s2': ddq,
            'locked_elbow_q1_acceleration_rad_s2': locked_acceleration,
            'elbow_holding_net_torque_Nm': holding_torque,
            'free_elbow_accelerations_rad_s2': free_acceleration,
            'effective_inertia_with_free_elbow_kg_m2': effective_inertia,
            'inertia_kg_m2': inertia, 'inertial_torque_Nm': inertial,
            'velocity_torque_Nm': bias, 'gravity_torque_Nm': gravity,
            'actuator_torque_without_external_Nm': torque,
            'actuator_power_W': power, 'energy_derivative_finite_difference_W': derivative,
            'external_force_N': force, 'mapped_external_torque_Nm': ext,
            'actuator_torque_with_external_Nm': [t - f for t, f in zip(torque, ext)],
            'external_power_W': external_power,
            'relative_coordinate_power_W': dot(tau_relative, relative_velocity),
            'absolute_coordinate_power_W': dot(tau_absolute, absolute_velocity)}


def chapter05():
    k = [2.0, math.sqrt(5.0)]
    s = [[2 * math.sqrt(5.0), 2], [2, math.sqrt(5.0)]]
    a, b, q = [[0, 1], [0, 0]], [[0], [1]], [[4, 0], [0, 1]]
    sb = matmul(s, b)
    ats, sa, control = matmul(transpose(a), s), matmul(s, a), matmul(sb, transpose(sb))
    residual = [[ats[i][j] + sa[i][j] - control[i][j] + q[i][j]
                 for j in range(2)] for i in range(2)]
    assert max(abs(x) for row in residual for x in row) < 1e-12
    c = 1 / math.sqrt(5)
    def lyapunov_derivative(x, u):
        return 2 * dot(matvec(s, x), [x[1], u])
    initial = [0.2, 0]
    v_initial = dot(initial, matvec(s, initial))
    large = [0, 4]
    u_large = -dot(k, large)
    u_limited = max(-1.0, min(1.0, u_large))
    assert v_initial < c
    assert lyapunov_derivative(large, u_limited) > 0
    dt, total = 0.002, 8.0
    state = initial[:]
    maximum_input, maximum_v_increase = 0.0, 0.0
    def flow(x):
        u = max(-1.0, min(1.0, -dot(k, x)))
        return [x[1], u]
    previous_v = v_initial
    for _ in range(round(total / dt)):
        f1 = flow(state)
        f2 = flow([x + dt * f / 2 for x, f in zip(state, f1)])
        f3 = flow([x + dt * f / 2 for x, f in zip(state, f2)])
        f4 = flow([x + dt * f for x, f in zip(state, f3)])
        state = [x + dt * (f + 2 * g + 2 * h + j) / 6
                 for x, f, g, h, j in zip(state, f1, f2, f3, f4)]
        maximum_input = max(maximum_input, abs(dot(k, state)))
        v_now = dot(state, matvec(s, state))
        maximum_v_increase = max(maximum_v_increase, v_now - previous_v)
        previous_v = v_now
    assert maximum_input <= 1 and maximum_v_increase < 1e-12
    return {'controllability_matrix': [[0, 1], [1, 0]],
            'normalized_pendulum_feedback_linearization': {
                'angle_rad': math.pi / 2, 'desired_acceleration': 1.0,
                'required_input': math.sin(math.pi / 2) + 1.0,
                'limited_input': 1.0,
                'actual_acceleration': 1.0 - math.sin(math.pi / 2)},
            'controllability_determinant': -1,
            'Q': q, 'R': 1, 'LQR_gain': k, 'S': s,
            'ARE_max_residual': max(abs(x) for row in residual for x in row),
            'force_limit_N': 1.0, 'certified_level_c': c,
            'zero_velocity_certified_position_error_m': 1 / math.sqrt(10),
            'initial_error_state': initial, 'initial_V': v_initial,
            'initial_control_N': -dot(k, initial),
            'RK4_step_s': dt, 'simulation_duration_s': total,
            'simulated_final_error_state': state,
            'largest_sampled_V_increase': maximum_v_increase,
            'saturation_counterexample': {'state': large, 'commanded_u_N': u_large,
                                         'applied_u_N': u_limited,
                                         'nominal_Vdot': lyapunov_derivative(large, u_large),
                                         'saturated_Vdot': lyapunov_derivative(large, u_limited)}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chapter', choices=['02', '03', '04', '05'])
    args = parser.parse_args()
    cases = {'02': chapter02, '03': chapter03, '04': chapter04, '05': chapter05}
    result = {key: fn() for key, fn in cases.items() if not args.chapter or key == args.chapter}
    print(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False))
