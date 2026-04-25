#!/usr/bin/env bash
set -euo pipefail

CONTAINER_EXPLICIT=0
if [[ -n "${USER_WEB_FIXTURE_REDIS_CONTAINER+x}" ]]; then
  REDIS_CONTAINER=$USER_WEB_FIXTURE_REDIS_CONTAINER
  CONTAINER_EXPLICIT=1
else
  REDIS_CONTAINER=home_decor_redis_local
fi

PASSWORD_EXPLICIT=0
ENDPOINT_EXPLICIT=0
if [[ -n "${USER_WEB_FIXTURE_REDIS_HOST+x}" || -n "${USER_WEB_FIXTURE_REDIS_PORT+x}" || -n "${REDIS_HOST+x}" || -n "${REDIS_PORT+x}" ]]; then
  ENDPOINT_EXPLICIT=1
fi

REDIS_HOST=${USER_WEB_FIXTURE_REDIS_HOST:-${REDIS_HOST:-127.0.0.1}}
REDIS_PORT=${USER_WEB_FIXTURE_REDIS_PORT:-${REDIS_PORT:-6380}}

if [[ -n "${USER_WEB_FIXTURE_REDIS_PASSWORD+x}" ]]; then
  REDIS_PASSWORD=$USER_WEB_FIXTURE_REDIS_PASSWORD
  PASSWORD_EXPLICIT=1
elif [[ -n "${REDIS_PASSWORD+x}" ]]; then
  REDIS_PASSWORD=$REDIS_PASSWORD
  PASSWORD_EXPLICIT=1
elif [[ "$ENDPOINT_EXPLICIT" == "1" ]]; then
  REDIS_PASSWORD=""
else
  REDIS_PASSWORD=local_dev_redis_password_change_me
fi

resolve_docker_redis_password() {
  if [[ "$PASSWORD_EXPLICIT" == "1" || -z "$REDIS_CONTAINER" ]]; then
    return
  fi

  local cmd
  cmd=$(docker inspect "$REDIS_CONTAINER" --format '{{range .Config.Cmd}}{{println .}}{{end}}' 2>/dev/null || true)
  local expect_password=0
  local part
  while IFS= read -r part; do
    if [[ "$expect_password" == "1" ]]; then
      REDIS_PASSWORD=$part
      return
    fi
    if [[ "$part" == "--requirepass" ]]; then
      expect_password=1
      continue
    fi
    if [[ "$part" == --requirepass=* ]]; then
      REDIS_PASSWORD=${part#--requirepass=}
      return
    fi
  done <<<"$cmd"
}

is_auth_failure() {
  local payload=$1
  [[ "$payload" == *"NOAUTH"* || "$payload" == *"WRONGPASS"* || "$payload" == *"AUTH failed"* ]]
}

redis_cli_host() {
  if [[ -n "$REDIS_PASSWORD" ]]; then
    REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" "$@"
  else
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" "$@"
  fi
}

redis_cli_docker() {
  if [[ -n "$REDIS_PASSWORD" ]]; then
    docker exec -e REDISCLI_AUTH="$REDIS_PASSWORD" "$REDIS_CONTAINER" redis-cli "$@"
  else
    docker exec "$REDIS_CONTAINER" redis-cli "$@"
  fi
}

clear_with_redis_cli() {
  local keys
  keys=$(redis_cli_host --raw KEYS 'rate_limit:*' 2>&1 || true)
  if is_auth_failure "$keys"; then
    echo "Unable to clear rate limit keys via redis-cli: redis auth failed" >&2
    return
  fi
  if [[ -n "$keys" ]]; then
    while IFS= read -r key; do
      [[ -z "$key" ]] && continue
      redis_cli_host DEL "$key" >/dev/null 2>&1 || true
    done <<<"$keys"
    echo "Cleared rate limit keys via redis-cli"
  else
    echo "No rate limit keys found via redis-cli"
  fi
}

clear_with_docker() {
  resolve_docker_redis_password

  local keys
  keys=$(redis_cli_docker --raw KEYS 'rate_limit:*' 2>&1 || true)
  if is_auth_failure "$keys"; then
    echo "Unable to clear rate limit keys in docker container $REDIS_CONTAINER: redis auth failed" >&2
    return
  fi
  if [[ -n "$keys" ]]; then
    while IFS= read -r key; do
      [[ -z "$key" ]] && continue
      redis_cli_docker DEL "$key" >/dev/null 2>&1 || true
    done <<<"$keys"
    echo "Cleared rate limit keys via docker container: $REDIS_CONTAINER"
  else
    echo "No rate limit keys found in docker container: $REDIS_CONTAINER"
  fi
}

if [[ "$ENDPOINT_EXPLICIT" == "1" ]] && command -v redis-cli >/dev/null 2>&1; then
  clear_with_redis_cli
elif [[ -n "$REDIS_CONTAINER" ]] && [[ "$ENDPOINT_EXPLICIT" == "0" || "$CONTAINER_EXPLICIT" == "1" ]] && command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$REDIS_CONTAINER"; then
  clear_with_docker
elif command -v redis-cli >/dev/null 2>&1; then
  clear_with_redis_cli
else
  echo "redis-cli not found and redis container unavailable; skip rate limit cleanup" >&2
fi
