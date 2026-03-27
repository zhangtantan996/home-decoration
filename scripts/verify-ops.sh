#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

node ./scripts/testing/run_command_suite.mjs \
  --suite verify-ops \
  --step "ops-node-test::if ls tests/ops/*.mjs >/dev/null 2>&1; then node --test tests/ops/*.mjs; else echo 'No ops tests found, skip'; fi"
