# AfyaSasa Core Workflow Test Plan

**Generated:** 2026-08-28 · **Updated:** 2026-08-29  
**Purpose:** Executable acceptance tests proving UI → API → DB → downstream workflow.  
**Environment:** Docker Compose local (`http://localhost:8080`, API via nginx `http://localhost:8080/api/v1` or direct `http://localhost:3000/api/v1`)

---

## Run full automated suite

```bash
docker compose up -d --build
npm run test:workflows
```

Production/VPS (nginx on 8080):

```bash
API=http://127.0.0.1:8080/api/v1 TENANT=jalaram npm run test:workflows
```

---

## Prerequisites

```bash
cp .env.example .env
# Ensure:
# DEFAULT_TENANT_CODE=jalaram
# HOSPITAL_NUMBER_PREFIX=JH
# TYPEORM_MIGRATIONS_RUN=true

docker compose up -d --build
npm run smoke          # health checks
```

**Test credentials:**

| Role | Email | Password |
|------|-------|----------|
| Admin / Records | `it@jalaram.co.ke` | `ChangeMe123!` (change if forced) |
| Doctor | `doctor@jalaram.co.ke` | `ChangeMe123!` |
| Nurse | `nurse@jalaram.co.ke` | `ChangeMe123!` |
| Lab | `lab@jalaram.co.ke` | `ChangeMe123!` |

**Tenant header:** `X-Tenant: jalaram`

---

## Existing automated tests

| Script | Type | Coverage | Command |
|--------|------|----------|---------|
| `ops/smoke-test.sh` | Health | Backend + frontend + login | `npm run smoke` |
| `ops/opd-workflow-test.sh` | API (15+ steps) | Reception → OPD → triage → SOAP → referral → sick sheet → workflow guard → complete | `npm run test:opd` |
| `ops/ipd-workflow-test.sh` | API (13 steps) | Admit → vitals → MAR → discharge | `npm run test:ipd` |
| `ops/lab-workflow-test.sh` | API | Lab order → awaiting_results → verify → doctor review → in_consultation | `npm run test:lab` |
| `ops/radiology-workflow-test.sh` | API | Imaging order → report → verify → doctor review | `npm run test:radiology` |
| `ops/inventory-workflow-test.sh` | API | Receipt → balances → requisition (auto-route) → transfer | `npm run test:inventory` |
| `ops/pharmacy-workflow-test.sh` | API | Prescribe → FEFO dispense → ledger → order dispensed | `npm run test:pharmacy` |
| `ops/test-workflows.sh` | Orchestrator | All scripts above | `npm run test:workflows` |
| `ops/onboarding-tests/specs/reception-opd.spec.ts` | Playwright | Navigation + screenshots (no form submit) | onboarding runner |
| `backend/src/core/audit/audit.interceptor.spec.ts` | Unit | Audit interceptor | `npm run test` (backend) |

**Gaps:** No automated tests for ED, maternity, theatre, ICU. Playwright does not submit clinical forms.

---

## P0 acceptance tests

### AT-P0-01 — Register patient

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login as records/admin | Dashboard loads |
| 2 | Register Patient → fill required fields + National ID | Form validates |
| 3 | Submit | Success toast; `patientNo` starts with `JH-` |
| 4 | SQL: `SELECT patient_no FROM demo.patients ORDER BY created_at DESC LIMIT 1;` | Matches JH pattern |
| 5 | Search same patient by name | Appears in autocomplete |

**API equivalent:**

```bash
curl -X POST "$API/patients" -H "Authorization: Bearer $TOKEN" -H "X-Tenant: jalaram" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"Patient","dateOfBirth":"1990-01-01","gender":"male","primaryPhone":"0712345678","identifiers":[{"type":"national_id","value":"TEST-ID-001","isPrimary":true}]}'
```

**Pass criteria:** HTTP 201; response includes `patientNo` matching `JH-\d{4}-\d{5}`.

---

### AT-P0-02 — OPD check-in with preferred doctor

| Step | Action | Expected |
|------|--------|----------|
| 1 | OPD Check-In → select patient | Step 2 enabled |
| 2 | Select clinic, visit type, **preferred doctor** | Review shows **Dr. Name** not UUID |
| 3 | Confirm check-in | Encounter created |
| 4 | SQL: `SELECT attending_doctor_id FROM demo.encounters ORDER BY created_at DESC LIMIT 1;` | Matches selected doctor |

