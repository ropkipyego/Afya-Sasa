# AfyaSasa Phase 1 Progress Checklist

Generated: 2026-06-20

## Executive status

Phase 1 is substantially implemented as a runnable foundation for local Cursor IDE use. The system includes infrastructure scaffolding, backend foundations, patient registration/profile workflows, admin screens, notification stubs, and root run scripts.

Docker Compose runtime could not be probed in the cloud machine because Docker is not installed in this environment. The repository is prepared for local Docker execution.

## How to run locally

```bash
cp .env.example .env
npm run dev
```

Demo login:

- Tenant: `demo`
- Email: `admin@demo.afyasasa.local`
- Password: `ChangeMe123!`

The demo admin is forced to change password on first login.

## Completed checklist

### Infrastructure

- [x] Monorepo structure
- [x] NestJS backend scaffold
- [x] React + Vite + TypeScript frontend scaffold
- [x] Tailwind CSS setup
- [x] Docker Compose file
- [x] PostgreSQL service
- [x] Redis service
- [x] MinIO service
- [x] Nginx config
- [x] Root run scripts
- [x] `.env.example`
- [x] README run instructions

### Core backend foundation

- [x] Config module
- [x] TypeORM configured with migrations
- [x] Public tenant registry entity
- [x] Tenant settings entity
- [x] Demo tenant seed
- [x] Tenant resolution middleware from `X-Tenant` / subdomain
- [x] JWT access token login
- [x] Refresh token table
- [x] Hashed refresh tokens
- [x] Logout
- [x] Logout all
- [x] Change password
- [x] Failed-login tracking
- [x] Account lockout logic
- [x] Forced password change flag
- [x] RBAC decorator
- [x] JWT guard
- [x] Permissions guard
- [x] Default roles
- [x] Default permissions
- [x] Role-permission seed
- [x] Audit log entity
- [x] Global audit interceptor
- [x] Append-only audit log DB trigger
- [x] Swagger setup
- [x] Validation pipe
- [x] Helmet security headers

### Patients module

- [x] Patient entity
- [x] Patient identifiers entity
- [x] Patient next of kin entity
- [x] Patient allergies entity
- [x] Patient chronic conditions entity
- [x] Patient registration endpoint
- [x] Patient search endpoint
- [x] Patient detail endpoint
- [x] Patient update endpoint
- [x] Patient soft delete endpoint
- [x] Duplicate detection endpoint
- [x] QR lookup endpoint
- [x] QR card endpoint with data URL
- [x] Patient history stub endpoint
- [x] Identifier create/update/delete
- [x] Next-of-kin create/update/delete
- [x] Allergy create/update/delete
- [x] Chronic-condition create/update/delete
- [x] Patient registration SMS queue event

### Notifications

- [x] Notification templates entity
- [x] Notification queue entity
- [x] SMS logs entity
- [x] Internal notifications entity
- [x] Patient registration SMS template seed
- [x] BullMQ notifications queue
- [x] BullMQ worker
- [x] Stub SMS gateway
- [x] SMS log write after stub send

### Administration

- [x] User management API
- [x] Role API
- [x] Permission listing API
- [x] Role assignment API
- [x] Settings read/update API
- [x] Audit log query API
- [x] User management frontend screen
- [x] Role/permission frontend screen
- [x] Settings frontend screen
- [x] Audit log frontend screen

### Frontend foundation

- [x] Login screen
- [x] Forced password change screen
- [x] Tenant-aware API client
- [x] Refresh-on-401 API wrapper
- [x] Zustand auth store
- [x] TanStack Query setup
- [x] Role-based navigation
- [x] Patient search screen
- [x] Patient registration screen
- [x] Patient profile drawer
- [x] Patient safety banner
- [x] Quick-add identifiers
- [x] Quick-add next of kin
- [x] Quick-add allergies
- [x] Quick-add chronic conditions
- [x] QR card display
- [x] Print card action

### Verification

- [x] Backend build passes
- [x] Frontend build passes
- [x] Backend unit test passes
- [x] Backend production audit has zero vulnerabilities
- [x] Frontend production audit has zero vulnerabilities

## Not complete / known gaps

### Runtime and infrastructure gaps

- [ ] Docker Compose runtime was not verified in this cloud environment because Docker is not installed.
- [ ] Production Docker image startup has not been exercised here.
- [ ] Automated tenant provisioning is not implemented.
- [ ] Full dynamic schema switching per request remains simplified around the seeded `demo` schema.
- [ ] MinIO bucket creation is not automated yet.
- [ ] Nginx SSL termination is configured only as a local HTTP skeleton.

### Core gaps

- [ ] Redis permission caching is not fully implemented.
- [ ] Audit before/after snapshots are not yet complete.
- [ ] Audit read/access events are not comprehensively captured.
- [ ] Platform-admin cross-tenant portal is not implemented.
- [ ] Data-subject export endpoint is not implemented.
- [ ] Full retention policy engine is not implemented.

### Patient gaps

- [ ] Full patient card layout is basic; printable styling can be improved.
- [ ] Patient profile editing UI is mostly quick-add, not full edit forms for every field.
- [ ] Biometric enrollment remains future scope.
- [ ] Photo upload is not implemented.

### Notifications gaps

- [ ] Africa's Talking live provider is not implemented yet.
- [ ] Twilio live provider is not implemented yet.
- [ ] Email/SMTP flow is not implemented yet.
- [ ] Provider callback delivery-status handling is not implemented.
- [ ] Full retry schedule is approximated through BullMQ exponential backoff.

### Testing gaps

- [ ] Endpoint integration tests are minimal.
- [ ] Auth failure / permission-denied endpoint tests are not complete.
- [ ] Browser E2E tests are not implemented.
- [ ] Cross-tenant isolation test suite is not implemented.

## Phase 1 assessment

Phase 1 is usable as a local foundation for continued tweaking and demo workflows, especially registration, profile management, admin configuration, and auth/RBAC exploration. Before production use, the remaining runtime, tenant isolation, audit snapshot, SMS provider, and integration-test gaps should be closed.
