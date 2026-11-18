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
| `keyword` | 결정타 단어를 화면 가득, 글자 스태거 | `text`, `size`(220), `sub`, `at`, `perLetter`(2), `align` |
| `ghost` | 콘텐츠 뒤 대형 옅은 단어 (슬라이드당 1회) | `text`, `size`(360), `at`, `maxOpacity`(0.08) |
| `stat` | 큰 숫자 카운트업 + 증감 칩 | `value`("4,178"), `unit`("억 원"), `label`, `delta`("+2배"), `at`, `dur`(24), `size` |
| `bars` | 연도·부문 비교 막대, 값 카운트업, 강조 막대, 증가 화살표, **증가분 얹기** | `bars[{label,value,display,at,highlight,valueAt,add{value,label,at,dur,color}}]`, `annotate{from,to,text,at}`, `max`, `barWidth` |
| `line` | 추세·전망 곡선 draw(**기본 부드러운 곡선** + 선 끝을 따라가는 점), 구간 음영, 표식 | `series[{points,at,dur,color,name,curve,dot}]`, `labels`, `markers[{series,i,text,at}]`, `shade{from,to,at}`, `curve`(키트 `line.params.curve`) |
| `nodes` | 개념·관계 (원+글리프+라벨, 연결선 draw) | `nodes[{id,x,y,r,glyph,label,sub,at,activeAt,fill}]`, `links[{from,to,at,arrow,dash}]` |
| `table` | KPI·비교 표, **말하는 행마다 하이라이트 이동** | `cols`, `rows`, `colW`, `highlights[{row,at}]`, `accentCol` |
| `cards` | "세 가지 키워드"·"일곱 가지 전략" 카드 공개(**기본 뒤집기**: 색 면+번호 → 앞면), 하나에 초점. 제목은 안쪽 여백(pad) 안에 자동 축소, 최소 36에서 두 줄 | `cards[{num,title,sub,icon,at,color}]`, `focus{index,at}`, `flip`, `pad`, `align` |
| `arrow` | 성장 화살표 draw + 라벨 | `x1,y1,x2,y2`(요소 안 좌표), `at`, `dur`, `label`, `color` |
| `banner` | 하단 한 줄 정리 (pop + shine) | `text`, `at`, `fill`, `size` |

### 사진·미디어 부품 (reactvideoeditor/remotion-templates의 Image & Media 움직임을 옮김, MIT)
사진 경로(`src`)는 섹션 폴더 기준(`photo.jpg`) 또는 `global_assets/…`. **사진이 없으면 '사진 자리 · slot' 표시**로 그려져 기획이 화면에 보인다. Remotion은 프레임 그리기 전에 사진을 모두 불러 둔다(`diagramMedia` + delayRender).

| kind | 쓰는 곳 | 핵심 props |
|---|---|---|
| `zoomReveal` | 챕터 시작·장소 소개. 크게 당겨진 흐린 사진이 빠지며 초점, 캡션이 올라옴 | `src`, `slot`, `at`, `dur`(45), `from`(1.35), `blur`(14), `fx`/`fy`, `rx`(0), `caption`, `captionAt`, `captionSize` |
| `split` | 둘을 나란히(국내↔해외, 작년↔올해). 양쪽에서 밀려와 만나고 VS | `left{src,label,slot}`, `right{…}`, `at`, `dur`(22), `stagger`(6), `gap`, `labelOn`("inside"\|"below"), `vs`, `vsAt` |
| `gallery` | 여러 장면 한눈에(임직원·현장). 칸마다 차례로, 말하는 칸만 밝게 | `images[{src,label,slot}]`, `cols`(3), `rows`, `at`, `stagger`(6), `gap`, `labelOn`, `highlight{index,at}` |
| `compare` | 전·후 변화. 구분선이 움직이며 '후'가 드러남 | `before{src,label}`, `after{src,label}`, `at`, `dur`(40), `from`(0.92), `to`(0.5) |
| `stack` | 시간 흐름·추억. 사진이 떨어지며 겹겹이, 맨 위에 라벨 | `images[{src,label,slot}]`, `at`, `stagger`(12), `rot`, `spread`(40), `photoW`, `photoH`, `frame` |

- 커뮤니티 템플릿을 쓸 때는 .tsx를 그대로 붙이지 않는다. 움직임을 이 파일(`studio/anim.js` KIT)로 옮겨야 스튜디오 미리보기 = 렌더가 유지되고 디자인 키트에서 조정된다.

## 움직임 문법 (anim.js — 모든 요소 공통, 2026-11-18)
- **등장(enter)**: fade · fade-up · fade-down · slide-left/right · scale-in · pop · wipe-right · typewriter · count-up · **flip**(뒤집히며) · **drop**(위에서 떨어지며 튐) · **zoom-in**(크게 다가왔다 제자리)
- **강조(emphasis `[{type,at,dur,color}]`)**: pulse · **bounce** · **lift** · **shake** · **wiggle** · highlight(빛 테두리, `color`=키트 색). 큰 요소는 세기를 자동으로 줄인다.
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
