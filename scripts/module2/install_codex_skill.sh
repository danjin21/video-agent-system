#!/bin/sh
# (하위 호환) 공용 스킬을 ~/.agents/skills 에 연결 → module2_setup.py skill 로 옮겨짐. Windows는 python으로 직접 실행.
#   install_codex_skill.sh [대상 폴더]
DIR=$(cd "$(dirname "$0")" && pwd)
if [ -n "$1" ]; then exec python3 "$DIR/module2_setup.py" skill --target "$1"; fi
exec python3 "$DIR/module2_setup.py" skill
