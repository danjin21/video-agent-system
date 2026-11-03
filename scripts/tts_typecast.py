# -*- coding: utf-8 -*-
"""모듈1 TTS (Typecast). usage: tts_typecast.py <project_root> [--beats 06-1,06-3] [--force]
읽는 것: project.json(voice·pronunciation), 00-direction/script_beats.json  [{"id":"02-1","text":"..."}]
쓰는 것: slide-NN/04-audio/beat-N.{wav,txt,tts.txt,input_hash}, duration_manifest.json  (+ --asr 로 words.json)
키: TYPECAST_API_KEY (secrets.env를 set -a로 source)"""
import json,subprocess,os,sys,hashlib,re,shutil,time
P=sys.argv[1]; os.chdir(P); args=sys.argv[2:]
only=set(args[args.index('--beats')+1].split(',')) if '--beats' in args else None
force='--force' in args
key=os.environ.get('TYPECAST_API_KEY') or sys.exit('TYPECAST_API_KEY 없음 (set -a; source ~/.config/video-agents/secrets.env; set +a)')
cfg=json.load(open('project.json')); V=cfg['voice']
PARAMS={"model":V.get('model','ssfm-v30'),"language":V.get('language','kor'),"voice_id":V['voice_id'],
        "prompt":V.get('prompt',{"emotion_type":"preset","emotion_preset":"toneup","emotion_intensity":1.0}),
        "output":{"audio_format":"wav","audio_tempo":V.get('tempo',0.9)}}
PRON=cfg.get('pronunciation',{})
def pron(t):
    for a,b in PRON.items(): t=re.sub(r'(?<![A-Za-z])'+re.escape(a)+r'(?![A-Za-z])',b,t)
    return t.replace('·',', ')
def tts(text,out,seed=None):
    body=dict(PARAMS,text=text); 
    if seed is not None: body['seed']=seed
    r=subprocess.run(['curl','-s','-w','%{http_code}','-X','POST','https://api.typecast.ai/v1/text-to-speech','-H',f'X-API-KEY: {key}','-H','Content-Type: application/json','-d',json.dumps(body,ensure_ascii=False),'-o',out],capture_output=True,text=True)
    return r.stdout,body
def dur_of(f): return float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout.strip() or 0)
beats=json.load(open('00-direction/script_beats.json')); ts=time.strftime('%m%d%H%M')
tot=0
for b in beats:
    if only and b['id'] not in only: continue
    sl,bt=b['id'].split('-'); sd=f'slide-{sl}/04-audio'; os.makedirs(sd,exist_ok=True)
    text=b['text']; tt=pron(text); h=hashlib.sha1(json.dumps({'t':tt,'p':PARAMS},sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:16]
    wav=f'{sd}/beat-{bt}.wav'; hf=f'{sd}/beat-{bt}.input_hash'
    if not force and os.path.exists(wav) and os.path.exists(hf) and open(hf).read().strip()==h:
        d=dur_of(wav); tot+=d; print(f'{b["id"]} cache {d:.2f}s'); continue
    if os.path.exists(wav): os.makedirs(f'{sd}/_prev_{ts}',exist_ok=True); shutil.copy(wav,f'{sd}/_prev_{ts}/beat-{bt}.wav')
    code,body=tts(tt,wav)
    if code!='200': print(f'{b["id"]} HTTP {code}: {open(wav,errors="ignore").read()[:200]}'); continue
    d=dur_of(wav); tot+=d
    open(f'{sd}/beat-{bt}.txt','w',encoding='utf8').write(text+'\n'); open(f'{sd}/beat-{bt}.tts.txt','w',encoding='utf8').write(tt+'\n'); open(hf,'w').write(h)
    mp=f'{sd}/duration_manifest.json'; man=json.load(open(mp)) if os.path.exists(mp) else {'beats':{}}
    man.update({'voice':V.get('name'),'voice_id':V['voice_id'],'params':PARAMS}); man['beats'][f'beat-{bt}']={'duration_s':round(d,3),'text':text,'tts_text':tt,'input_hash':h}
    man['beats']=dict(sorted(man['beats'].items())); json.dump(man,open(mp,'w'),ensure_ascii=False,indent=2)
    print(f'{b["id"]} new {d:.2f}s  TTS: {tt}')
print(f'TOTAL speech {tot:.1f}s')
print('다음: scripts/voice_qa.py 로 끝음 QA → flag 비트는 --beats 지정 + --force 로 seed 재생성 / scripts/asr_words.py 로 words.json')
