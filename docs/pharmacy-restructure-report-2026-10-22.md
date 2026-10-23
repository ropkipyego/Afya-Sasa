# AfyaSasa Pharmacy Restructure — Backend-First Implementation & Verification Report

**Date:** 22 October 2026  
**Tenant:** `jalaram` · **Schema:** `demo` · **API Prefix:** `/api/v1`  
**Branch / HEAD:** `main` @ `247d026` (`Blood bank and stock`)  
**Release Boundary:** Local verification only. No commits, pushes, merges, destructive resets, or production changes were performed.

---

## 1. Executive Summary & Release-Readiness Decision

The AfyaSasa Pharmacy module has been restructured backend-first into **four operational destinations** under **Pharmacy & Supply**:
1. **Dashboard** (`GET /inventory/pharmacy-dashboard`)
2. **Prescription & OTC Queue** (`PharmacyUnifiedQueue` combining OPD prescriptions, IPD prescriptions, and prepared OTC sales/orders)
3. **OTC Point of Sale** (`PharmacyPosPanel` with multi-line cart, barcode/SKU lookup, optional walk-in metadata, and cashier-controlled clearance)
4. **Products & Stock** (`GET /inventory/pharmacy-stock-table` — searchable, sortable, paginated per-batch/store table showing on-hand, reserved, available, expiry, and reorder status without merging distinct batch expiry dates)

Under **Hospital Control Center**, the previous four separate stock oversight cards were consolidated into a single **Pharmacy Configuration** desk (`PharmacyConfigPanel`, accessible with `inventory:read` or `pharmacy:read` without granting `settings:manage`) following the Lab Catalogue pattern with six tabs:
- **A. Pharmacy Catalogue** (create/edit products, strength, dosage form, reorder level, active status, and selling prices on `demo.inventory_items`)
- **B. Stores & Stock** (links to `Inventory & Store` plus live location, transfer, and requisition oversight)
- **C. Stock-Take & Reconciliation** (session creation, frozen baseline, printable physical count sheet with `book_qty` and blank `physical_count`, count import into session, variance reason enforcement, rejection/recount, independent approval, and one-time ledger posting; direct CSV stock-take posting is disabled)
- **D. Batch, Expiry & Stock Control** (live pharmacy batches, 90-day expiry warnings, stock-take history; unimplemented recall/quarantine/disposal actions are explicitly blocked)
- **E. Rules & Approvals** (server-enforced segregation of duties, FEFO/expiry rules, cashier clearance, and reorder thresholds)
- **F. Reports & Audit** (authoritative `demo.inventory_transactions` movements, ledger integrity checks, and department exports)

### Honest Release-Readiness Decision
- **Local UI & Non-Mutating Backend Integration:** **PASSED** and verified in the running Docker stack (`http://localhost:8080/`).
- **Automated Unit & Build Verification:** **PASSED** (`87` suites, `472` passed, `20` skipped, `0` failed; backend `nest build` and frontend `tsc -b && vite build` clean).
- **Controlled Hospital Release:** **NOT READY** until mutating end-to-end tests (preparing sales, collecting cashier payments, issuing stock, and approving a stock-take session with a second user) are executed against a **confirmed disposable PostgreSQL database**. The running local compose database (`afyasasa` in `/afya-sasa-postgres-1`, created `2026-09-21`) contains `26` patient rows and `66` inventory ledger rows and was treated as non-disposable in accordance with safety rules.

---

## 2. Endpoint-to-Screen-to-Database Mapping

