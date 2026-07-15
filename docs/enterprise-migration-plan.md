# AfyaSasa Enterprise Migration Plan

**Status:** Phase 0–1 largely complete for demo/single-hospital; Phase 2+ scheduled.  
**Last updated:** 2026-07-05

### Implementation snapshot

| Phase | Status | Notes |
|-------|--------|-------|
| **0 — Stabilize** | Done | Login, smoke tests, `schema:demo` hotfix, throttling on auth |
| **1A — Tenancy** | Done (demo) | AsyncLocalStorage + pool `search_path`; entities still `schema:demo` until staging proves provisioned tenants |
| **1B — Auth** | Done | Refresh rotation, `/auth/me`, MFA columns, password change keeps session |
| **1C — Audit** | Partial | PHI report; before/after snapshots pending |
| **1D — RBAC** | Done | Token revocation on role change; permission-gated control center |
| **3 — file_registry** | Schema only | Table migrated; app wiring pending |
| **5 — Unified orders** | Partial | Lab + radiology dual-write to `clinical_orders` |
| **Single-hospital UX** | Done | `VITE_HIDE_TENANT_SELECTOR=true` hides hospital code on login |

**Audience:** Engineering, DevOps, clinical informatics leads.  
**Goal:** Evolve AfyaSasa from a feature-rich clinical prototype into an enterprise-grade, multi-facility EMR supporting **1,000+ concurrent users**, **10,000+ facility accounts**, and **millions of clinical records** without breaking live workflows.

---

## Executive summary

AfyaSasa already has broad clinical coverage (OPD, IPD, ED, lab, radiology, maternity, theatre, ICU/HDU, documents, RBAC, MinIO storage, worklists, audit hooks). The gap is not “missing modules” — it is **architectural discipline at scale**:

| Area | Today | Enterprise target |
|------|--------|-------------------|
| Tenancy | Schema-per-tenant provisioned; ORM still targets `demo` schema | Dynamic tenant routing on every DB connection |
| Orders | Separate lab / radiology / referral tables | Unified order engine + department worklists |
| Encounters | Shared `encounters` + ED extension | Single encounter engine for all visit types |
| Auth | bcrypt, refresh tokens, lockout, login audit | + rotation, MFA-ready, email reset in prod |
| Audit | HTTP interceptor; `afterJson` only | Before/after snapshots on clinical mutations |
| Performance | Pagination on patients + worklists only | Pagination everywhere; Redis cache; partitions |
| Docs | Scattered guides | Per-module README + API + schema docs |

**Rule:** No greenfield rewrites. Every phase must be **backward compatible**, **migration-backed**, and **verifiable** with existing demo workflows (login → register → OPD → lab → IPD).

---

## Immediate blockers (fix before Phase 1)

### 1. Login 500 — `relation "users" does not exist`

**Cause:** Phase A removed `schema: 'demo'` from TypeORM entities and relied on `SET LOCAL search_path` in an interceptor. Connection pooling means `search_path` is set on one pooled connection while queries run on another → unqualified `users` resolves to `public` (empty).

**Fix applied:** `schema: 'demo'` restored on tenant entities (hotfix).  
**Proper fix (Phase 1):** Request-scoped `search_path` via TypeORM `QueryRunner` / AsyncLocalStorage subscriber — see §Phase 1.

### 2. Docker build — `registry-1.docker.io` DNS failure

**Cause:** Host DNS (`127.0.0.53`) cannot resolve Docker Hub — network/environment, not application code.

**Actions:**
```bash
# Test DNS
ping -c 2 registry-1.docker.io
resolvectl status

# Workarounds: fix router DNS, use 8.8.8.8 temporarily, or build when online
sudo systemd-resolve --flush-caches

# If images already exist locally, start without rebuild:
docker compose up -d
```

### 3. Tunnel / external access

Cloudflare tunnel fails when nothing listens on `:8080` or when `FRONTEND_ORIGIN` does not match the public URL. See `docs/free-test-hosting-guide.md`.

---

