#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_PID=""
ADMIN_PID=""
MERCHANT_PID=""
WEB_PID=""
GATEWAY_PID=""

cleanup() {
  local exit_code="$1"
  if [[ "${exit_code}" -ne 0 ]]; then
    cat /tmp/home-decoration-playwright-api.log >/dev/null 2>&1 && cat /tmp/home-decoration-playwright-api.log || true
    cat /tmp/home-decoration-playwright-admin.log >/dev/null 2>&1 && cat /tmp/home-decoration-playwright-admin.log || true
    cat /tmp/home-decoration-playwright-merchant.log >/dev/null 2>&1 && cat /tmp/home-decoration-playwright-merchant.log || true
    cat /tmp/home-decoration-playwright-web.log >/dev/null 2>&1 && cat /tmp/home-decoration-playwright-web.log || true
    cat /tmp/home-decoration-playwright-gateway.log >/dev/null 2>&1 && cat /tmp/home-decoration-playwright-gateway.log || true
  fi
  for pid in "$GATEWAY_PID" "$WEB_PID" "$MERCHANT_PID" "$ADMIN_PID" "$API_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" >/dev/null 2>&1 || true
    fi
  done
  return "${exit_code}"
}
trap 'cleanup $?' EXIT

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-60}"
  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "ready: $label -> $url"
      return 0
    fi
    sleep 2
  done
  echo "timeout waiting for $label -> $url" >&2
  return 1
}

npm run fixture:user-web
npm run reset:user-web:rate-limit

APP_ENV=local \
DATABASE_HOST="${DATABASE_HOST:-127.0.0.1}" \
DATABASE_PORT="${DATABASE_PORT:-5432}" \
DATABASE_USER="${DATABASE_USER:-postgres}" \
DATABASE_PASSWORD="${DATABASE_PASSWORD:-postgres}" \
DATABASE_DBNAME="${DATABASE_DBNAME:-home_decoration}" \
DATABASE_NAME="${DATABASE_NAME:-home_decoration}" \
DATABASE_SSLMODE="${DATABASE_SSLMODE:-disable}" \
REDIS_HOST="${REDIS_HOST:-127.0.0.1}" \
REDIS_PORT="${REDIS_PORT:-6379}" \
REDIS_PASSWORD="${REDIS_PASSWORD:-}" \
JWT_SECRET="${JWT_SECRET:-test_suite_runner_jwt_secret_2026}" \
SMS_PROVIDER="${SMS_PROVIDER:-mock}" \
SMS_DEBUG_BYPASS="${SMS_DEBUG_BYPASS:-true}" \
SMS_RISK_ENABLED="${SMS_RISK_ENABLED:-false}" \
nohup bash -lc 'cd server && go run ./cmd/api' >/tmp/home-decoration-playwright-api.log 2>&1 &
API_PID="$!"

nohup bash -lc 'cd admin && VITE_ROUTER_BASENAME=/admin npm run dev -- --host 127.0.0.1 --port 5173' >/tmp/home-decoration-playwright-admin.log 2>&1 &
ADMIN_PID="$!"

nohup bash -lc 'cd merchant && VITE_ROUTER_BASENAME=/merchant npm run dev -- --host 127.0.0.1 --port 5174' >/tmp/home-decoration-playwright-merchant.log 2>&1 &
MERCHANT_PID="$!"

nohup bash -lc 'cd web && VITE_API_URL=http://127.0.0.1:8080/api/v1 VITE_ROUTER_BASENAME=/app npm run dev -- --host 127.0.0.1 --port 5176' >/tmp/home-decoration-playwright-web.log 2>&1 &
WEB_PID="$!"

nohup node ./scripts/testing/local_gateway.mjs >/tmp/home-decoration-playwright-gateway.log 2>&1 &
GATEWAY_PID="$!"

wait_for_url "http://127.0.0.1:8080/api/v1/health" "api"
wait_for_url "http://127.0.0.1:5173/admin" "admin"
wait_for_url "http://127.0.0.1:5174/merchant" "merchant"
wait_for_url "http://127.0.0.1:5176/app" "web"
wait_for_url "http://127.0.0.1:5175/app" "gateway"

E2E_API_BASE_URL="${E2E_API_BASE_URL:-http://127.0.0.1:8080/api/v1}" \
E2E_ADMIN_ORIGIN="${E2E_ADMIN_ORIGIN:-http://127.0.0.1:5175/admin}" \
ADMIN_ORIGIN="${ADMIN_ORIGIN:-http://127.0.0.1:5175/admin}" \
MERCHANT_ORIGIN="${MERCHANT_ORIGIN:-http://127.0.0.1:5175/merchant}" \
WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:5176}" \
USER_WEB_FIXTURE_DB_URL="${USER_WEB_FIXTURE_DB_URL:-}" \
npx playwright test
