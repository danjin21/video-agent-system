---
name: module2-strategy-video
description: 경영전략회의 발표영상(약 15분)을 만든다. PPT나 대본을 받아 민감정보를 마스킹하고, 섹션마다 대본·스토리보드·장표·타임라인을 만든 뒤, 로컬 웹 스튜디오에서 섹션 단위 코멘트·직접 편집을 받아 고치고, 데이터 구동 Remotion(3D 포함)으로 렌더·합본한다. 인물은 HeyGen, 클론 음성·음악은 ElevenLabs이며 계정은 사용자마다 각자 연결한다. "경영전략회의 영상", "전략 발표영상", "모듈2" 요청에 사용.
---

# 모듈2 — 경영전략회의 발표영상

이 문서는 **도구 중립 절차서**다. Claude Code와 Codex가 같은 파일을 읽는다. 상세 설계와 근거는 플러그인의 `agents/module2.md`(설계 정본)에 있고, 이 파일과 다르면 그 문서가 우선한다.

## 0. 새 PC 설치 (macOS·Windows 공용)

사용자가 "이 스킬로 환경 설정해줘"라고 하면 이 순서로 한다. 모든 스크립트는 OS 공용 Python이다.

**Python 실행 이름:** Windows는 `py -3`(없으면 `python`), macOS는 `python3`. 아래 `PY`가 그것이다.
**경로:** `PLUGIN` = 이 SKILL.md에서 두 단계 위 폴더(링크·정션이면 실제 위치 기준). `S` = `PLUGIN/scripts/module2`.

1. **점검** — 아무것도 바꾸지 않는다.
   ```
   PY S/module2_setup.py check
   ```
2. **기본 프로그램이 빠졌으면** (git·node 18+·ffmpeg) 사용자에게 설치해도 되는지 묻고:
   ```
   PY S/module2_setup.py install --prereqs     # Windows는 winget, macOS는 Homebrew
   ```
   Windows에서는 설치 뒤 **터미널과 Codex를 다시 열어야** PATH에 잡힌다. 다시 연 뒤 1번부터.
   Python 자체가 없으면 사용자가 직접 설치한다(Windows: `winget install -e --id Python.Python.3.12`).
3. **나머지 전부**:
   ```
   PY S/module2_setup.py install [--remotion <Remotion 폴더>]
   ```
   - Remotion 폴더가 없으면 새로 만든다(기본 `~/remotion`, 검증된 버전 고정, TypeScript는 5.x). 경로는 `~/.config/video-agents/module2.json`에 저장돼 이후 스크립트가 자동으로 쓴다. 환경변수 `REMOTION_PROJECT_ROOT`가 있으면 그게 우선.
   - 3D 의존성은 `<Remotion>/codex-workspace/module2/`에만 설치한다.
   - Pretendard 폰트를 `~/.config/video-agents/fonts`에 받는다(GitHub, 약 47MB).
   - 이 스킬을 `~/.agents/skills/module2-strategy-video`에 연결한다(Windows는 링크 → 정션 → 복사 순으로 시도. 복사면 `git pull` 뒤 `PY S/module2_setup.py skill`을 다시 실행).
4. 마지막 `check`에서 **계정 키 파일**만 비어 있는 게 정상이다. 키는 [5] 절차로 사용자가 넣는다.
5. 첫 렌더는 Remotion이 렌더용 브라우저를 한 번 받아서 1분쯤 걸린다.

경로 변수 (이후 절차에서 사용):
```
P = <영상 프로젝트 폴더>     # 실데이터가 들어간다. 클라우드 동기화 폴더·저장소 밖에 둔다
```
Remotion 프로젝트에 `AGENTS.md`가 있으면 그 규칙을 따른다. 이 스킬은 `codex-workspace/module2/` 폴더 안에서만 작업하고 공용 `package.json`·Root를 고치지 않는다.
스튜디오 서버(`studio_server.py`)는 계속 떠 있어야 하므로, 에이전트 세션 안보다 **사용자가 연 별도 터미널**에서 켜두는 게 안정적이다.

## 1. 도구 이름 대응

설계 문서에는 Claude Code 도구 이름이 나온다. 다른 에이전트에서는 아래처럼 읽는다.

