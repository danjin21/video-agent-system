# 모듈2 연출 키트 — `diagram` · `broll` 요소

장표를 "제목 + 불릿 카드"로 때우지 않게 하는 도구 모음이다. 규칙은 `templates/module2/studio/anim.js` 한 곳에 있고
스튜디오 미리보기와 Remotion 렌더가 **같은 함수**(`diagramSVG`, `brollSVG`)로 그린다 → 미리보기 = 렌더.

- 요소 위치·크기(`x,y,w,h`)와 등장·퇴장(`timeline.json`)은 다른 요소와 같다.
- `props` 안의 `at`·`dur`는 **요소가 등장한 뒤 센 프레임**(30fps). 말하는 순간에 물린다: `at = (비트 시작 - 요소 in)`.
- 리빌 모션은 1.5초(45f) 안에 끝나고 멈춘다. 역동성은 "느린 하나"가 아니라 "빠른 여러 개".
- 색: props에는 디자인 키트 색 이름을 쓴다 — `$blue`(주인공), `$navy`(글자), `$coral`(증가·경고·반전), `$gray`(보조). 값은 `design/theme.json`(스튜디오 디자인 키트 탭). 굵기 600/700만.
- 글자 요소는 키트 글자 양식(`style`)을 참조한다 — SKILL.md [2-1b].

## diagram — `{"type":"diagram","kind":"…","props":{…}}`

| kind | 쓰는 곳 | 핵심 props |
|---|---|---|
| `chapter` | 챕터 간지(큰 번호 + 제목). 화면 전체 | `num`, `title`, `sub`, `at`, `onBlue` |
| `keyword` | 결정타 단어를 화면 가득, 글자 스태거 | `text`, `size`(220), `sub`, `at`, `perLetter`(2), `align`, `bgGhost`(true·{at,opacity:0.07,scale,stack}: 다 뜬 뒤 같은 단어를 뒤에 크고 옅게 두 줄로 — 배경이 휑하지 않게) |
| `ghost` | 콘텐츠 뒤 대형 옅은 단어 (슬라이드당 1회) | `text`, `size`(360), `at`, `maxOpacity`(0.08) |
| `stat` | 큰 숫자 카운트업 + 증감 칩 | `value`("4,178"), `unit`("억 원"), `label`, `delta`("+2배"), `at`, `dur`(24), `size` — 증감 칩 글자는 숫자 크기×`deltaScale`(0.3, 최소 48)·굵기 800(키트 `components.stat.params`) |
| `bars` | 연도·부문 비교 막대, 값 카운트업, 강조 막대, 증가 화살표, **증가분 얹기** | `bars[{label,value,display,at,highlight,valueAt,add{value,label,at,dur,color}}]`, `annotate{from,to,text,at}`, `max`, `barWidth` |
| `line` | 추세·전망 곡선 draw(**기본 부드러운 곡선** + 선 끝을 따라가는 점), 구간 음영, 표식 | `series[{points,at,dur,color,name,curve,dot}]`, `labels`, `markers[{series,i,text,at}]`, `shade{from,to,at}`, `curve`(키트 `line.params.curve`) |
| `nodes` | 개념·관계 (원+글리프+라벨, 연결선 draw) | `nodes[{id,x,y,r,glyph,icon,img,flipAt,label,sub,at,activeAt,fill}]`, `links[{from,to,at,arrow,dash,flow,color}]` — 연결선 기본 **회색 점선이 화살표 쪽으로 흐름**(머리는 고정, 원 테두리 밖). **icon**: money(지폐)·globe(지구본)·robot(로봇)·people(이야기하는 사람들)·pc(컴퓨터)·market(가게), **img**: 앱 아이콘 등 이미지(global_assets/icons/…). `flipAt`이면 글자 원이 뒤집혀 움직이는 아이콘으로. 아이콘은 기본 **색 아이콘**(연한 원 + 테두리, 진한 윤곽·색 면 — params iconColor, 노드별 `iconColor:0`이면 흰 선). 라벨 최소 40·800. params linkColor·linkDash·linkFlow·arrowGap·flipDur·labelMin·labelWeight |
| `table` | KPI·비교 표, **말하는 행마다 하이라이트 이동** | `cols`, `rows`, `colW`, `highlights[{row,at}]`, `accentCol` |
| `cards` | "세 가지 키워드"·"일곱 가지 전략" 카드 공개(**기본 뒤집기**: 색 면+번호 → 앞면), 하나에 초점. 제목은 안쪽 여백(pad) 안에 자동 축소, 최소 36에서 두 줄 | `cards[{num,title,sub,icon,at,color}]`, `focus{index,at}`, `flip`, `pad`, `align` |
| `arrow` | 성장 화살표 draw + 라벨 | `x1,y1,x2,y2`(요소 안 좌표), `at`, `dur`, `label`, `color` |
| `banner` | 하단 한 줄 정리 (pop + shine) | `text`, `at`, `fill`(기본 파랑 — **빨간 띠는 쓰지 않는다**), `size` |

