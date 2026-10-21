# AfyaSasa Phase 1 — baseline protection and first-pass engineering review

**Date:** 20 October 2026 (Africa/Nairobi)  
**Controlling audit:** `docs/audits/phase-0-2026-10-20/` (20 October 2026)  
**Nature:** Local read-only inspection, code review, tests, and a proposed change plan. **No application behaviour was changed in this pass.**  
**Repository:** `/home/yobra/Desktop/Afya-Sasa-1/Afya-Sasa`

```
PRODUCTION CONNECTED: NO
PRODUCTION SERVICES RESTARTED: NO
PRODUCTION SQL: NO
MIGRATIONS RUN: NO
DEMO SEED: NO
SYNCHRONIZE: unchanged (false in source)
COMMITS / PUSHES / RESET / CLEAN / STASH: NONE
WORKING TREE OVERWRITTEN: NO
PATIENT RECORDS MODIFIED: NO
LOGGED-IN UAT: NO
```

The 15 October departmental audit and the Phase 0 pack were **not** deleted.

---

## 1. Baseline and working-tree preservation

| Item | Value | Evidence |
| --- | --- | --- |
| Branch | `main` tracking `origin/main` (not ahead) | `git status -sb` |
| HEAD | `4a31826e7a5ce3c853b8f63f8c517fd5ec04428e` (`documentation`) | `git rev-parse HEAD` |
| Dirty paths | **57** short-status lines after this report file is added | `git status --short \| wc -l` was 56 at Phase 0; 57 after Phase 0 docs; this file adds one more |
| Preservation | No `git reset`, `clean`, `stash`, `checkout` of dirty files | this session |

### Modified (preserved)

```
backend/src/clinical-order/clinical-order-mirror.service.ts
backend/src/clinical-order/clinical-order.controller.ts
backend/src/clinical-order/clinical-order.entities.ts
backend/src/clinical-order/clinical-order.module.ts
backend/src/inventory/inventory.controller.ts
backend/src/inventory/inventory.dto.ts
backend/src/inventory/inventory.entities.ts
backend/src/inventory/inventory.service.spec.ts
backend/src/inventory/inventory.service.ts
backend/src/laboratory/lab-catalog.controller.ts
backend/src/laboratory/lab-catalog.service.ts
backend/src/laboratory/laboratory.controller.ts
backend/src/laboratory/laboratory.module.ts
backend/src/opd/opd.service.ts
backend/src/queue/visit-queue.controller.ts
backend/src/radiology/radiology.dto.ts
backend/src/radiology/radiology.service.ts
backend/src/reporting/reporting.service.ts
frontend/src/App.tsx
frontend/src/components/investigations/ImagingModule.tsx
frontend/src/components/investigations/ImagingResultsEntry.tsx
frontend/src/components/investigations/LabModule.tsx
frontend/src/components/investigations/LabWorklist.tsx
frontend/src/components/layout/AppMobileNav.tsx
frontend/src/components/opd/OpdCheckInWorkspace.tsx
frontend/src/components/orders/PharmacyProductsPanel.tsx
frontend/src/components/orders/PharmacyWorkspace.tsx
frontend/src/components/orders/PrescriptionForm.tsx
frontend/src/components/reports/ExecutiveAnalyticsDashboard.tsx
frontend/src/components/ui.tsx
frontend/src/lib/nav-module-filter.ts
frontend/src/lib/navigation.spec.ts
frontend/src/lib/navigation.ts
```

### Untracked (preserved)

