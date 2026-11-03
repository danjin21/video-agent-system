---
name: assemble
description: 최종 합본(모듈1). Premiere 없이 ffmpeg만으로 — 슬라이드 mp4 비디오 concat + 원본 WAV 나레이션 트랙 + BGM 사이드체인 덕킹 + 자막 굽기(PIL). sync-qa가 잡았던 합본 결함(AAC priming 누적 지연, -shortest 꼬리 절단)을 구조적으로 피한다.
tools: Bash, Read, Write
---

# Assemble 에이전트 — ffmpeg 합본 (Premiere 불필요)

## 왜 이 방식인가 (실측 사고 2건)
1. **오디오 포함 mp4를 concat demuxer로 이으면 슬라이드 경계마다 비디오 pts가 +1.3~1.8f씩 누적 밀린다.** 각 mp4의 AAC priming(2048샘플)으로 오디오가 비디오보다 길고, concat이 오디오 길이로 세그먼트를 배치하기 때문. 7슬라이드 끝에서 그림이 소리보다 0.26s 늦었다.
   → **비디오 전용 mp4로 분리(`-an -c:v copy`)한 뒤 concat.** 검증: 경계 pts = start_frame/30 정확, 총 프레임 = 타임라인 총 프레임.
2. **`-shortest`는 끝 페이드 꼬리를 자른다**(11f 손실, 마지막 프레임 순백 아님). → 오디오를 `apad+atrim`으로 정확히 총 길이에 맞추고 `-shortest` 금지.

## 입력
- `slide-NN/05-remotion/slide-NN.mp4` (remotion 출력, 오디오 포함이어도 무관 — 비디오만 씀)
- `03-conti-timeline.json` (슬라이드 순서·start_frame·비트 global 프레임·총 프레임)
- `slide-NN/04-audio/beat-N.wav` 원본 + `beat-N.words.json`
- `project.json` (bgm 경로·볼륨·덕킹, 자막 스타일, 수동 줄나눔 맵 경로)

## 절차 (`scripts/rebuild_audio_subs.py` → `scripts/build_master.sh` → `scripts/burn_subs.py`, 묶음 `scripts/build_all.sh <project>`)
1. **나레이션 트랙**: 각 비트 WAV를 `adelay=global_start_ms`로 콘티 프레임에 배치 → `amix normalize=0` → `audio/narration_timeline.wav`. 렌더 mp4의 오디오는 쓰지 않는다(priming 지연 회피).
2. **BGM 베드**: 트랙을 `acrossfade`로 루프 → 총 길이 trim → fade-in 1.5s / fade-out 3.5~3.8s → `volume`(기본 0.24) → **`sidechaincompress`(threshold 0.015, ratio 8, attack 30, release 1200)** 나레이션을 사이드체인으로 덕킹. release가 짧으면(300ms) 구절 사이에서 펌핑한다.
3. **비디오**: 슬라이드별 `-an -c:v copy` → concat demuxer `-c copy` → `master_video_clean.mp4`. 검증 3종: 총 프레임 수, 경계 pts, 마지막 프레임 휘도(순백 255).
4. **믹스**: 나레이션 +8dB(피크 ≈ −3.5dB) + 베드 → `alimiter 0.95` → AAC 192k. `master_bgm.mp4`, `master_narration_only.mp4`.
5. **자막**(선택): ffmpeg에 libass가 없는 환경이 많아 **PIL로 컷별 PNG를 그려 `overlay enable='between(t,a,b)'` 체인으로 굽는다.** 컷 분할·줄나눔은 **자동이 어색**(“프론티어 / 모델”)하므로 `final/subs/manual_map.json`에 문장별로 수동 지정(`||` 컷 분리, ` / ` 줄바꿈). 타이밍은 words.json 단어 onset에 스냅. 스타일 기본값 = "8번"(Pretendard-Medium 46px, 검은 외곽선 1px, 옅은 그림자, 하단 중앙 margin 48). 배경이 흰 장표면 외곽선 2px 권장 — 스타일 후보표(10종)를 사용자에게 보여주고 고르게 한 전례 있음.
6. 산출: `final/master_bgm.mp4`, `master_narration_only.mp4`, `*_sub.mp4`, `subtitles.srt`, `contact_sheet.png`(24~28프레임 격자 — 사람 검수용).

## zsh 함정
스크립트에서 `$D[n]`은 **배열 첨자**로 읽혀 빈 값이 된다 → 필터 문자열 안에선 반드시 `${D}[n]`. (실제로 믹스가 통째로 실패했던 원인.)

## 출력 계약
`final/` 아래 위 파일들 + `final/build_all.sh` 재실행만으로 전부 재생성 가능해야 한다(슬라이드 하나만 고쳐도 한 명령).
