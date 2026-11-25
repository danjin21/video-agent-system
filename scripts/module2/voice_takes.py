# -*- coding: utf-8 -*-
"""문장 하나씩 다시 만들고 골라 끼우기 (HeyGen).

  py -3 voice_takes.py <프로젝트> gen  s01:b1,s22:b7 [--n 3]  → 00-direction/takes/s01_b1/take-1..n.wav (+ current.wav)
                                                             + 00-direction/비교_s01_b1.wav (지금 → 새1 → 새2 … 0.9초 간격)
  py -3 voice_takes.py <프로젝트> use  s01:b1 2               → take-2로 교체 (기존은 takes/…/replaced-시각.wav 보관) + 시간 다시 잡기
  py -3 voice_takes.py <프로젝트> review                      → 00-direction/문장별_듣기/ (번호_섹션_문장_대사.wav 전부 + _문장목록.txt:
                                                               나레이션 전체 mp3 기준 시각) — 사용자가 번호로 '이 문장 이상' 지목
  2026-11-24 사용자: "한 문장씩 만들어서, 삑사리 나는 부분만 찾아서 고칠 수 있도록"

- 실값(마스킹 대상)이 든 문장은 tts_heygen.make_audio 그대로 → 실값 구간 무음. 끼운 뒤 splice_real.py로 다시 붙여야 함(안내 출력).
- 생성 직후 처리: 앞뒤 5ms 페이드(시작/끝 '틱' 제거) + 음량을 -16.5dB(말소리 구간)로 맞추되 피크는 -1.5dB를 넘지 않게
  (리미터로 누르지 않음 — 찌그러짐 방지).
"""
import os, re, sys, json, glob, shutil, time, wave, array, math, subprocess, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# 프로젝트 폴더: 첫 인자가 폴더면 그것, 아니면 현재 폴더
if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]):
    P = os.path.abspath(sys.argv.pop(1))
else:
    P = os.getcwd()
import tts_heygen as T  # noqa: E402
import redact  # noqa: E402

TAKES = os.path.join(P, "00-direction", "takes")
TARGET_DB, PEAK_DB = -16.5, -1.5


def beat_of(key):
    sid, bid = key.split(":")
    bj = T.rj(os.path.join(P, "sections", sid, "beats.json"))
    b = next(x for x in bj["beats"] if x["id"] == bid)
    wav = os.path.join(P, "sections", sid, "audio", "beat-%s.wav" % bid[1:])
    return sid, bid, b, wav


def read(p):
    w = wave.open(p); sr = w.getframerate(); a = array.array("h", w.readframes(w.getnframes())); w.close()
    return a, sr


def active_db(a, sr):
    hop = int(sr * .02); fr = []
    for i in range(0, len(a) - hop, hop):
        s = a[i:i + hop]; fr.append(sum(x * x for x in s) / hop)
    if not fr: return -99.0, -99.0
    loud = sorted(fr)[len(fr) // 3:]  # 무음 제외(아래 1/3 버림)
    rms = math.sqrt(sum(loud) / len(loud)) / 32768
    pk = max(abs(x) for x in a) / 32768
    return 20 * math.log10(max(rms, 1e-6)), 20 * math.log10(max(pk, 1e-6))


def finish(src, dst):
    """페이드 + 음량 맞춤(리미터 없음)."""
    a, sr = read(src)
    rdb, pdb = active_db(a, sr)
    g = min(TARGET_DB - rdb, PEAK_DB - pdb)
    dur = len(a) / sr
    flt = "afade=t=in:d=0.005,afade=t=out:st=%.4f:d=0.005,volume=%.2fdB" % (max(0, dur - 0.005), g)
    tmp = dst + ".tmp.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-af", flt, "-ar", "48000", "-ac", "1", tmp], check=True)
    os.replace(tmp, dst)
    return rdb + g, pdb + g


def cmd_list():
    os.makedirs(TAKES, exist_ok=True)
    out = []
    for bjp in sorted(glob.glob(os.path.join(P, "sections", "s*", "beats.json"))):
        sid = os.path.basename(os.path.dirname(bjp))
        for b in T.rj(bjp)["beats"]:
            if b.get("text"): out.append("%s:%s\t%s" % (sid, b["id"], b["text"]))
    open(os.path.join(TAKES, "문장목록.txt"), "w", encoding="utf-8").write("\n".join(out) + "\n")
    print("\n".join(out))


def cmd_gen(keys, n):
    cfg = T.rj(os.path.join(P, "project.json"), {}); voice = cfg.get("voice") or {}
    vid = voice["voice_id"]; key = T.api_key(); m = redact.load_map(P)
    st, mode, vstatus, err = T.voice_mode(key, vid)
    if st != 200: sys.exit("보이스 조회 실패 HTTP %s" % st)
    pro = mode == "professional"
    vm = voice.get("heygen_model") or ""
    model = vm if vm.startswith("heygen-voice-") else ("heygen-voice-1" if pro else "heygen-voice-1-turbo-free")
    for k in keys:
        sid, bid, b, wav = beat_of(k)
        d = os.path.join(TAKES, "%s_%s" % (sid, bid)); os.makedirs(d, exist_ok=True)
        if os.path.exists(wav) and not os.path.exists(os.path.join(d, "current.wav")):
            shutil.copy2(wav, os.path.join(d, "current.wav"))
        sp, expr, pitch = T.tone_of(b, voice)
        have = len(glob.glob(os.path.join(d, "take-*.wav")))
        for i in range(have + 1, have + n + 1):
            raw = os.path.join(d, "take-%d.raw.wav" % i)
            ok, info = T.make_audio(key, vid, pro, model, b["text"], m, raw, sp, expr, pitch)
            if not ok:
                print("실패 %s take-%d %s" % (k, i, info["error"])); continue
            out = os.path.join(d, "take-%d.wav" % i)
            finish(raw, out)
            T.wj(out[:-4] + ".json", {"key": k, "text": b["text"], "words": info["words"], "mute": info["mute"], "model": model,
                                      "voice_id": vid, "voice_mode": mode, "speed": sp, "expressiveness": expr, "pitch": pitch,
                                      "duration": info["duration"], "muted_tokens": T.sensitive_left(P, b["text"], m)})
            print("완료 %s take-%d %.2fs%s" % (k, i, T.dur_of(out), ("  (실값 무음 %s)" % info["mute"]) if info["mute"] else ""))
        concat([os.path.join(d, "current.wav")] + sorted(glob.glob(os.path.join(d, "take-[0-9]*.wav")), key=lambda p: int(re.findall(r"take-(\d+)", p)[0])),
               os.path.join(P, "00-direction", "비교_%s_%s.wav" % (sid, bid)))
        print("  → %s  (비교 파일: 00-direction/비교_%s_%s.wav)" % (d, sid, bid))


