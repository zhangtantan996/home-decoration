#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/deploy/docker-compose.prod.yml"
DEPLOY_ENV_FILE="${REPO_ROOT}/deploy/.env"
COMMON_LIB="${SCRIPT_DIR}/lib/release_common.sh"
VERIFY_HTTPS_SCRIPT="${SCRIPT_DIR}/verify_https.sh"

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

is_truthy() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]' | xargs)" in
    1|true|yes|on)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_safe_internal_host() {
  local host="${1:-}"
  host="$(printf '%s' "${host}" | tr '[:upper:]' '[:lower:]')"
  host="${host%%:*}"

  case "${host}" in
    localhost|127.0.0.1|::1|db|redis|prod_db|prod_redis|*.local|*.internal)
      return 0
      ;;
  esac

  if [[ "${host}" =~ ^10\. ]]; then
    return 0
  fi
  if [[ "${host}" =~ ^192\.168\. ]]; then
    return 0
  fi
  if [[ "${host}" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]]; then
    return 0
  fi

  return 1
}

validate_release_runtime() {
  local sms_provider
  sms_provider="$(printf '%s' "${SMS_PROVIDER:-}" | tr '[:upper:]' '[:lower:]' | xargs)"
  if [[ -z "${sms_provider}" ]]; then
    echo "Production deploy requires SMS_PROVIDER to be explicitly set." >&2
    exit 1
  fi
  if [[ "${sms_provider}" != "aliyun" ]]; then
    echo "Production deploy requires SMS_PROVIDER=aliyun, current=${SMS_PROVIDER}" >&2
    exit 1
  fi

  local real_name_provider license_provider
  real_name_provider="$(printf '%s' "${USER_REAL_NAME_VERIFY_PROVIDER:-}" | tr '[:upper:]' '[:lower:]' | xargs)"
  license_provider="$(printf '%s' "${LICENSE_VERIFY_PROVIDER:-}" | tr '[:upper:]' '[:lower:]' | xargs)"
  if [[ "${real_name_provider}" != "aliyun" ]]; then
    echo "Production deploy requires USER_REAL_NAME_VERIFY_PROVIDER=aliyun, current=${USER_REAL_NAME_VERIFY_PROVIDER:-<empty>}" >&2
    exit 1
  fi
  if [[ "${license_provider}" != "aliyun" ]]; then
    echo "Production deploy requires LICENSE_VERIFY_PROVIDER=aliyun, current=${LICENSE_VERIFY_PROVIDER:-<empty>}" >&2
    exit 1
  fi
  if [[ -z "${ALIYUN_VERIFY_ACCESS_KEY_ID:-}" || -z "${ALIYUN_VERIFY_ACCESS_KEY_SECRET:-}" ]]; then
    echo "Production deploy requires ALIYUN_VERIFY_ACCESS_KEY_ID and ALIYUN_VERIFY_ACCESS_KEY_SECRET." >&2
    exit 1
  fi
  if [[ -z "${ALIYUN_PERSON_VERIFY_AUTH_CODE:-}" ]]; then
    echo "Production deploy requires ALIYUN_PERSON_VERIFY_AUTH_CODE for personal real-name verification." >&2
    exit 1
  fi
  if [[ -z "${ALIYUN_ENTERPRISE_VERIFY_AUTH_CODE:-}" ]]; then
    echo "Production deploy requires ALIYUN_ENTERPRISE_VERIFY_AUTH_CODE for enterprise verification." >&2
    exit 1
  fi

  if [[ -z "${VITE_PUBLIC_SITE_URL:-}" || ! "${VITE_PUBLIC_SITE_URL}" =~ ^https:// ]]; then
    echo "Production deploy requires VITE_PUBLIC_SITE_URL to use https://, current=${VITE_PUBLIC_SITE_URL:-<empty>}" >&2
    exit 1
  fi

  if is_truthy "${ALIPAY_ENABLED:-false}"; then
    local required_alipay_keys=(
      ALIPAY_APP_ID
      ALIPAY_APP_PRIVATE_KEY
      ALIPAY_PUBLIC_KEY
    )
    local key
    for key in "${required_alipay_keys[@]}"; do
      if [[ -z "${!key:-}" ]]; then
        echo "Production deploy requires ${key} when ALIPAY_ENABLED=true." >&2
        exit 1
      fi
    done
  fi
}

validate_transport_safety() {
  if [[ -z "${SERVER_PUBLIC_URL:-}" || ! "${SERVER_PUBLIC_URL}" =~ ^https:// ]]; then
    echo "Production deploy requires SERVER_PUBLIC_URL to use https://, current=${SERVER_PUBLIC_URL:-<empty>}" >&2
    exit 1
  fi

  if [[ -n "${STORAGE_PUBLIC_BASE_URL:-}" && ! "${STORAGE_PUBLIC_BASE_URL}" =~ ^https:// ]]; then
    echo "Production deploy requires STORAGE_PUBLIC_BASE_URL to use https:// when set, current=${STORAGE_PUBLIC_BASE_URL}" >&2
    exit 1
  fi

  if [[ -n "${DATABASE_HOST:-}" ]] && ! is_safe_internal_host "${DATABASE_HOST}"; then
    echo "Production deploy requires DATABASE_HOST to be internal/private, current=${DATABASE_HOST}" >&2
    exit 1
  fi

  if [[ -n "${REDIS_HOST:-}" ]] && ! is_safe_internal_host "${REDIS_HOST}"; then
    echo "Production deploy requires REDIS_HOST to be internal/private, current=${REDIS_HOST}" >&2
    exit 1
  fi
}

validate_transport_safety
validate_release_runtime

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
    if release_compose_has_service db; then
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

ensure_prod_schema() {
  if ! release_compose_has_service db; then
    echo "==> Managed production database mode detected; skip local schema bootstrap"
    return 0
  fi

  echo "==> Starting production database dependencies"
  release_compose up -d db redis
  release_wait_for_postgres 30 2
  release_apply_known_migrations
}

update_services() {
  case "${SERVICE_SCOPE}" in
    api)
      echo "==> Updating service: api"
      release_update_service_isolated api
      ;;
    web)
      echo "==> Updating service: web"
      release_update_service_isolated web
      ;;
    all)
      echo "==> Updating services: api web"
      release_compose up -d --build api web
      ;;
  esac
}

verify_release() {
  release_verify_stack
  echo "==> Verifying external HTTPS routes"
  bash "${VERIFY_HTTPS_SCRIPT}"
}

if release_scope_includes_api "${SERVICE_SCOPE}"; then
  ensure_prod_schema
else
  echo "==> Service scope does not include api; skip schema bootstrap"
fi
update_services
verify_release
release_record_state "production" "deploy" "${TAG}" "${SERVICE_SCOPE}" "${SKIP_GIT}" "tag"

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