> **하이라이트 글자** (글자 요소 `hl:[{text,color,effect,at,dur}]`): 문구 안 고른 글자가 말할 때 남색→파랑으로 **색만 바뀐다**(기본 `color`). 다른 효과 shine(반짝)·marker(형광펜)·pop·glow. 기본값은 디자인 키트 `textHighlight`. 스튜디오 인스펙터 "하이라이트 글자"에서 글자 선택·색·효과를 고르고, 디자인 스크립트는 `kit.hl(요소, "어떤 환경")` — at을 비우면 그 글자가 들리는 순간으로 자동.


### 사진·미디어 부품 (reactvideoeditor/remotion-templates의 Image & Media 움직임을 옮김, MIT)
사진 경로(`src`)는 섹션 폴더 기준(`photo.jpg`) 또는 `global_assets/…`. **사진이 없으면 '사진 자리 · slot' 표시**로 그려져 기획이 화면에 보인다. Remotion은 프레임 그리기 전에 사진을 모두 불러 둔다(`diagramMedia` + delayRender).

| kind | 쓰는 곳 | 핵심 props |
|---|---|---|
| `zoomReveal` | 챕터 시작·장소 소개. 크게 당겨진 흐린 사진이 빠지며 초점, 캡션이 올라옴 | `src`, `slot`, `at`, `dur`(45), `from`(1.35), `blur`(14), `fx`/`fy`, `rx`(0), `caption`, `captionAt`, `captionSize` |
| `split` | 둘을 나란히(국내↔해외, 작년↔올해). 양쪽에서 밀려와 만나고 VS | `left{src,label,slot}`, `right{…}`, `at`, `dur`(22), `stagger`(6), `gap`, `labelOn`("inside"\|"below"), `vs`, `vsAt` |
| `gallery` | 여러 장면 한눈에(임직원·현장). 칸마다 차례로, 말하는 칸만 밝게 | `images[{src,label,slot}]`, `cols`(3), `rows`, `at`, `stagger`(6), `gap`, `labelOn`, `highlight{index,at}` |
| `compare` | 전·후 변화. 구분선이 움직이며 '후'가 드러남 | `before{src,label}`, `after{src,label}`, `at`, `dur`(40), `from`(0.92), `to`(0.5) |
| `stack` | 시간 흐름·추억. 사진이 떨어지며 겹겹이, 맨 위에 라벨 | `images[{src,label,slot}]`, `at`, `stagger`(12), `rot`, `spread`(40), `photoW`, `photoH`, `frame` |
| `bars3d` | **3D 쿼터뷰 막대** — 정면 2D 막대(높이 `pre` 비율)로 보이다가 `turn`에서 카메라가 쿼터뷰로 돌고, 막대가 입체가 되며 차례로 솟는다(값 카운트업). 실적·목표 결정타 1회 | `bars[{label,value,display,at,highlight,color}]`, `max`, `pre`(0.35, 1=2D에서 다 자람), `turn{at:30,dur:24,rx,ry,zoom}`, `riseAt`, `stagger`(8), `depth`, `barWidth`, `valueSize`, `labelSize`, `annotate{text,at,color}` |
| `cards3d` | **3D 뒤집기 카드** — 카드 뒷면(색+번호)이 보이다가 `tilt`에서 무대가 3D로 기울고, 카드가 차례로(`flipAt`이면 그 단어에) 뒤집혀 앞면 → `settle`에서 정면으로. 전략·과제 3~4개 공개 | `cards[{num,title,sub,color,back,at,flipAt}]`, `gap`, `tilt{at:20,dur:18,rx,ry,zoom}`, `flip{at,dur:22,stagger:12}`, `settle{at,dur}`·`false`, `titleSize`, `subSize`, `front`(뒤집기 없이 기울기만) |
| `rankRise` | **순위 상승** — 3·2·1위 입체 막대, 1위가 더 솟고 붉은 리본 화살표가 물결치며 오른쪽 위로, 배경도 흐른다 | `labels`, `heights`, `rise`, `riseAt`, `arrowAt`, `arrowDur`, `color`, `tag` |
| `rings` | **과녁 고리** — 가운데 영역에서 한 겹씩 넓어지는 기울어진 원판, 라벨은 고리 띠 위, 끝나면 물결이 퍼진다 | `center`, `rings[{label,at}]`, `tilt`, `gap`, `color` |
| `panels3` | **3분할 빗면 패널** — 비스듬한 패널 3개가 올라오며 패널마다 아이콘이 움직인다 | `panels[{icon,img,title,sub,color,at}]`, `skew`(14), `titleSize`, `subSize` |
| `stackBuild` | **블록 쌓기 → 지도** — 아이콘이 블록이 되어 빈자리에 끼워지고, 다 쌓이면 위로 올라가며 미국 지도가 흰색→파랑으로 물든다 | `blocks[{label,icon,at}]`, `mapAt`, `mapLabel`, `color` |
| `wordSwarm` | **글자 폭증 비행** — 가운데 한 단어(역량)가 100개로 불어나 흩어지고, 카메라가 휘어지며 그 사이를 날아 지나가면 화면이 비고 다음 화두가 딱 | `text`, `count`(100), `size`, `burst{at,dur}`, `fly{at,dur}`, `curve` |
| `horizon` | **경계 넘어 수평선·태양** — 큰 단어가 가로 일직선(경계)으로 눌리고, 카메라가 선을 넘어 나아가면 지평선에서 노란 태양이 뜨며 캡션 | `word`, `wordY`, `lineLabel`, `caption`, `captionSub`, `collapse`, `cross`, `sunAt`, `captionAt` |
| `globe` | **3D 지구** — 멀리서 돌며 다가와 한반도가 보이고, 대한민국에서 파란 화살표가 세계로. 육지는 `land`(kit.world_land() → global_assets/geo/world_land.json), 없으면 키트 안의 거친 윤곽 | `approach{dur,from,spin}`, `center{lon,lat}`, `home`, `targets[{lon,lat,label}]`, `arrowsAt`, `land` |
| `orgChart` | **조직도 그리기** — 회사 상자 아래로 남색 선이 그려지며 부문·팀 상자가 펼쳐지고, `highlightAt`에 지정 부서에 파란색이 들어오며 반짝 | `root`, `groups`(수 또는 [{name,teams}]), `teams`, `highlight[[부문,팀]]`, `highlightAt` |

