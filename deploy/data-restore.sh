#!/usr/bin/env bash
# Remote data restore — runs on VPS in `deploy/` directory after files have
# been scp'd to `~/shadraw-studio/`.
#
# Destructively replaces Postgres + MinIO contents with the dumps. Prompts
# for confirmation unless --yes is passed.
#
# Usage (on VPS):
#   cd ~/shadraw-studio/deploy
#   ./data-restore.sh                       # use newest dump found in ~/shadraw-studio/
#   ./data-restore.sh --yes                 # skip confirmation
#   ./data-restore.sh \                     # explicit files
#     --pg-dump ~/shadraw-studio/foo.dump \
#     --minio-tgz ~/shadraw-studio/bar.tgz

set -euo pipefail

cd "$(dirname "$0")"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
PG_DUMP=""
MINIO_TGZ=""
ASSUME_YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pg-dump)    PG_DUMP="$2"; shift 2 ;;
    --minio-tgz)  MINIO_TGZ="$2"; shift 2 ;;
    --yes|-y)     ASSUME_YES=1; shift ;;
    -h|--help)    sed -n '2,15p' "$0"; exit 0 ;;
    *)            echo "❌ Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Defaults: pick the newest matching file in ~/shadraw-studio/
if [[ -z "${PG_DUMP}" ]]; then
  PG_DUMP=$(ls -1t "$HOME/shadraw-studio/shadraw-pg-"*.dump 2>/dev/null | head -1 || true)
fi
if [[ -z "${MINIO_TGZ}" ]]; then
  MINIO_TGZ=$(ls -1t "$HOME/shadraw-studio/shadraw-minio-"*.tgz 2>/dev/null | head -1 || true)
fi

if [[ ! -f "${PG_DUMP}" ]]; then
  echo "❌ Postgres dump not found. Pass --pg-dump or put it under ~/shadraw-studio/" >&2
  exit 1
fi
if [[ ! -f "${MINIO_TGZ}" ]]; then
  echo "❌ MinIO tar not found. Pass --minio-tgz or put it under ~/shadraw-studio/" >&2
  exit 1
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "❌ ${ENV_FILE} not found in $(pwd). Run setup per deploy/README.md first." >&2
  exit 1
fi

COMPOSE="docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE}"

# Load DB credentials from .env so we can pass to pg_restore explicitly.
set -a; source "${ENV_FILE}"; set +a

echo "▶︎ Plan:"
echo "    pg_dump file   : ${PG_DUMP} ($(du -h "${PG_DUMP}" | cut -f1))"
echo "    minio tar      : ${MINIO_TGZ} ($(du -h "${MINIO_TGZ}" | cut -f1))"
echo "    target db      : ${POSTGRES_USER}@db/${POSTGRES_DB}"
echo "    compose file   : ${COMPOSE_FILE}"
echo ""
echo "⚠️  THIS WILL REPLACE all data in Postgres + MinIO with the dumps."
echo ""

if [[ ${ASSUME_YES} -ne 1 ]]; then
  read -p "Proceed? (type 'yes' to continue) " ans
  if [[ "${ans}" != "yes" ]]; then
    echo "Aborted."; exit 1
  fi
fi

echo ""
echo "▶︎ Starting db + minio only..."
${COMPOSE} up -d db minio

echo "▶︎ Waiting for db to be ready..."
until ${COMPOSE} exec -T db pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; do
  sleep 1
done

echo "▶︎ Restoring Postgres (--clean --if-exists)..."
cat "${PG_DUMP}" | ${COMPOSE} exec -T db \
  pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists

echo "▶︎ Stopping MinIO to swap data..."
${COMPOSE} stop minio

# Find the actual named volume (compose project prefix varies)
MINIO_VOL=$(docker volume ls --format "{{.Name}}" | grep -i miniodata | head -1)
if [[ -z "${MINIO_VOL}" ]]; then
  echo "❌ Could not find miniodata volume. Try: docker volume ls" >&2
  exit 1
fi
echo "    MinIO volume: ${MINIO_VOL}"

echo "▶︎ Extracting MinIO tar into volume..."
# Use abs path to tar file so it works inside the temporary alpine container's mount
ABS_TGZ=$(cd "$(dirname "${MINIO_TGZ}")" && pwd)/$(basename "${MINIO_TGZ}")
docker run --rm \
  -v "${MINIO_VOL}":/data \
  -v "${ABS_TGZ}":/backup.tgz:ro \
  alpine sh -c "cd /data && rm -rf .minio.sys shadraw && tar xzf /backup.tgz"

echo "▶︎ Starting MinIO + full stack..."
${COMPOSE} up -d

echo ""
echo "✓ Restore complete. api log (Ctrl+C to detach):"
echo ""
${COMPOSE} logs --tail=30 -f api
