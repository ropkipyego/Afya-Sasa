# 5, 9–10. Data model, security, interoperability

**Date:** 20 October 2026  
PostgreSQL schema name remains `demo` for tenant `jalaram`. Do not rename casually. Do not create duplicate SoT tables.

## Source-of-truth map

| Business entity | Authoritative table(s) | Related, not SoT | Notes |
| --- | --- | --- | --- |
| Patient | `patients` | biometric tables, SHA eligibility rows | Unique `patient_no`. Do not clone for FHIR. |
| Encounter / visit | `encounters` | `visit_queue_items` | Queue is routing, not a second encounter ledger. |
| Admission | `admissions` | wards/beds, transfers | |
| Appointment | `appointments` | | |
| Diagnosis | encounter/clinical documentation fields (verify column-level before HIE mapping) | FHIR map-on-read | Do not invent a parallel diagnosis ledger. |
| Clinical / medication order | `clinical_orders` | JSON metadata; pharmacy worklist mirror | Unique `order_no`; local unique `client_request_id` |
| Laboratory request/result | `lab_requests` (+ result/attachment entities) | visit queue LAB | |
| Imaging request/report | `radiology_requests` (+ reports/attachments) | visit queue RAD | Image **references**, not a PACS archive claim |
| Blood bank request | `blood_bank_requests` (local dirty schema) | must **not** use `inventory_batches` as donor units | Thin desk; 0 rows locally |
| Product catalogue | `inventory_items` | | Unique SKU; local strength/form columns |
| Batches / stock | `inventory_batches`, `inventory_transactions` | requisitions, transfers | FEFO in application; unique batch index **not** listed locally |
| Charge | `charges` | catalogue | Unique `uq_charges_service_entity_active` locally; **0 rows** |
| Payment | `payment_transactions` | M-Pesa/QB side records | Status machine; **no unique receipt index** locally |
| General ledger | **none in EMR** | QuickBooks queue | Do not create a second GL |
| Users / roles | `users` + RBAC tables | | |
| Audit | `audit_logs` | | High volume locally (88 305) vs tiny clinical census |

### Duplicated *concepts* (not duplicate tables)

1. **Orders:** `clinical_orders` vs `lab_requests` vs `radiology_requests` vs pharmacy dispense — correct **domain split** if IDs link; **risk** if UI creates one without the other.
2. **Queues:** `visit_queue_items` vs department worklists — diagnostic check-in bugs historically came from listing the wrong collection.
3. **Money:** charge vs payment vs receipt vs QB — three layers; local DB already shows payments without charges.
4. **Schema name `demo`** vs tenant code `jalaram` — naming debt, not a second tenant database in this compose.

### Orphans / reconciliation (local only)

- 2 `payment_transactions` completed, 0 `charges` → **unlinked or pre-charge-path data**.
- 66 inventory transactions, 2 items, 0 charges → stock history without billing rows on this copy.
- 88 305 audit logs vs 26 patients → audit volume is process/noise, not census.
- 0 `blood_bank_requests` — table exists locally only as empty capability.

**Production reconciliation is not done.** Do not extrapolate these counts to Jalaram live.

### Missing constraints (local)

- `payment_transactions`: no unique business receipt / `client_request_id`.
- `inventory_batches`: no unique (item, batch_no, location) in `pg_indexes` listing this audit.
- Health endpoint: no DB constraint; process-only.

---

## Security and permission findings

| Finding | Severity | Evidence | Impact | Action |
| --- | --- | --- | --- | --- |
| PermissionsGuard is OR-of-keys | High | `auth.guards.ts` `required.some` | A user with any one listed key passes | Review each `@Permissions` list; add AND where needed; tests per handler |
| Insurance UI gated only on `patients:read` | Medium | `navigation.ts` | Broader staff see claims UI; **server must still deny** | Dedicated permission; verify insurance controller guards |
| Health is public and ignores DB | Medium | `health.controller.ts` | Orchestrators mark “healthy” while Postgres is down | Add authenticated or internal ready check with `SELECT 1` — **no PHI** |
| Tenant isolation | Medium | middleware + `tenant-bind.spec` | Cross-tenant leak would be catastrophic | Production verification still missing |
| MFA / email / SMS | Low–Med | flags, Jest mail failures in this run | Operational reset/alert paths degraded locally | Do not enable in prod without config review |
| Audit logs | Medium | interceptor + 88k rows | Useful HTTP trail; not full clinical snapshot | Retention/PII review; do not dump PHI in this pack |
| Secrets | — | not printed | | Keep `.env` out of git/docs |
| Error filter | IPV | J `api-error.filter.spec` | Structured errors | Continue redacting technical internals from clients |

