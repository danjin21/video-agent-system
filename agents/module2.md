---
name: module2
description: 모듈2 — "경영전략회의 발표영상" 오케스트레이터. 인물(HeyGen 아바타) + 클론 음성·음악(ElevenLabs) + Remotion 장표(가능하면 3D)로 약 15분 발표영상을 만든다. 자료(PPT/대본) 접수 → 민감정보 마스킹 → 섹션별 4레이어(대본·스토리보드·장표·영상화 타임라인) → 로컬 웹 스튜디오에서 섹션 단위 코멘트·직접 편집 → 섹션별 서브에이전트 수정 루프. 상태 - 마스킹·스튜디오·수정 대기열·데이터 구동 렌더·3D 기본 키트·합본 구현(v1.1, 2026-11-11), 음성 합성(ElevenLabs·스플라이스)·HeyGen 생성 연결은 구현 전.
tools: Read, Write, Edit, Bash, Agent, Glob, Grep, AskUserQuestion
---

# 모듈2 — 경영전략회의 발표영상 (인물 + 클론음성 + 장표/3D)

> 모듈1 = 기본영상 + 기본음성(아바타 없음, Typecast, 2~3분). → `module1.md`
> **모듈2 = 경영전략회의 발표영상.** 인물은 HeyGen, 음성 복제·음악은 ElevenLabs, 장표는 Remotion(가능하면 3D). 목표 길이 **약 15분**.
> 근거 경험: 2026-06~07 CFO "2026 전사 경영전략" 영상(10:14, 18장, 수정 3사이클) + 2026-09 모듈1 프로젝트.
> 이 문서는 2026-11-11 사용자가 구두로 정의한 모듈2 요구사항을 정리한 **설계 정본**이다. 구현 상태는 §11 표를 따른다.

---

## 빠른 시작 (구현됨)

> 도구 중립 절차서: `skills/module2-strategy-video/SKILL.md` (Claude Code·Codex 공용). 이 문서는 설계 정본이다.

```bash
S=<plugin>/scripts/module2
python3 $S/module2_init.py <project> --script 대본.md      # 또는 --pptx 자료.pptx / --demo
python3 $S/redact.py scan <project>                        # 민감정보 추출 → 매핑표
python3 $S/studio_server.py <project>                      # http://127.0.0.1:8765 (스튜디오)
python3 $S/studio_queue.py <project> list                  # 사용자가 보낸 수정 요청
python3 $S/module2_setup.py install                       # (새 PC 1회) Remotion·3D·폰트·스킬. Windows는 py -3
python3 $S/render_section.py <project> <sNN|all> [--draft] [--still N]   # 섹션 렌더
python3 $S/assemble.py <project> [--draft]                 # 섹션 이어 붙이기 + 나레이션 + BGM
python3 $S/tts_voice.py <project> --sections s01,s02 --yes  # 문장(비트)별 음성 (project.json voice.provider)
python3 $S/splice_real.py <project> plan|make              # 무음 처리된 민감 실값을 같은 목소리 조각으로 끼움 (§7-3)
python3 $S/voice_takes.py <project> review                 # 문장별 듣기 폴더(번호·시각 목록) → 사용자가 이상한 번호 지목
python3 $S/voice_takes.py <project> gen s01:b1 --n 3       # 그 문장만 새로 3개 + 비교 파일 → use s01:b1 2 로 교체
cd <project>/design && python3 sections_a.py               # 섹션 설계 스크립트(kit.py) → layout/timeline (음성 길이 바뀌면 재실행)
```
스크립트는 표준 라이브러리만 쓴다 (Python 3.9+, pptx/docx도 zip+XML로 직접 읽음). 서버는 실행 중인 프로젝트 하나만 다룬다.

## 0. 한 장 요약

```
[0] 접수        사용자에게 경영전략회의 자료를 요청 (PPT / 대본 / 둘 다)
[1] 마스킹      회사명·금액·수치·지역 등 추출 → A사 / 99999원 / 임시지역 으로 치환, 매핑표는 로컬에만
[2] 연출안      director가 영상 전체 연출안(direction.md) → 스튜디오 '연출안'에서 사용자 승인 (필수 게이트)
    4레이어 초안 섹션마다 ① 대본 정리 ② 스토리보드(글 줄기) ③ 장표 레이아웃 ④ 영상화 타임라인 — 섹션별 직접 설계
    연출 검수    direction_check.py (오류 시 최종 렌더 차단) + design-critic 스틸 판정
[3] 스튜디오 리뷰 로컬 웹에서 섹션 하나씩 보고 → 코멘트 + 직접 편집(위치·크기·폰트·타이밍)
[4] 섹션 수정    코멘트 받은 섹션마다 서브에이전트 1개씩 띄워 수정 → 다시 스튜디오 → 반복 → 섹션 잠금
[5] 계정 연결    스튜디오 안에서 HeyGen 로그인·아바타 확인, ElevenLabs 녹음·보이스 클론 가이드
[6] 음성         ElevenLabs 클론 보이스. 민감 단어는 마스킹 음성 생성 후 실단어만 따로 만들어 로컬 합성
[7] 인물         HeyGen 아바타. 민감 단어가 없는 구간만
[8] 음악         ElevenLabs Music 또는 사용자 트랙
[9] 렌더         Remotion(데이터 구동) + 3D 장면(@remotion/three)
[10] 검수·합본   slide/sync/remotion/voice-qa → assemble(ffmpeg) → final-video-qa
```

---

## 1. 소통 원칙

- **주 소통 창구는 로컬 웹 스튜디오다.** 사용자는 섹션을 하나씩 보면서 코멘트와 직접 편집을 남긴다. 채팅은 진행 보고와 큰 결정에만 쓴다.
- AskUserQuestion은 **① 과금(ElevenLabs·HeyGen 생성) ② 외부 계정·키 ③ 마스킹 매핑 확정 ④ 구조 변경**에만 쓴다. 단계마다 "다음으로 갈까요?"를 띄우지 않는다 (모듈1과 동일).
- 사용자 기본 선호(메모리 `video-agent-design-prefs`)를 그대로 적용한다.
  - 아바타는 **풀스크린**만. 코너 박스·양옆 파란 패널 금지. 강조는 아바타 양옆 흰색 대형 키워드.
  - 아바타는 기본 **처음과 끝**에만. 한 씬은 **연속 단일 클립**.
  - 가안 데이터는 화면에 "(가안)" 표기.
  - **모든 타이틀은 명사형.** 제목·머리말(kicker)·챕터 간지·질문 장면 문구는 명사(구)로 끝낸다. "예를 들어 — 업무 절차를 다시 본다", "고객 접점을 잇는다", "올해, 어느 정도의 성장을 이루려 하는가" 같은 문장형·질문형 금지 → "업무 절차 재검토", "고객 접점 연결", "올해 성장 목표". 명사형으로 안 되면 타이틀을 뺀다. (2026-11-20 사용자: "모든 타이틀은 명사형이다. 에이전트에도 명시해라")
  - **강조·확대는 한 요소에 한 번.** 자동 강조(`beatAccent`)는 기본 끔, 수동 펄스 남발 금지, 노드는 톡 커지지 않고 페이드(`pop:true`일 때만 톡). 확대가 필요하면 다 나온 뒤 `zoom` 한 번. 키워드·패널은 나온 뒤 멈춤(`panels3.still`). (2026-11-20 사용자: "확대 두 번 되는 효과 다 없애라", "촐싹대지 마")
  - **하이라이트**: 남색 글자가 말할 때 파랑으로 바뀌는 `color`(기본) 또는 처음부터 색 + 말할 때 흰 선이 훑는 `sweep`. 파란 번짐(blur·glow) 금지.
  - **대본에 구어체 군말 금지**("이제" 등).
  - 음성 검수는 BGM 없는 나레이션 트랙으로.
