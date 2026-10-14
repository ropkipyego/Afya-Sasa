# AfyaSasa — Director audit pack

**Date of this evidence:** 14 October 2026, 17:20–17:21 Africa/Nairobi (EAT, +0300)  
**Audience:** Hospital Director, with technical annex for IT / Finance  
**Decision:** Local **release candidate for management audit and controlled acceptance**. **Not** production-ready. **Not** clinically approved. **Not** deployed.

```
LIVE STACK CHANGED: NO
LIVE DATABASE CHANGED: NO
PRODUCTION SQL EXECUTED: NO
PRODUCTION MIGRATIONS APPLIED: NONE
PRODUCTION DEPLOYMENT PERFORMED: NO
COMMITS / PUSHES THIS PROGRAMME: NONE
LOCAL COMPOSE REBUILD / RESTART: NO
TYPEORM_MIGRATIONS_RUN: false (compose-pinned)
AFYASASA_ALLOW_DEMO_SEED: false
AFYASASA_LAB_AMENDMENT_ENABLED: false
```

Classifications used below: **automated-test verified**, **implemented / not browser-verified**, **requires clinical or Finance acceptance**, **requires migration or data audit**, **requires external credentials**, **not implemented**.

Command log: [`2026-10-14-test-evidence.log`](./2026-10-14-test-evidence.log)  
Stock note (same figures): [`2026-10-14-stock-integrity.md`](./2026-10-14-stock-integrity.md)  
Older [`2026-10-14-release-reconciliation.md`](./2026-10-14-release-reconciliation.md) is **superseded** for test counts and working-tree status.

---

## 1. Executive summary

Jalaram already uses AfyaSasa. This local working tree hardens **inventory posting, charge idempotency, diagnostic visits, and doctor-scoped worklists**, and records what automated tests actually proved on **disposable** databases.

**Management can rely on for a local audit discussion**

- Full backend Jest on this tree: **380 passed, 0 failed, 0 skipped** (includes inventory and lab PostgreSQL suites; those suites are **not** extra tests).
- Dispense and pharmacy charge share one database transaction; billing retry does not deduct stock; `dispenseOpId` prevents a second amount on the same operation.
- OTC bills through the existing `demo.charges` ledger when a patient and selling price exist. Walk-in without a patient is intentionally unbilled. Sale identity is `saleId`, not the patient id.
- Director finance widgets separate billed, collected, refunded, and outstanding. They are **operational EMR figures**, not QuickBooks, and are **not certified** until Finance/IT reconcile a period.
- Planned SQL (session table, unique lots) is **unapplied**. Duplicate-lot audit was **not** run on hospital data.

**Not ready**

- Production promotion (uncommitted; local Docker images were not rebuilt).
- Logged-in staff UAT (login wall; no authorised test account used this run).
- Blood bank, live SHA claims, live FHIR HIE, unique batch index, session-table migration.

---

## 2. Exact code revision and working-tree status

| Item | Value |
| --- | --- |
| Branch | `main` tracking `origin/main` (`0` ahead, `0` behind) |
| HEAD | `a75c2e46fbce16e0d4f96c82b4c02d667faca01b` — *Last Changes* — 2026-10-14 11:46:57 +0300 |
| Working tree | **Dirty.** Uncommitted. **Do not treat GitHub `main` as this candidate.** |
| Local images | `afya-sasa-backend-1` / `afya-sasa-frontend-1` already running; **not rebuilt** for this tree |
| Evidence HEAD in log | same `a75c2e4` (tests ran against the dirty tree, not a commit) |

Modified tracked files include inventory, payments, OPD, laboratory PG harness, mail, pharmacy UI, doctor landing, and spec typing. Untracked: planned SQL, inventory PG harness/tests, stock-posting helpers, `docs/release/`.

---

## 3. Verified feature matrix

