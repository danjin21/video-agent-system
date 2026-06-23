---
slide_id: "05"
slide_type: 본문_데이터
subtype: 표
version: 1
estimated_duration_s: 39
title: 혁신 기술의 뉴노멀化 기간
notes:
  - "표 5x5, AI 행 강조"
beat_count: 6
---

# 슬라이드 05 — 혁신 기술의 뉴노멀化 기간

## [beat-1] (~5s, 차분)

참고로 과거에 혁신기술이 뉴노멀이 되기까지

## [beat-2] (~4s)

PC는 15년에서 20년,
{cue: row[PC].highlight}

## [beat-3] (~4s)

인터넷 10년에서 15년,
{cue: row[인터넷].highlight}

## [beat-4] (~4s)

스마트폰 7년에서 8년 등 점점 소요기간이 짧아졌는데요.
{cue: row[스마트폰].highlight}

## [beat-5] (~3s, 호기심)

그럼 AI는 어떤 상황일까요?

## [beat-6] (~8s, 힘있게)

생성형 AI는 22년 탄생해 현재 대중화에 접어들었고,
도입 후 5, 6년 후인 27년에는 뉴노멀로 정착될 것 같습니다.
{cue: row[AI].highlight + amber_box + pulse}

---

## 페이싱 메타 문법

- `(~Ns, 톤)` — 슈퍼톤이 읽음. 톤: 차분 / 호기심 / 힘있게 / 결연 / 부드럽게 등
- `{cue: ...}` — 콘티가 읽음. 자유 형식이지만 일관성 유지

## Beat ID 안정성 룰

- 순서 기반 (beat-1, beat-2, ...)
- 사이클 N+1에서 순서 변경 시 글작가가 명시적 매핑 작성:
  ```
  ---
  beat_mapping:
    v1.beat-3 -> v2.beat-5  # 이동
    v2.beat-3: new          # 신규
  ---
  ```