**A hidden button is not authorisation.**

---

## Interoperability and Kenyan requirements

**No certification or live SHA/DHA/HIE connectivity is claimed.**

External standards must be versioned when mapping is approved. This Phase 0 did **not** re-download SHA/DHA implementation guides; treat official MOH/SHA/DHA publications as authoritative when implementation is authorised.

| Capability | Classification | Evidence | External status |
| --- | --- | --- | --- |
| SHA eligibility/coverage API surface | Implemented locally, **not externally tested** | `ShaModule`; J `sha.client.spec` | **Waiting for credentials / sandbox** |
| SHA claims submission | Not evidenced as live | insurance drafts historically | Waiting for credentials + policy |
| FHIR map-on-read (`/integrations/fhir`) | Implemented locally, not a FHIR server | `FhirModule`; J `fhir-mapper.spec` | Not externally tested |
| Patient identity mapping | Partial | patients + SHA entities | Must reuse `patients`, not duplicate |
| Encounter/facility identifiers | Partial | encounters + tenant/facility tables | Confirm Jalaram facility codes against SHA registry **when authorised** |
| Clinical terminology / ICD | Partial | mapper tests; production coding quality unknown | Specification/policy |
| Medications / procedures | Partial | clinical_orders + inventory SKU | Catalogue quality local: 2 items |
| Lab/imaging exchange | Partial | local request/result model | No HIE submit evidenced |
| API authentication to SHA | Waiting | | Credentials |
| Consent | Insufficiently verified | | Policy |
| Auditability of exchange | Partial | audit_logs HTTP | Need message-level idempotency |
| Retry / idempotency / reconcile of HIE | Partial/missing | clinical_orders local unique client_request_id; payments lack unique receipt | Design before build |
| M-Pesa | Implemented in code, not live-verified | J mpesa specs | Waiting for till/credentials; **initiate ≠ paid** |
| QuickBooks | Implemented in code, not live-verified | Jest: credentials not configured | Waiting for QBWC secrets |
| KHIS/MOH aggregate submit | Mapping only | J `moh-mapping.spec` | Not operational |
| Biometrics | Partial | module + tests | Device/policy |
| DHA/HIE beyond SHA/FHIR stubs | Not implemented as certified node | | Specification + legal |

### Mapping discipline (when approved later)

1. Review existing patient and clinical model first.
2. Record standard **name, version, URL, date retrieved**.
3. Map onto existing tables; **no parallel patient identity**.
4. Idempotent outbound messages; reconcile with `audit_logs` + integration tables already present (`sha.entities.ts`), not a new clinical ledger.

---

## Reporting metric skeleton (uncertified)

Until finance/clinical owners sign definitions, treat dashboard figures as **unverified**.

| Metric family | Likely source (code) | Must document before trust |
| --- | --- | --- |
| OPD / patients / admissions | `reporting.service.ts` series sums | Encounter vs check-in vs completed consult |
| Labs / radiology | request tables | Status inclusion (cancelled?) |
| Charges by service line | `charges` via reporting finance helper | Local 0 rows → dashboard may show zeros or fall back — verify |
| Pharmacy stock | inventory tables | On-hand vs FEFO vs location PHARMACY |

---

## Schema change gate (no change authorised now)

Before **any** production schema change:

1. Current schema + applied migration list (production).
2. Why necessary.
3. Affected modules and row counts.
4. Backward compatibility.
5. Validation and reconciliation queries.
6. Rollback.
7. Backup (restorable dump **without** restoring onto prod as a test).
8. Tests.
9. Written approval.

**Do not** use TypeORM `synchronize` or flip `TYPEORM_MIGRATIONS_RUN=true` as a substitute.

**Already sitting in local/dev (not approved for production):**

| Migration | Intent | Local applied? | Prod |
| --- | --- | --- | --- |
| 1771000000000 InventoryStrengthForm | strength/form columns | Yes (columns exist) | Unknown; **do not apply** |
| 1771000000001 ClinicalOrderClientRequestId | unique client_request_id | Yes (index exists) | Unknown |
| 1771000000002 BloodBankRequests | blood bank requests table | Yes (0 rows) | Unknown |

These are **additive**. They still require the gate above because production code at unknown version may not expect them, and unique `client_request_id` can fail if duplicate NULLs/values exist on a real dataset.
