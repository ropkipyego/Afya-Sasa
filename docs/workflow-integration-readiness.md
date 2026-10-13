# Whole-hospital workflow integration — release readiness

**Date:** 2026-10-13  
**Branch:** `main` at `c5090e4` plus uncommitted local work (not committed).

## Safety

- LIVE STACK CHANGED: **NO**
- LIVE DATABASE CHANGED: **NO**
- PRODUCTION MIGRATIONS APPLIED: **NONE**
- PRODUCTION DEPLOYMENT PERFORMED: **NO**
- COMMITS/PUSHES: **NONE**
- FHIR SANDBOX CONNECTED: **NO**
- SHA CLAIMS CONNECTED: **NO** (eligibility may be live/stub per env; claims remain portal)

## Phase 1 — Module matrix (actual)

| Module | Typical role | Nav | UI | API | Tables | R/W | Flags / schema | Tests | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Registration | Front office | Register / Registry | PatientRegistrationForm | `/patients` | `patients`, identifiers | create/read | none | reception-opd Playwright (mock) | **Local complete / deployed unknown** |
| OPD consult | Doctor | Doctor Queue | DoctorConsultationWorkspace | `/opd`, diagnoses, SOAP | `encounters`, notes, diagnoses | consult perms | none | mock Playwright | **Local complete / unverified live** |
| Laboratory | Lab tech | Laboratory | LabModule (worklist + result entry) | `/laboratory/*` | lab_requests, items, results | enter/verify | `AFYASASA_LAB_AMENDMENT_ENABLED=false` | lab unit + Playwright mock | **Local Jalaram card layout**; **not clinically signed** |
| Radiology | Radiographer | Radiology | ImagingModule | `/radiology/*` | radiology_requests | enter/verify | none | radiology-access | **Partial** |
| Pharmacy | Pharmacist / doctor | Pharmacy + consult Meds | PrescriptionForm, PharmacyWorkspace | `/clinical-orders/pharmacy`, `/inventory` | clinical_orders, inventory_* | prescribe/dispense | none | pharmacy-prescription.spec | **Local linked**; catalogue search improved this pass |
| Theatre | Theatre team | Theatre | TheatreWorkspace | `/theatre/*` | surgery_* | bookings/notes | none | theatre-notes.spec | **Was broken (wrong note types)**; fixed locally, **unverified live** |
| IPD | Ward | Inpatient | IpdModule | `/admissions` | admissions, beds, notes | admissions:* | none | bed-occupancy | **Partial** |
| Cashier | Cashier | Cashier / Billing | PaymentDesk | `/payments/*` | charges, payment_transactions | initiate/manage | `AFYASASA_CHARGES_ENABLED` | payment-integrity | **Local complete**; unique receipt index **planned not applied** |
| Insurance | Billing | Insurance & Claims | InsuranceWorkspace | `/insurance`, `/sha` | sha_eligibility_checks + overlay | patients:read | SHA_* | insurance-lifecycle | **Partial**; no remittance |
| Director | Director | Director Dashboard | ExecutiveAnalyticsDashboard | `/reports/executive-analytics` | source tables | reports:read; finance gated | none | reporting-metrics | **Local complete**; **not proven vs live totals** |
| FHIR | Admin | Interoperability | InteropWorkspace | `/integrations/fhir` | maps EMR | settings:manage | DHA_FHIR_* empty | fhir-mapper | **Mapping only** |
| Drug import | Pharmacy admin | Pharmacy Stock Take | StockTakeWorkspace | `/inventory/items/import*` | inventory_items | inventory:manage | none | inventory-import-match | **Preview safer this pass**; production import **out of scope** |

Never treat “component exists” as production-ready.

## Phase 2 — Journey connections

A. OPD: register → check-in → triage → doctor SOAP/diagnosis → ClinicalInvestigationOrders (lab/rad) → PrescriptionForm (pharmacy) → ResultsInbox → cashier. **Connection present.** Follow-up appointments are a separate module.

