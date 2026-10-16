# Department and submodule inventory

Source of nav: `frontend/src/lib/navigation.ts` (36 items, 13 groups).  
Screen wiring: `frontend/src/App.tsx`.  
Aliases: `frontend/src/lib/screen-aliases.ts`.  
Backend modules: `backend/src/app.module.ts`.  
API prefix: `/api/v1`.

Nav hide is not authorisation. Backend `@RequirePermissions` is the control.

## Navigation groups

| Group | Screens |
| --- | --- |
| Dashboard | All Queues |
| Front Office | Register Patient, Patient Registry, Identify Patient, OPD Check-In, Appointments |
| OPD | Triage Queue, Doctor Queue, Sick Sheets, Referrals, Orders |
| IPD | Inpatient (IPD), ICU, HDU, Nursing |
| Diagnostics | Laboratory, Lab Queue, Radiology, Imaging Queue |
| Specialty & Procedures | Emergency, Theatre, Maternity |
| Pharmacy & Supply | Pharmacy, Pharmacy Queue, Pharmacy Dispensing, Pharmacy Sales, Pharmacy Stock, Pharmacy Stock Take, Pharmacy Products, Pharmacy Reports |
| Procurement and Store | Inventory & Store |
| Finance | Cashier / Billing, Insurance & Claims |
| Documents & Reports | Medical Documents, Hospital Library, Reports |
| Marketing & Outreach | Marketing |
| Management & Intelligence | Director Dashboard |
| Hospital Control Center | Hospital Control Center, Interoperability |

**Not in navigation:** Blood bank (no module). HR / ClinicFlow (not in this repo). Separate “invoice” document type vs charge/payment (cashier uses charges + payment transactions).

## A. Front Office

| Submodule | UI | API (prefix `/api/v1`) |
| --- | --- | --- |
| Register / update patient | `PatientRegistrationForm.tsx` | `POST/PATCH /patients`, identifiers, kin, allergies |
| Search | Header `GlobalPatientSearch`, `PatientSearchAutocomplete.tsx` | `GET /patients` |
| Duplicate check | Registration + `POST /patients/duplicates` | `PatientsService` identifier uniqueness |
| Identify (biometrics) | `IdentifyPatientWorkspace.tsx` | `/biometrics/*` |
| Registry | `PatientRegistry.tsx` | `GET /patients` |
| OPD check-in | `OpdCheckInWorkspace.tsx` | `POST /opd/encounters` |
| Appointments | `AppointmentCenter.tsx` | `/appointments`, `/appointments/slots`, `/appointments/today` |
| Queue tokens | Worklists | `/queue` |

Visit types in `opd.dto.ts`: `new`, `follow_up`, `referral`, `laboratory_only`, `radiology_only`, `diagnostic`. Diagnostic types set destination lab/rad, not doctor.

## B. OPD

| Submodule | UI | API |
| --- | --- | --- |
| Triage | `TriageWorkspace.tsx` | `GET /opd/triage/queue`, `POST /opd/encounters/:id/triage` |
| Doctor queue | `App.tsx` `DoctorQueue` | `GET /opd/doctor/queue`, `GET /opd/doctor/appointments/today` |
| SOAP | `DoctorConsultationWorkspace.tsx` | `POST /opd/encounters/:id/consultations` |
| Diagnosis / notes / files | same | diagnoses, notes, attachments |
| Complete visit | same | `PATCH /opd/encounters/:id/status` |
| Follow-ups | | `GET /opd/follow-ups` |
| Sick sheets | `SickSheetWorkspace.tsx` | `/opd/sick-sheets` |
| Referrals | `ReferralWorkspace.tsx` | `/referrals` |
| Clinical orders hub | `OrdersHub.tsx` | `/clinical-orders`, lab, radiology |

## C. Pharmacy (same stock as store)

Authoritative stock: `demo.inventory_items`, `demo.inventory_batches`, `demo.inventory_transactions`. Pharmacy location code `PHARMACY`. Dispense writes `DISPENSE` on that ledger — **not a second stock system**.

