# Video Project File Structure

신규 영상 프로젝트는 이 구조로 시작한다.

```
<프로젝트명>/                          # 예: 2026-H2-전략회의
  manifest.json                       # 단일 진실 소스. 사이클/슬라이드/현재 버전
  design-baseline.json                # 1회 생성, semver
  global_assets/
    logo.png
    fonts/
    bgm-pool/                         # 5곡 정도
  
  slide-NN/                           # NN = 슬라이드 번호 (01, 02, ...)
    manifest.json                     # 이 슬라이드 내부 상태
    
    01-script/
      v1.md  v1.input_hash
      v2.md  v2.input_hash            # 사이클별 누적
    
    02-research/
      facts.json
      verified.json
    
    03-storyboard-conti/
      storyboard.yaml
      layout.json
      beat_plan.yaml                  # 콘티 planning 패스 결과
      conti.yaml                      # 콘티 realization 패스 결과 (프레임 단위)
    
    04-audio/
      beat-1.wav  beat-1.input_hash
      beat-2.wav  beat-2.input_hash
      duration_manifest.json          # 각 wav 실측 길이
    
    05-remotion/
      <CompositionName>.tsx
      slide-NN.mp4  slide-NN.input_hash
      _archive/
        slide-NN.cycle1.mp4
        slide-NN.cycle2.mp4
    
    06-avatar/                        # 인물 슬라이드만
      avatar.mp4  avatar.input_hash
    
    07-broll/                         # 영상소스 사용 시
      broll.mp4
  
  premiere/
    project.prproj
    timeline.edl
    clip_map.json                     # slide.mp4 ↔ 시퀀스 매핑
  
  final/
    cycle1.mp4
    cycle2.mp4
    cycle_current.mp4                 # symlink to latest
```

## manifest.json (프로젝트 루트)

```json
{
  "project": "2026-H2-전략회의",
  "created": "2026-06-23",
  "current_cycle": 3,
  "design_baseline": "v1.2",
  "modes": { "checkpoint": "표준" },
  "cycles": [
    {
      "n": 1,
      "date": "2026-06-10",
      "trigger": "최초 제작",
      "scope": "all"
    },
    {
      "n": 2,
      "date": "2026-06-15",
      "trigger": "리더 1차 피드백",
      "scope": ["slide-05", "slide-12", "slide-19"]
    },
    {
      "n": 3,
      "date": "2026-06-20",
      "trigger": "데이터 정정",
      "scope": ["slide-15.data"]
    }
  ],
  "slides": {
    "05": {
      "type": "본문_데이터",
      "subtype": "표",
      "title": "혁신 기술의 뉴노멀化 기간",
      "current_versions": {
        "script": "v3",
        "audio_set": "v3",
        "remotion_mp4": "v3",
        "in_premiere": "v3"
      },
      "status": "stable"
    }
  }
}
```

## manifest.json (slide-NN/)

```json
{
  "slide_id": "05",
  "type": "본문_데이터",
  "subtype": "표",
  "current": {
    "script": "01-script/v3.md",
    "storyboard": "03-storyboard-conti/storyboard.yaml",
    "layout": "03-storyboard-conti/layout.json",
    "beat_plan": "03-storyboard-conti/beat_plan.yaml",
    "conti": "03-storyboard-conti/conti.yaml",
    "audio_set": "04-audio/",
    "remotion_mp4": "05-remotion/slide-05.mp4"
  },
  "beats": {
    "1": { "wav": "04-audio/beat-1.wav", "duration_s": 4.8 },
    "2": { "wav": "04-audio/beat-2.wav", "duration_s": 4.2 },
    "3": { "wav": "04-audio/beat-3.wav", "duration_s": 4.5 },
    "4": { "wav": "04-audio/beat-4.wav", "duration_s": 4.6 },
    "5": { "wav": "04-audio/beat-5.wav", "duration_s": 3.1 },
    "6": { "wav": "04-audio/beat-6.wav", "duration_s": 8.2 }
  },
  "status": "stable"
}
```
