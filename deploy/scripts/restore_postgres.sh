#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash deploy/scripts/restore_postgres.sh <backup.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
DATABASE_PORT="${DATABASE_PORT:-5432}"
RESTORE_DBNAME="${RESTORE_DBNAME:-}"

required_envs=(
  DATABASE_HOST
  DATABASE_PORT
  DATABASE_USER
  DATABASE_PASSWORD
  RESTORE_DBNAME
)

for env_name in "${required_envs[@]}"; do
  if [[ -z "${!env_name:-}" ]]; then
    echo "Missing required env var: ${env_name}" >&2
    exit 1
  fi
done

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

echo "Preparing restore database: ${RESTORE_DBNAME}"
docker run --rm \
  -e "PGPASSWORD=${DATABASE_PASSWORD}" \
  -e "DATABASE_HOST=${DATABASE_HOST}" \
  -e "DATABASE_PORT=${DATABASE_PORT}" \
  -e "DATABASE_USER=${DATABASE_USER}" \
  -e "RESTORE_DBNAME=${RESTORE_DBNAME}" \
  postgres:15-alpine \
  sh <<'EOS'
set -euo pipefail

exists="$(psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${RESTORE_DBNAME}'")"
if [[ "${exists}" != "1" ]]; then
  createdb -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" "${RESTORE_DBNAME}"
fi
EOS

echo "Restoring ${BACKUP_FILE} -> ${RESTORE_DBNAME}"
gzip -dc "${BACKUP_FILE}" | docker run --rm -i \
  -e "PGPASSWORD=${DATABASE_PASSWORD}" \
  -e "DATABASE_HOST=${DATABASE_HOST}" \
  -e "DATABASE_PORT=${DATABASE_PORT}" \
  -e "DATABASE_USER=${DATABASE_USER}" \
  -e "RESTORE_DBNAME=${RESTORE_DBNAME}" \
  postgres:15-alpine \
  sh -ceu 'psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$RESTORE_DBNAME" -v ON_ERROR_STOP=1'

echo "Restore completed: ${RESTORE_DBNAME}"