| 설계 문서 표현 | 뜻 | Claude Code | 그 밖의 에이전트(Codex 등) |
|---|---|---|---|
| AskUserQuestion | 사용자에게 선택을 묻고 답을 기다림 | AskUserQuestion | 채팅으로 묻고 답을 기다림 |
| Agent(섹션별 병렬) | 섹션 하나를 맡는 하위 작업자 | Agent 도구로 병렬 실행 | 하위 에이전트 기능이 있으면 사용, 없으면 섹션을 **하나씩 순서대로** 처리 |
| Read/Write/Edit/Bash | 파일·명령 | 동일 | 각자 셸·파일 도구 |

## 2. 절차

### [0] 접수
1. 경영전략회의 자료(PPT·대본·둘 다)를 달라고 한다.
2. 이미 받은 것은 다시 묻지 않고, 아래를 한 번에 하나씩 확인한다: 발표자·아바타 사용 여부, 목표 길이(기본 15분), 로고, BGM 방향, 사용자가 직접 만든 별도 영상 유무, **참고 영상**(이전 전략회의 영상·캡처·녹취록, 좋아하는 레퍼런스). 참고 영상이 있으면 [2-1]에서 연출 문법을 뽑는 기준이 된다.
3. 초기화:
   ```bash
   PY S/module2_init.py P --pptx 자료.pptx     # 또는 --script 대본.md / --demo
   ```
   - 만들어지는 섹션 파일은 **골격(scaffold)** 이다. 스튜디오가 열리게 하는 자리표시일 뿐 완성품이 아니다. 이걸 렌더해서 영상이라고 내놓지 않는다.
4. **"기본 영상" = 연출은 다 하고, 없는 재료만 자리표시.** 사용자가 "아바타·목소리 빼고 기본 영상"이라고 해도 연출안·다이어그램·카운트업·b-roll 자리는 그대로 만든다. 아바타·실사 영상은 자리표시, 음성은 발표 속도 추정(분당 약 350자)으로 시간을 잡는다.

### [1] 마스킹 (외부 전송 전 필수)
```bash
PY S/redact.py scan P        # 회사명·금액·수치·지역 추출 → 매핑표
PY S/studio_server.py P      # http://127.0.0.1:8765 → '마스킹' 화면에서 사용자가 확인·확정
PY S/redact.py apply P
PY S/redact.py gate P        # 실값이 남으면 exit 1 → 외부 호출 금지
```
- 스캐너가 놓친 토큰은 `redact.py add`로 보탠다. 오탐은 `allow`.
- 민감 토큰이 있는 비트는 인물(아바타) 모드에서 장표 모드로 자동 전환된다.
- `00-direction/redaction_map.json`은 커밋·업로드·공유하지 않는다.

### [2] 연출안 → 섹션별 4레이어

#### [2-1] 연출안 (director, 필수 — 장표보다 먼저)
영상 전체를 한 명의 PD가 설계한다. `agents/director.md`·`agents/storyboarder.md`·`templates/taste-rubric.json`·`templates/direction-rubric.json`을 읽고, `00-direction/direction.md`(init이 템플릿을 넣어 둠)를 채운다.
- 참고 영상이 있으면 먼저 분석한다: 챕터 구성, 간지, 숫자 연출, 다이어그램, 실사 영상을 쓴 지점과 비유, 감정 고점, 화면 글자 방식. 표로 정리해 "이번에 쓸 곳"까지 적는다.
- 반드시 들어갈 것: 한 줄 메시지·감정 흐름, **챕터 구조와 빌드업**(오프닝 훅·클라이맥스·수미상관), **섹션마다 주인공 장치 1개와 이유**(같은 장치 3연속 금지), **대본의 모든 수치의 연출**, b-roll 자리(장면 묘사·카메라·검색어), 하지 않을 것.
- 장치는 `templates/module2/remotion/DIRECTION_KIT.md`(chapter·keyword·ghost·stat·bars·line·nodes·table·cards·arrow·banner·broll)와 `THREE_KIT.md`(3D)에서 고른다.
- 스튜디오 **연출안** 탭에서 사용자에게 보여 주고 **승인**받는다. 승인 전에는 섹션 설계로 넘어가지 않는다. 연출안이 바뀌면 다시 승인.

