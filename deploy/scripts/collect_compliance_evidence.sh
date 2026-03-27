#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-${REPO_ROOT}/deploy/.env}"
VERIFY_HTTPS_SCRIPT="${REPO_ROOT}/deploy/scripts/verify_https.sh"

OUTPUT_FILE=""
SKIP_HTTPS="false"
SKIP_DB="false"
APP_LOG_FILE="${APP_LOG_FILE:-}"
HTTPS_RESULT="信息不足"
BACKUP_CRON_RESULT="信息不足"
BACKUP_FILES_RESULT="信息不足"
RETENTION_RESULT="信息不足"
SEPARATION_RESULT="信息不足"
RECONCILIATION_RESULT="信息不足"

usage() {
  cat <<'EOF'
Usage:
  bash deploy/scripts/collect_compliance_evidence.sh [options]

Options:
  --output <file>     Optional. Write markdown report to file.
  --skip-https        Optional. Skip HTTPS verification.
  --skip-db           Optional. Skip database evidence collection.
  --app-log <file>    Optional. Specify application log file path.
  --help              Show this help message.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      OUTPUT_FILE="${2:-}"
      shift 2
      ;;
    --skip-https)
      SKIP_HTTPS="true"
      shift
      ;;
    --skip-db)
      SKIP_DB="true"
      shift
      ;;
    --app-log)
      APP_LOG_FILE="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -f "${DEPLOY_ENV_FILE}" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${DEPLOY_ENV_FILE}"
  set +a
fi

if [[ -n "${OUTPUT_FILE}" ]]; then
  mkdir -p "$(dirname "${OUTPUT_FILE}")"
  exec >"${OUTPUT_FILE}"
fi

REPORT_TIME="$(date '+%Y-%m-%d %H:%M:%S %Z')"
HOSTNAME_VALUE="$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo unknown)"

ROOT_DOMAIN="${ROOT_DOMAIN:-}"
if [[ -z "${ROOT_DOMAIN}" && -n "${DEPLOY_WEBSITE_HOST:-}" ]]; then
  ROOT_DOMAIN="${DEPLOY_WEBSITE_HOST}"
fi
if [[ -z "${ROOT_DOMAIN}" && -n "${VITE_PUBLIC_SITE_URL:-}" ]]; then
  without_scheme="${VITE_PUBLIC_SITE_URL#*://}"
  ROOT_DOMAIN="${without_scheme%%/*}"
fi
ROOT_DOMAIN="${ROOT_DOMAIN:-hezeyunchuang.com}"
ADMIN_HOST="${ADMIN_HOST:-${DEPLOY_ADMIN_HOST:-admin.${ROOT_DOMAIN}}}"
API_HOST="${API_HOST:-${DEPLOY_API_HOST:-api.${ROOT_DOMAIN}}}"

print_code_block() {
  local content="${1:-}"
  echo '```'
  if [[ -n "${content}" ]]; then
    printf '%s\n' "${content}"
  fi
  echo '```'
}

maybe_capture() {
  "$@" 2>&1 || true
}

render_check_result() {
  local label="$1"
  local result="$2"

  case "${result}" in
    pass)
      printf -- '- %s：PASS\n' "${label}"
      ;;
    fail)
      printf -- '- %s：FAIL\n' "${label}"
      ;;
    *)
      printf -- '- %s：信息不足\n' "${label}"
      ;;
  esac
}

