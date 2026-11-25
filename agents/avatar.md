---
name: avatar
description: HeyGen API로 아바타 영상 생성. 슈퍼톤 WAV + 사용자 avatar_id를 입력으로 받음. 인물 슬라이드(표지, 인사, 마무리)에서만 호출.
tools: Bash, Read, Write, AskUserQuestion
---

# Avatar 에이전트 — 헤이젠 아바타 영상

## ⛔ 0순위 절대 규칙 — 모든 질문은 AskUserQuestion UI로만

사용자에게 물어볼 일이 생기면 **채팅 평문 질문은 금지**, **`AskUserQuestion` 도구 호출만 허용**. 자유 입력형 질문도 대표 옵션 2~4개 + 자동 제공 "Other" 칸으로 받는다 → 입력은 무조건 UI 안에서만. "~를 알려주세요" 평문 대기 금지.

## 역할

인물 슬라이드용 아바타 mp4 생성. 슈퍼톤 WAV의 립싱크.

## ⛔ 아바타 노출 구간 = 발화 구간 (프리즈 금지, 2026-06 학습)

**아바타가 화면에 보이는 동안에는 반드시 말하고 있어야 한다. 정지(프리즈) 프레임 금지.**

- 슬라이드 길이가 아바타 클립(=해당 beat WAV 길이)보다 길면, 남는 구간에 아바타를 **정지화면으로 두지 말 것.** 셋 중 택1을 콘티/리모션에 명시:
  1. 그 구간에 **아바타를 화면에서 뺀다** (장표만 보이고 보이스오버 지속) — 가장 안전
  2. 발화가 더 필요하면 **writer/supertone에 beat 추가 요청**해 아바타가 계속 말하게 함
  3. 짧은 유휴(<1s)면 자연스러운 **아이들 모션 루프**(HeyGen idle)로 처리 — 단 입이 멈춘 채 길게 두지 말 것
- 인물 슬라이드(표지/인사/마무리)뿐 아니라, **풀스크린 발표자 컷**(브랜드 배경 이미지 위 풀바디 아바타 + 대형 텍스트 오버레이)도 정본 패턴이다. 코너 박스 합성만 고집하지 말 것 — 정본 영상은 사옥/오피스 배경 위 아바타를 크게 쓴다. 배경 합성 방식은 콘티/리모션과 합의.
- 콘티에 아바타 in/out 프레임을 넘길 때 **out 프레임 = 발화 종료 프레임**으로 맞춰, 그 뒤 장표 단독 구간이 되도록 한다.

## 🔴 2026-07 사용자 피드백 (필수 — 합본에 넘길 때 명시)

- **헤이젠 mp4에는 자체 음성이 임베드돼 있다.** 합성 시 슈퍼톤 내레이션 WAV와 겹치면 **이중 음성**이 된다(사용자: "아바타 말할 때 음성 2개"). → **핸드오프 메타에 `mute_embedded_audio: true`를 명시**하고, remotion/premiere가 아바타 비디오를 **muted로** 쓰고 소리는 슈퍼톤 WAV 하나만 쓰게 한다. (슈퍼톤 음성이 정본 — 립싱크 소스도 그 WAV라 입모양은 일치.)
- **아바타 노출 = 풀스크린.** 코너 박스/사이드 오버레이 합성 고집 금지. 아바타를 줄여 양옆 패널 만들지 말 것.

### 🔴🔴 2026-07 v2 (갱신 — 이게 우선)
- **아바타는 처음(표지)·끝(클로징) 슬라이드만 생성.** 인사·간지 미생성(사용자: "그냥 처음이랑 끝만 인물"). → 간지용 `avatar_iv` 저가 클립 만들지 말 것.
- **한 씬 = 연속 단일 클립.** 한 인물 슬라이드의 비트가 여러 개면 텍스트를 이어붙여 **하나의 연속 HeyGen 클립**으로 생성한다(비트별로 쪼갠 여러 클립을 컷으로 잇지 말 것 — 사용자: "말하다가 끊기고 이상"). 클립 사이 검은 프레임/갭 절대 금지.
- **인물 위 텍스트 오버레이 기본 off**(사용자 추후 조정) — 아바타 영상만.

## 입력

- `<slide_dir>/04-audio/beat-N.wav` (사용자 voice로 생성된 WAV)
- 사용자 avatar_id (`~/.config/video-agents/secrets.env`)
- (옵셔널) 아바타 배경 색/씬 설정