- **실데이터가 들어간 산출물은 claude.ai 아티팩트로 올리지 않는다.** 스토리보드·스튜디오는 로컬(localhost)에서만 연다. 공유가 필요하면 마스킹본만 올린다.

---

## 2. [0] 접수 — 자료 요청

모듈2가 시작되면 가장 먼저 **경영전략회의에 쓸 내용**을 달라고 한다.

받을 수 있는 형태:
| 입력 | 처리 |
|---|---|
| PPT(.pptx) | 슬라이드 텍스트·도표·이미지 추출 → 섹션 후보로 분해. 암호화돼 있으면 복호화본 요청 |
| 대본(.docx/.md/텍스트) | 문단 → 섹션 → 비트로 분해 |
| 둘 다 | PPT를 장표 정본, 대본을 나레이션 정본으로 매칭 |
| 메모·구두 설명뿐 | writer가 대본 초안 작성 후 동일 흐름 |

함께 확인할 것 (한 번에 하나씩, 이미 받은 건 다시 묻지 않음):
1. 발표자(아바타 대상 인물)와 HeyGen 아바타 보유 여부
2. 목표 길이 (기본 15분. 한국어 나레이션 ≈ 280자/분 → 약 4,200자)
3. 로고·브랜드 자산 (로고는 임의 제작 금지, 받은 파일 그대로)
4. BGM 방향 (ElevenLabs Music 생성 / 사용자 보유 트랙)
5. 사용자가 직접 만든 별도 영상 소스 유무 (§10 규칙 따름)
6. **참고 영상** — 이전 전략회의 영상·장면 캡처·녹취록, 좋아하는 레퍼런스. 있으면 director가 연출 문법을 뽑아 연출안의 기준으로 삼는다(§4-0).

산출: `00-intake/` 원본 보관, `00-direction/direction.md`(연출안 — init이 템플릿 복사, director가 채움).

> **"기본 영상"의 뜻 (2026-11-16 사용자 교정):** "아바타·목소리 빼고 기본 영상"은 **연출을 빼라는 뜻이 아니다.** 연출안·다이어그램·카운트업·챕터 간지·b-roll 자리는 그대로 만들고, 없는 재료(아바타·실사·음성)만 자리표시·추정 시간으로 둔다.

---

## 3. [1] 마스킹 — 민감정보 익명화 (외부 전송 전 필수 게이트)

### 3-1. 무엇을 바꾸나
대본·PPT에서 아래를 **자동 추출**하고, 대체어로 바꾼 **마스킹 대본**을 만든다.

| 범주 | 예 (실값) | 대체어 규칙 |
|---|---|---|
| 회사명 (자사·계열사·고객·경쟁사·M&A 대상) | 삼성자산운용, ○○증권 | `A사`, `B사`, `C사` … 등장 순 |
| 금액·수치 (매출·AUM·이익·성장률·목표치·점유율) | 4,300억 원, 340조, 12% | `99999원`, `99999조`, `99%` (단위는 유지) |
| 지역·국가·도시 (글로벌 사업 전략) | 미국, 베트남, 뉴욕 | `임시지역1`, `임시지역2` … |
| 인명·직함+이름 | 홍길동 상무 | `담당임원1` |
| 상품명·프로젝트 코드명 | KODEX ○○, 프로젝트 X | `상품1`, `프로젝트1` |
| 딜·일정 (공시 전 일정) | 2027년 3월 인수 완료 | `0000년 0월` |

### 3-2. 매핑표
- `00-direction/redaction_map.json` — 토큰 ID, 범주, 실값, 대체어, 등장 위치(섹션·비트·어절), 발화 필요 여부.
  ```json
  {"tokens":[{"id":"COMPANY_1","cat":"company","real":"삼성자산운용","mask":"A사","spoken":true,"occurrences":["s01.b2.w3","s07.b1.w1"]}]}
  ```
- **매핑표는 로컬에만 둔다.** git 커밋 금지(.gitignore), 외부 API 페이로드·웹검색 쿼리·아티팩트에 절대 포함하지 않는다.
- 스튜디오의 "마스킹 검토" 화면에서 사용자가 누락·오탐을 고치고 **확정**한다 (AskUserQuestion으로 최종 확인).
- 사용자가 "이건 노출해도 됨"이라고 한 토큰은 `allow:true`로 표시하고 마스킹에서 뺀다.

### 3-3. 어디에 무엇이 쓰이나
| 대상 | 쓰는 대본 |
|---|---|
| 장표 화면 텍스트·차트 값 (Remotion, 로컬 렌더) | **실값** |
| 자막 (로컬 PIL 렌더) | **실값** |
| ElevenLabs 문장 생성 | **마스킹본** |
| HeyGen 아바타 | 민감 토큰이 **없는** 비트만 (§3-4) |
| researcher 웹검색 | 실값 금지. 일반화된 질의만 |

### 3-4. 민감 단어가 꼭 발화돼야 하는 비트
1. 그 비트는 **인물 구간에서 뺀다.** 아바타 대신 장표 영상 + 보이스오버로 만든다. (HeyGen에 실값 오디오가 넘어가지 않게.)
2. 음성은 ElevenLabs에서 **마스킹본 문장**으로 만든다.
3. **실단어만 따로** 같은 보이스로 생성한다.
4. 로컬에서 마스킹 단어 구간을 잘라내고 실단어 조각을 **붙인다(합성)** → §7-3 스플라이스 절차.

### 3-4-1. 구현 — `scripts/module2/redact.py`
| 명령 | 하는 일 |
|---|---|
| `scan <project>` | 섹션 `beats.json`(없으면 `script_full.md`)에서 후보 추출 → `redaction_map.json`. 사용자가 고친 대체어·허용값은 보존 |
| `apply <project>` | `script_masked.md`, 섹션별 `beats_masked.json`(비트마다 `text_masked`, `sensitive`, `splice`) 생성. 민감 비트가 `mode: avatar`면 `slide`로 강제 전환하고 `mode_forced`에 이유 기록 |
| `add / allow` | 놓친 토큰 추가, 노출 허용 토글 |
| `gate <project> [file\|-] [--fragments]` | 실값이 남아 있으면 exit 1. `--fragments`는 `splice_plan.json`의 실단어 어절만 통과 |
| `splice-plan <project>` | 발화되는 민감 어절 목록 → `splice_plan.json` (음성 합성 단계 입력) |
| `report <project>` | 범주별 표 |

