"""Fit genuine MotionLCM joints with its official SMPLify3D implementation.

All body-model parameters stay under the private .cache directory. Public-use
mesh outputs can be prepared separately after the source license is checked.
"""
# Official components: Copyright Tsinghua University and Shanghai AI Laboratory.
# See the retained MotionLCM-LICENSE.txt and SMPL source notices.
from pathlib import Path
import argparse
import hashlib
import json
import os
import pickle
import sys
import time

COMMIT='81c06368c17b056713deef2e9f6483f3172eea42'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo',type=Path,default=Path('MotionLCM'))
parser.add_argument('--output',type=Path,default=Path('run'))
parser.add_argument('--input',type=Path,help='Generated motion pickle; default run/inference/sample-NN.pkl')
parser.add_argument('--packages',action='append',default=[],help='Optional local dependency target; repeat if needed')
parser.add_argument('--sample',type=int,default=0)
parser.add_argument('--iterations',type=int,default=50)
args=parser.parse_args()
REPO=args.repo.resolve()
CACHE=args.output.resolve()
record={'motionlcm_commit':COMMIT}
for folder in reversed(args.packages):sys.path.insert(0,str(Path(folder).resolve()))
sys.path.insert(0,str(REPO))
if args.input:args.input=args.input.resolve()
os.chdir(REPO)

import numpy as np
import torch
import h5py
import smplx
from mld.transforms.joints2rots import config
from mld.transforms.joints2rots.compat import legacy_numpy_aliases
from mld.transforms.joints2rots.smplify import SMPLify3D

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def main():
    path=args.input or CACHE/f'inference/sample-{args.sample:02d}.pkl'
    with path.open('rb') as f:data=pickle.load(f)
    joints=np.asarray(data['joints'],dtype=np.float32)
    frames=len(joints)
    device=torch.device('cuda')
    with legacy_numpy_aliases():
        model=smplx.create(config.SMPL_MODEL_DIR,model_type='smpl',gender='neutral',ext='pkl',batch_size=frames).to(device)
    with h5py.File(config.SMPL_MEAN_FILE,'r') as f:
        pose=torch.from_numpy(f['pose'][:]).unsqueeze(0).repeat(frames,1).float().to(device)
        shape=torch.from_numpy(f['shape'][:]).unsqueeze(0).repeat(frames,1).float().to(device)
    fitter=SMPLify3D(smplxmodel=model,batch_size=frames,joints_category='AMASS',num_iters=args.iterations,device=device)
    points=torch.from_numpy(joints).to(device)
    confidence=torch.ones(22,device=device)
    # Match the official fit.py weighting: its string default "False" is truthy.
    confidence[[7,8,10,11]]=1.5
    torch.cuda.synchronize();started=time.perf_counter()
    print('SMPLify3D fitting',frames,'frames, iterations',args.iterations,flush=True)
    _,_,optimized_pose,optimized_shape,camera,loss=fitter(pose.detach(),shape.detach(),torch.zeros((1,3),device=device),points,conf_3d=confidence)
    with torch.no_grad():
        output=model(betas=torch.zeros_like(optimized_shape),global_orient=optimized_pose[:,:3],
                     body_pose=optimized_pose[:,3:],transl=points[:,0],return_verts=True)
    torch.cuda.synchronize();seconds=time.perf_counter()-started
    vertices=output.vertices.detach().cpu().numpy().astype('float32')
    fitted_joints=output.joints[:,:22].detach().cpu().numpy().astype('float32')
    # SMPL's template pelvis is not at the coordinate origin. Official fit.py
    # uses transl=input_pelvis; remove only this rigid translation mismatch.
    pelvis_alignment=joints[:,0]-fitted_joints[:,0]
    vertices+=pelvis_alignment[:,None,:]
    fitted_joints+=pelvis_alignment[:,None,:]
    floor=float(vertices[...,1].min())
    vertices[...,1]-=floor;fitted_joints[...,1]-=floor
    shifted_input=joints.copy();shifted_input[...,1]-=floor
    faces=np.asarray(model.faces,dtype='uint32')
    errors=np.linalg.norm(fitted_joints-shifted_input,axis=-1)
    assert vertices.shape==(frames,6890,3) and faces.shape==(13776,3)
    assert np.isfinite(vertices).all()
    out=CACHE/'mesh';out.mkdir(exist_ok=True)
    prefix=out/f'sample-{args.sample:02d}'
    np.save(str(prefix)+'-vertices.npy',vertices)
    np.save(str(prefix)+'-joints.npy',shifted_input.astype('float32'))
    np.save(str(prefix)+'-fitted-joints.npy',fitted_joints)
    np.save(out/'faces.npy',faces)
    np.savez_compressed(str(prefix)+'-mesh.npz',vertices=vertices,faces=faces,joints=shifted_input,fitted_joints=fitted_joints)
    data['vertices']=vertices;data['joints']=shifted_input
    with Path(str(prefix)+'-mesh.pkl').open('wb') as f:pickle.dump(data,f)
    metadata={'status':'success','input_motion':f'inference/sample-{args.sample:02d}.pkl','prompt':data['text'],'seed':data['seed'],
              'frames':frames,'fps':20.0,'vertices_shape':list(vertices.shape),'faces_shape':list(faces.shape),
              'method':'Official MotionLCM SMPLify3D, L-BFGS, AMASS 22-joint correspondence; mean pose initialization; final neutral zero-shape mesh',
              'iterations':args.iterations,'official_fit_default_iterations':150,'fitting_seconds':seconds,
              'coordinate_adaptation':'Each frame receives a rigid translation aligning the actual SMPL pelvis with the generated input pelvis before the common floor shift',
              'coordinate_convention':'Y-up; meters; common sequence floor translated to Y=0',
              'floor_shift_meters':floor,'mpjpe_meters_mean':float(errors.mean()),'mpjpe_meters_max':float(errors.max()),
              'loss':float(loss.detach().cpu()),'gpu':torch.cuda.get_device_name(0),
              'source_commit':record['motionlcm_commit'],
              'model_parameters_private':True,'body_model_sha256':digest(REPO/'deps/smpl_models/smpl/SMPL_NEUTRAL.pkl'),
              'body_license_url':'https://smpl.is.tue.mpg.de/bodylicense.html',
              'body_model_license_url':'https://smpl.is.tue.mpg.de/modellicense.html',
              'source_files':{p.relative_to(REPO).as_posix():digest(p) for p in [REPO/'fit.py',REPO/'mld/transforms/joints2rots/smplify.py',REPO/'mld/transforms/joints2rots/customloss.py']},
              'notes':['Official public prepare/download_smpl_models.sh dependency archive has no separate license file; original model/SMPL-Body terms apply',
                       'Output vertices are the actual fitted SMPL mesh, never a synthetic stick-figure substitute',
                       'No pose or vertex deformation in coordinate adaptation; only pelvis alignment by per-frame rigid translation',
                       'Optimization iteration count explicitly recorded; this is mesh fitting of pretrained model generation, not retraining']}
    Path(str(prefix)+'-metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(metadata,ensure_ascii=False,indent=2),flush=True)

if __name__=='__main__':main()
