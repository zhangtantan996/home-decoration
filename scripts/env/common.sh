#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

normalize_app_env() {
  local raw="${1:-}"
  raw="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | xargs)"
  case "$raw" in
    ""|local|docker|dev|development)
      printf 'local\n'
      ;;
    test|testing)
      printf 'test\n'
      ;;
    stage|staging|pre|preprod|pre-production)
      printf 'staging\n'
      ;;
    prod|production|release)
      printf 'production\n'
      ;;
    *)
      printf 'local\n'
      ;;
  esac
}

require_env() {
  local key
  for key in "$@"; do
    if [[ -z "${!key:-}" ]]; then
      echo "Missing required environment variable: ${key}" >&2
      exit 1
    fi
  done
}

load_env_contract() {
  local requested_env="${1:-local}"
  export APP_ENV="$(normalize_app_env "$requested_env")"

  local env_file="${ROOT_DIR}/env/${APP_ENV}.env"
  if [[ -f "${env_file}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a
  fi

  case "$APP_ENV" in
    local)
      : "${API_BASE_URL:=http://localhost:8080}"
      : "${ADMIN_BASE_URL:=http://localhost:5173}"
      : "${WEB_BASE_URL:=http://localhost:5175}"
      : "${TINODE_SERVER_URL:=ws://localhost:6060}"
      ;;
    test)
      : "${API_BASE_URL:=http://127.0.0.1:8080}"
      : "${ADMIN_BASE_URL:=http://127.0.0.1:5173}"
      : "${WEB_BASE_URL:=http://127.0.0.1:5175}"
      : "${TINODE_SERVER_URL:=ws://127.0.0.1:6060}"
      ;;
    staging|production)
      require_env API_BASE_URL ADMIN_BASE_URL WEB_BASE_URL
      ;;
  esac

  API_BASE_URL="${API_BASE_URL%/}"
  ADMIN_BASE_URL="${ADMIN_BASE_URL%/}"
  WEB_BASE_URL="${WEB_BASE_URL%/}"
  SERVER_PUBLIC_URL="${SERVER_PUBLIC_URL:-$API_BASE_URL}"
  VITE_APP_ENV="${VITE_APP_ENV:-$APP_ENV}"
  VITE_API_URL="${VITE_API_URL:-${API_BASE_URL}/api/v1}"
  TARO_APP_ENV="${TARO_APP_ENV:-$APP_ENV}"
  TARO_APP_API_BASE="${TARO_APP_API_BASE:-${API_BASE_URL}/api/v1}"
  TARO_APP_H5_URL="${TARO_APP_H5_URL:-${WEB_BASE_URL}/}"
  TARO_APP_TINODE_URL="${TARO_APP_TINODE_URL:-${TINODE_SERVER_URL:-}}"
  TARO_APP_TINODE_API_KEY="${TARO_APP_TINODE_API_KEY:-${TINODE_API_KEY:-}}"
  E2E_API_BASE_URL="${E2E_API_BASE_URL:-${API_BASE_URL}/api/v1}"
  E2E_ADMIN_ORIGIN="${E2E_ADMIN_ORIGIN:-${ADMIN_BASE_URL}}"

  export APP_ENV API_BASE_URL ADMIN_BASE_URL WEB_BASE_URL SERVER_PUBLIC_URL
  export VITE_APP_ENV VITE_API_URL
  export TARO_APP_ENV TARO_APP_API_BASE TARO_APP_H5_URL TARO_APP_TINODE_URL TARO_APP_TINODE_API_KEY
  export TINODE_SERVER_URL TINODE_API_KEY
  export E2E_API_BASE_URL E2E_ADMIN_ORIGIN
}

print_effective_env() {
  cat <<PRINT
APP_ENV=${APP_ENV}
API_BASE_URL=${API_BASE_URL:-}
ADMIN_BASE_URL=${ADMIN_BASE_URL:-}
WEB_BASE_URL=${WEB_BASE_URL:-}
SERVER_PUBLIC_URL=${SERVER_PUBLIC_URL:-}
TINODE_SERVER_URL=${TINODE_SERVER_URL:-}
VITE_APP_ENV=${VITE_APP_ENV:-}
VITE_API_URL=${VITE_API_URL:-}
TARO_APP_ENV=${TARO_APP_ENV:-}
TARO_APP_API_BASE=${TARO_APP_API_BASE:-}
TARO_APP_H5_URL=${TARO_APP_H5_URL:-}
E2E_API_BASE_URL=${E2E_API_BASE_URL:-}
E2E_ADMIN_ORIGIN=${E2E_ADMIN_ORIGIN:-}
PRINT
}

write_mobile_env_file() {
  local target_file="${1:?target file required}"
  cat > "${target_file}" <<ENVFILE
APP_ENV=${APP_ENV}
API_BASE_URL=${API_BASE_URL:-}
WEB_BASE_URL=${WEB_BASE_URL:-}
TINODE_SERVER_URL=${TINODE_SERVER_URL:-}
TINODE_API_KEY=${TINODE_API_KEY:-}
ENVFILE
}