| Screen / Destination | API Endpoint(s) | Controller & Service Method | Authoritative Database Tables (`demo.*`) | Transaction & Permission Boundary |
|---|---|---|---|---|
| **1. Dashboard** | `GET /api/v1/inventory/pharmacy-dashboard` | `InventoryController.pharmacyDashboard` → `InventoryService.pharmacyDashboard` | `clinical_orders`, `inventory_locations`, `inventory_items`, `inventory_batches`, `inventory_reservations`, `inventory_stock_take_sessions`, `charges`, `payment_transactions`, `inventory_transactions` | `@RequirePermissions('pharmacy:read', 'inventory:read')`; read-only aggregation; never fabricates zero on failure |
| **2. Prescription & OTC Queue** | `GET /api/v1/clinical-orders?module=pharmacy`<br>`GET /api/v1/inventory/pharmacy-dashboard`<br>`GET /api/v1/inventory/sales/:saleId`<br>`POST /api/v1/inventory/sales/prepare`<br>`POST /api/v1/inventory/dispense/prescription`<br>`POST /api/v1/inventory/dispense/otc`<br>`POST /api/v1/inventory/sales/cancel` | `ClinicalOrderMirrorService.listOrders`<br>`InventoryService.pharmacySaleStatus`<br>`InventoryService.preparePrescriptionSale`<br>`InventoryService.dispensePrescription`<br>`InventoryService.issueOtcSale`<br>`InventoryService.cancelPharmacySale` | `clinical_orders`, `inventory_reservations`, `inventory_batches`, `inventory_transactions`, `charges`, `payment_transactions` | Prepare/Cancel: `pharmacy:read` / `pharmacy:dispense`; Issue: `pharmacy:dispense` + `evaluatePharmacyClearance` inside `manager.transaction` with `pessimistic_write` batch locks |
| **3. OTC Point of Sale** | `GET /api/v1/inventory/items?category=pharmaceutical`<br>`GET /api/v1/inventory/barcode/:code`<br>`POST /api/v1/inventory/sales/otc/prepare`<br>`POST /api/v1/inventory/dispense/otc` | `InventoryService.listItems`<br>`InventoryService.lookupByBarcode`<br>`InventoryService.prepareOtcSale`<br>`InventoryService.issueOtcSale` | `inventory_items`, `inventory_batches`, `inventory_reservations`, `charges`, `payment_transactions`, `inventory_transactions` | Idempotent `otcSaleReferenceId(saleId)` + `dispenseOperationId`; walk-in uses nullable `patient_id` on `charges` only for pharmacy |
| **4. Products & Stock** | `GET /api/v1/inventory/pharmacy-stock-table` | `InventoryController.pharmacyStockTable` → `InventoryService.pharmacyStockTable` | `inventory_items`, `inventory_locations`, `inventory_batches`, `inventory_reservations`, `tenant_settings` (pricing) | `@RequirePermissions('pharmacy:read', 'inventory:read')`; returns one row per lot/batch at the selected store |
| **HCC → Pharmacy Configuration (A–F)** | `POST /api/v1/inventory/items`<br>`PATCH /api/v1/inventory/items/:id`<br>`PATCH /api/v1/inventory/items/:id/pricing`<br>`POST /api/v1/inventory/stock-take-sessions`<br>`GET /api/v1/inventory/stock-take-sessions/:id/sheet`<br>`POST /api/v1/inventory/stock-take-sessions/:id/import-counts`<br>`POST /api/v1/inventory/stock-take-sessions/:id/submit`<br>`POST /api/v1/inventory/stock-take-sessions/:id/reject`<br>`POST /api/v1/inventory/stock-take-sessions/:id/approve`<br>`GET /api/v1/inventory/integrity` | `InventoryService.createItem`<br>`InventoryService.updateItem`<br>`InventoryService.updateItemPricing`<br>`InventoryService.createStockTakeSession`<br>`InventoryService.exportPhysicalCountSheet`<br>`InventoryService.importCountsIntoSession`<br>`InventoryService.submitStockTakeSession`<br>`InventoryService.rejectStockTakeSession`<br>`InventoryService.approveAndPostStockTakeSession`<br>`InventoryService.integrityReport` | `inventory_items`, `tenant_settings`, `inventory_stock_take_sessions`, `inventory_stock_take_lines`, `inventory_batches`, `inventory_transactions` | View: `inventory:read` or `pharmacy:read`; Mutate catalogue/counts: `inventory:manage`; Approve stock-take: `inventory:manage` or `settings:manage` **and** `actor !== submittedBy` |

---

## 3. Changed Files & Migrations

### Backend Files Modified / Added
- `backend/src/inventory/inventory.controller.ts` — added `GET /inventory/pharmacy-dashboard`, `GET /inventory/pharmacy-stock-table`, `GET /inventory/stock-take-sessions/:id/sheet`, `POST /inventory/stock-take-sessions/:id/import-counts`.
- `backend/src/inventory/inventory.service.ts` — implemented `pharmacyDashboard`, `pharmacyStockTable`, `exportPhysicalCountSheet`, `importCountsIntoSession`; extended `listItems` and `updateItem` with `minLevel`/`maxLevel`, `name`, and `unit`; disabled direct CSV `stock_take` posting (`STOCK_TAKE_INVALID`).
- `backend/src/inventory/inventory.dto.ts` — extended `UpdateInventoryItemDto` (`name`, `unit`, `minLevel`, `maxLevel`) and added `ImportStockTakeCountsDto`.
- `backend/src/inventory/inventory.service.spec.ts` — added unit tests for `pharmacyDashboard` (OPD vs IPD separation, available stock after holds, low stock, pending stock-take sessions), `pharmacyStockTable` (per-batch rows preserving distinct expiry dates), and CSV stock-take bypass rejection.
- `backend/src/payments/payments.service.ts` — added `listRecentPharmacyCharges` and `listRecentPharmacyPayments` for dashboard and OTC queue aggregation.
- Preserved existing additive migrations in `backend/src/database/migrations/`:
  - `1772000000000-InventoryReservations.ts`
  - `1772100000000-PharmacyWalkInCharges.ts`
  - `1772200000000-InventoryStockTakeSessions.ts`

