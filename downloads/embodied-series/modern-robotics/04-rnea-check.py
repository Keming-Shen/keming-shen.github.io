# SPDX-License-Identifier: MIT
"""Check recursive Newton-Euler against the article's planar 2R equations.
Requires numpy and the adjacent 02-mr-core.py (MIT licensed).
The planar mass model matches article 04 Sec.3.4; test states are editorial.
All six-vectors use Modern Robotics ordering [omega; v] / [moment; force].
Usage: python 04-rnea-check.py --output 04-rnea-results.json
"""
import argparse, hashlib, importlib.util, json
from pathlib import Path
import numpy as np

COMMIT='cbd41fdf0bf75dbd5e986d832ae14226964ff0ac'

def translation(x):
    T=np.eye(4); T[0,3]=x; return T

def analytical(q,dq):
    q1,q2=q; d1,d2=dq; g=9.81; c2=np.cos(q2); h=.5*np.sin(q2)
    H=np.array([[5/3+c2,1/3+.5*c2],[1/3+.5*c2,1/3]])
    c=np.array([-h*d2*d2-2*h*d1*d2,h*d1*d1])
    G=np.array([1.5*g*np.cos(q1)+.5*g*np.cos(q1+q2),.5*g*np.cos(q1+q2)])
    return H,c,G

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--core',type=Path,default=Path(__file__).with_name('02-mr-core.py'))
    p.add_argument('--output',type=Path,default=Path(__file__).with_name('04-rnea-results.json'))
    a=p.parse_args(); spec=importlib.util.spec_from_file_location('mr_fixed',a.core)
    mr=importlib.util.module_from_spec(spec); spec.loader.exec_module(mr)
    # COM frames at x=0.5 and x=1.5 in the zero pose; tip at x=2.
    Mlist=np.array([translation(.5),translation(1.),translation(.5)])
    G=np.diag([1/12,1/12,1/12,1.,1.,1.]); Glist=np.array([G,G])
    Slist=np.array([[0,0,1,0,0,0],[0,0,1,0,-1,0.]]).T
    gravity=np.array([0,-9.81,0.]); Ftip=np.zeros(6)
    states=[(np.array([.3,.4]),np.array([.1,.2]),np.array([.2,-.1])),
            (np.array([0,np.pi/2]),np.zeros(2),np.array([0.,1.]))]
    outputs=[]
    for q,dq,ddq in states:
        H,c,Gg=analytical(q,dq)
        tau=mr.InverseDynamics(q,dq,ddq,gravity,Ftip,Mlist,Glist,Slist)
        recovered=mr.ForwardDynamics(q,dq,tau,gravity,Ftip,Mlist,Glist,Slist)
        Mr=mr.MassMatrix(q,Mlist,Glist,Slist)
        mass_error=float(np.max(np.abs(Mr-H)))
        torque_error=float(np.max(np.abs(tau-(H@ddq+c+Gg))))
        recovery_error=float(np.max(np.abs(recovered-ddq)))
        assert max(mass_error,torque_error,recovery_error)<1e-12
        assert np.all(np.linalg.eigvalsh(Mr)>0)
        outputs.append({'q':q.tolist(),'dq':dq.tolist(),'ddq':ddq.tolist(),'tau':tau.tolist(),
             'H':H.tolist(),'velocity_term':c.tolist(),'gravity_term':Gg.tolist(),
             'recovered_ddq':recovered.tolist(),'mass_error':mass_error,
             'analytical_torque_error':torque_error,'inverse_forward_error':recovery_error})
    result={'commit':COMMIT,'core_sha256':hashlib.sha256(a.core.read_bytes()).hexdigest(),
      'source_functions':['InverseDynamics','MassMatrix','ForwardDynamics'],
      'parameters':{'Mlist':Mlist.tolist(),'Glist':Glist.tolist(),'Slist':Slist.tolist(),
             'gravity':gravity.tolist(),'Ftip':Ftip.tolist()},'states':outputs,'checks_passed':True}
    a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'states':outputs,'checks_passed':True}))

if __name__=='__main__':main()
