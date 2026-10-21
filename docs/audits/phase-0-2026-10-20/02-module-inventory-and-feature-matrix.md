# 3–4, 6–8. Module inventory, feature matrix, clinical / pharmacy / finance findings

**Date:** 20 October 2026  
**Evidence classes:** source (S), Jest this audit (J: 385 passed / 20 skipped), local DB COUNT (D), local HTTP health (H), production (P: **none**), staff report (R: historical, not re-collected this Phase 0).

Status codes: **IV / IPV / PI / NI / BD / RG** — see pack README.

**N = 20 modules** below. Sub-features nested. Totals at the end are **module-level**, not the 102-row October 15 F-matrix (that matrix is historical).

---

## 1. Authentication, authorisation, tenant isolation

| Item | Status | Evidence |
| --- | --- | --- |
| JWT login / refresh / session policy | IPV | S `core/auth`; J `auth.service.spec`, `session-policy.spec`, `access-token-revocation.spec`, `mfa-otp.spec` |
| MFA OTP | PI | J exists; live MFA not verified; typically flag-gated |
| PermissionsGuard | RG | S: `required.some(...)` — **OR** of keys (`auth.guards.ts`) |
| Tenant middleware | IPV | S `TenantMiddleware`; J `tenant-bind.spec`; production isolation **P none** |
| Hidden UI as auth | RG | Insurance nav permission `patients:read` (`navigation.ts`) |

**Workflow:** login wall → JWT → `PermissionsGuard` + tenant bind.  
**Verified this audit:** none of login (credentials not used in this discovery). Health is `@Public()`.  
**Risk:** OR-semantics over-grants if handlers list mixed keys; UI hide ≠ server deny.

**Correction (needs approval):** AND-semantics or split handlers; tighten Insurance to a claims permission; permission tests per route.

---

## 2. Front office, registration, patient identity

| Item | Status | Evidence |
| --- | --- | --- |
| Register / registry / search | IPV | S patients module; J `patients.service.spec`, `patient.rules.spec`; D 26 patients |
| Biometrics | PI | S `BiometricModule`; J `biometric.service.spec`; live capture **P none** |
| Duplicate detection | IPV | J patient rules; not UAT’d this audit |

**UI:** Register Patient, Patient Registry, Identify Patient.  
**SoT:** `demo.patients` (+ biometric tables). Do not add a second patient table for SHA.

---

## 3. OPD and encounter management

| Item | Status | Evidence |
| --- | --- | --- |
| Check-in / encounters / queues | IPV | S Opd + VisitQueue; J `opd.service.spec`, `visit-queue.service.spec`; D 75 encounters, 2 queue items |
| Diagnostic-only visit routing | IPV (dirty tree) | S untracked `visit-routing.ts` + spec; intended to keep lab/rad visits off doctor queue when rules allow |
| Historical “OPD satisfactory” | R only | Staff report from prior audit; **not re-verified** |

**Preserve working OPD.** Dirty-tree routing/referral packing must be regression-tested before merge; do not “fix” OPD by rewrite.

**UI:** OPD Check-In, Triage Queue, Doctor Queue, All Queues.

---

## 4. Clinical documentation and diagnoses

| Item | Status | Evidence |
| --- | --- | --- |
| Encounter notes / diagnosis capture | IPV | S OPD entities/services; depth of coded ICD vs free text **not fully mapped this pass** |
| Structured terminology for HIE | PI | Needed for SHA/FHIR; local mapping exists in FHIR mapper tests |

---

## 5. Prescribing and medication orders

| Item | Status | Evidence |
| --- | --- | --- |
| Clinical orders as prescription vehicle | IPV | S `clinical-order`; J `pharmacy-prescription.spec`, `clinical-order-mirror.spec`, `prescription-quantity.spec`; D 25 orders |
| Exact catalogue `itemId` (no guess) | IPV (dirty) | Prior Phase A intent in inventory/clinical-order diffs |
| Strength/form on catalogue | PI | Columns exist locally; values empty until PATCH; 2 items in D |
| Client request idempotency | IPV local / RG prod | Unique index **local D**; untracked migration; production unknown |
| Quantity suggestion | PI | Countable oral OD/BD/TDS/QDS only; **must not invent dosing** |

**UI:** Prescription form (dirty), Pharmacy queue.  
**SoT:** `clinical_orders` (+ JSON metadata); inventory item FK. Mirror into pharmacy worklists — inspect `clinical-order-mirror.service.ts` before changing.

---

## 6. Pharmacy inventory and dispensing

