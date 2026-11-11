#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""모듈2 스튜디오 수정 요청 대기열 — 오케스트레이터(Claude)용.

  studio_queue.py <project> list                 대기 중 요청
  studio_queue.py <project> start <rid>          진행 시작: 직접 편집값(edits.json)을 layout/timeline에 그대로 합치고 비움
  studio_queue.py <project> brief <rid>          섹션 서브에이전트에게 줄 지시문 출력
  studio_queue.py <project> done <rid> --summary "한 줄 요약"   완료: 버전+1, 상태 '수정됨'
  studio_queue.py <project> fold <sid>           (단독) 편집값 합치기만

흐름: 사용자가 스튜디오에서 '수정 요청 보내기' → Claude가 list → 요청마다 start → brief로 서브에이전트 실행(병렬)
     → 에이전트가 comments.json 각 항목 status/resolution 기록 → done.
"""
import argparse
import datetime
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN = os.path.dirname(os.path.dirname(HERE))
TIMING = ["in", "out", "enter", "enterDur", "exit", "exitDur", "emphasis", "beat"]


def now():
    return datetime.datetime.now().isoformat(timespec="seconds")


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


def fold(P, sid):
    """edits.json → layout.json / timeline.json (값 그대로). 반환: 반영한 요소 id 목록."""
    d = os.path.join(P, "sections", sid)
    lay = rj(os.path.join(d, "layout.json"), {"canvas": {}, "elements": []})
    tl = rj(os.path.join(d, "timeline.json"), {"fps": 30, "duration": 150, "elements": {}})
    ed = rj(os.path.join(d, "edits.json"), {"elements": {}})
    tl.setdefault("elements", {})
    done = []
    for eid, e in (ed.get("elements") or {}).items():
        if e.get("_deleted"):
            lay["elements"] = [x for x in lay["elements"] if x["id"] != eid]
            tl["elements"].pop(eid, None)
            done.append(eid + "(삭제)")
            continue
        base = next((x for x in lay["elements"] if x["id"] == eid), None)
        if base is None:
            base = {"id": eid}
            lay["elements"].append(base)
        t = tl["elements"].setdefault(eid, {})
        for k, v in e.items():
            if k.startswith("_"):
                continue
            if k in TIMING:
                t[k] = v
            elif k == "font":
                base["font"] = dict(base.get("font") or {}, **v)
            elif v is None:
                base.pop(k, None)
            else:
                base[k] = v
        for k in TIMING:
            base.pop(k, None)
        done.append(eid + ("(추가)" if e.get("_new") else ""))
    wj(os.path.join(d, "layout.json"), lay)
    wj(os.path.join(d, "timeline.json"), tl)
    wj(os.path.join(d, "edits.json"), {"base_version": rj(os.path.join(d, "status.json"), {}).get("version", 1), "elements": {},
                                       "folded": {"at": now(), "elements": done}})
    return done


def load_q(P):
    return rj(os.path.join(P, "studio", "queue.json"), {"requests": []})


def save_q(P, q):
    wj(os.path.join(P, "studio", "queue.json"), q)


def find(q, rid):
    for r in q["requests"]:
        if r["id"] == rid:
            return r
    sys.exit("요청 없음: " + rid)


BRIEF = """너는 모듈2 섹션 수정 에이전트다. 섹션 {sid}('{title}') 하나만 고친다.

## 위치
- 섹션 폴더: {d}
- 고칠 수 있는 파일: layout.json, timeline.json, script.md, beats.json, storyboard.md, comments.json (이 폴더 안만)
- 렌더 의미론 정본: {anim} (요소 필드·등장/퇴장 효과 이름·텍스트 강조 [[...]] 문법)
- 스냅샷: history/{snap} (수정 전 상태. 건드리지 말 것)

## 사용자가 직접 바꾼 값
이미 layout.json/timeline.json에 그대로 합쳐 두었다: {folded}
이 값들은 사용자가 손으로 맞춘 숫자다. 다른 코멘트를 처리하다가 되돌리거나 "보정"하지 마라.

## 처리할 코멘트 (comments.json의 status=open)
{comments}
요청 메모: {note}

