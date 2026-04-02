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
  bash deploy/scripts/deploy_test.sh (--tag <git-tag> | --ref <git-ref>) --service <api|web|all>

Options:
  --tag <git-tag>          Optional. Release tag to deploy.
  --ref <git-ref>          Optional. Git branch / commit / ref to deploy.
  --service <scope>        Required. One of: api, web, all.
  --skip-backup            Optional. Skip backup step.
  --skip-git               Optional. Deploy current working tree without git fetch/checkout.
  --managed                Optional. Use managed DB/Redis/Tinode compose file.
  --help                   Show this help message.

Examples:
  bash deploy/scripts/deploy_test.sh --tag v1.2.3 --service api
  bash deploy/scripts/deploy_test.sh --ref origin/dev --service all
  bash deploy/scripts/deploy_test.sh --tag v1.2.3 --service web --managed
  bash deploy/scripts/deploy_test.sh --tag v1.2.3 --service all
EOF
}

TAG=""
DEPLOY_REF=""
SERVICE_SCOPE=""
SKIP_BACKUP="false"
SKIP_GIT="false"
USE_MANAGED="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --ref)
      DEPLOY_REF="${2:-}"
      shift 2
      ;;
    --service)
      SERVICE_SCOPE="${2:-}"
      shift 2
      ;;
    --skip-backup)
      SKIP_BACKUP="true"
      shift
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

if [[ -n "${TAG}" && -n "${DEPLOY_REF}" ]]; then
  echo "Use either --tag or --ref, not both." >&2
  usage >&2
  exit 1
fi

if [[ "${SKIP_GIT}" == "false" && -z "${TAG}" && -z "${DEPLOY_REF}" ]]; then
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
  echo "Please prepare deploy/.env.test before deploying test environment." >&2
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
    release_ensure_ref_exists "${DEPLOY_REF}"
    CHECKOUT_TARGET="${DEPLOY_REF}"
    STATE_TARGET_KIND="ref"
  fi
else
  echo "==> Git operations skipped; deploying current working tree"
fi

echo "==> Validating test compose configuration"
release_validate_compose

run_backup() {
  echo "==> Running test database backup"
  (
    if release_compose_has_service db; then
      mkdir -p "${REPO_ROOT}/deploy/backups/test"
      ts="$(date -u +%Y%m%dT%H%M%SZ)"
      out_file="${REPO_ROOT}/deploy/backups/test/${DB_NAME:-home_decoration_test}_${ts}.sql.gz"
      echo "Backing up test compose db service -> ${out_file}"
      release_compose exec -T db \
        pg_dump -U "${DB_USER:-postgres}" "${DB_NAME:-home_decoration_test}" --no-owner --no-privileges | gzip -c > "${out_file}"
      echo "OK: ${out_file}"
    elif [[ -n "${DATABASE_HOST:-}" && -n "${DATABASE_PORT:-}" && -n "${DATABASE_USER:-}" && -n "${DATABASE_PASSWORD:-}" ]]; then
      (
        cd "${REPO_ROOT}/deploy"
        BACKUP_DIR="./backups/test" bash "${REPO_ROOT}/deploy/scripts/backup_postgres.sh"
      )
    else
      echo "Backup skipped: test database backup env vars are incomplete." >&2
      exit 1
    fi
  )

  echo "==> Running test uploads backup"
  (
    cd "${REPO_ROOT}/deploy"
    BACKUP_DIR="./backups/test" UPLOADS_DIR="${UPLOADS_DIR:-../server/uploads_test}" bash "${REPO_ROOT}/deploy/scripts/backup_uploads.sh"
  )
}

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

  release_apply_known_migrations
}

action_summary() {
  echo "Environment: test"
  echo "Compose project: ${RELEASE_COMPOSE_PROJECT_NAME}"
  echo "Compose file: ${COMPOSE_FILE}"
  echo "Env file: ${DEPLOY_ENV_FILE}"
  echo "Local web port: ${RELEASE_LOCAL_PORT}"
}

action_summary

if [[ "${SKIP_BACKUP}" == "false" ]]; then
  run_backup
else
  echo "==> Skipping backup by request"
fi

if [[ "${SKIP_GIT}" == "false" ]]; then
  echo "==> Checking out ${CHECKOUT_TARGET}"
  release_checkout_ref "${CHECKOUT_TARGET}"
fi

update_services() {
  release_remove_conflicting_containers "${RELEASE_COMPOSE_PROJECT_NAME}" test_db test_redis test_api test_web test_tinode
  if release_scope_includes_api "${SERVICE_SCOPE}"; then
    ensure_test_schema
  else
    echo "==> Service scope does not include api; skip test schema bootstrap"
  fi

  case "${SERVICE_SCOPE}" in
    api)
      echo "==> Updating test service: api"
      release_update_service_isolated api
      ;;
    web)
      echo "==> Updating test service: web"
      release_update_service_isolated web
      ;;
    all)
      echo "==> Updating test services: api web"
      release_compose up -d --build api web
      ;;
  esac
}

verify_release() {
  release_verify_stack
}

update_services
verify_release
release_record_state "test" "deploy" "${CHECKOUT_TARGET}" "${SERVICE_SCOPE}" "${SKIP_GIT}" "${STATE_TARGET_KIND}"

echo ""
echo "Test deployment completed successfully."
echo "Checkout target: ${CHECKOUT_TARGET}"
echo "Service scope: ${SERVICE_SCOPE}"
echo "Skip git: ${SKIP_GIT}"
echo "Managed mode: ${USE_MANAGED}"
echo ""
echo "Recommended manual checks:"
echo "  - Verify test website homepage"
echo "  - Verify test admin entry: /admin/"
echo "  - Verify key test business APIs"
echo "  - Verify test data is isolated from production"
