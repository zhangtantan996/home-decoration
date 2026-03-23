#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/deploy/docker-compose.test.yml"
DEPLOY_ENV_FILE="${REPO_ROOT}/deploy/.env.test"
COMMON_LIB="${SCRIPT_DIR}/lib/release_common.sh"
RELEASE_LOCAL_PORT_DEFAULT="8889"
RELEASE_COMPOSE_PROJECT_DEFAULT="home_decoration_test"

if [[ ! -f "${COMMON_LIB}" ]]; then
  echo "Missing shared release helper: ${COMMON_LIB}" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "${COMMON_LIB}"

usage() {
  cat <<'EOF'
Usage:
  bash deploy/scripts/rollback_test.sh (--tag <stable-git-tag> | --ref <git-ref>) --service <api|web|all>

Options:
  --tag <stable-git-tag>   Optional. Stable tag to roll back to.
  --ref <git-ref>          Optional. Git branch / commit / ref to roll back to.
  --service <scope>        Required. One of: api, web, all.
  --skip-git               Optional. Roll back from current working tree without git fetch/checkout.
  --managed                Optional. Use managed DB/Redis/Tinode compose file.
  --help                   Show this help message.

Examples:
  bash deploy/scripts/rollback_test.sh --tag v1.2.2 --service api
  bash deploy/scripts/rollback_test.sh --ref origin/dev --service all
  bash deploy/scripts/rollback_test.sh --tag v1.2.2 --service web --managed
  bash deploy/scripts/rollback_test.sh --tag v1.2.2 --service all
EOF
}

TAG=""
ROLLBACK_REF=""
SERVICE_SCOPE=""
SKIP_GIT="false"
USE_MANAGED="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --ref)
      ROLLBACK_REF="${2:-}"
      shift 2
      ;;
    --service)
      SERVICE_SCOPE="${2:-}"
      shift 2
      ;;
    --skip-git)
      SKIP_GIT="true"
      shift
      ;;
    --managed)
      USE_MANAGED="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -n "${TAG}" && -n "${ROLLBACK_REF}" ]]; then
  echo "Use either --tag or --ref, not both." >&2
  usage >&2
  exit 1
fi

if [[ "${SKIP_GIT}" == "false" && -z "${TAG}" && -z "${ROLLBACK_REF}" ]]; then
  echo "Missing required argument: --tag or --ref" >&2
  usage >&2
  exit 1
fi

case "${SERVICE_SCOPE}" in
  api|web|all)
    ;;
  *)
    echo "Invalid --service value: ${SERVICE_SCOPE:-<empty>}" >&2
    echo "Allowed values: api, web, all" >&2
    exit 1
    ;;
esac

if [[ "${USE_MANAGED}" == "true" ]]; then
  COMPOSE_FILE="${REPO_ROOT}/deploy/docker-compose.test.managed.yml"
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${DEPLOY_ENV_FILE}" ]]; then
  echo "Missing test deploy env file: ${DEPLOY_ENV_FILE}" >&2
  echo "Please prepare deploy/.env.test before rollback." >&2
  exit 1
fi

release_require_command docker
release_require_command curl

if [[ "${SKIP_GIT}" == "false" ]]; then
  release_require_command git
fi

release_load_deploy_env

RELEASE_COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-${RELEASE_COMPOSE_PROJECT_DEFAULT}}"
export RELEASE_COMPOSE_PROJECT_NAME

RELEASE_LOCAL_PORT="${WEB_PORT:-${RELEASE_LOCAL_PORT_DEFAULT}}"
export RELEASE_LOCAL_PORT

cd "${REPO_ROOT}"

CHECKOUT_TARGET="current-working-tree"
STATE_TARGET_KIND="working-tree"

if [[ "${SKIP_GIT}" == "false" ]]; then
  release_ensure_clean_worktree

  echo "==> Fetching latest tags"
  release_fetch_tags

  if [[ -n "${TAG}" ]]; then
    release_ensure_tag_exists "${TAG}"
    CHECKOUT_TARGET="${TAG}"
    STATE_TARGET_KIND="tag"
  else
    release_ensure_ref_exists "${ROLLBACK_REF}"
    CHECKOUT_TARGET="${ROLLBACK_REF}"
    STATE_TARGET_KIND="ref"
  fi
else
  echo "==> Git operations skipped; rolling back from current working tree"
fi

echo "==> Validating test compose configuration"
release_validate_compose

release_remove_conflicting_containers "${RELEASE_COMPOSE_PROJECT_NAME}" test_db test_redis test_api test_web test_tinode

ensure_test_schema() {
  if ! release_compose_has_service db; then
    echo "==> Managed test database mode detected; skip local schema bootstrap"
    return 0
  fi

  echo "==> Starting test database dependencies"
  release_compose up -d db redis
  release_wait_for_postgres 30 2

  if ! release_postgres_table_exists "users"; then
    echo "==> Empty test database detected, importing baseline snapshot public.sql"
    release_apply_postgres_sql_file "${REPO_ROOT}/public.sql"
  else
    echo "==> Test database baseline already exists"
  fi

  local reconcile_files=(
    "server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql"
    "server/migrations/v1.6.9_reconcile_high_risk_schema_guard.sql"
    "server/migrations/v1.10.7_add_p0_booking_and_completion.sql"
    "server/migrations/v1.10.8_add_project_risk_and_refund.sql"
    "server/migrations/v1.11.0_add_p2_finance_and_audit_log_support.sql"
    "server/migrations/v1.12.2_reconcile_commerce_runtime_schema.sql"
  )

  local reconcile_file
  for reconcile_file in "${reconcile_files[@]}"; do
    echo "==> Applying test reconcile migration: ${reconcile_file}"
    release_apply_postgres_sql_file "${REPO_ROOT}/${reconcile_file}" >/dev/null
  done
}

if [[ "${SKIP_GIT}" == "false" ]]; then
  echo "==> Checking out rollback target ${CHECKOUT_TARGET}"
  release_checkout_ref "${CHECKOUT_TARGET}"
fi

rollback_services() {
  ensure_test_schema

  case "${SERVICE_SCOPE}" in
    api)
      echo "==> Rolling back test service: api"
      release_compose up -d --build api
      ;;
    web)
      echo "==> Rolling back test service: web"
      release_compose up -d --build web
      ;;
    all)
      echo "==> Rolling back test services: api web"
      release_compose up -d --build api web
      ;;
  esac
}

verify_rollback() {
  release_verify_stack
}

rollback_services
verify_rollback
release_record_state "test" "rollback" "${CHECKOUT_TARGET}" "${SERVICE_SCOPE}" "${SKIP_GIT}" "${STATE_TARGET_KIND}"

echo ""
echo "Test rollback completed successfully."
echo "Rollback target: ${CHECKOUT_TARGET}"
echo "Service scope: ${SERVICE_SCOPE}"
echo "Skip git: ${SKIP_GIT}"
echo "Managed mode: ${USE_MANAGED}"
echo ""
echo "Reminder: test database rollback is NOT automatic."
echo "If this test release included schema changes, assess whether test DB rollback is necessary before executing any down SQL."
