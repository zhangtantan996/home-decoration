#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_BIN="${DOCKER_BIN:-$(command -v docker || true)}"
DB_CONTAINER="${QUOTE_DB_CONTAINER:-}"
DB_URL="${QUOTE_DB_URL:-${USER_WEB_FIXTURE_DB_URL:-}}"
API_CONTAINER="${QUOTE_API_CONTAINER:-home_decor_api_local}"
API_BASE_URL="${E2E_API_BASE_URL:-http://127.0.0.1:8080/api/v1}"
ADMIN_PASSWORD_HASH='$2a$10$QEEz3QXaeR8E1MJ/P6U.0ut1TtEFu0Tq1n7iOuMVN3v8CE6SE5wGe'

if [[ -z "${DB_URL}" && -z "${DOCKER_BIN}" ]]; then
  echo "docker not found in PATH and QUOTE_DB_URL is empty" >&2
  exit 1
fi

if [[ -z "${DB_URL}" && -z "${DB_CONTAINER}" ]]; then
  if "${DOCKER_BIN}" ps --format '{{.Names}}' | grep -qx 'home_decor_db_local'; then
    DB_CONTAINER='home_decor_db_local'
  elif "${DOCKER_BIN}" ps --format '{{.Names}}' | grep -qx 'decorating_db'; then
    DB_CONTAINER='decorating_db'
  else
    echo "unable to detect local postgres container name" >&2
    exit 1
  fi
fi

cd "${ROOT_DIR}"

psql_exec_file() {
  local sql_file="$1"
  if [[ -n "${DB_URL}" ]]; then
    psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${sql_file}" >/dev/null
  else
    "${DOCKER_BIN}" exec -i "${DB_CONTAINER}" psql -U postgres -d home_decoration < "${sql_file}" >/dev/null
  fi
}

psql_query() {
  local sql="$1"
  if [[ -n "${DB_URL}" ]]; then
    psql "${DB_URL}" -v ON_ERROR_STOP=1 -P pager=off -F $'\t' -At -c "${sql}"
  else
    "${DOCKER_BIN}" exec "${DB_CONTAINER}" psql -U postgres -d home_decoration -P pager=off -F $'\t' -At -c "${sql}"
  fi
}

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

request_json() {
  local method="$1"
  local url="$2"
  local outfile="$3"
  local body="${4:-}"
  local auth="${5:-}"
  local attempt
  for attempt in 1 2 3 4 5 6; do
    if [[ "${method}" == "GET" ]]; then
      if [[ -n "${auth}" ]]; then
        if curl -sS -H "Authorization: Bearer ${auth}" "${url}" > "${outfile}" 2>/dev/null; then
          return 0
        fi
      else
        if curl -sS "${url}" > "${outfile}" 2>/dev/null; then
          return 0
        fi
      fi
    else
      if [[ -n "${auth}" ]]; then
        if curl -sS -X "${method}" -H "Authorization: Bearer ${auth}" -H 'Content-Type: application/json' -d "${body}" "${url}" > "${outfile}" 2>/dev/null; then
          return 0
        fi
      else
        if curl -sS -X "${method}" -H 'Content-Type: application/json' -d "${body}" "${url}" > "${outfile}" 2>/dev/null; then
          return 0
        fi
      fi
    fi
    sleep 2
  done
  echo "request failed: ${method} ${url}" >&2
  return 1
}

if [[ -f "erp报价.xls" && -n "${DOCKER_BIN}" ]] && "${DOCKER_BIN}" ps --format '{{.Names}}' | grep -qx "${API_CONTAINER}"; then
  "${DOCKER_BIN}" cp "erp报价.xls" "${API_CONTAINER}:/app/erp报价.xls"
fi
psql_exec_file "server/migrations/v1.7.0_add_quote_subsystem.sql"
psql_exec_file "server/migrations/v1.7.1_add_quote_management_menu.sql"
psql_exec_file "server/migrations/v1.7.2_upgrade_quote_workflow_v1.sql"
psql_exec_file "server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql"
psql_exec_file "server/migrations/v1.6.7_extend_sms_audit_context.sql"
psql_query "UPDATE sys_admins SET password = '${ADMIN_PASSWORD_HASH}', status = 1, is_super_admin = true WHERE username = 'admin';" >/dev/null

read -r merchant_provider_id merchant_phone <<<"$(psql_query "SELECT p.id, u.phone FROM providers p JOIN users u ON u.id = p.user_id WHERE p.provider_type = 3 ORDER BY p.id LIMIT 1;")"
read -r owner_user_id owner_phone <<<"$(psql_query "SELECT id, phone FROM users WHERE user_type = 1 ORDER BY id LIMIT 1;")"

