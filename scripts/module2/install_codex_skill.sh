#!/usr/bin/env bash
# 모듈2 스킬을 Codex(그리고 Agent Skills를 읽는 다른 에이전트)에 연결한다.
#   install_codex_skill.sh            → ~/.agents/skills/module2-strategy-video (모든 폴더에서 사용)
#   install_codex_skill.sh <폴더>      → <폴더>/.agents/skills/module2-strategy-video (그 저장소에서만)
# 복사하지 않고 심볼릭 링크를 건다. 플러그인을 git pull 하면 스킬도 같이 갱신된다.
set -euo pipefail
PLUGIN=$(cd "$(dirname "$(realpath "$0")")/../.." && pwd)
SRC="$PLUGIN/skills/module2-strategy-video"
BASE=${1:-$HOME}
DEST_DIR="$BASE/.agents/skills"
mkdir -p "$DEST_DIR"
DEST="$DEST_DIR/module2-strategy-video"
if [ -e "$DEST" ] && [ ! -L "$DEST" ]; then
  echo "이미 링크가 아닌 폴더가 있다: $DEST — 직접 확인 후 지워라" >&2; exit 1
fi
ln -sfn "$SRC" "$DEST"
echo "연결됨: $DEST -> $SRC"
echo "Codex에서 \$module2-strategy-video 또는 /skills 로 부른다."
