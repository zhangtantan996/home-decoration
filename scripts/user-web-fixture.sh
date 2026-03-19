#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SQL_FILE="$ROOT_DIR/server/scripts/testdata/user_web_fixture.sql"
MIGRATIONS=(
  "$ROOT_DIR/server/migrations/v1.9.7_add_business_flows.sql"
  "$ROOT_DIR/server/migrations/v1.9.8_case_audit_source_trace.sql"
  "$ROOT_DIR/server/migrations/v1.10.4_add_project_business_closure_fields.sql"
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

if [[ -n "$DB_URL" ]]; then
  echo "Applying user-web fixture via direct psql connection"
elif docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "Applying user-web fixture via docker container: $DB_CONTAINER"
else
  echo "Database container '$DB_CONTAINER' not found."
  echo "Set USER_WEB_FIXTURE_DB_CONTAINER or run psql manually with: $SQL_FILE" >&2
  exit 1
fi

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
