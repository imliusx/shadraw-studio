#!/usr/bin/env bash
# Restore Postgres + MinIO data from a local dump pair into the running stack.
#
# Binary + systemd deployment only:
#   - docker-compose.deps.yml runs Postgres + MinIO
#   - shadraw-api systemd service runs the API binary
#
# Destructive: replaces existing Postgres + MinIO contents.
#
# Usage (on VPS, run from wherever the compose file lives):
#   ./data-restore.sh                       # newest dump found in ~, .., .
#   ./data-restore.sh --yes                 # skip confirmation
#   ./data-restore.sh --pg-dump foo.dump --minio-tgz bar.tgz

set -euo pipefail

cd "$(dirname "$0")"

echo "▶︎ data-restore.sh starting (cwd: $(pwd))..."

PG_DUMP=""
MINIO_TGZ=""
ASSUME_YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pg-dump)    PG_DUMP="$2"; shift 2 ;;
    --minio-tgz)  MINIO_TGZ="$2"; shift 2 ;;
    --yes|-y)     ASSUME_YES=1; shift ;;
    -h|--help)    sed -n '2,16p' "$0"; exit 0 ;;
    *)            echo "❌ Unknown option: $1" >&2; exit 1 ;;
  esac
done

# --- Detect compose file ------------------------------------------------------
COMPOSE_FILE="docker-compose.deps.yml"
if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "❌ ${COMPOSE_FILE} not found in $(pwd)" >&2
  echo "   Run this script from /opt/shadraw-studio after deploy-binary.sh uploads files." >&2
  exit 1
fi
echo "  mode = binary, compose = ${COMPOSE_FILE}"

ENV_FILE=".env"
[[ -f "${ENV_FILE}" ]] || { echo "❌ ${ENV_FILE} not found in $(pwd)." >&2; exit 1; }
echo "  env  = $(pwd)/${ENV_FILE}"

# --- Locate dump files (search ., .., ~, ~/shadraw-studio) -------------------
# Note: function returns 0 explicitly to avoid set -e tripping on last [[...]] test.
# Note: ${d}/${pattern} is INTENTIONALLY unquoted so bash glob-expands the *.
search_dump() {
  local pattern="$1"
  local d f
  for d in . .. "$HOME" "$HOME/shadraw-studio"; do
    # shellcheck disable=SC2086
    f=$(ls -1t ${d}/${pattern} 2>/dev/null | head -1 || true)
    if [[ -n "${f}" ]]; then
      echo "${f}"
      return 0
    fi
  done
  return 0
}

if [[ -z "${PG_DUMP}"   ]]; then PG_DUMP=$(search_dump "shadraw-pg-*.dump"); fi
if [[ -z "${MINIO_TGZ}" ]]; then MINIO_TGZ=$(search_dump "shadraw-minio-*.tgz"); fi

echo "  pg   = ${PG_DUMP:-<not found>}"
echo "  tgz  = ${MINIO_TGZ:-<not found>}"

[[ -f "${PG_DUMP}"   ]] || { echo "❌ Postgres dump not found. Pass --pg-dump." >&2; exit 1; }
[[ -f "${MINIO_TGZ}" ]] || { echo "❌ MinIO tar not found. Pass --minio-tgz." >&2; exit 1; }

# Load DB credentials from .env so we can pass to pg_restore explicitly.
# Temporarily relax `set -u` because users sometimes put references to unset
# vars or quoting that bash's source can't reconcile under nounset.
set +u
set -a
source "${ENV_FILE}"
set +a
set -u

COMPOSE="docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE}"

# --- Detect systemd service ---------------------------------------------------
HAS_SYSTEMD=0
if systemctl list-unit-files shadraw-api.service >/dev/null 2>&1; then
  HAS_SYSTEMD=1
fi

# --- Plan summary ------------------------------------------------------------
echo "▶︎ Plan:"
echo "    mode         : binary + systemd"
echo "    compose file : ${COMPOSE_FILE}"
echo "    pg dump      : ${PG_DUMP} ($(du -h "${PG_DUMP}" | cut -f1))"
echo "    minio tar    : ${MINIO_TGZ} ($(du -h "${MINIO_TGZ}" | cut -f1))"
echo "    target db    : ${POSTGRES_USER}@db/${POSTGRES_DB}"
[[ ${HAS_SYSTEMD} -eq 1 ]] && echo "    systemd unit : shadraw-api.service (will be stopped & restarted)"
echo ""
echo "⚠️  THIS WILL REPLACE all data in Postgres + MinIO with the dumps."
echo ""

if [[ ${ASSUME_YES} -ne 1 ]]; then
  read -p "Proceed? (type 'yes' to continue) " ans
  [[ "${ans}" == "yes" ]] || { echo "Aborted."; exit 1; }
fi

# --- Stop API ---------------------------------------------------------------
if [[ ${HAS_SYSTEMD} -eq 1 ]] && systemctl is-active --quiet shadraw-api; then
  echo "▶︎ Stopping shadraw-api systemd service..."
  sudo systemctl stop shadraw-api
fi

# --- Start db + minio --------------------------------------------------------
echo "▶︎ Ensuring db + minio are up..."
${COMPOSE} up -d db minio

echo "▶︎ Waiting for db..."
until ${COMPOSE} exec -T db pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; do
  sleep 1
done

# --- Postgres restore --------------------------------------------------------
echo "▶︎ Restoring Postgres (--clean --if-exists)..."
cat "${PG_DUMP}" | ${COMPOSE} exec -T db \
  pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists

# --- MinIO swap --------------------------------------------------------------
echo "▶︎ Stopping MinIO to swap volume contents..."
${COMPOSE} stop minio

MINIO_VOL=$(docker volume ls --format "{{.Name}}" | grep -i miniodata | head -1)
[[ -n "${MINIO_VOL}" ]] || { echo "❌ miniodata volume not found." >&2; exit 1; }
echo "    MinIO volume: ${MINIO_VOL}"

ABS_TGZ=$(cd "$(dirname "${MINIO_TGZ}")" && pwd)/$(basename "${MINIO_TGZ}")
docker run --rm \
  -v "${MINIO_VOL}":/data \
  -v "${ABS_TGZ}":/backup.tgz:ro \
  alpine sh -c "cd /data && rm -rf .minio.sys shadraw && tar xzf /backup.tgz"

echo "▶︎ Starting MinIO..."
${COMPOSE} start minio

# --- Start API back up -------------------------------------------------------
if [[ ${HAS_SYSTEMD} -eq 1 ]]; then
  echo "▶︎ Starting shadraw-api systemd service..."
  sudo systemctl start shadraw-api
  sleep 2
  sudo systemctl status shadraw-api --no-pager -n 10
  echo ""
  echo "✓ Restore complete. Recent journal:"
  sudo journalctl -u shadraw-api -n 20 --no-pager
else
  echo "⚠️  systemd unit not installed; api won't auto-start."
  echo "   See deploy/deploy-binary.sh output for setup steps."
fi
