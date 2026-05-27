#!/usr/bin/env bash
# Ship the locally-built binary + ops files to VPS via rsync.
# Run after ./deploy/build-binary.sh.
#
# Usage: ./deploy/deploy-binary.sh user@vps [/remote/path]
# Defaults remote path: /opt/shadraw-studio

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 user@vps [/remote/path]" >&2
  exit 1
fi

TARGET="$1"
REMOTE_PATH="${2:-/opt/shadraw-studio}"

if [[ ! -f bin/server-linux-amd64 ]]; then
  echo "❌ bin/server-linux-amd64 not found. Run ./deploy/build-binary.sh first." >&2
  exit 1
fi

echo "▶︎ Ensuring ${REMOTE_PATH} exists on ${TARGET}..."
ssh "${TARGET}" "mkdir -p ${REMOTE_PATH}"

echo "▶︎ Rsyncing files to ${TARGET}:${REMOTE_PATH}..."
rsync -avz --progress \
  bin/server-linux-amd64 \
  migrations \
  deploy/docker-compose.deps.yml \
  deploy/shadraw-api.service \
  deploy/.env.prod.example \
  "${TARGET}:${REMOTE_PATH}/"

cat <<EOF

✓ Files uploaded. SSH in and finish setup:

  ssh ${TARGET}
  cd ${REMOTE_PATH}

  # 1. 准备 .env (首次):
  [ -f .env ] || cp .env.prod.example .env
  vim .env   # 填 JWT_SECRET / MASTER_KEY / POSTGRES_PASSWORD / S3_SECRET_ACCESS_KEY / ADMIN_EMAIL

  # 2. 起 Postgres + MinIO (docker)
  docker compose -f docker-compose.deps.yml --env-file .env up -d

  # 3. 安装 systemd 单元 (首次)
  sudo cp shadraw-api.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable shadraw-api

  # 4. 启动 API
  sudo systemctl restart shadraw-api
  sudo systemctl status shadraw-api

  # 5. 看日志
  sudo journalctl -u shadraw-api -f

后续升级:
  本地 ./deploy/build-binary.sh
  本地 ./deploy/deploy-binary.sh ${TARGET}
  SSH 上跑 sudo systemctl restart shadraw-api
EOF
