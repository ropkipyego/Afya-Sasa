# AfyaSasa Pharmacy — backend audit, stock-take verification and completion report

**Date:** 22 October 2026  
**Tenant:** `jalaram` · **schema:** `demo` · **API:** `/api/v1`  
**HEAD:** `247d026` on `main`  
**No commit, push, merge or deploy.**

## 1. Executive summary and release decision

CSV stock-take posting no longer bypasses independent approval. Counts can be imported into an open session; posting still requires a different authorised user. Physical count sheets use `book_qty` and a blank `physical_count` column.

The local compose database is **not disposable** (26 patient records, 66 inventory ledger rows). Mutating stock-take posting, sales, dispensing and recount were **not** run against it.

Authorised login on `http://localhost:8080/` **succeeded**. Pharmacy, POS and stock-take screens were opened and photographed. Full count → approve → post was not executed.

**Controlled release: no.** Staff-in-the-loop local UI: yes, with the caveats below.

## 2. Repository baseline (preserved)

Uncommitted pharmacy/POS/HCC/error-handling work was left intact. Additional changes this pass: CSV post disabled, session sheet + import-counts APIs, UI copy, tests, this evidence pack.

Compose backend: `POSTGRES_HOST=postgres`, `POSTGRES_DB=afyasasa`, `TYPEORM_MIGRATIONS_RUN=false`, `AFYASASA_ALLOW_DEMO_SEED=false`.  
Postgres container `/afya-sasa-postgres-1` created 2026-09-21. Host `.env` `POSTGRES_PORT=5432` is **not** the compose map (`5433`).

## 3. Architecture and data flow

One ledger: `demo.inventory_transactions`. Holds: `demo.inventory_reservations` (`held` / `consumed` / `released`). Charges/payments unchanged. Walk-in: nullable `patient_id` on pharmacy charges only.

Prepare → hold → cashier → `evaluatePharmacyClearance` → issue `DISPENSE`. Cancel releases holds; it does not refund.

## 4. Schema and migrations

| Object | Role |
|---|---|
| `demo.inventory_items` / `batches` / `locations` | Catalogue and on-hand |
| `demo.inventory_transactions` | Ledger |
| `demo.inventory_reservations` | Holds |
| `demo.inventory_stock_take_sessions` / `_lines` | Count lifecycle |
| `demo.charges` / `payment_transactions` | Cashier |

Counts at inspection: items 2, batches 13, ledger 66, charges 0, patients 26. **Not a throwaway database.** No new migrations applied this pass.

## 5. Endpoint / service / table map (stock-changing)

| Route | Service | Writes |
|---|---|---|
| `POST /inventory/receive` | `receiveStock` | RECEIPT + on-hand |
| `POST /inventory/items/import` confirm receipt | `importCatalog` | RECEIPT import |
| `POST /inventory/items/import` confirm stock_take | `importCatalog` | **Rejected** — `STOCK_TAKE_INVALID` |
| `POST /inventory/stock-take-sessions` | `createStockTakeSession` | Session + baseline lines only |
| `POST .../lines/:id` and `.../import-counts` | count / import | Line counts only |
| `POST .../approve` | `approveAndPostStockTakeSession` | `STOCK_TAKE` ledger, once |
| `POST /inventory/sales/prepare` | prepare Rx/OTC | Reservations + charge |
| `POST /inventory/dispense/*` | issue | Consume hold + DISPENSE |
| `POST /inventory/sales/cancel` | cancel | Release hold |
| Transfers ship/receive | transfer methods | TRANSFER_OUT/IN |

## 6. Stock-take and physical sheet

Session: location, `baseline_at`, lot lines, `expected_qty`. Counting does not change on-hand. Variance = counted − book. Reason required if variance ≠ 0. Submit all lines. Reject keeps baseline. Approver ≠ submitter. Stale on-hand aborts post. Session id is the ledger reference.

Sheet: `GET /inventory/stock-take-sessions/:id/sheet`  
Columns: `session_id, line_id, sku, name, batch_no, expiry, book_qty, physical_count, variance_reason`  
`physical_count` is empty. `book_qty` is not aliased as counted.