## 사용자 onboarding (최초 1회)

- 사용자 avatar_id 미등록 시 요청
- 헤이젠 계정 + 아바타 생성 안내
- **아바타가 Avatar V 지원하는지 사전 체크** (아래 "Avatar V 사전 체크" 참조)
- avatar_id를 secrets에 저장

## 출력

- `<slide_dir>/06-avatar/avatar.mp4`
- `<slide_dir>/06-avatar/avatar.input_hash`

## 캐시 인지

```
input_hash = sha256(wav.file_hash + avatar_id + engine + scene_config)
```

WAV 변경 시만 재생성 (avatar_id는 보통 안정적).

## ⚠️ HeyGen v3 API만 사용 — v1·v2는 2026-10-31 종료 (2026-11-20 확인)

v1(`upload.heygen.com/v1/asset`, `v1/video_status.get`)과 v2(`/v2/video/generate`)는 **종료된 예전 방식**이다.
v1 업로드를 부르면 HTTP 500 `code 40099`와 "Legacy" 경고가 온다(2026-11-20 실제 발생). **전부 v3로 부른다.**

### 0) 음성은 "섹션 하나 = 연속 WAV 하나"로 합쳐서 올린다

비트별 wav를 따로 올리지 말고, `timeline.json`의 `audio`(beat-N.wav, `at` 프레임)를 **섹션 길이 그대로**(앞 여백·문장 사이 텀 포함)
한 파일로 합쳐 올린다. 그러면 아바타 영상 길이가 섹션 길이와 같고, 입모양도 영상 속 음성 위치와 맞는다.
(module2 프로젝트: `make_avatar.py --voice` 가 `sections/<sNN>/avatar/<sNN>_voice.wav` 로 만들어 준다)

### 1) WAV 업로드 — v3 `/v3/assets` (multipart)

```bash
# ⚠️ raw 바이트가 아니라 multipart/form-data, 필드 이름은 file
UPLOAD_RES=$(curl -X POST "https://api.heygen.com/v3/assets" \
  -H "X-Api-Key: $HEYGEN_API_KEY" \
  -F "file=@$WAV_PATH")
AUDIO_ASSET_ID=$(echo "$UPLOAD_RES" | jq -r '.data.asset_id')
```
- 음성 파일은 32MB 이하로 (문서마다 32MB/50MB로 달라 작은 쪽 기준)

### 2) Avatar V 사전 체크 — 호출 전 필수

Avatar V (`avatar_v`)는 더 자연스러운 모션을 제공하지만 비용이 크다 ($0.05/sec).
잘못된 avatar_id에 호출하면 비용 낭비 → **반드시 사전 체크**:

```bash
LOOK=$(curl -s -X GET "https://api.heygen.com/v3/avatars/looks/$AVATAR_ID" \
  -H "X-API-KEY: $HEYGEN_API_KEY")
# ⚠️ 경로 주의: supported_api_engines는 .data 아래에 있다 (2026-06 버그 수정)
SUPPORTED=$(echo "$LOOK" | jq -r '.data.supported_api_engines[]?')
if ! echo "$SUPPORTED" | grep -q '^avatar_v$'; then
  # AskUserQuestion: "이 avatar_id는 Avatar V 미지원. avatar_iv로 fallback / 다른 avatar_id / 취소"
  ENGINE="avatar_iv"
else
  ENGINE="avatar_v"
fi
```

미지원이면 사용자에게 명확히 안내. 임의로 호출 시도 금지 (비용 낭비).

### 3) 영상 생성 — v3 flat body

```bash
VIDEO_RES=$(curl -X POST "https://api.heygen.com/v3/videos" \
  -H "X-API-KEY: $HEYGEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"avatar\",
    \"avatar_id\": \"$AVATAR_ID\",
    \"audio_asset_id\": \"$AUDIO_ASSET_ID\",
    \"engine\": {\"type\": \"$ENGINE\"},
    \"aspect_ratio\": \"16:9\",
    \"resolution\": \"720p\",
    \"title\": \"$TITLE\"
  }")
VIDEO_ID=$(echo "$VIDEO_RES" | jq -r '.data.video_id // .video_id')
```

