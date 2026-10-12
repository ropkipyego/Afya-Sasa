#!/usr/bin/env bash
# Restore a pg_dump into the *local docker compose* Postgres only.
# This is not a proven production recovery procedure until a restore has been tested
# on a disposable copy.
set -euo pipefail

dump="${1:-}"
if [[ -z "${dump}" || ! -f "${dump}" ]]; then
  echo "Usage: AFYASASA_RESTORE_CONFIRM=I_UNDERSTAND_LOCAL_ONLY bash ops/restore-postgres.sh backups/file.sql" >&2
  exit 1
fi

if [[ "${AFYASASA_RESTORE_CONFIRM:-}" != "I_UNDERSTAND_LOCAL_ONLY" ]]; then
  echo "Refusing restore. Set AFYASASA_RESTORE_CONFIRM=I_UNDERSTAND_LOCAL_ONLY and point docker compose at a disposable database." >&2
  exit 1
fi

if [[ "${TYPEORM_MIGRATIONS_RUN:-false}" == "true" ]]; then
  echo "Refusing restore while TYPEORM_MIGRATIONS_RUN=true." >&2
  exit 1
fi

echo "Restore is not executed from this programme. Run pg_restore/psql against a disposable compose Postgres after ICT review."
echo "Dump path: ${dump}"
echo "LIVE STACK MUST REMAIN UNCHANGED."
exit 2
