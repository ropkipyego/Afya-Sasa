# AfyaSasa Phase 3 — blood bank completion, revenue dashboard and related hardening

**Date:** 20 October 2026 (Africa/Nairobi)  
**Baseline:** Phase 1 + Phase 2 reports; dirty tree at HEAD `4a31826e7a5ce3c853b8f63f8c517fd5ec04428e`  
**Nature:** Local application/UI/tests. **No commit, no migration apply, no production.**

```
PRODUCTION CONNECTED: NO
MIGRATIONS APPLIED: NO (1771000000003 written, not run)
COMMITS / PUSH / RESET / STASH: NONE
SYNCHRONIZE / DEMO SEED / AUTO-MIGRATE: unchanged (false)
TENANT SELECTOR: still hidden
SCHEMA: demo (not renamed)
PARALLEL SoT TABLES: none (units table is a new domain ledger, not a second request table)
LOGGED-IN UAT / BROWSER: NO
```

Phase 0, Phase 1, Phase 2 and the 15 October departmental audit were kept. Prior uncommitted clinical/pharmacy/diagnostic work was not reverted.

---

## 1. Existing blood-bank work reused

Already present (uncommitted, not replaced):

- Entity `demo.blood_bank_requests` (`blood-bank.entities.ts`)
- Untracked migration `1771000000002-BloodBankRequests.ts`
- `BloodBankService` list/create/status + `tableReady` guard
- Routes under `/laboratory/blood-bank`
- UI `BloodBankDesk.tsx` (laboratory tab)
- Permissions: read `lab_requests:read`; create `lab_requests:create`; status enter **or** verify

That model is a **patient request desk**, not fridge units. Treating `units` on a request as physical stock would be false. Phase 3 kept requests as SoT for **requests** and added a **separate** unit entity/migration for stock.

---

## 2. Files changed this batch (reason)

| File | Why |
| --- | --- |
| `backend/src/laboratory/blood-bank-policy.ts` | Request transitions; issue requires grouping+crossmatch **and** `lab_results:verify`; metric definitions |
| `backend/src/laboratory/blood-bank-stock.ts` | Unit buckets; no double-count; available excludes unscreened/quarantine/expired/reserved/issued |
| `backend/src/laboratory/blood-bank-unit.entities.ts` | Unit ledger entity (`demo.blood_bank_units`) |
| `backend/src/database/migrations/1771000000003-BloodBankUnits.ts` | **Additive, not applied** |
| `backend/src/laboratory/blood-bank.service.ts` | Transition locks; stock API; unit register/transition if table exists |
| `backend/src/laboratory/laboratory.controller.ts` | `GET blood-bank/stock`; unit POST routes |
| `backend/src/laboratory/laboratory.module.ts` | Register `BloodBankUnit` |
| `backend/src/laboratory/blood-bank.spec.ts` + `blood-bank-stock.spec.ts` | Request/stock tests |
| `backend/src/reporting/revenue-summary.ts` | Charge/collection rules + finance gate |
| `backend/src/reporting/reporting.service.ts` | `compactRevenueSummary`; department revenue gated |
| `backend/src/reporting/reporting.controller.ts` | `GET /reports/revenue-summary` |
| `backend/src/reporting/department-revenue.spec.ts` | Gate + aggregation tests |
| `backend/src/core/admin/role-templates.ts` | Claims-officer description only (no silent `payments:initiate`) |
| `frontend/src/components/layout/DepartmentRevenueStrip.tsx` | Compact ledger; unavailable ≠ zero |
| `frontend/src/components/investigations/BloodBankDesk.tsx` | Stock panel + ordered request actions |

Phase 2 insurance `/ready` / cashier atomicity **not reverted**.

---

## 3. Blood-bank metric definitions

Physical stock is computed only when `demo.blood_bank_units` exists. Otherwise the API returns `available: false` and labels request counts as **requests**, not fridge units.

| Metric | Definition | Exclusions |
| --- | --- | --- |
| physicalOnHand | Not issued, not discarded | Issued, discarded |
| availableForIssue | `status=available` and `screening=released` and not expired | Unscreened, reactive, quarantine, reserved, issued, expired |
| reserved | Reserved for a request, not expired | |
| issuedInPeriod | `issuedAt` in selected range | Counted once |
| quarantinedOrAwaitingScreening | Awaiting screening, reactive, or quarantined | Receipt ≠ release |
| expired | Expiry ≤ now and still on shelf | |
| nearingExpiry | Available/reserved, expiry within 7 days | Overlay, not a second physical count |
| byGroup | ABO/Rh of on-hand units | Issued/discarded omitted |

Each unit has one **primary bucket**. Compatibility is **not** computed.

**Request workflow (existing table):** `requested → grouped → crossmatched → issued`. Issue blocked without grouping and crossmatch text **and** `lab_results:verify`. Status update uses a pessimistic lock. Duplicate issue rejected.

