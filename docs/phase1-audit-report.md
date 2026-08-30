# AfyaSasa — Phase 1 Audit Report

**Date:** 2026-08-29  
**Phase:** 1 — Audit (no major code changes)  
**Auditor:** Engineering audit via repository inspection + automated test inventory  
**Directive:** [`development-status-directive.md`](./development-status-directive.md)

---

## Executive summary

AfyaSasa has **substantial implementation** across core clinical and operations modules. The repository is ahead of several documentation files written earlier in the sprint (inventory and OPD workflow were marked incomplete in docs but are implemented in code).

**Primary gaps are now:**

1. **Validation** — staff UAT and specialty E2E tests, not missing OPD/lab modules  
2. **Coherence** — encounter workflow bypasses (ED/IPD), timeline completeness, notification consolidation  
3. **Known bugs** — IPD timeline UI, requisition destination stock, attending-doctor overwrite  
4. **Production** — VPS deploy, TLS, backups not yet executed  

---

## 1. Workflow map summary

Full map: [`core-workflow-map.md`](./core-workflow-map.md)

### P0 chain — automated evidence

```text
RECEPTION → PATIENT → OPD CHECK-IN → TRIAGE → DOCTOR QUEUE → CONSULTATION
→ DIAGNOSIS → LAB/RADIOLOGY → RESULT → DOCTOR REVIEW → PRESCRIPTION
→ PHARMACY → DISPENSE
```

| Segment | API test | Manual UAT |
|---------|----------|------------|
| Patient search/register | ✅ OPD script | ⏳ Staff |
| OPD check-in + attending doctor | ✅ OPD script step 3 | ⏳ Staff |
| Triage → doctor queue | ✅ OPD script | ⏳ Staff |
| Consultation + diagnosis | ✅ OPD script | ⏳ Staff |
| Lab round trip + review | ✅ lab script | ⏳ Staff |
| Radiology round trip + review | ✅ radiology script | ⏳ Staff |
| Prescription + dispense | ✅ pharmacy script | ⏳ Staff |
| Disposition / complete | ✅ OPD script | ⏳ Staff |

### P1 chain — automated evidence

```text
ADMISSION → BED → NURSING → ORDERS → DISCHARGE
```

| Segment | API test | Manual UAT |
|---------|----------|------------|
| IPD admit + census | ✅ IPD script | ⏳ Staff |
| Nursing vitals/MAR | ✅ IPD script | ⏳ Staff |
| Discharge + bed release | ✅ IPD script | ⏳ Staff |

```text
DEPARTMENT → REQUISITION → APPROVE → ISSUE → RECEIPT
```

| Segment | API test | Gap |
|---------|----------|-----|
| Requisition + auto-route | ✅ inventory script | Destination batch credit missing |
| Transfer ship/receive | ✅ inventory script | — |

---

## 2. Database relationship map (high level)

```text
public.tenants (code=jalaram)
    └── demo schema (TypeORM clinical entities)

demo.patients
    ├── patient_identifiers (national_id, sha, …)
    ├── patient_next_of_kin
    └── encounters
            ├── triage_assessments
            ├── consultations
            ├── encounter_diagnoses
            ├── lab_requests → lab_results (reviewed_at ≠ verified_at)
            ├── radiology_requests → radiology_reports
            ├── clinical_orders (mirror index)
            ├── referrals, sick_sheets
            └── admissions → beds, discharge_summaries

inventory_items
    ├── inventory_locations (PHARMACY, MAIN_STORE, WARD-*)
    ├── inventory_batches (qty, expiry)
    ├── inventory_transactions (ledger)
    ├── inventory_requisitions → lines
    └── inventory_transfers → lines

demo.audit_logs (HTTP interceptor)
internal_notifications, sms_logs
```

**Single patient record:** All modules FK to `demo.patients.id` — no departmental duplicate patients.

---

## 3. Gap matrix updates

See updated [`core-workflow-gap-matrix.md`](./core-workflow-gap-matrix.md).

Key corrections from stale docs:

| Was documented | Actual state |
|----------------|----------------|
| Inventory 0% | ~80% — engine, UI, requisitions, transfers, dispense |
| attendingDoctor not saved | Saved at check-in; overwritten at consult start |
| OPD bypasses workflow | OPD uses `EncounterWorkflowService`; ED/IPD bypass |
| No pharmacy test | `pharmacy-workflow-test.sh` exists and passes |

---

## 4. Known bugs (prioritized for Phase 2)

### P0

| Bug | File | Impact |
|-----|------|--------|
| IPD timeline tab broken | `frontend/src/components/ipd/PatientWorkspace.tsx` | Timeline shows empty/wrong — expects array, API returns `{ patient, events }` |
| `attendingDoctor` overwrite | `backend/src/opd/opd.service.ts` ~L292 | Check-in doctor lost if different clinician consults |
| `markAwaitingResults` silent fail | `backend/src/workflow/encounter-workflow.service.ts` | Invalid state transition not surfaced to API caller |
| Timeline missing dispense/pharmacy | `backend/src/patients/patients.service.ts` | Medication history incomplete on timeline |

### P1

