# AfyaSasa Phase 2 — Finance + Pharmacy Architecture Audit

**Date:** 22 September 2026  
**Status:** Audit accepted. First no-migration increment implemented 23 Sep 2026: expired FEFO block, import preview / products-only commit, hospital receipt numbers, unpaid dispensed-pharmacy cashier list. No schema created. Pending migrations still unapplied.  
**Live flags:** `TYPEORM_MIGRATIONS_RUN=false`, `AFYASASA_ALLOW_DEMO_SEED=false`  
**Pending files (unapplied):** `1768300000000-MarketingActivitiesFoundation`, `1768400000000-InventoryReorderLevels`

This document is the Phase 2 gate. Implementation starts only after review and approval.

---

## Live data snapshot (read-only)

| Dataset | Count | Notes |
| --- | --- | --- |
| Patients | 26 | Do not delete |
| Payment transactions | 2 | Both `cash` / `completed` / `consultation` |
| QuickBooks queue | 0 | Empty |
| Clinical orders | 25 | 7 pharmacy, all `dispensed` |
| Inventory items | 2 | `PARA500` (pharmaceutical), `GLOVES-M` (consumable) |
| Inventory batches | 13 | Authoritative qty |
| Inventory transactions | 66 | RECEIPT 33, ISSUE 16, DISPENSE 7, TRANSFER 10 |
| Locations | 3 | PHARMACY, MAIN_STORE, WARD-GENERAL |
| MAR rows | 17 | Nursing only |
| SHA eligibility checks | 0 | Table exists; unused |

`min_level` / `max_level` are **not** on live `demo.inventory_items`. Reorder migration remains unapplied.

---

## A. Current finance architecture

### What already works

- One operational payment table: `demo.payment_transactions`
- Cashier UI (`FinanceModule` → Payment Desk / Revenue / SHA)
- Manual payment: cash, card, insurance, quickbooks, waived → status `completed` immediately
- M-Pesa STK: status starts `initiated`; becomes `completed` only on callback `ResultCode === 0` (not on STK send)
- 2-minute duplicate guard: same patient + method + service line + amount
- Client PDF receipt (`printPaymentReceipt` / `buildSimplePdfBlob`) — real `%PDF`, not HTML-as-PDF
- HTTP audit interceptor writes `demo.audit_logs` for payment POSTs
- Patient timeline includes payment events
- Clinic consultation fee (`demo.clinics.consultation_fee`) and inventory sell price (settings JSON) can prefill cashier amounts
- No second general ledger in AfyaSasa

### Tables

| Table | Role |
| --- | --- |
| `demo.payment_transactions` | Canonical operational payment |
| `demo.quickbooks_sync_queue` | One-way outbound QB jobs |
| `demo.lab_requests` | Billing columns: `payment_status`, `billing_amount`, `payment_reference` |
| `demo.encounters` | `payment_method`, `receipt_number` (last ref only) |
| `demo.clinics` | `consultation_fee` (price config) |
| `demo.sha_eligibility_checks` | Eligibility only — not claims |
| `public.settings.clinical_catalog` | Payment methods, insurance schemes, inventory pricing |

**Do not exist:** invoices, charges, receipts (as rows), refunds, reversals, patient balances, cashier shifts, SHA claims.

### Payment row (authoritative columns)

`patient_id` (required), `encounter_id` (optional), `lab_request_id` (optional), `service_line` (`consultation` \| `pharmacy` \| `laboratory` \| `radiology` \| `inpatient` \| `other`), `service_entity_id`, `service_description`, `method`, `payer_scheme`, `amount`, `currency`, `status` (`pending` \| `initiated` \| `completed` \| `failed` \| `cancelled`), `external_reference`, `mpesa_phone`, `raw_callback`, `metadata`, audit/soft-delete columns.

