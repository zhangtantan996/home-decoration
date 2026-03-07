#!/usr/bin/env bash

release_require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

release_compose() {
  docker compose --env-file "${DEPLOY_ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

release_load_deploy_env() {
  set -a
  # shellcheck source=/dev/null
  source "${DEPLOY_ENV_FILE}"
  set +a
}

release_ensure_clean_worktree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Working tree is not clean. Commit or stash local changes before continuing." >&2
    exit 1
  fi
}

release_fetch_tags() {
  git fetch --tags --prune
}

release_ensure_tag_exists() {
  local tag="$1"
  if ! git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
    echo "Git tag not found: ${tag}" >&2
    exit 1
  fi
}

release_validate_compose() {
  release_compose config >/dev/null
}

release_checkout_tag() {
  local tag="$1"
  git checkout --detach "${tag}"
}

release_parse_url_host() {
  local raw="${1:-}"
  local without_scheme="${raw#*://}"
  local host_and_path="${without_scheme%%/*}"
  printf '%s\n' "${host_and_path%%:*}"
}

release_resolve_api_host() {
  if [[ -n "${DEPLOY_API_HOST:-}" ]]; then
    printf '%s\n' "${DEPLOY_API_HOST}"
    return
  fi

  if [[ -n "${API_HOST:-}" ]]; then
    printf '%s\n' "${API_HOST}"
    return
  fi

  if [[ -n "${SERVER_PUBLIC_URL:-}" ]]; then
    release_parse_url_host "${SERVER_PUBLIC_URL}"
    return
  fi

  printf '\n'
}

release_resolve_admin_host() {
  local api_host="${1:-}"

  if [[ -n "${DEPLOY_ADMIN_HOST:-}" ]]; then
    printf '%s\n' "${DEPLOY_ADMIN_HOST}"
    return
  fi

  if [[ -n "${ADMIN_HOST:-}" ]]; then
    printf '%s\n' "${ADMIN_HOST}"
    return
  fi

  if [[ -z "${api_host}" ]]; then
    api_host="$(release_resolve_api_host)"
  fi

  if [[ "${api_host}" == api.* ]]; then
    printf 'admin.%s\n' "${api_host#api.}"
    return
  fi

  printf '\n'
}

release_resolve_website_host() {
  local api_host="${1:-}"

  if [[ -n "${DEPLOY_WEBSITE_HOST:-}" ]]; then
    printf '%s\n' "${DEPLOY_WEBSITE_HOST}"
    return
  fi

  if [[ -n "${WEBSITE_HOST:-}" ]]; then
    printf '%s\n' "${WEBSITE_HOST}"
    return
  fi

  if [[ -n "${ROOT_DOMAIN:-}" ]]; then
    printf '%s\n' "${ROOT_DOMAIN}"
    return
  fi

  if [[ -z "${api_host}" ]]; then
    api_host="$(release_resolve_api_host)"
  fi

  if [[ "${api_host}" == api.* ]]; then
    printf '%s\n' "${api_host#api.}"
    return
  fi

  printf '\n'
}

release_probe_host_path() {
  local host="$1"
  local path="$2"
  local label="$3"
  local local_port="${RELEASE_LOCAL_PORT:-8888}"

  curl -fsS -H "Host: ${host}" "http://127.0.0.1:${local_port}${path}" >/dev/null
  echo "${label} passed: http://127.0.0.1:${local_port}${path} (Host: ${host})"
}

release_verify_stack() {
  local api_host
  local website_host
  local admin_host

  echo "==> Checking container status"
  release_compose ps

  echo "==> Tail api logs"
  release_compose logs --tail=50 api || true

  echo "==> Tail web logs"
  release_compose logs --tail=50 web || true

  api_host="$(release_resolve_api_host)"
  if [[ -z "${api_host}" ]]; then
    echo "Unable to resolve API host for health check. Set DEPLOY_API_HOST or SERVER_PUBLIC_URL in deploy/.env." >&2
    return 1
  fi

  echo "==> Running API health check"
  release_probe_host_path "${api_host}" "/api/v1/health" "API health check"

  website_host="$(release_resolve_website_host "${api_host}")"
  if [[ -n "${website_host}" ]]; then
    echo "==> Running website routing check"
    release_probe_host_path "${website_host}" "/" "Website routing check"
  else
    echo "==> Skipping website routing check (set DEPLOY_WEBSITE_HOST to enable)"
  fi

  admin_host="$(release_resolve_admin_host "${api_host}")"
  if [[ -n "${admin_host}" ]]; then
    echo "==> Running admin routing check"
    release_probe_host_path "${admin_host}" "/admin/" "Admin routing check"
  else
    echo "==> Skipping admin routing check (set DEPLOY_ADMIN_HOST to enable)"
  fi
}
