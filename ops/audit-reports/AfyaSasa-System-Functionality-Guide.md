# AfyaSasa Clinical EMR — System Functionality Guide & Strength Assessment

**Product:** AfyaSasa Hospital EMR (Jalaram Hospital deployment profile)  
**Document type:** Functional specification + readiness assessment for directors and clinical leads  
**Document date:** 15 July 2026  
**Environment covered:** Docker demo / pilot stack (`demo` tenant, single-hospital mode)  
**Primary admin login:** `it@jalaram.co.ke` (password as configured on the running system)  
**App URL (local):** http://localhost:8080  
**API:** http://localhost:3000/api/v1 · Swagger: http://localhost:3000/docs

---

## 1. Purpose of this document

This document explains:

- What AfyaSasa is and who it is for
- How a patient moves through the hospital in system steps
- What every major screen and Control Center section does
- Whether the product is currently strong enough for demo, pilot, and later VPS hosting
- Concrete recommendations before Contabo / Truehost production hosting

It is written as a board-ready brief: honest strengths, honest gaps, and a clear next plan.

---

## 2. Executive verdict — is it strong?

### Short answer

**Yes — strong as a hospital clinical EMR foundation and pilot platform.**  
**Not yet “enterprise complete”** for multi-schema national multi-tenant SaaS, full pharmacy warehouse, analyzer/PACS feeds, or certified national reporting pipelines.

### Scorecard (honest)

| Domain | Score (1–10) | Interpretation |
|--------|-------------|----------------|
| Module coverage (breadth) | **8.5** | Reception through ED, IPD, maternity, theatre, lab, imaging, admin |
| Clinical workflow depth | **7.0** | Core journeys work end-to-end; some specialty depth still maturing |
| Security & access control | **7.5** | JWT + refresh, RBAC, lockout, forced password change, audit trail |
| Usability (desktop) | **7.5** | Progressive forms, worklists, department dashboards, collapse sections |
| Mobile / tablet | **6.5** | Drawer nav + touch targets; needs formal device UAT |
| Reporting & BI | **7.5** | Ops center, clinical reports, executive analytics with export |
| Integrations (SMS, storage) | **7.0** | Celcom Africa / AT / Twilio ready; MinIO storage; email SMTP scaffold |
| Multi-facility / tenancy | **6.5** | One DB tenant + facilities JSON (correct for Jalaram + City Clinic) |
| Production ops maturity | **6.0** | Docker, health, backups scripts; TLS/backups/monitoring still to harden |
| **Overall hospital readiness** | **~7.2 / 10** | **Ready for structured pilot / UAT; plan 4–8 weeks hardening for VPS go-live** |

### Who can use it today

- Hospital director demos and stakeholder walkthroughs
- Clinical UAT (reception → OPD → lab/imaging → IPD/ED)
- IT training for Account Center and Control Center
- Soft live at one site with disciplined backup and access control

### Who should not treat it as finished yet

- Multi-hospital cloud product with isolated Postgres schemas per customer
- Fully digital pharmacy stock + procurement warehouse
- HL7 analyzer / DICOM-PACS vendor certification project
- National HIE auto-submission without further work

---

## 3. Product overview

AfyaSasa is a full-stack hospital Electronic Medical Record system:

- **Frontend:** React + TypeScript (clinical workspaces, dashboards, Control Center)
- **Backend:** NestJS REST API (`/api/v1`)
- **Database:** PostgreSQL (clinical data in `demo` schema for this deployment)
- **Cache / queues:** Redis + BullMQ (notifications)
- **Files:** MinIO (S3-compatible) for PDFs, attachments, templates
- **Realtime:** Socket.IO for live worklist / settings / ED alert refresh
- **Gateway:** Nginx serves the app on port 8080 and proxies the API

For Jalaram Hospital the product is configured in **single-hospital mode**: the tenant code (`demo`) is hidden from end users; staff sign in with Jalaram emails.

---

## 4. Patient journey — step by step

This is the recommended standard flow. Each step maps to a screen and a clear job.

### Step 1 — Find or register the patient (Reception)

1. Open **Patient Search**.
2. Search by name, phone, or patient number.
3. If found: open the patient; review the **safety banner** (allergies / alerts).
4. If not found: open **Register Patient**.
5. Search the registry again (prevents duplicates).
6. Enter core demographics.
7. Optionally expand collapsible sections: optional demographics, identifiers, next of kin, medical alerts.
8. Save — patient receives a hospital patient number.

**Why it matters:** Registration quality drives every later order, bill reference, and safety alert.

### Step 2 — Book or walk-in to clinic (Reception)

1. Use **Appointments** to schedule (or skip for walk-in).
2. Open **OPD Check-In**.
3. Select patient → clinic / department → visit type → confirm.
4. Encounter enters the outpatient workflow.

**Outcome:** Patient appears on triage / doctor queues.