**Pass criteria:** `attending_doctor_id` = selected doctor UUID. **Automated:** `ops/opd-workflow-test.sh` step 3.

---

### AT-P0-03 — Triage

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login as nurse → Triage Queue | Queue lists registered patients |
| 2 | Select patient → enter vitals + colour | Modal submits |
| 3 | SQL: `SELECT status FROM demo.encounters WHERE id = '$ENC';` | `triaged` |
| 4 | SQL: `SELECT colour, chief_complaint FROM demo.triage_assessments WHERE encounter_id = '$ENC';` | Vitals persisted |

**API:** Covered in `ops/opd-workflow-test.sh` steps 4–5.

---

### AT-P0-04 — Doctor queue + consultation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login as doctor → Doctor Queue | Patient appears (triaged) |
| 2 | Select → Context tab shows categorized cards | No UUID in header |
| 3 | SOAP tab → save consultation | Success notification |
| 4 | Add diagnosis | Persisted |
| 5 | SQL: `SELECT status FROM demo.encounters WHERE id = '$ENC';` | `in_consultation` |

---

### AT-P0-05 — Lab order round trip

| Step | Action | Expected |
|------|--------|----------|
| 1 | Doctor → Orders tab → order CBC (or API) | `lab_requests` row + `clinical_orders` mirror |
| 2 | Login lab → Laboratory worklist | Request visible with **patient name** |
| 3 | Collect sample | Status `sample_collected` |
| 4 | Enter result → verify | Status `verified` |
| 5 | Login doctor → Results Inbox | Patient name + request no; not UUID |
| 6 | Review result | `lab_results.reviewed_at` NOT NULL |

**SQL checks:**

```sql
SELECT lr.status, res.verified_at, res.reviewed_at
FROM demo.lab_requests lr
JOIN demo.lab_request_items lri ON lri.request_id = lr.id
JOIN demo.lab_results res ON res.request_item_id = lri.id
ORDER BY lr.created_at DESC LIMIT 1;
```

**Pass criteria:** `verified_at` and `reviewed_at` both set; statuses distinct.

---

### AT-P0-06 — Imaging round trip

Same structure as AT-P0-05 using radiology endpoints and `RadiologyWorklist.tsx`.

**Pass criteria:** Report verified; clinician review sets `radiology_reports.reviewed_at`.

---

### AT-P0-07 — Referral + sick sheet

**API:** `ops/opd-workflow-test.sh` steps 12–14.

**Pass criteria:** Rows in `demo.referrals` and `demo.sick_sheets` linked to patient/encounter.

---

### AT-P0-08 — Patient timeline

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Patient Timeline for test patient | Events listed chronologically |
| 2 | After lab test | Timeline includes lab event |
| 3 | API: `GET /patients/:id/timeline` | JSON events array non-empty |

---

### AT-P0-09 — Audit trail

| Step | Action | Expected |
|------|--------|----------|
| 1 | Perform registration (AT-P0-01) | — |
| 2 | Admin → Audit logs → filter today | Entry for POST /patients |
| 3 | Entry includes user id, action, timestamp | Present |

---

### AT-P0-10 — Encounter workflow transitions

| Step | Action | Expected |
|------|--------|----------|
| 1 | PATCH encounter status `registered` → `completed` directly | Returns **400** |
| 2 | Valid path: registered → triaged → in_consultation → completed | Each step succeeds |

**Automated:** `ops/opd-workflow-test.sh` step 13b.

---

## P1 acceptance tests

### AT-P1-01 — IPD admission + bed state

**Script:** `ops/ipd-workflow-test.sh`

**Pass criteria:**
- `admissions.status = active`
- `beds.status = occupied` for assigned bed
- `admission_no` matches `JH-ADM-*`

---

### AT-P1-02 — IPD consultant name on ward board

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admit patient with doctor user | Admission created |
| 2 | Open ward bed board | Shows **Dr. First Last** |
| 3 | API: `GET /inpatient/wards/:id/census` → `consultant` field human-readable |

**Automated:** `ops/ipd-workflow-test.sh` step 4b.

---

### AT-P1-03 — IPD discharge frees bed

