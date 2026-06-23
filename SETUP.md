# Setup Guide

영상 에이전트 시스템 초기 셋업.

## 사전 준비물

- macOS (Apple Silicon 권장)
- Claude Code CLI 설치
- Homebrew
- Node.js 20+ (Remotion 용)
- Python 3.9+

## 1단계: 시스템 의존성

```bash
# ffmpeg (오디오 길이 측정, 영상 분석)
brew install ffmpeg

# Python 패키지
pip3 install --user pyyaml

# (선택) jq — JSON 처리
brew install jq
```

## 2단계: Secrets 설정

```bash
mkdir -p ~/.config/video-agents
cp /Users/sam/agent/video-agent-system/templates/secrets.env.template \
   ~/.config/video-agents/secrets.env
chmod 600 ~/.config/video-agents/secrets.env

# 편집기로 키 입력
open -e ~/.config/video-agents/secrets.env
```

### SuperTone 가입 + 보이스 등록

1. https://supertone.ai 가입
2. 콘솔 > API > API Key 발급 → `SUPERTONE_API_KEY`에 입력
3. Voice Cloning 메뉴 > 본인 녹음 업로드:
   - **녹음 환경**: 조용한 방, 마이크 직접 (이어폰 마이크 금지)
   - **길이**: 1분 30초~2분
   - **내용**: 평소 발표 톤. 가급적 다양한 음운 포함 (예: 표준어 + 숫자 + 영어 발음)
   - 추천 대본 (직접 작성하거나 본인 발표대본 일부 사용):
     ```
     안녕하십니까. 이번 발표에서는 우리 회사의 전략 방향을
     세 가지 키워드로 정리해 보겠습니다. 첫째 혁신, 둘째 성장,
     셋째 글로벌입니다. 작년 매출은 2,632억 원으로 전년 대비
     78% 성장했으며, AI 도입은 27년 뉴노멀로 정착될 전망입니다.
     ...
     ```
4. 생성된 Voice ID → `SUPERTONE_VOICE_ID`에 입력

### HeyGen 가입 + 아바타 등록

1. https://heygen.com 가입
2. API Settings > Generate API Key → `HEYGEN_API_KEY`
3. Studio > Avatars:
   - **Instant Avatar**: 2분 영상 업로드 → 5분 내 생성 (저렴, 권장)
   - **Studio Avatar**: 1시간 녹화 (고품질, 비쌈)
4. 생성된 Avatar ID → `HEYGEN_AVATAR_ID`

### Envato

현재 MVP는 사람이 직접 다운로드. API 키는 비워두고 진행 가능. 추후 자동화.

## 3단계: 에이전트 설치

```bash
# 영상 프로젝트 만들 곳에서:
cd /Users/sam/Documents
mkdir -p 2026-H2-전략회의/.claude
cd 2026-H2-전략회의

# 에이전트 심볼릭 링크
ln -s /Users/sam/agent/video-agent-system/agents .claude/agents

# manifest 초기화
cp /Users/sam/agent/video-agent-system/templates/manifest.json manifest.json
# 편집해서 프로젝트명/날짜 입력
```

## 4단계: Remotion 프로젝트 연결

```bash
# 이미 있음:
ls /Users/sam/Documents/remotion

# 에이전트가 거기에 codex-workspace/slide-NN/ 만들 수 있는지 확인
cd /Users/sam/Documents/remotion
npm install         # 처음만
npm run typecheck   # 통과 확인
```

## 5단계: cycle_manager 동작 확인

```bash
python3 /Users/sam/agent/video-agent-system/tools/cycle_manager/cycle_manager.py \
        status /Users/sam/Documents/2026-H2-전략회의
```

`현재 사이클: 1` 표시되면 성공.

## 6단계: Claude Code에서 메인 에이전트 첫 호출

영상 프로젝트 폴더에서 Claude Code 실행:

```bash
cd /Users/sam/Documents/2026-H2-전략회의
claude  # Claude Code CLI 시작
```

대화창에서:
```
main 에이전트로 신규 영상 작업 시작해줘.
입력물:
- PPT: /path/to/원본.pptx
- 발표대본: /path/to/대본.docx
체크포인트 모드: 표준
```

메인 에이전트가 5단계 체크포인트로 안내합니다.

## 트러블슈팅

### `ModuleNotFoundError: No module named 'yaml'`
```bash
pip3 install --user pyyaml
```

### `ffprobe not found`
```bash
brew install ffmpeg
```

### `npx remotion render` 실패
```bash
cd /Users/sam/Documents/remotion
npm install
npm run typecheck
```

### 메인 에이전트가 서브에이전트를 못 찾음
`.claude/agents` 심볼릭 링크 확인:
```bash
ls -la .claude/agents
```

깨졌으면 다시:
```bash
rm .claude/agents
ln -s /Users/sam/agent/video-agent-system/agents .claude/agents
```

### SuperTone API 응답 포맷이 spec과 다름
SuperTone API는 시기에 따라 변경 가능. `supertone.md`의 curl 예시는 참고용. 첫 호출 시 실제 응답 보고 파서 조정.

## 다음 사이클 (사이클 N+1)

같은 폴더에서:
```
main에게: "슬라이드 10이랑 19 피드백 받았어. [내용 붙여넣기]"
```

메인이 자동으로 cycle_manager.plan 호출 → 영향 범위 보고 → OK 받고 진행.

## 백업 권장

- `manifest.json`은 자주 백업 (시간 여행에 필수)
- `slide-*/05-remotion/_archive/` 자동 백업되지만 외장 드라이브에도 주기적 복사
- `final/cycle-*.mp4` 다 보관
