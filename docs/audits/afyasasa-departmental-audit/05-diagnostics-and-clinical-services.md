# Diagnostics and clinical services

All statuses are **implemented, partially verified** unless stated. No logged-in clinical UAT this audit.

## Laboratory

**UI:** `frontend/src/components/investigations/LabModule.tsx` and related lab-ui, worklist, results entry.  
**API:** `LaboratoryController` `/laboratory/*`, `LabCatalogController` `/laboratory/catalog`.  
**Entities:** `lab_requests`, `lab_request_items`, `lab_samples`, `lab_results`, catalog tables under schema `demo`.

| Topic | Finding |
| --- | --- |
| Catalogue / pricing | Import and panels exist; incomplete reference ranges yield unassessed flags (`lab-result-engine`) |
| Request statuses | Requested → sample → processing → resulted → verified (see lifecycle spec) |
| Barcode | Generate/scan endpoints; `laboratory.barcode.spec.ts` |
| Verify vs enter | Separate permissions; technician template cannot verify |
| Cancel | `lab_requests:cancel` only |
| Amend | **Blocked** unless `AFYASASA_LAB_AMENDMENT_ENABLED=true` (compose pins false) |
| Reports | Layouts + builder specs; **laboratory clinical approval of templates outstanding** (`docs/laboratory-clinical-approval-register.md` exists as a process doc) |
| Isolated PG | 10 tests on `lab_it` **14 Oct 2026** — miniature schema, not hospital rows |

## Radiology

**UI:** `ImagingModule.tsx`. **API:** `/radiology/*`.  
Lifecycle spec covers status and verify. Attachments are file references via storage, **not** a PACS. Diagnostic-only OPD visits set destination `radiology`.

## Emergency

**UI:** `EmergencyCommandCenter.tsx`. **API:** `/emergency/*`.  
Uses `emergency_encounters`, not OPD `encounters`. Disposition to IPD/OPD is coded; **end-to-end UAT unverified**. `emergency.service.spec.ts` exists.

## Inpatient

**UI:** `IpdModule.tsx`. **API:** `/inpatient/*`.  
Admit occupies bed; discharge requires summary; transfers logged. `inpatient.service.spec.ts`, `bed-occupancy.spec.ts`.

**Nursing:** `/nursing/*` vitals, MAR, observations, shift notes. MAR is eMAR documentation. Stock still moves only on pharmacy confirm.

## ICU / HDU

Contrary to the **August 2026** gap matrix, ICU **is** wired: `IcuModule.tsx` calls `/icu/admissions`, observations, ventilator, fluids, rounds. HDU has `HduModule.tsx` and `/hdu`. **UAT unverified.**

## Theatre

`TheatreWorkspace.tsx` + `/theatre/*` rooms, procedure import, bookings, staff, notes, complications. `theatre.service.spec.ts`, `theatre-notes.spec.ts`. Consumables via store requisitions, not automatic theatre stock.

## Maternity

`MaternityServiceLine.tsx` + `/maternity/*` ANC, labour, partograph, delivery, newborn, optional `register-newborn-patient`. **Clinical UAT unverified.** Newborn registration must not create a duplicate mother record.

## Blood bank

**Not implemented** (no module, entity, or nav). Do not store units in `inventory_batches` as medicines.

## Missing vs incomplete

| Area | Classification |
| --- | --- |
| Lab amendment on live policy | Blocked by flag |
| Imaging PACS | Not implemented |
| ED/maternity/theatre logged-in E2E | Unverified |
| Blood bank | Not implemented |
