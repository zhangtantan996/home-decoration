#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

export APP_ENV="${APP_ENV:-local}"
export DATABASE_HOST="${DATABASE_HOST:-127.0.0.1}"
export DATABASE_PORT="${DATABASE_PORT:-5432}"
export DATABASE_USER="${DATABASE_USER:-postgres}"
export DATABASE_PASSWORD="${DATABASE_PASSWORD:-postgres}"
export DATABASE_DBNAME="${DATABASE_DBNAME:-home_decoration}"
export DATABASE_NAME="${DATABASE_NAME:-$DATABASE_DBNAME}"
export DATABASE_SSLMODE="${DATABASE_SSLMODE:-disable}"
export REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export REDIS_PASSWORD="${REDIS_PASSWORD:-}"
export JWT_SECRET="${JWT_SECRET:-test_verify_backend_jwt_secret_2026}"

node ./scripts/testing/run_command_suite.mjs \
  --suite verify-backend \
  --step "go-vet::cd server && go vet ./..." \
  --step "go-test::cd server && go test ./..."