| Area | Status |
| --- | --- |
| Inventory lock order, stock-take variance, session claim (0-qty + advisory lock), receipt/import txn, FEFO dispense, req/transfer document lock | **Automated-test verified** (unit + disposable PG miniature schema) |
| Pharmacy charge in same txn as dispense; retry without stock; `dispenseOpId` | **Automated-test verified** |
| OTC `saleId` idempotency; not using patientId as sale key | **Automated-test verified** (helper + service); PG rollback of OTC+charge |
| Doctor queue visibility; doctor appointments today scoped to actor | **Automated-test verified** (unit). **Not browser-verified** |
| Diagnostic-only visit destination / no auto consultation charge at check-in | **Implemented / not browser-verified**. Residual: cashier may still add a consultation line |
| Prescribe without stock deduction | **Implemented / not browser-verified** (API writes orders only) |
| Lab lifecycle concurrency | **Automated-test verified** on `lab_it` only. **Requires laboratory clinical review** of report templates |
| Director billed / collected / refund / outstanding **definitions** | **Automated-test verified** as code. Figures **require Finance acceptance** |
| Integrity panel UI | **Implemented / not browser-verified** |
| SHA eligibility, FHIR HIE | Mapping/client only — **requires external credentials**. Not live |
| Blood bank | **Not implemented** |
| Unique lot index / session table | **Requires migration or data audit** — unapplied |
| Production email / MFA | **Not enabled** |

---

## 4. Actual test commands and results

**Do not add subset counts to the full suite.** Jest `rootDir` is `backend/src`, `testRegex` is `.*\\.spec\\.ts$`. `npm run test:inventory-pg` and `npm run test:lab-pg` are **filters of the same suite**.

Environment (disposable only):

```
INVENTORY_TEST_DATABASE_URL=postgresql://inventory_it:***@127.0.0.1:55434/inventory_it
LAB_TEST_DATABASE_URL=postgresql://lab_it:***@127.0.0.1:55435/lab_it
```

| When (EAT) | Command | Result |
| --- | --- | --- |
| 17:20 | `npx jest --testPathPatterns=inventory-pg.integration --runInBand --forceExit` | 1 suite, **12 passed** |
| 17:20 | `npx jest --testPathPatterns=lab-pg.integration --runInBand --forceExit` | 1 suite, **10 passed** |
| 17:20 | `npx jest --runInBand --forceExit` (both URLs set) | 71 suites, **380 passed, 0 failed, 0 skipped** |
| 17:21 | `npx tsc -b --pretty false` in `frontend/` (project references `tsconfig.app.json` + `tsconfig.node.json`) | exit **0** |
| 17:21 | `npx tsc --noEmit --pretty false` in `backend/` (`tsconfig.json`, **includes `*spec.ts`**) | exit **0** |

Not run: `npm run test:e2e` (`backend/test/*.e2e-spec.ts`). Frontend has **no** Jest script.

The 380 includes the 12 inventory PG tests, the 10 lab PG tests, and one new `otcSaleReferenceId` unit test. Historical **379** is obsolete.

---

## 5. PostgreSQL integration evidence

Identity was checked **before** fixtures:

- `inventory_it/inventory_it` on `127.0.0.1:55434`
- `lab_it/lab_it` on `127.0.0.1:55435`

Harnesses refuse `afyasasa`, `sokoos`, `postgres`, `jalaram`, and the other suite’s database name.

These tests use **miniature schemas**, not live `demo` hospital quantities. They prove lock and transaction intent.

After tests, both containers were **removed**.

---

## 6. Inventory and billing integrity status

| Path | Transaction | Locks | Idempotency |
| --- | --- | --- | --- |
| Manual receipt | Yes | item + lots | New receipt each call (distinct `receipt` reference) |
| Receipt import | Yes (catalogue + stock) | advisory + item/lots | Session key; 0-qty claim; session table if applied |
| Stock-take | Yes | advisory + snapshot revalidation + lots | Same; **zero-variance still writes claim row** |
| Prescription / pharmacy dispense | Yes, charge in same txn | order `FOR UPDATE`, FEFO lots | Fully dispensed line refused; `dispenseOpId` on charge |
| Billing retry | Yes; **no stock** | order `FOR UPDATE` then charge lock | Same `dispenseOpId` returns existing charge |
| OTC | Yes | advisory on sale id, then lots | Client `saleId` required for retry safety; never patient id |
| Requisition issue | Yes | document then lots | Status must be approved; issued refused |
| Transfer ship / receive | Yes | document then lots | Ship only pending; receive only in_transit; existing `TRANSFER_IN` refused |

