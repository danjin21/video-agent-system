# Cycle Manager

메인 에이전트가 호출하는 결정론적 도구. LLM 아님.

## 책임

1. **변경 감지** — 사이클 N+1 입력 vs N 현재 상태 diff
2. **Stale 전파** — 의존성 그래프 traversal로 영향 노드 산출
3. **비용 추정** — `unit_costs` 룩업 합산
4. **실행 계획 생성** — 메인 에이전트가 사용자에게 보여줄 리포트
5. **상태 업데이트** — 실행 완료 후 manifest 갱신, 사이클 번호 증분

## 호출 패턴

### `cycle-manager status`
현재 프로젝트의 슬라이드별 상태 요약.

### `cycle-manager plan <change-spec>`

입력 형태:
1. **새 스크립트 파일**: `cycle-manager plan --script slide-05/01-script/v3.md`
2. **자연어 지시**: `cycle-manager plan --instruction "슬라이드 10 그래프 빨강으로"` (글작가 에이전트에 위임 → 새 스크립트 → diff)
3. **직접 노드 지정**: `cycle-manager plan --invalidate slide-05/04-audio/beat-3.wav` (긴급 패치용)

출력:
```
변경:
  - slide-05/01-script/v3.md (v2 대비 beat-3 텍스트 변경)

Stale 전파:
  - slide-05/04-audio/beat-3.wav        [supertone.beat]
  - slide-05/03-storyboard-conti/conti.yaml  [free, deterministic]
  - slide-05/05-remotion/slide-05.mp4   [remotion.slide_render]
  - premiere/clip[slide-05]             [premiere.clip_swap]
  - premiere/final.mp4                  [premiere.assembly_partial]

영향 없음: 24개 슬라이드

예상: 8분 + $0.01
```

### `cycle-manager execute`
plan을 실행. 각 에이전트를 의존성 순서대로 호출. 메인 에이전트는 결과를 사용자에게 스트리밍.

### `cycle-manager rollback <cycle-n>`
이전 사이클 상태로 복귀. `_archive/` 의 백업 사용.

## 캐시 검증 알고리즘

각 노드에 대해:
```python
def is_stale(node, manifest):
    current_inputs = collect_inputs(node, manifest)
    current_hash = hash_canonical(current_inputs)
    stored_hash = read_input_hash(node.output_path)
    return current_hash != stored_hash
```

Hash 계산은:
- 텍스트 파일: 내용의 SHA256
- 바이너리 파일: 파일 SHA256
- 구조화 데이터(JSON/YAML): canonical serialization 후 SHA256
- 파라미터(slide_type, voice_id 등): 직접 hash

## 실행 순서 (위상정렬)

의존성 그래프를 DAG로 보고 위상정렬. Stale 노드만 순서대로 실행.

병렬화 가능 노드는 동시 실행 (예: 슬라이드 5의 WAV 6개는 병렬 슈퍼톤 호출).

## 실패 처리

- 에이전트 실패 시 즉시 중단, 사용자에게 보고
- 부분 완료된 stale 노드는 manifest에 `in_progress` 마킹
- 재실행 시 `in_progress` 노드부터 이어서

## 구현 노트

MVP는 Python 스크립트 1개 (`cycle_manager.py`).
- 의존성 그래프: `dependency_graph.yaml`에서 로드
- 에이전트 호출: 메인 에이전트가 받아서 Claude Code Agent tool로 invoke
- 캐시: 파일 시스템 기반 (별도 DB 불필요)
