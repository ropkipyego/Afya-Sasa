# AfyaSasa release reconciliation — 14 October 2026

**Superseded for test counts and working-tree status.** Use [`2026-10-14-director-audit-pack.md`](./2026-10-14-director-audit-pack.md). This file recorded HEAD `a75c2e4` when the tree was still clean; the tree is now dirty.

**Decision: BLOCKED** for production promotion of `a75c2e4`.

This is a source/test/schema reconciliation. It is not a deployment, not a migration, and not clinical UAT.

```
LIVE STACK CHANGED: NO
LIVE DATABASE CHANGED: NO
PRODUCTION SQL EXECUTED: NO
PRODUCTION MIGRATIONS APPLIED: NONE
PRODUCTION DEPLOYMENT PERFORMED: NO
COMMITS/PUSHES THIS TASK: NONE
TYPEORM_MIGRATIONS_RUN: false (compose-pinned local; prod compose also pins false)
AFYASASA_ALLOW_DEMO_SEED: false
AFYASASA_LAB_AMENDMENT_ENABLED: false
EMAIL_DELIVERY_ENABLED: false (local container)
AUTH_MFA_OTP_ENABLED: false (local container)
```

ClinicFlow and the HR module were not inspected for change and were not modified.

---

## 1. Source and commit identity

| Item | Evidence |
| --- | --- |
| Branch | `main` tracking `origin/main` (`https://github.com/ropkipyego/Afya-Sasa.git`) |
| HEAD | `a75c2e46fbce16e0d4f96c82b4c02d667faca01b` (`a75c2e4`) — *Last Changes* — 2026-10-14 11:46:57 +0300 |
| Working tree | Clean. No staged, unstaged, or untracked files. No stash. |
| Ahead/behind origin | `0 0` — GitHub `main` matches local HEAD |
| Claimed production RC | `5a00c8c` (*mpesa*) — parent of HEAD |
| Delta vs claimed production RC | 12 files, +220 / −46, **only** commit `a75c2e4` |

`a75c2e4` contents (entire delta vs `5a00c8c`):

- `backend/src/reporting/reporting.service.ts`
- `backend/src/reporting/reporting-metrics.ts`
- `backend/src/reporting/reporting-metrics.spec.ts`
- `backend/src/laboratory/laboratory.service.ts`
- `backend/src/laboratory/laboratory.integrity.spec.ts`
- `backend/src/inventory/inventory.service.spec.ts`
- `backend/src/core/admin/role-templates.spec.ts`
- `frontend/src/lib/navigation.ts`
- `frontend/src/lib/navigation.spec.ts`
- `frontend/src/lib/nav-module-filter.ts`
- `frontend/src/lib/hospital-configuration.ts`
- `docs/hospital-ux-access-ops-handover.md`

`docs/hospital-ux-access-ops-handover.md` still says work was uncommitted. That sentence is **stale**; the 12-file set is now `a75c2e4` on GitHub.

**Do not treat GitHub `main` as the running production image.** Compose builds from `./backend` and `./frontend` with tags `latest`. Dockerfiles do not embed a git SHA. This session did not SSH to production or inspect production image IDs.

### Local Docker (not production)

| Image | ID (short) | Created |
| --- | --- | --- |
| `afya-sasa-backend:latest` | `a7190fd6fb70` | 2026-10-14 11:39:11 +0300 |
| `afya-sasa-frontend:latest` | `3f47fce3d077` | 2026-10-14 11:39:48 +0300 |

Those images were rebuilt from the same 12-file working tree **before** the 11:46 git commit. Local containers were healthy at reconciliation time. That is **local** evidence only.

Pinned in local `afya-sasa-backend-1`:

- `TYPEORM_MIGRATIONS_RUN=false`
- `AFYASASA_ALLOW_DEMO_SEED=false`
- `AFYASASA_LAB_AMENDMENT_ENABLED=false`
- `AFYASASA_CHARGES_ENABLED=true`
- `AUTH_MFA_OTP_ENABLED=false`
- `EMAIL_DELIVERY_ENABLED=false`

`docker-compose.yml` and `docker-compose.prod.yml` hard-pin the first three plus charges. Rebuild cannot turn migrations or lab amendment on from a stray `.env` value for those keys.

---

## 2. Local tests run this session

