#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""모듈2 합본 — 섹션 렌더를 이어 붙이고 나레이션·BGM을 깐다 (모듈1 assemble 교훈 반영).

  assemble.py <project> [--draft] [--out final/master.mp4]

- 비디오: 섹션 mp4에서 오디오를 떼고(-an) concat. 오디오 포함 mp4를 그대로 concat하면 AAC priming으로
  섹션 경계마다 영상이 1~2프레임씩 밀린다(2026-09 모듈1 사고).
- 나레이션: 섹션 audio/beat-N.wav 원본을 (섹션 시작 프레임 + 비트 시작 프레임) 위치에 adelay로 배치.
- BGM: project.json bgm.tracks[0] 이 있으면 반복 재생, 나레이션에 사이드체인 덕킹. `-shortest` 쓰지 않고 apad/atrim으로 길이 고정.
  앞부분만 깔려면 bgm.until("s14" — 그 섹션 시작에서 끝) 또는 bgm.end_sec(초) + bgm.fade_out(초, 기본 4).
- --draft: 섹션 최종본(sNN.mp4) 대신 초안(preview.mp4)으로 빠르게 이어 보기(전환 없이 단순 이어 붙임).
- 섹션 전환: design/theme.json `transitions`(디자인 키트)에 따라 경계마다 @remotion/transitions 조각(Module2Transition)을 렌더해
  [앞 섹션 - n] + [전환 n] + [다음 섹션 - n] 으로 잇는다. 경계마다 n프레임 겹치므로 나레이션 위치도 n씩 당긴다.
  n은 앞 섹션 꼬리 무음(마지막 비트 끝 ~ 섹션 끝)보다 길 수 없다. 섹션 시작 위치는 final/master.json에 기록(스튜디오 전체 보기용).
  --no-transitions: 전환 없이.
- 마일스톤 바: project.json `milestones`([{title, sections, steps?}])가 있고 디자인 키트 `milestones.enabled`면 합본 길이만큼
  Module2Milestones(투명 ProRes 4444)를 렌더해 영상 맨 위에 겹친다. 큰 챕터 이름 + 지금 위치(진행 막대), 챕터 안 단계(steps)도 표시.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import m2env  # noqa: E402
m2env.fix_stdio()


def rj(p, d=None):
    if not os.path.exists(p):
        return d
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def run(cmd):
    r = m2env.run(cmd)
    if r.returncode != 0:
        sys.exit("ffmpeg 실패:\n" + r.stderr[-2000:])


# 색 규격 — 모든 재인코딩을 BT.709·tv 범위로 통일 (2026-11-20: 섹션은 BT.709인데 합본이 BT.601·pc로 나가 사람 색조가 달라 보였음)
BT709 = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]
TOTV = "scale=in_range=auto:out_range=tv:in_color_matrix=auto:out_color_matrix=bt709"


DEFAULT_TRANSITIONS = {"default": {"type": "fade", "frames": 15}, "chapter": {"type": "wipe", "direction": "from-right", "frames": 18}, "sections": {}}


def is_chapter(P, sid):
    lay = rj(os.path.join(P, "sections", sid, "layout.json"), {}) or {}
    return any(e.get("type") == "diagram" and e.get("kind") == "chapter" for e in lay.get("elements", []))


def transition_for(P, cfg_t, sid_b):
    """다음 섹션(sid_b)으로 들어갈 때의 전환. 우선순위: sections[sid] > chapter(챕터 간지로 시작) > default"""
    t = dict(DEFAULT_TRANSITIONS["default"], **(cfg_t.get("default") or {}))
    ch = cfg_t.get("chapter", DEFAULT_TRANSITIONS["chapter"])
    if ch and is_chapter(P, sid_b):
        t.update(ch)
    t.update((cfg_t.get("sections") or {}).get(sid_b) or {})
    return t


def tail_room(tl):
    b = tl.get("beats") or []
    return tl.get("duration", 0) - (b[-1].get("end", 0) if b else 0)


