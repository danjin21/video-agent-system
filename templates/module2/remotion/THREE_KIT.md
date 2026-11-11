# 모듈2 3D 기본 키트

layout.json 요소에 `type: "3d"`, `scene: <이름>`, `props: {...}` 를 넣으면 Remotion 렌더에서 3D로 그려진다.
스튜디오 미리보기에서는 파란 자리 표시로 보이고, "초안 렌더" 뒤 "보기: 렌더본"에서 실제 움직임을 본다.

**시간 규칙:** props 안의 `at`, `explodeAt`, `focus[].at` 은 모두 **요소가 등장한 프레임(in)부터 센 프레임**이다.
발화 시점(ASR 단어 프레임, 섹션 기준)에 맞추려면 `at = 단어 프레임 − 요소 in`.
모든 움직임은 frame의 순수 함수라 몇 번을 렌더해도 같다.

## globe — 지구본 거점 (글로벌 전략)
```json
{"id":"el_globe","type":"3d","scene":"globe","x":960,"y":250,"w":860,"h":800,
 "props":{"markers":[{"lat":37.5,"lon":127,"label":"본사","home":true,"at":0},
                     {"lat":14.1,"lon":108.3,"label":"베트남","at":40}],
          "focus":[{"at":20,"lat":12,"lon":115,"zoom":1.0,"dur":40}],
          "arcDur":26}}
```
- `markers`: 위도·경도·라벨. `home: true`인 거점에서 나머지로 연결선이 그려지고, 선은 `at` 직전 `arcDur` 프레임 동안 그려진 뒤 거점이 팝업한다.
- `focus`: 지구본이 그 위치를 정면으로 돌려 보여준다. `zoom` 1 = 기본, 0.8 = 멀리. 경도는 짧은 쪽으로 돈다.
- 선택: `start`, `spin`(프레임당 자전 도, 기본 0.05), `color`, `gridColor`, `accent`, `labelSize`.
- 현재 대륙 윤곽은 없다(위경도 격자). 대륙 점지도 데이터가 생기면 추가.

## bars — 입체 막대 (실적·추이)
```json
{"type":"3d","scene":"bars","w":1000,"h":400,
 "props":{"bars":[{"label":"'24 상반기","value":305,"display":"305조","at":10},
                  {"label":"'25 상반기","value":340,"display":"340조","at":58,"highlight":true}],
          "max":360,"height":2.4,"trend":true,"orbit":14}}
```
- 막대는 `at`부터 26프레임 동안 자라고, 값은 `display` 문자열 안의 숫자가 같이 카운트업한다(anim.js와 같은 규칙).
- `highlight` 막대는 진한 파랑. `trend: true`면 마지막 막대 30프레임 뒤 추이선, 숫자면 그 프레임.
- `orbit`: 장면 동안 카메라가 도는 각도.

## layers — 층 쌓기·분해 (사업·플랫폼 구조)
```json
{"type":"3d","scene":"layers","w":960,"h":820,
 "props":{"layers":[{"label":"운용 역량","sub":"ETF · 연금 · 펀드","at":5},
                    {"label":"초부유층 자산관리","sub":"신사업 1","at":20}],
          "explodeAt":150,"explodeDur":30,"gap":1.05,
          "focus":[{"at":200,"index":1},{"at":300,"index":null}]}}
```
- 아래층부터 `at`에 떨어지듯 쌓이고, `explodeAt`에 층 사이가 벌어지며 보조 설명(`sub`)이 나타난다.
- `focus.index`: 그 층만 진하게, 나머지는 흐리게. `null`이면 해제.

## 장면 추가하는 법
1. `three/<Scene>.tsx` 작성 — `useCurrentFrame()`으로만 움직임 계산, 라벨은 `TextSprite`, 공용 곡선은 `util.ts`.
2. `three/Scene3D.tsx`의 `SCENES`에 등록.
3. `studio/app.js`의 `SCENE_NAMES`, `SCENE_DEFAULTS`에 이름·기본값 추가.
4. 이 문서에 props 표 추가. 데모 프로젝트에 넣고 `render_section.py <p> <sid> --still N`으로 정지 화면 확인.

## 설치·렌더
- 1회: `scripts/module2/setup_remotion.sh` — 3D 의존성을 `<remotion>/codex-workspace/module2/`에만 설치(공용 package.json 무변경), 중복 remotion 사본 제거.
- 렌더: `render_section.py <project> <sid|all> [--draft] [--still N]` — 매번 이 폴더와 anim.js를 작업 폴더로 동기화하고 `--gl=angle`로 렌더.
