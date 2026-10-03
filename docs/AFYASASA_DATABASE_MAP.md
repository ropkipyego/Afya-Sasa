# AfyaSasa database map

Inspection date: 2 October 2026.  
Schema: operational tables live in `demo`. Tenant settings live in `public`.  
Live counts below are from the running Jalaram Postgres volume. No tables were dropped, truncated, or recreated.

## Live volume snapshot

| Table | Rows |
| --- | ---: |
| patients | 26 |
| patient_identifiers | 13 (12 national_id, 1 sha) |
| encounters | 73 |
| consultations | 22 |
| admissions | 21 |
| wards | 12 |
| beds | 26 |
| users | 18 |
| payment_transactions | 2 |
| charges | 0 |
| lab_requests | 13 |
| lab_samples | 11 |
| lab_results | 11 |
| radiology_requests | 9 |
| clinical_orders | 25 |
| inventory_items | 2 |
| inventory_batches | 13 |
| appointments | 15 |
| sha_eligibility_checks | 0 |
| audit_logs | 86,105 |
| public.settings.clinical_catalog.hospitalCharges.items | 13 (all unpriced templates) |

Open OPD queue at inspection: 35 encounters in `registered` / `triaged` / `in_consultation` / `awaiting_results`. Only two had `attending_doctor_id` set (both IT Admin). Twenty doctor-queue encounters were unassigned. Those unassigned rows remain visible to every doctor until a preferred doctor is chosen or a doctor starts the consult.

## Shared columns

Most clinical entities extend `SoftDeleteClinicalEntity`:

- `id` UUID PK
- `created_by`, `created_at`
- `updated_by`, `updated_at`
- `deleted_at` (soft delete)

`users` does not use `deleted_at`. `audit_logs` and `sha_eligibility_checks` use the non-soft `AuditableEntity` / dedicated PK.

## Canonical entities

### Patient — `demo.patients`

| Field | Notes |
| --- | --- |
| PK | `id` UUID |
| Unique | `patient_no` |
| Indexes | `(first_name, last_name)` |
| Status | `is_deceased` |
| Identity extras | `qr_code`, `biometric_enrolled` flag only (no biometric template) |
| Relationships | identifiers, next of kin, allergies, chronic conditions |

**Duplicate candidate:** none. Do not add another patient table.

**Orphans:** none observed as a second identity store. Client Registry IDs are not yet stored (`patient_identifiers.type` has `national_id` and `sha` only).

### PatientIdentifier — `demo.patient_identifiers`

| Field | Notes |
| --- | --- |
| PK | `id` UUID |
| Unique | `(type, value)` |
| FK | `patient_id` → patients |
| Types | national_id, sha, passport, birth_certificate, birth_notification, alien_id, refugee_id, client_registry, mandate_number |
| Status | `verified`, `is_primary` |

Missing vs DHA request: `source`, `verified_at`, `client_registry_id` as a dedicated column. Use `type='client_registry'` + `value` rather than a new table.

### Encounter — `demo.encounters`

| Field | Notes |
| --- | --- |
| PK | `id` UUID |
| Unique | `encounter_no` |
| FK | `patient_id`, `attending_doctor_id` → users |
| Status | registered, triaged, in_consultation, awaiting_results, admitted, completed |
| Type | opd, emergency, inpatient |
| Index | `(type, status, started_at)` |
| Times | `started_at`, `ended_at` |

This is the only encounter system.

### Consultation — `demo.consultations`

| Field | Notes |
| --- | --- |
| PK | `id` UUID |
| FK | `encounter_id`, `doctor_id` → users |
| Status | draft, completed |
| SOAP | subjective, objective, assessment, plan |
| Follow-up | `follow_up_date`, `follow_up_instructions` |

Canonical doctor relationship already exists. Queue now uses `encounters.attending_doctor_id`, which is set at check-in or when a consult starts.

### Appointment — `demo.appointments` + `demo.appointment_slots`

| Field | Notes |
| --- | --- |
| PK | `id` UUID |
| FK | `patient_id`, `doctor_id`, `slot_id`, source encounter |
| Status | indexed with `appointment_date` |

### Queue — `demo` visit-queue tables via `VisitQueueService`

Token issued on OPD check-in. Not a second encounter.

### Practitioner / User / Role

- `demo.users` — PK UUID, email, password hash, `active`
- `demo.roles`, `demo.permissions`, `demo.user_roles`, `demo.role_permissions`
- Practitioner is the same `users` row. There is no separate Practitioner table. Do not create one.

### Department / Clinic

