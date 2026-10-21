# 11–16. Risk register, roadmap, tests, migration safety, user-doc gaps, acceptance criteria

**Date:** 20 October 2026  
**Authorisation:** this file recommends work. It does **not** authorise implementation, commit, migration, or production change.

---

## 11. Defect and risk register

| ID | Severity | Finding | Impact | Evidence | Recommended action | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| R01 | **P0** | Production version and image digest unknown; local images ≠ HEAD `4a31826` | Cannot know what staff are running; “fixing” local dirty tree may not match live | Phase 0: no Contabo inspect; local rebuild from dirty tree | Authorised read-only production inspect (compose ps, image labels, `/api/v1/health`, flag printenv). No restart | Document prod commit/digest vs Git |
| R02 | **P0** | Uncommitted schema + 3 untracked migrations already applied **locally** | Accidental prod migrate/sync would alter live DB | `177100*`; columns/indexes present in local `demo` | Freeze auto-migrate (`false`). Produce reviewed SQL plan only after prod schema diff | Prod `information_schema` vs migration files |
| R03 | **P0** | Dirty working tree (56 paths) is the actual product delta | Loss/overwrite of uncommitted clinical/pharmacy/lab work | `git status` | Do not reset/clean. Review as a batch **after** Phase 0 approval | `git status` remains until explicit commit request |
| R04 | **P1** | Local financial mismatch: 0 charges, 2 completed payments, 66 stock txns | Billing/stock reports wrong on this DB; may indicate older paths or incomplete 507cc02 data | `COUNT(*)` | Read-only reconcile; **no silent UPDATE of posted rows**. If prod similar, use reversal/adjustment | SQL joins charge↔payment↔inventory (redacted) |
| R05 | **P1** | `payment_transactions` lacks unique business idempotency key | Duplicate completed payments possible under retries | `pg_indexes` | After prod duplicate scan, additive unique index on non-null receipt/client id — **migration gate** | Duplicate query + Jest concurrency |
| R06 | **P1** | PermissionsGuard OR-of-keys | Over-broad API access | `auth.guards.ts` | Classify endpoints; AND or split; permission tests | Forbidden cases in Jest |
| R07 | **P1** | `/health` does not check Postgres | False healthy | `health.controller.ts` | Separate `/ready` with `SELECT 1` | Kill-DB test in **non-prod** only |
| R08 | **P1** | Pharmacy catalogue locally 2 items; strength/form empty | Prescribers cannot match real drugs; guessing forbidden | COUNT + empty columns | Operational: staff PATCH catalogue. Engineering: keep exact `itemId` | Dispense UAT with real SKUs on **non-prod** copy |
| R09 | **P1** | Unique `client_request_id` only local | Duplicate prescription submit on prod possible | local index vs untracked migration | Include in reviewed migration **after** duplicate analysis | Unique violation test |
| R10 | **P1** | Insurance nav `patients:read` | UI leak of claims workspace | `navigation.ts` | Dedicated permission aligned with API | Role matrix test |
| R11 | **P2** | SHA/FHIR/M-Pesa/QB/KHIS not live | Staff may believe integrations work | Jest + no credentials this audit | Interop screen must show **not connected**; no fake success | Status contract tests |
| R12 | **P2** | Blood bank = thin lab desk (dirty tree), 0 rows | Unsafe if used as transfusion/TTI/fridge system | blood-bank.* + COUNT 0 | Label as request desk; no pharmacy lots | Spec + UI copy |
| R13 | **P2** | Lab amendment disabled | Cannot correct verified results in app | flag false | Policy decision, not a silent enable | Flag test |
| R14 | **P2** | Reporting uncertified | Director decisions on wrong numbers | reporting.service; 0 charges | Metric dictionary + reconcile | Independent SQL vs API |
| R15 | **P2** | Jest open handles | CI may hang/flake | Jest footer this run | `--detectOpenHandles` later; not a product defect | Clean exit |
| R16 | **P2** | Batch uniqueness not in indexes | Duplicate lots / FEFO confusion | `pg_indexes` | After duplicate scan, unique constraint — migration gate | inventory-pg tests |
| R17 | **P3** | User docs vs dirty UI | Training lag | nav Blood Bank, diagnostic arrivals | Update staff docs **after** merge | Screenshot checklist |
| R18 | **P3** | Schema still named `demo` | Operator confusion | information_schema | Do not rename in this phase | — |
| R19 | **P3** | Stale deploy docs mentioning auto-migrate | Someone might enable `TYPEORM_MIGRATIONS_RUN=true` | historical guides | Banner: compose pins false; ignore contrary docs | Doc review |
| R20 | **P2** | No authenticated E2E this Phase 0 | Screens may exist while workflow fails | login not performed | After approval: scripted UAT on local with synthetic patients | Workflow scripts in `ops/` |

