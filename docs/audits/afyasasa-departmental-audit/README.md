# AfyaSasa departmental functionality audit

**Audit date:** 15 October 2026 (Africa/Nairobi)  
**Nature:** Read-only inspection and documentation. No application, database, deployment, or configuration changes.

**Audience:** Hospital Director, department heads, and engineering.

## Executive summary

AfyaSasa is an operational Jalaram Hospital EMR (NestJS + React + PostgreSQL). Staff report that **OPD runs efficiently** and **prescriptions generally work**, with **a few drug-dispensing issues still needing investigation**. This audit treats those statements as **user-reported operational evidence**, not as a completed test programme.

This inspection of **source at `507cc02`** found a full departmental surface: Front Office, OPD, IPD (including ICU/HDU/nursing), Diagnostics (lab and radiology), Emergency, Theatre, Maternity, Pharmacy, Store/Procurement, Finance, Documents/Reports, Marketing, Director analytics, and Hospital Control Center. **Blood bank is not implemented.** SHA, FHIR, M-Pesa, QuickBooks, email, SMS, and biometrics exist at different maturity levels; none were live end-to-end verified in this audit.

**Highest-priority follow-up:** authorised, non-destructive investigation of pharmacy dispensing (user-reported, not independently reproduced here), plus keeping inventory/billing integrity work from commit `507cc02` aligned with the **running local images**, which were built **before** that commit.

## Scope and methodology

1. Git identity, architecture, navigation, backend modules, and controllers were inspected in the repository.
2. Existing docs were used only as pointers. Stale claims (for example `docs/core-workflow-gap-matrix.md` dated 2026-08-28) were **not** copied as current truth.
3. Local compose health was observed read-only. Production Contabo version was **not** established.
4. Jest was **not** re-executed in this audit. Last captured run is dated 14 Oct 2026 17:20 EAT on a dirty tree that was then committed as `507cc02`.
5. No patient records were opened. No dispense, payment, email, SMS, or SHA call was made.
6. Status uses the model in §6 of the request. A screen or endpoint is not treated as a working workflow.

## Evidence standards

| Claim type | Allowed evidence |
| --- | --- |
| Source exists | File path, class, `@Controller` route |
| Automated test | Named spec + dated command log |
| Running local stack | `docker ps`, `/api/v1/health` this audit |
| Production | Not available this audit |
| Staff operations | User-reported only, labelled as such |

## Repository baseline

| Item | Value |
| --- | --- |
| Location | `/home/yobra/Desktop/Afya-Sasa-1/Afya-Sasa` |
| Identity | AfyaSasa Clinical EMR, tenant code `jalaram`, TypeORM schema still named `demo` |
| Branch | `main` tracking `origin/main` (0 ahead, 0 behind) |
| HEAD | `507cc02c067f8b6b59c0bb84a923425927015cb2` — *drugs changes....* — 2026-10-14 17:25:03 +0300 |
| Working tree | **Clean** at audit start |
| Parent | `a75c2e4` *Last Changes* |
| API prefix | `/api/v1` (`backend/src/main.ts`) |
| Auth | JWT access + refresh cookie; global `JwtAccessGuard` + `PermissionsGuard` (OR of listed keys) |

## Local vs production

| Environment | Evidence this audit |
| --- | --- |
| Source | HEAD `507cc02` |
| Local compose | Containers healthy (frontend, backend, nginx, postgres, redis, minio). Backend `/api/v1/health` → `{"status":"ok","service":"afyasasa-backend"}` |
| Local image age | Backend/frontend images created **2026-10-14 08:39 UTC (11:39 EAT)** — **before** `507cc02` (17:25 EAT). Running local UI/API **do not** necessarily include the inventory/billing commit |
| Production | **Not established.** No production host, image SHA, or database version inspected |

## Feature count method

A **feature** is one row in `02-feature-status-matrix.md`: a distinct staff capability with a named screen and/or API. Count = **102** (F01–F92 departmental + S01–S10 platform/security/integrations). Status totals are in that file and repeated in the completion summary.

**Give this to the Director / non-IT readers:** [AfyaSasa-Hospital-Leadership-Report.pdf](./AfyaSasa-Hospital-Leadership-Report.pdf) — plain language, department by department, simple scores out of 10.

IT annex (same facts, technical): [AfyaSasa-Departmental-Readiness-Report.pdf](./AfyaSasa-Departmental-Readiness-Report.pdf)

## Document index

| File | Contents |
| --- | --- |
| [01-department-inventory.md](./01-department-inventory.md) | Departments, submodules, nav, APIs |
| [02-feature-status-matrix.md](./02-feature-status-matrix.md) | Feature-by-feature status |
| [03-workflow-flowcharts.md](./03-workflow-flowcharts.md) | Implemented workflows (Mermaid) |
| [04-opd-and-pharmacy-assessment.md](./04-opd-and-pharmacy-assessment.md) | OPD, Rx lifecycle, dispensing investigation |
| [05-diagnostics-and-clinical-services.md](./05-diagnostics-and-clinical-services.md) | Lab, radiology, ED, IPD, theatre, maternity |
| [06-finance-inventory-and-procurement.md](./06-finance-inventory-and-procurement.md) | Charges, payments, store, QB |
| [07-security-integrations-and-reporting.md](./07-security-integrations-and-reporting.md) | RBAC, audit, SHA/FHIR/email, Director metrics |
| [08-defects-risks-and-prioritized-roadmap.md](./08-defects-risks-and-prioritized-roadmap.md) | P0–P3, phases |
| [09-evidence-and-verification-log.md](./09-evidence-and-verification-log.md) | Paths, tests, limitations |

## Confirmation

No application code, database, migration, seed, container restart, deploy, commit, or push was performed for this audit. Documentation only under `docs/audits/afyasasa-departmental-audit/`.
