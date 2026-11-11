#!/bin/zsh
# 모듈2 Remotion 작업 폴더 준비 (1회). 공용 package.json은 건드리지 않는다 (Remotion AGENTS.md 격리 규칙).
#   setup_remotion.sh [REMOTION_ROOT]
# - <root>/codex-workspace/module2/ 에 3D 의존성만 따로 설치 (--legacy-peer-deps: react·remotion은 상위 node_modules 사용)
# - @remotion/three가 끌고 오는 중복 remotion 사본을 지운다 (두 벌이면 3D 안에서 프레임 컨텍스트가 끊김)
set -e
ROOT=${1:-${REMOTION_PROJECT_ROOT:-/Users/sam/Documents/remotion}}
W=$ROOT/codex-workspace/module2
RV=$(node -p "require('$ROOT/node_modules/remotion/package.json').version")
mkdir -p $W
[ -f $W/package.json ] || cat > $W/package.json <<'J'
{"name":"module2-workspace-deps","private":true,"description":"모듈2 전용 3D 의존성. 공용 package.json을 건드리지 않기 위해 이 폴더에만 설치.","dependencies":{}}
J
CACHE=${NPM_CACHE:-${TMPDIR:-/tmp}/module2-npm-cache}
(cd $W && npm install --cache $CACHE --legacy-peer-deps --no-audit --no-fund \
   @remotion/three@$RV three@0.180.0 @react-three/fiber@9 @types/three@0.180.0)
rm -rf $W/node_modules/remotion $W/node_modules/react $W/node_modules/react-dom
echo "module2 workspace ready: $W (remotion $RV)"
