#!/usr/bin/env bash
# Object storage: multipart upload → register metadata → presign download
set -euo pipefail

API="${API:-http://localhost:3000/api/v1}"
TENANT="${TENANT:-jalaram}"
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
    --data "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\",\"device\":\"storage-workflow-test\"}")"
  TOKEN="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")"
}

step "1. Login"
login_as "$ADMIN_EMAIL"
ok "Authenticated"

step "2. Multipart upload via API proxy"
TMP="$(mktemp --suffix=.pdf)"
printf '%s' '%PDF-1.4 workflow test' > "$TMP"
UPLOAD="$(curl -fsS -X POST "${API}/storage/upload" \
  -H "X-Tenant: ${TENANT}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@${TMP};type=application/pdf;filename=sample.pdf" \
  -F "folder=workflow-test" \
  -F "requestId=storage-test")"
rm -f "$TMP"
STORAGE_KEY="$(echo "$UPLOAD" | python3 -c "import sys,json; print(json.load(sys.stdin)['storagePath'])")"
ok "Uploaded ${STORAGE_KEY}"

step "3. Register clinical document metadata"
patients="$(api GET "/patients?q=brian&pageSize=1")"
PATIENT_ID="$(echo "$patients" | python3 -c "import sys,json; d=json.load(sys.stdin); rows=d.get('items',[]); print(rows[0]['id'] if rows else '')")"
[[ -n "$PATIENT_ID" ]] || fail "No patient found"
doc="$(api POST "/documents" --data "{
  \"patientId\": \"${PATIENT_ID}\",
  \"documentType\": \"other\",
  \"title\": \"Storage workflow test\",
  \"filename\": \"sample.pdf\",
  \"mimeType\": \"application/pdf\",
  \"storagePath\": \"${STORAGE_KEY}\",
  \"fileSize\": 128
}")"
DOC_ID="$(echo "$doc" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
ok "Document registered ${DOC_ID}"

step "4. Fetch download via API proxy"
BODY="$(curl -fsS -X POST "${API}/storage/fetch" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: ${TENANT}" \
  -H "Authorization: Bearer ${TOKEN}" \
  --data "{\"key\":\"${STORAGE_KEY}\"}")"
echo "$BODY" | grep -q 'PDF-1.4' || fail "Downloaded content mismatch"
ok "API fetch download works"

step "5. Reject disallowed MIME type on presign"
HTTP="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${API}/storage/presign-upload" \
  -H "Content-Type: application/json" \
  -H "X-Tenant: ${TENANT}" \
  -H "Authorization: Bearer ${TOKEN}" \
  --data '{"key":"bad.exe","contentType":"application/x-msdownload","folder":"test","filename":"bad.exe"}')"
[[ "$HTTP" == "400" ]] || fail "Expected 400 for disallowed type, got $HTTP"
ok "MIME validation enforced"

echo ""
echo "══════════════════════════════════════"
echo "Storage workflow: ALL PASSED"
echo "══════════════════════════════════════"