> **노드 아이콘 전체**: money·globe·robot·people·pc·market·app(img)·person·usperson·account·youtube·phone·megaphone·building·flag·docpen·dumbbell·handshake·team. `icon`에 배열(["globe","building","flag"])을 주면 원 안에 나란히. **AI 영상 B-roll**: `scripts/module2/ai_video.py`(ElevenLabs Veo) → global_assets/clips/ → broll `src`. **Envato 소재**: `envato_assets.py search/download` (스튜디오 계정 연결에서 토큰).

> 3D 부품(`bars3d`·`cards3d`)은 CSS 3D(HTML)로 그려 스튜디오 미리보기 = 렌더다(three.js `type:"3d"`는 렌더에서만 보임). 카메라 각도·원근은 디자인 키트 `components.bars3d/cards3d.params`(rx·ry·zoom·depth·perspective). 디자인 키트 탭 썸네일을 클릭하면 움직임이 재생된다.

- 커뮤니티 템플릿을 쓸 때는 .tsx를 그대로 붙이지 않는다. 움직임을 이 파일(`studio/anim.js` KIT)로 옮겨야 스튜디오 미리보기 = 렌더가 유지되고 디자인 키트에서 조정된다.

## 움직임 문법 (anim.js — 모든 요소 공통, 2026-11-18)
- **등장(enter)**: fade · fade-up · fade-down · slide-left/right · scale-in · pop · wipe-right · typewriter · count-up · **flip**(뒤집히며) · **drop**(위에서 떨어지며 튐) · **zoom-in**(크게 다가왔다 제자리)
- **강조(emphasis `[{type,at,dur,color}]`)**: pulse · **bounce** · **lift** · **shake** · **wiggle** · **echo**(메아리 흔들림 — 흔들리며 잔상 3겹이 퍼짐. `stat`은 숫자에만 잔상, 그 밖은 요소 전체. 핵심 수치를 "한 번 더" 강조할 때, 카운트업이 끝난 뒤 그 숫자가 들리는 순간, dur 40) · highlight(빛 테두리, `color`=키트 색). 큰 요소는 세기를 자동으로 줄인다.
- **양식 강조**: `theme.motion.<양식>.emphasis`(at = 등장부터 센 프레임) → 그 양식을 쓰는 모든 요소에 같은 강조.
- **비트마다 움직임(자동)**: `theme.beatAccent` — 문장 시작과 긴 문장 4초마다 화면 변화가 없으면 주인공 요소(가장 큰 도표·글자)에 pulse→lift→bounce를 돌아가며 건다. 제외하려면 요소에 `noAccent:true`. 그래도 직접 설계할 것: 문장마다 그 문장의 화두(숫자·키워드·칩)가 새로 뜨거나 강조되게.
- **마일스톤 바**: 합본 때 영상 맨 위 64px에 큰 챕터(project.json `milestones`)와 진행 위치. 섹션 글자는 y 80 이상(배치 검사 `milestone`).

