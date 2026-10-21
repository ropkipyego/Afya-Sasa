# AfyaSasa Phase 4 — insurance and prescription workflow completion

**Date:** 20 October 2026 (Africa/Nairobi)  
**Baselines:** Phase 1 review, Phase 2 hardening, Phase 3 blood-bank/revenue  
**Repository:** `/home/yobra/Desktop/Afya-Sasa-1/Afya-Sasa`  
**Nature:** Local application/UI/tests on the existing dirty tree. **No commit, no migration apply, no production.**

```
PRODUCTION CONNECTED: NO
PRODUCTION SQL / MIGRATIONS / DEPLOY: NO
COMMITS / PUSH / RESET / CLEAN / STASH: NONE
SCHEMA / SEED / SYNCHRONIZE: unchanged (TYPEORM_MIGRATIONS_RUN=false, AFYASASA_ALLOW_DEMO_SEED=false, synchronize=false)
TENANT SELECTOR: still hidden
TENANT CODE: jalaram (not rewritten)
SCHEMA NAME: demo (not renamed)
PARALLEL SoT TABLES: none created
BLOOD-BANK UNITS MIGRATION 1771000000003: not applied
LOGGED-IN / BROWSER UAT: NO
HTTP AGAINST LOCAL COMPOSE THIS PASS: not exercised
```

Phase 0–3 reports and prior uncommitted clinical/pharmacy/lab/imaging work were kept. This batch did not rebuild those modules.

---

## 1. Current-state mapping (after this batch)

| Area | State | Notes |
| --- | --- | --- |
| Insurance workspace UI + `GET /insurance/workspace` | **Implemented** | `payments:read`. Nav matches API. |
| Payer catalogue (SHA default + JSON store) | **Partial** | Stored in `TenantSettings.clinicalCatalog.insuranceWorkspace`. Save needs `settings:manage` or `payments:manage`. |
| Claim draft from existing `charges` | **Implemented** | Duplicate `chargeIds` blocked. Cancelled charges rejected. Reuses `demo.charges`. |
| Claim status machine | **Implemented** | Defined transitions; actor, timestamp, reason on material moves. |
| Operational transitions (portal number, eligibility flags) | **Implemented** | Officer with `payments:read` (no cashier initiate). |
| Remittance `partially_paid` / `settled` | **Partial** | Status only. **Does not** create `payment_transactions`. Needs `payments:manage`. |
| SHA eligibility card + stored checks | **Partial** | Live vs stub vs disconnected labelled. Live SHA HIE still credential-dependent. |
| SHA/DHA electronic claim post | **Missing / blocked by policy** | Portal remains `portal.sha.go.ke`. No invented payer API. |
| Private insurer EDI / remittance files | **Missing** | Needs insurer spec + management approval. |
| Authorisation (preauth) as a distinct clinical object | **Partial** | Status values only; no separate preauth table. |
| Encounter service → claim line | **Partial** | Via existing charges, not a second claim-line ledger. |
| Prescription multi-line composer | **Implemented** | Add/remove/edit; exact catalogue `itemId`; stock hint does not block prescribe. |
| Quantity suggestion | **Implemented** | Countable oral tablet/capsule OD/BD/TDS/QDS only. Liquids, IV, topical, inhalers, PRN: manual. |
| Line validation (dose, route, frequency, quantity) | **Implemented** | Frontend + service + DTO. |
| Pharmacy exact-ID dispense + FEFO + dispense+charge tx | **Implemented** | Existing tx preserved. Expired lots skipped. FEFO sort among usable lots. |
| Double-dispense / negative stock / duplicate charge | **Implemented** | Order lock + remaining qty; `nextOnHand`; `dispenseOpId` idempotency. |
| Partial dispense / unavailable (reject line) / cancel | **Partial** | Partial and reject-line exist. Cancel is existing order `cancelled`. No silent substitute. |
| Clinical substitution / variable-regimen calculator | **Missing / blocked** | Not invented. |
| Blood-bank unit fridge ledger | **Unverified / blocked** | Code exists; `1771000000003` unapplied. Out of this batch. |

---

## 2. Workflow map onto existing models

