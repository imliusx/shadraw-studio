#!/usr/bin/env bash
# Build the Vite frontend locally and stage it into internal/web/dist/
# so the Dockerfile.prebuilt can embed it into the Go binary.
#
# Run from monorepo root or anywhere — this script cd's to the repo root.
#
# Usage:
#   ./deploy/build-frontend.sh         # build + copy
#   ./deploy/build-frontend.sh --skip-install   # reuse existing node_modules

set -euo pipefail
cd "$(dirname "$0")/.."

SKIP_INSTALL=0
[[ "${1:-}" == "--skip-install" ]] && SKIP_INSTALL=1

if [[ ${SKIP_INSTALL} -ne 1 ]]; then
  echo "▶︎ Installing web deps..."
  ( cd web && npm install --no-audit --no-fund )
else
  echo "▶︎ Skipping npm install (--skip-install)"
fi

echo "▶︎ Building Vite production bundle..."
( cd web && npm run build )

echo "▶︎ Staging web/dist → internal/web/dist (clears old content, keeps .gitkeep)..."
mkdir -p internal/web/dist
find internal/web/dist -mindepth 1 ! -name ".gitkeep" -delete
cp -r web/dist/. internal/web/dist/
touch internal/web/dist/.gitkeep

echo ""
echo "✓ Frontend staged at internal/web/dist/"
du -sh internal/web/dist
ls internal/web/dist/ | head

echo ""
echo "Next steps:"
echo "  1) Ship dist to VPS:"
echo "     ./deploy/sync-dist.sh user@vps"
echo "  2) Deploy on VPS:"
echo "     ssh user@vps 'cd /opt/shadraw-studio && git pull && cd deploy && ./deploy.sh up'"
