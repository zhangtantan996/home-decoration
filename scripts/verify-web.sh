#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

node ./scripts/testing/run_command_suite.mjs \
  --suite verify-web \
  --step "frontend-style-web::npm run check:frontend-style:web" \
  --step "web-build::npm run build:web" \
  --step "user-web-fixture::npm run fixture:user-web" \
  --step "ensure-api::./scripts/testing/ensure_local_api.sh" \
  --step "user-web-api-smoke::npm run smoke:user-web:api" \
  --step "user-web-ui-smoke::npm run test:e2e:user-web"
