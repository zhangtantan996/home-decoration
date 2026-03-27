#!/usr/bin/env bash
set -euo pipefail

API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:8080/api/v1/health}"

curl -fsS "$API_HEALTH_URL" >/dev/null
echo "health ok: $API_HEALTH_URL"
