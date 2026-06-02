#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CHECK_PATH="${CHECK_PATH:-/}"
WARN_THRESHOLD="${WARN_THRESHOLD:-75}"
CRITICAL_THRESHOLD="${CRITICAL_THRESHOLD:-85}"
AUTO_CLEAN_ON_WARN="${AUTO_CLEAN_ON_WARN:-1}"
AUTO_CLEAN_ON_CRITICAL="${AUTO_CLEAN_ON_CRITICAL:-1}"
KEEP_BACKUP_DAYS="${KEEP_BACKUP_DAYS:-7}"
DOCKER_CONTAINER_UNTIL="${DOCKER_CONTAINER_UNTIL:-72h}"
DOCKER_IMAGE_UNTIL="${DOCKER_IMAGE_UNTIL:-168h}"
DOCKER_BUILDER_UNTIL="${DOCKER_BUILDER_UNTIL:-168h}"
JOURNAL_KEEP="${JOURNAL_KEEP:-7d}"
RISK_WARNING_ENABLED="${RISK_WARNING_ENABLED:-0}"
DISK_ALERT_SCOPE="${DISK_ALERT_SCOPE:-系统/磁盘容量}"
DRY_RUN="${DRY_RUN:-0}"
BACKUP_DIRS_RAW="${BACKUP_DIRS:-${DEPLOY_DIR}/backups}"
PROTECTED_PATHS_RAW="${PROTECTED_PATHS:-/var/lib/postgresql /var/lib/mysql /var/lib/redis /var/lib/docker/volumes /root/home-decoration/server/uploads /root/home-decoration/uploads}"

read -r -a BACKUP_DIRS <<< "${BACKUP_DIRS_RAW}"
read -r -a PROTECTED_PATHS <<< "${PROTECTED_PATHS_RAW}"

log() {
  printf '[%s] %s\n' "$(date '+%F %T')" "$*"
}

run_cmd() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "DRY_RUN: $*"
    return 0
  fi
  "$@"
}

run_best_effort() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "DRY_RUN: $*"
    return 0
  fi
  if "$@"; then
    return 0
  fi
  log "Command failed but cleanup will continue: $*"
  return 0
}

validate_thresholds() {
  if ! [[ "${WARN_THRESHOLD}" =~ ^[0-9]+$ && "${CRITICAL_THRESHOLD}" =~ ^[0-9]+$ ]]; then
    echo "WARN_THRESHOLD and CRITICAL_THRESHOLD must be integers" >&2
    exit 1
  fi
  if (( WARN_THRESHOLD >= CRITICAL_THRESHOLD )); then
    echo "WARN_THRESHOLD must be lower than CRITICAL_THRESHOLD" >&2
    exit 1
  fi
}

usage_percent() {
  df -P "${CHECK_PATH}" | awk 'NR==2 { gsub(/%/, "", $5); print $5 }'
}

can_report_risk_warning() {
  [[ "${RISK_WARNING_ENABLED}" == "1" ]] || return 1
  [[ -n "${DATABASE_HOST:-}" && -n "${DATABASE_PORT:-}" && -n "${DATABASE_USER:-}" && -n "${DATABASE_PASSWORD:-}" ]]
}

open_alert() {
  local level="$1"
  local description="$2"
  if can_report_risk_warning; then
    bash "${SCRIPT_DIR}/report_risk_warning.sh" open "system_disk_usage" "${level}" "${DISK_ALERT_SCOPE}" "${description}" || true
  fi
}

resolve_alert() {
  local result="$1"
  if can_report_risk_warning; then
    bash "${SCRIPT_DIR}/report_risk_warning.sh" resolve "system_disk_usage" "${DISK_ALERT_SCOPE}" "${result}" || true
  fi
}

is_protected_path() {
  local candidate="$1"
  local protected
  for protected in "${PROTECTED_PATHS[@]}"; do
    if [[ "${candidate}" == "${protected}" || "${candidate}" == "${protected}/"* ]]; then
      return 0
    fi
  done
  return 1
}

print_hotspots() {
  local roots=(
    "/var/lib"
    "/var/log"
    "/tmp"
    "/root/home-decoration"
    "${DEPLOY_DIR}/backups"
  )
  local root
  for root in "${roots[@]}"; do
    if [[ -d "${root}" ]]; then
      log "Hotspots under ${root}:"
      du -xh -d 1 "${root}" 2>/dev/null | sort -h | tail -n 8 || true
    fi
  done
}

