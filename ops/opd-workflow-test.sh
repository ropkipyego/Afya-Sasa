#!/usr/bin/env bash
# Reception + OPD end-to-end API workflow for onboarding validation
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
TENANT="${TENANT:-demo}"
EMAIL="${EMAIL:-it@jalaram.co.ke}"
PASSWORD="${PASSWORD:-ChangeMe123!}"
OUT_DIR="${OUT_DIR:-ops/onboarding-tests/results}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="${OUT_DIR}/opd-api-${TIMESTAMP}.log"

mkdir -p "$OUT_DIR"

step() { echo ""; echo "━━━ $1 ━━━" | tee -a "$LOG_FILE"; }
ok() { echo "✓ $1" | tee -a "$LOG_FILE"; }
fail() { echo "✗ $1" | tee -a "$LOG_FILE"; exit 1; }

api() {
  local method="$1" path="$2"
  shift 2
  curl -fsS -X "$method" "${API}${path}" \
    -H "Content-Type: application/json" \
    -H "X-Tenant: ${TENANT}" \
    -H "Authorization: Bearer ${TOKEN}" \
    "$@"
}

step "1. Login"
login="$(curl -fsS -X POST "${API}/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: ${TENANT}" \
  --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"device\":\"opd-onboarding-test\"}")"
TOKEN="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")"
ok "Authenticated"

step "2. Patient search (reception)"
patients="$(api GET "/patients?q=brian&pageSize=5")"
PATIENT_ID="$(echo "$patients" | python3 -c "
import sys,json
d=json.load(sys.stdin)
rows=d.get('items',[])
print(rows[0]['id'] if rows else '')
")"
[[ -n "$PATIENT_ID" ]] || fail "No patient found for search"
ok "Patient ${PATIENT_ID}"

step "3. OPD check-in (create encounter)"
encounter="$(api POST "/opd/encounters" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"visitType\": \"new\",
  \"destination\": \"doctor\",
  \"departmentName\": \"General Outpatient\",
  \"presentingComplaint\": \"Fever and headache — onboarding test\"
}")"
ENCOUNTER_ID="$(echo "$encounter" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ok "Encounter ${ENCOUNTER_ID}"

step "4. Triage board & queue"
api GET "/opd/triage/board" >/dev/null
queue="$(api GET "/opd/triage/queue")"
ok "Triage board + queue (${#queue} bytes)"

step "5. Record triage"
api POST "/opd/encounters/${ENCOUNTER_ID}/triage" --data '{
  "category": "urgent",
  "colour": "yellow",
  "chiefComplaint": "Fever and headache",
  "painScore": 4,
  "temperature": 38.1,
  "pulse": 88,
  "respiratoryRate": 18,
  "bpSystolic": 120,
  "bpDiastolic": 78,
  "spo2": 98,
  "weight": 70,
  "height": 175
}' >/dev/null
ok "Triage saved"

step "6. Doctor queue"
doc_queue="$(api GET "/opd/doctor/queue")"
ok "Doctor queue loaded"

step "7. SOAP consultation"
consult="$(api POST "/opd/encounters/${ENCOUNTER_ID}/consultations" --data '{
  "subjective": "3-day headache with fever",
  "objective": "Alert, temp 38.1, no neck stiffness",
  "assessment": "Likely viral illness",
  "plan": "Paracetamol, fluids, review if worse"
}')"
CONSULT_ID="$(echo "$consult" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ok "Consultation ${CONSULT_ID}"

step "8. Add diagnosis"
api POST "/opd/encounters/${ENCOUNTER_ID}/diagnoses" --data '{
  "icd10Code": "R50.9",
  "description": "Fever, unspecified",
  "type": "primary",
  "confirmed": true
}' >/dev/null
ok "Diagnosis added"

