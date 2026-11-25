## 0.40.0 — 2026-11-25
- **다른 사람이 설치해도 같은 방식으로**: 2027 전략회의 프로젝트에서만 쓰던 도구를 플러그인으로 옮김.
  - 설계 키트 템플릿 `templates/module2/design/kit.py`·`README.md` — module2_init이 프로젝트 `design/`에 복사. 섹션 설계 스크립트(sections_*.py·scenes_*.py) 방식과 사용자 확정 연출 규칙(명사형 타이틀·강조 1회·번짐 금지·흔들림 금지·가운데 시선·실사 위 흰 마일스톤). 전략 카드판 항목은 프로젝트 `design/strategies.json`.
  - `scripts/module2/splice_real.py <project> plan|make` — 민감 실값 조각 끼우기(HeyGen 운반 문장 / ElevenLabs 문맥). 읽는 형태는 토큰 `say` 또는 숫자 한자어 자동 변환(실값을 코드에 두지 않음).
  - `scripts/module2/voice_takes.py <project> review|gen|use` — 문장별 듣기 폴더(번호·시각 목록), 한 문장만 여러 번 새로 만들어 비교 파일, 골라 교체(기존 보관·시간 다시 잡기). 생성본은 리미터 없이 이득만 + 앞뒤 5ms 페이드.
- 문서: module2.md 빠른 시작·§4-0-0c 설계 스크립트·§7 문장 단위 수정 루프·음량 규칙·목소리 교체 절차·§7-3 구현, SKILL.md 6-3.

## 0.39.6 — 2026-11-20
- `cards3d`: `zoomTo{index,at,dur,scale}`(그 카드가 가운데로 오며 커지고 나머지 사라짐), 카드별 `front`·`backNum`, 부제 단어 하이라이트 `hl[{text,at}]`(sweep), `pop:false`, 여러 줄 글자는 가장 긴 줄 기준 맞춤.
- `nodes.orb`: 입체 구슬(그러데이션·반사광·바닥 그림자) + 흰 아이콘. 새 아이콘 `lock`·`book`.
- `stackBuild.center`: 블록 `money:true`(양옆에서 지폐가 날아 들어옴), `flag:true`(지도 우측 상단 성조기 원).
- 새 부품 `passArrow`: 굵은 화살표가 왼→오로 지나감.
- 프로젝트 kit `seven_board`/`with_seven`: 챕터 간지 대신 7개 전략 카드판(지난 전략 앞면, 이번 전략은 이름이 들릴 때 뒤집혀 가운데로 확대).

## 0.39.5 — 2026-11-20
- **확대 효과 정리(사용자: "확대 두 번 되는 효과 다 없애라")**: 테마 `beatAccent.enabled` 기본 false(템플릿 theme.json도). `nodes`는 기본 페이드 등장(톡 커짐은 `pop:true`). 하이라이트 `shine`·`glow`의 파란 번짐 제거.
- `panels3.still`: 튀어 오르지 않고 딱 나온 뒤 멈춤(위아래 흔들림·아이콘 움직임 없음).
- `stackBuild.center`: 첫 블록이 화면 가운데 높이, 다음 블록은 위에서 내려와 얹히며 더미가 한 칸씩 내려가 새 블록이 늘 가운데. 지도 등장 때 더미가 아래로 빠지고 미국 지도가 가운데(`cy`).
- 스튜디오 섹션 리뷰: 재생 줄에 **'다음 섹션 자동'** 체크(브라우저에 기억) — 섹션이 끝나면 다음 섹션을 열어 처음부터 이어서 재생.
- `bars.annotate` 기본 = 증가 점선(앞 막대 높이 점선 + 늘어난 부분 점선 상자 + 옆에 증가율). 예전 빨간 화살표는 `style:"arrow"`.
- 에이전트·스킬 문서: **모든 타이틀은 명사형**, 강조·확대는 한 번, 번짐 금지, 구어체 군말 금지 명시.

## 0.39.4 — 2026-11-20
- **자동 강조(beatAccent) 한 요소 한 번만**: 문장 시작·4초마다 같은 그래프가 두 번 올라가고 두 번 커지던 문제(사용자: "한번 강조하면 한번만, 애니메이션을 몇 번 쓰면 어색"). 수동 강조가 있거나 자동 강조를 한 번 받은 요소는 다시 안 고름(`beatAccent.once:false`면 예전처럼). 그래프류(line·bars·bars3d·rings·stackBuild·stat)는 자동 강조 대상 제외.
- 마일스톤 바: 어두운 화면(전체화면 실사·아바타·배경 사진·파란 간지·남색 덮개) 구간에서는 선·점·글자 모두 흰색, 글자 테두리 없음. assemble이 섹션 layout/timeline에서 구간(`dark`)을 계산해 넘긴다.
- `nodes` `pop:false`(노드가 톡 커지지 않고 페이드) + 강조 `zoom{amount}`(큰 묶음도 줄이지 않고 한 번 확대) — "다 나온 뒤 한 번만 확대".
- 글자 하이라이트 효과 `sweep`: 처음부터 강조색, 말하는 순간(at) 흰 빛줄기가 왼→오로 한 번 훑음. `kit.hl(..., effect="sweep")`.
- `nodes` 노드 `grow{at,steps:3,to,every,dur}`: 톡·톡·톡 단계 확대 후 그 크기로 머묾(연결선 끝도 따라감).
- 민감 실값 스플라이스(프로젝트 스크립트 `splice_real.py`, module2.md §7-3 구현 시안): 무음 구간에 실단어 조각(읽는 형태, 문맥 인자는 마스킹본만)을 끼우고 앞뒤 1초 말소리에 음량 맞춤 → words.json에 실단어 추가 → `--retime` → 디자인 재실행.

