# Feature status matrix

**Count method:** one row = one feature. **N = 102** (F01–F92 departmental + S01–S10 platform/security/integrations).

**Confidence:** source inspection at `507cc02` unless noted. This audit did **not** log in or re-run Jest.

Status key: VO = Verified operational (this audit) · IPV = Implemented, partially verified · PI = Partially implemented · BD = Blocked or defective · CU = Configured but unverified · NI = Not implemented · U = Unverified

Tests column: “prior 14 Oct” = `docs/release/2026-10-14-test-evidence.log` (380 passed on dirty tree then committed as `507cc02`). Not re-run 15 Oct.

---

## Front Office (F01–F10)

| ID | Feature | Screen / API | Permission | Tests | Status | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| F01 | Patient search | `GET /patients` | patients:search/read | `patients.service.spec` | IPV | Not browser-verified this audit |
| F02 | Register patient | `POST /patients` | patients:create | patient rules spec | IPV | User-reported live use; no PHI inspected |
| F03 | Duplicate identifier block | `POST /patients/duplicates` | patients:create | patients.service.spec duplicate | IPV | Name-only is not a duplicate (by design) |
| F04 | Identifiers (incl. SHA capture) | patient identifiers | patients:update | — | IPV | Capture ≠ SHA eligibility |
| F05 | Biometric identify | `/biometrics`, Identify Patient | patients:search | biometric.service.spec | PI | Device/agent required |
| F06 | Patient registry | Patient Registry | patients:read | — | IPV | |
| F07 | OPD check-in | `POST /opd/encounters` | encounters:create | opd.service.spec | IPV | User-reported efficient |
| F08 | Diagnostic-only visit types | check-in visitType | encounters:create | opd DTO/entity | IPV | Cashier can still add consult charge |
| F09 | Appointments | `/appointments` | appointments:read/manage | — | IPV | `/appointments/today` is hospital-wide |
| F10 | Open-visit duplicate check-in | createEncounter open-today | encounters:create | opd.service.spec | IPV | |

## OPD (F11–F22)

| ID | Feature | Screen / API | Permission | Tests | Status | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| F11 | Triage + vitals | `/opd/encounters/:id/triage` | triage:create | — | IPV | User-reported |
| F12 | Doctor queue scoping | `GET /opd/doctor/queue` | consultations:read | opd.service.spec doctorQueue | IPV | Not logged-in |
| F13 | Doctor appointments today | `GET /opd/doctor/appointments/today` | consultations:read | opd.service.spec | IPV | |
| F14 | SOAP consultation | POST consultations | consultations:create | — | IPV | User-reported |
| F15 | ICD diagnosis | POST diagnoses | diagnoses:create | — | IPV | No live ICD-10 service |
| F16 | Clinical notes / attachments | POST notes/attachments | clinical_notes / attachments | — | IPV | |
| F17 | Encounter complete | PATCH status | encounters:update | workflow service | IPV | |
| F18 | Follow-up date | consultation follow-up | consultations:update | — | IPV | |
| F19 | Lab/rad order from consult | investigation components | lab/rad create | lab/rad specs | IPV | |
| F20 | Multi-line prescription | `POST /clinical-orders/pharmacy/prescription` | pharmacy:prescribe or consultations:create | pharmacy-prescription.spec | IPV | User-reported generally working |
| F21 | Sick sheets | `/opd/sick-sheets` | sick_sheets | — | IPV | |
| F22 | Referrals | `/referrals` | referrals | — | IPV | |

## Pharmacy (F23–F36)

| ID | Feature | Screen / API | Permission | Tests | Status | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| F23 | Medication catalogue | `GET /inventory/items?category=pharmaceutical` | pharmacy:read / prescribe | — | IPV | Same items table as store |
| F24 | Pharmacy queue | `GET /clinical-orders` | pharmacy:read | — | IPV | Name-match SKU heuristic in UI |
| F25 | Confirm FEFO dispense | `POST /inventory/dispense/prescription` | pharmacy:dispense | inventory.service.spec, PG 14 Oct | IPV | **User-reported issues — unreproduced** |
| F26 | Partial dispense | remaining qty metadata | pharmacy:dispense | remainingQuantity helper | IPV | |
| F27 | Refuse cancelled Rx | issuePharmacyLine | pharmacy:dispense | code | IPV | |
| F28 | Insufficient / expired stock | allocateFromBatches | pharmacy:dispense | stock-posting.spec | IPV | Failure mode for staff |
| F29 | Duplicate full dispense | remaining === 0 | pharmacy:dispense | — | IPV | |
| F30 | Charge in same txn | upsertPharmacyCharge | payments via dispense | payments.service.spec, PG | IPV | No unique SQL on charge entity |
| F31 | Billing retry no stock | `POST /inventory/dispense/retry-billing/:orderId` | dispense or payments:manage | — | IPV | |
| F32 | OTC billed / walk-in | `POST /inventory/dispense/otc` | pharmacy:dispense | stock-posting otcSaleReferenceId | IPV | Without saleId not idempotent |
| F33 | Pharmacy sales view | Pharmacy Sales | pharmacy:read | — | U | |
| F34 | Pharmacy stock / low / expiry | PHARMACY location balances | pharmacy:read | — | IPV | |
| F35 | Pharmacy stock take | StockTakeWorkspace | inventory:manage typically | stock-integrity, PG | IPV | Session table unapplied |
| F36 | Dispense history filter | PharmacyWorkspace history | pharmacy:read | — | IPV | |

