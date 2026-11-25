#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""모듈2 로컬 웹 스튜디오 서버 (표준 라이브러리만).

  studio_server.py <project> [--port 8765]

- 127.0.0.1에만 바인딩한다. 실데이터를 다루므로 외부 공개 금지.
- 정적 UI는 플러그인 templates/module2/studio/ 에서, 데이터는 <project>/ 에서 읽고 쓴다.
- API 키는 ~/.config/video-agents/secrets.env 에만 저장하고 응답으로 돌려주지 않는다.
"""
import argparse
import datetime
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import redact  # noqa: E402
import render_section  # noqa: E402
import direction_check  # noqa: E402

RENDERING = set()
RENDER_LOCK = threading.Lock()

PLUGIN = os.path.dirname(os.path.dirname(HERE))
STATIC = os.path.join(PLUGIN, "templates", "module2", "studio")
import m2env  # noqa: E402
m2env.fix_stdio()
SECRETS = m2env.SECRETS
REMOTION_ROOT = m2env.remotion_root()
P = None  # project root


def font_dirs():
    """폰트 검색 위치 (순서 = /fontfile/<i>/ 번호). 프로젝트 폰트가 우선."""
    return m2env.font_dirs(P, REMOTION_ROOT)

SECTION_JSON = {"layout", "timeline", "edits", "comments", "beats", "status"}
SECTION_TEXT = {"script": "script.md", "storyboard": "storyboard.md"}
SNAPSHOT_FILES = ["script.md", "beats.json", "storyboard.md", "layout.json", "timeline.json", "edits.json", "comments.json"]
WEIGHTS = {"thin": 100, "extralight": 200, "ultralight": 200, "light": 300, "regular": 400, "book": 400, "medium": 500,
           "semibold": 600, "demibold": 600, "bold": 700, "extrabold": 800, "ultrabold": 800, "black": 900, "heavy": 900}


def now():
    return datetime.datetime.now().isoformat(timespec="seconds")


def rjson(p, default=None):
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def wjson(p, obj):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, p)


def sec_dir(sid):
    if not re.match(r"^s\d{2,3}$", sid):
        raise ValueError("bad section id")
    return os.path.join(P, "sections", sid)


def safe_path(rel, root=None):
    root = os.path.realpath(root or P)
    full = os.path.realpath(os.path.join(root, rel))
    if not full.startswith(root + os.sep) and full != root:
        raise PermissionError(rel)
    return full

# ------------------------------------------------------------- secrets

def read_secrets():
    out = {}
    if os.path.exists(SECRETS):
        for line in open(SECRETS, encoding="utf-8"):
            m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*)$", line)
            if m and m.group(2).strip():
                out[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return out


def write_secret(key, value):
    os.makedirs(os.path.dirname(SECRETS), exist_ok=True)
    lines = open(SECRETS, encoding="utf-8").read().splitlines() if os.path.exists(SECRETS) else []
    done, out = False, []
    for line in lines:
        if re.match(r"^\s*%s\s*=" % key, line):
            if not done:
                out.append("%s=%s" % (key, value))
                done = True
            continue
        out.append(line)
    if not done:
        out.append("%s=%s" % (key, value))
    with open(SECRETS, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    os.chmod(SECRETS, 0o600)


def http_json(url, headers, method="GET", data=None, timeout=20):
    req = urllib.request.Request(url, headers=headers, method=method, data=data)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read()
            return r.status, json.loads(body.decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8") or "{}")
        except Exception:
            return e.code, {"error": str(e)}
    except Exception as e:  # 네트워크
        return 0, {"error": str(e)}


def err_msg(body):
    d = body.get("detail") if isinstance(body, dict) else None
    if isinstance(d, dict):
        return d.get("message") or d.get("status") or json.dumps(d, ensure_ascii=False)
    if isinstance(body, dict):
        e = body.get("error")
        if isinstance(e, dict):
            return e.get("message") or json.dumps(e, ensure_ascii=False)
        return e or body.get("message") or json.dumps(body, ensure_ascii=False)[:200]
    return str(body)[:200]

# ------------------------------------------------------------- project

def project_cfg():
    return rjson(os.path.join(P, "project.json"), {})


def save_project_cfg(cfg):
    wjson(os.path.join(P, "project.json"), cfg)


def queue_path():
    return os.path.join(P, "studio", "queue.json")


def load_queue():
    return rjson(queue_path(), {"requests": []})


def theme_path():
    return os.path.join(P, "design", "theme.json")


def load_theme():
    """프로젝트 디자인 키트. 없으면 플러그인 템플릿을 복사해 만든다."""
    tp = theme_path()
    if not os.path.exists(tp):
        os.makedirs(os.path.dirname(tp), exist_ok=True)
        shutil.copy2(os.path.join(PLUGIN, "templates", "module2", "theme.json"), tp)
    return rjson(tp, {})


def theme_usage():
    """어떤 양식·부품이 어느 섹션에 쓰였나 + 양식을 쓰지 않은(값 직접 지정) 글자 요소 수"""
    cfg = project_cfg()
    st, kinds, raw = {}, {}, {}
    for s_ in cfg.get("sections", []):
        sid = s_["id"]
        lay = rjson(os.path.join(sec_dir(sid), "layout.json"), {"elements": []}) or {"elements": []}
        for e in lay.get("elements", []):
            if e.get("style"):
                st.setdefault(e["style"], []).append(sid)
            elif e.get("type") == "text":
                raw[sid] = raw.get(sid, 0) + 1
            if e.get("type") == "diagram":
                kinds.setdefault(e.get("kind"), []).append(sid)
            elif e.get("type") in ("broll", "3d"):
                kinds.setdefault(e["type"], []).append(sid)
    uniq = lambda d: {k: sorted(set(v)) + [len(v)] for k, v in d.items()}  # noqa: E731  마지막 값 = 요소 수
    return {"styles": uniq(st), "kinds": uniq(kinds), "unstyled_text": raw}


def render_info(sid):
    d = sec_dir(sid)
    meta = rjson(os.path.join(d, "render", "render.json"), {}) or {}
    src_m = max([os.path.getmtime(os.path.join(d, f)) for f in ("layout.json", "timeline.json", "edits.json") if os.path.exists(os.path.join(d, f))] or [0])
    theme_m = os.path.getmtime(theme_path()) if os.path.exists(theme_path()) else 0
    th = None
    out = {}
    for k, v in meta.items():
        v = dict(v)
        fp = os.path.join(d, v["file"]) if v.get("file") else None
        if fp and os.path.exists(fp):
            v["url"] = "/files/sections/%s/%s?t=%d" % (sid, v["file"], int(os.path.getmtime(fp)))
            # 디자인 키트를 바꾸면 모든 섹션이 다시 렌더 대상 — 단 그림에 영향 없는 부분(섹션 전환 등)만 바뀌면 제외
            if v.get("theme_hash"):
                th = th or render_section.theme_hash(P, sid)
                kit_changed = v["theme_hash"] != th
            else:
                kit_changed = theme_m > os.path.getmtime(fp) + 1
            v["stale"] = src_m > os.path.getmtime(fp) + 1 or kit_changed
        out[k] = v
    if sid in RENDERING:
        out.setdefault("draft", {})["state"] = "running"
    return out


def start_render(sid, draft):
    with RENDER_LOCK:
        if sid in RENDERING:
            return False
        RENDERING.add(sid)

    def job():
        try:
            render_section.sync_workspace()
            render_section.render(P, sid, draft=draft, quiet=True)
        finally:
            RENDERING.discard(sid)
    threading.Thread(target=job, daemon=True).start()
    return True


# ------------------------------------------------------------- 전체 보기 (합본)
# 합본 = assemble.py 결과 final/master.mp4. 챕터 시작 = 앞 섹션 timeline.duration 합 (assemble.py와 같은 기준).
FULL_JOB = {"state": "idle"}
FULL_LOCK = threading.Lock()


def full_info():
    cfg = project_cfg()
    fps = cfg.get("fps", 30)
    master = os.path.join(P, "final", "master.mp4")
    draft = os.path.join(P, "final", "master_draft.mp4")
    src = master if os.path.exists(master) else (draft if os.path.exists(draft) else None)
    src_m = os.path.getmtime(src) if src else 0
    secs, at = [], 0
    # 섹션 전환으로 경계마다 겹친 만큼 합본 속 시작 위치가 당겨진다 → assemble.py가 남긴 실제 위치를 쓴다
    mj = rjson(os.path.splitext(src)[0] + ".json", {}) if src else {}
    m_start = {x["id"]: x["start"] for x in (mj or {}).get("sections", [])}
    for s in cfg.get("sections", []):
        sid = s["id"]
        d = sec_dir(sid)
        if not os.path.isdir(d):
            continue
        tl = rjson(os.path.join(d, "timeline.json"), {})
        dur = tl.get("duration", 0)
        ri = render_info(sid).get("final") or {}
        fp = os.path.join(d, "render", "%s.mp4" % sid)
        rendered = os.path.exists(fp)
        # 합본에 최신 내용이 안 들어간 이유: 섹션 최종 렌더가 없음 / 편집 후 렌더 안 함 / 렌더가 합본보다 새로움
        why = None
        if not rendered:
            why = "렌더 없음"
        elif ri.get("stale"):
            why = "편집 후 렌더 필요"
        elif src and os.path.getmtime(fp) > src_m + 1:
            why = "합본 이후 렌더됨"
        secs.append({"id": sid, "title": s.get("title", sid), "start": m_start.get(sid, at), "duration": dur, "changed": why})
        at += dur
    chk = direction_check.check(P)
    out = {"fps": fps, "total_frames": (mj or {}).get("total_frames", at), "transitions": (mj or {}).get("transitions", []), "sections": secs, "job": dict(FULL_JOB),
           "check": {"errors": chk["errors"], "warnings": chk["warnings"]}}
    if src:
        out["file"] = {"url": "/files/%s?t=%d" % (os.path.relpath(src, P).replace(os.sep, "/"), int(src_m)),
                       "name": os.path.relpath(src, P).replace(os.sep, "/"), "draft": src == draft,
                       "made": datetime.datetime.fromtimestamp(src_m).isoformat(timespec="seconds")}
    return out


def direction_payload():
    p = os.path.join(P, "00-direction", "direction.md")
    txt = open(p, encoding="utf-8").read() if os.path.exists(p) else ""
    st = (project_cfg().get("state") or {}).get("direction") or {}
    h = direction_check.direction_hash(P)
    return {"exists": bool(txt.strip()), "text": txt, "template": direction_check.TEMPLATE_MARK in txt, "hash": h,
            "approved": st, "approved_current": bool(st.get("approved_at")) and st.get("hash") == h,
            "check": direction_check.check(P)}


def approve_direction():
    d = direction_payload()
    if not d["exists"] or d["template"]:
        raise ValueError("연출안이 없거나 템플릿 그대로라 승인할 수 없습니다.")
    cfg = project_cfg()
    cfg.setdefault("state", {})["direction"] = {"approved_at": now(), "hash": d["hash"]}
    save_project_cfg(cfg)
    return cfg["state"]["direction"]


def start_full_build():
    """바뀐 섹션만 최종 렌더 → assemble.py 로 합본. 진행 상태는 FULL_JOB."""
    with FULL_LOCK:
        if FULL_JOB.get("state") == "running":
            return False
        FULL_JOB.clear()
        FULL_JOB.update({"state": "running", "started": now(), "step": "준비 중", "log": ""})

    def job():
        try:
            todo = [s["id"] for s in full_info()["sections"] if s["changed"] in ("렌더 없음", "편집 후 렌더 필요")]
            render_section.sync_workspace()
            for i, sid in enumerate(todo):
                FULL_JOB["step"] = "섹션 렌더 %s (%d/%d)" % (sid, i + 1, len(todo))
                ok, _ = render_section.render(P, sid, draft=False, quiet=True)
                if not ok:
                    meta = rjson(os.path.join(sec_dir(sid), "render", "render.json"), {}) or {}
                    raise RuntimeError("%s 렌더 실패: %s" % (sid, ((meta.get("final") or {}).get("log") or "")[-600:]))
            FULL_JOB["step"] = "합본 만드는 중"
            r = m2env.run([sys.executable, os.path.join(HERE, "assemble.py"), P])
            if r.returncode != 0:
                raise RuntimeError("assemble 실패: " + (r.stdout + r.stderr)[-800:])
            FULL_JOB.update({"state": "done", "step": "완료", "rendered": todo, "log": r.stdout.strip()[-300:]})
        except Exception as e:
            FULL_JOB.update({"state": "failed", "step": "실패", "log": str(e)})
        finally:
            FULL_JOB["finished"] = now()
    threading.Thread(target=job, daemon=True).start()
    return True


def section_summary(sid, title):
    d = sec_dir(sid)
    st = rjson(os.path.join(d, "status.json"), {"status": "draft", "version": 1, "locked": False})
    tl = rjson(os.path.join(d, "timeline.json"), {})
    cm = rjson(os.path.join(d, "comments.json"), {"comments": []})
    bm = rjson(os.path.join(d, "beats_masked.json"), None)
    beats = rjson(os.path.join(d, "beats.json"), {"beats": []})["beats"]
    open_c = [c for c in cm["comments"] if c.get("status", "open") == "open"]
    status = st.get("status", "draft")
    if st.get("locked"):
        status = "locked"
    elif st.get("scaffold") and status == "draft" and not open_c:
        status = "scaffold"
    elif status in ("draft", "revised") and open_c:
        status = "commented"
    modes = sorted({b.get("mode", "slide") for b in (bm or {"beats": beats})["beats"]})
    return {"id": sid, "title": title, "status": status, "version": st.get("version", 1), "locked": st.get("locked", False),
            "open_comments": len(open_c), "comments": len(cm["comments"]), "duration": tl.get("duration", 0),
            "fps": tl.get("fps", 30), "modes": modes,
            "sensitive": sum(len(b.get("sensitive", [])) for b in (bm or {"beats": []})["beats"]),
            "last_summary": st.get("last_summary", ""), "render": render_info(sid)}


def project_payload():
    cfg = project_cfg()
    secs = [section_summary(s["id"], s.get("title", s["id"])) for s in cfg.get("sections", []) if os.path.isdir(sec_dir(s["id"]))]
    m = redact.load_map(P)
    q = load_queue()
    vc = cfg.get("voice") or {}
    return {"project": {k: cfg.get(k) for k in ("title", "fps", "canvas", "target_minutes", "state", "module", "milestones")},
            "voice": {"provider": vc.get("provider"), "voice_set": bool(vc.get("voice_id")), "speed": vc.get("speed", "medium"), "gap": vc.get("gap", "medium")},
            "root": P, "sections": secs, "total_frames": sum(s["duration"] for s in secs),
            "redaction": {"confirmed": m.get("confirmed", False), "tokens": len(m.get("tokens", [])),
                          "active": len(redact.active_tokens(m))},
            "queue": [r for r in q["requests"] if r.get("status") != "done"]}


def section_payload(sid):
    d = sec_dir(sid)
    out = {"id": sid}
    for k in ("layout", "timeline", "edits", "comments", "beats", "status"):
        out[k] = rjson(os.path.join(d, k + ".json"), None)
    out["beats_masked"] = rjson(os.path.join(d, "beats_masked.json"), None)
    for k, fn in SECTION_TEXT.items():
        p = os.path.join(d, fn)
        out[k] = open(p, encoding="utf-8").read() if os.path.exists(p) else ""
    hist = os.path.join(d, "history")
    out["history"] = sorted([h for h in os.listdir(hist) if re.match(r"^v\d+$", h)], key=lambda x: int(x[1:])) if os.path.isdir(hist) else []
    words, audio = {}, []
    ad = os.path.join(d, "audio")
    if os.path.isdir(ad):
        for fn in sorted(os.listdir(ad)):
            m = re.match(r"^beat-(\d+)\.words\.json$", fn)
            if m:
                words["b" + m.group(1)] = rjson(os.path.join(ad, fn), [])
            m = re.match(r"^beat-(\d+)\.wav$", fn)
            if m:
                audio.append({"beat": "b" + m.group(1), "src": "sections/%s/audio/%s" % (sid, fn)})
    out["words"] = words
    out["render"] = render_info(sid)
    out["audio_files"] = audio
    return out


def snapshot(sid):
    d = sec_dir(sid)
    st = rjson(os.path.join(d, "status.json"), {"status": "draft", "version": 1, "locked": False})
    v = st.get("version", 1)
    hd = os.path.join(d, "history", "v%d" % v)
    os.makedirs(hd, exist_ok=True)
    for fn in SNAPSHOT_FILES:
        src = os.path.join(d, fn)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(hd, fn))
    return v


def list_fonts():
    fonts, seen = [], set()
    dirs = font_dirs()
    for root in dirs:
        if not os.path.isdir(root):
            continue
        for fn in sorted(os.listdir(root)):
            if not fn.lower().endswith((".otf", ".ttf", ".woff", ".woff2")):
                continue
            base = os.path.splitext(fn)[0]
            parts = re.split(r"[-_ ]", base)
            fam = parts[0]
            w = 400
            for p_ in parts[1:]:
                w = WEIGHTS.get(p_.lower().replace("italic", ""), w)
            key = (fam, w)
            if key in seen:
                continue
            seen.add(key)
            fonts.append({"family": fam, "weight": w, "file": fn, "dir": root, "url": "/fontfile/%d/%s" % (dirs.index(root), urllib.parse.quote(fn))})
    return fonts

# ------------------------------------------------------------- handler

class H(BaseHTTPRequestHandler):
    server_version = "Module2Studio/0.1"

    def log_message(self, fmt, *args):
        if "/api/" in self.path and self.command != "GET":
            sys.stderr.write("[studio] %s %s\n" % (self.command, self.path))

    # -- utils
    def send_json(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b)

    def body_bytes(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def body_json(self):
        b = self.body_bytes()
        return json.loads(b.decode("utf-8")) if b else {}

    def send_file(self, full):
        if not os.path.isfile(full):
            return self.send_json({"error": "not found"}, 404)
        size = os.path.getsize(full)
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if full.endswith(".js"):
            ctype = "text/javascript; charset=utf-8"
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)", rng)
            if m:
                if m.group(1):
                    start = int(m.group(1))
                    if m.group(2):
                        end = min(int(m.group(2)), size - 1)
                elif m.group(2):
                    start = max(0, size - int(m.group(2)))
            self.send_response(206)
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        else:
            self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        with open(full, "rb") as f:
            f.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
                remaining -= len(chunk)

    def route(self):
        u = urllib.parse.urlparse(self.path)
        return u.path, urllib.parse.parse_qs(u.query)

    # -- GET
    def do_GET(self):
        try:
            path, q = self.route()
            if path in ("/", "/index.html"):
                return self.send_file(os.path.join(STATIC, "index.html"))
            if path.startswith("/static/"):
                return self.send_file(safe_path(path[len("/static/"):], STATIC))
            if path.startswith("/files/"):
                return self.send_file(safe_path(urllib.parse.unquote(path[len("/files/"):])))
            m = re.match(r"^/fontfile/(\d)/(.+)$", path)
            if m:
                root = font_dirs()[int(m.group(1))]
                return self.send_file(safe_path(urllib.parse.unquote(m.group(2)), root))
            if path == "/api/project":
                return self.send_json(project_payload())
            if path == "/api/full":
                return self.send_json(full_info())
            if path == "/api/direction":
                return self.send_json(direction_payload())
            if path == "/api/theme":
                return self.send_json({"theme": load_theme(), "usage": theme_usage()})
            m = re.match(r"^/api/section/(s\d+)$", path)
            if m:
                return self.send_json(section_payload(m.group(1)))
            m = re.match(r"^/api/section/(s\d+)/history/(v\d+)$", path)
            if m:
                hd = os.path.join(sec_dir(m.group(1)), "history", m.group(2))
                return self.send_json({fn.split(".")[0]: (rjson(os.path.join(hd, fn)) if fn.endswith(".json") else open(os.path.join(hd, fn), encoding="utf-8").read())
                                       for fn in os.listdir(hd)})
            if path == "/api/fonts":
                return self.send_json(list_fonts())
            if path == "/api/redaction":
                m_ = redact.load_map(P)
                full = os.path.join(P, "00-direction", "script_full.md")
                text = open(full, encoding="utf-8").read() if os.path.exists(full) else ""
                return self.send_json({"map": m_, "script": text, "masked": redact.mask_text(text, m_), "cats": redact.CATS})
            if path == "/api/accounts":
                s = read_secrets()
                cfg = project_cfg()
                return self.send_json({
                    # 음성 보이스는 프로젝트에 하나(voice.provider로 어느 서비스 것인지 구분). 각 카드에는 자기 서비스 것만 보인다
                    "heygen": {"key_set": bool(s.get("HEYGEN_API_KEY")), "avatar_id": cfg.get("avatar", {}).get("avatar_id") or s.get("HEYGEN_AVATAR_ID", ""),
                               "voice_id": (cfg.get("voice") or {}).get("voice_id", "") if (cfg.get("voice") or {}).get("provider") == "heygen" else ""},
                    "elevenlabs": {"key_set": bool(s.get("ELEVENLABS_API_KEY")),
                                   "voice_id": (cfg.get("voice") or {}).get("voice_id", "") if (cfg.get("voice") or {}).get("provider") in (None, "elevenlabs") else ""},
                    "envato": {"key_set": bool(s.get("ENVATO_API_TOKEN"))},
                    "voice_provider": (cfg.get("voice") or {}).get("provider")})
            if path == "/api/voice-samples":
                vd = os.path.join(P, "global_assets", "voice_samples")
                out = []
                for fn in sorted(os.listdir(vd)) if os.path.isdir(vd) else []:
                    if fn.endswith(".wav"):
                        out.append({"name": fn, "src": "global_assets/voice_samples/" + fn, "sec": wav_seconds(os.path.join(vd, fn))})
                return self.send_json(out)
            if path == "/api/queue":
                return self.send_json(load_queue())
            return self.send_json({"error": "not found"}, 404)
        except PermissionError:
            return self.send_json({"error": "forbidden"}, 403)
        except Exception as e:
            return self.send_json({"error": str(e)}, 500)

    # -- PUT
    def do_PUT(self):
        try:
            path, q = self.route()
            m = re.match(r"^/api/section/(s\d+)/(\w+)$", path)
            if m:
                sid, name = m.group(1), m.group(2)
                d = sec_dir(sid)
                st = rjson(os.path.join(d, "status.json"), {})
                if st.get("locked") and name != "comments":
                    return self.send_json({"error": "잠긴 섹션입니다. 잠금을 풀고 수정하세요."}, 409)
                if name in SECTION_TEXT:
                    with open(os.path.join(d, SECTION_TEXT[name]), "w", encoding="utf-8") as f:
                        f.write(self.body_bytes().decode("utf-8"))
                elif name in ("edits", "comments", "layout", "timeline"):
                    obj = self.body_json()
                    if name == "edits":
                        obj["updated"] = now()
                    wjson(os.path.join(d, name + ".json"), obj)
                else:
                    return self.send_json({"error": "bad target"}, 400)
                return self.send_json({"ok": True, "saved": now()})
            if path == "/api/theme":
                body = self.body_json()
                if not isinstance(body, dict) or "styles" not in body or "colors" not in body:
                    return self.send_json({"error": "theme 형식이 아닙니다"}, 400)
                body["version"] = int(body.get("version", 1)) + 1
                wjson(theme_path(), body)
                return self.send_json({"ok": True, "version": body["version"], "saved": now()})
            if path == "/api/redaction":
                body = self.body_json()
                m_ = redact.load_map(P)
                by_id = {t["id"]: t for t in m_["tokens"]}
                for t in body.get("tokens", []):
                    if t["id"] in by_id:
                        for k in ("mask", "allow", "spoken", "cat"):
                            if k in t:
                                by_id[t["id"]][k] = t[k]
                if body.get("delete"):
                    m_["tokens"] = [t for t in m_["tokens"] if t["id"] not in set(body["delete"])]
                m_["confirmed"] = False
                redact.save_map(P, m_)
                return self.send_json({"ok": True})
            return self.send_json({"error": "not found"}, 404)
        except Exception as e:
            return self.send_json({"error": str(e)}, 500)

    # -- POST
    def do_POST(self):
        try:
            path, q = self.route()
            if path == "/api/direction/approve":
                try:
                    return self.send_json({"ok": True, "direction": approve_direction()})
                except ValueError as e:
                    return self.send_json({"error": str(e)}, 400)
            if path == "/api/voice/settings":
                bb = self.body_json()
                cfg = project_cfg()
                v = cfg.setdefault("voice", {})
                for k in ("speed", "gap"):
                    if k in bb and bb[k] in ("slow", "medium", "fast", "short", "long") or (k in bb and isinstance(bb[k], (int, float))):
                        v[k] = bb[k]
                save_project_cfg(cfg)
                return self.send_json({"ok": True, "voice": {k: v.get(k) for k in ("speed", "gap")}})
            if path == "/api/full/build":
                ok = start_full_build()
                return self.send_json({"ok": ok, "error": None if ok else "이미 합본을 만드는 중입니다."}, 200 if ok else 409)
            m = re.match(r"^/api/section/(s\d+)/render$", path)
            if m:
                b = self.body_json()
                ok = start_render(m.group(1), bool(b.get("draft", True)))
                return self.send_json({"ok": ok, "error": None if ok else "이미 렌더 중입니다."}, 200 if ok else 409)
            m = re.match(r"^/api/section/(s\d+)/(request|lock|restore|upload)$", path)
            if m:
                return self.section_action(m.group(1), m.group(2), q)
            if path == "/api/redaction/add":
                b = self.body_json()
                m_ = redact.load_map(P)
                cat = b.get("cat", "company")
                counters = {}
                for t in m_["tokens"]:
                    counters[t["cat"]] = counters.get(t["cat"], 0) + 1
                counters["company"] = sum(1 for t in m_["tokens"] if t["cat"] == "company")
                tid = "%s_%d" % (cat.upper(), sum(1 for t in m_["tokens"] if t["cat"] == cat) + 1)
                m_["tokens"].append({"id": tid, "cat": cat, "real": b["real"].strip(), "mask": b.get("mask") or redact.mask_for(cat, b["real"], counters, {}),
                                     "allow": False, "spoken": True, "source": "manual", "occurrences": [], "count": 0})
                m_["confirmed"] = False
                redact.save_map(P, m_)
                redact.scan(P)
                return self.send_json({"ok": True, "id": tid})
            if path == "/api/redaction/rescan":
                redact.scan(P)
                return self.send_json({"ok": True})
            if path == "/api/redaction/confirm":
                written = redact.apply(P)
                plan = redact.splice_plan(P)
                m_ = redact.load_map(P)
                m_["confirmed"] = True
                m_["confirmed_at"] = now()
                redact.save_map(P, m_)
                cfg = project_cfg()
                cfg.setdefault("state", {})["redaction_confirmed"] = m_["confirmed_at"]
                save_project_cfg(cfg)
                return self.send_json({"ok": True, "written": written, "splice_beats": len(plan["beats"])})
            if path == "/api/accounts/heygen":
                b = self.body_json()
                if b.get("api_key"):
                    write_secret("HEYGEN_API_KEY", b["api_key"].strip())
                if "avatar_id" in b:
                    cfg = project_cfg()
                    cfg.setdefault("avatar", {})["avatar_id"] = b["avatar_id"].strip()
                    save_project_cfg(cfg)
                if b.get("voice_id", "").strip():
                    # HeyGen 보이스로 음성을 만든다 (tts_heygen.py)
                    cfg = project_cfg()
                    cfg.setdefault("voice", {}).update({"provider": "heygen", "voice_id": b["voice_id"].strip()})
                    save_project_cfg(cfg)
                return self.send_json({"ok": True})
            if path == "/api/accounts/elevenlabs":
                b = self.body_json()
                if b.get("api_key"):
                    write_secret("ELEVENLABS_API_KEY", b["api_key"].strip())
                if b.get("voice_id", "").strip():
                    cfg = project_cfg()
                    cfg.setdefault("voice", {}).update({"provider": "elevenlabs", "voice_id": b["voice_id"].strip()})
                    save_project_cfg(cfg)
                return self.send_json({"ok": True})
            if path == "/api/accounts/envato":
                b = self.body_json()
                if b.get("api_key"):
                    write_secret("ENVATO_API_TOKEN", b["api_key"].strip())   # 값은 출력·로그하지 않는다
                return self.send_json({"ok": True})
            if path == "/api/accounts/envato/test":
                return self.send_json(test_envato())
            if path == "/api/accounts/heygen/test":
                return self.send_json(test_heygen())
            if path == "/api/accounts/elevenlabs/test":
                return self.send_json(test_elevenlabs())
            if path == "/api/voice-sample":
                return self.send_json(save_voice_sample(self.body_bytes(), q))
            if path == "/api/voice-sample/delete":
                b = self.body_json()
                fp = safe_path(os.path.join("global_assets", "voice_samples", os.path.basename(b["name"])))
                if os.path.exists(fp):
                    os.remove(fp)
                return self.send_json({"ok": True})
            if path == "/api/elevenlabs/clone":
                return self.send_json(clone_voice(self.body_json()))
            return self.send_json({"error": "not found"}, 404)
        except PermissionError:
            return self.send_json({"error": "forbidden"}, 403)
        except Exception as e:
            return self.send_json({"error": str(e)}, 500)

    def section_action(self, sid, action, q):
        d = sec_dir(sid)
        stp = os.path.join(d, "status.json")
        st = rjson(stp, {"status": "draft", "version": 1, "locked": False})
        if action == "lock":
            b = self.body_json()
            st["locked"] = bool(b.get("locked"))
            if st["locked"]:
                st["status"] = "locked"
            elif st.get("status") == "locked":
                st["status"] = "draft"
            wjson(stp, st)
            return self.send_json({"ok": True, "status": st})
        if action == "upload":
            name = os.path.basename((q.get("name") or ["file.bin"])[0])
            name = re.sub(r"[^\w.\-가-힣]", "_", name)
            dst = os.path.join(d, "attachments", "%s_%s" % (datetime.datetime.now().strftime("%m%d%H%M%S"), name))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, "wb") as f:
                f.write(self.body_bytes())
            return self.send_json({"ok": True, "path": os.path.relpath(dst, d), "url": "/files/" + os.path.relpath(dst, P)})
        if st.get("locked"):
            return self.send_json({"error": "잠긴 섹션입니다."}, 409)
        if action == "voicebeat":
            # 비트별 속도·뒤 텀 (스튜디오 대본 탭). 값이 null이면 프로젝트 기본값을 따른다
            bb = self.body_json()
            bp = os.path.join(d, "beats.json")
            bj = rjson(bp, {"beats": []})
            for x in bj["beats"]:
                if x["id"] == bb.get("beat"):
                    for k in ("speed", "gap_after"):
                        if k in bb:
                            if bb[k] in (None, ""):
                                x.pop(k, None)
                            else:
                                x[k] = bb[k]
            wjson(bp, bj)
            return self.send_json({"ok": True})
        if action == "retime":
            # 음성은 그대로, 텀·속도 설정을 타임라인에 반영 (외부 호출 없음)
            import tts_heygen
            dur, n = tts_heygen.retime(P, sid, project_cfg())
            return self.send_json({"ok": True, "duration": dur, "voiced": n})
        if action == "request":
            b = self.body_json()
            cm = rjson(os.path.join(d, "comments.json"), {"comments": []})
            open_ids = [c["id"] for c in cm["comments"] if c.get("status", "open") == "open"]
            ed = rjson(os.path.join(d, "edits.json"), {"elements": {}})
            if not open_ids and not ed.get("elements"):
                return self.send_json({"error": "열린 코멘트나 편집값이 없습니다."}, 400)
            v = snapshot(sid)
            qd = load_queue()
            for r in qd["requests"]:
                if r["section"] == sid and r.get("status") == "pending":
                    r["status"] = "superseded"
            rid = "r%d" % (len(qd["requests"]) + 1)
            qd["requests"].append({"id": rid, "section": sid, "snapshot": "v%d" % v, "comment_ids": open_ids,
                                   "has_edits": bool(ed.get("elements")), "note": b.get("note", ""), "requested_at": now(), "status": "pending"})
            wjson(queue_path(), qd)
            st["status"] = "revision_requested"
            st["requested_at"] = now()
            wjson(stp, st)
            return self.send_json({"ok": True, "request": rid, "snapshot": "v%d" % v})
        if action == "restore":
            b = self.body_json()
            hd = os.path.join(d, "history", b["version"])
            if not os.path.isdir(hd):
                return self.send_json({"error": "no such version"}, 404)
            snapshot(sid)
            for fn in os.listdir(hd):
                shutil.copy2(os.path.join(hd, fn), os.path.join(d, fn))
            st["version"] = st.get("version", 1) + 1
            st["status"] = "draft"
            st["last_summary"] = "%s로 되돌림" % b["version"]
            wjson(stp, st)
            return self.send_json({"ok": True})
        return self.send_json({"error": "bad action"}, 400)

# ------------------------------------------------------------- 외부 계정

def test_heygen():
    s = read_secrets()
    key = s.get("HEYGEN_API_KEY")
    if not key:
        return {"ok": False, "checks": [{"name": "API 키", "ok": False, "msg": "키가 없습니다."}]}
    h = {"X-API-KEY": key, "Accept": "application/json"}
    checks = []
    code, body = http_json("https://api.heygen.com/v2/user/remaining_quota", h)
    if code == 200:
        d = body.get("data", {})
        rq = d.get("remaining_quota")
        msg = "잔여 %s" % (rq if rq is not None else json.dumps(d, ensure_ascii=False)[:120])
        if isinstance(rq, (int, float)):
            # HeyGen 원값을 그대로 보여준다. 문서상 60으로 나누면 크레딧 수. 단위 해석은 요금제마다 달라 원값을 우선한다.
            msg = "API 잔여 quota %s (HeyGen 원값, 60으로 나누면 약 %.1f 크레딧)" % (rq, rq / 60.0)
            if rq < 600:
                msg += " · 부족할 수 있음: 아바타 생성 전에 충전 여부를 확인하세요"
        checks.append({"name": "크레딧", "ok": True, "msg": msg, "raw": d})
    else:
        checks.append({"name": "키·크레딧", "ok": False, "msg": "HTTP %s %s" % (code, err_msg(body))})
    aid = project_cfg().get("avatar", {}).get("avatar_id") or s.get("HEYGEN_AVATAR_ID")
    avatar = None
    if aid:
        code, body = http_json("https://api.heygen.com/v3/avatars/looks/%s" % urllib.parse.quote(aid), h)
        if code == 200:
            d = body.get("data", body)
            eng = d.get("supported_api_engines") or []
            avatar = {"name": d.get("name") or d.get("avatar_name"), "preview": d.get("preview_image_url") or d.get("image_url") or d.get("thumbnail_url"),
                      "engines": eng}
            checks.append({"name": "아바타", "ok": True, "msg": "%s · 엔진 %s · Avatar V %s" % (avatar["name"] or aid, ", ".join(eng) or "-", "지원" if "avatar_v" in eng else "미지원")})
        else:
            checks.append({"name": "아바타", "ok": False, "msg": "HTTP %s %s" % (code, err_msg(body))})
    else:
        checks.append({"name": "아바타", "ok": False, "msg": "avatar_id가 없습니다."})
    v = project_cfg().get("voice") or {}
    if v.get("provider") == "heygen" and v.get("voice_id"):
        code, body = http_json("https://api.heygen.com/v3/models/audio/voices/%s" % urllib.parse.quote(v["voice_id"]), h)
        if code == 200:
            d = body.get("data", body)
            mode = d.get("mode") or d.get("type")
            note = "말 속도는 HeyGen speed(0.75~1.25), 모델 heygen-voice-1(유료)" if mode == "professional" else "말 속도는 이 PC에서 맞춤, 모델 Turbo Free(2026-11-30까지 무료)"
            checks.append({"name": "음성 보이스", "ok": d.get("status") in (None, "ACTIVE"),
                           "msg": "%s · %s · %s · %s" % (d.get("name") or v["voice_id"][:8], mode or "-", d.get("status") or "-", note), "voice_mode": mode})
        else:
            checks.append({"name": "음성 보이스", "ok": False, "msg": "HTTP %s %s" % (code, err_msg(body))})
    else:
        checks.append({"name": "음성 보이스", "ok": False, "msg": "HeyGen voice_id가 없습니다 (음성을 HeyGen으로 만들 때 필요)."})
    return {"ok": all(c["ok"] for c in checks if c["name"] != "아바타" or aid), "checks": checks, "avatar": avatar, "tested": now()}


def test_envato():
    """Envato 개인 토큰 확인 (Market API). 토큰 값은 응답·로그에 넣지 않는다."""
    import urllib.request
    key = read_secrets().get("ENVATO_API_TOKEN")
    if not key:
        return {"ok": False, "checks": [{"name": "키", "ok": False, "msg": "Envato 개인 토큰이 없습니다 (build.envato.com → Create a token)"}]}
    checks = []
    for name, url in (("계정", "https://api.envato.com/v1/market/private/user/username.json"),
                      ("검색", "https://api.envato.com/v1/discovery/search/search/item?term=business&page_size=1")):
        try:
            rq = urllib.request.Request(url, headers={"Authorization": "Bearer " + key, "User-Agent": "module2-studio"})
            with urllib.request.urlopen(rq, timeout=20) as r:
                d = json.loads(r.read().decode("utf-8"))
            checks.append({"name": name, "ok": True, "msg": ("사용자 " + d.get("username", "")) if "username" in d else "검색 가능 (%s건)" % d.get("total_hits", "?")})
        except Exception as e:  # noqa: BLE001
            checks.append({"name": name, "ok": False, "msg": str(e)[:200]})
    return {"ok": all(c["ok"] for c in checks), "checks": checks}


def test_elevenlabs():
    s = read_secrets()
    key = s.get("ELEVENLABS_API_KEY")
    if not key:
        return {"ok": False, "checks": [{"name": "API 키", "ok": False, "msg": "키가 없습니다."}]}
    h = {"xi-api-key": key, "Accept": "application/json"}
    base = "https://api.elevenlabs.io"
    checks = []
    code, body = http_json(base + "/v1/user/subscription", h)
    if code == 200:
        used, lim = body.get("character_count", 0), body.get("character_limit", 0)
        checks.append({"name": "구독·사용량 (user_read)", "ok": True,
                       "msg": "%s 플랜 · %s / %s자 사용 · 보이스 클론 %s" % (body.get("tier"), format(used, ","), format(lim, ","),
                                                                    "가능" if body.get("can_use_instant_voice_cloning") else "불가/미확인")})
    else:
        checks.append({"name": "구독·사용량 (user_read)", "ok": False, "msg": "HTTP %s %s" % (code, err_msg(body))})
    code, body = http_json(base + "/v1/voices", h)
    if code == 200:
        vs = body.get("voices", [])
        cloned = [v for v in vs if v.get("category") in ("cloned", "professional")]
        checks.append({"name": "보이스 조회 (voices_read)", "ok": True, "msg": "보이스 %d개 · 내 클론 %d개" % (len(vs), len(cloned)),
                       "voices": [{"id": v["voice_id"], "name": v.get("name"), "category": v.get("category")} for v in cloned[:20]]})
    else:
        checks.append({"name": "보이스 조회 (voices_read)", "ok": False, "msg": "HTTP %s %s" % (code, err_msg(body))})
    vid = project_cfg().get("voice", {}).get("voice_id")
    if vid:
        code, body = http_json(base + "/v1/voices/%s" % urllib.parse.quote(vid), h)
        checks.append({"name": "선택한 보이스", "ok": code == 200,
                       "msg": (body.get("name", "") + " · " + str(body.get("category", ""))) if code == 200 else "HTTP %s %s" % (code, err_msg(body))})
    return {"ok": all(c["ok"] for c in checks), "checks": checks, "tested": now()}


def wav_seconds(p):
    try:
        import wave
        with wave.open(p) as w:
            return round(w.getnframes() / float(w.getframerate()), 1)
    except Exception:
        return 0


def save_voice_sample(data, q):
    vd = os.path.join(P, "global_assets", "voice_samples")
    os.makedirs(vd, exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    ext = (q.get("ext") or ["webm"])[0]
    raw = os.path.join(vd, "_raw_%s.%s" % (stamp, re.sub(r"\W", "", ext)))
    with open(raw, "wb") as f:
        f.write(data)
    wav = os.path.join(vd, "sample_%s.wav" % stamp)
    r = m2env.run([m2env.which("ffmpeg") or "ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-ac", "1", "-ar", "44100", wav])
    os.remove(raw)
    if r.returncode != 0:
        return {"ok": False, "error": r.stderr[-300:]}
    return {"ok": True, "name": os.path.basename(wav), "sec": wav_seconds(wav)}


def clone_voice(b):
    """ElevenLabs Instant Voice Clone. 스튜디오에서 사용자가 확인창을 승인했을 때만 호출된다."""
    key = read_secrets().get("ELEVENLABS_API_KEY")
    if not key:
        return {"ok": False, "error": "ElevenLabs 키가 없습니다."}
    names = b.get("samples") or []
    if not names:
        return {"ok": False, "error": "샘플을 선택하세요."}
    boundary = uuid.uuid4().hex
    parts = []

    def field(n, v):
        parts.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (boundary, n, v)).encode("utf-8"))

    field("name", b.get("name") or "module2-voice")
    field("description", "module2 studio clone")
    field("remove_background_noise", "true" if b.get("denoise") else "false")
    for n in names:
        fp = safe_path(os.path.join("global_assets", "voice_samples", os.path.basename(n)))
        parts.append(("--%s\r\nContent-Disposition: form-data; name=\"files\"; filename=\"%s\"\r\nContent-Type: audio/wav\r\n\r\n" % (boundary, os.path.basename(fp))).encode("utf-8"))
        parts.append(open(fp, "rb").read() + b"\r\n")
    parts.append(("--%s--\r\n" % boundary).encode("utf-8"))
    code, body = http_json("https://api.elevenlabs.io/v1/voices/add",
                           {"xi-api-key": key, "Content-Type": "multipart/form-data; boundary=%s" % boundary},
                           method="POST", data=b"".join(parts), timeout=120)
    if code == 200 and body.get("voice_id"):
        cfg = project_cfg()
        cfg.setdefault("voice", {}).update({"provider": "elevenlabs", "voice_id": body["voice_id"]})
        save_project_cfg(cfg)
        return {"ok": True, "voice_id": body["voice_id"], "requires_verification": body.get("requires_verification")}
    return {"ok": False, "error": "HTTP %s %s" % (code, err_msg(body))}


def main():
    global P
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--port", type=int, default=0)
    a = ap.parse_args()
    P = os.path.realpath(a.project)
    if not os.path.exists(os.path.join(P, "project.json")):
        sys.exit("project.json 없음 — 먼저 module2_init.py 실행")
    port = a.port or project_cfg().get("studio", {}).get("port", 8765)
    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    print("모듈2 스튜디오: http://127.0.0.1:%d  (project %s)" % (port, P), flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
