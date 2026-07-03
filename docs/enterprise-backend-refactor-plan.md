# AfyaSasa Enterprise Backend Refactor Plan

This document maps your **13-section enterprise directive** to the current codebase, what was delivered in **Phase Enterprise Foundation**, and the phased roadmap to production hospital scale.

---

## Current posture

AfyaSasa has a **broad clinical feature set** on a **single-tenant demo schema** (`demo`). Patterns are enterprise-ready (auditable entities, RBAC, soft deletes, MinIO storage, BullMQ, audit interceptor) but **wiring and cross-cutting discipline** must catch up before multi-hospital production.

| Strength | Gap |
|----------|-----|
| Normalized clinical modules (OPD, IPD, lab, radiology, etc.) | All entities hardcoded to `demo` schema |
| Email login, refresh tokens, lockout | No production email for password reset |
| Permission guards on ~95% of routes | Pagination on only 2 list endpoints (before worklists) |
| MinIO/S3 abstraction | Metadata split across attachment tables |
| MPI identifiers + basic duplicate check | No patient merge, limited fuzzy matching |

---

## Section-by-section status

### 1. Database redesign

| Requirement | Status |
|-------------|--------|
| UUID primary keys | Done — all clinical entities |
| `created_at`, `updated_at`, `created_by`, `updated_by` | Done — `AuditableEntity` |
| Soft deletes (`deleted_at`) | Done — `SoftDeleteClinicalEntity` for clinical data |
| Foreign keys | Mostly done; **refresh_tokens FK added** in enterprise migration |
| Search indexes | **Expanded** — MRN, phone, name+DOB, identifiers, encounter/admission/lab status |
| Normalization | Good module separation; tenant isolation not yet dynamic |
| Audit clinical actions | Interceptor logs HTTP; **before/after JSON still TODO** |

**Next:** Schema-per-tenant provisioning CLI; `tenant_id` on audit_logs; entity snapshot on mutations.

### 2. Patient Master Index (MPI)

| Requirement | Status |
|-------------|--------|
| Multiple identifier types | Done — national_id, passport, SHA, birth_certificate, refugee_id |
| Facility MRN (`patient_no`) | Done — unique per tenant schema |
| Duplicate detection | **Enhanced** — identifier, phone, national ID, name+DOB |
| Block accidental duplicates | Frontend + `ensureNoDuplicateIdentifier` on create |
| Patient merge | **Not started** |

**API:** `POST /patients/duplicates` returns `matchReasons`, `candidates`, `nationalIdMatches`, `nameDobMatches`.

### 3. File storage

| Requirement | Status |
|-------------|--------|
| No blobs in PostgreSQL | Done — metadata only |
| MinIO/S3 presigned upload/download | Done — `StorageService` |
| Metadata fields | Done — `clinical_documents`, `lab_attachments`, `hospital_documents` |
| Unified document registry | **Partial** — multiple attachment tables; consolidate in Phase 3 |
| Tenant-prefixed object keys | **TODO** |

### 4. Email-based authentication

| Requirement | Status |
|-------------|--------|
| Email login | Done |
| Password hash, expiry, force change | Done (`forcePasswordChange`) |
| Account lockout | Done — 5 failures / 15 min |
| Refresh tokens + session timeout | Done — 15m access / 7d refresh |
| **Login audit history** | **Done** — `demo.login_events` table + `LoginAuditService` |
| **Password reset** | **Scaffolded** — `POST /auth/forgot-password`, `POST /auth/reset-password` (email send TODO) |
| MFA | Future |

### 5. RBAC

| Requirement | Status |
|-------------|--------|
| Multiple roles per user | Done |
| Granular permissions | Done — 80+ permission keys |
| No hardcoded role checks | Done — `@RequirePermissions` + guards |
| Every endpoint enforced | **Mostly** — logout/change-password still open to any authenticated user |
| `worklists:read` permission | **Added** |

### 6. Patient lists (operational worklists)

| Requirement | Status |
|-------------|--------|
| Filtered lists per module | **Done (API)** — `GET /worklists/:module/:listKey` |
| Search, sort, pagination | Done — `PaginationQueryDto` |
| Export | **TODO** — CSV export on worklist endpoints |
| Frontend dashboards | **TODO** — wire UI to `/worklists` |

**Catalog:** `GET /worklists` returns available list keys per module.

**Modules implemented:** registration, opd, emergency, ipd, laboratory, radiology.

### 7. Clinical workflow engine

| Requirement | Status |
|-------------|--------|
| Automatic status transitions | **Started** — `EncounterWorkflowService` |
| Lab order → `awaiting_results` | **Done** — on lab request create |
| Central state machine | **Partial** — allowed transitions defined; not all modules hooked |
| Configurable per tenant | **TODO** |

### 8. Performance

| Requirement | Status |
|-------------|--------|
| Shared pagination utilities | **Done** — `common/dto/pagination.dto.ts`, `pagination.util.ts` |
| Apply pagination everywhere | **In progress** — worklists + patient search |
| N+1 avoidance | **Ongoing** — use relations/joins in worklists |
| Config cache (Redis) | **TODO** |
| Background queues | Done — BullMQ for SMS |

