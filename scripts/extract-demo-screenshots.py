"""Extract explicitly selected screenshots already captured by browser tools.
Only image blocks are copied. Session text, prompts and credentials are never exported.
"""
import argparse,base64,json,hashlib
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--session',required=True,type=Path)
p.add_argument('--timestamp',required=True,action='append',help='Exact event timestamp to extract; repeat for multiple captures')
p.add_argument('--output',required=True,type=Path)
a=p.parse_args()
root=Path(__file__).resolve().parents[1]/'artifacts'/'private'
out=a.output.resolve()
if not out.is_relative_to(root.resolve()):raise SystemExit('Output must be inside artifacts/private for visual review before publication')
out.mkdir(parents=True,exist_ok=True)
wanted=set(a.timestamp);found=set();manifest=[]
for line in a.session.open(encoding='utf-8'):
 try:r=json.loads(line)
 except json.JSONDecodeError:continue
 ts=r.get('timestamp')
 if r.get('type')!='event_msg' or ts not in wanted:continue
 for i,c in enumerate(r.get('payload',{}).get('item',{}).get('result',{}).get('content',[])):
  if not isinstance(c,dict) or c.get('type')!='image' or c.get('mimeType') not in ['image/png','image/jpeg']:continue
  data=base64.b64decode(c['data'],validate=True)
  extension='png' if data.startswith(b'\x89PNG\r\n\x1a\n') else 'jpg' if data.startswith(b'\xff\xd8\xff') else None
  if not extension:raise SystemExit('Unsupported image bytes')
  name=ts.replace(':','-')+f'-{i}.{extension}'
  target=out/name
  if target.exists() and target.read_bytes()!=data:raise SystemExit('Refusing to overwrite different content')
  target.write_bytes(data);found.add(ts)
  manifest.append({'file':name,'capturedAt':ts,'sha256':hashlib.sha256(data).hexdigest()})
if wanted-found:raise SystemExit('Missing selected timestamps: '+', '.join(sorted(wanted-found)))
(out/'capture-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'images':len(manifest),'output':str(out)}))
