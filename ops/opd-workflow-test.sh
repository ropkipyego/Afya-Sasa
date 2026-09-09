#!/usr/bin/env bash
# Reception + OPD end-to-end API workflow for onboarding validation
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
TENANT="${TENANT:-jalaram}"
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
SEARCH_ID="$(echo "$patients" | python3 -c "
import sys,json
d=json.load(sys.stdin)
rows=d.get('items',[])
print(rows[0]['id'] if rows else '')
")"
[[ -n "$SEARCH_ID" ]] || fail "No patient found for search"
ok "Patient search ${SEARCH_ID}"

UNIQ="$(date +%s)"
PHONE="+2547${UNIQ: -8}"
ID_VALUE="TEST-${UNIQ}"

step "2c. Patient creation"
created="$(api POST "/patients" --data "{
  \"firstName\": \"Reception\",
  \"lastName\": \"Workflow${UNIQ}\",
  \"dateOfBirth\": \"1992-04-12\",
  \"gender\": \"female\",
  \"primaryPhone\": \"${PHONE}\",
  \"identifiers\": [{\"type\": \"national_id\", \"value\": \"${ID_VALUE}\", \"isPrimary\": true}]
}")"
PATIENT_ID="$(echo "$created" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
CREATED_NO="$(echo "$created" | python3 -c "import sys,json; print(json.load(sys.stdin)['patientNo'])")"
[[ -n "$PATIENT_ID" ]] || fail "Patient create did not return id"
ok "Created ${CREATED_NO} ${PATIENT_ID}"

step "2d. Duplicate detection"
dup="$(api POST "/patients/duplicates" --data "{
  \"firstName\": \"Reception\",
  \"lastName\": \"Workflow${UNIQ}\",
  \"dateOfBirth\": \"1992-04-12\",
  \"gender\": \"female\",
  \"primaryPhone\": \"${PHONE}\",
  \"identifiers\": [{\"type\": \"national_id\", \"value\": \"${ID_VALUE}\", \"isPrimary\": true}]
}")"
echo "$dup" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if not d.get('hasPotentialDuplicate'):
  raise SystemExit('expected hasPotentialDuplicate true')
cands=d.get('candidates') or []
if not any(c.get('id')=='${PATIENT_ID}' for c in cands):
  raise SystemExit('created patient missing from duplicate candidates')
" || fail "Duplicate detection did not flag the new patient"
ok "Duplicate check flagged existing patient"

step "2e. Duplicate identifier rejection"
dup_code="$(curl -sS -o /tmp/afyasasa-dup-id.json -w "%{http_code}" -X POST "${API}/patients" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: ${TENANT}" \
  -H "Authorization: Bearer ${TOKEN}" \
  --data "{
    \"firstName\": \"Other\",
    \"lastName\": \"Person\",
    \"dateOfBirth\": \"1988-01-01\",
    \"gender\": \"male\",
    \"primaryPhone\": \"+254700000001\",
    \"identifiers\": [{\"type\": \"national_id\", \"value\": \"${ID_VALUE}\", \"isPrimary\": true}]
  }")"
if [[ "$dup_code" != "409" ]]; then
  fail "Duplicate identifier should return 409, got ${dup_code}"
fi
ok "Duplicate identifier rejected (409)"

step "2f. Patient edit"
edited="$(api PATCH "/patients/${PATIENT_ID}" --data '{
  "occupation": "Reception clerk",
  "county": "Nairobi"
}')"
echo "$edited" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('occupation')!='Reception clerk' or d.get('county')!='Nairobi':
  raise SystemExit(f'edit not persisted: occupation={d.get(\"occupation\")} county={d.get(\"county\")}')
if d.get('id')!='${PATIENT_ID}' or d.get('patientNo')!='${CREATED_NO}':
  raise SystemExit('edit changed patient identity')
" || fail "Patient edit did not persist demographics"
ok "Patient demographics updated"

step "2g. Recent 20 patients newest first"
recent="$(api GET "/patients?pageSize=20")"
echo "$recent" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d.get('items') or []
if len(items)>20:
  raise SystemExit(f'expected at most 20, got {len(items)}')
if not items:
  raise SystemExit('recent list empty')
stamps=[row.get('createdAt') for row in items]
if stamps != sorted(stamps, reverse=True):
  raise SystemExit('recent patients are not newest-first')
