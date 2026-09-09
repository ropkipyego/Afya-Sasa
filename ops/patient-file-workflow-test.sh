#!/usr/bin/env bash
# Patient File: read-only view, computed timeline, demographic PATCH without wiping nested data.
# Non-destructive: creates uniquely named AFYASASA-PREGO-LIVE-TEST patients only.
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
TENANT="${TENANT:-jalaram}"
EMAIL="${EMAIL:-it@jalaram.co.ke}"
PASSWORD="${PASSWORD:-ChangeMe123!}"

pass=0

step() { echo ""; echo "━━━ $1 ━━━"; }
ok() { echo "✓ $1"; pass=$((pass + 1)); }
die() { echo "✗ $1"; exit 1; }

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
  --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"device\":\"patient-file-test\"}")" \
  || die "Authentication failed — passwords were not reset."
TOKEN="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")"
ok "Authenticated"

UNIQ="$(date +%s)"
PHONE="+2547${UNIQ: -8}"
ID_VALUE="PREGO-ID-${UNIQ}"
LAST="PREGO${UNIQ}"
KIN_PHONE="+25470000${UNIQ: -4}"

step "2. Create isolated test patient with nested clinical data"
created="$(api POST "/patients" --data "{
  \"firstName\": \"AFYASASA-PREGO-LIVE-TEST\",
  \"lastName\": \"${LAST}\",
  \"dateOfBirth\": \"1988-06-15\",
  \"gender\": \"female\",
  \"primaryPhone\": \"${PHONE}\",
  \"occupation\": \"Teacher\",
  \"identifiers\": [{\"type\": \"national_id\", \"value\": \"${ID_VALUE}\", \"isPrimary\": true}],
  \"nextOfKin\": [{
    \"name\": \"Kin ${LAST}\",
    \"relationship\": \"spouse\",
    \"primaryPhone\": \"${KIN_PHONE}\",
    \"isEmergencyContact\": true
  }],
  \"allergies\": [{
    \"allergen\": \"Penicillin\",
    \"type\": \"drug\",
    \"reaction\": \"Rash\",
    \"severity\": \"severe\"
  }],
  \"chronicConditions\": [{
    \"name\": \"Hypertension\",
    \"icd10Code\": \"I10\",
    \"status\": \"controlled\"
  }]
}")"
PATIENT_ID="$(echo "$created" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
MRN="$(echo "$created" | python3 -c "import sys,json; print(json.load(sys.stdin)['patientNo'])")"
BEFORE="$(echo "$created" | python3 -c "import sys,json; print(json.load(sys.stdin).get('updatedAt') or '')")"
[[ -n "$PATIENT_ID" ]] || die "Patient create did not return id"
ok "Created ${MRN} ${PATIENT_ID}"

step "3. Open Patient File read endpoints without writing the patient"
file="$(api GET "/patients/${PATIENT_ID}")"
timeline="$(api GET "/patients/${PATIENT_ID}/timeline")"
history="$(api GET "/patients/${PATIENT_ID}/history")"
journey="$(api GET "/patients/${PATIENT_ID}/journey")"
payments="$(api GET "/payments/transactions?patientId=${PATIENT_ID}&limit=20")"
docs_code="$(curl -sS -o /tmp/afyasasa-patient-docs.json -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: ${TENANT}" \
  -H "Authorization: Bearer ${TOKEN}" \
  "${API}/documents?patientId=${PATIENT_ID}")"
after_open="$(api GET "/patients/${PATIENT_ID}")"

echo "$after_open" | python3 -c "
import sys, json
d=json.load(sys.stdin)
before='${BEFORE}'
after=d.get('updatedAt') or ''
if before and after and before != after:
  raise SystemExit(f'opening patient file changed updatedAt: {before} -> {after}')
if d.get('patientNo')!='${MRN}':
  raise SystemExit('MRN changed during read')
" || die "Opening Patient File wrote to the patient record"
ok "Patient File GETs did not change patient updatedAt / MRN"

echo "$file" | python3 -c "
import sys, json
d=json.load(sys.stdin)
assert d.get('patientNo')=='${MRN}'
allergies=d.get('allergies') or []
conds=d.get('chronicConditions') or []
nok=d.get('nextOfKin') or []
if not any(a.get('allergen')=='Penicillin' for a in allergies):
  raise SystemExit('allergies missing')
if not any(c.get('name')=='Hypertension' for c in conds):
  raise SystemExit('chronic conditions missing')
if not nok:
  raise SystemExit('next of kin missing')
" || die "Demographics / alerts not visible"
ok "Allergies, chronic conditions, and NOK are visible"

