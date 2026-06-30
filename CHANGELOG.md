# CHANGELOG

## 0.22.0 (2026-06-29)

**확정 애니메이션·디자인 요소 전부 키트에 승격 (재사용화).**

- 사용자 호평한 **대비(큰 vs 좋은) + 노드 버블 pop**(회색→색, 0.6→1.08→1 커졌다 작아짐) 등 인라인이던 양식을 재사용 컴포넌트로 승격.
- `Diagrams.tsx`에 추가: **`ContrastPair`**(A vs B 대비) · **`Banner`**(pop+shine) · **`Header`**(kicker+타이틀) · **`KeywordReveal`**(대형 글자 스태거 AX·결정·실행). akjang-11을 ContrastPair로 리팩터(화면 동일 dogfood).
- 키트 총 14개 컴포넌트. `DIAGRAM_KIT.md`에 노드 버블 모션·대비·배너·키워드리빌 레시피 추가, `expression-patterns.json`에 `contrast` 패턴 + node_highlight 버블 pop 명시.
- 원칙 재확인: **확정된 양식은 인라인 금지, 키트 컴포넌트로 승격**.


## 0.21.0 (2026-06-29)

**인포 다이어그램 키트를 플러그인에 실제 탑재 (재현 가능화).**

- **문제(감사로 발견)**: 저수지·세 곡선 수렴 같은 양식이 좋다는 피드백을 받았으나, 실제 컴포넌트 코드는 *이 프로젝트 워크스페이스에만* 있었고(플러그인엔 텍스트 참조뿐), `ConvergeCurves`는 한 슬라이드에 **인라인**(재사용 불가), `ConcentricRings`는 미구현 → 새 영상에서 재현 불가.
- **`templates/remotion/Diagrams.tsx`·`Dynamics.tsx` 탑재** — 13개 컴포넌트(Node/Connector/Icon/GhostWord/Reservoir/RollingBall/ConvergeCurves/ConcentricRings/CountUp/GrowCircle/TiltField…). 새 덱은 복사해 import.
- **`ConvergeCurves`·`ConcentricRings`를 재사용 컴포넌트로 승격**(인라인→컴포넌트), akjang-08을 ConvergeCurves로 리팩터(화면 동일).
- **`templates/remotion/DIAGRAM_KIT.md` 쿡북** — 컴포넌트 레퍼런스 + 시그니처 다이어그램 레시피(저수지/수렴/노드체인/대비/동심원/운동장/큰숫자) + 패턴↔컴포넌트 매핑. "양식은 인라인 1회성 금지, 컴포넌트로 승격" 원칙.
- `remotion.md`·`layouter.md`가 프로젝트 경로 대신 **탑재 템플릿**을 가리키도록 갱신.


## 0.20.0 (2026-06-29)

**ASR 필수화 + 표현 패턴 라이브러리 (콘티가 매 문장·핵심어 → 명명 패턴).**

- **ASR을 콘티 워크플로 필수 단계로** (`continuity.md`): supertone WAV → `sync_qa.py --asr`로 단어별 타임스탬프 → 모든 시각 트리거를 그 단어 발화 프레임에 바인딩(추정 금지) → 렌더 후 `sync-qa --asr` 재검증. `main` [5-F]도 ASR=ground truth 명시.
- **표현 패턴 라이브러리** `templates/expression-patterns.json` — 명명된 시각 장치 10종: `ghost_emphasis`(큰 강조 배경 고스트)·`node_highlight`(단어 언급 시 다이어그램 요소 점등)·`count_up`·`keyword_reveal`·`draw_on`·`metaphor_motion`(저수지/공)·`connector_draw`(함께·동시에)·`marker_point`·`underline_sweep`·`chip_in`(발화된 것만). 각 패턴 trigger=ASR 단어 프레임.
- **콘티 산출물에 매 문장·핵심어별 `{word, t_frame(ASR), pattern, target}` 필수** — "큰 강조면 배경에 '10년', 다이어그램이면 그 단어에서 하이라이트" 식으로 명시. 패턴은 계속 확장(사용자 교정도 패턴화). director가 개념별 패턴 제안.


## 0.19.0 (2026-06-29)

**sync-qa ASR 모드 — 가정 제거, 실제 음성에서 단어 타임스탬프(ground truth).**