#### [2-1b] 디자인 키트 (필수 — 공통 양식의 단일 출처, 2026-11-18)
모든 장표의 공통 양식 — 제목 글꼴·크기·위치, 머리말, 화두 문장, 칩·박스 색, 실사 위 글자, 표기, 애니메이션(등장·퇴장), 연출 부품의 색 — 은 **`$P/design/theme.json` 하나를 거쳐** 만든다(init이 템플릿 `templates/module2/theme.json`을 복사).
- 요소는 값을 직접 갖지 않고 이름으로 참조한다: 글자 `"style": "title" | "kicker" | "display" | "headline" | "statement" | "subline" | "chip" | "chip_alert" | "caption_on_video" | "caption_on_video_sub" | "note" | "focus_num" | "focus_title" | "focus_sub"`, 색 `"$navy"`·`"$blue"`·`"$coral"`… (diagram props 안도 동일). 양식과 **다른 값만** 요소에 적는다(예: 위치 y, 강조색).
- 양식을 쓰는 요소의 등장·퇴장은 theme `motion.<양식>` 프리셋이 정한다 → 타이밍에는 `in`·`out`(·`emphasis`)만 적는다.
- 우선순위: 테마 < 요소에 적힌 값 < 스튜디오 직접 편집. 병합은 `anim.js mergeSection(..., theme)` 하나 — 스튜디오 미리보기와 렌더가 같다.
- 새로 반복되는 형태가 생기면(2곳 이상) 키트에 양식으로 올리고 참조로 바꾼다. 한 번만 쓰는 특수 글자만 값을 직접 둔다(스튜디오가 '양식을 쓰지 않는 글자 요소'로 보여 준다).
- 스튜디오 **디자인 키트** 탭(필수): 색(피커) · 글자 양식(미리보기·크기·굵기·글자색·박스색·위치·쓰인 곳·아이디어) · 애니메이션 양식(등장·퇴장·길이·▶ 미리보기) · 연출 부품 카탈로그(썸네일·언제 쓰나·쓰인 곳) · 양식 밖 요소 목록. 사용자는 여기서 공통 양식을 고치고 **아이디어를 얻고, 이 목록의 이름으로 소통한다**("headline 크기 줄여", "chip을 코랄로"). 키트를 바꾸면 모든 섹션이 '다시 렌더 필요'가 되고 '합본 다시 만들기'로 반영한다.
- 스튜디오를 새로 만들거나 고치는 에이전트는 이 탭을 빼지 않는다.

#### [2-2] 섹션 설계 (섹션별 작업자)
연출안대로 섹션(30~60초)마다 `sections/sNN/`에 만든다: ① `script.md`·`beats.json`(대본 정리) ② `storyboard.md`(글 줄기·화면 모드·비트→비주얼) ③ `layout.json`(1920×1080 좌표) ④ `timeline.json`(프레임 단위 등장·퇴장·효과).
- **섹션마다 직접 설계한다.** 모든 섹션을 반복문 하나로 찍어내는 생성 스크립트를 쓰지 않는다(같은 패턴 반복 = 연출 없음). 하위 에이전트가 있으면 섹션별로 맡긴다(§1 표).
- 다 만든 섹션은 `status.json`의 `"scaffold": false`로 바꾼다.
- **한 장면에 화두 하나 (2026-11-17 사용자 지시).** 장표처럼 여러 내용을 가로·세로로 늘어놓지 않는다. 지금 말하는 화두 하나만 화면 가운데에 크게 두고, 다음 화두로 넘어가면 이전 화두는 퇴장시킨다(예: 세전이익 → 관리자산 → 시장 → "하지만…" 빨간 띠 → 여러분). 제목은 작은 머리말로만 남긴다. 한 화두에 딸린 칩 묶음은 요소에 같은 `group` 값을 준다.
- 반전·결정타 문장("하지만 ~ 아니다")은 화면을 비우고 **가로 띠 배너**(`banner` `rx:0`, `wipe:true`, 코랄)로 가운데에 크게.
- 비트 단위 점진 노출: 말하는 순간마다 요소가 등장·강조된다. 8초 넘게 화면이 멈추지 않게.
- 화면 글자는 키워드·체언. 대사 전문 **자막 바는 기본 off**. 굵기 600/700.
- 값은 JSON에만 둔다. `.tsx`에 하드코딩하지 않는다.
- 3D 장면(지구본·입체 막대·층 쌓기)은 `templates/module2/remotion/THREE_KIT.md`를 따른다. 장면 안의 `at`은 **요소 등장부터 센 프레임**.

