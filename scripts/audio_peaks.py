# -*- coding: utf-8 -*-
"""타이밍 편집기 데이터: 비트별 파형 피크 + 단어 onset + 콘티 트리거 → final/timing/timing_editor.html
usage: audio_peaks.py <project_root>
트리거 소스: slide-NN/03-storyboard-conti/conti.yaml 의 (가능하면) 'triggers' 목록 — 없으면 단어만 표시.
편집기 '내보내기' → timing_overrides.json {"<slide>:<action_id>": local_frame} → continuity 가 다음 realization 에서 적용."""
import json,subprocess,os,sys,glob,array
P=sys.argv[1]; os.chdir(P); os.makedirs('final/timing',exist_ok=True)
try: import yaml
except ImportError: yaml=None
t=json.load(open('03-conti-timeline.json')); fps=t.get('fps',30); data=[]
for s in t['slides']:
    trig=[]
    cp=f'slide-{s["id"]}/03-storyboard-conti/conti.yaml'
    if yaml and os.path.exists(cp):
        try:
            c=yaml.safe_load(open(cp,encoding='utf8')) or {}
            def walk(o,path=''):
                if isinstance(o,dict):
                    if 'resolved_frame' in o or 'frame' in o:
                        fr=o.get('resolved_frame',o.get('frame'))
                        if isinstance(fr,(int,float)): trig.append({'id':o.get('id') or o.get('action') or path[-40:],'frame':int(fr),'word':o.get('word') or o.get('trigger')})
                    for k,v in o.items(): walk(v,path+'/'+str(k))
                elif isinstance(o,list):
                    for i,v in enumerate(o): walk(v,path+f'[{i}]')
            walk(c)
        except Exception as e: print('conti parse skip',s['id'],e)
    for b in s.get('beats',[]):
        if not b.get('wav_s'): continue
        bt=b['id'].split('-')[1]; wav=f'slide-{s["id"]}/04-audio/beat-{bt}.wav'
        raw=subprocess.run(['ffmpeg','-v','error','-i',wav,'-ac','1','-ar','8000','-f','s16le','-'],capture_output=True).stdout
        a=array.array('h'); a.frombytes(raw[:len(raw)//2*2]); n=max(1,len(a)//int(8000/fps))
        peaks=[max(abs(x) for x in a[i*n:(i+1)*n] or [0])/32768 for i in range(len(a)//n)]
        w=json.load(open(wav[:-4]+'.words.json')) if os.path.exists(wav[:-4]+'.words.json') else {'words':[],'text':''}
        lo,hi=b['local']
        data.append({'slide':s['id'],'beat':b['id'],'text':w.get('text',''),'local_start':lo,'frames':hi-lo,'peaks':[round(p,3) for p in peaks],
                     'words':w['words'],'triggers':[x for x in trig if lo<=x['frame']<=hi+15]})
tpl=open(os.path.join(os.path.dirname(__file__),'..','templates','module1','timing_editor.html'),encoding='utf8').read()
open('final/timing/timing_editor.html','w',encoding='utf8').write(tpl.replace('/*__DATA__*/null',json.dumps({'fps':fps,'beats':data},ensure_ascii=False)))
print('final/timing/timing_editor.html —',len(data),'beats')
