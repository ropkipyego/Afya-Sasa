# AfyaSasa — Detailed Progress & Self-Assessment Guide

**Last updated:** 2026-06-25  
**Purpose:** Everything you need to run the system, test each department yourself, and judge what is ready vs. what still needs work — especially for **reception onboarding this week**.

> **For analyst / supervisor sign-off before live:** see [`docs/pre-live-analyst-brief.md`](pre-live-analyst-brief.md) — short readiness brief with sign-off checklist.

---

## Table of contents

1. [Quick start (5 minutes)](#1-quick-start-5-minutes)
2. [Overall progress at a glance](#2-overall-progress-at-a-glance)
3. [Critical fixes completed (read this first)](#3-critical-fixes-completed-read-this-first)
4. [Navigation map — every screen in the app](#4-navigation-map--every-screen-in-the-app)
5. [Reception department — detailed status](#5-reception-department--detailed-status)
6. [Outpatient (OPD) — detailed status](#6-outpatient-opd--detailed-status)
7. [Inpatient (IPD) — detailed status](#7-inpatient-ipd--detailed-status)
8. [Emergency department — detailed status](#8-emergency-department--detailed-status)
9. [Investigations (Lab & Radiology)](#9-investigations-lab--radiology)
10. [Maternity service line](#10-maternity-service-line)
11. [Administration & reports](#11-administration--reports)
12. [Architecture decisions (Phase Next)](#12-architecture-decisions-phase-next)
13. [UI / UX polish status](#13-ui--ux-polish-status)
14. [Automated tests already run (proof)](#14-automated-tests-already-run-proof)
15. [Manual self-assessment — reception (step by step)](#15-manual-self-assessment--reception-step-by-step)
16. [Manual self-assessment — full OPD journey](#16-manual-self-assessment--full-opd-journey)
17. [Manual self-assessment — inpatient](#17-manual-self-assessment--inpatient)
18. [How to re-run automated tests](#18-how-to-re-run-automated-tests)
19. [Demo patients & seeded data](#19-demo-patients--seeded-data)
20. [Known limitations & honest gaps](#20-known-limitations--honest-gaps)
21. [Recommended next priorities](#21-recommended-next-priorities)
22. [Key file locations (for developers)](#22-key-file-locations-for-developers)

---

## 1. Quick start (5 minutes)

### Start the system

```bash
cd "/path/to/Afya-Sasa"
cp .env.example .env    # first time only
npm run preflight       # checks Docker, ports
npm run dev             # builds and starts all services
```

Or detached:

```bash
npm run dev:detached
npm run logs            # watch backend/frontend logs
```

### URLs

| Service | URL |
|---------|-----|
| **Hospital app (use this)** | http://localhost:8080 |
| Backend API | http://localhost:3000/api/v1 |
| Swagger (API explorer) | http://localhost:3000/docs |
| MinIO console | http://localhost:9001 |

### Login (admin — full access)

| Field | Value |
|-------|-------|
| Tenant | `demo` |
| Email | `admin@demo.afyasasa.local` |
| Password | `ChangeMe123!` |

**Important:** After any rebuild, hard-refresh the browser: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac).

### Smoke test (is the stack alive?)

```bash
npm run smoke
```

---

## 2. Overall progress at a glance

Honest assessment as of June 2026, after the latest polish and bug-fix pass:

| Area | Backend | Frontend UI | Workflow depth | Ready for staff trial? |
|------|---------|-------------|----------------|------------------------|
| **Reception** | Strong | Polished | High | **Yes — primary onboarding target** |
| **OPD (triage + doctor)** | Strong | Polished | High | **Yes** |
| **Sick sheets & referrals** | Fixed | Polished | High | **Yes** (was broken, now tested) |
| **Appointments** | Fixed | Good | Medium | **Yes** |
| **Medical documents** | Timeline-based | Good | Medium | **Yes** (view/search; not a separate upload CMS) |
| **Laboratory** | Strong | Kanban cards | High | Yes (lab tech role) |
| **Radiology** | Strong | Kanban cards | High | Yes (radiology role) |
| **Inpatient (IPD)** | Strong | Bed board + workspace | Medium–High | **Trial ready** (deep polish ongoing) |
| **Emergency** | Strong | Command center | Medium–High | Trial ready |
| **Maternity** | Strong | Service-line shell | Medium | Trial ready |
| **Theatre** | Scaffolded | Form-heavy | Low–Medium | Internal demo only |
| **ICU / HDU** | APIs exist | Routed via IPD ward board | Medium | Trial via IPD nav |
| **Admin / RBAC** | Strong | Functional | Medium | Yes for IT admin |

**Rough overall completion toward “hospital-ready EMR”:** ~55–60% (up from ~45% before recent service-line work).  
**Reception + OPD path for this week:** ~85% ready for supervised onboarding.

---

## 3. Critical fixes completed (read this first)

These were blocking real use. Verify they work when you assess the site.

### 3.1 Form submission crash (frontend)

**Symptom:** Saving referrals, sick sheets, appointments, triage, nursing notes, etc. failed with:

```text
Failed to construct 'FormData': parameter 1 is not of type 'HTMLFormElement'.
```

**Cause:** Some forms passed a React `FormEvent` to code expecting an `HTMLFormElement`, or the opposite.

**Fix:** Centralised in `frontend/src/lib/form-utils.ts`:
- All mutations receive `HTMLFormElement`
- Submit handlers pass `event.currentTarget` synchronously
- `formDataFromElement()` safely builds `FormData`

**You should verify:** Referrals → Save, Sick Sheets → Save, OPD Check-In → Confirm, Triage → Submit.

### 3.2 Internal server error on lists (backend)

**Symptom:** Opening Appointments, Referrals list, Sick Sheets history, Lab worklist, etc. returned **500 Internal Server Error**.

**Cause:** TypeORM rejects `undefined` values inside `where` filters.

**Fixed endpoints (non-exhaustive):**
- `GET /appointments`, `GET /appointments/today`
- `GET /referrals`
- `GET /opd/sick-sheets` (with or without `patientId`)
- `GET /laboratory/requests`
- `GET /radiology/requests`
- `GET /inpatient/beds`
- `GET /opd/encounters`
- `GET /nursing/vitals` (optional filters)
- Maternity pregnancy list

**You should verify:** Open each screen above — lists should load without 500 errors.

---

## 4. Navigation map — every screen in the app

The left sidebar groups modules. On **phone/tablet**, use the **hamburger menu** (top-left) — each item has an **icon**; groups are labelled (Reception, Outpatient, etc.).

| Group | Screen | Who uses it |
|-------|--------|-------------|
| **Reception** | Patient Search | Everyone |
| | Register Patient | Records / reception |
| | Patient Timeline | Records, clinicians |
| | OPD Check-In | Reception |
| | Appointments | Reception |
| | Referrals | Reception, doctors |
| | Medical Documents | Reception, records |
| | Sick Sheets | Reception, doctors |
| **Outpatient** | Triage Queue | Nurses |
| | Doctor Queue | Doctors |
| **Investigations** | Laboratory | Lab staff, doctors (orders) |
| | Radiology | Radiology staff, doctors |
| | Results Inbox | Doctors |
| **Inpatient** | Inpatient (IPD) | Ward clerks, nurses, doctors |
| | ICU | Critical care (opens IPD ICU ward) |
| | HDU | High dependency (opens IPD HDU ward) |
| **Emergency** | Emergency | ED staff |
| **Specialty** | Theatre | Surgical team |
| | Maternity | Midwives, obstetrics |
| **Reports** | OPD Reports | Management |
| | Clinical Reports | Management |
| | Operations Center | Executives |
| **Administration** | Notifications | All clinical staff |
| | Hospital Control Center | Hospital admin |

Config file: `frontend/src/lib/navigation.ts`  
Mobile nav: `frontend/src/components/layout/AppMobileNav.tsx`

---

## 5. Reception department — detailed status

### 5.1 Patient Search

- **Route in app:** Reception → Patient Search
- **What works:** Search by name, phone, patient number, ID; open profile drawer; identifiers, allergies, NOK, conditions
- **UI:** Standard layout (not yet `workspace-shell` — functional)
- **Test:** Search `Brian` or `DEMO-2026-00004`

### 5.2 Register Patient

- **Route:** Reception → Register Patient
- **Workflow:** Search-first → if no duplicate → multi-step registration
- **UI:** `workspace-shell`, generous padding, step indicator
- **Test:** Search a fake name → continue registration → only required fields needed upfront

### 5.3 OPD Check-In

- **Route:** Reception → OPD Check-In
- **Workflow (3 steps):**
  1. Find patient (autocomplete)
  2. Clinic, visit type, referral source, optional doctor
  3. Review & confirm → creates encounter → patient goes to **triage queue**
- **UI:** `workspace-shell`, step cards, clear spacing
- **Backend:** `POST /opd/encounters`
- **Automated test:** Passed (API step 3 in OPD workflow script)

### 5.4 Appointments

- **Route:** Reception → Appointments
- **Features:** Today / Upcoming / Missed / Completed / Cancelled tabs; book appointment; day/week/month view toggle
- **UI:** `workspace-shell`, metric cards, padded forms
- **Backend:** Was 500 on list — **fixed**
- **Test:** Book appointment for existing patient; confirm lists load

### 5.5 Referrals

- **Route:** Reception → Referrals
- **Features:** Create referral (internal/external), clinical letter, urgency, receiving doctor; track status; print/PDF letter
- **UI:** Two-column `workspace-shell`, wide cards, **no manual encounter ID** (removed)
- **Backend:** `POST /referrals`, `GET /referrals`, `PATCH /referrals/:id/status`
- **Was broken:** FormData bug — **fixed**
- **Automated test:** Passed

### 5.6 Sick Sheets

- **Route:** Reception → Sick Sheets
- **Features:** Select patient → issue certificate → **live print preview** → Save → Print/PDF → history list
- **UI:** `workspace-shell`, preview panel on the right
- **Backend:** `POST /opd/sick-sheets`, `GET /opd/sick-sheets?patientId=...` — list 500 **fixed**
- **Was broken:** FormData + sick sheet list 500 — **fixed**
- **Automated test:** Passed

### 5.7 Medical Documents

- **Route:** Reception → Medical Documents
- **What it is:** Unified **view** of patient timeline events (referrals, consultations, lab, radiology, visits) plus sick sheets — **not** a separate document upload portal
- **UI:** `workspace-shell` (recently added)
- **Test:** Select patient → filter by type → search text

### 5.8 Patient Timeline

- **Route:** Reception → Patient Timeline
- **Features:** Chronological events, filters, workflow status
- **Use:** Audit trail for reception when patient asks “what happened last visit?”

---

## 6. Outpatient (OPD) — detailed status

### 6.1 Triage Queue

- **Route:** Outpatient → Triage Queue
- **Workflow:**
  - Board metrics: awaiting triage, doctor queue, in consultation, completed today
  - Select patient from queue → vitals with normal-range hints → triage colour/category → submit → **doctor queue**
- **UI:** `workspace-shell`, wide assessment panel, spacing for tablets
- **Backend:** `POST /opd/encounters/:id/triage`
- **Automated test:** Passed

### 6.2 Doctor Queue

- **Route:** Outpatient → Doctor Queue
- **Workflow:**
  - Queue sorted by triage colour
  - Select patient → **tabbed workspace:**
    - **Context** — triage summary, timeline, alerts
    - **Consultation** — SOAP notes, complete visit
    - **Investigations** — order lab/radiology (no manual IDs)
    - **Referrals** — create referral from consultation
  - Add diagnosis (separate form below SOAP)
- **UI:** `workspace-shell` + `WorkspaceTabs`
- **Backend:** consultations, diagnoses, referrals, investigation orders
- **Automated test:** SOAP + diagnosis passed via API

### 6.3 End-to-end OPD path (what reception + clinical staff should see)

```text
Reception: OPD Check-In
    ↓
Nurse: Triage Queue → submit triage
    ↓
Doctor: Doctor Queue → SOAP → orders/referrals → complete visit
    ↓
Reception: Sick sheet / appointment / documents as needed
```

---

## 7. Inpatient (IPD) — detailed status

### 7.1 Inpatient dashboard

- **Route:** Inpatient → Inpatient (IPD)
- **Features:** Census metrics, ward summary cards (capacity / occupied / available), links to ward boards
- **UI:** `workspace-shell`, large ward cards

### 7.2 Ward board (visual bed cards)

- **Access:** Click a ward from IPD dashboard
- **Features:** Bed cards (not tables) — occupied, available, reserved, cleaning; colour status; click occupied bed → **patient workspace**; admit button on available beds
- **UI:** `workspace-shell`, `bed-card-grid`
- **File:** `frontend/src/components/ipd/WardDashboard.tsx`

### 7.3 ICU & HDU

- **Route:** Inpatient → ICU or HDU
- **Behaviour:** Opens **IPD module** filtered to ICU/HDU ward — not a separate form-only screen anymore
- **Architecture:** ICU/HDU are wards under IPD, not under Emergency

### 7.4 Admit patient

- **Access:** IPD dashboard → Admit patient
- **Workflow:** Search patient → pick available bed → reason → admit
- **Backend:** `POST /inpatient/admissions`
- **Automated test:** Passed

### 7.5 Patient workspace (inpatient)

- **Access:** Click bed card on ward board
- **Tabs / actions:** Overview, timeline, doctor reviews, nursing notes, vitals, medication (MAR), lab, radiology, documents, transfers, discharge
- **Forms:** Use `submitClinicalForm` — **working** after FormData fix
- **Automated test:** Progress notes, vitals, observations, MAR, discharge — all passed via API

### 7.6 What still needs polish for IPD

- Nursing command center visual redesign
- Consultant rounds UX
- Reserved/cleaning bed actions from board (partial)
- Deeper sticky patient context on all tabs

---

## 8. Emergency department — detailed status

### 8.1 Emergency Command Center

- **Route:** Emergency → Emergency
- **Features:**
  - Metric cards: patients today, waiting, critical, resuscitation, pending admissions/transfers/discharges
  - **Triage breakdown:** Red / Orange / Yellow / Green / Black / Awaiting triage
  - Emergency arrival registration (patient search, no manual IDs)
  - Treatment bay board
  - Priority queue (critical first)
- **UI:** `workspace-shell`, command-center layout
- **File:** `frontend/src/components/emergency/EmergencyCommandCenter.tsx`

### 8.2 Emergency patient workspace

- **Access:** Click queue patient or bay occupant
- **Tabs:** Notes, vitals, orders, lab, radiology, medication, timeline, disposition
- **Disposition outcomes:** Discharge home, admit to ward (IPD), transfer ICU/HDU/Theatre/Maternity, external referral, deceased
- **Architecture:** Emergency is **temporary** — patients must end with a disposition; ICU/HDU are **not** inside ED structure

---

## 9. Investigations (Lab & Radiology)

### 9.1 Laboratory

- **Kanban columns:** Requested → Collected → Processing → Completed → Verified
- **Critical results banner**
- **Order from:** Doctor consultation, IPD workspace, ED workspace (shared `ClinicalInvestigationOrders`)
- **Notifications:** Auto-notify on verify + critical results
- **UI:** `workspace-shell`, `lab-kanban` CSS grid
- **List 500:** Fixed

### 9.2 Radiology

- **Kanban:** Requested → Scheduled → In progress → Reported → Verified
- **Report entry + PDF attach**
- **Verify → notifies ordering clinician**
- **UI:** `workspace-shell`, card columns
- **List 500:** Fixed

### 9.3 Results Inbox

- Doctor-facing inbox for verified results (existing screen in App)

---

## 10. Maternity service line

- **Route:** Specialty → Maternity
- **Sub-areas:** Dashboard, ANC clinic, Labour ward, Mother–baby registry, Birth register, Unit boards (postnatal/nursery/NICU)
- **Features added recently:**
  - Visual partograph (`PartographChart.tsx`)
  - Newborn MRN registration from delivery
  - Baby rename UI
  - Birth register export
- **Status:** Foundation + polish; not yet at same depth as Reception/OPD

---

## 11. Administration & reports

- **Hospital Control Center:** Org profile, wards, clinical config, system health
- **Notifications inbox:** Lab critical, results ready, referrals
- **Operations Command Center:** Executive metrics
- **OPD / Clinical reports:** CSV export dashboards
- **User/role management:** In App admin section (admin login)

---

## 12. Architecture decisions (Phase Next)

### Emergency vs IPD

```text
EMERGENCY (temporary)
├── Triage
├── Treatment bays
├── Observation
└── Disposition → Ward | ICU | HDU | Theatre | Maternity | External | Discharge

IPD (final destinations)
├── Male / Female / Pediatric / Isolation wards
├── ICU
└── HDU

MATERNITY
├── ANC, Labour, Postnatal, Nursery, NICU
```

Emergency **does not** contain ICU/HDU as wards — it **transfers** to them.

---

## 13. UI / UX polish status

### Applied patterns

| Pattern | Where |
|---------|-------|
| `workspace-shell` | Reception check-in, registration, appointments, referrals, sick sheets, documents, triage, doctor consult, lab, radiology, IPD, ED |
| `WorkspaceTabs` | Doctor consultation, ED patient workspace |
| Card kanban | Lab, radiology worklists |
| Bed card grid | IPD ward board |
| Hamburger + icons | Mobile/tablet (`AppMobileNav`) |
| Touch targets | Min 44–48px inputs/buttons on mobile |
| Live sick sheet preview | Sick Sheets screen |

### Spacing (`frontend/src/index.css`)

```css
.workspace-shell gap: 2rem (mobile) → 2.5rem (tablet) → 3rem (desktop)
```

**Not every screen** uses `workspace-shell` yet (e.g. Patient Search, some admin panels).

---

## 14. Automated tests already run (proof)

All tests run against Docker on `localhost` with demo tenant.

### 14.1 OPD + Reception API — 15/15 passed

Script: `ops/opd-workflow-test.sh`

| Step | Action |
|------|--------|
| 1 | Login |
| 2 | Patient search |
| 3 | OPD check-in |
| 4 | Triage board + queue |
| 5 | Record triage |
| 6 | Doctor queue |
| 7 | SOAP consultation |
| 8 | Diagnosis |
| 9 | Referral |
| 10 | Sick sheet |
| 11 | List sick sheets |
| 12 | Appointment + lists |
| 13 | Patient timeline |
| 14 | Complete encounter |
| 15 | Referrals list |

Log: `ops/onboarding-tests/results/opd-api-*.log`

### 14.2 IPD API — 13/13 passed

Script: `ops/ipd-workflow-test.sh`

Admit → nursing (2 days) → MAR → referral → discharge summary → discharge → appointments list.

### 14.3 UI screenshots + screen recording — passed

Script: `ops/onboarding-tests/specs/reception-opd.spec.ts` (Playwright)

| Artifact | Location |
|----------|----------|
| 10 screenshots | `ops/onboarding-tests/results/screenshots/01-login-success.png` … `10-register-patient.png` |
| Screen recording | `ops/onboarding-tests/results/videos/reception-opd-workflow.webm` |
| HTML report | `ops/onboarding-tests/results/playwright-report/index.html` |
| Written report | `ops/onboarding-tests/results/ONBOARDING-REPORT.md` |

**Note:** Playwright tests **navigate and capture** each screen. They do **not** auto-fill every form in the browser — API scripts prove submit flows work.

---

## 15. Manual self-assessment — reception (step by step)

Use **records officer** or **admin** login. Allow ~45 minutes.

### A. Environment check

- [ ] `http://localhost:8080` loads
- [ ] Login with tenant `demo`, `admin@demo.afyasasa.local`, `ChangeMe123!`
- [ ] Sidebar shows Reception group expanded
- [ ] Resize browser to phone width — hamburger menu works, icons visible

### B. Patient Search

- [ ] Search `Brian` → results appear
- [ ] Open profile → allergies, identifiers visible
- [ ] No console errors (F12 → Console)

### C. Register Patient (optional — don’t duplicate Brian)

- [ ] Search fake name `Test Onboarding`
- [ ] If no match → continue registration
- [ ] Submit with required fields only

### D. OPD Check-In

- [ ] Select existing patient
- [ ] Step 2: choose clinic + visit type
- [ ] Step 3: confirm → success message
- [ ] Go to Triage Queue — patient should appear

### E. Appointments

- [ ] Lists load (no “Internal server error”)
- [ ] Book appointment for same patient
- [ ] See it under Today or Upcoming

### F. Referrals

- [ ] Select patient
- [ ] Fill reason + letter → **Save referral**
- [ ] Must **not** show FormData error
- [ ] Referral appears in right-hand list
- [ ] Print/PDF opens

### G. Sick Sheets

- [ ] Select patient
- [ ] Fill diagnosis, dates, doctor
- [ ] Live preview updates on the right
- [ ] **Save** → success
- [ ] **Print/PDF** opens
- [ ] History shows new entry

### H. Medical Documents

- [ ] Select same patient
- [ ] Documents list loads (timeline + sick sheets)
- [ ] Filter and search work

**Pass criteria for reception onboarding:** Sections D, F, G must save without errors.

---

## 16. Manual self-assessment — full OPD journey

Use **nurse** then **doctor** login (or admin for all-in-one).

| Role | Email |
|------|-------|
| Nurse | `nurse@demo.afyasasa.local` |
| Doctor | `doctor@demo.afyasasa.local` |

### Nurse — Triage

- [ ] Outpatient → Triage Queue
- [ ] Select checked-in patient
- [ ] Enter vitals (use quick-fill buttons or spinners)
- [ ] Chief complaint + triage colour
- [ ] Submit → patient leaves triage queue / appears in doctor queue

### Doctor — Consultation

- [ ] Outpatient → Doctor Queue
- [ ] Select patient (triage colour visible)
- [ ] Tab **Consultation** → save SOAP
- [ ] Add diagnosis below SOAP form
- [ ] Tab **Investigations** → order a lab test (patient context auto-linked)
- [ ] Tab **Referrals** → create referral
- [ ] Complete visit

### Verify downstream

- [ ] Laboratory worklist shows new request
- [ ] Medical Documents / Timeline shows consultation + referral
- [ ] Notifications inbox may show activity (if enabled)

---

## 17. Manual self-assessment — inpatient

- [ ] Inpatient → Inpatient (IPD) — dashboard loads metrics
- [ ] Admit patient OR use existing admission
- [ ] Open ward → see **bed cards** (not a plain table)
- [ ] Click occupied bed → patient workspace opens
- [ ] Add nursing note, vitals, MAR entry — each saves without error
- [ ] Create discharge summary → complete → discharge
- [ ] Bed returns to available/cleaning on ward board

Automated API proof: `bash ops/ipd-workflow-test.sh`

---

## 18. How to re-run automated tests

```bash
# Health only
npm run smoke

# OPD + reception API (15 steps)
bash ops/opd-workflow-test.sh

# IPD API (13 steps)
bash ops/ipd-workflow-test.sh

# Full suite: both APIs + Playwright screenshots + video
bash ops/run-onboarding-tests.sh
```

Playwright HTML report (after UI test):

```bash
xdg-open ops/onboarding-tests/results/playwright-report/index.html
```

---

## 19. Demo patients & seeded data

From migration seed (see `README.md`):

- **3+ patients** with identifiers and clinical flags
- **Wards:** General Ward, HDU, Maternity Ward (+ more after migrations)
- **8+ beds** across wards
- **Demo users** for each role

**Heavily used in tests:** Brian Kipyego — `DEMO-2026-00004`  
Search: `Brian`, `0795553007`, or `DEMO-2026-00004`

After OPD/IPD test runs, Brian may have multiple encounters, referrals, and sick sheets — good for testing **Medical Documents** and **Timeline**.

---

## 20. Known limitations & honest gaps

| Issue | Severity | Notes |
|-------|----------|-------|
| Playwright does not fill every form in UI | Low | API tests cover saves |
| Some admin/theatre screens still form-heavy | Medium | Not reception-critical |
| Patient Search layout not yet `workspace-shell` | Low | Cosmetic |
| IPD nursing command center needs visual polish | Medium | Functional |
| Rare list endpoints may still have TypeORM undefined filters | Low | Report 500 + screen name |
| Admin forced password change on first login | Info | Change password when prompted |
| Medical Documents is view-only aggregation | Info | Uploads go via lab/radiology/sick sheet flows |
| No production HA / backups configured in compose | High for go-live | See `docs/production-hardening-notes.md` |

If you see **500 Internal Server Error**:

1. Note exact screen and action
2. Check `npm run logs` or `docker compose logs backend`
3. Often was list/filter — may be an unfixed `where: { field: undefined }` pattern

If you see **FormData error**:

1. Hard refresh — you may be on old frontend bundle
2. Rebuild: `docker compose build frontend && docker compose up -d frontend`

---

## 21. Recommended next priorities

**For reception go-live this week:**

1. Staff walkthrough using Section 15 checklist
2. Train on OPD Check-In → Triage handoff (Section 16)
3. Keep admin login for first week; introduce role-specific logins after

**After reception:**

1. IPD deep polish (patient workspace tabs, nursing command center)
2. Emergency disposition → IPD admit integration testing
3. Lab/radiology role-specific logins (`lab@`, `radiology@`)
4. Production hardening + backup strategy

---

## 22. Key file locations (for developers)

| Area | Path |
|------|------|
| Navigation config | `frontend/src/lib/navigation.ts` |
| Mobile menu | `frontend/src/components/layout/AppMobileNav.tsx` |
| Form utilities (FormData fix) | `frontend/src/lib/form-utils.ts` |
| Global spacing CSS | `frontend/src/index.css` |
| OPD check-in | `frontend/src/components/opd/OpdCheckInWorkspace.tsx` |
| Triage | `frontend/src/components/opd/TriageWorkspace.tsx` |
| Doctor consult | `frontend/src/components/DoctorConsultationWorkspace.tsx` |
| Referrals | `frontend/src/components/referrals/ReferralWorkspace.tsx` |
| Sick sheets | `frontend/src/components/documents/SickSheetWorkspace.tsx` |
| IPD ward board | `frontend/src/components/ipd/WardDashboard.tsx` |
| ED command center | `frontend/src/components/emergency/EmergencyCommandCenter.tsx` |
| Lab kanban | `frontend/src/components/investigations/LabWorklist.tsx` |
| OPD API test | `ops/opd-workflow-test.sh` |
| IPD API test | `ops/ipd-workflow-test.sh` |
| UI capture tests | `ops/onboarding-tests/` |
| Onboarding artifacts | `ops/onboarding-tests/results/` |

---

## Summary for your assessment

**Ready for you to test now:**

- Full **reception** workflow (check-in, appointments, referrals, sick sheets, documents)
- Full **OPD** path (triage → doctor → complete)
- **IPD** admit → clinical entries → discharge (API-proven; UI trial-ready)
- **Emergency**, **Lab**, **Radiology**, **Maternity** — functional with recent UI upgrades

**Evidence on disk:**

- `docs/onboarding-self-assessment-guide.md` (this file)
- `ops/onboarding-tests/results/ONBOARDING-REPORT.md`
- `ops/onboarding-tests/results/screenshots/` (10 PNGs)
- `ops/onboarding-tests/results/videos/reception-opd-workflow.webm`

Start with **Section 15** (reception checklist), then **Section 16** (OPD), then explore IPD and Emergency at your pace.