def render_transition(P, a_rel, a_from, b_rel, t, out):
    """Module2Transition 조각 렌더 (입력·설정이 같으면 재사용)"""
    import hashlib
    import render_section as RS
    key = json.dumps([a_rel, a_from, b_rel, t, os.path.getmtime(os.path.join(P, a_rel)), os.path.getmtime(os.path.join(P, b_rel)), "bt709"], sort_keys=True)
    h = hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]
    stamp = out + ".key"
    if os.path.exists(out) and os.path.exists(stamp) and open(stamp, encoding="utf-8").read() == h:
        return out
    if not getattr(render_transition, "_synced", False):
        RS.sync_workspace()
        render_transition._synced = True
    props = {"a": a_rel.replace(os.sep, "/"), "aFrom": a_from, "b": b_rel.replace(os.sep, "/"), "n": t["frames"],
             "type": t.get("type", "fade"), "direction": t.get("direction"), "timing": t.get("timing", "linear")}
    pp = out + ".props.json"
    with open(pp, "w", encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False)
    cmd = m2env.remotion_cli(RS.REMOTION) + ["render", "codex-workspace/module2/index.ts", "Module2Transition", out, "--muted",
                                               "--props=%s" % pp, "--public-dir=%s" % P, "--gl=angle", "--log=error",
                                               "--image-format=png", "--pixel-format=yuv420p", "--color-space=bt709", "--crf=16"]
    r = m2env.run(cmd, cwd=RS.REMOTION)
    if r.returncode != 0 or not os.path.exists(out):
        sys.exit("전환 렌더 실패 (%s -> %s):\n%s" % (a_rel, b_rel, (r.stdout + r.stderr)[-2000:]))
    with open(stamp, "w", encoding="utf-8") as f:
        f.write(h)
    return out


MILESTONE_DEFAULT = {"enabled": True, "height": 64, "padX": 140, "gap": 10, "trackY": 44, "lineWidth": 4,
                     "track": "$line", "fill": "$blue", "on": "$navy", "off": "$gray", "dot": "$blue", "hideOpening": True, "hideEnding": False}


def dark_ranges(P, starts_out):
    """화면이 어두운 구간(합본 프레임) — 전체화면 실사(broll·video·avatar)·배경 사진·파란 간지·전체 어둡게 덮개.
    이 구간에서 마일스톤 바는 흰 선·흰 글자(테두리 없음)로 그린다 (2026-11-20 사용자)."""
    out = []
    for x in starts_out:
        d = os.path.join(P, "sections", x["id"])
        try:
            lay = json.load(open(os.path.join(d, "layout.json"), encoding="utf-8"))
            tl = json.load(open(os.path.join(d, "timeline.json"), encoding="utf-8"))
        except Exception:  # noqa: BLE001
            continue
        tle = tl.get("elements") or {}
        for e in lay.get("elements") or []:
            full = (e.get("w") or 0) >= 1800 and (e.get("h") or 0) >= 1000
            p = e.get("props") or {}
            dark = (full and e.get("type") in ("broll", "video", "avatar")) or \
                   (e.get("type") == "diagram" and e.get("kind") == "zoomReveal" and p.get("background")) or \
                   (e.get("type") == "diagram" and e.get("kind") == "chapter" and p.get("onBlue")) or \
                   (full and e.get("type") == "rect" and "rgba(11,31,75" in str(e.get("fill") or "").replace(" ", ""))
            t = tle.get(e["id"])
            if dark and t:
                a = x["start"] + int(t.get("in", 0))
                b = x["start"] + min(int(t.get("out", x["duration"])), x["duration"])
                if b > a:
                    out.append([a, b])
    out.sort()
    merged = []
    for a, b in out:
        if merged and a <= merged[-1][1] + 6:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    return merged


