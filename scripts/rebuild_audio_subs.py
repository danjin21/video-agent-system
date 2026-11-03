# -*- coding: utf-8 -*-
"""모듈1: 나레이션 트랙 + BGM 베드(덕킹) + 자막 PNG/SRT 재생성.
usage: rebuild_audio_subs.py <project_root>
읽는 것: 03-conti-timeline.json, slide-*/04-audio/beat-*.wav|.words.json, project.json(bgm/subtitles/pronunciation), final/subs/manual_map.json(선택)
쓰는 것: audio/narration_timeline.wav, audio/bgm_bed.wav, final/subs/cue*.png, final/subs/cues.json, final/subtitles.srt"""
import json,subprocess,os,sys,glob,re
from PIL import Image, ImageDraw, ImageFont
P=sys.argv[1]; os.chdir(P)
cfg=json.load(open('project.json')) if os.path.exists('project.json') else {}
t=json.load(open('03-conti-timeline.json')); fps=t.get('fps',30)
total_f=max(s['end_frame'] for s in t['slides']); dur=total_f/fps
os.makedirs('audio',exist_ok=True); os.makedirs('final/subs',exist_ok=True)
beats=[(s['id'],b) for s in t['slides'] for b in s.get('beats',[]) if b.get('wav_s')]
# 1) narration timeline
inputs=[];filters=[]
for i,(sl,b) in enumerate(beats):
    bt=b['id'].split('-')[1]; ms=int(round(b['global'][0]/fps*1000))
    inputs+=['-i',f'slide-{sl}/04-audio/beat-{bt}.wav']; filters.append(f'[{i}:a]aresample=48000,aformat=channel_layouts=mono,adelay={ms}|{ms}[a{i}]')
mix=''.join(f'[a{i}]' for i in range(len(beats)))+f'amix=inputs={len(beats)}:normalize=0:dropout_transition=0,apad=whole_dur={dur:.3f},atrim=0:{dur:.3f}[nar]'
subprocess.run(['ffmpeg','-v','error','-y']+inputs+['-filter_complex',';'.join(filters+[mix]),'-map','[nar]','-ar','48000','-ac','2','audio/narration_timeline.wav'],check=True)
print(f'narration: {len(beats)} beats, {dur:.3f}s')
# 2) BGM bed
bgm=cfg.get('bgm',{})
if bgm.get('path') and os.path.exists(os.path.expanduser(bgm['path'])):
    B=os.path.expanduser(bgm['path']); vol=bgm.get('volume',0.24); fo=bgm.get('fade_out_s',3.8); d=bgm.get('duck',{})
    th,ra,at,re_=d.get('threshold',0.015),d.get('ratio',8),d.get('attack_ms',30),d.get('release_ms',1200)
    subprocess.run(['ffmpeg','-v','error','-y','-i',B,'-i',B,'-i','audio/narration_timeline.wav','-filter_complex',
     f'[0:a][1:a]acrossfade=d=4:c1=tri:c2=tri[loop];[loop]atrim=0:{dur:.3f},afade=t=in:d=1.5,afade=t=out:st={dur-fo:.3f}:d={fo},volume={vol}[bed];[2:a]aformat=channel_layouts=stereo[sc];[bed][sc]sidechaincompress=threshold={th}:ratio={ra}:attack={at}:release={re_}:makeup=1[bgm]',
     '-map','[bgm]','-ar','48000','-ac','2','audio/bgm_bed.wav'],check=True); print('bgm bed ok:',os.path.basename(B))
else:
    if os.path.exists('audio/bgm_bed.wav'): os.remove('audio/bgm_bed.wav')
    print('bgm: none (project.json bgm.path 없음)')
# 3) subtitles
sub=cfg.get('subtitles',{'enabled':True})
if not sub.get('enabled',True): sys.exit(0)
MAP=json.load(open('final/subs/manual_map.json')) if os.path.exists('final/subs/manual_map.json') else {}
MAX=sub.get('max_chars',44); WRAP=sub.get('wrap_chars',36)
def auto_split(text):
    sents=[x.strip() for x in re.split(r'(?<=[.!?])\s+',text) if x.strip()]; out=[]
    for se in sents:
        if len(se)<=MAX: out.append(se); continue
        commas=[m.end() for m in re.finditer(r', ',se)]; mid=len(se)/2
        cut=min(commas,key=lambda c:abs(c-mid)) if commas else None
        out+= [se[:cut].strip(),se[cut:].strip()] if cut else [se]
    return ' || '.join(out)