**OTC vs billing:** Identified patient + priced SKU posts through **existing** `PaymentsService.upsertPharmacyCharge` (`demo.charges`). Walk-in without patient: stock only. That is a billing convention, not missing cash.

**Failed charge:** forced failure inside the same txn rolls back stock and order (PG + unit).

**Concurrent retries:** application-level `dispenseOps` + row lock. There is **no** unique DB constraint on `(service_line, service_entity_id)`. Residual race if two first-time inserts race without the order lock (retry now locks the order).

**Zero-variance without session table:** `pg_advisory_xact_lock` + 0-qty `inventory_transactions` row with `(reference_type, reference_id)`. If advisory lock is unavailable, concurrent posters could both pass the existence check; the unique session table is the durable DB constraint. **Not applied.**

**Unique batch key:** `(item_id, location_id, COALESCE(batch_no,''))` **invalid** when two genuine lots share batch number and differ by expiry, or when NULL and `''` collide. Production snapshot verification: **blocked**.

---

## 7. Clinical workflow acceptance status

Browser this run: `http://127.0.0.1:5173/` showed **Sign in** only (“Authorised staff only”). **No authorised test account was used.** Workflows below are **not** marked passed.

| Workflow | Acceptance |
| --- | --- |
| Login / session | Login wall observed. Session/inactivity not exercised logged-in |
| Reception / registration | Source inspected. **Blocked** for UAT |
| OPD / doctor queue | Unit tests for visibility. **Blocked** for UAT |
| Diagnostic-only lab/rad | Source + check-in copy. **Blocked** for UAT |
| Prescription / dispensing | API + inventory tests. **Blocked** for UAT |
| Integrity panel | Source lists awaiting vs legacy. **Blocked** for UAT |
| Cashier / billing | Charge helpers tested. **Blocked** for UAT |
| IPD admit / discharge | Existing module. **Blocked** for UAT |
| Lab entry / verify / print | Disposable PG only. **Requires laboratory review** of templates |
| Director dashboard | Definitions in code. **Requires Finance period reconciliation** |
| Control Center / backup | Restore 403 in source. **Blocked** for UAT |

---

## 8. Security and permissions findings

- `PermissionsGuard` is **OR** of listed keys.
- Integrity: `inventory:read` **or** `inventory:manage`.
- Doctor queue: non-supervisors cannot request another doctor’s `doctorId`.
- `GET /opd/doctor/appointments/today` filters `doctorId = actor`.
- `GET /appointments/today` remains hospital-wide for `appointments:read` (front office).
- Executive finance hidden unless director/admin/superadmin or `payments:read` / `settings:manage`.
- Restore: `POST /admin/backups/restore` 403. SQL dump is not a full-system backup.
- MFA OTP not required on the observed login copy. Production email delivery not enabled from this programme.
- No production secrets added to source in this pass.

---

## 9. Financial reconciliation status

**Not certified.** Operational EMR ≠ QuickBooks GL.

| Metric | Authoritative EMR source | Period vs point-in-time | Must not confuse with |
| --- | --- | --- | --- |
| Billed | `SUM(demo.charges.amount_owed)` on `created_at` in range | Period | Cash collected |
| Collected | `SUM(demo.payment_transactions.amount)` where `status=completed` and `metadata.kind <> refund` | Period | Revenue / QB deposits |
| Refunded | Same table, `metadata.kind = refund` | Period | Negative billed |
| Outstanding | `SUM(owed − paid − waived)` where status in `owed`, `partially_paid` | **Now**, not range | Period billed − collected |
| QB | Integration `pending`; failed QBWC counted separately | n/a | EMR cashier totals |

### Reconciliation worksheet (blank — do not invent a match)

Period from: __________ to: __________  
Prepared by Finance: __________ IT: __________ Date: __________

| Line | EMR | QuickBooks / bank | Difference | Explanation |
| --- | --- | --- | --- | --- |
| Billed | | | | |
| Collected | | | | |
| Refunded | | | | |
| Outstanding (as-of) | | | | |

Pharmacy Director KPI remains **Data unavailable** (`docs/AFYASASA_DASHBOARD_METRIC_DEFINITIONS.md`).

---

## 10. Migration and snapshot prerequisites

