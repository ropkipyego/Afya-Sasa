#!/usr/bin/env bash
# Restore a pg_dump into a *named disposable* local database only.
# Never restores into afyasasa or any other live/shared catalog.
set -euo pipefail

dump="${1:-}"
if [[ -z "${dump}" || ! -f "${dump}" ]]; then
  echo "Usage: AFYASASA_RESTORE_CONFIRM=I_UNDERSTAND_LOCAL_ONLY AFYASASA_RESTORE_TARGET_DB=hmis_sim_restore bash ops/restore-postgres.sh path/to.dump.sql" >&2
  exit 1
fi

if [[ "${AFYASASA_RESTORE_CONFIRM:-}" != "I_UNDERSTAND_LOCAL_ONLY" ]]; then
  echo "Refusing restore. Set AFYASASA_RESTORE_CONFIRM=I_UNDERSTAND_LOCAL_ONLY and AFYASASA_RESTORE_TARGET_DB=hmis_sim_restore." >&2
  exit 1
fi

if [[ "${TYPEORM_MIGRATIONS_RUN:-false}" == "true" ]]; then
  echo "Refusing restore while TYPEORM_MIGRATIONS_RUN=true." >&2
  exit 1
fi

target="${AFYASASA_RESTORE_TARGET_DB:-}"
case "${target}" in
  hmis_sim_restore) ;;
  afyasasa|afya|jalaram|sokoos|postgres|demo|"")
    echo "Refusing restore target '${target:-<empty>}'. Only AFYASASA_RESTORE_TARGET_DB=hmis_sim_restore is permitted." >&2
    exit 2
    ;;
  *)
    echo "Refusing restore target '${target}'. Only hmis_sim_restore is permitted." >&2
    exit 2
    ;;
esac

if grep -Eiq '(\\connect[[:space:]]+afyasasa)|(CREATE[[:space:]]+DATABASE[[:space:]]+afyasasa)' "${dump}"; then
  echo "Refusing dump that mentions operational database afyasasa." >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ADMIN_USER="${POSTGRES_USER:-afyasasa}"

identity="$(docker compose exec -T postgres psql -U "${ADMIN_USER}" -d "${target}" -Atc "SELECT current_database();")"
if [[ "${identity}" != "hmis_sim_restore" ]]; then
  echo "Refusing restore: connected database is ${identity}, not hmis_sim_restore." >&2
  exit 2
fi

docker compose exec -T postgres psql -U "${ADMIN_USER}" -d "${target}" -v ON_ERROR_STOP=1 < "${dump}"
echo "Restore completed into ${target} from ${dump}"
