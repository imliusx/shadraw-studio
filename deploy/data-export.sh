#!/usr/bin/env bash
# Local data export — runs on your dev machine in the monorepo root.
#
# Dumps Postgres + tars MinIO data into `backup/`, with date-stamped filenames.
# Idempotent: never destructive, safe to re-run. Each call produces files for
# the current date (`shadraw-pg-YYYY-MM-DD.dump`, `shadraw-minio-YYYY-MM-DD.tgz`).
#
# Usage:
#   deploy/data-export.sh                  # export to backup/
#   deploy/data-export.sh --scp user@host  # export + scp to remote home
#
# After export, see docs/deploy-migration.md for the restore steps on VPS,
# or use deploy/data-restore.sh once the files are on VPS.

set -euo pipefail

# cd to monorepo root (this script lives in deploy/)
cd "$(dirname "$0")/.."

SCP_TARGET=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --scp)
      SCP_TARGET="$2"; shift 2
      ;;
    -h|--help)
      sed -n '2,14p' "$0"; exit 0
      ;;
    *)
      echo "❌ Unknown option: $1" >&2; exit 1
      ;;
  esac
done

STAMP=$(date +%Y-%m-%d)
DUMP_FILE="backup/shadraw-pg-${STAMP}.dump"
MINIO_FILE="backup/shadraw-minio-${STAMP}.tgz"

mkdir -p backup

echo "▶︎ Checking docker compose services..."
if ! docker compose ps --format json db 2>/dev/null | grep -q '"State":"running"'; then
  echo "  db is not running — starting db + minio..."
  docker compose up -d db minio
  echo "  waiting for db..."
  until docker compose exec -T db pg_isready -U shadraw -d shadraw >/dev/null 2>&1; do
    sleep 1
  done
fi

echo "▶︎ Dumping Postgres (custom format) → ${DUMP_FILE}"
docker compose exec -T db pg_dump -U shadraw -Fc shadraw > "${DUMP_FILE}"

echo "▶︎ Taring MinIO data → ${MINIO_FILE}"
tar czf "${MINIO_FILE}" -C minio-data .

echo ""
echo "✓ Export complete:"
ls -lh "${DUMP_FILE}" "${MINIO_FILE}"

if [[ -n "${SCP_TARGET}" ]]; then
  echo ""
  echo "▶︎ SCP to ${SCP_TARGET}:~/shadraw-studio/"
  scp "${DUMP_FILE}" "${MINIO_FILE}" "${SCP_TARGET}:~/shadraw-studio/"
  echo ""
  echo "✓ Files copied. Next: ssh ${SCP_TARGET} 'cd ~/shadraw-studio/deploy && ./data-restore.sh'"
else
  echo ""
  echo "Next step:"
  echo "  scp ${DUMP_FILE} ${MINIO_FILE} user@vps:~/shadraw-studio/"
  echo "  ssh user@vps 'cd ~/shadraw-studio/deploy && ./data-restore.sh'"
fi