if [[ -z "${merchant_provider_id:-}" || -z "${merchant_phone:-}" ]]; then
  echo "unable to locate a foreman account for workflow smoke" >&2
  exit 1
fi
if [[ -z "${owner_user_id:-}" || -z "${owner_phone:-}" ]]; then
  echo "unable to locate an owner user account for workflow smoke" >&2
  exit 1
fi

admin_json="${tmp_dir}/admin.json"
category_json="${tmp_dir}/category.json"
library_item_json="${tmp_dir}/library_item.json"
merchant_json="${tmp_dir}/merchant.json"
price_book_save_json="${tmp_dir}/price_book_save.json"
price_book_publish_json="${tmp_dir}/price_book_publish.json"
task_create_json="${tmp_dir}/task_create.json"
task_items_json="${tmp_dir}/task_items.json"
task_prerequisites_json="${tmp_dir}/task_prerequisites.json"
task_validate_json="${tmp_dir}/task_validate.json"
task_recommend_json="${tmp_dir}/task_recommend.json"
task_select_json="${tmp_dir}/task_select.json"
task_generate_json="${tmp_dir}/task_generate.json"
merchant_task_json="${tmp_dir}/merchant_task.json"
merchant_submit_json="${tmp_dir}/merchant_submit.json"
submit_to_user_json="${tmp_dir}/submit_to_user.json"
user_login_json="${tmp_dir}/user_login.json"
user_view_json="${tmp_dir}/user_view.json"
user_confirm_json="${tmp_dir}/user_confirm.json"
print_html="${tmp_dir}/print.html"

request_json POST "${API_BASE_URL}/admin/login" "${admin_json}" '{"username":"admin","password":"admin123"}'
admin_token="$(python3 - <<'PY' "${admin_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
assert payload["code"] == 0, payload
print(payload["data"]["token"])
PY
)"

run_id="$(date +%s)"
category_code="WATERPROOF-${run_id}"
standard_code="STD-WP-${run_id}"
erp_code="ERP-WP-${run_id}"

request_json POST "${API_BASE_URL}/admin/quote-categories" "${category_json}" "{\"code\":\"${category_code}\",\"name\":\"防水-${run_id}\",\"sortOrder\":1,\"status\":1}" "${admin_token}"
category_id="$(python3 - <<'PY' "${category_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
assert payload["code"] == 0, payload
print(payload["data"]["id"])
PY
)"

request_json POST "${API_BASE_URL}/admin/quote-library/items" "${library_item_json}" "{\"categoryId\":${category_id},\"standardCode\":\"${standard_code}\",\"erpItemCode\":\"${erp_code}\",\"name\":\"墙地面防水-${run_id}\",\"unit\":\"㎡\",\"referencePriceCent\":0,\"pricingNote\":\"防水标准项\",\"status\":1,\"keywords\":[\"防水\",\"厨卫\"],\"erpMapping\":{\"source\":\"erp报价.xls\"},\"sourceMeta\":{\"scope\":\"workflow-smoke\"}}" "${admin_token}"
library_item_id="$(python3 - <<'PY' "${library_item_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
assert payload["code"] == 0, payload
print(payload["data"]["id"])
PY
)"

request_json POST "${API_BASE_URL}/merchant/login" "${merchant_json}" "{\"phone\":\"${merchant_phone}\",\"code\":\"123456\"}"
merchant_token="$(python3 - <<'PY' "${merchant_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
assert payload["code"] == 0, payload
print(payload["data"]["token"])
PY
)"

request_json PUT "${API_BASE_URL}/merchant/price-book" "${price_book_save_json}" "{\"remark\":\"工长日常价格库\",\"items\":[{\"standardItemId\":${library_item_id},\"unit\":\"㎡\",\"unitPriceCent\":1800,\"minChargeCent\":12000,\"remark\":\"基础防水单价\",\"status\":1}]}" "${merchant_token}"
request_json POST "${API_BASE_URL}/merchant/price-book/publish" "${price_book_publish_json}" '{}' "${merchant_token}"

request_json POST "${API_BASE_URL}/admin/quote-tasks" "${task_create_json}" "{\"projectId\":101,\"proposalId\":501,\"proposalVersion\":1,\"designerProviderId\":601,\"customerId\":201,\"houseId\":301,\"ownerUserId\":${owner_user_id},\"scenarioType\":\"plan_a\",\"title\":\"报价工作流联调任务\",\"currency\":\"CNY\"}" "${admin_token}"
task_id="$(python3 - <<'PY' "${task_create_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
assert payload["code"] == 0, payload
print(payload["data"]["id"])
PY
)"

