#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""모듈2 섹션 렌더 (데이터 구동 Remotion).

  render_section.py <project> <sNN|all> [--draft] [--scale 0.5] [--no-audio] [--still FRAME] [--frames A-B]

- 플러그인 templates/module2/remotion/ + studio/anim.js 를 <remotion>/codex-workspace/module2/ 로 동기화
  (미리보기와 렌더가 같은 anim.js를 쓰도록 매번 덮어씀. node_modules·package.json은 건드리지 않음)
- 섹션 layout/timeline/edits + 음성 목록 + 폰트를 props.json으로 만들어 렌더
- public dir = 프로젝트 폴더 (이미지·영상·음성·폰트를 staticFile로 읽음)
- 결과: --draft → sections/sNN/render/preview.mp4 (아직 없는 아바타 자리 표시, 기본 scale 0.5)
        기본   → sections/sNN/render/sNN.mp4 (최종, scale 1)
        상태   → sections/sNN/render/render.json (스튜디오가 읽음)
처음 한 번은 setup_remotion.sh 로 3D 의존성을 설치한다.
"""
import argparse
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN = os.path.dirname(os.path.dirname(HERE))
TPL = os.path.join(PLUGIN, "templates", "module2")
sys.path.insert(0, HERE)
import m2env  # noqa: E402
m2env.fix_stdio()
REMOTION = m2env.remotion_root()
WS = os.path.join(REMOTION, "codex-workspace", "module2")
WEIGHTS = {"thin": 100, "extralight": 200, "ultralight": 200, "light": 300, "regular": 400, "book": 400, "medium": 500,
           "semibold": 600, "demibold": 600, "bold": 700, "extrabold": 800, "ultrabold": 800, "black": 900, "heavy": 900}


def rj(p, d=None):
    if not os.path.exists(p):
        return d
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def wj(p, o):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, indent=2)
    os.replace(tmp, p)


def sync_workspace():
    if not os.path.isdir(os.path.join(WS, "node_modules", "@remotion", "three")):
        print("3D 의존성이 없어 먼저 설치합니다 (module2_setup.py remotion).", flush=True)
        import module2_setup
        module2_setup.setup_three(REMOTION)
    src = os.path.join(TPL, "remotion")
    for root, _, files in os.walk(src):
        rel = os.path.relpath(root, src)
        dst = os.path.join(WS, rel) if rel != "." else WS
        os.makedirs(dst, exist_ok=True)
        for fn in files:
            shutil.copy2(os.path.join(root, fn), os.path.join(dst, fn))
    shutil.copy2(os.path.join(TPL, "studio", "anim.js"), os.path.join(WS, "anim.js"))


def font_dirs(P):
    return m2env.font_dirs(P, REMOTION)


def font_index(P):
    idx = {}
    for d in font_dirs(P):
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if not fn.lower().endswith((".otf", ".ttf", ".woff", ".woff2")):
                continue
            parts = re.split(r"[-_ ]", os.path.splitext(fn)[0])
            w = 400
            for p in parts[1:]:
                w = WEIGHTS.get(p.lower().replace("italic", ""), w)
            idx.setdefault((parts[0], w), os.path.join(d, fn))
    return idx


def collect_fonts(P, merged_families):
    """쓰인 (family, weight)를 프로젝트 global_assets/fonts 로 복사하고 props용 목록 반환. 3D 라벨용 Pretendard 500/600/700 포함."""
    idx = font_index(P)
    want = set(merged_families) | {("Pretendard", 500), ("Pretendard", 600), ("Pretendard", 700)}
    dst_dir = os.path.join(P, "global_assets", "fonts")
    os.makedirs(dst_dir, exist_ok=True)
    out, missing = [], []
    for fam, w in sorted(want):
        src = idx.get((fam, w))
        if not src:
            cands = [(abs(k[1] - w), v) for k, v in idx.items() if k[0] == fam]
            src = min(cands)[1] if cands else None
        if not src:
            missing.append("%s %d" % (fam, w))
            continue
        dst = os.path.join(dst_dir, os.path.basename(src))
        if not os.path.exists(dst):
            shutil.copy2(src, dst)
        out.append({"family": fam, "weight": w, "src": "global_assets/fonts/" + os.path.basename(src)})
    return out, missing


def section_props(P, sid, draft, with_audio):
    d = os.path.join(P, "sections", sid)
    layout = rj(os.path.join(d, "layout.json"), {"elements": []})
    timeline = rj(os.path.join(d, "timeline.json"), {"fps": 30, "duration": 150, "elements": {}})
    edits = rj(os.path.join(d, "edits.json"), {"elements": {}})
    els = list(layout.get("elements", [])) + [dict(e, id=k) for k, e in (edits.get("elements") or {}).items() if e.get("_new")]
    fams = set()
    for e in els:
        f = dict(e.get("font") or {}, **((edits.get("elements") or {}).get(e["id"], {}).get("font") or {}))
        if f.get("family"):
            fams.add((f["family"], int(f.get("weight", 400))))
        # 아직 없는 영상·아바타 파일 표시 (최종 렌더에서 빈 화면 방지용 경고)
        if e.get("type") in ("video", "avatar") and e.get("src"):
            sp = e["src"] if e["src"].startswith(("global_assets/", "sections/")) else "sections/%s/%s" % (sid, e["src"])
            e["srcExists"] = os.path.exists(os.path.join(P, sp))
    for e in layout.get("elements", []):
        if e.get("type") in ("video", "avatar") and e.get("src"):
            sp = e["src"] if e["src"].startswith(("global_assets/", "sections/")) else "sections/%s/%s" % (sid, e["src"])
            e["srcExists"] = os.path.exists(os.path.join(P, sp))
    fonts, missing = collect_fonts(P, fams)
    audio = []
    if timeline.get("audio"):
        audio = [{"src": a["src"], "at": a.get("at", 0)} for a in timeline["audio"]]
    else:
        starts = {b["id"]: b.get("start", 0) for b in timeline.get("beats", [])}
        ad = os.path.join(d, "audio")
        for fn in sorted(os.listdir(ad)) if os.path.isdir(ad) else []:
            m = re.match(r"^beat-(\d+)\.wav$", fn)
            if m:
                audio.append({"src": "audio/" + fn, "at": starts.get("b" + m.group(1), 0)})
    props = {"layout": layout, "timeline": timeline, "edits": edits, "sectionDir": "sections/" + sid,
             "fonts": fonts, "audio": audio, "withAudio": bool(with_audio and audio), "draft": draft}
    return props, missing


def render(P, sid, draft=False, scale=None, with_audio=True, still=None, frames=None, quiet=False):
    d = os.path.join(P, "sections", sid)
    rd = os.path.join(d, "render")
    os.makedirs(rd, exist_ok=True)
    props, missing = section_props(P, sid, draft, with_audio)
    for e in props["layout"]["elements"]:
        if not draft and e.get("type") in ("video", "avatar") and e.get("srcExists") is False:
            print("경고: %s %s 파일이 없어 최종 렌더에서 빈 칸이 됩니다 (%s)" % (sid, e["id"], e.get("src")), flush=True)
    if missing:
        print("경고: 폰트 파일을 못 찾음 → 기본 글꼴로 대체: " + ", ".join(missing), flush=True)
    pp = os.path.join(rd, "props.json")
    wj(pp, props)
    scale = scale if scale is not None else (0.5 if draft else 1.0)
    st = rj(os.path.join(d, "status.json"), {})
    if still is not None:
        out = os.path.join(rd, "still_f%d.png" % still)
        cmd = m2env.remotion_cli(REMOTION) + ["still", "codex-workspace/module2/index.ts", "Module2Section", out, "--frame=%d" % still]
    else:
        out = os.path.join(rd, "preview.mp4" if draft else "%s.mp4" % sid)
        cmd = m2env.remotion_cli(REMOTION) + ["render", "codex-workspace/module2/index.ts", "Module2Section", out]
        if not props["withAudio"]:
            cmd.append("--muted")
        if frames:
            cmd.append("--frames=%s" % frames)
    cmd += ["--props=%s" % pp, "--public-dir=%s" % P, "--gl=angle", "--scale=%s" % scale, "--log=error"]
    meta_p = os.path.join(rd, "render.json")
    meta = rj(meta_p, {})
    key = "draft" if draft else "final"
    if still is None:
        meta[key] = {"state": "running", "started": datetime.datetime.now().isoformat(timespec="seconds"), "version": st.get("version", 1), "scale": scale}
        wj(meta_p, meta)
    t0 = time.time()
    r = m2env.run(cmd, cwd=REMOTION)
    ok = r.returncode == 0 and os.path.exists(out)
    if still is None:
        meta = rj(meta_p, {})
        meta[key] = {"state": "done" if ok else "failed", "file": os.path.relpath(out, d) if ok else None,
                     "finished": datetime.datetime.now().isoformat(timespec="seconds"), "seconds": round(time.time() - t0, 1),
                     "version": st.get("version", 1), "scale": scale, "log": (r.stdout + r.stderr)[-1500:] if not ok else ""}
        wj(meta_p, meta)
    if not quiet:
        print(("완료" if ok else "실패"), sid, os.path.relpath(out, P), "%.0fs" % (time.time() - t0), flush=True)
        if not ok:
            print((r.stdout + r.stderr)[-3000:], flush=True)
    return ok, out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("section")
    ap.add_argument("--draft", action="store_true")
    ap.add_argument("--scale", type=float)
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--still", type=int)
    ap.add_argument("--frames")
    a = ap.parse_args()
    P = os.path.abspath(a.project)
    sync_workspace()
    cfg = rj(os.path.join(P, "project.json"), {})
    sids = [s["id"] for s in cfg.get("sections", [])] if a.section == "all" else [a.section]
    fails = 0
    for sid in sids:
        ok, _ = render(P, sid, a.draft, a.scale, not a.no_audio, a.still, a.frames)
        fails += 0 if ok else 1
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
