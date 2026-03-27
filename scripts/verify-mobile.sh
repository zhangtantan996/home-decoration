#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

node ./scripts/testing/run_command_suite.mjs \
  --suite verify-mobile \
  --step "mobile-lint::cd mobile && npm run lint" \
  --step "mobile-jest::cd mobile && npm test -- --no-watchman --runInBand"
