# AfyaSasa Director, marketing, billing, and error hardening

Inspect-first audit of the live Jalaram AfyaSasa EMR. No second patient, encounter, admission, charge, payment, inventory, lab, billing, ledger, or reporting database was created.

Live backup referenced: `backups/afyasasa-20261002-115248.sql`.

## Existing architecture

WORKING. NestJS API (`/api/v1`) + React frontend + PostgreSQL schema `demo` + Redis/BullMQ + MinIO + nginx. TypeORM `synchronize: false`, `TYPEORM_MIGRATIONS_RUN=false`. JWT + refresh cookie. Canonical clinical tables already hold live patients, encounters, admissions, lab, radiology, theatre, pharmacy/inventory, and two payments.

## Existing database tables and relationships

WORKING. Canonical identities:

- `demo.patients` ← encounters, admissions, charges, payments, lab/radiology requests
- `demo.encounters` ← OPD/clinical visit; optional attending doctor
- `demo.admissions` → patient, encounter, bed, ward
- `demo.charges` → patient, optional encounter; `service_line` + `service_entity_id`
- `demo.payment_transactions` → patient, optional encounter/lab/charge
- `demo.marketing_visits` → owner user (field outreach activities)
- Audit: `demo.audit_logs` (paginated admin API)

Do not create alternatives.

## Existing indexes and constraints

WORKING / NEEDS HARDENING.

- Patients: unique `patient_no`; name index. National ID is not uniquely constrained — BUSINESS DECISION REQUIRED before adding one (historical duplicates possible).
- Admissions: unique `admission_no`; status index. Beds unique `(ward, bed_no)`.
- Charges: index `(status, service_line)`. No unique `(service_line, service_entity_id)`. Application idempotency exists. Planned SQL (not applied): `backend/src/database/sql/planned/20261002_charges_service_entity_unique.sql`.
- Marketing visits: indexes on activity date, facility, location, outcome, follow-up date.
- Open OPD-per-day is enforced in `OpdService`, not as a DB unique constraint (historical records must remain).

## Existing dashboard and reporting endpoints

WORKING. Reused; no new reporting database.

| Endpoint | Permission | Role |
| --- | --- | --- |
| `GET /reports/dashboard` | `reports:read` | Snapshot counts |
| `GET /reports/operations` | `reports:read` | Operations command center |
| `GET /reports/executive-analytics` | `reports:read` | Director range analytics |
| `GET /reports/intelligence` | `reports:read` | Prior-period findings |
| `GET /reports/moh-705a/b`, `706`, `717` | `reports:read` | MOH generation |
| Department reports | `reports:read` | OPD/IPD/lab/theatre/maternity/ICU |

NEEDS HARDENING (done in this pass): finance fields on executive/operations/intelligence are stripped unless the actor is director/administrator/superadmin or has `payments:read` / `settings:manage`. Doctors with only `reports:read` no longer receive charge/payment totals.

## Existing charge and payment endpoints

WORKING. `PaymentsController` + `AccommodationChargeService.upsertServiceCharge` + pharmacy upsert. `AFYASASA_CHARGES_ENABLED=true`. Catalogue prices live in `public.settings.clinical_catalog` and clinic consultation fees — not invented in code.

Live: **0 charge rows**, **2 payments**. Payments stay on `payment_transactions`. Duplicate submit blocked by 2-minute matching payment check. No silent refund/delete path.

## Patient-account logic

WORKING / NEEDS HARDENING. Account = sum of charges owed/paid/waived plus listed payments. Cashier desk reads charges + payments. Outstanding on Director is charge-based, not a second ledger.

## Audit logic

WORKING. `AuditInterceptor` + `GET /admin/audit-logs` with pagination. Do not create a second audit system. Request ID is now also on API errors.

## Marketing functionality

WORKING as field outreach (`demo.marketing_visits` used as activities). Permissions `marketing:read/create/update/delete/manage/reports`. Dashboard today/week/month. Team report by staff/location/service.

MISSING as patient-acquisition CRM: no enquiry→appointment→patient foreign keys. BUSINESS DECISION REQUIRED before adding `marketing_enquiries`. This pass reuses visits and reports `Insufficient attribution data` instead of inventing conversion rates.

Controlled source vocabulary is now published (Google, Website, WhatsApp, Facebook, Instagram, TikTok, Referral, Existing patient, Walk-in, Other) but historical patients are not back-attributed.

## Notification functionality

BLOCKED EXTERNALLY. SMTP_HOST empty. SMS provider/placeholders not proven. Public forgot-password remains anti-enumeration. Admin temporary-password reset works without email.

## Error handling (before)

NEEDS HARDENING. Nest default `{statusCode,message,error}`. No global `ExceptionFilter`. Frontend `apiRequest` had status mapping but no timeout, no request ID, no envelope.

