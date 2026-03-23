#!/usr/bin/env bash
set -euo pipefail

# One-shot backup pipeline:
# 1) dump PostgreSQL databases to ./backups/*.sql.gz
# 2) archive uploads to ./backups/uploads_*.tar.gz
# 3) sync all backups to OSS
#
# Required env:
#   DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD
#   OSS_BUCKET

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${DEPLOY_DIR}"

report_alert() {
  local scope="$1"
  local message="$2"
  bash "${SCRIPT_DIR}/report_risk_warning.sh" open "system_backup_failure" "critical" "${scope}" "${message}" || true
}

resolve_alert() {
  local scope="$1"
  local result="$2"
  bash "${SCRIPT_DIR}/report_risk_warning.sh" resolve "system_backup_failure" "${scope}" "${result}" || true
}

run_step() {
  local scope="$1"
  shift
  if "$@"; then
    resolve_alert "${scope}" "备份步骤恢复正常"
    return 0
  fi
  report_alert "${scope}" "备份步骤失败：$*"
  exit 1
}

run_step "备份/数据库" bash "${SCRIPT_DIR}/backup_postgres.sh"
run_step "备份/上传文件" bash "${SCRIPT_DIR}/backup_uploads.sh"
run_step "备份/OSS同步" bash "${SCRIPT_DIR}/oss_sync_backups.sh"

echo "All backup steps completed."