```
backend/src/clinical-order/clinical-order-mirror.spec.ts
backend/src/clinical-order/prescription-quantity.spec.ts
backend/src/clinical-order/prescription-quantity.ts
backend/src/database/migrations/1771000000000-InventoryStrengthForm.ts
backend/src/database/migrations/1771000000001-ClinicalOrderClientRequestId.ts
backend/src/database/migrations/1771000000002-BloodBankRequests.ts
backend/src/laboratory/blood-bank.entities.ts
backend/src/laboratory/blood-bank.service.ts
backend/src/laboratory/blood-bank.spec.ts
backend/src/laboratory/lab-work-areas.spec.ts
backend/src/laboratory/lab-work-areas.ts
backend/src/opd/referral-details.spec.ts
backend/src/opd/referral-details.ts
backend/src/opd/visit-routing.spec.ts
backend/src/opd/visit-routing.ts
backend/src/radiology/radweb-image-url.spec.ts
backend/src/radiology/radweb-image-url.ts
docs/audits/phase-0-2026-10-20/
frontend/src/components/investigations/BloodBankDesk.tsx
frontend/src/components/investigations/DiagnosticCheckInArrivals.tsx
frontend/src/components/investigations/ImagingShiftHandover.tsx
frontend/src/lib/lab-work-areas.ts
frontend/src/lib/prescription-quantity.ts
frontend/src/lib/referring-details.ts
```

Recent commits (not re-implemented): `4a31826 documentation`, `507cc02 drugs changes....`, `a75c2e4 Last Changes`.

### Untracked migrations — expected schema (not applied this pass)

| File | Objects |
| --- | --- |
| `1771000000000-InventoryStrengthForm.ts` | `ALTER TABLE demo.inventory_items ADD COLUMN IF NOT EXISTS strength varchar NULL`, `dosage_form varchar NULL` |
| `1771000000001-ClinicalOrderClientRequestId.ts` | `demo.clinical_orders.client_request_id varchar NULL`; **partial unique index** `uq_clinical_orders_client_request_id` on `(client_request_id) WHERE client_request_id IS NOT NULL AND deleted_at IS NULL` |
| `1771000000002-BloodBankRequests.ts` | `CREATE TABLE IF NOT EXISTS demo.blood_bank_requests` (uuid PK, `request_no` unique, patient/encounter/admission FKs as uuid columns, product, units, blood group, indication, status, grouping/crossmatch, issued_at); index `idx_blood_bank_requests_status` |

Comments on all three files: apply via explicit SQL only; `TYPEORM_MIGRATIONS_RUN` must stay false. **This Phase 1 pass did not run them.** Phase 0 recorded that the **local** database already contains these objects; **production schema was not inspected** (forbidden this phase).

### Configuration (source only; flags not changed)

| Setting | Source | Value |
| --- | --- | --- |
| `synchronize` | `backend/src/app.module.ts` | **hard-coded `false`** |
| `migrationsRun` | same; `TYPEORM_MIGRATIONS_RUN === 'true'` | compose pins **`"false"`** |
| `AFYASASA_ALLOW_DEMO_SEED` | `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example` | **false**; `demo-seed-guard.ts` blocks true in production |
| `AFYASASA_CHARGES_ENABLED` | compose | **true** |
| `AFYASASA_LAB_AMENDMENT_ENABLED` | compose + `laboratory.service.ts` | **false** |
| Backend healthcheck | compose | HTTP `/api/v1/health` only |

Stale docs (`docs/contabo-deployment-guide.md`, `docs/free-test-hosting-guide.md`) still mention `TYPEORM_MIGRATIONS_RUN=true`. **Compose files pin false.** Do not follow those guides.

---

## 2. Jalaram tenant identity versus `demo` schema

**Required identity:** hospital/tenant Jalaram; tenant code `jalaram`; PostgreSQL schema **`demo`** (do not rename).

