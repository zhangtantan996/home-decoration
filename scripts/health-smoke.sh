#!/usr/bin/env bash
set -euo pipefail

API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:8080/api/v1/health}"
API_HEALTH_FALLBACK_URL="${API_HEALTH_FALLBACK_URL:-http://127.0.0.1:5175/api/v1/health}"

if curl -fsS "$API_HEALTH_URL" >/dev/null; then
  echo "health ok: $API_HEALTH_URL"
  exit 0
fi

if [[ -n "$API_HEALTH_FALLBACK_URL" ]] && curl -fsS "$API_HEALTH_FALLBACK_URL" >/dev/null; then
  echo "health ok: $API_HEALTH_FALLBACK_URL (fallback)"
  exit 0
fi

echo "health check failed: $API_HEALTH_URL (fallback: $API_HEALTH_FALLBACK_URL)" >&2
exit 1
