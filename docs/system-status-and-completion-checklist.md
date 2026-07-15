# AfyaSasa System Status and Completion Checklist

Generated: 2026-06-21

Purpose: this document gives a complete, honest view of the current AfyaSasa build so an advisor, developer, clinician, or hospital stakeholder can understand what exists, how good it is, what is weak, what remains, and what should be prioritised next.

## 1. Executive summary

AfyaSasa is now a broad clinical EMR foundation/prototype. It is no longer only a blueprint. The codebase contains backend modules, frontend screens, database migrations, seed data, Docker Compose infrastructure, authentication, RBAC, audit foundations, patient records, OPD, lab, radiology, inpatient, emergency, nursing, theatre, maternity, ICU, HDU, reporting, notifications, and storage foundations.

However, the system is not yet production-ready. The module coverage is wide, but many workflows are still foundational and need testing, polish, runtime bug fixing, deeper clinical UX, integration tests, and production hardening.

Current honest estimate:

```txt
Module coverage: high
Workflow depth: medium
UI/UX quality: medium-low, improving
Runtime confidence: medium-low until full local click-through testing is complete
Production readiness: low-medium
Overall completion toward hospital-ready EMR: about 45%
```

## 2. Technology stack

Current stack:

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: NestJS, TypeScript
- Database: PostgreSQL
- ORM: TypeORM with migrations
- Queue/cache: Redis + BullMQ
- File storage: MinIO/S3-compatible storage with signed URLs
- Reverse proxy: Nginx
- Auth: JWT access token + refresh token
- Password hashing: bcrypt
- SMS: configurable provider
  - stub
  - Africa's Talking
  - Twilio
- Packaging: Docker Compose

## 3. How to run locally

From project root:

```bash
cp .env.example .env
npm run preflight
npm run dev
```

If npm is not available:

```bash
cp .env.example .env
docker compose up --build
```

If local DB/migrations are broken from older runs:

```bash
docker compose down -v
docker compose up --build
```

URLs:

- App: `http://localhost:8080`
- Backend API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- MinIO console: `http://localhost:9001`

Demo tenant:

```txt
demo
```

Demo users:

| Role | Email | Password |
|---|---|---|
| Administrator | `it@jalaram.co.ke` | `ChangeMe123!` |
| Doctor | `doctor@jalaram.co.ke` | `ChangeMe123!` |
| Nurse | `nurse@jalaram.co.ke` | `ChangeMe123!` |
| Records Officer | `records@jalaram.co.ke` | `ChangeMe123!` |
| Lab Technician | `lab@jalaram.co.ke` | `ChangeMe123!` |
| Radiology Technician | `radiology@jalaram.co.ke` | `ChangeMe123!` |

Smoke test after startup:

```bash
npm run smoke
```

## 4. Current implemented modules

### 4.1 System administration

Implemented:

- User management API and UI
- Role listing and role creation
- Permission listing
- Role-permission assignment backend
- Department creation
- User-to-department assignment
- Tenant settings API/UI
- Audit log viewer
- Account lockout support
- User activation/deactivation backend
- User unlock backend

Current UI quality:

- Functional, but still basic.
- User creation works.
- Departments can be created and assigned.
- Audit viewer is readable but still simple.

Still weak:

- Department-level queues are not fully wired.
- Permission editing UI needs better controls.
- Audit log needs better filters and detail drawers.
- No admin dashboard with system health metrics yet.
- No full platform-super-admin tenant provisioning UI.

Status:

```txt
Implemented foundation: yes
Production-ready: no
Priority for next pass: medium-high
```

### 4.2 Authentication and RBAC

Implemented:

- Login
- JWT access tokens
- Refresh tokens
- Logout
- Logout-all
- Change password
- Forced password change
- Failed login lockout
- RBAC guard
- Permission decorator
- Default roles and permissions

Still weak:

- Permission caching in Redis is not fully implemented.
- Password reset email is not fully wired.
- Session/device management UI is missing.
- Need full auth integration tests.

Status:

```txt
Implemented foundation: yes
Production-ready: partial
Priority for next pass: high
```

### 4.3 Tenant settings and branding

Implemented:

- Tenant registry
- Tenant settings
- Patient ID prefix
- SMS sender name
- Triage system setting
- Settings UI

Partially discussed/needed:

- Hospital name display
- Jalaram Hospital branding
- Logo URL
- Primary/secondary colour
- Email sender details
- Physical address
- Facility code
- Licence details
- Phone/email/contact information
- Letterhead/report branding