`demo.departments` and `demo.clinics` (admin module). Clinic consultation fees live on `clinics.consultation_fee`. Cardiology and Dermatology exist but are inactive.

### Admission / Ward / Bed / Discharge

- `demo.wards` — unique `code`, type, `active`
- `demo.beds` — unique `(ward, bed_no)`, status available/reserved/occupied/maintenance/inactive/cleaning
- `demo.admissions` — unique `admission_no`; FK patient, encounter, bed, ward, admitting/discharging doctor; status active/discharged/cancelled; `admitted_at`, `discharged_at`
- Discharge summary is a related inpatient entity, not a second admission table

### Diagnosis / ClinicalNote / VitalSigns / Allergy / Medication

| Requested name | Canonical table |
| --- | --- |
| Diagnosis | `demo.encounter_diagnoses` (ICD-10, type, confirmed) |
| ClinicalNote | `demo.clinical_notes` |
| VitalSigns | `demo` nursing vitals (nursing module) |
| Allergy | `demo.patient_allergies` |
| Medication / MedicationOrder | `demo.clinical_orders` (order_type pharmacy) |
| MedicationAdministration | nursing MAR |

### LabRequest / LabTest / LabResult / specimen

| Table | Role |
| --- | --- |
| `lab_requests` | Request header, status requested → verified |
| `lab_request_items` | Tests on a request |
| `lab_tests` / `orderable_lab_tests` | Catalog |
| `lab_specimen_types` | Tube/container catalog, not a patient identity |
| `lab_samples` | Unique `barcode`, collected_at, received_at, condition |
| `lab_results` | Result value, critical flag, verification |

Lab specimen barcodes already exist. Do not invent a second specimen identity. The barcode identifies the sample, not the patient.

### Radiology

`radiology_requests`, reports, modalities. Study sell prices are not imported (`radiologyStudies` absent in catalog).

### Product / Batch / Inventory / StockLedger / Dispensing

| Table | Role |
| --- | --- |
| `inventory_items` | SKU unique, name, category, unit, track_batch |
| `inventory_batches` | Batch + expiry + location |
| inventory transactions | Receipt, issue, transfer, dispense, adjustment |
| `clinical_orders` | Pharmacy prescription header |

No barcode column on items. Product identity today is SKU. Do not assume barcode = batch.

### Charge / Payment / Account

| Table | Role |
| --- | --- |
| `demo.charges` | Patient, optional encounter, service_line, service_entity_id, amounts, status owed/partially_paid/paid/waived/cancelled |
| `demo.payment_transactions` | Method, amount, status, optional `charge_id` |
| IPD account | Projection over charges + payments for an admission (`GET /payments/admissions/:id/account`) |

There is no separate ChargeLine, Account, PaymentAllocation, Payer, Coverage, Claim, or ClaimLine table. Payer/tariff is metadata on catalogue items and payment `payer_scheme`. Do not create a second billing engine.

Charge catalogue source of truth: `public.settings.clinical_catalog.hospitalCharges` (13 unpriced templates) plus clinic fees and 55 lab prices. Mapping workbook was never found on disk.

### Claim / Payer / Coverage

Not implemented as tables. SHA eligibility checks are stored in `demo.sha_eligibility_checks` only.

### AuditLog — `demo.audit_logs`

Append-only (DB trigger blocks UPDATE/DELETE). Fields: user_id, action, record_type, record_id, before_json, after_json, ip, user_agent, session_id, endpoint, http_code, duration. Correlation ID is not a first-class column.

### Missing requested entities (do not create until required)

| Requested | Existing substitute | Create new table? |
| --- | --- | --- |
| Practitioner | users | No |
| ChargeLine | charges row + metadata | No |
| Account | IPD account API | No |
| PaymentAllocation | payment.charge_id | No until split payments require it |
| Payer / Coverage | payment.payer_scheme + SHA check | No |
| Claim / ClaimLine | none | Blocked on DHA eClaims credentials and official tariff |
| ReportDefinition / ReportSubmission | reporting services + print templates | No until official KHIS spec is supplied |
| BiometricVerification | patients.biometric_enrolled flag | Hardware + DHA agent required |
| HRI class tables | none | Official HRI spec not present |

## Orphan / integrity notes

- Many open OPD encounters have no attending doctor. They are not orphans; they are unassigned pool visits.
- Two completed-looking payment rows are not linked to `charges` (charges = 0). Historical cashier entries, not a second ledger.
- `sha` identifier exists on one patient; no `client_registry` identifier rows yet.
- Test Ward exists in wards. ACC-ICU catalogue item exists but there is no ICU ward occupancy mapping priced.
