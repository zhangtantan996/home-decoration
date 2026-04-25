#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

node ./scripts/testing/run_command_suite.mjs \
  --suite regression-nightly \
  --continue-on-error \
  --step "verify-backend::npm run verify:backend" \
  --step "verify-admin::npm run verify:admin" \
  --step "verify-merchant::npm run verify:merchant" \
  --step "verify-web::npm run verify:web" \
  --step "verify-mobile::npm run verify:mobile" \
  --step "verify-mini::npm run verify:mini" \
  --step "playwright-regression::./scripts/testing/run_playwright_stack.sh"
