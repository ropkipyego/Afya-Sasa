# AfyaSasa — System Audit & Readiness Report

**Report date:** 15 July 2026 (updated)  
**Environment:** http://localhost:8080 (app) · http://localhost:3000/api/v1 (API)  
**Tenant:** demo (single-hospital / Jalaram profile)  
**Primary admin:** `it@jalaram.co.ke`  
**Companion guide:** `AfyaSasa-System-Functionality-Guide.pdf` (step-by-step functionality + strength assessment)

---

## 1. Executive summary

AfyaSasa is a Docker-hosted hospital EMR covering reception, outpatient, laboratory, imaging, inpatient, emergency, specialty services, reporting, notifications, and hospital administration.

**Overall readiness (15 Jul 2026):** Suitable for **demo, structured UAT, and controlled clinical pilot**. Production VPS go-live is recommended after TLS, backups, credential rotation, Celcom live keys, and the Priority-1 checklist in §6.

**Strength snapshot:** Module breadth **high**; core OPD/lab/imaging/IPD/ED journeys **operational**; pharmacy and national multi-tenant schema work remain **foundational / enterprise backlog**.

### Delivery since earlier July audit

- Navigation regrouped (Referrals/Sick Sheets → Outpatient; Lab & Imaging dashboards; Nursing nav)
- Realtime publish expanded (lab/radiology create+status, discharge, ED alerts)
- Facilities: Jalaram Hospital + City Clinic; ED permissions hardened
- Audit logs: before/after snapshots + CSV export/import
- Clinical orders mirror + pharmacy scaffold UI
- IPD admissions HTTP 500 fixed; IPD / Lab / Imaging dashboards improved
- Offline catalog cache + mutation queue foundations
- Jalaram identity emails (`it@jalaram.co.ke` and staff `@jalaram.co.ke`)
- Celcom Africa SMS gateway + bulk SMS admin UI
- Login password show/hide; larger animated welcome header; collapse arrows on form/nav sections

---

## 2. Platform & infrastructure

| Module | What it does | Status | Recommended improvements |
|--------|----------------|--------|-------------------------|
| **PostgreSQL** | Clinical + admin data (`demo` schema) | Working | Nightly encrypted backups; restore drills |
| **Redis** | Cache / BullMQ queues | Working | Cache catalogs + report aggregates |
| **MinIO (S3)** | Clinical files & templates | Working | Full `file_registry` consistency checks |
| **Nginx** | UI :8080 + API proxy | Working | TLS termination on VPS |
| **NestJS API** | REST `/api/v1`, Swagger `/docs` | Working | Uniform pagination + error codes |
| **React frontend** | Clinical SPA + Control Center | Working | Code-split large bundle; device matrix QA |
| **Realtime (Socket.IO)** | Live worklist / ED / settings sync | Working | Authenticate socket handshake with JWT |
| **Docker Compose** | Pilot packaging | Working | Production compose + resource limits |

---

## 3. Core platform services

| Module | What it does | Status | Recommended improvements |
|--------|----------------|--------|-------------------------|
| **Authentication** | Login, refresh, lockout, forced password change, show/hide password | Working | Email reset in production; MFA for admins |
| **RBAC** | Roles, permissions, revocation | Working | Job-title role templates |
| **Tenancy / facilities** | `X-Tenant` + facilities JSON (Jalaram + City Clinic) | Working for single hospital | Multi-schema only when expanding customers |
| **Admin / Settings** | Profile, catalogs, departments | Working | Catalog change history |
| **Audit logs** | Mutation trail + export/import | Working | SIEM shipping optional later |
| **Notifications / SMS** | Inbox + Celcom/AT/Twilio + bulk SMS UI | Working (stub until keys) | Live Celcom credentials + delivery dashboard |
| **Clinical orders mirror** | Lab/imaging/pharmacy unified view | Partial | Deeper pharmacy dispense |
| **Worklists** | Cross-department queues | Working | Saved filters per user |
| **Documents / templates** | DOCX / library / medical docs | Working | PDF parity for every template |
| **Health check** | `/api/v1/health` | Working | Deep dependency latency probes |

