#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/deploy/docker-compose.prod.yml"
DEPLOY_ENV_FILE="${REPO_ROOT}/deploy/.env"
COMMON_LIB="${SCRIPT_DIR}/lib/release_common.sh"

if [[ ! -f "${COMMON_LIB}" ]]; then
  echo "Missing shared release helper: ${COMMON_LIB}" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "${COMMON_LIB}"

usage() {
  cat <<'EOF'
Usage:
  bash deploy/scripts/rollback_prod.sh --tag <stable-git-tag> --service <api|web|all>

Options:
  --tag <stable-git-tag>   Required. Stable tag to roll back to.
  --service <scope>        Required. One of: api, web, all.
  --help                   Show this help message.

Examples:
  bash deploy/scripts/rollback_prod.sh --tag v1.2.2 --service api
  bash deploy/scripts/rollback_prod.sh --tag v1.2.2 --service web
  bash deploy/scripts/rollback_prod.sh --tag v1.2.2 --service all
EOF
}

TAG=""
SERVICE_SCOPE=""

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

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${DEPLOY_ENV_FILE}" ]]; then
  echo "Missing deploy env file: ${DEPLOY_ENV_FILE}" >&2
  echo "Please prepare deploy/.env before rollback." >&2
  exit 1
fi

release_require_command git
release_require_command docker
release_require_command curl
release_load_deploy_env

cd "${REPO_ROOT}"

release_ensure_clean_worktree

echo "==> Fetching latest tags"
release_fetch_tags

release_ensure_tag_exists "${TAG}"

echo "==> Validating compose configuration"
release_validate_compose

echo "==> Checking out rollback tag ${TAG}"
release_checkout_tag "${TAG}"

rollback_services() {
  case "${SERVICE_SCOPE}" in
    api)
      echo "==> Rolling back service: api"
      release_compose up -d --build api
      ;;
    web)
      echo "==> Rolling back service: web"
      release_compose up -d --build web
      ;;
    all)
      echo "==> Rolling back services: api web"
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
echo "Rollback completed successfully."
echo "Rollback tag: ${TAG}"
echo "Service scope: ${SERVICE_SCOPE}"
echo ""
echo "Reminder: database rollback is NOT automatic."
echo "If this release included schema changes, assess whether DB rollback is necessary before executing any down SQL."
