# AfyaSasa BB-0 — Blood-bank architecture audit and implementation roadmap

**Date:** 21 October 2026 (Africa/Nairobi)  
**Nature:** Read-only discovery. **No application behaviour change except this report file.**  
**Baselines:** Phase 0–4 audits; Phase 3 blood-bank/revenue note; Phase 5A diagnostic inspection (in-chat).  
**Repository:** `/home/yobra/Desktop/Afya-Sasa-1/Afya-Sasa`

```
PRODUCTION CONNECTED: NO
DATABASE QUERIED THIS PASS: NO
MIGRATIONS / SEED / SYNCHRONIZE: not run; flags not changed
COMMITS / PUSH / RESET / STASH / CHECKOUT: NONE
SCHEMA NAME: demo (not renamed)
TENANT: jalaram alias not rewritten
PARALLEL SoT TABLES CREATED THIS PASS: none
BROWSER / LOGGED-IN UAT: NO
```

Evidence labels used below: **VERIFIED IN SOURCE**, **TESTED IN ISOLATED TESTS**, **PARTIAL**, **MISSING**, **NOT VERIFIED**.

Historical reports in `docs/audits/` were not deleted.

---

## 1. Executive summary

AfyaSasa currently has a **laboratory patient-request desk**, not a transfusion service.

**What exists (source):**

- Patient blood **requests** (`demo.blood_bank_requests`): product, quantity, optional encounter/admission, free-text grouping and crossmatch, statuses `requested → grouped → crossmatched → issued` (or `cancelled`).
- A **proposed unit ledger** (`BloodBankUnit` + unapplied migration `1771000000003`) with status/screening fields and a stock summariser that **fails closed** if the table is absent.
- One UI (`BloodBankDesk`) under Laboratory → Blood Bank.
- Isolated Jest coverage for request transitions, issue permission, missing-units dashboard, and unit **bucket maths**.

**What does not exist (source search for `donor`, `transfusion`, `haemovigilance`, `knbts` in `.ts`/`.tsx`: zero matches):**

- Donors, consent, eligibility, deferral, donation events, samples linked to donations, TTI result records, external processing referrals.
- Supplier identity, delivery notes, quarantine inspection, recall registers.
- Movement ledger (receipt/issue/return as auditable stock events).
- Compatibility calculation, antibody panels, electronic crossmatch against a named unit.
- Ward handover, transfusion start/stop/outcome, reactions, bidirectional recipient–unit trace.

**Stock dashboard “unavailable” — root cause VERIFIED IN SOURCE:**  
`GET /laboratory/blood-bank/stock` returns `available: false` when `information_schema` has no `demo.blood_bank_units`. The UI then shows that reason and **request** counts, not KES/unit zeros. The units migration is **written and untracked, not applied** in this working tree. Whether any local or production database already has that table was **not re-queried** this pass.

**Recommendation:** Do **not** treat the current module as production transfusion. Proceed to **BB-1** only after review: reuse the existing unit entity (do not invent a second unit table); do **not** apply `1771000000003` until duplicate `unit_no` scan and written approval. Donor collection (BB-3) needs **new** records and clinical policy — stop for approval before schema.

Jalaram scope (external prepared components **and** local collection; no assumed in-house component preparation; pathway through handover and outcome) is **largely unimplemented**. Local collection must not enter `available` inventory until screening/release is documented — current unit code can set `screeningStatus=released` and `status=available` in **one** API call without storing TTI results (**CONFIRMED GAP**).

---

## 2. Verified current architecture and baseline

| Item | Value | Evidence |
| --- | --- | --- |
| Branch | `main` tracking `origin/main` | `git status -sb` |
| HEAD | `4a31826e7a5ce3c853b8f63f8c517fd5ec04428e` | `git rev-parse` |
| Dirty tree | **50** modified, **40** untracked (90 short-status lines) before this report | `git status --short` |
| `synchronize` | **false** (hard-coded) | `backend/src/app.module.ts` |
| `migrationsRun` | only if `TYPEORM_MIGRATIONS_RUN === 'true'` | same |
| Compose pins | `TYPEORM_MIGRATIONS_RUN: "false"`, `AFYASASA_ALLOW_DEMO_SEED: "false"` | `docker-compose.yml` (prior Phase 0/1) |

