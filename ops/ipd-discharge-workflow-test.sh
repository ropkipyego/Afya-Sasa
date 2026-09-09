#!/usr/bin/env bash
# Pass 3: Discharge summary → discharge → bed cleaning → housekeeping available
# Non-destructive: creates uniquely named AFYASASA-DC-TEST patients only.
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
TENANT="${TENANT:-jalaram}"
EMAIL="${EMAIL:-it@jalaram.co.ke}"
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

api_code() {
  local method="$1" path="$2" body="$3" out="$4"
  curl -sS -o "$out" -w "%{http_code}" -X "$method" "${API}${path}" \
    -H "Content-Type: application/json" \
    -H "X-Tenant: ${TENANT}" \
    -H "Authorization: Bearer ${TOKEN}" \
    --data "$body"
}

step "1. Login"
login="$(curl -fsS -X POST "${API}/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: ${TENANT}" \
  --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"device\":\"ipd-discharge-pass3\"}")"
TOKEN="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")"
ok "Authenticated"

UNIQ="$(date +%s)"
PHONE="+2547${UNIQ: -8}"

step "2. Isolated test patient"
created="$(api POST "/patients" --data "{
  \"firstName\": \"AFYASASA-DC-TEST-${UNIQ}\",
  \"lastName\": \"Discharge\",
  \"dateOfBirth\": \"1979-09-04\",
  \"gender\": \"female\",
  \"primaryPhone\": \"${PHONE}\"
}")"
PATIENT_ID="$(echo "$created" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
PATIENT_NO="$(echo "$created" | python3 -c "import sys,json; print(json.load(sys.stdin).get('patientNo',''))")"
NAME="$(echo "$created" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['firstName']+' '+d['lastName'])")"
ok "Created ${NAME} ${PATIENT_NO} ${PATIENT_ID}"

doctors="$(api GET "/admin/users")"
DOCTOR_ID="$(echo "$doctors" | python3 -c "import sys,json; rows=json.load(sys.stdin); print(rows[0]['id'] if rows else '')")"
beds="$(api GET "/inpatient/beds/available")"
BED_ID="$(echo "$beds" | python3 -c "import sys,json; rows=json.load(sys.stdin); print(rows[0]['id'] if rows else '')")"
WARD_ID="$(echo "$beds" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['ward']['id'])")"
[[ -n "$BED_ID" ]] || die "No available bed"

encounter="$(api POST "/opd/encounters" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"visitType\": \"new\",
  \"destination\": \"doctor\",
  \"presentingComplaint\": \"Pass3 discharge workflow\",
  \"attendingDoctorId\": \"${DOCTOR_ID}\"
}")"
ENCOUNTER_ID="$(echo "$encounter" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
api POST "/opd/encounters/${ENCOUNTER_ID}/triage" --data '{
  "category": "urgent",
  "colour": "yellow",
  "chiefComplaint": "Pass3 discharge"
}' >/dev/null
api POST "/opd/encounters/${ENCOUNTER_ID}/consultations" --data '{
  "subjective": "Pass3",
  "objective": "Stable",
  "assessment": "Ready for short admission",
  "plan": "Admit then discharge"
}' >/dev/null

admission="$(api POST "/inpatient/admissions" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"encounterId\": \"${ENCOUNTER_ID}\",
  \"bedId\": \"${BED_ID}\",
  \"reason\": \"Pass3 isolated discharge test\",
  \"type\": \"elective\"
}")"
ADMISSION_ID="$(echo "$admission" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ok "Admitted ${ADMISSION_ID} to bed ${BED_ID}"

step "3. Cannot free occupied bed via housekeeping"
occ_code="$(api_code PATCH "/inpatient/beds/${BED_ID}/status" '{"status":"available"}' /tmp/afyasasa-dc-occupied.json)"
[[ "$occ_code" == "400" ]] || die "Occupied bed should reject housekeeping, got ${occ_code}"
ok "Occupied bed cannot be marked available"

step "4. Cannot discharge without a completed summary"
code="$(api_code POST "/inpatient/admissions/${ADMISSION_ID}/discharge" '{"conditionOnDischarge":"improved"}' /tmp/afyasasa-dc-nosummary.json)"
[[ "$code" == "400" ]] || die "Discharge without summary should be 400, got ${code}"
enc="$(api GET "/opd/encounters/${ENCOUNTER_ID}")"
echo "$enc" | python3 -c "import sys,json; assert json.load(sys.stdin)['status']=='admitted'" || die "Encounter changed without discharge"
ok "Discharge blocked until summary is complete"