## 0.39.3 — 2026-11-20
- **색 규격 통일 (BT.709·tv 범위)**: Remotion 기본 렌더는 JPEG 프레임 → `yuvj420p`·BT.601·pc 범위라, 원본 영상(BT.709·tv)·스튜디오 미리보기와 합본의 사람 피부색·대비가 달라 보였다(사용자: "합본 용미니와 섹션 용미니 색조가 다르다").
  - render_section·전환 조각: `--image-format=png --pixel-format=yuv420p --color-space=bt709 --crf=16`
  - assemble: 이어 붙이기·마일스톤 겹치기 모두 BT.709·tv로 변환·태그(`-colorspace/-color_primaries/-color_trc bt709 -color_range tv`), 마일스톤 바(RGBA)도 BT.709로 변환 후 겹침. 인코딩 veryfast·crf18 → medium·crf15.
  - 전환 조각 캐시 키에 색 규격 포함(예전 조각 재사용 방지). 기존 프로젝트는 섹션을 다시 렌더해야 적용된다.

## 0.39.2 — 2026-11-20
- assemble: BGM 앞부분만 깔기 `bgm.until`(섹션 id — 그 섹션 시작에서 끝) / `bgm.end_sec` + `bgm.fade_out`. 덕킹 세기 `bgm.duck_ratio`(기본 8 — 목소리 밑 음악이 -33dB까지 내려가 사실상 안 들림. 2면 약 -20dB로 계속 들림, volume 0.4와 함께 권장).
- avatar: HeyGen 웹 25fps → 30fps는 minterpolate로 중간 프레임 생성(프레임 반복으로 사람 움직임이 끊기던 문제).

## 0.39.1 — 2026-11-20
- **avatar 에이전트**: HeyGen v1·v2 종료(2026-10-31) 반영 — 업로드 `POST /v3/assets`(multipart `file`, 응답 `data.asset_id`), 상태 `GET /v3/videos/{id}`(pending·processing·completed·failed, `failure_code`). v1 업로드는 HTTP 500 `40099`.
- avatar: 음성은 섹션 하나 = 연속 WAV 하나(timeline audio를 섹션 길이 그대로 합침) → 아바타 길이 = 섹션 길이.
- avatar: `MOVIO_PAYMENT_INSUFFICIENT_CREDIT`(API 크레딧 없음, 웹 크레딧과 별개) → 재시도 금지, **HeyGen 웹에서 직접 만들기 순서 가이드** 작성 + 받은 mp4 가져오기(길이 1초 넘게 다르면 거부, 1920×1080·30fps·무음으로 맞춤).

## 0.39.0 — 2026-11-19
- 새 부품 `wordSwarm`(한 단어 100개 폭증 + 휘는 카메라 비행) · `horizon`(단어→경계선→넘어서 지평선·노란 태양·캡션) · `globe`(정사영 3D 지구: 다가오며 회전, 한반도, 파란 대권 화살표; 육지 데이터 `land` 또는 내장 거친 윤곽) · `orgChart`(선이 그려지는 조직도 + 지정 부서 파란색).
- `bars3d`: 증가분 입체 `add`, 숫자 시점 `valueAt/valueDur`.
- `cards3d`: 기본 `mode:"fold"`(정면 3등분, 양옆만 살짝 꺾인 병풍 — 가로선 평행). 예전 기울기 = `mode:"tilt"`.
- 색 `purple` 추가(테마·KIT_COLORS).
- `sync=False` 요소는 발음 맞춤·word_sync 검사 제외.
- 디자인 키트 썸네일 데모: wordSwarm·horizon·globe·orgChart, bars3d(증가분).

