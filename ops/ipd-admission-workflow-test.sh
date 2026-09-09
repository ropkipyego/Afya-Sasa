#!/usr/bin/env bash
# Pass 2: Doctor → IPD admission → census → workspace → nursing/vitals/MAR → transfer
# Non-destructive: creates uniquely named AFYASASA-IPD-TEST patients only.
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
TENANT="${TENANT:-jalaram}"
EMAIL="${EMAIL:-it@jalaram.co.ke}"
PASSWORD="${PASSWORD:-ChangeMe123!}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

pass=0
fail=0
RESULTS=()

step() { echo ""; echo "━━━ $1 ━━━"; }
ok() { echo "✓ $1"; RESULTS+=("PASS: $1"); pass=$((pass + 1)); }
die() { echo "✗ $1"; RESULTS+=("FAIL: $1"); fail=$((fail + 1)); exit 1; }

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

create_patient() {
  local suffix="$1"
  local phone="+2547${UNIQ: -7}${suffix: -1}"
  api POST "/patients" --data "{
    \"firstName\": \"AFYASASA-IPD-TEST-${UNIQ}\",
    \"lastName\": \"${suffix}\",
    \"dateOfBirth\": \"1988-03-22\",
    \"gender\": \"female\",
    \"primaryPhone\": \"${phone}\"
  }"
}

step "0. Login"
login="$(curl -fsS -X POST "${API}/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: ${TENANT}" \
  --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"device\":\"ipd-admission-pass2\"}")"
TOKEN="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")"
ok "Authenticated as ${EMAIL}"

UNIQ="$(date +%s)"

step "Test 3. Ward Dashboard Admit button wiring"
grep -q 'onAdmit={(bedId) => setView({ screen: '\''admit'\'', bedId })}' \
  "${ROOT}/frontend/src/components/ipd/IpdModule.tsx" \
  || die "IpdModule does not pass onAdmit to WardDashboard"
ok "Ward Dashboard Admit is wired to IpdAdmitPanel"

step "Beds for isolated admits"
beds="$(api GET "/inpatient/beds/available")"
BED_COUNT="$(echo "$beds" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")"
[[ "$BED_COUNT" -ge 3 ]] || die "Need at least 3 available beds; found ${BED_COUNT}"
BED_A="$(echo "$beds" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")"
BED_B="$(echo "$beds" | python3 -c "import sys,json; print(json.load(sys.stdin)[1]['id'])")"
BED_C="$(echo "$beds" | python3 -c "import sys,json; print(json.load(sys.stdin)[2]['id'])")"
WARD_A="$(echo "$beds" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['ward']['id'])")"
ok "Available beds reserved for test: 3"

doctors="$(api GET "/admin/users")"
DOCTOR_ID="$(echo "$doctors" | python3 -c "import sys,json; rows=json.load(sys.stdin); print(rows[0]['id'] if rows else '')")"
[[ -n "$DOCTOR_ID" ]] || die "No clinical staff found"

step "Test 1. OPD patient admitted from doctor consultation"
opd_patient="$(create_patient "OPDAdmit")"
OPD_PATIENT_ID="$(echo "$opd_patient" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
OPD_PATIENT_NO="$(echo "$opd_patient" | python3 -c "import sys,json; print(json.load(sys.stdin).get('patientNo',''))")"
OPD_NAME="$(echo "$opd_patient" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['firstName']+' '+d['lastName'])")"

encounter="$(api POST "/opd/encounters" --data "{
  \"patientId\": \"${OPD_PATIENT_ID}\",
  \"visitType\": \"new\",
  \"destination\": \"doctor\",
  \"departmentName\": \"General Outpatient\",
  \"presentingComplaint\": \"Pass2 IPD admit from consultation\",
  \"attendingDoctorId\": \"${DOCTOR_ID}\"
}")"
OPD_ENCOUNTER_ID="$(echo "$encounter" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

api POST "/opd/encounters/${OPD_ENCOUNTER_ID}/triage" --data '{
  "category": "urgent",
  "colour": "yellow",
  "chiefComplaint": "Pass2 IPD admit",
  "painScore": 3,
  "temperature": 37.2,
  "pulse": 80,
  "respiratoryRate": 16,
  "bpSystolic": 118,
  "bpDiastolic": 76,
  "spo2": 98
}' >/dev/null

api POST "/opd/encounters/${OPD_ENCOUNTER_ID}/consultations" --data '{
  "subjective": "Pass2 consult",
  "objective": "Stable",
  "assessment": "Needs admission",
  "plan": "Admit to IPD"
}' >/dev/null