## 규칙
1. 코멘트마다 layout.json(위치·크기·폰트·색·문구) 또는 timeline.json(in/out 프레임, enter/exit 효과, emphasis)을 고친다. 단위: px(1920×1080), 프레임(30fps).
2. 타이밍 코멘트("말할 때")는 audio/beat-N.words.json(ASR 단어 시작점)이 있으면 그 프레임 = 비트 start + 단어 s×30 에 맞춘다. 없으면 timeline.beats의 비트 경계로 근사하고 resolution에 "음성 생성 후 단어 시점으로 재정렬 필요"라고 적는다.
3. 텍스트 일부 강조는 text 안에 [[강조할 부분]]으로 감싸고 font.accentColor로 색을 정한다(기본 #296ef9).
4. 이미지·영상 첨부(attachments 경로)는 image/video 요소로 넣는다. src는 섹션 폴더 기준 상대경로.
5. 해석이 갈리는 코멘트(무엇을 올리라는 건지 등)는 고치지 말고 status를 needs_user로, resolution에 두 해석안을 적는다.
6. 화면 수치·회사명은 실값 그대로 써도 된다(로컬 렌더). 다만 script.md/beats.json 문구를 바꿨다면 마지막 줄에 "마스킹 재적용 필요"라고 보고한다.
7. 섹션 밖 파일(design-baseline.json, 다른 섹션, global_assets)이 바뀌어야 하면 직접 고치지 말고 보고만 한다.
8. 끝나면 comments.json에서 처리한 코멘트마다 status를 resolved 또는 needs_user로 바꾸고 resolution에 한 줄 설명(무엇을 몇으로 바꿨는지)을 쓴다.
9. JSON은 유효해야 한다. 고친 뒤 python3 -c "import json;json.load(open(...))"로 확인한다.

## 보고 (마지막 메시지)
- 한 줄 요약 (studio_queue.py done --summary에 그대로 넣을 문장)
- 코멘트별 처리 결과
- 섹션 밖 변경이 필요한 것 / 마스킹 재적용 필요 여부
"""


def brief(P, r):
    sid = r["section"]
    d = os.path.join(P, "sections", sid)
    cfg = rj(os.path.join(P, "project.json"), {})
    title = next((s.get("title", sid) for s in cfg.get("sections", []) if s["id"] == sid), sid)
    cm = rj(os.path.join(d, "comments.json"), {"comments": []})
    ids = set(r.get("comment_ids") or [])
    lines = []
    for c in cm["comments"]:
        if c["id"] in ids or (c.get("status", "open") == "open"):
            at = "" if c.get("frame") is None else " @f%d(%.1fs)" % (c["frame"], c["frame"] / 30.0)
            att = "" if not c.get("attachments") else " 첨부: " + ", ".join(a["path"] for a in c["attachments"])
            lines.append("- [%s] 유형=%s 대상=%s%s: %s%s" % (c["id"], c["type"], c.get("target") or "섹션 전체", at, c.get("body", ""), att))
    ed = rj(os.path.join(d, "edits.json"), {})
    folded = ", ".join((ed.get("folded") or {}).get("elements", [])) or "없음"
    return BRIEF.format(sid=sid, title=title, d=d, anim=os.path.join(PLUGIN, "templates", "module2", "studio", "anim.js"),
                        snap=r.get("snapshot", "-"), folded=folded, comments="\n".join(lines) or "(없음 — 직접 편집값 반영만)",
                        note=r.get("note") or "없음")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("cmd", choices=["list", "start", "brief", "done", "fold"])
    ap.add_argument("arg", nargs="?")
    ap.add_argument("--summary", default="")
    a = ap.parse_args()
    P = os.path.abspath(a.project)
    q = load_q(P)
    if a.cmd == "list":
        pend = [r for r in q["requests"] if r.get("status") in ("pending", "in_progress")]
        if not pend:
            print("대기 중 요청 없음")
        for r in pend:
            print("%s  %s  %-11s 코멘트 %d개  편집 %s  %s  메모: %s" % (r["id"], r["section"], r["status"], len(r.get("comment_ids", [])),
                                                          "있음" if r.get("has_edits") else "없음", r["requested_at"], r.get("note") or "-"))
    elif a.cmd == "fold":
        print("반영:", ", ".join(fold(P, a.arg)) or "없음")
    elif a.cmd == "start":
        r = find(q, a.arg)
        done = fold(P, r["section"])
        r["status"] = "in_progress"
        r["started_at"] = now()
        save_q(P, q)
        stp = os.path.join(P, "sections", r["section"], "status.json")
        st = rj(stp, {})
        st["status"] = "in_progress"
        wj(stp, st)
        print("시작 %s (%s). 직접 편집 반영: %s" % (r["id"], r["section"], ", ".join(done) or "없음"))
    elif a.cmd == "brief":
        print(brief(P, find(q, a.arg)))
    elif a.cmd == "done":
        r = find(q, a.arg)
        r["status"] = "done"
        r["done_at"] = now()
        r["summary"] = a.summary
        save_q(P, q)
        stp = os.path.join(P, "sections", r["section"], "status.json")
        st = rj(stp, {})
        st["version"] = st.get("version", 1) + 1
        st["status"] = "revised"
        st["last_summary"] = a.summary
        st["revised_at"] = now()
        wj(stp, st)
        print("완료 %s → %s v%d" % (r["id"], r["section"], st["version"]))


if __name__ == "__main__":
    main()
