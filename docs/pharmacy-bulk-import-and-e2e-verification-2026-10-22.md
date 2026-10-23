# AfyaSasa — Pharmacy Bulk Import, Stock-Take Database Verification, OPD/IPD Integration & Login Cleanup Report

**Date:** 22 October 2026  
**Tenant:** `jalaram` · **Schema:** `demo` · **API Prefix:** `/api/v1`  
**Branch / HEAD:** `main` @ `247d026` (`Blood bank and stock`)  
**Release Boundary:** Local verification only. All existing uncommitted work and the 26 patient / 66 inventory ledger rows in `afyasasa` (`demo`) were preserved untouched. All mutating database verification ran strictly inside the isolated disposable PostgreSQL database `inventory_it` (`postgresql://inventory_it:***@127.0.0.1:5433/inventory_it`).

---

## 1. Executive Summary & Release Readiness

All five workstreams (**A–E**) have been implemented, verified against a real disposable PostgreSQL database (`inventory_it`), built into the running Docker containers, and verified in the browser:

- **A. Stock-Take Database Workflow (Steps 1–10):** **PASSED (Database-Verified on `inventory_it`)**
  - Fixed a real PostgreSQL locking defect uncovered during database integration testing (`FOR UPDATE cannot be applied to the nullable side of an outer join` when `pessimistic_write` was combined with `LEFT JOIN` relations in `InventoryService` and `PaymentsService`).
  - Hardened `importCountsIntoSession` to reject unknown SKUs, ambiguous multi-lot SKU matches (when `line_id` or `batch_no` is omitted), unit mismatches (`bottle` vs `capsule`), and negative quantities without creating stock.
  - Verified all 10 lifecycle steps end-to-end against PostgreSQL in `backend/src/inventory/inventory-pg.integration.spec.ts`.
- **B. Pharmacy Catalogue Bulk Importer & Controlled Opening Stock:** **PASSED (Database & Browser Verified)**
  - Built into **Hospital Control Center → Pharmacy Configuration → 1. Catalogue & Bulk Import** and **2. Stores & Opening Stock**.
  - Supports downloadable CSV templates, CSV/XLSX upload, dry-run preview, create-vs-update toggle, `strength`, `dosage_form`, `min_level` (`reorder_level`), `max_level`, selling price, duplicate detection, row-level validation errors (negative quantities, invalid `YYYY-MM-DD` expiry dates, negative reorder levels), downloadable CSV error report, and partial-failure transaction rollback.
  - Catalogue imports (`importIntent: 'catalogue'`) never change `qty_on_hand`. Controlled opening stock (`importIntent: 'receipt'`, `confirmStockTake: true`, `sessionId`) is separated into Tab 2 with idempotent session protection.
- **C. OPD & IPD Prescription End-to-End Integration:** **PASSED (Database-Verified on `inventory_it`)**
  - Traced and tested `PrescriptionForm.tsx` → `POST /api/v1/clinical-orders/pharmacy/prescription` → `ClinicalOrderMirrorService.createPharmacyPrescription` → `GET /api/v1/inventory/pharmacy-dashboard` / `PharmacyUnifiedQueue` → `POST /api/v1/inventory/sales/prepare` → `evaluatePharmacyClearance` → `POST /api/v1/inventory/dispense/prescription` → `syncPrescriptionHeader`.
  - Proved `clientRequestId` retry idempotency, OPD vs IPD categorisation, reservation holds without reducing on-hand, fail-closed unpaid block, post-clearance dispensing, `DISPENSE` ledger entries, and prescription header status synchronisation (`status = 'dispensed'`, `completedAt` set).
- **D. Centralised Pharmacy Administration:** **PASSED (Browser Verified)**
  - Single **Pharmacy Configuration** entry under **Hospital Control Center** (accessible with `inventory:read` or `pharmacy:read` without granting `settings:manage`) with the exact six tabs:
    1. `1. Catalogue & Bulk Import`
    2. `2. Stores & Opening Stock`
    3. `3. Stock-Take & Reconciliation`
    4. `4. Batches & Expiry`
    5. `5. Rules & Approvals`
    6. `6. Reports & Audit`
