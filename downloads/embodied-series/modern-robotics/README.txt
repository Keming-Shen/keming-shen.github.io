Modern Robotics 教学算例

运行环境：Python 3、NumPy。05–07 绘图还需要 Matplotlib。
示例：python -m pip install numpy matplotlib

将 modern-robotics-examples.zip 解压到独立目录，保留原来的文件结构。
每个算例可以单独执行；所有模型、参数、坐标约定见相应博客正文和脚本。

python 02-twist-check.py
python 03-poe-ik-check.py
python 04-rnea-check.py
python 05-mr-computed-torque.py
python 06-mr-time-scaling.py
python 07-mr-planar-grasp.py
python 12-mr-planar-check.py

02–04 的结果打印到终端；对应保存的 JSON 已包含在包中。
05–07 默认写出 assets/ 的数值图和 results/ 的检查结果。
12 为不依赖 Pinocchio 的平面 2R 几何验证；它不比较两个不同的机器人模型。
绘图字体优先使用系统中文字体。缺少中文字体时可先查看数值结果。

配套库来源：NxRLab/ModernRobotics
固定版本：cbd41fdf0bf75dbd5e986d832ae14226964ff0ac
官方 core.py 保持原样，库许可见 modern_robotics/LICENSE。
02-mr-core.py 为同一版本的单文件入口，许可见 02-mr-core-LICENSE.txt。
05–07 自编算例许可见 05-07-example-LICENSE.txt。
书的概念与公式出处见文章末尾参考资料；本包不包含教材 PDF。
