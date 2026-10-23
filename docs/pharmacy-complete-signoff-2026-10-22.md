# AfyaSasa Pharmacy — implementation, verification and sign-off

**Date:** 22 October 2026  
**Tenant:** `jalaram`  
**Schema:** `demo`  
**API:** `/api/v1`  
**HEAD:** `247d026` (`Blood bank and stock`) on `main`  
**Release boundary:** local only. Nothing was committed, pushed, merged or deployed.

## 1. Executive summary and sign-off status

The Pharmacy module now runs as one workflow on the existing inventory ledger, charges and payments. Prescriptions and walk-in POS prepare stock as **holds** (reservations), cashier clearance uses existing `charges` / `payment_transactions`, and issue posts `DISPENSE`. Stock Oversight is available to `inventory:read` without `settings:manage`. A real stock-take session (baseline → count → submit → reject/recount → independent approve → one-time ledger post) is in the local app.

**Sign-off: not ready for controlled hospital release.**

Ready for **staff-in-the-loop local verification** after an authorised user signs in with their live password. Not ready to treat as released until the 15 browser scenarios are executed with that login, a second `inventory:manage` user posts a variance, and isolated migration tests run on a disposable database (not this compose volume).

Demo login `it@jalaram.co.ke` / `ChangeMe123!` still returns **Authentication is required** (AUTH_REQUIRED). Passwords were not reset.

## 2. Original problems and scope

Pharmacy, inventory, cashier and Hospital Control Center existed as separate screens. Stock-take posted immediately from CSV. Walk-in billing required a patient. Stock Oversight was missing. Holds were not distinguished from on-hand. This work connected those pieces; it did not create a second pharmacy application.

## 3. Final module structure and navigation

| Screen | Permission | Purpose |
|---|---|---|
| Pharmacy | `pharmacy:read` | Queue, prescriptions, issue |
| Pharmacy Sales POS | `pharmacy:read` | Multi-line OTC / walk-in cart |
| Inventory & Store | `inventory:read` | Receive, transfers, stock-take session + legacy sheet |
| Stock Oversight | `inventory:read` | HCC Overview / Stores / Control / Reports |
| Payments | `payments:collect` (existing) | Pharmacy sale lookup and queue |

HCC configuration remains `settings:manage`. Stock Oversight does not grant it.

## 4. Prescription-to-dispensing workflow

1. Clinician writes a pharmacy clinical order. Stock is unchanged.  
2. Pharmacy prepares (`POST /inventory/sales/prepare`). FEFO lots go to `demo.inventory_reservations` (`held`). `qty_on_hand` does not change.  
3. `PaymentsService.upsertPharmacyCharge` opens/updates the bill.  
4. Cashier collects via `POST /payments/manual` (or STK).  
5. Issue (`POST /inventory/dispense/prescription`) runs `evaluatePharmacyClearance` inside the transaction. Unpaid / partial / insurance-without-policy fail closed.  
6. Issue consumes holds, reduces on-hand, posts `DISPENSE`.  
7. Cancel releases `held` rows. It does not refund collected money.

**Status:** Implemented but not fully verified (unit/clearance tests pass; browser issue path not executed).

## 5. POS-to-cashier workflow, including walk-ins

`PharmacyPosPanel` searches catalogue / SKU / barcode, shows selling price and available quantity (on-hand minus held), and prepares a multi-line cart with optional patient or walk-in name/phone.

Walk-in charges use additive nullable `patient_id` on `demo.charges` and `demo.payment_transactions`. Clinical billing still expects a patient at the application layer. No dummy patient is created.

Cashier: `GET /payments/pharmacy-queue`, `GET /payments/pharmacy-sale/:saleId`. Payment attempt key is stable in the checkout panel. Receipt uses existing print helper.

POS discounts, VAT and refunds were not invented.

**Status:** Implemented but not fully verified.

## 6. Stock reservation, batch, FEFO and ledger

- Available = on-hand − held reservations.  
- Expired lots remain ineligible for receive/dispense (`isExpiredBatch`).  
- Recalled / quarantined pharmacy lots: **Blocked** — no authorised movement types beyond blood-bank structures.  
- Ledger of record remains `demo.inventory_transactions`. Reservations are not a second ledger.

**Status:** Implemented and verified at unit level (`stock-available`, `stock-posting`, `pharmacy-clearance`). Isolated `inventory-pg` not run (`inventory_it` not created).

## 7. Stock-take and approval workflow

