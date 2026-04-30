#!/usr/bin/env bash
set -euo pipefail

# Backup PostgreSQL databases (main + tinode) using a disposable postgres docker image.
# Works with managed RDS (no local pg tools needed).
#
# Required env:
#   DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD
# Optional env:
#   DATABASE_DBNAME (default: home_decoration)
#   TINODE_DBNAME   (default: tinode)
#   BACKUP_DIR      (default: ./backups)
#   BACKUP_DOCKER_NETWORK (optional docker network for containerized DB hosts)

DATABASE_DBNAME="${DATABASE_DBNAME:-home_decoration}"
TINODE_DBNAME="${TINODE_DBNAME:-tinode}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_DOCKER_NETWORK="${BACKUP_DOCKER_NETWORK:-}"

if [[ -z "${DATABASE_HOST:-}" || -z "${DATABASE_PORT:-}" || -z "${DATABASE_USER:-}" || -z "${DATABASE_PASSWORD:-}" ]]; then
  echo "Missing required env vars: DATABASE_HOST/DATABASE_PORT/DATABASE_USER/DATABASE_PASSWORD" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

DOCKER_NETWORK_ARGS=()
if [[ -n "${BACKUP_DOCKER_NETWORK}" ]]; then
  DOCKER_NETWORK_ARGS=(--network "${BACKUP_DOCKER_NETWORK}")
fi

TS="$(date -u +%Y%m%dT%H%M%SZ)"

dump_db() {
  local dbname="$1"
  local out_file="${BACKUP_DIR}/${dbname}_${TS}.sql.gz"

  echo "Backing up database: ${dbname} -> ${out_file}"

  docker run --rm \
    "${DOCKER_NETWORK_ARGS[@]}" \
    -e "PGPASSWORD=${DATABASE_PASSWORD}" \
    postgres:15-alpine \
    sh -ceu "pg_dump -h \"${DATABASE_HOST}\" -p \"${DATABASE_PORT}\" -U \"${DATABASE_USER}\" -d \"${dbname}\" --no-owner --no-privileges | gzip -c" \
    > "${out_file}"

  echo "OK: ${out_file}"
}

dump_db "${DATABASE_DBNAME}"
dump_db "${TINODE_DBNAME}"

echo ""
echo "Next (optional): upload ${BACKUP_DIR}/*.gz to OSS (use ossutil/aliyun-cli configured on the ECS host)."
