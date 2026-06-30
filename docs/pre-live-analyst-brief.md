# AfyaSasa — Pre-Live Analyst Brief

**Document type:** Readiness assessment for analyst / supervisor sign-off  
**Version:** 1.0  
**Date:** 2026-06-25  
**Proposed first live:** Reception + OPD (supervised pilot)  
**Environment:** `http://localhost:8080` (Docker demo) · Tenant `demo`

---

## 1. Purpose

This brief is for an **analyst, clinical supervisor, or IT reviewer** who must decide whether AfyaSasa is safe to put in front of reception and outpatient staff for a **short supervised live trial** — before wider hospital rollout.

It is intentionally **short**. Detailed click-through steps live in `docs/onboarding-self-assessment-guide.md`. Test artefacts live in `ops/onboarding-tests/results/`.

---

## 2. Recommendation

| Question | Answer |
|----------|--------|
| **Proceed with supervised reception live?** | **Yes** — with scope limits below |
| **Proceed with unsupervised production go-live?** | **No** — not yet |
| **Proceed with full hospital (IPD, ED, theatre) live?** | **No** — trial-ready only; polish ongoing |

**Suggested pilot:** 1–2 reception desks + 1 triage nurse + 1 OPD doctor, **demo tenant or isolated pilot tenant**, admin on standby for first 2–3 days.

---

## 3. Scope of first live (in scope vs out of scope)

### In scope — train and use this week

| Module | Staff | Core actions |
|--------|-------|----------------|
| Patient Search | Reception | Find patient, view profile |
| Register Patient | Reception | Search-first registration |
| OPD Check-In | Reception | 3-step check-in → triage queue |
| Appointments | Reception | Book, view today/upcoming |
| Referrals | Reception, doctors | Create letter, track status, print |
| Sick Sheets | Reception, doctors | Issue, preview, print, history |
| Medical Documents | Reception | View patient document timeline |
| Triage Queue | Nurses | Vitals, triage category, send to doctor |
| Doctor Queue | Doctors | SOAP, diagnosis, orders, referrals, complete visit |

### Out of scope for first live (demo / trial only)

| Module | Reason |
|--------|--------|
| Full IPD go-live | Functional but needs deeper ward workflow polish |
| Emergency command center | Trial-ready; not reception-critical |
| Theatre scheduling | Form-heavy; internal demo |
| Production hosting / backups | Local Docker only unless infra provisioned |
| SMS / real payment integrations | Stub or config-dependent |
| Multi-tenant production cutover | Use `demo` or dedicated pilot tenant |

---

## 4. What was delivered (summary for analyst)

### Platform

- Clinical EMR: NestJS API + React UI + PostgreSQL + Redis + MinIO + Nginx
- Auth: JWT, RBAC, tenant isolation (`demo`)
- Audit, notifications, patient timeline foundations

### Recent critical fixes (must be on build before live)

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| 1 | FormData / form submit mismatch | Referrals, sick sheets, many forms failed to save | **Fixed** |
| 2 | TypeORM `undefined` in list filters | Appointments, referrals, sick sheets returned 500 | **Fixed** |
| 3 | Mobile nav tiny dropdown | Unusable on phones/tablets | **Fixed** (hamburger + icons) |
| 4 | ICU/HDU under Emergency nav | Wrong clinical model | **Fixed** (under Inpatient) |

### UI standard (reception-facing)

- Card-based layouts, wider spacing (`workspace-shell`)
- Tabbed doctor workspace (Context / Consultation / Investigations / Referrals)
- Live sick sheet preview
- Touch-friendly controls on mobile

---

## 5. Test evidence (objective)

All runs against Docker stack, tenant `demo`, user `admin@demo.afyasasa.local`.

| Test suite | Steps | Result | Script / artefact |
|------------|-------|--------|-------------------|
| OPD + Reception API | 15 | **PASS** | `ops/opd-workflow-test.sh` |
| Inpatient API | 13 | **PASS** | `ops/ipd-workflow-test.sh` |
| UI navigation capture | 10 screens | **PASS** | `ops/onboarding-tests/results/screenshots/` |
| Screen recording | 1 workflow | **PASS** | `ops/onboarding-tests/results/videos/reception-opd-workflow.webm` |
| Stack smoke | Health + login | **PASS** | `npm run smoke` |

### OPD + Reception API path proven (automated)

```text
Login → Search patient → OPD check-in → Triage → Doctor queue →
SOAP → Diagnosis → Referral → Sick sheet → Appointments →
Timeline → Complete visit → List referrals
```

### IPD API path proven (automated, not first-live scope)

```text
Admit → Progress notes (×2) → Vitals → Nursing obs → MAR →
Referral → Discharge summary → Discharge
```

**Gap:** Playwright tests **navigate and screenshot** screens; they do not auto-fill every browser form. Save behaviour is proven via API scripts.

---

## 6. Clinical workflow — first live (one page)

```text
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  RECEPTION  │     │    NURSE     │     │   DOCTOR    │     │  RECEPTION   │
│ OPD Check-In│ ──► │ Triage Queue │ ──► │Doctor Queue │ ──► │ Sick sheet / │
│ (encounter) │     │ vitals+colour│     │ SOAP+orders │     │ appointment  │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
       │                                        │
       └──────────── Referrals / documents ◄────┘
```

