#!/usr/bin/env bash
set -euo pipefail

REDIS_CONTAINER=${USER_WEB_FIXTURE_REDIS_CONTAINER:-home_decor_redis_local}
REDIS_HOST=${USER_WEB_FIXTURE_REDIS_HOST:-127.0.0.1}
REDIS_PORT=${USER_WEB_FIXTURE_REDIS_PORT:-6380}
REDIS_PASSWORD=${USER_WEB_FIXTURE_REDIS_PASSWORD:-}

clear_with_redis_cli() {
  local auth_args=()
  if [[ -n "$REDIS_PASSWORD" ]]; then
    auth_args=(-a "$REDIS_PASSWORD")
  fi

  local keys
  keys=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" "${auth_args[@]}" --raw KEYS 'rate_limit:*' || true)
  if [[ -n "$keys" ]]; then
    while IFS= read -r key; do
      [[ -z "$key" ]] && continue
      redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" "${auth_args[@]}" DEL "$key" >/dev/null
    done <<<"$keys"
    echo "Cleared rate limit keys via redis-cli"
  else
    echo "No rate limit keys found via redis-cli"
  fi
}

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$REDIS_CONTAINER"; then
  keys=$(docker exec "$REDIS_CONTAINER" redis-cli --raw KEYS 'rate_limit:*' || true)
  if [[ -n "$keys" ]]; then
    while IFS= read -r key; do
      [[ -z "$key" ]] && continue
      docker exec "$REDIS_CONTAINER" redis-cli DEL "$key" >/dev/null
    done <<<"$keys"
    echo "Cleared rate limit keys via docker container: $REDIS_CONTAINER"
  else
    echo "No rate limit keys found in docker container: $REDIS_CONTAINER"
  fi
elif command -v redis-cli >/dev/null 2>&1; then
  clear_with_redis_cli
else
  echo "redis-cli not found and redis container unavailable; skip rate limit cleanup" >&2
fi