Deficient path: CSV `POST /inventory/items/import` with `confirmStockTake` still posts immediately for `inventory:manage` (legacy, labelled as such).

Required path (new):

1. `POST /inventory/stock-take-sessions` snapshots on-hand lots at a location (`baseline_at`).  
2. Counts are saved per line. Variance requires a reason (≥3 characters). Counting does not change stock.  
3. Submit requires every line counted.  
4. Reject returns the session to recount; baseline and history remain.  
5. Approve/post requires a **different** `inventory:manage` (or `settings:manage`) user. Same submitter is rejected (`STOCK_TAKE_INDEPENDENT_APPROVAL`).  
6. Post uses existing `adjustOnHand` / `STOCK_TAKE` ledger, session id as idempotency key, and aborts if on-hand drifted from baseline.  
7. Posted sessions return the existing result on retry.

Tables: `demo.inventory_stock_take_sessions`, `demo.inventory_stock_take_lines` (additive; applied on local compose Postgres `afyasasa` / schema `demo` on 22 Oct 2026). `TYPEORM_MIGRATIONS_RUN` remains `false`.

**Status:** Implemented but not fully verified (rules tests pass; browser count/approve not executed).

## 8. Control Center configuration and reports

Overview tiles: on-hand, reserved/held, available, pending stock takes, low stock, near-expiry (90 days), expired lots.  
Stores & Transfers: existing transfer/requisition APIs; no duplicated GRN.  
Stock Control: pharmacy batches, expiry, history; recall/quarantine/disposal remain blocked.  
Reports: `inventory_transactions` + integrity. Collections are not labelled profit.

Min/max/reorder remain on inventory items. No invented notification recipient list, VAT, or named variance-approver role.

**Status:** Implemented but not fully verified.

## 9. Roles and permissions matrix

| Action | Permission | Extra rule |
|---|---|---|
| View stock / oversight | `inventory:read` | |
| Pharmacy POS / queue | `pharmacy:read` | Issue needs `pharmacy:dispense` |
| Receive, transfer, start/count/submit/reject stock-take | `inventory:manage` | |
| Approve and post stock-take | `inventory:manage` **or** `settings:manage` | Actor ≠ `submitted_by` |
| Collect payment | existing payments collect | |
| Documented credit | `payments:manage` | Not the preparer (`pharmacy-clearance`) |
| Hospital settings | `settings:manage` | Not granted to store users for Oversight |

Enforced on controllers/services, not only by hiding buttons.

## 10. Database tables / migrations

| Migration | Change | Why |
|---|---|---|
| `1772000000000-InventoryReservations` | `demo.inventory_reservations` | Holds without touching on-hand |
| `1772100000000-PharmacyWalkInCharges` | `patient_id` nullable on charges and payment_transactions | Walk-in pharmacy bills |
| `1772200000000-InventoryStockTakeSessions` | session + line tables | Count/approve without posting on count |

Applied additively via `docker exec -i afya-sasa-postgres-1 psql` on **local** compose Postgres (`afya-sasa-postgres-1`, created 2026-09-21, database `afyasasa`, user `afyasasa`). Not production Contabo. Compose `.env` `TYPEORM_MIGRATIONS_RUN=false` was not flipped.

**Rollback (local only):** `DROP TABLE demo.inventory_stock_take_lines; DROP TABLE demo.inventory_stock_take_sessions;` Reservations/nullable patient_id rollback would restore NOT NULL only after no walk-in rows exist.

Isolated disposable `inventory_it` database: **not created** (credentials/host would be guessed). Migration tests against a throwaway DB: **Blocked**.

## 11. Reused components and removals

Reused: `inventory_items/batches/transactions`, payments charges, FEFO allocate, `adjustOnHand`, PaymentDesk, print receipt, HCC shell.

Removed: none. Incomplete CSV stock-take was **not** deleted; it is labelled legacy sheet import.

## 12. API routes and frontend screens changed

**New/changed APIs:**  
`GET /inventory/oversight-summary`  
`GET|POST /inventory/stock-take-sessions`  
`POST .../lines/:lineId`  
`POST .../submit|reject|approve`  
Existing: `sales/prepare`, `sales/otc/prepare`, `sales/cancel`, `payments/pharmacy-queue`, `payments/pharmacy-sale/:saleId`.

**Frontend:** `PharmacyPosPanel`, `StockTakeSessionPanel`, `StockOversightPanels`, PaymentDesk pharmacy lookup, ErrorBoundary.