- **사고 규명**: akjang-14에서 'AX'를 11.6초로 봤으나, 사용자는 9초에 들었다. 원인 — sync-qa의 구절↔onset 휴리스틱이 *내가 가정한 비트 텍스트*(v8 대본)에 의존했는데, **실제 TTS 내레이션이 대본과 달랐다**(실제론 b2에서 "AX입니다"를 8.9초에 발화). 가정이 틀리니 검증도 같이 틀린 순환.
- **`sync_qa.py --asr` (faster-whisper)**: 비트 WAV를 받아써 단어별 타임스탬프를 얻고, 트리거의 `word` 실제 발화 프레임과 대조. 발음치환 역매핑(AX→에이엑스). **가정 없이 실제 음성을 읽으므로 이 함정을 제거.** akjang-14 'AX'를 ASR 측정 8.9초(b2 +5.14s)에 정렬 → 0 flagged.
- 휴리스틱(무설치)은 폴백으로 유지하되 "가정 기반"임을 명시, 의심 시 ASR이 최종 심판. supertone는 실제 발화 텍스트를 `beat-N.txt`로 저장(대본≠실제 TTS 방지).
- CFO akjang-14: 로봇 채움을 "AX입니다"(8.9s)로, 발화되지 않는 칩(점유율격차·사람과AI) 제거.


## 0.18.0 (2026-06-29)

**sync-qa 단어 단위 매핑 — "특정 단어에서 하이라이트"를 잡아낸다.**

- **한계 해결**: onset 검출만으로는 "어느 onset이 'AX'인가"를 몰라, 'AX입니다' 하이라이트를 비트 시작에 잘못 붙였다(사용자 지적). → `sync_qa.py`가 **비트 텍스트를 문장부호로 프로소디 구절로 쪼개 검출 onset에 순서대로 매핑** → 대상 단어(`word`)가 든 구절의 onset을 정답으로 검증. 'AX'=구절2 → onset 349(11.6s)로 정확히 짚어 314(비트 시작) 트리거를 FLAG.
- 비트 텍스트는 `texts` 인라인 또는 `<slide>-<beat>.txt` 사이드카(supertone 저장)에서 읽음.
- 정밀도 한계 명시: 쉼 없는 문장은 비트 분할 또는 ASR(Whisper) 단어 타임스탬프로 정밀화(옵션).
- 적용: CFO akjang-14 AX 노드를 측정 'AX입니다' onset(349)에 정렬, sync-qa 0 flagged.


## 0.17.0 (2026-06-29)

**신규 `sync-qa` 에이전트 — 발화↔애니메이션 타이밍 검증 (추정 금지).**

- **문제**: 애니메이션 트리거 프레임을 "비트 안 어디쯤"으로 추정해 넣으면 발화와 어긋나도 검증 불가(akjang-14 'AX' 노드를 추정으로 frame 350에 넣은 사고).
- **`sync-qa` 에이전트 + `scripts/sync_qa.py`** (무설치): 비트 WAV의 발화 onset(쉼→발화)을 측정해, 각 애니메이션 트리거가 **측정된 비트 경계/발화 onset**에 맞는지 객관 검증. 추정(mid-beat) 타이밍은 FLAG + 측정 onset 제시 또는 비트 분할 권고. slide-qa(공간)·design-critic(취향)와 **병렬 게이트**.
- **`main`**: [5-F]를 **3중 게이트(slide-qa 공간 / sync-qa 시간 / design-critic 취향)** 로 — 모든 슬라이드·모든 사이클 필수, "사람이 봤다고 생략 금지".
- **`slide-qa`**: **화면 밖 잘림(off-canvas)** + 구도 균형 체크 추가 — 대형 고스트 타이포/큰 도형이 가장자리에서 잘리는 결함 차단.
- **타이밍은 측정해서 맞춘다**: 핵심어 동기는 비트 경계에 정렬(필요시 비트 분할). CFO akjang-14 트리거를 측정 onset(수익률 173 / AX 314 / 사람·AI·함께 404)에 재정렬, sync-qa 전부 통과. "10년" 고스트는 가운데로(off-canvas 수정), AX=로봇·수익률=% 아이콘.


## 0.16.0 (2026-06-29)

**다이어그램 우선 — "도형이 많이 나와야 한다" (역동성의 진짜 해법).**