Current gap:

The settings model is still too small for a real hospital tenant. It should become a complete hospital profile/branding center.

Recommended next fields:

- `hospital_display_name`
- `legal_name`
- `logo_url`
- `primary_color`
- `secondary_color`
- `accent_color`
- `email_from_name`
- `email_from_address`
- `support_email`
- `support_phone`
- `website`
- `postal_address`
- `physical_address`
- `moh_facility_code`
- `licence_number`
- `report_footer`
- `letterhead_url`

Status:

```txt
Implemented foundation: yes
Production-ready: no
Priority for next pass: high
```

### 4.4 Patients / Master Patient Index

Implemented:

- Patient registration
- Patient search
- Duplicate detection by identifiers
- Patient number generation
- QR card data
- Patient profile drawer
- Patient identifiers
- Next of kin
- Allergies
- Chronic conditions
- Patient safety banner
- Patient clinical timeline

Search supports:

- name
- patient number
- identifier filtering
- phone filtering

Needs improvement:

- Search should more strongly prioritise National ID/SHA/passport/phone/patient number.
- Search UI should show autocomplete suggestions as user types.
- Must show two or more identifiers on selection:
  - name
  - DOB
  - patient number
  - phone
  - ID/SHA
- Need patient merge workflow for duplicates.
- Need patient photo upload.
- Need better patient profile full-page view, not only drawer.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium
Production-ready: no
Priority for next pass: very high
```

### 4.5 Patient Clinical Timeline

Implemented:

- Backend timeline endpoint
- Timeline shown in patient profile drawer
- Includes events from:
  - registration
  - encounters
  - admissions
  - lab results
  - radiology reports
  - surgeries
  - maternity
  - ICU
  - HDU
  - appointments
  - referrals

Still weak:

- Timeline is simple cards, not a polished clinical timeline.
- Needs filters by event type.
- Needs date range filter.
- Needs print/export.
- Needs better grouping by encounter/admission.
- Needs links to source records.

Status:

```txt
Implemented foundation: yes
Production-ready: no
Priority for next pass: very high
```

### 4.6 Appointments

Implemented:

- Appointment slots backend
- Appointment booking backend
- Appointment listing UI
- Patient lookup selector in appointment form
- Appointment status backend
- Mark arrived creates OPD encounter

Still weak:

- Doctor selection still uses user ID.
- Calendar UI is not polished.
- Reminder jobs are not fully implemented.
- No no-show workflow UI.
- No recurring schedule UI.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium-low
Priority: medium
```

### 4.7 OPD

Implemented:

- OPD encounter creation
- OPD check-in
- Triage queue
- Triage form
- Doctor queue
- SOAP consultation
- Diagnosis entry
- Encounter completion
- OPD report

Still weak:

- Consultation room needs better layout.
- Lab/radiology ordering should be embedded inside consultation screen.
- Follow-up appointment should be created directly from consultation.
- Discharge instructions should be structured.
- Previous visits should be displayed in consultation workspace.
- Need clear status transitions.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium
Priority: very high
```

### 4.8 Triage

Implemented:

- Vitals capture
- Pain score
- Triage colour
- Triage category
- Move to doctor queue

Still weak:

- Needs BMI auto-calculation.
- Needs abnormal vitals warnings.
- Needs triage category guidance.
- Needs better emergency fast-path.
- Needs re-triage UI.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium
Priority: medium-high
```

### 4.9 Laboratory

Implemented:

- Lab panels
- Lab tests
- Lab request creation
- Lab request items
- Sample collection
- Sample receipt backend
- Result entry
- Critical flagging
- Verification
- Results inbox
- Critical result listing
- Doctor review action
- Seeded lab catalogue

Still weak:

- Sample receipt UI is incomplete.
- Request detail view is not polished.
- Result entry still requires request item IDs.
- Verification UI needs a proper request detail workflow.
- Critical result acknowledgement UX should be stronger.
- Need lab turnaround time reporting.
- Need barcode printing.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium
Priority: very high
```

### 4.10 Radiology

Implemented:

- Modalities
- Radiology requests
- Status update backend
- Report writing
- Report verification
- Report inbox
- Attachment references
- Signed upload URL helper
- Doctor review action
- Seeded modalities

Still weak:

- Actual browser file upload is not fully automated.
- Image preview is missing.
- Report verification UI needs better controls.
- Request scheduling UI is basic.
- Modality procedure templates are missing.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium-low
Priority: high
```

