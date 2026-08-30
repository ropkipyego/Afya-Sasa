#!/usr/bin/env bash
# SMS: login → bulk send → verify log (Celcom Africa or stub)
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
TENANT="${TENANT:-jalaram}"
ADMIN_EMAIL="${ADMIN_EMAIL:-it@jalaram.co.ke}"
PASSWORD="${PASSWORD:-ChangeMe123!}"
SMS_TEST_MOBILE="${SMS_TEST_MOBILE:-}"

step() { echo ""; echo "━━━ $1 ━━━"; }
ok() { echo "✓ $1"; }
fail() { echo "✗ $1"; exit 1; }
skip() { echo "⊘ $1"; }

api() {
  local method="$1" path="$2"
  shift 2
  curl -fsS -X "$method" "${API}${path}" \
    -H "Content-Type: application/json" \
    -H "X-Tenant: ${TENANT}" \
    -H "Authorization: Bearer ${TOKEN}" \
    "$@"
}

login_as() {
  local email="$1"
  local login
  login="$(curl -fsS -X POST "${API}/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-Tenant: ${TENANT}" \
    --data "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\",\"device\":\"sms-workflow-test\"}")"
  TOKEN="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")"
}

step "1. Login (admin — needs settings:manage for bulk SMS)"
login_as "$ADMIN_EMAIL"
ok "Authenticated"

step "2. Check recent SMS logs (before)"
BEFORE="$(api GET "/notifications/sms/logs?limit=5")"
echo "$BEFORE" | python3 -c "import sys,json; rows=json.load(sys.stdin); print(f'  Existing log rows: {len(rows)}')"

if [[ -z "$SMS_TEST_MOBILE" ]]; then
  skip "Live send skipped — set SMS_TEST_MOBILE=0712345678 to test Celcom delivery"
  echo ""
  echo "To send a real test SMS:"
  echo "  SMS_TEST_MOBILE=07XXXXXXXX API=$API TENANT=$TENANT npm run test:sms"
  echo ""
  echo "Or use Hospital Control Center → Notifications → Bulk SMS"
  exit 0
fi

step "3. Send test SMS to ${SMS_TEST_MOBILE}"
RESULT="$(api POST "/notifications/sms/bulk" --data "{
  \"mobiles\": [\"${SMS_TEST_MOBILE}\"],
  \"message\": \"AfyaSasa SMS test from Jalaram Hospital — $(date -u +%Y-%m-%dT%H:%MZ). Reply if received.\"
}")"
echo "$RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d.get('ok') is True, d
print(f'  Provider: {d.get(\"provider\")}')
print(f'  Status: {d.get(\"status\")}')
print(f'  Message ID: {d.get(\"providerMessageId\")}')
" || fail "Bulk SMS API returned unexpected payload"
ok "SMS accepted by provider"

step "4. Verify SMS log row"
sleep 1
AFTER="$(api GET "/notifications/sms/logs?limit=3")"
echo "$AFTER" | python3 -c "
import sys,json,os
rows=json.load(sys.stdin)
mobile=os.environ.get('SMS_TEST_MOBILE','')
match=[r for r in rows if mobile.replace('+','') in r.get('destination','').replace('+','') or r.get('destination','').endswith(mobile[-9:])]
assert match, f'No log row for {mobile}. Latest: {rows[:1]}'
print(f'  Logged: {match[0][\"provider\"]} → {match[0][\"deliveryStatus\"]}')
" SMS_TEST_MOBILE="$SMS_TEST_MOBILE" || fail "SMS not found in logs"
ok "SMS log recorded"

echo ""
echo "══════════════════════════════════════"
echo "SMS workflow: ALL PASSED"
echo "Check the handset for delivery."
echo "══════════════════════════════════════"