### 9. Notification center

| Requirement | Status |
|-------------|--------|
| Internal inbox | Done |
| Lab/radiology/referral triggers | Done |
| Realtime (Socket.IO) | Done |
| Email channel | **TODO** |
| Unified toast + inbox | **Partial** |

### 10. Audit & logging

| Requirement | Status |
|-------------|--------|
| HTTP audit interceptor | Done |
| Append-only audit_logs | Done — DB trigger |
| Login events | **Done** — separate `login_events` table |
| before/after values | **TODO** |
| Print/export audit | **TODO** |

### 11. API design

| Requirement | Status |
|-------------|--------|
| `/api/v1` prefix | Done |
| ValidationPipe global | Done |
| Consistent pagination shape | **Standardized** — `{ items, meta }` |
| Standard error codes | **TODO** |
| OpenAPI completeness | **Partial** |

### 12. QR scan feature flag

| Requirement | Status |
|-------------|--------|
| Disable scan-to-search | **Done** — `featureFlags.qrPatientScan` default `false` |
| Keep architecture | QR lookup API + print card remain |
| Biometric future | Documented |

### 13. Code quality & documentation

| Deliverable | Location |
|-------------|----------|
| This refactor plan | `docs/enterprise-backend-refactor-plan.md` |
| Lab/documents progress | `docs/lab-documents-progress-report.md` |
| Free hosting | `docs/free-test-hosting-guide.md` |
| Go-live checklist | `docs/go-live-checklist.md` |

---

## Phase Enterprise Foundation (delivered)

**Migration:** `1766700000000-EnterpriseFoundation.ts`

- `login_events` — login, logout, failed login, password reset events
- `password_reset_tokens` — secure reset flow
- Performance indexes on patients, identifiers, encounters, admissions, lab requests
- `refresh_tokens` FK to users
- Permissions: `worklists:read`, `auth:password_reset`

**New modules:**

| Module | Path | Purpose |
|--------|------|---------|
| Worklists | `backend/src/worklists/` | Paginated operational patient lists |
| Workflow | `backend/src/workflow/` | Encounter status transitions |
| Pagination | `backend/src/common/` | Shared DTO + helpers |
| Login audit | `backend/src/core/auth/login-audit.service.ts` | Auth event persistence |
| Tenant schema | `backend/src/core/tenancy/tenant-schema.interceptor.ts` | `SET search_path` per request |

**Auth endpoints added:**

- `POST /auth/forgot-password`
- `POST /auth/reset-password`

---

## Recommended implementation phases

### Phase A — Multi-tenancy (blocker for multi-hospital)

1. Tenant provisioning: clone `demo` schema → `{tenant_code}` per hospital
2. Remove hardcoded `schema: 'demo'` from entities (dynamic schema or search_path only)
3. Tenant-prefixed S3 keys: `{tenantCode}/patients/{id}/...`
4. Platform admin API for tenant lifecycle

### Phase B — Compliance & auth hardening

1. Email provider for password reset (SMTP / SendGrid)
2. Audit entity snapshots on PATCH/POST clinical mutations
3. PHI access report from audit_logs
4. JWT invalidation on role change (Redis denylist)

### Phase C — MPI & worklist UX

1. Patient merge workflow (admin)
2. Fuzzy duplicate scoring (Levenshtein / Soundex)
3. Frontend worklist dashboards per department
4. CSV export on all worklists

### Phase D — Workflow & notifications

1. Hook radiology/referral/admission into `EncounterWorkflowService`
2. Email notification channel
3. Unified notification center (merge toast + inbox)
4. Department-scoped queues (`user_departments`)

### Phase E — Scale & operations

1. Partition `audit_logs` / `login_events` by month
2. Automated Postgres + MinIO backups with restore drills
3. Cursor-based pagination for very large lists
4. Load testing (hundreds concurrent users)

---

## API quick reference (new)

```
GET  /worklists                              — list catalog
GET  /worklists/:module/:listKey?page=&pageSize=&q=&sortDir=
POST /auth/forgot-password                   — { email }
POST /auth/reset-password                    — { token, newPassword }
POST /patients/duplicates                    — enhanced MPI check
```

**Worklist examples:**

```
GET /worklists/registration/today
GET /worklists/registration/duplicate-candidates
GET /worklists/opd/waiting
GET /worklists/opd/investigations-pending
GET /worklists/laboratory/requested
GET /worklists/emergency/red
GET /worklists/ipd/current-admissions
```

---

## Deploy

After pulling this phase:

```bash
docker compose up -d --build
```

Verify migration `EnterpriseFoundation1766700000000` applied.

---

## Final goal alignment

This phase prioritizes **correctness, security, and maintainability** over new clinical features. The backend is being shaped to support:

- Multiple hospitals (tenant schema interceptor + roadmap)
- Millions of records (indexes + pagination + worklists)
- Large document storage (MinIO metadata pattern)
- Long-term integrations (billing, pharmacy, NHIS, biometrics)

**The backend should become the strongest part of the system** — this document and Phase Enterprise Foundation are the starting point for that transition.
