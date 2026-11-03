# -*- coding: utf-8 -*-
"""자막 굽기 (libass 불필요): final/subs/cue*.png + cues.json → final/master_*_sub.mp4
usage: burn_subs.py <project_root>"""
import json,subprocess,sys,os
P=sys.argv[1]; os.chdir(P)
cues=json.load(open('final/subs/cues.json')); n=len(cues); inputs=[]; fc=[]; prev='[0:v]'
for i,c in enumerate(cues):
    inputs+=['-i',f'final/subs/cue{i:02d}.png']; out=f'[v{i}]' if i<n-1 else '[vout]'
    fc.append(f"{prev}[{i+1}:v]overlay=0:0:enable='between(t,{c['start']:.3f},{c['end']:.3f})'{out}"); prev=f'[v{i}]'
for v in ['bgm','narration_only']:
    src=f'final/master_{v}.mp4'
    if not os.path.exists(src): continue
    r=subprocess.run(['ffmpeg','-v','error','-y','-i',src]+inputs+['-filter_complex',';'.join(fc),'-map','[vout]','-map','0:a','-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-c:a','copy',f'final/master_{v}_sub.mp4'],capture_output=True,text=True)
    print(v,'ok' if r.returncode==0 else r.stderr[-300:])