Command (backend, outside sandbox, in-band):

```bash
cd backend && npx jest --runInBand --testPathPatterns='laboratory.integrity.spec|laboratory.results-safety.spec|lab-access.spec|lab-lifecycle.spec|inventory.service.spec|inventory-import-match.spec|reporting-metrics.spec|role-templates.spec|module-visibility.spec|opd.service.spec|director-access.spec|mpesa-callback|payment-integrity.spec'
```

**Result: 13 suites, 77 tests, all passed (4.087 s).** Tests were not edited to obtain the pass.

Covered in that run:

- Lab reject/cancel reasons, amendment flag-off, no template grant of amend/cancel, duplicate active-result refusal, lifecycle transitions, report fail-closed access helpers
- Pharmacy `confirm: false` does not start a stock transaction
- Stock-take CSV header aliasing (not a live post)
- Director `swallowQueryFailure` unit behaviour
- Doctor queue isolation (Doctor A vs B vs admin)
- M-Pesa callback amount match / parse contract
- Payment integrity helpers
- Module API permission keys for Director / cashier / refunds

Frontend:

```bash
cd frontend && npx tsc -b --pretty false
```

**Result: exit 0.** `frontend/src/lib/navigation.spec.ts` exists but the frontend package has **no Jest/Vitest runner**, so those nav group assertions were not executed by a test harness. Nav groups were observed in the local browser (`http://localhost:8080`) for an already-signed-in superadmin/administrator session.

Not run this session: full `backend` Jest corpus, Playwright, `test:lab-pg` isolated Postgres, restore drills, live Daraja, live SMTP, production health.

---

## 3. Local schema evidence (Docker volume `postgres-data`, schema `demo`)

Present:

- `lab_results.result_comment`, `supersedes_id`, `amendment_reason`, `verified_at`
- `lab_samples.rejection_reason`
- Index `idx_lab_results_supersedes` (not a uniqueness constraint)
- Permission rows `lab_results:amend`, `lab_requests:cancel` with **0** `role_permissions` grants

Absent on **this local** volume:

- `lab_requests.verified_at`
- `radiology_requests.verified_at`

That absence is why Director **Lab TAT** showed “Data unavailable” locally after `a75c2e4`. The dashboard still returned HTTP 200 because TAT queries are wrapped in `swallowQueryFailure`.

**Prior programme claim (not re-run against production this session):** production already had `demo.lab_results.result_comment`, `supersedes_id`, `amendment_reason` and `demo.lab_samples.rejection_reason`. Treat as **unconfirmed until a production read-only query**.

Planned SQL exists and was **not** applied to production:

- `backend/src/database/sql/planned/20261012_lab_integrity_lifecycle.sql` (additive columns + permission INSERT; unique index commented)
- `backend/src/database/sql/planned/20261012_lab_duplicate_audit.read-only.sql`
- Other planned files: biometric finger position, charges unique, payment external reference unique, insurance claim workspace

Do not apply planned SQL because a file exists. Do not create the unique lab-result index until a reviewed duplicate audit returns zero conflicting active rows.

---

## 4. Feature reconciliation matrix

Statuses used only as specified. **VERIFIED IN LIVE WORKFLOW** is unused: no production clinical, pharmacy, or cashier transaction was executed.

