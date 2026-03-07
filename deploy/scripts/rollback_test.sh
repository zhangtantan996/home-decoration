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
  bash deploy/scripts/rollback_test.sh --tag <stable-git-tag> --service <api|web|all>

Options:
  --tag <stable-git-tag>   Required. Stable tag to roll back to.
  --service <scope>        Required. One of: api, web, all.
  --managed                Optional. Use managed DB/Redis/Tinode compose file.
  --help                   Show this help message.

Examples:
  bash deploy/scripts/rollback_test.sh --tag v1.2.2 --service api
  bash deploy/scripts/rollback_test.sh --tag v1.2.2 --service web --managed
  bash deploy/scripts/rollback_test.sh --tag v1.2.2 --service all
EOF
}

TAG=""
SERVICE_SCOPE=""
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
  echo "Please prepare deploy/.env.test before rollback." >&2
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

echo "==> Checking out rollback tag ${TAG}"
release_checkout_tag "${TAG}"

rollback_services() {
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

echo ""
echo "Test rollback completed successfully."
echo "Rollback tag: ${TAG}"
echo "Service scope: ${SERVICE_SCOPE}"
echo "Managed mode: ${USE_MANAGED}"
echo ""
echo "Reminder: test database rollback is NOT automatic."
echo "If this test release included schema changes, assess whether test DB rollback is necessary before executing any down SQL."
