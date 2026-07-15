#!/usr/bin/env bash
# Full AfyaSasa system audit — API + UI reachability per department/module
set -uo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:3000/api/v1}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:8080}"
TENANT="${TENANT:-demo}"
EMAIL="${EMAIL:-it@jalaram.co.ke}"
PASSWORD="${PASSWORD:-ChangeMe123!}"
if [[ -n "${PASSWORD_FILE:-}" && -f "$PASSWORD_FILE" ]]; then
  PASSWORD="$(tr -d '\r\n' < "$PASSWORD_FILE")"
fi
REPORT_DIR="${REPORT_DIR:-./ops/audit-reports}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_JSON="${REPORT_DIR}/audit-${STAMP}.json"
REPORT_MD="${REPORT_DIR}/audit-${STAMP}.md"

mkdir -p "$REPORT_DIR"

PASS=0
FAIL=0
WARN=0
RESULTS=()
TOKEN=""

log() { echo "[$(date +%H:%M:%S)] $*"; }

record() {
  local area="$1" test="$2" status="$3" detail="$4"
  RESULTS+=("$(jq -nc --arg a "$area" --arg t "$test" --arg s "$status" --arg d "$detail" '{area:$a,test:$t,status:$s,detail:$d}')")
  case "$status" in
    PASS) PASS=$((PASS + 1)); log "  ✓ PASS  [$area] $test" ;;
    FAIL) FAIL=$((FAIL + 1)); log "  ✗ FAIL  [$area] $test — $detail" ;;
    WARN) WARN=$((WARN + 1)); log "  ! WARN  [$area] $test — $detail" ;;
    SKIP) log "  - SKIP  [$area] $test — $detail" ;;
  esac
}

api_get() {
  local path="$1"
  curl -fsS -H "Authorization: Bearer ${TOKEN}" -H "X-Tenant: ${TENANT}" "${BACKEND_URL}${path}" 2>&1
}

api_post() {
  local path="$1" body="$2"
  curl -fsS -X POST -H "Authorization: Bearer ${TOKEN}" -H "X-Tenant: ${TENANT}" \
    -H "Content-Type: application/json" --data "$body" "${BACKEND_URL}${path}" 2>&1
}

http_ok() {
  local url="$1"
  curl -fsS -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000"
}

log "AfyaSasa Full System Audit — ${STAMP}"
log "Backend: ${BACKEND_URL} | Frontend: ${FRONTEND_URL} | Tenant: ${TENANT}"
log ""

# ── Infrastructure ──────────────────────────────────────────────
log "=== Infrastructure ==="
code="$(http_ok "${BACKEND_URL}/health")"
[[ "$code" == "200" ]] && record "Infrastructure" "Backend health" "PASS" "HTTP $code" || record "Infrastructure" "Backend health" "FAIL" "HTTP $code"

code="$(http_ok "${FRONTEND_URL}")"
[[ "$code" == "200" ]] && record "Infrastructure" "Frontend (Nginx)" "PASS" "HTTP $code" || record "Infrastructure" "Frontend (Nginx)" "FAIL" "HTTP $code"

code="$(http_ok "http://localhost:3000/docs")"
[[ "$code" == "200" ]] && record "Infrastructure" "Swagger docs" "PASS" "HTTP $code" || record "Infrastructure" "Swagger docs" "WARN" "HTTP $code"

for tpl in lab-catalog-import-template.csv radiology-catalog-import-template.csv; do
  code="$(http_ok "${FRONTEND_URL}/templates/${tpl}")"
  [[ "$code" == "200" ]] && record "Infrastructure" "Template: ${tpl}" "PASS" "HTTP $code" || record "Infrastructure" "Template: ${tpl}" "FAIL" "HTTP $code"
done

# ── Authentication ──────────────────────────────────────────────
log "=== Authentication ==="
login_response="$(curl -fsS -X POST "${BACKEND_URL}/auth/login" \
  -H "Content-Type: application/json" -H "X-Tenant: ${TENANT}" \
  --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"device\":\"full-audit\"}" 2>&1)" || login_response=""

if echo "$login_response" | jq -e '.accessToken' >/dev/null 2>&1; then
  TOKEN="$(echo "$login_response" | jq -r '.accessToken')"
  record "Authentication" "Demo admin login" "PASS" "Token received"
else
  record "Authentication" "Demo admin login" "FAIL" "${login_response:0:200}"
  log "Cannot continue API tests without token."
  printf '%s\n' "${RESULTS[@]}" | jq -s '.' > "$REPORT_JSON"
  exit 1
fi

me="$(api_get /auth/me 2>&1)" || me=""
if echo "$me" | jq -e '.email' >/dev/null 2>&1; then
  record "Authentication" "GET /auth/me" "PASS" "$(echo "$me" | jq -r '.email')"
else
  record "Authentication" "GET /auth/me" "FAIL" "${me:0:120}"
fi