**Relevant source (all currently dirty or untracked, not on HEAD):**

| Path | Role |
| --- | --- |
| `backend/src/laboratory/blood-bank.entities.ts` | Request entity |
| `backend/src/laboratory/blood-bank-unit.entities.ts` | Unit entity |
| `backend/src/laboratory/blood-bank.service.ts` | Service |
| `backend/src/laboratory/blood-bank-policy.ts` | Request transitions + issue gates + metric copy |
| `backend/src/laboratory/blood-bank-stock.ts` | Unit buckets, unit transitions |
| `backend/src/laboratory/blood-bank.spec.ts` | Request + missing-table tests |
| `backend/src/laboratory/blood-bank-stock.spec.ts` | Gates + summarise tests |
| `backend/src/database/migrations/1771000000002-BloodBankRequests.ts` | Requests table SQL |
| `backend/src/database/migrations/1771000000003-BloodBankUnits.ts` | Units table SQL **unapplied in source comments** |
| `backend/src/laboratory/laboratory.controller.ts` | HTTP routes |
| `backend/src/laboratory/laboratory.module.ts` | Registers both entities + `BloodBankService` |
| `frontend/src/components/investigations/BloodBankDesk.tsx` | Only blood-bank screen |
| `frontend/src/components/investigations/LabModule.tsx` | Tab `bloodbank` |
| `frontend/src/App.tsx` | Screen `Blood Bank` → LabModule |
| `frontend/src/lib/navigation.ts` | Nav `lab_requests:read` |

**Re-verification of historical findings:**

| Historical claim | This pass |
| --- | --- |
| Request flow `requested → grouped → crossmatched → issued` | **VERIFIED IN SOURCE** (`blood-bank-policy.ts` `REQUEST_TRANSITIONS`) |
| Status names imply grouping/crossmatch **tests** | **PARTIAL** — only non-empty **strings** required at issue (`assertBloodBankIssueReady`). No unit, sample, or antibody record. |
| `demo.blood_bank_units` not available | **VERIFIED IN SOURCE** that the **code path treats absence** as unavailable stock. **NOT VERIFIED** whether any database already has the table (no SQL this pass). Phase 0 locally counted `blood_bank_requests` = 0; that count was **not repeated**. |

Pharmacy `inventory_batches` is **not** referenced by blood-bank create (**TESTED IN ISOLATED TESTS**: `blood-bank.spec.ts` “refuses to use pharmacy inventory lots”).

---

## 3. Source-of-truth data model

Authoritative existing clinical/finance tables (patients, encounters, admissions, lab requests, charges, payments, pharmacy inventory, audit logs) remain those domains. Blood bank must **not** duplicate them.

