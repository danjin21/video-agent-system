# 섹션 설계 키트 (design/)

module2_init이 이 폴더를 프로젝트 `design/`에 복사합니다(이미 있으면 그대로 둠). 섹션 화면은 **Python 설계 스크립트**로 만들고, 스튜디오에서 미세 조정합니다.

## 파일
| 파일 | 역할 |
|---|---|
| `theme.json` | 디자인 키트 단일 출처: 색·글자 양식·모션 프리셋·부품. 스튜디오 '디자인 키트' 탭에서 고침 |
| `kit.py` | 짧은 표기: `text` `title` `chip` `dg`(부품) `broll` `bg_photo` `three` `T`(타이밍) `hl`(하이라이트) `chapter` `seven_board`/`with_seven` `save` |
| `sections_a.py` … | 챕터별 섹션 함수 `s01()`, `s02()` … (프로젝트마다 새로 씀) |
| `scenes_a.py` … | 한 장면에 화두 하나 버전으로 섹션을 **덮어쓰는** 스크립트(있으면 sections보다 나중에 실행) |
| `strategies.json` | (선택) 전략 카드판 항목 `[["이름","부제"], …]` |

## 섹션 함수 모양
```python
from kit import *

def s05():
    b, D = beats("s05")                 # 문장 시작 프레임 {'b1': 15, ...}, 섹션 길이
    els = [title("관리자산 성장"),        # 타이틀은 명사형만
           dg("el_bars", "bars", 140, 300, 1640, 600, {"bars": [...], "annotate": {"from": 0, "to": 1, "text": "+12%"}}),
           hl(text("el_q", 140, 200, 1640, 60, "어떤 환경이었는가", 38), "환경")]  # 말할 때 sweep
    tl = {"el_title": T(0, D, "fade-up", 15),
          "el_bars": T(b["b2"], D),
          "el_q": T(b["b1"], b["b2"], "fade", 12, "fade", 10)}
    save("s05", els, tl, "# s05 …스토리보드 메모")
```
- `save`가 layout.json·timeline.json을 쓰고 **edits.json을 비움**(스튜디오 미세조정은 설계 재실행 때 사라짐 → 고칠 건 설계 스크립트에 반영).
- 음성 길이가 바뀌면(`tts_voice.py --retime`, `voice_takes.py use`, `splice_real.py make`) **설계 스크립트를 다시 실행**해야 화면 타이밍이 따라옴.
- `word_at(sid, "b3", "낱말")` = 그 낱말이 들리는 프레임. 하이라이트·카드 뒤집기 등은 말에 맞춘다.

## 사용자 확정 규칙 (2026-11 경영전략회의)
- 모든 타이틀은 **명사형**(문장형 금지) 또는 없음. 구어체 군말("이제" 등) 금지.
- 강조·확대는 **한 요소에 한 번**. 같은 그래프가 두 번 올라가거나 두 번 커지지 않게(theme `beatAccent.enabled:false`).
- 하이라이트는 처음부터 강조색, 말하는 순간 흰 빛줄기 sweep. **파란 번짐(blur·glow) 금지.**
- 튀거나 흔들리는 등장 금지(`panels3.still`, `nodes` 기본 페이드).
- 시선은 화면 가운데: 쌓기는 가운데부터(`stackBuild.center`), 지도·도표도 가운데.
- 실사(b-roll)·아바타·남색 덮개 구간 위 마일스톤 바는 흰 선·흰 글자(assemble이 자동 계산).
