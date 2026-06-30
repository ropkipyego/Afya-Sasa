# AfyaSasa Reception Onboarding — Test Report

**Generated:** 2026-06-25  
**Environment:** Docker (`localhost:8080` frontend, `localhost:3000` API)  
**Tenant:** `demo` · **User:** `admin@demo.afyasasa.local`

---

## Executive summary

| Suite | Result | Steps |
|-------|--------|-------|
| **OPD + Reception API** | ✅ PASSED | 15/15 |
| **IPD API** | ✅ PASSED | 13/13 |
| **UI screenshots + video** | ✅ PASSED | 10 screens captured |

The system is ready for reception staff onboarding this week.

---

## What was fixed before testing

### 1. Form submission crash (frontend)
**Error:** `Failed to construct 'FormData': parameter 1 is not of type 'HTMLFormElement'`

**Cause:** Forms passed `FormEvent` to mutations that expected `HTMLFormElement` (or vice versa).

**Fix:** All mutations now use `formDataFromElement(formElement)` and submit handlers pass `event.currentTarget`.

**Affected modules:** Referrals, sick sheets, appointments, OPD check-in, triage, doctor consultation, emergency, lab, radiology, maternity, IPD nursing.

### 2. Internal server error on lists/documents (backend)
**Error:** `TypeORMError: Undefined value encountered in property ... of a where condition`

**Cause:** List endpoints passed `undefined` filter values to TypeORM `where` clauses.

**Fixed endpoints:**
- `GET /appointments` and `/appointments/today`
- `GET /referrals`
- `GET /opd/sick-sheets` (with and without `patientId`)
- `GET /laboratory/requests`
- `GET /radiology/requests`
- `GET /inpatient/beds`
- `GET /opd/encounters`

### 3. UI spacing (reception-friendly)
- `workspace-shell` gaps increased (2rem → 2.5rem → 3rem on large screens)
- Medical Documents center uses `workspace-shell` padding

---

## OPD + Reception workflow tested (API)

Simulated full patient journey for **Brian Kipyego** (`DEMO-2026-00004`):

1. Login  
2. Patient search  
3. **OPD check-in** → new encounter  
4. Triage board + queue  
5. **Triage** (vitals + category)  
6. Doctor queue  
7. **SOAP consultation**  
8. Diagnosis (ICD-10)  
9. **Internal referral** (Physiotherapy)  
10. **Sick sheet** issued (3 days)  
11. Sick sheets list (documents)  
12. **Appointment** booked + list  
13. Patient timeline (27 events — documents center)  
14. Encounter completed  
15. Referrals list  

**Latest encounter:** `a3690e0c-72be-48b6-961e-3962210e8642`  
**Latest sick sheet:** `5920452b-d170-4505-a0eb-de12d7d913b7`  
**Latest referral:** `160233d7-2fed-4f1c-935e-4084b5d437fe`

Log: `results/opd-api-20260625T114824Z.log`  
Summary JSON: `results/opd-api-summary-20260625T114824Z.json`

---

## IPD workflow tested (API)

1. Admit → bed board  
2. Day 1: progress note + vitals + nursing observation  
3. MAR medication  
4. Day 2: progress note + vitals  
5. Referral  
6. Discharge summary + discharge  
7. Appointments list  

---

## UI capture (screenshots + screen recording)

### Screenshots (`results/screenshots/`)

| File | Screen |
|------|--------|
| `01-login-success.png` | Login |
| `02-patient-search.png` | Patient Search |
| `03-opd-checkin.png` | OPD Check-In |
| `04-appointments.png` | Appointments |
| `05-referrals.png` | Referrals |
| `06-sick-sheets.png` | Sick Sheets |
| `07-medical-documents.png` | Medical Documents |
| `08-triage-queue.png` | Triage Queue |
| `09-doctor-queue.png` | Doctor Queue |
| `10-register-patient.png` | Register Patient |

### Screen recording

- **Video:** `results/videos/reception-opd-workflow.webm`  
- **Playwright HTML report:** `results/playwright-report/index.html` (open in browser)

---

## How to re-run all tests

```bash
# API only
bash ops/opd-workflow-test.sh
bash ops/ipd-workflow-test.sh

# Full suite (API + UI capture)
bash ops/run-onboarding-tests.sh
```

---

## Reception onboarding checklist (for staff)

Use demo credentials: `admin@demo.afyasasa.local` / `ChangeMe123!` · tenant `demo`

- [ ] **Patient Search** — find patient by name, phone, or number  
- [ ] **Register Patient** — search first; only register if no match  
- [ ] **OPD Check-In** — 3 steps: patient → visit details → confirm  
- [ ] **Appointments** — book follow-up; check Today / Upcoming tabs  
- [ ] **Referrals** — select patient, fill letter, Save (no encounter ID needed)  
- [ ] **Sick Sheets** — select patient, live preview, Save + Print/PDF  
- [ ] **Medical Documents** — select patient to see timeline + sick sheets  
- [ ] **Triage Queue** — nurse: vitals + submit to doctor queue  
- [ ] **Doctor Queue** — SOAP, diagnosis, investigations, referrals tabs  

---

## Known limitations

- Playwright tests **navigate and capture** screens; they do not yet auto-fill every form in the browser (API tests cover submit flows).
- Use **hard refresh** (`Ctrl+Shift+R`) after deploy to load latest frontend.
- If you see 500 errors on a list screen, report the exact screen — we fixed the known TypeORM patterns but more may exist in rarely-used modules.