## 0.38.0 — 2026-11-19
- 3D 부품 `bars3d`(정면 2D → 쿼터뷰 3D 카메라 전환 → 막대 입체·솟음, annotate) · `cards3d`(3D로 기울며 카드 차례로 뒤집기, 카드별 flipAt, settle). CSS 3D(HTML_KINDS)라 스튜디오 미리보기 = 렌더. 키트 params rx·ry·zoom·depth·perspective.
- 디자인 키트 탭: 부품 썸네일 클릭 → 움직임 재생(▶).
- 하이라이트 글자 `hl`(textHTML 공용: shine·color·marker·pop·glow) + 스튜디오 인스펙터 선택 UI + 키트 기본값 `textHighlight` + kit.hl()(발음 자동 맞춤).
- 노드: 아이콘 7종(money·globe·robot·people·pc·market·app img) + flipAt 뒤집기, 연결선 회색 흐르는 점선·화살표 머리 원 밖, 라벨 40·800.
- keyword `bgGhost`(뒤에 크고 옅은 두 줄). 머리말 62·800. 경고 칩 파란 띠+흰 글자, 배너 기본 파랑(빨간 띠 없음).
- 패널(panels3)·블록(stackBuild) 위 아이콘도 색 아이콘(흰 원판 위) — `badgeIcon`.
- 실사 B-roll 기본 = 빈 자리(Envato 영상 넣을 곳), AI 영상은 요청 시에만.
- 노드 아이콘 색칠(키트 nodes.iconColor=1): 연한 원 + 원 색 테두리 위에 진한 윤곽·색 면 아이콘(흰 아이콘 대신). 패널·블록 위 아이콘은 흰색 유지.
- 간격: 배치 검사 붙음 24→32px, 도형 14→20px, **머리말(kicker) 아래 64px 미만 = 오류**(headgap). 머리말 기본 y 230→206, stat 라벨 간격·노드 부제 간격(subGap 64) 넓힘.
- TTS: 비트별 `voice_settings` 덮어쓰기. 음성 시안 채택 `adopt_voice.py`(ElevenLabs Forced Alignment로 낱말 시간).
- 기본 글꼴 키트 설정 `font.family`(디자인 키트 탭 "기본 글꼴"): 글자 양식·키트 그림(anim.js FONT)·마일스톤·kit.text() 전체가 따라간다. 글꼴 파일 이름 앞 숫자(Paperlogy-7Bold) 굵기 인식.
- 새 부품 `rankRise`·`rings`·`panels3`·`stackBuild`(미국 지도) + 노드 아이콘 12종 추가·여러 아이콘(icon 배열).
- AI 영상 B-roll `ai_video.py`(ElevenLabs /v1/flows/video, Veo 3.1 fast) · Envato 소재 `envato_assets.py` + 스튜디오 계정 연결 Envato 카드(ENVATO_API_TOKEN).
- 강조 `echo`(메아리 흔들림): 흔들리며 잔상 3겹이 바깥으로 퍼지며 사라짐. `emphasisFilter` 공용(스튜디오·렌더), `stat`은 SVG 안에서 숫자에만 잔상.
- `stat` 증감 칩(delta): 숫자 크기에 비례(×0.3, 최소 48) + ExtraBold 800. 키트 `components.stat.params`(deltaScale·deltaMin·deltaWeight)로 조정. 렌더 기본 글꼴에 Pretendard 800 추가.

## 0.37.0 — 2026-11-18
- 움직임: 등장 flip·drop·zoom-in, 강조 bounce·lift·shake·wiggle 추가(`transformOf` 공용 — 회전·3D 뒤집기). 큰 요소는 강조 세기 자동 축소.
- 카드: 기본 뒤집기(뒷면 색+번호 → 앞면), 제목 안쪽 여백 자동 맞춤(최소 36, 두 줄 줄바꿈), 좁은 카드 가운데 정렬. 배치 검사 `edge`(카드·칩 테두리 여백 20px 미만 = 오류).
- 선 차트: 기본 부드러운 곡선 + 선 끝 따라가는 점.
- 비트마다 움직임 `beatAccent`(anim.js mergeSection): 문장 시작·긴 문장 4초마다 변화 없으면 주인공 요소 자동 강조. 정지 경고 8→6초.
- 마일스톤 바: `Milestones.tsx`(Module2Milestones) + assemble 겹침, project.json `milestones`, 키트 `milestones`, 배치 검사 `milestone`.
- 문장형 자막 발음 맞춤(첫 단어), 요소 `sync`로 단어 지정.
- TTS 끝 군소리 감지·재생성(`trailing_hum`).
- 스튜디오 디자인 키트: 비트마다 움직임·마일스톤 바 패널.

## 0.36.0 — 2026-11-18
- 사진 부품 옵션: `background`(글자 뒤 배경 — 배치 검사·화두 수 제외), `dim`(글자 읽히게 어둡게), `drift`(공개 뒤 천천히 다가감). 배경 사진 자리 표시는 화면 아래쪽.
- 키트 애니메이션 양식에 `emphasis`(등장 기준 프레임) — 같은 양식의 모든 요소에 같은 강조. 하이라이트 강조에 `color`(키트 색) → `emphasisShadow` 공용.
- 경고 칩(chip_alert) 기본: 46px + 등장 직후 펄스·코랄 빛 테두리(사용자 요청, 템플릿 공통).
- direction_check `count_cut` 경고: 숫자 카운트업·막대가 다 자란 뒤 1초 안에 장면이 바뀌면 경고.
- 키트 지문(theme_hash)을 섹션별로 — 그 섹션이 쓰는 양식·부품만 반영(다른 섹션 양식 변경으로 재렌더 안 함).

