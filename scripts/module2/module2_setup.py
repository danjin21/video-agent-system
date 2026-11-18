#!/usr/bin/env python3
"""모듈2 환경 설정 — macOS·Windows 공용. 새 PC에서 저장소를 받은 뒤 이것 하나로 맞춘다.

  python module2_setup.py check                      # 무엇이 있고 없는지 점검 (아무것도 바꾸지 않음)
  python module2_setup.py install [--remotion DIR]   # 아래 전부를 순서대로 (이미 된 것은 건너뜀)
        [--prereqs]   빠진 기본 프로그램(git·node·ffmpeg)을 winget/brew로 설치
        [--no-fonts] [--no-skill]
  python module2_setup.py remotion [--remotion DIR]  # Remotion 루트 생성(없으면) + 3D 의존성
  python module2_setup.py fonts                      # Pretendard를 공용 폰트 폴더에 받기 (~47MB, GitHub)
  python module2_setup.py skill [--target DIR]       # 공용 스킬을 ~/.agents/skills 에 연결 (Codex 등)

Windows에서는 python3 대신 `py -3` 또는 `python`으로 실행한다.
API 키(ElevenLabs·HeyGen)는 이 스크립트가 다루지 않는다 — 사용자가 스튜디오 '계정' 화면에서 직접 넣는다.
"""
import argparse
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import m2env  # noqa: E402
from m2env import IS_WIN  # noqa: E402

m2env.fix_stdio()
HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN = os.path.dirname(os.path.dirname(HERE))
SKILL_NAME = "module2-strategy-video"
SKILL_SRC = os.path.join(PLUGIN, "skills", SKILL_NAME)
PRETENDARD_URL = "https://github.com/orioncactus/pretendard/releases/download/v1.3.9/Pretendard-1.3.9.zip"
PRETENDARD_WEIGHTS = ["Regular", "Medium", "SemiBold", "Bold", "ExtraBold", "Light"]
COPY_MARK = ".module2-skill-copy"

PREREQ = {  # 이름: (확인 명령, winget id, brew 이름)
    "git": ("git", "Git.Git", "git"),
    "node": ("node", "OpenJS.NodeJS.LTS", "node"),
    "ffmpeg": ("ffmpeg", "Gyan.FFmpeg", "ffmpeg"),
}


def say(*a):
    print(*a, flush=True)


# ------------------------------------------------------------------ check
def node_major():
    n = m2env.which("node")
    if not n:
        return None
    r = m2env.run([n, "-v"])
    m = re.match(r"v(\d+)", r.stdout.strip())
    return int(m.group(1)) if m else None


def pretendard_files():
    found = {}
    for d in m2env.font_dirs():
        if not os.path.isdir(d):
            continue
        for fn in os.listdir(d):
            m = re.match(r"^Pretendard-(\w+)\.(otf|ttf)$", fn, re.I)
            if m:
                found.setdefault(m.group(1).lower(), os.path.join(d, fn))
    return found


def skill_dest(target=None):
    return os.path.join(target or os.path.expanduser("~"), ".agents", "skills", SKILL_NAME)


def status():
    root = m2env.remotion_root()
    ws = os.path.join(root, "codex-workspace", "module2")
    nm = node_major()
    pf = pretendard_files()
    sd = skill_dest()
    rows = [
        ("Python 3.9+", sys.version_info >= (3, 9), sys.version.split()[0]),
        ("git", bool(m2env.which("git")), m2env.which("git") or "없음"),
        ("node 18+", bool(nm and nm >= 18), ("v%d" % nm) if nm else "없음"),
        ("npm", bool(m2env.which("npm")), m2env.which("npm") or "없음"),
        ("ffmpeg", bool(m2env.which("ffmpeg")), m2env.which("ffmpeg") or "없음"),
        ("Remotion 루트", os.path.isfile(os.path.join(root, "node_modules", "remotion", "package.json")), root),
        ("3D 의존성", os.path.isdir(os.path.join(ws, "node_modules", "@remotion", "three")), ws),
        ("Pretendard 500·600·700", all(w in pf for w in ("medium", "semibold", "bold")), ", ".join(sorted(pf)) or "없음"),
        ("공용 스킬(~/.agents/skills)", os.path.isfile(os.path.join(sd, "SKILL.md")), sd),
        ("계정 키 파일", os.path.isfile(m2env.SECRETS), m2env.SECRETS + " (값은 표시 안 함, 스튜디오에서 입력)"),
    ]
    return rows


