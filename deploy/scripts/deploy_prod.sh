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
  bash deploy/scripts/deploy_prod.sh --tag <git-tag> --service <api|web|all>

Options:
  --tag <git-tag>          Required. Release tag to deploy.
  --service <scope>        Required. One of: api, web, all.
  --skip-backup            Optional. Skip backup step.
  --skip-git               Optional. Deploy current working tree without git fetch/checkout.
  --help                   Show this help message.

Examples:
  bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service api
  bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service web
  bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service all
EOF
}

TAG=""
SERVICE_SCOPE=""
SKIP_BACKUP="false"
SKIP_GIT="false"

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
    --skip-git)
      SKIP_GIT="true"
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

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${DEPLOY_ENV_FILE}" ]]; then
  echo "Missing deploy env file: ${DEPLOY_ENV_FILE}" >&2
  echo "Please prepare deploy/.env before deploying." >&2
  exit 1
fi

release_require_command docker
release_require_command curl

if [[ "${SKIP_GIT}" == "false" ]]; then
  release_require_command git
fi

release_load_deploy_env

cd "${REPO_ROOT}"

if [[ "${SKIP_GIT}" == "false" ]]; then
  release_ensure_clean_worktree

  echo "==> Fetching latest tags"
  release_fetch_tags

  release_ensure_tag_exists "${TAG}"
else
  echo "==> Git operations skipped; deploying current working tree"
fi

echo "==> Validating compose configuration"
release_validate_compose

run_backup() {
  echo "==> Running database backup"
  (
    if release_compose config --services | grep -qx 'db'; then
      mkdir -p "${REPO_ROOT}/deploy/backups"
      ts="$(date -u +%Y%m%dT%H%M%SZ)"
      out_file="${REPO_ROOT}/deploy/backups/${DB_NAME:-home_decoration}_${ts}.sql.gz"
      echo "Backing up compose db service -> ${out_file}"
      release_compose exec -T db \
        pg_dump -U "${DB_USER:-postgres}" "${DB_NAME:-home_decoration}" --no-owner --no-privileges | gzip -c > "${out_file}"
      echo "OK: ${out_file}"
    elif [[ -n "${DATABASE_HOST:-}" && -n "${DATABASE_PORT:-}" && -n "${DATABASE_USER:-}" && -n "${DATABASE_PASSWORD:-}" ]]; then
      bash "${REPO_ROOT}/deploy/scripts/backup_postgres.sh"
    else
      echo "Backup skipped: database backup env vars are incomplete." >&2
      exit 1
    fi
  )

  echo "==> Running uploads backup"
  (
    cd "${REPO_ROOT}/deploy"
    bash "${REPO_ROOT}/deploy/scripts/backup_uploads.sh"
  )
}

if [[ "${SKIP_BACKUP}" == "false" ]]; then
  run_backup
else
  echo "==> Skipping backup by request"
fi

if [[ "${SKIP_GIT}" == "false" ]]; then
  echo "==> Checking out tag ${TAG}"
  release_checkout_tag "${TAG}"
fi

update_services() {
  case "${SERVICE_SCOPE}" in
    api)
      echo "==> Updating service: api"
      release_compose up -d --build api
      ;;
    web)
      echo "==> Updating service: web"
      release_compose up -d --build web
      ;;
    all)
      echo "==> Updating services: api web"
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
echo "Deployment completed successfully."
echo "Tag: ${TAG}"
echo "Service scope: ${SERVICE_SCOPE}"
echo "Skip git: ${SKIP_GIT}"
echo ""
echo "Recommended manual checks:"
echo "  - Verify website homepage"
echo "  - Verify admin entry: /admin/"
echo "  - Verify key business APIs"
echo "  - If nginx changed, verify website/admin/api routes"
