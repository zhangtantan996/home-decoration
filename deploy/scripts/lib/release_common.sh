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

release_scope_includes_api() {
  case "${1:-}" in
    api|all)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

release_update_service_isolated() {
  local service_name="$1"
  release_compose up -d --build --no-deps "${service_name}"
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
  local prepared_sql_file
  local status=0

  if [[ ! -f "${sql_file}" ]]; then
    echo "SQL file not found: ${sql_file}" >&2
    return 1
  fi

  prepared_sql_file="$(mktemp)"

  if grep -Eq '^[[:space:]]*--[[:space:]]+up[[:space:]]*$' "${sql_file}"; then
    awk '
      BEGIN { in_up = 0 }
      /^[[:space:]]*--[[:space:]]+up[[:space:]]*$/ {
        in_up = 1
        next
      }
      /^[[:space:]]*--[[:space:]]+down[[:space:]]*$/ {
        exit
      }
      in_up {
        print
      }
    ' "${sql_file}" > "${prepared_sql_file}"
  else
    cat "${sql_file}" > "${prepared_sql_file}"
  fi

  if [[ ! -s "${prepared_sql_file}" ]]; then
    rm -f "${prepared_sql_file}"
    echo "SQL file has no executable content: ${sql_file}" >&2
    return 1
  fi

  if release_compose exec -T db \
    psql -v ON_ERROR_STOP=1 -U "${DB_USER:-postgres}" -d "${DB_NAME:-home_decoration}" < "${prepared_sql_file}"; then
    status=0
  else
    status=$?
  fi

  rm -f "${prepared_sql_file}"
  return "${status}"
}

