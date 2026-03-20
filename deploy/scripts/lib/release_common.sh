#!/usr/bin/env bash

release_require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

release_compose() {
  local compose_args=()
  if [[ -n "${RELEASE_COMPOSE_PROJECT_NAME:-}" ]]; then
    compose_args+=(-p "${RELEASE_COMPOSE_PROJECT_NAME}")
  fi

  docker compose "${compose_args[@]}" --env-file "${DEPLOY_ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
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

release_ensure_ref_exists() {
  local ref="$1"
  if ! git rev-parse -q --verify "${ref}^{commit}" >/dev/null; then
    echo "Git ref not found: ${ref}" >&2
    exit 1
  fi
}

release_ensure_tag_exists() {
  local tag="$1"
  if ! git rev-parse -q --verify "refs/tags/${tag}^{commit}" >/dev/null; then
    echo "Git tag not found: ${tag}" >&2
    exit 1
  fi
}

release_validate_compose() {
  release_compose config >/dev/null
}

release_compose_has_service() {
  local service_name="$1"
  local services

  services="$(release_compose config --services 2>/dev/null || true)"
  if [[ -z "${services}" ]]; then
    return 1
  fi

  printf '%s\n' "${services}" | grep -q "^${service_name}$"
}

release_wait_for_postgres() {
  local attempts="${1:-30}"
  local delay_seconds="${2:-2}"
  local attempt

  for ((attempt=1; attempt<=attempts; attempt++)); do
    if release_compose exec -T db pg_isready -U "${DB_USER:-postgres}" -d "${DB_NAME:-home_decoration}" >/dev/null 2>&1; then
      return 0
    fi

    if (( attempt == attempts )); then
      echo "Postgres did not become ready after ${attempts} attempts." >&2
      return 1
    fi

    sleep "${delay_seconds}"
  done
}

release_postgres_table_exists() {
  local table_name="$1"
  release_compose exec -T db \
    psql -U "${DB_USER:-postgres}" -d "${DB_NAME:-home_decoration}" -Atqc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table_name}' LIMIT 1;" 2>/dev/null | grep -qx '1'
}

release_apply_postgres_sql_file() {
  local sql_file="$1"

  if [[ ! -f "${sql_file}" ]]; then
    echo "SQL file not found: ${sql_file}" >&2
    return 1
  fi

  release_compose exec -T db \
    psql -v ON_ERROR_STOP=1 -U "${DB_USER:-postgres}" -d "${DB_NAME:-home_decoration}" < "${sql_file}"
}

release_checkout_ref() {
  local ref="$1"
  git checkout --detach "${ref}"
}

release_checkout_tag() {
  local tag="$1"
  release_checkout_ref "${tag}"
}

release_parse_url_host() {
  local raw="${1:-}"
  local without_scheme="${raw#*://}"
  local host_and_path="${without_scheme%%/*}"
  printf '%s\n' "${host_and_path%%:*}"
}

release_container_project() {
  local container_name="$1"
  docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "${container_name}" 2>/dev/null || true
}

release_remove_conflicting_containers() {
  local expected_project="$1"
  shift

  local container_name
  local current_project

  for container_name in "$@"; do
    if ! docker inspect "${container_name}" >/dev/null 2>&1; then
      continue
    fi

    current_project="$(release_container_project "${container_name}")"
    if [[ -n "${current_project}" && "${current_project}" == "${expected_project}" ]]; then
      continue
    fi

    echo "==> Removing conflicting container ${container_name} (current project: ${current_project:-<none>}, expected: ${expected_project})"
    docker rm -f "${container_name}" >/dev/null
  done
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
  local attempts="${RELEASE_HEALTHCHECK_ATTEMPTS:-20}"
  local delay_seconds="${RELEASE_HEALTHCHECK_DELAY:-3}"
  local max_time="${RELEASE_HEALTHCHECK_MAX_TIME:-10}"
  local attempt

  for ((attempt=1; attempt<=attempts; attempt++)); do
    if curl -fsS -o /dev/null --max-time "${max_time}" -H "Host: ${host}" "http://127.0.0.1:${local_port}${path}"; then
      echo "${label} passed: http://127.0.0.1:${local_port}${path} (Host: ${host})"
      return 0
    fi

    if (( attempt == attempts )); then
      echo "${label} failed after ${attempts} attempts: http://127.0.0.1:${local_port}${path} (Host: ${host})" >&2
      return 1
    fi

    echo "${label} not ready yet (${attempt}/${attempts}), retrying in ${delay_seconds}s..."
    sleep "${delay_seconds}"
  done
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