step "9. Referral (reception module)"
referral="$(api POST "/referrals" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"encounterId\": \"${ENCOUNTER_ID}\",
  \"type\": \"internal\",
  \"targetDepartment\": \"Physiotherapy\",
  \"reason\": \"Post-viral fatigue\",
  \"letter\": \"Patient recovering from viral illness. Refer for graded exercise programme.\"
}")"
REFERRAL_ID="$(echo "$referral" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ok "Referral ${REFERRAL_ID}"

step "10. Sick sheet (document)"
today="$(date -u +%Y-%m-%d)"
end="$(date -u -d '+3 days' +%Y-%m-%d 2>/dev/null || date -u -v+3d +%Y-%m-%d)"
sick="$(api POST "/opd/sick-sheets" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"encounterId\": \"${ENCOUNTER_ID}\",
  \"diagnosis\": \"Viral fever\",
  \"daysOff\": 3,
  \"startDate\": \"${today}\",
  \"endDate\": \"${end}\",
  \"doctorName\": \"Dr. Demo Clinician\",
  \"licenseNumber\": \"DEMO-001\",
  \"notes\": \"Rest and hydration\"
}")"
SICK_ID="$(echo "$sick" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ok "Sick sheet ${SICK_ID}"

step "11. List sick sheets (was 500 without patientId filter fix)"
api GET "/opd/sick-sheets?patientId=${PATIENT_ID}" >/dev/null
ok "Sick sheets list OK"

step "12. Appointments"
doctors="$(api GET "/admin/users")"
DOCTOR_ID="$(echo "$doctors" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
print(rows[0]['id'] if rows else '')
")"
if [[ -n "$DOCTOR_ID" ]]; then
  api POST "/appointments" --data "{
    \"patientId\": \"${PATIENT_ID}\",
    \"doctorId\": \"${DOCTOR_ID}\",
    \"appointmentDate\": \"${end}\",
    \"appointmentTime\": \"10:00\",
    \"type\": \"follow_up\",
    \"reason\": \"OPD review after sick leave\"
  }" >/dev/null
  ok "Appointment booked"
else
  ok "Skipped appointment (no doctors in seed)"
fi
api GET "/appointments" >/dev/null
api GET "/appointments/today" >/dev/null
ok "Appointments list OK"

step "13. Patient timeline (documents center)"
timeline="$(api GET "/patients/${PATIENT_ID}/timeline")"
echo "$timeline" | python3 -c "
import sys,json
e=json.load(sys.stdin).get('events',[])
print(f'  Timeline events: {len(e)}')
" | tee -a "$LOG_FILE"
ok "Timeline loaded"

step "14. Complete visit"
api PATCH "/opd/encounters/${ENCOUNTER_ID}/status" --data '{"status":"completed"}' >/dev/null
ok "Encounter completed"

step "15. Referrals list"
refs="$(api GET "/referrals")"
echo "$refs" | python3 -c "import sys,json; print(f'  Total referrals: {len(json.load(sys.stdin))}')" | tee -a "$LOG_FILE"
ok "Referrals list OK"

SUMMARY="${OUT_DIR}/opd-api-summary-${TIMESTAMP}.json"
python3 -c "
import json
print(json.dumps({
  'timestamp': '${TIMESTAMP}',
  'patientId': '${PATIENT_ID}',
  'encounterId': '${ENCOUNTER_ID}',
  'consultationId': '${CONSULT_ID}',
  'referralId': '${REFERRAL_ID}',
  'sickSheetId': '${SICK_ID}',
  'status': 'passed'
}, indent=2))
" > "$SUMMARY"

echo "" | tee -a "$LOG_FILE"
echo "══════════════════════════════════════" | tee -a "$LOG_FILE"
echo "OPD + Reception workflow: ALL PASSED" | tee -a "$LOG_FILE"
echo "Log:     ${LOG_FILE}" | tee -a "$LOG_FILE"
echo "Summary: ${SUMMARY}" | tee -a "$LOG_FILE"
echo "══════════════════════════════════════" | tee -a "$LOG_FILE"
