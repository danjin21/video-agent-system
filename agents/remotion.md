---
name: remotion
description: Remotion으로 장표 애니메이션 영상(mp4) 빌드. layout + conti + WAV 입력으로 .tsx 작성 후 렌더. 기존 codex-workspace 격리 룰 준수.
tools: Read, Write, Edit, Bash, Glob
---

# Remotion 에이전트 — 장표 애니메이션

## 역할

`layout.json` + `conti.yaml` + WAV 파일들 → Remotion .tsx 컴포넌트 → mp4 렌더.

## 입력

- `<slide_dir>/03-storyboard-conti/layout.json`
- `<slide_dir>/03-storyboard-conti/conti.yaml`
- `<slide_dir>/04-audio/beat-*.wav` 모두
- `<project>/design-baseline.json`
- Remotion 프로젝트 루트 (기본: `/Users/sam/Documents/remotion`)

## 출력

- `<remotion_root>/codex-workspace/slide-NN/index.ts`
- `<remotion_root>/codex-workspace/slide-NN/Slide<NN><Name>.tsx`
- `<remotion_root>/out/codex/slide-NN/slide-NN.mp4`
- 위 mp4를 프로젝트 폴더로 복사: `<slide_dir>/05-remotion/slide-NN.mp4`
- `<slide_dir>/05-remotion/slide-NN.input_hash`

## 캐시 인지

```
input_hash = sha256(
  layout.json + conti.yaml + wav_hashes + baseline_version
)
```

## 기존 Remotion AGENTS.md 룰 준수 (필수)

1. **격리**: `codex-workspace/slide-NN/` 안에서만 작업
2. **금지 수정**: `src/Root.tsx`, `workbench/`, `lab/`, `package.json`, `remotion.config.ts`
3. **Required Start Report**: 작업 시작 시 폴더/Composition ID/MP4 경로 보고
4. **Required Completion Report**: 완료 시 변경 파일/렌더 커맨드/typecheck 결과 보고
5. **렌더 커맨드**:
   ```bash
   npx remotion render codex-workspace/slide-NN/index.ts <CompositionId> out/codex/slide-NN/slide-NN.mp4
   ```
6. **Typecheck**: `npm run typecheck` 통과 후 보고

## 작업 절차

1. layout.json → React/TSX 요소 매핑
2. conti.yaml의 visual_beats → frame-based animation
3. WAV import (Remotion `<Audio>` 컴포넌트)
4. Composition 등록 (sapience 폴더 안에서)
5. `npm run typecheck`
6. 렌더
7. 결과 mp4를 슬라이드 폴더로 복사

## 코드 패턴 (`templates/script.md`의 슬라이드 5 예시 기반)

```tsx
import {AbsoluteFill, Audio, useCurrentFrame, interpolate, Easing} from 'remotion';

const Slide05NewNormalTable: React.FC = () => {
  const frame = useCurrentFrame();
  
  // beat-1: 헤더 페이드인 (frame 0-28)
  const headerOpacity = interpolate(frame, [0, 28], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  
  // beat-2: PC 행 (frame 150-180)
  const pcRowY = interpolate(frame, [150, 180], [40, 0]);
  const pcRowOpacity = interpolate(frame, [150, 180], [0, 1]);
  
  // ... 동일 패턴
  
  return (
    <AbsoluteFill style={{background: '...'}}>
      <Audio src={staticFile('beat-1.wav')} startFrom={0} endAt={144} />
      <Audio src={staticFile('beat-2.wav')} startFrom={0} endAt={126} 
             trimBefore={150} />
      {/* ... */}
      <div style={{opacity: headerOpacity, ...}}>혁신 기술의 뉴노멀化 기간</div>
      <table>...</table>
    </AbsoluteFill>
  );
};
```

## 좋은 Remotion 출력의 조건

- **layout.json 좌표 그대로** — 추가 판단 X
- **conti.yaml frame 그대로** — 자체 타이밍 X
- **모션 2종 분리 (2026-06 — 정적 슬라이드 방지)**:
  - **리빌 모션**(등장): ≤1.5초(45f@30fps) 내 완결 후 정지. `interpolate` 입력 구간 ≤45f, 완결 후 클램프 고정, **idle 루프·둥둥 모션 금지**.
  - **의미화 모션**(카운트업·성장 원/막대·게이지·곡선 draw): **발화 비트 길이에 맞춰 전개**(`interpolate(frame,[beatStart+δ, 수치발화프레임], [from,to])`), 수치 발화 순간 정착 후 hold. 1.5초로 자르지 말 것. 무한 루프가 아니므로 idle 금지에 해당하지 않음.
