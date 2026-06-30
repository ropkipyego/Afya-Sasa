# AfyaSasa Go-Live Readiness Directive — Master Plan

This document maps the **Final Go-Live Readiness & Production Hardening Directive** (15 sections) to the current codebase, test coverage, and phased delivery plan.

**Principle:** No new clinical modules. Complete, polish, test, and harden what exists until the platform is genuinely production-ready.

**Current overall readiness:** ~55–60% for full hospital go-live; **supervised reception + OPD pilot** is supported after checklist sign-off (`docs/pre-live-analyst-brief.md`).

---

## Phase overview

| Phase | Focus | Target |
|-------|--------|--------|
| **P0** | Blockers for any live use | Doctors from users, file download, inbox UX, env docs, audit query fixes |
| **P1** | Configuration & admin completeness | Hospital settings panels, remove hardcoded fallbacks, catalog UIs |
| **P2** | Documents, notifications, templates | Central storage, notification center, report template engine |
| **P3** | Performance, security, deployment | Indexes, caching, hardening review, production guides |
| **P4** | Full E2E & sign-off | All workflows in Section 12, Section 13 checklist pass |

---

## 1. Complete application audit

**Status:** In progress (exploratory audit completed).

| Area | Status | Notes |
|------|--------|-------|
| Reception / OPD | ✅ Tested | API + Playwright (`ops/opd-workflow-test.sh`, `ops/onboarding-tests/`) |
| IPD / nursing | ✅ API tested | `ops/ipd-workflow-test.sh` |
| Lab / radiology | ⚠️ Partial | Worklists work; some exports fake |
| ED / maternity / theatre | ⚠️ UI polish done | Not production-validated end-to-end |
| Admin / settings | ⚠️ Partial | 8 Hospital Control Center sections still placeholders |
| Placeholder buttons | ⚠️ Remaining | Fake PDF/XLSX exports, 5 disabled reports, theatre UUID inputs |

**Action:** Screen-by-screen audit spreadsheet; hide or wire every button before full go-live.

---

## 2. Remove hardcoded data

**Status:** Partial.

| Item | Source today | Target |
|------|--------------|--------|
| Departments, clinics, visit types | `tenant_settings.clinical_catalog` + fallbacks in `clinical-catalog.ts` | Catalog only; empty hospital must configure before use |
| Doctors | ✅ **Now:** `staffClinicians` from user accounts (`admin.service.ts`) | Remove legacy `assignableDoctors` text list |
| Lab / radiology tests | DB seed + module tables | Admin catalog panels (placeholder) |
| Roles / permissions | DB | Hospital Settings UI exists |
| Wards / beds | Created in IPD + catalog ward/bed types | Fully config-driven |
| Hospital name / branding | `clinical_catalog.hospitalProfile` + tenant | Branding panel (placeholder) |

**Key files:** `frontend/src/lib/clinical-catalog.ts`, `ClinicalConfigPanel.tsx`, migration `1766400000000`.

---

## 3. Database design (files not in PostgreSQL)

**Status:** Architecture correct for radiology attachments; not universal.

- Files stored in MinIO/S3 via presigned URLs (`storage.service.ts`).
- PostgreSQL holds metadata only (`radiology_attachments`, etc.).
- **Gap:** Patient documents, consent forms, referrals not yet unified in a `clinical_documents` table.

---

## 4. File storage

**Status:** Partial.

| Capability | Status |
|------------|--------|
| Presign upload | ✅ `POST /storage/presign-upload` |
| Presign download | ✅ Backend + ✅ **Frontend** `downloadClinicalFile()` |
| Radiology PDF attach | ✅ Upload + download in worklist |
| Other document types | ❌ Not wired |

---

## 5. Notification center

**Status:** Basic.

- In-app notifications for lab verify and radiology verify.
- Inbox UI exists; no realtime push to all event types.
- **Gap:** Tasks, priorities, archive, search, appointment/admission/transfer alerts.

**Key files:** `notifications.service.ts`, notification components in frontend.

---

## 6. Hospital settings (replace “Tenant” terminology)

**Status:** Partial.

`HospitalControlCenter.tsx` sections:

| Section | Status |
|---------|--------|
| Clinical catalog | ✅ |
| Users / roles | ✅ |
| Departments | ✅ |
| Lab catalog | ❌ Placeholder |
| Radiology catalog | ❌ Placeholder |
| Theatre / maternity | ❌ Placeholder |
| Notifications templates | ❌ Placeholder |
| Reporting / branding / superadmin | ❌ Placeholder |

---

## 7. Report template engine

**Status:** Not started.

