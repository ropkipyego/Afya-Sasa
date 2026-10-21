# 1–2. Verified current-state report and repository/deployment baseline

**Date:** 20 October 2026  
**Constraint:** no secrets, no patient-identifying data.

## A. Source code

| Item | Verified value | Evidence |
| --- | --- | --- |
| Directory | `/home/yobra/Desktop/Afya-Sasa-1/Afya-Sasa` | workspace |
| Branch | `main` tracking `origin/main` | `git status -sb` |
| HEAD | `4a31826e7a5ce3c853b8f63f8c517fd5ec04428e` message `documentation` | `git rev-parse HEAD` |
| Ahead/behind origin | not ahead | `## main...origin/main` |
| Working tree | **dirty — 56 paths** | `git status --short \| wc -l` |
| Package | `afyasasa` 1.1.0 | root `package.json` |
| Frontend | React/TypeScript, navigation in `frontend/src/lib/navigation.ts`, screens in `frontend/src/App.tsx`, **no React Router** | source |
| Backend | NestJS, global prefix `/api/v1` | conventions + health path |
| ORM | TypeORM `synchronize: false`; `migrationsRun` only if `TYPEORM_MIGRATIONS_RUN === 'true'` | `backend/src/app.module.ts` |
| Tenant | code `jalaram`; PostgreSQL schema still named `demo` | prior identity + `information_schema` |
| Stock/billing commit | `507cc02 drugs changes....` is **ancestor** of HEAD; do not redo blindly | `git log` |

### Recent commits (newest first)

```
4a31826 documentation
507cc02 drugs changes....
a75c2e4 Last Changes
5a00c8c mpesa
db8547b several changes in the system that are heavy
c5090e4 meaningfull changes
f37cff3 biometrics and sha  integration
f60429e hospital charges
```

### Uncommitted application work (preserve)

Do **not** discard. This is the live engineering baseline, not HEAD.

**Modified (examples):** clinical-order (controller, entities, module, mirror), inventory (controller, dto, entities, service + spec), laboratory (catalog, controller, module), OPD service, visit-queue controller, radiology dto/service, reporting.service, App.tsx, Lab/Imaging modules, Pharmacy workspace/products/prescription form, navigation, UI.

**Untracked:**

- Migrations `1771000000000-InventoryStrengthForm.ts`, `1771000000001-ClinicalOrderClientRequestId.ts`, `1771000000002-BloodBankRequests.ts`
- Prescription quantity helper + specs; clinical-order-mirror spec
- Blood-bank entities/service/spec; lab-work-areas
- OPD visit-routing + referral-details
- RadWeb image URL helper + spec
- Frontend BloodBankDesk, DiagnosticCheckInArrivals, ImagingShiftHandover, lib helpers

### Backend modules (`app.module.ts` imports)

Core, Mail, Realtime, Patients, Notifications, Opd, Appointments, Inpatient, Emergency, Nursing, Reporting, Theatre, Maternity, Icu, Hdu, Laboratory, Radiology, Storage, Referrals, Documents, Worklists, Workflow, Inventory, Marketing, Health, Payments, Sha, Fhir, Insurance, VisitQueue, Exports, Biometric.

Clinical orders live under inventory/pharmacy/clinical-order rather than a top-level AppModule import name; `ClinicalOrderModule` is wired via those domains (dirty tree includes `clinical-order.module.ts` edits).

### Frontend navigation groups (dirty `navigation.ts`)

Dashboard; Front Office; OPD Module; IPD Module; Laboratory (includes Blood Bank); Radiology; Specialty & Procedures (Emergency, Theatre, Maternity); Pharmacy & Supply; Procurement and Store; Finance; Documents & Reports; Marketing & Outreach; Management & Intelligence; Hospital Control Center (including Interoperability).

### Migrations in source

49 TypeORM migration files under `backend/src/database/migrations/`, of which **3 are untracked** (`177100*`). Committed series runs through `1770500000000-EmailDeliveryAndReportShare` and inventory/biometric/charges foundations. **Automatic production run remains disabled in compose.**

Historical docs such as `docs/contabo-deployment-guide.md` have previously mentioned `TYPEORM_MIGRATIONS_RUN=true`. **Compose files pin `false`.** Treat any guide that enables auto-migrate as stale and dangerous until rewritten.

### Feature flags (local running container `printenv`)

| Flag | Local container | Compose default |
| --- | --- | --- |
| `TYPEORM_MIGRATIONS_RUN` | `false` | `false` (`docker-compose.yml` and `docker-compose.prod.yml`) |
| `AFYASASA_ALLOW_DEMO_SEED` | `false` | `false` |
| `AFYASASA_CHARGES_ENABLED` | `true` | `true` |
| `AFYASASA_LAB_AMENDMENT_ENABLED` | `false` | `false` |
| `NODE_ENV` | `development` | — |