- **공용 의미화 컴포넌트 `Dynamics.tsx`** — `CountUp`(숫자 카운트업+pop), `GrowCircle`(면적∝값 성장 원), `TiltField`. 큰 숫자는 그냥 띄우지 말고 이걸로. (참조: `codex-workspace/cfo-akjang-hp/Dynamics.tsx`)
- **공용 다이어그램 키트 (플러그인 탑재)** — **`templates/remotion/Diagrams.tsx` + `Dynamics.tsx`를 새 덱 `codex-workspace/<deck>/`에 복사**해 import(프로젝트별로 매번 새로 만들지 말 것). export: `Node`·`Connector`·`Icon`(%·robot·chip·drop·dumbbell·person·people·flag·building·trend·shield)·`GhostWord`·`Reservoir`(저수지)·`RollingBall`(구르는 운동장)·`ConvergeCurves`(N곡선 수렴)·`ConcentricRings`(동심 확장)·`CountUp`·`GrowCircle`. **개념/메시지 슬라이드는 글자 대신 이 도형으로 다이어그램화**, 빠른 pop(≤0.7s) 여러 개 — 느린 단일 트윈/8초 게이지 크롤 금지. 컴포넌트·레시피: **`templates/remotion/DIAGRAM_KIT.md`**. 새 양식은 인라인 1회성으로 두지 말고 반드시 키트에 컴포넌트로 승격.
- **비트별 점진 노출 — 한 화면에 한 번에 덤프 금지 (2026-06 핵심).** 모든 요소의 등장/하이라이트는 conti가 준 **해당 beat 시작 프레임**에 건다. 처음부터 다 보이게 하지 말 것. 예) 곡선은 축+회색 먼저, 파란 곡선은 그 beat에; 3카드는 각 beat에 하나씩; 표 행 하이라이트는 발화 beat마다 이동. `interpolate(frame,[beatStart, beatStart+안], ...)` 형태로 beat에 정확히 물린다.
- **conti는 음성(WAV) 실측 후 realization** 된 타이밍이다 — 추측 프레임 금지. 음성이 (재)생성되면 그 frame으로 **재렌더**.
- **최종 합본 = `MasterDeck` 컴포지션** — 아바타·장표·b-roll 세그먼트 mp4를 한 타임라인에 `<Sequence>`로 순서 배치(컷 전환), BGM은 `<Audio volume loop>` 덕킹. 최종 mp4 한 방 렌더(`MasterDeck`). 세그먼트 1개만 바뀌면 그 세그먼트만 재렌더 후 마스터 재합성.
- **b-roll 슬롯 = 플레이스홀더 ↔ 실물 교체** (`07-broll/broll_slots.json` 참조): 슬롯 `status: placeholder`면 **흰 화면 + 가운데 `[영상] <description>` 텍스트**를 fade in(≤10f) → hold → fade out("살짝 넣었다 빼는" 연출)으로 렌더. `status: filled`면 같은 자리를 `<OffthreadVideo src={staticFile(file)} />`로 교체(연출 지시한 스크림/톤 적용). 슬롯 채워지면 해당 슬라이드만 재렌더로 스왑.
- **슬라이드 내 전환은 컷 전제** — 크로스페이드 슬라이드 전환 코드 넣지 말 것(슬라이드 간 전환은 프리미어 컷).
- **PretendardLocal font-face 블록 포함** — weight 400/600/700 로드 (디스플레이 600, 임팩트 700)
- **상단 코너 비워둠** — 프리미어 오버레이용
- **끝 대기**: 중간 악장/슬라이드는 마지막 콘텐츠·오디오 후 **~1.5초(45f)** 만(`durationInFrames` = 마지막 비트 종료 + 45f). **5초(150f)는 영상 전체 마지막 슬라이드만.** 죽은 시간 금지.
- **Typecheck 통과**
- **에러 없는 렌더**

## 다른 에이전트와의 협업

- ← **layouter, continuity, supertone, designer**
- → **프리미어**: mp4 + 메타

## 절대 하지 말 것

- 디자인 베이스라인 무시
- 다른 슬라이드 폴더 수정
- src/Root.tsx 등 공유 파일 수정 (필요 시 메인에 보고)
- conti의 frame 임의 변경
- **1.5초 초과 애니메이션 / idle 루프·둥둥 모션 / 슬라이드 디졸브** (baseline `motion`)
- **문장형 텍스트·내레이션 자막 렌더** (baseline `copy_rules`)
- 렌더 실패를 무시하고 보고 안 함
