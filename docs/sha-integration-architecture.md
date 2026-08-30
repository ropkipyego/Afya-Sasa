# AfyaSasa SHA / HIE Integration Architecture

**Generated:** 2026-08-28  
**Status:** Readiness assessment — **capture only implemented today**  
**Principle:** AfyaSasa is the local source of truth. SHA/HIE is an external verification and claims-readiness boundary.

---

## 1. What exists today (honest)

| Capability | Status | Implementation |
|------------|--------|----------------|
| SHA number **capture** | ✅ | `PatientIdentifier.type = 'sha'` in registration |
| National ID capture | ✅ | Same identifier model |
| Identifier verification flag | ⚠️ Field only | `verified: boolean` — no external call |
| SHA eligibility API | ❌ | Not implemented |
| SHA claims submission | ❌ | Not implemented |
| HIE / MPI lookup | ❌ | Not implemented |
| FHIR server/client | ❌ | Not implemented |
| Integration queue/retry | ⚠️ Partial pattern | SMS uses BullMQ; no generic integration queue |
| External reference storage | ❌ | No dedicated `external_identifiers` table |

**Do not** present current SHA field as "integrated with SHA". It is **identifier capture for future interoperability**.

---

## 2. Target architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLINICAL UI LAYER                     │
│  Registration · OPD · Billing context · Admin settings   │
│  (NO direct SHA API calls)                               │
└──────────────────────────┬──────────────────────────────┘
                             │
┌──────────────────────────▼──────────────────────────────┐
│              AFYASASA DOMAIN SERVICES                      │
│  patients · encounters · orders · diagnoses · admissions   │
└──────────────────────────┬──────────────────────────────┘
                             │
┌──────────────────────────▼──────────────────────────────┐
│           INTEGRATION ENGINE (to build)                  │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ Identity    │ │ Eligibility  │ │ Claims readiness │  │
│  │ adapter     │ │ adapter      │ │ adapter (future) │  │
│  └─────────────┘ └──────────────┘ └──────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Outbound queue · retry · idempotency · audit        ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────┘
                             │
┌──────────────────────────▼──────────────────────────────┐
│        HIE / NATIONAL INTEROPERABILITY LAYER             │
│  MPI · FHIR gateway · SHA services (when certified)        │
└──────────────────────────────────────────────────────────┘
```

Clinical screens **never** import SHA SDKs or FHIR clients directly.

---

## 3. Patient registration rule

```
PATIENT ARRIVES
  ↓
AFYASASA PATIENT REGISTRY (always succeeds locally)
  ↓
IDENTIFIER CAPTURE (national_id, sha, passport, …)
  ↓
ASYNC: HIE/MPI/SHA VERIFICATION JOB
  ├── SUCCESS → external_reference linked, verified_at set
  └── FAILURE / TIMEOUT → status = pending_verification, retry scheduled
```

**Clinical care continues** if external API is down. UI may show badge: "SHA verification pending" — not blocking unless policy requires it for specific billing workflows.

Current code already supports local-first registration (`patients.service.ts` create with no external dependency).

---

## 4. External identifier model (proposed)

Extend beyond flat `patient_identifiers`:

```sql
-- Proposed: demo.external_identifiers (future migration)
CREATE TABLE external_identifiers (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES patients(id),
  system text NOT NULL,        -- 'afyasasa', 'sha', 'hie_mpi', 'nhif', ...
  value text NOT NULL,
  identifier_type text,        -- 'sha_membership', 'mpi_id', ...
  status text NOT NULL,        -- 'pending', 'verified', 'failed', 'revoked'
  verified_at timestamptz,
  last_checked_at timestamptz,
  source text,                 -- 'registration', 'hie_sync', 'manual'
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system, value)
);
```

**Migration path:** Keep `patient_identifiers` for clinical display; sync or mirror SHA rows into `external_identifiers` when integration engine is built. Do not break existing registration DTOs in P0.

---

## 5. Integration engine components (to build)

### 5.1 Module location

Proposed: `backend/src/integration/`

| Service | Responsibility |
|---------|----------------|
| `IntegrationQueueService` | BullMQ jobs for outbound calls |
| `IdentityVerificationService` | SHA/MPI lookup orchestration |
| `EligibilityService` | Coverage check (future) |
| `ClaimsReadinessService` | Map encounter data to claim bundle (future) |
| `FhirMappingService` | Internal → FHIR Resource transformers |
| `IntegrationAuditService` | Every outbound/inbound attempt logged |

### 5.2 Outbound event pattern

```
OUTBOUND EVENT (e.g. verify_sha_identity)
  ↓ VALIDATE payload
  ↓ ENQUEUE (idempotency key = patient_id + system + operation)
  ↓ WORKER SEND
  ↓ ACK?
      YES → update external_identifier.status = verified
      NO  → retry with backoff → dead letter → admin notification