| Domain | Entity / table | PK | Related | Service | Route | UI | Tests | Label |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Patient request | `BloodBankRequest` / `demo.blood_bank_requests` | uuid | Patient, Encounter?, Admission? | `BloodBankService` | `GET/POST /laboratory/blood-bank`, `POST .../:id/status` | `BloodBankDesk` | `blood-bank.spec.ts`, policy tests | **PARTIAL** (desk only) |
| Unit / component | `BloodBankUnit` / `demo.blood_bank_units` | uuid; unique `unit_no` | `reserved_request_id`, `issued_request_id` (uuid columns, **no FK in migration**) | same | `POST .../units`, `POST .../units/:id/status`, `GET .../stock` | Stock **read** only; **no register UI** | stock maths + missing-table | **PARTIAL**; table **unapplied** in source |
| Donors / history | — | — | — | — | — | — | — | **MISSING** |
| Eligibility / consent / deferral | — | — | — | — | — | — | — | **MISSING** |
| Donation event | — | — | `collected_at` optional on unit only | registerUnit | API only | none | none | **MISSING** as donation |
| Samples / TTI results | — | — | `screening_status` enum on unit | transitionUnit | API | none | bucket tests | **MISSING** as results |
| External lab / processing referral | — | — | — | — | — | — | — | **MISSING** |
| Supplier / delivery | — | — | — | — | — | — | — | **MISSING** |
| Storage equipment | — | — | `location` varchar | registerUnit | API | none | none | **MISSING** (free text) |
| Stock movements | — | — | Status overwrite on unit | transitionUnit | API | none | transition helpers | **MISSING** ledger |
| Request items (per unit) | — | — | Request has numeric `units` only | — | — | — | — | **MISSING** |
| Patient grouping sample | — | — | `grouping_result` varchar | updateStatus | desk form | none | string-not-empty | **PARTIAL** |
| Crossmatch vs named unit | — | — | `crossmatch_result` varchar | updateStatus | desk | none | string-not-empty | **PARTIAL** |
| Issue | request `issued_at`; unit `issued_at` | — | **not joined in issue of request** | updateStatus / transitionUnit | desk issues **request**, not unit | isolated | **PARTIAL** |
| Ward handover | — | — | — | — | — | — | — | **MISSING** |
| Transfusion outcome | — | — | — | — | — | — | — | **MISSING** |
| Return / discard / recall / reaction | discard/expired/quarantine **unit statuses** only | — | `last_reason` | transitionUnit | API only | policy/stock | **PARTIAL** (status only) |
| Audit | HTTP interceptor (all POST except health/docs) | audit log | `created_by` / `updated_by` | `audit.interceptor.ts` | implicit | interceptor specs | **PARTIAL** (HTTP, not haemovigilance) |
| Reporting | requestWorkload on stock payload | — | — | `stock()` | desk | none dedicated | **PARTIAL** |

**Auditable columns (VERIFIED IN SOURCE):** both entities extend `SoftDeleteClinicalEntity` (`id`, `created_by`, `created_at`, `updated_by`, `updated_at`, `deleted_at`).

**Do not add a second unit table.** The existing `BloodBankUnit` design is the intended unit SoT. It is incomplete (no supplier, no TTI rows, no movements) but **reusing it is safer** than a parallel fridge table. Pharmacy lots must stay pharmacy.

---

## 4. External supply workflow

**MISSING / PARTIAL.** `registerUnit` records: `unitNo`, `product`, `bloodGroup`, `expiresAt`, optional `collectedAt`, optional `location`, `receivedAt=now()`, `screeningStatus=awaiting_screening`, `status=received`, actor ids.

**Not recorded:** supplier (KNBTS or other), delivery/document reference, ISBT/traceability label beyond `unit_no`, collection/preparation site, TTI certificates, inspection pass/fail, discrepancy, recall lot.

Receipt **does** create one identifiable unit **if** the units table exists. It does **not** create a movement row. Acceptance into `available` is a later `transitionUnit` (see §8).

UI for receipt: **MISSING** (`BloodBankDesk` never calls `POST /laboratory/blood-bank/units`).

---

## 5. Local donor / collection workflow

**MISSING** as a domain. No donor ID, consent, eligibility, deferral, donation volume, sample IDs, TTI panels, authorised review, donor adverse events, or confidentiality-scoped donor screens.

`collected_at` on a unit is an optional timestamp, not a donation record.

**Jalaram does not perform component preparation (agreed).** Any “processing” step in future design is a **question for confirmation**, not implemented functionality. WHO distinguishes **blood establishments** (collection, testing, processing, distribution) from **hospital blood banks** (storage, compatibility, issue). AfyaSasa today is closer to a thin hospital request list.

**Local donation must not become `available` until release is documented.** Source allows `screeningStatus: 'released'` in the same POST as `status: 'available'` without storing HIV/HBV/HCV/syphilis (or other) results — **CONFIRMED GAP**, not a completed test.

Donor medical data: no screens exist; future donor records **must not** sit on a general `lab_requests:read` worklist. That is a policy + permission question (BB-3/BB-7).

---

## 6. Patient-to-transfusion workflow

Traced frontend → API → service → persistence.