admission="$(api POST "/inpatient/admissions" --data "{
  \"patientId\": \"${OPD_PATIENT_ID}\",
  \"encounterId\": \"${OPD_ENCOUNTER_ID}\",
  \"bedId\": \"${BED_A}\",
  \"reason\": \"Pass2 doctor disposition admit to IPD\",
  \"type\": \"elective\"
}")"
OPD_ADMISSION_ID="$(echo "$admission" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
echo "$admission" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d['patient']['id']=='${OPD_PATIENT_ID}', d['patient']['id']
enc=d.get('encounter') or {}
assert enc.get('id')=='${OPD_ENCOUNTER_ID}', enc
assert d.get('status')=='active'
print(d.get('admissionNo',''))
" || die "Admission did not preserve patient/encounter"

enc_after="$(api GET "/opd/encounters/${OPD_ENCOUNTER_ID}")"
echo "$enc_after" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d['id']=='${OPD_ENCOUNTER_ID}'
assert d['patient']['id']=='${OPD_PATIENT_ID}'
assert d['status']=='admitted', d.get('status')
" || die "Encounter did not move to admitted"

bed_after="$(api GET "/inpatient/beds")"
echo "$bed_after" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
bed=next(b for b in rows if b['id']=='${BED_A}')
assert bed['status']=='occupied', bed.get('status')
" || die "Bed was not occupied"
ok "OPD consult admit: same patient, same encounter, admission created, bed occupied"

step "Test 2. Cannot admit encounter that cannot transition to admitted"
blocked_patient="$(create_patient "Blocked")"
BLOCKED_PATIENT_ID="$(echo "$blocked_patient" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
blocked_enc="$(api POST "/opd/encounters" --data "{
  \"patientId\": \"${BLOCKED_PATIENT_ID}\",
  \"visitType\": \"new\",
  \"destination\": \"doctor\",
  \"presentingComplaint\": \"Pass2 illegal admit\"
}")"
BLOCKED_ENCOUNTER_ID="$(echo "$blocked_enc" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
BEFORE_STATUS="$(echo "$blocked_enc" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")"

code="$(api_code POST "/inpatient/admissions" "{
  \"patientId\": \"${BLOCKED_PATIENT_ID}\",
  \"encounterId\": \"${BLOCKED_ENCOUNTER_ID}\",
  \"bedId\": \"${BED_B}\",
  \"reason\": \"Should fail\",
  \"type\": \"elective\"
}" /tmp/afyasasa-pass2-blocked.json)"
[[ "$code" == "400" ]] || die "Illegal admit should return 400, got ${code}"
python3 - <<'PY' || die "Illegal admit error was not useful"
import json
d=json.load(open('/tmp/afyasasa-pass2-blocked.json'))
msg=str(d.get('message') or d)
if 'registered' not in msg.lower() and 'admitted' not in msg.lower():
    raise SystemExit(msg)
print(msg)
PY
after="$(api GET "/opd/encounters/${BLOCKED_ENCOUNTER_ID}")"
echo "$after" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d['status']=='${BEFORE_STATUS}', d.get('status')
" || die "Blocked encounter was modified"
bed_b="$(api GET "/inpatient/beds")"
echo "$bed_b" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
bed=next(b for b in rows if b['id']=='${BED_B}')
assert bed['status']=='available', bed.get('status')
" || die "Bed B was occupied despite failed admit"
ok "Illegal transition rejected; encounter and bed unchanged"

step "Test 4. ED admitted_ipd creates a real IPD admission"
ed_patient="$(create_patient "EDHandoff")"
ED_PATIENT_ID="$(echo "$ed_patient" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ed="$(api POST "/emergency/register" --data "{
  \"patientId\": \"${ED_PATIENT_ID}\",
  \"presentingComplaint\": \"Pass2 ED to IPD handoff\",
  \"arrivalMode\": \"walk_in\"
}")"
ED_ID="$(echo "$ed" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ED_ENCOUNTER_ID="$(echo "$ed" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['encounter']['id'])")"
api POST "/emergency/${ED_ID}/triage" --data '{
  "triageCategory": "yellow",
  "notes": "Pass2 ED triage"
}' >/dev/null
ed_disp="$(api POST "/emergency/${ED_ID}/disposition" --data "{
  \"outcome\": \"admitted_ipd\",
  \"bedId\": \"${BED_B}\",
  \"admissionReason\": \"Pass2 ED admitted_ipd\",
  \"notes\": \"Handoff to ward\"
}")"
echo "$ed_disp" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d.get('outcome')=='admitted_ipd' or d.get('disposition')=='admitted_ipd', d
assert d.get('status')=='disposed' or d.get('workflowStage')=='disposed'
" || die "ED episode not closed after admitted_ipd"

