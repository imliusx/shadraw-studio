#!/usr/bin/env bash
# Sync the locally-built frontend dist to a VPS.
# Run AFTER ./deploy/build-frontend.sh.
#
# Usage:
#   ./deploy/sync-dist.sh user@vps [/remote/path]
#
# Default remote path: /opt/shadraw-studio

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 user@vps [/remote/path]" >&2
  exit 1
fi

TARGET="$1"
REMOTE_PATH="${2:-/opt/shadraw-studio}"

if [[ ! -f internal/web/dist/index.html ]]; then
  echo "❌ internal/web/dist/index.html not found." >&2
  echo "   Run ./deploy/build-frontend.sh first." >&2
  exit 1
fi

echo "▶︎ Ensuring ${REMOTE_PATH}/internal/web/dist exists on ${TARGET}..."
ssh "${TARGET}" "mkdir -p '${REMOTE_PATH}/internal/web/dist'"

echo "▶︎ Rsyncing internal/web/dist/ to ${TARGET}:${REMOTE_PATH}/internal/web/dist/ ..."
rsync -avz --delete --progress \
  --exclude=".gitkeep" \
  internal/web/dist/ \
  "${TARGET}:${REMOTE_PATH}/internal/web/dist/"

cat <<EOF

✓ dist synced. Now on the VPS:

  ssh ${TARGET}
  cd ${REMOTE_PATH}
  git pull                  # pull latest backend code
  cd deploy
  ./deploy.sh up            # docker build uses Dockerfile.prebuilt, only Go is compiled

提示:Dockerfile.prebuilt 会校验 internal/web/dist/index.html 是否存在,
缺了就直接 fail,不会去跑 vite build,避免 VPS 上 OOM。
EOF