Production values were **not** read.

### Existing documentation (do not delete)

- `docs/audits/afyasasa-departmental-audit/` — 15 Oct departmental audit (stale counts)
- `docs/release/` — director packs and reconciliations (several marked superseded)
- `ops/backup-postgres.sh`, `ops/restore-postgres.sh`, workflow smoke scripts
- Deployment guides — **re-verify before following**

### Automated tests

- Framework: repository Jest via `backend/node_modules/.bin/jest` (do not introduce a second runner)
- 78 `*.spec.ts` files under `backend/src`
- **This audit command:** `cd backend && ./node_modules/.bin/jest --runInBand --coverage=false`
- **Result:** Test Suites 78 passed; Tests 385 passed, 20 skipped; Time ~10.2 s; **exit 0**
- **Limitation:** “Jest did not exit one second after the test run has completed” (open handles). Not treated as failed tests.
- Frontend `navigation.spec.ts` exists in dirty tree; **not executed** as a separate frontend suite this audit unless included elsewhere.

## B. Deployment

### Local Compose (inspected)

| Service | Status (20 Oct ~21:15 EAT) | Image |
| --- | --- | --- |
| backend | Up, healthy | `afya-sasa-backend` |
| frontend | Up, healthy | `afya-sasa-frontend` |
| nginx | Up, healthy | `nginx:1.27-alpine` |
| postgres | Up, healthy | `postgres:16` |
| redis | Up, healthy | `redis:7` |
| minio | Up, healthy | `minio/minio:latest` |

- API: `GET http://127.0.0.1:8080/api/v1/health` → **200** `{status:"ok",service:"afyasasa-backend"}`
- Database connectivity: **proven by read-only `psql` COUNT queries**, not by the health endpoint
- Local images: previously rebuilt from the **dirty working tree**, **not** from tagged commit `4a31826`

### Production

**Not inspected.** No SSH, no Contabo panel, no remote compose, no remote image digest, no remote `/health`, no backup listing.

| Question | Status |
| --- | --- |
| What versions are running? | **Unknown** |
| Do images match source commits? | **Unknown** — local already does not match HEAD |
| Container health | **Unknown** |
| API health | **Unknown** |
| DB connectivity | **Unknown** |
| Application logs | **Not pulled** (would risk PHI) |
| Backup status | **Unknown** (local script `ops/backup-postgres.sh` exists; dumps with `--clean --if-exists` to `backups/`) |
| Deployment drift | **Assumed possible; not measured** |

Do not restart or alter production to complete discovery.

## C. Database (local, read-only)

**Connection:** `docker compose exec postgres psql` user/db `afyasasa`, schema `demo`.  
**Operations:** `COUNT(*)`, `pg_indexes`, `information_schema.columns` only. No DML, no truncate, no migrate.

### Aggregate counts (exact, not `pg_stat` estimates)

| Table | COUNT(*) |
| --- | --- |
| patients | 26 |
| encounters | 75 |
| admissions | 21 |
| appointments | 15 |
| users | 18 |
| clinical_orders | 25 |
| lab_requests | 14 |
| radiology_requests | 9 |
| inventory_items | 2 |
| inventory_batches | 13 |
| inventory_transactions | 66 |
| charges | **0** |
| payment_transactions | **2** (both `completed`) |
| visit_queue_items | 2 |
| audit_logs | 88 305 |
| blood_bank_requests | 0 |

Interpretation: this is **not** a full hospital production census. Either this Compose volume is a reduced/dev dataset, or production was never this database. `pg_stat_user_tables` estimates were previously **wrong** (patients not in top tables; charges/payments/items estimated 0). Always use `COUNT(*)` for integrity work.

### Constraints observed (subset)

| Object | Note |
| --- | --- |
| `patients_patient_no_key` | unique patient number |
| `clinical_orders_order_no_key` | unique order number |
| `uq_clinical_orders_client_request_id` | **present locally** (dirty migration 1771000000001) |
| `inventory_items_sku_key` | unique SKU |
| `uq_charges_service_entity_active` | unique active charge per service entity **in DB**; 0 rows so unused locally |
| payment_transactions | **pkey + non-unique indexes only** — no unique receipt/idempotency index observed |
| inventory_batches | pkey + `idx_inventory_batches_item_location` — **no unique (item, batch, location) index listed** |

### Columns present locally from uncommitted work

- `inventory_items.strength`, `dosage_form`, `drug_class`
- `clinical_orders.client_request_id`
- `blood_bank_requests` table exists (0 rows)

**Production schema was not compared.** Applying `177100*` without a reviewed plan is forbidden.

### Authoritative tables (application source of truth — local schema)

See `03-data-model-security-interop.md` for the map. Summary: do **not** create parallel patient, encounter, charge, payment, stock, or GL tables. QuickBooks, if used, is an **external** accounting sink, not a second EMR ledger.
