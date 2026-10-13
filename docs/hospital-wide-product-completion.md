# Hospital-wide product completion — handover

**Date:** 2026-10-13  
**Git branch at inspect:** `main` (do not assume this file is committed)

## Safety

- LIVE STACK CHANGED: **NO**
- LIVE DATABASE CHANGED: **NO**
- PRODUCTION MIGRATIONS APPLIED: **NONE**
- PRODUCTION DEPLOYMENT PERFORMED: **NO**
- FHIR SANDBOX CONNECTED: **NO** — `GET /integrations/fhir/status` reports `connected: false` unless an authorized sandbox test is configured. Env placeholders are empty. No outbound DHA FHIR call is made.
- PRODUCTION EMAIL ENABLED: **NO** (unchanged)

## 1. Requirements-to-implementation matrix

| Requirement | Route / page | Nav | Backend | Tables | Permissions | Data | Tests | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Director operational dashboard | `Director Dashboard` → ReportsHub analytics; `GET /reports/executive-analytics` | Hidden as Reports tab **before**; now first-class nav `reports:read` | `ReportingService.executiveAnalytics` | encounters, patients, admissions, beds, lab_requests, radiology_requests, charges, payment_transactions, sha_eligibility_checks, inventory_batches, quickbooks_sync_queue | `reports:read`; finance KPIs additionally `canViewDirectorFinance` | Persisted aggregations | module-visibility.spec, reporting-metrics | **Partial → complete for available sources.** Pharmacy dispensing totals remain unavailable as a Director rollup. |
| Cashier / centralized billing | `Cashier / Billing` (was Finance) | `payments:initiate` | payments + charges | `charges`, `payment_transactions` | initiate / manage | Operational ledger, not QuickBooks GL | payment-integrity.spec | **Complete** for collect / statement / reprint / refund / cashier summary. Shift close already existed. Split tenders: sequential allocations to a charge, not multi-tender in one POST. |
| Insurance / SHA | `Insurance & Claims` | `patients:read` | `/insurance/*`, `/sha/*` | sha_eligibility_checks; overlay `clinical_catalog.insuranceWorkspace` | read / manage | Eligibility persisted; claims are **operational drafts** | insurance-lifecycle.spec | **Partial.** SHA claims remain on portal.sha.go.ke. `submitted_manual` requires a portal reference. |
| DHA / Kenya FHIR | `Interoperability` | `settings:manage` | `/integrations/fhir/*` | maps patients, encounters | settings / patients / encounters | Canonical EMR rows | fhir-mapper.spec | **Partial.** Mapping + synthetic validation. Sandbox **not connected**. eClaims IG is draft. |
| Navigation / roles | sidebar | permission + module filter | PermissionsGuard OR | roles / permissions | per item | JWT | module-visibility.spec | **Complete** for new items. Hidden menu is not the control. |
| Journeys A–F | — | — | — | — | — | Isolated tests only | unit specs | **Not browser-run in this pass.** No isolated PG reset against production. |

Situation classes used above: Director was (2) hidden in Reports; cashier was (2) labelled Finance; FHIR was (1) missing; SHA claims were (1) as in-app lifecycle.

## 2. Director metric definitions

See also `docs/AFYASASA_DASHBOARD_METRIC_DEFINITIONS.md`. Additions:

| Metric | Source | Date basis | Definition |
| --- | --- | --- | --- |
| Payments received | `payment_transactions` | `created_at` | `SUM(amount)` where `status=completed` and `metadata.kind <> refund` |
| Refunds | same | `created_at` | `SUM(amount)` where `metadata.kind = refund` |
| Unmatched payments | same | range | completed, `charge_id IS NULL`, not refund |
| Payer mix | same | range | cash/card/mpesa/qb = patientPayments; method=insurance = insuranceRecorded (**not remittance**) |
| Returning OPD | `encounters` | `started_at` | distinct patients with OPD in range who have an earlier encounter |
| Avg OPD wait | `encounters` | now | AVG minutes for OPD `registered`/`triaged` |
| Lab TAT | `lab_requests` | verified-created | hours where `verified_at` present |
| Expiry-risk batches | `inventory_batches` | query time | qty>0 and expiry ≤ 30 days |
| Failed integrations | `quickbooks_sync_queue` | query time | `status=failed` |

Refresh: React Query poll 20s. Explicitly **not real-time**. `refresh.realtime=false`.

## 3. Cashier model

- Charges remain `demo.charges`. Payments remain `demo.payment_transactions`.
- Collection POST `/payments/manual` with `idempotencyKey`.
- Refund POST `/payments/:id/refund` inserts a **new** completed row `metadata.kind=refund` and restores `amount_paid`. Original row is kept.
- Statement GET `/payments/patients/:id/statement`.
- Cashier summary GET `/payments/cashier/summary`.
- QuickBooks remains GL. Collections are not labelled revenue.

## 4. Insurance / claimant states

Implemented transitions in `insurance-lifecycle.ts`. Overlay storage until planned SQL is approved. Eligibility is not coverage proof. Unapproved insurer share is not a guaranteed receivable.

## 5. FHIR

- Kenya Core IG **v1.0.0**, FHIR R4 **4.0.1**, eClaims IG **draft**.
- Profiles listed in `kenya-core.ts`.
- Synthetic Patient validation only. No invented sandbox success.

## 6. Navigation / permission matrix

| Module | Menu | Route access | API | Dept scope |
| --- | --- | --- | --- | --- |
| Director Dashboard | `reports:read` | same | `/reports/executive-analytics` | hospital schema via tenant ALS |
| Cashier / Billing | `payments:initiate` | same | payments:* | same |
| Insurance & Claims | `patients:read` | same | `/insurance/workspace` OR of patients:read, payments:read, payments:initiate | same |
| Interoperability | `settings:manage` | same | `/integrations/fhir/status` OR settings:manage, reports:read | same |
| Refund | not a menu | — | `payments:manage` | — |

## 7. Files changed (why)

Director nav + aggregations; cashier statement/refund/idempotency; insurance overlay workspace; FHIR mapper/workspace; tests; planned SQL (not applied); this handover.

## 8. Migrations

`backend/src/database/sql/planned/20261013_insurance_claim_workspace.sql` — **not applied**. Overlay used instead.

## 9. Test commands

```bash
cd backend && ./node_modules/.bin/jest --testPathPatterns='payment-integrity|insurance-lifecycle|fhir-mapper|module-visibility' --runInBand
cd backend && npm run build
cd frontend && npx tsc -b --pretty false
```

## 10. Remaining blockers

- SHA eClaims / remittance API pack not connected; portal remains source of claim submission.
- Kenya eClaims IG is draft; mappings will need revision.
- DHA FHIR sandbox credentials not present.
- M-Pesa STK body is unsigned (existing).
- Unique payment `external_reference` SQL still planned, not applied.
- Split tender in a single request is sequential only.
- Benefit limits / contracted rates need hospital-approved catalogues.
- Browser E2E journeys A–F need an isolated synthetic database proof before reset/seed.
- Charges unique index live-apply state unknown.

## 11. Synthetic UAT

Unit fixtures only. No production data touched.

## 12. Git

Uncommitted local work. Not committed or pushed unless requested.