print_protected_paths() {
  local path
  log "Protected paths not cleaned automatically:"
  for path in "${PROTECTED_PATHS[@]}"; do
    if [[ -e "${path}" ]]; then
      du -sh "${path}" 2>/dev/null || true
    fi
  done
}

cleanup_old_backups() {
  local dir
  for dir in "${BACKUP_DIRS[@]}"; do
    [[ -n "${dir}" ]] || continue
    if [[ ! -d "${dir}" ]]; then
      continue
    fi
    if is_protected_path "${dir}"; then
      log "Skip protected backup dir: ${dir}"
      continue
    fi
    log "Cleaning backup dir older than ${KEEP_BACKUP_DAYS} days: ${dir}"
    if [[ "${DRY_RUN}" == "1" ]]; then
      find "${dir}" -type f -mtime +"${KEEP_BACKUP_DAYS}" -print || true
    else
      find "${dir}" -type f -mtime +"${KEEP_BACKUP_DAYS}" -print -delete || true
    fi
  done
}

cleanup_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log "docker not found, skip docker cleanup"
    return 0
  fi
  if ! docker info >/dev/null 2>&1; then
    log "docker daemon unavailable, skip docker cleanup"
    return 0
  fi
  log "Pruning stopped containers older than ${DOCKER_CONTAINER_UNTIL}"
  run_best_effort docker container prune -f --filter "until=${DOCKER_CONTAINER_UNTIL}"
  log "Pruning unused images older than ${DOCKER_IMAGE_UNTIL}"
  run_best_effort docker image prune -af --filter "until=${DOCKER_IMAGE_UNTIL}"
  log "Pruning builder cache older than ${DOCKER_BUILDER_UNTIL}"
  run_best_effort docker builder prune -af --filter "until=${DOCKER_BUILDER_UNTIL}"
}

cleanup_journal() {
  if ! command -v journalctl >/dev/null 2>&1; then
    log "journalctl not found, skip journal cleanup"
    return 0
  fi
  log "Vacuuming journald logs to ${JOURNAL_KEEP}"
  run_best_effort journalctl --vacuum-time="${JOURNAL_KEEP}"
}

safe_cleanup() {
  cleanup_docker
  cleanup_journal
  cleanup_old_backups
}

validate_thresholds

current_usage="$(usage_percent)"
log "Disk usage on ${CHECK_PATH}: ${current_usage}%"

if (( current_usage < WARN_THRESHOLD )); then
  log "Disk usage below warn threshold ${WARN_THRESHOLD}%, no cleanup required"
  resolve_alert "磁盘使用率恢复到 ${current_usage}%"
  exit 0
fi

print_hotspots

should_clean=0
if (( current_usage >= CRITICAL_THRESHOLD )); then
  should_clean="${AUTO_CLEAN_ON_CRITICAL}"
else
  should_clean="${AUTO_CLEAN_ON_WARN}"
fi

if [[ "${should_clean}" == "1" ]]; then
  log "Threshold reached, starting safe cleanup"
  safe_cleanup
else
  log "Threshold reached, cleanup disabled by configuration"
fi

final_usage="$(usage_percent)"
log "Disk usage after cleanup: ${final_usage}%"

if (( final_usage < WARN_THRESHOLD )); then
  resolve_alert "磁盘使用率已从 ${current_usage}% 恢复到 ${final_usage}%"
  exit 0
fi

print_protected_paths

if (( final_usage >= CRITICAL_THRESHOLD )); then
  message="磁盘使用率 ${final_usage}%（初始 ${current_usage}%），执行安全清理后仍高于严重阈值 ${CRITICAL_THRESHOLD}%。当前仅清理 Docker 缓存、停止容器、构建缓存、journald 日志和过期备份；数据库、上传目录和卷数据不会自动删除，请人工扩容或转移关键数据。"
  log "${message}"
  open_alert "critical" "${message}"
  exit 2
fi

message="磁盘使用率 ${final_usage}%（初始 ${current_usage}%），已执行安全清理但仍高于提醒阈值 ${WARN_THRESHOLD}%。系统不会自动删除数据库、上传目录和卷数据，请人工确认是否需要扩容或迁移关键内容。"
log "${message}"
open_alert "medium" "${message}"
exit 0