#### [2-2b] 배치·간격 (필수, 2026-11-18)
사용자: "간격이 안 맞아서 겹치고, 텍스트들이 막 붙어 있는 게 많다. 에이전트에서도 꼭 검수해서 스튜디오 디자인이 나오게."
- 같은 화면의 서로 다른 내용 사이는 **최소 24px**, 글자와 남의 도형(원·막대) 사이 최소 14px. 선·화살표는 글자를 가로지르지 않는다. 글자는 화면 가장자리 24px 안쪽.
- 부품 안 간격은 디자인 키트 부품 설정으로 맞춘다(예: 노드 원↔라벨 `labelGap`, 라벨↔설명 `subGap`). 섹션마다 좌표로 땜질하지 말고 키트 값을 고친다.
- 장면을 만든 뒤 `node S/layout_audit.mjs P` 로 확인한다(장면마다 실제 위치 계산 — 스튜디오·렌더와 같은 anim.js). [2-3] 검수에 포함되어 겹침·가로지름은 최종 렌더를 막는다.
- 검사 통과 뒤에도 대표 장면 스틸을 눈으로 본다(검사는 글자 폭을 근사한다).

#### [2-3] 연출 검수 (게이트)
```bash
PY S/direction_check.py P    # 오류가 있으면 exit 1 → 최종 렌더 차단 (render_section이 자동으로 검사)
```
- 막는 것: 연출안 없음·미승인, 골격 그대로, 글자만 있는 섹션, 숫자 연출 없음, 같은 장치 3연속, 화두 과밀(한 화면 내용 6개 이상, 4~5개는 경고), **배치 겹침·선이 글자를 가로지름**(붙음 24px 미만·화면 밖은 경고). 경고: 8초 정지, 자막 바, 굵기 800, 챕터 간지 없음.
- 검사를 통과해도 `design-critic`(`agents/design-critic.md`, `taste-rubric.json`)으로 대표 장면 스틸을 보고 한 번 더 판정한다(`render_section.py P sNN --still N`).
- 스튜디오 연출안 탭 오른쪽에 같은 검수 결과가 뜬다. `--skip-check`는 사용자가 명시적으로 허락했을 때만.

- **매 순간 움직임**(2026-11-18 사용자: "모든 문장에는 비트별로… 매순간 애니메이션이 나와서 재미있어야"): 문장(비트)마다 그 문장의 화두가 새로 뜨거나 강조된다. 설계에서 직접 주고, 빠진 곳은 `beatAccent`가 자동으로 메운다. 정지 경고는 6초. 카드는 뒤집히며, 선 차트는 곡선으로, 등장은 flip·drop·zoom-in도 섞어 단조롭지 않게.
- **문장형 자막도 대사에 맞춘다**: 12자 넘는 자막은 첫 단어가 발음될 때 뜬다. 특정 단어에 맞출 때는 요소에 `"sync": "초부유층"`.
- **끝 군소리('음~') 금지**: ElevenLabs가 짧은 문장 끝에 군소리를 붙이는 일이 있다 → `tts_heygen.trailing_hum`이 감지해 최대 2번 다시 만들고, 남으면 경고. 사용자가 지적하면 그 문장만 `--beats sid:bN --force`로 다시.
- **마일스톤 바**: project.json `milestones`([{title, sections, steps?}])로 큰 챕터를 묶으면 합본 때 영상 위에 진행 바가 붙는다(연출안 §3 챕터 구조 그대로). 키트 `milestones`에서 색·숨김.
- **숫자는 다 오른 뒤 머문다**(2026-11-18): stat·bars 카운트업과 증가분 막대는 장면이 바뀌기 최소 1초(권장 2초) 전에 끝난다. 오르는 중에 넘어가면 어색하다 → `direction_check` `count_cut` 경고.
- **강조는 키트 양식에서**: 같은 성격의 글자(예: 경고 칩)는 크기·강조(펄스·빛 테두리)를 `theme.json` `styles`·`motion.<양식>.emphasis`로 한 번에 정한다. 사용자가 한 장면을 지적해도 "템플릿 공통"이면 양식을 고친다(그 양식을 쓰는 모든 장면이 따라옴).
- **사진 부품을 배경으로**: 화면 가득 사진 위에 글자를 얹을 때는 `background:true` + `dim`(0.5 안팎). 사진 파일은 `global_assets/photos/`에, 없으면 '사진 자리 · 파일명'이 보인다.