| Step | What code does | Label |
| --- | --- | --- |
| 1. Clinical request + patient | `POST /laboratory/blood-bank` with `patientId`; encounter/admission **optional** and **not sent by UI** | **PARTIAL** |
| 2. Component, qty, indication, urgency, clinician | product + numeric `units` + optional indication. **No urgency. Clinician = `createdBy` only.** | **PARTIAL** |
| 3. Patient/sample identity | no sample barcode, no phlebotomy time | **MISSING** |
| 4. Blood group | free-text `groupingResult` / optional `patientBloodGroup` | **PARTIAL** |
| 5. Crossmatch | free-text `crossmatchResult`; **not** tied to a unit | **PARTIAL** |
| 6. Reservation of eligible units | `transitionUnit` `reserved` + `reservedRequestId`; **no UI**; no eligibility check beyond transition map | **PARTIAL** |
| 7. Duplicate reservation / double issue | Request re-issue blocked (status lock). Unit re-issue blocked if already `issued`. **Two units can be reserved for one request; request `units` not checked. Request can be issued with zero units issued.** | **CONFIRMED GAP** |
| 8. Authorised issue | Request: `lab_results:verify` **in service** if status=`issued`; grouping+crossmatch strings required. Controller still OR `enter`\|`verify`. Unit issue also requires verify. **Request issue does not consume units.** | **PARTIAL** |
| 9. Ward handover | — | **MISSING** |
| 10. Transfusion start/complete | — | **MISSING** |
| 11. Outcome / return / discard | unit `discarded`/`available` from reserved; no clinical outcome | **MISSING** |
| 12. Reaction / notification / trace | — | **MISSING** |

**Status meanings in code (do not infer from names):**

| Status | Meaning in source |
| --- | --- |
| `requested` | Row saved. No payment, sample, or unit link. |
| `grouped` | Staff chose next status; may also post grouping text. **No rule that grouping text is present until issue.** |
| `crossmatched` | Same for crossmatch text. |
| `issued` | Timestamp set; verify permission + both strings non-empty. **Does not mean a unit left the fridge.** |
| `cancelled` | Terminal. No reason field on the request entity. |

---

## 7. Screen, API and permission inventory

### HTTP (`LaboratoryController`)

| Method | Path | Permission (OR of keys) | Extra service rule |
| --- | --- | --- | --- |
| GET | `/laboratory/blood-bank` | `lab_requests:read` | empty list if requests table missing |
| GET | `/laboratory/blood-bank/stock` | `lab_requests:read` | `available:false` if units table missing |
| POST | `/laboratory/blood-bank` | `lab_requests:create` | product/qty validation |
| POST | `/laboratory/blood-bank/:id/status` | `lab_results:enter` **or** `lab_results:verify` | issue requires **verify** |
| POST | `/laboratory/blood-bank/units` | `create` **or** `enter` | blocked if units table missing |
| POST | `/laboratory/blood-bank/units/:id/status` | `enter` **or** `verify` | issue requires **verify** |

No dedicated `blood_bank:*` permission. Role templates: **no blood-bank role**. `lab_technician` template keys (`lab_samples:update`, `lab_results:create`) **do not match** collect/enter/verify used by these routes (**PARTIAL** / potential live-RBAC mismatch — live rows **NOT VERIFIED**).

Nav: `Blood Bank` requires `lab_requests:read` only. Anyone who can read lab requests can open the desk and **see** stock/request lists. Mutating still needs create/enter/verify.

HTTP audit interceptor records mutations unless `/health` `/ready` `/docs` (`audit.interceptor.ts`). **NOT** a haemovigilance case file.

### Screens

| Screen | Permission (nav) | API | Counts | Empty / error | Actions validated on server? |
| --- | --- | --- | --- | --- | --- |
| Blood Bank / Lab tab | `lab_requests:read` | list + stock + create + status | stock metrics **only if** `available:true`; else request workload | loading; empty “No blood bank requests”; stock error Alert **not zero**; unavailable Alert | create/status yes; **unit register/transition not in UI** |
| Laboratory overview | same LabModule | not blood-specific | — | — | — |

Forbidden: standard 403 via `PermissionsGuard`; no dedicated blood-bank forbidden copy. **NOT VERIFIED** in browser.