탐지: 금액(숫자+조/억/만+원/달러, 한글 수사), 퍼센트·%p·bp·배수, 연도(기본 노출 허용), 사전(`dictionaries/regions.txt`, `companies.txt`), 회사 접미사(~자산운용/증권/은행/홀딩스…, 영문 Inc/Corp…), 성씨+직함 인명(앞뒤 순서 모두), `project.json`의 `redaction.terms`. **자동 탐지는 출발점이다.** 오케스트레이터는 대본을 직접 읽고 놓친 것(고객사 약칭, 프로젝트 코드명 등)을 `add`로 보탠 뒤 사용자에게 마스킹 화면에서 확정받는다.
조사 교정: 대체어 받침에 맞춰 은/는·이/가·을/를·과/와·으로/로 등을 바꾼다("한빛자산운용이"→"A사가", "베트남과"→"임시지역1과"). `splice`에는 실값 기준 어절이 남는다.
매핑표를 저장할 때 프로젝트 `.gitignore`에 `redaction_map.json`, `splice_plan.json`, `00-intake/`를 자동 추가한다.

### 3-5. 마스킹 게이트 (자동 검사)
- 외부로 나가는 모든 텍스트·오디오 요청 직전에 `redaction_map.json`의 실값 문자열이 페이로드에 있는지 검사하고, 있으면 **차단**한다. (실단어 조각 생성 요청은 §7-3의 허용 목록으로만 통과.)
- 아바타 비트의 대본에 민감 토큰이 하나라도 있으면 그 비트를 인물에서 장표로 강제 전환하고 사용자에게 알린다.

---

## 4. [2] 연출안 → 섹션별 4레이어 초안

### 4-0. 연출안 (필수 게이트, 2026-11-16)
> 배경: 2027 전략회의 1차 결과물이 22개 섹션 모두 "제목 + 불릿 카드 3~6개 + 자막 바"로 찍혀 나왔다. 사용자: "장표가 모두 일괄적이다", "숫자가 쫘라락 바뀌고, 강조는 파란색, 건물 전경이 나오며 카메라가 도는 연출 — 그런 기획이 다 생략됐다. 빌드업을 해야 하는데." 원인은 절차서(SKILL.md)에 director 단계가 없어 init 골격을 반복문으로 채워 렌더한 것. director·storyboarder·design-critic의 2026-06~07 학습이 모듈2에 연결되지 않았다.

1. director가 `00-direction/direction.md`(템플릿 `templates/module2/direction.md`)를 채운다: 한 줄 메시지·감정 흐름 / 참고 영상 문법 표 / 챕터 구조·빌드업(오프닝 훅·클라이맥스·수미상관) / **섹션별 주인공 장치 1개 + 이유 + 비트별 큐** / 수치 전부의 연출 / b-roll 자리(묘사·카메라·검색어) / 하지 않을 것.
2. 참고 영상이 있으면 먼저 분석: 챕터 간지, 숫자 연출(카운트업·막대·거대 숫자), 다이어그램, 실사 영상 지점과 비유, 감정 고점 장치, 화면 글자 방식(키워드 vs 문장). 2026 하반기 영상의 문법은 `templates/module2/remotion/DIRECTION_KIT.md` 레시피 표에 정리.
3. 스튜디오 **연출안** 탭(`#direction`)에서 사용자가 승인 → `project.json state.direction = {approved_at, hash}`. 연출안이 바뀌면 해시가 달라져 다시 승인.
4. 승인 뒤 섹션 작업자가 섹션별로 직접 설계한다. **모든 섹션을 한 생성 스크립트로 찍어내지 않는다.** 끝난 섹션은 `status.json` `scaffold:false`.
5. 연출 검수 `scripts/module2/direction_check.py` — 오류(연출안 없음·미승인·골격 그대로·글자만·숫자 연출 없음·같은 장치 3연속)가 있으면 `render_section.py`가 최종 렌더를 거부한다(초안·스틸은 허용). 경고: 8초 정지·자막 바·굵기 800·챕터 간지 없음. 통과 후 design-critic이 대표 스틸을 `taste-rubric.json`으로 판정.

### 4-0-0. 디자인 키트 (구현됨, 2026-11-18)
> 사용자: "영상에 넣은 디자인 요소들을 종류별로 리스트업해서 스튜디오에서 볼 수 있게 — 그래야 공통 양식을 수정할 수 있다. 모든 장표의 타이틀 폰트 크기와 위치, 박스색 이런 것들을 다 여기를 통과해서 만들게 되는 것. 아이디어도 제공받고, 애니메이션 양식 같은 것도 다 이 키트에서 정하고, 그걸로 소통하고 조정한다."

- 단일 출처 `$P/design/theme.json` (템플릿 `templates/module2/theme.json`): `colors`(+`colorLabels`), `styles`(글자 양식 14종 — 위치·크기·굵기·색·박스·`label`·`idea`), `motion`(양식별 등장·퇴장 프리셋), `components`(연출 부품 13종 이름·아이디어).
- 요소 `"style"` 참조 + `"$색"` 참조 → `anim.js mergeSection(layout, timeline, edits, theme)`가 병합(스튜디오·Remotion 공용, `render_section`이 props에 theme 포함). `applyKitTheme`가 diagram 기본 색도 테마로 바꾼다.
- 스튜디오 `디자인 키트` 탭(`#kit`) + `GET/PUT /api/theme`(+ 쓰인 곳 집계 `usage`). 테마를 저장하면 버전이 오르고 모든 섹션 렌더가 stale → 합본 다시 만들기.
- 2027 전략회의 적용: 22섹션 글자 요소 중 대부분이 양식 참조(title 18·kicker 24·headline 21·focus 카드 등), 직접 값은 특수 글자 18개만.

### 4-0-0b. 배치 검사 (구현됨, 2026-11-18)
`scripts/module2/layout_audit.mjs` — anim.js가 그리는 글자·선·원·막대의 화면 좌표를 기록(`collectDiagram`, `measureText`)해 장면 시점마다 겹침·가로지름·24px 미만 붙음·화면 밖을 찾는다. direction_check 오류(겹침·가로지름)/경고(붙음·화면 밖)로 연결, 스튜디오 연출안 탭 검수 목록에 표시. 대형 키워드 글자 스태거는 한 단어로 본다.

### 4-0-0c. 섹션 설계 스크립트 (구현됨, 2026-11-20)
섹션 화면은 `$P/design/sections_*.py`(챕터별 함수 `s01()`…)와 `scenes_*.py`(덮어쓰기)로 만든다. 짧은 표기·규칙은 `$P/design/kit.py` — 템플릿 `templates/module2/design/kit.py`·`README.md`(module2_init이 복사). `save()`는 layout·timeline을 쓰고 edits.json을 비우므로, 사용자가 말한 수정은 **설계 스크립트에 반영**한다(스튜디오 미세조정만으로 끝내지 않음). 음성 길이가 바뀌면 설계 스크립트를 다시 돌린다. 사용자 확정 연출 규칙(명사형 타이틀·강조 1회·번짐 금지·가운데 시선 등)은 README 끝에 있다.

