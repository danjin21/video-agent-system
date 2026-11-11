---
name: module2-strategy-video
description: 경영전략회의 발표영상(약 15분)을 만든다. PPT나 대본을 받아 민감정보를 마스킹하고, 섹션마다 대본·스토리보드·장표·타임라인을 만든 뒤, 로컬 웹 스튜디오에서 섹션 단위 코멘트·직접 편집을 받아 고치고, 데이터 구동 Remotion(3D 포함)으로 렌더·합본한다. 인물은 HeyGen, 클론 음성·음악은 ElevenLabs이며 계정은 사용자마다 각자 연결한다. "경영전략회의 영상", "전략 발표영상", "모듈2" 요청에 사용.
---

# 모듈2 — 경영전략회의 발표영상

이 문서는 **도구 중립 절차서**다. Claude Code와 Codex가 같은 파일을 읽는다. 상세 설계와 근거는 플러그인의 `agents/module2.md`(설계 정본)에 있고, 이 파일과 다르면 그 문서가 우선한다.

## 0. 경로 잡기

```bash
# 이 SKILL.md는 <plugin>/skills/module2-strategy-video/SKILL.md 에 있다 (심볼릭 링크면 실제 경로 기준)
PLUGIN=$(cd "$(dirname "$(realpath <이 SKILL.md 경로>)")/../.." && pwd)
S=$PLUGIN/scripts/module2
P=<영상 프로젝트 폴더>                      # 예: ~/videos/2027-strategy
export REMOTION_PROJECT_ROOT=<Remotion 프로젝트 루트>   # 사용자마다 다름
```

필요한 것: Python 3.9+(표준 라이브러리만 씀), ffmpeg, Node.js, Remotion 프로젝트 하나.
Codex 연결: `$S/install_codex_skill.sh`(홈 전체) 또는 `$S/install_codex_skill.sh <저장소>`(그 저장소만). 플러그인 저장소 안에서는 `.agents/skills/`에 이미 링크돼 있다.
Remotion 프로젝트에 `AGENTS.md`가 있으면 그 규칙을 따른다. 이 스킬은 `codex-workspace/module2/` 폴더 안에서만 작업하고 공용 `package.json`·Root를 고치지 않는다.

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
2. 이미 받은 것은 다시 묻지 않고, 아래를 한 번에 하나씩 확인한다: 발표자·아바타 사용 여부, 목표 길이(기본 15분), 로고, BGM 방향, 사용자가 직접 만든 별도 영상 유무.
3. 초기화:
   ```bash
   python3 $S/module2_init.py $P --pptx 자료.pptx     # 또는 --script 대본.md / --demo
   ```

### [1] 마스킹 (외부 전송 전 필수)
```bash
python3 $S/redact.py scan $P        # 회사명·금액·수치·지역 추출 → 매핑표
python3 $S/studio_server.py $P      # http://127.0.0.1:8765 → '마스킹' 화면에서 사용자가 확인·확정
python3 $S/redact.py apply $P
python3 $S/redact.py gate $P        # 실값이 남으면 exit 1 → 외부 호출 금지
```
- 스캐너가 놓친 토큰은 `redact.py add`로 보탠다. 오탐은 `allow`.
- 민감 토큰이 있는 비트는 인물(아바타) 모드에서 장표 모드로 자동 전환된다.
- `00-direction/redaction_map.json`은 커밋·업로드·공유하지 않는다.

### [2] 섹션별 4레이어 초안
섹션(30~60초)마다 `sections/sNN/`에 만든다: ① `script.md`·`beats.json`(대본 정리) ② `storyboard.md`(글 줄기·화면 모드) ③ `layout.json`(1920×1080 좌표) ④ `timeline.json`(프레임 단위 등장·퇴장·효과).
- 값은 JSON에만 둔다. `.tsx`에 하드코딩하지 않는다.
- 3D 장면(지구본·입체 막대·층 쌓기)은 `templates/module2/remotion/THREE_KIT.md`를 따른다. 장면 안의 `at`은 **요소 등장부터 센 프레임**.

### [3] 스튜디오 리뷰
```bash
python3 $S/studio_server.py $P      # 127.0.0.1 전용. 실데이터가 있으므로 외부 공개 금지
```
사용자는 섹션 하나씩 보며 코멘트(위치·크기·폰트·타이밍·효과·이미지·영상 대체·문구·자유)와 직접 편집을 남기고 "수정 요청 보내기"를 누른다.

