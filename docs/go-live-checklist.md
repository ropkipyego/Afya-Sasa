# AfyaSasa Go-Live Checklist

Aligned with the **Final Go-Live Readiness Directive** (Section 13). Complete before production deployment.

**Legend:** `[x]` = implemented in repo / automated test exists · `[ ]` = requires manual VPS or UAT sign-off

---

## Deployment

- [ ] Production VPS provisioned (see `docs/contabo-deployment-guide.md`)
- [ ] TLS configured (Let's Encrypt) and `FRONTEND_ORIGIN` matches public URL
- [ ] Daily Postgres backups scheduled and restore tested once

## Build & runtime

- [x] Environment variables documented (`.env.example`)
- [x] `npm run build` succeeds without errors
- [x] `npm run test:workflows` script exists (runs all API acceptance tests)
- [ ] `cp .env.example .env` and set production secrets on target server
- [ ] `npm run preflight` passes on target server
- [ ] `npm run dev` starts all containers (or production compose)
- [ ] `npm run smoke` passes on running stack
- [ ] Docker deployment succeeds (`docker compose up -d --build`)
- [ ] Backend health responds (`GET /api/v1/health`)
- [ ] Frontend loads through reverse proxy (e.g. `http://localhost:8080`)
- [ ] Swagger loads at `/docs` (restrict in production)

---

## UI quality gates

- [x] OPD check-in shows doctor name (not UUID) on review step
- [x] Clinical orders dashboard shows patient names
- [x] Pharmacy dispense button on pharmacy orders
- [x] Inventory & store UI (stock, requisitions, receive)
- [x] Dedicated pharmacy workspace (queue + prescribe + dispense)
- [ ] Every button performs its action, navigates, saves, validates, or is hidden (full UI audit)
- [ ] Every form validates correctly
- [ ] Every search functions
- [ ] Autocomplete works (patient search)
- [ ] All dropdowns load from configuration (not hardcoded IDs)
- [ ] No console errors on core workflows
- [ ] No broken routes
- [ ] No placeholder screens visible to clinical users
- [ ] No hardcoded IDs or names in production UI
- [ ] No mock data visible
- [x] Production build has no demo login pre-fill

---

## Authentication & accounts

- [x] Jalaram tenant default (`DEFAULT_TENANT_CODE=jalaram`)
- [x] Admin login credentials documented (`it@jalaram.co.ke`)
- [ ] Admin / doctor / nurse / reception / lab / radiology login verified on deploy
- [ ] Doctor accounts appear in appointment and OPD doctor dropdowns
- [ ] Permissions enforced correctly per role
- [ ] Session expiration behaves as expected
- [ ] Force password change on first login (if enabled)

---

## Core clinical flows

- [x] OPD check-in persists preferred doctor (`attendingDoctorId`)
- [x] Encounter workflow guards invalid status transitions
- [x] Lab review returns encounter to `in_consultation` when complete
- [x] Radiology review returns encounter to `in_consultation` when complete
- [x] Pharmacy prescribe → dispense → stock ledger (API)
- [ ] Register patient (manual UI)
- [ ] Search patient
- [ ] Open patient profile
- [ ] Review patient clinical timeline
- [ ] Record triage (UI)
- [ ] Complete doctor consultation (SOAP, diagnosis) (UI)
- [ ] Create referral
- [ ] Issue sick sheet
- [ ] Book appointment
- [ ] Create lab request → collect → enter → verify → review (UI)
- [ ] Create radiology request → report → verify → review (UI)
- [ ] Results inbox shows patient context (not raw UUIDs)
- [ ] Create ward and bed
- [ ] Admit patient (UI)
- [ ] Record vitals / MAR / shift notes
- [ ] Discharge summary and discharge

**Automated API coverage:** `npm run test:workflows` (OPD, IPD, lab, radiology, inventory, pharmacy)

---

## Documents & files

- [ ] MinIO bucket exists and is private
- [ ] Signed upload URL works
- [ ] Signed download URL works (radiology attachments)
- [ ] Documents generate correctly (sick sheet preview minimum)
- [ ] File uploads validate type and size

---

## Notifications & audit

- [x] Lab result notification on verify (service wired)
- [x] Radiology notification on verify (service wired)
- [ ] Notification inbox loads (UI UAT)
- [ ] Audit logs visible in admin
- [ ] Audit events generated for sensitive actions

---

## Specialty flows (before full hospital go-live)

- [ ] Emergency registration and disposition
- [ ] Theatre booking (no raw UUID inputs)
- [ ] Maternity ANC / labour / delivery
- [ ] ICU / HDU under IPD ward types

---

## Operations

- [x] Backup script exists (`ops/backup-postgres.sh`)
- [x] Restore script exists (`ops/restore-postgres.sh`)
- [x] Contabo deployment guide (`docs/contabo-deployment-guide.md`)
- [x] Database migrations include inventory engine + Jalaram numbering
- [ ] Backup script tested on production server
- [ ] Restore script tested once
- [ ] Database migrations run cleanly on fresh install (verify on VPS)

---

## Automated tests (run before sign-off)

```bash
npm run smoke                 # health + login
npm run test:workflows        # full API suite

# Individual scripts:
ops/opd-workflow-test.sh      # reception + OPD + workflow guard
ops/ipd-workflow-test.sh      # admit + census + discharge
ops/lab-workflow-test.sh      # lab round trip + encounter status
ops/radiology-workflow-test.sh
ops/inventory-workflow-test.sh
ops/pharmacy-workflow-test.sh # prescribe + FEFO dispense + ledger
ops/run-onboarding-tests.sh   # Playwright UI navigation
```

---

## Known production blockers (full hospital)

- [ ] Full dynamic multi-tenant schema switching
- [ ] Cross-tenant isolation tests
- [x] Main store requisitions + transfers (requisitions + transfer UI/API; full UAT pending)
- [ ] Report template engine (no fake PDF/XLSX)
- [ ] Patient card QR scan workflow
- [ ] SMTP email transport
- [ ] Real SMS provider (Celcom keys)
- [ ] Load testing
- [ ] External security review

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Clinical lead | | | |
| IT / admin | | | |
| Analyst / supervisor | | | |

For supervised reception + OPD pilot: run `npm run test:workflows` and complete manual UI walkthrough in `docs/core-workflow-test-plan.md`.