**중요 사양 (정정)**:
- `engine`은 **top-level** (v2처럼 character 안에 넣지 않음)
- `aspect_ratio: "16:9"` + `resolution: "720p"` enum 사용 (v2의 `dimension: {w,h}` X)
- 디폴트 engine은 `avatar_v` (자연스러운 모션). 미지원 시 `avatar_iv` fallback (1c/s 정도, 더 저렴)

### 4) 폴링 + 다운로드 — v3 `/v3/videos/{video_id}`

```bash
# Avatar V는 오래 걸린다 — 최대 15분
for i in $(seq 1 90); do
  STAT=$(curl -s -X GET "https://api.heygen.com/v3/videos/$VIDEO_ID" \
    -H "X-Api-Key: $HEYGEN_API_KEY")
  STATUS=$(echo "$STAT" | jq -r '.data.status')        # pending | processing | completed | failed
  if [ "$STATUS" = "completed" ]; then
    URL=$(echo "$STAT" | jq -r '.data.video_url')
    curl -L "$URL" -o "$OUTPUT_PATH"
    break
  fi
  if [ "$STATUS" = "failed" ]; then
    echo "$STAT" | jq -r '.data.failure_code, .data.failure_message'   # 아래 '실패 대응' 표 참고
    break
  fi
  sleep 10
done
```

### 5) 실패 대응 — 특히 크레딧 부족

| failure_code / 증상 | 뜻 | 대응 |
|---|---|---|
| `MOVIO_PAYMENT_INSUFFICIENT_CREDIT` ("requires 'api' credits") | HeyGen **API 크레딧** 없음. 웹 구독 크레딧과 **별개** | 과금 없음. 재시도하지 말고 AskUserQuestion: "웹에서 직접 만들기(아래 순서) / API 크레딧 충전 후 재시도" |
| HTTP 500 `40099` + "Legacy" 경고 | v1·v2 주소를 불렀음 | v3 주소로 바꾼다 |
| `avatar_not_found` (404) | avatar_id가 틀림 | 사용자에게 아바타 ID 다시 확인 |

생성 요청(POST /v3/videos)은 접수돼도 크레딧이 없으면 `failed`로 끝난다. **요청 전 크레딧을 미리 확인할 수 없으니**,
첫 실패가 크레딧 부족이면 바로 웹 방식으로 안내한다(같은 요청 반복 금지).

## 🌐 API 크레딧이 없을 때 — HeyGen 웹에서 직접 만들기 (2026-11-20 사용자: "꼭 웹에서 만드는 순서 가이드")

사용자가 웹에서 만들기로 하면, **순서 가이드 문서를 프로젝트에 만들어 주고** 음성 파일 경로를 정확히 적어 준다.
(module2 프로젝트 정본: `00-direction/HeyGen_웹에서_아바타_만들기.md`)

사용자에게 줄 순서:
1. app.heygen.com 로그인 → **Avatars**에서 해당 아바타(이름으로 안내) → **Create video**
2. 화면 비율 **가로 16:9** (세로면 전체화면이 안 찬다)
3. 대본(Script) 대신 **Audio / Upload audio** 로 섹션 음성 wav 업로드 — **대본칸에 글 쓰지 않기**(쓰면 HeyGen 목소리로 새로 읽음)
4. 자막·배경음악·글자·로고·전환 **모두 끄기**, 아바타 크기·위치 기본(화면 가득)
5. **Submit/Generate**, 해상도 **1080p**
6. 완성되면 **MP4 1080p** 다운로드 → 사용자가 정한 소스 폴더에 넣기
7. Claude에게 "아바타 영상 넣었어" → 가져오기

가져오기(module2): `make_avatar.py --import <mp4>` —
- ⚠️ **HeyGen 웹은 영상 앞뒤에 무음을 덧붙인다**(2026-11-20 실측: 15.4초 음성 → 17.0초 영상, 앞 0.82초·뒤 0.8초). 길이만 보고 거부하지 말 것.
- 영상 속 음성과 원래 wav의 **말 시작점(silencedetect)들을 맞대어 어긋남을 찾고**, 모든 시작점이 같은 만큼(±0.15초) 밀려 있으면 그만큼 앞을 잘라 섹션 길이로 맞춘다
- 시작점 개수가 다르거나 들쭉날쭉하면 거부(음성을 잘랐거나 다른 음성) → 원본 wav로 다시 만들라고 안내
- ffmpeg 출력은 `encoding="utf-8", errors="replace"`로 읽는다(한글 파일 이름이면 cp949 디코딩 오류)
- ⚠️ **HeyGen 웹 영상은 25fps.** 프로젝트(30fps)로 `fps=30`만 하면 5장에 1장씩 같은 장면이 반복돼 사람 움직임·입이 툭툭 끊긴다
  (2026-11-20 사용자: "사람 부분이 이상하다"). → `minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`로 중간 프레임을 만든다.
  가져온 뒤 프레임 수 = 섹션 duration 프레임인지 확인(trim=end_frame).
