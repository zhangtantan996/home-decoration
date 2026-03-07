#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/deploy/docker-compose.test.yml"
DEPLOY_ENV_FILE="${REPO_ROOT}/deploy/.env.test"
COMMON_LIB="${SCRIPT_DIR}/lib/release_common.sh"
RELEASE_LOCAL_PORT_DEFAULT="8889"

if [[ ! -f "${COMMON_LIB}" ]]; then
  echo "Missing shared release helper: ${COMMON_LIB}" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "${COMMON_LIB}"

usage() {
  cat <<'EOF'
Usage:
  bash deploy/scripts/deploy_test.sh --tag <git-tag> --service <api|web|all>

Options:
  --tag <git-tag>          Required. Release tag to deploy.
  --service <scope>        Required. One of: api, web, all.
  --skip-backup            Optional. Skip backup step.
  --managed                Optional. Use managed DB/Redis/Tinode compose file.
  --help                   Show this help message.

Examples:
  bash deploy/scripts/deploy_test.sh --tag v1.2.3 --service api
  bash deploy/scripts/deploy_test.sh --tag v1.2.3 --service web --managed
  bash deploy/scripts/deploy_test.sh --tag v1.2.3 --service all
EOF
}

TAG=""
SERVICE_SCOPE=""
SKIP_BACKUP="false"
USE_MANAGED="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
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

if [[ -z "${TAG}" ]]; then
  echo "Missing required argument: --tag" >&2
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

release_require_command git
release_require_command docker
release_require_command curl
release_load_deploy_env

RELEASE_LOCAL_PORT="${WEB_PORT:-${RELEASE_LOCAL_PORT_DEFAULT}}"
export RELEASE_LOCAL_PORT

cd "${REPO_ROOT}"

release_ensure_clean_worktree

echo "==> Fetching latest tags"
release_fetch_tags

release_ensure_tag_exists "${TAG}"

echo "==> Validating test compose configuration"
release_validate_compose

run_backup() {
  echo "==> Running test database backup"
  (
    if release_compose config --services | grep -qx 'db'; then
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

action_summary() {
  echo "Environment: test"
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

echo "==> Checking out tag ${TAG}"
release_checkout_tag "${TAG}"

update_services() {
  case "${SERVICE_SCOPE}" in
    api)
      echo "==> Updating test service: api"
      release_compose up -d --build api
      ;;
    web)
      echo "==> Updating test service: web"
      release_compose up -d --build web
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

echo ""
echo "Test deployment completed successfully."
echo "Tag: ${TAG}"
echo "Service scope: ${SERVICE_SCOPE}"
echo "Managed mode: ${USE_MANAGED}"
echo ""
echo "Recommended manual checks:"
echo "  - Verify test website homepage"
echo "  - Verify test admin entry: /admin/"
echo "  - Verify key test business APIs"
echo "  - Verify test data is isolated from production"