B. Diagnostic-only: Lab walk-in desk exists; charges if catalogue priced. **Do not invent a consultation.**

C. IPD: admit → bed → notes/orders → pharmacy dispense stock → theatre booking optional → discharge summary. Theatre notes now persist with valid types. **Discharge-to-final-bill is charge-driven, not a second ledger.**

D. Self-pay: charge → partial/full payment → receipt → statement → cashier summary. **Refunds keep original payment.**

E. Insured: SHA eligibility + claim **drafts**. **No evidenced SHA submission/adjudication/remittance.**

F. Lab: request → specimen worklist → structured/panel entry + comments → verify → official HTML report (ordering clinician / verifier). Amendment disabled until policy.

G. Theatre: book → status board → staff → notes (assessment, consent, counts, anaesthesia, operative, specimens, post-op, recovery) → complications. **Counts are narrative notes, not a structured swab-count table.**

H. Prescribe: catalogue search → prescription → pharmacy review/dispense → inventory transaction → charge when priced. Free-text without `itemId` **does not move stock.**

I. Director: server aggregates; drill-down is navigation to modules, not row-level finance drill from KPI cards.

J. FHIR: map/validate synthetic; **no sandbox exchange.**

## Defect register

### P0

| ID | Evidence | Workflow | Local fix | Tests | Remaining |
| --- | --- | --- | --- | --- | --- |
| P0-1 | Theatre UI posted `pre_op` / `intra_op`; API `@IsIn` rejects them | Theatre notes never saved | UI now posts API types; GET `/theatre/bookings/:id` returns notes | theatre-notes.spec | Live staff must re-enter any notes that failed silently |
| P0-2 | Confirm import previously overwrote name/class/unit/price on SKU match | Drug catalogue | Default import **creates new only**; `updateExisting` required to overwrite; likely-name matches skipped | inventory-import-match.spec | Production import remains a separate authorised operation |
| P0-3 | `User.passwordHash` has `select: true`; some staff endpoints could serialise users | Auth leak risk | GET booking detail maps names only | — | Broader User `select: false` not changed (auth uses findOne) |

### P1

| ID | Evidence | Local fix | Remaining |
| --- | --- | --- | --- |
| P1-1 | Lab comments existed on entity/report HTML but result-entry UI did not send them | Panel + single-value comments persist; official report button on result entry | Layout not clinically approved |
| P1-2 | Unique payment `external_reference` SQL still planned | Unchanged (not applied) | Duplicate receipt numbers possible until isolated apply |
| P1-3 | SHA claims / remittance | Overlay drafts only | Portal remains source of truth |
| P1-4 | Isolated PG for E2E not proven this session | — | No browser-against-DB journeys claimed |

### P2

Prescription catalogue was an unfiltered `<select>` of all SKUs — searchable filter added. Theatre board listed 8 cases — now all bookings. Kanban columns are counts, not drag-drop. Director drill-down is module navigation. Radiology reporting TAT null when unverified.

### P3

Theatre kanban not clickable. Prescription search is shared across lines.

## Tests actually run

See command output in the agent session. Targeted Jest + `tsc` after edits.

**END-TO-END TESTS:** Playwright lab/reception specs exist against **mock API**, not an isolated hospital database. `LAB_TEST_DATABASE_URL` was **not** set/proven this pass. **Do not treat E2E as passed.**

## Smallest blockers before hospital UAT

1. Isolated test database (localhost) and a scripted synthetic journey A/D/F.
2. Clinical sign-off of structured lab report layout.
3. Re-enter any theatre notes that failed before the type fix.
4. Confirm `AFYASASA_CHARGES_ENABLED` and charge unique index **on the intended UAT schema**, not production.
5. SHA/DHA credentials and approved claims pack before calling insurance or FHIR “connected”.
6. Authorised drug import rehearsal on a copy of catalogue — default no longer overwrites.

Do not declare the hospital system ready because modules are visible or the build passed.