### 4.11 Inpatient / IPD

Implemented:

- Wards
- Beds
- Bed dashboard
- Available/occupied/cleaning/maintenance/reserved statuses
- Admissions
- Patient selector in admission flow
- Bed selector
- Bed status update
- Bed transfers backend
- Progress notes UI
- Discharge summary creation UI
- Discharge summary completion UI
- Discharge action UI

Still weak:

- Transfer UI is missing.
- Discharge summary list/select is awkward; users must copy summary ID.
- Bedside dashboard is not mature.
- Admission notes and nursing assessment need better structure.
- Ward round list needs better doctor-specific view.
- Discharge medications need structured flow.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium
Priority: very high
```

### 4.12 Nursing

Implemented:

- Vitals
- Active admission selector
- MAR scheduling
- MAR status update
- Shift notes
- Nursing observations
- Observation panel
- MAR panel

Still weak:

- MAR chart UI needs a real time-grid.
- Observation charts are not visual.
- Care plan is missing.
- Nursing assessment is missing.
- Shift handover viewer is basic.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium
Priority: high
```

### 4.13 Emergency

Implemented:

- Emergency registration
- Emergency dashboard
- Disposition
- Critical alerts
- Alert acknowledgement

Still weak:

- Emergency fast triage UI needs improvement.
- Critical alert audio/visual escalation is missing.
- Code blue broadcast UI is not complete.
- Continuous vitals charting is not complete.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium-low
Priority: high
```

### 4.14 Theatre

Implemented:

- Theatre rooms
- Surgical procedures
- Surgery bookings
- Surgery status transitions
- Theatre staff assignment
- Surgery notes
- Complications backend

Still weak:

- Consent forms UI is missing.
- Surgical checklist UI is basic/missing.
- Recovery tracking is not polished.
- Complication UI is not exposed strongly.
- Theatre calendar/schedule view is missing.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium-low
Priority: medium-high
```

### 4.15 Maternity

Implemented:

- Pregnancy registration
- ANC visit
- Labour record
- Delivery record
- Newborn record
- Postnatal visit

Still weak:

- Mother registration should be more integrated with patient registration.
- Newborn registration should optionally create a new patient automatically.
- ANC chart needs visualisation.
- Labour partograph is missing.
- Maternity admission flow needs mini-IPD layout.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium-low
Priority: high
```

### 4.16 ICU

Implemented:

- ICU admission
- ICU observations
- Ventilator records
- Fluid balance
- ICU rounds
- ICU status transitions

Still weak:

- ICU charting is not visual.
- Hourly observations need a time-grid.
- Ventilator trends need charting.
- Fluid balance needs cumulative totals.
- Critical events need stronger UI.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium-low
Priority: medium-high
```

### 4.17 HDU

Implemented:

- HDU admission
- HDU observations
- HDU rounds
- HDU status transitions

Still weak:

- HDU monitoring chart is not visual.
- Escalation tracking needs better UI.
- Transfer back to ward workflow needs polish.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium-low
Priority: medium
```

### 4.18 Reporting

Implemented:

- Clinical dashboard metrics
- OPD summary
- Admissions report
- Discharges report
- Bed occupancy
- Emergency stats
- Disease register
- MOH 705 draft
- CSV-ready outputs
- Frontend report selector

Still weak:

- PDF export not implemented.
- Excel export not implemented.
- Date filters need UI.
- Department filters missing.
- Waiting time reports missing.
- Productivity reports missing.
- Maternity/theatre/ICU/HDU reports need expansion.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium
Priority: medium-high
```

### 4.19 Audit

Implemented:

- Audit entity
- Global audit interceptor
- Append-only DB trigger
- Audit viewer
- Read/create/update/delete/export/print/download action mapping
- Basic audit tests

Still weak:

- Before/after snapshots are not complete.
- Patient-specific audit filtering is missing.
- Diff view is missing.
- Export audit logs UI missing.
- Device/session context can be richer.

Status:

```txt
Implemented foundation: yes
Workflow maturity: medium
Priority: high
```

## 5. UI/UX assessment

### What is better now

- Sidebar is grouped by workflow area.
- Sidebar scrolls.
- Mobile dropdown exists.
- Patient lookup exists in several important forms.
- JSON panels were converted to table-first panels.
- Settings page is clearer.
- Bed dashboard has summary cards.
- Admissions flow has patient search and bed selection.
- Patient profile includes safety banner and clinical timeline.