## 13. Tests run (actual commands)

```
npm --prefix backend test -- --runInBand --forceExit
```

**Result:** 87 suites passed, 469 passed, 20 skipped, 0 failed. Time ~8.6s. Open-handles warning only.

```
npm --prefix backend run build
npm --prefix frontend run build
```

**Result:** both succeeded (`tsc -b && vite build`). Frontend bundle in image: `index-CddTJreG.js` contains `Stock-take session` (count 1). Backend dist contains `stock-take-sessions`.

```
npm --prefix backend test -- --testPathPatterns=inventory-pg.integration
```

**Not run** — `INVENTORY_TEST_DATABASE_URL` / `inventory_it` not established.

## 14. Browser scenarios actually executed

Environment: Cursor browser tab `http://localhost:8080/` after `docker compose up -d --build frontend backend`. Home HTTP 200. Health HTTP 200.

| # | Scenario | Result |
|---|---|---|
| 1 | Login and navigation per role | **Blocked.** Login form shown. `it@jalaram.co.ke` / `ChangeMe123!` → “Authentication is required.” Live staff password was not reset. |
| 2–15 | Catalogue, prepare, pay, issue, unpaid block, walk-in, receipt, retries, cancel, stock-take variants, expiry block, unauthorised approve, reports, empty/error | **Not executed.** Would claim false completion if inferred from unit tests. |

Unauthenticated API checks from the sandbox could not bind to `127.0.0.1:8080`; the same host returned 200 from the browser and from an unsandboxed curl to `/` and `/api/v1/health`.

## 15. Known limitations and unfinished work

- Browser E2E with live credentials.  
- Named variance-approver role (segregation is same-permission, different user).  
- Recall / quarantine / disposal / customer returns.  
- Insurance, waiver, POS discount, POS tax.  
- Automatic reservation expiry.  
- Isolated migration/pg integration harness.  
- CSV confirm-and-post still bypasses independent approval if `inventory:manage` uses it.  
- `.env` `POSTGRES_HOST=localhost` `POSTGRES_PORT=5432` is not the compose mapped `5433`; compose backend uses internal `postgres:5432`. Do not point host tools at the wrong instance.

## 16. Data integrity, migration and recovery

Reservations do not enter `inventory_transactions`. Integrity reports still reconcile on-hand to the ledger. Stock-take post is transactional and idempotent by session id. Counting cannot change stock. Concurrent dispense during an open count fails post on stale snapshot.

Backups: existing `ops/backup-postgres.sh`. Destructive `docker compose down -v` and `dev:fresh` were not used.

## 17. Files changed and decisions

Uncommitted working tree (do not commit until asked). New this completion pass: stock-take session entities/migration/service/UI, oversight summary, session tests, this report.

Decisions: one ledger; walk-in without dummy patient; independent approval without a new permission key; fail-closed insurance; Stock Oversight on `inventory:read`.

## 18. Release-readiness checklist and next steps

| Check | Status |
|---|---|
| Local compose identity preserved | Yes |
| `TYPEORM_MIGRATIONS_RUN=false` | Yes |
| No production touch / no commit | Yes |
| Automated unit suite green | Yes (469 pass / 20 skip) |
| Frontend production build | Yes |
| Images rebuilt | Yes |
| 15 browser scenarios | No |
| Isolated migration test | No |
| Policy (insurance, recall, tax) | Fail closed / blocked |

**Recommended next steps (user):** sign in with the live account already used in this hospital (`userId` `20000000-0000-4000-8000-000000000001` was active on nginx logs). Walk Pharmacy POS, cashier queue, issue, and Stock take with a second inventory user for approve. Only then consider a commit.

### Requirement labels

| Area | Label |
|---|---|
| Protect existing app / identity | Implemented and verified |
| Rx prepare → reserve → pay → issue | Implemented but not fully verified |
| POS multi-line + walk-in | Implemented but not fully verified |
| Cashier clearance fail-closed | Implemented but not fully verified (unit) |
| Control Center four areas | Implemented but not fully verified |
| Stock-take session lifecycle | Implemented but not fully verified |
| Quarantine / recall / disposal | Blocked |
| POS discount / tax / refunds | Not implemented (policy) |
| Isolated DB migration tests | Blocked |
| 15 browser E2E scenarios | Blocked (login) |
| Management PDF | Implemented if generated beside this file |

**Controlled release: no.** Local verification build: **yes**, pending live login.