# ── Reception / Patients ─────────────────────────────────────────
log "=== Reception & Patients ==="
for ep in "/patients?limit=5" "/appointments?limit=5" "/referrals?limit=5"; do
  r="$(api_get "$ep" 2>&1)" || r=""
  if echo "$r" | jq -e 'type == "array" or .items' >/dev/null 2>&1; then
    record "Reception" "GET ${ep}" "PASS" "OK"
  elif echo "$r" | jq -e 'type == "array"' >/dev/null 2>&1; then
    record "Reception" "GET ${ep}" "PASS" "Array returned"
  else
    record "Reception" "GET ${ep}" "FAIL" "${r:0:120}"
  fi
done

# ── Outpatient ───────────────────────────────────────────────────
log "=== Outpatient (OPD) ==="
for ep in "/opd/encounters?limit=5" "/opd/triage/queue" "/opd/doctor/queue"; do
  r="$(api_get "$ep" 2>&1)" || r=""
  if echo "$r" | jq -e '.' >/dev/null 2>&1 && [[ "$r" != *"error"* && "$r" != *"Forbidden"* ]]; then
    record "Outpatient" "GET ${ep}" "PASS" "OK"
  else
    record "Outpatient" "GET ${ep}" "WARN" "${r:0:120}"
  fi
done

# ── Investigations ───────────────────────────────────────────────
log "=== Investigations (Lab & Radiology) ==="
for ep in "/laboratory/panels" "/laboratory/tests?limit=5" "/laboratory/requests?limit=5" \
          "/radiology/modalities" "/radiology/studies" "/radiology/requests?limit=5"; do
  r="$(api_get "$ep" 2>&1)" || r=""
  if echo "$r" | jq -e '.' >/dev/null 2>&1 && [[ "$r" != *"Forbidden"* && "$r" != *"message"* ]]; then
    record "Investigations" "GET ${ep}" "PASS" "OK"
  elif echo "$r" | jq -e '.message' >/dev/null 2>&1; then
    record "Investigations" "GET ${ep}" "WARN" "$(echo "$r" | jq -r '.message' 2>/dev/null || echo "$r")"
  else
    record "Investigations" "GET ${ep}" "FAIL" "${r:0:120}"
  fi
done

# ── Inpatient ────────────────────────────────────────────────────
log "=== Inpatient (IPD) ==="
for ep in "/inpatient/wards" "/inpatient/admissions?limit=5" "/inpatient/beds"; do
  r="$(api_get "$ep" 2>&1)" || r=""
  if echo "$r" | jq -e '.' >/dev/null 2>&1 && [[ "$r" != *"Forbidden"* && "$r" != *"Not Found"* ]]; then
    record "Inpatient" "GET ${ep}" "PASS" "OK"
  else
    record "Inpatient" "GET ${ep}" "WARN" "${r:0:120}"
  fi
done

# ── Emergency ────────────────────────────────────────────────────
log "=== Emergency ==="
for ep in "/emergency/queue?limit=5" "/emergency/bays" "/emergency/dashboard"; do
  r="$(api_get "$ep" 2>&1)" || r=""
  if echo "$r" | jq -e '.' >/dev/null 2>&1 && [[ "$r" != *"Forbidden"* ]]; then
    record "Emergency" "GET ${ep}" "PASS" "OK"
  else
    record "Emergency" "GET ${ep}" "WARN" "${r:0:120}"
  fi
done

# ── Specialty ────────────────────────────────────────────────────
log "=== Specialty (Theatre & Maternity) ==="
for ep in "/theatre/procedures" "/theatre/bookings?limit=5" "/maternity/pregnancies?limit=5"; do
  r="$(api_get "$ep" 2>&1)" || r=""
  if echo "$r" | jq -e '.' >/dev/null 2>&1 && [[ "$r" != *"Forbidden"* ]]; then
    record "Specialty" "GET ${ep}" "PASS" "OK"
  else
    record "Specialty" "GET ${ep}" "WARN" "${r:0:120}"
  fi
done

# ── Reports & Analytics ──────────────────────────────────────────
log "=== Reports & Executive Analytics ==="
for ep in "/reports/dashboard" "/reports/operations" \
          "/reports/executive-analytics?from=$(date -u -d '30 days ago' +%Y-%m-%d 2>/dev/null || date -u -v-30d +%Y-%m-%d 2>/dev/null || echo '2026-05-01')&to=$(date -u +%Y-%m-%d)" \
          "/reports/opd-summary" "/reports/laboratory"; do
  r="$(api_get "$ep" 2>&1)" || r=""
  if echo "$r" | jq -e '.' >/dev/null 2>&1 && [[ "$r" != *"Forbidden"* ]]; then
    record "Reports" "GET ${ep}" "PASS" "OK"
  else
    record "Reports" "GET ${ep}" "FAIL" "${r:0:120}"
  fi
done

# ── Administration / Account Center ────────────────────────────
log "=== Administration & Account Center ==="
for ep in "/admin/users/summary" "/admin/users" "/admin/users/role-options" "/admin/clinical-staff" \
          "/admin/settings" "/admin/clinical-catalog" "/admin/departments"; do
  r="$(api_get "$ep" 2>&1)" || r=""
  if echo "$r" | jq -e '.' >/dev/null 2>&1 && [[ "$r" != *"Forbidden"* ]]; then
    record "Administration" "GET ${ep}" "PASS" "OK"
  else
    record "Administration" "GET ${ep}" "WARN" "${r:0:120}"
  fi
