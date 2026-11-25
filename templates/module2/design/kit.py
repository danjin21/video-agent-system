# -*- coding: utf-8 -*-
"""섹션 설계용 짧은 표기 (요소·타이밍 만들기만). 섹션 구성은 sections_*.py에서 섹션마다 직접 쓴다."""
import json
import re
import os

P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1920, 1080
# 색은 디자인 키트(design/theme.json colors) 참조 — 키트에서 바꾸면 모든 장표가 따라온다
NAVY, BLUE, CORAL, GRAY, WHITE, PURPLE = "$navy", "$blue", "$coral", "$gray", "$white", "$purple"
# 디자인 키트 글자 양식의 기본 크기 (높이 계산용 — 실제 값은 theme.json)
STYLE_SIZE = {"title": 54, "kicker": 62, "display": 110, "headline": 80, "statement": 52, "subline": 48,
              "chip": 36, "chip_alert": 46, "caption_on_video": 64, "caption_on_video_sub": 46, "note": 26}
STYLE_COLOR = {"headline": NAVY, "display": NAVY, "statement": NAVY, "subline": GRAY, "kicker": BLUE, "title": NAVY,
               "chip": BLUE, "chip_alert": WHITE, "caption_on_video": WHITE, "caption_on_video_sub": WHITE, "note": GRAY}


def styled(i, style, s, x=None, y=None, w=None, h=None, z=3, color=None, **font):
    """디자인 키트 양식을 참조하는 글자 요소. 양식과 다른 값만 적는다."""
    e = {"id": i, "type": "text", "style": style, "text": s, "z": z}
    for k, v in (("x", x), ("y", y), ("w", w), ("h", h)):
        if v is not None:
            e[k] = v
    f = {k: v for k, v in font.items() if v is not None}
    if color and color != STYLE_COLOR.get(style):
        f["color"] = color
    if f:
        e["font"] = f
    return e


