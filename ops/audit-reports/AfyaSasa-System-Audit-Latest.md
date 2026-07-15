# AfyaSasa — Complete System & Module Audit

**Report date:** 9 July 2026  
**Environment:** http://localhost:8080 (app) · http://localhost:3000/api/v1 (API)  
**Tenant:** demo (single-hospital mode)  
**Automated test result:** 43 PASS · 3 WARN · 0 FAIL

---

## 1. Executive summary

AfyaSasa is a hospital EMR covering reception, outpatient, investigations, inpatient, emergency, specialty services, reporting, and administration. The platform runs on **Docker** (PostgreSQL, Redis, MinIO, NestJS API, React frontend, Nginx).

**Recent delivery (this cycle):**
- Account Center — create/edit users, doctor quick-add, specialisation, password reset, clinical staff directory
- Radiology catalog — CSV template + bulk import (modalities + study protocols)
- Executive Analytics — BI dashboard with date ranges, trends, comparisons, widget config, CSV export
- Auth/session hardening — refresh tokens, cross-tab sync, forced password change without logout
- Single-hospital UX — hospital code hidden on login

**Overall readiness:** Suitable for **demo, pilot, and structured user acceptance testing**. Not yet certified for full production at national scale without addressing items in §6 (Improvement roadmap).

---

## 2. Platform & infrastructure modules

| Module | What it does | Status | Recommended improvements |
|--------|----------------|--------|-------------------------|
| **PostgreSQL** | Primary clinical and admin data store (demo schema) | Working | Full multi-tenant `search_path` on all ORM queries; backup automation |
| **Redis** | Session/cache layer | Working | Wire caching for catalog, settings, and report aggregates |
| **MinIO (S3)** | Clinical file storage (lab PDFs, radiology attachments, DOCX templates) | Working | Complete `file_registry` integration per enterprise plan |
| **Nginx reverse proxy** | Serves frontend on :8080, proxies API | Working | TLS certificates for production; rate limiting |
| **NestJS API** | REST API `/api/v1`, Swagger at `/docs` | Working | Global pagination; structured error codes on all list endpoints |
| **React frontend** | SPA worklists, forms, control center | Working | Code-split large bundle (>500 KB); deeper mobile QA |
| **Realtime (Socket.IO)** | Live settings/worklist updates | Partial | Expand to lab/radiology queue live refresh |
| **Docker Compose** | Local and pilot deployment | Working | Production compose + health checks documented |

---

## 3. Core platform services (backend)

| Module | What it does | Status | Recommended improvements |
|--------|----------------|--------|-------------------------|
| **Authentication** | Login, refresh rotation, lockout, forced password change | Working | Email password reset in production; MFA enrollment UI |
| **RBAC** | Roles, permissions, token revocation on role change | Working | Role templates per job title (nurse, doctor, records) |
| **Tenancy** | `X-Tenant` header, pool-level `search_path` | Demo OK | Provisioned tenant schemas for true multi-hospital |
| **Admin / Settings** | Hospital profile, clinical catalog, departments | Working | Version history for catalog changes |
| **Audit logs** | User action trail, PHI access report | Partial | Before/after JSON snapshots on clinical mutations |
| **Notifications** | In-app inbox, SMS config | Working | Delivery status dashboard; push notifications |
| **Clinical orders mirror** | Lab + radiology dual-write to unified orders table | Partial | Single order UI for clinicians; pharmacy orders |
| **Worklists API** | Cross-department patient queues | Working | Saved filters per user; export |
| **Documents / templates** | DOCX render, hospital library | Working | PDF generation parity for all template types |
| **Health check** | `/api/v1/health` for ops | Working | Deep checks (DB latency, MinIO, Redis) |

---

## 4. Clinical workflow modules (main navigation)

### 4.1 Reception

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Patient Search** | Find existing patients before registration or visit; opens safety banner and profile. | Working | Duplicate detection hints; national ID lookup |
| **Register Patient** | Progressive registration with demographics, next of kin, identifiers. | Working | Bulk import from CSV; photo capture |
| **Patient Timeline** | Chronological view of encounters, orders, documents, admissions. | Working | PDF export of timeline; filter by module |
| **OPD Check-In** | Stepwise check-in: patient → clinic → visit type → confirm encounter. | Working | Queue number printing; appointment auto check-in |
| **Appointments** | Schedule, status workflow, calendar views. | Working | SMS reminders; wait-list |
| **Referrals** | Internal/external referrals with letter generation and tracking. | Working | eReferral integration; status webhooks |
| **Medical Documents** | Patient-linked document repository. | Working | OCR search; category tagging |
| **Sick Sheets** | Issue, print, store sick leave certificates. | Working | Digital signature; employer verification QR |

