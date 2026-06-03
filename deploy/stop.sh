#!/usr/bin/env bash
# Stop the shadraw stack on the VPS (binary + systemd deployment).
#
# Binary + systemd deployment only:
#   - shadraw-api systemd service runs the API binary
#   - docker-compose.deps.yml runs Postgres + MinIO
#
# Non-destructive: stops the service / containers, never deletes data volumes.
# (For full removal incl. data, see deploy/uninstall.md — this script won't.)
#
# Usage (on VPS, run from /opt/shadraw-studio):
#   ./stop.sh                  # stop API only (temporary downtime; deps stay up)
#   ./stop.sh --deps           # also stop Postgres + MinIO containers (data kept)
#   ./stop.sh --disable        # also cancel auto-start on boot
#   ./stop.sh --deps --disable # stop everything and disable boot start
#   ./stop.sh --status         # show current state only, change nothing

set -euo pipefail

cd "$(dirname "$0")"

STOP_DEPS=0
DISABLE=0
STATUS_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deps)     STOP_DEPS=1; shift ;;
    --disable)  DISABLE=1; shift ;;
    --status)   STATUS_ONLY=1; shift ;;
    -h|--help)  sed -n '2,16p' "$0"; exit 0 ;;
    *)          echo "❌ Unknown option: $1" >&2; exit 1 ;;
  esac
done

COMPOSE_FILE="docker-compose.deps.yml"
ENV_FILE=".env"

# --- Detect systemd unit -----------------------------------------------------
HAS_SYSTEMD=0
if systemctl list-unit-files shadraw-api.service >/dev/null 2>&1; then
  HAS_SYSTEMD=1
fi

# --- Status-only branch ------------------------------------------------------
if [[ ${STATUS_ONLY} -eq 1 ]]; then
  echo "▶︎ shadraw-api:"
  if [[ ${HAS_SYSTEMD} -eq 1 ]]; then
    echo "    active : $(systemctl is-active shadraw-api || true)"
    echo "    enabled: $(systemctl is-enabled shadraw-api 2>/dev/null || true)"
  else
    echo "    systemd unit not installed"
  fi
  echo "▶︎ dependency containers:"
  if [[ -f "${COMPOSE_FILE}" ]]; then
    docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps || true
  else
    echo "    ${COMPOSE_FILE} not found in $(pwd)"
  fi
  exit 0
fi

# --- Stop API ----------------------------------------------------------------
if [[ ${HAS_SYSTEMD} -eq 1 ]]; then
  if systemctl is-active --quiet shadraw-api; then
    echo "▶︎ Stopping shadraw-api systemd service..."
    sudo systemctl stop shadraw-api
    echo "  ✓ shadraw-api stopped"
  else
    echo "  shadraw-api already inactive"
  fi
  if [[ ${DISABLE} -eq 1 ]]; then
    echo "▶︎ Disabling shadraw-api auto-start on boot..."
    sudo systemctl disable shadraw-api
    echo "  ✓ auto-start disabled"
  fi
else
  echo "⚠️  shadraw-api systemd unit not installed; nothing to stop."
fi

# --- Stop dependency containers (optional) -----------------------------------
if [[ ${STOP_DEPS} -eq 1 ]]; then
  [[ -f "${COMPOSE_FILE}" ]] || { echo "❌ ${COMPOSE_FILE} not found in $(pwd); cannot stop deps." >&2; exit 1; }
  [[ -f "${ENV_FILE}"     ]] || { echo "❌ ${ENV_FILE} not found in $(pwd)." >&2; exit 1; }
  echo "▶︎ Stopping Postgres + MinIO containers (data volumes intact)..."
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" down
  echo "  ✓ Postgres + MinIO stopped"
fi

# --- How to bring it back ----------------------------------------------------
echo ""
echo "✓ Done. Bring it back with:"
if [[ ${STOP_DEPS} -eq 1 ]]; then
  echo "    docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up -d"
fi
if [[ ${DISABLE} -eq 1 ]]; then
  echo "    sudo systemctl enable shadraw-api"
fi
echo "    sudo systemctl start shadraw-api"
