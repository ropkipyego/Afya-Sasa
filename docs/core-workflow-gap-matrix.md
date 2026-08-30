# AfyaSasa Core Workflow Gap Matrix

**Generated:** 2026-08-28  
**Legend:** ✅ Working · ⚠️ Partial · ❌ Missing · 🔍 Needs verification

Priority: **P0** core clinical · **P1** operations · **P2** specialty · **P3** interoperability · **P4** production hardening

---

| Workflow | Current State | Gap | Backend | Database | Frontend | Priority | Acceptance Test |
|----------|---------------|-----|---------|----------|----------|----------|-----------------|
| **Patient search** | ✅ Name/MRN/phone search with pagination | Duplicate-candidate scoring could be stronger | `patients.service.ts` | `patients`, indexes on `patient_no` | `PatientSearchAutocomplete.tsx` | P0 | Search by MRN → open profile |
| **Patient registration** | ✅ Full demographics + compulsory ID + age/DOB + kin ID | Photo capture; CSV import | `POST /patients` | `patients`, `patient_identifiers`, `patient_next_of_kin` | `PatientRegistrationForm.tsx` | P0 | Register → JH number → identifiers saved |
| **Single patient record** | ✅ One row per person across modules | None | Shared `Patient` FK everywhere | Unique `patient_no` | N/A | P0 | Same patient in OPD, lab, IPD |
| **SHA identifier capture** | ✅ `type: sha` on identifier | No verification; not on timeline | `patient.dto.ts` | `patient_identifiers` | Registration form | P3 | Register with SHA → stored locally |
| **OPD check-in** | ✅ Step wizard, visit context | — | `opd.service.ts` persists `attendingDoctor` | `encounters.attending_doctor_id` | `OpdCheckInWorkspace.tsx` | **P0** | Check-in with doctor → DB has `attending_doctor_id` |
| **OPD encounter numbering** | ✅ `JH-OPD-YYYY-NNNNN` | Year-scoped sequence not yet enforced everywhere | `formatHospitalNumber` | `encounter_no` unique | Shown in triage/doctor | P0 | New encounter gets JH-OPD prefix |
| **Triage** | ✅ Vitals + colour + modal UX | Retriage UX limited | `POST .../triage` | `triage_assessments` | `TriageWorkspace.tsx` | P0 | Triage → status `triaged` → vitals in DB |
| **Doctor queue** | ✅ Priority by triage colour + attending doctor filter | — | `GET /opd/doctor/queue?doctorId=` | Join triage + attending doctor | `App.tsx` DoctorQueue | P0 | Triaged patient appears in queue |
| **SOAP consultation** | ✅ Subjective/objective/assessment/plan | — | `POST .../consultations` | `consultations` | `DoctorConsultationWorkspace.tsx` | P0 | SOAP saved → retrievable |
| **Diagnosis** | ✅ ICD description + type | ICD-10 lookup not integrated | `POST .../diagnoses` | `encounter_diagnoses` | Doctor workspace | P0 | Diagnosis on encounter |
| **Encounter status workflow** | ✅ `EncounterWorkflowService` enforced | — | `opd.service.ts` + `encounter-workflow.service.ts` | `encounters.status` | N/A | P0 | Invalid transitions rejected |
| **Lab order** | ✅ Full request + items + mirror | — | `laboratory.service.ts` | `lab_requests`, `clinical_orders` | `ClinicalInvestigationOrders.tsx` | P0 | Order → lab queue |
| **Lab sample → result** | ✅ Collect, enter, verify | — | Lab service | `lab_samples`, `lab_results` | `LabWorklist.tsx` | P0 | Full lab lifecycle API test |
| **Lab clinician review** | ✅ Separate `reviewedAt` from `verifiedAt` | — | `POST .../review` returns encounter to `in_consultation` when all reviewed | `lab_results.reviewed_at` | `ResultsInbox` | P0 | Doctor reviews → encounter status updated |
| **Imaging order → report** | ✅ Full cycle | Scheduling depth limited | `radiology.service.ts` | `radiology_*` tables | `RadiologyWorklist.tsx` | P0 | Imaging round-trip |
| **Pharmacy prescription** | ✅ Prescribe + FEFO dispense + ledger | Timeline events; SKU matching heuristic; pharmacy permissions | `inventory/dispense` + clinical orders | `clinical_orders` + `inventory_transactions` | `PharmacyWorkspace.tsx` | **P1** | `ops/pharmacy-workflow-test.sh` |
| **Referral** | ✅ Letter + persistence | — | `referrals.service.ts` | `referrals` | `ReferralWorkspace.tsx` | P0 | Referral created + notified |
| **Sick sheet** | ✅ Preview + doctor name | — | `opd.service.ts` | `sick_sheets` | `SickSheetWorkspace.tsx` | P0 | Issue sick sheet PDF path |
| **Appointments** | ✅ Book + doctor relation | SMS reminders not live | `appointments.service.ts` | `appointments` | `AppointmentCenter.tsx` | P1 | Book → list shows Dr. name |
| **Patient timeline** | ⚠️ Computed from 12+ sources | No pharmacy/dispense/inventory/SHA events; IPD UI parsing bug | `patients.service.ts` timeline | Read-only aggregation | `PatientTimeline.tsx`, `PatientWorkspace.tsx` | P0 | Events ordered; dispense appears |
| **Audit (HTTP)** | ✅ Global interceptor | `beforeJson` not true entity snapshot | `audit.interceptor.ts` | `audit_logs` | `AuditLogPanel.tsx` shows UUIDs | P0 | Mutation → audit row |
| **Notifications** | ⚠️ Direct service calls | `NotificationDispatcherService` scaffold unused | `notifications.service.ts` | `internal_notifications`, `sms_logs` | `NotificationInbox.tsx` | P1 | Lab verify → clinician notified |
| **IPD admission** | ✅ Bed assign + reason | — | `inpatient.service.ts` | `admissions`, `beds` | `IpdAdmitPanel.tsx` | P1 | Admit → bed occupied |
| **IPD ward census** | ✅ Bed board + consultant name | — | `getWardCensus` loads `admittingDoctor` | `admitting_doctor_id` | `WardDashboard.tsx` | P1 | Census shows "Dr. Lastname" |
| **IPD discharge** | ✅ Requires discharge summary | — | `dischargeAdmission` | `discharge_summaries` | `PatientWorkspace.tsx` | P1 | Discharge → bed cleaning |
| **Bed transfer** | ✅ Logged | — | `transferBed` | `bed_transfer_log` | IPD workspace | P1 | Transfer → audit + bed states |
| **ED workflow** | ⚠️ UI + entities exist | Bypasses encounter workflow; no E2E test | `emergency.service.ts` | `emergency_encounters` | `EmergencyCommandCenter.tsx` | P2 | ED disposition → admit |
| **Maternity** | ⚠️ Broad UI | No E2E acceptance test | `maternity.service.ts` | pregnancies, deliveries, newborns | `MaternityServiceLine.tsx` | P2 | ANC → delivery → baby link |
| **Theatre** | ⚠️ Booking workflow | No E2E test; supply via requisitions | `theatre.service.ts` | `surgery_bookings` | `TheatreWorkspace.tsx` | P2 | Book → complete procedure |
| **ICU/HDU** | ✅ Backend API | ❌ Frontend not wired to `/icu/` APIs | `icu/` module | icu_admissions, etc. | Nav → `IpdModule` ward board only | P2 | ICU admission → monitoring UI |
| **Inventory engine** | ✅ Items, locations, batches, ledger | No ledger read UI; no RETURN/ADJUST/STOCK_TAKE | `inventory/` module | `inventory_*` tables | `InventoryModule.tsx` | **P1** | `ops/inventory-workflow-test.sh` |
| **Main store requisitions** | ✅ Create → approve → issue → ack | Destination batch credit missing | `inventory.service.ts` | `inventory_requisitions` | `InventoryModule.tsx` | P1 | Requisition → issue → receipt |
| **Stock ledger** | ✅ RECEIPT, ISSUE, DISPENSE, TRANSFER | No GET ledger API | `inventory.service.ts` | `inventory_transactions` | — | P1 | Every movement → transaction row |
| **Batch / expiry / FEFO** | ✅ Batch on receipt + FEFO dispense | — | `inventory_batches` | batch + expiry columns | Pharmacy dispense | P1 | Dispense uses earliest expiry batch |
| **SHA/HIE integration** | ❌ Capture only | No integration boundary | — | — | — | P3 | Offline register → pending verify |
| **External identifiers** | ⚠️ Patient identifiers table | No `system`/`status`/HIE ref table | — | `patient_identifiers` only | Registration | P3 | MPI ref linked after verify |
| **FHIR mapping layer** | ❌ Not built | — | — | — | — | P3 | Internal → FHIR adapter (future) |
| **Tenant code jalaram** | ✅ Default `jalaram` | Entity schema still `demo` | `tenancy.service.ts`, migrations | `public.tenants.code=jalaram` | `tenant-config.ts` | P0 | Login without hospital code |
| **MOH auto-report** | ✅ Scheduler + admin notify | Was broken (demo alias join) — fixed in code | `moh-auto-report.service.ts` | N/A | Reports dashboard | P1 | Auto-run → admin notification |
| **Security RBAC** | ✅ Server guards | Frontend hide ≠ security (OK if backend enforces) | `@RequirePermissions` | roles/permissions | Nav filter | P4 | Role denied on API 403 |
| **Production deploy** | ❌ Not on Contabo yet | TLS, backups, secrets | — | — | — | P4 | HTTPS + backup restore test |
| **Smoke / acceptance tests** | ✅ Full API suite (7 workflows) | No ED/maternity/theatre/ICU scripts; minimal Playwright | `ops/*-workflow-test.sh` | — | Playwright navigation only | P0 | `npm run test:workflows` green |

