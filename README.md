# AfyaSasa

Clinical-only Electronic Medical Records platform for Kenyan hospitals.

## Phase 1 foundation included

- NestJS backend in `backend`
- React + Vite + Tailwind frontend in `frontend`
- Docker Compose services for PostgreSQL, Redis, MinIO, Nginx, backend, and frontend
- Initial tenancy, auth/RBAC, audit, patients, and notification foundations

## Run locally

Requires Docker / Docker Compose.

```bash
cp .env.example .env
npm run dev
```

Backend API: `http://localhost:3000/api/v1`

Swagger: `http://localhost:3000/docs`

Frontend through Nginx: `http://localhost:8080`

Useful commands:

```bash
npm run dev:detached
npm run logs
npm run stop
npm run build
npm run test
npm run audit
npm run db:backup
npm run db:restore -- backups/your-backup.sql
```

## Demo login

- Tenant for all demo accounts: `demo`
- Password for all demo accounts: `ChangeMe123!`

| Role | Email | Notes |
|---|---|---|
| Administrator | `admin@demo.afyasasa.local` | Forced to change password on first login |
| Doctor | `doctor@demo.afyasasa.local` | OPD, inpatient, emergency workflows |
| Nurse | `nurse@demo.afyasasa.local` | Triage, emergency, nursing workflows |
| Records Officer | `records@demo.afyasasa.local` | Registration and check-in workflows |
| Lab Technician | `lab@demo.afyasasa.local` | Reserved for Phase 3 lab workflows |
| Radiology Technician | `radiology@demo.afyasasa.local` | Reserved for Phase 3 radiology workflows |

## Seeded demo data

The demo migration seeds:

- 3 patients with identifiers and clinical flags
- General Ward, HDU, and Maternity Ward
- 8 beds across those wards
- Default system roles and permissions
- Demo staff users for each role

## Current Phase 1 browser workflows

- Login and forced password change
- Patient search-first registration
- Patient profile drawer with identifiers, next of kin, allergies, chronic conditions
- Printable QR card data
- User management
- Role/permission review and role creation
- Tenant settings
- Audit log viewer

## Additional workflows already scaffolded

- OPD check-in, triage, doctor queue, SOAP consultation, diagnosis entry
- Appointments and OPD reports
- Bed dashboard, admissions, emergency dashboard, critical alerts
- Nursing vitals and basic charting
- Clinical reporting dashboard with CSV export

## Architecture documents

- Phase 1 checklist: `docs/phase1-progress-checklist.md`
- Future Theatre, Maternity, ICU, and HDU architecture: `docs/future-clinical-modules-architecture.md`
- Production hardening notes: `docs/production-hardening-notes.md`