# AfyaSasa — Lab, Documents & Onboarding Progress Report

*Generated after lab module hardening, hospital document library, and catalog bulk import work.*

---

## What was fixed and delivered

### 1. Laboratory request submission

| Issue | Fix |
|-------|-----|
| Orders failed when patient had no active OPD visit | Lab orders now auto-create a **laboratory walk-in encounter** (`LAB-YYYY-#####`) when no visit exists |
| Lab technician could not place orders | Migration grants `lab_requests:create`, `files:upload`, `files:download` to **lab_technician** |
| Panel orders did not expand to tests | Ordering a panel now creates **one line per analyte** in the panel; empty panels stay as panel rows |
| Invalid test/panel IDs created empty requests | Backend validates IDs and rejects orders with **zero valid items** |
| Errors were silent in worklist | Lab worklist mutations now surface errors via **toast notifications** |

### 2. Lab PDF upload (lab technician → doctor / reception)

| Capability | Location |
|------------|----------|
| Upload PDF on a lab request | **Laboratory** worklist → select request → **Upload lab report PDF** |
| View / print / download / delete | Same panel (lab tech); **Medical Documents** for patient-centric access |
| API | `POST /laboratory/requests/:id/attachments`, `DELETE /laboratory/attachments/:id` |
| Patient lab PDFs | `GET /laboratory/patients/:patientId/attachments` shown in **Medical Documents** |

After upload, request moves to **resulted** status. Verify still required before clinician inbox notification (structured results **or** PDF required).

### 3. Hospital-wide document library

| Role | How |
|------|-----|
| **Admin** | Hospital Control Center → **Hospital document library** — publish PDF/Word/images |
| **All staff** | Sidebar → **Hospital Library** — search, view, print, download |
| API | `GET/POST /documents/hospital`, `DELETE /documents/hospital/:id` |

Categories: policy, protocol, form, training, memo, general. Audience tags: all, clinical, lab, radiology, nursing, reception, admin.

### 4. Lab catalog bulk onboarding

| Step | Action |
|------|--------|
| 1 | Hospital Control Center → **Laboratory catalog** |
| 2 | **Download CSV template** (`/templates/lab-catalog-import-template.csv`) |
| 3 | Fill rows: `record_type` = `panel` or `test`, plus codes, sample types, reference ranges |
| 4 | **Upload filled CSV** — panels and tests import in one pass |

API: `POST /laboratory/tests/import` with `{ "csv": "..." }`.

Starter template also in repo: `docs/templates/lab-catalog-import-template.csv`.

---

## Database migration required

Run migrations after deploy (or `docker compose up` if migrations run on startup):

```
1766600000000-LabAttachmentsHospitalDocs.ts
```

Creates:

- `demo.lab_attachments`
- `demo.hospital_documents`
- Permissions: `lab_attachments:*`, `hospital_documents:*`, `documents:delete`, expanded lab tech grants

---

## How to test (demo tenant)

1. **Rebuild stack:** `docker compose up -d --build`
2. **Lab order:** Login as `lab@demo.afyasasa.local` → Laboratory → New request → pick patient + test → Send
3. **PDF:** Open request → upload PDF → Verify & notify doctor
4. **Reception view:** Login as `records@demo.afyasasa.local` → Medical Documents → select patient → lab PDF row → View/Print
5. **Hospital docs:** Admin → Hospital Library (nav or Control Center) → publish a policy PDF → all roles can browse
6. **Bulk catalog:** Admin → Laboratory catalog → download template → upload CSV

---

## Overall platform progress (high level)

| Area | Status | Notes |
|------|--------|-------|
| Core EMR (patients, OPD, IPD, ED) | **Strong** | Workflows scaffolded and demo-seeded |
| Hospital Control Center | **Strong** | Card home, modules, catalogs, templates |
| Laboratory | **Improved** | Submit fix, PDF attach, bulk import |
| Radiology | **Good** | PDF attach pattern (lab now matches) |
| MOH reports (705A/B, 706, 717) | **Good** | JSON + DOCX when templates uploaded |
| DOCX print templates | **Good** | Sick sheet, referral, MOH forms |
| Hospital document portal | **New** | Admin publish + staff library |
| Production hardening | **In progress** | See `docs/go-live-checklist.md` |
| Free test hosting | **Documented** | `docs/free-test-hosting-guide.md` |

---

## Recommended next steps

1. **Run migration** on your Docker volume if stack was already up before this change.
2. **Import your real lab catalog** via CSV (hundreds of tests in one upload).
3. **Upload official MOH DOCX forms** in Document Templates for regulatory exports.
4. **Publish hospital SOPs** to Hospital Library so all departments have one source of truth.
5. **End-to-end smoke:** `npm run smoke` and `bash ops/opd-workflow-test.sh` after rebuild.

---

## Key file reference

| Area | Paths |
|------|-------|
| Lab service | `backend/src/laboratory/laboratory.service.ts` |
| Lab worklist UI | `frontend/src/components/investigations/LabWorklist.tsx` |
| Hospital library | `frontend/src/components/documents/HospitalLibrary.tsx` |
| Lab bulk import UI | `frontend/src/components/admin/panels/LabCatalogPanel.tsx` |
| CSV template | `docs/templates/lab-catalog-import-template.csv` |
| Migration | `backend/src/database/migrations/1766600000000-LabAttachmentsHospitalDocs.ts` |
