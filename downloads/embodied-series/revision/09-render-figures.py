"""Render source-supported teaching plots and software diagrams for chapters 09–14.

Inputs: official LeRobot action numbers; ROS URDF inertia example; MuJoCo delay
description and an optional actually recorded CPU trace; Pinocchio CLIK source;
robomimic data/checkpoint/rollout interfaces; MimicKit engine configuration.
No policy training is run and no convergence or task-success data are invented.
Install matplotlib and numpy to regenerate. Source URLs are recorded in
integration/learning-review.json in the prepared publication bundle.
"""
import argparse
import csv
from html import escape
import os
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--assets',type=Path,default=Path(__file__).resolve().parents[1]/'assets')
parser.add_argument('--trace-csv',type=Path,default=Path(__file__).with_name('11-hinge-trace.csv'))
args=parser.parse_args()
args.assets.mkdir(parents=True,exist_ok=True)
os.environ.setdefault('MPLCONFIGDIR',str(args.assets.parent/'integration'/'mpl-cache'))
import numpy as np
import matplotlib
matplotlib.use('Agg')
from matplotlib import pyplot as plt, font_manager
font=Path('C:/Windows/Fonts/msyh.ttc')
if font.exists():
    font_manager.fontManager.addfont(str(font))
    plt.rcParams['font.family']=font_manager.FontProperties(fname=str(font)).get_name()
plt.rcParams.update({'axes.unicode_minus':False,'font.size':12,'axes.spines.top':False,
                     'axes.spines.right':False,'figure.facecolor':'white',
                     'axes.labelcolor':'#334155','text.color':'#0f172a'})
BLUE,TEAL,ORANGE,GRAY='#2563eb','#0f766e','#ea580c','#64748b'

absolute=np.array([46,47.5,49,50.0]);current=45.0
relative=absolute-current
delta=np.diff(np.r_[current,absolute])
fig,axes=plt.subplots(1,3,figsize=(12,3.5),constrained_layout=True)
for ax,values,title,color in zip(axes,[absolute,relative,delta],
                               ['绝对目标','相对当前状态','逐步差分'],[BLUE,TEAL,ORANGE]):
    ax.bar(np.arange(1,5),values,color=color,width=.58)
    ax.set_xticks(range(1,5));ax.set_xlabel('动作块中的步数')
    ax.set_title(title,pad=16,fontweight='bold')
    for n,val in enumerate(values,1):ax.annotate(f'{val:g}',(n,val),xytext=(0,5),textcoords='offset points',ha='center')
    ax.set_ylim(0,max(values)*1.22)
    ax.grid(axis='y',alpha=.12);ax.set_axisbelow(True)
axes[0].set_ylabel('关节位置值');axes[1].set_ylabel('位置偏移');axes[2].set_ylabel('位置增量')
fig.suptitle('同一目标序列，三种动作表示  ·  预测时当前值 = 45',fontsize=15,fontweight='bold')
fig.savefig(args.assets/'09-action-representations.png',dpi=180);plt.close(fig)

fig,ax=plt.subplots(figsize=(11,3.7),constrained_layout=True)
ax.set_xlim(.055,.345);ax.set_ylim(-.7,2.0)
ax.hlines(0,.08,.32,color='#cbd5e1',linewidth=2)
ax.scatter([.1,.2],[0,0],s=180,c=[BLUE,TEAL],zorder=3)
ax.scatter([.3],[0],s=180,c=[ORANGE],zorder=3)
for x,label in [(.1,'旧样本\n0.1 s'),(.2,'新样本\n0.2 s'),(.3,'当前时刻\n0.3 s')]:
    ax.text(x,-.12,label,ha='center',va='top',fontsize=12)
ax.annotate('',xy=(.1,1.02),xytext=(.3,1.02),arrowprops={'arrowstyle':'->','color':BLUE,'lw':2})
ax.text(.2,1.14,'delay = 0.2 s  →  请求 0.1 s 的值',ha='center',color=BLUE)
ax.text(.2,1.65,'dt = 0.1 s，nsample = 2',ha='center',fontsize=15,fontweight='bold')
ax.text(.15,.35,'缓冲中保存的时间戳',ha='center',color=GRAY)
ax.set_xticks([.1,.2,.3]);ax.set_xticklabels(['100','200','300']);ax.set_xlabel('时间（ms）')
ax.set_yticks([]);ax.spines['left'].set_visible(False);ax.spines['bottom'].set_visible(False)
fig.savefig(args.assets/'10-sensor-history.png',dpi=180);plt.close(fig)

