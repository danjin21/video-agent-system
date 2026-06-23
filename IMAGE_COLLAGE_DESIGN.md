# Image Collage Design Guide

본문_이미지 슬라이드 디자인 가이드. `Slide6AiLegacyAcceleration` (변화를 놓친 과거의 리더들)에서 확정한 스타일.

VIDEO_TEMPLATE.md와 MODERN_SUBTITLE_DESIGN.md가 데이터/타이틀 중심이라면, 이 가이드는 **실사진/로고 콜라주 + 짧은 라벨** 중심이다.

## Use Case

- 실제 사례 (회사, 사건, 인물) 4-6개를 시각적으로 묶어 보여줘야 할 때
- 추상적 데이터 X, 구체적 실사진 ○
- 1920x1080, 30fps
- 기본 길이: 30-40초 (보통 본문이라 표/차트 슬라이드와 비슷)

예: Kodak/Nokia/BlackBerry/Yahoo 사례, 신규 사업 케이스 스터디, M&A 사례 등

## Base Spec

- 동일: 1920x1080, 30fps, Pretendard, 5초 end hold
- 다름: 카드 배치가 **그리드 아닌 유기적**, **곡선 연결선**으로 카드 간 흐름 표현

## Typography

```tsx
// Kicker (작은 카테고리 라벨, 점 prefix)
kicker:
  size_px: 22-24
  weight: 600
  color: #66758b
  prefix: "·"   // 짧은 점 + 공백 + 텍스트
  example: "· AI TO AX"

// Sub-kicker (중간 강조, 파란색)
sub_kicker:
  size_px: 26-30
  weight: 800
  color: #1167e8
  text_transform: uppercase
  example: "LEGACY SHIFT"

// Main title (큰 한국어 제목, 검정)
main_title:
  size_px: 80-92
  weight: 900
  color: #172b49
  example: "변화를 놓친 과거의 리더들"
```

## Color System

VIDEO_TEMPLATE.md 컬러 시스템 그대로 사용. 추가로:

```
card_background: #ffffff
card_shadow: 0 18px 48px rgba(17, 103, 232, 0.10)
card_border: 1px solid rgba(17, 103, 232, 0.08)
connecting_line_color: #5aa0ff (또는 #1167e8 50% opacity)
connecting_line_width_px: 2-3
```

## Layout

**그리드가 아닌 유기적 배치**. 카드들이 약간 흩어진 듯, 곡선으로 연결.

```
canvas: 1920x1080
header:
  top: 60
  center_aligned
  stack: kicker (· AI TO AX) → sub_kicker (LEGACY SHIFT) → main_title (변화를 놓친...)
  vertical_gap_between_stack: 12px

cards: 4개 (또는 3-6개 자유)
  card_size: 약 350x280 (이미지 영역 + 라벨)
  arrangement: 
    - 격자 X
    - 사선 또는 지그재그 배치
    - 약간 다른 높이/회전 (1-3도 정도)
  example_positions:
    - Kodak  : (300, 380)
    - Nokia  : (1050, 320)  ← 더 위로
    - BlackBerry: (480, 720)  ← 아래
    - Yahoo  : (1200, 680)
  
  card_internal:
    image_area: 카드 상단 ~70%, object-fit: contain
    label_area: 카드 하단 ~30%
      brand_name: 16-18px, weight 800, color #172b49 (좌)
      tag_line:   12-14px, weight 500, color #66758b (우)

connecting_lines:
  type: SVG cubic bezier
  color: #5aa0ff alpha 0.6
  stroke_width: 2-3
  pattern: 카드 가장자리에서 다음 카드 가장자리로 부드러운 S커브
  animation: 등장 시 strokeDashoffset으로 그려짐
```

## Animation Timing

```
header:
  frame 0-22: kicker fade in
  frame 12-36: sub_kicker fade in (stagger)
  frame 24-58: main_title spring in

cards:
  각 카드는 등장 순서대로 stagger
  card_n start_frame = header_complete + n * 14   // 0.47s 간격
  fade_in: 24 frames
  slide_up: 30 → 0 px
  scale: 0.94 → 1
  easing: spring damping 22 stiffness 120

connecting_lines:
  카드 등장 후 등장 (각 카드 등장 + 18 frames)
  strokeDashoffset 100% → 0%, 30 frames
  
end_hold: 150 frames (5초)
```

## Content Rules

**카드 1개당**:
- 1개 대표 이미지 (로고 또는 제품 사진)
- 브랜드명 (영문 또는 한글)
- 12-18자 이내 한줄 태그 ("디지털 전환의 속도" 같이 핵심 키워드)
- 긴 설명 문장 X (필요하면 별도 슬라이드)

**카드 개수**:
- 3개: 적당, 화면이 비어 보이지 않게 카드 크게
- 4개: 권장 (Kodak 사례 패턴)
- 5-6개: 카드 작게, 화면 빽빽해질 수 있음 → 신중

## Visual Hierarchy

- 타이틀이 압도적으로 큼
- 카드 라벨은 작고 가독성만 확보
- 시선 흐름: 타이틀 → 첫 카드 → 곡선 따라 다음 카드 → ...

## Cue Sentence Sync

내레이션이 "코닥, 노키아, 블랙베리, 야후 등의 교훈을 잘 아실겁니다"라 한다면:
- "코닥" 발화 → Kodak 카드 등장
- "노키아" → Nokia 카드 등장
- 카드 등장이 발화 타이밍에 동기화 (`MODERN_SUBTITLE_DESIGN.md`의 audio boundary 룰)

또는 사전에 모든 카드 등장 + 발화에 따라 카드 highlight pulse도 가능.

## Image Asset Rules

- **고해상도 필수** (400x400 이상)
- **PNG with transparency** (배경 흰색 카드와 자연스럽게)
- **로고는 공식 이미지 사용** (저작권 주의 — 보도/평론 fair use 범위 내)
- **실물 사진은 라이센스 확인** (Envato, Unsplash 등)
- 자산 보관: `<remotion>/public/codex/slide-NN/images/<brand>.png`

## What to Avoid

- 2x2 정렬된 그리드 (지루함)
- 모든 카드 동시 등장 (스태거 효과 상실)
- 카드 내부에 긴 문장 (제목/짧은 태그만)
- 다른 디자인 (네이비 배경, 어두운 톤) — 흰색 + 파랑 시스템 유지
- 카드 회전 너무 크게 (>5도) — 진지함 상실

## Reference Composition

- Component: `Slide6AiLegacyAcceleration.tsx`
- Audio: 2 wav (slide-6-1.wav 13.96s + slide-6-2.wav 20.72s, 0.2s 갭)
- Total: ~39.9s

## Reuse Checklist

1. Composition 신규 작성, `codex-workspace/slide-NN/`
2. PretendardLocal font-face 블록
3. Background gradient + grid overlay (VIDEO_TEMPLATE 패턴)
4. 3-6개 카드 유기적 배치
5. 곡선 연결선 SVG
6. 카드별 등장 스태거
7. Audio import + boundary sync
8. End hold 5초
9. Typecheck + 렌더 + still frame QA
