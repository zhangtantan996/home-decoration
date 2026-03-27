#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_OUTPUT_ROOT="${REPO_ROOT}/output/security-scans"
TIMESTAMP="$(date '+%Y%m%dT%H%M%S')"

OUTPUT_DIR=""
OUTPUT_ROOT="${DEFAULT_OUTPUT_ROOT}"
ENV_FILE=""
SKIP_DAST=0
SKIP_DOCKER_FALLBACK=0
DRY_RUN=0
ZAP_MINUTES="${ZAP_MINUTES:-5}"
ZAP_FAIL_LEVEL="${ZAP_FAIL_LEVEL:-Medium}"

DOCKER_READY_CACHE=""
SUMMARY_FILE=""
REPORTS_DIR=""
AUTOMATED_DIR=""
LOG_DIR=""

usage() {
  cat <<'EOF'
用法:
  bash scripts/security/run_security_scans.sh [options]

选项:
  --env-file <path>          读取目标环境变量样例，常用于 DAST
  --output-root <path>       指定输出根目录，默认 output/security-scans
  --output-dir <path>        指定本次执行目录，默认自动带时间戳
  --skip-dast                跳过 ZAP 基线扫描
  --skip-docker-fallback     工具缺失时不使用 Docker 兜底
  --dry-run                  只生成目录/模板/执行计划，不实际跑扫描
  -h, --help                 显示帮助

环境变量:
  USER_WEB_URL               用户 Web URL，例如 https://test.example.com
  ADMIN_URL                  管理后台 URL，例如 https://admin-test.example.com
  API_URL                    API URL，例如 https://api-test.example.com
  SCAN_IMAGES                可选，逗号分隔的镜像名，供 trivy image 扫描
  ZAP_MINUTES                ZAP baseline 时长（分钟），默认 5
  ZAP_FAIL_LEVEL             ZAP 失败级别，默认 Medium

输出:
  output/security-scans/<timestamp>/
    automated/               自动化工具输出
    logs/                    执行日志
    reports/                 报告模板与人工验证剧本副本
    scan-summary.md          本次执行汇总
EOF
}

log() {
  printf '[security-scan] %s\n' "$*"
}

warn() {
  printf '[security-scan][WARN] %s\n' "$*" >&2
}

have_tool() {
  command -v "$1" >/dev/null 2>&1
}

docker_ready() {
  if [[ -n "${DOCKER_READY_CACHE}" ]]; then
    [[ "${DOCKER_READY_CACHE}" == "1" ]]
    return
  fi

  if have_tool docker && docker info >/dev/null 2>&1; then
    DOCKER_READY_CACHE="1"
  else
    DOCKER_READY_CACHE="0"
  fi

  [[ "${DOCKER_READY_CACHE}" == "1" ]]
}

load_env_file() {
  if [[ -z "${ENV_FILE}" ]]; then
    return
  fi
  if [[ ! -f "${ENV_FILE}" ]]; then
    warn "env 文件不存在: ${ENV_FILE}"
    exit 1
  fi

  # shellcheck disable=SC1090
  set -a && source "${ENV_FILE}" && set +a
}

