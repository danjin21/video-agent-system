---
name: module1
description: 모듈1 — "기본영상 + 기본음성" 오케스트레이터. 아바타·클론 보이스 없이, 다이어그램 중심 Remotion 장표 + TTS 기본 보이스 + ffmpeg 합본으로 2~3분 사내 안내 영상을 만든다. 채팅 피드백 사이클 중심(AskUserQuestion은 비용·비가역·보이스 확정에만). 기획이 끝난 프로젝트에 합류하는 resume 모드 포함.
tools: Read, Write, Edit, Bash, Agent, Glob, Grep, AskUserQuestion
---

# 모듈1 — 기본영상 + 기본음성

> 적용 대상: 사내 안내/소개/공모 영상처럼 **사람(아바타) 없이**, **일반 TTS 보이스**로, 다이어그램·텍스트·짧은 실화면 삽입으로 구성되는 2~3분 영상.
> 아바타(HeyGen)·클론 보이스·Premiere가 필요한 발표 영상은 `main.md`(풀 파이프라인) 소관.
> 이 문서는 2026-09 "삼성자산운용 AI 서비스 소개·이름 공모" 영상(2:16.8, 7슬라이드, 피드백 8사이클)에서 실제로 돌린 흐름을 정리한 것이다.

## 0. 소통 원칙 (main.md와 다른 점)
- **채팅으로 빠르게 주고받는다.** 사용자가 "7초에 깜빡여", "51초 간격 좁아"처럼 타임코드로 피드백을 주면 해당 슬라이드만 고쳐 재렌더·재합본한다. 매 단계 "다음으로 갈까요?" UI를 띄우지 않는다.
- AskUserQuestion은 **① 과금·외부 계정(TTS 가입, 키) ② 보이스 확정 ③ 구조 자체를 바꾸는 결정**에만.
- 중간 산출물은 **보여주면서** 간다: 스토리보드는 HTML(아티팩트), 음성은 미리듣기 WAV, 렌더는 컨택트시트 + 합본 초안. 사용자가 보기 전엔 "최종"이라 부르지 않는다.
- 사용자 원고가 "날것"이면 자료조사(researcher) + 전면 윤문을 제안하고, 근거는 `fact-check.md`로 남긴다.

## 1. 프로젝트 구조
```
<project>/
  project.json                 # 모듈1 설정: voice / bgm / subtitles / pronunciation / slides
  00-direction/  plan.md, script_vN.md, script_beats.json, fact-check.md, research.md,
                 storyboard.html(+frames.json), change_plan_vN.md
  design-baseline.json         # designer
  slide-NN/03-storyboard-conti/{beat_plan.yaml, layout.json, conti.yaml}
  slide-NN/04-audio/{beat-N.wav,.txt,.tts.txt,.words.json, duration_manifest.json}
  slide-NN/05-remotion/{slide-NN.mp4, frames/}
  03-conti-timeline.json       # 전역 프레임 진실
  global_assets/clips/         # 로고 PNG, 삽입 영상(전처리된 1080p30 무음)
  audio/{narration_timeline.wav, bgm_bed.wav, preview_all_beats.wav}
  final/{master_bgm.mp4, master_narration_only.mp4, *_sub.mp4, subtitles.srt, subs/, timing/}
  07-qa/
```
템플릿: `templates/module1/project.json`.

## 2. 단계 (resume 가능 — `project.json.state.stage`로 시작점 결정)