| Bug | File | Impact |
|-----|------|--------|
| Requisition issue no destination credit | `backend/src/inventory/inventory.service.ts` | Department receipt not reflected in batch balances |
| Pharmacy permission uses `lab_requests:read` | clinical-orders controller | Pharmacists may get 403 incorrectly |
| ED/IPD bypass encounter workflow | `emergency.service.ts`, `inpatient.service.ts` | Invalid transitions possible |
| Notification dispatcher unused | `notifications/` | Direct calls everywhere; no unified event bus |

### P2

| Bug | File | Impact |
|-----|------|--------|
| ICU frontend not wired | `IpdModule.tsx`, nav | Backend ICU API unreachable from UI |
| No ED/maternity/theatre E2E tests | `ops/` | Specialty validation unproven |

---

## 5. Duplicate logic

| Pattern | Locations | Recommendation |
|---------|-----------|----------------|
| Lab/radiology review → encounter transition | `laboratory.service.ts`, `radiology.service.ts` | Extract shared helper in Phase 2 |
| Tenant fallback `?? 'demo'` | Reduced but some remain | Continue `tenantChannel()` migration |
| Clinical order mirror | Centralized in `clinical-order-mirror.service.ts` | Good — extend for pharmacy source records |

---

## 6. Security audit (summary)

| Control | Status |
|---------|--------|
| JWT access + refresh | ✅ |
| Global `JwtAccessGuard` + `PermissionsGuard` | ✅ |
| `@Public()` only on auth endpoints | ✅ |
| Password bcrypt hashing | ✅ |
| Login rate limiting | ✅ (120/min) |
| Server-side `@RequirePermissions` | ✅ per module |
| Frontend nav filter | ⚠️ UX only — not security |
| Default passwords in seed | ⚠️ Must reset before production |
| Swagger `/docs` | ⚠️ Should block in production Nginx |
| Audit HTTP interceptor | ✅ (beforeJson snapshot incomplete) |

---

## 7. Broken persistence points

| Workflow step | Persists? | Notes |
|---------------|-----------|-------|
| OPD check-in attending doctor | ✅ | Overwritten at consult |
| Encounter status (OPD) | ✅ | Workflow enforced |
| Encounter status (ED admit/discharge) | ⚠️ | Direct SQL update |
| Lab verified vs reviewed | ✅ | Separate columns |
| Pharmacy dispense → ledger | ✅ | FEFO batch debit |
| Requisition issue → destination | ❌ | Source debited only |
| Patient timeline aggregation | ⚠️ | Many event types missing |

---

## 8. Automated test inventory

| Script | Status |
|--------|--------|
| `ops/smoke-test.sh` | ✅ |
| `ops/opd-workflow-test.sh` | ✅ |
| `ops/ipd-workflow-test.sh` | ✅ |
| `ops/lab-workflow-test.sh` | ✅ |
| `ops/radiology-workflow-test.sh` | ✅ |
| `ops/inventory-workflow-test.sh` | ✅ |
| `ops/pharmacy-workflow-test.sh` | ✅ |
| `ops/test-workflows.sh` | ✅ orchestrator |
| `ops/emergency-workflow-test.sh` | ❌ missing |
| `ops/maternity-workflow-test.sh` | ❌ missing |
| `ops/theatre-workflow-test.sh` | ❌ missing |
| Playwright form-submit UAT | ❌ navigation only |

---

## 9. Phase 2 recommended fix order

Per execution directive, **do not add modules**. Fix in this order:

1. IPD timeline response parsing (P0 UI bug)  
2. Patient timeline — add pharmacy dispense events (P0)  
3. `attendingDoctor` — preserve check-in doctor or explicit reassign (P0)  
4. `markAwaitingResults` — fail loudly on invalid transition (P0)  
5. Requisition destination batch credit (P1)  
6. Pharmacy-specific permissions (P1)  
7. Wire ED encounter status through workflow service (P1)  
8. ICU frontend API integration (P2)  
9. Notification dispatcher wiring (P1)  

---

## 10. Phase 1 report (per directive §31)

### Changed

- Documentation only — no application code modified in Phase 1  
- Created: `development-status-directive.md`, `development-progress.md`, `phase1-audit-report.md`  
- Updated: `core-workflow-gap-matrix.md`, `core-workflow-map.md`, `inventory-architecture.md`, `core-workflow-test-plan.md`

### Database

- No migrations in Phase 1

### Backend / Frontend

- No code changes in Phase 1

### Tests

- Existing `npm run test:workflows` suite referenced as evidence  
- No new tests added in Phase 1

### Workflow tested

- Audit via code inspection and test script inventory (not re-run during doc update)

### Remaining

- Phase 2 P0 fixes (see §9)  
- Staff UAT  
- Production deploy

### Risk

- **Clinical:** Attending-doctor overwrite may misattribute encounters in multi-doctor scenarios  
- **Data integrity:** Requisition destination stock mismatch  
- **Operational:** Docs were stale — teams may underestimate readiness  
- **Deployment:** Production not yet on Contabo  

---

*Phase 1 complete. Proceed to Phase 2 — P0 fixes per [`development-status-directive.md`](./development-status-directive.md).*
