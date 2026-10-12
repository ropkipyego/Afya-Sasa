# Master hardening programme — working checklist

Session-only status. Not a production-ready declaration.

| Module | Status | Evidence / tests | Blockers / next |
| --- | --- | --- | --- |
| JWT tenant bind | tested (unit) | `tenant-bind.spec.ts` | Not multi-schema isolation. ORM still `schema:'demo'`. |
| Export authorization | tested (unit) | `exports.service.spec.ts` | Keep departmental keys. |
| M-Pesa STK contract + claim | tested (unit) | `mpesa-callback.contract.spec.ts`, `payments.mpesa-callback.spec.ts` | Daraja does not sign STK JSON. Optional `MPESA_CALLBACK_ALLOWED_IPS`. Unique index planned, not applied. No sandbox STK. |
| QuickBooks Web Connector | tested (unit) | `quickbooks-webconnector.service.spec.ts` | No live posting. |
| Charge uniqueness | implemented (migration exists) | `1770100000000` | Live apply-state unknown. Isolated PG not run (no localhost `LAB_TEST_DATABASE_URL`). |
| Payment external_reference unique | awaiting approval | planned SQL | Duplicate audit required. |
| Director dashboard | implemented | `/reports/executive-analytics`, `reporting-metrics.spec.ts` | Pharmacy aggregate unavailable. Staff-on-duty not shown. |
| Reports Centre | implemented | `/reports/catalogue` | Inventory/SHA claims/integration-failure reports unimplemented. |
| Control Center / staff directory | implemented | Control Center grouping, `lastLoginAt` | Last login is not on-duty. |
| Radiology lifecycle + report ACL | tested (unit) | `radiology-lifecycle.spec.ts`, `radiology-access.spec.ts` | Findings/attachments redacted without report permission. |
| Laboratory integrity | preserved | prior lab specs | Amendment off; unique result index disabled; cancel/amend ungranted. Isolated PG harness now refuses remote URLs. |
| Nursing MAR duplicate | tested (unit) | `nursing.mar.spec.ts` | Application-level only. |
| Bed occupancy claim | tested (unit) | `bed-occupancy.spec.ts` plus admit/transfer occupant check | Concurrent DB proof needs isolated Postgres. |
| SHA client timeout | tested (unit) | `sha.client.spec.ts` | No sandbox eligibility proof. |
| Email allowlist | tested (unit) | `mail.config.spec.ts` | Delivery disabled unless `EMAIL_DELIVERY_ENABLED=true`. Set `EMAIL_RECIPIENT_ALLOWLIST` in staging. |
| Backups / restore | blocked | `ops/restore-postgres.sh` refuses to run | Restore not tested. Do not claim reliability. |
