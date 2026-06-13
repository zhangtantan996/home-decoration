#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-standard}"
CONTINUE_ON_ERROR="${VERIFY_LAUNCH_CONTINUE_ON_ERROR:-0}"

usage() {
  cat <<'EOF'
用法:
  ./scripts/launch-readiness.sh [standard|full|smoke|security|perf]

模式:
  standard  轻预约上线常规门禁：backend/admin/ops/mini + API 冒烟 + git diff 检查
  full      完整上线门禁：standard + 安全扫描 + k6 压测
  smoke     只运行轻预约 API 冒烟
  security  只运行安全扫描脚本
  perf      只运行轻预约 k6 压测

常用环境变量:
  API_BASE_URL                 API 地址，默认 http://127.0.0.1:8080/api/v1
  OPS_ADMIN_TOKEN              可选，启用 Ops 鉴权接口冒烟
  ADMIN_TOKEN                  可选，启用 Admin 鉴权接口冒烟
  USER_TOKEN                   可选，写入冒烟或压测预约/反馈时必填
  ENABLE_WRITE_SMOKE=1         显式允许冒烟脚本创建测试预约/报价/反馈
  SMOKE_PROVIDER_ID            写入冒烟预约的服务商 ID
  K6_ENABLE_WRITES=1           显式允许 k6 写入预约/报价
  K6_PROVIDER_ID               k6 写入预约的服务商 ID
  VERIFY_LAUNCH_CONTINUE_ON_ERROR=1  失败后继续跑后续步骤
EOF
}

suite_args=(--suite "launch-readiness-${MODE}")
if [[ "$CONTINUE_ON_ERROR" == "1" ]]; then
  suite_args+=(--continue-on-error)
fi

add_step() {
  suite_args+=(--step "$1::$2")
}

case "$MODE" in
  standard)
    add_step "verify-backend" "npm run verify:backend"
    add_step "verify-admin" "npm run verify:admin"
    add_step "verify-ops" "npm run verify:ops"
    add_step "verify-mini" "npm run verify:mini"
    add_step "light-appointment-smoke" "./scripts/light-appointment-smoke.sh"
    add_step "git-diff-check" "git diff --check && git diff --cached --check"
    ;;
  full)
    add_step "verify-backend" "npm run verify:backend"
    add_step "verify-admin" "npm run verify:admin"
    add_step "verify-ops" "npm run verify:ops"
    add_step "verify-mini" "npm run verify:mini"
    add_step "light-appointment-smoke" "./scripts/light-appointment-smoke.sh"
    add_step "security-scan" "bash scripts/security/run_security_scans.sh --skip-dast"
    add_step "performance-k6-light-appointment" "./scripts/performance/run-light-appointment-k6.sh"
    add_step "git-diff-check" "git diff --check && git diff --cached --check"
    ;;
  smoke)
    add_step "light-appointment-smoke" "./scripts/light-appointment-smoke.sh"
    ;;
  security)
    add_step "security-scan" "bash scripts/security/run_security_scans.sh --skip-dast"
    ;;
  perf)
    add_step "performance-k6-light-appointment" "./scripts/performance/run-light-appointment-k6.sh"
    ;;
  -h|--help|help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac

node ./scripts/testing/run_command_suite.mjs "${suite_args[@]}"
