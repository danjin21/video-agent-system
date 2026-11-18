#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""모듈2 음성 — HeyGen TTS (사용자 본인 voice_id). 문장(비트) 단위로 만들고, 문장 사이 텀은 로컬 타임라인에서 맞춘다.

  tts_heygen.py <project> --sections s01,s02 [--until 60] [--yes] [--force] [--beats s02:b2,...]
  tts_heygen.py <project> --retime --sections s01,s02        # 음성은 그대로, 텀·속도 설정만 다시 반영 (외부 호출 없음)

설정 (project.json "voice"):
  {"provider":"heygen","voice_id":"…","speed":"medium","gap":"medium"}
  speed: slow | medium | fast | 숫자(0.75~1.25)      → 0.9 / 1.0 / 1.1
  gap  : short | medium | long | 숫자(초)            → 0.25 / 0.5 / 0.9 초 (문장 끝 ~ 다음 문장 시작)
비트별 덮어쓰기 (beats.json 각 비트): "speed", "gap_after" — 스튜디오 대본 탭에서 고른다.

- 외부로 보내기 전에 redact 게이트: 마스킹 허용(allow)되지 않은 실값이 든 문장은 보내지 않고 건너뛴다(추정 시간 유지).
- professional 보이스는 HeyGen speed 파라미터, instant 보이스는 HeyGen이 speed를 무시하므로 로컬 ffmpeg atempo로 맞춘다.
- 결과: sections/sNN/audio/beat-N.wav (+ .words.json 단어 시점, .tts.json 생성 기록). 이후 비트 시간을 실제 길이 + 텀으로 다시 잡고,
  layout/timeline 요소의 시각(in/out/emphasis/키트 props의 at 등)을 비트 기준으로 따라 옮긴다.
- --yes 없이 실행하면 보낼 문장·글자 수만 보여주고 끝난다(과금 호출 전 승인).
- API 키는 ~/.config/video-agents/secrets.env 의 HEYGEN_API_KEY (스튜디오 '계정 연결'에서 사용자가 직접 입력). 출력하지 않는다.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import m2env  # noqa: E402
import redact  # noqa: E402
m2env.fix_stdio()

FPS = 30
SPEED = {"slow": 0.9, "medium": 1.0, "fast": 1.1}
GAP = {"short": 0.25, "medium": 0.5, "long": 0.9}
LEAD_IN = 0.5   # 섹션 첫 문장 전 여유(초)
TAIL = 0.8      # 섹션 마지막 문장 뒤 여유(초)
API = "https://api.heygen.com"
TIME_KEYS = {"at", "activeAt", "subAt", "explodeAt"}


def rj(p, d=None):
    if not os.path.exists(p):
        return d
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def wj(p, o):
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, indent=2)
    os.replace(tmp, p)


def api_key():
    for line in open(m2env.SECRETS, encoding="utf-8") if os.path.exists(m2env.SECRETS) else []:
        m = re.match(r"^\s*HEYGEN_API_KEY\s*=\s*(.+?)\s*$", line)
        if m:
            return m.group(1).strip().strip('"').strip("'")
    return None


def call(method, path, key, body=None, timeout=120):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method,
                                 headers={"X-Api-Key": key, "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8") or "{}")
        except Exception:
            return e.code, {"error": str(e)}


def speed_of(v):
    if isinstance(v, (int, float)):
        return max(0.75, min(1.25, float(v)))
    return SPEED.get(v or "medium", 1.0)


def gap_of(v):
    if isinstance(v, (int, float)):
        return max(0.0, float(v))
    return GAP.get(v or "medium", 0.5)


def dur_of(path):
    r = m2env.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
    return float((r.stdout or "0").strip() or 0)


def sensitive_left(P, text, m):  # P는 쓰지 않음
    """허용되지 않은 실값이 남아 있으면 그 목록"""
    return [t["real"] for t in m.get("tokens", []) if not t.get("allow") and t.get("real") and t["real"] in text]