### [3] 스튜디오 리뷰
```bash
PY S/studio_server.py P      # 127.0.0.1 전용. 실데이터가 있으므로 외부 공개 금지
```
사용자는 섹션 하나씩 보며 코멘트(위치·크기·폰트·타이밍·효과·이미지·영상 대체·문구·자유)와 직접 편집을 남기고 "수정 요청 보내기"를 누른다.
- **전체 보기 탭(필수 기능):** 합본(`final/master.mp4`)을 스튜디오 안에서 처음부터 끝까지 이어서 본다. 섹션 챕터로 건너뛰기, 현재 섹션 → '이 섹션 리뷰하기', 합본에 아직 반영 안 된 섹션 표시, '합본 다시 만들기'(바뀐 섹션만 최종 렌더 → assemble). 사용자가 전체 영상을 보고 싶어 하면 파일 경로를 안내하지 말고 이 탭을 연다(`http://127.0.0.1:8765/#full`). 스튜디오를 고치거나 새로 만들 때 이 기능을 빼지 않는다 — 상세는 `agents/module2.md` §5-5.
- 회사 프록시 환경이면 스튜디오 서버를 `NODE_USE_ENV_PROXY=1`로 띄운다(스튜디오의 렌더 버튼이 Node.js를 쓴다).

### [4] 섹션 수정 루프
```bash
PY S/studio_queue.py P list
PY S/studio_queue.py P start <rid>    # 직접 편집값을 값 그대로 합침 (해석 금지)
PY S/studio_queue.py P brief <rid>    # 섹션 작업자 지시문
#  → 지시문대로 섹션 수정 (§1 표: 병렬 하위 에이전트 또는 순서대로)
PY S/studio_queue.py P done <rid> --summary "무엇을 바꿨는지 한 줄"
```
- 섹션 작업자는 **자기 섹션 폴더만** 고친다. 전역 변경이 필요하면 보고만 한다.
- 각 코멘트를 `resolved` / `needs_user`로 표시한다. 해석이 갈리면 두 안을 만들어 고르게 한다.
- 대본 문구가 바뀌면 [1]의 `scan → apply → gate`를 다시 돈다.
- 잠긴 섹션은 건드리지 않는다.

### [5] 계정 연결 — 사용자별 (ElevenLabs·HeyGen)
계정은 **영상을 만드는 사용자 본인 것**을 쓴다. 이 스킬·플러그인·저장소에는 어떤 사용자의 키나 ID도 넣지 않는다.

1. 사용자에게 본인 계정이 있는지 묻는다. 없으면 각 서비스 가입은 사용자가 직접 한다(에이전트가 계정을 만들지 않는다).
2. 스튜디오 `계정 연결` 화면을 열게 하고, 사용자가 **직접** 붙여넣게 한다:
   - ElevenLabs: API 키. 키 권한에 TTS, 사용자 정보 읽기, 보이스 읽기·쓰기, (BGM을 만들면) Music을 켠다.
   - HeyGen: API 키, 아바타 ID(look ID), (HeyGen 음성을 쓸 때) **voice_id**.
3. 저장 위치는 사용자별로 나뉜다:
   - API 키 → 그 사용자의 `~/.config/video-agents/secrets.env` (권한 600). 응답·로그·커밋에 절대 출력하지 않는다.
   - voice_id·avatar_id → 해당 영상 프로젝트의 `$P/project.json`. 음성 보이스는 프로젝트에 하나이고 `voice.provider`(elevenlabs | heygen)로 어느 서비스 것인지 구분한다.
4. "연결 테스트"로 확인한다: ElevenLabs는 플랜·남은 글자 수·보이스 목록·내 클론 수, HeyGen은 크레딧·아바타·보이스 종류(instant/professional).
5. **회사 프록시 환경**: 스튜디오를 띄우는 터미널에 프록시가 없으면 외부 호출이 시간 초과된다. 프로젝트 `start_studio.ps1`에서 그 프로세스에만 `HTTPS_PROXY`·`NODE_USE_ENV_PROXY=1`을 준다(시스템 설정은 건드리지 않음).

### [6] 음성 — 목소리 정하기 → 생성 → 타이밍 (구현됨, ElevenLabs 권장)
진입점 `PY S/tts_voice.py` (구현 `tts_heygen.py`, ElevenLabs·HeyGen 공용). 한 번에 다 만들지 말고 **처음 1분(`--until 60`)**으로 목소리를 확정한 뒤 넓힌다.