No expiry, wastage, recall, reaction, or traceability **reports**. MOH 706 is general laboratory, not haemovigilance.

---

## 8. State-transition matrix

### Requests (`blood-bank-policy.ts`) — VERIFIED IN SOURCE / TESTED

| From | Allowed | Blocked (examples) |
| --- | --- | --- |
| requested | grouped, cancelled | issued, crossmatched |
| grouped | crossmatched, cancelled | issued, requested |
| crossmatched | issued, cancelled | grouped |
| issued | none | any |
| cancelled | none | any |
| same status | error “already in that status” | |

Issue additionally: non-empty grouping **and** crossmatch strings; `lab_results:verify`.

### Units (`blood-bank-stock.ts` `UNIT_TRANSITIONS`) — VERIFIED IN SOURCE

| From | Allowed |
| --- | --- |
| received | available, quarantined, expired, discarded |
| available | reserved, quarantined, expired, discarded |
| reserved | issued, available, quarantined, expired, discarded |
| issued | none |
| expired | discarded |
| quarantined | available, discarded, expired |
| discarded | none |

`available` also requires `screeningStatus === 'released'` and not expired (`assertUnitMayBecomeAvailable`).

**Not in matrix:** handover, transfusing, returned-awaiting-reassessment, recalled.

---

## 9. Stock calculation and reconciliation

**Authoritative calculation when the units table exists (VERIFIED IN SOURCE, TESTED IN ISOLATED TESTS):**

- Stock is **not** a stored quantity and **not** a sum of movement rows.
- Each unit is assigned **one** `primaryUnitBucket` (discarded / issued / expired / quarantined_or_awaiting / reserved / available / held).
- `physicalOnHand` = not discarded and not issued (includes quarantine, reserved, expired-on-shelf).
- `availableForIssue` = bucket `available` only (`status=available` **and** `screening=released` **and** not expired).
- `issuedInPeriod` counts `issuedAt` in range, once per unit.
- `nearingExpiry` is an overlay (7 days), not added into on-hand.
- `byGroup` uses on-hand units.
- Cap: `units.find({ take: 5000 })` — overflow **NOT VERIFIED** / risk if >5000 rows.

**When the table is absent:** `available: false`, **no** `availableForIssue: 0` (**TESTED**). Request `units` numeric field is **requested quantity**, not fridge count.

**Inconsistency risks (CONFIRMED in source):**

1. Request `status=issued` vs zero units with `issued_request_id`.
2. Unit `status` vs `screeningStatus` vs expiry (bucket prefers status issued/discarded first, then expiry).
3. `reserved` via `status` **or** `reservedRequestId` (bucket ORs them).
4. No movement sum to reconcile against status.
5. Request `units` (e.g. 2) never compared to reserved/issued unit count.

**Do not use pharmacy FEFO lots as blood units.**

---

## 10. Confirmed defects, potential risks, unverified

### Confirmed (source / isolated tests)

| ID | Finding | Severity |
| --- | --- | --- |
| D1 | Units table migration not applied in source; stock API fail-closed | Blocks fridge dashboard |
| D2 | No donor/collection/TTI/supplier/handover/transfusion/reaction domains | Blocks target scope |
| D3 | Request issue does not issue or reserve units | False “issued” |
| D4 | Grouping/crossmatch are unconstrained strings; compatibility **explicitly not calculated** | Clinical safety |
| D5 | `screeningStatus` can be set to `released` in the same call as `available` with no TTI evidence | Unsafe release |
| D6 | Reserve does not assert screening released / not expired (only transition from `available`) | Medium if operators skip path |
| D7 | No UI for unit receipt/transition | API-only, easy to ignore |
| D8 | Create request UI omits encounter/admission | Weak visit link |
| D9 | No cancellation reason on request | Audit |
| D10 | Controller OR-keys allow enter to **hit** issue endpoint; service then Forbidden — OK if clients handle 403 | UX/ops |
| D11 | Template vs API permission names for lab tech | Provisioning risk |
| D12 | `registerUnit` has no supplier, document, inspection | External receipt incomplete |
| D13 | No movement ledger | Reconciliation |