| Operational step | Existing model / screen |
| --- | --- |
| Patient / payer details | `demo.patients` + SHA IDs on file; payers in settings JSON; Insurance workspace |
| Eligibility | `demo.sha_eligibility_checks` (`source`: live / stub / disconnected); `ShaEligibilityCard` |
| Authorisation | Claim statuses `preauth_*` only |
| Encounter services | Existing OPD/IPD charges (`demo.charges`) |
| Claim preparation | `POST /insurance/claims` → JSON claim with `chargeIds` |
| Review / submission | `PATCH /insurance/claims/:id` → `prepared` → `submitted_manual` (portal number required) |
| Payer response | Manual `acknowledged` / `queried` / `rejected` / `approved` / `partially_approved` |
| Remittance | `partially_paid` / `settled` — **status on the claim JSON**, not a new payment |
| Reconciliation | Split helper (`splitResponsibility`); cash equivalent **only** remittance statuses |
| Prescribe | `POST /clinical-orders/pharmacy/prescription` → header + line `clinical_orders` |
| Dispense | `dispensePrescription` transaction + `upsertPharmacyCharge` |

Claims remain JSON in tenant settings (existing SoT). **No claims table was added.**

---

## 3. Files changed this batch (and why)

| File | Why |
| --- | --- |
| `backend/src/integration/insurance/insurance.controller.ts` | Narrow officer access: prepare/transition OR `payments:read` \| `initiate` \| `manage`. Remittance still gated in service. |
| `backend/src/integration/insurance/insurance.service.ts` | Skip cancelled charges; history.reason; remittance Forbidden without manage; eligibility kind; **no PaymentsService** |
| `backend/src/integration/insurance/insurance-lifecycle.ts` | Allowed transitions, remittance vs cash, reason rule, eligibility kind |
| `backend/src/integration/insurance/insurance.permissions.spec.ts` | Allow/deny matrix for officer vs cashier vs registrar |
| `backend/src/integration/insurance/insurance-lifecycle.spec.ts` | Transition + eligibility labelling |
| `backend/src/integration/insurance/insurance.service.spec.ts` | Duplicate lines, cancelled charges, remittance retry, no payment post |
| `backend/src/core/admin/role-templates.ts` | Description only. Template keys unchanged (`payments:read`, not initiate/manage) |
| `backend/src/core/admin/role-templates.spec.ts` | Officer keys must not include cashier initiate |
| `frontend/src/components/insurance/InsuranceWorkspace.tsx` | `canPrepare` vs `canRemit`; status + reason; cancelled charges disabled; eligibility labels |
| `backend/src/clinical-order/prescription-quantity.ts` | Shared `lineValidationError`; topical/inhaler still not auto-qty |
| `frontend/src/lib/prescription-quantity.ts` | Same validation (route required) |
| `backend/src/clinical-order/prescription-quantity.spec.ts` | Manual qty for topical/inhaler; line rules |
| `backend/src/clinical-order/clinical-order-mirror.service.ts` | Validate new lines after catalogue + replay |
| `backend/src/clinical-order/clinical-order-mirror.spec.ts` | Multi-line OK; missing dose/qty rejected |
| `backend/src/clinical-order/clinical-order.controller.ts` | Multi-line DTO requires dose, route, frequency |
| `frontend/src/components/orders/PrescriptionForm.tsx` | Route required; add/remove already present |
| `backend/src/inventory/inventory.service.ts` | Allocate usable lots **FEFO** (expiry then id); still skip expired |
| `backend/src/inventory/inventory.service.spec.ts` | Expired-only stock; FEFO pick |
| `backend/src/inventory/stock-posting.memory.ts` | Order mutex so concurrent dispenses cannot both pass remaining-qty |
| `backend/src/inventory/stock-posting.spec.ts` | Concurrent double-dispense serializes to one success |
| `docs/audits/afyasasa-phase-4-insurance-prescriptions-2026-10-20.md` | This report |

No new entities, no new migrations, no blood-bank apply.

---

## 4. Role / permission matrix

PermissionsGuard remains **OR-of-keys**.

