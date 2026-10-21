# AfyaSasa Phase 2 — permission, readiness and payment integrity hardening

**Date:** 20 October 2026 (Africa/Nairobi)  
**Controlling baseline:** `docs/audits/afyasasa-phase-1-review-2026-10-20.md`  
**Repository:** `/home/yobra/Desktop/Afya-Sasa-1/Afya-Sasa`

```
PRODUCTION CONNECTED: NO
PRODUCTION SQL / MIGRATIONS / DEPLOY: NO
COMMITS / PUSH / RESET / CLEAN / STASH: NONE
SCHEMA / SEED / SYNCHRONIZE: unchanged
TENANT SELECTOR: still hidden in compose defaults
SCHEMA NAME: demo (not renamed)
TENANT CODE: jalaram (not rewritten)
PARALLEL SoT TABLES: none created
EXISTING CLINICAL/FINANCE ROWS: not modified
LOGGED-IN / BROWSER UAT: NO
HTTP AGAINST LOCAL COMPOSE THIS PASS: not running (connection refused on :8080)
```

Phase 0, Phase 1, and the 15 October departmental audit were **not** deleted. Prior uncommitted clinical/pharmacy/lab work was **not** reverted.

---

## 1. Baseline and working-tree preservation

| Item | Value |
| --- | --- |
| Branch | `main` tracking `origin/main` |
| HEAD | `4a31826e7a5ce3c853b8f63f8c517fd5ec04428e` |
| Pre-edit dirty count | 58 short-status lines (Phase 0 docs + Phase 1 report + prior product work) |
| Preservation | No git restore/checkout of dirty files. Edits were additive on listed files only. |

`PermissionsGuard` remains **OR-of-keys**. Untracked migrations `177100*` were **not** applied.

---

## 2. Files changed and why

### Application (this batch)

| File | Reason |
| --- | --- |
| `backend/src/integration/insurance/insurance.controller.ts` | Workspace GET no longer accepts `patients:read` |
| `frontend/src/lib/navigation.ts` | Insurance nav key aligned to `payments:read` (file already had unrelated uncommitted nav work; only the Insurance permission line was required for this batch) |
| `backend/src/health/health.controller.ts` | Keep `/health`; add `/ready` with `SELECT 1` + timeout on the existing TypeORM `DataSource` |
| `backend/src/core/audit/audit.interceptor.ts` | Skip audit on `/ready` so probes do not flood `audit_logs` |
| `backend/src/payments/payments.service.ts` | Manual cashier payment + charge update share one `manager.transaction` |

### Tests / report

| File | Reason |
| --- | --- |
| `backend/src/integration/insurance/insurance.permissions.spec.ts` | **New.** Route keys and allow/deny roles |
| `backend/src/common/module-visibility.spec.ts` | Insurance workspace is `payments:read` only |
| `backend/src/health/health.controller.spec.ts` | **New.** Ready/not-ready/timeout |
| `backend/src/core/audit/audit.interceptor.spec.ts` | `/ready` skipped |
| `backend/src/payments/payments.cashier-atomic.spec.ts` | **New.** Atomic success, rollback, idempotency, validation, retry |
| `frontend/src/lib/navigation.spec.ts` | Insurance permission assertion (not executed by backend Jest) |
| `docs/audits/afyasasa-phase-2-hardening-2026-10-20.md` | This report |

No unique indexes, no migrations, no new charge/payment tables.

---

## 3. Insurance permission matrix

Catalogue **does not** contain `insurance:read`. Adding one would need permissions rows + live role grants (wider configuration). **Not added.** Narrowest existing key for viewing claims workspace: `payments:read` (already on `insurance_officer` and `cashier` templates).

| Route | Action | Sensitivity | Before (OR) | After | Intended roles |
| --- | --- | --- | --- | --- | --- |
| `GET /insurance/workspace` | View payers/claims drafts | Medium | `patients:read` **OR** `payments:read` **OR** `payments:initiate` | **`payments:read` only** | Claims officer, cashier, finance read |
| `POST /insurance/claims` | Prepare operational claim draft | High | `payments:initiate` OR `payments:manage` | **unchanged** | Cashier / finance manage |
| `POST /insurance/payers` | Create/update payer | High | `settings:manage` OR `payments:manage` | **unchanged** | Admin / finance manage |
| `PATCH /insurance/claims/:id` | Record response / transition | High | `payments:manage` | **unchanged** | Finance manage |

**Frontend:** `Insurance & Claims` nav `permission` was `patients:read`, now `payments:read`. `App.tsx` still filters `user.permissions.includes(item.permission)`.

**Not changed:** `PermissionsGuard` OR semantics; shared queue OR; inventory catalogue OR; dispense `pharmacy:dispense` OR `inventory:manage`.

### Unresolved role decision

`insurance_officer` template is `patients:read`, `payments:read`, `encounters:read`. After this batch they **can view** the workspace and **still cannot** `POST /insurance/claims` (no `payments:initiate` / `payments:manage`). That matches today’s API, not the template prose (“operational claim drafts”). Assigning `payments:initiate` to that template is a **management decision**, not done here.

---

## 4. `/health` versus `/ready`

