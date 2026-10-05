"""Run the frozen official MotionLCM V2 one-step T2M components locally.

Environment adapter only: omit training/evaluation framework, retain official
VAE, denoiser, scheduler, text encoder and joint-recovery implementations.
Never publish SMPL model parameters.
"""
# Official components: Copyright Tsinghua University and Shanghai AI Laboratory.
# See the retained MotionLCM-LICENSE.txt and SMPL source notices.
from pathlib import Path
import argparse
import hashlib
import json
import os
import pickle
import random
import sys
import time

COMMIT='81c06368c17b056713deef2e9f6483f3172eea42'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo',type=Path,default=Path('MotionLCM'))
parser.add_argument('--output',type=Path,default=Path('run'))
parser.add_argument('--packages',action='append',default=[],help='Optional local dependency target; repeat if needed')
parser.add_argument('--probe',action='store_true')
parser.add_argument('--frames',type=int,default=100)
parser.add_argument('--seed',type=int,default=1234)
args=parser.parse_args()
REPO=args.repo.resolve()
CACHE=args.output.resolve()
record={'motionlcm_commit':COMMIT}
for folder in reversed(args.packages):sys.path.insert(0,str(Path(folder).resolve()))
sys.path.insert(0,str(REPO))
os.environ['HF_HUB_OFFLINE']='1'
os.environ['TRANSFORMERS_OFFLINE']='1'
os.environ['HF_HOME']=str(CACHE/'hf-cache')
os.environ['TRANSFORMERS_CACHE']=str(CACHE/'hf-cache/transformers')