# ------------------------------------------------------------------ 비트 시간 다시 잡기 + 요소 시각 따라 옮기기
def frame_map(old, new):
    """old/new: [(start,end)] 비트 구간 → 프레임 변환 함수 (구간 안은 비례, 구간 밖은 가까운 경계 기준 이동)"""
    def f(x):
        if not old:
            return x
        for (os_, oe), (ns, ne) in zip(old, new):
            if os_ <= x < oe:
                return int(round(ns + (x - os_) * (ne - ns) / max(1, oe - os_)))
        if x < old[0][0]:
            return int(round(x + new[0][0] - old[0][0])) if x > 0 else x
        return int(round(x + new[-1][1] - old[-1][1]))
    return f


def remap_section(d, old, new, new_dur):
    fm = frame_map(old, new)
    tl = rj(os.path.join(d, "timeline.json"), {})
    lay = rj(os.path.join(d, "layout.json"), {"elements": []})
    byid = {e["id"]: e for e in lay.get("elements", [])}
    old_dur = tl.get("duration", 0)
    for eid, t in (tl.get("elements") or {}).items():
        i0 = t.get("in", 0)
        i1 = fm(i0) if i0 > 0 else 0
        o0 = t.get("out", old_dur)
        t["out"] = new_dur if o0 >= old_dur else max(i1 + 1, fm(o0))
        for em in t.get("emphasis") or []:
            em["at"] = fm(em.get("at", i0))
        t["in"] = i1
        e = byid.get(eid)
        if e and e.get("type") in ("diagram", "3d") and e.get("props"):
            def walk(v):
                if isinstance(v, dict):
                    for k, x in list(v.items()):
                        if k in TIME_KEYS and isinstance(x, (int, float)):
                            v[k] = fm(i0 + x) - i1
                        else:
                            walk(x)
                elif isinstance(v, list):
                    for x in v:
                        walk(x)
            walk(e["props"])
    tl["duration"] = new_dur
    wj(os.path.join(d, "timeline.json"), tl)
    wj(os.path.join(d, "layout.json"), lay)


def retime(P, sid, cfg):
    d = os.path.join(P, "sections", sid)
    bj = rj(os.path.join(d, "beats.json"))
    beats = bj["beats"]
    tl = rj(os.path.join(d, "timeline.json"), {})
    old = [(b["start"], b["end"]) for b in beats]
    voice = cfg.get("voice") or {}
    cur = int(round(LEAD_IN * FPS))
    new, audio = [], []
    for i, b in enumerate(beats):
        wav = os.path.join(d, "audio", "beat-%s.wav" % b["id"][1:])
        if os.path.exists(wav):
            sec = dur_of(wav)
            b["audio_sec"] = round(sec, 3)
            audio.append({"src": "audio/" + os.path.basename(wav), "at": cur})
        else:
            sec = b.get("est_sec", 3.0) - 0.35  # 추정(무음) 문장은 추정 길이
            b.pop("audio_sec", None)
        n = max(15, int(round(sec * FPS)))
        last = i == len(beats) - 1
        g = TAIL if last else gap_of(b.get("gap_after", voice.get("gap")))
        b["start"], b["end"] = cur, cur + n
        new.append((cur, cur + n))
        cur += n + int(round(g * FPS))
    new_dur = cur
    remap_section(d, old, new, new_dur)
    tl = rj(os.path.join(d, "timeline.json"))
    tl["beats"] = [{"id": b["id"], "start": b["start"], "end": b["end"]} for b in beats]
    tl["audio"] = audio
    wj(os.path.join(d, "timeline.json"), tl)
    wj(os.path.join(d, "beats.json"), bj)
    return new_dur, len(audio)


# ------------------------------------------------------------------ 생성
def voice_mode(key, vid):
    st, j = call("GET", "/v3/models/audio/voices/%s" % vid, key, timeout=30)
    data = (j or {}).get("data") or {}
    return st, data.get("mode") or data.get("type"), data.get("status"), (j or {}).get("error")


# 범주별 자리채움 (받침 없음, 받침 있음) — 뒤 조사(은/는·과/와)가 실제 단어와 맞도록 마지막 글자 받침을 맞춘다
FILLER_BY_CAT = {"region": ("해외", "타국"), "company": ("협력사", "제휴은행"), "person": ("담당자", "책임자"),
                 "product": ("상품", "대표 상품"), "project": ("과제", "프로젝트명")}