## 0.35.0 — 2026-11-18
- 사진·미디어 부품 5종(diagram kind): `zoomReveal`·`split`·`gallery`·`compare`·`stack` — reactvideoeditor/remotion-templates Image & Media 움직임을 anim.js로 옮김(MIT). 사진 없으면 자리표시, Remotion은 사진 미리 불러오기. 디자인 키트 부품·썸네일 추가.
- 키트 지문에서 설명 글(label·idea) 제외.
- 섹션 전환: `@remotion/transitions` 설치(module2 워크스페이스), `Transition.tsx`(Module2Transition) 추가, `assemble.py`가 경계마다 전환 조각을 렌더해 잇고 나레이션 위치를 당김. `final/master.json`에 실제 섹션 위치 기록 → 스튜디오 전체 보기 반영.
- 디자인 키트 `transitions`(기본·챕터·섹션별) + 스튜디오 디자인 키트 탭 '섹션 전환' 편집·미리보기.
- 렌더 기록에 `theme_hash`(transitions 제외) — 전환만 바꾸면 섹션 재렌더 불필요.
- 음성 기록 `tts.json`에 `voice_id` 저장(어떤 목소리로 만들었는지 확인용).

## 0.34.0 — 2026-11-18
- 화두 단어 발음 맞춤: 대사에 그대로 나오는 키워드·숫자·띠·짧은 단어는 words.json의 단어 시작점에 등장. `direction_check`에 `word_sync` 경고 추가(1초 넘게 어긋남). SKILL [5] 규칙 추가.

## 0.33.0 — 모듈2 배치 검사(겹침·간격) (2026-11-18)
- **신규 `scripts/module2/layout_audit.mjs`**: 장면 시점마다 글자·선·원·막대의 실제 좌표(anim.js `collectDiagram`·`measureText`, 스튜디오·렌더와 같은 규칙)로 겹침·선이 글자를 가로지름·24px 미만 붙음·화면 밖 검사. direction_check에 연결(겹침·가로지름 = 최종 렌더 차단, 붙음·화면 밖 = 경고) → 스튜디오 연출안 탭 검수 목록.
- 막대 차트 증가 화살표: 두 막대 사이 빈 곳(막대 윗면 아래)으로 옮기고 라벨은 그 위 가운데, 공간이 좁으면 라벨을 줄여 맞춤(최소 30px) — 값 라벨을 가로지르거나 머리말과 겹치던 문제.
- 키트 간격: 노드 `subGap` 42→54, 대형 키워드 아래 설명 +22px.
- 문서: SKILL.md [2-2b] 배치·간격(24px 규칙, 키트로 고치기), [2-3]·절대 하지 말 것, design-critic.md, module2.md §4-0-0b.
- 2027 전략회의: 검사 23건(붙음) → 0건, s21 막대·s07 칩 배치 수정.

## 0.32.0 — 모듈2 디자인 키트 (공통 양식의 단일 출처) (2026-11-18)
- **`design/theme.json` 디자인 키트** (템플릿 `templates/module2/theme.json`, init이 복사): 색 10종(+설명), 글자 양식 14종(title·kicker·display·headline·statement·subline·chip·chip_alert·caption_on_video(_sub)·note·focus_num/title/sub — 위치·크기·굵기·색·박스·아이디어), 애니메이션 프리셋, 연출 부품 카탈로그 13종(아이디어).
- 요소는 `"style"`·`"$색"`으로 참조 → `anim.js mergeSection(..., theme)`가 병합(스튜디오·Remotion 공용, `render_section` props에 theme). 양식 요소의 등장·퇴장은 motion 프리셋. diagram 기본 색도 테마(`applyKitTheme`).
- **스튜디오 '디자인 키트' 탭**: 색 피커, 글자 양식 표(미리보기·크기·굵기·색·박스색·위치·쓰인 곳·아이디어), 애니메이션 표(▶ 미리보기), 부품 카탈로그(썸네일·쓰인 곳), 양식 밖 글자 목록. `GET/PUT /api/theme` + 사용처 집계. 테마 변경 → 모든 섹션 렌더 stale.
- 부품 설정 `components.<부품>.params` (anim.js `KIT_PARAMS`, 키트 탭에서 숫자로 조절): 노드 원↔라벨 간격 `labelGap` 46→66, `subGap` 42.
- 음성: 자리채움을 범주·받침에 맞춤(지역 → 해외/타국, 회사 → 협력사/제휴은행) — 조사가 실제 단어와 맞게.
- 문서: SKILL.md [2-1b] 디자인 키트(필수), 절대 하지 말 것, module2.md §4-0-0·§5-1, director.md(키트 이름으로 소통), DIRECTION_KIT.md 색 참조.
- 2027 전략회의 적용: 나머지 20섹션 음성 116문장(5,501자, 실패 0) 생성 → 22섹션 양식 참조로 재저장(직접 값 글자 18개만) → 전체 재렌더.