| Feature | Entry points | Source | Local tests | Schema / flags / perms | Proposed image (`a75c2e4` build) | Production runtime | Status | Blocker / safest next |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Director dashboard / executive analytics / intelligence | `ReportingController` `/reports/executive-analytics`, `/reports/intelligence`; `ExecutiveAnalyticsDashboard.tsx` | `5a00c8c` + `a75c2e4` swallow wrappers | reporting-metrics.spec; local HTTP 200 after rebuild | Optional `lab_requests.verified_at` / `radiology_requests.verified_at` for TAT only | Yes, if rebuilt from HEAD | **Not verified on production.** Prior failure mode was missing TAT columns crashing Promise.all. | VERIFIED IN LOCAL TESTS; NOT YET VERIFIED in production | Read-only prod confirm of running image; then authorized backend rebuild of `a75c2e4` without SQL |
| Nav groups (FO, OPD, IPD, Diagnostics, Specialty, Pharmacy, Procurement and Store, Finance, Documents) | `frontend/src/lib/navigation.ts`, `nav-module-filter.ts` | `a75c2e4` | Observed local UI; spec file not harnessed | Menu hide ≠ API auth | Yes (frontend image) | NOT YET VERIFIED | VERIFIED IN LOCAL SOURCE | Rebuild frontend; check one role of each template |
| Role templates | `backend/src/core/admin/role-templates.ts` | earlier commits; spec in `a75c2e4` | role-templates.spec: no amend/cancel, no superadmin | Live grants are `role_permissions`, not templates | Yes | NOT YET VERIFIED | VERIFIED IN LOCAL TESTS | Do not auto-grant lab cancel/amend |
| Registration / encounters / triage / doctor queue | `/patients`, `/opd`, App screens | `5a00c8c` and earlier | opd.service.spec doctor isolation | `patients`, `encounters` | Same as 5a00c8c | NOT YET VERIFIED | VERIFIED IN LOCAL TESTS (queue isolation only) | Live doctor A/B UAT still outstanding |
| Admissions / ICU / HDU / nursing | IPD/ICU/HDU/Nursing nav + inpatient APIs | pre-`a75c2e4` | not re-run | admissions/beds | Same as 5a00c8c | NOT YET VERIFIED | VERIFIED IN LOCAL SOURCE | Ward UAT |
| Clinical documents / sick sheets / referrals | OPD nav + document modules | grouping in `a75c2e4`; screens older | not re-run | existing tables | Yes | NOT YET VERIFIED | VERIFIED IN LOCAL SOURCE | Print UAT |
| Lab request → collect → enter → verify | `LaboratoryService`, Lab module | pre-`a75c2e4`; duplicate-active check in `a75c2e4` | integrity + results-safety + lifecycle | `lab_*`; amendment flag false | Yes | NOT YET VERIFIED | VERIFIED IN LOCAL TESTS | Do not run live amendments |
| Specimen rejection reason | `receiveSample` | pre-`a75c2e4` | integrity.spec | `lab_samples.rejection_reason` | Yes | BLOCKED BY SCHEMA until prod columns reconfirmed | VERIFIED IN LOCAL TESTS | Production information_schema query below |
| Request cancellation | `cancelRequest` | pre-`a75c2e4` | integrity.spec 403 without `lab_requests:cancel` | permission row ≠ grant | Yes | BLOCKED BY PERMISSIONS (intentionally) | VERIFIED IN LOCAL TESTS | Leave ungranted until policy |
| Result amendment | `amendResult` | pre-`a75c2e4` | flag-off + missing perm | `AFYASASA_LAB_AMENDMENT_ENABLED=false`; 0 grants | Yes, **disabled** | BLOCKED BY CONFIGURATION/INTEGRATION and PERMISSIONS | VERIFIED IN LOCAL TESTS | Do not enable |
| Duplicate active results | `enterResult` active-set check | `a75c2e4` | integrity.spec | No unique index (correct) | Yes | NOT YET VERIFIED; unique index BLOCKED BY SCHEMA pending audit | VERIFIED IN LOCAL TESTS | Run read-only duplicate audit on a copy or approved prod read |
| Lab department-scoped reports | `lab-access.ts` | documented | fail-closed helper tests | JWT has no department ids | Same | BLOCKED BY CONFIGURATION/INTEGRATION (no mapping) | VERIFIED IN LOCAL SOURCE | Do not invent department join |
| Radiology | Imaging module | pre-`a75c2e4` | not in this 77-test set | `radiology_*`; local missing `verified_at` | Same as 5a00c8c | NOT YET VERIFIED | VERIFIED IN LOCAL SOURCE | TAT swallow only in `a75c2e4` |
| Pharmacy Rx / dispense / confirm | `PharmacyWorkspace`, `dispensePrescription` | pre-`a75c2e4`; confirm test in `a75c2e4` | confirm:false unit test | PHARMACY location vs store | Same | NOT YET VERIFIED | VERIFIED IN LOCAL TESTS | Do not test real dispensing |
| Stock deduct vs cashier charge | `recordDispenseCharge` after txn commit | pre-`a75c2e4` | **no compensating-txn test** | existing `charges` | Same | Known risk | NOT YET VERIFIED | Accept: stock can persist if charge insert fails |
| Stock-take preview vs confirm | `importCatalog` `previewOnly` / `confirmStockTake`; `/inventory/items/import` preview | pre-`a75c2e4` | CSV mapping tests only, **not** confirm-post | inventory_* | Same | NOT YET VERIFIED | VERIFIED IN LOCAL SOURCE | Do not post a live stock take |
| Store requisitions / transfers / receipt | `InventoryModule` under Procurement group | nav `a75c2e4`; APIs older | not re-run | inventory_* | Yes | NOT YET VERIFIED | VERIFIED IN LOCAL SOURCE | Store officer UAT |
| Cashier / SHA / insurance | PaymentDesk, SHA eligibility | pre-`a75c2e4` | payment-integrity in this run | charges + payment_transactions; SHA portal for claims | Same | NOT YET VERIFIED | VERIFIED IN LOCAL SOURCE | Claims remain portal.sha.go.ke |
| M-Pesa | `mpesa-callback.contract.ts`, payments.service | `5a00c8c` | mpesa-callback specs passed | empty production IP allowlist fail-closed unless `MPESA_CALLBACK_REQUIRE_IP_ALLOWLIST=false`; no X-Forwarded-For | Same as 5a00c8c | NOT YET VERIFIED live callback | BLOCKED BY CONFIGURATION/INTEGRATION until Daraja + allowlist evidenced | Confirm prod `MPESA_CALLBACK_ALLOWED_IPS` without changing it |
| Inpatient billing | accommodation scheduler (local logs generated=0 skipped=147) | pre-`a75c2e4` | not in this set | charges | Same | NOT YET VERIFIED | VERIFIED IN LOCAL SOURCE | Do not invent accommodation amounts |
| Email / password reset | mail + auth | pre-`a75c2e4` | mail.policy.spec not in this 77 | `EMAIL_DELIVERY_ENABLED=false` | Same | BLOCKED BY CONFIGURATION/INTEGRATION | VERIFIED IN LOCAL SOURCE | Keep delivery off until mailbox UAT |
| Biometrics | planned SQL / prior changelog | older | not this run | additive biometric tables claimed 2 Oct 2026 changelog | Same | NOT YET VERIFIED | NOT YET VERIFIED | Device status Director: NOT_VERIFIED locally |
| FHIR / KHIS | Interop workspace | mapping only | not this run | no sandbox | Same | BLOCKED BY CONFIGURATION/INTEGRATION | VERIFIED IN LOCAL SOURCE | Mapping ≠ submission |
| Audit / permissions guard | PermissionsGuard | older | module-visibility.spec | JWT permissions | Same | NOT YET VERIFIED live | VERIFIED IN LOCAL TESTS | Menu is not a security boundary |

