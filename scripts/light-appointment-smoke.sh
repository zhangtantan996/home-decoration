#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8080/api/v1}"
API_BASE_URL="${API_BASE_URL%/}"
PRODUCTION_API_HOSTS="${PRODUCTION_API_HOSTS:-api.hezeyunchuang.com,hezeyunchuang.com,www.hezeyunchuang.com}"
OPS_ADMIN_TOKEN="${OPS_ADMIN_TOKEN:-}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
USER_TOKEN="${USER_TOKEN:-}"
ENABLE_WRITE_SMOKE="${ENABLE_WRITE_SMOKE:-0}"
SMOKE_PROVIDER_ID="${SMOKE_PROVIDER_ID:-}"
SMOKE_PROVIDER_TYPE="${SMOKE_PROVIDER_TYPE:-designer}"
LIGHT_SMOKE_EXEC_CONTAINER="${LIGHT_SMOKE_EXEC_CONTAINER:-}"

log() {
  printf '[light-smoke] %s\n' "$*"
}

fail() {
  printf '[light-smoke][FAIL] %s\n' "$*" >&2
  exit 1
}

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

if [[ "$ENABLE_WRITE_SMOKE" == "1" && -n "$LIGHT_SMOKE_EXEC_CONTAINER" && "${LIGHT_SMOKE_CONTAINER_MODE:-0}" != "1" ]]; then
  fail "LIGHT_SMOKE_EXEC_CONTAINER 仅用于容器内只读烟测；写入烟测请在本地开发 API 上直接运行"
fi

if [[ "$ENABLE_WRITE_SMOKE" == "1" ]] && is_production_api_url "$API_BASE_URL"; then
  fail "禁止对生产 API 开启 ENABLE_WRITE_SMOKE=1；生产只允许只读烟测"
fi

if [[ -n "$LIGHT_SMOKE_EXEC_CONTAINER" && "${LIGHT_SMOKE_CONTAINER_MODE:-0}" != "1" ]]; then
  log "run public read probes inside container: ${LIGHT_SMOKE_EXEC_CONTAINER}"
  docker exec -i \
    -e API_BASE_URL="$API_BASE_URL" \
    -e LIGHT_SMOKE_CONTAINER_MODE=1 \
    "$LIGHT_SMOKE_EXEC_CONTAINER" sh -s <<'SH'
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8080/api/v1}"
API_BASE_URL="${API_BASE_URL%/}"

log() {
  printf '[light-smoke] %s\n' "$*"
}

fail() {
  printf '[light-smoke][FAIL] %s\n' "$*" >&2
  exit 1
}

request() {
  path="$1"
  label="$2"
  tmp="/tmp/light-smoke-${label}-$$.json"

  if command -v wget >/dev/null 2>&1; then
    if ! wget -q -T 20 -O "$tmp" "${API_BASE_URL}${path}"; then
      cat "$tmp" 2>/dev/null || true
      rm -f "$tmp"
      fail "${label} 请求失败"
    fi
  elif command -v curl >/dev/null 2>&1; then
    status="$(curl -sS --connect-timeout 5 --max-time 20 -o "$tmp" -w '%{http_code}' "${API_BASE_URL}${path}" || true)"
    if [ "$status" -lt 200 ] 2>/dev/null || [ "$status" -ge 300 ] 2>/dev/null; then
      cat "$tmp" 2>/dev/null || true
      rm -f "$tmp"
      fail "${label} HTTP ${status:-curl_failed}"
    fi
  else
    fail "container missing wget/curl"
  fi

  rm -f "$tmp"
  log "ok ${label} GET ${path}"
}

request "/health" "api-health"
request "/homepage" "homepage"
request "/public/site-config" "public-site-config"
request "/providers?page=1&pageSize=6" "public-providers"
request "/designers?page=1&pageSize=6" "public-designers"
request "/companies?page=1&pageSize=6" "public-companies"
request "/foremen?page=1&pageSize=6" "public-foremen"
request "/material-shops?page=1&pageSize=6" "public-material-shops"
request "/inspiration?page=1&pageSize=6" "public-inspiration"
request "/regions/service-cities" "service-cities"
SH
  exit $?
fi