## 0.31.0 — 모듈2 ElevenLabs 음성 + 목소리 복제·조정 절차 (2026-11-18)
- **음성 생성 ElevenLabs 지원** (`tts_voice.py` 진입점, 구현 `tts_heygen.py` 공용): `/v1/text-to-speech/{id}/with-timestamps`, 사용자 클론 보이스, `voice.settings`(stability·similarity_boost·style)·speed, 앞뒤 문장 맥락(`voice.context`), 글자 시각 → 단어 시점.
- **금액만 무음** (`voice.sensitive: silence` 기본, ElevenLabs·HeyGen 공통): 실값 대신 자리채움 숫자로 문장 전체 생성 → 글자 시각으로 그 구간만 무음. "세전이익은 ___ 으로 예상됩니다". 실값은 외부로 나가지 않음.
- **목소리 비교 샘플** `--sample sNN:bN --variants …`: 안정성·음높이(로컬)·속도·스타일·끝처리(마지막 어절만 음높이·고음·크기 낮춤, 길이 유지)·앞뒤맥락 조합을 같은 문장으로 만들어 들려주고 고르게 함. HeyGen은 표현 강도·음높이·태그.
- 스튜디오: 클론 시 `voice.provider=elevenlabs` 기록, 연결 테스트(플랜·글자 수·클론 수).
- 문서: SKILL.md [5]·[6] 전면 개정(복제 → 비교 → 선택 → 생성, 피드백→조정 대응표, 프록시), module2.md §7 구현 상태·실제 사례, 절대 하지 말 것 2항목.
- 검증: 용미니4.wav(51.6초)로 클론 → 비교 8종 → 안정성 0.85 확정 → 처음 1분 10문장 360자 생성(금액 3개만 무음, −91 dB 확인), s01 15.1초·s02 36.8초, 합본 17:39(나레이션 10개, 평균 −15.6 dB).

## 0.30.0 — 모듈2 HeyGen 음성 + 속도·텀 조절 (2026-11-17)
- **신규 `scripts/module2/tts_heygen.py`**: HeyGen `POST /v3/models/audio/tts`로 문장 단위 음성(사용자 voice_id). `--yes` 없이 보낼 문장·글자 수만 표시. 마스킹 미허용 실값 문장은 건너뜀. professional은 HeyGen speed·`heygen-voice-1`, instant는 로컬 atempo·`heygen-voice-1-turbo-free`. 단어 시점 → `beat-N.words.json`.
- **텀·속도**: `voice.speed`/`voice.gap` 프리셋 + 비트별 `speed`/`gap_after`. 실제 음성 길이 + 텀으로 비트를 다시 잡고 layout·timeline의 in/out/emphasis/키트 props 시각을 비트 기준으로 따라 옮김(`--retime`, 외부 호출 없음).
- 스튜디오: 대본 탭 음성 바(기본 속도·텀, **텀 적용**) + 비트별 속도·텀 선택, 🔊 실제 길이 표시. 계정 연결 HeyGen에 **voice_id** 칸, 연결 테스트가 보이스 종류·상태 확인. 보이스는 `voice.provider`로 HeyGen/ElevenLabs 구분해 각 카드에 자기 것만 표시.
- 검증: 2027 프로젝트 처음 1분 8문장(276자) 생성, s01 18.9→15.5초·s02 49.4→41.1초로 재정렬, 합본에 나레이션 8개(평균 −15.7 dB, 피크 −0.3 dB).