---

## 5. Production schema / config / permission differences

**This session has no fresh production query results.** Distinguish:

| Claim | Evidence class |
| --- | --- |
| Production RC is `5a00c8c` | Prior operator statement. **Not** confirmed by image ID this session. |
| Production has lab integrity columns | Prior programme statement. **Not** re-queried. |
| Production `TYPEORM_MIGRATIONS_RUN=false` and lab amendment false | Present in `docker-compose.prod.yml` in git. Runtime env on the VPS **not** inspected. |
| Permission rows vs grants | Local: rows exist, grants = 0. Production grants **unknown**. |
| Unique lab index | Local: **not** present. Must not be created until duplicate audit. |

### Read-only queries to run on production later (do not execute from this task)

Image / compose identity (host shell, read-only):

```bash
docker inspect afya-sasa-backend --format '{{.Id}} {{.Created}} {{.Config.Image}}'
docker inspect afya-sasa-frontend --format '{{.Id}} {{.Created}} {{.Config.Image}}'
docker exec afya-sasa-backend-1 printenv TYPEORM_MIGRATIONS_RUN AFYASASA_ALLOW_DEMO_SEED AFYASASA_LAB_AMENDMENT_ENABLED EMAIL_DELIVERY_ENABLED AUTH_MFA_OTP_ENABLED NODE_ENV
```

Schema (Postgres, SELECT only):

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'demo'
  AND (
    (table_name = 'lab_results' AND column_name IN ('result_comment','supersedes_id','amendment_reason','verified_at'))
    OR (table_name = 'lab_samples' AND column_name = 'rejection_reason')
    OR (table_name = 'lab_requests' AND column_name IN ('verified_at','cancellation_reason'))
    OR (table_name = 'radiology_requests' AND column_name = 'verified_at')
  )
