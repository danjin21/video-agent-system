#!/bin/zsh
# 모듈1 전체 합본: build_all.sh <project_root>  (오디오 트랙·자막 PNG 재생성 → 합본 → 자막 굽기)
set -e; PROJ=${1:?project root}; HERE=$(cd "$(dirname "$0")" && pwd)
PYTHONIOENCODING=utf-8 python3 -X utf8 "$HERE/rebuild_audio_subs.py" "$PROJ"
"$HERE/build_master.sh" "$PROJ"
PYTHONIOENCODING=utf-8 python3 -X utf8 "$HERE/burn_subs.py" "$PROJ"
ls -la "$PROJ"/final/master_*.mp4 | awk '{printf "%.1f MB  %s\n",$5/1048576,$9}'
