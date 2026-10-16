# Evidence and verification log

## Commands and inspections this audit (read-only)

Earlier session captured git identity, compose health, and `/api/v1/health`. This continuation **did not** re-run docker, Jest, migrations, or logins. It wrote documentation only.

| Action | Result | Limitation |
| --- | --- | --- |
| Git HEAD (prior) | `507cc02` *drugs changes....* 2026-10-14 17:25 +0300, `main`, clean tree | Not re-queried this continuation |
| `docker ps` (prior) | frontend, backend, nginx, postgres, redis, minio healthy | Local only |
| `GET /api/v1/health` (prior) | `{"status":"ok","service":"afyasasa-backend"}` | Not production |
| Image created-at (prior) | 2026-10-14T08:39Z — before HEAD | Running local ≠ source HEAD |
| Jest this audit | **Not executed** | Use 14 Oct log only |
| Production | **Not accessed** | Version unknown |
| PHI / dispense / pay / email / SMS | **Not performed** | |

## Prior test evidence (not this audit)

File: `docs/release/2026-10-14-test-evidence.log`

| Command | Environment | Result |
| --- | --- | --- |
| `npx jest --testPathPatterns=inventory-pg.integration --runInBand --forceExit` | disposable `inventory_it` on 127.0.0.1:55434 | 12 passed; miniature schema |
| `npx jest --testPathPatterns=lab-pg.integration --runInBand --forceExit` | disposable `lab_it` :55435 | 10 passed; miniature schema |
| `npx jest --runInBand --forceExit` | backend cwd; mocks for mail/QB | **71 suites, 380 tests passed**, 0 failed |
| `npx tsc -b` frontend | local | exit 0 |
| `npx tsc --noEmit` backend | local including specs | exit 0 |

Tree at that Jest run: **dirty** `a75c2e4`; then committed as `507cc02`. Mail warnings: `NOT_CONFIGURED`, allowlist, DEGRADED/FAILED then a later accepted mock. QBWC: credentials not configured.

**External services:** SMTP/QB mocked or rejected; PG integration used disposable DBs, not hospital data.

## Test inventory by area (definitions exist; 15 Oct execution = none)

| Area | Representative specs |
| --- | --- |
| OPD | `backend/src/opd/opd.service.spec.ts` |
| Patients | `patients.service.spec.ts` |
| Pharmacy Rx | `clinical-order` `pharmacy-prescription.spec.ts` |
| Inventory | `inventory.service.spec.ts`, `stock-posting.spec.ts`, `stock-integrity.spec.ts`, `inventory-pg.integration.spec.ts` |
| Payments | `payments.service.spec.ts`, `payment-integrity.spec.ts`, mpesa-callback specs, hospital-charges, qbwc |
| Lab | `lab-lifecycle.spec.ts`, `lab-result-engine.spec.ts`, `laboratory.barcode.spec.ts`, `lab-access.spec.ts`, `lab-pg.integration.spec.ts` |
| Radiology | `radiology-lifecycle.spec.ts`, `radiology-access.spec.ts` |
| IPD | `inpatient.service.spec.ts`, `bed-occupancy.spec.ts` |
| Nursing | `nursing.mar.spec.ts` |
| ED | `emergency.service.spec.ts` |
| Theatre | `theatre.service.spec.ts`, `theatre-notes.spec.ts` |
| Reporting | `reporting-metrics.spec.ts`, `report-delivery.service.spec.ts`, `moh-mapping.spec.ts` |
| Auth | fixtures in 14 Oct log AUTH_REQUIRED / AUTH_FORBIDDEN |
| Mail | mail service specs (delivery not live) |

`ops/pharmacy-workflow-test.sh` cited in August 2026 gap matrix: **not run**.

## API prefixes (source `@Controller`)

All under `/api/v1` except as noted.

`auth`, `admin`, `admin/email`, `patients`, `opd`, `appointments`, `inpatient`, `emergency`, `nursing`, `icu`, `hdu`, `laboratory`, `laboratory/catalog`, `radiology`, `theatre`, `maternity`, `clinical-orders`, `inventory`, `payments/*` (controller `@Controller()`), `reports`, `exports`, `documents`, `storage`, `referrals`, `queue`, `worklists`, `marketing`, `notifications`, `biometrics`, `sha`, `integrations/fhir`, `insurance`, `platform/tenants`, `health`.

## Principal entities / tables (schema name still `demo`)

patients, encounters, consultations, clinical_orders (+ lines), lab_requests, lab_request_items, lab_samples, lab_results, radiology_requests, admissions, beds, emergency_encounters, inventory_items, inventory_batches, inventory_locations, inventory_transactions, charges, payment_transactions, audit_logs, appointments, users/roles (admin).

## Status classification basis

| Status | Basis used |
| --- | --- |
| IPV | Source + named tests and/or user report; no logged-in UAT this audit |
| PI | Essential step missing (device, live HIE, unapplied SQL, mapping-only) |
| BD | Lab amend flag off — workflow cannot run under current policy |
| CU | Email UI/config; live delivery unproven |
| NI | Blood bank absent |
| U | Pharmacy sales view not inspected in UI this audit |
| VO | None of the 102 features (would require exercised workflow) |

## Stale documents not used as current truth

- `docs/core-workflow-gap-matrix.md` (2026-08-28) claimed missing STOCK_TAKE, unwired ICU, unbuilt FHIR. **Contradicted** by current `App.tsx`, `IcuModule`, `FhirController`, stock-take workspace.

## Related director pack (separate from this audit)

`docs/release/2026-10-14-director-audit-pack.md`, `2026-10-14-stock-integrity.md`, `2026-10-14-release-reconciliation.md`.

## Unresolved questions

1. Exact staff-facing symptoms of PH-R1 (error text, wrong drug, stock not moving, double charge).
2. Whether production Contabo is on `507cc02` or an older image.
3. Whether hospital `inventory_batches` has duplicate lots (planned read-only SQL must use a real snapshot).
4. Whether SMTP is configured in production.
5. Whether SHA/M-Pesa/QB credentials exist in production (not inspected; do not dump).
6. Lab template clinical sign-off status in operations (register exists as a process doc).

## Confirmation

Documentation written under `docs/audits/afyasasa-departmental-audit/` only. No application, database, migration, seed, container, deploy, commit, or configuration change in this task.
