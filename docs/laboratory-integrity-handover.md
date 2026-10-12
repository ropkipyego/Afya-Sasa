# Laboratory integrity programme — operational handover

This document records **this hardening phase**. Production was not modified.

```
LIVE STACK CHANGED: NO
LIVE DATABASE CHANGED: NO
PRODUCTION MIGRATIONS APPLIED: NONE
PRODUCTION DEPLOYMENT PERFORMED: NO
```

**Not production-ready.** Open gates: clinical approvals, live duplicate audit, department-scoped report architecture, cancel/amend role grants, staging UAT against a dedicated API+DB.

## Status legend

implemented · tested · partially tested · blocked · awaiting clinical approval

## Architecture

```
Order (clinical-order / walk-in / LabWorklist)
  → lab_requests + lab_request_items (legacy test_id | catalogue orderable_test_id)
  → existing payments / charges (unchanged)
  → lab_samples (collect → receive/reject with recorded condition)
  → lab_results (draft → verify; amendment append-only when enabled)
  → lab_attachments (PDF; not a substitute for structured values)
  → GET /laboratory/requests/:id/report (HTML from stored rows + flags)
```

Request lock: `SELECT … FROM demo.lab_requests WHERE id = $1 FOR UPDATE` inside a TypeORM transaction around panel persist, verify, and cancel. Result writes use `UPDATE … WHERE verified_at IS NULL` and check `affected`.

## Workstream 1 — Schema (tested on isolated Postgres)

**Finding (fixed):** the first planned permission INSERT used non-existent columns `module`/`code`. Live permissions are `demo.permissions (resource, action, permission_key)` unique on `(resource, action)`.

Corrected files:

- `backend/src/database/sql/planned/20261012_lab_integrity_lifecycle.sql`
- `backend/src/database/sql/planned/20261012_lab_integrity_lifecycle.rollback.sql`
- Isolated fixture: `backend/src/laboratory/sql/lab-integrity-isolated-fixture.sql`

**Permission rows are not grants.** Planned SQL inserts `lab_results:amend` and `lab_requests:cancel` with `ON CONFLICT (resource, action) DO NOTHING` and does **not** insert `role_permissions`. Endpoints stay 403 until an administrator assigns them. Amendment also requires `AFYASASA_LAB_AMENDMENT_ENABLED=true` (pinned `false` in `.env.example`, `docker-compose.yml`, and `docker-compose.prod.yml`).

**Isolated DB evidence (12 Oct 2026):** throwaway `postgres:16` on host port **55432**, database `labtest`, **not** the compose `afyasasa` volume.

```
LAB_TEST_DATABASE_URL=postgresql://labtest:labtest@127.0.0.1:55432/labtest \
  npx jest --testPathPatterns=lab-pg.integration --runInBand --forceExit
→ 8 passed (includes synthetic duplicate-audit classification)
```

Covered: apply planned SQL; existing synthetic legacy + catalogue rows still readable; permissions inserted with zero role grants; rollback drops new columns and keeps legacy values.

**Unresolved migration risks**

- Deploying entity mappings before the SQL runs will fail SELECTs on new columns.
- Rollback DROPs amendment/rejection columns; do not roll back if those cells already hold retained clinical notes.
- Unique index on `(request_item_id, parameter_id)` remains **commented** for production. Isolated duplicate audit returned **zero** rows, then the index was created and a second insert was rejected. Live/dev snapshots were **not** queried. Do not auto-delete duplicates.

## Workstream 2 — PostgreSQL concurrency (tested)

Same isolated instance:

| Scenario | Result |
| --- | --- |
| Save vs verify (request `FOR UPDATE`, then `UPDATE … verified_at IS NULL`) | Save waited; after verify commit, save `rowCount=0`; stored value unchanged |
| Two concurrent draft updates | Serialized by row lock; last committed draft value persisted |
| Duplicate catalog insert after unique index | Unique violation |
| Partial multi-parameter insert + `1/0` | Rollback; leftover parameter row count 0 |
| Cancel vs verify | Cancel committed; verify `rowCount=0`; status `cancelled` with reason |
| Attachment after verify / rejected specimen | Status remains verified; rejection_reason stored |

Amendment-vs-verify on a live connection is **partially tested** (amendment remains disabled; unique/supersede behaviour covered by unit tests).

## Workstream 3 — Lifecycle and permissions (tested at guard/service; role admin awaiting grant)