### Step 3 — Triage (Nursing / Outpatient)

1. Open **Triage Queue**.
2. Select the waiting patient.
3. Capture vitals and triage category (including colour-coded urgency).
4. Note pregnancy / critical alerts where applicable.
5. Submit triage.

**Outcome:** Patient is prioritised for clinician review.

### Step 4 — Consultation (Doctor)

1. Open **Doctor Queue**.
2. Select patient; review previous visits and safety banner.
3. Document **SOAP** notes.
4. Enter diagnosis (ICD-supported where configured).
5. Order investigations from clinical tools (lab / radiology).
6. Complete consultation or escalate (admission / ED / referral).

### Step 5 — Laboratory (if ordered)

1. Lab staff open **Lab Dashboard** then **Laboratory** worklist.
2. Collect / acknowledge sample.
3. Enter or attach results.
4. Verify result.
5. Clinician receives item in **Results Inbox** / notifications.

### Step 6 — Imaging (if ordered)

1. Imaging staff open **Imaging Dashboard** then **Radiology** worklist.
2. Progress study status.
3. Write text report and/or attach PDF.
4. Verify report for clinician release.

### Step 7 — Admission / IPD (if needed)

1. From clinical workflow, admit patient to a ward/bed.
2. Use **Inpatient (IPD)** ward board and patient workspace.
3. Nursing uses **Nursing** for observations / notes.
4. ICU / HDU screens focus those units.
5. Discharge when clinically ready — bed frees on the board.

### Step 8 — Emergency pathway (if ED arrival)

1. Open **Emergency**.
2. Triage (red/orange generate critical alert + sound where configured).
3. Assign bay / observation as needed.
4. Disposition: discharge, admit, transfer, or deceased workflow as applicable.

### Step 9 — Documents & communications

1. Issue **Sick Sheets** or **Referrals** from Outpatient.
2. Store outputs under **Medical Documents**.
3. Publish policies under **Hospital Library**.
4. Send patient SMS from Control Center → Notifications (Celcom Africa when credentials set).

### Step 10 — Governance & analytics (Management)

1. **Operations Center** — today’s census and pending work.
2. **Executive Analytics** — trends, comparisons, CSV export.
3. **Audit logs** — who changed what.
4. **Account Center** — staff access lifecycle.

---

## 5. Main navigation — every module explained

### 5.1 Reception

| Screen | Functionality (what staff do) | Strength |
|--------|-------------------------------|----------|
| **Patient Search** | Search registry, open chart, see safety context | Strong |
| **Register Patient** | Progressive registration with optional collapsible steps | Strong |
| **Patient Timeline** | Chronological clinical history across modules | Strong |
| **OPD Check-In** | Guided encounter creation for clinics | Strong |
| **Appointments** | Schedule and manage appointment statuses | Strong |

### 5.2 Outpatient

| Screen | Functionality | Strength |
|--------|---------------|----------|
| **Triage Queue** | Vitals, triage colour, prior visits | Strong |
| **OPD Patients** | Department patient directory / queue filters | Strong |
| **Doctor Queue** | Prioritised consultations, SOAP, completion | Strong |
| **Referrals** | Create/track referral letters | Good |
| **Sick Sheets** | Issue and print sick leave certificates | Good |

### 5.3 Documents

| Screen | Functionality | Strength |
|--------|---------------|----------|
| **Medical Documents** | Patient-linked clinical document store | Strong |
| **Hospital Library** | Hospital-wide SOPs, policies, circulars | Strong |

### 5.4 Laboratory

| Screen | Functionality | Strength |
|--------|---------------|----------|
| **Lab Dashboard** | Pending work, TAT-oriented command view | Strong |
| **Laboratory** | Full request → sample → result → verify worklist | Strong |
| **Lab Patients** | Patients with active lab orders | Strong |
| **Results Inbox** | Clinician verified-result inbox | Strong |

### 5.5 Imaging

| Screen | Functionality | Strength |
|--------|---------------|----------|
| **Imaging Dashboard** | Pending studies / modality overview | Strong |
| **Radiology** | Imaging worklist, report, attach PDF | Strong |
| **Imaging Patients** | Patients with imaging requests | Strong |

Admin catalog supports CSV import of modalities and study protocols.

### 5.6 Inpatient

| Screen | Functionality | Strength |
|--------|---------------|----------|
| **Inpatient (IPD)** | Ward board, beds, patient workspace, transfer/discharge | Strong (admissions list bug fixed in recent wave) |
| **IPD Patients** | Admission-focused patient directory | Strong |
| **ICU / HDU** | Focused critical-care views within IPD | Good |
| **Nursing** | Nursing command center for notes/observations | Good / still deepening |

### 5.7 Emergency

