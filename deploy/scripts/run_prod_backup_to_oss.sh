#!/usr/bin/env bash
set -euo pipefail

# Production backup entrypoint used by cron on ECS.
# Reads DB credentials from deploy/.env and keeps secrets out of crontab.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${DEPLOY_DIR}"

if [[ ! -f .env ]]; then
  echo "Missing deploy/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

export DATABASE_HOST="${DATABASE_HOST:-prod_db}"
export DATABASE_PORT="${DATABASE_PORT:-5432}"
export DATABASE_USER="${DATABASE_USER:-${DB_USER:-postgres}}"
export DATABASE_PASSWORD="${DATABASE_PASSWORD:-${DB_PASSWORD:-}}"
export DATABASE_DBNAME="${DATABASE_DBNAME:-${DB_NAME:-home_decoration}}"
export TINODE_DBNAME="${TINODE_DBNAME:-tinode}"
export BACKUP_DOCKER_NETWORK="${BACKUP_DOCKER_NETWORK:-deploy_prod-net}"
export OSS_BUCKET="${OSS_BUCKET:-hezeyunchuang-prod-backup}"
export OSS_PREFIX="${OSS_PREFIX:-home-decoration/prod-backups}"
export KEEP_LOCAL_DAYS="${KEEP_LOCAL_DAYS:-7}"

if [[ -z "${DATABASE_PASSWORD}" ]]; then
  echo "Missing DATABASE_PASSWORD or DB_PASSWORD in deploy/.env" >&2
  exit 1
fi

bash "${SCRIPT_DIR}/backup_and_sync_oss.sh"