- Transitions in `lab-lifecycle.ts` reject cancelled→processing and verified→resulted.
- Cancel/verify use conditional status updates plus request locks.
- `PermissionsGuard` tests: cancel, amend, report, and attachments denied without the exact key; `lab_results:enter` does not imply cancel.
- **Department-scoped reports: blocked.** JWT has no department ids; `user_departments` ≠ catalogue `lab_departments`. Structured report HTML is fail-closed (creator, verifying lab staff, or administrator).
- Audit writes actor, action, record id, afterJson (reason), endpoint; no tokens/passwords.

## Workstream 4 — Reports (tested)

`lab-report.builder.spec.ts`: HTML escape of names/values/comments; no second patient; unassessed vs normal vs critical CSS; incomplete panel banner; cancelled + amendment current row. Stored flags are printed; catalogue is not re-run. Layout is **awaiting clinical approval**.

## Workstream 5 — End-to-end (partially tested / blocked)

- API/SQL synthetic workflow: isolated PG graph (legacy + catalogue) **tested**.
- Playwright on isolated Vite `127.0.0.1:4174` with `AFYASASA_LAB_E2E=1` (proxy to `:3000` disabled) and a mocked `/api/v1` (never `:8080`). Config refuses `:8080`/`:3000`/`:5433`.
- `ops/onboarding-tests`: 5 passed (31.2s) — isolation, report flags/XSS/incomplete panel, synthetic workflow, cancel+report denial.
- Traces/videos: `ops/onboarding-tests/results/lab-e2e-output/`. Screenshots: `…/screenshots/` and per-test folders.
- This is **not** a live Nest/Postgres browser UAT. Staging still needs a dedicated synthetic API+DB.

## Workstream 6 — Regression (tested)

```
npx jest --no-coverage
→ 37 suites, 204 passed, 7 skipped (PG tests without LAB_TEST_DATABASE_URL)

npx nest build → passed
frontend npx tsc -b → passed
```

Mail, auth, and reporting tests in that full Jest run still passed. Unrelated dirty-tree files were not reverted.

## Permission and report access (this gate)

See `docs/laboratory-permission-matrix.md`. Cancel/amend remain ungranted. Structured reports are fail-closed: `lab_results:read` plus (request creator, `lab_results:verify`, or administrator/superadmin). Hospital `user_departments` cannot be joined to catalogue `lab_departments`.

Read-only duplicate audit: `backend/src/database/sql/planned/20261012_lab_duplicate_audit.read-only.sql`.

Isolated Playwright: `ops/onboarding-tests/playwright.lab.config.ts` on Vite `:4174` with mocked API. Refuses `:8080`/`:3000`/`:5433`.

## Remaining gaps

- Isolated Playwright UAT uses a mocked API on Vite `:4174` (not a live Nest/Postgres stack). Staging still needs a dedicated synthetic API+DB.
- Live duplicate audit before enabling the unique index.
- Clinical sign-off (ranges, critical limits, amendment notification, report layout).
- Department-scoped report access (policy unknown).
- `lab_requests:cancel` / `lab_results:amend` role assignment (must not be granted just to make a demo pass).

## Staging UAT (not executed)

1. Clone schema to a staging DB; apply planned SQL; keep `AFYASASA_LAB_AMENDMENT_ENABLED=false`.
2. Repeat the synthetic nine-step worklist in `docs/laboratory-integrity-handover.md` (previous section) with synthetic patients only.
3. Confirm cancel 403 for lab tech until the permission is assigned; 200 after a **named** role grant.
4. Print structured report; laboratory staff review layout.

## Production rollout (explicitly not executed)

1. Maintenance window. `TYPEORM_MIGRATIONS_RUN=false`.
2. Apply planned SQL only after staging UAT.
3. Deploy application code that maps the new columns.
4. Leave amendment flag false. Do not grant amend/cancel until policy exists.
5. Rollback file exists; dropping columns loses any new comments.

## How to re-run isolated PG tests

```
docker run -d --name afyasasa-lab-pg-test \
  -e POSTGRES_USER=labtest -e POSTGRES_PASSWORD=labtest -e POSTGRES_DB=labtest \
  -p 55432:5432 postgres:16
# wait until pg_isready
cd backend
LAB_TEST_DATABASE_URL=postgresql://labtest:labtest@127.0.0.1:55432/labtest \
  npm run test:lab-pg
docker rm -f afyasasa-lab-pg-test
```