### APIs (`/api/v1`)

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/payments/mpesa/stk-push` | `payments:initiate` |
| POST | `/payments/mpesa/callback` | Public |
| POST | `/payments/manual` | `payments:initiate` |
| GET | `/payments/transactions` | `payments:read` or `payments:initiate` |
| GET | `/integrations/quickbooks/queue` | `payments:manage` |
| PATCH | `/integrations/quickbooks/queue/:id/synced` | `payments:manage` |
| POST | `/integrations/quickbooks/webconnector` | Public (QBWC SOAP) |
| GET/POST | `/sha/*` | Patient read/search — eligibility only |

### Frontend

- `frontend/src/components/payments/FinanceModule.tsx` — Cashier, Revenue, SHA
- `PaymentDesk.tsx`, `PaymentCheckoutPanel.tsx`, `FinanceRevenuePanel.tsx`, `FinanceShaPanel.tsx`
- Embedded checkout: lab walk-in, radiology request
- OPD check-in stores `paymentMethod` / `receiptNumber` on the **encounter**, not via `PaymentsService`
- No QuickBooks queue UI

### Permissions

| Key | Roles (seeded) |
| --- | --- |
| `payments:read` | administrator, records_officer |
| `payments:initiate` | administrator, records_officer |
| `payments:manage` | administrator |

Doctor does not collect money. That is correct.

### Money flow (actual)

```
Price hint (clinic fee / inventory sell / typed amount)
        ↓
PaymentDesk / PaymentCheckoutPanel
        ↓
  ┌─────┴──────┐
  M-Pesa STK   Manual (cash/card/insurance/quickbooks/waived)
  status=initiated   status=completed
        ↓
  Callback ResultCode=0 → completed
        ↓
applyCompletedPayment → lab_requests and/or encounters
        ↓
Client PDF receipt
        ↓
enqueueQuickbooks (narrow cases only)
        ↓
QBWC polls pending queue → QuickBooks Desktop
```

**Charge origin today:** there is no charge row. Amount is chosen at collection time.

**Receipt number today:** M-Pesa receipt in `external_reference`; manual optional `reference`; PDF filename uses patient number. No hospital receipt sequence.

**Outstanding balance:** not stored and not computed server-side.

**QuickBooks:** one-way AfyaSasa → QB Desktop. Queue empty in live DB. `invoice_add` QBXML is minimal; `payment_add` / `customer_add` fall through to stub `HostQueryRq`. Failed status is never written by application code. No retry. Authenticate token is hardcoded `afyasasa-token` (QBWC passwords in env are not validated).

---

## B. Current pharmacy architecture

### What already works

- One inventory engine. Pharmacy and Main Store are **locations**, not two stock systems
- Item master + batches + movement ledger
- Prescribe = `clinical_orders` (`order_type='pharmacy'`) on the **same patient**
- Dispense deducts stock (FEFO by `expiry_date ASC`, then `createdAt`)
- Prescribe does **not** deduct stock
- MAR is a separate nursing chart with **no** FK to orders or batches
- CSV item import exists
- Requisitions and transfers exist
- Patient timeline has `pharmacy_prescription` and `pharmacy_dispense` events
- OTC dispense exists (`reference_type=otc_sale`)

`docs/inventory-architecture.md` (Aug 2026) is **partially stale**: ledger read API/UI and requisition destination credit now exist.

### Tables

| Table | Role |
| --- | --- |
| `inventory_items` | Product master (sku, name, category, unit, track_batch) |
| `inventory_locations` | PHARMACY / MAIN_STORE / WARD-GENERAL |
| `inventory_batches` | `qty_on_hand` per item+location+batch |
| `inventory_transactions` | Immutable movements |
| `inventory_requisitions` + lines | Department requests |
| `inventory_transfers` + lines | Inter-location moves |
| `clinical_orders` | Prescriptions when `order_type='pharmacy'` |
| `medication_administration_records` | IPD MAR |

**Do not exist:** `prescriptions`, `medications`, `suppliers`, purchase orders, GRN documents, stock-take tables, pack-conversion tables, `inventory_dispensations`.

### Workflow

```
Doctor  → POST /clinical-orders/pharmacy     (no stock)
Pharmacy → POST /inventory/dispense/pharmacy  (FEFO deduct + status=dispensed)
Nursing  → POST /nursing/mar                  (administration only)
Cashier  → POST /payments/manual              (optional, not triggered by dispense)
```

### APIs (pharmacy-relevant)

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/clinical-orders/pharmacy` | `pharmacy:prescribe` or `consultations:create` |
| GET | `/clinical-orders` | pharmacy/consult/lab read |
| POST | `/inventory/dispense/pharmacy` | `pharmacy:dispense` or `inventory:manage` |
| POST | `/inventory/dispense/otc` | same |
| POST | `/inventory/receipts` | `inventory:manage` |
| POST | `/inventory/items/import` | `inventory:manage` or `settings:manage` |
| GET | `/inventory/locations/:id/balances` | inventory/pharmacy read |
| GET | `/inventory/alerts/low-stock` | returns empty until reorder columns exist |

### Frontend

- `PharmacyModule` — queue, dispense, pharmacy stock, OTC
- `InventoryModule` — store, receive, requisitions, transfers, ledger, prices
- `PrescriptionForm` — OPD and IPD
- `MarGrid` — nursing, labelled as separate from pharmacy
- No ED prescribing UI

### Permissions

`pharmacy:read` (admin/doctor/nurse), `pharmacy:prescribe` (admin/doctor), `pharmacy:dispense` (admin/nurse), `inventory:read` / `inventory:manage`.

---

## C. Finance gaps

### Critical

1. **No charge object.** Money is collected without a durable “this service is owed” record. Duplicate cashier entries and missed collections are both possible.
2. **Receipt is not a server record.** PDF is generated in the browser. No hospital receipt sequence. Cannot reliably answer “what was the receipt number?” after a lost download.
3. **No refund / reversal.** Completed payments cannot be undone in-system.
4. **Waiver is only a payment method.** Original amount is not retained as a separate charge with an authorised write-off.
5. **QuickBooks Desktop sync is incomplete.** `payment_add`/`customer_add` are stubs; failures are not persisted; queue has no UI; live queue is empty.

### Important

6. **No patient outstanding balance.** Cannot list what is unpaid across encounter/services.
7. **No cashier shift / daily reconciliation** (open → collect → close → variance → supervisor).
8. **Insurance is a method + optional `payer_scheme`.** No split of insurer vs patient responsibility. Lab can be `insurance_pending`; other lines cannot.
9. **SHA is eligibility only.** Claims must not be implemented in this Phase 2 finance slice.
10. **OPD check-in payment fields bypass `PaymentsService`.** Encounter can show a receipt number with no `payment_transactions` row.
11. **Inpatient service line exists in types only.** No IPD billing workflow.
12. **Radiology has no payment_status columns.** Payment is generic only.
13. **M-Pesa callback is public.** Needed for Daraja; must stay tightly parsed and never mark paid on STK initiate (already correct).

### Later

14. Card confirmation beyond “cashier marks completed”.
15. Finance dashboards (collections, method totals, QB exceptions).
16. Two-way QuickBooks (must remain one-way).

---

## D. Pharmacy gaps

### Critical

1. **Live catalogue is two SKUs.** Hospital cannot operate pharmacy on this. Bulk import is required — but current import can **receive opening qty immediately**, which is dangerous on a live DB.
2. **Opening stock on import is unsafe.** Existing CSV import upserts SKU and may `receiveStock()` from `opening_qty`. Must not invent or overwrite live stock from a spreadsheet.
3. **Expired batches can still be dispensed.** FEFO sorts by expiry but does not exclude expired lots.
4. **Dispense does not create a charge.** Cashier can bill a different amount, twice, or not at all.

### Important

5. **Product identity is SKU + free-text name.** No generic/strength/form/route uniqueness. Duplicate medicines are likely on import.
6. **Single unit string.** No pack hierarchy (box → strip → tablet).
7. **No suppliers / PO / formal GRN.** Receipt is a stock event only.
8. **RETURN / ADJUSTMENT / STOCK_TAKE** exist as enum values only — no API, no who/why enforcement.
9. **No `inventory_dispensations` table.** Batch allocations live in `clinical_orders.metadata` + ledger.
10. **Low-stock columns not live.** UI may fall back to a hardcoded threshold of 10.
11. **MAR remains unlinked** (correct for Phase 1). Do not add a FK in this audit.

### Later

12. FEFO policy confirmation vs hospital SOP.
13. Near-expiry notifications (UI heuristic only today).
14. ED prescribing UI.
15. XLSX import (CSV exists).
16. Fast/slow mover reports.

---

## E. Proposed data model (do not create)

### Finance (operational — not a ledger)

```
Patient
  └── Encounter
        └── Charge          ← NEW operational row (not GL)
              ├── service_line, service_entity_id, amount, status
              ├── Payment(s)  ← EXISTING payment_transactions
              └── Receipt     ← NEW server receipt_no + PDF metadata
                    └── QuickBooks queue (EXISTING, outbound only)
```

**Charge statuses (proposed):** `owed` → `partially_paid` | `paid` | `waived` | `cancelled`  
**Payment stays as collected money.** Do not replace `payment_transactions`.  
**QuickBooks remains accounting.** AfyaSasa never stores trial balance, P&L, or bank rec.

### Pharmacy

```
Patient
  └── Encounter / Admission
        └── Prescription (clinical_orders.order_type=pharmacy)  ← EXISTING
              └── Dispensing event (ledger DISPENSE + metadata) ← EXISTING
                    └── inventory_batches.qty_on_hand            ← EXISTING
                          └── inventory_items (product master)   ← EXISTING, extend later
```

**Product master extensions (later, after import design approval):** generic name, brand, strength, form, route, pack size — still one `inventory_items` row, not a second medicine table.

**Batch stays `inventory_batches`.** Opening stock is a controlled `RECEIPT` after stock-take, never a silent CSV side effect.

---

## F. Import template (proposed)

Existing file: `frontend/public/templates/inventory-stock-import-template.csv`  
Columns today: `sku,name,category,unit,track_batch,cost,markup,sell,opening_qty,batch_no,expiry`

### Proposed columns and ownership

| Column | Layer | Import now? |
| --- | --- | --- |
| Item code (SKU) | Product master | Yes — required |
| Generic name | Product | Yes — required |
| Brand name | Product | Optional |
| Strength | Product | Required where form is dosed |
| Dosage form | Product | Yes |
| Route | Product | Optional |
| Unit (base) | Product | Yes |
| Pack size / conversion | Product (later) | No — do not invent |
| Category | Product | Yes (`pharmaceutical` / `medical_consumable` / `non_medical`) |
| Manufacturer | Product | Optional |
| Purchase price | Product pricing (settings JSON today) | Optional |
| Selling price | Product pricing | Optional |
| Reorder level / max | Product | **Not until** `InventoryReorderLevels` is approved |
| Supplier name | Supplier / procurement | Metadata only — no supplier table yet |
| Batch number | Batch | Separate **stock-take** import, not product import |
| Expiry date | Batch | Stock-take import only |
| Opening quantity | Opening stock | Stock-take import only, review-before-commit |

**Rule:** product import must not post `RECEIPT`. Stock import is a second, supervised step.

---

## G. Import validation rules

### Required (product)

- Generic/product name
- Dosage form
- Unit
- Category
- SKU (or system-assigned after duplicate review)
- Strength when the form is tablet/capsule/injection/syrup

### Uniqueness

Do **not** key on name alone.

Proposed identity (review against Jalaram catalogue before coding):

`normalize(generic) + strength + dosage_form + route + unit`

SKU must also be unique. Likely duplicates are shown, never inserted silently.

### Numeric

- Quantities ≥ 0
- Prices ≥ 0
- Reorder ≥ 0
- Max ≥ reorder (when those columns exist)

### Expiry / batch

- Expiry must be a valid date
- Expired lots must never import as usable `qty_on_hand`
- Batch + product + location must be consistent
- If `track_batch` and quantity > 0: batch number and expiry required

### Process (mandatory)

```
Upload → Validate → Errors → Duplicates → New products → Human review → Confirm → Import → Audit log
```

Never: upload → insert.

---

## H. Finance ↔ pharmacy integration

| Event | Who | When | System of record |
| --- | --- | --- | --- |
| Prescription | Doctor | Consultation / IPD | `clinical_orders` |
| Stock deduction | Pharmacist | Dispense / OTC issue | `inventory_batches` + `inventory_transactions` (`DISPENSE`) |
| Charge | **One author** — recommended: pharmacy confirm-dispense **or** cashier if OTC unpaid | After dispense quantity is known, **or** at cashier if billed before issue | Proposed `charges` — **not** a second payment |
| Payment | Cashier / records (`payments:initiate`) | When money is collected or waiver authorised | `payment_transactions` |
| Receipt | AfyaSasa | On completed payment | Proposed server receipt + existing PDF |
| QuickBooks | Integration / admin | After completed operational payment (or nightly batch) | `quickbooks_sync_queue` → QB Desktop |

**Authoritative charge event:** exactly one charge per dispensed prescription line (or OTC sale). Cashier must attach payment to that charge. Dispense must not also invent a second charge. Payment Desk must not invent a charge that pharmacy already created.

**MAR never charges and never deducts stock.**

---

## I. Migration plan (not executed)

Pending files stay unapplied unless separately approved.

### 1. InventoryReorderLevels (`1768400000000`)

| | |
| --- | --- |
| CURRENT | `inventory_items` has no min/max. `listLowStock()` returns []. UI may use threshold 10. |
| PROBLEM | Low-stock is unreliable. |
| PROPOSED | Additive nullable `min_level`, `max_level`. |
| DATA IMPACT | 2 live items; both get NULL. No qty change. |
| MIGRATION | Existing file — apply only after backup + approval. |
| VALIDATION | Columns exist; quantities unchanged; 2 SKUs still present. |
| ROLLBACK | `DROP COLUMN` if unused. |
| RISK | Low if no other writes assume the columns. **Do not apply in this audit.** |

### 2. MarketingActivitiesFoundation (`1768300000000`)

Unrelated CRM. **Do not apply** as part of pharmacy/finance.

### 3. Future operational charge + receipt (not written)

| | |
| --- | --- |
| CURRENT | 2 payment rows; no charges; receipts are client PDFs. |
| PROBLEM | Cannot attach money to a service obligation. |
| PROPOSED | New `charges` + `receipt_no` on payment or receipt table. **Keep** `payment_transactions`. |
| DATA IMPACT | Backfill optional charges from the 2 completed payments (consultation). Do not invent balances. |
| ROLLBACK | Drop new tables; payments remain. |
| RISK | Medium — touches cashier path. Implement behind feature flag after UAT on test tenant if available. |

### 4. Product master columns (not written)

| | |
| --- | --- |
| CURRENT | sku, name, category, unit, track_batch. 2 items. |
| PROBLEM | Cannot uniquely identify medicines for import. |
| PROPOSED | Additive nullable columns (generic, brand, strength, form, route). |
| DATA IMPACT | 2 rows get NULL/derived values. Batches untouched. |
| ROLLBACK | Drop new columns. |
| RISK | Low if nullable. |

### 5. Do not migrate

- Patient table
- A general ledger
- MAR → pharmacy FK
- Opening stock from CSV into live batches

---

## J. Production risk

| Risk | Effect | Mitigation |
| --- | --- | --- |
| CSV opening_qty on live import | Fake or overwritten stock | Disable opening receive on product import; stock-take only |
| Applying pending migrations blindly | Marketing tables / reorder columns without hospital sign-off | Keep `TYPEORM_MIGRATIONS_RUN=false` |
| Replacing `payment_transactions` | Lose 2 real payments and cashier path | Extend, do not replace |
| Auto-charge on every historical dispense | 7 dispensed orders × invented prices | Charge only **new** dispenses after go-live of charge object |
| Expired FEFO pick | Patient could receive expired stock | Block expired batches before changing anything else |
| QBWC public SOAP + hardcoded token | Integration abuse if exposed | Keep internal; do not “fix” by inventing a new accounting system |
| Using real patients as import guinea pigs | Clinical/finance pollution | Import against catalogue files only; stock-take with pharmacy lead |
| Second patient or second ledger | Split identity / split money | Forbidden |

---

## K. Recommended implementation order

Do **not** finish all of finance before pharmacy, or the reverse. They share one charge event.

1. **Freeze rules** — keep `payment_transactions`; keep inventory engine; no GL; no SHA claims.
2. **Harden pharmacy import** — review-before-commit; split product vs stock; block expired opening qty. Use the 2 live SKUs as identity tests, not production stock replacement.
3. **Block expired FEFO issues** — small behaviour change on existing batches; no migration.
4. **Operational charge** — thin table linking patient + encounter + service + amount. Backfill only the 2 known payments if needed.
5. **Pharmacy dispense → one charge** — then cashier pays that charge. OTC same rule.
6. **Server receipt number + stored PDF metadata** — keep current PDF generator.
7. **Waiver as charge adjustment** — original amount retained.
8. **Refund/reversal** — new payment row `method`/`status`, never delete original.
9. **Cashier shift reconciliation** — after charges+payments are trustworthy.
10. **QuickBooks** — implement real `payment_add` QBXML and failure status; still one-way; still no AfyaSasa ledger.
11. **Reorder columns** — apply `InventoryReorderLevels` only after pharmacy lead confirms min/max.
12. **SHA claims / insurance splits** — later phase.

---

## Ownership boundary (proposed final)

| Data | AfyaSasa | QuickBooks |
| --- | --- | --- |
| Patient / encounter / clinical service | YES | Customer name/ref only if synced |
| Charge (operational) | YES | Invoice copy if/when QBXML is real |
| Payment transaction | YES | Payment copy / integration |
| Receipt | YES | Accounting record |
| Cashier shift | YES | Daily summary only |
| Patient balance (operational) | YES | Reconciliation support |
| SHA eligibility | YES | NO |
| SHA claim status | YES (later) | NO |
| General ledger / TB / P&L / BS / bank rec | NO | YES |

---

## Finance controls — can we answer them today?

| Question | Today |
| --- | --- |
| Who collected? | Partial — `created_by` + audit log |
| When? | YES — `created_at` |
| Which patient? | YES — `patient_id` |
| Which encounter? | Partial — optional, often null |
| Which service? | Partial — `service_line` + description; no charge line |
| How much? | YES — `amount` |
| Method? | YES — `method` |
| Receipt number? | Weak — optional reference / client PDF |
| Refunded? | NO |
| Waived? | Weak — method=`waived` only |
| Sent to QuickBooks? | Queue row if enqueued; live count 0 |
| Did QuickBooks accept? | Only if `status=synced` + `quickbooks_txn_id` |

---

## Approval gate

Phase 2 implementation must not start until this architecture is accepted, especially:

- Charge is operational, not a ledger
- Import never posts opening stock without a stock-take
- `payment_transactions` is kept
- Pending migrations stay unapplied until individually approved
