#!/usr/bin/env bash
# Lab order → sample → result → verify → clinician review (API)
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
TENANT="${TENANT:-jalaram}"
DOC_EMAIL="${DOC_EMAIL:-doctor@jalaram.co.ke}"
LAB_EMAIL="${LAB_EMAIL:-lab@jalaram.co.ke}"
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
    --data "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\",\"device\":\"lab-workflow-test\"}")"
  TOKEN="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")"
}

step "1. Admin — patient + OPD encounter"
login_as "$ADMIN_EMAIL"
patients="$(api GET "/patients?q=brian&pageSize=1")"
PATIENT_ID="$(echo "$patients" | python3 -c "import sys,json; d=json.load(sys.stdin); rows=d.get('items',[]); print(rows[0]['id'] if rows else '')")"
[[ -n "$PATIENT_ID" ]] || fail "No patient found"
encounter="$(api POST "/opd/encounters" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"visitType\": \"new\",
  \"destination\": \"doctor\",
  \"presentingComplaint\": \"Lab workflow test\"
}")"
ENCOUNTER_ID="$(echo "$encounter" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
api POST "/opd/encounters/${ENCOUNTER_ID}/triage" --data '{
  "category":"routine","colour":"green","chiefComplaint":"Lab test","painScore":1
}' >/dev/null
ok "Encounter ${ENCOUNTER_ID} triaged"

step "2. Doctor — order lab test (Haemoglobin)"
login_as "$DOC_EMAIL"
tests="$(api GET "/laboratory/tests")"
TEST_ID="$(echo "$tests" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
print(next((t['id'] for t in rows if t.get('code')=='HB'), rows[0]['id'] if rows else ''))
")"
[[ -n "$TEST_ID" ]] || fail "No lab tests in catalog"
lab_req="$(api POST "/laboratory/requests" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"encounterId\": \"${ENCOUNTER_ID}\",
  \"priority\": \"routine\",
  \"testIds\": [\"${TEST_ID}\"]
}")"
REQUEST_ID="$(echo "$lab_req" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ITEM_ID="$(echo "$lab_req" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d.get('items') or []
print(items[0]['id'] if items else '')
")"
[[ -n "$ITEM_ID" ]] || fail "Lab request has no items"
enc_status="$(api GET "/opd/encounters/${ENCOUNTER_ID}" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")"
[[ "$enc_status" == "awaiting_results" ]] || fail "Expected awaiting_results, got ${enc_status}"
ok "Lab request ${REQUEST_ID}; encounter awaiting_results"

step "3. Lab tech — collect, result, verify"
login_as "$LAB_EMAIL"
sample="$(api POST "/laboratory/requests/${REQUEST_ID}/samples" --data '{"type":"whole_blood"}')"
SAMPLE_ID="$(echo "$sample" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
result="$(api POST "/laboratory/results" --data "{
  \"requestItemId\": \"${ITEM_ID}\",
  \"sampleId\": \"${SAMPLE_ID}\",
  \"value\": \"13.2\",
  \"unit\": \"g/dL\"
}")"
RESULT_ID="$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
api POST "/laboratory/requests/${REQUEST_ID}/verify" >/dev/null
ok "Result ${RESULT_ID} verified"

step "4. Doctor reviews result → back to in_consultation"
login_as "$DOC_EMAIL"
api POST "/laboratory/results/${RESULT_ID}/review" >/dev/null
enc_status="$(api GET "/opd/encounters/${ENCOUNTER_ID}" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")"
[[ "$enc_status" == "in_consultation" ]] || fail "Expected in_consultation after review, got ${enc_status}"
ok "Encounter returned to in_consultation"

echo ""
echo "══════════════════════════════════════"
echo "Lab workflow: ALL PASSED"
echo "══════════════════════════════════════"
