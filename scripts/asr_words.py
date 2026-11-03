# -*- coding: utf-8 -*-
"""ASR 단어 타임스탬프: beat-N.wav → beat-N.words.json (faster-whisper small, ko)
usage: asr_words.py <project_root> [slide-NN/04-audio/beat-N.wav ...]  (경로 생략 시 전체)"""
import sys,os,glob,json,subprocess
P=sys.argv[1]; os.chdir(P)
from faster_whisper import WhisperModel
m=WhisperModel('small',device='cpu',compute_type='int8')
wavs=sys.argv[2:] or sorted(glob.glob('slide-*/04-audio/beat-*.wav'))
for wav in wavs:
    d=os.path.dirname(wav); b=os.path.basename(wav)[:-4]
    subprocess.run(['ffmpeg','-v','error','-y','-i',wav,'-ac','1','-ar','16000','/tmp/_asr.wav'])
    segs,_=m.transcribe('/tmp/_asr.wav',language='ko',word_timestamps=True)
    words=[{'w':w.word.strip(),'s':round(w.start,3),'e':round(w.end,3)} for s in segs for w in s.words]
    dur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',wav],capture_output=True,text=True).stdout.strip())
    text=open(f'{d}/{b}.txt',encoding='utf8').read().strip() if os.path.exists(f'{d}/{b}.txt') else ''
    json.dump({'beat':b,'duration_s':round(dur,3),'text':text,'words':words},open(f'{d}/{b}.words.json','w'),ensure_ascii=False,indent=1)
    print(f'{d.split("/")[0]} {b}: {len(words)}w  ASR: {" ".join(x["w"] for x in words)}')
