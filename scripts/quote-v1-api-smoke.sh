#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_BIN="${DOCKER_BIN:-$(command -v docker || true)}"
API_CONTAINER="${QUOTE_API_CONTAINER:-home_decor_api_local}"
DB_CONTAINER="${QUOTE_DB_CONTAINER:-home_decor_db_local}"

if [[ -z "${DOCKER_BIN}" ]]; then
  echo "docker not found in PATH" >&2
  exit 1
fi

cd "${ROOT_DIR}"

if [[ ! -f "erp报价.xls" ]]; then
  echo "missing erp报价.xls" >&2
  exit 1
fi

"${DOCKER_BIN}" cp "erp报价.xls" "${API_CONTAINER}:/app/erp报价.xls"
"${DOCKER_BIN}" exec -i "${DB_CONTAINER}" psql -U postgres -d home_decoration < "server/migrations/v1.7.0_add_quote_subsystem.sql"
"${DOCKER_BIN}" exec -i "${DB_CONTAINER}" psql -U postgres -d home_decoration < "server/migrations/v1.7.1_add_quote_management_menu.sql"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

docker_api() {
  local method="$1"
  local path="$2"
  local outfile="$3"
  local body="${4:-}"
  local auth="${5:-}"

  if [[ "${method}" == "GET" ]]; then
    if [[ -n "${auth}" ]]; then
      "${DOCKER_BIN}" exec -e AUTH_TOKEN="${auth}" "${API_CONTAINER}" sh -lc \
        'wget -q -O - --header="Authorization: Bearer ${AUTH_TOKEN}" "http://127.0.0.1:8080'"${path}"'"' \
        > "${outfile}"
    else
      "${DOCKER_BIN}" exec "${API_CONTAINER}" sh -lc \
        'wget -q -O - "http://127.0.0.1:8080'"${path}"'"' \
        > "${outfile}"
    fi
    return
  fi

  if [[ -n "${auth}" ]]; then
    "${DOCKER_BIN}" exec -e AUTH_TOKEN="${auth}" -e POST_BODY="${body}" "${API_CONTAINER}" sh -lc \
      'wget -q -O - --header="Content-Type: application/json" --header="Authorization: Bearer ${AUTH_TOKEN}" --post-data="${POST_BODY}" "http://127.0.0.1:8080'"${path}"'"' \
      > "${outfile}"
  else
    "${DOCKER_BIN}" exec -e POST_BODY="${body}" "${API_CONTAINER}" sh -lc \
      'wget -q -O - --header="Content-Type: application/json" --post-data="${POST_BODY}" "http://127.0.0.1:8080'"${path}"'"' \
      > "${outfile}"
  fi
}

admin_json="${tmp_dir}/admin.json"
import_json="${tmp_dir}/import.json"
library_json="${tmp_dir}/library.json"
create_json="${tmp_dir}/create.json"
items_json="${tmp_dir}/items.json"
invite_json="${tmp_dir}/invite.json"
merchant_json="${tmp_dir}/merchant.json"
merchant_list_json="${tmp_dir}/merchant_list.json"
merchant_detail_json="${tmp_dir}/merchant_detail.json"
submit_json="${tmp_dir}/submit.json"
compare_json="${tmp_dir}/compare.json"
award_json="${tmp_dir}/award.json"

docker_api POST "/api/v1/admin/login" "${admin_json}" '{"username":"admin","password":"admin123"}'
admin_token="$(python3 - <<'PY' "${admin_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
assert payload["code"] == 0, payload
print(payload["data"]["token"])
PY
)"

docker_api POST "/api/v1/admin/quote-library/import" "${import_json}" '{}' "${admin_token}"
docker_api GET "/api/v1/admin/quote-library/items?page=1&pageSize=20" "${library_json}" '' "${admin_token}"
first_item_id="$(python3 - <<'PY' "${library_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
assert payload["code"] == 0, payload
items=payload["data"]["list"]
assert items, "no quote library items"
print(items[0]["id"])
PY
)"
first_item_name="$(python3 - <<'PY' "${library_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
print(payload["data"]["list"][0]["name"])
PY
)"

