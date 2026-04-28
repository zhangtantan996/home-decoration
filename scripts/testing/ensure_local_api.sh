#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:8080/api/v1/health}"
API_LOG_FILE="${API_LOG_FILE:-/tmp/home-decoration-verify-web-api.log}"
API_PID_FILE="${API_PID_FILE:-/tmp/home-decoration-verify-web-api.pid}"

if curl -fsS "$API_HEALTH_URL" >/dev/null 2>&1; then
  echo "API already ready: $API_HEALTH_URL"
  exit 0
fi

if [[ -f "$API_PID_FILE" ]] && kill -0 "$(cat "$API_PID_FILE")" >/dev/null 2>&1; then
  echo "API process exists but health is not ready yet: pid=$(cat "$API_PID_FILE")"
else
  echo "Starting local API for verification"
  start_cmd=(bash -lc 'cd server && exec go run ./cmd/api')
  if command -v setsid >/dev/null 2>&1; then
    start_cmd=(setsid "${start_cmd[@]}")
  fi

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
    JWT_SECRET="${JWT_SECRET:-verify_web_jwt_secret_2026}" \
    SMS_PROVIDER="${SMS_PROVIDER:-mock}" \
    SMS_DEBUG_BYPASS="${SMS_DEBUG_BYPASS:-true}" \
    SMS_RISK_ENABLED="${SMS_RISK_ENABLED:-false}" \
    nohup "${start_cmd[@]}" >"$API_LOG_FILE" 2>&1 &
  echo $! >"$API_PID_FILE"
fi

for _ in $(seq 1 60); do
  if curl -fsS "$API_HEALTH_URL" >/dev/null 2>&1; then
    echo "API ready: $API_HEALTH_URL"
    exit 0
  fi
  if [[ -f "$API_PID_FILE" ]] && ! kill -0 "$(cat "$API_PID_FILE")" >/dev/null 2>&1; then
    echo "API process exited before health became ready: pid=$(cat "$API_PID_FILE")" >&2
    cat "$API_LOG_FILE" >&2 || true
    exit 1
  fi
  sleep 2
done

echo "API did not become healthy: $API_HEALTH_URL" >&2
cat "$API_LOG_FILE" >&2 || true
exit 1