def concat(files, out, gap=0.9):
    files = [f for f in files if os.path.exists(f)]
    if not files:
        return
    inp, fc = [], ""
    for k, f in enumerate(files):
        inp += ["-i", f]; fc += "[%d:a]aresample=48000,apad=pad_dur=%.2f[a%d];" % (k, gap, k)
    fc += "".join("[a%d]" % k for k in range(len(files))) + "concat=n=%d:v=0:a=1[o]" % len(files)
    subprocess.run(["ffmpeg", "-y", "-v", "error"] + inp + ["-filter_complex", fc, "-map", "[o]", "-ac", "1", out], check=True)


def cmd_review():
    """문장별 듣기 폴더: 모든 문장 wav를 번호 붙여 복사 + 목록(나레이션 전체 mp3 기준 시각 = 앞 섹션 길이 합 + 문장 시작)."""
    O = os.path.join(P, "00-direction", "문장별_듣기")
    shutil.rmtree(O, ignore_errors=True); os.makedirs(O)
    cfg = T.rj(os.path.join(P, "project.json"), {})
    sids = [s["id"] for s in cfg.get("sections", [])] or sorted(os.listdir(os.path.join(P, "sections")))
    off, n, lines = 0.0, 0, ["	".join(["번호", "나레이션 시각", "섹션:문장", "대사"])]
    first = True
    for sid in sids:
        tl = T.rj(os.path.join(P, "sections", sid, "timeline.json"), {})
        bj = T.rj(os.path.join(P, "sections", sid, "beats.json"), {"beats": []})
        has = False
        for b in bj["beats"]:
            w = os.path.join(P, "sections", sid, "audio", "beat-%s.wav" % b["id"][1:])
            if not os.path.exists(w) or not b.get("text"):
                continue
            has = True; n += 1; t = off + b.get("start", 0) / T.FPS
            short = re.sub(r'[\\/:*?"<>|.,]', "", b["text"])[:22].strip()
            shutil.copy2(w, os.path.join(O, "%03d_%s_%s_%s.wav" % (n, sid, b["id"], short)))
            lines.append("%03d	%d분%02d초	%s:%s	%s" % (n, t // 60, t % 60, sid, b["id"], b["text"]))
        if has or not first:   # 맨 앞 무음 섹션(인트로)은 나레이션 mp3에 없음
            off += tl.get("duration", 0) / T.FPS; first = False
    open(os.path.join(O, "_문장목록.txt"), "w", encoding="utf-8").write(chr(10).join(lines) + chr(10))
    print("%d문장 → %s" % (n, O))


def cmd_use(k, i):
    sid, bid, b, wav = beat_of(k)
    d = os.path.join(TAKES, "%s_%s" % (sid, bid))
    tk = os.path.join(d, "take-%s.wav" % i); meta = T.rj(tk[:-4] + ".json")
    if os.path.exists(wav):
        shutil.copy2(wav, os.path.join(d, "replaced-%s.wav" % time.strftime("%m%d_%H%M%S")))
    shutil.copy2(tk, wav)
    T.wj(wav[:-4] + ".words.json", {"beat": "beat-" + bid[1:], "duration_s": round(T.dur_of(wav), 3), "text": b["text"], "words": meta["words"]})
    T.wj(wav[:-4] + ".tts.json", {"provider": "heygen", "voice_id": meta["voice_id"], "model": meta["model"], "voice_mode": meta["voice_mode"],
                                  "speed": meta["speed"], "expressiveness": meta["expressiveness"], "pitch": meta["pitch"],
                                  "muted": meta["mute"], "muted_tokens": meta["muted_tokens"],
                                  "text_sha1": hashlib.sha1(b["text"].encode("utf-8")).hexdigest()[:12], "duration": meta["duration"],
                                  "take": "take-%s" % i})
    cfg = T.rj(os.path.join(P, "project.json"), {})
    dur, n = T.retime(P, sid, cfg)
    print("%s → take-%s 로 교체. %s 시간 다시 잡음 %.1f초" % (k, i, sid, dur / T.FPS))
    if meta["mute"]:
        print("※ 실값 무음 구간이 있음 → splice_real.py %s 로 실단어를 다시 붙이세요" % sid)
    print("※ 화면 타이밍 반영: 해당 섹션 설계 스크립트를 다시 돌리세요")


if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    c = sys.argv[1]
    if c == "list": cmd_list()
    elif c == "gen":
        n = int(sys.argv[sys.argv.index("--n") + 1]) if "--n" in sys.argv else 3
        cmd_gen([x for x in sys.argv[2].split(",") if x], n)
    elif c == "use": cmd_use(sys.argv[2], sys.argv[3])
    elif c == "review": cmd_review()
    else: sys.exit(__doc__)