| Item | Status | Evidence |
| --- | --- | --- |
| Dispense + stock movement + charge in one transaction (507cc02 lineage) | IPV | S inventory service; J `inventory.service.spec`, `stock-posting.spec`, `stock-integrity.spec`, `inventory-pg.integration.spec` |
| FEFO | IPV | Tests in inventory specs; not UAT’d on hospital lots |
| Available stock | IPV | J; local D 2 items / 13 batches / 66 txns — **tiny catalogue** |
| OTC / sales / stock take / products | IPV | UI nav exists; J some inventory; **no logged-in UAT** |
| Returns / adjustments | IPV | Source paths exist historically; not re-traced line-by-line this Phase 0 |
| Blood products as pharmacy lots | NI (correct) | Must remain laboratory/blood-bank, not FEFO drug lots |

**RG:** A dispense that posts stock without a charge (or the reverse) is the integrity failure 507cc02 targeted. Local D shows **0 charges** despite inventory transactions and 2 payments — **this local DB does not currently reconcile**. Whether production matches is **unknown**.

**Recommended:** authorised read-only production reconciliation of `inventory_transactions` vs `charges` vs `payment_transactions` **after** backup confirmation. No silent overwrite of posted finance.

---

## 7. Laboratory

| Item | Status | Evidence |
| --- | --- | --- |
| Requests, lifecycle, results safety | IPV | S laboratory; J lab-lifecycle, results-safety, access, permissions, integrity, pg integration, barcode, report builder |
| Queue stages / work areas | IPV (dirty) | `lab-work-areas.ts` + LabWorklist/LabModule |
| Amendment | BD | `AFYASASA_LAB_AMENDMENT_ENABLED=false` |
| Diagnostic check-in arrivals | IPV (dirty) | `DiagnosticCheckInArrivals.tsx` + visit routing |
| Do not fabricate results | — | Policy; no result seeding this audit |

**SoT:** `lab_requests` (+ results/attachments entities). Distinct from `visit_queue_items` and `clinical_orders`.

---

## 8. Imaging / radiology

| Item | Status | Evidence |
| --- | --- | --- |
| Requests, reports, access | IPV | S radiology; J lifecycle + access; D 9 requests |
| RadWeb/image URL validation | IPV (dirty) | `radweb-image-url.ts` + spec |
| Shift handover UI | PI | `ImagingShiftHandover.tsx` untracked; operational depth unverified |
| PACS | BD/PI | Attachments/URL refs in EMR; no evidence of certified PACS |

**Preserve diagnostic-only visits** when existing rules permit (dirty `visit-routing`).

---

## 9. IPD, admissions, inpatient

| Item | Status | Evidence |
| --- | --- | --- |
| Wards, admit, occupancy | IPV | S inpatient; J `inpatient.service.spec`, `bed-occupancy.spec`; D 21 admissions |
| Nursing vitals / MAR | IPV | S nursing; J `nursing.mar.spec` — MAR **not** stock deduction |
| ICU / HDU | IPV | Modules present; not UAT’d |

---

## 10. Emergency

| Item | Status | Evidence |
| --- | --- | --- |
| ED register / triage | IPV | S emergency; J `emergency.service.spec` |
| Linkage to OPD encounter | PI | Historically separate workflow; disposition UAT missing |

---

## 11. Theatre, maternity, other specialty

| Item | Status | Evidence |
| --- | --- | --- |
| Theatre bookings/notes | IPV | J theatre specs |
| Maternity ANC/labour/delivery | IPV | S maternity; limited Jest vs UI depth |
| Newborn → patient | RG | Duplicate-patient risk if misused (prior audit) |

---

## 12. Inventory, procurement, transfers

| Item | Status | Evidence |
| --- | --- | --- |
| Receipts, requisitions, transfers | IPV | J inventory-pg + stock-posting |
| Unique batch / import-session constraints | PI | Prior audit: planned SQL not fully applied; local indexes still lack unique batch key |
| Integrity panel | IPV | API exists historically; login not done this Phase 0 |

---

## 13. Charges and billing

| Item | Status | Evidence |
| --- | --- | --- |
| Charge entity + catalogue | IPV | S `charge.entities.ts`, payments; J `hospital-charges.spec`, `charge.entities.spec` |
| Unique active charge per service | IPV local | D `uq_charges_service_entity_active`; **0 charge rows** |
| Pharmacy upsert charge with dispense | IPV code / RG data | Code lineage 507cc02; local data **does not demonstrate** posted charges |
| Check-in auto consult charge | PI | Prior: not automatic |

**SoT for billed services:** `demo.charges`. Do not add a second charges table.

---

## 14. Payments, refunds, waivers, allocations

| Item | Status | Evidence |
| --- | --- | --- |
| Manual payments | IPV | J `payments.service.spec`, `payment-integrity.spec` |
| Status model | IPV | pending / initiated / completed / failed / cancelled (prior inspection) |
| M-Pesa STK + callback | PI + BD | J callback specs; live STK **not** claimed |
| Refund | IPV | route exists historically; UAT missing |
| Unique receipt / payment idempotency at DB | NI/RG | D: no unique payment index beyond pkey |
| Posted payment vs request | — | Do not treat STK initiate as completed |