### Frontend Files Modified / Added
- `frontend/src/lib/navigation.ts` — reduced `Pharmacy & Supply` to `Dashboard`, `Prescription & OTC Queue`, `OTC Point of Sale`, `Products & Stock`; replaced `Stock Oversight` with `Pharmacy Configuration` under `Hospital Control Center`.
- `frontend/src/lib/nav-module-filter.ts` & `frontend/src/lib/screen-aliases.ts` — mapped new and retired pharmacy screen names cleanly.
- `frontend/src/lib/control-center-permissions.ts` — allowed `inventory:read` or `pharmacy:read` or `settings:manage` to open `pharmacy` in Control Center.
- `frontend/src/components/orders/PharmacyModule.tsx` — restructured around the four operational destinations.
- `frontend/src/components/orders/PharmacyDashboard.tsx` — connected to `GET /inventory/pharmacy-dashboard` with explicit loading and error handling.
- `frontend/src/components/orders/PharmacyUnifiedQueue.tsx` — unified OPD prescriptions, IPD prescriptions, and OTC sales/orders queue.
- `frontend/src/components/orders/PharmacyProductsStockPanel.tsx` — searchable, sortable, paginated batch/store table backed by `GET /inventory/pharmacy-stock-table`.
- `frontend/src/components/admin/panels/PharmacyConfigPanel.tsx` — single Hospital Control Center Pharmacy Configuration desk (sections A–F).
- `frontend/src/components/admin/HospitalControlCenter.tsx`, `ControlCenterHome.tsx`, `control-center-sections.tsx`, `frontend/src/App.tsx` — wired `Pharmacy Configuration` card and route.

---

## 4. Automated Test Commands & Results

```bash
npm --prefix backend test -- --runInBand --forceExit
```
- **Test Suites:** `87 passed, 87 total`
- **Tests:** `472 passed, 20 skipped, 492 total` (`0 failed`)

```bash
npm --prefix backend run build && npm --prefix frontend run build
```
- **Backend Build (`nest build`):** Succeeded (`0` errors)
- **Frontend Build (`tsc -b && vite build`):** Succeeded (`2303` modules transformed)
- **Docker Rebuild (`docker compose up -d --build frontend backend`):** Succeeded; live containers updated.

---

## 5. Browser Verification & Evidence Index

Executed against `http://localhost:8080/` using the authorised local administrator account (no credentials echoed or captured). All screenshots are stored in `docs/pharmacy-e2e-evidence-2026-10-22/`:

| # | File | Scenario | Result |
|---|---|---|---|
| 01 | `01-login-home.png` | Login screen before password entry | **PASSED** |
| 02 | `02-pharmacy-home.png` | Initial Pharmacy workspace login check | **PASSED** |
| 03 | `03-pharmacy-pos.png` | OTC Point of Sale empty cart & walk-in inputs | **PASSED** |
| 04 | `04-pos-catalogue-search.png` | POS search showing `Paracetamol 500mg tablet (PARA500)` · `4694` available · `no price` | **PASSED** |
| 05 | `05-stock-take-session.png` | Stock-Take & Reconciliation session panel + disabled CSV direct post | **PASSED** |
| 06 | `06-nav-four-destinations.png` | Sidebar `Pharmacy & Supply` showing exactly `Dashboard`, `Queue`, `POS`, `Stock` and `HCC → Pharmacy cfg` | **PASSED** |
| 07 | `07-pharmacy-dashboard.png` | Restructured Dashboard showing `Pending prescriptions (OPD 0 · IPD 0)`, `OTC sales today (0)`, `Available stock (4694, On-hand 4694, Reserved 0)`, `Stock & count exceptions (0)` | **PASSED** |
| 08 | `08-prescription-otc-queue.png` | Unified `Prescription & OTC Queue` (`OPD Prescriptions`, `IPD Prescriptions`, `OTC Sales / Orders`, `All Pending Rx`, `Partial Rx`, `Rx History`) | **PASSED** |
| 09 | `09-products-and-stock.png` | `Products & Stock` table with Store selector (`Pharmacy Store`), status filter, and sort | **PASSED** |
| 10 | `10-products-and-stock-rows.png` | `Products & Stock` lot rows (`Examination gloves`, `Paracetamol 500mg tablet` per lot) | **PASSED** |
| — | Accessibility snapshot verified | `Hospital Control Center → Pharmacy Configuration` tabs `A. Pharmacy Catalogue` through `F. Reports & Audit` | **PASSED** (DOM/a11y snapshot verified; PNG capture timed out once in headless tool) |
| — | Mutating E2E (prepare sale, pay, dispense, create/approve stock-take) | Requires confirmed disposable DB and second `inventory:manage` user | **BLOCKED** (local compose DB has 26 patients / 66 ledger rows) |