import numpy as np
import torch
from omegaconf import OmegaConf

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def run():
    checkpoint=REPO/'experiments_t2m/motionlcm_humanml/motionlcm_humanml.ckpt'
    ckpt=torch.load(checkpoint,map_location='cpu',weights_only=False)
    state=ckpt.get('state_dict',ckpt)
    print('checkpoint:',checkpoint, 'keys:',len(state), flush=True)
    print('key prefixes:',sorted({k.split('.')[0] for k in state}),flush=True)
    cond_dim=state['denoiser.time_embedding.cond_proj.weight'].shape[1]
    print('guidance condition dimension:',cond_dim,flush=True)
    if args.probe:
        print('torch:',torch.__version__,'cuda:',torch.cuda.is_available(),flush=True)
        print('GPU:',torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,flush=True)
        return
    from mld.models.architectures.mld_vae import MldVae
    from mld.models.architectures.mld_denoiser import MldDenoiser
    from mld.models.architectures.mld_clip import MldTextEncoder
    from mld.models.schedulers.scheduling_lcm import LCMScheduler
    from mld.utils.utils import get_guidance_scale_embedding
    from mld.data.humanml.scripts.motion_process import recover_from_ric
    device=torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    random.seed(args.seed);np.random.seed(args.seed);torch.manual_seed(args.seed)
    if device.type=='cuda':torch.cuda.manual_seed_all(args.seed)
    init_start=time.perf_counter()
    vae=MldVae(nfeats=263,latent_dim=[16,32],hidden_dim=256,force_pre_post_proj=True,
               ff_size=1024,num_layers=9,num_heads=4,dropout=.1,arch='encoder_decoder',
               normalize_before=False,norm_eps=1e-5,activation='gelu',norm_post=True,
               activation_post=None,position_embedding='learned')
    denoiser=MldDenoiser(latent_dim=[16,32],hidden_dim=256,text_dim=768,time_dim=768,
                        ff_size=1024,num_layers=9,num_heads=4,dropout=.1,
                        normalize_before=False,norm_eps=1e-5,activation='gelu',norm_post=True,
                        activation_post=None,flip_sin_to_cos=True,freq_shift=0,
                        time_act_fn='silu',time_post_act_fn=None,position_embedding='learned',
                        arch='trans_enc',add_mem_pos=True,force_pre_post_proj=True,
                        text_act_fn=None,time_cond_proj_dim=cond_dim,zero_init_cond=True,
                        controlnet_embed_dim=256,controlnet_act_fn='silu')
    for name,model in [('vae',vae),('denoiser',denoiser)]:
        substate={k[len(name)+1:]:v for k,v in state.items() if k.startswith(name+'.')}
        model.load_state_dict(substate,strict=True)
        model.to(device).eval().requires_grad_(False)
        print(name,'strict checkpoint load OK',flush=True)
    text_encoder=MldTextEncoder(modelpath=str(REPO/'deps/sentence-t5-large')).to(device).eval().requires_grad_(False)
    scheduler_config=OmegaConf.to_container(OmegaConf.load(REPO/'configs/modules/scheduler_lcm.yaml'),resolve=True)['scheduler']
    scheduler=LCMScheduler(**scheduler_config['params'])
    meanfiles=list((REPO/'datasets').rglob('Mean.npy'))
    stdfiles=list((REPO/'datasets').rglob('Std.npy'))
    if not meanfiles or not stdfiles:raise RuntimeError('Official HumanML3D Mean.npy/Std.npy absent')
    meanfile=meanfiles[0];stdfile=stdfiles[0]
    # Official data module converts the stored float64 statistics with .float().
    mean=np.load(meanfile).astype('float32');std=np.load(stdfile).astype('float32')
    assert mean.shape==std.shape==(263,)
    prompts=['a person walks forward and turns left.','a person raises their right arm above their head.']
    frames=args.frames
    if not 40<=frames<=200:raise ValueError('Use official supported 40–200 frames')
    init_seconds=time.perf_counter()-init_start
    if device.type=='cuda':torch.cuda.synchronize()
    start=time.perf_counter()
    with torch.inference_mode():
        text_embedding=text_encoder(prompts)
        latents=torch.randn((len(prompts),16,32),device=device)
        noise=latents.detach().cpu().numpy()
        latents=latents*scheduler.init_noise_sigma
        scheduler.set_timesteps(1)
        guidance_scale=float(scheduler_config['cfg_step_map'][1])
        cond=get_guidance_scale_embedding(torch.tensor(guidance_scale-1).repeat(len(prompts)),embedding_dim=cond_dim).to(device=device,dtype=latents.dtype)
        for t in scheduler.timesteps.to(device):
            model_input=scheduler.scale_model_input(latents,t)
            prediction=denoiser(sample=model_input,timestep=t,encoder_hidden_states=text_embedding,
                               timestep_cond=cond,controlnet_residuals=None)[0]
            latents=scheduler.step(prediction,t,latents).prev_sample
        mask=torch.ones((len(prompts),frames),device=device,dtype=torch.bool)
        features=vae.decode(latents,mask)
        denormalized=features.cpu()*torch.from_numpy(std)+torch.from_numpy(mean)
        joints=recover_from_ric(denormalized,22).numpy().astype('float32')
    if device.type=='cuda':torch.cuda.synchronize()
    seconds=time.perf_counter()-start
    assert np.isfinite(joints).all()
    output=CACHE/'inference';output.mkdir(parents=True,exist_ok=True)
    np.savez_compressed(output/'motionlcm-v2-raw.npz',normalized_features=features.cpu().numpy(),
                        features=denormalized.numpy(),joints=joints,initial_noise=noise,
                        latents=latents.cpu().numpy(),text_embedding=text_embedding.cpu().numpy())
    for i,prompt in enumerate(prompts):
        data={'joints':joints[i],'text':prompt,'length':frames,'hint':None,'fps':20.0,'seed':args.seed}
        with (output/f'sample-{i:02d}.pkl').open('wb') as f:pickle.dump(data,f)
        np.save(output/f'sample-{i:02d}-joints.npy',joints[i])
    metadata={'status':'success','model':'MotionLCM V2 HumanML3D one-step T2M',
              'official_repo':'https://github.com/Dai-Wenxun/MotionLCM',
              'official_commit':record['motionlcm_commit'],'checkpoint':'MotionLCM/'+checkpoint.relative_to(REPO).as_posix(),
              'checkpoint_sha256':digest(checkpoint),'prompts':prompts,'seed':args.seed,
              'frames_per_sample':frames,'fps':20.0,'duration_seconds':frames/20.,'batch_size':len(prompts),
              'inference_steps':1,'timesteps':scheduler.timesteps.tolist(),'guidance_scale':guidance_scale,
              'coordinate_convention':'HumanML3D recover_from_ric: Y-up, root world motion integrated; meters',
              'joint_shape':list(joints.shape),'feature_shape':list(features.shape),'finite':True,
              'hardware':torch.cuda.get_device_name(0) if device.type=='cuda' else 'CPU',
              'torch_version':torch.__version__,'cuda_version':torch.version.cuda,
              'initialization_seconds':init_seconds,'inference_seconds_total_batch':seconds,
              'normalization':{'mean':'MotionLCM/'+meanfile.relative_to(REPO).as_posix(),'mean_sha256':digest(meanfile),'std':'MotionLCM/'+stdfile.relative_to(REPO).as_posix(),'std_sha256':digest(stdfile)},
              'adaptations':['Only training/evaluation framework omitted; official architectures and strict weights retained',
                             'No SMPL mesh fitting in this inference step; raw generated 22-joint motion saved',
                             'Offline sentence-t5-large text encoder from official dependency source'],
              'source_files':{p.relative_to(REPO).as_posix():digest(p) for p in [
                  REPO/'mld/models/architectures/mld_vae.py',REPO/'mld/models/architectures/mld_denoiser.py',
                  REPO/'mld/models/architectures/mld_clip.py',REPO/'mld/models/schedulers/scheduling_lcm.py',
                  REPO/'mld/data/humanml/scripts/motion_process.py',REPO/'configs/modules/scheduler_lcm.yaml']}}
    (output/'run-metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(metadata,ensure_ascii=False,indent=2),flush=True)

if __name__=='__main__':run()