**SoT:** `demo.payment_transactions`. Local **2 completed payments and 0 charges** is a reconciliation defect **on this database**.

---

## 15. Accounting and financial reporting

| Item | Status | Evidence |
| --- | --- | --- |
| In-EMR GL | NI as a full ledger | Do not invent one |
| QuickBooks queue / web connector | PI + BD | J `quickbooks-webconnector.service.spec`; credentials “not configured” in Jest logs this run |
| Executive finance slices | IPV/RG | S `reporting.service.ts` `chargesByServiceLine`; **not certified** against 0 local charges |

---

## 16. Executive and operational reporting

| Item | Status | Evidence |
| --- | --- | --- |
| Executive analytics API/UI | IPV | J `reporting-metrics.spec`, `analytics-intelligence.spec`, `department-revenue.spec`; dirty `reporting.service.ts` + dashboard |
| MOH/KHIS mapping | PI + BD | J `moh-mapping.spec`; submit not operational |
| Pharmacy KPI on director pack | PI | Prior gap; dirty reporting may add fields — **do not certify accuracy** |

**Metric rule:** every dashboard number needs definition, source table, inclusion/exclusion, period, tenant scope, reconciliation. This audit **does not certify** dashboard accuracy.

---

## 17. User administration and audit

| Item | Status | Evidence |
| --- | --- | --- |
| Users/roles/templates | IPV | S admin; J role-templates, superadmin-policy |
| HTTP audit interceptor | IPV | J `audit.interceptor.spec`; D 88 305 `audit_logs` |
| Entity-level before/after snapshots | PI | HTTP mutations, not full row snapshots |

---

## 18. Documents and staff-facing documentation

| Item | Status | Evidence |
| --- | --- | --- |
| Medical documents / library | IPV | S documents module |
| User manuals vs actual dirty UI | RG | Docs lag dirty navigation (Blood Bank, diagnostic check-in, shift handover) |

---

## 19. APIs, integrations, interoperability

See `03` for SHA/DHA/HIE. Module status: **PI + BD**. Endpoints exist; **no live SHA/DHA/M-Pesa/QB success claimed**.

---

## 20. Backup, recovery, monitoring, deployment

| Item | Status | Evidence |
| --- | --- | --- |
| Local backup script | IPV | `ops/backup-postgres.sh` (`pg_dump --clean --if-exists`) |
| Restore | IPV/RG | Restore is destructive by nature; **must not** be run against production without authorisation |
| Health monitoring | PI | Process health only; **no DB ping** |
| Production backups | BD | P none |
| `npm run deploy:prod` | — | Exists; **must not be run** without reviewed plan |

---

## Module-level scoreboard (recalculated 20 Oct 2026)

| Status | Count | Modules |
| --- | --- | --- |
| IV (this audit, full workflow) | **0** | Health/flags/schema/Jest are platform facts, not clinical IV |
| IPV | **14** | 2, 3, 5, 7, 8, 9, 10, 11, 12, 13, 16, 17, 18, plus prescribing/pharmacy overlapping 5–6 |
| Mixed IPV + RG/PI | **5** | 1 (auth OR), 4 (docs/HIE), 6 (pharmacy data), 14 (payments), 15 (accounting) |
| PI + BD | **1** | 19 integrations |
| Platform PI | **1** | 20 monitoring/backups (counted separately) |

These are **not** comparable 1:1 to the October 15 “102 features / 88 IPV” table. Recalculation used **modules + evidence this audit**.

## High-risk workflow verdicts

### A. Patient and encounter integrity

**IPV** locally (small N). Duplicate detection not UAT’d. Tenant isolation tested in unit specs only. **Preserve existing patient/encounter model.**

### B. Pharmacy

**Code IPV / data RG on local DB.** Transactional dispense+charge must be proven on a dataset that actually has charges. Catalogue ambiguity: **do not guess** product when `itemId` missing. Strength/form empty until filled.

### C. Laboratory

**IPV** in Jest. Amendment **BD**. No fabricated results. Queue eligibility = dirty work-area logic + visit tokens — needs UAT after merge.

### D. Imaging

**IPV** in Jest + dirty RadWeb URL helper. Diagnostic-only visits: keep existing business rules.

### E. Charges and payments

**RG on local data.** SoT: `charges` + `payment_transactions`. Failed payment ≠ completed. Posted records require auditable reversal, not overwrite. No new payment table or GL.

### F. Reporting

**IPV tests, uncertified numbers.** Trace `reporting.service.ts` aggregations before trusting Director Dashboard.

### G. Security

**RG:** OR permissions, public health without DB, Insurance `patients:read`, no production auth review. Hidden nav is not authorisation.