### [4] 섹션 수정 루프
```bash
python3 $S/studio_queue.py $P list
python3 $S/studio_queue.py $P start <rid>    # 직접 편집값을 값 그대로 합침 (해석 금지)
python3 $S/studio_queue.py $P brief <rid>    # 섹션 작업자 지시문
#  → 지시문대로 섹션 수정 (§1 표: 병렬 하위 에이전트 또는 순서대로)
python3 $S/studio_queue.py $P done <rid> --summary "무엇을 바꿨는지 한 줄"
```
- 섹션 작업자는 **자기 섹션 폴더만** 고친다. 전역 변경이 필요하면 보고만 한다.
- 각 코멘트를 `resolved` / `needs_user`로 표시한다. 해석이 갈리면 두 안을 만들어 고르게 한다.
- 대본 문구가 바뀌면 [1]의 `scan → apply → gate`를 다시 돈다.
- 잠긴 섹션은 건드리지 않는다.

### [5] 계정 연결 — 사용자별 (ElevenLabs·HeyGen)
계정은 **영상을 만드는 사용자 본인 것**을 쓴다. 이 스킬·플러그인·저장소에는 어떤 사용자의 키나 ID도 넣지 않는다.

1. 사용자에게 본인 계정이 있는지 묻는다. 없으면 각 서비스 가입은 사용자가 직접 한다(에이전트가 계정을 만들지 않는다).
2. 스튜디오 `계정` 화면을 열게 하고, 사용자가 **직접** 붙여넣게 한다:
   - ElevenLabs: API 키. 키 권한에 TTS, 사용자 정보 읽기, 보이스 읽기·쓰기, (BGM을 만들면) Music을 켠다.
   - HeyGen: API 키, 본인 아바타 ID(look ID).
3. 저장 위치는 사용자별로 나뉜다:
   - API 키 → 그 사용자의 `~/.config/video-agents/secrets.env` (권한 600). 응답·로그·커밋에 절대 출력하지 않는다.
   - voice_id·avatar_id → 해당 영상 프로젝트의 `$P/project.json`. 다른 사용자·다른 프로젝트 값을 복사해 오지 않는다.
4. "연결 테스트"로 확인한다: ElevenLabs는 권한·보이스 목록, HeyGen은 아바타·Avatar V 지원·잔여 크레딧.
5. 클론 보이스가 없으면 스튜디오 녹음 가이드로 본인 목소리를 녹음하고, 승인받은 뒤 클론을 만든다. 녹음 원고에 실데이터를 넣지 않는다.

### [6] 음성 — ElevenLabs (사용자 본인 voice_id)
1. `gate`를 통과한 마스킹 문장만 보낸다. 생성 전 글자 수·예상 비용을 알리고 승인받는다.
2. 민감 어절은 마스킹 문장으로 생성한 뒤, 실값 어절만 따로 생성해 로컬에서 잘라 붙인다(`redact.py splice-plan`, 설계 문서 §7-3). 허용 목록에 있는 조각만 `gate --fragments`를 통과한다.
3. 생성 후 BGM 없이 음성 검수 → ASR 단어 타임스탬프 → 타임라인 재바인딩.

> 상태: 생성 스크립트는 아직 구현 전이다. 구현되기 전에는 사용자가 만든 WAV를 `sections/sNN/audio/beat-N.wav`로 넣는다.

### [7] 인물 — HeyGen (사용자 본인 avatar_id)
1. 민감 토큰이 0개인 비트만 아바타로 만든다.
2. 생성 전 길이·엔진·비용·잔여 크레딧을 알리고 승인받는다.
3. 립싱크 음성은 [6]의 WAV. 아바타 영상은 무음으로 쓰고 소리는 WAV 하나만 쓴다.
4. 결과를 `sections/sNN/avatar/avatar.mp4`에 두면 렌더가 읽는다.

> 상태: 생성 연결은 아직 구현 전이다. 그 전에는 사용자가 만든 mp4를 위 경로에 넣는다.

### [8] 렌더·합본
```bash
$S/setup_remotion.sh                           # 처음 한 번 (3D 의존성, codex-workspace/module2 에만 설치)
python3 $S/render_section.py $P s03 --draft    # 섹션 초안. 스튜디오의 '초안 렌더' 버튼과 같음
python3 $S/render_section.py $P all            # 최종
python3 $S/assemble.py $P                      # 섹션 이어 붙이기 + 나레이션 배치 + BGM 덕킹
```
- 스튜디오 미리보기와 렌더는 같은 `anim.js`를 쓴다. 미리보기와 다르면 버그다.
- 음악은 사용자 트랙 또는 ElevenLabs Music(과금 → 승인). `project.json`의 `bgm.tracks`에 넣는다.

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
- 값을 `.tsx`에 하드코딩하기

## 4. 참고 문서 (플러그인 내부)
| 문서 | 내용 |
|---|---|
| `agents/module2.md` | 설계 정본 — 데이터 형식, 스튜디오, 마스킹, 스플라이스 상세 |
| `templates/module2/remotion/THREE_KIT.md` | 3D 장면 props와 새 장면 추가법 |
| `agents/avatar.md` | HeyGen API 사양(v3, 오디오 업로드, Avatar V 확인) |
| `agents/assemble.md` | 합본·덕킹 규칙 |
