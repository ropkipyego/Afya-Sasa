# Finance, inventory, and procurement

## Vocabulary (as implemented)

| Term | Table / object | Meaning |
| --- | --- | --- |
| Charge | `demo.charges` | Amount owed for a service. **Not cash.** |
| Payment | `demo.payment_transactions` | Collection or refund row |
| Receipt | Reprint of a completed payment | Not a second ledger |
| Invoice | **No separate invoice entity found** | Do not assume e-invoicing |
| General ledger | QuickBooks | EMR is operational cashier, not the GL |

## Charge ownership (source)

| Stream | How a charge appears |
| --- | --- |
| OPD consultation | **Not** auto-created at check-in. Clinic fee is displayed. Cashier / catalogue may add consultation |
| Pharmacy | `upsertPharmacyCharge` in the **same DB transaction** as dispense when price > 0 |
| OTC | Same, only if `patientId` and sell price; walk-in unbilled by design |
| Lab / radiology | Via payments/hospital-charges when those services are billed — **not traced as auto-post on every request this audit** |
| IPD accommodation | Job `POST /payments/charges/accommodation/process` using catalogue rates; empty rate → no charge |

## Payments

`PaymentsController`: STK, callback, manual pay, transactions, outstanding, charges, statement, cashier summary, refund, catalogue import, exceptions, IPD census, adjust, cashier close, manual charge, QB queue/sync, QBWC.

Idempotency: M-Pesa callback specs exist; pharmacy `dispenseOpId`. **Live STK not verified.** Avoid test STK to real numbers.

## Director finance metrics

From `ReportingService.financeAnalytics` and `docs/AFYASASA_DASHBOARD_METRIC_DEFINITIONS.md`:

| Metric | Source | Caveat |
| --- | --- | --- |
| Billed | SUM charges.amountOwed in range | Period; not collections |
| Collected | completed payments excluding refunds | Not revenue |
| Refunds | metadata.kind = refund | Separate |
| Outstanding | point-in-time owed−paid−waived | Not range minus collected |
| Pharmacy activity | **unavailable** | Do not derive from movements |
| Accounting | pending | QuickBooks |

**Not certified** until Finance/IT complete a period worksheet (see Director pack §9).

## Inventory truth

**One** catalogue and ledger: `inventory_items`, `inventory_batches`, `inventory_locations`, `inventory_transactions`. Pharmacy `PHARMACY` location is a location on that ledger. Store requisitions/transfers/receipts write the same tables.

Stock-take posts **variance** (`STOCK_TAKE`), not counted quantity as a receipt (`inventory.service.ts` `adjustOnHand`).

Integrity: `GET /inventory/integrity` (awaiting charge vs legacy review). **Not opened logged-in this audit.**

## Planned SQL (unapplied)

| File | Role |
| --- | --- |
| `20261014_inventory_concurrency.sql` | `inventory_import_sessions` unique session_key |
| `20261014_inventory_batch_unique_index.sql` | commented unique lots — expiry not in key |
| `20261014_inventory_batch_duplicate_audit.read-only.sql` | **must not** be invented from test fixture; needs authorised snapshot |
| `20261014_stock_take_sessions.sql` | commented |

Without session table: advisory lock + 0-qty claim. Unique session row is the durable concurrent constraint.

## QuickBooks

Queue + Web Connector. Specs reject missing credentials. Status `accountingIntegration: pending` on analytics. EMR collections **must not** be labelled as QB deposits.

## Procurement UI

`InventoryModule.tsx`: overview, stock, prices, stock take, requisitions, buying list (`ProcurementPanel`), transfers, receive, ledger, integrity. Suppliers as first-class APIs were **not** inventoried as a separate controller this audit (buying list is in-module).
