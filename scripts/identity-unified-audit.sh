#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SQL_PATH="${ROOT_DIR}/server/scripts/testdata/identity_unified_audit.sql"
OUTPUT_DIR="${IDENTITY_AUDIT_OUTPUT_DIR:-${ROOT_DIR}/test-results}"
OUTPUT_PATH="${IDENTITY_AUDIT_OUTPUT_PATH:-${OUTPUT_DIR}/identity-unified-audit-$(date +%Y%m%d-%H%M%S).txt}"

DB_URL="${IDENTITY_AUDIT_DB_URL:-}"
DB_USER="${IDENTITY_AUDIT_DB_USER:-postgres}"
DB_NAME="${IDENTITY_AUDIT_DB_NAME:-home_decoration}"
DOCKER_DB_CONTAINER="${IDENTITY_AUDIT_DB_CONTAINER:-}"

mkdir -p "${OUTPUT_DIR}"

run_with_psql_url() {
  psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${SQL_PATH}" > "${OUTPUT_PATH}"
}

run_with_docker() {
  local container_name="$1"
  docker exec -i "${container_name}" \
    psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f - < "${SQL_PATH}" > "${OUTPUT_PATH}"
}

if [[ ! -f "${SQL_PATH}" ]]; then
  echo "[identity-unified-audit] SQL file not found: ${SQL_PATH}" >&2
  exit 1
fi

if [[ -n "${DB_URL}" ]]; then
  echo "[identity-unified-audit] using IDENTITY_AUDIT_DB_URL"
  run_with_psql_url
elif [[ -n "${DOCKER_DB_CONTAINER}" ]]; then
  echo "[identity-unified-audit] using docker container: ${DOCKER_DB_CONTAINER}"
  run_with_docker "${DOCKER_DB_CONTAINER}"
else
  if docker ps --format '{{.Names}}' | grep -qx "home_decor_db_local"; then
    echo "[identity-unified-audit] using default docker container: home_decor_db_local"
    run_with_docker "home_decor_db_local"
  elif docker ps --format '{{.Names}}' | grep -qx "decorating_db"; then
    echo "[identity-unified-audit] using fallback docker container: decorating_db"
    run_with_docker "decorating_db"
  else
    echo "[identity-unified-audit] no database target found." >&2
    echo "Set IDENTITY_AUDIT_DB_URL or IDENTITY_AUDIT_DB_CONTAINER." >&2
    exit 1
  fi
fi

echo "[identity-unified-audit] report written: ${OUTPUT_PATH}"
