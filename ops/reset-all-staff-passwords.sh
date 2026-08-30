#!/usr/bin/env bash
set -euo pipefail

# Resets all active @jalaram.co.ke staff accounts to the documented first-login password.
# Does not affect external emails (e.g. gmail.com) or inactive accounts.

CONTAINER="${POSTGRES_CONTAINER:-afya-sasa-postgres-1}"
DB_USER="${POSTGRES_USER:-afyasasa}"
DB_NAME="${POSTGRES_DB:-afyasasa}"
DEFAULT_HASH='$2b$12$qRe3g8JqjBxv8saFH9j6yONr.MRd2WdoemkXP53ZANso.yOOcacFa'

echo "Resetting Jalaram staff passwords to ChangeMe123! …"

docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
  "UPDATE demo.users
   SET password_hash = '${DEFAULT_HASH}',
       force_password_change = true,
       failed_login_attempts = 0,
       locked_until = NULL,
       active = true
   WHERE email LIKE '%@jalaram.co.ke'
     AND deleted_at IS NULL;"

echo "Done. All @jalaram.co.ke accounts use ChangeMe123! — staff should change on first login."
