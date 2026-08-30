# AfyaSasa Core Workflow Map

**Generated:** 2026-08-28  
**Purpose:** Map the **existing implementation** against required hospital workflows. This is an engineering audit document, not a product promise.  
**Baseline:** Jalaram Hospital single-tenant pilot (`jalaram` login code; PostgreSQL schema `demo` for TypeORM entities).

---

## Architecture inventory (summary)

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React + Vite + Tailwind | Label-based navigation in `App.tsx` (no React Router) |
| Backend | NestJS + TypeORM | 33 domain modules under `backend/src/` |
| Database | PostgreSQL | Schema `demo` on all clinical entities |
| Cache/queue | Redis + BullMQ | SMS queue, notification processor |
| Files | MinIO (S3-compatible) | Lab/radiology attachments, DOCX templates |
| Auth | JWT + refresh + RBAC | Server-side permission guards |
| Audit | Global HTTP interceptor | `demo.audit_logs` |
| Realtime | Socket.IO | Tenant-scoped publish (some `demo` fallbacks remain) |

### Backend modules (clinical)

| Module | Path | Role |
|--------|------|------|
| Patients | `backend/src/patients/` | Registration, search, identifiers, timeline |
| OPD | `backend/src/opd/` | Encounters, triage, consultation, diagnoses |
| Appointments | `backend/src/appointments/` | Scheduling |
| Laboratory | `backend/src/laboratory/` | Catalog, requests, samples, results |
| Radiology | `backend/src/radiology/` | Modalities, requests, reports |
| Clinical order | `backend/src/clinical-order/` | Unified order mirror (lab/rad/pharmacy stub) |
| Workflow | `backend/src/workflow/` | Encounter status transitions (partially wired) |
| Inpatient | `backend/src/inpatient/` | Wards, beds, admissions, discharge |
| Emergency | `backend/src/emergency/` | ED bays, triage, disposition |
| Nursing | `backend/src/nursing/` | Vitals, MAR, shift notes |
| Referrals | `backend/src/referrals/` | Referral letters |
| Worklists | `backend/src/worklists/` | Cross-department queues |
| Notifications | `backend/src/notifications/` | SMS + internal inbox |
| Reporting | `backend/src/reporting/` | Clinical + MOH reports |
| Theatre / Maternity / ICU / HDU | respective folders | Specialty scaffolding |

**Not implemented as of 2026-08-29:** Unified document store, SHA/HIE integration service, notification event bus (dispatcher scaffold exists but unwired). **Inventory engine is implemented** — see `backend/src/inventory/`.

### Frontend screens (by workflow)

Navigation defined in `frontend/src/lib/navigation.ts`, rendered in `frontend/src/App.tsx`.

| Workflow | Screen | Component |
|----------|--------|-----------|
| Registration | Register Patient | `PatientRegistrationForm.tsx` |
| Search | Patient Search | `PatientSearchAutocomplete.tsx` |
| OPD check-in | OPD Check-In | `OpdCheckInWorkspace.tsx` |
| Triage | Triage Queue | `Triageworkspace.tsx` |
| Doctor | Doctor Queue | `App.tsx` + `DoctorConsultationWorkspace.tsx` |
| Lab | Laboratory / Lab Dashboard | `LabWorklist.tsx`, `LabDashboard.tsx` |
| Imaging | Radiology / Imaging Dashboard | `RadiologyWorklist.tsx`, `ImagingDashboard.tsx` |
| Results review | Results Inbox | `App.tsx` (ResultsInbox) |
| IPD | Inpatient (IPD) | `IpdModule.tsx` |
| ED | Emergency | `EmergencyCommandCenter.tsx` |
| Pharmacy (pilot) | Pharmacy | `PharmacyWorkspace.tsx` |
| Inventory & Store | Inventory & Store | `InventoryModule.tsx` |
| Pharmacy (legacy) | Clinical Orders | `ClinicalOrdersDashboard.tsx` |
| Timeline | Patient Timeline | `PatientTimeline.tsx` |
| Admin | Hospital Control Center | `HospitalControlCenter.tsx` |

---

## WORKFLOW 1 — Patient registration

### Required flow

```
PATIENT ARRIVES → SEARCH → FOUND? → OPEN / REGISTER → PATIENT ID → IDENTIFIERS → ENCOUNTER → QUEUE
```

### Current implementation