if args.trace_csv.is_file():
    with args.trace_csv.open(encoding='utf-8') as file:
        rows=list(csv.DictReader(file))
    t=np.array([float(r['time_s']) for r in rows]);q=np.array([float(r['q_rad']) for r in rows]);v=np.array([float(r['v_rad_s']) for r in rows])
    fig,axes=plt.subplots(2,1,figsize=(10,4.7),sharex=True,constrained_layout=True)
    axes[0].plot(t,q,color=BLUE,lw=2);axes[0].set_ylabel('q（rad）')
    axes[1].plot(t,v,color=TEAL,lw=2);axes[1].set_ylabel('v（rad/s）');axes[1].set_xlabel('仿真时间（s）')
    for ax in axes:ax.grid(alpha=.15);ax.set_xlim(0,2)
    axes[0].set_title('hinge 模型的 CPU 仿真记录  ·  MuJoCo 3.3.7，dt = 0.002 s',fontsize=14,pad=12)
    fig.savefig(args.assets/'11-hinge-trace.png',dpi=180);plt.close(fig)

fig,ax=plt.subplots(figsize=(11,3.8),constrained_layout=True)
physics=np.arange(1,13)*1000/120
control=np.arange(0,4)*1000/30
ax.scatter(physics,np.ones_like(physics),color=TEAL,s=55,zorder=3)
ax.scatter(control,np.ones_like(control)*2,color=BLUE,s=105,zorder=3)
for a,b in zip(control[:-1],control[1:]):
    ax.plot([a,b],[1.45,1.45],color=ORANGE,lw=3)
    ax.text((a+b)/2,1.55,'命令保持 4 个物理步',ha='center',fontsize=11,color=ORANGE)
for x in control:
    ax.axvline(x,color='#cbd5e1',linestyle='--',lw=1)
    ax.text(x,2.2,f'{x:.1f}',ha='center',fontsize=10)
ax.set_yticks([1,2]);ax.set_yticklabels(['物理步终点 · 120 Hz','控制更新 · 30 Hz'])
ax.set_ylim(.55,2.55);ax.set_xlim(-3,103);ax.set_xticks([0,100/3,200/3,100]);ax.set_xticklabels(['0','33.3','66.7','100'])
ax.set_xlabel('推导的时间轴（ms）');ax.set_title('一个控制周期包含四个物理步',fontsize=15,fontweight='bold',pad=14)
ax.spines['left'].set_visible(False);ax.tick_params(axis='y',length=0)
fig.savefig(args.assets/'14-control-schedule.png',dpi=180);plt.close(fig)

def start_svg(width,height):
    return [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
            '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/></marker></defs>',
            f'<rect width="{width}" height="{height}" rx="16" fill="#f8fafc"/>',
            '<g font-family="Microsoft YaHei" fill="#0f172a">']
def label(out,x,y,lines,size=18,color='#0f172a',anchor='middle',weight='normal'):
    if isinstance(lines,str):lines=[lines]
    for i,line in enumerate(lines):
        out.append(f'<text x="{x}" y="{y+27*i}" text-anchor="{anchor}" font-size="{size}" font-weight="{weight}" fill="{color}">{escape(line)}</text>')
def box(out,x,y,w,h,lines,color=BLUE,size=18):
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="white" stroke="{color}" stroke-width="2"/>')
    label(out,x+w/2,y+31,lines,size=size)
def arrow(out,x1,y1,x2,y2):out.append(f'<path d="M{x1},{y1} L{x2},{y2}" stroke="{GRAY}" stroke-width="2" fill="none" marker-end="url(#arrow)"/>')
def finish(out,name):
    out.extend(['</g>','</svg>']);(args.assets/name).write_text('\n'.join(out)+'\n',encoding='utf-8')