## 0.29.0 — 모듈2 연출 단계 연결: 연출안·연출 키트·검수 게이트 (2026-11-16)
배경: 2027 전략회의 1차 결과물이 22섹션 모두 "제목 + 불릿 카드 + 자막 바"로 찍혀 나옴(사용자: "장표가 모두 일괄적", "숫자가 쫘라락, 건물 전경에 카메라가 도는 연출 — 기획이 다 생략", "빌드업을 해야"). 원인: SKILL.md에 director 단계가 없고, init 골격을 반복문으로 채워 렌더. director·storyboarder·design-critic의 2026-06~07 학습이 모듈2에 연결되지 않았음.
- **연출안 단계 (필수 게이트)**: `templates/module2/direction.md` 템플릿(init이 `00-direction/`에 복사) → director가 챕터·빌드업·섹션별 주인공 장치·수치 연출·b-roll 자리를 채움 → 스튜디오 신규 **연출안** 탭에서 사용자 승인(`state.direction` 해시). 연출안이 바뀌면 재승인.
- **연출 키트** (`anim.js` 공용 → 스튜디오 미리보기 = Remotion 렌더): `type:"diagram"` 11종(chapter·keyword·ghost·stat 카운트업·bars·line·nodes·table 행 하이라이트·cards·arrow·banner), `type:"broll"` 실사 자리표시(초안·최종 모두 장면 묘사 표시, `src` 생기면 실사, 카메라 줌·팬·회전 — 회전 시 모서리 덮는 배율 자동). 문서 `templates/module2/remotion/DIRECTION_KIT.md`(2026 하반기 영상 레시피 포함). 스튜디오 인스펙터에서 JSON·b-roll 묘사·파일·카메라 편집.
- **연출 검수 `scripts/module2/direction_check.py`**: 오류 = 연출안 없음/템플릿/미승인/승인 뒤 변경, 골격 그대로, 글자만 있는 섹션, 숫자 연출 없음, 같은 장치 3연속. 경고 = 8초 정지, 자막 바, 굵기 800, 챕터 간지 없음. `render_section.py` 최종 렌더가 오류 시 거부(`--draft`·`--still` 허용, `--skip-check`는 사용자 허락 시만). 스튜디오 연출안 탭·전체 보기에 결과 표시.
- init 골격 표시: `status.json scaffold:true`, 스튜디오 상태 "골격(연출 전)". 섹션 작업자가 설계 후 false.
- 문서: SKILL.md [0] 참고 영상 질문·"기본 영상 = 연출 포함, 재료만 자리표시", [2-1] 연출안 → [2-2] 섹션별 직접 설계(일괄 생성 스크립트 금지, 자막 바 off) → [2-3] 검수, 절대 하지 말 것 4항목. `agents/module2.md` §2·§4-0·§4-0-1·§5-1·§11·§12, `agents/director.md` 모듈2 절(절제 ≠ 일괄, 빌드업, 캡처 PDF·녹취록 분석법). 루브릭: taste +6(uniform_template·numbers_colored_only·no_buildup·caption_bar_default·scaffold_shipped·basic_means_undirected), direction +3 원칙 + 학습 2건.
- 스튜디오 마크다운 렌더에 표·인용 지원(연출안이 표 위주).
- **한 장면에 화두 하나 (2026-11-17 사용자 지시)**: SKILL.md [2-2]·module2.md §4-1·director.md 규칙, taste-rubric `multi_topic_screen`, direction_check `busy`(동시 내용 6개 이상 오류·4~5개 경고, 같은 `group`은 하나로). banner에 `rx`(가로 띠 0)·`wipe`(왼→오 펼침), bars `add` 라벨 앞 연결선은 `leader:true`일 때만.
- 스튜디오 미리보기 버그 수정: 세로 정렬(valign) 텍스트가 재생 중 위로 붙던 문제(drawFrame이 display를 지워 flex가 풀림). 렌더는 원래 정상.
- bars에 `add`(막대 위 증가분이 코랄로 자람 + 옆 라벨)와 `valueAt`·`valueDur`(값 카운트업 시점 분리) 추가.
- 실제 22섹션 제작 중 보강: cards `focus`를 배열로(말하는 카드로 초점 이동, `index:null` = 모두 밝게), 좁은 라틴 글자 폭(i·l·t 등) 보정, 배너 shine을 그라데이션으로, 정지 구간 검사가 diagram·3D 내부의 at·activeAt·subAt까지 셈.
- 검증(Windows 11): 1차 2027 프로젝트에 검수 → 오류 27·경고 67로 차단. 데모 6섹션(init 골격 → 차단 15건) → 연출안 + 섹션별 키트 설계 → 미승인 1건만 남음 → 스튜디오에서 승인 → 통과 → 최종 렌더·합본(82.6초) 성공. 같은 프레임에서 스튜디오 미리보기와 렌더 스틸 일치, 콘솔 오류 없음.

## 0.28.0 — 모듈2 스튜디오 '전체 보기' (2026-11-16)
- **스튜디오 신규 탭 `전체 보기`** (`#full`): 합본 `final/master.mp4`(없으면 `master_draft.mp4`)를 스튜디오 안에서 처음부터 끝까지 재생. 오른쪽 섹션 챕터 목록(시작 시각·길이, 누르면 그 지점부터 재생, 재생 중 현재 섹션 강조), 플레이어 아래 현재 섹션 + '이 섹션 리뷰하기'.
- **합본 미반영 표시 + '합본 다시 만들기'**: 섹션별 `렌더 없음`/`편집 후 렌더 필요`/`합본 이후 렌더됨`을 보여주고, 버튼 한 번으로 바뀐 섹션만 최종 렌더한 뒤 `assemble.py` 실행(서버 백그라운드, 진행 단계 표시, 끝나면 보던 위치 유지한 채 새 영상으로 교체).
- studio_server: `GET /api/full`, `POST /api/full/build` (`full_info`·`start_full_build`). 챕터 시작은 assemble.py와 같은 기준(앞 섹션 `timeline.duration` 합).
- 문서: `agents/module2.md` §5-5(필수 기능 — 스튜디오를 다시 만들거나 고칠 때 빼지 않는다), SKILL.md [3]·[8]·절대 하지 말 것. 회사 프록시 환경에서는 스튜디오 서버를 `NODE_USE_ENV_PROXY=1`로 띄워야 렌더 버튼이 Remotion 브라우저를 받을 수 있음.
- 검증(Windows 11, 실제 22섹션·17분 55초 프로젝트): 챕터 이동·현재 섹션 강조, 섹션 1개 변경 감지 → 그 섹션만 렌더 → 합본 갱신(17초), '이 섹션 리뷰하기' 이동, 콘솔 오류 없음.

