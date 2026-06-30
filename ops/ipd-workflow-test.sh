#!/usr/bin/env bash
# End-to-end API workflow: patient → admit → nursing (2 days) → referral → discharge
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
TENANT="${TENANT:-demo}"
EMAIL="${EMAIL:-admin@demo.afyasasa.local}"
PASSWORD="${PASSWORD:-ChangeMe123!}"

pass=0
fail=0

step() { echo ""; echo "━━━ $1 ━━━"; }
ok() { echo "✓ $1"; pass=$((pass + 1)); }
die() { echo "✗ $1"; fail=$((fail + 1)); exit 1; }

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
  --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"device\":\"ipd-workflow-test\"}")"
TOKEN="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")"
ok "Authenticated as ${EMAIL}"

step "2. Find or create test patient"
patients="$(api GET "/patients?q=demo&pageSize=5")"
PATIENT_ID="$(echo "$patients" | python3 -c "
import sys, json
data = json.load(sys.stdin)
rows = data.get('items', data if isinstance(data, list) else [])
print(rows[0]['id'] if rows else '')
")"
if [[ -z "$PATIENT_ID" ]]; then
  created="$(api POST "/patients" --data '{
    "firstName":"Workflow",
    "lastName":"TestPatient",
    "dateOfBirth":"1990-01-15",
    "gender":"male",
    "primaryPhone":"+254700000099"
  }')"
  PATIENT_ID="$(echo "$created" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
  ok "Registered new patient ${PATIENT_ID}"
else
  ok "Using existing patient ${PATIENT_ID}"
fi

step "3. IPD dashboard & available bed"
dashboard="$(api GET "/inpatient/dashboard")"
echo "$dashboard" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"  Active: {d['activeAdmissions']} | Beds free: {d['availableBeds']}\")"
beds="$(api GET "/inpatient/beds/available")"
BED_ID="$(echo "$beds" | python3 -c "
import sys, json
rows = json.load(sys.stdin)
print(rows[0]['id'] if rows else '')
")"
[[ -n "$BED_ID" ]] || die "No available beds — seed wards first"
WARD_NAME="$(echo "$beds" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['ward']['name'])")"
ok "Bed ${BED_ID} in ${WARD_NAME}"

step "4. Admit patient"
admission="$(api POST "/inpatient/admissions" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"bedId\": \"${BED_ID}\",
  \"reason\": \"Community-acquired pneumonia — workflow test\",
  \"type\": \"elective\"
}")"
ADMISSION_ID="$(echo "$admission" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ok "Admission ${ADMISSION_ID}"

step "5. Doctor progress note (day 1)"
api POST "/inpatient/admissions/${ADMISSION_ID}/progress-notes" --data '{
  "subjective": "Cough, fever x3 days",
  "objective": "RR 22, temp 38.2, crackles RLL",
  "assessment": "CAP — moderate",
  "plan": "IV antibiotics, O2, repeat CXR"
}' >/dev/null
ok "Progress note saved"

step "6. Nursing — vitals & observation (day 1)"
api POST "/nursing/vitals" --data "{
  \"admissionId\": \"${ADMISSION_ID}\",
  \"temperature\": 38.2,
  \"pulse\": 96,
  \"respiratoryRate\": 22,
  \"bpSystolic\": 118,
  \"bpDiastolic\": 76,
  \"spo2\": 94
}" >/dev/null
api POST "/nursing/observations" --data "{
  \"admissionId\": \"${ADMISSION_ID}\",
  \"type\": \"pain\",
  \"value\": \"Patient alert, mild dyspnoea. SpO2 94% on room air.\"
}" >/dev/null
ok "Day 1 vitals + nursing note"

step "7. Medication chart (MAR)"
SCHEDULED="$(python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc)+timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")"
api POST "/nursing/mar" --data "{
  \"admissionId\": \"${ADMISSION_ID}\",
  \"medicationName\": \"Ceftriaxone\",
  \"dosage\": \"1g\",
  \"route\": \"iv\",
  \"frequency\": \"OD\",
  \"scheduledTime\": \"${SCHEDULED}\"
}" >/dev/null
ok "MAR entry scheduled"

step "8. Simulate day 2 — second progress note + vitals"
api POST "/inpatient/admissions/${ADMISSION_ID}/progress-notes" --data '{
  "subjective": "Improved cough, afebrile overnight",
  "objective": "RR 18, temp 37.0, clearer breath sounds",
  "assessment": "Responding to antibiotics",
  "plan": "Continue IV abx, plan step-down tomorrow"
}' >/dev/null
api POST "/nursing/vitals" --data "{
  \"admissionId\": \"${ADMISSION_ID}\",
  \"temperature\": 37.0,
  \"pulse\": 82,
  \"respiratoryRate\": 18,
  \"bpSystolic\": 120,
  \"bpDiastolic\": 78,
  \"spo2\": 97
}" >/dev/null
ok "Day 2 clinical entries"

step "9. Referral (internal)"
referral="$(api POST "/referrals" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"type\": \"internal\",
  \"targetDepartment\": \"Cardiology\",
  \"reason\": \"Pre-discharge echo review\",
  \"letter\": \"Patient admitted with CAP. Request cardiology review for known murmur before discharge.\"
}")"
REFERRAL_ID="$(echo "$referral" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ok "Referral ${REFERRAL_ID} created"

step "10. List referrals (was 500 with undefined status filter)"
referrals="$(api GET "/referrals")"
COUNT="$(echo "$referrals" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")"
ok "Listed ${COUNT} referrals"

step "11. Patient workspace snapshot"
workspace="$(api GET "/inpatient/admissions/${ADMISSION_ID}/workspace")"
echo "$workspace" | python3 -c "
import sys, json
w = json.load(sys.stdin)
print(f\"  Patient: {w['admission']['patient']['firstName']} {w['admission']['patient']['lastName']}\")
print(f\"  Ward/Bed: {w['admission']['ward']['name']} / {w['admission']['bed']['bedNo']}\")
print(f\"  Progress notes: {len(w['progressNotes'])}\")
print(f\"  LOS days: {w['lengthOfStayDays']}\")
"
ok "Workspace loaded"

step "12. Discharge summary + discharge"
summary="$(api POST "/inpatient/admissions/${ADMISSION_ID}/discharge-summary" --data '{
  "presentingComplaint": "Cough and fever",
  "history": "3 days productive cough",
  "examOnAdmission": "Crackles RLL",
  "investigationsSummary": "CXR: RLL consolidation",
  "finalDiagnosis": "Community-acquired pneumonia",
  "treatmentGiven": "IV Ceftriaxone",
  "dischargeMeds": "Amoxicillin 500mg TDS x5 days",
  "followUpInstructions": "OPD review in 1 week"
}')"
SUMMARY_ID="$(echo "$summary" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
api POST "/inpatient/discharge-summaries/${SUMMARY_ID}/complete" >/dev/null
api POST "/inpatient/admissions/${ADMISSION_ID}/discharge" --data '{
  "conditionOnDischarge": "improved"
}' >/dev/null
ok "Discharged — bed should be cleaning/available"

step "13. Appointments list (was 500)"
api GET "/appointments" >/dev/null
api GET "/appointments/today" >/dev/null
ok "Appointments endpoints healthy"

echo ""
echo "══════════════════════════════════════"
echo "IPD workflow test: ${pass} steps passed"
echo "Patient:    ${PATIENT_ID}"
echo "Admission:  ${ADMISSION_ID}"
echo "Referral:   ${REFERRAL_ID}"
echo "══════════════════════════════════════"
