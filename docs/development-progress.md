# AfyaSasa — Development Progress

**Last updated:** 2026-08-29  
**Baseline:** Jalaram Hospital single-tenant pilot (`DEFAULT_TENANT_CODE=jalaram`)  
**Source of truth:** Repository code + `ops/test-workflows.sh` + Phase 1 audit

Percentages are **estimates** — closure requires evidence per [`core-workflow-gap-matrix.md`](./core-workflow-gap-matrix.md).

---

## Overall readiness

| Milestone | Estimate | Evidence |
|-----------|----------|----------|
| Jalaram supervised pilot (reception, OPD, lab, IPD, pharmacy/store) | **~70%** | 7 API workflow scripts pass locally |
| Full hospital go-live (all depts, docs, integrations, production) | **~55–60%** | Specialty UAT, documents, SHA, VPS incomplete |

---

## Layer progress

| Layer | % | Status | Evidence |
|-------|---|--------|----------|
| Database & migrations | 85 | Core clinical + inventory tables, Jalaram tenant | `backend/src/database/migrations/` |
| Backend API | 80 | Most modules implemented; specialty/ICU gaps | 33 NestJS modules |
| Frontend UI | 75 | Main screens exist; ICU not wired; some bugs | `frontend/src/components/` |
| Automated API tests | 90 | 7 workflow scripts + smoke | `npm run test:workflows` |
| Admin / configuration | 70 | Hospital Control Center; some placeholders | `HospitalControlCenter.tsx` |
| Inventory & pharmacy | 80 | Engine + UI + requisitions + transfers + dispense | `inventory-workflow-test.sh`, `pharmacy-workflow-test.sh` |
| Integrations (SMS, SHA, email) | 10 | SHA capture only; SMS stub | `.env.example`, `sha-integration-architecture.md` |
| Production deployment | 25 | Guide + scripts; VPS not live | `contabo-deployment-guide.pdf` |

---

## Module progress

| Module | Backend | Frontend | API tested | Status |
|--------|---------|----------|------------|--------|
| Auth & Jalaram tenant | ✅ | ✅ | ✅ smoke | **Done** |
| Patient registration/search | ✅ | ✅ | ✅ OPD script | **Done** |
| OPD check-in → consultation | ✅ | ✅ | ✅ OPD script | **Done** (see attending-doctor caveat) |
| Triage & doctor queue | ✅ | ✅ | ✅ OPD script | **Done** |
| Lab | ✅ | ✅ | ✅ lab script | **Done** |
| Radiology | ✅ | ✅ | ✅ radiology script | **Done** |
| Referrals & sick sheets | ✅ | ✅ | ✅ OPD script | **Done** |
| Appointments | ✅ | ✅ | ✅ OPD script | **Done** |
| IPD | ✅ | ✅ | ✅ IPD script | **Done** |
| Nursing | ✅ | ✅ | ✅ IPD script | **Done** |
| Pharmacy + dispensing | ✅ | ✅ | ✅ pharmacy script | **Done** |
| Inventory (store) | ✅ | ✅ | ✅ inventory script | **Done** (destination credit gap) |
| Emergency | ✅ | ✅ | ❌ no E2E script | **~60%** |
| Maternity | ✅ | ✅ | ❌ no E2E script | **~50%** |
| Theatre | ✅ | ✅ | ❌ no E2E script | **~50%** |
| ICU/HDU | ✅ | ⚠️ ward board only | ❌ | **~55%** |
| Notifications | ⚠️ direct calls | ✅ inbox | ⚠️ partial | **~65%** |
| Documents / MinIO | ⚠️ radiology only | ⚠️ partial | ❌ | **~40%** |
| Reports / MOH | ⚠️ partial | ⚠️ placeholders | ⚠️ | **~50%** |
| SHA / HIE | ❌ capture only | ❌ | ❌ | **~5%** |

---

## Phase status (execution directive)

| Phase | Status | Next action |
|-------|--------|-------------|
| **1 — Audit** | ✅ Complete | See [`phase1-audit-report.md`](./phase1-audit-report.md) |
| **2 — P0 fixes** | 🔄 In progress | 5 audit bugs fixed; pharmacy permissions + UAT remain |
| **3 — P1 operations** | 🔄 Mostly complete | ICU frontend + ledger UI remain |
| **4 — P2 specialty** | ⏳ Blocked on P0 | ED/maternity/theatre E2E scripts + UAT |
| **5 — P3 interoperability** | ⏳ Future | External identifier model |
| **6 — P4 production** | ⏳ Blocked on UAT | Contabo deploy per deployment guide |

---

## Known bugs (Phase 1 audit)

| # | Issue | Priority | Status |
|---|-------|----------|--------|
| 1 | IPD `PatientWorkspace` timeline tab — wrong API response shape | P0 | ✅ Fixed |
| 2 | `attendingDoctor` overwritten when different doctor starts consult | P0 | ✅ Fixed |
| 3 | Requisition issue debits source but does not credit destination batches | P1 | ✅ Fixed |
| 4 | `markAwaitingResults()` silent no-op on invalid encounter state | P0 | ✅ Fixed |
| 5 | Pharmacy orders gated by `lab_requests:read` permission | P1 | ✅ Fixed — `pharmacy:read/prescribe/dispense` |
| 6 | ICU frontend has zero `/icu/` API integration | P2 | ✅ Fixed — `IcuModule.tsx` |
| 7 | ED/IPD admission bypass `EncounterWorkflowService` | P1 | ✅ Fixed — workflow wired |
| 8 | Dispense/inventory events missing from patient timeline | P0 | ✅ Fixed |
| 9 | `NotificationDispatcherService` scaffold unused | P1 | ✅ Fixed — `notifyUsers` + registration enqueue events |

---

## Test coverage

```bash
npm run test:workflows   # smoke + OPD + IPD + lab + radiology + inventory + pharmacy
```

| Script | Steps | Covers |
|--------|-------|--------|
| `ops/smoke-test.sh` | Health + login | Stack up |
| `ops/opd-workflow-test.sh` | 15+ | Full OPD + attending doctor + workflow guard |
| `ops/ipd-workflow-test.sh` | 13 | Admit → nursing → discharge |
| `ops/lab-workflow-test.sh` | Full | Order → result → doctor review |
| `ops/radiology-workflow-test.sh` | Full | Imaging round trip |
| `ops/inventory-workflow-test.sh` | Full | Receipt, requisition, transfer |
| `ops/pharmacy-workflow-test.sh` | Full | Prescribe → dispense → ledger |

**Missing:** ED, maternity, theatre, ICU workflow scripts; Playwright form-submit UAT.

---

## What blocks go-live (non-code)

- Staff UAT by role (reception, nurse, doctor, lab, pharmacy, store, ward)
- Contabo VPS + TLS + production secrets
- Backup schedule + restore test
- Clinical + IT sign-off on [`go-live-checklist.md`](./go-live-checklist.md)

---

## Related documents

- [`development-status-directive.md`](./development-status-directive.md) — execution rules
- [`phase1-audit-report.md`](./phase1-audit-report.md) — detailed audit
- [`core-workflow-gap-matrix.md`](./core-workflow-gap-matrix.md) — gap closure criteria
- [`contabo-deployment-guide.pdf`](./contabo-deployment-guide.pdf) — production deploy