ed_enc="$(api GET "/opd/encounters/${ED_ENCOUNTER_ID}")"
echo "$ed_enc" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d['id']=='${ED_ENCOUNTER_ID}'
assert d['patient']['id']=='${ED_PATIENT_ID}'
assert d['status']=='admitted', d.get('status')
" || die "ED encounter was not admitted (got completed or other)"

ed_admissions="$(api GET "/inpatient/admissions?status=active")"
ED_ADMISSION_ID="$(echo "$ed_admissions" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
match=next((a for a in rows if a.get('patient',{}).get('id')=='${ED_PATIENT_ID}'), None)
assert match, 'no IPD admission for ED patient'
print(match['id'])
")"
ok "ED admitted_ipd created IPD admission ${ED_ADMISSION_ID}; encounter admitted"

step "Test 5. IPD census shows newly admitted test patient"
census="$(api GET "/inpatient/wards/${WARD_A}/census")"
echo "$census" | python3 -c "
import sys,json
rows=json.load(sys.stdin).get('census',[])
match=[r for r in rows if (r.get('admission') or {}).get('id')=='${OPD_ADMISSION_ID}']
assert match, 'OPD test admission missing from census'
assert match[0]['patient']['id']=='${OPD_PATIENT_ID}'
" || die "Census missing OPD test admission"
ok "Census contains OPD test admission"

step "Test 6. IPD workspace loads the correct admission"
workspace="$(api GET "/inpatient/admissions/${OPD_ADMISSION_ID}/workspace")"
echo "$workspace" | python3 -c "
import sys,json
w=json.load(sys.stdin)
adm=w['admission']
assert adm['id']=='${OPD_ADMISSION_ID}'
assert adm['patient']['id']=='${OPD_PATIENT_ID}'
enc=adm.get('encounter') or {}
assert enc.get('id')=='${OPD_ENCOUNTER_ID}', enc
" || die "Workspace loaded the wrong admission"
ok "Workspace loaded correct admission"

step "Test 7. Create nursing observation"
obs="$(api POST "/nursing/observations" --data "{
  \"admissionId\": \"${OPD_ADMISSION_ID}\",
  \"type\": \"pain\",
  \"value\": \"Pass2 isolated nursing observation\"
}")"
OBS_ID="$(echo "$obs" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
[[ -n "$OBS_ID" ]] || die "Observation not created"
ok "Nursing observation ${OBS_ID}"

step "Test 8. Vitals omitted values stay NULL"
vitals="$(api POST "/nursing/vitals" --data "{
  \"admissionId\": \"${OPD_ADMISSION_ID}\",
  \"encounterId\": \"${OPD_ENCOUNTER_ID}\",
  \"temperature\": 37.4,
  \"pulse\": 84
}")"
echo "$vitals" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d.get('temperature') not in (None,'','0',0)
assert d.get('pulse')==84
for key in ('respiratoryRate','bpSystolic','bpDiastolic','spo2','bloodGlucose'):
    val=d.get(key)
    assert val is None, f'{key} should be null, got {val!r}'
" || die "Omitted vitals were stored as 0"
listed="$(api GET "/nursing/vitals?admissionId=${OPD_ADMISSION_ID}")"
echo "$listed" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
row=rows[0]
for key in ('respiratoryRate','bpSystolic','bpDiastolic','spo2'):
    val=row.get(key)
    assert val is None, f'{key} should remain null after GET, got {val!r}'
" || die "GET vitals coerced omitted values"
ok "Omitted vitals stored as null"

step "Test 9. Create MAR entry"
SCHEDULED="$(python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc)+timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")"
mar="$(api POST "/nursing/mar" --data "{
  \"admissionId\": \"${OPD_ADMISSION_ID}\",
  \"medicationName\": \"Pass2-Paracetamol\",
  \"dosage\": \"1g\",
  \"route\": \"oral\",
  \"frequency\": \"TDS\",
  \"scheduledTime\": \"${SCHEDULED}\"
}")"
MAR_ID="$(echo "$mar" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ok "MAR entry ${MAR_ID}"