| Step | Action | Expected |
|------|--------|----------|
| 1 | Complete discharge summary | Status complete |
| 2 | Discharge admission | `admissions.status = discharged` |
| 3 | Bed status | `cleaning` or `available` after workflow |

---

### AT-P1-04 — Pharmacy prescription + dispense

| Step | Action | Expected |
|------|--------|----------|
| 1 | Doctor → prescribe Paracetamol | Order created |
| 2 | Admin/pharmacist → dispense | `clinical_orders.status = dispensed` |
| 3 | SQL: `inventory_transactions` row with `transaction_type = DISPENSE` | Ledger row exists |

**Automated:** `ops/pharmacy-workflow-test.sh`

---

### AT-P1-05 — MOH auto-report

| Step | Action | Expected |
|------|--------|----------|
| 1 | Wait for scheduler or `GET /reports/moh/auto-run` | Returns ok |
| 2 | Admin notifications | MOH ready message |
| 3 | Backend logs | No "demo alias" error |

---

## P2 acceptance tests (specialty — manual UAT)

| ID | Workflow | Minimum pass |
|----|----------|--------------|
| AT-P2-01 | ED arrival → triage → disposition | Disposition recorded |
| AT-P2-02 | Maternity ANC visit | Pregnancy row created |
| AT-P2-03 | Maternity delivery → newborn patient | Mother-baby link exists |
| AT-P2-04 | Theatre booking → complete | Booking status updated |

---

## P3 acceptance tests (integration — future)

| ID | Scenario | Expected |
|----|----------|----------|
| AT-P3-01 | Register with SHA; HIE stub offline | Patient saved; verification pending |
| AT-P3-02 | HIE verify success | `external_identifiers.status = verified` |
| AT-P3-03 | Duplicate outbound job | Idempotent — one external ref |

---

## P4 production smoke (pre go-live)

```bash
# On VPS after deploy
curl -fsS https://your-domain/api/v1/health
TENANT=jalaram API=https://your-domain/api/v1 ./ops/opd-workflow-test.sh
# Verify TLS, backup restore, no default JWT secrets
```

Checklist: `docs/go-live-checklist.md`

---

## Test execution matrix

| Test ID | Automated | Script / method | Status |
|---------|-----------|-----------------|--------|
| AT-P0-01 | Partial | API curl / manual UI | 🔍 Verify |
| AT-P0-02 | Yes | `opd-workflow-test.sh` | ✅ |
| AT-P0-03 | Yes | `opd-workflow-test.sh` | ✅ |
| AT-P0-04 | Yes | `opd-workflow-test.sh` | ✅ |
| AT-P0-05 | Yes | `lab-workflow-test.sh` | ✅ |
| AT-P0-06 | Yes | `radiology-workflow-test.sh` | ✅ |
| AT-P0-07 | Yes | `opd-workflow-test.sh` | ✅ |
| AT-P0-08 | Partial | `opd-workflow-test.sh` timeline GET | 🔍 Verify |
| AT-P0-09 | Manual | Admin audit panel | 🔍 Verify |
| AT-P0-10 | Yes | `opd-workflow-test.sh` step 13b | ✅ |
| AT-P1-01 | Yes | `ipd-workflow-test.sh` | ✅ |
| AT-P1-02 | Yes | `ipd-workflow-test.sh` step 4b | ✅ |
| AT-P1-03 | Yes | `ipd-workflow-test.sh` | ✅ |
| AT-P1-04 | Yes | `pharmacy-workflow-test.sh` | ✅ |
| AT-P1-05 | Partial | API trigger | 🔍 Verify |

**Run all:** `npm run test:workflows`

---

## Definition of pass

A test **passes** only when:

1. HTTP responses are success (or expected 4xx for negative tests)  
2. Database rows match expected state (SQL verified)  
3. Downstream user role sees correct human-readable data  
4. Audit log contains mutation (where applicable)  
5. No regression in `npm run smoke`  

Report failures with: test ID, step, expected vs actual, relevant SQL query.

---

## Reporting template

```markdown
## Test run: YYYY-MM-DD
- Environment: local | staging | production
- Tenant: jalaram
- Commit: <hash>

| Test ID | Result | Notes |
|---------|--------|-------|
| AT-P0-01 | PASS/FAIL | |
| AT-P0-02 | PASS/FAIL | |

Blockers:
- ...

Evidence:
- Log file: ops/onboarding-tests/results/...
```
