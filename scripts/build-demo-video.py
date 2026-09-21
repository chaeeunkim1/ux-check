"""Encode a captioned demo from actual browser captures; never fabricate UI.
Requires imageio-ffmpeg installed in artifacts/private/media-tools.
"""
import argparse,json,subprocess,sys,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'artifacts/private/media-tools'))
import imageio_ffmpeg
p=argparse.ArgumentParser();p.add_argument('--scenes',required=True,type=Path);p.add_argument('--output',required=True,type=Path);a=p.parse_args()
scenes=json.loads(a.scenes.read_text(encoding='utf-8-sig'))
duration=sum(s['seconds'] for s in scenes)
if not 55<=duration<=60:raise SystemExit('Demo target must be 55–60 seconds')
build=ROOT/'artifacts/private/media-build';build.mkdir(parents=True,exist_ok=True)
font=Path(r'C:\Windows\Fonts\malgun.ttf')
if not font.exists():raise SystemExit('Korean font unavailable')
shutil.copyfile(font,build/'caption-font.ttf')
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();parts=[]
for index,scene in enumerate(scenes):
 source=(ROOT/scene['image']).resolve()
 if not source.is_relative_to((ROOT/'artifacts/private').resolve()) or not source.is_file():raise SystemExit('Use inspected private browser captures only')
 for field in ['title','caption']:(build/f'{index}-{field}.txt').write_text(scene[field],encoding='utf-8')
 filters=[]
 if 'crop' in scene:
  x,y,w,h=scene['crop'];filters.append(f'crop={w}:{h}:{x}:{y}')
 filters+=['scale=1760:810:force_original_aspect_ratio=decrease','pad=1920:1080:(ow-iw)/2:130:color=0xf2f5ef',f"drawtext=fontfile=caption-font.ttf:textfile={index}-title.txt:fontcolor=0x173d2a:fontsize=48:x=80:y=42",f"drawtext=fontfile=caption-font.ttf:textfile={index}-caption.txt:fontcolor=0x243b2f:fontsize=32:x=80:y=982",f"drawtext=fontfile=caption-font.ttf:text='{index+1:02} / {len(scenes):02}':fontcolor=0x536759:fontsize=24:x=1735:y=60",'setsar=1','format=yuv420p']
 target=build/f'scene-{index:02}.mp4'
 args=[ffmpeg,'-y','-hide_banner','-loglevel','error','-loop','1','-i',str(source),'-t',str(scene['seconds']),'-vf',','.join(filters),'-r','24','-c:v','libx264','-preset','fast','-crf','20','-movflags','+faststart',str(target)]
 subprocess.run(args,cwd=build,check=True);parts.append(target)
 print(f'Encoded scene {index+1}/{len(scenes)}',flush=True)
(build/'concat.txt').write_text('\n'.join(f"file '{p.name}'" for p in parts),encoding='utf-8')
output=a.output.resolve();output.parent.mkdir(parents=True,exist_ok=True)
subprocess.run([ffmpeg,'-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i','concat.txt','-c','copy','-movflags','+faststart',str(output)],cwd=build,check=True)
reader=imageio_ffmpeg.read_frames(str(output));metadata=next(reader);reader.close()
if not 55<=metadata['duration']<=60.1:raise SystemExit('Duration verification failed')
manifest={'source':'Actual browser screenshots of synthetic-data demo; edited sequence, analysis waiting omitted','audio':'none; Korean captions','durationSeconds':metadata['duration'],'size':metadata['size'],'bytes':output.stat().st_size,'scenes':scenes}
(output.with_suffix('.manifest.json')).write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'output':str(output),'durationSeconds':metadata['duration'],'size':metadata['size'],'bytes':output.stat().st_size}))
