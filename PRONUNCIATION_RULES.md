# 발음 치환 룰 — 영문 약어 한글 발음 정책

## 왜

한국어 발표 영상에서 영문 약어(KODEX, ETF, AUM 등)를 그대로 TTS에 보내면
알파벳을 그대로 읽거나 영어 발음으로 처리해 매우 어색하다.
→ TTS 호출 직전, 텍스트만 한글 발음 표기로 치환한다.

## 적용 범위 (중요)

| 대상 | 치환? |
|---|---|
| TTS 호출 직전 텍스트 | ✅ 적용 |
| script.md (보존용 원본) | ❌ 원본 표기 유지 |
| 자막 (Remotion) | ❌ 원본 표기 유지 |
| 시각 자료 (장표 텍스트, 차트) | ❌ 원본 표기 유지 |

→ 사용자가 화면으로 보는 것은 모두 원본, **귀로 듣는 것만** 한글 발음.

## 매칭 규칙

- 단어 경계 `\b` 기준 매칭 (부분 일치 금지)
- **대소문자 구분** — 대문자 약어 원칙 (`ETF`는 치환, `etf`는 무시)
- 룰은 단순 1:1 문자열 매핑. 컨텍스트 분기 없음

## 기본 룰 (2026 ETF 보고자료 프로젝트 사이클 1에서 확정)

| 원문 | 한글 발음 |
|---|---|
| KODEX | 코덱스 |
| ETF | 이티에프 |
| AUM | 에이유엠 |
| AI | 에이아이 |
| TDF | 티디에프 |
| KOSPI | 코스피 |
| Fed | 에프이디 |
| TIGER | 타이거 |
| ACE | 에이스 |
| RISE | 라이즈 |
| SOL | 솔 |
| KB | 케이비 |

(`templates/pronunciation-rules.json.template` 에 JSON 형태로 동일 내용 보관)

## 프로젝트별 override

프로젝트마다 새 약어/도메인이 생긴다. 디폴트는 그대로 두고 프로젝트 폴더에서 override:

```bash
mkdir -p <project>/audio
cp /path/to/video-agent-system/templates/pronunciation-rules.json.template \
   <project>/audio/pronunciation-rules.json
# 필요한 약어 추가/수정
```

Supertone 에이전트는 다음 순서로 룰을 로드:
1. `<project>/audio/pronunciation-rules.json` (있으면 우선)
2. `templates/pronunciation-rules.json.template` (디폴트 fallback)

## 신규 약어 발견 시

스크립트에 새 영문 약어가 등장하면 (룰에 없는):
1. supertone 에이전트가 발견 → **AskUserQuestion으로 컨펌** (자동 추정 금지)
2. 사용자가 한글 표기 확정 → 프로젝트 룰 파일에 추가 → 재시도

자동 추정 금지 이유: `Fed` 같은 약어를 잘못 풀면 ("페드" vs "에프이디") 영상 톤이 무너진다. 비용 대비 컨펌 비용은 작다.

## 디버깅

- TTS 결과가 어색하면: 먼저 입력 텍스트 로그 확인 → 약어가 치환됐는지 검사
- 룰은 적용됐는데 발음이 이상하면: 룰의 한글 표기 자체 재검토 (예: `AI` → `에이아이` vs `에이 아이` 띄어쓰기 차이)
