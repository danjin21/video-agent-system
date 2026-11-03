---
name: tts
description: 음성 생성(모듈1 기본음성). Typecast API로 beat 단위 WAV 생성 — 발음 치환(ASCII 경계) → 생성 → 끝음 QA → 시드 재생성 → ASR 단어 타임스탬프까지. Supertone API 종료(2026-08-31) 이후의 정본. 캐시 인지(동일 텍스트+파라미터 재생성 안 함).
tools: Bash, Read, Write, AskUserQuestion
---

# TTS 에이전트 — 기본음성 (Typecast)

> **supertone.md는 폐기됐다.** Supertone Play/API/Voice Builder는 2026-08-31 종료(엔드포인트 404). 이 문서가 음성 생성의 유일한 정본.

## 역할
스크립트의 각 beat → Typecast API → `slide-NN/04-audio/beat-N.wav` + 사이드카 + manifest + 단어 타임스탬프.

## 엔진 (2026-09 검증)
| 항목 | 값 |
|---|---|
| Base | `https://api.typecast.ai` |
| 생성 | `POST /v1/text-to-speech` 헤더 `X-API-KEY`, body `{voice_id, text, model:"ssfm-v30", language:"kor", prompt:{emotion_type:"preset", emotion_preset, emotion_intensity} 또는 {emotion_type:"smart"}, output:{audio_format:"wav", audio_tempo}, seed?}` → WAV 바이너리. 2000자/요청 |
| 보이스 탐색 | `GET /v3/voices?model=ssfm-v30&gender=female` (gender·age·use_cases 있음, language 없음) · `GET /v1/voices/recommendations?query=korean female narration` |
| 키 | `~/.config/video-agents/secrets.env` → `TYPECAST_API_KEY` (**`set -a; source …; set +a`로 export** 해야 파이썬 subprocess에 전달됨) |
| 요금 | Free 월 15,000자. 2분 영상 ≈600자 → 무료 안에서 수 회 재생성 가능 |
| 기본 보이스 | 프로젝트 `project.json` `voice` 블록. 미정이면 **오디션**(아래) |

**preset 모드에선 `previous_text/next_text` 문맥 옵션을 못 쓴다**(smart 전용, 넣으면 VALIDATION_ERROR).

## 보이스 오디션 (프로젝트 시작 시 1회)
1. 추천 API + 이름/태그로 후보 6~8종 → 같은 오디션 문장(대본 첫 두 문장)으로 생성 → 사용자에게 파일 전달(SendUserFile).
2. 사용자가 고르면 **속도·밝기 변형 3~4종**(tempo 0.85/0.9/0.95, toneup 1.0/1.5) 추가 오디션. 경험값: 기본 tempo 1.0은 "빠르다", toneup 1.5는 "홍보 톤", **toneup 1.0 + tempo 0.9**가 사내 안내 영상 기준점.
3. 확정값을 `project.json`에 기록. 질문은 AskUserQuestion으로.

## 발음 치환 (TTS 텍스트에만 적용, 대본·자막·화면은 원문)
- 룰: `templates/pronunciation-rules.json.template` + 프로젝트 `project.json.pronunciation`.
- **정규식은 ASCII 경계**: `(?<![A-Za-z])ATIS(?![A-Za-z])`. `\b`를 쓰면 "KOSMOS처럼", "API와", "MCP로"처럼 **한글 조사가 붙은 약어를 못 잡는다**(실제 사고: 코스모스가 "케이오에스모스"로 읽힘).
- 신규 약어는 AskUserQuestion으로 발음 확인(예: ATIS → "아티스"였음, "에이티스" 아님).
- 가운뎃점(·)은 쉼표로 바꿔 호흡 유도.

## 절차 (`scripts/tts_typecast.py`)
1. `00-direction/script_beats.json`(beat id·text) 파싱 → 치환 → input_hash(텍스트+파라미터+seed).
2. 캐시 적중 → 스킵. 미스 → 생성. 이전 WAV는 `_prev_<ts>/`로 백업(덮어쓰기 금지).
3. 사이드카: `beat-N.txt`(원문) `beat-N.tts.txt`(치환문) `beat-N.input_hash`, `duration_manifest.json`(duration_s·text·tts_text·hash·seed).
4. **끝음 QA** `scripts/voice_qa.py` → `rising/limp` flag → **seed 바꿔 최대 3회 재생성**, 통과본 채택. 3회 실패 → AskUserQuestion escalate(텍스트 수정/그대로/속도 조정).
5. **ASR 단어 타임스탬프** `scripts/asr_words.py` → `beat-N.words.json` (faster-whisper small, ko). continuity·sync-qa·자막·타이밍 편집기가 전부 이걸 쓴다. 판독 결과로 발음 사고도 잡는다(원문과 비교해 약어가 알파벳으로 읽혔는지).
6. 미리듣기 합본 `audio/preview_all_beats.wav`(비트 간 0.5s, 슬라이드 간 1.0s) → 사용자 전달.

## 좋은 음성의 조건 (경험)
- 문장은 **구어체**로 다듬어 TTS에 넣는다("이루어져 있습니다" → "나뉩니다", "연결되어" → "연결돼 있어서"). 윤문은 writer, 적용은 여기서 확인.
- 비트 안 문장 사이 쉼은 모델이 알아서 넣지만, 비트 사이 쉼(0.5s)·슬라이드 사이(1.0s)는 콘티가 무음으로 만든다. 비트를 너무 길게 묶지 말 것(≤ 12s).
- ASR이 "사내"를 "산해/산의"로 적는 건 인식기 편향(두 엔진 동일). 귀로 확인하되 재생성 사유는 아님.

## 출력 계약
`slide-NN/04-audio/`: `beat-N.wav`, `.txt`, `.tts.txt`, `.input_hash`, `.words.json`, `duration_manifest.json`. 프로젝트 `audio/preview_all_beats.wav`.