---

## 4. Revenue summary

**SoT:** `demo.charges` and `demo.payment_transactions`. Not QuickBooks, not profit, not inventory transfers.

| Metric | Rule |
| --- | --- |
| Charges raised | `amount_owed` of charges created in period, **excluding cancelled**. Partial payment still counts the full raised amount once |
| Collections | Completed payments, excluding refunds and `method=waived` |
| Refunds | Completed rows with `metadata.kind=refund` |
| Waivers | `amount_waived` on non-cancelled charges in period |
| Outstanding | Current remaining on `owed` / `partially_paid` (snapshot, not period-limited) |

**Authorisation:** `canViewRevenueSummary` = director/admin/superadmin **or** `payments:read` **or** `payments:initiate`. `reports:read` or `lab_requests:read` alone is **not** enough. Endpoint `GET /reports/revenue-summary` still lists `reports:read` in OR keys; **service returns `available: false`** for clinical-only users. UI does not render KES 0 as a verified result.

Department headers reuse `DepartmentRevenueStrip` (already on lab/other workspaces). Clinical users see an explicit “not for this role” note.

---

## 5. Permission / audit notes

| Action | Permission |
| --- | --- |
| List requests / stock dashboard | `lab_requests:read` |
| Create request / register unit | create or enter |
| Grouping / crossmatch / quarantine | enter **or** verify |
| **Issue request or unit** | **`lab_results:verify` required in service** (controller still OR enter\|verify; issue is extra-checked) |
| Revenue summary | finance/director as above |
| Insurance workspace | Phase 2 `payments:read`; claim POST still initiate\|manage |
| `/ready` | Process+DB only; not clinical readiness |
| Cashier payment+charge | Phase 2 same transaction; lab/encounter flags still post-commit |

Audit: HTTP interceptor still records laboratory POSTs. `/ready` remains skipped.

---

## 6. Tests and builds (this pass)

Installed Jest / nest / frontend `npm run build`. Not `npx`.

| Check | Result |
| --- | --- |
| `git diff --check` | pass (exit 0) |
| Focused (blood-bank, stock, department-revenue, reporting-metrics, cashier-atomic, insurance, health) | **7 suites, 40 passed** |
| Full backend Jest `--runInBand --forceExit` | **82 suites passed; 419 passed; 20 skipped; 439 total**; ~14.5 s |
| Backend `nest build` | pass |
| Frontend `tsc -b && vite build` | pass (~1.05 s) |
| Frontend unit runner | none |
| Browser / staff UAT | **not-run** |
| Production | **not-run** |

Phase 2 was 81 / 410. This pass added stock/policy/revenue cases. Open-handle force-exit unchanged (pre-existing).

---

## 7. Implemented vs tested vs exercised vs production

| Item | Implemented | Automated-tested | Locally exercised | Production |
| --- | --- | --- | --- | --- |
| Request transition + verify-to-issue | Yes | Yes | No | No |
| Unit stock maths | Yes | Yes | No | No |
| Unit table persistence | Code + **unapplied** migration | Guard when table missing | No | No |
| Revenue summary API/UI | Yes | Aggregation + gate tests | No | No |
| Clinical finance leak closed | Yes (available:false) | Yes | No | No |

---

## 8. Migration proposed, not applied

`1771000000003-BloodBankUnits.ts` creates `demo.blood_bank_units` (`unit_no` unique). **Do not apply** until:

1. Confirmed production/local schema vs `1771000000002`
2. Duplicate `unit_no` scan (empty table expected)
3. Backup + written approval
4. `TYPEORM_MIGRATIONS_RUN` remains false; one-off SQL only

Until then, stock dashboard shows **unavailable**, not fake zeros.

Batch uniqueness for pharmacy lots remains the older planned SQL — still not applied.

---

## 9. Remaining risks and decisions

1. **Clinical governance:** grouping/crossmatch are recorded strings, not antibody panels or electronic compatibility.
2. **insurance_officer** still cannot POST claims without `payments:initiate` / `payments:manage`.
3. Cashier **ancillary** lab/encounter updates remain after commit.
4. Payment **unique receipt** still JSON/2-minute window only.
5. Department strip now **hides KES from lab-only roles** — operational change vs previous leak.
6. Unit register/issue APIs exist but are inert until the units table is applied.
7. Not production-ready as a transfusion service.

**Next recommended batch (after review):** authorised apply of `1771000000003` on non-prod; unit receipt/release UI against real rows; optional claims-officer initiate grant; payment unique-index duplicate scan; wrap cashier lab/encounter flags in the same transaction if finance agrees.

---

## Explicit confirmation

No production systems, hospital databases, migrations, deployments, commits, pushes or data resets were performed.
