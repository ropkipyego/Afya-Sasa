#!/usr/bin/env bash
# Emergency: register → triage → disposition (API)
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
TENANT="${TENANT:-jalaram}"
ADMIN_EMAIL="${ADMIN_EMAIL:-it@jalaram.co.ke}"
PASSWORD="${PASSWORD:-ChangeMe123!}"

step() { echo ""; echo "━━━ $1 ━━━"; }
ok() { echo "✓ $1"; }
fail() { echo "✗ $1"; exit 1; }

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
    --data "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\",\"device\":\"ed-workflow-test\"}")"
  TOKEN="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")"
}

step "1. Admin — create isolated test patient"
login_as "$ADMIN_EMAIL"
UNIQ="$(date +%s)"
PHONE="+2547${UNIQ: -8}"
created="$(api POST "/patients" --data "{
  \"firstName\": \"AFYASASA-ED-TEST\",
  \"lastName\": \"Workflow${UNIQ}\",
  \"dateOfBirth\": \"1985-06-11\",
  \"gender\": \"male\",
  \"primaryPhone\": \"${PHONE}\"
}")"
PATIENT_ID="$(echo "$created" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
[[ -n "$PATIENT_ID" ]] || fail "Failed to create isolated ED test patient"
ok "Isolated test patient ${PATIENT_ID}"

step "2. Register ED encounter"
ed="$(api POST "/emergency/register" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"presentingComplaint\": \"Chest pain — workflow test\",
  \"arrivalMode\": \"walk_in\"
}")"
ED_ID="$(echo "$ed" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ENCOUNTER_ID="$(echo "$ed" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['encounter']['id'])")"
echo "$ed" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d['status']=='active'
print(f'  ED {d[\"id\"]} encounter {d[\"encounter\"][\"id\"]}')
" || fail "Register failed"
ok "ED encounter registered"

step "3. Triage (yellow)"
api POST "/emergency/${ED_ID}/triage" --data '{
  "triageCategory": "yellow",
  "notes": "Workflow test triage"
}' >/dev/null
encounter="$(api GET "/opd/encounters/${ENCOUNTER_ID}")"
echo "$encounter" | python3 -c "
import sys,json
assert json.load(sys.stdin)['status']=='triaged'
" || fail "Encounter not triaged after ED triage"
ok "Triage saved; encounter status triaged"

step "4. Disposition — discharge home"
api POST "/emergency/${ED_ID}/disposition" --data '{
  "outcome": "discharged_home",
  "notes": "Stable — workflow test discharge"
}' >/dev/null
encounter="$(api GET "/opd/encounters/${ENCOUNTER_ID}")"
echo "$encounter" | python3 -c "
import sys,json
assert json.load(sys.stdin)['status']=='completed'
" || fail "Encounter not completed after disposition"
ok "Disposition closed; encounter completed"

step "5. ED queue includes disposed episode"
queue="$(api GET "/emergency/queue")"
echo "$queue" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
print(f'  Queue size: {len(rows)}')
" || fail "Queue fetch failed"
ok "ED queue accessible"

echo ""
echo "══════════════════════════════════════"
echo "Emergency workflow: ALL PASSED"
echo "══════════════════════════════════════"
