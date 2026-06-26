# Video Agent System

경영전략회의 보고서를 영상으로 만드는 사이클 인지 에이전트 시스템.

## 무엇

사용자 → **메인 에이전트** → 13개 전문 서브에이전트로 구성. 한 번 만들고 끝이 아니라 **N번의 사이클**(스크립트 수정 → 영향 범위 자동 산출 → 최소 재작업)을 전제로 설계됨.

## 13개 서브에이전트

| 에이전트 | 책임 |
|---|---|
| `writer` | 전체 글 방향 + 페이싱 메타 + 비주얼 큐 인라인 스크립트 |
| `researcher` | 스크립트 내 fact의 근거 수집 |
| `verifier` | 수집 자료 검증 + 예상치/주장 구분 |
| `designer` | 디자인 베이스라인 1회 생성, 이후 참조 |
| `storyboarder` | 슬라이드 타입 결정 + 비주얼 큰 그림 |
| `layouter` | 장표 화면 구성 (좌표/사이즈) |
| `continuity` | 콘티 (프레임 단위 타임라인) |
| `supertone` | 슈퍼톤 API로 보이스 WAV 생성 |
| `avatar` | HeyGen API로 아바타 영상 생성 |
| `remotion` | 장표 애니메이션 영상(mp4) 빌드 |
| `bgm` | 엔바토에서 배경음 5곡 관리 |
| `video-source` | 엔바토에서 b-roll 다운로드 |
| `premiere` | 프리미어로 최종 짜집기 (EDL/XML export 단계까지) |

## 도구

- `tools/cycle_manager/` — 결정론적 사이클 매니저. 변경 감지 → stale 전파 → 비용 추정. 메인 에이전트가 호출.

## 설치 (Claude Code 플러그인)

### 방법 1: 로컬 폴더에서 세션마다 로드 (개발/테스트용)

```bash
cd /Users/sam/Documents/<영상 프로젝트>
claude --plugin-dir /Users/sam/agent/video-agent-system
```

세션 안에서:
```
main 에이전트로 영상 작업 시작
```

### 방법 2: 영구 설치 (팀 배포용)

Git 저장소로 만든 뒤:
```bash
# 마켓플레이스 생성 (한 번)
claude plugin marketplace add /path/to/your-marketplace.json

# 플러그인 설치
claude plugin install video-agent-system@your-marketplace
```

### 검증

```bash
claude --plugin-dir /Users/sam/agent/video-agent-system \
       plugin details video-agent-system
```

14개 에이전트 모두 등록되어야 함 (main + 13개 전문).

## 다음 단계 (이 패키지 사용 전)

1. 슈퍼톤 API 키 + 사용자별 voice_id 등록 (`~/.config/video-agents/secrets.env`)
2. 헤이젠 API 키 + 사용자별 avatar_id 등록
3. 엔바토 계정 (현재는 사람이 다운로드, 추후 API 자동화)
4. Remotion 프로젝트 경로 설정 (이미 `/Users/sam/Documents/remotion`)

## 핵심 원칙 (모든 에이전트 공통)

- **사이클 인지**: 모든 출력물은 `input_hash`를 같이 저장. 동일 입력 → 캐시 재사용.
- **버전 명시적**: `최최최종.wav` 같은 파일명 금지. `v1, v2, ...` + manifest가 current 지정.
- **에이전트 격리**: 다른 에이전트 작업물 수정 금지. 자기 폴더만 건드림.
- **사용자 체크포인트 5곳**: 스크립트 → 스토리보드 → 음성 샘플 → 리모션 렌더 → 프리미어 직전.
- **디자인 베이스라인 단일 소스**: `design-baseline.json` + 정본 `DESIGN.md`(HP 디자인 언어, 영상 오버라이드 포함)
