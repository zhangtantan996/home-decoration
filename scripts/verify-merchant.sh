#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

node ./scripts/testing/run_command_suite.mjs \
  --suite verify-merchant \
  --step "frontend-style-merchant::npm run check:frontend-style:merchant" \
  --step "merchant-build::cd merchant && VITE_API_URL=http://127.0.0.1:8080/api/v1 npm run build"
