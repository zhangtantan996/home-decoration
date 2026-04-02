#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

node ./scripts/testing/run_command_suite.mjs \
  --suite smoke-test \
  --step "api-health::./scripts/health-smoke.sh" \
  --step "user-web-fixture::npm run fixture:user-web" \
  --step "identity-api-acceptance::npm run test:identity:acceptance:api" \
  --step "user-web-api-smoke::npm run smoke:user-web:api" \
  --step "phase1-demand-api-smoke::./scripts/phase1-demand-real-api-smoke.sh" \
  --step "quote-workflow-api-smoke::./scripts/quote-workflow-v1-api-smoke.sh" \
  --step "phase2-contract-complaint-api-smoke::./scripts/phase2-contract-complaint-smoke.sh"
