#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""모듈2 연출 검수 게이트 — 최종 렌더 전에 "연출 없이 찍어낸 영상"을 막는다.

  direction_check.py <project> [--json]       # 문제 목록. 오류가 있으면 exit 1

검사 (오류 = 최종 렌더 차단, 경고 = 표시만):
  [오류] 연출안 없음/템플릿 그대로     00-direction/direction.md
  [오류] 연출안 미승인 또는 승인 뒤 바뀜  project.json state.direction (스튜디오 '연출안'에서 승인)
  [오류] 골격 그대로                  module2_init 골격(status.scaffold / 요소 _scaffold)이 남은 섹션
  [오류] 글자만 있는 섹션             diagram·broll·3d·image·video·avatar 요소가 하나도 없음
  [오류] 숫자 연출 없음               대본에 금액·%·배 수치가 있는데 stat/bars/line/table/카운트업이 없음
  [오류] 같은 장치 반복               연속 3개 섹션이 같은 장치 구성(요소 종류 집합)
  [오류] 화두 과밀                   한 화면에 내용 6개 이상 동시 (4~5개는 경고). 같은 group 값은 하나로 셈
  [오류] 배치: 겹침·선이 글자를 가로지름·카드/칩 안 글자가 테두리에 붙음 (layout_audit.mjs)   [오류] 머리말 아래 64px 미만   [경고] 배치: 32px 미만으로 붙음·화면 밖
  [경고] 화두 단어가 발음과 1초 넘게 어긋남 (words.json)
  [경고] 숫자 카운트업·막대가 다 자라기 전(또는 1초 안)에 장면이 바뀜
  [경고] 정지 구간                  새 요소·강조·키트 내부 등장·자동 비트 강조 없이 6초 넘게 멈춤
  [경고] 자막 바                     하단 자막 바(대사 전문)는 기본 off
  [경고] 굵기 800 이상               디스플레이는 600, 임팩트 700까지
  [경고] 챕터 간지 없음              섹션 12개 이상인데 chapter 키트가 없음
