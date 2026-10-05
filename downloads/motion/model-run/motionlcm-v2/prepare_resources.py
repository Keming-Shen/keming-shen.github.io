"""Obtain the fixed official resources locally; weights are not redistributed.

MotionLCM: copyright Tsinghua University and Shanghai AI Laboratory.
Source: https://github.com/Dai-Wenxun/MotionLCM
Keep its LICENSE. Body-model resources are an explicitly selected stage and
remain local; read https://smpl.is.tue.mpg.de/modellicense.html before using them.
"""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import zipfile

COMMIT='81c06368c17b056713deef2e9f6483f3172eea42'
TEXT_REVISION='1b36eb48a1df42a07ffd02234d25abfbf3e3f3cb'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo',type=Path,default=Path('MotionLCM'))
parser.add_argument('--stage',choices=['code','inference','body'],required=True)
args=parser.parse_args()
repo=args.repo.resolve()
downloads=repo.parent/'.motionlcm-resource-downloads'
downloads.mkdir(parents=True,exist_ok=True)

def safe_extract(path,destination,strip_root=False):
    destination.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(path) as z:
        for item in z.infolist():
            pieces=Path(item.filename).parts
            relative=Path(*pieces[1:]) if strip_root else Path(item.filename)
            if not relative.parts:continue
            target=(destination/relative).resolve()
            if not target.is_relative_to(destination.resolve()):raise ValueError('Unsafe zip entry')
            if item.is_dir():target.mkdir(parents=True,exist_ok=True);continue
            target.parent.mkdir(parents=True,exist_ok=True)
            with z.open(item) as source,target.open('wb') as output:shutil.copyfileobj(source,output)

def drive(filename,identifier,destination):
    import gdown
    path=downloads/filename
    if not path.exists():
        result=gdown.download(id=identifier,output=str(path),quiet=False)
        if result is None:raise RuntimeError('Official Drive resource was not retrieved')
    safe_extract(path,destination)
    return {'resource':filename,'official_drive_id':identifier,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}

log={'motionlcm_commit':COMMIT,'text_encoder_revision':TEXT_REVISION,'stage':args.stage,'resources':[]}
if args.stage=='code':
    import requests
    path=downloads/f'MotionLCM-{COMMIT}.zip'
    if not path.exists():
        response=requests.get(f'https://codeload.github.com/Dai-Wenxun/MotionLCM/zip/{COMMIT}',timeout=(20,120))
        response.raise_for_status();path.write_bytes(response.content)
    if repo.exists() and any(repo.iterdir()):raise RuntimeError('Use an empty repo directory; do not overwrite an existing checkout')
    safe_extract(path,repo,strip_root=True)
    log['resources'].append({'resource':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
elif args.stage=='inference':
    if not (repo/'configs/motionlcm_t2m.yaml').is_file():raise RuntimeError('Run --stage code first or provide the fixed official checkout')
    log['resources'].append(drive('experiments_t2m.zip','1U7homKobR2gaDLfL5flS3N0g7e0a_AQd',repo))
    log['resources'].append(drive('humanml3d_tiny.zip','1Mg_3RnWmRt0tk_lyLRRiOZg1W-Fu4wLL',repo/'datasets'))
    from huggingface_hub import snapshot_download
    snapshot_download(repo_id='sentence-transformers/sentence-t5-large',revision=TEXT_REVISION,
                      local_dir=repo/'deps/sentence-t5-large',
                      allow_patterns=['*.json','*.model','pytorch_model.bin','model.safetensors','1_Pooling/*','2_Dense/*'])
else:
    if not (repo/'LICENSE').is_file():raise RuntimeError('Provide the fixed official checkout first')
    print('SMPL parameter models stay local. Model terms: https://smpl.is.tue.mpg.de/modellicense.html')
    log['resources'].append(drive('smpl_models.zip','1J2pTxrar_q689Du5r3jES343fZUmCs_y',repo/'deps'))
(downloads/f'{args.stage}-metadata.json').write_text(json.dumps(log,indent=2),encoding='utf8')
print(json.dumps(log,indent=2))