def rj(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def wj(p, o):
    """내용이 같으면 쓰지 않는다 — 파일 시간이 바뀌면 스튜디오가 '편집 후 렌더 필요'로 보고 다시 렌더하기 때문"""
    txt = json.dumps(o, ensure_ascii=False, indent=2)
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            if f.read() == txt:
                return
    with open(p, "w", encoding="utf-8") as f:
        f.write(txt)


def beats(sid):
    """{'b1': start, ...}, duration"""
    d = os.path.join(P, "sections", sid)
    b = rj(os.path.join(d, "beats.json"))["beats"]
    return {x["id"]: x["start"] for x in b}, rj(os.path.join(d, "timeline.json"))["duration"]


def word_at(sid, beat, word, fps=30, end=False):
    """그 단어가 발음되는 프레임 (섹션 기준). 음성(words.json)이 없으면 None.
    beat: 'b2' / word: 단어에 포함된 글자(예: 'Beyond')."""
    d = os.path.join(P, "sections", sid)
    start = {x["id"]: x["start"] for x in rj(os.path.join(d, "beats.json"))["beats"]}[beat]
    p = os.path.join(d, "audio", "beat-%s.words.json" % beat.lstrip("b"))
    if not os.path.exists(p):
        return None
    for w in rj(p)["words"]:
        if word in w["w"]:
            return start + round((w["e"] if end else w["s"]) * fps)
    return None


def base_font():
    """디자인 키트 기본 글꼴 (theme.json font.family) — 양식 없는 글자 요소도 따라간다"""
    try:
        return (rj(os.path.join(os.path.dirname(os.path.abspath(__file__)), "theme.json")).get("font") or {}).get("family") or "Pretendard"
    except Exception:  # noqa: BLE001
        return "Pretendard"


def text(i, x, y, w, h, s, size=48, color=NAVY, weight=600, align="left", valign=None, z=3, ls=-0.5, lh=1.25, fill=None, radius=0, pad=0):
    if color == WHITE and align == "center" and not fill:
        return styled(i, "caption_on_video" if size >= 56 else "caption_on_video_sub", s, x, y, w, h, z)
    if color == GRAY and size <= 28 and not fill:
        return styled(i, "note", s, x, y, w, h, z)
    e = {"id": i, "type": "text", "x": x, "y": y, "w": w, "h": h, "text": s, "z": z,
         "font": {"family": base_font(), "weight": weight, "size": size, "color": color, "align": align, "lineHeight": lh, "letterSpacing": ls, "accentColor": BLUE}}
    if valign:
        e["valign"] = valign
    if fill:
        e.update({"fill": fill, "radius": radius, "pad": pad})
    return e


def title(s, i="el_title"):
    return styled(i, "title", s)


def chip(i, x, y, s, color=BLUE, w=None, size=None):
    st = "chip_alert" if color in (CORAL, "alert") else "chip"   # 경고 칩 = 파란 띠 + 흰 글자 (빨간 띠 쓰지 않음)
    size = size or STYLE_SIZE[st]          # 기본은 키트 양식 크기(경고 칩 46 · 일반 칩 36)
    w = w or int(len(s) * size * 0.95 + 64)
    if x is None:                           # 가운데 정렬
        x = (W - w) // 2
    big = size != STYLE_SIZE[st]
    return styled(i, st, s, x, y, w, (size + 34) if big else None, size=size if big else None)


def dg(i, kind, x, y, w, h, props, z=2):
    return {"id": i, "type": "diagram", "kind": kind, "x": x, "y": y, "w": w, "h": h, "z": z, "props": props}


PHOTO_DIR = "global_assets/photos"


def photo_src(name):
    """사진 파일이 global_assets/photos/에 있으면 그 경로, 없으면 None(→ 화면에 '사진 자리 · 설명' 표시)"""
    return PHOTO_DIR + "/" + name if os.path.exists(os.path.join(P, PHOTO_DIR, name)) else None


def bg_photo(i, name, slot, D, dim=0.5, drift=0.08, z=0):
    """화면 가득 배경 사진: 줌아웃 공개 + 천천히 다가감 + 글자 읽히게 어둡게. 파일: global_assets/photos/<name>"""
    return dg(i, "zoomReveal", 0, 0, W, H, {"src": photo_src(name), "slot": "%s · %s" % (slot, name), "at": 0, "dur": 50, "from": 1.3,
                                           "drift": drift, "driftDur": max(60, D), "dim": dim, "background": True}, z=z)


def broll(i, slot, query, camera, z=0):
    return {"id": i, "type": "broll", "x": 0, "y": 0, "w": W, "h": H, "z": z, "slot": slot, "query": query, "src": None, "props": {"camera": camera}}


def three(i, scene, x, y, w, h, props, z=2):
    return {"id": i, "type": "3d", "scene": scene, "x": x, "y": y, "w": w, "h": h, "z": z, "props": props}


def T(i, o, enter="none", dur=12, exit_="none", exit_dur=12, emphasis=None):
    t = {"in": int(i), "out": int(o), "enter": enter, "enterDur": dur, "exit": exit_, "exitDur": exit_dur}
    if emphasis:
        t["emphasis"] = emphasis
    return t


def _strategies():
    """전략 카드판 항목: 프로젝트 design/strategies.json  [["이름","부제"], ...] (발표마다 다름 — 키트에 하드코딩 금지)"""
    p = os.path.join(P, "design", "strategies.json")
    return [tuple(x) for x in rj(p)] if os.path.exists(p) else []


def seven_board(k, flip_at):
    """전략 카드판 (챕터 간지 대신, 2026-11-20 사용자; 항목은 design/strategies.json): 지난 전략은 앞면, 이번 전략(k, 0부터) 카드는 그 이름을 말할 때
    뒤집히고 가운데로 커진 뒤 사라지며 본 장면이 나온다. 반환: (요소들, 타이밍, 끝 프레임)"""
    zoom_at = flip_at + 22
    end = zoom_at + 24 + 12
    cards = []
    for i, (name, sub) in enumerate(_strategies()):
        c = {"num": "전략 %d" % (i + 1), "backNum": str(i + 1), "title": name, "at": 0}
        if i < k:
            c["front"] = True
        elif i == k:
            c.update(flipAt=flip_at, sub=sub)
        else:
            c["flipAt"] = 99999
        cards.append(c)
    els = [{"id": "el_seven_bg", "type": "rect", "x": 0, "y": 0, "w": W, "h": H, "z": 19, "fill": "#ffffff"},
           dict(dg("el_seven_in", "cards3d", 160, 340, 1600, 380, {
               "cards": cards, "gap": 24, "mode": "tilt", "tilt": {"at": 0, "dur": 1, "rx": 0, "ry": 0, "zoom": 1}, "settle": False, "pop": False,
               "flip": {"dur": 18}, "titleSize": 34, "subSize": 14,
               "zoomTo": {"index": k, "at": zoom_at, "dur": 24, "scale": 2.6}}, z=20), sync=False, noAccent=True)]
    tl = {"el_seven_bg": T(0, end, "none", 1, "fade", 12), "el_seven_in": T(0, end, "none", 1, "fade", 12)}
    return els, tl, end


def with_seven(els, tl, k, sid, beat, word, fallback=20):
    """섹션의 챕터 간지(el_chapter)를 7개 전략 카드판으로 바꾼다. 그 전략 이름(word)이 들릴 때 카드가 뒤집힌다."""
    fa = (word_at(sid, beat, word) or fallback) - 2
    b_els, b_tl, _ = seven_board(k, fa)
    els = [e for e in els if e["id"] != "el_chapter"] + b_els
    tl = {i: t for i, t in tl.items() if i != "el_chapter"}
    tl.update(b_tl)
    return els, tl


def chapter(num, ttl, sub=None, blue=True, out=78):
    """챕터 간지 요소 + 타이밍 (섹션 첫 2.6초)"""
    return (dg("el_chapter", "chapter", 0, 0, W, H, {"num": num, "title": ttl, "sub": sub, "onBlue": blue, "at": 0, "numSize": 150 if len(num) > 2 else 200}, z=20),
            T(0, out, "none", 1, "fade", 10))


_NORM = re.compile(r"[^0-9A-Za-z가-힣.%]")


def _norm(s):
    return _NORM.sub("", str(s)).lower()


def _key_text(e):
    """발음에 맞출 화두 글자. 대상: 대형 키워드·숫자·띠·짧은 단어(공백 빼고 12자 이하). 머리말·제목·문장 자막은 제외."""
    if e.get("nosync") or e.get("style") in ("kicker", "title", "note", "chip", "chip_alert"):
        return None
    if e.get("type") == "diagram":
        if e.get("kind") in ("keyword", "stat", "banner"):
            return (e.get("props") or {}).get("text")
        return None
    s = re.sub(r"\[\[|\]\]", "", str(e.get("text") or ""))
    return s if s and len(re.sub(r"\s", "", s)) <= 12 else None


def _sentence_text(e):
    """문장형 자막(12자 초과 글자 요소): 첫 단어가 발음되는 순간에 뜬다 — 2026-11-18 사용자: '대사 나올 때 바로 나와야'"""
    if e.get("nosync") or e.get("type") != "text" or e.get("style") in ("kicker", "title", "note", "chip", "chip_alert"):
        return None
    s = re.sub(r"\[\[|\]\]", "", str(e.get("text") or ""))
    return s if s and len(re.sub(r"\s", "", s)) > 12 else None


def sync_words(sid, els, tl, fps=30):
    """화두 단어는 발음 순간에 뜬다 — words.json의 그 단어 시작점으로 in을 옮긴다(앞뒤 3~4초 안에서만)."""
    d = os.path.join(P, "sections", sid)
    words = []
    for b in rj(os.path.join(d, "beats.json"))["beats"]:
        p = os.path.join(d, "audio", "beat-%s.words.json" % b["id"].lstrip("b"))
        if os.path.exists(p):
            words += [(b["start"] + round(w["s"] * fps), _norm(w["w"])) for w in rj(p)["words"]]
    if not words:
        return []
    moved = []
    for e in els:
        t = tl.get(e["id"])
        if e.get("sync") is False:              # sync=False: 발음 맞춤 끄기 (디자인 시점 그대로 — 띠를 대사보다 먼저 등)
            continue
        key, sent = _key_text(e), _sentence_text(e)
        txt = e.get("sync") or key or sent       # sync: 디자인에서 맞출 단어를 직접 지정
        if not t or not txt:
            continue
        toks = [_norm(x) for x in re.split(r"[\s\n·—,→]+", txt) if len(_norm(x)) >= 2]
        if e.get("sync") or not key:
            toks = toks[:1]                    # 문장·지정 단어는 첫 단어만 (뒤 단어로 엉뚱하게 짝짓지 않게)
        lo = 150 if e.get("sync") else 90
        best = None
        for ti, tok in enumerate(toks[:3]):
            for f, w in words:
                if not (w.startswith(tok) or (len(w) >= 2 and tok.startswith(w) and len(w) >= len(tok) - 1)):
                    continue
                if not (t["in"] - lo <= f <= t["in"] + 120 and f < t["out"] - 20):
                    continue
                cand = (ti, abs(f - t["in"]), f)
                if best is None or cand < best:
                    best = cand
        if best and best[2] < t["in"]:
            # 앞당길 때: 앞 장면 요소(원래 in 전에 끝나는 것)가 다 퇴장한 뒤에만
            prev = [o["out"] for k, o in tl.items() if k != e["id"] and best[2] < o["out"] <= t["in"] + 6]
            if prev:
                best = (best[0], best[1], max(best[2], max(prev)))
        if best and abs(best[2] - t["in"]) > 6:
            dl = best[2] - t["in"]
            t["in"] = best[2]
            pr = e.get("props") or {}
            if isinstance(pr.get("subAt"), (int, float)):      # 부제는 원래 절대 시점 유지
                pr["subAt"] = max(int(pr.get("perLetter", 2) * len(txt)) + 6, pr["subAt"] - dl)
            moved.append("%s %+.1fs" % (e["id"], dl / fps))
    return moved


def hl(e, *items, color="$blue", effect=None):
    """글자 요소에 하이라이트 글자를 단다. items: "어떤 환경" 또는 {"text", "color", "effect", "at"}.
    at이 없으면 save 때 그 글자(첫 낱말)가 들리는 프레임으로 맞춘다 → 말할 때 남색→파랑으로 바뀌며 반짝 (2026-11-19 사용자)"""
    out = []
    for x in items:
        x = dict(text=x) if isinstance(x, str) else dict(x)
        x.setdefault("color", color)
        if effect:
            x.setdefault("effect", effect)
        out.append(x)
    e["hl"] = out
    return e


def sync_hl(sid, els, tl, fps=30):
    """hl 항목 중 at이 없는 것 → 요소가 떠 있는 동안 그 글자의 첫 낱말이 발음되는 프레임"""
    d = os.path.join(P, "sections", sid)
    beats = rj(os.path.join(d, "beats.json"))["beats"]
    words = []
    for b in beats:
        wp = os.path.join(d, "audio", "beat-%s.words.json" % b["id"].lstrip("b"))
        if os.path.exists(wp):
            words += [(b["start"] + round(w["s"] * fps), _norm(w["w"])) for w in rj(wp)["words"]]
    for e in els:
        t = tl.get(e["id"]) or {}
        for x in e.get("hl") or []:
            if x.get("at") is not None:
                continue
            first = _norm(str(x["text"]).split()[0])
            hit = [f for f, w in words if t.get("in", 0) - 15 <= f < t.get("out", 10 ** 9) and first and (first in w or w in first and len(w) >= 2)]
            x["at"] = max(t.get("in", 0), hit[0]) if hit else t.get("in", 0) + 12


def save(sid, els, tl, note):
    """layout·timeline 저장 + 골격 해제. note = storyboard.md 본문"""
    d = os.path.join(P, "sections", sid)
    t = rj(os.path.join(d, "timeline.json"))
    mv = sync_words(sid, els, tl)
    sync_hl(sid, els, tl)
    if mv:
        print("  발음 맞춤", sid, ", ".join(mv))
    t["elements"] = tl
    # 음성(timeline.audio)은 tts가 채운 것을 그대로 둔다
    # 양식(style)을 쓰는 요소의 등장·퇴장 모양은 디자인 키트 motion 프리셋이 정한다 → 시점(in/out)과 강조만 남긴다
    for e in els:
        if e.get("style") and e["id"] in tl:
            tl[e["id"]] = {k: v for k, v in tl[e["id"]].items() if k in ("in", "out", "emphasis", "beat")}
    wj(os.path.join(d, "layout.json"), {"canvas": {"w": W, "h": H, "bg": "$bg"}, "elements": els})
    wj(os.path.join(d, "timeline.json"), t)
    wj(os.path.join(d, "edits.json"), {"base_version": 1, "elements": {}})
    st = rj(os.path.join(d, "status.json"))
    st["scaffold"] = False
    wj(os.path.join(d, "status.json"), st)
    with open(os.path.join(d, "storyboard.md"), "w", encoding="utf-8") as f:
        f.write(note.strip() + "\n")
    missing = [e["id"] for e in els if e["id"] not in tl]
    if missing:
        raise SystemExit("%s: 타이밍 없는 요소 %s" % (sid, missing))


# ---- 한 장면에 화두 하나: 장면용 짧은 표기 ----
def center(i, s, y, size=72, color=NAVY, weight=700, h=None, lh=1.3):
    """화면 가운데 큰 글자 — 크기대에 따라 키트 양식(display/headline/statement/subline)"""
    st = "display" if size >= 100 else "headline" if size >= 66 else "statement" if size >= 50 else "subline"
    if color == GRAY and st == "statement":
        st = "subline"
    sz = STYLE_SIZE[st]
    return styled(i, st, s, None, y, None, h or int(sz * lh * (s.count("\n") + 1)) + 10, color=color)


def kicker(i, s, y=206, color=BLUE):   # 머리말 아래 64px 이상 비우도록 조금 위로 (2026-11-19)
    """장면의 작은 머리말 (지금 화두 이름)"""
    return styled(i, "kicker", s, None, y, color=color)


def band(i, s, fill=BLUE, size=68, y=440, h=200):
    """화면을 가로지르는 띠 — 반전·결정타 문장"""
    return dg(i, "banner", 0, y, W, h, {"text": s, "at": 0, "fill": fill, "rx": 0, "wipe": True, "size": size})


def X(i, o, enter="fade-up", dur=14, emphasis=None):
    """장면 요소 타이밍: 들어오고, 다음 장면 시작에 사라짐"""
    return T(i, o, enter, dur, "fade", 10, emphasis)


def world_land():
    """3D 지구(globe) 육지 다각형. global_assets/geo/world_land.json([[[lon,lat],…],…])이 있으면 그것, 없으면 None(키트의 거친 윤곽)"""
    fp = os.path.join(P, "global_assets", "geo", "world_land.json")
    if not os.path.exists(fp):
        return None
    d = rj(fp)
    return d.get("polygons") if isinstance(d, dict) else d