prepare_dirs() {
  if [[ "${OUTPUT_ROOT}" != /* ]]; then
    OUTPUT_ROOT="${REPO_ROOT}/${OUTPUT_ROOT#./}"
  fi

  if [[ -z "${OUTPUT_DIR}" ]]; then
    OUTPUT_DIR="${OUTPUT_ROOT}/${TIMESTAMP}"
  elif [[ "${OUTPUT_DIR}" != /* ]]; then
    OUTPUT_DIR="${REPO_ROOT}/${OUTPUT_DIR#./}"
  fi

  AUTOMATED_DIR="${OUTPUT_DIR}/automated"
  LOG_DIR="${OUTPUT_DIR}/logs"
  REPORTS_DIR="${OUTPUT_DIR}/reports"
  mkdir -p "${AUTOMATED_DIR}" "${LOG_DIR}" "${REPORTS_DIR}"
  SUMMARY_FILE="${OUTPUT_DIR}/scan-summary.md"
}

init_summary() {
  cat >"${SUMMARY_FILE}" <<EOF
# 安全扫描结果汇总

- 执行时间：$(date '+%Y-%m-%d %H:%M:%S %z')
- 仓库根目录：${REPO_ROOT}
- 输出目录：${OUTPUT_DIR}
- dry-run：$([[ "${DRY_RUN}" -eq 1 ]] && echo "yes" || echo "no")
- Docker 兜底：$([[ "${SKIP_DOCKER_FALLBACK}" -eq 1 ]] && echo "disabled" || echo "enabled")

## 自动化扫描结果

| 分类 | 项目 | 状态 | 产物 | 备注 |
| --- | --- | --- | --- | --- |
EOF
}

record_result() {
  local category="$1"
  local item="$2"
  local status="$3"
  local artifact="$4"
  local note="$5"

  printf '| %s | %s | %s | %s | %s |\n' \
    "${category}" \
    "${item}" \
    "${status}" \
    "${artifact:--}" \
    "${note:--}" >>"${SUMMARY_FILE}"
}

copy_templates() {
  cp "${REPO_ROOT}/docs/安全扫描报告模板.md" "${REPORTS_DIR}/安全扫描报告模板.md"
  cp "${REPO_ROOT}/docs/人工安全验证剧本_2026-03-25.md" "${REPORTS_DIR}/人工安全验证剧本.md"

  cat >"${REPORTS_DIR}/README.md" <<EOF
# 本次安全扫描工作区

- 先看：../scan-summary.md
- 自动化输出：../automated/
- 执行日志：../logs/
- 可直接填写：
  - 安全扫描报告模板.md
  - 人工安全验证剧本.md

建议流程：
1. 先跑自动化扫描，标注命中与失败项
2. 再按人工剧本复现高危链路
3. 最后将“自动化命中 / 人工复现成功 / 误报 / 待确认”分别归档
EOF
}

run_scan() {
  local category="$1"
  local item="$2"
  local artifact_rel="$3"
  shift 3

  local log_file="${LOG_DIR}/${item}.log"
  local artifact_display="${artifact_rel:--}"

  if [[ "${DRY_RUN}" -eq 1 ]]; then
    record_result "${category}" "${item}" "DRY-RUN" "${artifact_display}" "未执行，仅生成工作区"
    return 0
  fi

  log "运行 ${item}"
  set +e
  "$@" >"${log_file}" 2>&1
  local exit_code=$?
  set -e

  local status="OK"
  local note="exit=${exit_code}"
  if [[ "${exit_code}" -ne 0 ]]; then
    status="CHECK"
  fi

  record_result "${category}" "${item}" "${status}" "${artifact_display}" "${note}; 日志: logs/$(basename "${log_file}")"
  return 0
}

run_shell_scan() {
  local category="$1"
  local item="$2"
  local artifact_rel="$3"
  local command="$4"

  run_scan "${category}" "${item}" "${artifact_rel}" bash -lc "${command}"
}

run_npm_audits() {
  if ! have_tool npm; then
    record_result "依赖" "npm-audit" "SKIP" "-" "npm 不可用"
    return
  fi

  local projects=(
    "."
    "admin"
    "merchant"
    "web"
    "mobile"
    "mini"
  )

  local project
  for project in "${projects[@]}"; do
    local lockfile="${REPO_ROOT}/${project}/package-lock.json"
    local item_name="npm-audit-$(basename "${project}")"
    if [[ "${project}" == "." ]]; then
      item_name="npm-audit-root"
    fi
    if [[ ! -f "${lockfile}" ]]; then
      record_result "依赖" "${item_name}" "SKIP" "-" "未发现 package-lock.json"
      continue
    fi

    local artifact_rel="automated/${item_name}.json"
    local artifact_abs="${OUTPUT_DIR}/${artifact_rel}"
    run_shell_scan "依赖" "${item_name}" "${artifact_rel}" \
      "cd '${REPO_ROOT}/${project}' && npm audit --omit=dev --json > '${artifact_abs}'"
  done
}

run_gitleaks_scan() {
  local artifact_rel="automated/gitleaks.json"
  local artifact_abs="${OUTPUT_DIR}/${artifact_rel}"

  if have_tool gitleaks; then
    run_scan "Secrets" "gitleaks" "${artifact_rel}" \
      gitleaks detect --source "${REPO_ROOT}" --redact --report-format json --report-path "${artifact_abs}"
    return
  fi

  if [[ "${SKIP_DOCKER_FALLBACK}" -eq 0 ]] && docker_ready; then
    run_scan "Secrets" "gitleaks" "${artifact_rel}" \
      docker run --rm \
        -v "${REPO_ROOT}:/repo" \
        -v "${OUTPUT_DIR}:/scan" \
        -w /repo \
        zricethezav/gitleaks:latest \
        detect --source . --redact --report-format json --report-path "/scan/${artifact_rel}"
    return
  fi

  record_result "Secrets" "gitleaks" "SKIP" "-" "未安装 gitleaks，且 Docker 兜底不可用"
}

run_osv_scan() {
  local artifact_rel="automated/osv-scanner.json"
  local artifact_abs="${OUTPUT_DIR}/${artifact_rel}"

  if have_tool osv-scanner; then
    run_scan "依赖" "osv-scanner" "${artifact_rel}" \
      osv-scanner --recursive "${REPO_ROOT}" --format json -o "${artifact_abs}"
    return
  fi

  record_result "依赖" "osv-scanner" "SKIP" "-" "未安装 osv-scanner"
}

run_govulncheck_scan() {
  local artifact_rel="automated/govulncheck.txt"
  local artifact_abs="${OUTPUT_DIR}/${artifact_rel}"

  if have_tool govulncheck; then
    run_shell_scan "Go" "govulncheck" "${artifact_rel}" \
      "cd '${REPO_ROOT}/server' && govulncheck ./... > '${artifact_abs}'"
    return
  fi

  if have_tool go; then
    run_shell_scan "Go" "govulncheck" "${artifact_rel}" \
      "cd '${REPO_ROOT}/server' && GOWORK=off go run golang.org/x/vuln/cmd/govulncheck@latest ./... > '${artifact_abs}'"
    return
  fi

  record_result "Go" "govulncheck" "SKIP" "-" "未安装 go/govulncheck"
}

run_gosec_scan() {
  local artifact_rel="automated/gosec.txt"
  local artifact_abs="${OUTPUT_DIR}/${artifact_rel}"

  if have_tool gosec; then
    run_shell_scan "Go" "gosec" "${artifact_rel}" \
      "cd '${REPO_ROOT}/server' && gosec ./... > '${artifact_abs}'"
    return
  fi

  if have_tool go; then
    run_shell_scan "Go" "gosec" "${artifact_rel}" \
      "cd '${REPO_ROOT}/server' && GOWORK=off go run github.com/securego/gosec/v2/cmd/gosec@latest ./... > '${artifact_abs}'"
    return
  fi

  record_result "Go" "gosec" "SKIP" "-" "未安装 go/gosec"
}

run_semgrep_scan() {
  local artifact_rel="automated/semgrep.json"
  local artifact_abs="${OUTPUT_DIR}/${artifact_rel}"
  local target_paths="server admin merchant web mobile mini deploy"
  local semgrep_cmd="semgrep scan --config p/owasp-top-ten --config p/golang --config p/typescript --config p/react --config p/docker --config p/secrets --json --output '${artifact_abs}' ${target_paths}"

  if have_tool semgrep; then
    run_shell_scan "SAST" "semgrep" "${artifact_rel}" \
      "cd '${REPO_ROOT}' && ${semgrep_cmd}"
    return
  fi

  if [[ "${SKIP_DOCKER_FALLBACK}" -eq 0 ]] && docker_ready; then
    run_scan "SAST" "semgrep" "${artifact_rel}" \
      docker run --rm \
        -v "${REPO_ROOT}:/src" \
        -v "${OUTPUT_DIR}:/scan" \
        -w /src \
        --entrypoint semgrep \
        semgrep/semgrep \
        scan --config p/owasp-top-ten --config p/golang --config p/typescript --config p/react --config p/docker --config p/secrets --json --output "/scan/${artifact_rel}" server admin merchant web mobile mini deploy
    return
  fi

  record_result "SAST" "semgrep" "SKIP" "-" "未安装 semgrep，且 Docker 兜底不可用"
}

run_trivy_config_scan() {
  local artifact_rel="automated/trivy-config.json"
  local artifact_abs="${OUTPUT_DIR}/${artifact_rel}"

  if have_tool trivy; then
    run_scan "IaC" "trivy-config" "${artifact_rel}" \
      trivy config --format json --output "${artifact_abs}" "${REPO_ROOT}"
    return
  fi

  if [[ "${SKIP_DOCKER_FALLBACK}" -eq 0 ]] && docker_ready; then
    run_scan "IaC" "trivy-config" "${artifact_rel}" \
      docker run --rm \
        -v "${REPO_ROOT}:/work" \
        -v "${OUTPUT_DIR}:/scan" \
        -w /work \
        aquasec/trivy:latest \
        config --format json --output "/scan/${artifact_rel}" .
    return
  fi

  record_result "IaC" "trivy-config" "SKIP" "-" "未安装 trivy，且 Docker 兜底不可用"
}

run_trivy_image_scans() {
  local images="${SCAN_IMAGES:-}"
  if [[ -z "${images}" ]]; then
    record_result "IaC" "trivy-image" "SKIP" "-" "未设置 SCAN_IMAGES"
    return
  fi

  local image
  IFS=',' read -r -a image_list <<<"${images}"
  for image in "${image_list[@]}"; do
    image="$(echo "${image}" | xargs)"
    [[ -z "${image}" ]] && continue

    local safe_name
    safe_name="$(echo "${image}" | tr '/:@' '___')"
    local artifact_rel="automated/trivy-image-${safe_name}.json"
    local artifact_abs="${OUTPUT_DIR}/${artifact_rel}"

    if have_tool trivy; then
      run_scan "IaC" "trivy-image-${safe_name}" "${artifact_rel}" \
        trivy image --format json --output "${artifact_abs}" "${image}"
      continue
    fi

    if [[ "${SKIP_DOCKER_FALLBACK}" -eq 0 ]] && docker_ready; then
      run_scan "IaC" "trivy-image-${safe_name}" "${artifact_rel}" \
        docker run --rm \
          -v /var/run/docker.sock:/var/run/docker.sock \
          -v "${OUTPUT_DIR}:/scan" \
          aquasec/trivy:latest \
          image --format json --output "/scan/${artifact_rel}" "${image}"
      continue
    fi

    record_result "IaC" "trivy-image-${safe_name}" "SKIP" "-" "未安装 trivy，且 Docker 兜底不可用"
  done
}

run_zap_scan_for_target() {
  local item="$1"
  local url="$2"

  local html_rel="automated/${item}.html"
  local json_rel="automated/${item}.json"
  local base_dir="${OUTPUT_DIR}/automated"

  if [[ -z "${url}" ]]; then
    record_result "DAST" "${item}" "SKIP" "-" "未配置目标 URL"
    return
  fi

  if [[ "${SKIP_DOCKER_FALLBACK}" -eq 1 ]] || ! docker_ready; then
    record_result "DAST" "${item}" "SKIP" "-" "ZAP 仅支持 Docker 兜底"
    return
  fi

  run_scan "DAST" "${item}" "${html_rel}, ${json_rel}" \
    docker run --rm \
      -v "${base_dir}:/zap/wrk:rw" \
      ghcr.io/zaproxy/zaproxy:stable \
      zap-baseline.py -t "${url}" -m "${ZAP_MINUTES}" -I -J "$(basename "${json_rel}")" -r "$(basename "${html_rel}")"
}

run_dast_scans() {
  if [[ "${SKIP_DAST}" -eq 1 ]]; then
    record_result "DAST" "zap-baseline" "SKIP" "-" "显式跳过 DAST"
    return
  fi

  run_zap_scan_for_target "zap-user-web" "${USER_WEB_URL:-}"
  run_zap_scan_for_target "zap-admin" "${ADMIN_URL:-}"
  run_zap_scan_for_target "zap-api" "${API_URL:-}"
}

append_postface() {
  cat >>"${SUMMARY_FILE}" <<EOF

## 后续动作建议

1. 先看状态为 \`CHECK\` 的工具输出，再回填 \`reports/安全扫描报告模板.md\`
2. 按 \`reports/人工安全验证剧本.md\` 优先复现 P0：越权、支付、上传、XSS
3. 将“仅工具命中但未复现”的问题放入“待确认”，不要直接认定为已确认漏洞
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env-file)
        ENV_FILE="${2:-}"
        shift 2
        ;;
      --output-root)
        OUTPUT_ROOT="${2:-}"
        shift 2
        ;;
      --output-dir)
        OUTPUT_DIR="${2:-}"
        shift 2
        ;;
      --skip-dast)
        SKIP_DAST=1
        shift
        ;;
      --skip-docker-fallback)
        SKIP_DOCKER_FALLBACK=1
        shift
        ;;
      --dry-run)
        DRY_RUN=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        warn "未知参数: $1"
        usage
        exit 1
        ;;
    esac
  done
}

main() {
  parse_args "$@"
  load_env_file
  prepare_dirs
  init_summary
  copy_templates

  run_gitleaks_scan
  run_npm_audits
  run_osv_scan
  run_govulncheck_scan
  run_gosec_scan
  run_semgrep_scan
  run_trivy_config_scan
  run_trivy_image_scans
  run_dast_scans
  append_postface

  log "完成，结果目录: ${OUTPUT_DIR}"
  log "汇总文件: ${SUMMARY_FILE}"
}

main "$@"
