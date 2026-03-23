#!/usr/bin/env bash
set -euo pipefail

# 用法:
#   bash deploy/scripts/report_risk_warning.sh open <type> <level> <scope> <description>
#   bash deploy/scripts/report_risk_warning.sh resolve <type> <scope> <result>
#
# 依赖环境变量:
#   DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD
# 可选:
#   DATABASE_DBNAME (默认: home_decoration)

MODE="${1:-}"
ALERT_TYPE="${2:-}"
ARG3="${3:-}"
ARG4="${4:-}"
ARG5="${5:-}"
DATABASE_DBNAME="${DATABASE_DBNAME:-home_decoration}"

if [[ -z "${DATABASE_HOST:-}" || -z "${DATABASE_PORT:-}" || -z "${DATABASE_USER:-}" || -z "${DATABASE_PASSWORD:-}" ]]; then
  echo "Missing required env vars: DATABASE_HOST/DATABASE_PORT/DATABASE_USER/DATABASE_PASSWORD" >&2
  exit 1
fi

if [[ -z "${MODE}" || -z "${ALERT_TYPE}" ]]; then
  echo "Usage: bash deploy/scripts/report_risk_warning.sh <open|resolve> ..." >&2
  exit 1
fi

run_psql() {
  docker run --rm \
    -e "PGPASSWORD=${DATABASE_PASSWORD}" \
    postgres:15-alpine \
    psql \
      -v ON_ERROR_STOP=1 \
      -h "${DATABASE_HOST}" \
      -p "${DATABASE_PORT}" \
      -U "${DATABASE_USER}" \
      -d "${DATABASE_DBNAME}" \
      "$@"
}

if [[ "${MODE}" == "open" ]]; then
  ALERT_LEVEL="${ARG3}"
  ALERT_SCOPE="${ARG4}"
  ALERT_DESC="${ARG5}"
  if [[ -z "${ALERT_LEVEL}" || -z "${ALERT_SCOPE}" || -z "${ALERT_DESC}" ]]; then
    echo "Usage: bash deploy/scripts/report_risk_warning.sh open <type> <level> <scope> <description>" >&2
    exit 1
  fi

  run_psql \
    -v alert_type="${ALERT_TYPE}" \
    -v alert_level="${ALERT_LEVEL}" \
    -v alert_scope="${ALERT_SCOPE}" \
    -v alert_desc="${ALERT_DESC}" <<'SQL'
UPDATE risk_warnings
SET level = :'alert_level',
    description = :'alert_desc',
    status = CASE WHEN status = 1 THEN 1 ELSE 0 END,
    updated_at = NOW(),
    handled_at = NULL,
    handled_by = NULL,
    handle_result = ''
WHERE type = :'alert_type'
  AND project_id = 0
  AND project_name = :'alert_scope'
  AND status IN (0, 1);

INSERT INTO risk_warnings (created_at, updated_at, project_id, project_name, type, level, description, status)
SELECT NOW(), NOW(), 0, :'alert_scope', :'alert_type', :'alert_level', :'alert_desc', 0
WHERE NOT EXISTS (
  SELECT 1
  FROM risk_warnings
  WHERE type = :'alert_type'
    AND project_id = 0
    AND project_name = :'alert_scope'
    AND status IN (0, 1)
);
SQL
  exit 0
fi

if [[ "${MODE}" == "resolve" ]]; then
  ALERT_SCOPE="${ARG3}"
  ALERT_RESULT="${ARG4:-系统自动恢复}"
  if [[ -z "${ALERT_SCOPE}" ]]; then
    echo "Usage: bash deploy/scripts/report_risk_warning.sh resolve <type> <scope> <result>" >&2
    exit 1
  fi

  run_psql \
    -v alert_type="${ALERT_TYPE}" \
    -v alert_scope="${ALERT_SCOPE}" \
    -v alert_result="${ALERT_RESULT}" <<'SQL'
UPDATE risk_warnings
SET status = 2,
    updated_at = NOW(),
    handled_at = NOW(),
    handle_result = :'alert_result'
WHERE type = :'alert_type'
  AND project_id = 0
  AND project_name = :'alert_scope'
  AND status IN (0, 1);
SQL
  exit 0
fi

echo "Unsupported mode: ${MODE}" >&2
exit 1
