# SPDX-License-Identifier: MIT
"""Check space/body POE, Jacobians and numerical body IK.
Requires numpy and the adjacent 02-mr-core.py (MIT licensed).
Model values and the IK goal/initial guess are the official FKin/IKin examples.
Jacobian consistency and finite-difference checks are added editorial checks.
Usage: python 03-poe-ik-check.py --output 03-poe-ik-results.json
"""
import argparse, hashlib, importlib.util, json
from pathlib import Path
import numpy as np

COMMIT='cbd41fdf0bf75dbd5e986d832ae14226964ff0ac'

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--core',type=Path,default=Path(__file__).with_name('02-mr-core.py'))
    p.add_argument('--output',type=Path,default=Path(__file__).with_name('03-poe-ik-results.json'))
    a=p.parse_args(); spec=importlib.util.spec_from_file_location('mr_fixed',a.core)
    mr=importlib.util.module_from_spec(spec); spec.loader.exec_module(mr)
    M=np.array([[-1,0,0,0],[0,1,0,6],[0,0,-1,2],[0,0,0,1.]])
    Slist=np.array([[0,0,1,4,0,0],[0,0,0,0,1,0],[0,0,-1,-6,0,-.1]]).T
    Blist=np.array([[0,0,-1,2,0,0],[0,0,0,0,1,0],[0,0,1,0,0,.1]]).T
    q=np.array([np.pi/2,3.,np.pi])
    axis_error=float(np.max(np.abs(Blist-mr.Adjoint(mr.TransInv(M))@Slist)))
    Ts=mr.FKinSpace(M,Slist,q); Tb=mr.FKinBody(M,Blist,q)
    Js=mr.JacobianSpace(Slist,q); Jb=mr.JacobianBody(Blist,q)
    pose_error=float(np.max(np.abs(Ts-Tb)))
    jac_error=float(np.max(np.abs(Js-mr.Adjoint(Ts)@Jb)))
    assert max(axis_error,pose_error,jac_error)<1e-12
    step=1e-6; direction=np.array([.2,-.1,.3])
    Tdot=(mr.FKinSpace(M,Slist,q+step*direction)-mr.FKinSpace(M,Slist,q-step*direction))/(2*step)
    Vs_fd=mr.se3ToVec(Tdot@mr.TransInv(Ts))
    finite_difference_error=float(np.max(np.abs(Vs_fd-Js@direction)))
    assert finite_difference_error<1e-8
    goal=np.array([[0,1,0,-5],[1,0,0,4],[0,0,-1,1.6858],[0,0,0,1.]])
    q0=np.array([1.5,2.5,3.]); eomg=.01; ev=.001
    solution,success=mr.IKinBody(Blist,M,goal,q0,eomg,ev)
    reached=mr.FKinBody(M,Blist,solution)
    residual=mr.se3ToVec(mr.MatrixLog6(mr.TransInv(reached)@goal))
    angle_error=float(np.linalg.norm(residual[:3])); linear_error=float(np.linalg.norm(residual[3:]))
    assert success and angle_error<=eomg and linear_error<=ev
    result={'commit':COMMIT,'core_sha256':hashlib.sha256(a.core.read_bytes()).hexdigest(),
      'source_functions':['FKinSpace','FKinBody','JacobianSpace','JacobianBody','IKinBody'],
      'parameters':{'M':M.tolist(),'Slist':Slist.tolist(),'Blist':Blist.tolist(),'q':q.tolist()},
      'T_space':Ts.tolist(),'T_body':Tb.tolist(),'Js':Js.tolist(),'Jb':Jb.tolist(),
      'max_axis_conversion_error':axis_error,'max_space_body_pose_error':pose_error,
      'max_jacobian_adjoint_error':jac_error,'max_finite_difference_error':finite_difference_error,
      'ik':{'goal':goal.tolist(),'initial_guess':q0.tolist(),'eomg':eomg,'ev':ev,'solution':solution.tolist(),
            'success':bool(success),'reached_pose':reached.tolist(),'log_error':residual.tolist(),
            'angular_error_norm':angle_error,'linear_log_error_norm':linear_error},'checks_passed':True}
    a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'T':Ts.tolist(),'ik_solution':solution.tolist(),'angular_error':angle_error,'linear_log_error':linear_error,'checks_passed':True}))

if __name__=='__main__':main()