No active production incident was **confirmed** (production unseen). Treat R01 as the blocking unknown.

---

## 12. Prioritised implementation roadmap

**Do not start until this pack is approved.** Preserve OPD/prescribing unless a **specific** defect is proven.

### P0 — change control and live identity (no feature rewrite)

1. Authorised production discovery (read-only): versions, flags, schema migration list, backup existence, health. **No restart.**
2. Protect dirty tree: branch or stash **only if user requests**; default is leave working tree.
3. Diff production schema vs local (especially `177100*` objects) before any migrate thought.

### P1 — integrity and safety (narrow batches)

1. Production (or sanitised copy) reconcile: stock movements ↔ charges ↔ payments. Document gaps; reverse/adjust, never rewrite history.
2. Payment idempotency unique key **if** duplicates are zero or remediable.
3. PermissionsGuard review for finance, pharmacy dispense, lab verify, radiology verify, insurance.
4. Ready-check including DB.
5. Complete review of **already written** dirty-tree prescription exact-ID + client_request_id + diagnostic routing — merge as one reviewed batch **if** approved, with Jest + targeted UAT. Do not expand scope.

### P2 — workflows, reporting, interop, reliability

1. Lab/imaging check-in UAT on diagnostic visit types (dirty UI).
2. Blood bank: keep thin; do not build donor/TTI unless specified.
3. Reporting metric dictionary; pharmacy KPI only if traced.
4. Interop: credential-gated; status honesty.
5. Jest open handles; more permission and concurrency tests.

### P3 — docs, nav consistency, naming

1. Staff documentation for new desks.
2. Fix stale migration advice in old guides (without deleting useful history).
3. Navigation polish only after clinical/finance batches.

Sequence: **P0 discovery → freeze migrate → P1 reconcile/permissions → optional merge of dirty clinical batch → P2 → P3.**

---

## 13. Test and regression strategy

**Runner:** `npm test` (root) → `npm --prefix backend test -- --runInBand` using **installed** Jest.

**This audit:** 385 passed, 20 skipped, 78 suites, exit 0, open-handle warning.

### Gaps

| Gap | Why it matters |
| --- | --- |
| No logged-in browser E2E this Phase 0 | UI/API contract unverified for dirty screens |
| Frontend unit suite not separately reported | `navigation.spec.ts` dirty |
| Production-shaped data | Local 26 patients / 0 charges |
| Payment duplicate concurrency against DB unique (missing) | R05 |
| Cross-module: dispense failure rolls back charge **on a DB with charges** | Local 0 charges |
| Permission matrix per finance/clinical verify route | R06 |
| Health/ready DB down | R07 |
| SHA/M-Pesa sandbox contract | R11 — only when credentials exist |
| Open handles | R15 |

### After each approved batch

1. `./node_modules/.bin/jest --runInBand` in backend.
2. Relevant `ops/*-workflow-test.sh` **only** against non-prod.
3. Do not run destructive workflow tests on production.
4. Do not claim pass unless the command ran.

### Never

- New test runner
- Weaken auth to pass tests
- Seed demo in production
- Print PHI in test output

---

## 14. Migration and deployment safety plan

### Current pins (must remain)

- `synchronize: false`
- `TYPEORM_MIGRATIONS_RUN=false` unless a **named, approved** one-off says otherwise
- `AFYASASA_ALLOW_DEMO_SEED=false`

### Local vs production

