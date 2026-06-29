#!/usr/bin/env python3
"""
sync_qa.py — 발화↔애니메이션 타이밍 검증 (무설치: ffmpeg + Python 표준 라이브러리).

문제: 애니메이션 트리거 프레임을 "비트 안 어디쯤"으로 *추정*하면 발화와 어긋나도 알 수 없다
(2026-06: akjang-14 AX 노드를 추정으로 frame 350에 넣음 → 검증 불가).

원칙: **트리거는 추정하지 말고 측정된 발화 onset에 맞춘다.**
- 가장 안전: 트리거 = 측정된 *비트 시작 프레임*(audio boundary = visual beat). 비트를 잘게 쪼개면 모든 트리거가 경계에 떨어진다.
- 비트가 길어 비트 안에서 특정 단어에 맞춰야 하면: 이 스크립트가 비트 내부 발화 onset(쉼→발화 전환)들을 측정해, 트리거가 실제 onset에 붙어 있는지 검사한다.

입력: beats_manifest.json + 비트 WAV들 + triggers.json
triggers.json 예:
  { "akjang-14": [ {"el":"AX 노드 채움", "frame":314, "beat":"b3"},
                   {"el":"함께 링크", "frame":408, "beat":"b3"} ] }
출력: report.json (el, frame, beat, 비트시작, 비트내 onset들, 가장가까운 onset, delta_s, verdict)
종료코드: flag 있으면 1.
"""
import sys, os, json, math, wave, contextlib, subprocess, argparse

def load_pcm(path, sr=16000):
    raw = subprocess.run(["ffmpeg","-v","quiet","-i",path,"-ar",str(sr),"-ac","1","-f","s16le","-"],
                         stdout=subprocess.PIPE, check=True).stdout
    import struct
    n = len(raw)//2
    return [s/32768.0 for s in struct.unpack("<%dh"%n, raw[:n*2])], sr

def rms_frames(x, win, hop):
    return [math.sqrt(sum(v*v for v in x[i:i+win])/max(1,len(x[i:i+win]))) for i in range(0, max(1,len(x)-win+1), hop)]

def onsets_s(path, fps, silence_ratio=0.10, min_gap_s=0.18):
    """비트 내부 발화 onset 시각(초) 리스트 — 무음 구간 뒤 발화가 시작되는 지점들."""
    x, sr = load_pcm(path)
    win, hop = int(sr*0.025), int(sr*0.010)
    env = rms_frames(x, win, hop)
    if not env: return []
    peak = max(env) or 1e-9
    thr = silence_ratio*peak
    voiced = [e > thr for e in env]
    ons = []
    prev = False
    quiet_run = 0
    for i, v in enumerate(voiced):
        if v and not prev and quiet_run*hop/sr >= (min_gap_s if ons else 0):
            ons.append(i*hop/sr)
        if not v: quiet_run += 1
        else: quiet_run = 0
        prev = v
    return ons

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("beats_dir")
    ap.add_argument("--triggers", required=True)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--tol", type=float, default=0.20, help="허용 오차(초)")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    fps = a.fps
    man = json.load(open(os.path.join(a.beats_dir, "beats_manifest.json")))
    trig = json.load(open(a.triggers))
    out_dir = a.out or os.path.join(a.beats_dir, "sync_qa")
    os.makedirs(out_dir, exist_ok=True)

    results, flagged = [], 0
    for slide, items in trig.items():
        beats = {b["beat"]: b for b in man.get(slide, {}).get("beats", [])}
        for it in items:
            b = beats.get(it["beat"])
            if not b:
                results.append({**it, "slide": slide, "verdict": "no_beat"}); continue
            bstart = b["start_frame"]
            wav = os.path.join(a.beats_dir, f"{slide}-{it['beat']}.wav")
            ons = onsets_s(wav, fps) if os.path.exists(wav) else []
            ons_frames = [round(bstart + o*fps) for o in ons]
            off = it["frame"] - bstart            # 비트 시작 대비 트리거 오프셋(frame)
            # 가장 가까운 발화 onset
            near = min(ons_frames, key=lambda of: abs(of - it["frame"])) if ons_frames else bstart
            delta_s = (it["frame"] - near)/fps
            on_boundary = abs(off) <= a.tol*fps
            on_onset = abs(it["frame"] - near) <= a.tol*fps
            if on_boundary:
                verdict = "ok: 비트 시작에 정렬(안전)"
            elif on_onset:
                verdict = f"ok: 발화 onset 정렬(+{delta_s:.2f}s)"
            else:
                verdict = f"FLAG: 추정 타이밍 — 가장 가까운 onset과 {delta_s:+.2f}s 어긋남. 그 단어에 맞추려면 비트를 쪼개거나 frame={near}로"
                flagged += 1
            results.append({"slide": slide, "el": it["el"], "beat": it["beat"], "frame": it["frame"],
                            "beat_start": bstart, "onset_frames": ons_frames,
                            "nearest_onset": near, "delta_s": round(delta_s, 2), "verdict": verdict})
            print(f"  {slide} {it['beat']:>3} {it['el'][:22]:<22} f{it['frame']:<5} → {verdict}")

    json.dump({"tol_s": a.tol, "flagged": flagged, "results": results},
              open(os.path.join(out_dir, "report.json"), "w"), ensure_ascii=False, indent=2)
    print(f"\n→ {out_dir}/report.json  ({flagged} flagged)")
    sys.exit(1 if flagged else 0)

if __name__ == "__main__":
    main()