## Laboratory (F37–F46)

| ID | Feature | API / UI | Permission | Tests | Status | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| F37 | Test/panel catalogue | `/laboratory/catalog`, LabCatalogPanel | lab + settings | lab-pricing.spec | IPV | Incomplete configs possible |
| F38 | Request | POST `/laboratory/requests` | lab_requests:create | lab-lifecycle.spec | IPV | |
| F39 | Sample collect / barcode / scan | samples, barcode | lab_samples | laboratory.barcode.spec | IPV | |
| F40 | Receive / reject sample | POST receive | lab_samples:update | lab-pg 14 Oct | IPV | |
| F41 | Result entry + flags | POST results | lab_results:create | lab-result-engine.spec | IPV | Missing ranges = unassessed |
| F42 | Verify | POST verify | lab_results:verify | lab-lifecycle | IPV | **Requires lab clinical review of templates** |
| F43 | Cancel | POST cancel | lab_requests:cancel | lab-access.spec | IPV | Not granted to tech template |
| F44 | Amend verified | POST amend | lab_results:amend + flag | laboratory.service.ts | BD | Flag **false** on compose |
| F45 | Report PDF/layouts | GET report, layouts | lab_results:read | lab-report.builder.spec | IPV | |
| F46 | Clinician inbox / critical | results/inbox, critical | lab_results:read | — | IPV | |

## Radiology (F47–F52)

| ID | Feature | API | Tests | Status | Gap |
| --- | --- | --- | --- | --- | --- |
| F47 | Modalities catalogue | `/radiology/modalities` | — | IPV | |
| F48 | Request | POST requests | radiology-lifecycle.spec | IPV | |
| F49 | Status workflow | PATCH status | radiology-lifecycle | IPV | Scheduling depth limited |
| F50 | Report + verify | POST reports/verify | radiology-access.spec | IPV | |
| F51 | Attachments | POST attachments | — | IPV | PACS not evidenced |
| F52 | Diagnostic-only routing | OPD destination radiology | — | IPV | |

## IPD / nursing / ICU / HDU (F53–F62)

| ID | Feature | API / UI | Tests | Status | Gap |
| --- | --- | --- | --- | --- | --- |
| F53 | Wards & beds | `/inpatient/wards`, beds | bed-occupancy.spec | IPV | |
| F54 | Admit | POST admissions | inpatient.service.spec | IPV | |
| F55 | Ward transfer | POST transfers | — | IPV | |
| F56 | Progress notes | POST progress-notes | — | IPV | |
| F57 | Discharge summary + PDF | discharge-summary, pdf | — | IPV | |
| F58 | Discharge (summary required) | POST discharge | — | IPV | |
| F59 | Nursing vitals | `/nursing/vitals` | — | IPV | |
| F60 | MAR | `/nursing/mar` | nursing.mar.spec | IPV | Not stock deduction |
| F61 | ICU monitoring | `/icu/admissions` + IcuModule | — | IPV | Not UAT this audit |
| F62 | HDU | `/hdu`, HduModule | — | IPV | |

## Emergency / theatre / maternity (F63–F71)

| ID | Feature | API | Tests | Status | Gap |
| --- | --- | --- | --- | --- | --- |
| F63 | ED register / triage / bays | `/emergency/*` | emergency.service.spec | IPV | Separate from OPD encounter workflow |
| F64 | ED disposition | POST disposition | — | IPV | Admit/discharge path UAT unverified |
| F65 | Theatre catalogue / rooms | `/theatre/theatres`, procedures | theatre.service.spec | IPV | |
| F66 | Surgery booking + notes | bookings, notes, complications | theatre-notes.spec | IPV | Supply via store, not auto |
| F67 | ANC pregnancy | POST pregnancies, anc-visits | — | IPV | Needs clinical UAT |
| F68 | Labour / partograph | labour-records, partograph | — | IPV | |
| F69 | Delivery / newborn | deliveries, newborns | — | IPV | |
| F70 | Register newborn as patient | register-newborn-patient | — | IPV | Duplicate-patient risk if misused |
| F71 | Blood bank | — | — | **NI** | Do not use pharmacy lots |

## Finance (F72–F80)

