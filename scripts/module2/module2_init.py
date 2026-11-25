#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""모듈2 프로젝트 초기화 + 섹션 골격 생성.

  module2_init.py <project> --script 대본.md|.docx|.txt   (## 제목 단위로 섹션 분할)
  module2_init.py <project> --pptx 자료.pptx                (슬라이드 단위로 섹션 분할)
  module2_init.py <project> --demo                          (가상 회사 데모 대본)

섹션마다 script.md / beats.json / storyboard.md / layout.json / timeline.json 기본값을 만든다.
이 기본값은 스튜디오가 열리게 하는 골격일 뿐이며, writer·storyboarder·layouter·continuity가 덮어쓴다.
이미 있는 섹션 파일은 --force 없이는 덮어쓰지 않는다.
"""
import argparse
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import redact  # noqa: E402

PLUGIN = os.path.dirname(os.path.dirname(HERE))
TEMPLATE = os.path.join(PLUGIN, "templates", "module2")
FPS = 30
CHARS_PER_SEC = 280 / 60.0

DEMO = """# 2027 전사 경영전략 (데모·가상 데이터)

## 오프닝
안녕하십니까. 한빛자산운용 대표이사 김도윤입니다. 오늘은 2027년 우리가 가야 할 길을 함께 나누고자 합니다.

## 시장의 변화
퇴직연금 시장은 지난해 500조 원을 넘어섰습니다. 투자자들은 이제 상품이 아니라 해법을 찾고 있습니다.

## 상반기 실적
올해 상반기 운용자산은 340조 원으로 12% 성장했습니다. 매출은 4,300억 원, 세전이익은 1,950억 원을 기록했습니다.

## 글로벌 전략
우리는 베트남과 인도네시아를 거점으로 동남아 시장에 진출합니다. 미국에서는 현지 운용사 인수를 검토하고 있습니다.

## 신사업
초부유층 자산관리와 공공 OCIO를 두 축으로, 3년 안에 신사업 매출을 2배로 키우겠습니다.

## 클로징
변화는 이미 시작됐습니다. 한빛자산운용이 먼저 지도를 다시 그리겠습니다. 감사합니다.
"""



sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import m2env  # noqa: E402
m2env.fix_stdio()

def split_sentences(text):
    text = re.sub(r"\s+", " ", text.strip())
    parts = re.split(r"(?<=[.?!다요])\s+(?=[^\s])", text)
    return [p.strip() for p in parts if p.strip()]


def sections_from_markdown(md):
    secs, cur = [], None
    for line in md.splitlines():
        h = re.match(r"^##\s+(.*)", line)
        if h:
            cur = {"title": h.group(1).strip(), "body": []}
            secs.append(cur)
        elif line.startswith("# "):
            continue
        elif cur is not None:
            cur["body"].append(line)
        elif line.strip():
            cur = {"title": "도입", "body": [line]}
            secs.append(cur)
    return [{"title": s["title"], "text": "\n".join(s["body"]).strip()} for s in secs if "\n".join(s["body"]).strip()]


def sections_from_pptx(path):
    out = []
    for block in redact.read_pptx(path).split("## 슬라이드 ")[1:]:
        lines = [l for l in block.splitlines()[1:] if l.strip()]
        notes = [l[5:] for l in lines if l.startswith("[노트] ")]
        body = [l for l in lines if not l.startswith("[노트] ")]
        title = body[0] if body else "슬라이드"
        text = " ".join(notes) if notes else " ".join(body[1:])
        out.append({"title": title[:40], "text": text or title, "slide_text": body})
    return out


def wjson(p, obj):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def scaffold_section(d, sid, idx, total, sec, force):
    os.makedirs(d, exist_ok=True)
    for sub in ("history", "audio", "avatar", "render", "attachments"):
        os.makedirs(os.path.join(d, sub), exist_ok=True)
    if os.path.exists(os.path.join(d, "beats.json")) and not force:
        return False
    sents = split_sentences(sec["text"])
    mode = "avatar" if idx in (0, total - 1) else "slide"
    beats, t = [], 0
    for i, s in enumerate(sents):
        dur = max(1.5, len(s) / CHARS_PER_SEC) + 0.4
        start, end = int(round(t * FPS)), int(round((t + dur) * FPS))
        beats.append({"id": "b%d" % (i + 1), "text": s, "mode": mode, "est_sec": round(dur, 2), "start": start, "end": end})
        t += dur
    duration = beats[-1]["end"] + 15 if beats else 150
    with open(os.path.join(d, "script.md"), "w", encoding="utf-8") as f:
        f.write("# %s\n\n%s\n" % (sec["title"], "\n\n".join(sents)))
    wjson(os.path.join(d, "beats.json"), {"section": sid, "title": sec["title"], "beats": beats})
    with open(os.path.join(d, "storyboard.md"), "w", encoding="utf-8") as f:
        f.write("# %s — 스토리보드 (골격)\n\n**메시지:** %s\n\n**화면 모드:** %s\n\n**흐름:**\n%s\n" % (
            sec["title"], sents[0] if sents else sec["title"], "인물(풀스크린)" if mode == "avatar" else "장표",
            "\n".join("- %s → (비주얼 미정)" % b["id"] for b in beats)))

    els = [
        {"id": "el_kicker", "type": "text", "x": 160, "y": 150, "w": 900, "h": 50, "text": "%02d" % (idx + 1),
         "font": {"family": "Pretendard", "weight": 600, "size": 32, "color": "#296ef9", "align": "left", "lineHeight": 1.2, "letterSpacing": 2}},
        {"id": "el_title", "type": "text", "x": 160, "y": 210, "w": 1600, "h": 110, "text": sec["title"],
         "font": {"family": "Pretendard", "weight": 700, "size": 84, "color": "#0b1f4b", "align": "left", "lineHeight": 1.15, "letterSpacing": -1}},
    ]
    tl = {"el_kicker": {"in": 0, "out": duration, "enter": "fade-up", "enterDur": 15, "exit": "none", "exitDur": 15},
          "el_title": {"in": 4, "out": duration, "enter": "fade-up", "enterDur": 18, "exit": "none", "exitDur": 15}}
    if mode == "avatar":
        els.append({"id": "el_avatar", "type": "avatar", "x": 0, "y": 0, "w": 1920, "h": 1080, "z": -1, "src": "avatar/avatar.mp4",
                    "fill": "#dfe6f2", "text": "아바타 (HeyGen 풀스크린)"})
        tl["el_avatar"] = {"in": 0, "out": duration, "enter": "fade", "enterDur": 10, "exit": "none", "exitDur": 10}
        els = [e for e in els if e["id"] != "el_kicker"]
        els[0].update({"y": 860, "h": 100, "font": dict(els[0]["font"], color="#ffffff", size=64)})
        tl.pop("el_kicker", None)
    else:
        y = 400
        for b in beats[:4]:
            eid = "el_%s" % b["id"]
            els.append({"id": eid, "type": "text", "x": 160, "y": y, "w": 1600, "h": 120, "text": b["text"],
                        "font": {"family": "Pretendard", "weight": 500, "size": 40, "color": "#1a1a1a", "align": "left", "lineHeight": 1.4, "letterSpacing": 0},
                        "fill": "#f3f6fb", "radius": 16, "pad": 28})
            tl[eid] = {"in": b["start"], "out": duration, "enter": "fade-up", "enterDur": 15, "exit": "none", "exitDur": 15, "beat": b["id"]}
            y += 150
    wjson(os.path.join(d, "layout.json"), {"canvas": {"w": 1920, "h": 1080, "bg": "#ffffff"}, "elements": els})
    wjson(os.path.join(d, "timeline.json"), {"fps": FPS, "duration": duration, "beats": [{"id": b["id"], "start": b["start"], "end": b["end"]} for b in beats],
                                             "audio": [], "elements": tl})
    wjson(os.path.join(d, "edits.json"), {"base_version": 1, "elements": {}})
    wjson(os.path.join(d, "comments.json"), {"comments": []})
    # scaffold: 이 골격은 스튜디오가 열리게 하는 자리표시일 뿐 완성품이 아니다.
    # 연출안(00-direction/direction.md) 승인 뒤 섹션 작업자가 직접 설계하고 scaffold를 false로 바꾼다.
    # 남아 있으면 direction_check가 최종 렌더를 막는다.
    wjson(os.path.join(d, "status.json"), {"status": "draft", "version": 1, "locked": False, "scaffold": True})
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("--script")
    ap.add_argument("--pptx")
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--title")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    P = os.path.abspath(a.project)
    for sub in ("00-intake", "00-direction", "sections", "global_assets/logos", "global_assets/fonts", "global_assets/clips",
                "global_assets/user_videos", "global_assets/voice_samples", "audio", "final", "studio"):
        os.makedirs(os.path.join(P, sub), exist_ok=True)

    pj = os.path.join(P, "project.json")
    if not os.path.exists(pj):
        cfg = json.load(open(os.path.join(TEMPLATE, "project.json"), encoding="utf-8"))
        cfg["title"] = a.title or os.path.basename(P)
        wjson(pj, cfg)
    cfg = json.load(open(pj, encoding="utf-8"))

    if a.demo:
        md = DEMO
        with open(os.path.join(P, "00-intake", "demo_script.md"), "w", encoding="utf-8") as f:
            f.write(md)
        cfg.setdefault("redaction", {}).setdefault("terms", {}).setdefault("person", [])
        secs = sections_from_markdown(md)
    elif a.script:
        shutil.copy2(a.script, os.path.join(P, "00-intake", os.path.basename(a.script)))
        md = redact.read_any(a.script)
        secs = sections_from_markdown(md)
    elif a.pptx:
        shutil.copy2(a.pptx, os.path.join(P, "00-intake", os.path.basename(a.pptx)))
        secs = sections_from_pptx(a.pptx)
        md = "\n\n".join("## %s\n%s" % (s["title"], s["text"]) for s in secs)
    else:
        secs, md = [], None

    if md is not None:
        with open(os.path.join(P, "00-direction", "script_full.md"), "w", encoding="utf-8") as f:
            f.write(md)
    dirp = os.path.join(P, "00-direction", "direction.md")
    if not os.path.exists(dirp):
        shutil.copy2(os.path.join(TEMPLATE, "direction.md"), dirp)
    # 디자인 키트: 공통 양식(색·글자 양식·애니메이션·부품)의 단일 출처. 스튜디오 '디자인 키트' 탭에서 고친다
    themep = os.path.join(P, "design", "theme.json")
    if not os.path.exists(themep):
        os.makedirs(os.path.dirname(themep), exist_ok=True)
        shutil.copy2(os.path.join(TEMPLATE, "theme.json"), themep)
    # 설계 키트(kit.py + README): 섹션 설계 스크립트(sections_*.py)가 쓰는 짧은 표기. 있으면 덮지 않음
    for fn in ("kit.py", "README.md"):
        src, dst = os.path.join(TEMPLATE, "design", fn), os.path.join(P, "design", fn)
        if os.path.exists(src) and not os.path.exists(dst):
            shutil.copy2(src, dst)
    made = 0
    for i, s in enumerate(secs):
        sid = "s%02d" % (i + 1)
        if scaffold_section(os.path.join(P, "sections", sid), sid, i, len(secs), s, a.force):
            made += 1
    if secs:
        cfg["sections"] = [{"id": "s%02d" % (i + 1), "title": s["title"]} for i, s in enumerate(secs)]
        cfg.setdefault("state", {})["stage"] = "intake_done"
        wjson(pj, cfg)
    redact.ensure_gitignore(P)
    print("project:", P)
    print("sections:", len(secs), "(new %d)" % made)
    print("섹션 파일은 골격(scaffold)입니다 — 완성품이 아닙니다.")
    print("다음: redact.py scan → director가 00-direction/direction.md 작성 → 스튜디오 '연출안' 승인 → 섹션별 설계")


if __name__ == "__main__":
    main()