| Layer | Finding |
| --- | --- |
| Tenant code | `DEFAULT_TENANT_CODE` default `jalaram` (`tenant.middleware.ts`, `.env.example`) |
| Schema | `DEFAULT_TENANT_SCHEMA` default `demo`; TypeORM `@Entity({ schema: 'demo' })` |
| JWT bind | `JwtAccessGuard` calls `assertAccessTenantMatches({ tokenTenantCode: payload.tid, requestTenantCode: request.tenant?.code })` |
| Alias | `tenantLookupCodes('demo')` returns `['jalaram','demo']`. **Cutover alias, not proven multi-tenant isolation.** |
| Selector | `VITE_HIDE_TENANT_SELECTOR` defaults **true** in `docker-compose.yml` frontend build args; `LoginScreen` hides hospital code when true and forces `DEFAULT_TENANT` |
| Product chrome | Login still prints **“AfyaSasa”** as the product mark (`LoginScreen.tsx`); hospital name comes from public hospital profile (Jalaram strings elsewhere) |
| Superadmin | `SuperAdminPanel.tsx` treats `tenant.code !== 'jalaram'` as a special case — selector must stay hidden |

**Can Jalaram branding be corrected without schema, tenant isolation, or production data changes?**  
**Yes, for UI/copy only:** product vs hospital labelling, logos, and facility display names that already default to Jalaram in mail/SMS/lab reports.  
**No, without a migration/data plan:** renaming schema `demo` → `jalaram`; rewriting tenant rows; enabling the hospital-code selector; claiming cross-tenant safety.

**Do not enable the tenant selector. Do not claim production-safe multi-tenant isolation.**

---

## 3. Actual test and build results (this pass)

Commands used the **installed** runners (`backend/node_modules/.bin/jest`, `backend/node_modules/.bin/nest`, `frontend` `npm run build`). **Not** `npx`. **Not** Phase 0 numbers copied forward without re-running.

| Check | Command | Result (20 Oct 2026 ~21:32–21:34 EAT) |
| --- | --- | --- |
| `git diff --check` | repo root | **exit 0** (no whitespace/conflict markers) |
| Backend Jest (full) | `./node_modules/.bin/jest --runInBand --coverage=false --forceExit` | **78 suites passed; 385 passed; 20 skipped; 405 total; ~7.8 s; exit 0**. Force-exit due to open handles |
| Focused suites | 22 files listed below | **22 passed; 114 passed; 11 skipped; 125 total; ~2.7 s; exit 0** |
| Frontend unit tests | — | **Not available.** `frontend/package.json` has no `test` script and no Jest/Vitest dependency. `frontend/src/lib/navigation.spec.ts` is **not** in backend `rootDir: src` |
| Backend compile | `./node_modules/.bin/nest build` | **exit 0** |
| Frontend build | `npm run build` (`tsc -b && vite build`) | **exit 0**, Vite 8.0.16, ~1.44 s. Warnings: large chunks; ineffective dynamic imports (`auth-store.ts`, `api.ts`) |
| Logged-in UAT | — | **Did not occur** |
| Browser workflow | — | **Did not occur** |

Focused Jest files (all passed or skipped-inside-suite):  
`clinical-order-mirror`, `prescription-quantity`, `pharmacy-prescription`, `visit-routing`, `referral-details`, `opd.service`, `visit-queue.service`, `inventory.service`, `stock-integrity`, `stock-posting`, `inventory-pg.integration`, `laboratory.permissions`, `lab-lifecycle`, `blood-bank`, `radiology-access`, `radiology-lifecycle`, `radweb-image-url`, `payment-integrity`, `payments.service`, `module-visibility`, `tenant-bind`, `reporting-metrics`.

Build artefacts (`backend/dist`, `frontend/dist`) are gitignored; they were not committed.

---

## 4. Confirmed, unconfirmed, and disproved Phase 0 findings

Legend: **Confirmed** = this review reproduced in source (and tests where cited). **Unconfirmed** = still unknown without production or UAT. **Disproved as a blanket claim** = mechanism exists but is not automatically a defect on every handler.

### 4.1 PermissionsGuard OR-of-keys — **Confirmed mechanism**

```89:91:backend/src/core/auth/auth.guards.ts
    const allowed = required.some((permission) =>
      userPermissions.has(permission),
    );
```

`RequirePermissions(...keys)` stores a flat array. **Any one key is enough.**

**Do not globally change OR to AND.** Many lists are intentional unions:

| Handler | Keys | Likely intent |
| --- | --- | --- |
| `GET inventory/items` | inventory:read, pharmacy:read, pharmacy:prescribe, consultations:create, payments:initiate | Catalogue for store, pharmacy, prescriber, cashier |
| `GET /queue` | encounters:read, emergency:read, pharmacy:read, lab_requests:read, radiology_requests:read | Shared worklist |
| `POST inventory/dispense/*` | pharmacy:dispense, inventory:manage | Pharmacy **or** store manager |
| Lab verify | **`lab_results:verify` only** | Single key — OR unused |
| Radiology verify | **`radiology_reports:verify` only** | Single key |
| Refund | **`payments:manage` only** | Single key |

`module-visibility.spec.ts` documents Insurance keys as `patients:read`, `payments:read`, `payments:initiate` but **never asserts that `patients:read` alone is insufficient**. Tests currently encode OR.

**Over-broad confirmed examples (policy, not automatic AND):**

- `GET /insurance/workspace` — `patients:read` **OR** `payments:read` **OR** `payments:initiate` (`insurance.controller.ts`). Matches nav `permission: 'patients:read'`.
- `GET /queue` — a user with only `pharmacy:read` may list **all** queue types the service returns (controller does not split by `queueType`).
- `POST /inventory/dispense/pharmacy` — `inventory:manage` without `pharmacy:dispense` is enough.

**Finance / refund / dispense / lab verify / rad verify (API):**

| Action | Guard | Assessment |
| --- | --- | --- |
| Manual payment / cashier | `payments:initiate` (and mixed OR with read on GETs) | Initiate is the collection key; read+initiate OR on several GET summaries |
| Refund `POST payments/:id/refund` | `payments:manage` only | **Tight** |
| Dispense | `pharmacy:dispense` **OR** `inventory:manage` | Dual-role by design; needs management sign-off before narrowing |
| Retry billing | those plus `payments:manage` | OR |
| Lab result enter / verify | separate keys; verify is single | **Tight** on verify |
| Lab blood-bank status | enter **OR** verify | Union |
| Radiology report create / verify | create vs verify single keys | **Tight** on verify |

Hidden UI is still not authorisation. Insurance nav vs API is **aligned to the weak key**, not a UI-only leak.

### 4.2 Health vs readiness — **Confirmed**

`HealthController` is `@Public()`, returns `{ status: 'ok', service: 'afyasasa-backend' }`, **no database ping**. Compose backend healthcheck uses that URL. Postgres down after start would not fail that check.

### 4.3 Payment idempotency and unique receipt — **Confirmed missing DB constraint; application mitigations exist**

- Receipt numbers: `JH-RCP-{year}-` via `nextHospitalReceiptNo()` stored in `externalReference` (max+1, **raceable**, no unique index on entity).
- Optional `idempotencyKey` in **JSON metadata**; lookup is `metadata->>'idempotencyKey'` — **not unique**.
- Soft duplicate window: same patient/method/line/amount within **2 minutes**.
- TypeORM `PaymentTransaction`: indexes on status/method only; `chargeId` nullable.
- Charge entity: **no** `@Unique`. Phase 0 local DB had `uq_charges_service_entity_active` — **production unknown this phase**.

**Do not add a unique index in this batch** until duplicate analysis on an authorised non-production snapshot.

### 4.4 Charge / payment / dispense transactions — **Confirmed in code for pharmacy dispense; manual payment weaker**

- OTC and prescription charging call `payments.upsertPharmacyCharge(..., manager)` **inside** `items.manager.transaction`. Charge failure should roll back stock in that path (Jest stock/payment specs exist; this pass re-ran them).
- `recordManualPayment` saves the transaction then `applyPaymentToCharge` **without** an enclosing transaction in the reviewed method — **integrity risk** if the second write fails.
- Local Phase 0 counts (0 charges / 2 payments) remain **data on the local copy**, not proof that 507cc02 code is absent. Production not inspected.

### 4.5 Inventory batch uniqueness — **Confirmed still planned, not applied in source**

