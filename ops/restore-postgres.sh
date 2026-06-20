#!/usr/bin/env bash
set -euo pipefail

backup_file="${1:-}"

if [[ -z "${backup_file}" ]]; then
  echo "Usage: npm run db:restore -- path/to/backup.sql" >&2
  exit 1
fi

if [[ ! -f "${backup_file}" ]]; then
  echo "Backup file not found: ${backup_file}" >&2
  exit 1
fi

docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-afyasasa}" \
  -d "${POSTGRES_DB:-afyasasa}" \
  < "${backup_file}"

echo "Restored ${backup_file}"
