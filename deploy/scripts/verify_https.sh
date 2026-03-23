#!/usr/bin/env bash
set -euo pipefail

ROOT_DOMAIN="${ROOT_DOMAIN:-hezeyunchuang.com}"
ADMIN_HOST="${ADMIN_HOST:-admin.${ROOT_DOMAIN}}"
API_HOST="${API_HOST:-api.${ROOT_DOMAIN}}"
CURL_BIN="${CURL_BIN:-curl}"
OPENSSL_BIN="${OPENSSL_BIN:-openssl}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-12}"

if ! command -v "${CURL_BIN}" >/dev/null 2>&1; then
  echo "curl not found: ${CURL_BIN}" >&2
  exit 1
fi

if ! command -v "${OPENSSL_BIN}" >/dev/null 2>&1; then
  echo "openssl not found: ${OPENSSL_BIN}" >&2
  exit 1
fi

ok_count=0
fail_count=0

pass() {
  printf '[PASS] %s\n' "$1"
  ok_count=$((ok_count + 1))
}

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  fail_count=$((fail_count + 1))
}

check_status() {
  local url="$1"
  local expected="$2"
  local label="$3"
  local status
  status="$("${CURL_BIN}" -k -sS -o /dev/null -w '%{http_code}' --max-time "${TIMEOUT_SECONDS}" "${url}" || echo "000")"
  if [[ "${status}" == "${expected}" ]]; then
    pass "${label} -> ${status}"
  else
    fail "${label} -> got ${status}, want ${expected}"
  fi
}

check_redirect_prefix() {
  local url="$1"
  local expected_prefix="$2"
  local label="$3"
  local headers
  headers="$("${CURL_BIN}" -k -sS -I --max-time "${TIMEOUT_SECONDS}" "${url}" || true)"
  if [[ "${headers}" != *" 301 "* && "${headers}" != *" 302 "* ]]; then
    fail "${label} -> expected redirect, got: $(printf '%s' "${headers}" | head -n 1)"
    return
  fi

  local location
  location="$(printf '%s\n' "${headers}" | awk 'BEGIN{IGNORECASE=1} /^location:/ {sub(/\r$/,"",$2); print $2; exit}')"
  if [[ "${location}" == "${expected_prefix}"* ]]; then
    pass "${label} -> ${location}"
  else
    fail "${label} -> redirect location mismatch: ${location}"
  fi
}

check_tls_handshake() {
  local host="$1"
  local label="$2"
  local output
  output="$(printf '' | "${OPENSSL_BIN}" s_client -connect "${host}:443" -servername "${host}" -tls1_2 2>/dev/null || true)"
  if [[ "${output}" == *"BEGIN CERTIFICATE"* ]] && [[ "${output}" == *"Protocol  : TLSv1.2"* || "${output}" == *"Protocol  : TLSv1.3"* ]]; then
    pass "${label}"
  else
    fail "${label}"
  fi
}

echo "==> Verifying HTTPS rollout"
echo "ROOT_DOMAIN=${ROOT_DOMAIN}"
echo "ADMIN_HOST=${ADMIN_HOST}"
echo "API_HOST=${API_HOST}"
echo

check_redirect_prefix "http://${ROOT_DOMAIN}/" "https://${ROOT_DOMAIN}/" "Root domain HTTP -> HTTPS"
check_redirect_prefix "http://${ADMIN_HOST}/admin/login" "https://${ADMIN_HOST}/admin/login" "Admin domain HTTP -> HTTPS"
check_redirect_prefix "http://${API_HOST}/api/v1/health" "https://${API_HOST}/api/v1/health" "API domain HTTP -> HTTPS"

check_tls_handshake "${ROOT_DOMAIN}" "Root domain TLS handshake"
check_tls_handshake "${ADMIN_HOST}" "Admin domain TLS handshake"
check_tls_handshake "${API_HOST}" "API domain TLS handshake"

check_status "https://${ROOT_DOMAIN}/" "200" "Root domain homepage"
check_status "https://${ROOT_DOMAIN}/api/v1/health" "404" "Root domain blocks API path"
check_status "https://${ADMIN_HOST}/admin/login" "200" "Admin login page"
check_status "https://${ADMIN_HOST}/api/v1/health" "404" "Admin domain blocks API path"
check_status "https://${API_HOST}/api/v1/health" "200" "API health endpoint"
check_status "https://${API_HOST}/tinode/v0/version" "200" "Tinode version endpoint"

echo
echo "PASS=${ok_count} FAIL=${fail_count}"
if [[ "${fail_count}" -gt 0 ]]; then
  exit 1
fi
