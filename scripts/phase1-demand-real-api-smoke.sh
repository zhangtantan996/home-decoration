#!/usr/bin/env bash
set -euo pipefail

API_BASE=${PHASE1_API_BASE:-http://127.0.0.1:8080/api/v1}
USER_PHONE=${PHASE1_USER_PHONE:-19999100001}
MERCHANT_PHONE=${PHASE1_MERCHANT_PHONE:-19999100002}
ADMIN_USER=${PHASE1_ADMIN_USER:-admin}
ADMIN_PASS=${PHASE1_ADMIN_PASS:-admin123}
REDIS_CONTAINER=${PHASE1_REDIS_CONTAINER:-home_decor_redis_local}
REDIS_PASSWORD=${PHASE1_REDIS_PASSWORD:-kXTSG3Q7yjug7I60JgOmWo6w9OIJrFUf}

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
    code=${PHASE1_SMS_CODE:-123456}
  fi
  printf '%s' "$code"
}

clear_rate_limits

echo "[phase1-demand-smoke] user login"
user_code=$(send_login_code "$USER_PHONE")
user_login=$(curl -sS -X POST "$API_BASE/auth/login" -H 'Content-Type: application/json' -d "{\"phone\":\"$USER_PHONE\",\"code\":\"$user_code\"}")
assert_code_zero "$user_login" user-login
user_token=$(printf '%s' "$user_login" | json_field data.token)

echo "[phase1-demand-smoke] admin login"
admin_login=$(curl -sS -X POST "$API_BASE/admin/login" -H 'Content-Type: application/json' -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")
assert_code_zero "$admin_login" admin-login
admin_token=$(printf '%s' "$admin_login" | json_field data.token)

echo "[phase1-demand-smoke] merchant login"
merchant_code=$(send_login_code "$MERCHANT_PHONE")
merchant_login=$(curl -sS -X POST "$API_BASE/merchant/login" -H 'Content-Type: application/json' -d "{\"phone\":\"$MERCHANT_PHONE\",\"code\":\"$merchant_code\"}")
assert_code_zero "$merchant_login" merchant-login
merchant_token=$(printf '%s' "$merchant_login" | json_field data.token)
provider_id=$(printf '%s' "$merchant_login" | json_field data.provider.id)

echo "[phase1-demand-smoke] create demand"
demand_create=$(curl -sS -X POST "$API_BASE/demands" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $user_token" \
  -d '{
    "demandType":"renovation",
    "title":"真实联调需求-老房翻新",
    "city":"西安",
    "district":"雁塔区",
    "address":"高新区联调路 66 号",
    "area":92,
    "budgetMin":110000,
    "budgetMax":210000,
    "timeline":"3month",
    "stylePref":"现代简约 / 收纳优先",
    "description":"联调脚本创建的需求，用于验证审核、分配、接单和方案提交流程。",
    "attachments":[{"url":"https://example.com/uploads/phase1-demand-plan.jpg","name":"户型图.jpg","size":102400}]
  }')
assert_code_zero "$demand_create" demand-create
demand_id=$(printf '%s' "$demand_create" | json_field data.id)

echo "[phase1-demand-smoke] submit demand #$demand_id"
demand_submit=$(curl -sS -X POST "$API_BASE/demands/$demand_id/submit" -H "Authorization: Bearer $user_token")
assert_code_zero "$demand_submit" demand-submit

echo "[phase1-demand-smoke] approve demand"
demand_review=$(curl -sS -X POST "$API_BASE/admin/demands/$demand_id/review" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $admin_token" \
  -d '{"action":"approve","note":"联调审核通过"}')
assert_code_zero "$demand_review" demand-review

echo "[phase1-demand-smoke] assign provider #$provider_id"
demand_assign=$(curl -sS -X POST "$API_BASE/admin/demands/$demand_id/assign" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $admin_token" \
  -d "{\"providerIds\":[${provider_id}],\"responseDeadlineHours\":48}")
assert_code_zero "$demand_assign" demand-assign

echo "[phase1-demand-smoke] merchant list leads"
lead_list=$(curl -sS "$API_BASE/merchant/leads?page=1&pageSize=20" -H "Authorization: Bearer $merchant_token")
assert_code_zero "$lead_list" lead-list
lead_id=$(printf '%s' "$lead_list" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); const match=(j.data?.list||[]).find(item=>item.demand?.id===Number(process.argv[1])); process.stdout.write(String(match?.id||''))})" "$demand_id")
if [ -z "$lead_id" ]; then
  echo "[lead-list] lead not found for demand $demand_id" >&2
  exit 1
fi

echo "[phase1-demand-smoke] accept lead #$lead_id"
lead_accept=$(curl -sS -X POST "$API_BASE/merchant/leads/$lead_id/accept" -H "Authorization: Bearer $merchant_token")
assert_code_zero "$lead_accept" lead-accept

echo "[phase1-demand-smoke] submit proposal"
proposal_submit=$(curl -sS -X POST "$API_BASE/merchant/proposals" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $merchant_token" \
  -d "{
    \"sourceType\":\"demand\",
    \"demandMatchId\":${lead_id},
    \"summary\":\"联调商家方案：先做空间梳理和水电点位优化，再推进泥木与主材。\",
    \"designFee\":6000,
    \"constructionFee\":136000,
    \"materialFee\":28000,
    \"estimatedDays\":70,
    \"attachments\":\"[\\\"https://example.com/uploads/phase1-demand-proposal.pdf\\\"]\"
  }")
assert_code_zero "$proposal_submit" proposal-submit
proposal_id=$(printf '%s' "$proposal_submit" | json_field data.id)

echo "[phase1-demand-smoke] verify demand detail"
demand_detail=$(curl -sS "$API_BASE/demands/$demand_id" -H "Authorization: Bearer $user_token")
assert_code_zero "$demand_detail" demand-detail
quoted_proposal=$(printf '%s' "$demand_detail" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); const match=(j.data?.matches||[]).find(item=>Number(item.proposal?.id||0)===Number(process.argv[1])); process.stdout.write(String(match?.proposal?.id||''))})" "$proposal_id")
if [ "$quoted_proposal" != "$proposal_id" ]; then
  echo "[demand-detail] expected proposal $proposal_id in demand detail, got: $demand_detail" >&2
  exit 1
fi

echo "[phase1-demand-smoke] ok"
echo "demand_id=$demand_id"
echo "lead_id=$lead_id"
echo "proposal_id=$proposal_id"