title="联调报价清单-$(date +%s)"
docker_api POST "/api/v1/admin/quote-lists" "${create_json}" "{\"projectId\":101,\"customerId\":201,\"houseId\":301,\"ownerUserId\":401,\"scenarioType\":\"plan_a\",\"title\":\"${title}\",\"currency\":\"CNY\"}" "${admin_token}"
quote_list_id="$(python3 - <<'PY' "${create_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
assert payload["code"] == 0, payload
print(payload["data"]["id"])
PY
)"

docker_api POST "/api/v1/admin/quote-lists/${quote_list_id}/items/batch-upsert" "${items_json}" "{\"items\":[{\"standardItemId\":${first_item_id},\"lineNo\":1,\"quantity\":12,\"sortOrder\":1}]}" "${admin_token}"
quote_list_item_id="$(python3 - <<'PY' "${items_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
assert payload["code"] == 0, payload
print(payload["data"]["items"][0]["id"])
PY
)"

docker_api POST "/api/v1/admin/quote-lists/${quote_list_id}/invitations" "${invite_json}" '{"providerIds":[90001]}' "${admin_token}"
docker_api POST "/api/v1/admin/quote-lists/${quote_list_id}/start" "${tmp_dir}/start.json" '{}' "${admin_token}"

docker_api POST "/api/v1/merchant/login" "${merchant_json}" '{"phone":"13800000001","code":"123456"}'
merchant_token="$(python3 - <<'PY' "${merchant_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
assert payload["code"] == 0, payload
print(payload["data"]["token"])
PY
)"

docker_api GET "/api/v1/merchant/quote-lists" "${merchant_list_json}" '' "${merchant_token}"
docker_api GET "/api/v1/merchant/quote-lists/${quote_list_id}" "${merchant_detail_json}" '' "${merchant_token}"
docker_api POST "/api/v1/merchant/quote-lists/${quote_list_id}/submission/submit" "${submit_json}" "{\"items\":[{\"quoteListItemId\":${quote_list_item_id},\"unitPriceCent\":1880,\"remark\":\"联调报价\"}]}" "${merchant_token}"

docker_api GET "/api/v1/admin/quote-lists/${quote_list_id}/comparison" "${compare_json}" '' "${admin_token}"
submission_id="$(python3 - <<'PY' "${compare_json}"
import json,sys
payload=json.load(open(sys.argv[1]))
assert payload["code"] == 0, payload
subs=payload["data"]["submissions"]
assert subs, payload
print(subs[0]["submissionId"])
PY
)"
docker_api POST "/api/v1/admin/quote-lists/${quote_list_id}/award" "${award_json}" "{\"submissionId\":${submission_id}}" "${admin_token}"

python3 - <<'PY' "${import_json}" "${library_json}" "${create_json}" "${invite_json}" "${merchant_list_json}" "${merchant_detail_json}" "${submit_json}" "${compare_json}" "${award_json}" "${title}" "${first_item_name}"
import json,sys
import_payload=json.load(open(sys.argv[1]))
library_payload=json.load(open(sys.argv[2]))
create_payload=json.load(open(sys.argv[3]))
invite_payload=json.load(open(sys.argv[4]))
merchant_list_payload=json.load(open(sys.argv[5]))
merchant_detail_payload=json.load(open(sys.argv[6]))
submit_payload=json.load(open(sys.argv[7]))
compare_payload=json.load(open(sys.argv[8]))
award_payload=json.load(open(sys.argv[9]))
print(json.dumps({
  "import_code": import_payload["code"],
  "import_result": import_payload["data"],
  "library_count": len(library_payload["data"]["list"]),
  "created_quote_list_id": create_payload["data"]["id"],
  "created_title": sys.argv[10],
  "library_first_item": sys.argv[11],
  "invitation_count": len(invite_payload["data"]["invitations"]),
  "merchant_quote_list_count": len(merchant_list_payload["data"]["list"]),
  "merchant_detail_title": merchant_detail_payload["data"]["quoteList"]["title"],
  "merchant_submit_code": submit_payload["code"],
  "comparison_submission_count": len(compare_payload["data"]["submissions"]),
  "award_code": award_payload["code"],
  "awarded_provider_id": award_payload["data"]["awardedProviderId"],
  "final_status": award_payload["data"]["status"]
}, ensure_ascii=False, indent=2))
PY
