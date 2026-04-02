#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

node ./scripts/testing/run_command_suite.mjs \
  --suite verify-mini \
  --step "mini-lint::cd mini && npm run lint" \
  --step "mini-build-weapp::cd mini && npm run build:weapp"