`backend/src/database/sql/planned/20261014_inventory_batch_unique_index.sql` is commented; requires read-only duplicate audit first. Entity `batch_no` is nullable, no unique decorator.

### 4.6 Prescription catalogue + `client_request_id` — **Confirmed in dirty tree**

- Mirror rejects lines without `itemId`; loads active pharmaceutical IDs; unique-violation replay (`clinical-order-mirror.service.ts`).
- Column is nullable `select: false`; code probes `information_schema` before writing the column.
- Unique index is **migration-gated** (`1771000000001`). Application replay works without the index but cannot prevent concurrent duplicates.

### 4.7 Diagnostic-only routing — **Confirmed in dirty tree + unit tests**

`visit-routing.ts`: `laboratory_only` / `radiology_only` / `diagnostic` override a client `destination=doctor`. Jest `visit-routing.spec.ts` passed this pass. **No logged-in check-in UAT.**

### 4.8 Reporting aggregations — **Confirmed sources; accuracy uncertified**

| Metric | Source tables / filters |
| --- | --- |
| Charges | `charges.amountOwed` by `createdAt` |
| Collections | `payment_transactions.amount` status=`completed`, excluding `metadata.kind=refund` |
| Refunds | completed + `kind=refund` |
| Dashboard `activeOpd` | `encounters` type=`opd` **status=`triaged` only** — not all open OPD |
| Occupancy | `beds` status=`occupied` |
| SHA | `sha_eligibility` entity injected; not live SHA |

Director copy states EMR cashier ledger **is not** the QuickBooks GL (`departmentRevenue`). Numbers are **not certified** against hospital books.

### 4.9 Disproved or narrowed

| Phase 0 wording | This review |
| --- | --- |
| Treat every multi-key `@RequirePermissions` as a defect | **Disproved as blanket.** Mechanism is OR; several unions are operational. Classify per handler. |
| Dispense+charge never transactional | **Disproved for pharmacy OTC/Rx paths that pass `manager`.** Manual cashier path is the weaker boundary. |
| Need a new charges or payments table | **Disproved.** Keep `charges` and `payment_transactions`. |
| Lab/rad verify are OR-loose | **Disproved for verify endpoints** (single permission). |

### 4.10 Unconfirmed (no production / no UAT)

- Production image vs `4a31826` vs dirty tree  
- Production flags, backups, unique indexes, duplicate receipts/lots  
- Whether local 0-charge / 2-payment dataset exists in hospital operations  
- Cross-tenant isolation beyond unit `tenant-bind.spec`  
- SHA / M-Pesa / QuickBooks live behaviour  
- Diagnostic check-in in a real staff session  

---

## 5. Prioritised fixes and acceptance tests (proposed only)

No code was changed for these items in Phase 1.

