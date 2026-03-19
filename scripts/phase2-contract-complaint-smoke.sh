#!/usr/bin/env bash
set -euo pipefail

API_BASE=${PHASE2_API_BASE:-http://127.0.0.1:8080/api/v1}
USER_PHONE=${PHASE2_USER_PHONE:-19999100001}
MERCHANT_PHONE=${PHASE2_MERCHANT_PHONE:-19999100002}
PROJECT_ID=${PHASE2_PROJECT_ID:-99140}
REDIS_CONTAINER=${PHASE2_REDIS_CONTAINER:-home_decor_redis_local}
REDIS_PASSWORD=${PHASE2_REDIS_PASSWORD:-kXTSG3Q7yjug7I60JgOmWo6w9OIJrFUf}

json_field() {
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); const path=process.argv[1].split('.'); let cur=j; for (const k of path){cur=cur?.[k]} process.stdout.write(String(cur ?? ''))})" "$1"
}

assert_code_zero() {
  local payload=$1
  local label=$2
  local code
  code=$(printf '%s' "$payload" | json_field code)
  if [ "$code" != "0" ]; then
    echo "[$label] failed: $payload" >&2
    exit 1
  fi
}

clear_rate_limits() {
  if ! command -v docker >/dev/null 2>&1; then
    return
  fi
  if ! docker ps --format '{{.Names}}' | grep -qx "$REDIS_CONTAINER"; then
    return
  fi
  local keys
  keys=$(docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" --raw KEYS 'rate_limit:*' || true)
  if [[ -z "$keys" ]]; then
    return
  fi
  while IFS= read -r key; do
    [[ -z "$key" ]] && continue
    docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" DEL "$key" >/dev/null
  done <<<"$keys"
}

send_login_code() {
  local phone=$1
  local payload
  payload=$(curl -sS -X POST "$API_BASE/auth/send-code" -H 'Content-Type: application/json' -d "{\"phone\":\"$phone\",\"purpose\":\"login\"}")
  local code
  code=$(printf '%s' "$payload" | json_field data.debugCode)
  if [ -z "$code" ]; then
    code=${PHASE2_SMS_CODE:-123456}
  fi
  printf '%s' "$code"
}

clear_rate_limits

echo "[phase2-smoke] user login"
user_code=$(send_login_code "$USER_PHONE")
user_login=$(curl -sS -X POST "$API_BASE/auth/login" -H 'Content-Type: application/json' -d "{\"phone\":\"$USER_PHONE\",\"code\":\"$user_code\"}")
assert_code_zero "$user_login" user-login
user_token=$(printf '%s' "$user_login" | json_field data.token)
user_id=$(printf '%s' "$user_login" | json_field data.user.id)

echo "[phase2-smoke] merchant login"
merchant_code=$(send_login_code "$MERCHANT_PHONE")
merchant_login=$(curl -sS -X POST "$API_BASE/merchant/login" -H 'Content-Type: application/json' -d "{\"phone\":\"$MERCHANT_PHONE\",\"code\":\"$merchant_code\"}")
assert_code_zero "$merchant_login" merchant-login
merchant_token=$(printf '%s' "$merchant_login" | json_field data.token)

echo "[phase2-smoke] create contract"
contract_create=$(curl -sS -X POST "$API_BASE/contracts" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $merchant_token" \
  -d "{
    \"projectId\":${PROJECT_ID},
    \"userId\":${user_id},
    \"title\":\"Phase2 联调合同\",
    \"totalAmount\":198000,
    \"paymentPlan\":[
      {\"phase\":1,\"name\":\"签约定金\",\"amount\":19800,\"percentage\":10,\"trigger_event\":\"contract_confirmed\"},
      {\"phase\":2,\"name\":\"开工款\",\"amount\":59400,\"percentage\":30,\"trigger_event\":\"construction_start\"}
    ],
    \"attachmentUrls\":[\"https://example.com/contracts/phase2-contract.pdf\"],
    \"termsSnapshot\":{\"version\":\"phase2-smoke\"}
  }")
assert_code_zero "$contract_create" contract-create
contract_id=$(printf '%s' "$contract_create" | json_field data.id)

echo "[phase2-smoke] confirm contract #$contract_id"
contract_confirm=$(curl -sS -X POST "$API_BASE/contracts/$contract_id/confirm" -H "Authorization: Bearer $user_token")
assert_code_zero "$contract_confirm" contract-confirm

echo "[phase2-smoke] create complaint"
complaint_create=$(curl -sS -X POST "$API_BASE/complaints" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $user_token" \
  -d "{
    \"projectId\":${PROJECT_ID},
    \"category\":\"quality\",
    \"title\":\"Phase2 联调投诉\",
    \"description\":\"联调投诉：用于验证投诉链路可创建并可回查。\",
    \"evidenceUrls\":[\"https://example.com/complaints/phase2-proof.jpg\"]
  }")
assert_code_zero "$complaint_create" complaint-create
complaint_id=$(printf '%s' "$complaint_create" | json_field data.id)

echo "[phase2-smoke] list complaints"
complaint_list=$(curl -sS "$API_BASE/complaints" -H "Authorization: Bearer $user_token")
assert_code_zero "$complaint_list" complaint-list
found=$(printf '%s' "$complaint_list" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); const ok=(j.data||[]).some(item=>Number(item.id)===Number(process.argv[1])); process.stdout.write(ok?'yes':'no')})" "$complaint_id")
if [ "$found" != "yes" ]; then
  echo "[complaint-list] complaint $complaint_id not found: $complaint_list" >&2
  exit 1
fi

echo "[phase2-smoke] ok"
echo "contract_id=$contract_id"
echo "complaint_id=$complaint_id"