- **E. Login Screen Cleanup:** **PASSED (Browser Verified)**
  - Identified `"Demo address"` originating from `1766212800000-InitialPhaseOne.ts` (`public.tenants.address`) and rendered via `GET /api/v1/auth/hospitals` (`TenancyService.toPublicHospital`) and `HospitalIdentityCard` in `LoginScreen.tsx`, plus the development rollout note `"A single sign-in code is prepared for a later rollout and is not required today."`
  - Suppressed `"Demo address"` in both `TenancyService.toPublicHospital` and `LoginScreen.tsx` (while still displaying real configured hospital addresses) and cleaned the footer note to `"Authorised staff only."` without altering tenant resolution (`jalaram`) or authentication.

### Release-Readiness Decision
**READY FOR CONTROLLED RELEASE** on the local branch, subject to standard hospital change-control approval before any git commit or production deployment.

---

## 2. Source-to-Database Mappings

| Workflow | Frontend Component | API Endpoint | Controller → Service | Database Tables (`demo.*` / `public.*`) |
|---|---|---|---|---|
| **Login & Public Hospital Identity** | `LoginScreen.tsx` | `GET /api/v1/auth/hospitals`<br>`POST /api/v1/auth/login` | `AuthController.hospitals` → `TenancyService.listPublicHospitals` | `public.tenants`, `public.settings`, `demo.users`, `demo.login_events` |
| **1. Catalogue & Bulk Import** | `PharmacyConfigPanel.tsx` (Tab 1) | `POST /api/v1/inventory/items/import/preview`<br>`POST /api/v1/inventory/items/import`<br>`POST /api/v1/inventory/items`<br>`PATCH /api/v1/inventory/items/:id` | `InventoryController.previewImport` / `importItems` → `InventoryService.importCatalog` (`importIntent: 'catalogue'`) | `demo.inventory_items`, `public.settings` (`clinical_catalog.inventoryPricing`) |
| **2. Stores & Opening Stock** | `PharmacyConfigPanel.tsx` (Tab 2) | `POST /api/v1/inventory/items/import/preview`<br>`POST /api/v1/inventory/items/import` | `InventoryService.importCatalog` (`importIntent: 'receipt'`, `confirmStockTake: true`, `sessionId`) | `demo.inventory_import_sessions`, `demo.inventory_batches`, `demo.inventory_transactions` (`RECEIPT`) |
| **3. Stock-Take & Reconciliation** | `StockTakeSessionPanel.tsx` (Tab 3) | `POST /api/v1/inventory/stock-take-sessions`<br>`GET .../sheet`<br>`POST .../import-counts`<br>`POST .../lines/:lineId`<br>`POST .../submit`<br>`POST .../reject`<br>`POST .../approve` | `InventoryService.createStockTakeSession`<br>`exportPhysicalCountSheet`<br>`importCountsIntoSession`<br>`countStockTakeLine`<br>`submitStockTakeSession`<br>`rejectStockTakeSession`<br>`approveAndPostStockTakeSession` | `demo.inventory_stock_take_sessions`, `demo.inventory_stock_take_lines`, `demo.inventory_import_sessions`, `demo.inventory_batches`, `demo.inventory_transactions` (`STOCK_TAKE`) |
| **OPD & IPD Prescriptions** | `DoctorConsultationWorkspace.tsx` / `ipd/PatientWorkspace.tsx` → `PrescriptionForm.tsx` → `PharmacyUnifiedQueue.tsx` | `POST /api/v1/clinical-orders/pharmacy/prescription`<br>`GET /api/v1/clinical-orders?module=pharmacy`<br>`POST /api/v1/inventory/sales/prepare`<br>`POST /api/v1/inventory/dispense/prescription` | `ClinicalOrderMirrorService.createPharmacyPrescription`<br>`InventoryService.preparePrescriptionSale`<br>`InventoryService.dispensePrescription` → `syncPrescriptionHeader` | `demo.clinical_orders`, `demo.inventory_reservations`, `demo.charges`, `demo.payment_transactions`, `demo.inventory_batches`, `demo.inventory_transactions` (`DISPENSE`) |

---

## 3. Bulk Import Format & Field Mapping

