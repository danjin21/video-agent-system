# 사용자 상호작용 패턴

모든 사용자 질문 가능 에이전트가 따라야 할 공통 규칙.

## ⛔ 0순위 절대 규칙 — 모든 질문은 AskUserQuestion UI로만

사용자에게 무언가 물어볼 일이 생기면, **채팅 평문으로 묻는 것은 금지**다. 너의 **유일한 허용 행동은 `AskUserQuestion` 도구 호출**이다.

- 객관식이든 자유입력이든 **전부** AskUserQuestion으로 받는다.
- **자유 입력형 질문도 UI로**: 소속·주제·시간처럼 정답이 열린 질문도, 대표 옵션 2~4개를 제시하면 사용자는 자동 제공되는 **"Other" 칸에 직접 타이핑**한다. → 자유입력도 UI 안에서만 이뤄진다. (예: "소속이 어디세요?" → 옵션에 흔한 부서 몇 개 + Other 자유입력)
- **"~를 알려주세요 / 입력해 주세요" 같은 평문을 쓰고 답을 기다리지 말 것.** 그건 위반이다.
- 보고/진행상황 요약은 평문 OK. 하지만 **답을 받아야 하는 순간엔 무조건 AskUserQuestion**.

## 원칙

1. **꼭 필요할 때만 묻기** — 결정 권한이 사용자에게만 있는 경우 (취향/비용 발생/사실 확인). 그 외엔 디폴트로 진행하고 보고
2. **`AskUserQuestion` UI 도구 사용** — 자연어 평문 질문 금지. 구조화된 선택지로
3. **2~4개 옵션** — 너무 많으면 피곤
4. **"Other"는 자동 제공** — 사용자 자유 입력 가능하니 옵션에 직접 넣지 말 것
5. **추천 옵션은 첫 번째 + "(Recommended)"** — 사용자가 빨리 결정하도록

## AskUserQuestion 도구 사용 예

### 좋은 예 — 슬라이드 분할 결정 (storyboarder)

```json
{
  "questions": [{
    "question": "슬라이드 5는 65초 분량입니다. 어떻게 처리할까요?",
    "header": "분할 결정",
    "multiSelect": false,
    "options": [
      {"label": "5-1(곡선) + 5-2(표) 2개로 분할 (Recommended)",
       "description": "내용 모티프가 다르고 단일로는 길어 분할 권장"},
      {"label": "단일 슬라이드로 유지",
       "description": "카메라 줌으로 변주, 65초 단일 유지"},
      {"label": "내용 축약 후 단일",
       "description": "beat 일부 제거 또는 통합으로 40초로 단축"}
    ]
  }]
}
```

### 좋은 예 — 슈퍼톤 첫 sample 컨펌

```json
{
  "questions": [{
    "question": "첫 beat 음성 생성됐습니다. 보이스 톤/속도 OK?",
    "header": "음성 샘플",
    "multiSelect": false,
    "options": [
      {"label": "OK, 나머지 진행 (Recommended)",
       "description": "이대로 25개 beat 일괄 생성. ~$0.25"},
      {"label": "속도 조정 (느리게)",
       "description": "speed 0.7 → 0.6, 다시 sample 생성"},
      {"label": "속도 조정 (빠르게)",
       "description": "speed 0.7 → 0.8, 다시 sample 생성"},
      {"label": "보이스 재학습 필요",
       "description": "톤이 본인과 다름 → 슈퍼톤 재녹음 가이드 제공"}
    ]
  }]
}
```

### 좋은 예 — 체크포인트 모드 (main 첫 대화)

```json
{
  "questions": [{
    "question": "이번 영상은 어느 모드로 진행할까요?",
    "header": "체크포인트 모드",
    "multiSelect": false,
    "options": [
      {"label": "표준 (Recommended)",
       "description": "스크립트/스토리보드/음성샘플/리모션/최종 5단계 컨펌"},
      {"label": "빠른",
       "description": "스크립트 + 최종본 2단계만. 발표 임박 시"},
      {"label": "정밀",
       "description": "매 핸드오프마다 컨펌. 시범 운영 초반에 유용"}
    ]
  }]
}
```

### 좋은 예 — BGM 선곡 (bgm, multiSelect)

```json
{
  "questions": [{
    "question": "엔바토에서 추천 BGM 5곡 찾았습니다. 어떤 톤 가져갈까요?",
    "header": "BGM 톤 선택",
    "multiSelect": true,
    "options": [
      {"label": "Corporate uplifting", "description": "밝고 진취적, 인트로/마무리"},
      {"label": "Modern business",     "description": "차분, 본문 차트 슬라이드"},
      {"label": "Cinematic reveal",    "description": "임팩트, 키워드 등장"},
      {"label": "Ambient calm",        "description": "조용, 반성/회고"},
      {"label": "Strong finale",       "description": "결연, 마지막 wrap-up"}
    ]
  }]
}
```

## 안 좋은 예 (피해야 할 것)

❌ **평문 질문**
```
"슬라이드 분할할까요?"
```
→ 사용자가 "어떻게요?"라고 되물음, 비효율적.

❌ **너무 추상적인 옵션**
```
- 옵션 A
- 옵션 B
- 옵션 C
```
→ 각 옵션이 뭔지 description 없으면 결정 불가.

❌ **5개 이상 옵션**
```
- 옵션 1, 옵션 2, ..., 옵션 7
```
→ 피곤함. 묶거나 재구성.

❌ **"Other" 옵션 직접 추가**
→ AskUserQuestion이 자동 제공. 중복.

❌ **모든 단계마다 묻기**
```
beat-1 생성 시작할까요? OK
beat-2 생성 시작할까요? OK
...
```
→ 한 번에 묶어서 묻기. "전체 25개 beat 생성, 비용 $0.25, 진행?"

## 도구 선언

질문 가능 에이전트는 frontmatter `tools:` 에 반드시 포함:

```yaml
tools: Read, Write, Edit, AskUserQuestion, ...
```

## 질문 후 처리

- 사용자 답변 받으면 manifest에 결정 기록 (`decisions: [...]`)
- 같은 질문 다시 묻지 말 것 (이미 결정된 사항)
- 사이클 N+1에서 사용자가 명시적으로 바꾸려 할 때만 재질문
