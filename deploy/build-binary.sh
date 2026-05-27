#!/usr/bin/env bash
# Build a self-contained linux/amd64 binary with the Vite frontend embedded.
# Runs locally (your Mac / dev machine). Produces:
#   bin/server-linux-amd64
#
# Use this when the VPS is too resource-constrained to run docker build.
# After build, ship with: ./deploy/deploy-binary.sh user@vps

set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶︎ Stage 1: Vite build (frontend)..."
( cd web && npm install --no-audit --no-fund && npm run build )

echo "▶︎ Stage 2: Copying web/dist → internal/web/dist (for go:embed)..."
mkdir -p internal/web/dist
find internal/web/dist -mindepth 1 ! -name ".gitkeep" -delete
cp -r web/dist/. internal/web/dist/
touch internal/web/dist/.gitkeep

echo "▶︎ Stage 3: Cross-compiling Go binary for linux/amd64..."
mkdir -p bin
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
  -ldflags="-s -w" \
  -trimpath \
  -o bin/server-linux-amd64 \
  ./cmd/server

echo ""
echo "✓ Build complete:"
ls -lh bin/server-linux-amd64
file bin/server-linux-amd64

echo ""
echo "Next: ./deploy/deploy-binary.sh user@vps [/remote/path]"
echo "      (default remote path: /opt/shadraw-studio)"