ids=[row.get('id') for row in items]
if '${PATIENT_ID}' not in ids:
  raise SystemExit('newly created patient missing from recent 20')
if ids[0]!='${PATIENT_ID}':
  raise SystemExit(f'newest patient should be first, got {ids[0]}')
" || fail "Recent 20 ordering failed"
ok "Recent 20 newest-first includes new patient"

step "2b. Resolve clinical staff (preferred doctor)"
doctors="$(api GET "/admin/users")"
DOCTOR_ID="$(echo "$doctors" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
print(rows[0]['id'] if rows else '')
")"
[[ -n "$DOCTOR_ID" ]] || fail "No clinical staff found for attending doctor test"

step "3. OPD check-in (create encounter)"
encounter="$(api POST "/opd/encounters" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"visitType\": \"new\",
  \"destination\": \"doctor\",
  \"departmentName\": \"General Outpatient\",
  \"presentingComplaint\": \"Fever and headache — onboarding test\",
  \"attendingDoctorId\": \"${DOCTOR_ID}\"
}")"
ENCOUNTER_ID="$(echo "$encounter" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
echo "$encounter" | python3 -c "
import sys,json
enc=json.load(sys.stdin)
doc=enc.get('attendingDoctor') or {}
doc_id=doc.get('id') if isinstance(doc, dict) else None
expected='${DOCTOR_ID}'
if doc_id != expected:
  raise SystemExit(f'attendingDoctor.id expected {expected}, got {doc_id}')
print(f'  attendingDoctor: {doc.get(\"firstName\",\"\")} {doc.get(\"lastName\",\"\")}'.strip())
" || fail "attendingDoctor not persisted at check-in"
ok "Encounter ${ENCOUNTER_ID} (doctor assigned)"

step "3b. Duplicate same-day OPD check-in blocked"
dup_visit_code="$(curl -sS -o /tmp/afyasasa-dup-visit.json -w "%{http_code}" -X POST "${API}/opd/encounters" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: ${TENANT}" \
  -H "Authorization: Bearer ${TOKEN}" \
  --data "{
    \"patientId\": \"${PATIENT_ID}\",
    \"visitType\": \"new\",
    \"destination\": \"doctor\"
  }")"
if [[ "$dup_visit_code" != "400" ]]; then
  fail "Second same-day OPD check-in should return 400, got ${dup_visit_code}"
fi
ok "Duplicate same-day check-in blocked"

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

step "7b. Doctor queue keeps in_consultation encounter"
doc_queue_after="$(api GET "/opd/doctor/queue")"
echo "$doc_queue_after" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
match=next((row for row in rows if row.get('id')=='${ENCOUNTER_ID}'), None)
if not match:
  raise SystemExit('encounter missing from doctor queue after SOAP')
if match.get('status')!='in_consultation':
  raise SystemExit(f'expected in_consultation, got {match.get(\"status\")}')
" || fail "Doctor queue dropped the active consultation"
ok "Doctor queue still shows in_consultation encounter"

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

step "13b. Invalid encounter transition rejected (AT-P0-10)"
guard_patient="$(api POST "/patients" --data "{
  \"firstName\": \"Guard\",
  \"lastName\": \"Workflow${UNIQ}\",
  \"dateOfBirth\": \"1995-09-09\",
  \"gender\": \"male\",
  \"primaryPhone\": \"+25471${UNIQ: -7}\",
  \"identifiers\": [{\"type\": \"national_id\", \"value\": \"GUARD-${UNIQ}\", \"isPrimary\": true}]
}")"
GUARD_ID="$(echo "$guard_patient" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
bad_enc="$(api POST "/opd/encounters" --data "{
  \"patientId\": \"${GUARD_ID}\",
  \"visitType\": \"new\",
  \"destination\": \"doctor\"
}")"
BAD_ID="$(echo "$bad_enc" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
if curl -fsS -X PATCH "${API}/opd/encounters/${BAD_ID}/status" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: ${TENANT}" \
  -H "Authorization: Bearer ${TOKEN}" \
  --data '{"status":"completed"}' >/dev/null 2>&1; then
  fail "Invalid registered→completed should return 400"
fi
ok "Workflow guard blocked invalid transition"

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