request() {
  local method="$1"
  local path="$2"
  local label="$3"
  local token="${4:-}"
  local body="${5:-}"

  local tmp
  tmp="$(mktemp)"
  local curl_args=(-sS --connect-timeout 5 --max-time 20 -o "$tmp" -w '%{http_code}' -X "$method" "${API_BASE_URL}${path}" -H 'Accept: application/json')
  if [[ -n "$token" ]]; then
    curl_args+=(-H "Authorization: Bearer ${token}")
  fi
  if [[ -n "$body" ]]; then
    curl_args+=(-H 'Content-Type: application/json' -d "$body")
  fi

  local status
  if ! status="$(curl "${curl_args[@]}")"; then
    rm -f "$tmp"
    fail "${label} 请求失败"
  fi

  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    printf '[light-smoke][BODY] %s\n' "$(head -c 500 "$tmp")" >&2
    rm -f "$tmp"
    fail "${label} HTTP ${status}"
  fi

  rm -f "$tmp"
  log "ok ${label} ${method} ${path}"
}

request GET "/health" "api-health"
request GET "/homepage" "homepage"
request GET "/public/site-config" "public-site-config"
request GET "/providers?page=1&pageSize=6" "public-providers"
request GET "/designers?page=1&pageSize=6" "public-designers"
request GET "/companies?page=1&pageSize=6" "public-companies"
request GET "/foremen?page=1&pageSize=6" "public-foremen"
request GET "/material-shops?page=1&pageSize=6" "public-material-shops"
request GET "/inspiration?page=1&pageSize=6" "public-inspiration"
request GET "/regions/service-cities" "service-cities"

if [[ -n "$OPS_ADMIN_TOKEN" ]]; then
  request GET "/ops-admin/bookings?page=1&pageSize=5" "ops-bookings" "$OPS_ADMIN_TOKEN"
  request GET "/ops-admin/quote-inquiries?page=1&pageSize=5" "ops-quote-inquiries" "$OPS_ADMIN_TOKEN"
  request GET "/ops-admin/providers?page=1&pageSize=5" "ops-providers" "$OPS_ADMIN_TOKEN"
  request GET "/ops-admin/material-shops?page=1&pageSize=5" "ops-material-shops" "$OPS_ADMIN_TOKEN"
  request GET "/ops-admin/projects?page=1&pageSize=5" "ops-projects" "$OPS_ADMIN_TOKEN"
else
  log "skip ops authenticated probes: OPS_ADMIN_TOKEN not set"
fi

if [[ -n "$ADMIN_TOKEN" ]]; then
  request GET "/admin/health" "admin-health-detail" "$ADMIN_TOKEN"
  request GET "/admin/users?page=1&pageSize=5" "admin-users" "$ADMIN_TOKEN"
else
  log "skip admin authenticated probes: ADMIN_TOKEN not set"
fi

if [[ "$ENABLE_WRITE_SMOKE" == "1" ]]; then
  if [[ -z "$USER_TOKEN" ]]; then
    fail "ENABLE_WRITE_SMOKE=1 requires USER_TOKEN"
  fi
  if [[ -z "$SMOKE_PROVIDER_ID" ]]; then
    fail "ENABLE_WRITE_SMOKE=1 requires SMOKE_PROVIDER_ID"
  fi

  now_suffix="$(date +%H%M%S)"
  quote_body=$(cat <<JSON
{"address":"西安市雁塔区轻预约烟测${now_suffix}号","cityCode":"610100","area":96,"houseLayout":"三室两厅","renovationType":"旧房翻新","style":"现代简约","budgetRange":"20-30万","phone":"1990000${now_suffix:0:4}","source":"launch_smoke"}
JSON
)
  booking_body=$(cat <<JSON
{"providerId":${SMOKE_PROVIDER_ID},"providerType":"${SMOKE_PROVIDER_TYPE}","address":"西安市雁塔区轻预约烟测${now_suffix}号","area":96,"renovationType":"旧房翻新","budgetRange":"20-30万","preferredDate":"2026-06-18 上午","phone":"1990000${now_suffix:0:4}","notes":"launch smoke test"}
JSON
)
  feedback_body='{"type":"suggestion","content":"launch smoke test feedback","contact":"19900000000"}'

  request POST "/quote-inquiries" "write-quote-inquiry" "" "$quote_body"
  request POST "/bookings" "write-booking" "$USER_TOKEN" "$booking_body"
  request POST "/user/feedback" "write-feedback" "$USER_TOKEN" "$feedback_body"
else
  log "skip write probes: ENABLE_WRITE_SMOKE is not 1"
fi