**6-1. 목소리 정하기 (복제 → 비교 → 선택)**
1. 발표자 목소리를 복제한다. 재료는 본인(또는 권한 있는) 깨끗한 음성 **30초 이상**(1~3분 권장, 단일 화자, 배경음 없음). 파일이 있으면 `global_assets/voice_samples/`에 넣고, 없으면 스튜디오 녹음기로 녹음한다. 녹음 원고에 실데이터를 넣지 않는다. 길이·음량·무음 구간을 ffprobe/volumedetect로 먼저 확인한다.
2. 스튜디오 `계정 연결 → 클론 만들기`(= `POST /api/elevenlabs/clone`)로 Instant Voice Clone. 결과 voice_id는 `project.json voice`에 `provider: elevenlabs`로 저장된다. 한글 이름을 셸 curl로 보내면 인코딩이 깨지므로 UTF-8 JSON으로 보낸다.
3. **같은 문장 하나로 비교 샘플**을 만들어 사용자에게 들려준다(파일을 보내고 고르게 한다). 금액이 든 문장을 고르면 무음 처리까지 함께 확인된다.
   ```bash
   PY S/tts_voice.py P --sample s02:b1 --yes --variants "A_기본:0.5:0:1.0,B_안정:0.75:0:1.0,C_안정_천천히:0.75:0:0.93,D_안정_천천히_낮게:0.75:-1:0.93"
   ```
   형식 `이름:안정성:음높이(반음):속도:스타일:끝처리(1):앞뒤맥락(1)`. 사용자 피드백에 맞춰 한 번 더 좁힌다.
4. 피드백 → 조정 대응표 (2026-11-17 실제 교정):

   | 사용자 말 | 조정 |
   |---|---|
   | "가볍다·얄밉다·출렁인다" | 안정성 ↑ (0.5 → 0.75 → **0.85**), 스타일 0 |
   | "문장 끝이 얄밉다" | 안정성 ↑ 먼저. 그래도 남으면 끝처리(`tail`: 마지막 어절만 −1.5반음·고음 −4dB·−1.5dB, 길이 유지) |
   | "더 중후하게·낮게" | 음높이 −1 반음(로컬). −2.5 이상은 기계음이 날 수 있음 |
   | "빠르다·느리다" | 속도 0.93~1.1 (ElevenLabs speed 0.7~1.2) |
   | "문장 사이가 짧다·길다" | `gap` short·medium·long — 음성 재생성 없이 **텀 적용** |
   | HeyGen 인스턴트 보이스가 별로 | ElevenLabs 클론으로 전환 (HeyGen instant는 speed·pitch API 미지원, 표현 강도만) |

5. 고른 설정을 `project.json voice`에 저장한다 — 예(2027 전략회의에서 확정): `{"provider":"elevenlabs","settings":{"stability":0.85,"similarity_boost":0.8,"style":0.0,"use_speaker_boost":true},"speed":"medium","gap":"medium","context":false,"sensitive":"silence"}`. `context:false`는 비교 샘플과 똑같이 문장 단독으로 만든다(true면 앞뒤 문장을 함께 보내 이어 말하듯 맺음).

**6-2. 생성**
1. 먼저 `--yes` 없이 실행해 보낼 문장·글자 수·무음 처리될 실값을 보여주고 승인받는다(과금).
   ```bash
   PY S/tts_voice.py P --sections s01,s02 --until 60          # 확인
   PY S/tts_voice.py P --sections s01,s02 --until 60 --yes    # 생성
   ```
2. **금액·민감 실값은 그 단어만 무음** (`voice.sensitive: silence`, 기본): 실값 대신 같은 단위의 자리채움 숫자(예: 4,178억 원 → 1,111억 원)로 문장 전체를 생성해 억양을 살리고, 글자별 시각으로 자리채움 구간만 무음 → "2026년 세전이익은 ___ 으로 예상됩니다". 실값은 외부로 나가지 않는다. 무음 구간은 `beat-N.tts.json`에 남아 나중에 실값 음성을 끼워 넣을 수 있다. 문장째 빼려면 `sensitive: skip`. 사용자가 노출을 허용한 토큰(`redact.py allow`)만 실값으로 보낸다.
3. 결과: `audio/beat-N.wav` + `.words.json`(단어 시점) + `.tts.json`(설정·무음 기록). 생성 후 비트 시간을 실제 길이 + 텀으로 다시 잡고 장면 요소(in/out/강조/키트 props의 at)를 따라 옮긴다. 음량을 확인한다(평균 −16 dB 안팎, 피크 −1 dB 이하 클리핑 없음).
   - **화두 단어는 발음 순간에 뜬다.** 슬로건·키워드·핵심 숫자처럼 대사에 그대로 나오는 단어는 비트 시작 + 고정 오프셋으로 잡지 말고 `words.json`의 그 단어 시작점(`s`)에 `in`을 맞춘다(디자인 스크립트에서 `word_at(sid, "b2", "Beyond")` 같은 헬퍼로 계산, 음성이 없으면 기존 오프셋으로 대체). 앞 장면 글자는 그 직전(≈10프레임 전)에 퇴장. 음성을 다시 만들면 디자인 스크립트를 다시 돌려 시점을 다시 잡는다.
     - 대상: 대형 키워드·stat·강조 띠·짧은 단어(공백 빼고 12자 이하). 제외: 머리말(kicker)·제목·칩·문장형 자막(문장 시작에 뜨는 게 맞다). 요소에 `"nosync": true`면 제외.
     - 짝짓기: 화면 글자의 앞 토큰이 발음 단어의 앞부분과 일치(조사 붙은 '성장입니다'↔'성장' OK), 원래 in 기준 −3초~+4초 안에서만. 앞당길 때는 앞 장면 요소가 다 퇴장한 뒤로만(같은 자리에 두 화두가 겹치지 않게).
     - 저장 단계(`save`)에서 자동으로 맞추고, 검수 게이트 `direction_check`가 1초 넘게 어긋난 화두를 `word_sync` 경고로 띄운다(스튜디오 연출안 목록에 표시). — 2026-11-18 사용자: "Beyond Connection이 발음 나올 때 나오도록"