release_apply_known_migrations() {
  local migration_files=(
    "server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql"
    "server/migrations/v1.6.9_reconcile_high_risk_schema_guard.sql"
    "server/migrations/v1.9.12_normalize_provider_price_unit_to_sqm.sql"
    "server/migrations/v1.9.13_add_official_provider_review_project_link.sql"
    "server/migrations/v1.9.14_add_claimed_completion_onboarding_columns.sql"
    "server/migrations/v1.9.15_add_admin_security_columns.sql"
    "server/migrations/v1.9.16_add_provider_display_name.sql"
    "server/migrations/v1.9.18_add_user_real_name_verification_fields.sql"
    "server/migrations/v1.9.19_add_enterprise_license_verification_fields.sql"
    "server/migrations/v1.10.7_add_p0_booking_and_completion.sql"
    "server/migrations/v1.10.8_add_project_risk_and_refund.sql"
    "server/migrations/v1.11.0_add_p2_finance_and_audit_log_support.sql"
    "server/migrations/v1.12.2_reconcile_commerce_runtime_schema.sql"
    "server/migrations/v1.12.3_add_alipay_payment_runtime.sql"
    "server/migrations/v1.9.17_backfill_booking_survey_deposit_from_intent_fee.sql"
    "server/migrations/v1.12.11_hide_legacy_risk_arbitration_menu.sql"
    "server/migrations/v1.12.12_add_payment_central_runtime.sql"
    "server/migrations/v1.12.13_add_settlement_and_bond_domains.sql"
    "server/migrations/v1.12.14_cleanup_legacy_bond_rule_config.sql"
    "server/migrations/v1.13.0_add_order_center_menu_and_indexes.sql"
    "server/migrations/v1.13.1_cleanup_duplicate_admin_menus.sql"
    "server/migrations/v1.13.2_add_unique_index_sys_menus_button_permission.sql"
    "server/migrations/v1.13.3_add_supervision_workspace_menu.sql"
    "server/migrations/v1.13.4_add_public_visibility_switches.sql"
    "server/migrations/v1.13.5_align_booking_budget_bridge_schema.sql"
    "server/migrations/v1.13.6_reconcile_quote_runtime_schema.sql"
    "server/migrations/v1.13.7_link_change_orders_to_payment_plans.sql"
    "server/migrations/v1.14.0_add_quote_inquiries.sql"
    "server/migrations/v1.14.1_restructure_admin_quote_erp_menu.sql"
    "server/migrations/v1.14.2_payment_refund_projection_and_money_cents.sql"
    "server/migrations/v1.14.3_add_admin_payment_order_menu.sql"
    "server/migrations/v1.14.3_add_outbox_events.sql"
    "server/migrations/v1.14.4_reconcile_contract_runtime_schema.sql"
    "server/migrations/v1.14.5_add_reconciliation_runtime_tables.sql"
    "server/migrations/v1.14.6_add_booking_survey_deposit_status.sql"
    "server/migrations/v1.14.7_reconcile_admin_finance_role_permissions.sql"
    "server/migrations/v1.15.0_unified_identity_center.sql"
    "server/migrations/v1.15.0_backfill_identity_data.sql"
  )
  local migration_file
  local latest_known_migration
  local unlisted_newer_migrations

  if ! release_compose_has_service db; then
    echo "==> Compose database service not present; skip bundled SQL migrations"
    return 0
  fi

  latest_known_migration="$(basename "${migration_files[${#migration_files[@]}-1]}")"
  unlisted_newer_migrations="$(
    find "${REPO_ROOT}/server/migrations" -maxdepth 1 -type f -name 'v*.sql' -print \
      | xargs -n1 basename \
      | sort -V \
      | awk -v latest="${latest_known_migration}" '
          $0 == latest { seen = 1; next }
          seen { print }
        '
  )"

  if [[ -n "${unlisted_newer_migrations}" ]]; then
    echo "New versioned migrations are not included in release_apply_known_migrations:" >&2
    printf '  - %s\n' ${unlisted_newer_migrations} >&2
    echo "Update deploy/scripts/lib/release_common.sh allowlist or review and execute these migrations manually before release." >&2
    return 1
  fi

  for migration_file in "${migration_files[@]}"; do
    echo "==> Applying database migration: ${migration_file}"
    release_apply_postgres_sql_file "${REPO_ROOT}/${migration_file}" >/dev/null
  done
}

release_checkout_ref() {
  local ref="$1"
  git checkout --detach "${ref}"
}

release_checkout_tag() {
  local tag="$1"
  release_checkout_ref "${tag}"
}

release_timestamp_utc() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

release_timestamp_slug() {
  date -u +%Y%m%dT%H%M%SZ
}

release_sanitize_name() {
  local raw="${1:-}"
  printf '%s' "${raw}" | tr '/:@ ' '____' | tr -cd '[:alnum:]._\n-'
}

release_resolve_commit_sha() {
  if [[ -n "${RELEASE_COMMIT_OVERRIDE:-}" ]]; then
    printf '%s\n' "${RELEASE_COMMIT_OVERRIDE}"
    return
  fi

  if command -v git >/dev/null 2>&1 && git rev-parse --verify HEAD >/dev/null 2>&1; then
    git rev-parse HEAD
    return
  fi

  printf '\n'
}

release_record_state() {
  local environment="$1"
  local action="$2"
  local target="$3"
  local service_scope="$4"
  local skip_git="$5"
  local target_kind="${6:-unknown}"
  local state_root="${RELEASE_STATE_DIR:-${REPO_ROOT}/deploy/state}"
  local environment_dir="${state_root}/${environment}"
  local history_dir="${environment_dir}/history"
  local timestamp_iso
  local timestamp_slug
  local target_slug
  local hostname_value
  local commit_value
  local current_file
  local history_file

  mkdir -p "${history_dir}"

  timestamp_iso="$(release_timestamp_utc)"
  timestamp_slug="$(release_timestamp_slug)"
  target_slug="$(release_sanitize_name "${target}")"
  if [[ -z "${target_slug}" ]]; then
    target_slug="current"
  fi

  hostname_value="$(hostname -f 2>/dev/null || hostname 2>/dev/null || printf 'unknown')"
  commit_value="$(release_resolve_commit_sha)"
  current_file="${environment_dir}/current.env"
  history_file="${history_dir}/${timestamp_slug}-${action}-${target_slug}.env"

  cat > "${current_file}" <<EOF
RELEASE_ENVIRONMENT=${environment}
RELEASE_ACTION=${action}
RELEASE_TARGET=${target}
RELEASE_TARGET_KIND=${target_kind}
RELEASE_COMMIT=${commit_value}
RELEASE_SERVICE_SCOPE=${service_scope}
RELEASE_SKIP_GIT=${skip_git}
RELEASE_COMPOSE_FILE=${COMPOSE_FILE}
RELEASE_ENV_FILE=${DEPLOY_ENV_FILE}
RELEASE_COMPOSE_PROJECT_NAME=${RELEASE_COMPOSE_PROJECT_NAME:-}
RELEASE_MANAGED_MODE=${USE_MANAGED:-false}
RELEASE_HOSTNAME=${hostname_value}
RELEASE_TIMESTAMP_UTC=${timestamp_iso}
EOF

  cp "${current_file}" "${history_file}"

  echo "==> Recorded release state: ${current_file}"
  echo "==> Recorded release history: ${history_file}"
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