Import: `POST .../import-counts` writes counts into the session only.

## 7. Variance and approval

Unit tests: reason required on difference; count blocked after submit/post; independent approver; CSV confirm cannot post.

## 8. Legacy CSV bypass — finding and fix

**Finding:** `importCatalog` posted `STOCK_TAKE` when `confirmStockTake` was true, with only `inventory:manage` and a client `sessionId`. That bypassed independent approval.

**Fix:** stock_take + confirm now throws before any transaction. Regression test asserts the manager transaction is not opened. UI Confirm-and-post removed.

Receipt imports are unchanged (goods receipt, not stock-take).

## 9. POS, payment, dispensing

POS search on live app returned Paracetamol PARA500, 4694 available, **no price**. Prepare/issue buttons stay disabled on an empty cart. Cashier ledger tile: collected 0 / charged 0. No mutating sale was posted.

Walk-in fields are on the POS screen. Clinical patient search remains separate.

## 10. Permissions

Count/submit/import-counts: `inventory:manage`. Approve: `inventory:manage` or `settings:manage`, different user. Oversight: `inventory:read`. Dispense: `pharmacy:dispense`. Stock Oversight does not require `settings:manage`.

## 11. Files changed this pass (plus preserved dirty tree)

- `inventory.service.ts` / `inventory.controller.ts` / `inventory.dto.ts` — reject CSV stock-take post; sheet + import-counts  
- `inventory.service.spec.ts` / `stock-take-session.spec.ts`  
- `StockTakeWorkspace.tsx` / `StockTakeSessionPanel.tsx`

## 12. Migrations applied this pass

None.

## 13. Tests

```
npm --prefix backend test -- --runInBand --forceExit
```

**87 suites passed, 470 passed, 20 skipped, 0 failed.**

```
npm --prefix backend run build
npm --prefix frontend run build
```

Both succeeded. Images rebuilt. `inventory-pg` **NOT RUN** (no proven disposable `inventory_it`).

## 14. Browser scenarios

Tool: Cursor browser at `http://localhost:8080/` after image rebuild. No screen recording in this tool.

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Login (authorised staff) | PASSED | 01, then pharmacy home |
| 2 | Pharmacy navigation | PASSED | 02 |
| 3 | POS screen | PASSED | 03 |
| 4 | Catalogue / available qty | PASSED (a11y) / PARTIAL (screenshot below fold) | 04 + tree PARA500 4694 |
| 5 | Stock-take session UI | PASSED | 05 |
| 6 | Create session / sheet / count | NOT RUN | Would lock a live store |
| 7 | Variance / submit / reject / independent approve / post | NOT RUN | Same |
| 8 | CSV import through session | NOT RUN on DB | Unit: CSV post blocked |
| 9 | Prepare / pay / issue / unpaid block / walk-in sale | NOT RUN | Non-disposable DB |
| 10 | Stock Oversight overview | BLOCKED | Nav click intercepted |
| 11 | Recording | NOT RUN | Tool has no recorder |

## 15. Limitations

- Operational local DB — no synthetic mutating E2E.  
- POS items with no sell price.  
- Sheet-import header on the running image still mentioned “direct posting” until the copy fix (backend already rejects it).  
- No second inventory user in-browser for independent approval.  
- Recall/quarantine/disposal, insurance, POS tax/discount still fail-closed / not implemented.

## 16. Backup / recovery

Do not `docker compose down -v`. Existing `ops/backup-postgres.sh`. Stock-take session tables already exist; dropping them is not required for this fix.

## 17. Checklist

| Item | Status |
|---|---|
| Uncommitted work preserved | Yes |
| CSV stock-take bypass removed | Yes (unit verified) |
| Physical sheet columns | Implemented; download not exercised (no session) |
| Independent approval in backend | Yes (unit) |
| Browser login | PASSED |
| Mutating stock-take / sale E2E | BLOCKED |
| Isolated integration DB | BLOCKED |
| Controlled release | **No** |

Evidence: `docs/pharmacy-e2e-evidence-2026-10-22/`  
This file: `docs/pharmacy-backend-and-e2e-audit-2026-10-22.md`
