#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

node ./scripts/testing/run_command_suite.mjs \
  --suite verify-ops \
  --step "frontend-style-ops::npm run check:frontend-style:ops" \
  --step "ops-lint::cd ops && npm run lint" \
  --step "ops-build::cd ops && VITE_API_URL=http://127.0.0.1:8080/api/v1 npm run build"
