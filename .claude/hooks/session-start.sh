#!/bin/bash
# 세션 시작 훅 — Claude Code on the web(클라우드 세션)에서 의존성을 미리 설치한다.
# 클라우드 세션은 매번 빈 컨테이너에서 저장소를 새로 받아오므로 node_modules가 없다.
# 이 훅이 없으면 npm run check / build 전에 매번 설치를 따로 해야 한다.
set -euo pipefail

# 로컬 PC 세션에서는 아무것도 하지 않는다. 이미 설치돼 있고, 재설치는 낭비다.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"}"

# 이미 설치돼 있고 락파일보다 최신이면 건너뛴다. 훅은 세션 시작뿐 아니라
# resume·clear·compact 때도 돌기 때문에 매번 재설치하지 않도록 한다.
if [ -d node_modules ] && [ node_modules/.package-lock.json -nt package-lock.json ]; then
  echo "의존성 설치됨 — 건너뜀"
  exit 0
fi

# npm install이 아니라 npm ci. 샌드박스 npm이 로컬보다 낮은 버전이면
# npm install은 모르는 필드(libc 등)를 지우며 package-lock.json을 다시 써서
# 세션이 매번 변경된 락파일로 시작된다. npm ci는 락파일을 절대 건드리지 않는다.
# ci가 실패하는 경우는 락파일이 package.json과 실제로 어긋났을 때뿐이라
# 그때만 install로 넘어간다.
npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# 파노라마 재생성(scripts/*.py, requirements.txt의 numpy·scipy·opencv·Pillow)은
# 설치가 무겁고 매 세션 필요하지도 않아 여기서 다루지 않는다. 필요할 때 이렇게 만든다:
#   python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
