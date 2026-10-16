# Defects, risks, and prioritized roadmap

No production or application code was changed for this audit. Recommendations are for a **later, authorised** task.

## Classification key

- **Confirmed defect:** independently reproduced here. **None** (no live Rx, payment, or clinical write).
- **Reported unreproduced:** staff observation without auditor reproduction.
- **Suspected risk:** source inspection shows a plausible failure mode.
- **Missing feature:** confirmed absent.
- **Improvement:** desirable, not required for safe current operation.

## Register

| ID | Type | Item | Sev | Evidence | Why this severity | Next step |
| --- | --- | --- | --- | --- | --- | --- |
| PH-R1 | Reported | Dispensing issues at pharmacy | **P1** until characterised | User report | Could be wrong drug, stock, or charge — unknown until captured | Authorised synthetic dispense UAT; capture API body, order metadata, batch, ledger, charge. No live patient if avoidable |
| PH-S1 | Suspected | Name-equality SKU match | P1 suspected | `PharmacyWorkspace.tsx` `matchCatalogItem` | Wrong item if names collide and `itemId` missing | Fail closed without `itemId` |
| PH-S2 | Suspected | Charge uniqueness app-level | P2 | No unique on charge `serviceEntityId` | Duplicate charge if lock bypassed | Keep order lock; unique after data audit |
| PH-S3 | Suspected | Unapplied session/lot SQL | P2 | planned SQL files | Concurrent import/take edge | Director/IT; **read-only** duplicate-lot snapshot, not the test fixture |
| PH-S4 | Operational | Local images older than `507cc02` | P1 ops | docker created 11:39 EAT vs commit 17:25 | Staff may not run stock-integrity code | Rebuild **local** when instructed; not production from this audit |
| LAB-F44 | Policy block | Result amend off | P2 (by design) | `AFYASASA_LAB_AMENDMENT_ENABLED=false` | Cannot amend verified results | Keep false unless clinical governance changes |
| LAB-TPL | Process | Lab report templates | P2 | clinical approval register | Reports may not match lab policy | Lab clinical sign-off |
| FIN-CERT | Process | Director finance uncertified | P2 | metric definitions + no worksheet | Wrong management decisions if treated as GL | Period worksheet billed vs collected vs outstanding vs QB |
| KPI-PH | Missing metric | Pharmacy activity on Director | P3 | definitions: Data unavailable | Gap in intelligence, not a dispense blocker | Design aggregate from orders, **not** raw movements |
| BB-NI | Missing | Blood bank | P3 unless transfusion is live workflow | no module | Do not store units as medicine lots | Separate programme if required |
| INT-SHA | Unverified live | SHA eligibility | P2 | local API only | Eligibility capture ≠ cover | Sandbox only when authorised |
| INT-MPESA | Unverified live | STK | P2 | code + unit tests | Duplicate or failed collections possible in field | No real STK this audit |
| INT-QB | Unverified live | QuickBooks | P2 | pending analytics | Double-counting if EMR called revenue | Keep QB as GL |
| MAIL | CU | SMTP delivery | P2 | 14 Oct NOT_CONFIGURED / allowlist | Password reset / report share may fail | Config review without sending PHI |
| BIO | PI | Biometrics | P3 | device required | Front office identify incomplete without hardware | Hardware programme |
| PACS | Missing | Imaging PACS | P3 | attachments only | File refs ≠ viewer | Out of current EMR core |
| IMG-AGE | Ops | Deploy lag | P1 local | image vs HEAD | Integrity work not in running containers | Controlled local rebuild |

**No P0** was assigned: no confirmed patient-safety harm, unauthorised access incident, proven duplicate payment, or proven stock corruption in this audit. Elevating PH-R1 to P0 would require evidence of wrong-drug issue or ledger/charge mismatch on a real dispense.

## Preserve working functionality

Do **not** rewrite OPD, prescription create, FEFO allocate, or payment posting. Targeted hardening: SKU identity, session uniqueness (if Director approves schema), image alignment, pharmacy UAT.

## Implementation phases (after this documentation task)

### Phase A — Diagnose dispensing (dependency: none except test patient policy)

**Acceptance:** One synthetic prescription: prescribe → queue → confirm → remaining qty, `qtyOnHand`, `DISPENSE` ledger, charge `dispenseOps` agree; error bodies captured for insufficient stock and double-confirm.  
**Tests:** existing inventory/payments specs; add a UI fixture if `itemId` missing.  
**Do not:** touch live prescriptions.

### Phase B — Align running local code with `507cc02` (dependency: IT window)

**Acceptance:** Local image created-at ≥ commit time; health still ok; no production deploy from this plan.  
**Tests:** re-run isolated PG inventory + full Jest on disposable DBs only.

### Phase C — Inventory schema decisions (dependency: read-only lot audit)

**Acceptance:** Duplicate-lot query on **authorised hospital snapshot**; then decide whether to apply unique index / import session table.  
**Do not:** run planned SQL blindly.

### Phase D — Finance certification (dependency: Finance owner)

**Acceptance:** Signed worksheet for one closed period: billed ≠ collected ≠ outstanding ≠ QB.  
**Tests:** `reporting-metrics.spec.ts` plus worksheet.

### Phase E — Lab governance (dependency: lab clinical)

**Acceptance:** Template register signed; amendment flag remains false unless policy says otherwise.

### Phase F — Integrations (only with sandbox credentials)

SHA/M-Pesa/QB/email in **sandbox**. Never production callbacks from a laptop.

## Regression minimum for any later code change

- `inventory.service.spec.ts`, `stock-posting.spec.ts`, `stock-integrity.spec.ts`
- Isolated `inventory-pg.integration.spec.ts` if disposable PG available
- `payments.service.spec.ts` pharmacy charge
- `opd.service.spec.ts` doctor queue
- `pharmacy-prescription.spec.ts`
- Frontend `tsc -b`

Do not run M-Pesa STK, SMS bulk, SHA eligibility against live IDs, or backup restore.