def cmd_check(_a):
    say("모듈2 환경 점검 (%s)" % ("Windows" if IS_WIN else sys.platform))
    rows = status()
    for name, ok, info in rows:
        say(" %s %-26s %s" % ("OK " if ok else "-- ", name, info))
    missing = [n for n, ok, _ in rows if not ok]
    if missing:
        say("\n빠진 것: " + ", ".join(missing))
        say("→ python module2_setup.py install  (기본 프로그램까지 설치하려면 --prereqs)")
        if "계정 키 파일" in missing:
            say("→ 계정 키는 스튜디오 '계정' 화면에서 사용자가 직접 넣는다.")
    else:
        say("\n모두 준비됨.")
    return 0


# ------------------------------------------------------------------ prereqs
def install_prereqs():
    todo = [k for k, (exe, _, _) in PREREQ.items() if not m2env.which(exe)]
    if not todo:
        return True
    if IS_WIN:
        wg = m2env.which("winget")
        if not wg:
            say("winget이 없다. Microsoft Store의 '앱 설치 관리자'를 설치하거나 %s를 직접 설치하라." % ", ".join(todo))
            return False
        for k in todo:
            say("설치:", k)
            subprocess.call([wg, "install", "-e", "--id", PREREQ[k][1], "--accept-source-agreements", "--accept-package-agreements"])
        say("\n※ 새로 설치한 프로그램은 터미널(그리고 Codex)을 다시 열어야 PATH에 잡힌다. 다시 연 뒤 install을 한 번 더 실행하라.")
        return False
    brew = m2env.which("brew")
    if not brew:
        say("Homebrew가 없다. https://brew.sh 안내대로 설치한 뒤 다시 실행하라.")
        return False
    subprocess.call([brew, "install"] + [PREREQ[k][2] for k in todo])
    return all(m2env.which(PREREQ[k][0]) for k in todo)


# ------------------------------------------------------------------ remotion
def npm_install(cwd, pkgs, legacy=False):
    npm = m2env.which("npm")
    if not npm:
        raise SystemExit("npm이 없다 — node(LTS)를 먼저 설치하라 (install --prereqs)")
    cache = os.environ.get("NPM_CACHE") or os.path.join(tempfile.gettempdir(), "module2-npm-cache")
    cmd = [npm, "install", "--cache", cache, "--no-audit", "--no-fund"] + (["--legacy-peer-deps"] if legacy else []) + pkgs
    say("npm install (%s): %s" % (cwd, " ".join(pkgs)))
    r = subprocess.call(cmd, cwd=cwd)
    if r != 0:
        raise SystemExit("npm install 실패 (위 로그 확인)")


def ensure_remotion_root(root):
    if os.path.isfile(os.path.join(root, "node_modules", "remotion", "package.json")):
        return
    os.makedirs(root, exist_ok=True)
    pj = os.path.join(root, "package.json")
    if not os.path.exists(pj):
        with open(pj, "w", encoding="utf-8") as f:
            json.dump({"name": "remotion-root", "private": True}, f, indent=2)
    tj = os.path.join(root, "tsconfig.json")
    if not os.path.exists(tj):
        with open(tj, "w", encoding="utf-8") as f:
            json.dump({"compilerOptions": {"target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler", "jsx": "react-jsx",
                                           "strict": True, "skipLibCheck": True, "esModuleInterop": True}}, f, indent=2)
    npm_install(root, ["%s@%s" % kv for kv in m2env.PINS.items()])


def setup_three(root=None):
    """<root>/codex-workspace/module2 에만 3D·섹션 전환(@remotion/transitions) 의존성 설치. 공용 package.json 무변경(Remotion AGENTS.md 격리 규칙)."""
    root = root or m2env.remotion_root()
    rv_p = os.path.join(root, "node_modules", "remotion", "package.json")
    if not os.path.exists(rv_p):
        raise SystemExit("Remotion 루트에 remotion이 없다: %s → python module2_setup.py remotion" % root)
    with open(rv_p, encoding="utf-8") as f:
        rv = json.load(f)["version"]
    ws = os.path.join(root, "codex-workspace", "module2")
    os.makedirs(ws, exist_ok=True)
    pj = os.path.join(ws, "package.json")
    if not os.path.exists(pj):
        with open(pj, "w", encoding="utf-8") as f:
            json.dump({"name": "module2-workspace-deps", "private": True,
                       "description": "모듈2 전용 3D 의존성. 공용 package.json을 건드리지 않기 위해 이 폴더에만 설치.", "dependencies": {}},
                      f, ensure_ascii=False, indent=2)
    npm_install(ws, ["@remotion/three@%s" % rv, "@remotion/transitions@%s" % rv] + ["%s@%s" % kv for kv in m2env.THREE_PINS.items()], legacy=True)
    # @remotion/three가 끌고 오는 중복 사본 제거 (두 벌이면 3D 안에서 프레임 컨텍스트가 끊김)
    for n in ("remotion", "react", "react-dom"):
        shutil.rmtree(os.path.join(ws, "node_modules", n), ignore_errors=True)
    say("3D 준비됨: %s (remotion %s)" % (ws, rv))


