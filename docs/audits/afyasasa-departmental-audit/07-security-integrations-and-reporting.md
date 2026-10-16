# Security, integrations, and reporting

## Authentication and authorisation

| Layer | Implementation |
| --- | --- |
| Login | `AuthController` `/auth` — JWT access + refresh cookie |
| Default | Global `JwtAccessGuard` + `PermissionsGuard` (`backend/src/main.ts` / core auth) |
| Permission model | `@RequirePermissions(...)` — **OR** of listed keys (any one grants) |
| Nav hide | `frontend/src/lib/navigation.ts` — **not** security |
| Public exceptions | Health; M-Pesa callback (IP allowlist in `mpesa-callback.contract.ts`); some storage/share tokens |

Role templates: `backend/src/core/admin/role-templates.ts` (records officer, doctor, nurse, lab technician, lab verifier, radiology technician, pharmacist, store officer, cashier, insurance officer, plus director/admin). Lab technician template does **not** include `lab_requests:cancel` or `lab_results:verify`.

User APIs (`AdminController` `/admin`): users CRUD, activate/deactivate/unlock, reset password, role assign, department assign, roles, permissions, templates, settings, clinical catalog, backups, system-health, audit-logs, phi-access-report, clinics.

**This audit did not attempt unauthorised access against a logged-in session.** Prior Jest (14 Oct) logged `AUTH_REQUIRED` on `GET /patients` and `AUTH_FORBIDDEN` on `GET /reports/executive-analytics` for a doctor fixture.

### Risks (suspected, not proven incidents)

| Risk | Evidence | Severity |
| --- | --- | --- |
| Over-broad OR permissions | Guard semantics | P2 |
| Director finance visible only with payments/settings or director roles | `reporting` finance hide rules in metric definitions | By design |
| Restore endpoint present | `POST /admin/backups/restore` — do not invoke | Operational caution |
| Nav-only hiding | Frontend | P2 if someone treats nav as ACL |

## Audit

`AuditInterceptor` on mutations → `demo.audit_logs`. Export/import under `/admin/audit-logs`. PHI access report exists as an admin route. **Not a complete before/after clinical snapshot** of every column.

## Director dashboard data reliability

Screen: `ExecutiveAnalyticsDashboard.tsx` ← `GET /reports/executive-analytics` (`ReportingController`).  
Definitions: `docs/AFYASASA_DASHBOARD_METRIC_DEFINITIONS.md`. Tests: `reporting-metrics.spec.ts` (prior 14 Oct, not re-run).

| Indicator | Meaning | Source | Fit for management decisions |
| --- | --- | --- | --- |
| OPD visits | Count of OPD encounters in range | `encounters` | Directional if encounter create is reliable |
| New patients | Registrations in range | `patients` | Not visit volume |
| ED / IPD / beds | Counts as defined | emergency_encounters, admissions, beds | Occupancy unavailable if totalBeds = 0 |
| Lab/rad pending | Point-in-time worklists | request status | Backlog, not TAT alone |
| Lab TAT | Avg verify−create hours | verified rows only | Null if none verified |
| Pharmacy activity | **Data unavailable** | No aggregate | **Do not invent from inventory movements** |
| Billed vs collected | Charge SUM vs completed payments | charges / payment_transactions | **Not certified**; not GL |
| Outstanding | Point-in-time | charges owed | Not “billed minus collected” |
| Accounting | Pending | QuickBooks | EMR ≠ GL |
| Marketing conversion | Insufficient attribution | — | Do not invent rates |

Finance tiles require director/admin/superadmin or `payments:read` / `settings:manage`.

## Report generation and delivery

| Path | Status |
| --- | --- |
| In-app reports hub | Implemented (`ReportsHub`, `/reports/*`, `/exports/*`) |
| Lab/rad PDF layouts | Implemented; lab **clinical template approval still outstanding** |
| IPD discharge PDF | Implemented in IPD module |
| Shared token URL | `ReportDeliveryService` builds `/api/v1/reports/shared/{token}` |
| Email of reports | Depends on SMTP; **configured but unverified** live |
| Government notification | Spec: does not fabricate acknowledgement on failure |

## Integration maturity

Levels: 1 not implemented · 2 planned/docs · 3 implemented locally · 4 automated tests · 5 sandbox verified · 6 production config present · 7 live E2E verified.

| Integration | Level | Notes |
| --- | --- | --- |
| SHA/DHA | 3 (local mapping) | `/sha/status`, `POST /sha/eligibility`, coverage. Not 5–7 this audit |
| FHIR | 3 | `/integrations/fhir` map patient/encounter; `validate-synthetic`. Not a FHIR server |
| Insurance/corporate | 3 | `/insurance` drafts; not SHA submit |
| M-Pesa | 3–4 | STK + callback code + specs. Live **not 7**. Do not test against real phones |
| QuickBooks Desktop / QBWC | 3–4 | Queue + connector; credentials missing rejected in tests. Live **not 7**. QB is GL |
| Email/SMTP | 3 + CU | `/admin/email`; 14 Oct tests: NOT_CONFIGURED / allowlist / DEGRADED |
| SMS | 3 PI | `POST /notifications/sms/bulk` — do not send |
| Biometrics | 3 PI | Device/agent required |
| MinIO | 3 | Local compose healthy this audit |
| PACS | 1 | File attachments only |
| Blood bank LIS | 1 | |
| KHIS submit | 2–3 mapping | F89 PI |

**No credentials or tokens are reproduced here.** Production configuration for any of the above was **not** inspected.

## Interoperability UI

Nav: Hospital Control Center → Interoperability. Surfaces SHA/FHIR status for operators. Presence of the screen is **not** live HIE.
