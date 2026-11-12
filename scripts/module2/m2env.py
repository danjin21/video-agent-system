"""모듈2 공통 환경 — macOS·Windows 공용.

- Remotion 루트: 환경변수 REMOTION_PROJECT_ROOT → ~/.config/video-agents/module2.json 의 remotion_root → 기본값
- 폰트 폴더: 프로젝트 → 공용(~/.config/video-agents/fonts) → OS 폰트 폴더 → Remotion public/fonts
- 외부 명령(node·npm·ffmpeg) 찾기, UTF-8 고정 실행
"""
import json
import os
import shutil
import subprocess
import sys

IS_WIN = os.name == "nt"
CONF_DIR = os.path.join(os.path.expanduser("~"), ".config", "video-agents")
CONF = os.path.join(CONF_DIR, "module2.json")
SECRETS = os.path.join(CONF_DIR, "secrets.env")
SHARED_FONTS = os.path.join(CONF_DIR, "fonts")

# Remotion·3D 버전 고정 (검증된 조합. TypeScript 7은 Remotion 번들러가 깨지므로 5.x)
PINS = {
    "remotion": "4.0.475", "@remotion/cli": "4.0.475", "@remotion/renderer": "4.0.475",
    "react": "19.2.7", "react-dom": "19.2.7", "typescript": "5.9", "@types/react": "19",
}
THREE_PINS = {"three": "0.180.0", "@react-three/fiber": "9", "@types/three": "0.180.0"}  # @remotion/three는 remotion 버전에 맞춤


def fix_stdio():
    """Windows 콘솔·파이프(cp949)에서도 한글·기호 출력이 깨지지 않게."""
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def load_conf():
    try:
        with open(CONF, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_conf(**kw):
    c = load_conf()
    c.update(kw)
    os.makedirs(CONF_DIR, exist_ok=True)
    with open(CONF, "w", encoding="utf-8") as f:
        json.dump(c, f, ensure_ascii=False, indent=2)
    return c


def default_remotion_root():
    legacy = "/Users/sam/Documents/remotion"  # 최초 개발 맥 (하위 호환)
    if not IS_WIN and os.path.isdir(os.path.join(legacy, "node_modules", "remotion")):
        return legacy
    return os.path.join(os.path.expanduser("~"), "remotion")


def remotion_root():
    return os.path.abspath(os.environ.get("REMOTION_PROJECT_ROOT") or load_conf().get("remotion_root") or default_remotion_root())


def os_font_dirs():
    if IS_WIN:
        win = os.environ.get("WINDIR", r"C:\Windows")
        local = os.environ.get("LOCALAPPDATA", os.path.join(os.path.expanduser("~"), "AppData", "Local"))
        return [os.path.join(local, "Microsoft", "Windows", "Fonts"), os.path.join(win, "Fonts")]
    if sys.platform == "darwin":
        return [os.path.expanduser("~/Library/Fonts"), "/Library/Fonts"]
    return [os.path.expanduser("~/.local/share/fonts"), os.path.expanduser("~/.fonts"), "/usr/share/fonts"]


def font_dirs(project=None, remotion=None):
    d = []
    if project:
        d.append(os.path.join(project, "global_assets", "fonts"))
    d.append(SHARED_FONTS)
    d += os_font_dirs()
    d.append(os.path.join(remotion or remotion_root(), "public", "fonts"))
    return d


def which(name):
    """node·npm·ffmpeg 실행 파일 경로 (Windows의 .cmd/.exe 포함). 없으면 None."""
    return shutil.which(name)


def run(cmd, **kw):
    """UTF-8로 출력 받는 subprocess.run (Windows 기본 cp949 디코딩 오류 방지)."""
    kw.setdefault("capture_output", True)
    kw.setdefault("text", True)
    kw.setdefault("encoding", "utf-8")
    kw.setdefault("errors", "replace")
    return subprocess.run(cmd, **kw)


def remotion_cli(root=None):
    """npx 대신 node로 Remotion CLI를 직접 부른다 (Windows의 npx.cmd 문제 회피)."""
    root = root or remotion_root()
    js = os.path.join(root, "node_modules", "@remotion", "cli", "remotion-cli.js")
    node = which("node")
    if node and os.path.exists(js):
        return [node, js]
    npx = which("npx")
    return [npx or "npx", "remotion"]
