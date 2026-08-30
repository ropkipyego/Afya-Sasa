#!/usr/bin/env bash
# Radiology order → report → verify → clinician review (API)
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
TENANT="${TENANT:-jalaram}"
DOC_EMAIL="${DOC_EMAIL:-doctor@jalaram.co.ke}"
RAD_EMAIL="${RAD_EMAIL:-radiology@jalaram.co.ke}"
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
    --data "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\",\"device\":\"radiology-workflow-test\"}")"
  TOKEN="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")"
}

step "1. Admin — patient + OPD encounter"
login_as "$ADMIN_EMAIL"
patients="$(api GET "/patients?q=brian&pageSize=1")"
PATIENT_ID="$(echo "$patients" | python3 -c "import sys,json; d=json.load(sys.stdin); rows=d.get('items',[]); print(rows[0]['id'] if rows else '')")"
[[ -n "$PATIENT_ID" ]] || fail "No patient"
encounter="$(api POST "/opd/encounters" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"visitType\": \"new\",
  \"destination\": \"doctor\",
  \"presentingComplaint\": \"Radiology workflow test\"
}")"
ENCOUNTER_ID="$(echo "$encounter" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
api POST "/opd/encounters/${ENCOUNTER_ID}/triage" --data '{
  "category":"routine","colour":"green","chiefComplaint":"CXR","painScore":0
}' >/dev/null
ok "Encounter ${ENCOUNTER_ID}"

step "2. Doctor — order chest X-ray"
login_as "$DOC_EMAIL"
modalities="$(api GET "/radiology/modalities")"
MODALITY_ID="$(echo "$modalities" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
print(next((m['id'] for m in rows if m.get('code')=='XRAY'), rows[0]['id'] if rows else ''))
")"
[[ -n "$MODALITY_ID" ]] || fail "No radiology modalities"
rad_req="$(api POST "/radiology/requests" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"encounterId\": \"${ENCOUNTER_ID}\",
  \"modalityId\": \"${MODALITY_ID}\",
  \"bodyPart\": \"Chest\",
  \"clinicalIndication\": \"Cough — rule out pneumonia\",
  \"priority\": \"routine\"
}")"
REQUEST_ID="$(echo "$rad_req" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
enc_status="$(api GET "/opd/encounters/${ENCOUNTER_ID}" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")"
[[ "$enc_status" == "awaiting_results" ]] || fail "Expected awaiting_results"
ok "Radiology request ${REQUEST_ID}"

step "3. Radiologist — report + verify"
login_as "$RAD_EMAIL"
report="$(api POST "/radiology/requests/${REQUEST_ID}/reports" --data '{
  "findings": "Clear lung fields",
  "impression": "No acute cardiopulmonary disease",
  "recommendation": "Clinical correlation"
}')"
REPORT_ID="$(echo "$report" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
api POST "/radiology/reports/${REPORT_ID}/verify" >/dev/null
ok "Report ${REPORT_ID} verified"

step "4. Doctor reviews report"
login_as "$DOC_EMAIL"
api POST "/radiology/reports/${REPORT_ID}/review" >/dev/null
enc_status="$(api GET "/opd/encounters/${ENCOUNTER_ID}" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")"
[[ "$enc_status" == "in_consultation" ]] || fail "Expected in_consultation after review"
ok "Encounter returned to in_consultation"

echo ""
echo "══════════════════════════════════════"
echo "Radiology workflow: ALL PASSED"
echo "══════════════════════════════════════"
