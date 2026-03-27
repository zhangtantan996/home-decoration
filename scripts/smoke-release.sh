#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

node ./scripts/testing/run_command_suite.mjs \
  --suite smoke-release \
  --step "api-health::./scripts/health-smoke.sh" \
  --step "user-web-fixture::npm run fixture:user-web" \
  --step "identity-api-acceptance::npm run test:identity:acceptance:api" \
  --step "user-web-api-smoke::npm run smoke:user-web:api"
