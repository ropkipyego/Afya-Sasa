#!/usr/bin/env bash
# Inventory engine smoke test — locations, items, receipt, ledger
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
TENANT="${TENANT:-jalaram}"
EMAIL="${EMAIL:-it@jalaram.co.ke}"
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

step "1. Login"
login="$(curl -fsS -X POST "${API}/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: ${TENANT}" \
  --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"device\":\"inventory-smoke\"}")"
TOKEN="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")"
ok "Authenticated"

step "2. List locations"
locations="$(api GET "/inventory/locations")"
PHARMACY_ID="$(echo "$locations" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
print(next((r['id'] for r in rows if r['code']=='PHARMACY'), ''))
")"
MAIN_STORE_ID="$(echo "$locations" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
print(next((r['id'] for r in rows if r['code']=='MAIN_STORE'), ''))
")"
[[ -n "$PHARMACY_ID" && -n "$MAIN_STORE_ID" ]] || fail "Seed locations missing"
ok "Pharmacy + Main Store locations"

step "3. List seed items"
items="$(api GET "/inventory/items")"
PARA_ID="$(echo "$items" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
print(next((r['id'] for r in rows if r['sku']=='PARA500'), ''))
")"
GLOVES_ID="$(echo "$items" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
print(next((r['id'] for r in rows if r['sku']=='GLOVES-M'), ''))
")"
[[ -n "$PARA_ID" && -n "$GLOVES_ID" ]] || fail "Seed items missing"
ok "Paracetamol + gloves items"

step "4. Receive pharmaceutical stock (batch + expiry)"
expiry="$(date -u -d '+180 days' +%Y-%m-%d 2>/dev/null || date -u -v+180d +%Y-%m-%d)"
receipt="$(api POST "/inventory/receipts" --data "{
  \"itemId\": \"${PARA_ID}\",
  \"locationId\": \"${PHARMACY_ID}\",
  \"quantity\": 500,
  \"batchNo\": \"BATCH-TEST-001\",
  \"expiryDate\": \"${expiry}\",
  \"reason\": \"Opening stock — smoke test\"
}")"
echo "$receipt" | python3 -c "
import sys,json
d=json.load(sys.stdin)
qty=float(d['batch']['qtyOnHand'])
assert qty >= 500, qty
assert d['transaction']['transactionType']=='RECEIPT'
print(f'  Batch qty: {qty}')
" || fail "Pharmacy receipt failed"
ok "Pharmacy receipt + ledger row"

step "5. Receive consumable stock (no batch)"
receipt2="$(api POST "/inventory/receipts" --data "{
  \"itemId\": \"${GLOVES_ID}\",
  \"locationId\": \"${MAIN_STORE_ID}\",
  \"quantity\": 200,
  \"reason\": \"Opening stock — smoke test\"
}")"
echo "$receipt2" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert float(d['batch']['qtyOnHand']) >= 200
print(f'  Gloves qty: {d[\"batch\"][\"qtyOnHand\"]}')
" || fail "Main store receipt failed"
ok "Main store receipt"

step "6. Location balances"
balances="$(api GET "/inventory/locations/${PHARMACY_ID}/balances")"
echo "$balances" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert len(d['batches']) >= 1
print(f'  Pharmacy batches: {len(d[\"batches\"])}')
" || fail "Balances query failed"
ok "Pharmacy balances visible"

step "7. Department requisition (mixed pharma + consumable routing)"
req="$(api POST "/inventory/requisitions" --data "{
  \"requestingDepartment\": \"General Ward\",
  \"notes\": \"Workflow test requisition\",
  \"lines\": [
    { \"itemId\": \"${PARA_ID}\", \"quantity\": 20 },
    { \"itemId\": \"${GLOVES_ID}\", \"quantity\": 10 }
  ]
}")"
REQ_ID="$(echo "$req" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
echo "$req" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d['status']=='submitted'
routes={ln['fulfillmentRoute'] for ln in d['lines']}
assert routes=={'pharmacy','main_store'}, routes
print(f'  {d[\"requisitionNo\"]} routes: {sorted(routes)}')
" || fail "Requisition create/routing failed"
ok "Requisition created with pharmacy + main store routing"

step "8. Approve and issue requisition"
api POST "/inventory/requisitions/${REQ_ID}/approve" --data '{}' >/dev/null
issue="$(api POST "/inventory/requisitions/${REQ_ID}/issue" --data '{}')"
echo "$issue" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d['requisition']['status']=='issued'
assert len(d['transactions']) >= 1
types={t['transactionType'] for t in d['transactions']}
assert 'ISSUE' in types
print(f'  Issued with {len(d[\"transactions\"])} ledger rows')
" || fail "Requisition issue failed"
ok "Stock issued from pharmacy + main store"

step "9. Acknowledge requisition"
ack="$(api POST "/inventory/requisitions/${REQ_ID}/acknowledge" --data '{}')"
echo "$ack" | python3 -c "
import sys,json
assert json.load(sys.stdin)['status']=='completed'
" || fail "Acknowledge failed"
ok "Department acknowledged receipt"

step "10. Stock transfer Main Store → Ward"
WARD_ID="$(echo "$locations" | python3 -c "
import sys,json
rows=json.load(sys.stdin)
print(next((r['id'] for r in rows if r['code']=='WARD-GENERAL'), ''))
")"
[[ -n "$WARD_ID" ]] || fail "Ward location missing"
transfer="$(api POST "/inventory/transfers" --data "{
  \"sourceLocationId\": \"${MAIN_STORE_ID}\",
  \"destinationLocationId\": \"${WARD_ID}\",
  \"notes\": \"Workflow test transfer\",
  \"lines\": [{ \"itemId\": \"${GLOVES_ID}\", \"quantity\": 5 }]
}")"
TRF_ID="$(echo "$transfer" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
api POST "/inventory/transfers/${TRF_ID}/ship" --data '{}' >/dev/null
api POST "/inventory/transfers/${TRF_ID}/receive" --data '{}' >/dev/null
ward_bal="$(api GET "/inventory/locations/${WARD_ID}/balances")"
echo "$ward_bal" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert len(d['batches']) >= 1
print(f'  Ward batches after transfer: {len(d[\"batches\"])}')
" || fail "Transfer receive failed"
ok "Transfer completed with ward stock"

echo ""
echo "══════════════════════════════════════"
echo "Inventory engine smoke: ALL PASSED"
echo "══════════════════════════════════════"