def has_batchim(word):
    ch = (word or " ")[-1]
    return "가" <= ch <= "힣" and (ord(ch) - 0xAC00) % 28 != 0


def filler_of(real, cat=None):
    """실값 대신 보낼 자리채움 — 숫자는 같은 단위·비슷한 길이(숫자만 1로), 그 밖은 범주에 맞는 일반어. 실값은 외부로 나가지 않는다."""
    f = re.sub(r"\d", "1", real)
    if f != real:
        return f
    pair = FILLER_BY_CAT.get(cat or "", ("그곳", "그 기관"))
    return pair[1] if has_batchim(real) else pair[0]


def masked_text(text, m):
    """허용되지 않은 실값을 자리채움으로 바꾼 문장 + 자리채움의 글자 구간 [(i0,i1)]"""
    cats = {t["real"]: t.get("cat") for t in m.get("tokens", []) if not t.get("allow") and t.get("real") and t["real"] in text}
    toks = sorted(cats, key=len, reverse=True)
    out, spans, i = "", [], 0
    while i < len(text):
        hit = next((r for r in toks if text.startswith(r, i)), None)
        if hit:
            f = filler_of(hit, cats.get(hit))
            spans.append((len(out), len(out) + len(f)))
            out += f
            i += len(hit)
        else:
            out += text[i]
            i += 1
    return out, spans


def char_spans_to_time(chars, spans, pad=0.03):
    """original_characters(글자별 시각)로 글자 구간 → 시간 구간"""
    flat = []
    for c in chars or []:
        for _ch in (c.get("text") or ""):
            flat.append((c.get("start_time", 0), c.get("end_time", 0)))
    out = []
    for i0, i1 in spans:
        if i1 <= len(flat) and i0 < i1:
            out.append((max(0.0, flat[i0][0] - pad), flat[i1 - 1][1] + pad))
    return out


def tone_of(b, voice):
    sp = speed_of(b.get("speed", voice.get("speed")))
    expr = b.get("expressiveness", voice.get("expressiveness"))
    pitch = float(b.get("pitch", voice.get("pitch", 0)) or 0)
    return sp, (None if expr is None else max(0.0, min(1.0, float(expr)))), max(-4.0, min(4.0, pitch))


def make_audio(key, vid, pro, model, text, m, wav, sp=1.0, expr=None, pitch=0.0, tags=""):
    """문장 → wav. 민감 실값은 자리채움으로 보내고 그 구간만 무음. 반환: (ok, info)"""
    send, spans = masked_text(text, m)
    if sensitive_left(None, send, m):
        return False, {"error": "게이트: 실값이 남아 있어 보내지 않음"}
    body = {"voice_id": vid, "text": (tags + " " + send) if tags else send, "language": "ko", "model": model, "with_timestamps": True}
    if pro:
        if abs(sp - 1.0) > 1e-6:
            body["speed"] = sp
        if abs(pitch) > 1e-6:
            body["pitch_shift"] = pitch
    elif expr is not None:
        body["expressiveness_boost"] = expr
    st, j = call("POST", "/v3/models/audio/tts", key, body, timeout=180)
    if st != 200:
        return False, {"error": "HTTP %s %s" % (st, json.dumps((j or {}).get("error") or j, ensure_ascii=False)[:300])}
    dat = j.get("data") or {}
    os.makedirs(os.path.dirname(wav), exist_ok=True)
    raw = wav[:-4] + ".raw.wav"
    with urllib.request.urlopen(dat["audio_url"], timeout=120) as r, open(raw, "wb") as f:
        f.write(r.read())
    off = len(tags) + 1 if tags else 0   # 앞에 붙인 태그만큼 글자 위치가 밀린다
    mute = char_spans_to_time(dat.get("original_characters"), [(x + off, y + off) for x, y in spans])
    filt = []
    if mute:
        filt.append("volume=enable='%s':volume=0" % "+".join("between(t,%.3f,%.3f)" % (x, y) for x, y in mute))
    local_sp = 1.0 if pro else sp
    local_pitch = 0.0 if pro else pitch
    if abs(local_pitch) > 1e-6:
        rr = 2 ** (local_pitch / 12.0)
        filt += ["asetrate=44100*%.5f" % rr, "aresample=44100", "atempo=%.5f" % (local_sp / rr)]
    elif abs(local_sp - 1.0) > 1e-6:
        filt.append("atempo=%.4f" % local_sp)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", raw] + (["-filter:a", ",".join(filt)] if filt else []) + ["-ar", "48000", "-ac", "1", wav]
    m2env.run(cmd)
    os.remove(raw)
    k = local_sp
    words = []
    for w in dat.get("original_words") or []:
        t = (w.get("text") or "").strip()
        if not t or any(x <= w["start_time"] < y for x, y in mute):
            continue
        words.append({"w": t, "s": round(w["start_time"] / k, 3), "e": round(w["end_time"] / k, 3)})
    return True, {"words": words, "mute": [(round(x / k, 3), round(y / k, 3)) for x, y in mute], "sent": send, "duration": dat.get("duration")}



