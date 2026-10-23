# Pharmacy cashier-controlled release

Local development first. Do not apply the reservations migration on the hospital database until an isolated local copy has been verified.

## Lifecycle

1. Clinician creates a prescription (`POST /clinical-orders/pharmacy/prescription`). Stock is not touched.
2. Pharmacy **prepares** the sale (`POST /inventory/sales/prepare` or `/inventory/sales/otc/prepare`).
   - FEFO lots are **reserved** in `demo.inventory_reservations` (`held`).
   - `qty_on_hand` does not change.
   - No `DISPENSE` ledger row is written.
   - `PaymentsService.upsertPharmacyCharge` opens/updates the pharmacy bill with a **prepare** operation id.
3. Cashier collects using the existing `POST /payments/manual` workflow against that charge.
4. Pharmacy **issues** (`POST /inventory/dispense/prescription` or `/inventory/dispense/otc`) only after `evaluatePharmacyClearance` succeeds inside the issue transaction.
5. Issue consumes the reservation, reduces `qty_on_hand`, and posts `DISPENSE`.
6. **Cancel** (`POST /inventory/sales/cancel`) releases `held` rows. It will not fabricate a dispense, refund or reversal. If money was collected, cashier must refund first.

There is no automatic reservation expiry.

## Clearance (fail closed)

Release is allowed only when:

- Operational charges are enabled, and
- A matching pharmacy charge exists, and
- Either verified collected money (`cash` / `mpesa` / `card` / `quickbooks`) plus **documented** `metadata.adjustments` waivers cover the amount owed, or
- A documented `metadata.creditApproval` `{ by, at, reason, amount }` covers the remaining balance (`POST /payments/charges/:id/credit`, `payments:manage`, not the same user who prepared the bill).

Not sufficient: receipt number, HTTP 200, charge existence, cashier `method=insurance`, insurance claim remittance, undocumented `waived` payments, frontend labels.

Insurance status that should authorise release at Jalaram is **unconfirmed** — insurance remains blocked.

## Isolated test database

`INVENTORY_TEST_DATABASE_URL` must be a local URL whose database **and** user are both `inventory_it`. The harness refuses `afyasasa`, `demo`, `jalaram`, and remote hosts. See `backend/src/common/isolated-database.ts`.

Keep `TYPEORM_MIGRATIONS_RUN=false` in hospital compose. Apply `1772000000000-InventoryReservations.ts` only on a disposable local schema.

## API errors

JSON envelope:

```json
{
  "success": false,
  "error": {
    "code": "FINANCIAL_CLEARANCE_DENIED",
    "message": "This sale cannot be issued because its bill is still outstanding.",
    "retryable": false,
    "nextAction": "Collect payment or a documented credit/exemption at the cashier desk, then issue."
  },
  "requestId": "…"
}
```

Clients should show `error.message` (and `nextAction` when present), not “cannot access server”, for 400/403/409. Timeouts and network failures are the only cases that mention connectivity. `X-Request-Id` is echoed.

## Local app start

See `docs/local-testing-guide.md`. Typical: `cp .env.example .env` then `npm run dev`. App: http://localhost:8080