4. 스튜디오 `대본` 탭: 기본 말 속도·문장 사이 텀 + 문장별 덮어쓰기, 🔊 실제 길이, **텀 적용**(외부 호출 없음). 속도를 바꾼 문장은 `--beats s02:b3 --force --yes`로 그 문장만 다시 만든다.
5. 그다음 '전체 보기'에서 '합본 다시 만들기' → 사용자가 처음 1분을 듣고 확정하면 나머지 섹션으로 넓힌다.
- HeyGen 음성도 같은 명령으로 된다(`voice.provider: heygen`): professional 클론은 HeyGen speed·pitch + `heygen-voice-1`(유료), instant는 표현 강도(`expressiveness`)만 API, 속도·음높이는 로컬, 모델 `heygen-voice-1-turbo-free`.

### [7] 인물 — HeyGen (사용자 본인 avatar_id)
1. 민감 토큰이 0개인 비트만 아바타로 만든다.
2. 생성 전 길이·엔진·비용·잔여 크레딧을 알리고 승인받는다.
3. 립싱크 음성은 [6]의 WAV. 아바타 영상은 무음으로 쓰고 소리는 WAV 하나만 쓴다.
4. 결과를 `sections/sNN/avatar/avatar.mp4`에 두면 렌더가 읽는다.

> 상태: 생성 연결은 아직 구현 전이다. 그 전에는 사용자가 만든 mp4를 위 경로에 넣는다.

### [8] 렌더·합본
```bash
PY S/render_section.py P s03 --draft    # 섹션 초안. 스튜디오의 '초안 렌더' 버튼과 같음
PY S/render_section.py P all            # 최종
PY S/assemble.py P                      # 섹션 이어 붙이기 + 나레이션 배치 + BGM 덕킹
```
- 스튜디오 미리보기와 렌더는 같은 `anim.js`를 쓴다. 미리보기와 다르면 버그다.
- 합본을 만든 뒤에는 스튜디오 **전체 보기** 탭에서 확인하게 안내한다. 섹션을 고친 뒤에는 그 탭의 '합본 다시 만들기'로 갱신할 수 있다.
- 음악은 사용자 트랙 또는 ElevenLabs Music(과금 → 승인). `project.json`의 `bgm.tracks`에 넣는다.
- **섹션 전환**(2026-11-18): 합본 때 경계마다 `@remotion/transitions` 조각(`Module2Transition`)을 렌더해 끼운다. 종류·길이는 디자인 키트 `design/theme.json` → `transitions`(스튜디오 디자인 키트 탭 '섹션 전환', ▶ 미리보기).
  - 기본 `default`(페이드 15f) / 챕터 간지로 시작하는 섹션은 `chapter`(오른쪽에서 닦아내기 18f) / 특정 섹션만 `sections.<sid>`. 종류: fade·slide·wipe·flip·clockWipe·iris·none.
  - 앞 섹션 끝 n프레임과 다음 섹션 처음 n프레임이 겹치므로 경계마다 n프레임 짧아지고 나레이션도 그만큼 당겨 배치한다. n은 앞 섹션 꼬리 무음(보통 24f)을 넘지 못한다 → 대사가 잘리지 않는다.
  - 섹션 안 장면은 그대로라 섹션 재렌더가 필요 없다(키트 지문 `theme_hash`에서 transitions 제외). 실제 섹션 시작 위치는 `final/master.json` → 스튜디오 전체 보기 챕터가 이를 쓴다.
  - 패키지는 `codex-workspace/module2`에만 설치(`module2_setup.py remotion`, Remotion 버전과 맞춤). `--draft`·`--no-transitions`는 전환 없이 이어 붙임.
  - 커뮤니티 템플릿(remotion-templates·remotion-bits 등, MIT)은 그대로 붙이지 말고 움직임을 키트 양식·anim.js 부품으로 옮긴다 — 스튜디오 미리보기와 렌더가 같은 anim.js를 써야 하기 때문.
  - 이미 옮긴 것: 사진·미디어 부품 `zoomReveal`·`split`·`gallery`·`compare`·`stack`(DIRECTION_KIT.md). 실사 사진이 있으면 b-roll 대신 이 부품으로 장면을 만든다. 사진 파일은 사용자에게 받는다(다운로드는 사용자 승인).