### 4.2 Outpatient (OPD)

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Triage Queue** | Nurse workspace: vitals, triage colour, alerts, prior visits. | Working | NEWS2/MEWS auto-score; device vitals import |
| **OPD Patients** | Active outpatients by queue; open chart from worklist. | Working | Panel view by clinic/room |
| **Doctor Queue** | Prioritised consultations: SOAP notes, ICD-10 diagnosis, complete visit. | Working | Order sets; e-prescribing module |
| **OPD Reports** | Visit summaries and OPD operational reports. | Working | Tie to Executive Analytics drill-down |

### 4.3 Investigations

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Laboratory** | Full lab worklist: request → sample → result → verify; PDF upload. | Working | Analyzer HL7 feed; critical result escalation rules |
| **Lab Patients** | Patients with active lab requests (department worklist). | Working | Batch sample collection mode |
| **Lab catalog (admin)** | Panels, tests, reference ranges; **CSV bulk import** with template. | Working | LOINC code mapping; price list per test |
| **Radiology** | Imaging worklist: request → schedule → report → verify; attachments. | Working | DICOM viewer integration; PACS worklist sync |
| **Imaging Patients** | Patients with active radiology requests. | Working | Modality room assignment |
| **Radiology catalog (admin)** | Modalities + study protocols; **CSV template import**. | Working | **Import study CSV now** (0 protocols in demo DB) |
| **Results Inbox** | Clinician inbox for verified lab/radiology results. | Working | Acknowledge/read receipt; push alert |

### 4.4 Inpatient (IPD)

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Inpatient (IPD)** | Ward board, admissions, transfers, bed assignment, discharge. | Working | **Fix admissions list API (HTTP 500)** — priority bug |
| **IPD Patients** | Current admissions and discharge-ready patients. | Working | Expected discharge date; bed cleaning workflow |
| **ICU** | ICU ward view filtered from IPD module. | Working | Ventilator charting; hourly observation grid |
| **HDU** | High-dependency unit view. | Working | Step-down criteria checklist |
| **Wards & beds (admin)** | Configure wards, bed inventory, occupancy. | Working | Visual bed map designer |

### 4.5 Emergency

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Emergency** | ED command center: triage, bays, observation, disposition. | Working | Real-time ED dashboard TV mode |
| **ED Patients** | ED queue by triage and disposition. | Working | Ambulance pre-alert intake |
| **Emergency API** | Queue, dashboard, metrics, bays, alerts. | Partial | Bays endpoint requires ED permission (403 for admin — expected) |

### 4.6 Specialty

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Theatre** | Surgical bookings, procedures, scheduling. | Working | WHO checklist; implant tracking |
| **Maternity** | ANC, labour, delivery, nursery service line. | Working | Partograph; neonatal integration |
| **Nursing module (API)** | Nursing notes and observations (backend). | Partial | Dedicated nursing UI in main nav |

### 4.7 Reports & analytics

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Clinical Reports** | Metric cards, MOH report library (705/706/717), CSV export. | Working | Scheduled email reports |
| **Executive Analytics** | BI dashboard: date presets, KPIs, trend charts, period comparison, widget config, CSV export. | Working | Interactive chart library; ward-level drill-down |
| **Operations Center** | Today's ops snapshot: OPD, beds, pending labs/radiology, ED. | Working | Auto-refresh intervals configurable |
| **OPD Reports** | OPD-specific reporting view. | Working | Merge into unified analytics hub |
| **Worklists** | Cross-department operational queues with search. | Working | Role-default landing pages |

### 4.8 Administration

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Hospital Control Center** | Central admin: profile, catalogs, users, security, ops. | Working | Guided setup wizard for new hospitals |
| **Hospital Library** | Policies, SOPs, circulars for all staff. | Working | Version control and acknowledgement tracking |
| **Notifications** | Staff notification inbox. | Working | Priority levels; mark-all-read |

---

## 5. Hospital Control Center modules (detailed)