request_json POST "${API_BASE_URL}/admin/quote-tasks/${task_id}/items/batch-upsert" "${task_items_json}" "{\"items\":[{\"standardItemId\":${library_item_id},\"name\":\"墙地面防水\",\"unit\":\"㎡\",\"quantity\":10,\"categoryL1\":\"防水\",\"sortOrder\":1}]}" "${admin_token}"
task_item_id="$(python3 - <<'PY' "${task_items_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
assert payload["code"] == 0, payload
print(payload["data"]["items"][0]["id"])
PY
)"

request_json PUT "${API_BASE_URL}/admin/quote-tasks/${task_id}/prerequisites" "${task_prerequisites_json}" '{"area":89,"layout":"3室2厅","renovationType":"全屋翻新","constructionScope":"防水","serviceAreas":["浦东新区"],"workTypes":["waterproof"],"notes":"workflow smoke"}' "${admin_token}"
request_json POST "${API_BASE_URL}/admin/quote-tasks/${task_id}/validate-prerequisites" "${task_validate_json}" '{}' "${admin_token}"
request_json POST "${API_BASE_URL}/admin/quote-tasks/${task_id}/recommend-foremen" "${task_recommend_json}" '{}' "${admin_token}"
request_json POST "${API_BASE_URL}/admin/quote-tasks/${task_id}/select-foremen" "${task_select_json}" "{\"providerIds\":[${merchant_provider_id}]}" "${admin_token}"
request_json POST "${API_BASE_URL}/admin/quote-tasks/${task_id}/generate-drafts" "${task_generate_json}" '{}' "${admin_token}"

request_json GET "${API_BASE_URL}/merchant/quote-tasks/${task_id}" "${merchant_task_json}" '' "${merchant_token}"
request_json POST "${API_BASE_URL}/merchant/quote-lists/${task_id}/submission/submit" "${merchant_submit_json}" "{\"items\":[{\"quoteListItemId\":${task_item_id},\"unitPriceCent\":2000,\"remark\":\"工长微调后提交\"}],\"estimatedDays\":30,\"remark\":\"正式报价\"}" "${merchant_token}"
submission_id="$(python3 - <<'PY' "${task_generate_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
assert payload["code"] == 0, payload
subs=payload["data"]["submissions"]
assert subs, payload
print(subs[0]["submissionId"])
PY
)"
request_json POST "${API_BASE_URL}/admin/quote-tasks/${task_id}/submit-to-user" "${submit_to_user_json}" "{\"submissionId\":${submission_id}}" "${admin_token}"

request_json POST "${API_BASE_URL}/auth/login" "${user_login_json}" "{\"phone\":\"${owner_phone}\",\"type\":\"code\",\"code\":\"123456\"}" || true
user_token="$(python3 - <<'PY' "${user_login_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
if payload.get("code") == 0 and payload.get("data", {}).get("token"):
    print(payload["data"]["token"])
PY
)"

print_token="${admin_token}"
if [[ -n "${user_token:-}" ]]; then
  request_json GET "${API_BASE_URL}/quote-tasks/${task_id}/user-view" "${user_view_json}" '' "${user_token}"
  request_json POST "${API_BASE_URL}/quote-submissions/${submission_id}/confirm" "${user_confirm_json}" '{}' "${user_token}"
  print_token="${user_token}"
fi

request_json GET "${API_BASE_URL}/quote-submissions/${submission_id}/print" "${print_html}" '' "${print_token}"

python3 - <<'PY' "${task_validate_json}" "${task_recommend_json}" "${task_generate_json}" "${merchant_task_json}" "${submit_to_user_json}" "${user_confirm_json}" "${print_html}"
import json,sys,os
validate_payload=json.load(open(sys.argv[1]))
recommend_payload=json.load(open(sys.argv[2]))
generate_payload=json.load(open(sys.argv[3]))
merchant_task_payload=json.load(open(sys.argv[4]))
submit_to_user_payload=json.load(open(sys.argv[5]))
user_confirm_payload = json.load(open(sys.argv[6])) if os.path.exists(sys.argv[6]) and os.path.getsize(sys.argv[6]) else None
print_html = open(sys.argv[7], encoding='utf-8').read()
print(json.dumps({
  "validate_ok": validate_payload["data"]["ok"],
  "recommend_count": len(recommend_payload["data"]["list"]),
  "generated_submission_count": len(generate_payload["data"]["submissions"]),
  "merchant_task_status": merchant_task_payload["data"]["quoteList"]["status"],
  "submit_to_user_status": submit_to_user_payload["data"]["status"],
  "user_confirm_status": user_confirm_payload["data"]["status"] if user_confirm_payload else "not-executed",
  "print_contains_title": "报价工作流联调任务" in print_html,
}, ensure_ascii=False, indent=2))
PY
