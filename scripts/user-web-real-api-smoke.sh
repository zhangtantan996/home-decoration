#!/usr/bin/env bash
set -euo pipefail

API_BASE=${USER_WEB_REAL_API_BASE:-}
DEFAULT_API_BASE_PRIMARY=${USER_WEB_REAL_API_BASE_PRIMARY:-http://127.0.0.1:8080/api/v1}
DEFAULT_API_BASE_FALLBACK=${USER_WEB_REAL_API_BASE_FALLBACK:-http://127.0.0.1:5175/api/v1}
PHONE=${USER_WEB_FIXTURE_PHONE:-19999100001}
PROVIDER_ID=${USER_WEB_FIXTURE_PROVIDER_ID:-99101}
BOOKING_ID=${USER_WEB_FIXTURE_BOOKING_ID:-99110}
PROPOSAL_ID=${USER_WEB_FIXTURE_PROPOSAL_ID:-99120}
ORDER_ID=${USER_WEB_FIXTURE_ORDER_ID:-99130}
PROJECT_ID=${USER_WEB_FIXTURE_PROJECT_ID:-99140}

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

probe_api_base() {
  local candidate=$1
  if [ -z "$candidate" ]; then
    return 1
  fi
  curl -fsS "$candidate/health" >/dev/null 2>&1
}

if [ -z "$API_BASE" ]; then
  if probe_api_base "$DEFAULT_API_BASE_PRIMARY"; then
    API_BASE="$DEFAULT_API_BASE_PRIMARY"
  elif probe_api_base "$DEFAULT_API_BASE_FALLBACK"; then
    API_BASE="$DEFAULT_API_BASE_FALLBACK"
  else
    echo "[user-web-real-api-smoke] no reachable api base (tried: $DEFAULT_API_BASE_PRIMARY, $DEFAULT_API_BASE_FALLBACK)" >&2
    exit 1
  fi
fi

echo "[user-web-real-api-smoke] send-code"
send=$(curl -sS -X POST "$API_BASE/auth/send-code" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\",\"purpose\":\"login\"}")
send_code_status=$(printf '%s' "$send" | json_field code)
if [ "$send_code_status" = "0" ]; then
  code=$(printf '%s' "$send" | json_field data.debugCode)
else
  echo "[user-web-real-api-smoke] send-code fallback: $send"
  code=${USER_WEB_REAL_SMS_CODE:-123456}
fi

echo "[user-web-real-api-smoke] login"
login=$(curl -sS -X POST "$API_BASE/auth/login" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\",\"code\":\"$code\"}")
assert_code_zero "$login" login
token=$(printf '%s' "$login" | json_field data.token)

echo "[user-web-real-api-smoke] provider detail"
provider=$(curl -sS "$API_BASE/designers/$PROVIDER_ID")
assert_code_zero "$provider" provider-detail

echo "[user-web-real-api-smoke] booking detail"
booking=$(curl -sS "$API_BASE/bookings/$BOOKING_ID" -H "Authorization: Bearer $token")
assert_code_zero "$booking" booking-detail

echo "[user-web-real-api-smoke] proposal detail"
proposal=$(curl -sS "$API_BASE/proposals/$PROPOSAL_ID" -H "Authorization: Bearer $token")
assert_code_zero "$proposal" proposal-detail

echo "[user-web-real-api-smoke] order plans"
plans=$(curl -sS "$API_BASE/orders/$ORDER_ID/plans" -H "Authorization: Bearer $token")
assert_code_zero "$plans" order-plans

echo "[user-web-real-api-smoke] project detail/phases/milestones"
project=$(curl -sS "$API_BASE/projects/$PROJECT_ID" -H "Authorization: Bearer $token")
phases=$(curl -sS "$API_BASE/projects/$PROJECT_ID/phases" -H "Authorization: Bearer $token")
milestones=$(curl -sS "$API_BASE/projects/$PROJECT_ID/milestones" -H "Authorization: Bearer $token")
assert_code_zero "$project" project-detail
assert_code_zero "$phases" project-phases
assert_code_zero "$milestones" project-milestones

echo "[user-web-real-api-smoke] ok"