- Sick sheet has live preview; most printables are hardcoded or stub exporters (`report-exporters.ts`).
- **Required:** Template-based patient card, referral, discharge summary, lab/radiology reports with logo, QR, variables.

---

## 8. Patient card

**Status:** Partial.

- QR generation exists; scan-to-retrieve workflow not implemented.
- Branded print template needed.

---

## 9. Performance

**Status:** Not formally audited.

- List endpoints use `take: 100` in several places.
- **Actions:** Index review, pagination on all tables, lazy loading, Redis permission cache.

---

## 10. Security

**Status:** Foundations present.

| Control | Status |
|---------|--------|
| JWT auth + refresh | ✅ |
| RBAC per endpoint | ✅ |
| Audit logging | ✅ |
| File upload presign | ✅ |
| Rate limiting | ⚠️ Verify production config |
| CSRF | N/A for Bearer API |
| Demo login prefill | ✅ **Removed in production builds** |

---

## 11. Error handling

**Status:** Partial.

- API returns structured NestJS exceptions; frontend `apiRequest` surfaces messages.
- **Gap:** Consistent user-facing copy across all modules; no raw stack traces in UI (verify).

---

## 12. Complete workflow testing

| Workflow | API test | UI test |
|----------|----------|---------|
| Registration → OPD → triage → consult | ✅ | ✅ Playwright |
| Lab | ⚠️ Manual | ❌ |
| Radiology | ⚠️ Manual | ❌ |
| Admission → ward → discharge | ✅ IPD script | ❌ |
| Emergency / maternity / theatre | ❌ | ❌ |

**Scripts:** `ops/run-onboarding-tests.sh`, `ops/opd-workflow-test.sh`, `ops/ipd-workflow-test.sh`.

---

## 13. Go-live checklist

See **`docs/go-live-checklist.md`** (aligned with directive Section 13).

Automated gates:

```bash
npm run preflight
npm run smoke
npm run build
ops/run-onboarding-tests.sh
```

---

## 14. Deployment readiness

**Status:** Docker Compose stack exists; production guides incomplete.

| Deliverable | Status |
|-------------|--------|
| `.env.example` | ✅ Expanded |
| Docker Compose | ✅ postgres, redis, minio, backend, frontend, nginx |
| Installation guide | ⚠️ Partial in README |
| Backup / restore | ⚠️ Scripts referenced in checklist |
| Health checks | ✅ `/health`, admin system health |
| Nginx / Cloudflare / VPS | ⚠️ Document reverse-proxy patterns |

---

## 15. Final quality standard

Unified design language improved (workspace-shell, mobile nav, card worklists). Continue:

- Same patterns across all modules
- Patient-centered workflows
- Minimize clicks
- No placeholder screens visible to clinical users

---

## P0 completed (this sprint)

- [x] Doctors dropdown from user accounts (`listClinicalStaff`, `doctorSelectOptions`)
- [x] Appointments use clinical catalog (not `/admin/users`)
- [x] `downloadClinicalFile()` + radiology attachment download
- [x] Results Inbox shows patient name, MRN, test/modality (not UUID)
- [x] Radiology inbox filters verified reports only
- [x] Audit log list query undefined-where fix
- [x] Demo login email only in `import.meta.env.DEV`
- [x] Production `.env.example` expanded

## P1 completed (this sprint)

- [x] Hospital Control Center: Lab, Radiology, Theatre, Maternity, Notifications, Reporting, Branding, Super Admin panels (no placeholders)
- [x] Theatre workspace replaces UUID dev forms
- [x] QR scan lookup on patient search (`PatientQrLookup`)
- [x] Branded patient card print template
- [x] All 12 reports enabled with backend endpoints
- [x] Printable HTML report exports (PDF downloads as `.html`)
- [x] Notification realtime + header badge + clickable links
- [x] Referral + appointment internal notifications
- [x] Lab/radiology realtime events

## Recommended next work (P2)

1. Build lab and radiology catalog admin panels (replace placeholders).
2. Remove `defaultClinicalCatalog` fallbacks for greenfield hospitals (show “configure in settings” instead).
3. Unified `clinical_documents` metadata table + upload/download for all document types.
4. Expand notification types and Socket.IO realtime.
5. Patient card print template + QR scan route.
6. Replace fake report exporters with template engine MVP.
7. Full workflow API test suite for lab, radiology, ED, maternity.

---

## Related documents

| Document | Purpose |
|----------|---------|
| `docs/pre-live-analyst-brief.md` | Short supervised-live sign-off |
| `docs/onboarding-self-assessment-guide.md` | Hands-on 22-section assessment |
| `docs/go-live-checklist.md` | Pre-deployment checklist |
| `ops/onboarding-tests/results/ONBOARDING-REPORT.md` | Latest automated QA log |