- **진단 교정**: 영상이 정적인 1순위 원인은 모션이 아니라 **시각적 빈약함**(슬라이드에 도형이 거의 없음). 0.15에서 "애니메이션을 발화 길이에 맞춰 늘린" 것은 역효과(느린 게이지=굼뜸).
- **다이어그램 우선 원칙** (`DESIGN.md`/`layouter`/`designer`/`director`/`continuity`): 개념은 글자가 아니라 **노드·원·커넥터·아이콘·칩 다이어그램**으로. 메시지 슬라이드도 텍스트-온리 지양.
- **의미 우선 아이콘**: 청중이 1초 안에 읽는 아이콘(수익률=%, AI/AX=로봇, 성장=상승화살표, 자금=물방울). 빗나간/추상 메타포 금지.
- **단어 단위 싱크**: 다이어그램 요소는 beat 시작이 아니라 **그 개념 단어가 실제 발화되는 프레임**에 등장.
- **강조 고스트 타이포**: 결정타 숫자/단어를 콘텐츠 뒤·옆 대형 옅은 타이포로 한 번 더(발화 순간, 슬라이드당 1회).
- **"느린 단일 트윈" 금지**: 역동성은 "느린 한 개"가 아니라 "빠른 여러 개". 8초 게이지 크롤 폐기 → 도형 빠른 pop(≤0.7s) 연달아. `taste-rubric.json` anti-pattern 추가(`sparse_text_slide`/`slow_single_tween`/`metaphor_not_drawn`/`wrong_icon`/`emphasis_no_ghost`).
- **Remotion 다이어그램 키트** `Diagrams.tsx`(Node/Connector/Icon/Reservoir/RollingBall/GhostWord) — `remotion.md`에 참조. CFO 영상 히어로 3개(두 근육=두 원 다이어그램 / 운동장=구르는 공+좁아짐 / 저수지=물 차오름)에 적용.


## 0.15.0 (2026-06-29)

**역동성(정적 슬라이드 방지) + 슈퍼톤 끝음 QA.**

- **모션 2종 분리 (정적 슬라이드 근본 해결)**: 기존 "≤1.5초 후 hold"를 **리빌 모션**(등장 — 여전히 ≤1.5초 후 hold)과 **의미화 모션**(숫자 카운트업·원/막대 성장·게이지·곡선 draw — *발화 비트 길이에 맞춰 전개*, 수치 발화 순간 정착)으로 분리. 긴 내레이션(>8초) 위 정적 슬라이드 금지. `continuity`/`remotion`/`layouter`/`director`/`design-critic`/`DESIGN.md`/`taste-rubric.json`에 박음.
- **Remotion 공용 컴포넌트 `Dynamics.tsx`**: `CountUp`(카운트업+pop), `GrowCircle`(면적∝값 성장 원+중앙 카운트업), `TiltField`("기울어진 운동장" 메타포 — 바닥이 기울고 공이 낮은 쪽으로 굴러내림). CFO 영상 악장 6(432조→501조 + 운동장)·7(40%/13조달러 카운트업)·16(OCIO 플로우 분산 등장)에 첫 적용.
- **메타포 비주얼 = director 비트별 판정(혼합)**: 결정타·감정 고조는 b-roll(플레이스홀더 슬롯), 보조·개념은 아이콘/일러스트 모션, 약하면 절제.
- **슈퍼톤 끝음 QA — `scripts/voice_qa.py` (무설치)**: ffmpeg + Python 표준 라이브러리(자기상관 F0 + RMS)로 문장 끝 `rising`(끝음 올라감)·`limp`(맥아리 없음) 자동 감지 + **문장별 곡선 SVG**(곡률 육안 확인). F0 옥타브 오류 보정, `limp`은 화자 코퍼스 상대 판정. 임계값 템플릿 `templates/voice-qa-rubric.json`.
- **supertone 끝음 QA 루프**: 생성 후 voice_qa → flag된 beat 자동 재생성(시도1 문장부호 보정, 시도2 speed/무음 후처리, 최대 2회) → 실패 시 곡선 SVG와 함께 AskUserQuestion으로 escalate. QA 미통과 음성은 다음 단계로 못 넘김.


## 0.14.0 (2026-06-26)

**최종 합본 = Remotion 마스터 컴포지터(기본). Premiere는 선택 폴리시.**

- **remotion `MasterDeck`**: 아바타+장표+b-roll 세그먼트 mp4를 한 타임라인에 컷으로 올리고 BGM 덕킹 → 최종 mp4 한 방 렌더. 끝까지 자동·재현 100%. 세그먼트 1개 변경 시 그것만 재렌더 후 마스터 재합성.
- **premiere/main**: 기본 합체는 Remotion 마스터, Premiere(EDL/XML 핸드오프)는 사람 손 폴리시용 선택지로 명시.


## 0.13.1 (2026-06-26)

