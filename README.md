# AfyaSasa

Clinical-only Electronic Medical Records platform for Kenyan hospitals.

## Phase 1 foundation included

- NestJS backend in `backend`
- React + Vite + Tailwind frontend in `frontend`
- Docker Compose services for PostgreSQL, Redis, MinIO, Nginx, backend, and frontend
- Initial tenancy, auth/RBAC, audit, patients, and notification foundations

## Run locally

```bash
cp .env.example .env
docker compose up --build
```

Backend API: `http://localhost:3000/api/v1`

Swagger: `http://localhost:3000/docs`

Frontend through Nginx: `http://localhost:8080`