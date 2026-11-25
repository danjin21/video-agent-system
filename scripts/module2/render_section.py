#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""모듈2 섹션 렌더 (데이터 구동 Remotion).

  render_section.py <project> <sNN|all> [--draft] [--scale 0.5] [--no-audio] [--still FRAME] [--frames A-B] [--skip-check]

- 최종 렌더(--draft·--still 아님)는 연출 검수 게이트(direction_check.py) 오류가 0이어야 진행한다.

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
    if not all(os.path.isdir(os.path.join(WS, "node_modules", "@remotion", x)) for x in ("three", "transitions")):
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
            for p in parts[1:]:   # Paperlogy-7Bold 처럼 앞에 숫자가 붙은 이름도
                w = WEIGHTS.get(re.sub(r"^\d+", "", p.lower().replace("italic", "")), w)
            idx.setdefault((parts[0], w), os.path.join(d, fn))
    return idx


def collect_fonts(P, merged_families):
    """쓰인 (family, weight)를 프로젝트 global_assets/fonts 로 복사하고 props용 목록 반환. 3D 라벨·키트용 Pretendard 500/600/700/800 포함."""
    idx = font_index(P)
    base = ((load_theme(P) or {}).get("font") or {}).get("family") or "Pretendard"   # 디자인 키트 기본 글꼴
    want = set(merged_families) | {(f, w) for f in {"Pretendard", base} for w in (500, 600, 700, 800)}  # 800: 키트 증감 칩(stat delta)
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


def load_theme(P):
    """디자인 키트: 프로젝트 design/theme.json (없으면 플러그인 템플릿)"""
    for p in (os.path.join(P, "design", "theme.json"), os.path.join(TPL, "theme.json")):
        t = rj(p)
        if t:
            return t
    return None


def theme_hash(P, sid=None):
    """섹션 그림에 영향을 주는 키트 부분만의 지문.
    - 제외: 섹션 전환(transitions)·version·설명 글(label·idea) → 이것만 바꾸면 섹션 재렌더 불필요
    - sid를 주면 그 섹션이 쓰는 글자 양식·애니메이션 양식·부품만 → 다른 섹션 양식을 바꿔도 이 섹션은 그대로"""
    import hashlib
    t = dict(load_theme(P) or {})
    for k in ("transitions", "milestones", "version", "_note", "colorLabels"):
        t.pop(k, None)
    if sid:
        lay = rj(os.path.join(P, "sections", sid, "layout.json"), {}) or {}
        tl = rj(os.path.join(P, "sections", sid, "timeline.json"), {}) or {}
        els = lay.get("elements") or []
        used = {e.get("style") for e in els if e.get("style")} | {(tl.get("elements") or {}).get(e.get("id"), {}).get("preset") for e in els}
        kinds = {e.get("kind") for e in els if e.get("type") == "diagram"}
        t["styles"] = {k: v for k, v in (t.get("styles") or {}).items() if k in used}
        t["motion"] = {k: v for k, v in (t.get("motion") or {}).items() if k in used}
        t["components"] = {k: v for k, v in (t.get("components") or {}).items() if k in kinds}
        edits = rj(os.path.join(P, "sections", sid, "edits.json"), {}) or {}
        if not any(e.get("hl") for e in els) and not any((v or {}).get("hl") for v in (edits.get("elements") or {}).values()):
            t.pop("textHighlight", None)   # 하이라이트 글자를 안 쓰는 섹션은 그 기본값과 무관

    def strip(v):   # 설명 글(label·idea 등)은 그림과 무관
        if isinstance(v, dict):
            return {k: strip(x) for k, x in v.items() if k not in ("label", "idea", "_idea", "paramLabels") and not k.startswith("_")}
        if isinstance(v, list):
            return [strip(x) for x in v]
        return v
    t = strip(t)
    # 그림 코드 지문: anim.js·Module2Section.tsx가 바뀌면(아이콘·부품 그리는 방식) 키트 값이 같아도 다시 렌더 (2026-11-19: 코드만 바뀐 장면이 안 바뀌던 문제)
    code = hashlib.sha1()
    for cp in (os.path.join(TPL, "studio", "anim.js"), os.path.join(TPL, "remotion", "Module2Section.tsx")):
        if os.path.exists(cp):
            code.update(open(cp, "rb").read().replace(b"\r\n", b"\n"))
    t["_code"] = code.hexdigest()[:12]
    return hashlib.sha1(json.dumps(t, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:12]


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
        if e.get("type") in ("video", "avatar", "broll") and e.get("src"):
            sp = e["src"] if e["src"].startswith(("global_assets/", "sections/")) else "sections/%s/%s" % (sid, e["src"])
            e["srcExists"] = os.path.exists(os.path.join(P, sp))
    for e in layout.get("elements", []):
        if e.get("type") in ("video", "avatar", "broll") and e.get("src"):
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
             "fonts": fonts, "audio": audio, "withAudio": bool(with_audio and audio), "draft": draft, "theme": load_theme(P)}
    return props, missing


def render(P, sid, draft=False, scale=None, with_audio=True, still=None, frames=None, quiet=False):
    d = os.path.join(P, "sections", sid)
    rd = os.path.join(d, "render")
    os.makedirs(rd, exist_ok=True)
    props, missing = section_props(P, sid, draft, with_audio)
    for e in props["layout"]["elements"]:
        if not draft and e.get("type") in ("video", "avatar", "broll") and e.get("srcExists") is False:
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
        # 색 규격: 원본 영상(BT.709, tv 범위)과 같게. 기본값(JPEG 프레임 → yuvj420p·BT.601·pc 범위)이면 합본에서 사람 피부가
        # 누렇고 대비가 낮아 보인다(2026-11-20 사용자: "합본 용미니와 섹션 용미니 색조가 다르다"). 프레임도 PNG(무손실)로.
        cmd += ["--image-format=png", "--pixel-format=yuv420p", "--color-space=bt709", "--crf=16"]
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
                     "version": st.get("version", 1), "scale": scale, "log": (r.stdout + r.stderr)[-1500:] if not ok else "",
                     "theme_hash": theme_hash(P, sid)}
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
    ap.add_argument("--skip-check", action="store_true", help="연출 검수 게이트 건너뛰기 (사용자가 명시적으로 허락한 경우만)")
    a = ap.parse_args()
    P = os.path.abspath(a.project)
    # 연출 검수 게이트: 최종 렌더(초안·정지 화면 제외)는 direction_check 오류가 0이어야 한다
    if not a.draft and a.still is None and not a.skip_check:
        import direction_check
        r = direction_check.check(P)
        if not r["ok"]:
            for x in r["issues"]:
                if x["level"] == "error" and (a.section == "all" or x["section"] in (None, a.section)):
                    print("오류 %s %s: %s" % (x["section"] or "전체", x["code"], x["msg"]), flush=True)
            if a.section == "all" or any(x["level"] == "error" and x["section"] in (None, a.section) for x in r["issues"]):
                sys.exit("연출 검수 통과 전에는 최종 렌더를 하지 않습니다 → direction_check.py %s (초안은 --draft)" % P)
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