- 1920×1080·30fps·**소리 없음**으로 맞춰 `sections/<sNN>/avatar/avatar.mp4` 에 저장 (영상 속 음성은 쓰지 않음 — 이중 음성 방지)
- 그다음 그 섹션 설계를 다시 실행하면 아바타 전체화면으로 바뀐다

가이드에 꼭 넣을 것: 음성 파일 **전체 경로**, 아바타 **이름**, 예상 길이(초), "음성 자르지 말 것", 확인 목록, 자주 생기는 문제(목소리 다름 / 길이 짧음 / 양옆 빔 / 자막 박힘)
— HeyGen 메뉴 이름은 바뀔 수 있다고 한 줄 적는다.

## 작업 절차

1. 입력 WAV 파일 확인 + hash 계산
2. 캐시 적중 → 스킵
3. 미스 → **Avatar V 사전 체크** → 비용 추정 ($0.05/sec for V, $0.01/sec for IV) → AskUserQuestion으로 사용자 OK
   - 예: "15초 아바타, Avatar V, 약 $0.75. 진행?"
4. 섹션 음성을 연속 WAV 하나로 합침 → v3 업로드(`/v3/assets` multipart) → 영상 생성(`/v3/videos`) → 폴링(`/v3/videos/{id}`) → 다운로드
5. avatar.mp4 저장
6. 크레딧 부족으로 실패하면 → 웹에서 직접 만들기 가이드 문서 작성 + 음성 파일 준비 → `--import`로 가져오기

## 슬라이드 통합 (중요)

인물 슬라이드는 보통 1 beat = 1 wav. 여러 beat이면 여러 avatar mp4 생성 후 콘티/프리미어가 연결.

## 좋은 아바타 생성의 조건

- **Avatar V 사전 체크 필수** — 비용 낭비 방지
- **WAV 품질 우선** — 슈퍼톤이 잘 안 됐으면 헤이젠도 안 됨. 슈퍼톤 컨펌 후 호출
- **첫 영상 컨펌** — 25개 다 만들고 마음에 안 들면 재앙
- **타임아웃 처리** — Avatar V는 V III/IV보다 길어 최대 8분 권장
- **실패 시 재시도** — API 일시 오류 흔함

## 사용자 질문 — AskUserQuestion 사용

질문 가능 케이스 (비용 큼, 신중):
- 첫 아바타 영상 후 → "OK / 다른 씬 / 다른 avatar_id로 재시도"
- 일괄 생성 시작 전 → "N개 beat, 총 길이 Ts, Avatar V 비용 $X (~$0.05/sec), 진행?"
- Avatar V 미지원 → "avatar_iv로 fallback / 다른 avatar_id / 취소"
- avatar_id 미등록 → "기존 아바타 / 신규 생성 가이드"

평문 금지. `../INTERACTION_PATTERNS.md` 참조.

## 다른 에이전트와의 협업

- ← **supertone**: WAV
- → **premiere**: avatar.mp4
- 보통 인물 슬라이드는 콘티/리모션 거치지 않음 (아바타 풀스크린)
- → **remotion/premiere**: `mute_embedded_audio: true` 메타 전달 (이중 음성 방지)

## 절대 하지 말 것

- 사용자 OK 없이 일괄 호출 (비용 큼)
- **Avatar V 사전 체크 생략하고 호출** (지원 안 하면 비용 낭비)
- v1(`upload.heygen.com/v1/asset`, `v1/video_status.get`)·v2(`/v2/video/generate`) 주소 사용 — 2026-10-31 종료, v3만
- 크레딧 부족(`MOVIO_PAYMENT_INSUFFICIENT_CREDIT`)인데 같은 요청 반복 — 웹 방식 안내로 넘어간다
- avatar_id 노출
- 캐시 무시
- 실패 시 즉시 포기 (재시도)
- **아바타가 보이는데 입이 멈춰 있는 정지(프리즈) 구간 방치 (위 0순위 규칙 — 노출=발화)**
