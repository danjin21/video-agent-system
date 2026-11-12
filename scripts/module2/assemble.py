#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""모듈2 합본 — 섹션 렌더를 이어 붙이고 나레이션·BGM을 깐다 (모듈1 assemble 교훈 반영).

  assemble.py <project> [--draft] [--out final/master.mp4]

- 비디오: 섹션 mp4에서 오디오를 떼고(-an) concat. 오디오 포함 mp4를 그대로 concat하면 AAC priming으로
  섹션 경계마다 영상이 1~2프레임씩 밀린다(2026-09 모듈1 사고).
- 나레이션: 섹션 audio/beat-N.wav 원본을 (섹션 시작 프레임 + 비트 시작 프레임) 위치에 adelay로 배치.
- BGM: project.json bgm.tracks[0] 이 있으면 반복 재생, 나레이션에 사이드체인 덕킹. `-shortest` 쓰지 않고 apad/atrim으로 길이 고정.
- --draft: 섹션 최종본(sNN.mp4) 대신 초안(preview.mp4)으로 빠르게 이어 보기.
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


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("--draft", action="store_true")
    ap.add_argument("--out")
    a = ap.parse_args()
    P = os.path.abspath(a.project)
    cfg = rj(os.path.join(P, "project.json"), {})
    fps = cfg.get("fps", 30)
    secs = [s["id"] for s in cfg.get("sections", [])]
    tmp = tempfile.mkdtemp(prefix="m2asm_")
    lst = os.path.join(tmp, "list.txt")
    offset, clips, missing = 0, [], []
    with open(lst, "w", encoding="utf-8") as f:
        for sid in secs:
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
            offset += tl.get("duration", 0)
    if missing:
        sys.exit("렌더 없는 섹션: %s → render_section.py %s <sid>%s 먼저" % (", ".join(missing), P, " --draft" if a.draft else ""))
    os.makedirs(os.path.join(P, "final"), exist_ok=True)
    out = os.path.join(P, a.out) if a.out else os.path.join(P, "final", "master_draft.mp4" if a.draft else "master.mp4")
    video = os.path.join(tmp, "video.mp4")
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", video])
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
        fc = ("[2:a]aloop=loop=-1:size=2e9,atrim=0:{D},volume={v}[b];[1:a]asplit=2[n1][n2];"
              "[b][n1]sidechaincompress=threshold=0.015:ratio=8:attack=30:release=1200[bd];"
              "[n2]volume=6dB[nv];[nv][bd]amix=inputs=2:normalize=0:dropout_transition=0,apad=whole_dur={D},atrim=0:{D},alimiter=limit=0.95:level=false[a]").format(D=D, v=vol)
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-i", narr, "-i", track, "-filter_complex", fc,
             "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", out])
    print("합본:", os.path.relpath(out, P), D + "s", "(나레이션 %d개%s)" % (len(clips), ", BGM 덕킹" if bgm else ""))


if __name__ == "__main__":
    main()
