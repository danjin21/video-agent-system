# -*- coding: utf-8 -*-
"""무음 처리된 민감 실값을 같은 목소리로 따로 만들어 나레이션에 끼워 넣는다 (module2.md §7-3).

  py -3 splice_real.py <프로젝트> plan            # 끼울 자리 목록 + 읽는 형태 확인
  py -3 splice_real.py <프로젝트> make            # 실단어 조각 생성(project.json voice.provider: heygen|elevenlabs) + 끼워 넣기
  py -3 splice_real.py <프로젝트> make --only s02:b1 [--regen]

- 읽는 형태: redaction_map.json 토큰의 "say"(있으면) → 없으면 숫자를 한자어로 자동 변환(say_of). plan에서 꼭 확인.
- 다른 목소리로 바꾼 뒤에는 audio/splice/*.masked.wav 를 지우고 다시 돌린다(예전 목소리 원본 재사용 방지).

- 조각 요청에는 실단어(읽는 형태)만 보낸다. 앞뒤 문맥 인자에는 마스킹 문장만 넣는다.
- 원본(무음) 비트 음성은 audio/splice/beat-N.masked.wav 로 보관. 다시 돌리면 그 원본에서 다시 만든다.
- 끼운 뒤 비트 길이가 바뀌므로 tts_voice.py --retime 과 디자인 스크립트를 다시 돌려야 한다.
"""
import base64, json, os, re, subprocess, sys, urllib.request, urllib.error, wave, array, math, shutil

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tts_heygen as T  # noqa: E402

# 프로젝트 폴더: 첫 인자가 폴더면 그것, 아니면 현재 폴더
if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]):
    P = os.path.abspath(sys.argv.pop(1))
else:
    P = os.getcwd()

_DIG = "영일이삼사오육칠팔구"