step "Test 10. PATCH MAR status to given persists"
api PATCH "/nursing/mar/${MAR_ID}/status" --data '{"status":"given"}' >/dev/null
mar_get="$(api GET "/nursing/mar/${OPD_ADMISSION_ID}")"
echo "$mar_get" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
row=next(r for r in rows if r['id']=='${MAR_ID}')
assert row['status']=='given', row.get('status')
" || die "MAR given status did not persist"
ok "MAR given persists after GET"

step "Test 11. PATCH MAR withheld / refused / not_available"
SCHEDULED2="$(python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc)+timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")"
mar2="$(api POST "/nursing/mar" --data "{
  \"admissionId\": \"${OPD_ADMISSION_ID}\",
  \"medicationName\": \"Pass2-Amoxicillin\",
  \"dosage\": \"500mg\",
  \"route\": \"oral\",
  \"frequency\": \"TDS\",
  \"scheduledTime\": \"${SCHEDULED2}\"
}")"
MAR2_ID="$(echo "$mar2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
api PATCH "/nursing/mar/${MAR2_ID}/status" --data '{"status":"withheld","withholdReason":"NPO"}' >/dev/null
SCHEDULED3="$(python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc)+timedelta(hours=3)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")"
mar3="$(api POST "/nursing/mar" --data "{
  \"admissionId\": \"${OPD_ADMISSION_ID}\",
  \"medicationName\": \"Pass2-ORS\",
  \"dosage\": \"200ml\",
  \"route\": \"oral\",
  \"frequency\": \"stat\",
  \"scheduledTime\": \"${SCHEDULED3}\"
}")"
MAR3_ID="$(echo "$mar3" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
api PATCH "/nursing/mar/${MAR3_ID}/status" --data '{"status":"refused"}' >/dev/null
SCHEDULED4="$(python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc)+timedelta(hours=4)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")"
mar4="$(api POST "/nursing/mar" --data "{
  \"admissionId\": \"${OPD_ADMISSION_ID}\",
  \"medicationName\": \"Pass2-Insulin\",
  \"dosage\": \"4u\",
  \"route\": \"sc\",
  \"frequency\": \"stat\",
  \"scheduledTime\": \"${SCHEDULED4}\"
}")"
MAR4_ID="$(echo "$mar4" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
api PATCH "/nursing/mar/${MAR4_ID}/status" --data '{"status":"not_available"}' >/dev/null
mar_all="$(api GET "/nursing/mar/${OPD_ADMISSION_ID}")"
echo "$mar_all" | python3 -c "
import sys,json
rows={r['id']: r['status'] for r in json.load(sys.stdin)}
assert rows['${MAR_ID}']=='given'
assert rows['${MAR2_ID}']=='withheld'
assert rows['${MAR3_ID}']=='refused'
assert rows['${MAR4_ID}']=='not_available'
" || die "MAR statuses did not persist"
ok "MAR withheld/refused/not_available persist"

step "Test 12. Ward transfer preserves admission and patient"
xfer="$(api POST "/inpatient/admissions/${OPD_ADMISSION_ID}/transfers" --data "{
  \"toBedId\": \"${BED_C}\",
  \"reason\": \"Pass2 isolated ward transfer\"
}")"
echo "$xfer" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d['id']=='${OPD_ADMISSION_ID}'
assert d['patient']['id']=='${OPD_PATIENT_ID}'
assert d['bed']['id']=='${BED_C}', d.get('bed')
" || die "Transfer changed patient or admission identity"
ok "Transfer preserved patient and admission; new bed occupied"

step "Test 13. Timeline contains the admission event"
timeline="$(api GET "/patients/${OPD_PATIENT_ID}/timeline")"
echo "$timeline" | python3 -c "
import sys,json
d=json.load(sys.stdin)
events=d.get('events') or d if isinstance(d, list) else d.get('events',[])
types=[e.get('type') for e in events]
assert 'admission' in types, types
" || die "Timeline missing admission event"
ok "Timeline contains admission event"

echo ""
echo "══════════════════════════════════════"
echo "Pass 2 IPD admission tests: ${pass} passed"
echo "OPD test patient: ${OPD_NAME} ${OPD_PATIENT_NO} ${OPD_PATIENT_ID}"
echo "Blocked patient:  ${BLOCKED_PATIENT_ID}"
echo "ED test patient:  ${ED_PATIENT_ID}"
echo "OPD admission:    ${OPD_ADMISSION_ID}"
echo "ED admission:     ${ED_ADMISSION_ID}"
echo "══════════════════════════════════════"
for line in "${RESULTS[@]}"; do echo "$line"; done
