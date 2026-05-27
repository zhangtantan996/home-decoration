#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

PORT="${SUPERVISOR_SMOKE_PORT:-4178}"
PREVIEW_PID=""
PREVIEW_LOG="/tmp/home-decoration-supervisor-preview.log"

cleanup() {
  if [[ -n "$PREVIEW_PID" ]] && kill -0 "$PREVIEW_PID" >/dev/null 2>&1; then
    kill "$PREVIEW_PID" >/dev/null 2>&1 || true
    wait "$PREVIEW_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

cd "$ROOT_DIR/supervisor"
npm run preview -- --host 127.0.0.1 --port "$PORT" --strictPort >"$PREVIEW_LOG" 2>&1 &
PREVIEW_PID="$!"

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
  cat "$PREVIEW_LOG" >&2 || true
  echo "supervisor preview did not become ready on port $PORT" >&2
  exit 1
fi

cd "$ROOT_DIR"
SUPERVISOR_BASE_URL="http://127.0.0.1:$PORT/apply" \
node ./scripts/testing/supervisor_apply_service_area_smoke.mjs
