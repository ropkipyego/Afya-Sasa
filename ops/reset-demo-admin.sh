#!/usr/bin/env bash
set -euo pipefail

# Resets the Jalaram / demo administrator to documented first-login credentials.
# Password hash matches ChangeMe123! from InitialPhaseOne migration.

CONTAINER="${POSTGRES_CONTAINER:-afya-sasa-postgres-1}"
DB_USER="${POSTGRES_USER:-afyasasa}"
DB_NAME="${POSTGRES_DB:-afyasasa}"
ADMIN_EMAIL="${ADMIN_EMAIL:-it@jalaram.co.ke}"

echo "Resetting admin account (${ADMIN_EMAIL})…"

docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
  "UPDATE demo.users SET password_hash = '\$2b\$12\$qRe3g8JqjBxv8saFH9j6yONr.MRd2WdoemkXP53ZANso.yOOcacFa', force_password_change = true, failed_login_attempts = 0, locked_until = NULL, active = true WHERE email IN ('${ADMIN_EMAIL}', 'admin@demo.afyasasa.local', 'it@jalaram.co.ke');"

echo "Done. Sign in as ${ADMIN_EMAIL} with ChangeMe123! and set a new password when prompted."