## 0.27.0 — 모듈2 Windows 지원 + 새 PC 설치 스크립트 (2026-11-12)
- **신규 `scripts/module2/module2_setup.py`** (macOS·Windows 공용): `check`(점검), `install [--prereqs] [--remotion DIR]`(기본 프로그램 winget/brew → Remotion 루트 생성·버전 고정 → 3D 의존성 → Pretendard → 스킬 연결), `remotion`, `fonts`, `skill`(링크 → 정션 → 복사).
- **신규 `scripts/module2/m2env.py`**: Remotion 루트(환경변수 → `~/.config/video-agents/module2.json` → 기본값), OS별 폰트 폴더(+공용 `~/.config/video-agents/fonts`), UTF-8 고정 실행, node로 Remotion CLI 직접 호출(npx.cmd 회피), 콘솔 UTF-8.
- render_section·studio_server·assemble: 맥 전용 경로 제거, cp949 디코딩 오류 방지, concat 목록 UTF-8·슬래시 경로.
- `setup_remotion.sh`·`install_codex_skill.sh`는 module2_setup.py를 부르는 얇은 래퍼(하위 호환).
- 저장소의 `.agents/skills` 심볼릭 링크 제거 (Windows 클론에서 깨진 파일이 됨). 스킬 연결은 `module2_setup.py skill`.
- SKILL.md §0 "새 PC 설치" 절차, 명령 표기 OS 중립화(`PY S/…`).
- 발견: TypeScript 7이 깔리면 Remotion 번들러가 실패(`typescript.sys` 없음) → 5.x 고정.
- 검증(macOS, 빈 홈 폴더 가정): install → 새 Remotion 루트 → 데모 6섹션 초안 렌더·합본 통과, 폰트는 공용 폴더에서만 읽음. Windows 실기 검증은 아직.

## 0.26.0 — 모듈2 공용 스킬 (Claude Code·Codex) (2026-11-11)
- **신규 `skills/module2-strategy-video/SKILL.md`**: 도구 중립 절차서. Agent Skills 표준(name·description)이라 Claude Code 플러그인 스킬과 Codex 스킬로 같이 쓴다. Claude 전용 도구(Agent·AskUserQuestion)는 대응표로 풀어 씀 — 하위 에이전트가 없으면 섹션을 순서대로 처리.
- **ElevenLabs·HeyGen은 사용자별**: 스킬에는 연결 절차만 두고 키·voice_id·avatar_id 값은 넣지 않는다. 키는 각 사용자의 `~/.config/video-agents/secrets.env`, ID는 각 프로젝트 `project.json`.
- **`scripts/module2/install_codex_skill.sh`**: `~/.agents/skills` 또는 지정 저장소의 `.agents/skills`에 심볼릭 링크. 플러그인 저장소에는 `.agents/skills/module2-strategy-video` 링크 포함.
- `agents/module2.md`: 스킬 위치, 계정 사용자별 원칙 추가.

## 0.25.0 — 모듈2 렌더 연결 + 3D 기본 키트 (2026-11-11)
- **데이터 구동 Remotion 컴포지션** `templates/module2/remotion/Module2Section.tsx`: layout/timeline/edits props, 스튜디오와 같은 anim.js로 상태 계산(미리보기 = 렌더), 텍스트·[[강조]]·이미지·영상·아바타(무음)·3D·음성, 폰트 FontFace 로드.
- **3D 기본 키트** `templates/module2/remotion/three/`: `globe`(거점·연결선·포커스 회전), `bars`(입체 막대·카운트업·추이선), `layers`(층 쌓기·분해·강조), 한글 라벨 `TextSprite`, `THREE_KIT.md`.
- **`scripts/module2/render_section.py`**: 템플릿·anim.js 동기화 → props 생성(폰트 복사, 음성 배치) → 초안/최종/정지 화면 렌더, `render.json` 상태. **`setup_remotion.sh`**: 3D 의존성을 `codex-workspace/module2/`에만 설치(Remotion AGENTS.md 격리 규칙 준수), 중복 remotion 제거.
- **`scripts/module2/assemble.py`**: 섹션 비디오 concat(오디오 분리) + 비트 WAV 배치 + BGM 사이드체인 덕킹.
- 스튜디오: "초안 렌더" 버튼(백그라운드), "보기: 미리보기/렌더본" 겹쳐 보기와 오래됨 표시, "+ 3D" 추가, 3D 장면 설정 편집.
- 검증: 데모 6섹션 초안 17초, 3D 3종 정지 화면·프레임 시퀀스 확인, 합본 길이 2477f 일치, 나레이션 오프셋 1프레임 이내.