---

## Priority summary

### P0 — Fix first (core pilot blockers)

1. ~~Persist **preferred doctor** on OPD check-in~~ ✅
2. ~~Wire **OPD status** through `EncounterWorkflowService`~~ ✅
3. Extend **acceptance tests** to prove DB persistence (lab review path)
4. Run **Jalaram migration** on deployed DB

### P1 — Operations (before full hospital)

5. ~~**IPD census** — resolve admitting doctor name~~ ✅
6. ~~**Pharmacy** — prescribe + dispense on shared inventory engine~~ ✅
7. ~~**Inventory engine** — requisitions + transfers~~ ✅ (destination credit + ledger UI remain)
8. **Notification** consolidation (wire `NotificationDispatcherService`)
9. **Patient timeline** — pharmacy dispense + inventory events
10. **ICU frontend** — wire to backend APIs

### P2 — Specialty validation

11. ED, maternity, theatre end-to-end UAT + workflow scripts

### P3 — Interoperability

11. External identifier model + integration boundary (see `sha-integration-architecture.md`)

### P4 — Production

12. Contabo/VPS, HTTPS, backups, Celcom live keys, go-live checklist

---

## Evidence required to close a gap

For each row marked ⚠️ or ❌, closure requires:

1. UI action performed by role-appropriate user  
2. API request/response captured  
3. Database row verified (SQL or migration test)  
4. Downstream screen shows correct state  
5. Audit log entry exists  
6. Timeline event appears (where applicable)  
7. Automated test added to `docs/core-workflow-test-plan.md`

Do **not** mark done on UI render alone.