| Step | Backend | Frontend | Persisted? |
|------|---------|----------|------------|
| Search | `GET /patients?q=` — `patients.service.ts` | `PatientSearchAutocomplete.tsx` | Yes |
| Register | `POST /patients` — creates `Patient`, `PatientIdentifier`, `PatientNextOfKin` | `PatientRegistrationForm.tsx` | Yes |
| Patient number | `formatHospitalNumber('patient')` → `JH-YYYY-NNNNN` | Shown on card/header | Yes |
| Identifiers | `PatientIdentifier` (national_id, sha, passport, etc.) | Compulsory ID field | Yes |
| SHA capture | `type: 'sha'` on identifier — **capture only** | Registration form | Yes (no external verify) |
| Encounter | **Separate step** — OPD check-in creates encounter | Not auto on registration | Yes (when check-in runs) |
| Queue | Worklist `registration/today` | `OperationalWorklists.tsx` | Yes |

**Single patient record:** One `demo.patients` row reused across all modules. No department-specific duplicate patients.

**Gap:** Registration does not auto-create an encounter (by design — reception check-in is separate). External SHA failure does not block registration (correct).

---

## WORKFLOW 2 — OPD

### Required flow

```
RECEPTION → CHECK-IN → TRIAGE → DOCTOR QUEUE → CONSULTATION → DIAGNOSIS → ORDERS → RESULTS → REVIEW → DISPOSITION
```

### Current implementation

| Step | API | Entity / status | Persisted? |
|------|-----|-----------------|------------|
| Check-in | `POST /opd/encounters` | `Encounter` status `registered` | Yes |
| Triage | `POST /opd/encounters/:id/triage` | `TriageAssessment` + status `triaged` | Yes |
| Doctor queue | `GET /opd/doctor/queue` | Encounters `triaged`, sorted by colour | Yes |
| Consultation | `POST .../consultations` | `Consultation` + status `in_consultation` | Yes |
| Diagnosis | `POST .../diagnoses` | `EncounterDiagnosis` | Yes |
| Lab order | `POST /laboratory/requests` + mirror | `LabRequest` + `ClinicalOrder` | Yes |
| Imaging order | `POST /radiology/requests` + mirror | `RadiologyRequest` + `ClinicalOrder` | Yes |
| Pharmacy order | `POST /clinical-orders/pharmacy` + `POST /inventory/dispense/pharmacy` | `ClinicalOrder` mirror + ledger DISPENSE | Yes |
| Referral | `POST /referrals` | `Referral` | Yes |
| Sick sheet | `POST /opd/sick-sheets` | `SickSheet` | Yes |
| Complete | `PATCH .../status` → `completed` | `Encounter.status` | Yes |
| Admit | `POST /inpatient/admissions` | `Admission` + bed | Yes |

**Gaps (2026-08-29 audit):**
- ~~Preferred doctor on check-in not saved~~ — **Fixed:** `attendingDoctorId` persisted at create; **caveat:** overwritten when a different doctor starts consultation (`createConsultation` sets `request.user.sub`).
- OPD status updates use `EncounterWorkflowService` (triage, consult, complete, guarded PATCH). **ED/IPD still bypass** workflow in places.
- Clinician review tracked on `LabResult.reviewedAt` / `RadiologyReport.reviewedAt` (separate from verification).
- Pharmacy dispense not yet on patient timeline.

---

## WORKFLOW 3 — Triage

```
Patient → Triage queue → Nurse → Vitals → Priority → Doctor queue
```

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Vitals persist | `TriageAssessment` (temp, pulse, BP, SpO2, etc.) | Yes |
| Priority persist | `colour` + `category` (Manchester-style) | Yes |
| Triage user recorded | `createdBy` on auditable entity | Yes |
| Timestamp | `createdAt` | Yes |
| Doctor receives patient | `Encounter.status = triaged` → doctor queue | Yes |
| No UUID in UI | Patient name + `encounterNo` in triage cards | Mostly yes |

Frontend: `TriageWorkspace.tsx` (modal submit, countdown toast on success).

ED triage is separate: `EmergencyEncounter.triageCategory` in `emergency.service.ts`.

---

## WORKFLOW 4 — Orders (unified model)

### Target lifecycle

```
ORDERED → ACCEPTED → IN PROGRESS → COMPLETED → RESULT AVAILABLE → CLINICIAN REVIEWED
```

### Current model

Two layers:

1. **Source records** — `LabRequest`, `RadiologyRequest`, pharmacy stub
2. **Mirror index** — `ClinicalOrder` (`clinical_orders` table)

`ClinicalOrder` fields: patient, encounter, admission, orderType, sourceModule, sourceRecordId, status, priority, orderedBy, orderedAt, completedAt, metadata.