| Action | Nav | API keys | insurance_officer template | Cashier | Finance (`payments:manage`) |
| --- | --- | --- | --- | --- | --- |
| Open Insurance & Claims | `payments:read` | `GET workspace` `payments:read` | Yes | Yes | Yes |
| Draft claim from charges | same screen | `POST claims` read \| initiate \| manage | **Yes** (narrowest change) | Yes | Yes |
| Record portal number / operational status | UI if allowed transition | `PATCH claims/:id` same OR list | Yes | Yes | Yes |
| Record remittance settled / partially_paid | UI disabled without manage | Service **Forbidden** unless `payments:manage` | **No** | **No** | Yes |
| Save payers | note only | `POST payers` settings:manage \| payments:manage | No | No | Yes |
| Collect cash / STK | Cashier | existing `payments:initiate` | **No** (not granted) | Yes | Yes |
| Prescribe | clinical screens | `pharmacy:prescribe` \| `consultations:create` | No | No | No |
| Dispense | Pharmacy | existing pharmacy:dispense | No | No | No |

**Permission decision:** officers already had `payments:read`. Phase 3 left POST on initiate\|manage, so officers could see the screen but not draft. Phase 4 added `payments:read` to POST/PATCH **instead of** granting `payments:initiate` (which would allow cashier collection). Remittance is a second check for `payments:manage` only.

Registrar `patients:read` remains denied on insurance APIs (Phase 2).

---

## 5. State transitions

### Claims

```
draft → eligibility_pending | prepared | cancelled
eligibility_pending → eligibility_verified | eligibility_failed | cancelled
eligibility_verified → preauth_required | prepared | cancelled
eligibility_failed → eligibility_pending | cancelled
preauth_required → preauth_pending | cancelled
preauth_pending → preauth_approved | preauth_rejected | cancelled
preauth_approved → prepared | cancelled
preauth_rejected → preauth_required | cancelled
prepared → submitted_manual | cancelled
submitted_manual → acknowledged | queried | rejected | cancelled
acknowledged → queried | rejected | approved | partially_approved | cancelled
queried → prepared | rejected | cancelled
rejected → prepared | cancelled
approved → partially_paid | settled | cancelled
partially_approved → partially_paid | queried | cancelled
partially_paid → settled | queried
settled → (terminal)
cancelled → (terminal)
```

Material transitions require a **reason** (and actor + timestamp): `submitted_manual`, `queried`, `rejected`, `cancelled`, `preauth_rejected`, `eligibility_failed`, `partially_paid`, `settled`. `submitted_manual` also requires a portal/SHA claim number.

Eligibility labelling:

- `source=live` → verified insurer response  
- `source=stub` → practice mode, not live  
- `source=disconnected` (and anything else) → recorded without insurer response  

### Prescription / pharmacy

```
header requested → partially_dispensed → dispensed
line requested → partially_dispensed → dispensed
cancelled lines are not dispensed
```

Prescribe does **not** require stock. Dispense requires exact prescribed `itemId`, confirm=true, remaining qty, non-expired usable lots, and charge in the same transaction when an amount is suggested. Retry billing does not deduct stock twice (`dispenseOpId`). Concurrent dispenses lock the order in the memory protocol (production path already uses pessimistic write on the line).

---

## 6. Tests and builds (this pass)

Installed backend `./node_modules/.bin/jest`, `npx nest build`, frontend `npx tsc -b && npx vite build`. Not claimed as browser UAT.

| Check | Result |
| --- | --- |
| `git diff --check` | pass (exit 0) |
| Focused Jest (insurance, prescription-quantity, clinical-order-mirror, inventory.service.spec, stock-posting.spec, role-templates.spec, pharmacy-prescription.spec, payments.service.spec) | **10 suites passed, 83 tests passed** |
| Full backend Jest `--forceExit` | **83 suites passed; 436 passed; 20 skipped; 456 total**; ~7.4 s |
| Backend `nest build` | pass |
| Frontend TypeScript `tsc -b` | pass |
| Frontend `vite build` | pass (~1.06 s) |
| Frontend unit runner | none |
| Browser / staff UAT | **not-run** |
| Production | **not-run** |

Phase 3 was 82 suites / 419 passed / 20 skipped. This pass added `insurance.service.spec` and extra lifecycle, role, quantity, catalogue, FEFO, and concurrent-dispense cases. Open-handle force-exit is unchanged (pre-existing).

