#!/usr/bin/env python3
"""
sync_qa.py — 발화↔애니메이션 타이밍 검증 (무설치: ffmpeg + Python 표준 라이브러리).

문제: 애니메이션 트리거 프레임을 "비트 안 어디쯤"으로 *추정*하면 발화와 어긋나도 알 수 없다
(2026-06: akjang-14 'AX' 노드를 추정으로 넣음 → 검증 불가).

핵심: **트리거는 추정하지 말고 측정된 발화에 맞춘다.**
- 비트가 짧으면: 트리거 = 측정된 *비트 시작 프레임*(audio boundary = visual beat).
- 비트가 길어 비트 안 특정 단어에 맞춰야 하면(예: "AX입니다"에서 하이라이트):
  비트 텍스트를 문장부호(,.·!?)로 **프로소디 구절**로 쪼개고, 검출된 발화 onset에 **순서대로 매핑**해
  대상 단어가 든 구절의 onset 프레임을 구한다. (단어 라벨 없는 onset만으로는 못 잡던 걸 잡게 됨.)

입력: beats_manifest.json + 비트 WAV들 + triggers.json
triggers.json:
  { "texts": { "akjang-14": { "b3": "다른 하나는 가장 새로운 근육, AX입니다. 사람과 AI가 ..." } },
    "akjang-14": [ {"el":"AX 노드 채움", "frame":350, "beat":"b3", "word":"AX"}, ... ] }
  (texts 없으면 <dir>/<slide>-<beat>.txt 사이드카를 읽음. word 없으면 비트 시작 경계로 검사.)
출력: report.json + 콘솔. 종료코드: flag 있으면 1.
"""
import sys, os, json, math, subprocess, argparse, struct, re

def load_pcm(path, sr=16000):
    raw = subprocess.run(["ffmpeg","-v","quiet","-i",path,"-ar",str(sr),"-ac","1","-f","s16le","-"],
                         stdout=subprocess.PIPE, check=True).stdout
    n = len(raw)//2
    return [s/32768.0 for s in struct.unpack("<%dh"%n, raw[:n*2])], sr

def onsets_s(path, silence_ratio=0.10, min_gap_s=0.18):
    """비트 내부 발화 onset 시각(초) — 무음(≥min_gap) 뒤 발화 시작점들. 첫 onset≈0(비트 시작)."""
    x, sr = load_pcm(path)
    win, hop = int(sr*0.025), int(sr*0.010)
    env = [math.sqrt(sum(v*v for v in x[i:i+win])/win) for i in range(0, max(1,len(x)-win), hop)]
    if not env: return []
    thr = silence_ratio*(max(env) or 1e-9)
    ons, prev, quiet = [], False, 0
    for i, e in enumerate(env):
        v = e > thr
        if v and not prev and quiet*hop/sr >= (min_gap_s if ons else 0):
            ons.append(i*hop/sr)
        quiet = 0 if v else quiet+1
        prev = v
    return ons

def phrases(text):
    """문장부호로 프로소디 구절 분리(쉼표·마침표·가운뎃점 등 = 발화 시 쉼)."""
    return [p.strip() for p in re.split(r'[,.!?·…]+', text) if p.strip()]

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
    texts = trig.get("texts", {})
    out_dir = a.out or os.path.join(a.beats_dir, "sync_qa")
    os.makedirs(out_dir, exist_ok=True)

    def beat_text(slide, beat):
        t = texts.get(slide, {}).get(beat)
        if t: return t
        p = os.path.join(a.beats_dir, f"{slide}-{beat}.txt")
        return open(p, encoding="utf-8").read().strip() if os.path.exists(p) else None

    results, flagged = [], 0
    for slide, items in trig.items():
        if slide == "texts": continue
        beats = {b["beat"]: b for b in man.get(slide, {}).get("beats", [])}
        for it in items:
            b = beats.get(it["beat"])
            if not b:
                results.append({**it, "slide": slide, "verdict": "no_beat"}); continue
            bstart = b["start_frame"]
            wav = os.path.join(a.beats_dir, f"{slide}-{it['beat']}.wav")
            ons = onsets_s(wav) if os.path.exists(wav) else []
            ons_frames = [round(bstart + o*fps) for o in ons]
            word = it.get("word")
            phr = phrases(beat_text(slide, it["beat"]) or "")
            target_frame, basis = None, ""
            if word and phr and ons_frames:
                # 단어가 든 구절 index → 같은 index의 onset (구절 수와 onset 수가 맞을 때 1:1)
                idx = next((i for i, p in enumerate(phr) if word in p), None)
                if idx is not None:
                    target_frame = ons_frames[min(idx, len(ons_frames)-1)]
                    basis = f'"{word}"=구절{idx+1}/{len(phr)} → onset {target_frame}'
            if target_frame is None:        # 단어 미지정/매칭실패 → 비트 시작 경계
                target_frame = bstart
                basis = f"비트 시작 {bstart}"
            delta_s = (it["frame"] - target_frame)/fps
            if abs(it["frame"] - target_frame) <= a.tol*fps:
                verdict = f"ok ({basis}, {delta_s:+.2f}s)"
            else:
                verdict = f"FLAG: {basis} 인데 트리거 f{it['frame']} ({delta_s:+.2f}s 어긋남) → frame={target_frame}로"
                flagged += 1
            results.append({"slide": slide, "el": it["el"], "beat": it["beat"], "frame": it["frame"],
                            "beat_start": bstart, "phrases": phr, "onset_frames": ons_frames,
                            "target": word, "target_frame": target_frame, "delta_s": round(delta_s, 2), "verdict": verdict})
            print(f"  {slide} {it['beat']:>3} {it['el'][:20]:<20} f{it['frame']:<5} → {verdict}")

    json.dump({"tol_s": a.tol, "flagged": flagged, "results": results},
              open(os.path.join(out_dir, "report.json"), "w"), ensure_ascii=False, indent=2)
    print(f"\n→ {out_dir}/report.json  ({flagged} flagged)")
    sys.exit(1 if flagged else 0)

if __name__ == "__main__":
    main()