Keep `TYPEORM_MIGRATIONS_RUN=false`. **Do not apply from this programme.**

| File | What it does | Before it exists | After / required constraint | Apply? |
| --- | --- | --- | --- | --- |
| `20261014_inventory_concurrency.sql` | `inventory_import_sessions` unique `session_key` | Advisory lock + 0-qty ledger claim | Unique session row is the durable concurrent idempotency constraint | **No** until IT + Director |
| `20261014_inventory_batch_unique_index.sql` | Unique lot key (commented) | Duplicate lots allowed | Index only if audit returns **zero** groups; expiry **not** in key | **No** |
| `20261014_inventory_batch_duplicate_audit.read-only.sql` | Duplicate `(item, location, COALESCE(batch_no,''))` | n/a | Must run on an **authorised protected snapshot**, not invented from the test fixture | **Not run** |
| `20261014_stock_take_sessions.sql` | Commented first-class take tables | Ledger-backed takes | Optional later | **No** |

**What works before the session table:** posting, variance, 0-qty claim, advisory lock on PostgreSQL.  
**What requires the session table:** a database unique constraint if two posters race when advisory lock is missing or bypassed.

---

## 11. Known issues and residual risks

1. Running local images do not include this dirty tree.
2. Unique lot index vs expiry / NULL vs `''`.
3. Diagnostic visits do not forbid a manual consultation charge.
4. Charge uniqueness is application-level (`dispenseOps`), not a unique SQL constraint.
5. OTC without `saleId` is not idempotent (new UUID each call).
6. Lab / clinical / Director UAT blocked (no test login).
7. No frontend automated tests; e2e Jest not run.
8. Blood bank, live SHA/FHIR, KHIS submit deferred.

---

## 12. Hospital decisions and approvals required

1. Director: accept this pack as **evidence for audit**, not as go-live.
2. IT: whether to apply **sessions-only** SQL without the unique lot index.
3. IT: authorised **read-only** duplicate-lot audit on a protected snapshot.
4. Finance: complete §9 worksheet for one reporting period.
5. Laboratory: review result templates before clinical sign-off.
6. Separate instruction required to **commit**, rebuild, or deploy.

---

## 13. Staff acceptance-test checklist

Use a **synthetic UAT patient**. Do not invent charges or stock to complete the demo. Leave unchecked until a logged-in run happens.

- [ ] Ordinary OPD check-in vs diagnostic-only (no doctor queue; no auto consult fee).
- [ ] Doctor: own queue and own appointments only.
- [ ] Multi-line prescription does not reduce stock; confirmed dispense does; retry does not.
- [ ] OTC with patient+price one charge; walk-in unbilled; same `saleId` refused.
- [ ] Stock-take preview/confirm; zero-variance still claimed; second session refused.
- [ ] Transfer receive once; requisition issue once.
- [ ] Integrity: awaiting-charge ≠ legacy review.
- [ ] Director: billed / collected / outstanding separate; pharmacy activity unavailable.
- [ ] Backup listed as SQL dump; restore forbidden.
- [ ] Empty lists do not fabricate patients.

---

## 14. Controlled-release and rollback plan

**Release (only after §12 approvals and a commit that does not exist yet)**

1. Tag the commit SHA on a review branch.
2. Rebuild **local/staging** images from that SHA. Do not migrate.
3. Staff UAT on a copy or local stack — never reseed live patients.
4. If sessions SQL is approved, apply on a **maintenance window** with `TYPEORM_MIGRATIONS_RUN` still false and a reviewed one-off script — not auto-migrate.

**Rollback**

1. Redeploy the previous image SHA (`a75c2e4` or the last production tag). Do not restore over live data from the UI.
2. If sessions SQL had been applied, rollback is a DBA procedure on a backup taken **before** apply. UI restore remains forbidden.
3. Unique lot index, if ever applied, must not be rolled forward on a database that still has duplicate lots.

This tree remains **uncommitted and undeployed**. There is nothing to roll back in production from this programme.

---

## 15. Uncommitted and undeployed

Local changes **remain uncommitted and undeployed**. No production database, migration, deployment, commit, or push was performed for this pack.

Director: ______________________ Date: __________  
IT: ____________________________ Date: __________  
Finance (metrics worksheet): ____ Date: __________
