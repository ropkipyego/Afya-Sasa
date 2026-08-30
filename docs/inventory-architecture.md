# AfyaSasa Inventory Architecture

**Generated:** 2026-08-28 · **Updated:** 2026-08-29  
**Status:** Implemented in code — see gaps below  
**Rule:** One inventory engine. Pharmacy and Main Store are **custodians/locations**, not separate stock systems.

---

## 1. Current state (audit — 2026-08-29)

| Capability | Exists? | Location |
|------------|---------|----------|
| Item master | ✅ | `inventory.service.ts` — `inventory_items` |
| Stock locations | ✅ | PHARMACY, MAIN_STORE, WARD-GENERAL |
| Stock balances | ✅ | `inventory_batches.qty_on_hand` per location |
| Batches / expiry | ✅ | Required on pharma receipts |
| Receipts (GRN) | ✅ | `POST /inventory/receipts` |
| Requisitions | ✅ | Create → approve → issue → acknowledge |
| Auto-routing | ✅ | `pharmaceutical` → pharmacy; else → main store |
| Issues / transfers | ✅ | Requisition issue + transfer ship/receive |
| Returns | ❌ | Entity type only |
| Adjustments / stock take | ❌ | Not implemented |
| Movement ledger | ✅ writes | `inventory_transactions` — **no read API/UI** |
| Pharmacy dispense | ✅ | FEFO + `DISPENSE` ledger + clinical order status |
| MAR (administration log) | ✅ | `medication_administration_records` (nursing) — separate from inventory |

**Backend:** `backend/src/inventory/` (controller, service, entities, DTOs)  
**Frontend:** `InventoryModule.tsx` (Stock, Requisitions, Transfers, Receive), `PharmacyWorkspace.tsx`  
**Tests:** `ops/inventory-workflow-test.sh`, `ops/pharmacy-workflow-test.sh`

### Known gaps

1. **Requisition issue** debits source batches + writes ledger but does **not credit destination** location batches.  
2. **Ledger list API** — transactions written but not exposed for audit UI.  
3. **Patient timeline** — dispense events not aggregated.  
4. **RETURN / ADJUSTMENT / STOCK_TAKE** — transaction types in schema; no service endpoints.  
5. **Medication→SKU matching** — paracetamol heuristic; other drugs need explicit `itemId`.

**Conclusion:** Inventory engine is **~80% implemented**. Do not build separate pharmacy/store systems.

---

## 2. Target domain model

### 2.1 Core entities (proposed)

All tables in tenant schema (currently `demo`; future: dynamic per tenant).

```
inventory_items              — Item master (SKU, name, category, unit, track_batch)
inventory_categories         — pharmaceutical | medical_consumable | non_medical
inventory_locations          — PHARMACY, MAIN_STORE, WARD-{id}, THEATRE, ED, etc.
inventory_batches            — batch_no, expiry_date, item_id, location_id, qty_on_hand
inventory_balances           — item_id, location_id, qty (derived or materialized)
inventory_transactions     — LEDGER (immutable append-only)
inventory_requisitions       — Header: requesting dept, status, requested_by
inventory_requisition_lines  — item_id, qty_requested, routed_to (pharmacy|main_store)
inventory_transfers          — source_location, dest_location, status workflow
inventory_transfer_lines     — item_id, batch_id?, qty
inventory_dispensations      — Links prescription → batch lines → patient
inventory_stock_takes        — Period close / count sessions
```

### 2.2 Transaction ledger (required)

Every stock movement creates an `inventory_transactions` row:

| Field | Purpose |
|-------|---------|
| `item_id` | What moved |
| `quantity` | How much (+ in, − out) |
| `unit` | tablets, vials, pairs, etc. |
| `source_location_id` | Nullable for receipts |
| `destination_location_id` | Nullable for issues/consumption |
| `transaction_type` | RECEIPT, ISSUE, TRANSFER_OUT, TRANSFER_IN, RETURN, ADJUSTMENT, DISPENSE, STOCK_TAKE |
| `batch_id` | When batch-tracked |
| `reference_type` | requisition, transfer, dispensation, lab, etc. |
| `reference_id` | UUID of source document |
| `user_id` | Who performed |
| `reason` | Required for adjustments |
| `created_at` | Timestamp |

**Rule:** Never `UPDATE inventory_batches.qty_on_hand` without a matching transaction row (or use DB trigger to enforce).

### 2.3 Balance strategy

**Option A (recommended for pilot):** Materialized balance updated in same transaction as ledger insert (with row lock on batch).

**Option B:** Balance computed `SUM(transactions)` — correct but slower; use for audit reconciliation.

---

## 3. Pharmacy vs Main Store

### Pharmacy custodian

**Handles:**
- Medicines and pharmaceutical products
- Dispensing to patients
- Pharmaceutical stock (batch/expiry mandatory)
- Ward/pharmacy transfers of meds
- FEFO picking

**Workflow:**

```
DOCTOR PRESCRIPTION (clinical_orders / future prescriptions table)
  ↓
PHARMACY QUEUE (status: pending_review)
  ↓
PHARMACIST REVIEW
  ↓
STOCK CHECK (inventory_batches at PHARMACY location)
  ↓
BATCH SELECT (FEFO)
  ↓
DISPENSE → inventory_transactions (DISPENSE) + inventory_dispensations
  ↓
PATIENT MEDICATION RECORD (link to encounter/admission + MAR optional)
```

### Main Store custodian

**Handles:**
- Medical consumables (gloves, gauze, syringes, IV sets, dressings, PPE)
- Non-medical supplies (kitchen, cleaning, stationery, laundry, maintenance)

**Workflow:**

```
DEPARTMENT REQUISITION
  ↓
APPROVAL (head nurse / admin)
  ↓
MAIN STORE PICK
  ↓
ISSUE → inventory_transactions (ISSUE)
  ↓
DEPARTMENT RECEIVES (acknowledge)
```

---

## 4. Automatic stock routing

Departments submit **one requisition**. System routes lines by item category:

| Item example | Category | Routed to |
|--------------|----------|-----------|
| Propofol | pharmaceutical | Pharmacy |
| Gloves | medical_consumable | Main Store |
| Gauze | medical_consumable | Main Store |
| Cleaning fluid | non_medical | Main Store |

Implementation:

```typescript
function routeRequisitionLine(item: InventoryItem): 'pharmacy' | 'main_store' {
  if (item.category === 'pharmaceutical') return 'pharmacy';
  return 'main_store';
}
```

Theatre example:

```
THEATRE requisition [Propofol, Gloves, Gauze]
  → splits into:
     Pharmacy queue: Propofol
     Main Store queue: Gloves, Gauze
```

Department UI shows **one submission**; backend creates sub-requests or routed lines.

---

## 5. Transfers

```
TRANSFER CREATED (draft)
  ↓ APPROVED
ISSUED FROM SOURCE (TRANSFER_OUT txn)
  ↓ IN TRANSIT
RECEIVED AT DESTINATION (TRANSFER_IN txn)
  ↓ COMPLETED
```

Examples:
- Main Store → Theatre
- Pharmacy → Ward
- Ward → Pharmacy (return unused meds)

Source and destination balances must reconcile: `qty_out = qty_in` (minus documented loss).

---

## 6. Returns

```
DEPARTMENT RETURN REQUEST
  ↓ INSPECTION (pharmacist / store keeper)
ACCEPTED | REJECTED | QUARANTINE
  ↓
If accepted → RETURN transaction (may not go to available — quarantine/expired path)
```

Do not auto-return expired or opened items to sellable stock.

---

## 7. Batch + expiry

Pharmaceutical batches required:

| Field | Required |
|-------|----------|
| `batch_no` | Yes |
| `expiry_date` | Yes |
| `quantity` | Yes |
| `location_id` | Yes |

**FEFO:** On dispense, select batch with earliest `expiry_date` where `qty > 0` and not expired.

**Alerts (notification engine):**
- Near expiry (configurable days)
- Expired (block dispense)
- Low stock (reorder level on item master)
- Out of stock

---

## 8. Integration with clinical modules

| Clinical event | Inventory action |
|----------------|------------------|
| Doctor prescription | Create pharmacy queue item (no stock move yet) |
| Pharmacist dispense | DISPENSE transaction |
| Theatre procedure | Consumption issue from requisition or direct issue |
| Lab sample collection | Optional consumable issue (future) |
| IPD MAR administer | Record administration; may link to dispensed batch |
| Discharge | Return unused meds workflow |

**Theatre supply routing:** Medicines → Pharmacy requisition; consumables → Main Store requisition (same requisition UI, auto-split).

---

## 9. API design (domain actions)

| Good | Bad |
|------|-----|
| `POST /inventory/requisitions` | `POST /fix-stock` |
| `POST /inventory/dispensations` | `POST /subtract-pharmacy-qty` |
| `POST /inventory/transfers/:id/receive` | `POST /move-items-manually` |
| `GET /inventory/locations/:id/balances` | `GET /pharmacy-stock-json` |

NestJS module proposal: **`backend/src/inventory/`** single module exported to pharmacy and store controllers as thin facades if needed.

---

## 10. UI surfaces (future — not built)

| Screen | User | Purpose |
|--------|------|---------|
| Pharmacy queue | Pharmacist | Review prescriptions, dispense |
| Main Store queue | Store keeper | Pick/issue requisitions |
| Department requisition | Ward/theatre/ED | Request supplies |
| Stock balances | Admin | Location balances |
| Batch/expiry report | Pharmacist | Near-expiry list |
| Transfer inbox | Both custodians | Approve/receive transfers |

**Do not duplicate** patient or order systems. Link via `patient_id`, `encounter_id`, `clinical_order_id`.

---

## 11. Audit & timeline

Every inventory transaction must:

1. Write `inventory_transactions` row  
2. Trigger audit log (via existing interceptor or explicit domain audit)  
3. Appear on patient timeline when patient-linked (dispense)  
4. Notify on low stock / near expiry  

---

## 12. Migration path from current stub

**Phase 1 (P1):** Add inventory tables + ledger + item/location seed (Pharmacy + Main Store locations only).

**Phase 2:** Wire pharmacy dispense to replace mirror-only pharmacy orders; keep `ClinicalOrder` as index pointing to `inventory_dispensations.id`.

**Phase 3:** Requisitions + routing + transfers.

**Phase 4:** Batch/expiry + FEFO + alerts.

**Do not** delete existing `clinical_orders` pharmacy rows — migrate metadata into `prescriptions` / `dispensations` with backfill script.

---

## 13. Risks if built wrong

| Anti-pattern | Risk |
|--------------|------|
| Two separate stock tables | Split balances, reconciliation nightmare |
| Direct qty UPDATE | Unaudited shrinkage |
| Pharmacy without batches | Regulatory failure, expired meds dispensed |
| UI-only stock | Phantom inventory |
| Department picks custodian manually | Wrong workflow, training burden |

---

## 14. Definition of done (inventory)

Inventory work is done when a tester can:

1. Receive stock into Pharmacy with batch/expiry  
2. Doctor prescribes → pharmacist dispenses with FEFO batch  
3. Ledger shows DISPENSE; balance reduced  
4. Main Store receives requisition → issues gloves → department acknowledges  
5. Transfer Main Store → Theatre completes with balanced txn pairs  
6. Return rejected expired item does not increase sellable stock  
7. All steps appear in audit + relevant patient timeline  

**Current completion: 0/7**
