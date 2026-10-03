# AfyaSasa production changelog — controlled fixes 2 Oct 2026 (afternoon)

Backup: `backups/afyasasa-20261002-115248.sql`

Applied after backup: additive `demo.biometric_*` tables only. Patients 26, payments 2 unchanged.

Rebuilt: backend, frontend, nginx. Postgres/Redis/MinIO left running.

---

# AfyaSasa production changelog — hardening pass 2 Oct 2026

No commit or push was made. No migration was run. No demo seed. No password reset. No production table drop/truncate.

## Code changed this pass (reversible)

| File | Change | Why |
| --- | --- | --- |
| `backend/src/opd/opd.controller.ts` | Doctor queue always uses authenticated request; `doctorId` is optional supervisor filter | Stop client-supplied identity spoofing |
| `backend/src/opd/opd.service.ts` | Queue returns unassigned + assigned-to-actor only; supervisors see all; doctors cannot request another doctor's queue; publish `encounter.updated` on check-in, SOAP, complete, status | Backend enforcement + live update without a new websocket product |
| `backend/src/opd/opd.service.spec.ts` | Doctor A / Doctor B / admin / spoof tests | Prove the filter |
| `frontend/src/App.tsx` | `queryKey: ['doctor-queue', userId]` | Stop cache bleed across logins |

## Inspection artifacts written

All under `docs/`:

- AFYASASA_CURRENT_ARCHITECTURE.md
- AFYASASA_DATABASE_MAP.md
- AFYASASA_API_AUDIT.md
- AFYASASA_MOH_REPORTING_MAP.md
- AFYASASA_DHA_INTEGRATION_AUDIT.md
- AFYASASA_SECURITY_AUDIT.md
- AFYASASA_FINAL_DATA_FLOW.md
- AFYASASA_API_MATRIX.md
- AFYASASA_MOH_MATRIX.md
- AFYASASA_DHA_MATRIX.md
- AFYASASA_SECURITY_MATRIX.md
- this changelog

## Tests

- `opd.service.spec.ts`: 8 passed (including 4 new doctor-queue cases)
- Live: `GET /` 200, `GET /api/v1/health` 200
- Live DB snapshot taken (read-only)

## Not done (correctly blocked)

- No SHR, consent, claims, biometric, or 33 new MOH apps
- No second billing or patient tables
- No invented HRI fields
- No live doctor A/B login (accounts not reset)
- Doctor-queue code is **not** in the running Docker backend until an authorized rebuild

## Deploy note

Do not rebuild or migrate until this diff is reviewed. After rebuild, verify:

1. Doctor assigned at check-in appears only on that doctor's queue
2. Unassigned visits still appear for doctors (pickup pool)
3. Administrator still sees the full queue
4. Existing patients, payments, and users unchanged