**Handoffs to verify manually once:**

1. After check-in → patient appears in Triage Queue  
2. After triage submit → patient appears in Doctor Queue  
3. After complete visit → patient leaves active queue  
4. Sick sheet / referral visible under Medical Documents for same patient  

---

## 7. Access for analyst review

### URLs

| Resource | URL |
|----------|-----|
| Application | http://localhost:8080 |
| API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/docs |

### Credentials (pilot)

| Role | Email | Password | Use for |
|------|-------|----------|---------|
| Administrator | `admin@demo.afyasasa.local` | `ChangeMe123!` | Full walkthrough |
| Records | `records@demo.afyasasa.local` | `ChangeMe123!` | Reception-only view |
| Nurse | `nurse@demo.afyasasa.local` | `ChangeMe123!` | Triage |
| Doctor | `doctor@demo.afyasasa.local` | `ChangeMe123!` | Consultation |

Tenant: **`demo`** for all accounts.

### Analyst review pack (on disk)

| Item | Path |
|------|------|
| This brief | `docs/pre-live-analyst-brief.md` |
| Detailed self-test guide | `docs/onboarding-self-assessment-guide.md` |
| Test report | `ops/onboarding-tests/results/ONBOARDING-REPORT.md` |
| Screenshots (10) | `ops/onboarding-tests/results/screenshots/` |
| Workflow video | `ops/onboarding-tests/results/videos/reception-opd-workflow.webm` |

---

## 8. Analyst sign-off checklist

Analyst completes during **one 60–90 minute session** (or delegates sections).

### A. Infrastructure

- [ ] `npm run smoke` passes
- [ ] App loads at :8080 without console errors on login
- [ ] Hard refresh confirms latest frontend after deploy

### B. Reception (must pass)

- [ ] Patient search returns seeded patients
- [ ] OPD check-in completes 3 steps without error
- [ ] Referral saves (no FormData error)
- [ ] Sick sheet saves + preview + print
- [ ] Appointments list loads (no 500)
- [ ] Medical documents show data for test patient

### C. Clinical handoff (must pass)

- [ ] Triage submit succeeds
- [ ] Doctor SOAP saves
- [ ] Visit can be completed

### D. Governance

- [ ] Roles understood (reception uses `records@` or `admin@` for pilot)
- [ ] Staff know demo data vs real patients policy
- [ ] Escalation path if form fails (admin + `npm run logs`)

### E. Analyst decision

| Decision | Initials | Date |
|----------|----------|------|
| ☐ Approve supervised reception + OPD live | | |
| ☐ Approve with conditions (list below) | | |
| ☐ Do not proceed | | |

**Conditions / notes:**

```text
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## 9. Risks and mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Staff hit old cached frontend | Medium | Hard refresh; rebuild frontend container before pilot |
| Rare 500 on unpolished list screens | Low | Note screen name; check backend logs; hotfix pattern known |
| Duplicate patient registration | Medium | Enforce search-first training |
| Pilot on demo tenant mixes test data | Medium | Use dedicated pilot tenant or clear naming convention |
| No production backup/HA | High for real go-live | Acceptable for **supervised local pilot** only |
| Admin password change prompt | Low | Complete forced change or use non-forced demo user |

---

## 10. Success criteria for “short live” (2 weeks)

| Metric | Target |
|--------|--------|
| Reception check-ins per day without IT intervention | ≥ 90% |
| Referral / sick sheet save success | 100% in pilot |
| Triage → doctor handoff failures | 0 critical |
| Unplanned downtime during desk hours | 0 |
| Staff satisfaction (informal) | “Usable with support” or better |

---

## 11. What happens after short live

| Phase | Focus |
|-------|--------|
| Week 2–3 | IPD ward board + nursing command center polish |
| Week 3–4 | Emergency disposition → admit integration testing |
| Month 2 | Production environment, backups, role hardening |
| Ongoing | Theatre/maternity depth; operations dashboards |

---

## 12. One-paragraph executive summary

AfyaSasa has a working **reception and OPD path** from patient search through check-in, triage, doctor consultation, referrals, sick sheets, and appointments. Critical form-submit and server-list bugs were fixed and verified by **28 automated API steps** plus UI capture artefacts. The system is **suitable for a supervised reception/OPD pilot** on the demo or isolated pilot environment. It is **not** ready for unattended production go-live or full-hospital rollout until IPD polish, infrastructure hardening, and extended UAT are complete.

---

## 13. Related documents

| Document | Audience |
|----------|----------|
| `docs/onboarding-self-assessment-guide.md` | Staff / supervisor doing hands-on testing |
| `ops/onboarding-tests/results/ONBOARDING-REPORT.md` | QA / dev test log |
| `docs/system-status-and-completion-checklist.md` | Long-form module inventory |
| `README.md` | Developers — run instructions |
| `docs/go-live-checklist.md` | Production go-live (future) |

---

*End of analyst brief — v1.0*