step "5. Draft summary still cannot discharge"
summary="$(api POST "/inpatient/admissions/${ADMISSION_ID}/discharge-summary" --data '{
  "presentingComplaint": "Short stay",
  "history": "Pass3 isolated history",
  "examOnAdmission": "Stable",
  "investigationsSummary": "None",
  "finalDiagnosis": "Resolved",
  "treatmentGiven": "Observation",
  "dischargeMeds": "Paracetamol",
  "followUpInstructions": "OPD in 1 week"
}')"
SUMMARY_ID="$(echo "$summary" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
draft_code="$(api_code POST "/inpatient/admissions/${ADMISSION_ID}/discharge" '{"conditionOnDischarge":"improved"}' /tmp/afyasasa-dc-draft.json)"
[[ "$draft_code" == "400" ]] || die "Draft summary should not allow discharge, got ${draft_code}"
ok "Draft summary is not enough"

step "6. Finalise summary and discharge"
api POST "/inpatient/discharge-summaries/${SUMMARY_ID}/complete" >/dev/null
discharged="$(api POST "/inpatient/admissions/${ADMISSION_ID}/discharge" --data '{"conditionOnDischarge":"improved"}')"
echo "$discharged" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d['status']=='discharged', d.get('status')
assert d['id']=='${ADMISSION_ID}'
assert d['patient']['id']=='${PATIENT_ID}'
" || die "Discharge did not close the admission"
enc2="$(api GET "/opd/encounters/${ENCOUNTER_ID}")"
echo "$enc2" | python3 -c "import sys,json; assert json.load(sys.stdin)['status']=='completed'" || die "Encounter not completed"
beds_all="$(api GET "/inpatient/beds")"
echo "$beds_all" | python3 -c "
import sys,json
bed=next(b for b in json.load(sys.stdin) if b['id']=='${BED_ID}')
assert bed['status']=='cleaning', bed.get('status')
" || die "Bed was not marked cleaning"
ok "Admission discharged; encounter completed; bed cleaning"

step "7. Cleaning bed cannot be selected for admission"
other="$(api POST "/patients" --data "{
  \"firstName\": \"AFYASASA-DC-TEST-${UNIQ}\",
  \"lastName\": \"Other\",
  \"dateOfBirth\": \"1991-02-02\",
  \"gender\": \"male\",
  \"primaryPhone\": \"+2547${UNIQ: -7}2\"
}")"
OTHER_ID="$(echo "$other" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
clean_code="$(api_code POST "/inpatient/admissions" "{
  \"patientId\": \"${OTHER_ID}\",
  \"bedId\": \"${BED_ID}\",
  \"reason\": \"Should fail cleaning bed\",
  \"type\": \"elective\"
}" /tmp/afyasasa-dc-cleaning.json)"
[[ "$clean_code" == "400" ]] || die "Cleaning bed admit should be 400, got ${clean_code}"
avail="$(api GET "/inpatient/beds/available")"
echo "$avail" | python3 -c "
import sys,json
ids=[b['id'] for b in json.load(sys.stdin)]
assert '${BED_ID}' not in ids
" || die "Cleaning bed appeared in available list"
ok "Cleaning bed rejected for admission"

step "8. Housekeeping marks bed available"
api PATCH "/inpatient/beds/${BED_ID}/status" --data '{"status":"available"}' >/dev/null
avail2="$(api GET "/inpatient/beds/available")"
echo "$avail2" | python3 -c "
import sys,json
ids=[b['id'] for b in json.load(sys.stdin)]
assert '${BED_ID}' in ids
" || die "Bed did not return to available list"
ok "Housekeeping freed the bed"

step "9. Census no longer shows the discharged admission"
census="$(api GET "/inpatient/wards/${WARD_ID}/census")"
echo "$census" | python3 -c "
import sys,json
rows=json.load(sys.stdin).get('census',[])
match=[r for r in rows if (r.get('admission') or {}).get('id')=='${ADMISSION_ID}']
assert not match
" || die "Discharged admission still on census"
ok "Census dropped discharged admission"

step "10. Timeline contains admission and discharge"
timeline="$(api GET "/patients/${PATIENT_ID}/timeline")"
echo "$timeline" | python3 -c "
import sys,json
d=json.load(sys.stdin)
events=d.get('events') or []
types=[e.get('type') for e in events]
assert 'admission' in types, types
assert 'discharge' in types, types
" || die "Timeline missing admission or discharge"
ok "Timeline has admission + discharge"

echo ""
echo "══════════════════════════════════════"
echo "Pass 3 discharge tests: ${pass} passed"
echo "Patient:   ${NAME} ${PATIENT_NO} ${PATIENT_ID}"
echo "Other:     ${OTHER_ID}"
echo "Admission: ${ADMISSION_ID} (discharged)"
echo "Bed:       ${BED_ID} (available after housekeeping)"
echo "══════════════════════════════════════"