**b-roll = 플레이스홀더 카드 → 나중 교체 워크플로.**

- **director/remotion/video-source**: b-roll 비트는 처음엔 **흰 화면 + 가운데 `[영상] <묘사>`** 플레이스홀더(fade in→hold→out, "살짝 넣었다 빼기")로 렌더 → 영상 없이도 전체 완성. 나중에 업로드/Pexels로 채우면 `broll_slots.json` `status: filled` → 같은 자리 OffthreadVideo로 스왑 재렌더. 슬롯·묘사("낮의 여의도 건물 영상", "시계 똑딱이는 영상")는 director가 정함, video-source가 채움.

## 0.13.0 (2026-06-26)

**신규 에이전트 `director`(연출/PD) — 절제 우선 연출 의도 + 레퍼런스 주도.**

- **director 추가**: 영상 전체의 연출 의도 설계(비트별 장치+왜, 호흡·에너지 곡선, 톤 일관). **절제 우선** — b-roll·장식은 내러티브가 요구할 때만(간지 자동 금지). 사용자가 좋아하는 **레퍼런스 연출/영상을 주면 분석(reference_style)해 그 문법으로 플랜·소스 매칭**. design-critic(사후 미감)과 달리 사전 창작 판단, storyboarder 위에서 의도 제공.
- **direction-rubric 시드** `templates/direction-rubric.json` — restraint_first, broll_default_off, broll_if_used(동적·스크림 강제 금지), one_director_feel 등.
- **main [6-0] 연출** 단계 추가(storyboarder 앞). 에이전트 수 16→17.

## 0.12.1 (2026-06-26)

**b-roll 기본 미사용 — 간지/배경에 자동으로 깔지 않음.**

- **storyboarder/video-source**: b-roll/배경영상은 기본 미사용. 간지·표지·키워드·배경에 기계적으로 깔지 말 것(기본 = 깨끗한 파란/화이트 면, 사용자 피드백). 사용 여부·위치·톤(스크림 유무 등)은 **연출(director) 판단**, 명시 요청 시에만 video-source 호출. (Pexels 연동은 도구로 유지.)

## 0.12.0 (2026-06-26)

**b-roll 자동 소스 — Pexels(검색 API + 직접 다운로드).**

- **video-source**: Pexels를 **기본 자동 소스**로 추가 — 검색→다운→합성까지 에이전트 자동(사용자 업로드 불필요). 무료 상업 라이선스. `PEXELS_API_KEY` 사용, `api.pexels.com/videos/search`. Envato Elements는 프리미엄 수동 fallback으로 유지.
- secrets 템플릿에 `PEXELS_API_KEY` 추가.

## 0.11.2 (2026-06-26)

**b-roll 소스 정정 — Envato Elements(app.envato.com).**

- **video-source**: 레퍼런스 소스를 **Envato Elements**(`app.envato.com`/`elements.envato.com`, 구독형)로 고정. videohive(Envato Market, 건당 구매) 및 Market API(`api.envato.com`) 사용 금지. Elements는 공개 검색 API 없음 → `elements.envato.com/stock-video?terms=...` **검색 URL을 제시**하고 사용자가 favorite/다운로드/업로드.

## 0.11.1 (2026-06-26)

**중간 악장 끝 대기 단축(1.5초) + b-roll 배경 적용 패턴.**

- **끝 대기(trailing hold)**: 중간 악장/슬라이드는 마지막 콘텐츠·오디오 후 **~1.5초(45f)** 만. **5초(150f) end-hold는 영상 전체 마지막 슬라이드에만.** designer baseline(`inter_slide_hold_frames:45`)·continuity·remotion·DESIGN. design-critic 루브릭에 `long_dead_hold`·`slow_term` 추가.
- **b-roll 배경 패턴**(video-source/storyboarder): 표지·엔딩·간지/전환·키워드·감성 모먼트에만, **데이터 슬라이드 금지**. 치료 = 블루 스크림(온브랜드). storyboarder가 `background_video` 큐로 지정.

## 0.11.0 (2026-06-26)

**신규 에이전트 `design-critic` — 취향·미감 자문(학습형).**