### Potential risks (not fully proven)

| ID | Risk |
| --- | --- |
| R1 | Concurrent reserve of last eligible unit: pessimistic lock **per row**, not “one available O+” allocation |
| R2 | Unique `unit_no` collision on apply if dirty data exists — scan required before migrate |
| R3 | HTTP audit may capture blood-bank bodies — donor TTI later would need tighter sanitization |
| R4 | Soft-delete without haemovigilance retention rules |

### Unverified

- Live DB: whether `blood_bank_requests` / `blood_bank_units` exist in local or production.
- Browser UAT, 403 empty states, live role rows.
- Whether Jalaram currently screens donations on-site vs sends to KNBTS.
- Cold-chain equipment inventory.

---

## 11. Screen-by-screen acceptance checklist (future UAT, not this pass)

**Blood Bank desk**

- [ ] Unauthorised user cannot open (nav + API).
- [ ] Stock unavailable shows **reason**, not zero fridge units.
- [ ] Stock available: on-hand ≠ available-to-issue; quarantine/reserved/expired distinct.
- [ ] Create request requires patient + product + qty; persists.
- [ ] Cannot skip grouping/crossmatch to issue.
- [ ] Issue without `lab_results:verify` fails.
- [ ] Issued request cannot be issued again.
- [ ] Cancelled/issued rows hide transition form.
- [ ] Empty list copy.
- [ ] Stock HTTP error is not rendered as 0.

**Not testable until built:** donor desk, receipt desk, reservation board, handover, transfusion, recall, reports.

---

## 12. Questions requiring Jalaram clinical / operational approval

1. Who is the **authorised blood establishment** for TTI testing and component preparation (KNBTS vs hospital vs both)?
2. May Jalaram **collect** whole blood, or only **receive** prepared units?
3. Mandatory TTI panel and who **releases** a unit (named role)?
4. Emergency uncrossmatched issue — allowed? Who authorises? (Do **not** encode until written.)
5. Compatibility rules (ABO/Rh, plasma, platelets, electronic vs serological XM).
6. Storage ranges and expiry **by product** (do not invent).
7. Return-to-stock: time out of fridge, temperature, visual inspection, who signs.
8. Ward handover: which ward roles confirm receipt.
9. Transfusion documentation: start/stop, volume, two-person check.
10. Reaction reporting path (hospital haemovigilance + national).
11. Donor confidentiality: which roles see deferral/TTI.
12. Charging: blood as lab request vs separate charge (Phase 5B clearance is **not** wired here).
13. Apply `1771000000002` / `0003` on which environments, after `unit_no` duplicate scan.

---

## 13. Phased implementation roadmap (planning only)

Dependency: **unit ledger (existing entity) before issue-from-stock**; **release evidence before available**; **request↔unit link before true issue**; **handover after issue**; **donor module is a new SoT and waits for Q1–Q3**.

| Phase | Intent | Depends on | Safer note |
| --- | --- | --- | --- |
| **BB-1** | Inventory SoT + dashboard foundation | Review of `BloodBankUnit`; **do not** new table | Apply `1771000000003` only after approval; keep fail-closed if missing; no fake zeros |
| **BB-2** | External receipt, quarantine, acceptance, release | BB-1 | Additive columns on **same** unit row (supplier, document, inspection) — **schema later, stop if rejected** |
| **BB-3** | Local donor, eligibility, consent, collection, testing trace | Policy Q1–Q3 | **New donor/donation tables** — not a duplicate of patients or units; donation **cannot** skip to available |
| **BB-4** | Request, sample ID, grouping, XM, reservation safeguards | BB-1 | Tighten existing request + reserve vs eligible units; still no invented XM algorithm |
| **BB-5** | Issue, handover, transfusion outcome | BB-4 | New outcome fields/events; request issue must consume reserved units |
| **BB-6** | Return, discard, recall, reactions, bidirectional trace | BB-5 | Movement or event log; do not silent-edit issued rows |
| **BB-7** | Dashboard split buckets, reports, role keys | BB-1 metrics already sketched; extend after BB-5/6 | Dedicated permissions; donor screens restricted |
| **BB-8** | Isolated tests, clinical UAT, approved rollout | All prior | No production migrate until BB-8 sign-off |