resolve_log_paths() {
  if [[ -n "${APP_LOG_FILE}" && -f "${APP_LOG_FILE}" ]]; then
    printf '%s\n' "${APP_LOG_FILE}"
    return
  fi

  local found="false"
  shopt -s nullglob
  for file in "${REPO_ROOT}"/server/logs/*.log; do
    printf '%s\n' "${file}"
    found="true"
  done
  shopt -u nullglob

  if [[ "${found}" == "false" ]]; then
    return 1
  fi
}

can_query_db() {
  [[ "${SKIP_DB}" == "false" ]] && [[ -n "${DATABASE_HOST:-}" ]] && [[ -n "${DATABASE_PORT:-}" ]] && [[ -n "${DATABASE_USER:-}" ]] && [[ -n "${DATABASE_PASSWORD:-}" ]]
}

run_sql() {
  local sql="$1"

  if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="${DATABASE_PASSWORD}" psql \
      -v ON_ERROR_STOP=1 \
      -h "${DATABASE_HOST}" \
      -p "${DATABASE_PORT}" \
      -U "${DATABASE_USER}" \
      -d "${DATABASE_DBNAME:-home_decoration}" \
      -At \
      -F $'\t' \
      -c "${sql}"
    return
  fi

  if command -v docker >/dev/null 2>&1; then
    docker run --rm \
      -e "PGPASSWORD=${DATABASE_PASSWORD}" \
      postgres:15-alpine \
      psql \
        -v ON_ERROR_STOP=1 \
        -h "${DATABASE_HOST}" \
        -p "${DATABASE_PORT}" \
        -U "${DATABASE_USER}" \
        -d "${DATABASE_DBNAME:-home_decoration}" \
        -At \
        -F $'\t' \
        -c "${sql}"
    return
  fi

  echo "信息不足，无法执行数据库取证：缺少 psql/docker"
  return 1
}

latest_backup_files() {
  local backup_dir="${REPO_ROOT}/deploy/backups"
  if [[ ! -d "${backup_dir}" ]]; then
    echo "信息不足，未发现 ${backup_dir}"
    return 0
  fi

  find "${backup_dir}" -maxdepth 1 -type f | sort | tail -n 5 || true
}

echo "# 软件达标现场取证报告"
echo
echo "- 生成时间：\`${REPORT_TIME}\`"
echo "- 主机：\`${HOSTNAME_VALUE}\`"
echo "- 仓库：\`${REPO_ROOT}\`"
echo

echo "## 1. 配置快照"
echo
echo "- \`APP_ENV\`：\`${APP_ENV:-<empty>}\`"
echo "- \`SERVER_MODE\`：\`${SERVER_MODE:-<empty>}\`"
echo "- \`SERVER_PUBLIC_URL\`：\`${SERVER_PUBLIC_URL:-<empty>}\`"
echo "- \`DATABASE_HOST\`：\`${DATABASE_HOST:-<empty>}\`"
echo "- \`DATABASE_SSLMODE\`：\`${DATABASE_SSLMODE:-<empty>}\`"
echo "- \`REDIS_HOST\`：\`${REDIS_HOST:-<empty>}\`"
echo "- \`ROOT_DOMAIN\`：\`${ROOT_DOMAIN}\`"
echo "- \`ADMIN_HOST\`：\`${ADMIN_HOST}\`"
echo "- \`API_HOST\`：\`${API_HOST}\`"
echo

echo "## 2. HTTPS 验收"
echo
if [[ "${SKIP_HTTPS}" == "true" ]]; then
  echo "信息不足，已按参数跳过 HTTPS 验证。"
elif [[ -x "${VERIFY_HTTPS_SCRIPT}" || -f "${VERIFY_HTTPS_SCRIPT}" ]]; then
  https_output="$(maybe_capture bash "${VERIFY_HTTPS_SCRIPT}")"
  if [[ "${https_output}" == *"[FAIL]"* ]]; then
    HTTPS_RESULT="fail"
  elif [[ "${https_output}" == *"[PASS]"* ]]; then
    HTTPS_RESULT="pass"
  fi
  print_code_block "${https_output}"
else
  echo "信息不足，未找到 \`deploy/scripts/verify_https.sh\`。"
fi
echo

echo "## 3. 备份与恢复"
echo
echo "### 3.1 当前 cron"
cron_output="$(maybe_capture sh -c "crontab -l | grep 'backup_and_sync_oss.sh'")"
if [[ -z "${cron_output}" ]]; then
  cron_output="信息不足，当前用户 crontab 未发现 backup_and_sync_oss.sh"
else
  BACKUP_CRON_RESULT="pass"
fi
print_code_block "${cron_output}"
echo
echo "### 3.2 最近备份文件"
backup_files_output="$(latest_backup_files)"
if [[ -n "${backup_files_output}" ]] && [[ "${backup_files_output}" != 信息不足* ]]; then
  BACKUP_FILES_RESULT="pass"
fi
print_code_block "${backup_files_output}"
echo

echo "## 4. 审计日志保留"
echo
log_files="$(resolve_log_paths || true)"
if [[ -n "${log_files}" ]]; then
  retention_log="$(printf '%s\n' "${log_files}" | xargs grep -h 'Audit log retention' 2>/dev/null | tail -n 10 || true)"
  if [[ -z "${retention_log}" ]]; then
    retention_log="信息不足，未在现有日志中检索到 Audit log retention 相关记录"
  else
    RETENTION_RESULT="pass"
  fi
  print_code_block "${retention_log}"
else
  echo "信息不足，未找到可读的应用日志文件。"
fi
echo

if can_query_db; then
  echo "### 4.1 audit_logs 抽样"
  audit_sql="SELECT COUNT(*) AS total, COALESCE(MIN(created_at)::text,'') AS earliest_created_at, COALESCE(MAX(created_at)::text,'') AS latest_created_at FROM audit_logs;"
  audit_sql_output="$(maybe_capture run_sql "${audit_sql}")"
  if [[ -n "${audit_sql_output}" ]] && [[ "${audit_sql_output}" != 信息不足* ]]; then
    RETENTION_RESULT="pass"
  fi
  print_code_block "${audit_sql_output}"
else
  echo "信息不足，未提供完整数据库连接环境，跳过 audit_logs 取证。"
fi
echo

echo "## 5. 三员分立"
echo
if can_query_db; then
  role_sql="SELECT key, name, status FROM sys_roles WHERE key IN ('system_admin','security_admin','security_auditor') ORDER BY key;"
  role_sql_output="$(maybe_capture run_sql "${role_sql}")"
  if [[ -n "${role_sql_output}" ]] && [[ "${role_sql_output}" != 信息不足* ]]; then
    SEPARATION_RESULT="pass"
  fi
  print_code_block "${role_sql_output}"
else
  echo "信息不足，未提供完整数据库连接环境，跳过三员分立种子取证。"
fi
echo

echo "## 6. 交易对账"
echo
if [[ -n "${log_files}" ]]; then
  reconcile_log="$(printf '%s\n' "${log_files}" | xargs grep -h 'Finance reconciliation' 2>/dev/null | tail -n 10 || true)"
  if [[ -n "${reconcile_log}" ]]; then
    echo "### 6.1 对账任务日志"
    print_code_block "${reconcile_log}"
  fi
fi

if can_query_db; then
  echo "### 6.2 finance_reconciliations 最近记录"
  reconcile_sql="SELECT id, reconcile_date, status, finding_count, owner_admin_id, resolved_by_admin_id, COALESCE(last_run_at::text,'') FROM finance_reconciliations ORDER BY reconcile_date DESC, id DESC LIMIT 10;"
  reconcile_sql_output="$(maybe_capture run_sql "${reconcile_sql}")"
  if [[ -n "${reconcile_sql_output}" ]] && [[ "${reconcile_sql_output}" != 信息不足* ]]; then
    RECONCILIATION_RESULT="pass"
  fi
  print_code_block "${reconcile_sql_output}"

  echo
  echo "### 6.3 风险告警联动"
  risk_sql="SELECT id, type, level, status, project_name, COALESCE(handle_result,''), created_at FROM risk_warnings WHERE type = 'finance_reconciliation_failed' ORDER BY id DESC LIMIT 10;"
  print_code_block "$(maybe_capture run_sql "${risk_sql}")"
else
  echo "信息不足，未提供完整数据库连接环境，跳过交易对账数据库取证。"
fi
echo

echo "## 7. 人工补证项"
echo
echo "- 宿主机 \`443\` 监听截图"
echo "- 浏览器 Mixed Content 截图"
echo "- 备份执行 / 恢复演练输出与业务抽样截图"
echo "- 审计员只读菜单截图"
echo "- 异常对账认领/处理页面截图"
echo

echo "## 8. 上线准入预检查"
echo
render_check_result "HTTPS 三域验收" "${HTTPS_RESULT}"
if [[ "${BACKUP_CRON_RESULT}" == "pass" && "${BACKUP_FILES_RESULT}" == "pass" ]]; then
  render_check_result "备份任务与备份产物" "pass"
elif [[ "${BACKUP_CRON_RESULT}" == "fail" || "${BACKUP_FILES_RESULT}" == "fail" ]]; then
  render_check_result "备份任务与备份产物" "fail"
else
  render_check_result "备份任务与备份产物" "unknown"
fi
render_check_result "审计日志 retention 取证" "${RETENTION_RESULT}"
render_check_result "三员分立取证" "${SEPARATION_RESULT}"
render_check_result "对账闭环取证" "${RECONCILIATION_RESULT}"
echo
echo "> 说明：本节只是脚本级预检查，不替代最终 Go/No-Go 签字。缺少人工截图、恢复演练结果或真实环境验证时，仍不能判定最终达标。"
