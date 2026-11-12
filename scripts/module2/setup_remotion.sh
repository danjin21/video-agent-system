#!/bin/sh
# (하위 호환) 모듈2 Remotion 3D 의존성 설치 → module2_setup.py remotion 으로 옮겨짐. Windows는 python으로 직접 실행.
#   setup_remotion.sh [REMOTION_ROOT]
DIR=$(cd "$(dirname "$0")" && pwd)
if [ -n "$1" ]; then exec python3 "$DIR/module2_setup.py" remotion --remotion "$1"; fi
exec python3 "$DIR/module2_setup.py" remotion
