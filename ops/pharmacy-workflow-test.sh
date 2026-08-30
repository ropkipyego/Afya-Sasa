#!/usr/bin/env bash
# Pharmacy prescription → stock receipt → dispense with ledger (API)
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
TENANT="${TENANT:-jalaram}"
DOC_EMAIL="${DOC_EMAIL:-doctor@jalaram.co.ke}"
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
    --data "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\",\"device\":\"pharmacy-workflow-test\"}")"
  TOKEN="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")"
}

step "1. Admin — ensure pharmacy stock"
login_as "$ADMIN_EMAIL"
locations="$(api GET "/inventory/locations")"
PHARMACY_ID="$(echo "$locations" | python3 -c "import sys,json; print(next(r['id'] for r in json.load(sys.stdin) if r['code']=='PHARMACY'))")"
items="$(api GET "/inventory/items")"
PARA_ID="$(echo "$items" | python3 -c "import sys,json; print(next(r['id'] for r in json.load(sys.stdin) if r['sku']=='PARA500'))")"
expiry="$(date -u -d '+180 days' +%Y-%m-%d 2>/dev/null || date -u -v+180d +%Y-%m-%d)"
api POST "/inventory/receipts" --data "{
  \"itemId\": \"${PARA_ID}\",
  \"locationId\": \"${PHARMACY_ID}\",
  \"quantity\": 100,
  \"batchNo\": \"PHARM-TEST-$(date +%s)\",
  \"expiryDate\": \"${expiry}\"
}" >/dev/null
ok "Pharmacy stock received"

step "2. Doctor — prescribe Paracetamol"
login_as "$DOC_EMAIL"
patients="$(api GET "/patients?q=brian&pageSize=1")"
PATIENT_ID="$(echo "$patients" | python3 -c "import sys,json; d=json.load(sys.stdin); rows=d.get('items',[]); print(rows[0]['id'] if rows else '')")"
[[ -n "$PATIENT_ID" ]] || fail "No patient"
order="$(api POST "/clinical-orders/pharmacy" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"medication\": \"Paracetamol 500mg\",
  \"dose\": \"1g TDS\",
  \"priority\": \"routine\"
}")"
ORDER_ID="$(echo "$order" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ok "Pharmacy order ${ORDER_ID}"

step "3. Admin — dispense (FEFO + ledger)"
login_as "$ADMIN_EMAIL"
dispense="$(api POST "/inventory/dispense/pharmacy" --data "{
  \"clinicalOrderId\": \"${ORDER_ID}\",
  \"quantity\": 6
}")"
echo "$dispense" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d['orderId']
assert len(d['transactions']) >= 1
assert d['transactions'][0]['transactionType']=='DISPENSE'
print(f'  Dispensed from {len(d[\"allocations\"])} batch(es)')
" || fail "Dispense response invalid"
orders="$(api GET "/clinical-orders?module=pharmacy&patientId=${PATIENT_ID}")"
echo "$orders" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
match=next((r for r in rows if r['id']=='${ORDER_ID}'), None)
assert match and match['status']=='dispensed', match
" || fail "Order not marked dispensed"
ok "Dispense complete with ledger"

echo ""
echo "══════════════════════════════════════"
echo "Pharmacy workflow: ALL PASSED"
echo "══════════════════════════════════════"