def _read_int(n):
    """정수 → 한자어 읽기 (사천백칠십팔). 1은 '일' 생략(십·백·천), 만·억·조 단위."""
    if n == 0:
        return "영"
    out, big = "", ["", "만", "억", "조", "경"]
    k = 0
    while n:
        n, part = divmod(n, 10000)
        if part:
            s = ""
            for unit, v in (("천", part // 1000), ("백", part // 100 % 10), ("십", part // 10 % 10), ("", part % 10)):
                if v:
                    s += ("" if (v == 1 and unit) else _DIG[v]) + unit
            if s == "일" and k == 1:
                s = ""   # 10000 → 만 (일만 아님)
            out = s + big[k] + out
        k += 1
    return out


def say_of(real):
    """실값 → 소리 나는 대로 (1,234억 원 → 천이백삼십사억 원, 12.5조 → 십이 점 오조, 3%p → 삼 퍼센트포인트).
    redaction_map.json 토큰에 "say"가 있으면 그걸 우선 쓴다(스튜디오·직접 수정)."""
    def num(mo):
        a, _, b = mo.group(0).replace(",", "").partition(".")
        s = _read_int(int(a))
        if b:
            s += " 점 " + "".join(_DIG[int(c)] for c in b)
        return s
    s = re.sub(r"\d[\d,]*(?:\.\d+)?", num, real)
    return s.replace("%p", " 퍼센트포인트").replace("%", " 퍼센트")


SR = 48000
XF = 0.015  # 이음새 크로스페이드(초)


def rj(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def wj(p, o):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, indent=2)


def ff(*a):
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", *a], capture_output=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError(r.stderr)


def read_wav(p):
    with wave.open(p) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2, p
        a = array.array("h"); a.frombytes(w.readframes(w.getnframes()))
    return [x / 32768.0 for x in a]


def write_wav(p, s):
    a = array.array("h", [max(-32768, min(32767, int(round(x * 32767)))) for x in s])
    with wave.open(p, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(a.tobytes())


def rms(s):
    s = [x for x in s if abs(x) > 0.003]
    return math.sqrt(sum(x * x for x in s) / len(s)) if s else 0.0


def jobs():
    m = rj(os.path.join(P, "00-direction", "redaction_map.json"))
    reals = [t["real"] for t in m["tokens"] if not t.get("allow")]
    say_map = {t["real"]: t["say"] for t in m["tokens"] if t.get("say")}
    out = []
    for sid in sorted(os.listdir(os.path.join(P, "sections"))):
        d = os.path.join(P, "sections", sid)
        for fn in sorted(os.listdir(os.path.join(d, "audio")) if os.path.isdir(os.path.join(d, "audio")) else []):
            if not fn.endswith(".tts.json"):
                continue
            tj = rj(os.path.join(d, "audio", fn))
            if not tj.get("muted"):
                continue
            n = fn.split(".")[0].split("-")[1]
            beat = next(b for b in rj(os.path.join(d, "beats.json"))["beats"] if b["id"] == "b" + n)
            text = beat["text"]
            # 문장 안 실값 등장 순서 = 무음 구간 순서
            hits, i = [], 0
            while i < len(text):
                h = next((r for r in sorted(reals, key=len, reverse=True) if text.startswith(r, i)), None)
                if h:
                    hits.append((i, h)); i += len(h)
                else:
                    i += 1
            assert len(hits) == len(tj["muted"]), (sid, n, hits, tj["muted"])
            for (ci, real), (t0, t1) in zip(hits, tj["muted"]):
                out.append({"sid": sid, "n": n, "real": real, "say": say_map.get(real) or say_of(real), "t0": t0, "t1": t1,
                            "prev": T.masked_text(text[:ci], m)[0].strip(), "next": T.masked_text(text[ci + len(real):], m)[0].strip(),
                            "tts": tj, "m": m})
    return out


def gen_fragment_heygen(j, out_wav):
    """HeyGen: 앞뒤 마스킹 문장을 붙인 '운반 문장'으로 만들어 억양을 살리고, 글자별 시각으로 실단어 구간만 잘라낸다.
    운반 문장에 들어가는 실값은 이 실단어 하나뿐 (게이트로 확인)."""
    key = T.api_key()
    tj = j["tts"]
    prev = (j["prev"] or "").strip()
    nxt = (j["next"] or "").strip()
    text = (prev + " " if prev else "") + j["say"] + ((" " + nxt) if nxt else "")
    i0 = len(prev) + (1 if prev else 0)
    i1 = i0 + len(j["say"])
    if T.sensitive_left(None, prev + " " + nxt, j["m"]):
        raise RuntimeError("게이트: 문맥에 실값")
    body = {"voice_id": tj["voice_id"], "text": text, "language": "ko", "model": tj["model"], "with_timestamps": True}
    st, res = T.call("POST", "/v3/models/audio/tts", key, body, timeout=180)
    if st != 200:
        raise RuntimeError("HTTP %s %s" % (st, json.dumps(res, ensure_ascii=False)[:300]))
    dat = res.get("data") or {}
    raw = out_wav[:-4] + ".raw.wav"
    with urllib.request.urlopen(dat["audio_url"], timeout=120) as r, open(raw, "wb") as f:
        f.write(r.read())
    span = T.char_spans_to_time(dat.get("original_characters"), [(i0, i1)], pad=0.02)
    if not span:
        raise RuntimeError("글자 시각 없음")
    a, b = span[0][0], span[0][1] + 0.04
    ff("-i", raw, "-af", "atrim=%.3f:%.3f,asetpts=N/SR/TB" % (a, b), "-ar", str(SR), "-ac", "1", out_wav)
    os.remove(raw)
    return b - a


def gen_fragment(j, out_wav):
    if j["tts"].get("provider") == "heygen":
        return gen_fragment_heygen(j, out_wav)
    key = T.el_key()
    tj = j["tts"]
    body = {"text": j["say"], "model_id": tj["model"], "voice_settings": tj["settings"]}
    if j["prev"]:
        body["previous_text"] = j["prev"]
    if j["next"]:
        body["next_text"] = j["next"]
    # 게이트: 문맥 인자에 실값이 섞이면 보내지 않는다
    if T.sensitive_left(None, (body.get("previous_text") or "") + " " + (body.get("next_text") or ""), j["m"]):
        raise RuntimeError("게이트: 문맥에 실값")
    req = urllib.request.Request(T.EL_API + "/v1/text-to-speech/%s/with-timestamps?output_format=mp3_44100_128" % tj["voice_id"],
                                 data=json.dumps(body, ensure_ascii=False).encode("utf-8"), method="POST",
                                 headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        res = json.loads(r.read().decode("utf-8"))
    raw = out_wav[:-4] + ".mp3"
    with open(raw, "wb") as f:
        f.write(base64.b64decode(res["audio_base64"]))
    al = res.get("alignment") or {}
    st = [s for c, s in zip(al["characters"], al["character_start_times_seconds"]) if not c.isspace()]
    en = [e for c, e in zip(al["characters"], al["character_end_times_seconds"]) if not c.isspace()]
    a, b = max(0.0, st[0] - 0.02), en[-1] + 0.06
    ff("-i", raw, "-af", "atrim=%.3f:%.3f,asetpts=N/SR/TB" % (a, b), "-ar", str(SR), "-ac", "1", out_wav)
    os.remove(raw)
    return b - a


def trim_silence(s, thr=0.01):
    i = next((k for k, x in enumerate(s) if abs(x) > thr), 0)
    k = len(s) - next((k for k, x in enumerate(reversed(s)) if abs(x) > thr), 0)
    pad = int(0.012 * SR)
    return s[max(0, i - pad):min(len(s), k + pad)]


def splice_beat(sid, n, items):
    d = os.path.join(P, "sections", sid, "audio")
    sp = os.path.join(d, "splice"); os.makedirs(sp, exist_ok=True)
    wav = os.path.join(d, "beat-%s.wav" % n)
    keep = os.path.join(sp, "beat-%s.masked.wav" % n)
    wjp = os.path.join(d, "beat-%s.words.json" % n)
    wkeep = os.path.join(sp, "beat-%s.masked.words.json" % n)
    if not os.path.exists(keep):
        shutil.copy(wav, keep); shutil.copy(wjp, wkeep)
    src = read_wav(keep)
    words = rj(wkeep)
    ref = rms(src)
    out, cur, shift, new_words = [], 0, 0.0, []
    xf = int(XF * SR)
    report = []
    for it in sorted(items, key=lambda x: x["t0"]):
        frag = trim_silence(read_wav(it["frag"]))
        i0, i1 = int(it["t0"] * SR), int(it["t1"] * SR)
        near = rms(src[max(0, i0 - SR):i0] + src[i1:i1 + SR]) or ref   # 바로 앞뒤 1초 말소리에 맞춘다
        g = (near / rms(frag)) if rms(frag) else 1.0
        g = max(0.4, min(2.5, g))
        frag = [x * g for x in frag]
        out += src[cur:i0]   # 무음 구간 앞까지 원본 그대로 (무음 구간은 이미 0이라 이음새가 튀지 않는다)
        n_ = min(xf, len(frag) // 4)
        for k in range(n_):
            frag[k] *= math.sin(0.5 * math.pi * k / n_)
            frag[-1 - k] *= math.sin(0.5 * math.pi * k / n_)
        f_start = len(out) / SR
        out += frag
        f_end = len(out) / SR
        new_words.append({"w": it["real"], "s": round(f_start, 3), "e": round(f_end, 3), "spliced": True})
        report.append({"real": it["real"], "gap": round(it["t1"] - it["t0"], 3), "frag": round(len(frag) / SR, 3), "gain": round(g, 2)})
        cur = i1
    out += src[cur:]
    write_wav(wav, out)
    # 단어 시점: 무음 구간 뒤 단어는 늘어난 만큼 밀기
    muts = sorted(items, key=lambda x: x["t0"])
    ww = []
    for w in words["words"]:
        delta = 0.0
        for it, nw in zip(muts, [x for x in new_words]):
            if w["s"] >= it["t1"] - 1e-3:
                delta = (nw["e"] - it["t1"])
        ww.append({"w": w["w"], "s": round(w["s"] + delta, 3), "e": round(w["e"] + delta, 3)})
    ww = sorted(ww + new_words, key=lambda x: x["s"])
    words["words"] = ww
    words["duration_s"] = round(len(out) / SR, 3)
    words["spliced"] = report
    wj(wjp, words)
    return report, len(out) / SR


def main():
    a = sys.argv[1:]
    js = jobs()
    only = a[a.index("--only") + 1].split(",") if "--only" in a else None
    if only:
        js = [j for j in js if "%s:b%s" % (j["sid"], j["n"]) in only]
    if not a or a[0] == "plan":
        for j in js:
            print("%s b%s  %.2f~%.2f  %s → '%s'   (앞: %s | 뒤: %s)" % (j["sid"], j["n"], j["t0"], j["t1"], j["real"], j["say"], j["prev"][-20:], j["next"][:20]))
        print("총 %d곳, 보낼 글자 %d자" % (len(js), sum(len(j["say"]) for j in js)))
        return
    by = {}
    for k, j in enumerate(js):
        sp = os.path.join(P, "sections", j["sid"], "audio", "splice"); os.makedirs(sp, exist_ok=True)
        j["frag"] = os.path.join(sp, "beat-%s.frag%d.wav" % (j["n"], sum(1 for x in js[:k] if x["sid"] == j["sid"] and x["n"] == j["n"]) + 1))
        if not os.path.exists(j["frag"]) or "--regen" in a:
            dur = gen_fragment(j, j["frag"])
            print("조각 %s b%s %s  %.2fs" % (j["sid"], j["n"], j["real"], dur))
        by.setdefault((j["sid"], j["n"]), []).append(j)
    for (sid, n), items in by.items():
        rep, dur = splice_beat(sid, n, items)
        print("끼움 %s b%s → %.2fs  %s" % (sid, n, dur, rep))


if __name__ == "__main__":
    main()