| Submodule | UI | API |
| --- | --- | --- |
| Overview | `PharmacyDashboard.tsx` | orders + balances |
| Queue / OPD / IPD / partial / history | `PharmacyWorkspace.tsx` | `GET /clinical-orders?module=pharmacy` |
| Confirm dispense | same | `POST /inventory/dispense/prescription` (`confirm: true`) |
| Single-line dispense | | `POST /inventory/dispense/pharmacy` |
| Billing retry | | `POST /inventory/dispense/retry-billing/:orderId` |
| OTC | `PharmacyOtcPanel.tsx` | `POST /inventory/dispense/otc` |
| Sales | `PharmacySalesPanel.tsx` | payments department collections |
| Stock / low / expiry / receive | pharmacy stock panels | `/inventory/locations/:id/balances`, receipts |
| Stock take | `StockTakeWorkspace.tsx` | import preview/confirm |
| Products / prices | `PharmacyProductsPanel`, `InventoryPricesPanel` | items + pricing |
| Reports | `DepartmentExportsPanel` | `/reports/department-revenue` |
| Prescribe (doctor) | `PrescriptionForm.tsx` | `POST /clinical-orders/pharmacy/prescription` |

## D. Laboratory

UI: `LabModule.tsx` and investigation components.  
API: `/laboratory/*`, `/laboratory/catalog/*`.  
Cancel requires `lab_requests:cancel`. Amendment gated by `AFYASASA_LAB_AMENDMENT_ENABLED` (compose false).

## E. Radiology

UI: `ImagingModule.tsx`. API: `/radiology/*`. Diagnostic-only visits route to radiology destination at check-in.

## F. IPD, nursing, ICU, HDU

- IPD: `IpdModule.tsx` — `/inpatient/*` wards, beds, admissions, transfers, discharge, PDF summary.
- Nursing: IPD `initialScreen="nursing"` plus `/nursing/vitals`, `mar`, observations, shift-notes. MAR is **administration recording**, not pharmacy stock deduction.
- ICU: `IcuModule.tsx` — `/icu/admissions`, observations, ventilator, fluids, rounds.
- HDU: `HduModule.tsx` — `/hdu/*`.

## G. Emergency

`EmergencyCommandCenter.tsx` — `/emergency/register`, dashboard, queue, bays, triage, notes, observation, disposition.

## H. Theatre and maternity

- Theatre: `TheatreWorkspace.tsx` — `/theatre/theatres`, procedures, bookings, staff, notes, complications.
- Maternity: `MaternityServiceLine.tsx` — pregnancies, ANC, labour, partograph, deliveries, newborns, mother-baby registry.

## I. Finance

`FinanceModule` / `PaymentDesk.tsx` — charges, outstanding, manual/M-Pesa payment, refunds, cashier summary, catalogue, IPD accommodation job, exceptions, QB queue/webconnector.  
Insurance: `InsuranceWorkspace.tsx` — `/insurance/workspace`, payers, claim **drafts**; SHA portal remains external.

## J. Procurement and store

`InventoryModule.tsx` — overview, stock, prices, stock take, requisitions, buying list, transfers, receive, ledger, integrity. Same `inventory_*` tables as pharmacy.

## K. Documents and reports

Medical documents, hospital library, reports hub (OPD, clinical, director analytics, operations, exports, MOH mapping). Mail: `/admin/email`. Report share: reporting delivery services.

## L. Appointments, referrals, follow-up

Covered under Front Office / OPD. Missed-appointment SMS: not evidenced as live.

## M. Users, roles, audit

Control Center cards in `control-center-sections.tsx`. APIs `/admin/users`, roles, permissions, templates, audit-logs, backups (restore 403), system-health.

Role templates (`role-templates.ts`): records officer, doctor, nurse, lab technician, lab verifier, radiology technician, pharmacist, store officer, cashier, insurance officer, plus director/admin templates in the rest of that file.

## N. Director dashboard

`ReportsHub initialTab="analytics"` → `ExecutiveAnalyticsDashboard.tsx` → `GET /reports/executive-analytics`. Definitions: `docs/AFYASASA_DASHBOARD_METRIC_DEFINITIONS.md`.

## O. Integrations (modules present)

| Integration | Module |
| --- | --- |
| SHA | `integration/sha` — `/sha/status`, eligibility, coverage |
| FHIR | `integration/fhir` — `/integrations/fhir` |
| Insurance drafts | `integration/insurance` |
| M-Pesa | `payments` STK + callback |
| QuickBooks | QBWC + queue |
| Email | `core/mail` |
| SMS | `notifications` `/notifications/sms/bulk` |
| Biometrics | `biometric` |
| Object storage | MinIO `storage` |

## Backend module list (`app.module.ts`)

Core, Mail, Patients, Notifications, Health, OPD, Appointments, Inpatient, Emergency, Nursing, Reporting, Theatre, Maternity, ICU, HDU, Laboratory, Radiology, Storage, Referrals, Documents, Realtime, Worklists, Workflow, Inventory, Marketing, Payments, SHA, FHIR, Insurance, VisitQueue, Exports, Biometric, Auth/Admin/RBAC/Tenancy/Audit via Core.