| Screen | Functionality | Strength |
|--------|---------------|----------|
| **Emergency** | ED command: queue, bays, metrics, critical alerts + sound | Strong |
| **ED Patients** | ED directory by triage / disposition | Strong |

### 5.8 Specialty

| Screen | Functionality | Strength |
|--------|---------------|----------|
| **Theatre** | Surgical bookings / procedures | Good (expand WHO checklist later) |
| **Maternity** | ANC, labour, delivery, nursery service line | Good |
| **Pharmacy** | Medication orders / dispensing pilot | Foundational |

### 5.9 Reports

| Screen | Functionality | Strength |
|--------|---------------|----------|
| **OPD Reports** | Outpatient operational reporting | Good |
| **Clinical Reports** | Wider clinical metrics / MOH-oriented outputs | Strong |
| **Executive Analytics** | Date ranges, KPIs, trends, widgets, CSV | Strong |
| **Operations Center** | Live executive census / pending workloads | Strong |
| **Clinical Orders** | Unified lab / imaging / pharmacy order view | Good |
| **Worklists** | Cross-department queues | Strong |

### 5.10 Administration (staff-facing)

| Screen | Functionality | Strength |
|--------|---------------|----------|
| **Notifications** | In-app inbox for results, referrals, tasks | Strong |
| **Hospital Control Center** | Full hospital operating configuration | Strong |

---

## 6. Hospital Control Center — configuration map

| Section | What it configures | Impact |
|---------|--------------------|--------|
| **Hospital profile** | Facility identity, contacts, locale | Letterhead, cards, defaults |
| **Facilities & modules** | Main hospital + satellites (e.g. City Clinic); module toggles | Multi-site UX on one patient DB |
| **User & access management** | Create/edit users, specialisation, password reset, doctor quick-add | Who can log in and practice |
| **Roles & permissions** | RBAC permission bundles | Least-privilege clinical access |
| **Departments & clinics** | Clinical departments | OPD routing and reporting |
| **Clinical catalog** | Visit types, payments, identifiers, triage defaults | Dropdowns hospital-wide |
| **Wards & beds** | Bed inventory | Admissions and occupancy |
| **Laboratory catalog** | Panels/tests + CSV import | What clinicians can order |
| **Radiology catalog** | Modalities/studies + CSV import | Imaging orderables |
| **Theatre / Maternity config** | Specialty catalogs | Specialty documentation |
| **Hospital document library** | Publish SOPs | Staff policy access |
| **Document templates** | Printable clinical DOCX | Sick sheets, referrals, etc. |
| **Printing & QR / Branding** | Cards, QR, logo, colours | Visual identity |
| **Notification center** | SMS sender, templates, **bulk SMS UI** | Patient messaging (Celcom) |
| **Reports / Audit / Security** | Reporting entry, compliance trail, role guidelines | Governance |
| **Backup & System health** | Ops guidance + live service status | Reliability |
| **Super admin** | Platform operator tools | Multi-tenant operators only |

---

## 7. Security, identity, and communications

### Authentication

- Email + password login
- JWT access token + refresh token rotation
- Account lockout after failed attempts
- Forced password change on first login / reset
- Password show/hide toggle on login screens
- Session restore across refresh; cross-tab awareness

### Identity branding (Jalaram)

- Primary IT admin: `it@jalaram.co.ke`
- Clinical demo users on `@jalaram.co.ke`
- SMS sender default oriented to **JALARAM**
- Facilities: Jalaram Hospital (main) + City Clinic (satellite)

### SMS (Celcom Africa)

Configured via environment:

- `SMS_PROVIDER=celcom_africa`
- `CELCOM_API_KEY`
- `CELCOM_PARTNER_ID`
- `CELCOM_SHORTCODE`

Bulk send available under Control Center → Notifications (or API `POST /notifications/sms/bulk`). Keep `SMS_PROVIDER=stub` until live keys are supplied.

### Audit

- Mutation audit with request/response snapshots
- Export / import of audit records for compliance review
- PHI access reporting foundations

---

## 8. Platform architecture (for IT)

| Layer | Technology | Role |
|-------|------------|------|
| UI | React / Vite / Tailwind | Clinical SPA |
| API | NestJS | Business logic, RBAC, tenancy header |
| DB | PostgreSQL | System of record |
| Queue | Redis / BullMQ | Async SMS notifications |
| Objects | MinIO | Clinical files |
| Realtime | Socket.IO | Live invalidation / ED alerts |
| Edge | Nginx | Static UI + API proxy |

**Deployment model now:** Docker Compose on a workstation or tunnel (Cloudflare quick tunnel for demo).  
**Recommended production host for Kenya:** **Truehost VPS (Nairobi)** — lower latency for staff, M-Pesa billing, local support. Contabo is a strong cheap option for EU-hosted RAM-heavy DIY boxes, but weaker for Kenya-facing clinical latency.