## 0.24.0 — 모듈2 마스킹 + 로컬 스튜디오 구현 (2026-11-11)
- **`scripts/module2/redact.py`**: 회사·금액·수치·지역·인명·일정 탐지(정규식+사전+휴리스틱), 대체어 받침에 맞춘 조사 교정, 매핑표(로컬 전용·.gitignore 자동), 마스킹본·민감 비트 인물→장표 강제 전환, 외부 전송 게이트, 실단어 어절 splice-plan.
- **`scripts/module2/module2_init.py`**: 대본(md/docx/txt)·pptx(노트 우선)·데모 → 섹션 골격(script/beats/storyboard/layout/timeline).
- **로컬 웹 스튜디오** `scripts/module2/studio_server.py` + `templates/module2/studio/`: 섹션 4레이어 탭, 재생 미리보기(음성 동기), 직접 편집(드래그 이동·크기·폰트·색·정렬·등장/퇴장·강조, 요소 추가/삭제, ⌘Z), 타임라인 막대 드래그(비트·ASR 단어·요소 경계 자석), 코멘트 9유형+첨부, 수정 요청·잠금·버전 되돌리기, 마스킹 검토·확정, HeyGen/ElevenLabs 연결 테스트·가이드, 보이스 클론 녹음기.
- **`templates/module2/studio/anim.js`**: 렌더 의미론 정본(병합·프레임 상태·타자기·카운트업·[[강조]]). Remotion 컴포넌트가 같은 파일을 쓰도록 설계.
- **`scripts/module2/studio_queue.py`**: 수정 요청 대기열 list/start(편집값 기계적 합치기)/brief(섹션 에이전트 지시문)/done.
- `agents/module2.md` v1: 빠른 시작, 구현 상세, 수정 루프 절차, 상태표 갱신.
- 검증: `agent_design_new/module2-demo`(가상 회사 6섹션)에서 마스킹부터 섹션 에이전트 수정·스튜디오 갱신까지 한 바퀴.

## 0.24.0-draft — 모듈2 "경영전략회의 발표영상" 설계 (2026-11-11)
- **신규 `agents/module2.md` (설계 v0)**: 인물 HeyGen + ElevenLabs 클론 음성·음악 + Remotion(3D 선택) 약 15분 발표영상 오케스트레이터.
- 자료(PPT/대본) 접수 → **민감정보 마스킹**(회사명→A사, 금액→99999원, 지역→임시지역, 매핑표 로컬 전용, 외부 전송 게이트).
- 섹션별 4레이어(대본·스토리보드·장표 레이아웃·영상화 타임라인) → **로컬 웹 스튜디오**에서 섹션 단위 코멘트·직접 편집(위치·크기·폰트·타이밍) → 섹션별 서브에이전트 수정 루프.
- 민감 단어 발화 비트는 인물 제외 + 마스킹 음성 생성 후 실단어 어절만 따로 생성해 **로컬 스플라이스**.
- 스튜디오 내 HeyGen 연결·ElevenLabs 녹음/클론 가이드. 사용자 제작 별도 영상 투입 규칙은 지시 대기 칸.
- 구현 전: redact.py, studio 템플릿, tts_elevenlabs.py, splice_tokens.py, 3D 키트. `main.md`에 모듈2 라우팅 추가.

## 0.23.0 — 모듈1 "기본영상 + 기본음성" (2026-11-03)
- **신규 `agents/module1.md`**: 아바타·클론 보이스·Premiere 없이 다이어그램 장표 + TTS 기본 보이스 + ffmpeg 합본으로 2~3분 안내 영상을 만드는 오케스트레이터. 채팅 피드백 사이클 중심, resume 모드.
- **신규 `agents/tts.md`** (+`scripts/tts_typecast.py`, `scripts/asr_words.py`): Supertone API 종료(2026-08-31)에 따른 Typecast 정본. ASCII 경계 발음 치환, 끝음 QA 시드 재생성, ASR 단어 타임스탬프.
- **신규 `agents/assemble.md`** (+`scripts/build_master.sh`, `build_all.sh`, `rebuild_audio_subs.py`, `burn_subs.py`): 비디오 전용 concat + 원본 WAV 나레이션 + BGM 사이드체인 덕킹 + PIL 자막. AAC priming 누적 지연·`-shortest` 꼬리 절단 사고 구조적 회피.
- **타이밍 편집기** `templates/module1/timing_editor.html` + `scripts/audio_peaks.py`: 파형·단어 onset·트리거 드래그 → `timing_overrides.json` → continuity 적용.
- **스토리보드 HTML** `templates/module1/storyboard.html` + `scripts/storyboard_html.py`: 실좌표 SVG 프레임.
- `templates/module1/project.json` 프로젝트 설정(보이스·발음·BGM·자막·타이밍).
- `supertone.md` 폐기 표시, `main.md` 모듈1 라우팅 + resume 모드, `continuity/storyboarder/layouter/remotion.md`에 모듈1 실전 규칙 추가.
- 근거 프로젝트: `agent_design_new/ai-naming-intro` (2:16.8, 7슬라이드, 피드백 8사이클).

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