### 4-0-1. 연출 키트 (구현됨)
요소 `type:"diagram"`(kind 11종: chapter·keyword·ghost·stat·bars·line·nodes·table·cards·arrow·banner)과 `type:"broll"`(실사 자리표시 → `src` 생기면 실사, 카메라 줌·팬·회전). 그리는 규칙은 `anim.js`의 `diagramSVG`·`brollSVG` 하나 → 스튜디오 미리보기와 Remotion 렌더가 같다. props와 레시피: `templates/module2/remotion/DIRECTION_KIT.md`. b-roll 자리표시는 초안·최종 모두 보인다(기획이 화면에 남도록).

### 4-1. 섹션 4레이어

15분 영상은 **섹션 15~25개**(섹션당 30~60초)로 나눈다. 섹션마다 아래 4개 레이어를 만든다.

| 레이어 | 내용 | 파일 | 담당 |
|---|---|---|---|
| ① 대본 정리 | 윤문된 나레이션, 비트 분할, 비트별 예상 길이 | `script.md`, `beats.json` | writer |
| ② 스토리보드 (글 줄기) | 섹션의 메시지 한 줄, 논리 흐름, 화면 모드(인물/장표/3D/영상), 비트↔비주얼 매핑 | `storyboard.md` | director → storyboarder |
| ③ 장표 형태 (레이아웃) | 1920×1080 실좌표 요소 배치, 폰트, 색, 차트 스펙 | `layout.json` | layouter |
| ④ 영상화 레이아웃 (타임라인) | 요소별 등장·퇴장 프레임, 크기 변화, 효과(서서히 사라짐 등), 트랙(인물·장표·b-roll·음성·BGM) | `timeline.json` | continuity |

규칙:
- 데이터 섹션은 **차트 스펙 먼저, 대본 나중** (main.md §5-E 유지).
- 장표는 **숫자 나열 금지**, 연출 키트(`DIRECTION_KIT.md` — 모듈1 `Diagrams.tsx`의 모듈2 데이터 구동판) 우선.
- 같은 장치 구성 3섹션 연속 금지, 글자만 있는 섹션 금지, 대본 수치는 전부 숫자 연출, 8초 넘는 정지 금지, 자막 바 기본 off (direction_check가 검사).
- **한 장면에 화두 하나 (2026-11-17).** 사용자: "한 내용에 하나의 큰 화두가 보여야 한다. 장표처럼 여러 내용이 가로 세로 스파게티처럼 있으면 안 된다." 섹션은 화두 단위 장면의 연속으로 설계한다 — 지금 화두만 가운데에 크게, 다음 화두가 오면 이전 화두 퇴장, 제목은 작은 머리말. 반전 문장은 화면을 비우고 코랄 가로 띠(`banner rx:0 wipe:true`). direction_check `busy`: 동시 내용 6개 이상 오류, 4~5개 경고(같은 `group`은 하나로).
- 섹션 사이 연결(전환·톤)은 오케스트레이터가 관리하고, 섹션 에이전트는 자기 섹션만 본다.

프로젝트 구조:
```
<project>/
  project.json                     # 모듈2 설정: voice / avatar / bgm / fps / sections / state
  00-intake/                       # 원본 PPT·대본 (실데이터)
  00-direction/ direction.md, redaction_map.json(로컬 전용), script_full.md, script_masked.md
  design-baseline.json
  sections/sNN/
    script.md  beats.json  storyboard.md  layout.json  timeline.json
    edits.json                     # 스튜디오 직접 편집값 (§5-3)
    comments.json                  # 스튜디오 코멘트 (§5-2)
    history/vN/                    # 수정 전후 스냅샷
    audio/  beat-N.wav, beat-N.words.json, splice/
    avatar/ avatar.mp4
    render/ sNN.mp4, frames/
  global_assets/ logos/, fonts/, clips/, user_videos/
  audio/ narration_timeline.wav, bgm_bed.wav
  final/ master_bgm.mp4, master_narration_only.mp4, *_sub.mp4
  studio/                          # 로컬 웹 스튜디오 (템플릿에서 복사)
```

---

## 5. [3] 로컬 웹 스튜디오 — 섹션 단위 리뷰·편집

> **상태: 구현됨 (v1).** 서버 `scripts/module2/studio_server.py`(표준 라이브러리, 127.0.0.1 전용), 화면 `templates/module2/studio/`(index.html·app.js·style.css·anim.js, 빌드 없음). 프로젝트에 복사하지 않고 플러그인에서 바로 서빙하고, 데이터만 프로젝트에서 읽고 쓴다. 실데이터를 다루므로 외부 호스팅 금지.

### 5-1. 화면 구성
| 화면 | 기능 |
|---|---|
| 시작 | 자료 업로드(PPT·대본), 프로젝트 설정, 진행 단계 표시 |
| 연출안 (필수) | direction.md 렌더 + 승인 버튼(해시) + 연출 검수 결과(오류·경고, 누르면 그 섹션) (§4-0) |
| 마스킹 검토 | 추출 토큰 표, 실값↔대체어 수정, 오탐 해제, 확정 버튼 |
| 섹션 목록 | 섹션 카드(제목·길이·상태: 초안/코멘트있음/수정중/잠금) |
| 섹션 뷰 | 4레이어 탭(대본·스토리보드·장표·타임라인) + 미리보기 플레이어 + 코멘트 패널 |
| 편집 모드 | 캔버스에서 요소 드래그(위치)·핸들(크기)·폰트 패널·타임라인 바 드래그(등장·퇴장) |
| 계정 연결 | HeyGen·ElevenLabs 연결과 가이드 (§6) |
| 디자인 키트 (필수) | 색·글자 양식·애니메이션 양식·연출 부품 카탈로그·쓰인 곳·양식 밖 요소 (§4-0-0) |
| 전체 보기 (필수) | 합본 영상 처음~끝 이어보기, 섹션 챕터 이동, 합본 미반영 섹션 표시, "합본 다시 만들기" (§5-5) |

미리보기는 **`anim.js`(렌더 의미론 정본)**로 그린다. 요소 병합(`mergeSection`), 프레임별 상태(`stateAt`: 투명도·이동·크기·닦아내기·강조), 표시 텍스트(`displayText`·`richSegments`: 타자기·카운트업·[[강조]])가 순수 함수로 들어 있어, 데이터 구동 Remotion 컴포넌트가 **같은 파일을 import**하면 미리보기와 렌더가 일치한다. (설계 v0의 `@remotion/player` 임베드는 빌드 체인이 필요해 보류. 3D·차트·실제 아바타는 렌더 단계에서 완성.)
- 비트 음성(`audio/beat-N.wav`)이 있으면 미리보기 재생 때 같이 나오고, `beat-N.words.json`(ASR)이 있으면 타임라인에 단어 시작점이 찍혀 막대가 거기에 붙는다.
- 편집 모드에서는 아직 등장 전인 요소도 흐리게 보여서 선택할 수 있다. 가운데선·다른 요소 가장자리에 자석처럼 붙고(Alt로 해제), ⌘Z로 되돌린다.
- 끝까지 유지되는 요소의 타임라인 막대를 옮기면 등장만 바뀌고 퇴장은 끝에 고정된다.
- 섹션 잠금, 이전 버전 되돌리기(`history/vN`), 4초마다 상태 폴링(에이전트가 고치면 자동 새로고침).

