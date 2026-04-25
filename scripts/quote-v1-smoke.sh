#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_CONTAINER="${QUOTE_API_CONTAINER:-home_decor_api_local}"
DB_CONTAINER="${QUOTE_DB_CONTAINER:-home_decor_db_local}"

cd "${ROOT_DIR}"

if [[ ! -f "erp报价.xls" ]]; then
  echo "缺少 erp报价.xls，无法执行报价系统 smoke。" >&2
  exit 1
fi

docker cp "erp报价.xls" "${API_CONTAINER}:/app/erp报价.xls"
docker exec -i "${DB_CONTAINER}" psql -U postgres -d home_decoration < "server/migrations/v1.7.1_add_quote_management_menu.sql"

E2E_API_BASE_URL="${E2E_API_BASE_URL:-http://127.0.0.1:8080/api/v1}" \
E2E_ADMIN_ORIGIN="${E2E_ADMIN_ORIGIN:-http://127.0.0.1:5175/admin}" \
MERCHANT_ORIGIN="${MERCHANT_ORIGIN:-http://127.0.0.1:5175/merchant}" \
npx playwright test tests/e2e/quote-system-v1.smoke.test.ts
