# 다이어그램 키트 — 인포 다이어그램 컴포넌트 + 레시피

> 개념을 **글자가 아니라 그림(도형)** 으로 푸는 재사용 컴포넌트. CFO 영상(2026-06)에서 검증된 양식.
> **사용법:** 새 Remotion 덱을 만들 때 이 폴더의 `Diagrams.tsx`·`Dynamics.tsx`를 `codex-workspace/<deck>/`에 복사하고 import. HP 톤(블루 `#024ad8`/화이트/코랄 `#ff5050`, Pretendard) 내장.
> **타이밍:** 모든 등장 프레임은 **ASR 단어 타임스탬프**(`sync_qa.py --asr`)에 바인딩. 추정 금지. 역동성 = "느린 한 개"가 아니라 "빠른 여러 개(pop ≤0.7s)".

## 컴포넌트 레퍼런스 (`Diagrams.tsx`)
| export | 용도 | 핵심 props |
|---|---|---|
| `Node` | 원+아이콘/글리프+라벨, pop 등장→activeAt에 채움 | `x,y,r,start,activeAt,icon|glyph,label,sub,surface` |
| `Connector` | 두 점 사이 선/화살표 draw | `x1,y1,x2,y2,start,color,arrow` |
| `Icon` | 의미 우선 라인 픽토그램 | `name`(dumbbell·robot·chip·drop·person·people·flag·building·trend·shield)`,size,color` |
| `GhostWord` | 강조어를 배경/옆 대형 옅게 | `text,start,side(center|left|right),size,maxOpacity` |
| `Reservoir` | 저수지: 분지+유입 물방울+수위 상승 | `x,y,w,h,start,fillStart,fillEnd,onBlue,label` |
| `RollingBall` | 기울어진 운동장: 공이 회전하며 구름+폭 축소 | `start,width,tiltDeg,shrinkStart,shrinkEnd,shrinkTo` |
| `ConvergeCurves` | N개 곡선이 한 점으로 수렴 | `items:[{name,q,y,at}],conv:{x,y},convAt,surface` |
| `ConcentricRings` | 동심원 확장(공공→민간→개인) | `cx,cy,rings:[{label,r,at}],surface` |
| `ContrastPair` | A vs B 대비(두 노드 + 'vs') | `left,right({glyph|icon,label,sub,start,activeAt,fill}),y,r,cx,gap,vsAt` |
| `Banner` | 하단 배너 (pop + 흰 shine 스윕) | `text,start,onBlue` |
| `Header` | 상단 kicker + 타이틀 | `kicker,title,onBlue` |
| `KeywordReveal` | 결정타 단어 대형 글자 스태거 (AX·결정·실행) | `text,start,surface,size,perLetter` |

`Dynamics.tsx`: `CountUp`(숫자 카운트업+pop) · `GrowCircle`(면적∝값 성장 원+중앙 카운트업) · `TiltField`(운동장 정적판) · 헬퍼 `pop`/`appear`.

## 시그니처 다이어그램 레시피 (코드 없어도 재현 가능하게)
- **저수지 = 모이는 자금** (`Reservoir`): U자 분지(INK stroke) + 위에서 떨어지는 물방울 3줄(반복 낙하) + 수위가 `fillStart→fillEnd`에 차오름 + 라벨 칩. 파란 배경이면 `onBlue`(흰 분지/연한 물).
- **세 곡선 → 하나의 결정** (`ConvergeCurves`): 좌측 staggered 높이에서 출발한 곡선들이 우측 한 점(`conv`)으로 수렴. 각 곡선/라벨이 그 개념 단어 발화(`at`)에 그려지며 점등 → `convAt`에 수렴 노드 pop. 그 뒤 "지금" 세로선·"결정" 키워드는 슬라이드에서 오버레이.
- **노드 체인** (`Node`+`Connector`): 개념 단계를 원 노드로 나열, 단어 발화 순서로 등장하며 사이를 커넥터가 draw(예: 수익률→신뢰→자산, 전담조직→역량→접점).
- **대비 (A vs B)** (`ContrastPair`): 좌=달성(blue ✓ glyph), 우=과제(coral ? glyph), 가운데 "vs". 뒤이어 변환 화살표(`Connector`)로 "A→B"(양적→질적). 사용자 확정 호평 양식(2026-06).
- **⭐ 노드 버블 등장 모션** (`Node`의 핵심 — 사용자 특히 호평): 회색 윤곽 → `activeAt`에 색(blue/coral) 채워지며 아이콘이 흰색으로, scale `0.6→1.08→1`로 **커졌다 작아지는 버블 pop**. 모든 노드 등장의 표준 모션. start≈activeAt로 두면 "등장+버블+점등"이 한 번에.
- **하단 배너** (`Banner`): 파란 라운드 바가 pop(0.92→1.06→1) + 흰 shine이 1회 스윕. 결과/코멘트 한 줄(체언 종결).
- **대형 키워드 리빌** (`KeywordReveal`): 결정타 단어(AX·결정·실행)를 화면 가득, 글자별 stagger scale-pop. 콘텐츠 비우고 단어만.
- **동심원 확장** (`ConcentricRings`): 안쪽(공공)→바깥(개인)으로 영역이 넓어짐. 각 링이 발화에 pop.
- **구르는 운동장** (`RollingBall`): 공이 회전(spin)하며 굴러가고, `shrink`구간에 운동장 폭이 줄며 공이 낮은 끝으로. "기울어진/좁아지는 시장" 은유.
- **큰 숫자** (`GrowCircle`+`CountUp`): 면적이 값에 비례하는 원 + 중앙 카운트업, 수치 발화 순간 정착(예: 432→501조).

## 패턴 ↔ 컴포넌트 매핑
`templates/expression-patterns.json`의 패턴 id가 어떤 컴포넌트로 구현되는지: `metaphor_motion`→Reservoir/RollingBall, `node_highlight`→Node, `connector_draw`→Connector, `count_up`→CountUp/GrowCircle, `ghost_emphasis`→GhostWord, `marker_point`→SVG circle/text, `keyword_reveal`→대형 텍스트 스태거. **수렴/동심원**은 `ConvergeCurves`/`ConcentricRings`.

## 확장
새 개념이 기존 컴포넌트로 안 되면 이 파일에 **새 컴포넌트를 추가**하고(HP 톤·pop 등장·ASR 바인딩 규칙 준수) 위 표·레시피·`expression-patterns.json`에 등록한다. 사용자가 좋아한 양식은 반드시 컴포넌트로 승격(인라인 1회성으로 두지 말 것 — 2026-06 ConvergeCurves가 인라인이라 재사용 불가했던 사례).
