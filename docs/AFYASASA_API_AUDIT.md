# AfyaSasa API audit

Inspection date: 2 October 2026.  
Prefix: `/api/v1`.  
Global guards: `JwtAccessGuard` + `PermissionsGuard` unless `@Public()`.  
Audit interceptor records GET/POST/PUT/PATCH/DELETE except `/health` and swagger.

This is a source-and-live inspection. Endpoints marked WORKING were confirmed by code path plus, where noted, a live call or unit test. Endpoints not live-called in this pass are classified from implementation, not assumed healthy because the route exists.

Standard error shape today is NestJS `{ statusCode, message, error }`. The requested `{ success, error.code, correlationId }` envelope is **not** implemented. Stack traces are not returned by default Nest filters; there is no custom correlation-id filter.

## Live-tested this pass

| Call | Result |
| --- | --- |
| `GET /` through nginx :8080 | 200 |
| `GET /api/v1/health` | 200 `{ status: "ok", service: "afyasasa-backend" }` |
| Postgres snapshot queries | succeeded (see database map) |
| `OpdService.doctorQueue` unit tests | 8/8 passed after backend scoping |

Doctor A vs Doctor B was not live-logged in (passwords are not reset in this pass). Assignment enforcement is proven in unit tests against the real service method.

## Classification legend

- WORKING — implemented, guarded, uses canonical tables
- WORKING BUT WEAK — works but has an authorization, validation, pagination, or integration gap
- BROKEN — incorrect behaviour proven
- STALE — older path still present
- DUPLICATE — second way to do the same thing
- UNUSED — backend route with no frontend caller found
- AUTHORIZATION BUG — previously returned unauthorized rows (doctor queue, now fixed)
- INTEGRATION BUG / BLOCKED — external system not connected
- BACKEND ROUTE MISSING — frontend or requirement has no matching official API

---

## Auth `/auth`

| METHOD | PATH | AUTH | ROLE/PERM | TABLES | STATUS |
| --- | --- | --- | --- | --- | --- |
| GET | /auth/hospitals | public | — | tenants | WORKING |
| GET | /auth/hospitals/:code | public | — | tenants | WORKING |
| GET | /auth/session-policy | public | — | — | WORKING |
| POST | /auth/login | public + throttle | email/password | users, sessions | WORKING |
| POST | /auth/refresh | public + throttle | refresh cookie | sessions | WORKING |
| POST | /auth/forgot-password | public + throttle | — | users | WORKING |
| POST | /auth/reset-password | public + throttle | token | users | WORKING |
| POST | /auth/logout | public | refresh cookie | sessions | WORKING |
| GET | /auth/me | JWT | — | users | WORKING |
| POST | /auth/activity | JWT | — | sessions | WORKING |
| POST | /auth/logout-all | JWT | — | sessions | WORKING |
| POST | /auth/change-password | JWT | current password | users | WORKING |

Validation: class-validator DTOs. Lockout exists (director account was previously locked after failed defaults — do not reset). Secrets must not appear in logs.

---

## OPD `/opd`

| METHOD | PATH | PERM | TABLES | STATUS |
| --- | --- | --- | --- | --- |
| GET | /opd/encounters | encounters:read | encounters | WORKING BUT WEAK — `doctorId` query is not role-scoped |
| POST | /opd/encounters | encounters:create | encounters, visit queue | WORKING — blocks second open visit same day |
| GET | /opd/encounters/:id | encounters:read | encounter + triage/consult/dx/notes | WORKING |
| PATCH | /opd/encounters/:id/status | encounters:update | encounters | WORKING — workflow transitions; now publishes `encounter.updated` |
| GET | /opd/triage/queue | triage:read | encounters status=registered | WORKING |
| GET | /opd/triage/board | triage:read | today's OPD | WORKING |
| POST | /opd/encounters/:id/triage | triage:create | triage_assessments | WORKING — notifies assigned doctor or all clinicians |
| GET | /opd/follow-ups | appointments:read or consultations:read | appointments | WORKING |
| GET | /opd/doctor/queue | consultations:read | encounters, triage, queue | **FIXED** — backend now returns only unassigned + actor assignments unless administrator/superadmin/director/settings:manage |
| POST | /opd/encounters/:id/consultations | consultations:create | consultations | WORKING — sets attending doctor if empty; publishes realtime |
| PATCH | /opd/consultations/:id | consultations:update | consultations | WORKING BUT WEAK — no assigned-doctor check |
| POST | /opd/consultations/:id/complete | consultations:update | consultations, appointments | WORKING — follow-up appointment if dated |
| POST | /opd/encounters/:id/diagnoses | diagnoses:create | encounter_diagnoses | WORKING |
| POST | /opd/encounters/:id/notes | clinical_notes:create | clinical_notes | WORKING |
| POST | /opd/encounters/:id/attachments | encounter_attachments:create | attachments + MinIO | WORKING |
| GET | /opd/reports/summary | reports:read | encounters | WORKING |
| GET | /opd/sick-sheets | sick_sheets:read | sick_sheets | WORKING |
| POST | /opd/sick-sheets | sick_sheets:create | sick_sheets | WORKING |

Doctor-queue expected statuses: 200 with array. Unauthenticated: 401. Doctor requesting another `doctorId`: 400. Previously BROKEN/AUTHORIZATION BUG: every doctor received every open visit.

Frontend caller: `App.tsx` `queryKey ['doctor-queue', userId]`, 20s poll, invalidation on SOAP save / complete / triage / results / IPD admit.

---

## Patients `/patients`