# ------------------------------------------------------------------ ElevenLabs (사용자 본인 클론 보이스)
EL_API = "https://api.elevenlabs.io"


def el_key():
    for line in open(m2env.SECRETS, encoding="utf-8") if os.path.exists(m2env.SECRETS) else []:
        mm = re.match(r"^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$", line)
        if mm:
            return mm.group(1).strip().strip('"').strip("'")
    return None


def el_settings(voice, b=None, override=None):
    """voice.settings(stability·similarity_boost·style·speed) + 비트/비교용 덮어쓰기. speed 프리셋도 반영(0.7~1.2)."""
    s = dict({"stability": 0.5, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True}, **(voice.get("settings") or {}))
    s.pop("speed", None)
    sp = speed_of((b or {}).get("speed", voice.get("speed")))
    s.update(override or {})
    s["speed"] = max(0.7, min(1.2, float(s.get("speed", sp))))
    return s


def make_audio_el(key, vid, model, text, m, wav, settings, pitch=0.0, prev_text=None, next_text=None):
    """ElevenLabs /with-timestamps → wav. 민감 실값은 자리채움으로 보내고 그 글자 구간만 무음. 음높이는 로컬."""
    import base64
    send, spans = masked_text(text, m)
    if sensitive_left(None, send, m):
        return False, {"error": "게이트: 실값이 남아 있어 보내지 않음"}
    body = {"text": send, "model_id": model, "voice_settings": settings}
    if prev_text:
        body["previous_text"] = masked_text(prev_text, m)[0]
    if next_text:
        body["next_text"] = masked_text(next_text, m)[0]
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(EL_API + "/v1/text-to-speech/%s/with-timestamps?output_format=mp3_44100_128" % vid, data=data, method="POST",
                                 headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            j = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return False, {"error": "HTTP %s %s" % (e.code, e.read().decode("utf-8", "replace")[:300])}
    os.makedirs(os.path.dirname(wav), exist_ok=True)
    raw = wav[:-4] + ".raw.mp3"
    with open(raw, "wb") as f:
        f.write(base64.b64decode(j["audio_base64"]))
    al = j.get("alignment") or {}
    cs, st_, en_ = al.get("characters") or [], al.get("character_start_times_seconds") or [], al.get("character_end_times_seconds") or []
    chars = [{"text": c, "start_time": s0, "end_time": e0} for c, s0, e0 in zip(cs, st_, en_)]
    mute = char_spans_to_time(chars, spans)
    filt = []
    if mute:
        filt.append("volume=enable='%s':volume=0" % "+".join("between(t,%.3f,%.3f)" % (x, y) for x, y in mute))
    if abs(pitch) > 1e-6:
        rr = 2 ** (pitch / 12.0)
        filt += ["asetrate=44100*%.5f" % rr, "aresample=44100", "atempo=%.5f" % (1.0 / rr)]
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", raw] + (["-filter:a", ",".join(filt)] if filt else []) + ["-ar", "48000", "-ac", "1", wav]
    m2env.run(cmd)
    os.remove(raw)
    # 단어 시점: 글자 시각을 공백 기준으로 묶는다 (무음 구간 단어 제외)
    words, cur = [], None
    for c in chars:
        if c["text"].isspace():
            if cur:
                words.append(cur)
            cur = None
            continue
        if cur is None:
            cur = {"w": "", "s": c["start_time"], "e": c["end_time"]}
        cur["w"] += c["text"]
        cur["e"] = c["end_time"]
    if cur:
        words.append(cur)
    words = [{"w": w["w"], "s": round(w["s"], 3), "e": round(w["e"], 3)} for w in words if not any(x <= w["s"] < y for x, y in mute)]
    return True, {"words": words, "mute": [(round(x, 3), round(y, 3)) for x, y in mute], "sent": send, "duration": None}

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("--sections", default="")
    ap.add_argument("--until", type=float, help="앞에서부터 이 초까지만 (예: 60)")
    ap.add_argument("--beats", help="이 비트만 (s02:b2,s02:b4)")
    ap.add_argument("--yes", action="store_true", help="실제로 HeyGen 호출 (과금 가능)")
    ap.add_argument("--force", action="store_true", help="이미 만든 문장도 다시 생성")
    ap.add_argument("--retime", action="store_true", help="생성 없이 텀·시간만 다시 반영")
    ap.add_argument("--sample", help="목소리 비교용: 이 비트 하나를 여러 설정으로 (예: s02:b1) → 00-direction/voice_samples/")
    ap.add_argument("--variants", default="기본:-:0", help="이름:표현강도(0~1 또는 -):음높이(반음)[:태그] 를 , 로 구분")
    a = ap.parse_args()
    P = os.path.abspath(a.project)
    cfg = rj(os.path.join(P, "project.json"), {})
    voice = cfg.get("voice") or {}
    sids = [s.strip() for s in a.sections.split(",") if s.strip()]
    only = set(x.strip() for x in a.beats.split(",")) if a.beats else None

    if a.retime:
        for sid in sids:
            dur, n = retime(P, sid, cfg)
            print("%s 텀 반영: %.1f초 (음성 %d문장)" % (sid, dur / FPS, n))
        return 0

    vid = voice.get("voice_id")
    if not vid:
        sys.exit("project.json voice.voice_id 가 없습니다.")
    m = redact.load_map(P)
    # 민감 실값: silence(기본) = 자리채움으로 보내고 그 단어 구간만 무음 / skip = 문장째 건너뜀
    policy = voice.get("sensitive", "silence")

    plan, sb = [], None
    if a.sample:
        ssid, sbid = a.sample.split(":")
        sb = next(x for x in rj(os.path.join(P, "sections", ssid, "beats.json"))["beats"] if x["id"] == sbid)
        print("비교 문장: %s" % sb["text"])
        print("보내는 문장: %s" % masked_text(sb["text"], m)[0])
        if not a.yes:
            print("(확인만. 생성은 --yes)")
            return 0
    else:
        plan, skipped, t_acc = [], [], 0.0
        for sid in sids:
            bj = rj(os.path.join(P, "sections", sid, "beats.json"))
            for b in bj["beats"]:
                key_ = "%s:%s" % (sid, b["id"])
                if a.until is not None and t_acc >= a.until:
                    break
                t_acc += b.get("est_sec", 3)
                if only and key_ not in only:
                    continue
                left = sensitive_left(P, b["text"], m)
                if left and policy == "skip":
                    skipped.append((key_, left))
                    continue
                wav = os.path.join(P, "sections", sid, "audio", "beat-%s.wav" % b["id"][1:])
                if os.path.exists(wav) and not a.force:
                    continue
                plan.append((sid, b, wav, left))
        chars = sum(len(b["text"]) for _, b, _, _ in plan)
        print("보낼 문장 %d개 · %d자 (voice %s…)" % (len(plan), chars, vid[:6]))
        for sid, b, _, left in plan:
            print("  %s:%s  %s%s" % (sid, b["id"], masked_text(b["text"], m)[0], ("   ← 이 부분만 무음: %s" % ", ".join(left)) if left else ""))
        for k_, left in skipped:
            print("  건너뜀 %s — 마스킹되지 않은 실값 %s" % (k_, ", ".join(left)))
        if not plan:
            print("새로 만들 문장이 없습니다.")
        if not a.yes:
            print("\n(확인만 했습니다. 실제 생성은 --yes)")
            return 0
    provider = voice.get("provider", "heygen")
    if provider == "elevenlabs":
        key = el_key()
        if not key:
            sys.exit("ELEVENLABS_API_KEY가 없습니다 — 스튜디오 '계정 연결'에서 직접 넣어 주세요.")
        vm = voice.get("model") or ""
        model = vm if str(vm).startswith("eleven_") else "eleven_multilingual_v2"
        print("보이스: ElevenLabs %s… model=%s" % (vid[:6], model))
        return run_elevenlabs(a, P, cfg, voice, key, vid, model, m, sids, plan if not a.sample else None, sb if a.sample else None)
    key = api_key()
    if not key:
        sys.exit("HEYGEN_API_KEY가 없습니다 — 스튜디오 '계정 연결'에서 HeyGen API 키를 직접 넣어 주세요.")
    st, mode, vstatus, err = voice_mode(key, vid)
    if st != 200:
        sys.exit("보이스 조회 실패 (HTTP %s): %s" % (st, json.dumps(err or {}, ensure_ascii=False)[:300]))
    pro = (mode == "professional")
    # professional 클론은 heygen-voice-1만 지원(유료). instant·공개 보이스는 turbo-free(2026-11-30까지 무료)
    # voice.model은 HeyGen 모델 이름(heygen-voice-*)일 때만 쓴다 — 템플릿의 ElevenLabs 모델명 등이 남아 있을 수 있음
    vm = voice.get("heygen_model") or voice.get("model") or ""
    model = vm if str(vm).startswith("heygen-voice-") else ("heygen-voice-1" if pro else "heygen-voice-1-turbo-free")
    print("보이스: mode=%s status=%s → model=%s" % (mode, vstatus, model))

    if a.sample:
        outd = os.path.join(P, "00-direction", "voice_samples")
        for spec in a.variants.split(","):
            parts = spec.split(":")
            name = parts[0]
            expr = None if len(parts) < 2 or parts[1] in ("", "-") else float(parts[1])
            pitch = float(parts[2]) if len(parts) > 2 and parts[2] else 0.0
            tags = parts[3] if len(parts) > 3 else ""
            out = os.path.join(outd, "%s_%s.wav" % (a.sample.replace(":", "_"), name))
            ok, info = make_audio(key, vid, pro, model, sb["text"], m, out, speed_of(voice.get("speed")), expr, pitch, tags)
            print(("완료 %s  %.2fs  무음 %s" % (os.path.basename(out), dur_of(out), info["mute"])) if ok else ("실패 %s %s" % (name, info["error"])))
        return 0

    done = 0
    for sid, b, wav, left in plan:
        sp, expr, pitch = tone_of(b, voice)
        ok, info = make_audio(key, vid, pro, model, b["text"], m, wav, sp, expr, pitch)
        if not ok:
            print("실패 %s:%s %s" % (sid, b["id"], info["error"]))
            continue
        wj(wav[:-4] + ".words.json", {"beat": "beat-" + b["id"][1:], "duration_s": round(dur_of(wav), 3), "text": b["text"], "words": info["words"]})
        wj(wav[:-4] + ".tts.json", {"provider": "heygen", "voice_id": vid, "model": model, "voice_mode": mode, "speed": sp, "expressiveness": expr, "pitch": pitch,
                                    "muted": info["mute"], "muted_tokens": left,
                                    "text_sha1": hashlib.sha1(b["text"].encode("utf-8")).hexdigest()[:12], "duration": info["duration"]})
        done += 1
        print("완료 %s:%s %.2fs%s" % (sid, b["id"], dur_of(wav), ("  무음 %s" % info["mute"]) if info["mute"] else ""))
    for sid in sids:
        dur, n = retime(P, sid, cfg)
        print("%s 시간 다시 잡음: %.1f초 (음성 %d문장)" % (sid, dur / FPS, n))
    print("생성 %d/%d." % (done, len(plan)))
    return 0




def soften_tail(wav, words, tail=None):
    """문장 끝 어절만 차분하게: 음높이 내림 + 고음 살짝 깎음 + 살짝 작게. 길이는 그대로, 이음매는 크로스페이드.
    tail: {"pitch": -1.5(반음), "treble": -4(dB), "gain": -1.5(dB)} — None/빈 값이면 하지 않음"""
    if not tail or not words:
        return False
    t0 = max(0.0, float(words[-1]["s"]) - 0.03)
    dur = dur_of(wav)
    if dur - t0 < 0.15:
        return False
    xf = 0.04
    rr = 2 ** (float(tail.get("pitch", -1.5)) / 12.0)
    head_end = t0 + xf
    fc = ("[0:a]atrim=0:%.3f,asetpts=PTS-STARTPTS[h];"
          "[0:a]atrim=%.3f,asetpts=PTS-STARTPTS,asetrate=48000*%.5f,aresample=48000,atempo=%.5f,"
          "treble=g=%.1f:f=3000,volume=%.1fdB[t];[h][t]acrossfade=d=%.3f:c1=tri:c2=tri[o]") % (
        head_end, t0, rr, 1.0 / rr, float(tail.get("treble", -4)), float(tail.get("gain", -1.5)), xf)
    tmp = wav[:-4] + ".tail.wav"
    r = m2env.run(["ffmpeg", "-y", "-v", "error", "-i", wav, "-filter_complex", fc, "-map", "[o]", "-ar", "48000", "-ac", "1", tmp])
    if r.returncode == 0 and os.path.exists(tmp):
        os.replace(tmp, wav)
        return True
    return False

def trailing_hum(wav, hop_s=0.02):
    """문장 끝 뒤에 따로 붙은 짧은 소리('음~' 같은 군소리)가 있으면 {"cut","gap","blob"}, 없으면 None.
    기준: 마지막 소리 덩어리가 0.12~0.40초이고 그 앞 무음이 0.14초 이상(받침·'다'의 자연스러운 끝과 구분) — 2026-11-18 사용자: '먼저 ETF입니다. 음~'"""
    import array
    import math
    import wave
    w = wave.open(wav)
    sr, ch = w.getframerate(), w.getnchannels()
    a = array.array("h", w.readframes(w.getnframes()))
    w.close()
    if ch > 1:
        a = a[::ch]
    hop = max(1, int(sr * hop_s))
    voiced = []
    for i in range(0, len(a), hop):
        seg = a[i:i + hop]
        r = math.sqrt(sum(x * x for x in seg) / max(1, len(seg)))
        voiced.append(20 * math.log10(max(1, r) / 32768) > -36)
    j = len(voiced) - 1
    while j >= 0 and not voiced[j]:
        j -= 1
    end = j
    while j >= 0 and voiced[j]:
        j -= 1
    blob = (end - j) * hop_s
    k = j
    while k >= 0 and not voiced[k]:
        k -= 1
    gap = (j - k) * hop_s
    if gap >= 0.14 and 0.12 <= blob <= 0.40 and k > 0 and (k + 1) * hop_s > 0.5:
        return {"cut": round((k + 1) * hop_s + 0.03, 3), "gap": round(gap, 2), "blob": round(blob, 2)}
    return None


def run_elevenlabs(a, P, cfg, voice, key, vid, model, m, sids, plan, sb):
    if sb is not None:
        outd = os.path.join(P, "00-direction", "voice_samples")
        for spec in a.variants.split(","):
            parts = spec.split(":")
            name = parts[0]
            ov = {}
            if len(parts) > 1 and parts[1] not in ("", "-"):
                ov["stability"] = float(parts[1])
            pitch = float(parts[2]) if len(parts) > 2 and parts[2] else 0.0
            if len(parts) > 3 and parts[3]:
                ov["speed"] = float(parts[3])
            if len(parts) > 4 and parts[4]:
                ov["style"] = float(parts[4])
            tail = {"pitch": -1.5, "treble": -4, "gain": -1.5} if len(parts) > 5 and parts[5] == "1" else None
            prev_t = next_t = None
            if len(parts) > 6 and parts[6] == "1":
                ssid, sbid = a.sample.split(":")
                bj = rj(os.path.join(P, "sections", ssid, "beats.json"))["beats"]
                k = next(i for i, x in enumerate(bj) if x["id"] == sbid)
                prev_t = bj[k - 1]["text"] if k > 0 else None
                next_t = bj[k + 1]["text"] if k + 1 < len(bj) else None
            out = os.path.join(outd, "%s_EL_%s.wav" % (a.sample.replace(":", "_"), name))
            ok, info = make_audio_el(key, vid, model, sb["text"], m, out, el_settings(voice, None, ov), pitch, prev_t, next_t)
            if ok and tail:
                soften_tail(out, info["words"], tail)
            print(("완료 %s  %.2fs  무음 %s%s" % (os.path.basename(out), dur_of(out), info["mute"], "  끝처리" if tail else "")) if ok else ("실패 %s %s" % (name, info["error"])))
        return 0
    done = 0
    for sid, b, wav, left in plan:
        bj = rj(os.path.join(P, "sections", sid, "beats.json"))["beats"]
        idx = next(i for i, x in enumerate(bj) if x["id"] == b["id"])
        use_ctx = voice.get("context", True)   # 앞뒤 문장 맥락 (false면 문장 단독 — 비교 샘플과 똑같이)
        prev_t = bj[idx - 1]["text"] if use_ctx and idx > 0 else None
        next_t = bj[idx + 1]["text"] if use_ctx and idx + 1 < len(bj) else None
        pitch = float(b.get("pitch", voice.get("pitch", 0)) or 0)
        sett = el_settings(voice, b)
        ok, info = make_audio_el(key, vid, model, b["text"], m, wav, sett, pitch, prev_t, next_t)
        # 끝에 군소리('음~')가 붙으면 최대 2번 다시 만든다 (짧은 문장에서 잘 생김)
        for retry in range(2):
            hum = ok and trailing_hum(wav)
            if not hum:
                break
            print("  %s:%s 끝 군소리 감지(무음 %.2fs 뒤 %.2fs) → 다시 생성" % (sid, b["id"], hum["gap"], hum["blob"]))
            ok, info = make_audio_el(key, vid, model, b["text"], m, wav, sett, pitch, prev_t, next_t)
        if ok and trailing_hum(wav):
            print("  경고 %s:%s 끝 군소리가 남았습니다 — 들어 보고 스튜디오에서 이 문장만 다시 만드세요" % (sid, b["id"]))
        if not ok:
            print("실패 %s:%s %s" % (sid, b["id"], info["error"]))
            continue
        tail = b.get("tail", voice.get("tail"))
        if tail:
            soften_tail(wav, info["words"], tail)
        wj(wav[:-4] + ".words.json", {"beat": "beat-" + b["id"][1:], "duration_s": round(dur_of(wav), 3), "text": b["text"], "words": info["words"]})
        wj(wav[:-4] + ".tts.json", {"provider": "elevenlabs", "voice_id": vid, "model": model, "settings": sett, "pitch": pitch, "muted": info["mute"], "muted_tokens": left,
                                    "text_sha1": hashlib.sha1(b["text"].encode("utf-8")).hexdigest()[:12]})
        done += 1
        print("완료 %s:%s %.2fs%s" % (sid, b["id"], dur_of(wav), ("  무음 %s" % info["mute"]) if info["mute"] else ""))
    for sid in sids:
        dur, n = retime(P, sid, cfg)
        print("%s 시간 다시 잡음: %.1f초 (음성 %d문장)" % (sid, dur / FPS, n))
    print("생성 %d/%d." % (done, len(plan)))
    return 0

if __name__ == "__main__":
    sys.exit(main() or 0)
