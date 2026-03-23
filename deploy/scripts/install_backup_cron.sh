#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

SCHEDULE="${BACKUP_CRON_SCHEDULE:-0 3 * * *}"
LOG_FILE="${BACKUP_CRON_LOG_FILE:-/var/log/home-decoration-backup.log}"
KEEP_LOCAL_DAYS="${KEEP_LOCAL_DAYS:-7}"
OSS_PREFIX="${OSS_PREFIX:-home-decoration/prod-backups}"

required_envs=(
  DATABASE_HOST
  DATABASE_PORT
  DATABASE_USER
  DATABASE_PASSWORD
  DATABASE_DBNAME
  OSS_BUCKET
)

for env_name in "${required_envs[@]}"; do
  if [[ -z "${!env_name:-}" ]]; then
    echo "Missing required env var: ${env_name}" >&2
    exit 1
  fi
done

printf -v cron_cmd \
  'cd %q && DATABASE_HOST=%q DATABASE_PORT=%q DATABASE_USER=%q DATABASE_PASSWORD=%q DATABASE_DBNAME=%q OSS_BUCKET=%q OSS_PREFIX=%q KEEP_LOCAL_DAYS=%q bash ./scripts/backup_and_sync_oss.sh >> %q 2>&1' \
  "${DEPLOY_DIR}" \
  "${DATABASE_HOST}" \
  "${DATABASE_PORT}" \
  "${DATABASE_USER}" \
  "${DATABASE_PASSWORD}" \
  "${DATABASE_DBNAME}" \
  "${OSS_BUCKET}" \
  "${OSS_PREFIX}" \
  "${KEEP_LOCAL_DAYS}" \
  "${LOG_FILE}"

tmp_cron="$(mktemp)"
cleanup() {
  rm -f "${tmp_cron}"
}
trap cleanup EXIT

if crontab -l >/dev/null 2>&1; then
  crontab -l | grep -v 'backup_and_sync_oss.sh' > "${tmp_cron}" || true
else
  : > "${tmp_cron}"
fi

printf '%s %s\n' "${SCHEDULE}" "${cron_cmd}" >> "${tmp_cron}"
crontab "${tmp_cron}"

echo "Backup cron installed/updated successfully."
echo "Current matching entry:"
crontab -l | grep 'backup_and_sync_oss.sh' || true
