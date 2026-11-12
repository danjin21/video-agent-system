#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""모듈2 민감정보 마스킹.

회사명·금액/수치·지역·인명·상품/프로젝트명을 찾아 대체어(A사 / 99999원 / 임시지역1 …)로 바꾸고,
매핑표 00-direction/redaction_map.json (로컬 전용)을 관리한다.

명령:
  redact.py scan   <project> [--input FILE ...]   후보 추출 → 매핑표 갱신(사용자 수정값 보존)
  redact.py apply  <project>                      마스킹본 생성(script_masked.md, beats_masked.json)
  redact.py add    <project> --real TEXT --cat CAT [--mask TEXT]
  redact.py allow  <project> --real TEXT [--off]  노출 허용 토글
  redact.py gate   <project> [FILE|-] [--fragments]  실값이 있으면 exit 1 (외부 전송 직전 검사)
  redact.py splice-plan <project>                 발화되는 민감 어절 목록 → 00-direction/splice_plan.json
  redact.py report <project>

표준 라이브러리만 사용 (Python 3.9+). pptx/docx는 zip+XML로 직접 읽는다.
"""
import argparse
import datetime
import json
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
DICT_DIR = os.path.join(HERE, "dictionaries")

CATS = {
    "company": "회사",
    "money": "금액",
    "number": "수치",
    "region": "지역",
    "person": "인명",
    "product": "상품",
    "project": "프로젝트",
    "date": "일정",
}

# ---------------------------------------------------------------- 파일 읽기


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import m2env  # noqa: E402
m2env.fix_stdio()

def _xml_text(data, tag_suffix):
    root = ET.fromstring(data)
    paras = []
    for p in root.iter():
        if p.tag.endswith("}p"):
            t = "".join((n.text or "") for n in p.iter() if n.tag.endswith(tag_suffix))
            if t.strip():
                paras.append(t)
    return paras


def read_pptx(path):
    out = []
    with zipfile.ZipFile(path) as z:
        names = sorted(
            [n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)],
            key=lambda n: int(re.findall(r"\d+", n)[-1]),
        )
        for n in names:
            num = int(re.findall(r"\d+", n)[-1])
            paras = _xml_text(z.read(n), "}t")
            notes = "ppt/notesSlides/notesSlide%d.xml" % num
            note_paras = _xml_text(z.read(notes), "}t") if notes in z.namelist() else []
            out.append("## 슬라이드 %d\n%s" % (num, "\n".join(paras)))
            if note_paras:
                out.append("[노트] " + " ".join(note_paras))
    return "\n\n".join(out)


def read_docx(path):
    with zipfile.ZipFile(path) as z:
        return "\n".join(_xml_text(z.read("word/document.xml"), "}t"))


def read_any(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pptx":
        return read_pptx(path)
    if ext == ".docx":
        return read_docx(path)
    with open(path, encoding="utf-8") as f:
        return f.read()

# ---------------------------------------------------------------- 사전

def _load_list(name):
    p = os.path.join(DICT_DIR, name)
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8") as f:
        return [l.strip() for l in f if l.strip() and not l.startswith("#")]

SURNAMES = set("김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용")
TITLES = ["대표이사", "부회장", "회장", "부사장", "사장", "전무", "상무", "본부장", "센터장", "부문장", "실장", "팀장", "이사", "CEO", "CFO", "CIO", "COO", "CTO"]
COMPANY_SUFFIX = ["자산운용", "증권", "은행", "생명", "화재", "손해보험", "보험", "캐피탈", "카드", "금융지주", "금융그룹", "금융", "그룹", "홀딩스", "전자", "건설", "투자", "운용", "물산", "중공업", "화학", "제약", "통신"]
COMPANY_EN_SUFFIX = ["Asset Management", "Capital", "Securities", "Holdings", "Group", "Bank", "Inc.", "Inc", "Corp.", "Corp", "LLC", "Ltd.", "Ltd", "Co."]

# ---------------------------------------------------------------- 받침·조사

DIGIT_READ = {"0": "영", "1": "일", "2": "이", "3": "삼", "4": "사", "5": "오", "6": "육", "7": "칠", "8": "팔", "9": "구"}
LATIN_READ = {"A": "에이", "B": "비", "C": "씨", "D": "디", "E": "이", "F": "에프", "G": "지", "H": "에이치", "I": "아이", "J": "제이",
              "K": "케이", "L": "엘", "M": "엠", "N": "엔", "O": "오", "P": "피", "Q": "큐", "R": "알", "S": "에스", "T": "티",
              "U": "유", "V": "브이", "W": "더블유", "X": "엑스", "Y": "와이", "Z": "제트"}


def jong(word):
    """마지막 음절 받침: None(없음) / 'ㄹ' / 'other'."""
    w = word.strip()
    if not w:
        return None
    if w.endswith("%p"):
        return None  # 퍼센트포인트
    c = w[-1]
    if c == "%":
        return None  # 퍼센트
    if c.isdigit():
        c = DIGIT_READ[c][-1]
    elif c.upper() in LATIN_READ:
        c = LATIN_READ[c.upper()][-1]
    if "가" <= c <= "힣":
        j = (ord(c) - 0xAC00) % 28
        if j == 0:
            return None
        return "ㄹ" if j == 8 else "other"
    return None

# (받침형, 무받침형) — 긴 것부터 매칭
PARTICLES = [("이라고", "라고"), ("이라는", "라는"), ("이었", "였"), ("이랑", "랑"), ("이나", "나"), ("이란", "란"), ("이며", "며"),
             ("이고", "고"), ("이라", "라"), ("으로", "로"), ("은", "는"), ("이", "가"), ("을", "를"), ("과", "와")]


def split_particle(rest):
    """토큰 뒤 텍스트에서 조사(어느 형태든)를 찾아 (pair, 원문형) 반환."""
    cands = []
    for pair in PARTICLES:
        for form in pair:
            if rest.startswith(form):
                cands.append((len(form), pair, form))
    if not cands:
        return None, ""
    cands.sort(key=lambda x: -x[0])
    return cands[0][1], cands[0][2]


def particle_for(word, pair):
    j = jong(word)
    if pair == ("으로", "로"):
        return "으로" if j == "other" else "로"
    return pair[0] if j else pair[1]

# ---------------------------------------------------------------- 탐지

HANNUM = "[일이삼사오육칠팔구십백천만억조영]"
RE_MONEY = re.compile(
    r"(?<![\w.])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(?:조|억|만|천)?(?:\s*(?:조|억|만|천))?\s*(?:원|달러|불|엔|위안|유로|USD|KRW)"
    r"|(?<![\w.])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(?:조|억)(?![가-힣])"
    r"|\$\s?\d[\d,]*(?:\.\d+)?\s*(?:[BMK]|bn|억|조)?"
    r"|" + HANNUM + r"{2,}\s*(?:조|억)\s*(?:원|달러)?"
)
RE_PCT = re.compile(r"(?<![\w.])[+-]?\d+(?:\.\d+)?\s*(?:%p|%|퍼센트포인트|퍼센트|bp)")
RE_MULT = re.compile(r"(?<![\w.])\d+(?:\.\d+)?\s*배(?!당|송|치|분|너|열|포)")
RE_DATE = re.compile(r"(?<!\d)(?:19|20)\d{2}\s*년(?:\s*\d{1,2}\s*월)?")


def detect(text, extra_terms):
    """[(start, end, cat, real, source)] 반환. 겹치면 긴 것 우선."""
    hits = []

    def add(m, cat, src):
        s, e = m.span()
        real = text[s:e].strip()
        s = s + (len(text[s:e]) - len(text[s:e].lstrip()))
        hits.append((s, s + len(real), cat, real, src))

    for m in RE_MONEY.finditer(text):
        add(m, "money", "regex")
    for m in RE_PCT.finditer(text):
        add(m, "number", "regex")
    for m in RE_MULT.finditer(text):
        add(m, "number", "regex")
    for m in RE_DATE.finditer(text):
        add(m, "date", "regex")

    # 사전 (지역·회사·상품) + 프로젝트 추가 용어
    dict_terms = []
    for w in _load_list("regions.txt"):
        dict_terms.append((w, "region", "dict"))
    for w in _load_list("companies.txt"):
        dict_terms.append((w, "company", "dict"))
    for w, cat in extra_terms:
        dict_terms.append((w, cat, "project"))
    for w, cat, src in sorted(dict_terms, key=lambda x: -len(x[0])):
        pat = re.escape(w)
        if re.match(r"[A-Za-z]", w):
            pat = r"(?<![A-Za-z])" + pat + r"(?![A-Za-z])"
        else:
            pat = r"(?<![가-힣])" + pat  # 앞은 경계, 뒤는 조사 허용
        for m in re.finditer(pat, text):
            add(m, cat, src)

    # 회사 접미사 휴리스틱 (한글)
    suf = "|".join(sorted(COMPANY_SUFFIX, key=len, reverse=True))
    for m in re.finditer(r"(?<![가-힣])([가-힣A-Za-z]{1,8}?(?:" + suf + r"))(?=[은는이가을를의과와도로에\s,.)]|$)", text):
        stem = m.group(1)
        if len(stem) >= 3 and stem not in ("자산운용", "증권", "은행", "보험", "금융", "투자", "운용", "그룹"):
            add(m, "company", "heuristic")
    # 회사 접미사 (영문)
    esuf = "|".join(re.escape(s) for s in COMPANY_EN_SUFFIX)
    for m in re.finditer(r"(?:[A-Z][A-Za-z&]+\s){1,3}(?:" + esuf + r")", text):
        add(m, "company", "heuristic")
    # 인명 + 직함
    tit = "|".join(TITLES)
    for m in re.finditer(r"(?<![가-힣])([가-힣]{2,3})\s?(" + tit + r")(?![가-힣])", text):
        if m.group(1)[0] in SURNAMES:
            s, e = m.span()
            hits.append((s, e, "person", text[s:e], "heuristic"))
    # 직함 + 인명 ("대표이사 김도윤입니다")
    for m in re.finditer(r"(?<![가-힣])(" + tit + r")\s([가-힣]{2,3})(?=[이은는의을가께입,.\s]|$)", text):
        if m.group(2)[0] in SURNAMES:
            s, e = m.span()
            hits.append((s, e, "person", text[s:e], "heuristic"))

    # 겹침 제거: 긴 것 우선, 같은 길이면 source 우선순위
    prio = {"project": 0, "dict": 1, "regex": 2, "heuristic": 3}
    hits.sort(key=lambda h: (-(h[1] - h[0]), prio.get(h[4], 9), h[0]))
    taken, out = [], []
    for h in hits:
        if any(not (h[1] <= a or h[0] >= b) for a, b in taken):
            continue
        taken.append((h[0], h[1]))
        out.append(h)
    out.sort(key=lambda h: h[0])
    return out

# ---------------------------------------------------------------- 매핑표

def map_path(project):
    return os.path.join(project, "00-direction", "redaction_map.json")


def load_map(project):
    p = map_path(project)
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return {"version": 1, "confirmed": False, "tokens": []}


def save_map(project, m):
    os.makedirs(os.path.dirname(map_path(project)), exist_ok=True)
    m["updated"] = datetime.datetime.now().isoformat(timespec="seconds")
    with open(map_path(project), "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=2)
    ensure_gitignore(project)


def ensure_gitignore(project):
    p = os.path.join(project, ".gitignore")
    lines = []
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            lines = f.read().splitlines()
    need = ["00-direction/redaction_map.json", "00-direction/splice_plan.json", "00-intake/"]
    changed = False
    for n in need:
        if n not in lines:
            lines.append(n)
            changed = True
    if changed:
        with open(p, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")


def _norm(s):
    return re.sub(r"\s+", "", s)


def mask_for(cat, real, counters, defaults):
    if cat == "company":
        i = counters.setdefault("company", 0)
        counters["company"] += 1
        return (chr(ord("A") + i) if i < 26 else "Z%d" % (i - 25)) + "사"
    if cat == "money":
        if "달러" in real or "$" in real or "USD" in real:
            return defaults.get("money_usd", "99999달러")
        if "엔" in real:
            return "99999엔"
        if "유로" in real:
            return "99999유로"
        if "위안" in real:
            return "99999위안"
        return defaults.get("money", "99999원")
    if cat == "number":
        if "%p" in real or "포인트" in real:
            return "99%p"
        if "%" in real or "퍼센트" in real:
            return "99%"
        if "bp" in real:
            return "99bp"
        if "배" in real:
            return "9배"
        return "99999"
    if cat == "date":
        return "0000년 0월" if "월" in real else "0000년"
    label = {"region": "임시지역", "person": "담당자", "product": "상품", "project": "프로젝트"}.get(cat, "항목")
    counters[cat] = counters.get(cat, 0) + 1
    return "%s%d" % (label, counters[cat])


def project_config(project):
    p = os.path.join(project, "project.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return {}


def scan_files(project):
    """후보 추출용 정본 텍스트(중복 집계 방지): 섹션 beats.json이 있으면 그것만, 없으면 script_full.md."""
    files = [f for f in source_files(project) if f.endswith("beats.json")]
    if files:
        return files
    return [f for f in source_files(project) if f.endswith("script_full.md")]


def source_files(project):
    """마스킹 대상 텍스트 파일 목록 (project 상대경로)."""
    files = []
    full = os.path.join(project, "00-direction", "script_full.md")
    if os.path.exists(full):
        files.append("00-direction/script_full.md")
    sec = os.path.join(project, "sections")
    if os.path.isdir(sec):
        for d in sorted(os.listdir(sec)):
            for name in ("script.md", "beats.json"):
                if os.path.exists(os.path.join(sec, d, name)):
                    files.append("sections/%s/%s" % (d, name))
    return files


def file_texts(project, rel):
    """(위치키, 텍스트) 목록. beats.json은 비트별."""
    p = os.path.join(project, rel)
    if rel.endswith("beats.json"):
        with open(p, encoding="utf-8") as f:
            b = json.load(f)
        sec = b.get("section") or rel.split("/")[1]
        return [("%s.%s" % (sec, bt["id"]), bt.get("text", "")) for bt in b.get("beats", [])]
    return [(rel, read_any(p))]


def scan(project, inputs=None):
    m = load_map(project)
    cfg = project_config(project).get("redaction", {})
    extra = [(t, c) for c, ts in cfg.get("terms", {}).items() for t in ts]
    extra += [(t["real"], t["cat"]) for t in m["tokens"] if t.get("source") == "manual"]
    defaults = cfg.get("masks", {})
    allow_default = set(cfg.get("allow", []))
    by_real = {_norm(t["real"]): t for t in m["tokens"]}
    counters = {}
    for t in m["tokens"]:  # 기존 번호 이어가기
        if t["cat"] == "company":
            counters["company"] = counters.get("company", 0) + 1
        elif t["cat"] in ("region", "person", "product", "project"):
            counters[t["cat"]] = counters.get(t["cat"], 0) + 1
    for t in m["tokens"]:
        t["occurrences"] = []
    targets = []
    for rel in (inputs or scan_files(project)):
        if os.path.isabs(rel) or os.path.exists(rel):
            targets.append((os.path.basename(rel), read_any(rel)))
        else:
            targets.extend(file_texts(project, rel))
    for loc, text in targets:
        for s, e, cat, real, src in detect(text, extra):
            key = _norm(real)
            t = by_real.get(key)
            if not t:
                tid = "%s_%d" % (cat.upper(), sum(1 for x in m["tokens"] if x["cat"] == cat) + 1)
                t = {"id": tid, "cat": cat, "real": real, "mask": mask_for(cat, real, counters, defaults),
                     "allow": cat == "date" or real in allow_default, "spoken": True, "source": src, "occurrences": []}
                m["tokens"].append(t)
                by_real[key] = t
            t["occurrences"].append({"loc": loc, "start": s})
    for t in m["tokens"]:
        t["count"] = len(t["occurrences"])
    m["confirmed"] = False
    save_map(project, m)
    return m


def active_tokens(m):
    return [t for t in m["tokens"] if not t.get("allow") and t.get("real")]


def mask_text(text, m, eojeols=None):
    """실값 → 대체어. 조사는 대체어 받침에 맞춰 교정. eojeols 리스트에 스플라이스 정보 기록."""
    toks = sorted(active_tokens(m), key=lambda t: -len(t["real"]))
    if not toks:
        return text
    pat = "|".join(re.escape(t["real"]) for t in toks)
    lookup = {t["real"]: t for t in toks}
    out, i = [], 0
    for mt in re.finditer(pat, text):
        s, e = mt.span()
        if s < i:
            continue
        t = lookup[mt.group(0)]
        out.append(text[i:s])
        pair, form = split_particle(text[e:])
        if pair:
            new_p = particle_for(t["mask"], pair)
            out.append(t["mask"] + new_p)
            end = e + len(form)
            if eojeols is not None:
                eojeols.append({"id": t["id"], "real_eojeol": text[s:end], "mask_eojeol": t["mask"] + new_p})
        else:
            out.append(t["mask"])
            end = e
            if eojeols is not None:
                eojeols.append({"id": t["id"], "real_eojeol": text[s:e], "mask_eojeol": t["mask"]})
        i = end
    out.append(text[i:])
    return "".join(out)


def apply(project):
    m = load_map(project)
    written = []
    for rel in source_files(project):
        p = os.path.join(project, rel)
        if rel.endswith("beats.json"):
            with open(p, encoding="utf-8") as f:
                b = json.load(f)
            for bt in b.get("beats", []):
                ej = []
                bt["text_masked"] = mask_text(bt.get("text", ""), m, ej)
                bt["sensitive"] = [x["id"] for x in ej]
                bt["splice"] = ej
                if ej and bt.get("mode") == "avatar":
                    bt["mode"] = "slide"
                    bt["mode_forced"] = "민감 토큰 포함 → 인물에서 장표로 전환"
            outp = p.replace("beats.json", "beats_masked.json")
            with open(outp, "w", encoding="utf-8") as f:
                json.dump(b, f, ensure_ascii=False, indent=2)
        else:
            text = read_any(p)
            outp = re.sub(r"(script_full|script)\.md$", lambda x: ("script_masked" if x.group(1) == "script_full" else "script_masked") + ".md", p)
            with open(outp, "w", encoding="utf-8") as f:
                f.write(mask_text(text, m))
        written.append(os.path.relpath(outp, project))
    return written


def gate(text, m, fragments=None):
    """실값 잔존 검사. fragments(허용 어절 집합)와 정확히 같은 텍스트는 통과."""
    if fragments is not None and text.strip() in fragments:
        return []
    hits = []
    for t in active_tokens(m):
        if t["real"] in text or _norm(t["real"]) in _norm(text):
            hits.append(t)
    return hits


def splice_plan(project):
    m = load_map(project)
    plan = {"generated": datetime.datetime.now().isoformat(timespec="seconds"), "beats": []}
    sec = os.path.join(project, "sections")
    for d in sorted(os.listdir(sec)) if os.path.isdir(sec) else []:
        p = os.path.join(sec, d, "beats.json")
        if not os.path.exists(p):
            continue
        with open(p, encoding="utf-8") as f:
            b = json.load(f)
        for bt in b.get("beats", []):
            ej = []
            masked = mask_text(bt.get("text", ""), m, ej)
            spoken = [x for x in ej if next((t for t in m["tokens"] if t["id"] == x["id"]), {}).get("spoken", True)]
            if spoken:
                plan["beats"].append({"section": d, "beat": bt["id"], "text_masked": masked, "fragments": spoken})
    p = os.path.join(project, "00-direction", "splice_plan.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)
    return plan


def allowed_fragments(project):
    p = os.path.join(project, "00-direction", "splice_plan.json")
    if not os.path.exists(p):
        return set()
    with open(p, encoding="utf-8") as f:
        plan = json.load(f)
    return {fr["real_eojeol"].strip() for b in plan["beats"] for fr in b["fragments"]}


def report(m):
    lines = ["확정: %s" % ("예" if m.get("confirmed") else "아니오")]
    for cat, name in CATS.items():
        ts = [t for t in m["tokens"] if t["cat"] == cat]
        if not ts:
            continue
        lines.append("\n[%s] %d개" % (name, len(ts)))
        for t in ts:
            lines.append("  %-12s %-20s → %-12s %s x%d" % (t["id"], t["real"], t["mask"], "(노출허용)" if t.get("allow") else "", t.get("count", 0)))
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["scan", "apply", "add", "allow", "gate", "splice-plan", "report"])
    ap.add_argument("project")
    ap.add_argument("file", nargs="?")
    ap.add_argument("--input", nargs="*")
    ap.add_argument("--real")
    ap.add_argument("--cat", choices=list(CATS))
    ap.add_argument("--mask")
    ap.add_argument("--off", action="store_true")
    ap.add_argument("--fragments", action="store_true")
    a = ap.parse_args()
    P = os.path.abspath(a.project)

    if a.cmd == "scan":
        m = scan(P, a.input)
        print(report(m))
    elif a.cmd == "apply":
        for w in apply(P):
            print("written", w)
    elif a.cmd == "add":
        m = load_map(P)
        if not a.real or not a.cat:
            sys.exit("--real, --cat 필요")
        counters = {}
        for t in m["tokens"]:
            counters[t["cat"]] = counters.get(t["cat"], 0) + 1
        if a.cat == "company":
            counters["company"] = sum(1 for t in m["tokens"] if t["cat"] == "company")
        mask = a.mask or mask_for(a.cat, a.real, counters, {})
        tid = "%s_%d" % (a.cat.upper(), sum(1 for t in m["tokens"] if t["cat"] == a.cat) + 1)
        m["tokens"].append({"id": tid, "cat": a.cat, "real": a.real, "mask": mask, "allow": False, "spoken": True,
                            "source": "manual", "occurrences": [], "count": 0})
        m["confirmed"] = False
        save_map(P, m)
        print("added", tid, a.real, "→", mask)
    elif a.cmd == "allow":
        m = load_map(P)
        for t in m["tokens"]:
            if t["real"] == a.real:
                t["allow"] = not a.off
                print(t["id"], "allow =", t["allow"])
        save_map(P, m)
    elif a.cmd == "gate":
        m = load_map(P)
        text = sys.stdin.read() if (a.file in (None, "-")) else read_any(a.file)
        frags = allowed_fragments(P) if a.fragments else None
        hits = gate(text, m, frags)
        if hits:
            print("BLOCKED: 실값 %d종 발견 → %s" % (len(hits), ", ".join(t["id"] for t in hits)))
            sys.exit(1)
        print("CLEAN")
    elif a.cmd == "splice-plan":
        plan = splice_plan(P)
        print("splice 대상 비트 %d개, 조각 %d개" % (len(plan["beats"]), sum(len(b["fragments"]) for b in plan["beats"])))
    elif a.cmd == "report":
        print(report(load_map(P)))


if __name__ == "__main__":
    main()
