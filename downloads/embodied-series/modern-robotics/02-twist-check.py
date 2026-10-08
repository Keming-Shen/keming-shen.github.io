# SPDX-License-Identifier: MIT
"""Check a screw displacement and the two six-vector orderings.
Requires numpy and the adjacent 02-mr-core.py (MIT licensed).
Usage: python 02-twist-check.py --output 02-twist-results.json
"""
import argparse, hashlib, importlib.util, json
from pathlib import Path
import numpy as np

COMMIT='cbd41fdf0bf75dbd5e986d832ae14226964ff0ac'

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--core',type=Path,default=Path(__file__).with_name('02-mr-core.py'))
    p.add_argument('--output',type=Path,default=Path(__file__).with_name('02-twist-results.json'))
    a=p.parse_args()
    spec=importlib.util.spec_from_file_location('mr_fixed',a.core)
    mr=importlib.util.module_from_spec(spec); spec.loader.exec_module(mr)
    # q, s, h are the official ScrewToAxis docstring example.
    # The travel angle and the additional permutation checks are editorial.
    q=np.array([3.,0.,0.]); s=np.array([0.,0.,1.]); h=2.
    S=mr.ScrewToAxis(q,s,h); theta=np.pi/2
    T=mr.MatrixExp6(mr.VecTose3(S*theta))
    expected=np.array([[0,-1,0,3],[1,0,0,-3],[0,0,1,np.pi],[0,0,0,1.]])
    exp_error=float(np.max(np.abs(T-expected)))
    assert np.allclose(S,[0,0,1,0,-3,2]) and exp_error<1e-12
    # A point on the axis translates along that axis by h*theta.
    moved_axis_point=T[:3,:3]@q+T[:3,3]
    assert np.allclose(moved_axis_point,q+h*theta*s)
    P=np.block([[np.zeros((3,3)),np.eye(3)],[np.eye(3),np.zeros((3,3))]])
    R,t=mr.TransToRp(T)
    adj_vfirst=np.block([[R,mr.VecToso3(t)@R],[np.zeros((3,3)),R]])
    permutation_error=float(np.max(np.abs(P@mr.Adjoint(T)@P-adj_vfirst)))
    assert permutation_error<1e-12
    result={'commit':COMMIT,'core_sha256':hashlib.sha256(a.core.read_bytes()).hexdigest(),
      'source_functions':['ScrewToAxis','VecTose3','MatrixExp6','Adjoint'],
      'parameters':{'q':q.tolist(),'s':s.tolist(),'pitch':h,'travel_angle_rad':theta},
      'S_omega_v':S.tolist(),'exponential_coordinates_rho_theta':(P@(S*theta)).tolist(),
      'T':T.tolist(),'moved_axis_point':moved_axis_point.tolist(),
      'max_exponential_error':exp_error,'max_adjoint_permutation_error':permutation_error,
      'checks_passed':True}
    a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'S':S.tolist(),'translation':t.tolist(),'checks_passed':True}))

if __name__=='__main__':main()
