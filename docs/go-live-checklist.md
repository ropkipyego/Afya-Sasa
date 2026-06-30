# AfyaSasa Go-Live Checklist

Aligned with the **Final Go-Live Readiness Directive** (Section 13). Complete before production deployment.

---

## Build & runtime

- [ ] `cp .env.example .env` and set production secrets
- [ ] `npm run preflight` passes
- [ ] `npm run dev` starts all containers (or production compose)
- [ ] `npm run smoke` passes
- [ ] `npm run build` succeeds without errors
- [ ] Docker deployment succeeds (`docker compose up -d --build`)
- [ ] Backend health responds (`GET /api/v1/health`)
- [ ] Frontend loads through reverse proxy (e.g. `http://localhost:8080`)
- [ ] Swagger loads at `/docs` (restrict in production)
- [ ] Environment variables documented (`.env.example`)

---

## UI quality gates

- [ ] Every button performs its action, navigates, saves, validates, or is hidden
- [ ] Every form validates correctly
- [ ] Every search functions
- [ ] Autocomplete works (patient search)
- [ ] All dropdowns load from configuration (not hardcoded IDs)
- [ ] No console errors on core workflows
- [ ] No broken routes
- [ ] No placeholder screens visible to clinical users
- [ ] No hardcoded IDs or names in production UI
- [ ] No mock data visible
- [ ] Production build has no demo login pre-fill

---

## Authentication & accounts

- [ ] Admin login works
- [ ] Doctor login works
- [ ] Nurse login works
- [ ] Reception login works
- [ ] Lab login works
- [ ] Radiology login works
- [ ] Doctor accounts appear in appointment and OPD doctor dropdowns
- [ ] Permissions enforced correctly per role
- [ ] Session expiration behaves as expected
- [ ] Force password change on first login (if enabled)

---

## Core clinical flows

- [ ] Register patient
- [ ] Search patient
- [ ] Open patient profile
- [ ] Review patient clinical timeline
- [ ] OPD check-in
- [ ] Record triage
- [ ] Complete doctor consultation (SOAP, diagnosis)
- [ ] Create referral
- [ ] Issue sick sheet
- [ ] Book appointment
- [ ] Create lab request → collect → enter → verify → review
- [ ] Create radiology request → report → verify → review
- [ ] Results inbox shows patient context (not raw UUIDs)
- [ ] Create ward and bed
- [ ] Admit patient
- [ ] Record vitals / MAR / shift notes
- [ ] Discharge summary and discharge

---

## Documents & files

- [ ] MinIO bucket exists and is private
- [ ] Signed upload URL works
- [ ] Signed download URL works (radiology attachments)
- [ ] Documents generate correctly (sick sheet preview minimum)
- [ ] File uploads validate type and size

---

## Notifications & audit

- [ ] Lab result notification fires on verify
- [ ] Radiology notification fires on verify
- [ ] Notification inbox loads
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

- [ ] Backup script tested
- [ ] Restore script tested
- [ ] Database migrations run cleanly on fresh install
- [ ] Update / rollback procedure documented

---

## Automated tests (recommended before sign-off)

```bash
ops/opd-workflow-test.sh      # 15-step reception + OPD API
ops/ipd-workflow-test.sh      # 13-step IPD API
ops/run-onboarding-tests.sh   # API + Playwright UI
```

---

## Known production blockers (full hospital)

- [ ] Full dynamic multi-tenant schema switching
- [ ] Cross-tenant isolation tests
- [ ] Lab / radiology catalog admin UIs (not placeholders)
- [ ] Report template engine (no fake PDF/XLSX)
- [ ] Patient card QR scan workflow
- [ ] SMTP email transport
- [ ] Real SMS provider (Africa's Talking / Twilio)
- [ ] Load testing
- [ ] External security review

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Clinical lead | | | |
| IT / admin | | | |
| Analyst / supervisor | | | |

For supervised reception + OPD pilot only, use **`docs/pre-live-analyst-brief.md`**.