| ID | Feature | API | Tests | Status | Gap |
| --- | --- | --- | --- | --- | --- |
| F72 | Charge catalogue | `/payments/charge-catalogue` | hospital-charges.spec | IPV | |
| F73 | Manual / service charge | POST charges/manual | — | IPV | Check-in does not auto-insert consult charge |
| F74 | Pharmacy charge | upsertPharmacyCharge | payments.service.spec | IPV | |
| F75 | Lab/rad charging | payments + hospital-charges | — | IPV | Path depends on cashier/order |
| F76 | IPD accommodation job | accommodation/process | — | IPV | Empty rate → no charge |
| F77 | Payment (cash/card/insurance) | POST payments/manual | payment-integrity.spec | IPV | |
| F78 | M-Pesa STK | POST mpesa/stk-push + callback | mpesa-callback specs | PI | Live STK **U** |
| F79 | Refund | POST payments/:id/refund | — | IPV | payments:manage |
| F80 | QuickBooks | queue + webconnector | qbwc spec | PI | `connected` not live-verified; QB is GL |

## Store / procurement (F81–F86)

| ID | Feature | API | Tests | Status | Gap |
| --- | --- | --- | --- | --- | --- |
| F81 | Receipts | POST `/inventory/receipts` | stock-posting, PG | IPV | |
| F82 | Requisition approve/issue/ack | requisitions/* | PG issue idempotency | IPV | |
| F83 | Transfer ship/receive | transfers/:id/ship\|receive | PG | IPV | |
| F84 | Integrity panel | GET `/inventory/integrity` | — | IPV | Login not done |
| F85 | Import sessions unique table | planned SQL | — | PI | Unapplied |
| F86 | Unique batch index | planned commented SQL | — | PI | Audit not run on hospital snapshot |

## Documents, reporting, marketing (F87–F92)

| ID | Feature | API / UI | Tests | Status | Gap |
| --- | --- | --- | --- | --- | --- |
| F87 | Medical documents / library | documents, hospital_documents | — | IPV | |
| F88 | Director analytics | GET `/reports/executive-analytics` | reporting-metrics.spec | IPV | Finance **not certified**; pharmacy KPI **NI** |
| F89 | MOH mapping | reports/moh | moh-mapping.spec | PI | KHIS submit not operational |
| F90 | Email SMTP / reset | `/admin/email` | mail specs | CU | Delivery pin false locally historically |
| F91 | SMS bulk | POST `/notifications/sms/bulk` | — | PI | Do not treat as live patient SMS |
| F92 | Marketing outreach | `/marketing` | marketing.service.spec | IPV | No diagnoses in marketing records |

## Platform, security, integrations (S01–S10)

These rows were omitted from F01–F92 and are required for a complete inventory. Details in `07-security-integrations-and-reporting.md`.

| ID | Feature | API / UI | Tests | Status | Gap |
| --- | --- | --- | --- | --- | --- |
| S01 | Login / JWT refresh | `/auth`, login wall | auth specs (prior 14 Oct) | IPV | Login page observed; no staff login this audit |
| S02 | User lifecycle | `/admin/users` create/patch/activate/deactivate/unlock/reset | — | IPV | `users:manage` |
| S03 | Roles, templates, departments | `/admin/roles`, permissions, role-templates, departments | — | IPV | Guard is OR of keys |
| S04 | Audit logs | `/admin/audit-logs` | AuditInterceptor | IPV | HTTP mutations, not full entity snapshots |
| S05 | SHA eligibility | `/sha/status`, eligibility, coverage | — | PI | Mapping/local; live SHA **not verified** |
| S06 | FHIR mapping | `/integrations/fhir` status, patient, encounter | — | PI | Map-on-read; not a FHIR server |
| S07 | Insurance claim drafts | `/insurance` | — | IPV | Drafts; SHA portal remains external |
| S08 | Shared report delivery | `ReportDeliveryService`, `/reports/shared/:token` | report-delivery.service.spec | PI | Depends on email; live share **U** |
| S09 | Backups listing | `/admin/backups`; restore | — | IPV | Restore historically 403 in director pack |
| S10 | Interoperability screen | Control Center Interop | — | IPV | UI over SHA/FHIR status |

---

## Status totals (N = 102)

| Status | Count | How counted |
| --- | --- | --- |
| Verified operational (this audit) | **0** of the 102 | Login wall and `/health` observed but not counted as clinical VO |
| Implemented, partially verified | **88** | F-rows 81 + S01–S04, S07, S09, S10 |
| Partially implemented | **10** | F05, F78, F80, F85, F86, F89, F91, S05, S06, S08 |
| Blocked or defective | **1** | F44 lab amendment disabled by policy flag |
| Configured but unverified | **1** | F90 email |
| Not implemented | **1** | F71 blood bank (pharmacy Director KPI is a gap inside F88) |
| Unverified | **1** | F33 pharmacy sales view |

Check: 88+10+1+1+1+1 = 102.

F44 is counted once as **BD**, not also as PI.

Platform observations (not in N): login screen at `:5173`; health JSON; local containers healthy; images older than HEAD.

## Notes

- **User-reported:** OPD efficient; prescriptions generally working; dispensing has some issues. Mapped to F07–F20 (positive report) and F25 (open investigation).
- **No confirmed dispensing defect** independently reproduced this audit (no live Rx touched).
