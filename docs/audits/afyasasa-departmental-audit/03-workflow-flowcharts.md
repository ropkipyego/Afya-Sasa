# Workflow flowcharts (actual implementation)

Diagrams follow source at `507cc02`. Grey / dashed nodes are **unverified**, **gated**, or **not implemented**. They are not drawn as if they already succeed in production.

## 1. Patient registration and routing

```mermaid
flowchart TD
  search["Front office: search GET /patients"]
  found{Match?}
  open["Open existing patient file"]
  dup["POST /patients/duplicates + unique identifier"]
  reg["POST /patients"]
  checkin["POST /opd/encounters"]
  vt{visitType}
  doc["destination doctor → triage/OPD queue"]
  lab["laboratory_only / diagnostic → LAB queue"]
  rad["radiology_only → RAD queue"]
  openToday{Open OPD visit today?}
  refuse["400: continue existing visit"]

  search --> found
  found -->|yes| open
  found -->|no| dup --> reg --> checkin
  checkin --> openToday
  openToday -->|yes| refuse
  openToday -->|no| vt
  vt -->|new / follow_up / referral| doc
  vt -->|laboratory_only / diagnostic| lab
  vt -->|radiology_only| rad
```

Check-in does **not** insert a consultation charge. Reception **displays** clinic `consultationFee`. Cashier may still post a consultation charge later (**unverified** whether staff always follow diagnostic-only policy).

## 2. OPD consultation and completion

```mermaid
flowchart TD
  arr["Encounter registered"]
  tri["POST /opd/encounters/:id/triage"]
  q["GET /opd/doctor/queue — scoped to actor unless supervisor"]
  soap["POST consultations SOAP"]
  dx["POST diagnoses"]
  ord["Orders: lab / radiology / pharmacy"]
  complete["PATCH status completed via workflow service"]
  fu["Optional follow-up appointment"]

  arr --> tri --> q --> soap --> dx --> ord --> complete --> fu
```

Invalid status transitions are rejected by `EncounterWorkflowService`.

## 3. Prescription → dispense → stock → charge

```mermaid
flowchart TD
  rx["POST /clinical-orders/pharmacy/prescription\nstatus requested — no stock change"]
  q["GET /clinical-orders pharmacy queue"]
  pick["UI: itemId or name match against catalogue"]
  confirm{"confirm: true?"}
  lock["Txn: lock order FOR UPDATE, FEFO lots"]
  stock{Usable qty enough?}
  fail["400 insufficient / expired / cancelled / already dispensed"]
  write["qtyOnHand -= ; ledger DISPENSE"]
  chg["upsertPharmacyCharge same txn"]
  chgfail["Forced/failed charge → ROLLBACK stock"]
  pay["Cashier collects later — separate payment"]

  rx --> q --> pick --> confirm
  confirm -->|no| fail
  confirm -->|yes| lock --> stock
  stock -->|no| fail
  stock -->|yes| write --> chg
  chg -->|error| chgfail
  chg -->|ok| pay
```

**Unverified in this audit:** live mismatch between Rx qty, ledger, and charge. **User-reported:** some dispensing problems (see `04-opd-and-pharmacy-assessment.md`).

## 4. Laboratory

```mermaid
flowchart TD
  req["POST /laboratory/requests"]
  smp["POST samples + barcode"]
  recv["POST samples/:id/receive"]
  res["POST results / panel"]
  ver["POST requests/:id/verify"]
  report["GET requests/:id/report"]
  cancel["POST cancel — lab_requests:cancel only"]
  amend["POST amend — AFYASASA_LAB_AMENDMENT_ENABLED"]

  req --> smp --> recv --> res --> ver --> report
  req -.-> cancel
  ver -.-> amend
```

Amend is **blocked** while the compose flag is false. Template layouts exist; **clinical sign-off of layouts is outstanding**.

## 5. Radiology

```mermaid
flowchart TD
  req["POST /radiology/requests"]
  st["PATCH status: requested → scheduled → in_progress"]
  rep["POST reports"]
  ver["POST verify"]
  att["Optional attachments — not a PACS"]

  req --> st --> rep --> ver
  st --> att
```

## 6. Inpatient

```mermaid
flowchart TD
  admit["POST /inpatient/admissions — bed occupied"]
  care["Notes, nursing vitals, MAR, orders"]
  tr["POST transfers"]
  sum["POST discharge-summary"]
  dis["POST discharge — summary required"]
  acc["Accommodation charge job if catalogue priced"]

  admit --> care --> tr
  care --> acc
  care --> sum --> dis
```

MAR does **not** decrement `inventory_batches`. Inpatient medicines still go through pharmacy dispense if prescribed.

## 7. Emergency

```mermaid
flowchart TD
  reg["POST /emergency/register"]
  tri["POST :id/triage"]
  bay["POST assign-bay"]
  work["notes / observation"]
  disp["POST disposition"]
  out["discharge / referral / admit — UAT unverified"]

  reg --> tri --> bay --> work --> disp --> out
```

ED entities are **separate** from OPD `encounters` (`emergency_encounters`).

## 8. Charge, payment, receipt, GL

```mermaid
flowchart TD
  charge["demo.charges amount_owed — not cash"]
  pay["demo.payment_transactions completed"]
  rec["Receipt reprint from payment"]
  qb["QuickBooks queue / QBWC — GL"]
  outst["Outstanding = owed - paid - waived"]

  charge --> pay --> rec
  pay -.-> qb
  charge --> outst
```

There is **no** separate invoice table in this inspection. A payment is not a charge. QB is not replaced by EMR totals.

## 9. Procurement → pharmacy availability

```mermaid
flowchart TD
  rec["POST /inventory/receipts RECEIPT"]
  req["Requisition approve → issue ISSUE"]
  trf["Transfer ship TRANSFER_OUT → receive TRANSFER_IN"]
  pharm["PHARMACY location batches"]
  disp["DISPENSE on confirm"]

  rec --> pharm
  req --> pharm
  trf --> pharm
  pharm --> disp
```

One ledger. Stock-take posts `STOCK_TAKE` variance, not counted qty as receipt.

## 10. Authentication and departmental access

```mermaid
flowchart TD
  login["POST /auth/login — JWT + refresh cookie"]
  nav["Frontend nav filtered by permission"]
  api["PermissionsGuard OR-list on handler"]
  deny["403 Permission denied"]

  login --> nav
  login --> api
  api -->|missing all keys| deny
```

Hiding a menu is not security.

## 11. Report generation and delivery

```mermaid
flowchart TD
  rpt["GET /reports/*"]
  share["Report share / email templates"]
  smtp["MailService — delivery flag / allowlist"]
  off["EMAIL_DELIVERY_ENABLED historically false on compose"]

  rpt --> share --> smtp
  smtp --> off
```

SQL backup list ≠ full system backup. UI restore **403**.

## 12. Director dashboard data flow

```mermaid
flowchart TD
  tables["demo.encounters, patients, admissions,\nlab_requests, radiology_requests,\ncharges, payment_transactions, ..."]
  svc["ReportingService.executiveAnalytics"]
  fin{canViewDirectorFinance?}
  hide["Finance fields null"]
  ui["ExecutiveAnalyticsDashboard"]
  def["docs/AFYASASA_DASHBOARD_METRIC_DEFINITIONS.md"]

  tables --> svc
  svc --> fin
  fin -->|no| hide --> ui
  fin -->|yes| ui
  def -.-> ui
```

Pharmacy activity indicator: **data unavailable** (not invented from movements). Figures are **not Finance-certified**.