```

**Idempotency:** Same patient + operation must not create duplicate external registrations if network times out.

### 5.3 Configuration (tenant settings)

Store in `TenantSettings.clinicalCatalog` or dedicated integration JSON:

```json
{
  "integrations": {
    "sha": {
      "enabled": false,
      "mode": "stub",
      "endpoint": "",
      "facilityCode": ""
    },
    "hie": {
      "enabled": false,
      "fhirBaseUrl": ""
    }
  }
}
```

Admin toggles in Control Center — **disabled by default** until certified credentials exist.

---

## 6. FHIR-ready design (mapping layer only)

**Do not** rewrite internal DB to FHIR resources.

```
AFYASASA INTERNAL MODEL          FHIR MAPPING LAYER           HIE
─────────────────────────        ──────────────────          ───
Patient                    →     Patient / RelatedPerson
Encounter                  →     Encounter
Observation (vitals)       →     Observation
Condition (diagnosis)      →     Condition
ServiceRequest (lab/rad)   →     ServiceRequest
DiagnosticReport           →     DiagnosticReport
MedicationRequest          →     MedicationRequest (future)
Procedure                  →     Procedure
Organization (facility)    →     Organization
Practitioner               →     Practitioner
```

Mapping services are **stateless transformers** invoked by integration engine when HIE submission is required.

Existing structured data already supports mapping:

| Data element | Internal location | FHIR readiness |
|--------------|-------------------|----------------|
| Patient identity | `patients`, `patient_identifiers` | Good |
| Encounter | `encounters` | Good |
| Diagnosis | `encounter_diagnoses` | Good (ICD field partial) |
| Vitals | `triage_assessments`, `vital_signs` | Good |
| Lab orders/results | `lab_requests`, `lab_results` | Good |
| Imaging | `radiology_requests`, `radiology_reports` | Good |
| Medication | `clinical_orders` pharmacy metadata | Partial — needs real Rx entity |
| Facility | `tenants`, MOH code | Good |
| Practitioner | `users.kmpdcLicence` | Partial |

---

## 7. SHA data readiness checklist

Data to capture correctly **now** (no fake claim submission):

- [x] Patient demographics + identifiers  
- [x] Encounter type, dates, department  
- [x] Diagnoses (description; ICD-10 code field exists)  
- [x] Lab/radiology orders and results  
- [ ] Coverage reference (not captured — add when SHA contract known)  
- [ ] Consent flags (not implemented)  
- [ ] Service line billing codes (not implemented)  
- [x] Audit trail on mutations  
- [x] Facility MOH code on tenant (may be empty)

---

## 8. UI rules

| Do | Don't |
|----|-------|
| Show "SHA number captured" | Show "SHA verified" without backend proof |
| Show "Verification pending" after failed sync | Block registration when HIE down |
| Admin integration status dashboard | Embed SHA API keys in frontend |
| Capture SHA as optional identifier | Require SHA for emergency care |

Registration form today: SHA is one identifier type among others — **correct for capture-only phase**.

---

## 9. Failure handling

| Scenario | Expected behavior |
|----------|-------------------|
| HIE timeout on verify | Patient registered; external_identifier `pending`; retry job |
| Invalid SHA number | Mark `failed`; staff can correct identifier |
| Duplicate MPI match | Flag for records officer review; do not auto-merge |
| Claims API down | Clinical workflow unaffected; claims queue holds |

Reuse BullMQ pattern from `notifications/notification.processor.ts`.

---

## 10. Audit & certification boundary

Every integration attempt logs:

- `operation` (verify_identity, check_eligibility, submit_claim)  
- `patient_id` / `encounter_id`  
- `request_payload_hash` (not full PHI in logs if policy forbids)  
- `response_status`  
- `external_reference` returned  
- `user_id` who triggered (if manual)  
- `timestamp`  

**Certification boundary:** Live SHA/HIE credentials and endpoints are deployed only after:

1. Sandbox UAT pass  
2. Legal/data-sharing agreement  
3. Admin enables integration in settings  
4. Pilot with synthetic then real data under supervision  

AfyaSasa codebase remains **integration-ready**, not **integration-certified**.

---

## 11. Implementation priority (P3)

| Step | Effort | Dependency |
|------|--------|------------|
| 1. `external_identifiers` migration | Small | None |
| 2. Integration module stub + queue | Medium | Redis/BullMQ (exists) |
| 3. Stub identity adapter (returns pending) | Small | Step 2 |
| 4. Admin integration status panel | Small | Step 3 |
| 5. FHIR Patient/Encounter mappers | Medium | Step 1 |
| 6. Live SHA adapter (when keys available) | Large | Certification |
| 7. Eligibility + claims adapters | Large | SHA contract |

**Do not start step 6 until P0/P1 clinical workflows are stable.**

---

## 12. Current vs target summary

| Layer | Today | Target |
|-------|-------|--------|
| Identifier capture | ✅ | ✅ (keep) |
| Local source of truth | ✅ | ✅ (keep) |
| Integration boundary | ❌ | Module + queue |
| External references | ❌ | `external_identifiers` |
| FHIR mapping | ❌ | Adapter services |
| Retry/idempotency | ❌ | BullMQ workers |
| Clinical UI SHA logic | ✅ None (correct) | ✅ None (keep) |

**Completion: ~15% (capture + data model foundations only)**
