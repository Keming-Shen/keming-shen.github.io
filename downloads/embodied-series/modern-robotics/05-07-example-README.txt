Modern Robotics examples for articles 05--07

Download the examples together with the modern_robotics package directory.
The package is the unmodified upstream Python library at commit
cbd41fdf0bf75dbd5e986d832ae14226964ff0ac.

Dependencies: Python 3.12, numpy, matplotlib.
python -m pip install numpy matplotlib

From the directory containing the scripts and modern_robotics:
python 05-mr-computed-torque.py --assets-dir figures --results-dir checks
python 06-mr-time-scaling.py --assets-dir figures --results-dir checks
python 07-mr-planar-grasp.py --assets-dir figures --results-dir checks

Each command writes a PNG and a JSON result record. Numerical assertions
check the mathematical identities described in the corresponding article.

Examples: original scripts under the MIT License, see 05-07-example-LICENSE.txt.
Upstream library: Copyright (c) 2019 NxRLab, MIT, see modern_robotics/LICENSE.
Figures: original computed figures, 具身智能导论作者, CC BY-NC-SA 4.0.
The textbook PDF is a private reference and is not included in these downloads.

Verified: Python 3.12.14, numpy 2.5.3, matplotlib 3.11.2, 2026-10-08.
Plot labels need an installed CJK font (Microsoft YaHei, Noto Sans CJK SC,
or SimHei).
