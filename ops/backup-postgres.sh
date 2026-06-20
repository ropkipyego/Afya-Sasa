#!/usr/bin/env bash
set -euo pipefail

mkdir -p backups

timestamp="$(date +%Y%m%d-%H%M%S)"
output="${1:-backups/afyasasa-${timestamp}.sql}"

docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-afyasasa}" \
  -d "${POSTGRES_DB:-afyasasa}" \
  --clean \
  --if-exists \
  > "${output}"

echo "Backup written to ${output}"
