# -*- coding: utf-8 -*-
"""스토리보드 HTML 생성: 00-direction/storyboard_frames.json → 00-direction/storyboard.html
frames.json 스키마: {"title","subtitle","slides":[{"no","title","meta","beats":[{"tc","nar","bg","steps":[["0.0s","설명"],...],"elements":[{type:rect|circle|line|text|image|group|callout,...}]}]}]}
group 에 camera:{s,fx,fy} 를 주면 줌인 프레임(1920x1080 씬 좌표 그대로). 이미지는 data URI 또는 상대경로."""
import json,sys,os
P=sys.argv[1]; os.chdir(P)
tpl=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','templates','module1','storyboard.html'),encoding='utf8').read()
d=json.load(open('00-direction/storyboard_frames.json',encoding='utf8'))
open('00-direction/storyboard.html','w',encoding='utf8').write(tpl.replace('/*__DATA__*/null',json.dumps(d,ensure_ascii=False)))
print('00-direction/storyboard.html', sum(len(s['beats']) for s in d['slides']),'beats')