ORDER BY 1, 2;

SELECT indexname FROM pg_indexes
WHERE schemaname = 'demo' AND tablename IN ('lab_results','lab_samples');

SELECT p.permission_key,
       (SELECT count(*) FROM demo.role_permissions rp WHERE rp.permission_id = p.id) AS role_grants
FROM demo.permissions p
WHERE p.permission_key IN ('lab_results:amend','lab_requests:cancel');
```

Duplicate audit: use `backend/src/database/sql/planned/20261012_lab_duplicate_audit.read-only.sql` on an approved replica or with explicit hospital authorisation. **No UPDATE/DELETE/INDEX.**

---

## 6. Risks

**Clinical**

- Enabling amendment or cancel without policy and grants.
- Unique index on live duplicates would block result entry.
- Lab department isolation is fail-closed HTML, not a mapped department ACL.
- Director TAT “unavailable” can be mistaken for zero turnaround.

**Financial**

- Dispense stock commits, then `upsertPharmacyCharge`. Charge failure leaves stock moved without a matching charge. No second ledger was added.
- QuickBooks is not the EMR cashier ledger. Director finance is operational charges/collections.
- M-Pesa: unsigned Daraja JSON; production empty IP allowlist is fail-closed in code; live STK not verified here.
- Planned unique indexes on charges/payment references are **not** applied.

**Security**

- Menu grouping is not authorisation.
- Email delivery and MFA OTP remain off locally; unknown on production runtime.
- `AUTH_COOKIE_SECURE` must be true behind HTTPS (compose template defaults false for local HTTP).

**Deployment**

- Promoting `a75c2e4` is a **backend+frontend rebuild only**. Postgres/Redis/MinIO must stay up. `TYPEORM_MIGRATIONS_RUN` must stay false.
- Local images are not production images.
- Rollback is restart previous image tags; those tags are `latest`, so previous digests must be recorded **before** rebuild.

---

## 7. Minimal ordered release checklist (after BLOCKED items are cleared)

1. **Read-only** production image ID, created time, and the four `printenv` flags. Record backend/frontend digests.
2. **Read-only** production `information_schema` + permission grant counts (queries above).
3. If lab integrity columns are missing: **stop**. Do not rebuild entities that SELECT them until an authorised additive SQL review. Do not run TypeORM migrations.
4. If columns are present and flags remain false: authorised `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build backend frontend` **only**. Do not recreate volumes.
5. Verify: `/api/v1/health` 200; Director dashboard loads without “Unable to load”; OPD/IPD/Procurement groups; Laboratory worklist opens; Pharmacy queue opens; Cashier opens. **No live dispense, stock-take post, result amendment, or payment.**
6. Confirm `lab_results:amend` / `lab_requests:cancel` still have zero role grants unless hospital signed a grant.
7. Rollback: start the recorded previous image digests; do not apply rollback SQL that DROPs amendment columns if any notes exist.

---

## 8. Decision

**BLOCKED.**

Reasons (all required; none is a wording issue):

1. Production image/commit identity was **not** verified this session. GitHub `main` = `a75c2e4` is not evidence that Contabo is running it.
2. Production schema and role grants were **not** re-queried. Entity SELECTs on amendment columns can fail if the prior column claim is wrong.
3. No critical live workflow (register, consult, verify lab, dispense, pay) was verified on production. Local HTTP 200 and unit tests are not live verification.
4. Duplicate audit has not been run on production, so a uniqueness constraint remains forbidden.
5. Amendment, email delivery, MFA, SHA claims, FHIR, and M-Pesa live callbacks remain configuration/integration gated.

After steps 1–2 of the checklist, the **12-file delta** may be reconsidered as **READY WITH EXPLICITLY ACCEPTED LIMITATIONS**: code-only rebuild, amendment off, no unique index, no role grants, known stock-then-charge risk, TAT may display unavailable, no live UAT of money or medicines.

**Single safest next action:** on the production host, run only the read-only `docker inspect` / `printenv` and `information_schema` queries above. Do not rebuild, migrate, or grant permissions until those results are reviewed.