| Order type | Source table | Status lifecycle | Clinician review |
|------------|--------------|------------------|------------------|
| Laboratory | `lab_requests` / `lab_results` | requested → sample_collected → processing → resulted → verified | `LabResult.reviewedAt` (separate from verified) |
| Radiology | `radiology_requests` / `radiology_reports` | requested → scheduled → in_progress → reported → verified | `RadiologyReport.reviewedAt` |
| Pharmacy | `ClinicalOrder` mirror + inventory dispense | requested → dispensed | Not on timeline yet |
| Referral | `referrals` | own status | N/A |

**Gap:** "Completed" and "clinician reviewed" are conflated in some UI but **separate columns** exist on lab/radiology results. Pharmacy has no real source record.

---

## WORKFLOW 5 — Laboratory

```
ORDER → QUEUE → COLLECT → RECEIVE → PROCESS → RESULT → VERIFY → AVAILABLE → DOCTOR REVIEW
```

| Step | API / service | Status |
|------|---------------|--------|
| Order | `LaboratoryService.createRequest` | Yes |
| Queue | `GET /laboratory/requests`, worklists | Yes |
| Sample collect | `POST .../collect` | Yes |
| Result entry | `POST /laboratory/results` | Yes |
| Verification | `POST .../verify` | Yes |
| Critical alert | Notifications + realtime | Yes |
| Doctor inbox | `GET /laboratory/results/inbox`, `ResultsInbox` UI | Yes |
| Clinician review | `POST .../review` sets `reviewedAt` | Yes |
| Encounter link | Via `ClinicalOrderContextService` | Yes |
| Mirror sync | `ClinicalOrderMirrorService` | Yes |

Doctor can order from `ClinicalInvestigationOrders.tsx` and see results in Results Inbox with patient name (not UUID).

---

## WORKFLOW 6 — Imaging

Parallel to lab:

| Step | Status |
|------|--------|
| Request | Yes — `RadiologyService` |
| Worklist / dashboard | Yes — white-screen fix applied |
| Report write | Yes |
| Verify | Yes |
| Review | Yes — `reviewedAt` separate from verification |
| Attachments | Yes — MinIO storage |

---

## WORKFLOW 7 — Pharmacy

**Architectural rule:** Pharmacy and Main Store share one inventory engine; pharmacy is a **location/custodian** for medicines.

| Required | Current (2026-08-29) |
|----------|----------------------|
| Prescription entity | `ClinicalOrder` mirror (`POST /clinical-orders/pharmacy`) |
| Pharmacy queue | `PharmacyWorkspace.tsx` + `ClinicalOrdersDashboard.tsx` |
| Dispense | `POST /inventory/dispense/pharmacy` — FEFO batch debit + ledger |
| Stock check / batch / expiry | `inventory_batches`; pharma receipt requires batch+expiry |
| Inventory transaction | `inventory_transactions` type `DISPENSE` |
| Patient medication record | Consult tab + MAR (IPD); **not on patient timeline yet** |

Doctor prescribes from `DoctorConsultationWorkspace.tsx` or `PharmacyWorkspace.tsx` → dispense via inventory module.

**Gaps:** Medication→SKU heuristic (paracetamol only); pharmacy permissions reuse `lab_requests:read`; timeline events missing.

---

## WORKFLOW 8 — Main Store

| Required | Current |
|----------|---------|
| Location | `MAIN_STORE` inventory location |
| Requisitions from departments | `inventory_requisitions` + lines |
| Approve / issue / acknowledge | Full API + `InventoryModule.tsx` UI |
| Auto-routing | Non-pharmaceutical items → main store; pharmaceutical → pharmacy |

**Gap:** Requisition issue debits source location but **does not credit destination** batch balances.

---

## WORKFLOW 9–14 — Inventory engine, routing, ledger, transfers

**Implemented** in `backend/src/inventory/` + `InventoryModule.tsx`:

| Capability | Status |
|------------|--------|
| Item master + categories | ✅ |
| Locations (PHARMACY, MAIN_STORE, WARD-*) | ✅ |
| Receipts (GRN) | ✅ |
| Ledger (`inventory_transactions`) | ✅ writes; ❌ no read API/UI |
| Requisitions + auto-routing | ✅ (destination credit gap) |
| Transfers (ship/receive) | ✅ |
| FEFO dispense | ✅ |
| Returns / adjustments / stock take | ❌ types in entity; no endpoints |

See `docs/inventory-architecture.md` for full design.

---

## WORKFLOW 15 — IPD

```
ADMISSION → BED → WARD → NURSING → ROUNDS → ORDERS → REVIEW → TRANSFER / DISCHARGE
```

