#!/usr/bin/env python3
"""Cycle Manager — 영상 에이전트 시스템의 결정론적 사이클 도구.

메인 에이전트가 호출. LLM 아님. 변경 감지/stale 전파/비용 추정/실행 계획만 담당.

Usage:
  cycle_manager.py status <project_dir>
  cycle_manager.py plan <project_dir> --script <slide>/<version>.md
  cycle_manager.py plan <project_dir> --invalidate <node_path>
  cycle_manager.py execute <project_dir> <plan_id>
  cycle_manager.py rollback <project_dir> <cycle_n>
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

try:
    import yaml
except ImportError:
    print("Install pyyaml: pip install pyyaml", file=sys.stderr)
    sys.exit(1)


SCRIPT_DIR = Path(__file__).parent
DEP_GRAPH_PATH = SCRIPT_DIR / "dependency_graph.yaml"


@dataclass
class DependencyGraph:
    """nodes + producer edges + unit_costs + slide_type_pipelines."""
    nodes: dict[str, dict]
    unit_costs: dict[str, dict]
    slide_type_pipelines: dict[str, dict]

    @classmethod
    def load(cls, path: Path) -> "DependencyGraph":
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        nodes_list = data.get("nodes", [])
        nodes = {n["id"]: n for n in nodes_list if isinstance(n, dict) and "id" in n}
        return cls(
            nodes=nodes,
            unit_costs=data.get("unit_costs", {}),
            slide_type_pipelines=data.get("slide_type_pipelines", {}),
        )

    def downstream(self, node_id: str) -> set[str]:
        """Return all transitively dependent nodes."""
        result: set[str] = set()
        stack = [node_id]
        while stack:
            current = stack.pop()
            node = self.nodes.get(current)
            if not node:
                continue
            for produced in node.get("produces", []) or []:
                if produced not in result:
                    result.add(produced)
                    stack.append(produced)
        return result


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_canonical(obj) -> str:
    return sha256_text(json.dumps(obj, sort_keys=True, ensure_ascii=False))


@dataclass
class ProjectManifest:
    root: Path
    data: dict

    @classmethod
    def load(cls, project_dir: Path) -> "ProjectManifest":
        manifest_path = project_dir / "manifest.json"
        if not manifest_path.exists():
            raise FileNotFoundError(f"No manifest at {manifest_path}")
        return cls(root=project_dir, data=json.loads(manifest_path.read_text(encoding="utf-8")))

    def save(self) -> None:
        path = self.root / "manifest.json"
        path.write_text(json.dumps(self.data, indent=2, ensure_ascii=False), encoding="utf-8")

    @property
    def cycle(self) -> int:
        return self.data.get("current_cycle", 1)

    @property
    def slides(self) -> dict:
        return self.data.get("slides", {})

    def slide_dir(self, slide_id: str) -> Path:
        return self.root / f"slide-{slide_id}"


def cmd_status(project_dir: Path) -> int:
    manifest = ProjectManifest.load(project_dir)
    print(f"프로젝트: {manifest.data.get('project', project_dir.name)}")
    print(f"현재 사이클: {manifest.cycle}")
    print(f"디자인 베이스라인: {manifest.data.get('design_baseline', 'unknown')}")

    slides = manifest.slides
    print(f"슬라이드 {len(slides)}개:")
    stable, stale, in_progress, pending = 0, 0, 0, 0
    for sid, sdata in slides.items():
        status = sdata.get("status", "pending")
        if status == "stable":
            stable += 1
        elif status == "stale":
            stale += 1
        elif status == "in_progress":
            in_progress += 1
        else:
            pending += 1
    print(f"  ✅ 정상  : {stable}개")
    if stale:
        print(f"  🟡 stale : {stale}개")
    if in_progress:
        print(f"  🔵 진행중: {in_progress}개")
    if pending:
        print(f"  ⚪ 대기  : {pending}개")
    return 0


def collect_stale_for_script_change(
    graph: DependencyGraph,
    slide_id: str,
    changed_beats: list[str],
) -> list[dict]:
    """Compute stale plan for a script change.

    Returns ordered list of operations.
    """
    operations: list[dict] = []

    # Script change triggers per-beat WAV regen
    for beat_id in changed_beats:
        operations.append({
            "agent": "supertone",
            "scope": f"slide-{slide_id}/beat-{beat_id}",
            "cost_node": "supertone.beat",
            "reason": f"beat-{beat_id} 텍스트 변경",
        })

    # Then continuity realization (deterministic, free)
    operations.append({
        "agent": "continuity",
        "scope": f"slide-{slide_id} (realization)",
        "cost_node": None,
        "reason": "wav duration 변경",
    })

    # Then remotion re-render (slide-level)
    operations.append({
        "agent": "remotion",
        "scope": f"slide-{slide_id}",
        "cost_node": "remotion.slide_render",
        "reason": "conti/wav 변경",
    })

    # Then premiere clip swap
    operations.append({
        "agent": "premiere",
        "scope": f"clip[slide-{slide_id}]",
        "cost_node": "premiere.clip_swap",
        "reason": "remotion mp4 교체",
    })

    return operations


def estimate(operations: list[dict], graph: DependencyGraph) -> dict:
    total_usd = 0.0
    total_time_s = 0.0
    for op in operations:
        cost_node = op.get("cost_node")
        if cost_node and cost_node in graph.unit_costs:
            unit = graph.unit_costs[cost_node]
            total_usd += unit.get("usd", 0)
            total_time_s += unit.get("time_s", 0)
    return {
        "usd": round(total_usd, 4),
        "time_s": round(total_time_s, 1),
        "time_min": round(total_time_s / 60, 1),
    }


def cmd_plan(project_dir: Path, args: argparse.Namespace) -> int:
    manifest = ProjectManifest.load(project_dir)
    graph = DependencyGraph.load(DEP_GRAPH_PATH)

    if args.script:
        # Parse script path: e.g. "05/v3.md"
        parts = args.script.split("/")
        if len(parts) < 2:
            print(f"Bad --script: {args.script}", file=sys.stderr)
            return 2
        slide_id = parts[0]
        new_version_filename = parts[1]
        new_script_path = manifest.slide_dir(slide_id) / "01-script" / new_version_filename
        if not new_script_path.exists():
            print(f"Script not found: {new_script_path}", file=sys.stderr)
            return 2

        # Find previous version
        current_version = manifest.slides.get(slide_id, {}).get("current_versions", {}).get("script")
        if current_version is None:
            print(f"신규 슬라이드: 전체 파이프라인 실행 필요")
            operations = collect_stale_for_script_change(graph, slide_id, ["all"])
        else:
            prev_script_path = manifest.slide_dir(slide_id) / "01-script" / current_version
            changed_beats = diff_beats(prev_script_path, new_script_path)
            print(f"변경 beat: {changed_beats}")
            operations = collect_stale_for_script_change(graph, slide_id, changed_beats)

    elif args.invalidate:
        # Direct node invalidation
        operations = [{
            "agent": "manual",
            "scope": args.invalidate,
            "cost_node": None,
            "reason": "수동 invalidate",
        }]
    else:
        print("--script 또는 --invalidate 필요", file=sys.stderr)
        return 2

    # Report
    print("\n▶ 변경 분석")
    print(f"  슬라이드: slide-{slide_id if args.script else '?'}")

    print("\n▶ Stale 전파 (실행 순서)")
    for i, op in enumerate(operations, 1):
        print(f"  {i}. [{op['agent']}] {op['scope']}  ← {op['reason']}")

    print("\n▶ 영향 없음")
    affected_slides = {slide_id} if args.script else set()
    untouched = set(manifest.slides.keys()) - affected_slides
    print(f"  {len(untouched)}개 슬라이드 (캐시 그대로 재사용)")

    est = estimate(operations, graph)
    print(f"\n▶ 예상")
    print(f"  비용: ${est['usd']}")
    print(f"  시간: {est['time_min']}분 ({est['time_s']}초)")

    # Save plan
    plan_id = sha256_canonical(operations)[:8]
    plan_path = project_dir / ".cycle_manager" / f"plan-{plan_id}.json"
    plan_path.parent.mkdir(exist_ok=True)
    plan_path.write_text(json.dumps({
        "plan_id": plan_id,
        "cycle": manifest.cycle + 1,
        "operations": operations,
        "estimate": est,
        "affected_slides": list(affected_slides),
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nPlan saved: {plan_path}")
    print(f"실행: cycle_manager.py execute {project_dir} {plan_id}")
    return 0


def diff_beats(prev_path: Path, new_path: Path) -> list[str]:
    """Compare two script.md files at beat level, return list of changed beat IDs.

    Simple heuristic: split by '## [beat-N]' headers, compare text per beat.
    """
    def parse_beats(path: Path) -> dict[str, str]:
        text = path.read_text(encoding="utf-8")
        beats: dict[str, str] = {}
        current_id = None
        current_lines: list[str] = []
        for line in text.splitlines():
            if line.startswith("## [beat-"):
                if current_id:
                    beats[current_id] = "\n".join(current_lines).strip()
                # Parse "## [beat-3] (~Ns, tone)"
                start = line.find("[beat-") + len("[beat-")
                end = line.find("]", start)
                if end > start:
                    current_id = line[start:end]
                    current_lines = []
            elif current_id:
                current_lines.append(line)
        if current_id:
            beats[current_id] = "\n".join(current_lines).strip()
        return beats

    prev_beats = parse_beats(prev_path)
    new_beats = parse_beats(new_path)

    changed: list[str] = []
    all_ids = set(prev_beats) | set(new_beats)
    for bid in sorted(all_ids):
        if prev_beats.get(bid) != new_beats.get(bid):
            changed.append(bid)
    return changed


def cmd_execute(project_dir: Path, plan_id: str) -> int:
    """Execute a saved plan.

    This implementation is a stub: it prints what would be done.
    Real execution requires Claude Code Agent tool invocations,
    which must be done from the main agent context (not Python).
    """
    plan_path = project_dir / ".cycle_manager" / f"plan-{plan_id}.json"
    if not plan_path.exists():
        print(f"Plan not found: {plan_path}", file=sys.stderr)
        return 2
    plan = json.loads(plan_path.read_text(encoding="utf-8"))

    print(f"실행 plan: {plan_id} (cycle {plan['cycle']})")
    print("주의: 이 도구는 실제 에이전트 호출은 하지 않습니다.")
    print("메인 에이전트가 아래 순서대로 Agent 도구로 invoke 해주세요:\n")
    for i, op in enumerate(plan["operations"], 1):
        print(f"  {i}. Agent({op['agent']}, scope='{op['scope']}')")

    # Update manifest
    manifest = ProjectManifest.load(project_dir)
    manifest.data["current_cycle"] = plan["cycle"]
    cycles = manifest.data.setdefault("cycles", [])
    cycles.append({
        "n": plan["cycle"],
        "trigger": "cycle_manager.execute",
        "scope": plan["affected_slides"],
        "plan_id": plan_id,
    })
    manifest.save()
    print(f"\n사이클 {plan['cycle']}로 진입, manifest 갱신 완료.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Video Agent System — Cycle Manager")
    parser.add_argument("command", choices=["status", "plan", "execute", "rollback"])
    parser.add_argument("project_dir", type=Path)
    parser.add_argument("--script", help="신규 스크립트 경로 (slide_id/version.md)")
    parser.add_argument("--invalidate", help="직접 노드 invalidate")
    parser.add_argument("plan_id", nargs="?", help="execute용 plan ID")

    args = parser.parse_args()
    project_dir = args.project_dir.resolve()
    if not project_dir.exists():
        print(f"프로젝트 폴더 없음: {project_dir}", file=sys.stderr)
        return 2

    if args.command == "status":
        return cmd_status(project_dir)
    elif args.command == "plan":
        return cmd_plan(project_dir, args)
    elif args.command == "execute":
        if not args.plan_id:
            print("execute는 plan_id 필요", file=sys.stderr)
            return 2
        return cmd_execute(project_dir, args.plan_id)
    elif args.command == "rollback":
        print("rollback은 아직 미구현", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
