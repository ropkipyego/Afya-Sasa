# AfyaSasa security audit

Inspection date: 2 October 2026.

Backend authorization is mandatory. Frontend nav hiding is not a security control.

## Authentication

| Control | Implementation | Status |
| --- | --- | --- |
| Password login | bcrypt via auth service | WORKING |
| Access JWT | Bearer, verified by `JwtAccessGuard` | WORKING |
| Refresh | httpOnly cookie + optional body token | WORKING |
| Session inactivity | `TokenRevocationService` + `/auth/activity` | WORKING |
| Logout / logout-all | revokes refresh / all sessions | WORKING |
| Force password change | user flag | WORKING |
| Login throttle | ThrottlerGuard on login/refresh/forgot/reset | WORKING |
| Lockout | exists (do not unlock accounts in this pass) | WORKING |
| Public routes | hospitals list, session-policy, login, health, patient QR scan, M-Pesa callback | REVIEW |

## Authorization

`PermissionsGuard` requires **any one** of the listed `@RequirePermissions` values.

Role examples in live Jalaram users: administrator, superadmin, doctor, nurse, lab_technician, radiology_technician, records_officer.

| Role intent | Backend enforcement |
| --- | --- |
| Doctor | `consultations:*`, doctor queue now scoped to assigned/unassigned |
| Nurse | nursing + ward permissions |
| Lab / Radiology | lab_* / radiology_* |
| Pharmacy | inventory / clinical-order pharmacy |
| Cashier | payments:* |
| Administrator | users, settings, reports as assigned |
| Superadmin | technical admin; hospital admin cannot assign superadmin |
| Director | administrator role on this tenant (email director@…) plus reports |

Fixed this pass: `GET /opd/doctor/queue` no longer returns other doctors' assigned patients.

Remaining: `GET /opd/encounters?doctorId=` is not supervisor-gated. Consultation PATCH does not check assigned doctor.

## Session / CSRF / CORS / headers

- Refresh cookie is the CSRF-relevant surface; review cookie SameSite in production env before internet exposure
- CORS comes from Nest config / nginx; do not loosen to `*`
- nginx terminates HTTP on :8080 in this compose; TLS is an infrastructure decision
- Security headers should be confirmed on the live nginx server block (not assumed)

## Input / injection / XSS

- TypeORM parameterized queries for repository access
- class-validator DTOs on write endpoints
- React frontend default escaping; do not introduce `dangerouslySetInnerHTML` for clinical notes
- File upload goes through `/storage/upload` to MinIO — keep type/size checks server-side

## Secrets

- `.env` on server only
- Compose injects DB/Redis/MinIO/SHA vars into backend
- Frontend must never receive database credentials
- Audit sanitizer strips sensitive payload fields
- Do not print SHA client secret or DB password in logs or these docs

## Data stores

| Store | Access | Note |
| --- | --- | --- |
| PostgreSQL | backend only | host port 5433 on this machine |
| Redis | backend only | session / cache; host 6380 |
| MinIO | backend + nginx /minio | clinical files |
| Browser | JWT access in memory/store, refresh cookie, user profile JSON in localStorage | do not put consent tokens here |

## Audit

`AuditInterceptor` writes `demo.audit_logs` (86,105 rows). Table is append-only via trigger. Captures user, action, record, before/after JSON, IP, user agent, session, endpoint, HTTP code.

Gaps vs requested model: no first-class correlation ID; GET reads are audited (noisy); old/new clinical field-level diff is request/response JSON, not a loaded entity snapshot.

## Rate limit / public callbacks

M-Pesa callback is `@Public()`. Confirm Daraja IP/signature validation before treating production callbacks as trusted money.

## System health exposure

`GET /health` is public and only says the process is up.  
`GET /admin/system-health` is permission-gated and is the correct place for Redis/MinIO/queue detail. Do not put connection strings in that payload.

## Findings

| Severity | Finding | Action |
| --- | --- | --- |
| High (fixed) | Doctor queue leaked other doctors' assigned encounters | Backend filter shipped this pass |
| Medium | Encounters list accepts arbitrary doctorId | Do not expand; fix in a later minimal patch |
| Medium | Public M-Pesa callback | Confirm official validation |
| Medium | SHA/DHA not connected | Do not fake success |
| Low | Health is liveness only | Acceptable if admin health stays gated |
| Low | localStorage user profile | Contains roles, not tokens if purgeLegacyTokens ran |

No password resets were performed. Existing live accounts were not unlocked.
