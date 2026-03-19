#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${TEST_ENV_FILE:-${ROOT_DIR}/deploy/.env.test}"
COMPOSE_FILE="${ROOT_DIR}/deploy/docker-compose.test.yml"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing test env file: ${ENV_FILE}" >&2
  echo "Copy deploy/.env.test.example to deploy/.env.test and fill the secrets first." >&2
  exit 1
fi

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" down "$@"
