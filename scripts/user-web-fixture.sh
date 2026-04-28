#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SQL_FILE="$ROOT_DIR/server/scripts/testdata/user_web_fixture.sql"
MIGRATIONS=(
  "$ROOT_DIR/server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql"
  "$ROOT_DIR/server/migrations/v1.6.9_reconcile_high_risk_schema_guard.sql"
  "$ROOT_DIR/server/migrations/002_create_user_identities.sql"
  "$ROOT_DIR/server/migrations/v1.8.0_add_demand_system.sql"
  "$ROOT_DIR/server/migrations/v1.8.1_add_demand_center_menu.sql"
  "$ROOT_DIR/server/migrations/v1.9.0_add_transaction_trust_loop.sql"
  "$ROOT_DIR/server/migrations/v1.9.7_add_business_flows.sql"
  "$ROOT_DIR/server/migrations/v1.9.8_case_audit_source_trace.sql"
  "$ROOT_DIR/server/migrations/v1.9.13_add_official_provider_review_project_link.sql"
  "$ROOT_DIR/server/migrations/v1.9.14_add_claimed_completion_onboarding_columns.sql"
  "$ROOT_DIR/server/migrations/v1.9.15_add_admin_security_columns.sql"
  "$ROOT_DIR/server/migrations/v1.9.16_add_provider_display_name.sql"
  "$ROOT_DIR/server/migrations/v1.10.4_add_project_business_closure_fields.sql"
  "$ROOT_DIR/server/migrations/v1.10.7_add_p0_booking_and_completion.sql"
  "$ROOT_DIR/server/migrations/v1.10.8_add_project_risk_and_refund.sql"
  "$ROOT_DIR/server/migrations/v1.11.0_add_p2_finance_and_audit_log_support.sql"
  "$ROOT_DIR/server/migrations/v1.12.2_reconcile_commerce_runtime_schema.sql"
  "$ROOT_DIR/server/migrations/v1.12.3_add_alipay_payment_runtime.sql"
  "$ROOT_DIR/server/migrations/v1.9.17_backfill_booking_survey_deposit_from_intent_fee.sql"
  "$ROOT_DIR/server/migrations/v1.12.10_add_user_profile_birthday_bio.sql"
  "$ROOT_DIR/server/migrations/v1.12.12_add_payment_central_runtime.sql"
  "$ROOT_DIR/server/migrations/v1.12.13_add_settlement_and_bond_domains.sql"
  "$ROOT_DIR/server/migrations/v1.13.4_add_public_visibility_switches.sql"
  "$ROOT_DIR/server/migrations/v1.13.5_align_booking_budget_bridge_schema.sql"
  "$ROOT_DIR/server/migrations/v1.13.6_reconcile_quote_runtime_schema.sql"
  "$ROOT_DIR/server/migrations/v1.13.7_link_change_orders_to_payment_plans.sql"
  "$ROOT_DIR/server/migrations/v1.14.2_payment_refund_projection_and_money_cents.sql"
  "$ROOT_DIR/server/migrations/v1.14.3_add_outbox_events.sql"
  "$ROOT_DIR/server/migrations/v1.14.4_reconcile_contract_runtime_schema.sql"
  "$ROOT_DIR/server/migrations/v1.14.5_add_reconciliation_runtime_tables.sql"
  "$ROOT_DIR/server/migrations/v1.14.6_add_booking_survey_deposit_status.sql"
)
DB_CONTAINER=${USER_WEB_FIXTURE_DB_CONTAINER:-home_decor_db_local}
DB_NAME=${USER_WEB_FIXTURE_DB_NAME:-home_decoration}
DB_USER=${USER_WEB_FIXTURE_DB_USER:-postgres}
DB_URL=${USER_WEB_FIXTURE_DB_URL:-}

if ! [ -f "$SQL_FILE" ]; then
  echo "fixture sql not found: $SQL_FILE" >&2
  exit 1
fi

for migration in "${MIGRATIONS[@]}"; do
  if ! [ -f "$migration" ]; then
    echo "required migration not found: $migration" >&2
    exit 1
  fi
done

apply_sql_file() {
  local file_path=$1
  if [[ -n "$DB_URL" ]]; then
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$file_path"
  else
    docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$file_path"
  fi
}

align_postgres_sequences() {
  if [[ -n "$DB_URL" ]]; then
    psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  row record;
  max_id bigint;
BEGIN
  FOR row IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name,
      pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS sequence_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'id'
    WHERE c.relkind = 'r'
      AND n.nspname = current_schema()
      AND pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) IS NOT NULL
  LOOP
    EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I.%I', row.column_name, row.schema_name, row.table_name) INTO max_id;
    EXECUTE format('SELECT setval(%L::regclass, %s, %L)', row.sequence_name, GREATEST(max_id, 1), max_id > 0);
  END LOOP;
END $$;
SQL
  else
    docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
DO $$
DECLARE
  row record;
  max_id bigint;
BEGIN
  FOR row IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name,
      pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS sequence_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'id'
    WHERE c.relkind = 'r'
      AND n.nspname = current_schema()
      AND pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) IS NOT NULL
  LOOP
    EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I.%I', row.column_name, row.schema_name, row.table_name) INTO max_id;
    EXECUTE format('SELECT setval(%L::regclass, %s, %L)', row.sequence_name, GREATEST(max_id, 1), max_id > 0);
  END LOOP;
END $$;
SQL
  fi
}

if [[ -n "$DB_URL" ]]; then
  echo "Applying user-web fixture via direct psql connection"
elif docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "Applying user-web fixture via docker container: $DB_CONTAINER"
else
  echo "Database container '$DB_CONTAINER' not found."
  echo "Set USER_WEB_FIXTURE_DB_CONTAINER or run psql manually with: $SQL_FILE" >&2
  exit 1
fi

echo "Aligning postgres id sequences"
align_postgres_sequences

for migration in "${MIGRATIONS[@]}"; do
  echo "Applying migration: $(basename "$migration")"
  apply_sql_file "$migration"
done

apply_sql_file "$SQL_FILE"

echo "User-web fixture applied."
echo "Owner phone: 19999100001"
echo "Provider id: 99101"
echo "Booking id: 99110"
echo "Proposal id: 99120"
echo "Order id: 99130"
echo "Project id: 99140"