def milestone_overlay(P, cfg, theme, starts_out, total, fps, tmp):
    """마일스톤 바 투명 영상 경로 (없으면 None). 입력이 같으면 다시 렌더하지 않는다."""
    import hashlib
    ms = cfg.get("milestones") or []
    st = dict(MILESTONE_DEFAULT, **(theme.get("milestones") or {}))
    if not ms or not st.get("enabled", True):
        return None
    colors = theme.get("colors") or {}
    for k in ("track", "fill", "on", "off", "dot", "halo"):
        v = st.get(k)
        if isinstance(v, str) and v.startswith("$"):
            st[k] = colors.get(v[1:], v)
    pos = {x["id"]: (x["start"], x["start"] + x["duration"]) for x in starts_out}

    def rng(sids):
        r = [pos[s] for s in sids if s in pos]
        return (min(a for a, _ in r), max(b for _, b in r)) if r else None
    chapters = []
    for m in ms:
        r = rng(m.get("sections") or [])
        if not r:
            continue
        ch = {"title": m.get("title", ""), "start": r[0], "end": r[1]}
        steps = [dict(label=x.get("label", ""), start=rr[0], end=rr[1]) for x in m.get("steps") or [] for rr in [rng(x.get("sections") or [])] if rr]
        if steps:
            ch["steps"] = steps
        chapters.append(ch)
    # 겹치는 전환 구간 때문에 생기는 1~2프레임 겹침 정리: 다음 챕터 시작 = 이 챕터 끝
    for a, b in zip(chapters, chapters[1:]):
        a["end"] = b["start"]
    show = chapters[1]["start"] if st.get("hideOpening") and len(chapters) > 1 else 0
    hide = chapters[-1]["start"] if st.get("hideEnding") and len(chapters) > 1 else total
    if st.get("hideOpening") and len(chapters) > 1:
        chapters = chapters[1:]
    import render_section as RS
    fam = (theme.get("font") or {}).get("family") or "Pretendard"
    fonts, _ = RS.collect_fonts(P, {(fam, 500), (fam, 700)})
    st["fontFamily"] = fam
    props = {"total": total, "fps": fps, "chapters": chapters, "showFrom": show, "hideAfter": hide, "style": st, "fonts": fonts,
             "dark": dark_ranges(P, starts_out)}
    out = os.path.join(P, "final", "milestones.mov")
    h = hashlib.sha1(json.dumps(props, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:12]
    stamp = out + ".key"
    if os.path.exists(out) and os.path.exists(stamp) and open(stamp, encoding="utf-8").read() == h:
        return out
    RS.sync_workspace()
    pp = os.path.join(tmp, "milestones.props.json")
    with open(pp, "w", encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False)
    print("마일스톤 바 렌더 (%d프레임)" % total, flush=True)
    cmd = m2env.remotion_cli(RS.REMOTION) + ["render", "codex-workspace/module2/index.ts", "Module2Milestones", out, "--muted",
                                               "--codec=prores", "--prores-profile=4444", "--pixel-format=yuva444p10le", "--image-format=png",
                                               "--props=%s" % pp, "--public-dir=%s" % P, "--log=error"]
    r = m2env.run(cmd, cwd=RS.REMOTION)
    if r.returncode != 0 or not os.path.exists(out):
        sys.exit("마일스톤 바 렌더 실패:\n" + (r.stdout + r.stderr)[-2000:])
    with open(stamp, "w", encoding="utf-8") as f:
        f.write(h)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("--draft", action="store_true")
    ap.add_argument("--out")
    ap.add_argument("--no-transitions", action="store_true")
    a = ap.parse_args()
    P = os.path.abspath(a.project)
    cfg = rj(os.path.join(P, "project.json"), {})
    fps = cfg.get("fps", 30)
    secs = [s["id"] for s in cfg.get("sections", [])]
    tmp = tempfile.mkdtemp(prefix="m2asm_")
    lst = os.path.join(tmp, "list.txt")
    theme = rj(os.path.join(P, "design", "theme.json"), {}) or {}
    cfg_t = theme.get("transitions", DEFAULT_TRANSITIONS)
    use_t = not a.draft and not a.no_transitions and cfg_t.get("enabled", True)
    tls = {sid: rj(os.path.join(P, "sections", sid, "timeline.json"), {}) for sid in secs}
    # 경계별 전환 (앞 섹션 i -> 다음 섹션 i+1)
    trans = []
    for i in range(len(secs) - 1):
        t = transition_for(P, cfg_t, secs[i + 1]) if use_t else {"type": "none", "frames": 0}
        if t.get("type") == "none":
            t["frames"] = 0
        t["frames"] = max(0, min(int(t.get("frames", 0)), tail_room(tls[secs[i]]), 30))
        trans.append(t)
    offset, clips, missing, starts_out = 0, [], [], []
    with open(lst, "w", encoding="utf-8") as f:
        for si, sid in enumerate(secs):
            d = os.path.join(P, "sections", sid)
            src = os.path.join(d, "render", "preview.mp4" if a.draft else "%s.mp4" % sid)
            if not os.path.exists(src):
                missing.append(sid)
                continue
            v = os.path.join(tmp, sid + ".mp4")
            run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-an", "-c:v", "copy", v])
            f.write("file '%s'\n" % v.replace("\\", "/").replace("'", "'\\''"))
            tl = rj(os.path.join(d, "timeline.json"), {})
            starts = {b["id"]: b.get("start", 0) for b in tl.get("beats", [])}
            if tl.get("audio"):
                for x in tl["audio"]:
                    clips.append((os.path.join(d, x["src"]), offset + x.get("at", 0)))
            else:
                ad = os.path.join(d, "audio")
                for fn in sorted(os.listdir(ad)) if os.path.isdir(ad) else []:
                    m = re.match(r"^beat-(\d+)\.wav$", fn)
                    if m:
                        clips.append((os.path.join(ad, fn), offset + starts.get("b" + m.group(1), 0)))
            starts_out.append({"id": sid, "start": offset, "duration": tl.get("duration", 0)})
            offset += tl.get("duration", 0) - (trans[si]["frames"] if si < len(trans) else 0)
    if missing:
        sys.exit("렌더 없는 섹션: %s → render_section.py %s <sid>%s 먼저" % (", ".join(missing), P, " --draft" if a.draft else ""))
    out = os.path.join(P, a.out) if a.out else os.path.join(P, "final", "master_draft.mp4" if a.draft else "master.mp4")
    os.makedirs(os.path.join(P, "final"), exist_ok=True)
    video = os.path.join(tmp, "video.mp4")
    if any(t["frames"] for t in trans):
        # [섹션 i의 (앞 전환 n) ~ (끝 - 뒤 전환 n)] + [전환 조각] ... 을 한 번에 다시 인코딩
        tdir = os.path.join(P, "final", "transitions")
        os.makedirs(tdir, exist_ok=True)
        inputs, segs = [], []
        for si, sid in enumerate(secs):
            src_rel = os.path.join("sections", sid, "render", "%s.mp4" % sid)
            dur = tls[sid].get("duration", 0)
            head = trans[si - 1]["frames"] if si > 0 else 0
            tail = trans[si]["frames"] if si < len(trans) else 0
            inputs += ["-i", os.path.join(P, src_rel)]
            k = len(inputs) // 2 - 1
            segs.append("[%d:v]trim=start_frame=%d:end_frame=%d,setpts=PTS-STARTPTS,fps=%d,%s,format=yuv420p[v%d]" % (k, head, dur - tail, fps, TOTV, len(segs)))
            if tail:
                b_rel = os.path.join("sections", secs[si + 1], "render", "%s.mp4" % secs[si + 1])
                tp = render_transition(P, src_rel, dur - tail, b_rel, trans[si], os.path.join(tdir, "%s_%s.mp4" % (sid, secs[si + 1])))
                print("전환 %s->%s %s %d프레임" % (sid, secs[si + 1], trans[si].get("type"), tail), flush=True)
                inputs += ["-i", tp]
                k = len(inputs) // 2 - 1
                segs.append("[%d:v]setpts=PTS-STARTPTS,fps=%d,%s,format=yuv420p[v%d]" % (k, fps, TOTV, len(segs)))
        fc = ";".join(segs) + ";" + "".join("[v%d]" % i for i in range(len(segs))) + "concat=n=%d:v=1:a=0[v]" % len(segs)
        run(["ffmpeg", "-y", "-loglevel", "error"] + inputs + ["-filter_complex", fc, "-map", "[v]", "-c:v", "libx264", "-preset", "medium",
                                                            "-crf", "15", "-pix_fmt", "yuv420p"] + BT709 + ["-r", str(fps), video])
    else:
        run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", video])
    ms_mov = None if a.draft else milestone_overlay(P, cfg, theme, starts_out, offset, fps, tmp)
    if ms_mov:
        v2 = os.path.join(tmp, "video_ms.mp4")
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-i", ms_mov, "-filter_complex", "[1:v]format=yuva420p,scale=out_color_matrix=bt709:out_range=tv[ms];[0:v][ms]overlay=0:0:format=yuv420,format=yuv420p[v]",
             "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p"] + BT709 + ["-r", str(fps), v2])
        video = v2
        print("마일스톤 바 겹침", flush=True)
    with open(os.path.join(P, "final", "master_draft.json" if a.draft else "master.json"), "w", encoding="utf-8") as f:
        json.dump({"fps": fps, "total_frames": offset, "sections": starts_out, "transitions": [dict(t, into=secs[i + 1]) for i, t in enumerate(trans)]},
                  f, ensure_ascii=False, indent=2)
    D = "%.3f" % (offset / float(fps))
    if not clips:
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-c", "copy", out])
        print("합본(무음, 음성 없음):", os.path.relpath(out, P), D + "s")
        return
    # 나레이션 트랙
    narr = os.path.join(tmp, "narration.wav")
    inputs, parts = [], []
    for i, (wav, at) in enumerate(clips):
        inputs += ["-i", wav]
        ms = int(round(at * 1000.0 / fps))
        parts.append("[%d:a]aresample=48000,aformat=channel_layouts=mono,adelay=%d|%d[a%d]" % (i, ms, ms, i))
    fc = ";".join(parts) + ";" + "".join("[a%d]" % i for i in range(len(clips))) + \
        "amix=inputs=%d:normalize=0:dropout_transition=0,apad=whole_dur=%s,atrim=0:%s[n]" % (len(clips), D, D)
    run(["ffmpeg", "-y", "-loglevel", "error"] + inputs + ["-filter_complex", fc, "-map", "[n]", narr])
    bgm = (cfg.get("bgm") or {}).get("tracks") or []
    base = out.replace(".mp4", "_narration_only.mp4") if bgm else out
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-i", narr, "-filter_complex",
         "[1:a]volume=6dB,alimiter=limit=0.95:level=false[a]", "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", base])
    if bgm:
        track = bgm[0] if os.path.isabs(bgm[0]) else os.path.join(P, bgm[0])
        vol = (cfg.get("bgm") or {}).get("volume", 0.24)
        # 앞부분만 깔기: bgm.until(섹션 id — 그 섹션 시작에서 끝) 또는 bgm.end_sec(초). fade_out초 동안 줄어든 뒤 무음
        bg = cfg.get("bgm") or {}
        E = None
        if bg.get("until"):
            st = {s["id"]: s["start"] for s in (rj(os.path.join(P, "final", "master.json"), {}) or {}).get("sections", [])}
            if bg["until"] in st:
                E = st[bg["until"]] / float(fps)
        elif bg.get("end_sec"):
            E = float(bg["end_sec"])
        if E is not None and E < float(D):
            F = float(bg.get("fade_out", 4))
            cut = "atrim=0:{E:.3f},afade=t=out:st={S:.3f}:d={F:.3f},apad=whole_dur={D}".format(E=E, S=max(0.0, E - F), F=F, D=D)
            print("BGM: 0 ~ %.1f초 (끝 %.0f초 페이드아웃)" % (E, F))
        else:
            cut = "atrim=0:{D}".format(D=D)
        # 덕킹 세기: bgm.duck_ratio (기본 8 = 목소리 나오면 음악 거의 사라짐, 3 = 살짝 낮아져 계속 들림)
        dr = float(bg.get("duck_ratio", 8))
        fc = ("[2:a]aloop=loop=-1:size=2e9," + cut + ",volume={v}[b];[1:a]asplit=2[n1][n2];"
              "[b][n1]sidechaincompress=threshold=0.015:ratio=" + ("%g" % dr) + ":attack=30:release=1200[bd];"
              "[n2]volume=6dB[nv];[nv][bd]amix=inputs=2:normalize=0:dropout_transition=0,apad=whole_dur={D},atrim=0:{D},alimiter=limit=0.95:level=false[a]").format(D=D, v=vol)
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-i", narr, "-i", track, "-filter_complex", fc,
             "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", out])
    print("합본:", os.path.relpath(out, P), D + "s", "(나레이션 %d개%s)" % (len(clips), ", BGM 덕킹" if bgm else ""))


if __name__ == "__main__":
    main()