echo "$history" | python3 -c "
import sys, json
d=json.load(sys.stdin)
if not d.get('message'):
  raise SystemExit('history stub shape unexpected')
" || die "History stub missing"
ok "History stub is not used as the timeline source"

echo "$timeline" | python3 -c "
import sys, json
d=json.load(sys.stdin)
events=d.get('events') or []
types=[e.get('type') for e in events]
if 'registration' not in types:
  raise SystemExit(f'registration missing from timeline: {types}')
" || die "Timeline missing registration"
ok "Computed timeline includes registration"

step "4. OPD visit so timeline includes an encounter"
doctors="$(api GET "/admin/users")"
DOCTOR_ID="$(echo "$doctors" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
print(rows[0]['id'] if rows else '')
")"
[[ -n "$DOCTOR_ID" ]] || die "No clinical staff found"
encounter="$(api POST "/opd/encounters" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"visitType\": \"new\",
  \"destination\": \"doctor\",
  \"departmentName\": \"General Outpatient\",
  \"presentingComplaint\": \"Patient-file timeline test\",
  \"attendingDoctorId\": \"${DOCTOR_ID}\"
}")"
ENCOUNTER_ID="$(echo "$encounter" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
[[ -n "$ENCOUNTER_ID" ]] || die "OPD check-in failed"
timeline2="$(api GET "/patients/${PATIENT_ID}/timeline")"
echo "$timeline2" | python3 -c "
import sys, json
events=json.load(sys.stdin).get('events') or []
types=[e.get('type') for e in events]
if 'visit' not in types:
  raise SystemExit(f'OPD event missing from timeline: {types}')
" || die "Timeline missing OPD event"
ok "Computed timeline includes OPD visit ${ENCOUNTER_ID}"

step "5. Payments and documents endpoints (existing architecture)"
echo "$payments" | python3 -c "
import sys, json
d=json.load(sys.stdin)
if not isinstance(d, list):
  raise SystemExit('payments response is not a list')
" || die "Payments endpoint unexpected"
ok "Payments still use existing payment transactions"

if [[ "$docs_code" != "200" && "$docs_code" != "403" ]]; then
  die "Documents endpoint unexpected HTTP ${docs_code}"
fi
ok "Documents still use existing document architecture (HTTP ${docs_code})"

step "6. Edit one demographic via PATCH (same as Edit Patient form)"
edited="$(api PATCH "/patients/${PATIENT_ID}" --data '{
  "occupation": "Librarian"
}')"
echo "$edited" | python3 -c "
import sys, json
d=json.load(sys.stdin)
if d.get('occupation')!='Librarian':
  raise SystemExit('occupation not updated')
if d.get('patientNo')!='${MRN}':
  raise SystemExit('MRN changed by edit')
if d.get('id')!='${PATIENT_ID}':
  raise SystemExit('edit created a different patient id')
allergies=d.get('allergies') or []
conds=d.get('chronicConditions') or []
nok=d.get('nextOfKin') or []
ids=d.get('identifiers') or []
if not any(a.get('allergen')=='Penicillin' for a in allergies):
  raise SystemExit('allergies wiped')
if not any(c.get('name')=='Hypertension' for c in conds):
  raise SystemExit('chronic conditions wiped')
if not any('Kin ${LAST}' in (n.get('name') or '') for n in nok):
  raise SystemExit('next of kin wiped')
if not any(i.get('value')=='${ID_VALUE}' for i in ids):
  raise SystemExit('identifier wiped')
" || die "Edit wiped nested data or changed identity"
ok "Occupation updated; MRN / NOK / allergy / condition preserved"

step "7. Confirm no duplicate patient created"
search_phone="$(api GET "/patients?phone=${PHONE}&pageSize=20")"
echo "$search_phone" | python3 -c "
import sys, json
d=json.load(sys.stdin)
items=d.get('items') or []
ids=sorted({row.get('id') for row in items if row.get('id')})
if '${PATIENT_ID}' not in ids:
  raise SystemExit('test patient missing from phone search')
if len(ids)!=1:
  raise SystemExit(f'duplicate patients for test phone: {ids}')
" || die "Duplicate patient created"
ok "No duplicate patient created"

echo ""
echo "Patient File test patient remains in the database (not deleted):"
echo "  name: AFYASASA-PREGO-LIVE-TEST ${LAST}"
echo "  mrn:  ${MRN}"
echo "  id:   ${PATIENT_ID}"
echo "  encounter: ${ENCOUNTER_ID}"
echo "Passed: ${pass}"