| Section | Explanation | Status | Improvements |
|---------|-------------|--------|--------------|
| **Hospital profile** | Facility name, MOH code, contacts, locale — drives letterhead and defaults. | Working | Multiple sites under one group |
| **Facilities & modules** | Enable OPD/IPD/lab/etc. per satellite clinic. | Working | Per-facility go-live checklist |
| **User & access management** | Create/edit users, roles, departments, **quick-add doctor**, specialisation, password reset, search. | Working | Bulk user import; SSO/LDAP |
| **Roles & permissions** | RBAC bundles, permission matrix. | Working | Permission simulator ("view as role") |
| **Departments & clinics** | Clinical departments for OPD routing and reporting. | Working | Link departments to wards and theatres |
| **Clinical catalog** | Visit types, payment methods, identifiers, triage defaults. | Working | Import/export catalog JSON |
| **Wards & beds** | IPD bed inventory. | Working | Maintenance scheduling |
| **Laboratory catalog** | Panels/tests + CSV import template. | Working | Interface to national lab master |
| **Radiology catalog** | Modalities + study protocols + CSV import. | Working | Import demo study protocols from template |
| **Theatre configuration** | Theatres and procedure catalog. | Working | Block time scheduling rules |
| **Maternity configuration** | ANC and delivery templates. | Working | MOH maternity register auto-fill |
| **Document templates** | DOCX templates with merge fields. | Working | In-browser template preview |
| **Printing & QR** | Patient cards, QR defaults. | Working | National HIE patient ID QR standard |
| **Branding & theme** | Logo, colors, favicon. | Working | Dark mode |
| **Notification center** | SMS sender, templates. | Working | Africa's Talking / Twilio live credentials |
| **Reports (admin)** | Admin entry to reporting tools. | Working | Report permission per director role |
| **Audit logs** | Compliance trail. | Partial | Immutable log export to SIEM |
| **Security** | Role guidelines reference. | Working | Periodic access review report |
| **Backup & restore** | Ops scripts documentation. | Working | Automated nightly backup job |
| **System health** | DB, Redis, storage status. | Working | Alerting when service down |
| **Super admin** | Platform operator tools. | Working | Restrict to separate super-admin role only |

---

## 6. Improvement roadmap (prioritised)

### Priority 1 — Before pilot go-live
1. **Fix IPD admissions list** — `GET /inpatient/admissions` returns HTTP 500; blocks IPD patient worklist reliability.
2. **Import radiology study protocols** — use Control Center → Radiology → download CSV template → upload.
3. **Add clinical staff** — ensure all doctors have `doctor` role + specialisation in Account Center.
4. **Mobile/tablet QA** — verify sidebar, drawer, and full-width content on phones and tablets.
5. **Production secrets** — rotate demo passwords; remove `ops/.audit-credentials` from workstations.

### Priority 2 — Next development sprint
1. Executive Analytics — ward/clinic drill-down and chart interactivity.
2. Complete `file_registry` wiring for all uploads.
3. Audit before/after snapshots on clinical writes.
4. Pagination on all list APIs (admissions, encounters, orders).
5. Email password reset and MFA enrollment.

### Priority 3 — Enterprise scale (per migration plan)
1. Full multi-tenant ORM (no hardcoded `demo` schema).
2. Unified clinical order engine UI.
3. Redis caching for dashboards and catalogs.
4. Table partitioning for high-volume tenants.
5. National MOH report auto-submission pipelines.

---

## 7. Automated test results (9 Jul 2026)

| Area | Result |
|------|--------|
| Infrastructure | 5/5 PASS |
| Authentication | 2/2 PASS |
| Reception | 3/3 PASS |
| Outpatient | 3/3 PASS |
| Investigations | 6/6 PASS |
| Inpatient | 2 PASS, 1 WARN (admissions 500) |
| Emergency | 2 PASS, 1 WARN (bays 403 for admin) |
| Specialty | 3/3 PASS |
| Reports | 5/5 PASS |
| Administration | 7/7 PASS |
| New features | Account center, radiology API, executive analytics — PASS |
| UI assets | 2/2 PASS |

---

## 8. Manual audit checklist (for director sign-off)

- [ ] Login — hospital code hidden (single-tenant)
- [ ] Reception — register patient → check-in → timeline
- [ ] OPD — triage → doctor queue → complete consultation
- [ ] Lab — order test → enter result → clinician sees Results Inbox
- [ ] Radiology — request imaging → report → verify
- [ ] IPD — admit patient → ward board (verify admissions list loads)
- [ ] ED — triage patient → disposition
- [ ] Account Center — add doctor with specialisation → appears in clinical workflows
- [ ] Radiology catalog — import CSV template
- [ ] Executive Analytics — 30-day range, charts, CSV export
- [ ] Operations Center — today's figures match floor reality
- [ ] Mobile — navigation usable on small screen

---

## 9. How to open this report

- **PDF:** `ops/audit-reports/AfyaSasa-System-Audit-Latest.pdf`
- **HTML (best in browser):** `ops/audit-reports/AfyaSasa-System-Audit-Latest.html`
- **Chrome:** `google-chrome ops/audit-reports/AfyaSasa-System-Audit-Latest.html`

---

*AfyaSasa system audit — modules, status, and improvement recommendations.*  
*Regenerated for director review.*
