# AfyaSasa DHA / HIE integration audit

Inspection date: 2 October 2026.

DHA documentation is treated as authoritative. AfyaSasa must not duplicate DHA as an internal fake database and must not claim an integration complete until the live API flow is tested.

## What exists today

One integration module: `backend/src/integration/sha`.

| AfyaSasa endpoint | DHA / SHA target | Auth | Status |
| --- | --- | --- | --- |
| GET /sha/status | none (local config probe) | JWT patients:read or settings:manage | WORKING — reports mode, whether credentials exist, official portal links |
| POST /sha/eligibility | `{SHA_HIE_BASE_URL}/patients/eligibility` | Bearer tenant token + `X-Facility-Id` FR code | IMPLEMENTED, **REQUIRES DHA CREDENTIALS** |
| GET /sha/eligibility/patient/:id | local `sha_eligibility_checks` | JWT | WORKING — last stored row |
| GET /sha/coverage/patient/:id | local last check | JWT | WORKING — not a live coverage API |

Token URL: `POST {base}/tenants/token` with `client_id` / `client_secret`.  
Default base if unset: `https://ilm-dev.dha.go.ke/uat-middleware/api/v1` (UAT, not production).  
Live `sha_eligibility_checks` rows: **0**.

When credentials are missing, the service returns a disconnected outcome and tells staff to use `portal.sha.go.ke`. It does not invent an eligible member.

## AfyaSasa DHA calls that do not exist

| Required HIE area | AfyaSasa client | Notes |
| --- | --- | --- |
| Authentication beyond SHA tenant token | none except SHA token | |
| Client Registry search / resolve | none | Patient identifiers can store `client_registry`; no CR API client |
| Facility Registry | config `SHA_FACILITY_FR_CODE` only | **REQUIRES FACILITY REGISTRY INFORMATION** |
| Professional Registry | none | |
| Consent / open visit / visit close | none | Theatre has local consent_status only |
| Shared Health Record `/shr/*` | none | Retired draft clinical endpoints are not present in this repo either — do not add them |
| eClaims | none | |
| Preauthorization | none | |
| Terminology | none | |
| DHA callbacks for claim/preauth | none | |
| Biometric HealthID agent | none | `patients.biometric_enrolled` is a boolean flag |

## SHR requirement (not implemented)

Required flow when credentials and current `/shr/*` docs are available:

```text
build FHIR Bundle (unique UUID)
  → POST current SHR API
  → store bundle_id, mediator_id, submission_status, submitted_at
  → track async processing
  → verify persisted resources
  → confirmed_at or failure_reason / retry_count
```

HTTP 200 on submit means accepted/queued, not “SHR synchronized”. Do not implement a fake success flag.

## Consent requirement (not implemented)

Need official DHA consent docs before coding: standard, minor, representative, emergency, refusal, open visit reuse, refresh, close. Tokens must stay server-side. Check for an existing open DHA visit before opening another.

## Client Registry (schema ready, API not)

Store on existing `patient_identifiers`:

- local patient id = `patients.id`
- `type = client_registry`, `value = CR number`
- `verified` already exists; add `verified_at` / `source` only if a column is proven necessary
- Do not overwrite local demographics automatically

Live identifiers: 12 national_id, 1 sha, 0 client_registry.

## Callbacks / resilience

SHA client has no timeout wrapper, no exponential backoff, no dead-letter table, no correlation id column. Eligibility GET can be retried; POST token is not blindly retried in a loop. Full resilience is Phase 20 work after credentials exist.

## Classification

| Item | Bucket |
| --- | --- |
| SHA status screen | WORKING |
| SHA eligibility client | REQUIRES DHA CREDENTIALS — not live-tested |
| Client Registry API | REQUIRES DHA CREDENTIALS + FACILITY REGISTRY INFORMATION |
| SHR | REQUIRES DHA CREDENTIALS — current `/shr/*` docs only |
| Consent / visit | REQUIRES DHA CREDENTIALS |
| Claims / preauth / callbacks | REQUIRES DHA CREDENTIALS |
| Biometric consent | REQUIRES HARDWARE + official HealthID agent docs |
| Fake DHA responses | MUST NOT BE ADDED |