- **design-critic 추가**: slide-qa(객관 결함 게이트)와 분리된 취향 비평가. 안착 프레임을 시니어 디자이너 시선으로 비평 → 군더더기 라벨·referent 어긋남(역전≠교차점)·밋밋한 배너·작게 흘린 결정타 등 "취향 냄새"를 순위 제안(차단 아닌 자문). 사용자 채택/기각이 `design/taste-rubric.json`에 학습되어 사용자 취향에 수렴.
- **취향 루브릭 시드** `templates/taste-rubric.json` — 이번 세션 피드백서 도출한 10개 안티패턴(clutter_label, marker_off_referent, text_dump, small_punchline, flat_banner, slide_logo, chart_misalign, heavy_or_sentence, idle_or_over, off_brand).
- **main [5-F]**: slide-qa(객관 게이트) + design-critic(취향 자문) 2단 검수로 확장. 렌더 전 프리뷰에서 먼저 돌려 싸게 거름.
- 에이전트 수 15→16.

## 0.10.1 (2026-06-26)

**미적 검수 — 군더더기 라벨 금지 · 주석/마커 referent 정확.**

- **군더더기 설명 라벨 금지**(layouter/slide-qa): "오늘 함께 볼 곡선, 셋" 류 회색 중간 안내문/메타 라벨 제거 — 화면을 설명하지 말 것.
- **주석·마커는 referent에 정확히**(layouter/slide-qa): "역전" 점=곡선 교차점, 태그=해당 막대. 대충 근처 금지.
- slide-qa 체크리스트에 위 2개 미적 항목 추가.

## 0.10.0 (2026-06-26)

**대형 키워드 reveal · 배너 pop+shine · 좌상단 로고 슬라이드 미렌더.**

- **대형 강조 reveal (storyboarder/layouter/continuity/DESIGN)**: 결정타 키워드(예: "AX", 핵심 수치)는 표·콘텐츠를 비우고 **화면 가득 대형 텍스트 + 글자 스태거**(A→X)로. 작은 캡션 금지. 전용 beat로 분리.
- **하단 배너 pop + shine**: 단순 페이드 → scale pop(0.92→1.06→1.0) + 흰 shine 스윕 1회.
- **좌상단 로고**: Remotion 슬라이드에 직접 렌더 금지 → `top_left` 비우고 Premiere 전역 오버레이. (v0.6.4 '슬라이드 텍스트 워드마크 폴백' 정정.)

## 0.9.0 (2026-06-26)

**비트 단위 점진 노출 + 음성→리모션 재타이밍 루프 + avatar_v 버그 수정.**

- **핵심 원칙(continuity/remotion/storyboarder/writer/main)**: "한 화면에 여러 문장 덤프 금지". 한 슬라이드 안에서도 대사 한 비트마다 요소가 하나씩 등장/하이라이트. 3개면 3 오브젝트 순차, 표는 발화 행마다 하이라이트 이동, 간지어엔 간지 떴다 사라짐. 순차 등장 요소는 writer가 beat로 쪼갬.
- **음성→리모션 재타이밍 루프**: 비트 싱크는 실제 SuperTone WAV 실측 후에야 정확 → 장표→음성→continuity realization→Remotion 재렌더. 음성/대사 변경 시 그 슬라이드는 루프 재진입.
- **avatar.md 버그 수정**: Avatar V 사전체크가 `.supported_api_engines`(잘못)→`.data.supported_api_engines`. 이 버그로 V 지원 아바타가 IV로 잘못 폴백했음.

## 0.8.0 (2026-06-26)

**기획 깊이 상향 — 비유의 시각화·데이터 성실성·b-roll 매칭·비트 모션 (6개 에이전트).**

- **storyboarder**: "비유의 시각화" 원칙 — 콘셉트도 전용 다이어그램 자체 발상(다중곡선 성장모형·역전·도태), 비교는 표/다이어그램, 모든 슬라이드에 비주얼, 비유에 맞는 b-roll 쿼리, 화면 비노출 논점은 메모리.
- **video-source**: b-roll을 비유에 1:1 매칭("벽 넘기"=등산 ✕), 엔바토 favorite → 사용자 다운/업로드 요청(UI) → 폴더 정리 워크플로.
- **researcher / layouter / main**: 빈 `[TBD]` 금지 — 공개 데이터는 실제 조사, 내부·비공개는 근사치 + 빨간 `(*) TBD 수정 필요`.
- **layouter**: `gauge`(2단 13%→20%)·`multi_curve`(역전/도태)·`compare_table` 컴포넌트 추가.
- **continuity**: 데이터·논점을 모션으로 의미화(게이지 2단·곡선 lift·역전 추월, 각 ≤1.5초).
- **main**: [5-D]에 빈 TBD 금지 + 화면 비노출 논점 memory 저장.

## 0.7.0 (2026-06-26)

**신규 에이전트 `slide-qa` — 장표 검수(스크린샷 기반).**