| ID | Priority | Defect | Proposed fix | Schema? | Sign-off | Acceptance tests |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | P1 | Insurance workspace API+nav accept `patients:read` | Dedicated `insurance:read` / keep payments keys; **do not AND globally** | No | Management + claims | Guard test: registrar `patients:read` only → 403 on `/insurance/workspace`; claims officer allowed |
| F2 | P1 | `/health` ignores DB | Add internal `/ready` with `SELECT 1`; keep public `/health` as liveness **or** document compose check separately | No | Engineering | Non-prod: stop postgres → ready fails, liveness optional |
| F3 | P1 | Payment unique receipt / idempotency key only in JSON | After duplicate scan: unique index on non-null `external_reference` and/or idempotency expression | **Yes — gated** | Finance | Duplicate POST does not create two `completed` rows |
| F4 | P1 | Manual payment vs charge not one DB transaction | Wrap `recordManualPayment` charge+txn in one manager transaction | No | Finance | Forced charge failure leaves no completed payment |
| F5 | P2 | Queue list OR across departments | Filter list by caller’s department keys **or** split routes | No | Clinical ops | Pharmacist cannot list ED tokens |
| F6 | P2 | Dispense allowed with only `inventory:manage` | Policy: keep or require `pharmacy:dispense` | No | Pharmacy + store | Role matrix |
| F7 | P2 | Batch unique index | Planned SQL only after duplicate audit | **Yes — gated** | Pharmacy | Duplicate lot insert fails |
| F8 | P2 | `client_request_id` unique | Apply `1771000000001` only after NULL/duplicate scan | **Yes — gated** | Clinical | Double-submit returns same order |
| F9 | P3 | Login “AfyaSasa” vs Jalaram identity | Copy/logo only; keep tenant code `jalaram`, schema `demo`, selector hidden | No | Management | Selector still hidden; X-Tenant still `jalaram` |
| F10 | P3 | Stale docs `TYPEORM_MIGRATIONS_RUN=true` | Banner on those guides; do not delete | No | Engineering | Compose still false |
| F11 | P3 | Jest open handles | `--detectOpenHandles` cleanup | No | Engineering | Jest exits without `--forceExit` |
| F12 | P3 | Frontend `navigation.spec.ts` has no runner | Wire to existing Jest **or** drop if unused — decide later | No | Engineering | Spec actually runs |

**Dirty-tree clinical batch** (prescription exact ID, diagnostic routing, blood-bank desk, RadWeb URL): already written, tests green this pass. **Merge/commit is not authorised here.** Requires clinical + pharmacy review of behaviour, then a **migration plan** for `177100*` if those features are promoted.

---

## 6. Production and migration blockers

| Blocker | Status |
| --- | --- |
| Production inspect | **Out of scope this phase** (user instruction). Version drift remains P0 from Phase 0. |
| Auto-migrate / seed / synchronize | Must remain **false / false / false**. Lab amendment **false**. |
| `177100*` | Additive; local copy may already have them; **production unknown**. Unique `client_request_id` can fail on duplicates. |
| Payment / batch unique indexes | Planned SQL exists; **duplicate analysis not run on hospital data this phase**. |
| Schema rename `demo` | **Forbidden.** |
| Tenant selector | **Must stay hidden.** |
| Deploy / restart | **Forbidden this phase.** |
| Commit of dirty tree | **Not requested; not done.** |

---

## 7. Proposed next implementation batch (after review)

**Batch 1A — documentation only (no API/schema):**  
This Phase 1 report + optional warning banners on stale migrate=true guides. F10.

**Batch 1B — local app-only, no migration (if approved):**  
F1 insurance permission (nav + `InsuranceController` + tests).  
F2 readiness endpoint (do not weaken `/health` consumers without compose follow-up).  
F4 wrap manual payment+charge in one transaction + regression test.  
F9 branding copy **only if** management wants it.  
**Do not** AND all `RequirePermissions` lists.

**Batch 1C — dirty-tree product work (if approved as one reviewable PR, still no prod migrate):**  
Keep existing OPD doctor path; diagnostic override already unit-tested. Prescription `itemId` required. Blood bank remains a **lab request desk**, not a transfusion service. **Migrations stay unapplied in production.**

**Batch 1D — migration-gated (separate change plan + backup + duplicate queries):**  
`1771000000000`–`0002`, payment unique receipt, batch unique index.

**Out of batch:** SHA/M-Pesa/QB live wiring; schema rename; tenant selector; new SoT tables; production deploy.

---

## Explicit confirmation

This Phase 1 pass did **not** connect to or inspect live production, deploy, restart services, run production or local migrations, seed, reset, or modify patient/finance records. It did **not** commit, push, stash, reset, or overwrite uncommitted work. Flags `TYPEORM_MIGRATIONS_RUN`, `AFYASASA_ALLOW_DEMO_SEED`, `synchronize`, and lab amendment were **not** changed. No parallel SoT tables were created. The tenant selector was **not** enabled.

**Stop:** baseline captured, high-risk code reviewed, tests/builds recorded, change plan proposed. Waiting for review before any implementation batch.
