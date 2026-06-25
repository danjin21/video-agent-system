# CHANGELOG

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
