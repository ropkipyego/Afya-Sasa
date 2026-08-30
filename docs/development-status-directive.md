# AfyaSasa — Development Status & Execution Directive

**Effective:** 2026-08-29  
**Status:** Active engineering directive for all Cursor sessions  
**Principle:** The repository is the source of truth — percentages in this document are estimates only.

---

## Purpose

This document establishes the current development baseline for AfyaSasa and defines how engineering must proceed from this point forward.

AfyaSasa is **no longer in the initial module-building phase**. The system has broad coverage across the hospital. The primary engineering objective is now:

> **CORE WORKFLOW STABILIZATION → END-TO-END VALIDATION → SPECIALTY HARDENING → INTEROPERABILITY → PRODUCTION READINESS**

This is **not** permission to build additional modules unnecessarily.

---

## Current baseline (estimates)

| Milestone | Estimate |
|-----------|----------|
| Jalaram supervised pilot | ~70% |
| Full hospital production go-live | ~55–60% |

See [`development-progress.md`](./development-progress.md) for layer/module breakdown and evidence links.

---

## Development freeze

Until core workflows are validated, **do not**:

- Add new major modules
- Expand the feature list unnecessarily
- Build duplicate workflows or inventory engines
- Rebuild working modules from scratch
- Implement fake SHA APIs
- Add cosmetic UI while workflow bugs remain
- Spend significant time on multi-tenancy
- Declare workflows complete because screens exist

---

## Definition of "done"

A workflow is complete only when the full chain works:

```text
USER ACTION → FRONTEND → API → DATABASE → DOMAIN STATE
    → NEXT WORKFLOW → USER NOTIFICATION → AUDIT → PATIENT TIMELINE
```

Not done because: page loads, button works, modal opens, HTTP 200, or temporary UI data.

---

## Execution order

| Phase | Focus | Doc |
|-------|-------|-----|
| **1 — Audit** | Map workflows, gaps, bugs — no major code changes | [`phase1-audit-report.md`](./phase1-audit-report.md) |
| **2 — P0 fixes** | Patient identity, encounter lifecycle, OPD, lab, radiology, timeline, audit | [`core-workflow-gap-matrix.md`](./core-workflow-gap-matrix.md) |
| **3 — P1 operations** | Pharmacy, main store, ledger, requisitions, transfers, IPD, notifications | [`inventory-architecture.md`](./inventory-architecture.md) |
| **4 — P2 specialty** | ED, maternity, theatre, ICU/HDU validation | [`core-workflow-test-plan.md`](./core-workflow-test-plan.md) |
| **5 — P3 interoperability** | External identifiers, integration layer, SHA/HIE, FHIR adapter | [`sha-integration-architecture.md`](./sha-integration-architecture.md) |
| **6 — P4 production** | VPS, TLS, backups, security review, UAT, go-live | [`contabo-deployment-guide.pdf`](./contabo-deployment-guide.pdf) |

---

## Required documentation (maintain, do not duplicate)

| Document | Purpose |
|----------|---------|
| `docs/core-workflow-map.md` | Existing implementation vs required flows |
| `docs/core-workflow-gap-matrix.md` | Gap status with evidence rules |
| `docs/inventory-architecture.md` | Single inventory engine, pharmacy vs main store |
| `docs/sha-integration-architecture.md` | SHA/HIE boundary (capture only today) |
| `docs/core-workflow-test-plan.md` | Acceptance tests and automated scripts |
| `docs/development-progress.md` | Layer/module progress with repo evidence |
| `docs/phase1-audit-report.md` | Audit findings and known bugs |

---

## Required report after each implementation phase

Every phase completion must document:

1. **Changed** — files changed  
2. **Database** — migrations/schema  
3. **Backend** — APIs/services  
4. **Frontend** — screens/components  
5. **Tests** — added/passed/failed  
6. **Workflow** — exact workflow tested end-to-end  
7. **Remaining** — known limitations  
8. **Risk** — clinical, security, data-integrity, deployment  

---

## Final rule

The objective is **not** to make AfyaSasa look like it has more modules.

The objective is to **make AfyaSasa behave like one coherent hospital information system** — one continuous clinical workflow, with correctness, persistence, data integrity, auditability, and usability over feature count.

Do not declare production readiness without evidence.
