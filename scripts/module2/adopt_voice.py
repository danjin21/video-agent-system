#!/usr/bin/env python3
"""음성 시안 채택 — voice_samples 의 시안 wav를 그 문장(비트)의 실제 음성으로 넣는다.

  adopt_voice.py <project> s07:b4 <시안.wav> --text "시안 문장" [--settings '{"stability":0.65,"style":0.1,"speed":0.95}']

- 이전 음성은 00-direction/voice_samples/전_<sid>_<bid>_<시각>.wav 로 백업.
- 낱말 시간은 ElevenLabs Forced Alignment(/v1/forced-alignment)로 시안 음성에서 직접 잡는다 → 발음 맞춤이 정확.
- beats.json 문장·voice_settings, script.md, tts.json(text_sha1) 갱신 후 섹션 시간 다시 잡기(tts_heygen --retime).
- 키: secrets.env ELEVENLABS_API_KEY (스튜디오 계정 연결). 출력하지 않는다.
"""
import argparse
import datetime
import hashlib
import json
import os
import shutil
import subprocess
import sys
import uuid
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tts_heygen as TT  # noqa: E402


def forced_align(wav, text):
    key = TT.el_key()
    if not key:
        sys.exit("ElevenLabs 키가 없습니다 (스튜디오 계정 연결).")
    b = uuid.uuid4().hex
    body = (("--%s\r\nContent-Disposition: form-data; name=\"text\"\r\n\r\n%s\r\n" % (b, text)).encode("utf-8") +
            ("--%s\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.wav\"\r\nContent-Type: audio/wav\r\n\r\n" % b).encode("utf-8") +
            open(wav, "rb").read() + ("\r\n--%s--\r\n" % b).encode("utf-8"))
    rq = urllib.request.Request(TT.EL_API + "/v1/forced-alignment", data=body, method="POST",
                                headers={"xi-api-key": key, "Content-Type": "multipart/form-data; boundary=" + b})
    try:
        with urllib.request.urlopen(rq, timeout=120) as r:
            j = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:   # 에러 원문 그대로
        sys.exit("forced-alignment HTTP %s\n%s" % (e.code, e.read().decode("utf-8", "replace")[:1200]))
    return [{"w": w["text"], "s": round(w["start"], 3), "e": round(w["end"], 3)} for w in j.get("words", []) if w.get("text", "").strip()]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("beat", help="s07:b4")
    ap.add_argument("wav")
    ap.add_argument("--text", required=True)
    ap.add_argument("--settings", default="{}")
    a = ap.parse_args()
    P = os.path.abspath(a.project)
    sid, bid = a.beat.split(":")
    d = os.path.join(P, "sections", sid)
    n = bid.lstrip("b")
    dst = os.path.join(d, "audio", "beat-%s.wav" % n)
    bk = os.path.join(P, "00-direction", "voice_samples", "전_%s_%s_%s.wav" % (sid, bid, datetime.datetime.now().strftime("%H%M%S")))
    os.makedirs(os.path.dirname(bk), exist_ok=True)
    if os.path.exists(dst):
        shutil.copy2(dst, bk)
    words = forced_align(a.wav, a.text)
    shutil.copy2(a.wav, dst)
    dur = TT.dur_of(dst)
    settings = json.loads(a.settings)
    bj = TT.rj(os.path.join(d, "beats.json"))
    old_text = None
    for b in bj["beats"]:
        if b["id"] == bid:
            old_text = b["text"]
            b["text"] = a.text
            if settings:
                b["voice_settings"] = settings
    TT.wj(os.path.join(d, "beats.json"), bj)
    sp = os.path.join(d, "script.md")
    if old_text and os.path.exists(sp):
        s = open(sp, encoding="utf-8").read()
        if old_text in s:
            open(sp, "w", encoding="utf-8").write(s.replace(old_text, a.text, 1))
    TT.wj(os.path.join(d, "audio", "beat-%s.words.json" % n), {"beat": "beat-%s" % n, "duration_s": round(dur, 2), "text": a.text, "words": words})
    tp = os.path.join(d, "audio", "beat-%s.tts.json" % n)
    t = TT.rj(tp) if os.path.exists(tp) else {}
    t.setdefault("settings", {}).update(settings)
    t["text_sha1"] = hashlib.sha1(a.text.encode("utf-8")).hexdigest()[:12]
    t["adopted_from"] = os.path.basename(a.wav)
    TT.wj(tp, t)
    print("채택: %s %s ← %s (%.2fs, 낱말 %d개) · 이전 음성 %s" % (sid, bid, os.path.basename(a.wav), dur, len(words), os.path.relpath(bk, P)))
    subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "tts_heygen.py"), P, "--sections", sid, "--retime"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