out=start_svg(1120,390)
label(out,560,42,'模型、状态与派生量的更新顺序',24,weight='bold')
box(out,35,86,220,94,['MjModel','拓扑 · 惯量 · timestep'])
box(out,310,86,230,94,['MjData','qpos · qvel · time'])
box(out,600,86,215,94,['mj_forward','更新派生量，时间不变'],TEAL)
box(out,865,86,220,94,['update_scene → render','显示当前计算结果'],TEAL)
arrow(out,255,133,310,133);arrow(out,540,133,600,133);arrow(out,815,133,865,133)
box(out,310,245,230,88,['mj_step','动力学计算 + 积分'],ORANGE)
arrow(out,425,180,425,245);arrow(out,540,289,707,289);arrow(out,707,289,707,180)
label(out,700,347,'状态变化后重新前向计算',16,color=GRAY)
label(out,159,245,['静态模型：nq = nv = 0','hinge 模型：nq = nv = 1'],16,color=GRAY)
finish(out,'11-simulation-loop.svg')

out=start_svg(1120,580)
label(out,560,42,'CLIK 的局部误差与迭代更新',24,weight='bold')
box(out,35,90,265,105,['当前构型 q','forwardKinematics → oMi'])
box(out,425,90,270,105,['目标 oMdes','位置 [1, 0, 1] · 旋转 I'],TEAL)
box(out,820,90,265,105,['局部位姿误差','iMd = inverse(oMi) · oMdes','e = log(iMd)'],TEAL)
out.append(f'<path d="M 300 142 L 325 142 L 325 68 L 952 68 L 952 90" stroke="{GRAY}" stroke-width="2" fill="none" marker-end="url(#arrow)"/>')
arrow(out,695,142,820,142)
label(out,590,62,'当前位姿',15,color=GRAY)
box(out,820,265,265,105,['任务 Jacobian','Jtask = -Jlog6(iMd.inverse()) @ J'],ORANGE,size=16)
box(out,425,265,270,105,['阻尼线性系统','v = -J.T @ solve(J @ J.T + λI, e)'],ORANGE,size=16)
box(out,35,265,265,105,['构型积分','q ← integrate(q, 0.1v)'],BLUE)
arrow(out,952,195,952,265);arrow(out,820,317,695,317);arrow(out,425,317,300,317)
out.append(f'<path d="M 35 317 L 17 317 L 17 142 L 35 142" stroke="{GRAY}" stroke-width="2" fill="none" marker-end="url(#arrow)"/>')
label(out,560,438,['每次先检查：norm(e) < 1e-4','达到 1000 次迭代后停止；阻尼 λ = 1e-12'],19)
label(out,560,534,'计算依赖示意；图中没有未经运行的误差收敛曲线',16,color=GRAY)
finish(out,'12-clik-loop.svg')

out=start_svg(1120,530)
label(out,560,42,'示范数据、训练模型与闭环评测',24,weight='bold')
box(out,30,80,290,275,['HDF5','data / demo_*','actions · states','obs · next_obs','env_args 属性','mask / train, valid'])
box(out,400,85,290,100,['BC 训练','观测 → 示范动作'],BLUE)
box(out,790,85,300,100,['checkpoint','模型 + 配置 + 环境信息'],BLUE)
box(out,400,280,290,105,['示范验证','Validation / loss'],TEAL)
box(out,790,280,300,105,['策略 rollout','重建环境 → 真正执行动作'],ORANGE)
arrow(out,320,130,400,130);arrow(out,690,130,790,130)
arrow(out,320,310,400,310);arrow(out,940,185,940,280)
label(out,545,231,'验证集来自示范轨迹',16,color=GRAY)
label(out,940,431,['Return · Horizon','Success_Rate · Num_Success'],18)
arrow(out,940,385,940,409)
label(out,175,414,['Lift PH：200 条成功示范','10% 验证 → 180 / 20'],17,color=GRAY)
label(out,560,497,'数据结构和执行接口示意；没有虚构训练损失或成功率',16,color=GRAY)
finish(out,'13-imitation-workflow.svg')
print('rendered figures:',len(list(args.assets.glob('0[9]*.*')))+len(list(args.assets.glob('1[0-4]-*.*'))))
