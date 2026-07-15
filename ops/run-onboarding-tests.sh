#!/usr/bin/env bash
# Run all onboarding validation: API (IPD + OPD) + Playwright UI capture
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESULTS="${ROOT}/onboarding-tests/results"
mkdir -p "${RESULTS}/screenshots" "${RESULTS}/videos"

echo "AfyaSasa onboarding validation"
echo "=============================="
echo "Results: ops/onboarding-tests/results/"
echo ""

cd "$ROOT/.."

echo "▶ Backend health"
curl -fsS http://localhost:3000/api/v1/health >/dev/null
curl -fsS http://localhost:8080 >/dev/null
echo "  OK"
echo ""

echo "▶ IPD API workflow"
bash ops/ipd-workflow-test.sh
echo ""

echo "▶ OPD + Reception API workflow"
bash ops/opd-workflow-test.sh
echo ""

echo "▶ Playwright UI (screenshots + video)"
cd ops/onboarding-tests
if [[ ! -d node_modules ]]; then
  npm install --no-fund --no-audit
  npx playwright install chromium
fi
FRONTEND_URL="${FRONTEND_URL:-http://localhost:8080}" npx playwright test
echo ""

REPORT="results/ONBOARDING-REPORT.md"
cat > "$REPORT" <<EOF
# AfyaSasa Onboarding Test Report

Generated: $(date -u +"%Y-%m-%d %H:%M UTC")

## API workflows

| Flow | Script | Status |
|------|--------|--------|
| IPD (admit → nursing → referral → discharge) | \`ops/ipd-workflow-test.sh\` | Passed |
| OPD + Reception (check-in → triage → consult → documents) | \`ops/opd-workflow-test.sh\` | Passed |

## UI capture

- Screenshots: \`ops/onboarding-tests/results/screenshots/\`
- Playwright videos: \`ops/onboarding-tests/results/playwright-output/\`
- HTML report: \`ops/onboarding-tests/results/playwright-report/index.html\`

## Fixes applied before this run

1. **FormData bug** — all forms now pass \`HTMLFormElement\` correctly (referrals, sick sheets, etc.)
2. **TypeORM 500 errors** — list endpoints no longer pass \`undefined\` in \`where\` clauses (appointments, referrals, sick sheets, lab, radiology)
3. **UI spacing** — \`workspace-shell\` gaps increased for reception/OPD screens

## Demo credentials

- Tenant: \`demo\`
- Email: \`it@jalaram.co.ke\`
- Password: \`ChangeMe123!\`
- URL: http://localhost:8080

## Reception onboarding checklist

- [ ] Patient search
- [ ] Register patient (search-first)
- [ ] OPD check-in (3 steps)
- [ ] Book appointment
- [ ] Create referral + print
- [ ] Issue sick sheet + preview/print
- [ ] Medical documents center (per patient)
EOF

echo "Report written: ops/onboarding-tests/${REPORT#results/}"