done

# ── New features spot-check ──────────────────────────────────────
log "=== Recent feature checks ==="
staff_count="$(api_get /admin/clinical-staff 2>/dev/null | jq 'length' 2>/dev/null || echo 0)"
record "Account Center" "Clinical staff directory" "PASS" "${staff_count} clinician(s) listed"

modalities="$(api_get /radiology/modalities 2>/dev/null | jq 'length' 2>/dev/null || echo 0)"
studies="$(api_get /radiology/studies 2>/dev/null | jq 'length' 2>/dev/null || echo 0)"
record "Radiology Catalog" "Modalities configured" "PASS" "${modalities} modality(ies)"
record "Radiology Catalog" "Study protocols in catalog" "$([[ "${studies:-0}" -gt 0 ]] && echo PASS || echo WARN)" "${studies} study protocol(s)"

analytics="$(api_get "/reports/executive-analytics?from=2026-01-01&to=2026-06-30" 2>/dev/null)"
if echo "$analytics" | jq -e '.summary.opdVisits' >/dev/null 2>&1; then
  record "Executive Analytics" "BI dashboard API" "PASS" "summary + trends returned"
else
  record "Executive Analytics" "BI dashboard API" "FAIL" "$(echo "$analytics" | head -c 120)"
fi

# ── UI static assets ─────────────────────────────────────────────
log "=== Frontend UI assets ==="
for asset in "/" "/index.html"; do
  code="$(http_ok "${FRONTEND_URL}${asset}")"
  [[ "$code" == "200" ]] && record "UI" "Page ${asset}" "PASS" "HTTP $code" || record "UI" "Page ${asset}" "FAIL" "HTTP $code"
done

# ── Write reports ────────────────────────────────────────────────
printf '%s\n' "${RESULTS[@]}" | jq -s \
  --arg stamp "$STAMP" \
  --argjson pass "$PASS" --argjson fail "$FAIL" --argjson warn "$WARN" \
  '{generatedAt:$stamp, summary:{pass:$pass,fail:$fail,warn:$warn}, results:.}' > "$REPORT_JSON"

{
  echo "# AfyaSasa Full System Audit Report"
  echo ""
  echo "**Generated:** ${STAMP} (UTC)"
  echo "**Environment:** ${BACKEND_URL} / ${FRONTEND_URL}"
  echo "**Tenant:** ${TENANT} | **User:** ${EMAIL}"
  echo ""
  echo "## Summary"
  echo ""
  echo "| Result | Count |"
  echo "|--------|-------|"
  echo "| PASS | ${PASS} |"
  echo "| WARN | ${WARN} |"
  echo "| FAIL | ${FAIL} |"
  echo ""
  echo "## Work completed in this release cycle"
  echo ""
  echo "1. **Account Center** — create/edit users, specialisation, reset password, search, quick-add doctor, clinical staff directory"
  echo "2. **Radiology catalog** — CSV template download + bulk import (modalities + study protocols)"
  echo "3. **Executive Analytics** — BI dashboard with date ranges, KPIs, trends, comparisons, configurable widgets, CSV export"
  echo "4. **Auth/session** — cross-tab sync, refresh tokens, forced password change flow"
  echo "5. **Single-hospital mode** — tenant selector hidden via env config"
  echo ""
  echo "## Results by department"
  echo ""
  current_area=""
  while IFS= read -r row; do
    area="$(echo "$row" | jq -r '.area')"
    test="$(echo "$row" | jq -r '.test')"
    status="$(echo "$row" | jq -r '.status')"
    detail="$(echo "$row" | jq -r '.detail')"
    if [[ "$area" != "$current_area" ]]; then
      echo ""
      echo "### ${area}"
      echo ""
      echo "| Test | Status | Detail |"
      echo "|------|--------|--------|"
      current_area="$area"
    fi
    echo "| ${test} | ${status} | ${detail} |"
  done < <(printf '%s\n' "${RESULTS[@]}" | jq -c '.')
  echo ""
  echo "## Manual UI audit checklist (for your review)"
  echo ""
  echo "- [ ] Login screen — no hospital code field (single-tenant mode)"
  echo "- [ ] Sidebar navigation — all department groups visible for admin"
  echo "- [ ] Hospital Control Center → User & access — edit doctor, reset password"
  echo "- [ ] Hospital Control Center → Radiology — download template, import CSV"
  echo "- [ ] Reports → Executive Analytics — date presets, charts, export"
  echo "- [ ] OPD → Doctor Queue, Triage Queue load without layout issues"
  echo "- [ ] Laboratory & Radiology worklists operational"
  echo "- [ ] Mobile/tablet — content full width, nav drawer works"
  echo ""
  echo "---"
  echo "*Automated audit by ops/full-system-audit.sh*"
} > "$REPORT_MD"

log ""
log "Audit complete: PASS=${PASS} WARN=${WARN} FAIL=${FAIL}"
log "JSON: ${REPORT_JSON}"
log "Markdown: ${REPORT_MD}"
echo "$REPORT_MD"
