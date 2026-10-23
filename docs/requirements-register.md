# AfyaSasa approved requirements register

Status values: `missing` · `in progress` · `implemented` · `locally verified` · `blocked by policy`.

| ID | Requirement | Status | Dependencies | Acceptance | Evidence |
|---|---|---|---|---|---|
| NAV-1 | Pharmacy 4 destinations | locally verified | `navigation.ts`, `PharmacyModule.tsx` | Dashboard, Prescription & OTC Queue, OTC Point of Sale, Products & Stock | `06-nav-four-destinations.png` |
| DASH-1 | Backend-driven Dashboard | locally verified | `GET /inventory/pharmacy-dashboard` | OPD/IPD Rx, OTC today, On-hand/Reserved/Available, low/out-of-stock, near-expiry, pending stock-takes | `07-pharmacy-dashboard.png` + PG integration |
| QUEUE-1 | Unified Prescription & OTC Queue | locally verified | `PharmacyUnifiedQueue.tsx` | OPD, IPD, OTC sales/orders tabs + clearance check | `08-prescription-otc-queue.png` + PG integration |
| RX-OPD-IPD | OPD & IPD prescription -> queue -> prepare -> clearance -> dispense -> header sync | locally verified | `ClinicalOrderMirrorService`, `InventoryService` | Idempotent `clientRequestId`, OPD vs IPD separation, unpaid block, DISPENSE ledger, header status sync | `inventory-pg.integration.spec.ts` (16/16 pass) |
| POS-1 | OTC Point of Sale | locally verified | `PharmacyPosPanel.tsx` | Multi-line cart, barcode, walk-in, prepare/issue | `03-pharmacy-pos.png`, `04-pos-catalogue-search.png` |
| POS-6 | POS discounts / tax | blocked by policy | none | No hospital POS discount/VAT policy | Disabled in UI |
| POS-8 | Walk-in customer optional | locally verified | nullable charge `patient_id` | OTC without dummy patient; cashier sale lookup | `1772100000000-PharmacyWalkInCharges.ts` |
| STOCK-1 | Products & Stock table | locally verified | `GET /inventory/pharmacy-stock-table` | Searchable, sortable, paginated lot/batch table with on-hand, reserved, available, reorder | `09-products-and-stock.png`, `10-products-and-stock-rows.png` |
| BULK-1 | Pharmacy Catalogue bulk importer & controlled opening stock | locally verified | `PharmacyConfigPanel.tsx`, `importCatalog` | Template download, dry-run preview, create/update, duplicates, invalid date/qty/location errors, error CSV download, zero stock mutation on catalogue import, separate opening-stock receipt | `12-hcc-catalogue-bulk-import.png`, `13-hcc-stores-opening-stock.png` + PG integration |
| HCC-CFG | Single HCC Pharmacy Configuration (1–6) | locally verified | `PharmacyConfigPanel.tsx` (`inventory:read` / `pharmacy:read`) | 1. Catalogue & Bulk Import, 2. Stores & Opening Stock, 3. Stock-Take & Reconciliation, 4. Batches & Expiry, 5. Rules & Approvals, 6. Reports & Audit | `12-hcc-catalogue-bulk-import.png`, `13-hcc-stores-opening-stock.png` |
| VAR | Controlled stock-take lifecycle & CSV bypass retired | locally verified | `stock-take-session.ts`, `InventoryService` | Baseline → physical sheet (`book_qty` + blank `physical_count`) → import counts (rejects unknown/ambiguous/unit mismatch) → submit → reject/recount → independent approve → drift detection → rollback → post once | `05-stock-take-session.png` + PG integration (`inventory_it`) |
| LOGIN-1 | Login screen demo text cleanup | locally verified | `TenancyService.toPublicHospital`, `LoginScreen.tsx` | Removed `Demo address` and rollout placeholder text while preserving `jalaram` tenant and auth | `11-login-cleaned.png` |
| RET | Quarantine / recall / disposal / customer returns | blocked by policy | no movement rules | Non-destructive views only; no fake buttons | Documented in Tab 4 & Tab 5 |
| ERR-1 | Error envelope + `formatApiError` | locally verified | `api-error.filter.ts` | Explicit error states; never silently zero | `api-error.filter.spec.ts` |

Tenant `jalaram`, schema `demo`, API `/api/v1`. Do not commit from this register.