| Change | Migration? | Deploy? | Now |
| --- | --- | --- | --- |
| Documentation-only (this pack) | No | No | Done in repo docs |
| Dirty TS/UI without schema | No | Yes, after review/test | **Wait** |
| `1771000000000` strength/form | Yes (additive) | Code that reads columns | **Wait** + empty-value backward compatible |
| `1771000000001` unique client_request_id | Yes | Code sending the key | **Wait** + duplicate scan |
| `1771000000002` blood_bank_requests | Yes | Blood bank UI | **Wait** |
| Payment unique index | Yes | Payment retry path | **Wait** |
| Batch unique index | Yes | Receipts | **Wait** |
| PermissionsGuard AND | No | Yes | **Wait** |
| `/ready` DB check | No | Yes | **Wait** |
| Flip migrate/seed flags | Config | Dangerous | **Forbidden** without plan |

### Backup

- Confirm **restorable** production backup **before** any prod SQL.
- Local `ops/backup-postgres.sh` uses `pg_dump --clean --if-exists` — appropriate for files, **dangerous if someone pipes restore to prod**.
- `ops/restore-postgres.sh` is **out of scope** unless disaster recovery is explicitly authorised.

### Rollback

- App-only deploy: redeploy previous image (prod images currently unknown — R01 first).
- Additive columns: leave in place if unused; do not DROP in panic.
- Unique indexes: drop index only if it blocks care **and** duplicates are understood — still needs approval.
- Never truncate clinical/finance tables as rollback.

---

## 15. User documentation gaps

| Audience | Gap |
| --- | --- |
| Front office | Diagnostic-only check-in (lab/imaging without doctor queue) — dirty UI, docs lag |
| Prescribers | Must pick catalogue `itemId`; strength/form may be blank until pharmacy fills products |
| Pharmacy | FEFO + charge expected; 2-item local catalogue is not hospital reality |
| Lab | Queue stages; amendment off; blood bank is **not** a full blood service |
| Radiology | Image URL/RadWeb field; shift handover experimental |
| Cashier | Initiate vs completed payment; M-Pesa not assumed live |
| Director | Dashboards uncertified; interop “not connected” |
| Engineering | Do not follow stale auto-migrate instructions |

Preserve existing useful docs; add this pack; do not delete the 15 Oct departmental audit.

---

## 16. Acceptance criteria (priority corrections)

### P0-A Production identity (R01)

- Read-only note of running image/commit/flags/health.
- No service restart.
- Drift table: prod vs `4a31826` vs dirty tree.

### P0-B Schema freeze (R02)

- Prod `TYPEORM_MIGRATIONS_RUN=false` confirmed or explicitly unknown.
- No `177100*` on production until duplicate/empty analysis + backup + approval.

### P1-A Finance/stock reconcile (R04)

- Query (redacted): count payments without charge, charges without payment, dispenses without charge.
- Written disposition per class (historical exception vs defect).
- No in-place overwrite of posted rows.

### P1-B Payment idempotency (R05)

- Zero conflicting duplicates **or** remapped.
- Additive unique constraint in a numbered migration.
- Jest: double-submit does not create two `completed` rows.

### P1-C Authorisation (R06, R10)

- Document OR vs intended AND per sensitive route.
- Insurance requires a non-`patients:read` API permission.
- Tests: 403 for wrong role on dispense, refund, lab verify, report verify.

### P1-D Ready check (R07)

- Unauthenticated `/health` may stay liveness-only.
- Readiness includes DB ping without PHI.

### P1-E Dirty clinical batch (optional, only if approved as one PR)

- Diagnostic visit routing keeps valid lab/rad-only visits off doctor queue.
- Prescriptions require unambiguous catalogue id.
- Unique `client_request_id` enforced where column exists.
- Blood bank labelled as laboratory request desk.
- Jest 385+ relevant new tests green; no OPD regression in `opd.service.spec` / visit-queue specs.

### P2-A Interop honesty (R11)

- SHA/FHIR/M-Pesa/QB status APIs do not report connected without evidence.
- No parallel patient table.

### P2-B Reporting (R14)

- Written definition for each Director metric used in decisions.
- SQL reconciliation sample on non-prod.

If any criterion requires production SQL or deploy, **stop for a separate change plan**.

---

## Stop point

Phase 0 discovery is complete in documentation.

**Waiting for approval before:** merging/committing the dirty tree, applying migrations, changing PermissionsGuard, adding `/ready`, production inspect beyond policy, or any other substantial product change.
