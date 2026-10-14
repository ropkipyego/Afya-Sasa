# Stock integrity workstream — 14 Oct 2026

LIVE STACK / PRODUCTION DB / MIGRATIONS / DEPLOY / COMMIT: **NO**

Aligned with [`2026-10-14-director-audit-pack.md`](./2026-10-14-director-audit-pack.md).

## Disposable PostgreSQL (this verification run)

Inventory: `afyasasa-inventory-it`, `inventory_it`/`inventory_it`, `127.0.0.1:55434`.
Laboratory: `afyasasa-lab-it`, `lab_it`/`lab_it`, `127.0.0.1:55435`.
Not `sokoos` (5432) or `afyasasa` (5433).
Harnesses refuse any other database name.

Evidence log: `docs/release/2026-10-14-test-evidence.log`  
`started_at=2026-10-14T17:20:23+03:00` EAT.

| Command | Result |
| --- | --- |
| `npx jest --testPathPatterns=inventory-pg.integration --runInBand --forceExit` | **12 passed** (subset of full Jest) |
| `npx jest --testPathPatterns=lab-pg.integration --runInBand --forceExit` | **10 passed** (subset of full Jest) |
| `npx jest --runInBand --forceExit` with both URLs | **380 passed, 0 failed, 0 skipped**, 71 suites |

Do **not** add 12 + 10 + 380. The path-filtered runs are included in the 380.

Both disposable containers were removed after the run.

## OTC

Walk-in without a patient: stock only, not billed.
Identified patient + selling price: existing `demo.charges` in the same transaction.
Idempotency key is client `saleId`, never `patientId`. Repeat `saleId` does not deduct twice.
Missing `saleId`: server generates a new UUID (not idempotent).

## Schema prepared, not applied

- `20261014_inventory_concurrency.sql` — `inventory_import_sessions` only
- `20261014_inventory_batch_unique_index.sql` — unique lot index, **commented**
- `20261014_inventory_batch_duplicate_audit.read-only.sql` — **not executed** on hospital data
- `20261014_stock_take_sessions.sql` — commented first-class take tables

Zero-variance today: advisory lock + 0-qty ledger claim. Unique session table is stronger concurrent protection and is **unapplied**. Unique lot index must wait for a zero-row duplicate audit. Expiry is not part of the proposed key.
