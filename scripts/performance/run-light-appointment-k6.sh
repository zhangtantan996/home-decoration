#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8080/api/v1}"
export API_BASE_URL
PRODUCTION_API_HOSTS="${PRODUCTION_API_HOSTS:-api.hezeyunchuang.com,hezeyunchuang.com,www.hezeyunchuang.com}"
export PRODUCTION_API_HOSTS
K6_DOCKER_IMAGE="${K6_DOCKER_IMAGE:-grafana/k6:latest}"
K6_DOCKER_FALLBACK="${K6_DOCKER_FALLBACK:-1}"
K6_DOCKER_NETWORK="${K6_DOCKER_NETWORK:-}"

api_host() {
  local url="$1"
  url="${url#http://}"
  url="${url#https://}"
  url="${url%%/*}"
  url="${url%%:*}"
  printf '%s' "$url"
}

is_production_api_url() {
  local host
  host="$(api_host "$1")"
  [[ "$host" == "hezeyunchuang.com" || "$host" == *.hezeyunchuang.com ]] && return 0

  local item
  IFS=',' read -r -a hosts <<<"$PRODUCTION_API_HOSTS"
  for item in "${hosts[@]}"; do
    item="${item//[[:space:]]/}"
    [[ -n "$item" && "$host" == "$item" ]] && return 0
  done
  return 1
}

if [[ "${K6_ENABLE_WRITES:-0}" == "1" ]] && is_production_api_url "$API_BASE_URL"; then
  cat >&2 <<'EOF'
[perf][FAIL] 禁止对生产 API 开启 K6_ENABLE_WRITES=1。
当前没有测试/预发服务器时，写入压测只能打本地开发环境；生产只允许低强度只读探测。
EOF
  exit 2
fi

timestamp="$(date '+%Y%m%dT%H%M%S')"
output_dir="${K6_OUTPUT_DIR:-test-results/performance/light-appointment/${timestamp}}"
mkdir -p "$output_dir"

summary_json="${output_dir}/summary.json"
run_log="${output_dir}/run.log"

echo "[perf] API_BASE_URL=${API_BASE_URL}"
echo "[perf] K6_PROFILE=${K6_PROFILE:-read}"
echo "[perf] output=${output_dir}"

if command -v k6 >/dev/null 2>&1; then
  k6 run \
    --summary-export "$summary_json" \
    tests/performance/k6/light-appointment.js | tee "$run_log"
elif [[ "$K6_DOCKER_FALLBACK" == "1" ]] && command -v docker >/dev/null 2>&1; then
  if [[ "$API_BASE_URL" =~ ^https?://(127\.0\.0\.1|localhost)(:|/) && -z "$K6_DOCKER_NETWORK" ]]; then
    cat >&2 <<'EOF'
[perf] 本机未安装 k6，准备使用 Docker 版 k6，但 API_BASE_URL 指向 localhost。
Docker 容器内的 localhost 不是宿主机。请二选一：
  1) 安装本机 k6: brew install k6
  2) 使用 Docker 网络地址，例如：
     K6_DOCKER_NETWORK=home_decoration_dev-net API_BASE_URL=http://api:8080/api/v1 npm run perf:light-appointment
EOF
    exit 127
  fi

  docker_args=(run --rm -v "${ROOT_DIR}:/work" -w /work)
  if [[ -n "$K6_DOCKER_NETWORK" ]]; then
    docker_args+=(--network "$K6_DOCKER_NETWORK")
  fi

  for env_name in \
    API_BASE_URL K6_PROFILE K6_TARGET_VUS K6_PEAK_VUS K6_WARMUP_DURATION K6_STEADY_DURATION \
    K6_SPIKE_DURATION K6_COOLDOWN_DURATION K6_SLEEP_SECONDS OPS_ADMIN_TOKEN ADMIN_TOKEN \
    USER_TOKEN K6_ENABLE_WRITES K6_PROVIDER_ID K6_PROVIDER_TYPE PRODUCTION_API_HOSTS; do
    if [[ -n "${!env_name:-}" ]]; then
      docker_args+=(-e "$env_name=${!env_name}")
    fi
  done

  docker "${docker_args[@]}" "$K6_DOCKER_IMAGE" run \
    --summary-export "/work/${summary_json}" \
    tests/performance/k6/light-appointment.js | tee "$run_log"
else
  cat >&2 <<'EOF'
[perf] k6 未安装，且 Docker 兜底不可用。
安装参考：
  macOS: brew install k6
  Docker: 安装/启动 Docker 后重试，或设置 K6_DOCKER_FALLBACK=0 禁用兜底。
EOF
  exit 127
fi

echo "[perf] summary: ${summary_json}"
echo "[perf] log: ${run_log}"