| Step | Implementation | Status |
|------|----------------|--------|
| Admit | `POST /inpatient/admissions` | Yes |
| Bed assignment | `Bed.status = occupied` | Yes |
| Ward board | `WardDashboard.tsx` + `getWardCensus` | Yes |
| Consultant name | `getWardCensus` loads `admittingDoctor` relation | ✅ |
| Transfers | `BedTransferLog` | Yes |
| Discharge | Requires completed discharge summary | Yes |
| Bed freed | Status → `cleaning` then `available` | Yes |
| Vitals / MAR | `nursing.service.ts` | Yes |

Wards seeded: General Male/Female, Paediatrics, Surgical Private (`1767300000000-ProductionWardsLayout.ts`).

---

## WORKFLOW 16 — Emergency

```
ARRIVAL → ED ENCOUNTER → TRIAGE → QUEUE → ASSESSMENT → ORDERS → REASSESS → DISPOSITION
```

Uses shared `Patient` + `Encounter` (type `emergency`) + `EmergencyEncounter`.

| Component | Path | Status |
|-----------|------|--------|
| Command center | `EmergencyCommandCenter.tsx` | Scaffolded |
| Bays | `EmergencyTreatmentBay` | Seeded |
| Disposition | admit / discharge / transfer / refer | Partial |
| Clinician name | `assignedClinician` relation resolved in service | Yes |

---

## WORKFLOW 17 — Maternity

Specialized on common patient engine: `MaternityServiceLine.tsx` orchestrates ANC, labour, partograph, delivery, newborn, registry.

Mother–baby link: `MotherBabyLink`, separate baby `Patient` record on delivery.

---

## WORKFLOW 18 — Theatre

`TheatreWorkspace.tsx` — booking, stages, team assignment. Supply routing to pharmacy/store **not implemented**.

---

## WORKFLOW 19 — Patient timeline

**Single computed timeline** — no separate timeline table.

- API: `GET /patients/:id/timeline` — `patients.service.ts`
- Aggregates: encounters, triage, consultations, lab, radiology, admissions, theatre, maternity, ICU/HDU, appointments, referrals
- UI: `PatientTimeline.tsx`, doctor Context tab

**Gap:** Pharmacy dispense, inventory events, SHA verification events not on timeline (not built yet).

---

## WORKFLOW 20 — Notifications

Event-driven partial implementation:

| Event | Mechanism |
|-------|-----------|
| Internal inbox | `InternalNotification` entity |
| SMS | BullMQ queue → Celcom/Africa's Talking/Twilio/stub |
| Lab critical / verified | `NotificationsService.notifyUsers` |
| MOH auto-report | `MohAutoReportService` → admin inbox |
| Realtime | `RealtimeService.publish` (lab, rad, admission, ED) |

**Gap:** No central notification event bus; services call notifications directly.

---

## WORKFLOW 21 — Audit

| Mechanism | Coverage |
|-----------|----------|
| `AuditInterceptor` (global) | All HTTP mutations — user, action, path, body snapshot |
| `AuditLog` entity | `demo.audit_logs` |
| Admin viewer | `AuditLogPanel.tsx` — export/import CSV |
| Login events | `LoginEvent` separate table |

**Gap:** `beforeJson` often stores request body, not loaded entity state (noted in interceptor comments).

---

## WORKFLOW 22–26 — SHA / HIE / FHIR

**Capture only today.** See `docs/sha-integration-architecture.md`.

---

## Database relationship map (core)

```
Patient 1──* PatientIdentifier
Patient 1──* Encounter (opd | emergency | inpatient)
Encounter 1──* TriageAssessment
Encounter 1──* Consultation
Encounter 1──* EncounterDiagnosis
Encounter 1──* LabRequest ──* LabRequestItem ──* LabResult
Encounter 1──* RadiologyRequest ──* RadiologyReport
Encounter 1──? ClinicalOrder (mirror)
Patient 1──* Admission ──* Bed ──* Ward
Admission 1──* DailyProgressNote
Admission 1──? DischargeSummary
User *──* Role (RBAC)
```

**Missing relationships:** Prescription → Dispense → InventoryTransaction, Requisition → Issue, ExternalIdentifier → HIE reference.

---

## Tenant & numbering (Jalaram)

| Setting | Value |
|---------|-------|
| Login tenant code | `jalaram` (legacy `demo` accepted) |
| DB schema (entities) | `demo` (TypeORM hardcoded) |
| Patient/visit numbers | `JH-*` via `HOSPITAL_NUMBER_PREFIX` |
| Staff emails | `@jalaram.co.ke` |
| Migration | `1767400000000-JalaramTenantAndNumbering.ts` |

---

## Definition of done (per directive §40)

A workflow step is **done** only when: UI → API → DB → domain state → downstream → notification → audit → timeline all behave correctly.

Most P0 OPD/lab/imaging steps meet 5–7 of 8 layers. Pharmacy, inventory, SHA, and full IPD polish do not.
