#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SQL_FILE="$ROOT_DIR/server/scripts/testdata/user_web_fixture.sql"
DB_CONTAINER=${USER_WEB_FIXTURE_DB_CONTAINER:-decorating_db}
DB_NAME=${USER_WEB_FIXTURE_DB_NAME:-home_decoration}
DB_USER=${USER_WEB_FIXTURE_DB_USER:-postgres}
DB_URL=${USER_WEB_FIXTURE_DB_URL:-}

if ! [ -f "$SQL_FILE" ]; then
  echo "fixture sql not found: $SQL_FILE" >&2
  exit 1
fi

if [[ -n "$DB_URL" ]]; then
  echo "Applying user-web fixture via direct psql connection"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
elif docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "Applying user-web fixture via docker container: $DB_CONTAINER"
  docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$SQL_FILE"
else
  echo "Database container '$DB_CONTAINER' not found."
  echo "Set USER_WEB_FIXTURE_DB_CONTAINER or run psql manually with: $SQL_FILE" >&2
  exit 1
fi

echo "User-web fixture applied."
echo "Owner phone: 19999100001"
echo "Provider id: 99101"
echo "Booking id: 99110"
echo "Proposal id: 99120"
echo "Order id: 99130"
echo "Project id: 99140"
