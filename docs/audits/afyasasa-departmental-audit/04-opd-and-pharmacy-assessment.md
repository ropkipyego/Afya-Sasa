# OPD and pharmacy assessment

## User-reported operations (not auditor-verified)

| Report | How this audit treats it |
| --- | --- |
| OPD has been working efficiently | Operational observation. Maps to check-in, triage, doctor queue, SOAP. **Not** a substitute for logged-in UAT this session. |
| Prescriptions have generally been working well | Maps to `POST /clinical-orders/pharmacy/prescription` and doctor `PrescriptionForm.tsx`. |
| Drug dispensing has had a few issues | **Reported, not independently reproduced.** No real prescription was dispensed. See defect register. |

## OPD findings (source)

| Step | Expected | Source |
| --- | --- | --- |
| Arrival | One open OPD visit per patient per Nairobi day | `OpdService.createEncounter` |
| Visit type | Diagnostic types skip doctor destination | `opd.service.ts` destination mapping |
| Doctor visibility | Own queue + unassigned; supervisors see all | `doctorQueue` + `opd.service.spec.ts` |
| Consult fee | Shown at check-in; **not written as a charge** at encounter create | `OpdCheckInWorkspace.tsx`; no charge insert in `createEncounter` |
| Prescribe | Order `requested`; **no** `qtyOnHand` change | `clinical-order-mirror.service.ts` `createPharmacyPrescription` |

## Representative prescription lifecycle (no PHI)

| Transition | Record | Expected state | Actual (from code) | Duplicate protection | Permissions |
| --- | --- | --- | --- | --- | --- |
| Prescribe | `demo.clinical_orders` header `kind=prescription` + line rows | `requested`, qtyDispensed 0 | Lines saved; stock untouched | New UUID header per POST | `pharmacy:prescribe` or `consultations:create` |
| Queue | `GET /clinical-orders` | Pharmacist sees requested lines | `PharmacyWorkspace` groups by `prescriptionGroupId` | n/a | `pharmacy:read` |
| Match item | UI `matchCatalogItem` | Prefer `metadata.itemId`, else **normalised name equality** | Wrong SKU possible if names collide and itemId missing | n/a | — |
| Confirm | `POST /inventory/dispense/prescription` `{ confirm: true, lines[] }` | Confirm required | `confirm: false` throws; UI requires review checkbox | Full line: remaining 0 / status dispensed | `pharmacy:dispense` |
| Stock | `inventory_batches.qtyOnHand`, `inventory_transactions` DISPENSE | FEFO non-expired lots; txn | `lockLocationBatches` then allocate | Same txn as charge | same |
| Billing | `demo.charges` pharmacy `serviceEntityId` = group id | One delta per `dispenseOpId` | `upsertPharmacyCharge` | `dispenseOps` array; retry locks order | Charge via payments |
| Payment | `demo.payment_transactions` | Separate cashier step | UI tells staff to collect at cashier | payment integrity specs | `payments:initiate` |
| History | order status dispensed / partial | Filters in workspace | metadata quantities | — | pharmacy:read |

Audit: HTTP `AuditInterceptor` on mutations (`demo.audit_logs`). Entity before-images are not a full snapshot.

## Where dispensing can fail (code paths)

These are **failure modes**, not proven production incidents:

1. Confirm not set (API and UI).
2. Cancelled order.
3. Already fully dispensed.
4. No/expired stock (`allocateFromBatches`).
5. Charge insert failure rolls back stock (user sees error; stock should remain).
6. UI name match selects the wrong catalogue item if `itemId` absent.
7. Concurrent two browsers on the same line: order `FOR UPDATE` should serialise; loser should see already dispensed / remaining 0.
8. OTC without `saleId`: new UUID each call (not idempotent). Frontend currently sends `crypto.randomUUID()` per submit.
9. Unique lot / session table **unapplied** — concurrent stock-take/import races rely on advisory lock + 0-qty claim.

## Pharmacy defect register

| ID | Issue | Severity | Evidence | Cause | Impact | Next diagnostic |
| --- | --- | --- | --- | --- | --- | --- |
| PH-R1 | Staff-reported dispensing problems | P1 until characterised | User report only | Unknown | Delay or wrong issue | Authorised UAT: one synthetic Rx; capture API error body, order metadata, batch qty, ledger, charge. **Do not use a live patient if avoidable.** |
| PH-S1 | Name-based SKU matching | P1 suspected | `PharmacyWorkspace.tsx` `matchCatalogItem` | Heuristic | Wrong drug if names collide | Require `itemId` from prescription; fail closed if unmatched |
| PH-S2 | Charge uniqueness is application-level | P2 suspected | `payment.entities.ts` no unique on serviceEntityId | No DB unique | Duplicate charge if lock bypassed | Keep order lock; consider unique after data audit |
| PH-S3 | Session table / unique lots unapplied | P2 | planned SQL unapplied | Schema decision | Concurrent take/import edge | Director/IT decision; snapshot duplicate-lot audit |
| PH-S4 | Running images older than `507cc02` | P1 operational | docker created 11:39 EAT vs commit 17:25 | Deploy lag | Staff may not be on stock-integrity code | Rebuild **local** images only when instructed; never production from this audit |

**Confirmed independently reproduced defects this audit:** none (no live dispense).

## Tests relevant to this chapter

| Spec | What it covers | This audit executed? |
| --- | --- | --- |
| `opd.service.spec.ts` | queue visibility, appointments today, open visit | No (prior 14 Oct included) |
| `pharmacy-prescription.spec.ts` | grouping | No (prior) |
| `inventory.service.spec.ts` | confirm gate, session id | No (prior) |
| `stock-posting.spec.ts` | locks, OTC sale id ≠ patient id | No (prior) |
| `inventory-pg.integration.spec.ts` | concurrency miniature schema | No (prior 12 passed) |
| `payments.service.spec.ts` | dispenseOpId | No (prior) |

`ops/pharmacy-workflow-test.sh` is mentioned in an **August 2026** gap matrix; this audit did **not** run it.