---

## 4. Clinical modules (main navigation)

### 4.1 Reception

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Patient Search** | Find patient; open safety banner/profile | Working | National ID / duplicate scoring |
| **Register Patient** | Progressive registration; collapsible optional steps | Working | Photo capture; CSV import |
| **Patient Timeline** | Chronological journey | Working | Timeline PDF export |
| **OPD Check-In** | Patient → clinic → visit type → confirm | Working | Appointment auto check-in |
| **Appointments** | Schedule + status workflow | Working | SMS reminders |

### 4.2 Outpatient

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Triage Queue** | Vitals, colour triage, alerts | Working | NEWS2/MEWS auto-score |
| **OPD Patients** | Clinic patient directory | Working | Room/panel view |
| **Doctor Queue** | SOAP, diagnosis, complete visit | Working | Order sets; e-Rx |
| **Referrals** | Referral letters + tracking | Working | External eReferral |
| **Sick Sheets** | Issue/print/store certificates | Working | Employer QR verify |

### 4.3 Documents

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Medical Documents** | Patient document repository | Working | OCR search |
| **Hospital Library** | Policies / SOPs / circulars | Working | Staff acknowledgement tracking |

### 4.4 Laboratory

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Lab Dashboard** | Pending/TAT command view | Working | TV wallboard mode |
| **Laboratory** | Request → sample → result → verify | Working | HL7 analyzer feed |
| **Lab Patients** | Active lab patients | Working | Batch collection |
| **Results Inbox** | Clinician verified inbox | Working | Acknowledge receipts |
| **Lab catalog (admin)** | Panels/tests + CSV import | Working | LOINC + pricing |

### 4.5 Imaging

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Imaging Dashboard** | Pending studies overview | Working | Modality utilisation charts |
| **Radiology** | Worklist, report, PDF attach | Working | DICOM / PACS |
| **Imaging Patients** | Active imaging patients | Working | Room assignment |
| **Radiology catalog** | Modalities + studies CSV import | Working | Keep study templates current |

### 4.6 Inpatient

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Inpatient (IPD)** | Ward board, beds, workspace | Working | Visual bed map designer |
| **IPD Patients** | Admissions directory | Working | Expected discharge dates |
| **ICU / HDU** | Critical / step-down views | Working | Ventilator / hourly grids |
| **Nursing** | Nursing command (notes/obs) | Working | Full MAR UI |

### 4.7 Emergency

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Emergency** | Queue, bays, metrics, alerts + sound | Working | Dedicated ED TV mode |
| **ED Patients** | ED directory | Working | Ambulance pre-alert |

### 4.8 Specialty

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Theatre** | Bookings / procedures | Working | WHO checklist |
| **Maternity** | ANC → labour → delivery → nursery | Working | Partograph |
| **Pharmacy** | Orders / dispense pilot | Partial | Stock & batches |

### 4.9 Reports & administration

| Screen | Explanation | Status | Improvements |
|--------|-------------|--------|--------------|
| **Executive Analytics** | BI KPIs, trends, widgets, CSV | Working | Interactive drill-down |
| **Operations Center** | Today’s ops command view | Working | Configurable refresh |
| **Clinical Reports / OPD Reports** | Clinical & OPD reporting | Working | Scheduled emails |
| **Clinical Orders** | Unified order board | Working | Closer pharmacy loop |
| **Worklists** | Cross-department queues | Working | Role landing pages |
| **Notifications** | Staff inbox | Working | Priority filters |
| **Hospital Control Center** | Full hospital OS | Working | Guided go-live wizard |

---

## 5. Control Center modules