### 5-2. 코멘트 (텍스트 지시)
코멘트는 요소를 클릭해 붙이고, 유형을 고른다.

| 유형 | 예 |
|---|---|
| `move` 위치 수정 | "제목 좀 더 위로" |
| `resize` 크기 수정 | "숫자 더 크게" |
| `font` 폰트 수정 | "본문 Pretendard Medium으로" |
| `timing` 타이밍 | "그래프는 '두 배'라고 말할 때 나오게" |
| `effect` 효과 넣기 | "서서히 사라지게", "카운트업으로" |
| `image` 이미지 넣기 | 이미지 파일 첨부 + 위치 |
| `replace_video` 영상으로 대체 | 장표 구간을 영상 파일로 교체 |
| `text` 문구 수정 | 대본·화면 문구 변경 |
| `free` 자유 의견 | 해석이 필요한 피드백 |

저장 형식 `sections/sNN/comments.json`:
```json
{"comments":[{"id":"c12","target":"el_title","type":"effect","body":"서서히 사라지게","attachments":[],"status":"open","created":"2026-11-11T10:20:00"}]}
```

### 5-3. 직접 편집 (값으로 넘김)
사용자가 캔버스에서 바꾼 값은 해석 없이 **그대로 숫자로** `edits.json`에 저장한다. 에이전트는 이 값을 우선 적용한다.
```json
{"base_version":3,
 "elements":{
   "el_title":{"x":120,"y":160,"w":980,"h":120,
     "font":{"family":"Pretendard","weight":700,"size":76,"letterSpacing":-1,"lineHeight":1.2,"color":"#0b1f4b"},
     "in":45,"out":300,"enter":"fade-up","exit":"fade","exitDur":20}}}
```
- 단위: 좌표는 1920×1080 px, 시간은 **프레임(30fps)**. UI에는 초로 표시.
- 타이밍 바는 비트 경계·ASR 단어 onset에 **스냅**한다 (모듈1 타이밍 편집기 로직 재사용).
- 폰트 목록은 실제 파일이 있는 것만 보여준다. 검색 순서: 프로젝트 `global_assets/fonts/` → `~/Library/Fonts` → Remotion `public/fonts` → `/Library/Fonts`. 렌더 단계에서 프로젝트 폰트 폴더에 없는 폰트는 복사해 둔다.
- 요소 추가(텍스트·이미지·영상·도형)는 `edits.json`에 `_new: true`, 삭제는 `_deleted: true`로 남는다. 이미지·영상은 섹션 `attachments/`에 업로드된다.
- 텍스트 일부 강조: 문구에 `[[강조할 부분]]`, 색은 `font.accentColor`(기본 #296ef9).

### 5-4. 데이터 구동 렌더 (필수)
- Remotion 컴포넌트는 **`layout.json` + `edits.json` + `timeline.json`을 읽어 그린다.** 값을 .tsx에 하드코딩하지 않는다.
- 이유: CFO 영상에서 수치가 .tsx에 박혀 있어 값 하나 바꿀 때마다 재코딩이 필요했다. 스튜디오 편집값이 그대로 영상이 되려면 데이터 구동이어야 한다.

### 5-5. 전체 보기 — 합본 이어보기 (필수, 구현됨)
섹션 리뷰만으로는 흐름·길이·섹션 사이 연결을 판단할 수 없다. 사용자는 **스튜디오 안에서** 전체 영상을 처음부터 끝까지 볼 수 있어야 한다. 스튜디오를 새로 만들거나 고치는 에이전트는 이 화면을 빼거나 별도 플레이어·파일 경로 안내로 대체하지 않는다.

| 항목 | 동작 |
|---|---|
| 위치 | 상단 탭 `전체 보기` (`#full`), '섹션 리뷰' 바로 옆 |
| 재생 | `final/master.mp4`(없으면 `master_draft.mp4`)를 `/files/`로 서빙(Range 지원 → 탐색 가능) |
| 챕터 | 오른쪽 섹션 목록. 시작 = `final/master.json`의 실제 위치(섹션 전환으로 경계마다 n프레임 겹침; 없으면 앞 섹션 `timeline.duration` 합). 누르면 그 지점부터 재생, 재생 중 현재 섹션 강조 |
| 현재 섹션 | 플레이어 아래 "NN 제목 · 현재/전체" + **이 섹션 리뷰하기**(섹션 리뷰로 이동) |
| 미반영 표시 | 섹션별 `렌더 없음` / `편집 후 렌더 필요`(layout·timeline·edits가 최종 렌더보다 새로움) / `합본 이후 렌더됨` |
| 합본 다시 만들기 | 서버 백그라운드 작업: 렌더 없음·편집 후 렌더 필요 섹션만 최종 렌더 → `assemble.py`. 진행 단계 표시, 끝나면 보던 위치를 유지한 채 새 영상으로 교체 |

API: `GET /api/full` → `{fps,total_frames,sections:[{id,title,start,duration,changed}],file:{url,name,draft,made},job}`, `POST /api/full/build` → 작업 시작(이미 돌면 409). 구현: `studio_server.py`의 `full_info`·`start_full_build`, `app.js`의 `viewFull`.
- 섹션 수정 루프([4])가 끝나면 사용자가 '전체 보기'에서 합본을 다시 만들어 확인할 수 있다고 알린다. 에이전트가 직접 합본을 갱신했다면 그렇다고 말한다.
- 렌더는 Node.js를 쓰므로, 회사 프록시 환경에서는 스튜디오 서버를 `NODE_USE_ENV_PROXY=1`로 띄워야 Remotion 브라우저 다운로드가 된다.

---

## 6. [5] 계정 연결 가이드 (스튜디오 내)

> **계정은 사용자별이다.** 키는 그 사용자의 `~/.config/video-agents/secrets.env`, voice_id·avatar_id는 그 프로젝트의 `project.json`에만 둔다. 플러그인·스킬·저장소에 특정 사용자의 키나 ID를 넣지 않는다. 절차는 `skills/module2-strategy-video/SKILL.md` [5]~[7].

### HeyGen
- 웹사이트 로그인은 스튜디오 안에 임베드할 수 없다. 스튜디오는 **로그인 링크 + 단계 안내**를 보여주고, 사용자가 API 키와 avatar_id를 붙여넣게 한다.
- "연결 테스트" 버튼 → 로컬 서버가 HeyGen API로 아바타 조회 → 썸네일, Avatar V 지원 여부, **잔여 크레딧**을 표시.
- 아바타 새로 만들기 가이드(촬영 조건, 업로드 절차) 포함.
- 키는 `~/.config/video-agents/secrets.env`에만 저장한다. 화면에 다시 표시하지 않는다.
- API 사양은 `avatar.md`(v3 flat body, `audio/x-wav` 업로드, Avatar V 사전 체크) 그대로.

### ElevenLabs
- API 키 입력 → "연결 테스트"로 **권한 확인** (TTS, 보이스 조회·추가, Music). 2026-09에 키가 TTS 권한만 있어 보이스 목록을 못 본 사고가 있었다.
- **녹음 가이드 + 브라우저 녹음기**: 보이스 클론용 낭독 원고 제공, 조용한 환경·마이크 거리·길이 안내, 녹음 파일은 로컬 `global_assets/voice_samples/`에 저장.
- 클론 생성은 사용자 승인 후 API 업로드 또는 사이트에서 직접. 생성된 voice_id를 `project.json`에 저장.
- 클론 샘플 원고에는 실데이터를 넣지 않는다.

---

## 7. [6] 음성 — ElevenLabs 클론 보이스

> **구현됨 (2026-11-17)** — `scripts/module2/tts_voice.py` (ElevenLabs·HeyGen 공용). 절차와 피드백→조정 대응표는 SKILL.md [6]이 정본.
> - 목소리 확정: 발표자 음성 30초+ → Instant Voice Clone → **같은 문장 비교 샘플**(안정성·속도·음높이·끝처리·앞뒤맥락) → 사용자 선택 → `project.json voice`.
> - 실제 사례: HeyGen instant 보이스는 "가볍고 얄밉다" → ElevenLabs 클론(용미니4.wav 51.6초)으로 전환, 안정성 0.85·스타일 0·속도 1.0 확정. 문장 끝 처리(tail)는 비교했으나 미채택.
> - 민감 실값은 자리채움 숫자로 생성 후 글자 시각으로 그 구간만 무음 (아래 §7-3 스플라이스의 1단계. 실값 조각 생성·끼워 넣기는 아직).
> - 처음 1분만 먼저 만들고 확정 → 확장.

### 7-1. 기본
- 사용자 클론 보이스로 비트별 WAV 생성. 캐시 키 = 텍스트 + voice_id + 모델 + 설정.
- 숫자·약어 발음 정규화 후 생성 (OCIO="오씨아이오", UHNW는 "초부유층" 등 메모리 규칙).
- 생성 전 **글자 수와 예상 비용을 알리고 승인**받는다.
- 생성 후 `voice-qa`(BGM 없이 끝음·잡음·튐 검사) → 문제 비트만 재생성 → `asr_words.py`로 단어 타임스탬프.
- **문장 단위 수정 루프 (구현됨 `voice_takes.py`, 2026-11-24 사용자: "한 문장씩 만들어서, 삑사리 나는 부분만 찾아서 고칠 수 있도록")**
  1. `review` → `00-direction/문장별_듣기/`(001_s01_b1_대사.wav … + `_문장목록.txt`: 번호·나레이션 전체 mp3 기준 시각·대사)를 사용자에게 준다.
  2. 사용자가 "몇 분 몇 초"·번호로 지목 → `gen sNN:bK --n 3`(같은 문장도 생성마다 억양이 다름) → `00-direction/비교_sNN_bK.wav`(지금→새1→새2→새3, 0.9초 간격) 전달.
  3. 사용자가 고르면 `use sNN:bK 2` → 기존 보관 + words·tts.json 갱신 + 시간 다시 잡기 → (실값 무음 있으면) `splice_real.py make --only` → 설계 스크립트 재실행.
  - 삑사리(음높이 순간 튐)는 파형 자동 탐지가 오탐이 많다 → **귀로 확인이 정본**. 끝 음절이 문장 평균보다 크게(+8dB↑) 튀는 것은 잡을 수 있음(예: "감사합니다"의 '니다').
- **음량 처리**: 리미터로 누르지 말 것(HeyGen 원본 피크가 이미 0.9 이상 — 전 문장 -16.5dB + 리미터 0.84로 눌렀다가 찌그러짐 우려). 말소리 구간 -16.5dB 목표, 피크 -1.5dB 넘지 않게 **이득만** 조정 + 앞뒤 5ms 페이드(voice_takes가 자동).
- **목소리 교체 시**: 기존 audio·beats·timeline·layout 전부 `00-direction/voice_backup_<이름>/`에 백업 → 전 문장 재생성 → 음성 없는 섹션(인트로)이 0.5초로 줄었는지 확인·복원 → `audio/splice/*.masked.wav` 삭제 후 splice 재실행 → 설계 재실행 → 아바타(립싱크)는 새 음성으로 다시 만들어야 함을 알린다.

### 7-2. 사용 엔드포인트 (구현 시 공식 문서로 재확인)
- 문장 생성: text-to-speech, 가능하면 **with-timestamps**(문자 정렬 정보)로 받아 스플라이스 위치 계산에 쓴다.
- 앞뒤 문맥 연결: previous_text / next_text (마스킹본 문맥만 넣는다).
- 보이스 클론: Instant Voice Clone 추가 API.
- 음악: Music API (BGM), 효과음: sound generation.

### 7-3. 민감 단어 스플라이스 (로컬 합성)
1. **마스킹 문장 생성.** "A사의 매출은 99999원입니다"를 클론 보이스로 생성.
2. **위치 찾기.** with-timestamps 정렬 + ASR 단어 타임스탬프로 마스킹 어절의 시작·끝을 찾는다.
3. **실단어 조각 생성.** 실값 어절만(예: "삼성자산운용의") 같은 보이스·같은 설정으로 생성. 문맥 인자에는 마스킹 문장만 넣는다. 이 요청만 마스킹 게이트 허용 목록으로 통과시킨다.
4. **잘라 붙이기.** 마스킹 구간을 제로 크로싱 기준으로 잘라내고 실단어 조각을 삽입. 라우드니스 맞춤, 10~20ms equal-power 크로스페이드.
5. **검증.** 합성 결과를 로컬 ASR로 다시 받아 실값이 정확히 들리는지, voice-qa로 이음새 튐이 없는지 확인. 실패하면 조각 재생성(최대 3회) 후 사용자에게 들려준다.
6. **타이밍 재측정.** 스플라이스 후 길이가 바뀌므로 `timeline.json` 트리거를 새 words.json으로 다시 바인딩.

주의:
- **조사는 실단어 기준으로 붙는다.** "A사는"이지만 실값은 "삼성자산운용은"이다. 그래서 스플라이스 단위는 단어가 아니라 **어절(단어+조사)**로 한다.
- 숫자는 읽는 형태로 바꿔서 생성 ("4,300억 원" → "사천삼백억 원").
- 실단어 조각조차 외부로 보내면 안 되는 경우: 사용자가 스튜디오 녹음기로 해당 어절을 직접 녹음하거나, 그 문장을 화면 자막·장표로만 보여주는 대안을 제시한다.
- 산출: `sections/sNN/audio/splice/` (마스킹 원본, 조각, 합성본, 검증 리포트). 원본 마스킹 WAV는 보관.
- **구현됨 `scripts/module2/splice_real.py` (2026-11-20~24)**: `plan`(끼울 자리·읽는 형태) → `make [--only sNN:bK] [--regen]`.
  - 읽는 형태 = redaction_map 토큰 `"say"` 우선, 없으면 숫자 한자어 자동 변환(`1,234억 원`→천이백삼십사억 원, `12.5조`→십이 점 오조, `3%p`→삼 퍼센트포인트). **plan 출력으로 사용자 확인.** 실값·읽는 형태를 플러그인 코드에 적지 않는다(배포됨).
  - HeyGen: 앞뒤 **마스킹** 문장을 붙인 운반 문장으로 생성 → 글자 시각으로 실단어 구간만 잘라냄(억양 자연스러움). 게이트: 운반 문장의 실값은 그 하나뿐. ElevenLabs: previous/next_text에 마스킹본.
  - 이음새 음량 = 앞뒤 1초 말소리 RMS에 맞춤(0.4~2.5배 제한), 15ms 크로스페이드. 끝나면 `tts_voice.py --retime` + 설계 재실행.

---

## 8. [7] 인물 / [8] 음악 / [9] 렌더

### 인물 — HeyGen
- 인물 비트는 **민감 토큰 0개**여야 한다 (§3-5 게이트).
- 립싱크 오디오는 ElevenLabs 클론 WAV. 아바타 mp4는 **muted**로 쓰고 소리는 WAV 하나만 (이중 음성 방지).
- 한 씬 비트를 이어 붙인 **연속 단일 클립**으로 생성. 노출 구간 = 발화 구간, 프리즈 금지.
- 생성 전 길이·엔진·비용·**잔여 크레딧**을 알리고 승인. (CFO 영상에서 크레딧 소진으로 클로징 클립을 못 만든 사고.)
- 상세 → `avatar.md`.

### 음악 — ElevenLabs Music 또는 사용자 트랙
- 15분은 파트(서두·본론 섹션군·결론)별로 2~3곡을 쓴다 (CFO 영상 Plan A 방식).
- 생성 시 길이·분위기·BPM을 정해 요청, 루프·페이드 처리. 사이드체인 덕킹은 `assemble.md` 그대로.

### 렌더 — 구현됨 (데이터 구동)
- 컴포지션 `templates/module2/remotion/Module2Section.tsx`: layout + timeline + edits를 props로 받아 그린다. 요소 상태는 스튜디오와 **같은 anim.js**로 계산 → 미리보기와 렌더가 같은 규칙.
- `render_section.py`가 매번 플러그인 템플릿과 anim.js를 `<remotion>/codex-workspace/module2/`로 동기화하고 렌더한다. public dir = 프로젝트 폴더(이미지·영상·음성을 staticFile로 읽음). 쓰인 폰트는 프로젝트 `global_assets/fonts/`로 복사해 FontFace로 로드.
- Remotion 프로젝트의 AGENTS.md(코덱스 에이전트 공용 규칙)를 지킨다: 작업은 `codex-workspace/module2/`에만, 공용 package.json·Root 무변경. 3D 의존성도 그 폴더에만 설치(`setup_remotion.sh`).
- `--draft`: 0.5배 해상도 `render/preview.mp4`, 아직 없는 아바타·영상은 자리 표시. 기본: 최종 `render/sNN.mp4`(없는 아바타 파일은 경고). `render/render.json`에 상태·버전 기록.
- 스튜디오: 섹션 머리에 "초안 렌더" 버튼(서버가 백그라운드 렌더), 재생줄의 "보기: 미리보기 / 렌더본" 전환으로 실제 렌더 영상을 같은 시점에 겹쳐 본다. 편집 후 렌더본이 오래되면 "(편집 전 버전)" 표시.
- 실측(데모, M-시리즈 맥): 섹션 초안 2~4초, 6섹션 전체 17초. 3D 포함.
- 합본 `assemble.py`: 섹션 mp4에서 오디오를 떼고 concat(모듈1 AAC 지연 사고 회피), 비트 WAV 원본을 섹션 시작+비트 시작 위치에 배치, BGM은 사이드체인 덕킹. 시험용 소리로 오프셋 오차 1프레임 이내 확인.

### 렌더 — Remotion + 3D
- 2D 장표: 모듈1·CFO에서 쌓은 다이어그램 키트 + 데이터 구동 컴포넌트.
- **3D 기본 키트 (구현됨):** `templates/module2/remotion/three/` — `globe`(지구본 거점·연결선·회전), `bars`(입체 막대·카운트업·추이선), `layers`(층 쌓기·분해·강조). 사용법과 props는 `templates/module2/remotion/THREE_KIT.md`. 요소 `type: "3d"`, 장면 안의 `at`은 **요소 등장부터 센 프레임**. 스튜디오 장표 탭의 "+ 3D …" 버튼으로 추가하고 인스펙터에서 장면 설정(JSON)을 고친다. 쓰는 곳은 director·storyboarder가 제안하고 사용자가 고른다. 새 장면이 필요하면 키트에 승격(인라인 1회성 금지).
  - 3D 장면도 `layout.json`·`timeline.json` 값으로 구동.
  - 렌더 시간이 길어 섹션 단위로 먼저 저해상도 미리보기, 확정 후 본렌더.
  - macOS 렌더는 GL 옵션(예: `--gl=angle`)을 구현 시 검증해 기록.
- 장표 위 수치·회사명은 실값으로 렌더해도 된다 (로컬 렌더).

---

## 9. [4] 섹션 수정 루프 — 섹션별 서브에이전트

```
스튜디오에서 섹션 리뷰 → comments.json / edits.json 자동 저장 → "수정 요청 보내기"
   (서버가 history/vN 스냅샷을 만들고 studio/queue.json에 요청 등록, 상태 '수정 요청됨')
 → 사용자가 채팅으로 "수정 요청 보냈어"
 → 오케스트레이터:  studio_queue.py <p> list
                   요청마다  studio_queue.py <p> start <rid>   # 직접 편집값을 layout/timeline에 값 그대로 합치고 비움
                             studio_queue.py <p> brief <rid>   # 섹션 에이전트 지시문
                   지시문으로 Agent(general-purpose)를 섹션마다 하나씩 병렬 실행
                   각 에이전트 보고를 받아  studio_queue.py <p> done <rid> --summary "한 줄"
 → 스튜디오가 4초 안에 감지해 섹션을 'v+1 · 수정됨·확인 필요'로 새로고침
 → 사용자가 확인 → 추가 코멘트 또는 "섹션 잠금"
```
- 직접 편집값은 에이전트가 해석하지 않도록 `start`에서 기계적으로 합친다. 에이전트는 코멘트만 처리한다.
- 에이전트는 `comments.json` 각 항목에 `status`(resolved/needs_user)와 `resolution`(무엇을 몇으로 바꿨는지)을 남긴다. 스튜디오 코멘트 카드에 그대로 보인다.
- 대본 문구가 바뀌면 에이전트가 "마스킹 재적용 필요"를 보고하고, 오케스트레이터가 `redact.py scan → apply`를 다시 돌린다.

섹션 에이전트 브리프에 반드시 넣을 것:
- 섹션 폴더 경로, 현재 버전, `comments.json`(open 상태만), `edits.json`
- 지켜야 할 전역 규칙: `design-baseline.json`, 사용자 선호, 마스킹 규칙
- **수정 가능 범위: 자기 섹션 폴더뿐.** 전역 자산·다른 섹션·baseline 변경이 필요하면 직접 고치지 말고 보고한다.
- 직접 편집값(`edits.json`)은 해석하지 말고 그대로 반영. 텍스트 코멘트만 해석.
- 해석이 갈리는 코멘트(예: "올려줘"가 박스인지 글자인지)는 두 안을 미리보기로 만들어 사용자가 고르게 한다. (모듈1에서 "박스가 올라간다"를 오해한 사고.)
- 완료 시 각 코멘트를 `resolved` / `needs_user`로 표시하고 한 줄 설명.

운영 규칙:
- 동시 실행은 섹션 4~6개 정도로 제한해 비용과 충돌을 관리한다.
- 대본이 바뀌면 그 섹션은 음성 → 타이밍 → 렌더 루프를 다시 돈다. 음성 재생성은 과금이므로 묶어서 승인받는다.
- 잠긴 섹션은 사용자가 풀기 전까지 건드리지 않는다.

---

## 10. 사용자 제작 별도 영상 — 투입 규칙 (사용자 지시 대기)

> 사용자가 이 플러그인을 쓰면서 **별도 영상을 어떻게 만들어 넣으라고 할지 직접 알려주기로 했다** (2026-11-11).
> 지시를 받으면 **아래에 날짜와 함께 원문 그대로 기록**하고, 스튜디오 `replace_video` 코멘트 처리와 렌더·합본 규칙에 반영한다.

- (기록 없음)

기록 전 기본 동작: 받은 영상은 `global_assets/user_videos/`에 원본 보관, 1080p30 무음으로 전처리한 사본을 쓰고, 오디오는 사용자가 지정할 때만 살린다.

---

## 11. 구현 상태와 로컬 구축 계획

모듈2는 **로컬에서 먼저 만들고**, 동작 확인 후 플러그인에 정식 탑재한다. 아래 산출물은 `templates/module2/`와 `scripts/`에 만든다.

| 구성 | 상태 | 비고 |
|---|---|---|
| 이 문서 (module2.md) | ✅ v1 | 2026-11-11 |
| 프로젝트 초기화·섹션 골격 `scripts/module2/module2_init.py` | ✅ | 대본 md/docx/txt, pptx(노트 우선), `--demo` |
| 마스킹 `scripts/module2/redact.py` | ✅ | 정규식+사전+휴리스틱, 조사 교정, 게이트, splice-plan. 놓친 토큰은 오케스트레이터가 보탬 |
| 로컬 웹 스튜디오 `studio_server.py` + `templates/module2/studio/` | ✅ | 섹션 4레이어, 미리보기 재생, 직접 편집, 타임라인, 코멘트·첨부, 잠금·버전, 마스킹 검토, 계정 연결·녹음기·클론, 전체 보기(합본 이어보기·챕터·합본 다시 만들기, §5-5) |
| 수정 대기열 `scripts/module2/studio_queue.py` | ✅ | list/start(fold)/brief/done |
| 연출안 템플릿 `templates/module2/direction.md` + 스튜디오 '연출안' 탭·승인 | ✅ | 2026-11-16. 승인 해시, 검수 결과 표시 |
| 연출 검수 게이트 `scripts/module2/direction_check.py` | ✅ | 최종 렌더 차단(render_section 연동), `--skip-check`는 사용자 허락 시만 |
| 연출 키트 diagram 11종 + broll 자리표시 (`anim.js`, `DIRECTION_KIT.md`) | ✅ | 스튜디오·Remotion 공용 SVG |
| 렌더 의미론 `templates/module2/studio/anim.js` | ✅ | 미리보기와 Remotion이 공유할 순수 함수 |
| 데이터 구동 Remotion 섹션 컴포지션 `templates/module2/remotion/` | ✅ | anim.js 공유, 3D·영상·이미지·리치 텍스트·음성 |
| 섹션 렌더 `scripts/module2/render_section.py` + `setup_remotion.sh` | ✅ | 초안/최종/정지 화면, 스튜디오 버튼·렌더본 보기 |
| 합본 `scripts/module2/assemble.py` | ✅ | 비디오 concat + 나레이션 배치 + BGM 덕킹 |
| ElevenLabs TTS·클론·음악 `scripts/tts_elevenlabs.py` | ⬜ 미구현 | tts_typecast.py 구조 재사용 |
| 스플라이스 `scripts/splice_tokens.py` | ⬜ 미구현 | 정렬·ASR·크로스페이드·재검증 |
| HeyGen 연동 갱신 | 🔶 기존 avatar.md | 크레딧 조회 추가 필요 |
| 공용 스킬 `skills/module2-strategy-video/SKILL.md` | ✅ | 도구 중립 절차서, Codex 연결 `install_codex_skill.sh` |
| 3D 기본 키트 `templates/module2/remotion/three/` | ✅ | globe·bars·layers, THREE_KIT.md. 대륙 윤곽은 데이터 확보 후 |
| 합본·자막·타이밍 | ✅ 모듈1 재사용 | assemble.md, asr_words.py, voice_qa.py, timing editor |
| 검수 게이트 | ✅ 기존 | slide-qa, sync-qa, remotion-qa, voice-qa, final-video-qa |

알려진 한계: 카운트업은 한 텍스트 요소 안의 숫자를 전부 함께 올린다. 특정 숫자만 올리려면 요소를 나눠야 한다(데모에서 섹션 에이전트가 문장을 세 요소로 나눠 해결). 다음 버전에서 `countTarget`(강조 구간만 카운트) 옵션을 anim.js에 추가할 것.

남은 구축 순서: ① ElevenLabs TTS + 실단어 스플라이스(키 권한 필요) → ② HeyGen 생성 연결(아바타 요소 src 채우기) → ③ anim.js `countTarget` → ④ 3D 장면 확장(실제 프로젝트에서 필요해지는 대로).

검증(2026-11-11, `agent_design_new/module2-demo`, 가상 회사 데모 6섹션): 마스킹 13토큰 추출·조사 교정·인물 비트 강제 전환, 스튜디오 드래그·폰트·효과·타임라인 편집값 저장, 코멘트 → 수정 요청 → fold → 섹션 에이전트 → done → 스튜디오 갱신까지 한 바퀴. HeyGen 연결 테스트는 아바타·Avatar V·잔여 quota를 읽었고, ElevenLabs는 현재 키에 `user_read`·`voices_read` 권한이 없다고 정확히 표시했다.

---

## 12. 절대 하지 말 것

- 연출안 승인 없이 섹션 장표 만들기 / init 골격을 그대로 렌더해 영상으로 내놓기
- 모든 섹션을 생성 스크립트 하나로 같은 틀에 찍어내기
- "아바타·음성 없이"를 "연출 없이"로 해석하기
- direction_check 오류를 남긴 채 합본을 완성본으로 보고하기

- 마스킹 확정 전에 대본을 ElevenLabs·HeyGen·웹검색에 보내기
- `redaction_map.json`을 커밋·업로드·아티팩트에 포함하기
- 민감 토큰이 있는 비트를 아바타로 만들기
- 실데이터가 담긴 스토리보드·스튜디오를 외부에 게시하기
- 스튜디오 직접 편집값을 에이전트가 임의로 "보정"하기
- 섹션 에이전트가 자기 섹션 밖 파일을 수정하기
- 승인 없이 과금 호출(음성 생성, 아바타 생성, 클론, 음악)
- 값을 .tsx에 하드코딩하기