### [9] 사용자 제작 별도 영상
투입 규칙은 사용자가 정하기로 했다. `agents/module2.md` §10에 기록된 규칙을 따른다. 기록이 없으면 `global_assets/user_videos/`에 원본을 보관하고 무음 사본을 쓴다.

## 3. 절대 하지 말 것
- 마스킹 확정·`gate` 통과 전에 대본을 외부(ElevenLabs·HeyGen·웹 검색)로 보내기
- `redaction_map.json`, API 키, 다른 사용자의 voice_id·avatar_id를 커밋·업로드·공유하기
- 민감 토큰이 있는 비트를 아바타로 만들기
- 실데이터가 든 스튜디오·스토리보드를 외부에 게시하기
- 사용자의 직접 편집값을 임의로 "보정"하기
- 섹션 작업자가 자기 섹션 밖을 고치기
- 승인 없이 과금 호출(음성·아바타·클론·음악)
- 목소리를 비교 샘플로 확정받기 전에 전체(18분)를 한 번에 생성하기
- 실제 금액을 외부 TTS로 보내기 (자리채움 + 무음이 기본, 사용자가 허용한 토큰만 예외)
- 값을 `.tsx`에 하드코딩하기
- 스튜디오를 고치거나 새로 만들면서 **전체 보기**(합본 이어보기)·**디자인 키트** 기능을 빼기
- 제목·칩·화두 문장 같은 공통 양식의 값을 섹션마다 복사해 박기 (디자인 키트 `style` 참조로)
- 배치 검사(`layout_audit.mjs`)의 겹침·붙음을 남긴 채 영상을 완성본으로 보고하기
- 연출안 승인 없이 섹션 장표를 만들기, init 골격을 그대로 렌더해 영상이라고 내놓기
- 모든 섹션을 하나의 생성 스크립트로 같은 틀에 찍어내기 (제목 + 불릿 카드 나열)
- "아바타·음성 없이"를 "연출 없이"로 해석하기
- 연출 검수(`direction_check.py`) 오류를 남긴 채 최종 렌더·합본을 완성본으로 보고하기

## 4. 참고 문서 (플러그인 내부)
| 문서 | 내용 |
|---|---|
| `agents/module2.md` | 설계 정본 — 데이터 형식, 스튜디오, 마스킹, 스플라이스 상세 |
| `templates/module2/remotion/THREE_KIT.md` | 3D 장면 props와 새 장면 추가법 |
| `templates/module2/remotion/DIRECTION_KIT.md` | 연출 키트(diagram 11종·broll 자리표시) props와 레시피 |
| `templates/module2/direction.md` | 연출안 템플릿 (init이 `00-direction/`에 복사) |
| `templates/module2/theme.json` | 디자인 키트 템플릿 (init이 `design/theme.json`에 복사) — 색·글자 양식·애니메이션·부품 카탈로그 |
| `agents/director.md`·`storyboarder.md`·`design-critic.md` | 연출·스토리보드·미감 검수 원칙 (2026-06~07 사용자 피드백 누적) |
| `templates/taste-rubric.json`·`direction-rubric.json` | 안티패턴·연출 원칙 루브릭 |
| `agents/avatar.md` | HeyGen API 사양(v3, 오디오 업로드, Avatar V 확인) |
| `agents/assemble.md` | 합본·덕킹 규칙 |