### Still not good enough

The UI is not yet at the level of mature systems like Bahmni, OpenMRS enterprise implementations, Epic-style flows, or modern hospital dashboards.

Main UI weaknesses:

- Too many forms on one screen.
- Some modules still require raw IDs.
- Some workflows need wizards.
- Tables need pagination, sorting, and column controls.
- No consistent design system components yet.
- Limited visual charts.
- Some forms are dense.
- Some screens are still admin/developer-friendly instead of nurse/doctor-friendly.
- Not enough role-specific dashboards.

Current UI rating:

```txt
Usability for demo/testing: 6/10
Clinical polish: 4/10
Visual design: 5/10
Navigation: 7/10
Data-entry safety: 5/10
```

## 6. Data/search recommendations

Patient search should support:

- Patient number
- National ID
- SHA number
- Passport number
- Birth certificate
- Refugee ID
- Phone number
- Full name
- Partial name
- Date of birth
- QR code
- Next-of-kin phone as secondary search, later

Patient selection should display at least:

- Full name
- Patient number
- DOB/age
- Gender
- Phone
- Primary identifier

This prevents wrong-patient selection.

## 7. Current verification status

Latest verified commands:

```bash
npm run build
npm run test
npm run audit
```

Current result:

```txt
Build: passing
Tests: passing
Audit: 0 vulnerabilities
TypeORM metadata validation: passing
```

Important limitation:

Docker runtime testing must happen on your machine. This cloud machine does not have Docker.

## 8. Biggest production blockers

1. Full runtime testing not complete.
2. Multi-tenancy is still demo-schema centered.
3. UI needs major clinical polish.
4. Tests are still too few.
5. Audit snapshots/diffs are incomplete.
6. File upload flow needs actual browser upload and preview.
7. Reporting exports need PDF/Excel.
8. Real SMS/email/provider testing is not complete.
9. No load testing.
10. No external security review.

## 9. Recommended next build order

### Next pass 1: UI clinical polish

- Make patient search autocomplete live as user types.
- Build proper patient full-page chart.
- Build proper consultation room layout.
- Build proper inpatient bedside dashboard.
- Replace remaining raw IDs.

### Next pass 2: End-to-end workflow refinement

- OPD: consultation to lab/radiology/follow-up/discharge.
- Lab: request detail, sample receive, verification screen.
- Radiology: request detail, image upload, report verification.
- IPD: transfer UI, discharge summary list, discharge meds.
- Nursing: MAR grid and observations charts.

### Next pass 3: testing

- Auth/RBAC tests.
- Patient registration tests.
- OPD e2e tests.
- Lab/radiology e2e tests.
- Inpatient e2e tests.
- Browser tests.

### Next pass 4: tenancy/audit hardening

- True schema switching.
- Tenant provisioning.
- Cross-tenant tests.
- Audit before/after snapshots.
- Audit export.

### Next pass 5: reporting and documents

- PDF reports.
- Excel exports.
- MOH 705 polish.
- Discharge summary PDF.
- Referral letter PDF.
- Theatre operation note PDF.

## 10. Advisor questions to ask

When seeking advice, ask:

1. Is the module scope clinically complete for MVP?
2. Which workflows must be perfect before pilot?
3. Is the UI safe enough for patient identification?
4. Are the audit requirements sufficient for Kenya healthcare governance?
5. Which reports are mandatory for the first hospital?
6. Is schema-per-tenant acceptable operationally?
7. Should billing remain excluded?
8. Which modules should be hidden until polished?
9. What is the minimum safe pilot scope?
10. What workflows should be tested with real clinicians first?

## 11. Honest final assessment

AfyaSasa has moved from blueprint to a broad EMR prototype/foundation with many implemented modules. The architecture is generally aligned with the clinical-only hospital EMR vision. The largest remaining challenge is not adding more modules; it is making the workflows clinically smooth, safe, tested, and polished.

Current best use:

```txt
Technical demo
Workflow walkthrough
Advisor review
Early clinician feedback
Local testing and bug discovery
```

Not ready for:

```txt
Production go-live
Unsupervised clinical use
Real patient data
Regulatory audit
Hospital-wide deployment
```

Recommended pilot path:

```txt
Start with registration + OPD + triage + consultation + lab/radiology request flow.
Do not pilot all modules at once.
```