- **slide-qa 추가**: 렌더/프리뷰된 장표를 **스크린샷으로 추출(ffmpeg end-hold 프레임)해 픽셀을 직접 판독** → 정렬·겹침(덮침)·잘림·안전영역·HP 규칙(색/weight/radius/배너/문장형 금지) 위반 점검. 결함은 `qa_report.yaml`에 `type·element·fix_for(layouter/remotion)·fix`로 구조화, high severity 0건이어야 통과. "좌표 믿지 말고 픽셀 봐라."
- **main**: [5-F] 장표 검수 단계 + 파이프라인 등록(slide-qa 2회 — layouter 프리뷰 직후 + remotion 렌더 직후). plugin/marketplace 에이전트 수 14→15.

## 0.6.5 (2026-06-26)

**차트 정렬 규율 — 막대 바닥선·라벨·주석 태그 정렬.**

- **layouter**: 막대는 키가 달라도 **공통 베이스라인(바닥 0)에 한 줄 정렬**(center로 펼쳐 바닥 어긋남 금지, 베이스라인 헤어라인 권장). 데이터 라벨은 막대 폭·간격에 맞춰 아래 한 줄. **주석 태그(역대 최고 등)는 해당 막대 위 중앙 정렬**(한쪽 overhang 금지). 꺾은선/마커도 점·선에 정확히 물리게.

## 0.6.4 (2026-06-26)

**로고 폴백 = 파란 텍스트 워드마크 · 차트 y축(수직) 중앙 정렬.**