### Catalogue Bulk Import Template (`afyasasa-pharmacy-catalogue-template.csv`)
| CSV / XLSX Header (Aliases) | Mapped Field | Target Table / Column | Validation & Behaviour |
|---|---|---|---|
| `sku` (`barcode`, `sku_code`) | `sku` | `demo.inventory_items.sku` | Uppercased; auto-generated from name if blank; duplicate SKUs within file flagged in `summary.duplicates` |
| `name` (`item_name`, `medicine`, `drug`, `name_of_the_item`) | `name` | `demo.inventory_items.name` | Required; exact & fuzzy (`likely_name`) matching against existing catalogue |
| `generic_name` (`generic`) | `generic_name` | Normalised in import parser | Preserved in row metadata |
| `strength` | `strength` | `demo.inventory_items.strength` | Saved on create and when `updateExisting=true` |
| `dosage_form` (`form`) | `dosage_form` | `demo.inventory_items.dosage_form` | Saved on create and when `updateExisting=true` |
| `unit` | `unit` | `demo.inventory_items.unit` | Inferred from name if blank (`tablet`, `capsule`, `bottle`, etc.) |
| `category` (`category_name`) | `category` | `demo.inventory_items.category` | Normalised to `pharmaceutical`, `medical_consumable`, or `non_medical` |
| `sell` (`rate`, `selling_price`, `unit_price`, `price`) | `sell` | `public.settings.clinical_catalog.inventoryPricing[sku]` | Must be non-negative; negative values rejected |
| `reorder_level` (`min_level`, `max_level`) | `minLevel` / `maxLevel` | `demo.inventory_items.min_level` / `max_level` | Must be non-negative number |
| `opening_qty` (`qty`, `quantity`) | `quantity` | Held in `catalogue` mode; posted as `RECEIPT` only in `receipt` mode | Must be non-negative; expired batches (`expiry_date < today`) rejected |

---

## 4. Defects Found & Fixed During Database Verification

1. **PostgreSQL `FOR UPDATE` on Nullable Outer Joins (`InventoryService` & `PaymentsService`):**
   - **Root Cause:** TypeORM `findOne` / `find` with both `lock: { mode: 'pessimistic_write' }` and `relations: { ... }` (where any relation is nullable, such as `batch`, `encounter`, `admission`, `patient`) generates `SELECT ... LEFT JOIN ... FOR UPDATE`, which PostgreSQL rejects with `ERROR: FOR UPDATE cannot be applied to the nullable side of an outer join`.
   - **Fix:** Acquired the `pessimistic_write` row lock on the primary entity table first without outer-join relations, then hydrated the relations inside the same transaction across `InventoryService` (`approveAndPostStockTakeSession`, `dispensePharmacyOrder`, `retryDispenseBilling`, `preparePharmacyLine`, `heldReservations`, `lockLocationBatches`, `lockMatchingBatch`, `issueRequisition`, `shipTransfer`, `receiveTransfer`) and `PaymentsService` (`upsertPharmacyCharge`, `lockChargeForPayment`).
2. **Stock-Take Count Sheet Import Ambiguity & Unit Validation (`importCountsIntoSession`):**
   - **Root Cause:** `session.lines.find(...)` matched the first lot when a SKU had multiple batches in the same session and `batch_no` was omitted, and did not verify the `unit` column if present.
   - **Fix:** Updated `importCountsIntoSession` to collect all matching candidate lines, reject ambiguous multi-lot SKU rows with an explicit message requiring `line_id` or `batch_no`, and reject rows whose `unit` disagrees with the catalogue unit.

---

## 5. Automated Test Commands & Actual Results

