# AfyaSasa Phase 0 — live system discovery, risk audit and hardening plan

**Audit date:** 20 October 2026 (Africa/Nairobi)  
**Nature:** Discovery and documentation only. No production deployment, no production SQL, no schema change plan executed, no commit, no push. Uncommitted application work was **not** overwritten.  
**Audience:** Hospital Director, clinical leads, finance, engineering.

This pack **supersedes status counts** in `docs/audits/afyasasa-departmental-audit/` (15 October 2026, source `507cc02`) for current-state decisions. The October 15 pack remains useful historical evidence and **must not be deleted**.

```
LIVE STACK CHANGED: NO (production not touched)
LIVE DATABASE CHANGED: NO (production not inspected for writes; local COUNT(*) was read-only)
PRODUCTION SQL EXECUTED: NO
PRODUCTION MIGRATIONS APPLIED: NONE
PRODUCTION DEPLOYMENT PERFORMED: NO
COMMITS/PUSHES THIS TASK: NONE
TYPEORM_MIGRATIONS_RUN (local container): false
AFYASASA_ALLOW_DEMO_SEED (local container): false
AFYASASA_CHARGES_ENABLED (local container): true
AFYASASA_LAB_AMENDMENT_ENABLED (local container): false
NODE_ENV (local container): development
```

## Required documentation map

| # | Required document | File |
| --- | --- | --- |
| 1 | Verified current-state report | this README §Executive summary + `01` |
| 2 | Repository and deployment baseline | `01-verified-current-state-and-baseline.md` |
| 3 | Module inventory | `02-module-inventory-and-feature-matrix.md` |
| 4 | Feature verification matrix | `02` |
| 5 | Data model and source-of-truth map | `03-data-model-security-interop.md` |
| 6 | Clinical workflow findings | `02` + `04` |
| 7 | Pharmacy and inventory integrity findings | `02` + `04` |
| 8 | Finance and payment integrity findings | `02` + `03` + `04` |
| 9 | Security and permission findings | `03` + `04` |
| 10 | Interoperability readiness assessment | `03` |
| 11 | Defect and risk register | `04-risk-register-roadmap-and-safety.md` |
| 12 | Prioritised implementation roadmap | `04` |
| 13 | Test and regression strategy | `04` |
| 14 | Migration and deployment safety plan | `04` |
| 15 | User documentation gaps | `04` |
| 16 | Acceptance criteria for each priority correction | `04` |

## Executive summary

AfyaSasa is an existing NestJS (`/api/v1`) + React (no React Router; `frontend/src/App.tsx`) + PostgreSQL EMR for tenant `jalaram`. TypeORM `synchronize` is **false**. Compose pins migrations and demo seed **off**.

**Local source is not a clean committed snapshot.** Branch `main` HEAD is `4a31826e7a5ce3c853b8f63f8c517fd5ec04428e` (`documentation`), tracking `origin/main`, **not ahead**. The working tree has **56 dirty paths** (modified + untracked) covering prescription/clinical-order, inventory strength/form, diagnostic check-in/referral routing, radiology RadWeb URL validation, lab work areas, blood-bank desk, reporting, and navigation. Three **untracked** migrations (`1771000000000`–`0002`) exist. Local PostgreSQL already contains the corresponding columns/indexes (`inventory_items.strength/dosage_form/drug_class`, `clinical_orders.client_request_id`, unique `uq_clinical_orders_client_request_id`, `blood_bank_requests`). **That local schema must not be assumed present in production.**

**Production Contabo was not inspected.** Version, image digest, backups, and hospital-scale census are **unknown**. Local Docker Compose (nginx `:8080`) is healthy. `GET /api/v1/health` returns `{status:ok,service:afyasasa-backend}` **without checking the database**.

**Local database (schema still named `demo`) is a small operational copy, not a production census:** 26 patients, 75 encounters, 21 admissions, 2 inventory items, **0 charges**, 2 completed payment transactions, 66 inventory transactions, 88 305 audit logs, 0 blood-bank requests. `pg_stat_user_tables` live-tuple estimates were **stale/misleading** (charges/payments/inventory estimated 0 even where some rows exist). Do not treat this database as Jalaram production.

**Automated tests (this audit, dirty tree):** `backend/node_modules/.bin/jest --runInBand` — **78 suites passed, 385 tests passed, 20 skipped**. Jest did not exit cleanly (open handles). Tests are unit/integration with isolated DBs; they are **not** logged-in hospital UAT and **not** production reconciliation.

**Highest-risk confirmed issues (evidence in `04`):**

1. **Deployment drift risk (P0):** production version unknown; local images rebuilt from a dirty tree, not from HEAD `4a31826`.
2. **Uncommitted schema ahead of Git (P0 for change control):** local additive SQL/migrations exist; production must not receive them without a reviewed plan.
3. **Financial source-of-truth inconsistency locally (P1):** 0 `charges` vs 2 completed `payment_transactions`; no unique receipt constraint on payments.
4. **Authorisation is OR-of-keys (P1):** `PermissionsGuard` allows any one listed permission; Insurance nav uses `patients:read` only.
5. **Health check does not prove database connectivity (P1).**
6. **External integrations not live-verified (P2):** SHA, FHIR map-on-read, M-Pesa, QuickBooks, KHIS submit, email/SMS.
7. **Blood bank is a thin laboratory request desk in the dirty tree, not a transfusion service (P2).**
8. **Pharmacy catalogue locally has 2 items; strength/form columns exist but are empty until staff PATCH (P1 operational).**

**No broad implementation pass is authorised by this pack.** Wait for review before substantial product changes, commits, migrations, or any production action.

## Classification legend

| Code | Meaning |
| --- | --- |
| **IV** | Implemented and verified in *this* Phase 0 (source + local process/schema/tests as cited) |
| **IPV** | Implemented in source (and often Jest) but not independently UAT’d / not production-verified |
| **PI** | Partially implemented |
| **NI** | Missing |
| **BD** | Blocked by external dependency or policy |
| **RG** | Regression or data-integrity risk |

A screen or API route is never counted as **IV**.