연출 규칙의 근거: agents/director.md, agents/storyboarder.md, templates/taste-rubric.json, agents/module2.md §4-1.
"""
import argparse
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import m2env  # noqa: E402
m2env.fix_stdio()

VISUAL = {"diagram", "broll", "3d", "image", "video", "avatar"}
NUMERIC_KINDS = {"stat", "bars", "line", "table"}
NUM_RE = re.compile(r"\d[\d,.]*\s?(조|억|만)?\s?(원|%p|%|배|bp)")
STATIC_LIMIT = 6 * 30   # 2026-11-18 사용자: "매순간 애니메이션" → 8초에서 6초로
BUSY_WARN, BUSY_ERROR = 4, 6   # 동시에 보이는 내용 요소 수 (2026-11-17 사용자: "한 내용에 하나의 큰 화두, 스파게티 금지")
TEMPLATE_MARK = "<!-- module2:direction-template -->"


def rj(p, d=None):
    if not os.path.exists(p):
        return d
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def direction_hash(P):
    p = os.path.join(P, "00-direction", "direction.md")
    if not os.path.exists(p):
        return None
    with open(p, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:12]


def merged_elements(d):
    layout = rj(os.path.join(d, "layout.json"), {"elements": []}) or {"elements": []}
    edits = (rj(os.path.join(d, "edits.json"), {}) or {}).get("elements") or {}
    out = []
    for e in layout.get("elements", []):
        ed = edits.get(e.get("id"), {})
        if ed.get("_deleted"):
            continue
        m = dict(e)
        m.update({k: v for k, v in ed.items() if not k.startswith("_") and k != "font"})
        m["font"] = dict(e.get("font") or {}, **(ed.get("font") or {}))
        out.append(m)
    for k, e in edits.items():
        if e.get("_new") and not e.get("_deleted"):
            out.append(dict(e, id=k))
    return out


def signature(els):
    sig = set()
    for e in els:
        t = e.get("type")
        if t == "diagram":
            sig.add("diagram:" + str(e.get("kind")))
        elif t in VISUAL:
            sig.add(t)
        elif t == "text" and not str(e.get("id", "")).startswith("el_cap"):
            sig.add("text")
    return tuple(sorted(sig))


TIME_KEYS = {"at", "activeAt", "subAt", "explodeAt"}


def kit_times(e):
    """diagram·3d 내부에서 화면이 바뀌는 시점(요소 기준 프레임)들 — props 안의 at·activeAt·subAt·explodeAt 전부."""
    ts = [0]

    def walk(v):
        if isinstance(v, dict):
            for k, x in v.items():
                if k in TIME_KEYS and isinstance(x, (int, float)):
                    ts.append(x)
                else:
                    walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)
    walk(e.get("props") or {})
    return ts


_WN = re.compile(r"[^0-9A-Za-z가-힣.%]")
SYNC_TOL = 30   # 1초 넘게 어긋나면 경고


def _key_text(e):
    """발음에 맞춰야 할 화두 글자: 대형 키워드·숫자·띠·짧은 단어(공백 빼고 12자 이하). 머리말·제목·문장 자막 제외."""
    if e.get("nosync") or e.get("style") in ("kicker", "title", "note", "chip", "chip_alert"):
        return None
    if e.get("type") == "diagram":
        return (e.get("props") or {}).get("text") if e.get("kind") in ("keyword", "stat", "banner") else None
    if e.get("type") != "text":
        return None
    s = re.sub(r"\[\[|\]\]", "", str(e.get("text") or ""))
    return s if s and len(re.sub(r"\s", "", s)) <= 12 else None


def word_offsets(d, els, tle, beats, fps=30):
    """(id, in, 단어 시작 프레임, 글자) — 대사에 나오는 화두 단어가 발음과 1초 넘게 어긋난 것."""
    words = []
    for b in beats:
        p = os.path.join(d, "audio", "beat-%s.words.json" % str(b.get("id", "")).lstrip("b"))
        w = rj(p)
        if w:
            words += [(b.get("start", 0) + round(x["s"] * fps), _WN.sub("", x["w"]).lower()) for x in w.get("words", [])]
    out = []
    if not words:
        return out
    for e in els:
        if e.get("sync") is False:   # 디자인에서 발음 맞춤을 일부러 끈 요소 (예: 띠를 대사보다 먼저)
            continue
        t, key = tle.get(e.get("id")) or {}, _key_text(e)
        sent = None
        if e.get("type") == "text" and not e.get("nosync") and e.get("style") not in ("kicker", "title", "note", "chip", "chip_alert"):
            raw = re.sub(r"\[\[|\]\]", "", str(e.get("text") or ""))
            sent = raw if len(re.sub(r"\s", "", raw)) > 12 else None
        txt = e.get("sync") or key or sent      # 문장형 자막은 첫 단어, sync는 지정 단어
        if not txt or "in" not in t:
            continue
        toks = [_WN.sub("", x).lower() for x in re.split(r"[\s\n·—,→]+", txt)]
        toks = [x for x in toks if len(x) >= 2][:1 if (e.get("sync") or not key) else 3]
        best = None
        for ti, tok in enumerate(toks):
            for f, w in words:
                if (w.startswith(tok) or (len(w) >= max(2, len(tok) - 1) and tok.startswith(w))) and t["in"] - 90 <= f <= t["in"] + 120 and f < t.get("out", 1e9) - 20:
                    c = (ti, abs(f - t["in"]), f)
                    best = c if best is None or c < best else best
        if best and best[2] < t["in"]:   # 앞 장면 요소가 아직 화면에 있으면 그 퇴장까지는 기다리는 게 맞다
            prev = [o.get("out", 0) for k, o in tle.items() if k != e["id"] and best[2] < o.get("out", 0) <= t["in"] + 6]
            if prev:
                best = (best[0], best[1], max(best[2], max(prev)))
        if best and abs(best[2] - t["in"]) > SYNC_TOL:
            out.append((e["id"], t["in"], best[2], txt))
    return out


HOLD_MIN = 30   # 숫자가 다 오른 뒤 최소 1초는 머문다


def count_ends(e):
    """diagram 안에서 숫자·막대가 다 자라는 시점(요소 기준 프레임)들 — stat(at+dur), bars(valueAt+valueDur, add.at+add.dur)"""
    p, ends = e.get("props") or {}, []
    if e.get("kind") == "stat":
        ends.append((p.get("at") or 0) + (p.get("dur") or 24))
    if e.get("kind") == "bars":
        for b in p.get("bars") or []:
            if b.get("display"):
                va = b.get("valueAt", b.get("at") or 0)
                ends.append(va + (b.get("valueDur") or p.get("grow") or 18))
            ad = b.get("add")
            if ad:
                ends.append((ad.get("at") or 0) + (ad.get("dur") or 20))
    return ends


def check(P):
    P = os.path.abspath(P)
    cfg = rj(os.path.join(P, "project.json"), {}) or {}
    issues = []

    def add(level, sid, code, msg):
        issues.append({"level": level, "section": sid, "code": code, "msg": msg})

    dp = os.path.join(P, "00-direction", "direction.md")
    txt = open(dp, encoding="utf-8").read() if os.path.exists(dp) else ""
    if not txt.strip():
        add("error", None, "no_direction", "연출안(00-direction/direction.md)이 없습니다. director가 영상 전체 연출안을 먼저 써야 합니다.")
    elif TEMPLATE_MARK in txt:
        add("error", None, "direction_template", "연출안이 템플릿 그대로입니다. 챕터·에너지 곡선·섹션별 장치를 채우고 템플릿 표시 줄을 지우세요.")
    appr = ((cfg.get("state") or {}).get("direction") or {})
    h = direction_hash(P)
    if txt.strip() and TEMPLATE_MARK not in txt:
        if not appr.get("approved_at"):
            add("error", None, "not_approved", "연출안이 아직 승인되지 않았습니다. 스튜디오 '연출안' 탭에서 사용자가 승인해야 합니다.")
        elif appr.get("hash") != h:
            add("error", None, "approval_stale", "연출안이 승인 뒤에 바뀌었습니다. 다시 승인받으세요.")

    secs = cfg.get("sections", [])
    sigs, kinds_all = [], set()
    for s in secs:
        sid = s["id"]
        d = os.path.join(P, "sections", sid)
        if not os.path.isdir(d):
            continue
        st = rj(os.path.join(d, "status.json"), {}) or {}
        els = merged_elements(d)
        tl = rj(os.path.join(d, "timeline.json"), {}) or {}
        tle = tl.get("elements") or {}
        dur = tl.get("duration", 0)
        beats = (rj(os.path.join(d, "beats.json"), {"beats": []}) or {"beats": []}).get("beats", [])
        if st.get("scaffold") or any(e.get("_scaffold") for e in els):
            add("error", sid, "scaffold", "module2_init 골격이 그대로입니다. 연출안대로 섹션을 직접 설계하세요.")
        types = {e.get("type") for e in els}
        kinds = {e.get("kind") for e in els if e.get("type") == "diagram"}
        kinds_all |= kinds
        if not (types & VISUAL):
            add("error", sid, "text_only", "글자만 있는 섹션입니다. 다이어그램·실사(b-roll 자리표시 포함)·3D 중 하나가 주인공이어야 합니다.")
        spoken_nums = [m.group(0) for b in beats for m in NUM_RE.finditer(b.get("text", ""))]
        has_count = any((tle.get(e["id"], {}) or {}).get("enter") == "count-up" or e.get("enter") == "count-up" for e in els)
        if spoken_nums and not (kinds & NUMERIC_KINDS or "3d" in types or has_count):
            add("error", sid, "numbers_flat", "수치(%s)가 나오는데 숫자 연출(stat·bars·line·table·카운트업)이 없습니다." % ", ".join(spoken_nums[:3]))
        caps = [e for e in els if str(e.get("id", "")).startswith("el_cap") or (e.get("type") == "text" and e.get("y", 0) >= 880 and (tle.get(e["id"], {}) or {}).get("beat"))]
        if caps:
            add("warn", sid, "caption_bar", "하단 자막 바가 있습니다(기본 off). 화면 글자는 키워드만.")
        heavy = [e["id"] for e in els if (e.get("font") or {}).get("weight", 0) >= 800]
        if heavy:
            add("warn", sid, "heavy_weight", "굵기 800 이상: %s (디스플레이 600, 임팩트 700)" % ", ".join(heavy[:4]))
        # 정지 구간: 화면에 새로 생기는 사건들 사이 간격
        ev = {0, dur}
        for e in els:
            t = tle.get(e["id"], {}) or {}
            tin = t.get("in", e.get("in", 0)) or 0
            if str(e.get("id", "")).startswith("el_cap"):
                continue
            ev.add(tin)
            for em in t.get("emphasis") or []:
                ev.add(em.get("at", tin))
            if e.get("type") in ("diagram", "3d"):
                ev |= {tin + (x or 0) for x in kit_times(e)}
        # anim.js beatAccents: 문장 시작·긴 문장 4초마다 변화가 없으면 주인공 요소에 자동 강조 → 그 시점도 변화로 센다
        theme = rj(os.path.join(P, "design", "theme.json"), {}) or {}
        ba = dict({"enabled": True, "every": 120, "delay": 8}, **(theme.get("beatAccent") or {}))
        if ba.get("enabled", True):
            for b in beats:
                ev.add(b.get("start", 0) + ba["delay"])
                x = b.get("start", 0) + ba["every"]
                while x < b.get("end", 0) - 45:
                    ev.add(x)
                    x += ba["every"]
        ev = sorted(x for x in ev if 0 <= x <= dur)
        # 한 화면 한 화두: 동시에 보이는 내용 요소 수 (제목·챕터 간지·실사 배경·고스트 제외)
        def is_content(e):
            if e.get("id") in ("el_title", "el_chapter") or str(e.get("id", "")).startswith("el_cap"):
                return False
            if e.get("type") in ("broll", "rect"):
                return False
            if e.get("type") == "diagram" and (e.get("kind") in ("ghost", "chapter") or (e.get("props") or {}).get("background")):
                return False   # 배경으로 깐 사진 부품(background:true)도 화두가 아니라 배경
            # 작은 머리말·표기(40px 이하, 배경 없음)는 화두가 아니라 안내
            if e.get("type") == "text" and not e.get("fill") and (e.get("font") or {}).get("size", 48) <= 40:
                return False
            return True
        busiest, at_f = 0, 0
        for f0 in ev:
            seen = set()
            for e in els:
                t = tle.get(e["id"], {}) or {}
                if is_content(e) and t.get("in", 0) <= f0 + 15 < t.get("out", dur):
                    seen.add(e.get("group") or e["id"])   # 같은 group(한 화두의 칩 묶음 등)은 하나로
            n = len(seen)
            if n > busiest:
                busiest, at_f = n, f0
        if busiest >= BUSY_ERROR:
            add("error", sid, "busy", "한 화면에 내용 %d개가 동시에 있습니다(%.1f초). 한 장면에 화두 하나 — 다음 화두가 오면 이전 화두는 퇴장." % (busiest, at_f / 30))
        elif busiest >= BUSY_WARN:
            add("warn", sid, "busy", "한 화면에 내용 %d개(%.1f초). 화두 하나만 크게 보이는지 확인하세요." % (busiest, at_f / 30))
        gaps = [(a, b) for a, b in zip(ev, ev[1:]) if b - a > STATIC_LIMIT]
        if gaps:
            a, b = max(gaps, key=lambda g: g[1] - g[0])
            add("warn", sid, "static", "%.0f초 동안 화면 변화가 없습니다 (%.1f~%.1f초). 비트마다 요소·강조를 물리세요." % ((b - a) / 30, a / 30, b / 30))
        # 숫자가 오르는 중에 장면이 넘어가면 어색하다 (2026-11-18 사용자: "103조 이후 숫자가 오르는데 장면이 넘어가요")
        for e in els:
            if e.get("type") != "diagram":
                continue
            t = tle.get(e["id"], {}) or {}
            for end in count_ends(e):
                if t.get("in", 0) + end > t.get("out", dur) - HOLD_MIN:
                    add("warn", sid, "count_cut", "%s: 숫자·막대가 %.1f초에 다 자라는데 %.1f초에 장면이 바뀝니다 — 다 오른 뒤 1초 이상 머물게(valueAt·dur를 당기거나 out을 늦추기)." % (e["id"], (t.get("in", 0) + end) / 30, t.get("out", dur) / 30))
                    break
        # 화두 단어는 발음 순간에 (2026-11-18 사용자: "Beyond Connection이 발음 나올 때 나오도록")
        for eid, tin, fw, txt in word_offsets(d, els, tle, beats):
            add("warn", sid, "word_sync", "「%s」(%s)가 발음보다 %.1f초 %s 뜹니다 — in을 words.json 단어 시작(%d프레임)에 맞추세요." % (txt[:16], eid, abs(fw - tin) / 30, "늦게" if tin > fw else "먼저", fw))
        sigs.append((sid, signature(els)))

    run = 1
    for i in range(1, len(sigs)):
        run = run + 1 if sigs[i][1] == sigs[i - 1][1] and sigs[i][1] else 1
        if run == 3:
            add("error", sigs[i][0], "uniform", "%s~%s 세 섹션이 같은 장치 구성입니다 %s. 섹션마다 주인공 장치를 바꾸세요." % (sigs[i - 2][0], sigs[i][0], list(sigs[i][1])))
    if len(secs) >= 12 and "chapter" not in kinds_all:
        add("warn", None, "no_chapters", "섹션이 %d개인데 챕터 간지(chapter)가 없습니다. 큰 흐름의 쉼표를 두세요." % len(secs))

    # 배치 검사 (layout_audit.mjs — 스튜디오·렌더와 같은 anim.js로 위치 계산): 겹침·선 가로지름 = 오류, 붙음·화면 밖 = 경고
    node = m2env.which("node")
    if node:
        r = m2env.run([node, os.path.join(os.path.dirname(os.path.abspath(__file__)), "layout_audit.mjs"), P, "--json"], timeout=180)
        try:
            found = json.loads((r.stdout or "[]").strip().splitlines()[-1] or "[]")
        except Exception:
            found = []
            add("warn", None, "layout_audit", "배치 검사를 실행하지 못했습니다: %s" % (r.stderr or "")[-200:])
        KN = {"overlap": "겹침", "crossing": "선이 글자를 가로지름", "edge": "카드·칩 테두리에 붙음(여백 20px 미만)", "milestone": "영상 위 마일스톤 바 자리에 글자가 들어감", "crowded": "너무 붙음(32px 미만)", "headgap": "머리말 아래 내용이 너무 가까움(64px 미만)", "offscreen": "화면 밖"}
        for x in found:
            lv = "error" if x["kind"] in ("overlap", "crossing", "edge", "headgap") else "warn"
            add(lv, x["section"], "layout_" + x["kind"], "%.1f초 %s — %s%s" % (x["t"], KN.get(x["kind"], x["kind"]), x["a"], (" ↔ " + x["b"]) if x.get("b") else ""))
    else:
        add("warn", None, "layout_audit", "node가 없어 배치 검사(겹침·간격)를 건너뛰었습니다.")

    hist = {}
    for _, sg in sigs:
        for k in sg:
            hist[k] = hist.get(k, 0) + 1
    errors = sum(1 for x in issues if x["level"] == "error")
    return {"ok": errors == 0, "errors": errors, "warnings": len(issues) - errors, "issues": issues,
            "devices": dict(sorted(hist.items(), key=lambda kv: -kv[1])), "direction_hash": h}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    r = check(a.project)
    if a.json:
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        for x in r["issues"]:
            print("%s %-5s %-18s %s" % ("오류" if x["level"] == "error" else "경고", x["section"] or "전체", x["code"], x["msg"]))
        print("\n장치 사용 횟수:", ", ".join("%s %d" % kv for kv in r["devices"].items()) or "없음")
        print("결과: 오류 %d · 경고 %d → %s" % (r["errors"], r["warnings"], "통과" if r["ok"] else "최종 렌더 차단"))
    sys.exit(0 if r["ok"] else 1)


if __name__ == "__main__":
    main()