def cmd_remotion(a):
    root = os.path.abspath(a.remotion) if a.remotion else m2env.remotion_root()
    ensure_remotion_root(root)
    m2env.save_conf(remotion_root=root)
    setup_three(root)
    say("Remotion 루트:", root, "(설정 저장:", m2env.CONF + ")")
    return 0


# ------------------------------------------------------------------ fonts
def cmd_fonts(_a):
    if all(w in pretendard_files() for w in ("medium", "semibold", "bold")):
        say("Pretendard 이미 있음.")
        return 0
    say("Pretendard 받는 중 (~47MB):", PRETENDARD_URL)
    with urllib.request.urlopen(PRETENDARD_URL, timeout=120) as r:
        data = r.read()
    os.makedirs(m2env.SHARED_FONTS, exist_ok=True)
    got = []
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        for w in PRETENDARD_WEIGHTS:
            fn = "Pretendard-%s.otf" % w
            cands = [n for n in names if n.endswith("/" + fn) or n == fn]
            cands.sort(key=lambda n: (0 if "static" in n.lower() else 1, len(n)))
            if cands:
                with open(os.path.join(m2env.SHARED_FONTS, fn), "wb") as f:
                    f.write(z.read(cands[0]))
                got.append(w)
    say("저장:", m2env.SHARED_FONTS, ", ".join(got))
    say("(스튜디오·렌더는 이 폴더를 바로 읽는다. 다른 프로그램에서도 쓰려면 파일을 더블클릭해 설치)")
    return 0 if got else 1


# ------------------------------------------------------------------ skill
def _is_link(p):
    if os.path.islink(p):
        return True
    isj = getattr(os.path, "isjunction", None)
    if isj and isj(p):
        return True
    if IS_WIN and os.path.isdir(p):
        try:
            os.readlink(p)
            return True
        except (OSError, ValueError):
            return False
    return False


def _remove(p):
    if _is_link(p):
        try:
            os.unlink(p)
        except (IsADirectoryError, PermissionError, OSError):
            os.rmdir(p)
    elif os.path.isdir(p) and os.path.exists(os.path.join(p, COPY_MARK)):
        shutil.rmtree(p)
    elif os.path.exists(p):
        raise SystemExit("이미 다른 폴더가 있다: %s — 직접 확인 후 지워라" % p)


def cmd_skill(a):
    dest = skill_dest(a.target)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    _remove(dest)
    how = None
    try:
        os.symlink(SKILL_SRC, dest, target_is_directory=True)
        how = "심볼릭 링크"
    except (OSError, NotImplementedError):
        if IS_WIN and subprocess.call(["cmd", "/c", "mklink", "/J", dest, SKILL_SRC], stdout=subprocess.DEVNULL) == 0:
            how = "정션(junction)"
    if not how:
        shutil.copytree(SKILL_SRC, dest)
        open(os.path.join(dest, COPY_MARK), "w").close()
        how = "복사 (git pull 후 이 명령을 다시 실행해야 갱신됨)"
    say("스킬 연결: %s -> %s [%s]" % (dest, SKILL_SRC, how))
    say("Codex에서 $%s 또는 /skills 로 부른다." % SKILL_NAME)
    return 0


# ------------------------------------------------------------------ install
def cmd_install(a):
    if a.prereqs and not install_prereqs():
        return 1
    miss = [k for k, (exe, _, _) in PREREQ.items() if not m2env.which(exe)]
    nm = node_major()
    if miss or not nm or nm < 18:
        say("기본 프로그램이 부족하다: %s%s" % (", ".join(miss), "" if (nm and nm >= 18) else " (node 18+ 필요)"))
        say("→ python module2_setup.py install --prereqs  또는 직접 설치 후 다시 실행")
        return 1
    cmd_remotion(a)
    if not a.no_fonts:
        cmd_fonts(a)
    if not a.no_skill:
        cmd_skill(argparse.Namespace(target=None))
    say("")
    return cmd_check(a)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd")
    sub.add_parser("check")
    p = sub.add_parser("install")
    p.add_argument("--remotion")
    p.add_argument("--prereqs", action="store_true")
    p.add_argument("--no-fonts", action="store_true")
    p.add_argument("--no-skill", action="store_true")
    p = sub.add_parser("remotion")
    p.add_argument("--remotion")
    sub.add_parser("fonts")
    p = sub.add_parser("skill")
    p.add_argument("--target")
    a = ap.parse_args()
    fn = {"check": cmd_check, "install": cmd_install, "remotion": cmd_remotion, "fonts": cmd_fonts, "skill": cmd_skill}.get(a.cmd or "check")
    sys.exit(fn(a) or 0)


if __name__ == "__main__":
    main()
