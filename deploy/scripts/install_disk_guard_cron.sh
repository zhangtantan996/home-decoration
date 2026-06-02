#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

SCHEDULE="${DISK_GUARD_CRON_SCHEDULE:-*/30 * * * *}"
LOG_FILE="${DISK_GUARD_LOG_FILE:-/var/log/home-decoration-disk-guard.log}"

printf -v cron_cmd \
  'cd %q && CHECK_PATH=%q WARN_THRESHOLD=%q CRITICAL_THRESHOLD=%q AUTO_CLEAN_ON_WARN=%q AUTO_CLEAN_ON_CRITICAL=%q KEEP_BACKUP_DAYS=%q DOCKER_CONTAINER_UNTIL=%q DOCKER_IMAGE_UNTIL=%q DOCKER_BUILDER_UNTIL=%q JOURNAL_KEEP=%q RISK_WARNING_ENABLED=%q DISK_ALERT_SCOPE=%q BACKUP_DIRS=%q PROTECTED_PATHS=%q DATABASE_HOST=%q DATABASE_PORT=%q DATABASE_USER=%q DATABASE_PASSWORD=%q DATABASE_DBNAME=%q bash ./scripts/disk_guard.sh >> %q 2>&1' \
  "${DEPLOY_DIR}" \
  "${CHECK_PATH:-/}" \
  "${WARN_THRESHOLD:-75}" \
  "${CRITICAL_THRESHOLD:-85}" \
  "${AUTO_CLEAN_ON_WARN:-1}" \
  "${AUTO_CLEAN_ON_CRITICAL:-1}" \
  "${KEEP_BACKUP_DAYS:-7}" \
  "${DOCKER_CONTAINER_UNTIL:-72h}" \
  "${DOCKER_IMAGE_UNTIL:-168h}" \
  "${DOCKER_BUILDER_UNTIL:-168h}" \
  "${JOURNAL_KEEP:-7d}" \
  "${RISK_WARNING_ENABLED:-0}" \
  "${DISK_ALERT_SCOPE:-系统/磁盘容量}" \
  "${BACKUP_DIRS:-${DEPLOY_DIR}/backups}" \
  "${PROTECTED_PATHS:-/var/lib/postgresql /var/lib/mysql /var/lib/redis /var/lib/docker/volumes /root/home-decoration/server/uploads /root/home-decoration/uploads}" \
  "${DATABASE_HOST:-}" \
  "${DATABASE_PORT:-}" \
  "${DATABASE_USER:-}" \
  "${DATABASE_PASSWORD:-}" \
  "${DATABASE_DBNAME:-home_decoration}" \
  "${LOG_FILE}"

tmp_cron="$(mktemp)"
cleanup() {
  rm -f "${tmp_cron}"
}
trap cleanup EXIT

if crontab -l >/dev/null 2>&1; then
  crontab -l | grep -v 'disk_guard.sh' > "${tmp_cron}" || true
else
  : > "${tmp_cron}"
fi

printf '%s %s\n' "${SCHEDULE}" "${cron_cmd}" >> "${tmp_cron}"
crontab "${tmp_cron}"

echo "Disk guard cron installed/updated successfully."
echo "Current matching entry:"
crontab -l | grep 'disk_guard.sh' || true