### 1. Disposable PostgreSQL Integration Suite (`inventory_it`)
```bash
INVENTORY_TEST_DATABASE_URL='postgresql://inventory_it:inventory_it@127.0.0.1:5433/inventory_it' npm --prefix backend run test:inventory-pg
```
- **Result:** `Test Suites: 1 passed, 1 total` · `Tests: 16 passed, 16 total` (`0 failed`, `5.23 s`)
- **Verified in PostgreSQL (`inventory_it`):**
  - Session identity guard (`inventory_it@inventory_it`).
  - Bulk catalogue dry-run preview, duplicate SKU detection, negative quantity rejection, create/update persistence, and proof that `catalogue` import creates `0` batch rows.
  - Large 60-item bulk import, decimal quantity (`12.5`), invalid expiry date format (`31-12-2028`), unknown location rejection, and full transaction rollback on forced failure.
  - Controlled opening-stock receipt (`open-sess-1`) and duplicate `sessionId` replay rejection.
  - Full 10-step stock-take lifecycle: session creation & baseline capture (`LOT-P1: 100`, `LOT-P2: 40`, `LOT-A1: 60`), physical sheet export with blank `physical_count`, count import rejecting unknown SKU / ambiguous multi-lot SKU / unit mismatch / negative quantity, variance reason enforcement, submit, self-approval block (`STOCK_TAKE_INDEPENDENT_APPROVAL`), rejection & recount preserving baseline, concurrent baseline drift detection (`98 != 100`), forced ledger failure rollback, one-time approval & `STOCK_TAKE` ledger posting (`96` and `42`), idempotent re-approval, and zero balance mismatch in `integrityReport`.
  - End-to-end OPD & IPD prescriptions: `createPharmacyPrescription` with `clientRequestId` retry idempotency, dashboard OPD/IPD separation, `preparePrescriptionSale` reservation holds (`onHand: 198, reserved: 10, available: 188`), unpaid dispense block (`FINANCIAL_CLEARANCE_DENIED`), cashier payment clearance, `dispensePrescription`, duplicate dispense rejection, and header status sync (`dispensed`).

### 2. Full Backend Unit & Spec Suite
```bash
npm --prefix backend test -- --runInBand --forceExit
```
- **Result:** `Test Suites: 87 passed, 87 total` · `Tests: 472 passed, 24 skipped, 496 total` (`0 failed`)

### 3. Production Builds & Docker Rebuild
```bash
npm --prefix backend run build && npm --prefix frontend run build
docker compose up -d --build frontend backend
```
- **Result:** Both builds succeeded with `0` errors; `afya-sasa-backend-1` and `afya-sasa-frontend-1` rebuilt and healthy.

---

## 6. Browser Scenarios & Evidence Index

All screenshots are stored in `docs/pharmacy-e2e-evidence-2026-10-22/` (see `README.md`):

| Scenario | Status | Evidence |
|---|---|---|
| Login screen demo text cleanup (`Demo address` & rollout note removed) | **PASSED** | `11-login-cleaned.png` |
| Authorised login & 4-destination Pharmacy navigation (`Dashboard`, `Prescription & OTC Queue`, `OTC Point of Sale`, `Products & Stock`) | **PASSED** | `06-nav-four-destinations.png`, `07-pharmacy-dashboard.png` |
| Unified `Prescription & OTC Queue` (`OPD Prescriptions`, `IPD Prescriptions`, `OTC Sales / Orders`) | **PASSED** | `08-prescription-otc-queue.png` |
| `OTC Point of Sale` search, stock availability, and cart | **PASSED** | `03-pharmacy-pos.png`, `04-pos-catalogue-search.png` |
| `Products & Stock` per-batch/store table with search, status filter, and sort | **PASSED** | `09-products-and-stock.png`, `10-products-and-stock-rows.png` |
| `HCC → Pharmacy Configuration → 1. Catalogue & Bulk Import` (CSV/XLSX template, dry-run preview, update toggle) | **PASSED** | `12-hcc-catalogue-bulk-import.png` |
| `HCC → Pharmacy Configuration → 2. Stores & Opening Stock` (controlled receipt workflow) | **PASSED** | `13-hcc-stores-opening-stock.png` |
| `HCC → Pharmacy Configuration → 3. Stock-Take & Reconciliation` | **PASSED** | `05-stock-take-session.png` |
| Mutating stock-take, opening-stock, and OPD/IPD dispense against disposable PostgreSQL (`inventory_it`) | **PASSED** | `backend/src/inventory/inventory-pg.integration.spec.ts` (`16/16` passed) |
| Mutating stock-take or sales against the non-disposable local `afyasasa` DB (26 patients, 66 ledger rows) | **BLOCKED BY SAFETY RULE** | Preserved untouched as required |
