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
npm run stop
npm run build
npm run test
npm run audit
```

## Demo login

- Tenant: `demo`
- Email: `admin@demo.afyasasa.local`
- Temporary password: `ChangeMe123!`

The demo admin is intentionally forced to change password on first login.

## Current Phase 1 browser workflows

- Login and forced password change
- Patient search-first registration
- Patient profile drawer with identifiers, next of kin, allergies, chronic conditions
- Printable QR card data
- User management
- Role/permission review and role creation
- Tenant settings
- Audit log viewer