HEAD remains `4a31826e7a5ce3c853b8f63f8c517fd5ec04428e`. Dirty tree preserved (87 short-status lines after this report).

---

## 7. Implemented vs tested vs locally exercised vs production-verified

| Item | Implemented | Automated-tested | Locally exercised (logged-in UI) | Production |
| --- | --- | --- | --- | --- |
| Officer can POST drafts with `payments:read` | Yes | Yes (guard + service) | No | No |
| Officer cannot collect cash (`payments:initiate` not granted) | Yes | Yes (template + prepare keys) | No | No |
| Duplicate claim charge ids | Yes | Yes | No | No |
| Cancelled charges excluded | Yes | Yes | No | No |
| Remittance without payment_transactions | Yes | Yes (no PaymentsService; retry from settled rejected) | No | No |
| Eligibility live vs manual labels | Yes | Kind helper tests | No | No |
| Exact catalogue IDs + multi-line Rx | Yes | Yes | No | No |
| Quantity / route / dose validation | Yes | Yes | No | No |
| Stock hint without blocking prescribe | Yes (UI) | Quantity tests; compose still sends without stock | No | No |
| Expired / insufficient / FEFO | Yes | Yes | No | No |
| Concurrent / double dispense + charge idempotency | Yes | Memory world + payments upsert | No | No |
| Dispense+charge rollback | Prior | Prior stock-posting tests still pass | No | No |
| Live SHA/DHA claim integration | **No** | N/A | No | No |

---

## 8. Unresolved decisions (stop for review)

### Payer / management

1. Whether claims should stay in settings JSON long-term, or a dedicated table (would be a **schema change** — not done).
2. DHA/SHA **claims pack** credentials, connectivity, authentication, and end-to-end tests before any “live claims” label.
3. Private insurer / TPA file formats and remittance advice posting into `payment_transactions` (must not silently duplicate cashier receipts).
4. Who may mark `settled` in production (finance only, as coded).
5. Whether officers should see patient charge amounts (they already have `payments:read`).

### Clinical

1. Variable / PRN / tapering quantity calculators — not invented.
2. Product substitution when stock is zero — **forbidden** unless a future approved policy exists.
3. Duration still optional (clinical). Dose, route, frequency, quantity required.

### Schema (not in this batch)

1. `1771000000003` blood-bank units — still unapplied (Phase 3).
2. `client_request_id` unique column migration — code already degrades if column missing.
3. Payment unique receipt index — still JSON/window only (Phase 2/3).
4. Claim persistence table — **would require a migration**; stopped.

---

## 9. Release-readiness checklist and remaining blockers

**Can ship to local/non-prod review as operational drafts + pharmacy hardening, not as live SHA claims.**

- [x] No production access, commits, or migrations this batch  
- [x] Tenant selector hidden; tenant `jalaram`; schema `demo`  
- [x] No duplicate SoT tables  
- [x] Officer drafts without cashier privileges  
- [x] Remittance does not post payments  
- [x] Catalogue ID matching preserved  
- [x] Jest + backend build + frontend tsc/build + `git diff --check`  
- [ ] Logged-in local UAT of Insurance workspace and PrescriptionForm  
- [ ] SHA HIE credentials + live eligibility E2E  
- [ ] SHA/DHA claim submission E2E (blocker for any “integrated claims” release)  
- [ ] Management sign-off on remittance vs cashier posting  
- [ ] Blood-bank units migration still a separate gated change  
- [ ] Payment unique-index duplicate scan (prior)  

**Blockers for production claims:** no verified SHA/DHA claim API; claims JSON is operational not a payer ledger; remittance is a status flag; browser UAT not run.

**Blockers for production pharmacy:** catalogue and dispense rules are implemented and unit-tested; **staff UAT on real Jalaram catalogue lots is still required** before calling the composer “hospital-verified.”

---

## Explicit confirmation

No production systems, hospital databases, migrations, deployments, commits, pushes, resets, stashes, seeds, or schema synchronisation were performed. Blood-bank unit migration was not applied. SHA/DHA claim posting is **not** marked working.