- **main [1].5**: 로고 미제공 시 **기본 폴백 = 회사명 파란색(#024ad8) 텍스트 워드마크**(빈칸 금지). 상태확인 단계에서 UI로 요청.
- **차트 수직 중앙 정렬 규칙** (DESIGN.md 영상 + designer baseline composition + layouter): 차트/그래프/표는 x축뿐 아니라 **y축(수직)도 중앙** — 헤더~배너 사이 콘텐츠 존의 세로 가운데. 차트가 위로 붙어 **타이틀 침범**하거나 배너와 겹치는 것 금지.

## 0.6.3 (2026-06-26)

**회사 로고 — 에이전트가 직접 업로드 요청.**

- **main [1].5 신규**: 좌상단 상시 노출 로고를 **AskUserQuestion으로 요청**(`로고 업로드 / 텍스트 워드마크 / 나중에`). 로고는 임의 생성 금지(브랜드 자산), 받기 전 top_left 비움, 받으면 `global_assets/` + baseline `premiere_overlays.logo`에 기록. 평문 "로고 주세요" 금지.

## 0.6.2 (2026-06-26)

**단계 전환 확인 질문도 AskUserQuestion UI 강제.**

- **main 0순위 규칙 보강**: "다음 단계로 갈까요?", "다음 스텝으로 넘어갈까요?", "이 버전으로 확정할까요?" 같은 진행/확정 확인 질문도 **평문 금지 → AskUserQuestion**. 마땅한 선택지가 없어도 평문으로 묻지 말고 `다음 단계로 진행 / 더 다듬기 / 기타(Other 입력)` 형태의 UI로. main [5]·writer 전환 프롬프트에 "AskUserQuestion UI로(평문 금지)" 명시.

## 0.6.1 (2026-06-26)

**데이터 슬라이드 플로우 명시화 — 자료수집 → 스크립트 재작성 → 사용자 재전달.**

- **main [5-E-1] 신규**: 데이터 슬라이드에 조사 데이터를 넣기로 하면, 메인이 사용자에게 "데이터를 먼저 조사하고 그에 맞춰 스크립트를 다시 써서 다시 보여드리겠습니다"라고 **명시적으로 안내**. 순서(researcher 자료수집+출처/검증 → 차트 스펙 → writer 재작성 v+1 → **사용자 재전달·컨펌**) 못박음. 자료수집이 스크립트보다 늦게 트리거돼도 반드시 재작성·재전달.
- **writer**: 그래프 내레이션 재작성본(v+1)이 메인을 통해 사용자에게 다시 전달·컨펌됨을 명시. 데이터 근거 변경 시 해당 구간 대본 갱신 의무(옛 수치 잔존 금지).

## 0.6.0 (2026-06-26)

**디자인 정본 전면 교체 — HP 디자인 언어 채택 (사용자 명시 승인).** 폰트는 Pretendard 유지.

- **신규 정본 `DESIGN.md`**: HP 디자인 언어 — 화이트 + HP Electric Blue `#024ad8` + near-black ink `#1a1a1a`, 셰브론 모티프, 2-tier radius(카드 16px / 버튼 4px), Soft Lift 그림자. 기존 화이트+블루(`#1167e8`)/IBM 정본 폐기.
- **시스템 오버라이드(영상용)**: ① 히어로/디스플레이 weight 500 → **600**, 임팩트 헤드라인·핵심수치 **700**까지(800/900 금지). ② 다크 배경 폐기 → **화이트 / 블루 풀블리드 2면**.
- **영상 레이아웃·모션 규칙**: 중앙축 3단(상단 타이틀 → 중앙 콘텐츠 → **하단 블루 배너** 페이드인) · 양옆 구도 순차 안무(가운데 등장 → 좌측 이동 + 우측 페이드인) · 모든 애니메이션 **≤1.5초 완결 후 hold** · **idle 정지**(둥둥/ambient 금지) · 트리거 **내레이션 비트 동기** · 슬라이드 **컷**.
- **카피**: **내레이션 자막 없음**, 장표 텍스트 **문장형(`~다`)·중타이틀 금지** (타이틀/키워드/숫자/라벨/체언 종결만).
- **designer**: 0순위 가드레일 HP 기준 재작성, baseline 기본값(colors/typography/rounded/motion/copy_rules) HP로 교체 + 웹→영상 번역 맵.
- **continuity / storyboarder / layouter / remotion**: 영상 모션·레이아웃·카피 규칙 전파. 옛 팔레트·gradient·VIDEO_TEMPLATE 소스 참조 정리.

## 0.5.7 (2026-06-25)

- **writer**: 그래프 내레이션 규칙 정정 — "지시어(이 그래프를 보십시오/여기를 보면) 금지". 그래프가 그려지는 동안 화면 변화를 **자연스러운 평서문으로 묘사**(애니메이션과 1:1 싱크). 예: 아이콘 100→1,000 ↔ "인구는 100명에서 1,000명으로 증가하였습니다." 원칙: "보라고 말하지 말고, 보이는 것을 말하라."

## 0.5.6 (2026-06-25)

데이터 슬라이드 "차트 먼저, 그래프 설명 대본 나중" — 그래프 워크스루.

- **main [5-E]**: 데이터 슬라이드는 researcher 데이터 → 차트 스펙(종류·축·강조점) → writer 그래프 설명 대본 순서로 뒤집기. 완성 렌더 전, 스펙만 먼저. 일반 슬라이드는 기존 순서.
- **writer**: "그래프 워크스루" 규칙 — 데이터 슬라이드는 수치 나열 금지, 시각물을 시선 유도+요소 지칭(축/구간/막대/기울기/하이라이트)으로 함께 읽고 takeaway로 닫기. 비주얼 큐와 지칭 타이밍 동기화.
- **researcher**: 각 dataset에 `takeaway`(강조점 한 줄)+`highlight` 힌트 필수 → writer가 가리키며 설명.

## 0.5.5 (2026-06-25)

- **writer**: "창작 원칙" 추가 — 참고 자료(예시 대본·기존 발표)를 답습/풀어쓰기 금지. 새 중심 콘셉트(organizing conceit) 수립, 오프닝·비유·마무리 신규 창작, 답습 자기점검, 창의 강도 게이트(콘셉트 후보 제시). 실데이터·서사 엔진 기법은 유지. 원칙: "참고 자료는 '무엇을 말할지'의 출처일 뿐, '어떻게 말할지'는 새로 짓는다." (v2 답습 → v3 '두 번째 곡선' 창작 사례에서 도출)

## 0.5.4 (2026-06-25)

- **writer**: "서사 엔진" 추가 — 실제 전략회의 발표 정밀 분석 기반. 9악장 스캐폴드 + 7기법(메타프레이밍/리캡 에토스/키워드 미니 3막/예고-회수/다층 수미상관/숫자 닻/호흡 메타) + 문장·수사 사전 + 감정 곡선 설계. "장표 narration이 아니라 연설을 쓴다" 원칙.

## 0.5.3 (2026-06-25)

데이터 슬라이드 처리 규칙(사용자 확정) + 실제 영상 차트 카탈로그 반영.

- **main**: [5-D] 표·그래프·다이어그램 데이터 게이트 — 어떤 슬라이드에 무엇을 넣을지 **사용자에게 먼저 묻고**(조사해서 넣을지), OK 시 조사 데이터는 빨간 `(*) 검증 or 대체 필요` 플래그로 표시.
- **researcher**: 메인 승인 슬라이드만 보강. 조사 데이터는 `status: researched_unverified` + `verify_flag: true` 표시 의무.
- **layouter**: 조사 미확정 데이터 곁에 빨간(#ff6b6b) `(*) 검증 or 대체 필요`(`type: verify_flag`) 렌더. 실제 영상 차트 카탈로그(묶은막대+데이터라벨/라인+음영/KPI표 하이라이트행/스탯콜아웃/포디움/허브-스포크/플로우/서클/카드) 근거 보강.

## 0.5.2 (2026-06-25)

CFO 프로젝트 사이클 1 + 사용자 자작 영상/스크립트 비교 분석 기반 4개 에이전트 강화.

- **designer**: 0순위 가드레일 — 정본 = 화이트+블루+네이비. 배경/메인색 다크·커스텀 전환은 MAJOR 디버전스로, 메인 지시만으로 따르지 말고 AskUserQuestion으로 사용자 직접 확인. divergence_note 기록 의무. ("너무 남색" 지적 재발 방지)
- **avatar**: "아바타 노출 구간 = 발화 구간, 프리즈 금지" 규칙. 슬라이드가 클립보다 길면 노출종료/beat추가/idle루프 택1. 풀스크린 브랜드배경 풀바디 합성 패턴 명시.
- **writer**: 전략회의 발표 톤·구성 가이드 — 따뜻·개인적·유머 페르소나, 연도별 리캡, 데이터 촘촘, 부문별 피드백, 핵심가치 회수, 감성 마무리 + 표준 구조 템플릿.
- **researcher**: 데이터 보강 모드 — 방향만 있고 수치 빈약 시 공시·IR·통계·기사 웹서치로 차트용 정형 데이터(datasets: bar/line/kpi_table/stat_callout/flow/podium) 생성.
- **layouter**: 데이터 시각화 컴포넌트 카탈로그 — 막대(데이터라벨)/라인(음영)/KPI표(하이라이트행)/스탯콜아웃/플로우/카드. placeholder 남발 금지, 실데이터로 채움.

## 0.5.1 (2026-06-25)

2026 CFO 전사경영전략 프로젝트 사이클 1 피드백 반영.

- **supertone**: 디폴트 `voice_settings.speed` 0.95 → **1.05**. 격식체 발표에서 0.95 이하는 "너무 느리다"는 피드백이 반복되어 기본값 상향. secrets.env.template·INTERACTION_PATTERNS 예시 속도도 1.05 기준(느리게 0.95 / 빠르게 1.15)으로 정정.

## 0.5.0 (2026-06-25)

2026 ETF 경영전략회의 보고자료 프로젝트 사이클 1에서 검증된 패턴 영구화.

- **supertone**: Studio voice ≠ API voice 분리 명시. `/v1/custom-voices/cloned-voice` 자동 등록 흐름 (audio file → voice_id → secrets.env 라인 단위 자동 교체)
- **supertone**: 모델 `sona_speech_2` + 실재 파라미터(`voice_settings.speed=0.95`)로 정정. 잘못된 `speed_per_word`/`pause_after_sentence` 제거 (Supertone API에 존재하지 않는 파라미터)
- **supertone**: TTS 호출 전 영문 약어 한글 발음 자동 치환 (PRONUNCIATION_RULES.md)
- **avatar**: HeyGen v3 API 전환 (`/v3/videos`, flat body, top-level `engine`, `aspect_ratio`+`resolution` enum)
- **avatar**: Avatar V 디폴트 + `GET /v3/avatars/looks/{look_id}` `supported_api_engines` 사전 체크로 비용 낭비 방지
- **avatar**: WAV 업로드 시 `Content-Type: audio/x-wav` 필수 (audio/wav는 400)
- **secrets.env.template**: `PREMIERE_PRO_PATH` 따옴표 fix (띄어쓰기로 인한 source 에러 해결), `# REQUIRED` 주석 추가, API에 없는 SUPERTONE_DEFAULT_* 항목 TODO 처리
- **신규 PRONUNCIATION_RULES.md**: 한국어 TTS 영문 약어 발음 룰 정책 (KODEX→코덱스 외 11종)
- **신규 templates/pronunciation-rules.json.template**: 기본 12개 룰 JSON 템플릿

## 0.4.0

- AskUserQuestion 도입, 경영전략 보고영상 10단계 플로우 프로토콜

## 0.1.0

- 초기 14개 에이전트 시스템 + cycle manager