| Section | Status | Notes |
|---------|--------|-------|
| Hospital profile | Working | Drives letterhead / branding defaults |
| Facilities & modules | Working | Jalaram + City Clinic pattern |
| User & access (Account Center) | Working | Doctor quick-add, specialisation, reset password |
| Roles & permissions | Working | Fine-grained RBAC |
| Departments & clinics | Working | Feeds OPD routing |
| Clinical / Lab / Radiology catalogs | Working | CSV import for lab & radiology |
| Wards & beds | Working | IPD occupancy source |
| Theatre / Maternity config | Working | Specialty catalogs |
| Templates / Printing / Branding | Working | Identity package |
| Notification center (bulk SMS) | Working | Celcom-ready |
| Audit / Security / Backup / Health | Working | Ops governance |
| Super admin | Working | Restrict tightly in production |

---

## 6. Improvement roadmap

### Priority 1 — Before broader pilot users

1. Create real clinical users in Account Center (roles + specialisation)
2. Import radiology study protocols CSV if empty
3. Complete one full UAT journey with director sign-off
4. Rotate demo passwords for any shared accounts
5. Keep production secrets out of chat logs / git

### Priority 2 — Before Truehost / Contabo VPS go-live

1. TLS + HTTPS-only reverse proxy
2. Nightly Postgres backup + restore test
3. Celcom Africa live keys smoke-test
4. Firewall / SSH hardening / non-root deploy user
5. Resource sizing: 4 vCPU / 8 GB RAM / 80+ GB SSD

### Priority 3 — Product depth

1. Pharmacy warehouse and MAR
2. MFA for admins; email reset
3. Socket JWT auth
4. Chart drill-down for Executive Analytics
5. Maternity partograph / theatre WHO checklist

### Priority 4 — Enterprise scale (later)

1. Multi-schema ORM (remove hardcoded `demo` schema)
2. Redis report/catalog cache
3. Deep entity audit snapshots
4. HL7 / PACS integrations
5. National report auto-submission

**Hosting recommendation:** Prefer **Truehost (Kenya)** for Jalaram primary production latency and local support; Contabo as optional secondary / DR capacity.

---

## 7. Automated / previous test posture

Earlier automated run (9 Jul 2026): **43 PASS · 3 WARN · 0 FAIL**.

Notable WARN items since addressed or clarified:

| Previous WARN | Current posture |
|---------------|-----------------|
| IPD admissions HTTP 500 | **Fixed** (listAdmissions where clause) |
| ED bays 403 for admin | Expected without ED bay perms; admin ED perms improved via migration |
| Empty radiology study protocols | Resolved by CSV import when run; keep catalog maintained |

Re-run `ops/full-system-audit.sh` after major releases for an updated pass matrix.

---

## 8. Manual audit checklist (director sign-off)

- [ ] Login as `it@jalaram.co.ke` — hospital code hidden; password toggle works
- [ ] Welcome header visible and animated
- [ ] Reception — register → check-in → timeline
- [ ] OPD — triage → doctor queue → complete
- [ ] Lab — order → result → Results Inbox
- [ ] Radiology — request → report → verify
- [ ] IPD — admit → ward board loads; nursing notes
- [ ] ED — red triage → alert visible
- [ ] Account Center — add doctor with specialisation
- [ ] Radiology catalog CSV import verified
- [ ] Executive Analytics date range + CSV export
- [ ] Notifications bulk SMS page opens (stub OK)
- [ ] Collapse arrows shrink form / nav sections
- [ ] Mobile drawer nav groups collapse

---

## 9. How to open these reports

| File | Purpose |
|------|---------|
| `AfyaSasa-System-Functionality-Guide.pdf` | Detailed step-by-step functionality + strength assessment |
| `AfyaSasa-System-Audit-Latest.pdf` | This status/audit report |
| Matching `.html` / `.md` | Browser-friendly / editable sources |

Generate PDFs:

```bash
bash ops/generate-audit-pdf.sh ops/audit-reports/AfyaSasa-System-Functionality-Guide.md
bash ops/generate-audit-pdf.sh ops/audit-reports/AfyaSasa-System-Audit-Latest.md
```

---

*AfyaSasa system audit — Jalaram Hospital profile — updated 15 July 2026.*
