# AfyaSasa current architecture

Inspection date: 2 October 2026.  
Tenant in use: `jalaram`.  
Internal schema name remains `demo` (historical TypeORM schema). That name must not be shown to hospital staff as if the hospital is a demo.

This document describes the live system as implemented. It is not a redesign proposal.

## What this system is

AfyaSasa is a NestJS + TypeORM + PostgreSQL hospital EMR with a React frontend. Jalaram is a live facility. Compose keeps `TYPEORM_MIGRATIONS_RUN=false` and `AFYASASA_ALLOW_DEMO_SEED=false`. Charges are enabled (`AFYASASA_CHARGES_ENABLED=true`).

## Runtime topology

```text
Browser
  → nginx :8080
      → frontend (nginx/static) :80
      → /api/v1 → backend :3000
      → /minio  → MinIO
backend
  → PostgreSQL :5432 (host 5433)
  → Redis :6379 (host 6380)
  → MinIO :9000
  → optional SHA HIE (only when credentials are set)
```

Live containers observed healthy on 2 Oct 2026:

| Service | Status |
| --- | --- |
| nginx | healthy, host 8080 → 200 |
| backend | healthy, `/api/v1/health` → `{"status":"ok"}` |
| frontend | healthy |
| postgres | healthy |
| redis | healthy |
| minio | healthy |

## Application layout

| Layer | Location | Role |
| --- | --- | --- |
| Frontend | `frontend/src` | Role-gated screens, React Query, JWT in memory + refresh cookie |
| Backend | `backend/src` | Nest modules, JWT + permission guards, TypeORM repositories |
| Shared catalog | `public.settings.clinical_catalog` | Hospital charges, lab pricing, print templates, clinics metadata |
| Operational data | `demo.*` | Patients, encounters, billing, lab, inventory, users |
| Tenancy | `public.tenants`, `public.settings` | Facility identity and settings |

## Canonical clinical flow

```text
Patient
  → Encounter (OPD / emergency / inpatient)
      → Triage
      → Consultation (doctor_id) + Encounter.attendingDoctor
      → Doctor queue (GET /opd/doctor/queue — backend scoped)
      → Clinical orders
          → Lab request / sample / result
          → Radiology request / report
          → Pharmacy clinical order / dispense
      → Admission / bed / discharge
      → Charge (demo.charges)
      → Payment (demo.payment_transactions)
      → Audit (demo.audit_logs)
```

There is one patient table, one encounter table, one charge table, and one payment table. Do not add replacements.

## Backend modules

| Module | Canonical responsibility |
| --- | --- |
| `core/auth` | Login, refresh cookie, session inactivity, password change |
| `core/admin` | Users, roles, departments, clinics, settings, audit, system health |
| `patients` | Registration, identifiers, allergies, next of kin, timeline |
| `opd` | Encounter, triage, consultation, diagnosis, notes, doctor queue |
| `queue` | Visit tokens |
| `appointments` | Slots and appointments |
| `inpatient` | Wards, beds, admissions, transfers, discharge |
| `nursing` | Vitals, MAR, observations, shift notes |
| `emergency` | ED register, bays, alerts, disposition |
| `maternity` | Pregnancy, ANC, labour, delivery, newborn |
| `icu` / `hdu` | Critical-care admissions and observations |
| `laboratory` | Requests, samples, results, catalog |
| `radiology` | Requests, reports, modalities |
| `theatre` | Bookings, procedures, notes |
| `clinical-order` | Unified order header, pharmacy prescriptions |
| `inventory` | Items, batches, receipts, dispense, transfers |
| `payments` | Charges, payments, catalogue, IPD account, cashier |
| `reporting` | Dashboards, MOH 705/706/717 projections |
| `integration/sha` | SHA eligibility only (not full HIE) |
| `notifications` | Inbox + optional SMS |
| `storage` | MinIO upload/download |
| `worklists` | Paginated operational lists |
| `documents` | Clinical and hospital library files |
| `realtime` | Socket.IO tenant events + polling fallback |

## Frontend surfaces

Primary workspace is `frontend/src/App.tsx` with role-based navigation. Important workspaces:

- OPD check-in, triage, doctor queue
- IPD dashboard and patient workspace (clinical / nursing / orders / account)
- Laboratory, radiology, pharmacy, inventory
- Cashier / finance
- Executive analytics and operations command center
- Super admin / hospital control center
- Reports hub (internal + MOH 705A/B, 706, 717)

## Data fetching

- React Query with named keys (`doctor-queue`, `triage-queue`, `ipd-dashboard`, …)
- Doctor queue polls every 20 seconds
- `useHospitalSync` invalidates clinical keys every 45 seconds, on window focus, and on Socket.IO events when `socket.io-client` is present
- Backend now publishes `encounter.updated` on check-in, consultation start, consultation complete, and encounter status change

## What is not present

- No second patient, encounter, charge, or payment engine
- No DHA Client Registry / SHR / consent / eClaims / preauthorization clients
- No biometric hardware provider
- No barcode column on inventory items (SKU is the product key)
- No KHIS/DHIS automatic submission
- No invented HRI 107A/107B classes
- Health endpoint checks process liveness only, not Postgres/Redis/MinIO/DHA

## Production safety already in compose

- Migrations do not auto-run
- Demo seed cannot run from compose environment
- Nginx resolves Docker DNS so rebuilt frontend/backend containers do not leave a stale 502
- Secrets stay in `.env` / server env; they must not be printed or sent to the frontend