## Frontend loading/error states (before)

NEEDS HARDENING. Executive analytics had skeleton + error text. Operations had skeleton but no retry. Marketing dashboard already had retry. Several mutations already use `loading={isPending}`.

## Transaction boundaries

NEEDS HARDENING in places; WORKING for payment charge apply + recent duplicate guard. Multi-step clinical writes should remain transactional in their services. External STK/QuickBooks stay out of open DB transactions (pending/completed/failed statuses).

## Background jobs

WORKING. BullMQ + accommodation charge scheduler (no-op when charges disabled or no priced stay).

## Caching

NEEDS HARDENING. React Query had no global defaults. This pass: 15s staleTime for reads; mutations never retry; payments/charges `staleTime: 0`. Do not cache permissions or identity.

## N+1 / inefficient queries

NEEDS HARDENING (addressed for Director). `executiveAnalytics` previously `find({ take: 5000 })` then counted in JS, and finance `find({ take: 2000 })`. Replaced with `COUNT` / `SUM` / `GROUP BY`. Department export reports still load up to 1000 rows for CSV — acceptable for current volume, not for Director cards.

## Race conditions

NEEDS HARDENING. Charge idempotency is application-level. Planned unique index not applied. Payment 2-minute duplicate window is a debounce, not a durable idempotency key. BUSINESS DECISION REQUIRED for a client-supplied idempotency key.

## Missing validation / authorization

NEEDS HARDENING. Financial Director totals were available to any `reports:read` holder. Tightened as above. Marketing owner spoofing already blocked in service tests.

## Missing indexes

Documented. Add only the planned charges unique index after authorization. Do not index every column.

## Orphan-record risks

NEEDS HARDENING. FKs exist for patient/encounter on charges/payments. Historical rows must not be deleted to “fix” orphans. Use reversal/adjustment if a paid charge is wrong — refund path is not silently implemented.

## Charge flow (canonical)

```
Patient / Encounter / Admission
  → priced service from existing catalogue (clinic fee, labTestPricing, inventory sell, theatre when completed+priced)
  → demo.charges (idempotent on service_line + service_entity_id)
  → patient outstanding
  → demo.payment_transactions
  → receipt / QuickBooks queue (not a second GL)
```

KSh 0 is not billable. Do not auto-charge a clinical event unless a priced catalogue rule already exists.

### Clinical event → charge (current rules)

| Event | Charge? | Status |
| --- | --- | --- |
| OPD check-in | Only if clinic consultation fee > 0 and charge path invoked | BUSINESS DECISION if reception should always post |
| Triage / consult note | No | WORKING |
| Lab request | Yes when catalogue price > 0 | WORKING |
| Radiology request | Yes when priced | WORKING |
| Theatre completed | Yes when priced | WORKING |
| Pharmacy dispense | Yes, amount delta on order | WORKING |
| IPD accommodation | Yes when nightly rate exists | WORKING / scheduler |
| Emergency / maternity / ICU event alone | No automatic charge | BUSINESS DECISION REQUIRED |

## Classification summary

| Area | Class |
| --- | --- |
| Clinical workflows (OPD, lab, rad, theatre, IPD, maternity, ICU/HDU, pharmacy) | WORKING |
| MOH 705A/B, 706, 717 generation | WORKING |
| Director analytics endpoints | WORKING / hardened |
| Payments table + duplicate debounce | WORKING |
| Charge table + catalogue | WORKING, 0 live rows |
| QuickBooks GL | BLOCKED EXTERNALLY / Accounting integration pending |
| SHA/DHA | BLOCKED EXTERNALLY |
| SMTP / SMS | BLOCKED EXTERNALLY |
| DigitalPersona HID SDK | BLOCKED EXTERNALLY / NOT VERIFIED |
| Marketing visits | WORKING |
| Enquiry→patient attribution | MISSING / BUSINESS DECISION |
| Global error envelope | NEEDS HARDENING → implemented |
| Frontend timeout/retry | NEEDS HARDENING → implemented |
| Unique charge DB index | NEEDS HARDENING → planned, not applied |
| Patient national-id uniqueness | BUSINESS DECISION REQUIRED |

## Schema change plan (not applied)

1. Optional unique partial index on `demo.charges (service_line, service_entity_id)` for active statuses. File: `backend/src/database/sql/planned/20261002_charges_service_entity_unique.sql`. Reason: durable idempotency. Production apply: no.
2. No `marketing_enquiries` table. Reuse `marketing_visits` until the hospital authorizes a new acquisition model.

## Metric definitions

See `docs/AFYASASA_DASHBOARD_METRIC_DEFINITIONS.md`.