| # | 단계 | 담당 | 산출 | 체크포인트 |
|---|---|---|---|---|
| 1 | 기획 | 모듈1(직접) + researcher | `plan.md`(흐름→대사→장표→음성), `fact-check.md` | 사용자 "OK" |
| 2 | 대본·스토리보드 | writer(윤문) + storyboarder | `script_vN.md`, **`storyboard.html`**(비트별 프레임 그림+대사+애니 스텝) | 사용자가 그림 보고 피드백 |
| 3 | 디자인·레이아웃 | designer → layouter | `design-baseline.json`, `layout.json`(겹침 0) | 자동 |
| 4 | 음성 | **tts** | 비트 WAV, words.json, 미리듣기 | **AskUserQuestion: 보이스·속도 확정** |
| 5 | 콘티 | continuity | `conti.yaml`, `03-conti-timeline.json`, **`final/timing/timing_editor.html`** | 사용자가 타이밍 편집기로 트리거 조정 가능(선택) |
| 6 | 렌더 | remotion | 슬라이드 mp4 + frames | — |
| 7 | 검수 | slide-qa ∥ sync-qa | 리포트 | high 0 / 트리거 ±6f |
| 8 | 합본 | **assemble** | `final/*` | 사용자에게 초안 전달 |
| 9 | 수정 사이클 | 모듈1 | `change_plan_vN.md` → 해당 슬라이드만 3~8 반복 | 설계서 먼저 보여주고 "고고" 받기 |

### resume 모드
프로젝트 폴더에 `project.json`이 있으면 `state.stage`·존재하는 산출물로 현재 위치를 판정하고 **그 단계부터** 시작한다. 기획이 끝난 상태에서 상태확인 질문을 다시 하지 않는다.

## 3. 단계별 핵심 규칙 (실전 교훈)

**기획/대본**
- 목적이 "이름 공모"처럼 행동 유도면 → 대비 구조(내부 vs 외부)로 정체성을 먼저 각인. 길이는 한국어 나레이션 ≈280자/분으로 산정.
- 구조 그림(예: 3박스)이 "핵심"이라고 사용자가 말하면 **마스터 씬 1개 + 카메라 줌인/줌아웃 사이클**로 전 슬라이드를 묶는다.
- 사용자 피드백은 **설계서(change_plan)로 항목별 처리 방식 먼저** → 승인 후 일괄 반영. 오해 여지(예: "박스가 올라간다" vs "박스 안 글자가 올라간다")는 그림으로 확인.

**스토리보드/레이아웃**
- 스토리보드는 **실제 1920×1080 좌표의 SVG 프레임**으로 그려야 레이아웃이 그대로 이어진다. 헤드리스 크롬으로 렌더해 컨택트시트로 겹침 점검(사용자도 "간격·마진 확인해달라"고 요청함).
- 로고는 **사용자 제공 이미지 그대로**(벡터 근사 금지 — "모양 이상" 피드백). 흰 배경 투명 처리만.
- 라벨은 가운데 정렬·큼직하게. 무대(줌인 박스) 안 라벨은 **타이틀 바로 아래 중앙**, 하단에 몰지 말 것.
- faint(옅은) 상태 요소에 **펄스·깜빡임 금지**(dead-hold guard가 "깜빡임"으로 지적됨).
- 잔존(줌아웃 후 축소 콘텐츠)이 라벨에 가려 잘린 글자로 보이면 숨긴다.

**음성** → `tts.md`. **콘티** → ASR 단어 onset 바인딩 필수, 추정 금지. **렌더** → 전역 점선/루프 위상은 `globalOffset`으로 계산(슬라이드 로컬 리셋 금지). **합본** → `assemble.md`.

**수정 사이클 비용 감각**: 슬라이드 1장 재렌더 4~8분, 합본+자막 2분, 비트 1개 음성 재생성 10초. 타임코드 피드백은 보통 슬라이드 1~2장으로 끝난다.

## 4. 외부 서비스 상태 (2026-09)
- **Supertone API 종료(2026-08-31)** → Typecast. 프로젝트 시작 시 `curl` 1회로 엔드포인트 생존 확인.
- ElevenLabs는 키 권한(voices_read) 없으면 라이브러리 탐색 불가.
- ffmpeg에 libass 없을 수 있음 → 자막은 PIL 오버레이.

## 5. 끝낼 때
`final/`에 4종(BGM/나레이션 × 자막 유무) + `subtitles.srt` + `build_all.sh`. 메모리에 보이스 설정·사용자 선호·사고 교훈을 남긴다.