CRUD + identifiers + next of kin + allergies + chronic conditions + history/journey/timeline/chart/QR.  
`GET /patients/scan/:code` is public for QR cards.  
Classification: WORKING. Soft-delete on DELETE. Identifier types include `client_registry` in the DTO; live data has no CR rows yet.

---

## Inpatient `/inpatient`

Wards, beds, dashboard, census, admit, transfer, progress notes, discharge summary, cancel.  
Classification: WORKING. Bed status includes `cleaning`. Occupancy is separate from accommodation charging.

---

## Payments `/payments` and `/integrations/quickbooks`

| METHOD | PATH | PERM | STATUS |
| --- | --- | --- | --- |
| POST | /payments/mpesa/stk-push | payments:initiate | WORKING BUT WEAK until live Daraja credentials proven |
| POST | /payments/mpesa/callback | public | WORKING BUT WEAK — public callback; verify signature/config before treating as settled |
| POST | /payments/manual | payments:initiate | WORKING |
| GET | /payments/transactions | payments:read or initiate | WORKING — default limit 50 |
| GET | /payments/outstanding | payments:read or initiate | WORKING — empty without patientId |
| GET | /payments/charges | payments:read/initiate/history | WORKING |
| GET | /payments/charge-catalogue | payments or settings | WORKING — paginated |
| PATCH | /payments/charge-catalogue | settings | WORKING |
| POST | /payments/charge-catalogue/import/preview | settings | WORKING — preview only |
| POST | /payments/charge-catalogue/import/confirm | settings | WORKING — no invented prices |
| GET | /payments/exceptions | finance | WORKING — read-only missed/unpriced |
| GET | /payments/admissions/:id/account | payments | WORKING |
| GET | /payments/charges/ipd-census | payments | WORKING |
| POST | /payments/charges/:id/adjust | payments | WORKING |
| POST | /payments/cashier/close | payments | WORKING |
| POST | /payments/charges/manual | payments | WORKING |
| POST | /payments/charges/accommodation/process | payments | WORKING — skips unpriced |
| GET | /integrations/quickbooks/queue | settings | WORKING — queue only, not a second GL |
| POST | /integrations/quickbooks/webconnector | QBWC | WORKING BUT WEAK — desktop connector, not live-proven this pass |

Zero-price items are not billable. KSh 0 is not a charge.

---

## Laboratory

`/laboratory` requests, samples collect/receive, results, verify, inbox.  
`/laboratory/catalog` departments, specimens, tests, pricing, import.  
Classification: WORKING. Specimen barcode table already exists (`lab_samples.barcode`). `POST /laboratory/catalog/seed` must stay unused on live Jalaram.

---

## Radiology, theatre, inventory, clinical orders

Implemented and frontend-wired. Inventory has no barcode scan API. Theatre charge posts only when booking is completed and priced. Pharmacy dispense uses inventory sell price then catalogue SKU/name fallback.

---

## SHA `/sha`

| METHOD | PATH | STATUS |
| --- | --- | --- |
| GET | /sha/status | WORKING — reports disconnected unless credentials set |
| GET | /sha/eligibility/patient/:id | WORKING — last stored check |
| GET | /sha/coverage/patient/:id | WORKING — derived from last check |
| POST | /sha/eligibility | BLOCKED BY EXTERNAL API unless SHA_CLIENT_ID/SECRET and SHA_FACILITY_FR_CODE are set |

Live `sha_eligibility_checks` = 0. No fake eligible responses in production path when disconnected.

---

## Reports `/reports`

Dashboard, operations, intelligence, executive analytics, OPD/IPD/lab/theatre/maternity/ICU/referrals, disease register.  
MOH: 705, 705A, 705B, 706, 717 + DOCX if template uploaded.  
`GET /reports/moh/auto-run` generates internal period data; it does **not** submit to KHIS.

Classification: WORKING for internal projection. Missing official registers are BACKEND ROUTE MISSING by design until MOH/HRI specs are supplied.

---

## Admin / platform / health / storage / worklists / notifications / documents / marketing / emergency / maternity / ICU / HDU / nursing / appointments / referrals / queue / exports

All listed in the controller inventory. JWT + permission metadata present.  
`GET /health` is public liveness only.  
`GET /admin/system-health` is the staff-facing health view and must stay permission-gated.  
`POST /platform/tenants/provision` is platform-level — do not use against live Jalaram data.

## Frontend call map (search)

Frontend uses `apiRequest` (custom client), some raw `fetch` for downloads/uploads (`storage`, discharge PDF, template render, public scan/hospitals). No axios. React Query keys are the cache. Hardcoded external DHA URLs were not found in the frontend.

## Known mismatches

| Issue | Class |
| --- | --- |
| Doctor queue previously returned all doctors' patients | AUTHORIZATION BUG — fixed this pass |
| `GET /opd/encounters?doctorId=` still accepts any doctor id | AUTHORIZATION BUG / WEAK |
| No `/shr/*`, consent, claim, preauth, biometric, barcode product APIs | BACKEND ROUTE MISSING — blocked on official integration, not stubs |
| Error envelope lacks `correlationId` | WORKING BUT WEAK |
| Health does not probe DB/Redis/MinIO/DHA | WORKING BUT WEAK |
| List endpoints vary: some paginated (worklists, catalogue), some `take: 100` (encounters) | WORKING BUT WEAK |

## Idempotency / transactions

- OPD check-in rejects a second open visit the same Nairobi day
- Accommodation charges key on admission+date+item+bed
- Payment service has a matching-payment guard
- Pharmacy dispense + stock + charge should stay in one service transaction; treat any split path as a billing-safety review item, not a new ledger