| Path | Auth | Check | Success | Failure |
| --- | --- | --- | --- | --- |
| `GET /api/v1/health` | `@Public()` | Process only | `{ status: 'ok', service: 'afyasasa-backend' }` 200 | — |
| `GET /api/v1/ready` | `@Public()` | Existing `DataSource.query('SELECT 1')`, 1500 ms timeout | `{ status: 'ready', service: 'afyasasa-backend' }` 200 | `{ status: 'not_ready', service: 'afyasasa-backend' }` **503**, no host/port/SQL text |

`/ready` does **not** mean migrations, modules, SHA, M-Pesa, or clinical workflows are operational.

Compose healthcheck still uses `/api/v1/health` (liveness). Not switched this batch.

**Automated tests:** available, unavailable (rejected query), timeout (`databaseIsReachable` hang).  
**Local HTTP:** **not-run** — nothing listening on `127.0.0.1:8080` this pass.

---

## 5. Cashier payment + charge flow

### Before

`recordManualPayment` validated, then `this.transactions.save`, then `applyPaymentToCharge` on the default repository. A charge-write failure could leave a completed payment without the matching balance update.

Pharmacy dispense already passed `manager` into `upsertPharmacyCharge` — **not changed**.

### After

1. Validate amount, load patient, idempotency lookup, 2-minute duplicate window, resolve lab/encounter (**before** financial writes).
2. `this.transactions.manager.transaction`:
   - Re-check idempotency and duplicate window
   - Lock charge (`pessimistic_write` when a manager is present)
   - Save `payment_transactions`
   - Apply paid/waived amounts and status on the **same** manager’s `Charge` repository
3. After **commit**: `applyCompletedPayment` (lab/encounter flags) and optional QuickBooks enqueue — same ancillary order as before.

Idempotency JSON key and two-minute window **preserved**. No unique index.

**Rollback evidence (Jest mocks that discard staging on throw):** payment-save failure → 0 committed payments and charges; charge-save failure → 0 committed payments and charges; retry after charge failure succeeds.

**Not in the same transaction:** lab `paymentStatus` / encounter `receiptNumber` updates. A failure there can still diverge from a committed cashier row (pre-existing). M-Pesa STK initiate+charge is **out of scope**.

---

## 6. Tests and builds (this pass)

Installed runner only (`backend/node_modules/.bin/jest`, `nest`, frontend `npm run build`). Not `npx`.

| Check | Result |
| --- | --- |
| `git diff --check` | **pass** (exit 0) |
| Focused Jest (7 suites: insurance, module-visibility, health, audit, cashier-atomic, payments.service, payment-integrity) | **39 passed**, 0 skipped, exit 0 |
| Full backend Jest `--runInBand --forceExit` | **81 suites passed; 410 passed; 20 skipped; 430 total**; ~12.6 s; exit 0. Open-handle force-exit remains |
| Backend `nest build` | **pass** (exit 0) |
| Frontend `tsc -b && vite build` | **pass** (exit 0); same chunk-size warnings as Phase 1 |
| Frontend Jest | **not-run** (no frontend test script) |
| Browser / staff UAT | **not-run** |
| Local `/health` `/ready` HTTP | **not-run** (compose not listening) |
| Production | **not-run** |

Phase 1 full suite was 78 / 385. This pass added three suites and the new cases above.

---

## 7. Remaining risks and unresolved decisions

1. Claims-officer template vs `POST /insurance/claims` (see §3).
2. Live roles that only had `patients:read` for insurance will lose the menu; template already included `payments:read`.
3. `/ready` not used by compose healthcheck yet.
4. Cashier ancillary lab/encounter updates remain after commit.
5. Receipt uniqueness still application-level only (Phase 1 F3, migration-gated).
6. Local 0-charge / 2-payment dataset from Phase 0 **not** rewritten.
7. Ready endpoint is public (like `/health`) — no PHI in payload.

---

## 8. States

| Task | Implemented | Automated-tested | Locally HTTP-exercised | Production-verified |
| --- | --- | --- | --- | --- |
| A Insurance auth | Yes | Yes (guard + metadata) | No | No |
| B `/ready` | Yes | Yes (unit) | No | No |
| C Atomic cashier payment+charge | Yes | Yes (mocked transaction) | No | No |

---

## 9. Manual UAT checklist (later, authorised local only)

1. User with **only** `patients:read`: Insurance & Claims hidden; `GET /api/v1/insurance/workspace` → 403.
2. User with `payments:read` (claims officer template): workspace loads; `POST /insurance/claims` still 403 without initiate/manage.
3. Cashier `payments:initiate`: manual payment against a charge updates `amount_paid` in the same commit; kill/restart mid-request does not leave a payment without the charge change (observe DB on **non-prod**).
4. Repeat cashier submit with same `idempotencyKey`: one payment row.
5. `GET /api/v1/health` → 200 `ok` with Postgres stopped (if safe locally); `GET /api/v1/ready` → 503 `not_ready` without connection strings.
6. Confirm tenant selector still hidden; tenant code still `jalaram`.

---

## Explicit confirmation

No production services, databases, migrations, deployments, or existing hospital records were changed. `TYPEORM_MIGRATIONS_RUN`, `AFYASASA_ALLOW_DEMO_SEED`, and `synchronize` were not flipped. Untracked `177100*` migrations were not run. No commit was created.

**Stop for review.** Do not start the next hardening batch until this Phase 2 change set is approved.