def wrap(c):
    if len(c)<=WRAP: return [c]
    cands=[m.end() for m in re.finditer(r', ',c)] or [m.end() for m in re.finditer(r'\s',c)]
    cut=min(cands,key=lambda p:abs(p-len(c)/2)); return [c[:cut].strip(),c[cut:].strip()]
cues=[]
for sl,b in beats:
    bt=b['id'].split('-')[1]; g0=b['global'][0]/fps
    w=json.load(open(f'slide-{sl}/04-audio/beat-{bt}.words.json')); words=w['words']; d=w['duration_s']; text=w['text']
    spec=MAP.get(b['id']) or auto_split(text)
    parts=[p.strip() for p in spec.split('||')]
    if ''.join(''.join(p.replace(' / ',' ').split()) for p in parts)!=''.join(text.split()):
        print('WARN manual_map 불일치 → 자동 분할:',b['id']); parts=[p.strip() for p in auto_split(text).split('||')]
    total=len(text.replace(' ','')); pos=0; se=words[-1]['e'] if words else d
    for i,p in enumerate(parts):
        n=len(p.replace(' / ',' ').replace(' ','')); f0=pos/total; f1=(pos+n)/total; pos+=n
        st=min((abs(x['s']-f0*se),x['s']) for x in words)[1] if words else f0*se; en=min((abs(x['e']-f1*se),x['e']) for x in words)[1] if words else f1*se
        if i==0: st=0.0
        if i==len(parts)-1: en=min(d,se+0.25)
        en=max(en,st+0.6); lines=[l.strip() for l in p.split(' / ')] if ' / ' in p else wrap(p)
        cues.append([g0+st,g0+en,lines])
for i in range(1,len(cues)):
    if cues[i][0]<cues[i-1][1]: cues[i-1][1]=cues[i][0]-0.05
for f in glob.glob('final/subs/cue*.png'): os.remove(f)
st_=sub.get('style',{}); fontp=os.path.expanduser(st_.get('font','~/Library/Fonts/Pretendard-Medium.otf')); size=st_.get('size',46)
stroke=st_.get('stroke',1); mb=st_.get('margin_bottom',48); lh=st_.get('line_height',60); shadow=st_.get('shadow',[1,2,120])
font=ImageFont.truetype(fontp,size); W,H=1920,1080
for i,(s0,e0,lines) in enumerate(cues):
    img=Image.new('RGBA',(W,H),(0,0,0,0)); dr=ImageDraw.Draw(img); y=H-mb-lh*len(lines)
    for ln in lines:
        bb=dr.textbbox((0,0),ln,font=font,stroke_width=stroke); x=(W-(bb[2]-bb[0]))//2
        if shadow: dr.text((x+shadow[0],y+shadow[1]),ln,font=font,fill=(0,0,0,shadow[2]),stroke_width=stroke,stroke_fill=(0,0,0,shadow[2]))
        dr.text((x,y),ln,font=font,fill=(255,255,255,255),stroke_width=stroke,stroke_fill=(0,0,0,255)); y+=lh
    img.save(f'final/subs/cue{i:02d}.png')
json.dump([{'start':round(s0,3),'end':round(e0,3),'lines':l} for s0,e0,l in cues],open('final/subs/cues.json','w'),ensure_ascii=False,indent=1)
f=lambda x: f'{int(x//3600):02d}:{int(x%3600//60):02d}:{int(x%60):02d},{int((x%1)*1000):03d}'
open('final/subtitles.srt','w',encoding='utf8').write('\n'.join(f'{i+1}\n{f(s0)} --> {f(e0)}\n'+chr(10).join(l)+'\n' for i,(s0,e0,l) in enumerate(cues)))
print(f'subtitles: {len(cues)} cues')