Suggested VPS size for go-live: **4 vCPU, 8 GB RAM, 80–160 GB SSD**, Ubuntu LTS, Docker Compose, nightly Postgres backups, TLS certificate, firewall.

---

## 9. Strength analysis by clinical area

### Strong areas (keep and scale)

1. End-to-end OPD pathway (search → register → check-in → triage → doctor)
2. Laboratory and radiology operational worklists with verification
3. IPD ward board model with ICU/HDU focus views
4. ED alerts with urgency signalling
5. Control Center as a real hospital operating system (not just “settings”)
6. Account Center for staffing doctors into clinical dropdowns
7. Executive Analytics + Operations Center for management
8. Role-based navigation filtering by hospital modules

### Adequate but needs depth before full go-live

1. Maternity partograph / neonatal depth
2. Theatre WHO checklist and implant tracking
3. Pharmacy stock, batch, and dispensing warehouse
4. Offline usage (browser cache queue exists; not a full offline EMR)
5. Socket auth hardening (tenant query trust → JWT connect auth)

### Intentionally later (“enterprise” backlog)

These are deferred because they need ops discipline / schema migration windows—not because the UI forgot them:

1. Strip hardcoded `schema: 'demo'` for true multi-tenant schema routing
2. Redis-backed report/catalog cache at scale
3. Full entity before/after DB snapshots beyond HTTP body/response
4. Separate legal entities as separate Postgres schemas
5. Analyzer HL7 and PACS/DICOM vendor projects

---

## 10. Recommendations (prioritised)

### A — Before inviting more clinical users (this week)

1. Soft-refresh demo; confirm login as `it@jalaram.co.ke`
2. Import radiology study CSV template if study list is empty
3. Create real Jalaram doctors/nurses in Account Center with correct roles
4. Walk one complete patient journey and tick the UAT checklist below
5. Keep Celcom on stub until API key + partner ID + approved sender ID are ready

### B — Before VPS production (Truehost recommended)

1. Issue TLS certificate and force HTTPS only
2. Rotate all demo passwords; disable unused seed accounts
3. Nightly encrypted Postgres backup + monthly restore drill
4. Set production JWT secrets, DB passwords, MinIO keys
5. Configure Celcom Africa live SMS and test bulk send to two handsets
6. Restrict Control Center to named IT + medical records leadership
7. Document downtime contact tree for Jalaram IT

### C — Product depth (next sprint after pilot)

1. Pharmacy MAR + stock balances
2. NEWS2 / MEWS auto-scoring in triage
3. Interactive chart drill-down in Executive Analytics
4. Email password reset for staff who forget credentials
5. MFA for administrators
6. Formal mobile QA matrix (Android + iPad browsers)

### D — Hosting decision

**Choose Truehost** for Jalaram production unless you specifically need Contabo’s higher RAM for a EU-hosted second environment. Use Contabo later as a disaster-recovery mirror if desired—not as the primary Kenya clinical host.

---

## 11. Manual UAT checklist (director / lead clinician)

- [ ] Login works without hospital-code field; password eye toggle works
- [ ] Welcome header shows personal greeting + “welcome to the system”
- [ ] Register patient with optional sections collapsed/expanded via arrows
- [ ] OPD check-in creates an encounter
- [ ] Triage vitals save and colour is visible on doctor queue
- [ ] Doctor completes SOAP and finishes visit
- [ ] Lab order appears on Lab worklist; verified result reaches Results Inbox
- [ ] Radiology report can be verified with attachment
- [ ] IPD admission appears on ward board; nursing notes save
- [ ] ED red triage raises alert (and sound where enabled)
- [ ] Referral and sick sheet generate printable output
- [ ] Account Center can create a doctor with specialisation
- [ ] Executive Analytics exports CSV for a date range
- [ ] Audit log shows recent mutations
- [ ] Bulk SMS page loads (stub mode OK until Celcom keys)

---

## 12. Related documents

| Document | Path |
|----------|------|
| System audit (status + test results) | `ops/audit-reports/AfyaSasa-System-Audit-Latest.pdf` |
| Integrations (Celcom / storage) | `docs/integrations.md` |
| Enterprise migration plan | `docs/enterprise-migration-plan.md` |
| This guide (source markdown) | `ops/audit-reports/AfyaSasa-System-Functionality-Guide.md` |

---

## 13. Closing statement

AfyaSasa at Jalaram is **a credible, broad, and operationally usable hospital EMR** for pilot use. Clinical breadth is high; the weakest remaining areas are specialty depth, pharmacy warehouse, and enterprise multi-schema tenancy—not the core patient journey.

Treat the next phase as **pilot hardening + Truehost hosting**, not a rewrite. With credentials, backups, TLS, and staff training completed, the platform is positioned for controlled hospital live use.

---

*Prepared for Jalaram Hospital / AfyaSasa product leadership — 15 July 2026.*