Do **not** combine BB-3 into BB-1. Do **not** start BB-5 until a unit can be reserved atomically against a request.

---

## 14. Files and tests likely to change in future phases

| Phase | Likely files | Tests |
| --- | --- | --- |
| BB-1 | `blood-bank.service.ts`, `BloodBankDesk.tsx`, maybe migration apply process (ops, not auto-run) | `blood-bank.spec.ts`, `blood-bank-stock.spec.ts` |
| BB-2 | `blood-bank-unit.entities.ts`, `1771000000003` **or follow-on additive migration**, register DTO/controller, desk receipt UI | register/quarantine/release tests |
| BB-3 | **new** donor/donation modules under laboratory or dedicated; permissions; **not** inventory | donor confidentiality + no skip-to-available |
| BB-4 | `blood-bank-policy.ts`, `updateStatus`, reserve path, request UI | skip-XM, reserve concurrency, qty vs units |
| BB-5 | service + new handover/outcome persistence, nursing/ward UI | issue consumes units; double issue |
| BB-6 | events/movements, recall query | bidirectional trace fixtures |
| BB-7 | desk/dashboard, `role-templates.ts`, nav | permission matrix |
| BB-8 | spec expansion only + UAT script | full backend Jest; **no** prod DB |

Unrelated dirty tree (pharmacy, insurance, diagnostics, Phase 5B `diagnostic-clearance.ts`, etc.) must stay untouched in those phases except explicit overlap.

---

## 15. What was and was not verified

**Verified this pass:** git baseline; source of all blood-bank files listed; request and unit state machines; stock fail-closed behaviour in code and isolated tests; permissions on controller; UI does not register units; no donor/transfusion identifiers in TS/TSX; TypeORM synchronize false; WHO/Kenya **guidance citations** as policy context (not as implemented software).

**Isolated tests exist; not re-run this BB-0 pass** (no test runner required for discovery). Prior Phase 3 reported those specs passing inside a full suite.

**Not verified:** any database, production, browser, live RBAC rows, real KNBTS connectivity, cold chain, or that `1771000000002` exists on a given server.

**Guidance (not software):**

- WHO blood safety and availability fact sheet: mandatory screening of donations for HIV, HBV, HCV, syphilis; ABO/RhD; quality-assured systems. https://www.who.int/news-room/fact-sheets/detail/blood-safety-and-availability  
- WHO donated-blood testing: https://www.who.int/teams/health-product-policy-and-standards/standards-and-specifications/blood-and-products-of-human-origin/quality-and-safety/donation-testing  
- WHO quality system in blood establishments (2023/24). https://www.who.int/publications/i/item/9789240086579  
- WHO blood cold chain defined as temperature control from collection to transfusion (centralization guidance).  
- Kenya Policy on Donation, Transfusion and Transplant of Human Derived Medical Products (2022, 2nd ed., MOH/KNBTTS). https://www.health.go.ke/sites/default/files/2023-12/Kenya-Policy-on-Human-Derived-Medical-Products-DonationsTransfus..._1.pdf  
- Kenya National Standards for Blood Transfusion Services (MoH guidelines portal).

No transfusion thresholds, XM tables, storage °C, or expiry days were encoded as product rules.

---

## Completion

**Root cause of missing physical stock dashboard (source):** units ledger table not present according to the service’s `information_schema` check; UI respects `available: false`. Migration `1771000000003` is in the working tree and **must not be auto-applied**.

**Proposed sequence:** BB-1 → BB-2 → BB-4 (in parallel with policy for BB-3) → BB-5 → BB-6 → BB-7 → BB-8. **BB-3 waits on Jalaram/KNBTS responsibility answers.**

**Git/application:** this task added **only** `docs/audits/afyasasa-bb-0-blood-bank-architecture-2026-10-21.md`. No other files, database objects, runtime services, configuration flags, commits, or deployments were changed.

**Stop.** Wait for explicit review before BB-1.