## Current architecture (as-is)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Nginx     │────▶│  NestJS API      │────▶│  PostgreSQL     │
│  :8080      │     │  /api/v1         │     │  public + demo  │
└─────────────┘     │                  │     └─────────────────┘
                    │  Guards          │              ▲
                    │  Interceptors    │              │
                    │  Services        │     ┌────────┴────────┐
                    │  TypeORM repos   │────▶│  Redis (BullMQ) │
                    └────────┬─────────┘     └─────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  MinIO / S3      │
                    └──────────────────┘
```

**Request path today:**
1. `TenantMiddleware` → resolve tenant from `X-Tenant` / subdomain  
2. `JwtAccessGuard` + `PermissionsGuard`  
3. `TenantSchemaInterceptor` (search_path — **broken for pool**)  
4. `AuditInterceptor` (HTTP-level)  
5. Controller → Service → Repository  

**83 entities** in `demo` schema; **17 migrations**; soft deletes on clinical tables; append-only `audit_logs`.

---

## Target architecture (to-be)

```
┌──────────────────────────────────────────────────────────────┐
│                     API Gateway / Nginx                       │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│  Presentation   Controllers (thin) — DTO validation only      │
├──────────────────────────────────────────────────────────────┤
│  Application    Domain services — business rules, workflows  │
│                 Order engine, Encounter engine, Worklists      │
│                 Notification dispatcher                      │
├──────────────────────────────────────────────────────────────┤
│  Platform       Auth, RBAC, Tenancy, Audit, Mail, Storage    │
├──────────────────────────────────────────────────────────────┤
│  Infrastructure TypeORM (tenant-scoped), Redis, BullMQ, S3   │
└──────────────────────────────────────────────────────────────┘
```

**Every write path:** Validate → Authorize → Audit (before) → Business rules → Persist → Audit (after) → Notify (async).

---

## Domain-based schema (target)

Organize PostgreSQL into logical domains (single `demo` / `{tenant}` schema per hospital, prefixed or namespaced tables):

| Domain | Tables (current → target) |
|--------|---------------------------|
| **platform** | `tenants`, `settings` (public) |
| **identity** | `users`, `roles`, `permissions`, `user_roles`, `login_events`, `password_reset_tokens`, `refresh_tokens` |
| **mpi** | `patients`, `patient_identifiers`, `patient_next_of_kin`, `patient_allergies`, `patient_chronic_conditions` |
| **encounters** | `encounters`, `triage_assessments`, `consultations`, `encounter_diagnoses`, `clinical_notes`, `emergency_encounters`, … |
| **orders** | `lab_requests`, `radiology_requests`, `referrals` → **`clinical_orders`** + typed extensions |
| **inpatient** | `wards`, `beds`, `admissions`, `discharge_summaries`, ICU/HDU tables |
| **investigations** | `lab_*`, `radiology_*` (catalog + results) |
| **documents** | `clinical_documents`, `hospital_documents`, `*_attachments` → **`file_registry`** |
| **operations** | `appointments`, `notification_*`, `audit_logs` |

**Rule:** Patient demographics exist **only** in MPI. All modules reference `patient_id` + `encounter_id`.

---

## Directive mapping (16 sections → phases)

| # | Directive | Current | Phase |
|---|-----------|---------|-------|
| 1 | Layered architecture | Controllers thin; some fat services | 0–1 |
| 2 | Database redesign | UUIDs, soft delete, partial indexes; no partitions | 2–3 |
| 3 | Domain schema | Implicit; not documented | 2 |
| 4 | Unified encounter | `encounters` + ED extension | 4 |
| 5 | Unified orders | Separate lab/rad/referral | 5 |
| 6 | Laboratory catalog | `lab_tests` flat columns; seed exists | 6 |
| 7 | Radiology | Text + PDF; no PACS | 6 (extend) |
| 8 | Object storage | MinIO + scattered metadata | 3 |
| 9 | Email auth | bcrypt, reset scaffold, login audit | 1 |
| 10 | Enterprise RBAC | Action permissions; no row-level | 1–2 |
| 11 | Operational worklists | API + module patient views | 1 (extend) |
| 12 | Notification engine | SMS queue; partial events | 4 |
| 13 | Performance | Sparse pagination; Redis partial | 2–3 |
| 14 | Audit & logging | HTTP audit; no before_json | 1 |
| 15 | Code documentation | Partial | All |
| 16 | Engineering goal | This document | — |

---

## Phased migration (safe upgrade order)

### Phase 0 — Stabilize (1 week, no schema breaks)

**Goal:** Demo hospital works reliably; CI green; baseline metrics.

| Task | Action | Verify |
|------|--------|--------|
| P0.1 | Keep `schema: 'demo'` on entities until Phase 1 tenant routing ships | Login, OPD, lab smoke tests |
| P0.2 | Fix `ThrottlerGuard` on `/auth/*` | Brute-force test |
| P0.3 | `FRONTEND_ORIGIN` documented per environment | Login via tunnel/LAN |
| P0.4 | `npm run smoke` + Playwright onboarding in CI | Green pipeline |
| P0.5 | Load baseline: login p95, patient search p95, worklist p95 | Record in `docs/performance-baseline.md` |

**Data migration:** None.

---

### Phase 1 — Platform hardening (2–3 weeks)

**Goal:** Auth, audit, tenancy, RBAC safe for production pilots.

#### 1A. Tenant-aware database connections (CRITICAL)

**Problem:** Hardcoded `schema: 'demo'` blocks provisioned tenants.

**Solution (choose one — recommend A):**

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **A** | `TenantConnectionSubscriber` — `SET LOCAL search_path` in `beforeQuery` on same connection via AsyncLocalStorage | True multi-schema | Requires TypeORM subscriber + CLS |
| **B** | Keep explicit schema; dynamic `EntityManager` with schema override per request | TypeORM-native | Heavy refactor |
| **C** | Database-per-tenant (separate DB name) | Strong isolation | Ops cost at 10k tenants |

**Migration steps (Option A):**
1. Add `@nestjs-cls` or `AsyncLocalStorage` for `tenantSchema` per request.
2. Implement `backend/src/core/tenancy/tenant-query.subscriber.ts`.
3. Remove `schema: 'demo'` from entities **only after** subscriber verified in staging.
4. Run regression: demo tenant + one provisioned tenant (`POST /platform/tenants/provision`).

**Rollback:** Re-add `schema: 'demo'` on entities.

#### 1B. Authentication upgrade

| Task | Detail |
|------|--------|
| SMTP production | `SMTP_*` + `APP_PUBLIC_URL`; remove dev token leak in prod |
| Refresh rotation | Issue new refresh token on refresh; revoke old |
| Revocation | Call `TokenRevocationService` on password change + role change (partially done) |
| MFA-ready | Add `users.mfa_secret`, `users.mfa_enabled` (nullable); no UI yet |
| Argon2 | Optional migration from bcrypt on next password set (dual-verify period) |

**Migration:** `1766900000000-AuthMfaReady.ts` — nullable MFA columns; no breaking change.

#### 1C. Audit before/after

| Task | Detail |
|------|--------|
| Clinical mutation decorator | `@Audited('patients')` loads entity before PATCH |
| Store `beforeJson` + sanitized `afterJson` | Compliance |
| PHI access report | Done — extend CSV export |

#### 1D. RBAC hardening

| Task | Detail |
|------|--------|
| Permission audit | Script: every controller method → permission or `@Public()` |
| Department scope | `user_departments` enforced on worklists (optional filter) |
| JWT version claim | Invalidate on permission change (Redis — done) |

**Verification:** Security checklist in `docs/go-live-checklist.md`.

---

### Phase 2 — Database scale (3–4 weeks)

**Goal:** Millions of rows; predictable query plans.

#### 2A. Index pack (online, `CONCURRENTLY`)

```sql
-- Examples (run per-tenant schema via migration)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_phone ON patients (primary_phone) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_encounters_opd_queue ON encounters (status, started_at DESC) WHERE type = 'opd' AND deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admissions_ward_status ON admissions (ward_id, status) WHERE deleted_at IS NULL;
```

Add: MRN (`patient_no`), national ID (`patient_identifiers`), facility (`tenant_id` on audit when added), department (`department_id` on encounters when added).

#### 2B. Partitioning (new data forward; archive old)

| Table | Strategy | Retention |
|-------|----------|-----------|
| `audit_logs` | RANGE (`created_at`) monthly | 7 years |
| `login_events` | RANGE monthly | 2 years |
| `notification_queue` | RANGE monthly | 90 days |
| `lab_results` | RANGE (`entered_at`) yearly | Clinical policy |
| `radiology_reports` | RANGE (`created_at`) yearly | Clinical policy |

**Migration approach:**
1. Create partitioned parent table `_partitioned`.
2. Attach current month partition.
3. Dual-write trigger OR brief maintenance window copy.
4. Swap views / rename (documented runbook).

**Patient timeline:** Today built from joins in `patients.service.ts` — do **not** partition a single table until unified timeline store is designed (Phase 4).

#### 2C. Pagination everywhere

Apply `PaginationQueryDto` to:
- OPD encounter lists, lab/radiology requests, admissions, appointments, referrals, notifications inbox, admin lists.

**Target:** No endpoint returns unbounded arrays > 100 rows.

#### 2D. Redis caching

| Key | TTL | Content |
|-----|-----|---------|
| `tenant:{id}:catalog` | 5 min | `clinical_catalog` JSON |
| `tenant:{id}:permissions:{roleId}` | 15 min | Permission sets |
| `tenant:{id}:lab-catalog` | 10 min | Active tests/panels |

Invalidate on Control Center save.

---

### Phase 3 — File registry & storage (2 weeks)

**Goal:** One metadata model for all clinical files.

**New table:** `file_registry`

```sql
CREATE TABLE file_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  patient_id uuid REFERENCES patients(id),
  encounter_id uuid REFERENCES encounters(id),
  category text NOT NULL, -- lab_report, radiology_pdf, consent, id_scan, ...
  storage_bucket text NOT NULL,
  storage_key text NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint,
  checksum_sha256 text,
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
```

**Migration:** Backfill from `lab_attachments`, `radiology_attachments`, `clinical_documents`, `encounter_attachments` — **no delete** of legacy tables until Phase 5.

**Storage keys:** `{tenantCode}/{category}/{patientId}/{uuid}-{filename}` (already partially implemented).

---

### Phase 4 — Encounter & notification engines (4–6 weeks)

#### 4A. Unified encounter engine

**Extend** `encounters.type` enum:

`opd | emergency | inpatient | maternity | icu | hdu | theatre | follow_up`

**Rules:**
- ED keeps `emergency_encounters` extension during transition.
- IPD admission links `encounter_id` (already optional — make required for new admissions).
- All diagnoses, orders, notes attach to `encounter_id` (enforce in services).

**Migration:** Backfill `encounter_id` on orphan admissions via script.

#### 4B. Notification engine v2

**New:** `notification_events` table + `NotificationDispatcherService`

| Event | Channels |
|-------|----------|
| lab_result_verified | in-app, SMS, email |
| critical_lab_result | in-app, SMS (priority) |
| radiology_report_ready | in-app |
| patient_waiting | in-app |
| admission_approved | in-app |
| discharge_pending | in-app |
| referral_received | in-app |
| appointment_reminder | SMS, email |

**Implementation:** Domain services emit events → BullMQ workers → persist `internal_notifications` + optional SMS/email.

**Realtime:** Keep Socket.IO; subscribe per user + department.

---

### Phase 5 — Unified order engine (6–8 weeks)

**New table:** `clinical_orders`

```sql
CREATE TABLE clinical_orders (
  id uuid PRIMARY KEY,
  order_no text UNIQUE NOT NULL,
  patient_id uuid NOT NULL REFERENCES patients(id),
  encounter_id uuid NOT NULL REFERENCES encounters(id),
  order_type text NOT NULL, -- laboratory, radiology, procedure, referral, admission, appointment, transfer
  status text NOT NULL,
  priority text NOT NULL DEFAULT 'routine',
  ordered_by uuid REFERENCES users(id),
  department_id uuid,
  payload jsonb NOT NULL DEFAULT '{}', -- type-specific details
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
```

**Migration strategy (zero downtime):**
1. Deploy `clinical_orders` + write-through adapter in `laboratory.service.createRequest()` — dual-write to `lab_requests` + `clinical_orders`.
2. Worklists read from `clinical_orders` with fallback to legacy tables.
3. After 2 release cycles, migrate historical rows.
4. Deprecate direct `lab_requests` creation (views for reporting).

**Departments** process via existing worklist keys + new order-type filters.

---

### Phase 6 — Laboratory & radiology catalog (2–3 weeks)

**Extend** `lab_tests` (or new `lab_test_fields` for multi-analyte):

| Column | Purpose |
|--------|---------|
| `name`, `unit`, `result_type`, `display_order` | Display |
| `reference_range_male`, `reference_range_female`, `reference_range_child` | Ranges |
| `critical_low`, `critical_high` | Alerts |
| `active` | Soft deactivate |

**Seed:** Kenyan MOH/common panel CSV (extend `docs/templates/lab-catalog-import-template.csv`).

**Radiology:** Keep modalities + typed report fields; PDF via `file_registry`.

**No PACS/DICOM** — explicit non-goal.

---

### Phase 7 — Documentation & module READMEs (ongoing)

Each backend module gets:

```
backend/src/{module}/
  README.md           # Purpose, boundaries, business rules
  ARCHITECTURE.md     # Entities, flows, dependencies
```

Root additions:
- `docs/database-schema.md` — ERD by domain
- `docs/api-overview.md` — OpenAPI link + conventions
- `docs/deployment.md` — Docker, env vars, migrations, rollback
- `docs/performance-baseline.md` — SLO targets

---

## Data upgrade safety rules

1. **Every schema change = TypeORM migration** — no `synchronize: true`.
2. **Expand → backfill → contract** — add nullable columns first; backfill job; then NOT NULL in later migration.
3. **Dual-write period** for orders, file registry, encounter links.
4. **Feature flags** in `clinical_catalog.featureFlags` for new engines.
5. **Provisioned tenants** get migrations via `apply_migration_to_all_schemas()` function (to build in Phase 1).
6. **Rollback plan** per migration documented in migration header comment.

---

## Environment variables (enterprise)

| Variable | Purpose |
|----------|---------|
| `POSTGRES_*` | Database |
| `REDIS_*` | Cache, BullMQ, token revocation |
| `JWT_*` | Auth |
| `SMTP_*`, `APP_PUBLIC_URL` | Password reset email |
| `S3_*` | Object storage |
| `FRONTEND_ORIGIN` | CORS + WebSocket (must match browser URL) |
| `TYPEORM_MIGRATIONS_RUN` | Auto-migrate on deploy |

See `.env.example`.

---

## Performance targets (SLO)

| Metric | Target |
|--------|--------|
| Login | p95 < 300 ms |
| Patient search | p95 < 500 ms |
| Worklist page | p95 < 400 ms |
| API availability | 99.9% (single hospital) |
| Concurrent users | 1,000+ per deployment cell |
| Tenant accounts | 10,000+ (schema-per-tenant with connection pool tuning) |

**Scale note:** 10,000 tenants on schema-per-tenant requires **connection pooler** (PgBouncer), **read replicas** for reporting, and **horizontal API replicas** behind load balancer — document in Phase 2 ops runbook.

---

## What NOT to do

- Do not rebuild OPD/IPD/lab UIs from scratch while migrating backend.
- Do not store files in PostgreSQL.
- Do not implement PACS/DICOM.
- Do not remove legacy tables until dual-write period ends.
- Do not deploy `search_path`-only tenancy without connection-scoped subscriber.
- Do not add features ahead of Phase 0 stabilization.

---

## Recommended next actions (this week)

1. **Confirm login works** after `schema: 'demo'` restore: `curl -X POST http://localhost:8080/api/v1/auth/login -H 'X-Tenant: demo' ...`
2. **Fix Docker DNS** or use `docker compose up -d` without `--build` if images exist.
3. **Approve Phase 1A design** (tenant subscriber vs alternatives).
4. **Assign owners** per phase (platform, clinical, investigations, ops).
5. **Start Phase 0** smoke tests + performance baseline — no new features.

---

## Related documents

| Document | Purpose |
|----------|---------|
| `docs/enterprise-backend-refactor-plan.md` | Section-by-section status (Phases A–B delivered) |
| `docs/free-test-hosting-guide.md` | Tunnel, LAN, deployment |
| `docs/go-live-checklist.md` | Production readiness |
| `docs/system-status-and-completion-checklist.md` | Feature completion |

---

*This plan prioritizes **correctness, security, performance, maintainability, and workflow integrity** over new features. Implementation PRs must reference a phase and include migration + rollback notes.*
