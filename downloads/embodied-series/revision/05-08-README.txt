05--08 numerical examples

Dependencies: Python 3.12, numpy, matplotlib.
Install: python -m pip install numpy matplotlib

From a directory containing the downloaded scripts:
python 05-control-examples.py --output-dir figures --results-dir checks
python 06-planning-examples.py --output-dir figures --results-dir checks
python 07-contact-examples.py --output-dir figures --results-dir checks
python 08-estimation-examples.py --output-dir figures --results-dir checks

Each script generates one PNG figure and one JSON record. Assertions check
the initial/final states, force/input bounds, covariance or projection
identities relevant to that example. The script comments identify original
source equations and distinguish chosen demonstration parameters.

Code: original implementation, MIT (see 05-08-MIT-LICENSE.txt).
Generated figures: CC BY-NC-SA 4.0, attribution: 具身智能导论作者.
Teaching sources retain their original CC BY-NC-SA 4.0 or CC BY 4.0 rights.

Verified 2026-10-08 with Python 3.12.14, numpy 2.5.3, matplotlib 3.11.2.
Chinese plotting labels use an installed Microsoft YaHei, Noto Sans CJK SC
or SimHei font. If none is installed, install a CJK font before plotting.