## broll — 실사 영상 자리 `{"type":"broll","slot":"장면 묘사","query":"영문 검색어","src":null,"props":{"camera":{…}}}`

- `src`가 없으면 **초안·최종 모두** 어두운 자리표시 카드에 장면 묘사·검색어를 띄운다 → 영상이 없어도 기획이 화면에 보인다.
- `src`(예: `global_assets/clips/building.mp4`)가 생기면 그대로 실사로 바뀐다(무음, cover).
- `camera`: `zoomFrom`, `zoomTo`, `panX`, `panY`, `rotate` — 요소 노출 시간 동안 천천히(빌딩 앙각 회전 = `{"zoomFrom":1,"zoomTo":1.12,"rotate":4}`).
- 실사 위 글자는 별도 `text` 요소(흰색 큰 키워드, 이탤릭 느낌은 letterSpacing·굵기로). 파란 스크림 강제 금지.
- 기본은 쓰지 않는다(`direction-rubric.json` broll_default_off). 감정 고조·결정타 비유에만, 비유에 1:1.

## 레시피 — 2026 하반기 영상(구작품)에서 나온 문법

| 장면 | 구성 |
|---|---|
| 챕터 간지 "03 상반기 실적" | `chapter{num:"03",title:"상반기 실적"}` 단독, 2~3초 |
| 실적 발표 | `bars`(연도별, 올해 막대 highlight) + 오른쪽 `stat` 2개(매출·세전이익, delta "+78%") + 하단 `banner`("역대 최고치 달성") |
| "모두 고생 많으셨습니다" | 성장 그래픽(`nodes`/`arrow`) 위 `banner`, 또는 `broll`(사람들·건물) + 흰 대형 키워드 |
| KPI 표 | `table` + 발화 행마다 `highlights` 이동, 끝에 `banner` |
| 세 가지 키워드 | `cards` 3장 스태거 → 각 챕터에서 `focus`로 해당 카드만 밝게 |
| 목표 숫자 | `keyword` 또는 `stat`("5,000" 억원) 단독 화면, 이어서 `arrow`("10%") |
| 글로벌 | 3D `globe`(THREE_KIT) 또는 `broll`(세계지도·컨테이너선) |
| 마무리 회고 | 첫 장면과 같은 `broll`(빌딩) + 첫 키워드를 다시 부름(수미상관) |

### 2026-11-19 추가 메모
- `bars3d` 막대에 `add{value,label,at,dur,color}`(위에 다른 색 증가분 입체가 솟음) · `valueAt/valueDur`(숫자 카운트업 시점). `pre:1`이면 2D에서 다 자란 뒤 `turn`(예: `ry:-45`)으로 쿼터뷰 전환.
- `cards3d` 기본 `mode:"fold"` — 무대는 정면 그대로(가로선 평행), 정면 3등분 카드 중 양옆만 안쪽으로 살짝 꺾인 병풍 입체(`fold` 18°). 예전처럼 무대 전체를 기울이려면 `mode:"tilt"`.
- 색 `$purple`(과제·보조 강조 — 빨강 대신).
- 디자인 `sync=False`: 그 요소는 발음 맞춤(kit.sync_words)·발음 검사(direction_check word_sync)를 건너뛴다 — 띠를 대사보다 먼저 띄울 때.
- 그림·데이터를 직접 못 만들면 `00-direction/codex_tasks/NN_*.md`에 작업 명세를 남긴다(사용자가 Codex에 맡김).
